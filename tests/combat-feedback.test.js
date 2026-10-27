"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const Core = require("../js/core.js");
const ClassCombat = require("../js/class-combat.js");
const D = require("../js/classic-data.js");
const originalSkills = new Set(["first_aid",...Object.values(D.classes).map(cls=>cls.skill).filter(Boolean)]);
const modulePath = path.resolve(__dirname, "../js/combat-feedback.js");
function feedback() {
  assert.ok(fs.existsSync(modulePath), "combat feedback module must exist");
  return require(modulePath);
}
function payload(overrides = {}) {
  return { kind: "attack", source: { x: 100, y: 200 }, target: { x: 130, y: 210 }, facing: 1,
    weaponType: "sword", skillId: null, result: null, phase: "direct", amount: null, magic: false, ...overrides };
}
function makeState(C = Core, classId = "swordsman", seed = 123456789) {
  const s = C.createState(), cls = D.classes[classId];
  s.classId = classId; s.weaponSchool = cls.weaponType; s.job = cls.tier ? "Swordman" : "Novice";
  s.equipment.weapon = cls.trainingWeapon; s.seed = seed;
  for (const id of originalSkills) if (C.skillAvailable(s, id)) s.skills[id] = D.skills[id].owner ? 2 : s.skills[id];
  s.player.hp = C.stats(s).maxHp; s.player.sp = 1000;
  s.player.x = 250; s.player.y = 310;
  s.monsters.forEach((m, i) => { m.x = i ? 800 : 280; m.y = i ? 100 : 310; m.hp = 10000; m.cd = 999; });
  return s;
}
const events = (s) => s.combatFeedback?.events || [];
function advance(C, s, seconds) { for (let i = 0; i < Math.round(seconds * 10); i++) C.tick(s, .1); }
function canonical(s) {
  const clean = JSON.parse(JSON.stringify(s)); delete clean.combatFeedback;
  // Normalize only approved schema/cosmetic additions. New skills are unlearned
  // in these retained-signature fixtures; assert that before projecting them.
  delete clean.skillVersion;
  for(const id of Object.keys(clean.skills||{})) if(!originalSkills.has(id) && !['bash','magnum','provoke'].includes(id)) {
    assert.equal(clean.skills[id],0,id+' must remain unlearned in retained parity');delete clean.skills[id];
  }
  if(clean.classCombat) {
    delete clean.classCombat.signals;delete clean.classCombat.signalSeq;
    if(JSON.stringify(clean.classCombat)===JSON.stringify({buffs:{},traps:[],orbCharges:0,orbTimer:0}))delete clean.classCombat;
  }
  for (const id of ['bash','magnum','provoke']) if (clean.skills) delete clean.skills[id];
  for (const id of ['rusty_sword','yak_greatsword']) if (clean.inventory) delete clean.inventory[id];
  for (const m of clean.monsters || []) delete m.provoke;
  for (const e of clean.effects || []) for (const key of ['kind','amount','critical','magic','target']) delete e[key];
  const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
  return sort(clean);
}

test("event module snapshots finite coordinates, fixes durations and has a browser API", () => {
  const F = feedback(), s = {}, input = payload();
  const e = F.emit(s, { ...input, id: 999, age: 9, duration: 99, ignored: true });
  assert.deepEqual(Object.keys(e).sort(), ["id", "kind", "source", "target", "facing", "weaponType", "skillId", "result", "phase", "amount", "magic", "age", "duration"].sort());
  assert.deepEqual(e, { id: 1, ...input, age: 0, duration: .28 });
  input.source.x = 999; input.target.y = 999;
  assert.equal(e.source.x, 100); assert.equal(e.target.y, 210);
  assert.ok(Object.isFrozen(e.source)); assert.ok(Object.isFrozen(e.target));
  assert.equal(F.emit(s, payload({ kind: "skill", skillId: "arun_slash" })).duration, .45);
  assert.equal(F.emit(s, payload({ kind: "impact", result: "hit", amount: 4 })).duration, .25);
  const sandbox = {}; vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), sandbox);
  assert.equal(typeof sandbox.BCCombatFeedback.emit, "function");
  assert.equal(sandbox.BCCombatFeedback.MAX_EVENTS, 64);
});

test("invalid event payloads cannot allocate or mutate feedback state", () => {
  const F = feedback();
  const invalid = [null, {}, payload({ kind: "kill" }), payload({ source: { x: NaN, y: 2 } }),
    payload({ target: { x: 1, y: Infinity } }), payload({ facing: 4 }), payload({ facing: 1.5 }),
    payload({ weaponType: "" }), payload({ skillId: 123 }), payload({ result: "critical" }),
    payload({ phase: "later" }), payload({ amount: -1 }), payload({ amount: Infinity }), payload({ magic: 1 }), payload({ kind: new String("attack") }), payload({ kind: { toString: () => "attack" } })];
  for (const input of invalid) {
    const s = {}; assert.equal(F.emit(s, input), null); assert.deepEqual(s, {});
  }
  const s = {}; F.emit(s, payload()); const before = JSON.stringify(s);
  for (const input of invalid) F.emit(s, input);
  assert.equal(JSON.stringify(s), before);
});

test("bounded events age by simulation dt, clear and keep monotonically increasing IDs without RNG", () => {
  const F = feedback(), s = { seed: 97 };
  for (let i = 0; i < 70; i++) F.emit(s, payload());
  assert.equal(events(s).length, 64); assert.equal(events(s)[0].id, 7); assert.equal(events(s).at(-1).id, 70);
  F.tick(s, 0); F.tick(s, -1); F.tick(s, NaN); assert.equal(events(s)[0].age, 0);
  F.tick(s, .1); assert.equal(events(s)[0].age, .1);
  F.tick(s, .18); assert.equal(events(s).length, 0);
  assert.equal(F.emit(s, payload()).id, 71); F.clear(s); assert.equal(events(s).length, 0);
  assert.equal(F.emit(s, payload()).id, 72); assert.equal(s.seed, 97);
  const empty = {}; F.tick(empty, 1); F.clear(empty); assert.deepEqual(empty, {});
});

test("actual normal attack emits a committed facing and measured physical hit before the target dies", () => {
  const s = makeState(); const m = s.monsters[0]; m.hp = 1; s.seed = 1;
  const before = { x: m.x, y: m.y };
  assert.equal(Core.act(s, "attack", { target: m.uid }).ok, true);
  assert.deepEqual(events(s).map(e => e.kind), ["attack", "impact"]);
  const [a, impact] = events(s);
  assert.equal(a.facing, 1); assert.equal(a.weaponType, "sword"); assert.equal(a.skillId, null);
  assert.deepEqual(impact.target, before); assert.ok(impact.amount >= 1); assert.equal(impact.phase, "direct");
  assert.equal(impact.magic, false); assert.equal(impact.result, "hit"); assert.ok(m.dead > 0);
  m.x = 600; s.player.x = 600; assert.equal(a.target.x, 280); assert.equal(a.source.x, 250);
});

test("seeded real misses and physical criticals report their actual outcomes and consume the baseline RNG", () => {
  let miss = null, crit = null;
  for (let seed = 1; seed <= 500 && (!miss || !crit); seed++) {
    const s = makeState(Core, "swordsman", seed); s.stats.luk = 99; s.stats.dex = 1;
    Core.act(s, "attack", { target: s.monsters[0].uid });
    const e = events(s).find(e => e.kind === "impact");
    assert.ok(e, "every resolved attack has an impact outcome");
    if (e.result === "miss") { miss = e; assert.equal(e.amount, 0); assert.equal(s.monsters[0].hp, 10000); }
    if (e.result === "crit") { crit = e; assert.ok(e.amount > 0); assert.equal(e.magic, false); }
  }
  assert.ok(miss, "seed sweep must exercise miss"); assert.ok(crit, "seed sweep must exercise actual physical crit");
});

for (const [classId, cls] of Object.entries(D.classes)) {
  test(`${classId} ordinary attack reports the actual weapon type and magic flag`, () => {
    const s = makeState(Core, classId); const hp = s.monsters[0].hp;
    assert.equal(Core.act(s, "attack", { target: s.monsters[0].uid }).ok, true);
    const [a, i] = events(s); assert.ok(a); assert.ok(i);
    assert.equal(a.weaponType, cls.weaponType); assert.equal(i.magic, !!Core.stats(s).basicMagic);
    assert.equal(i.amount, hp - s.monsters[0].hp);
    if (i.magic) { assert.equal(i.result, "hit"); assert.equal(i.skillId, null); }
  });
}

for (const [id, skill] of Object.entries(D.skills).filter(([id, sk]) => sk.owner && originalSkills.has(id))) {
  test(`${id} signature emits exactly one committed cast and real direct impacts`, () => {
    const s = makeState(Core, skill.owner), m = s.monsters[0], before = m.hp;
    if (id === "orb_burst") s.classCombat = { buffs: {}, traps: [], orbCharges: 3, orbTimer: 12 };
    assert.equal(Core.act(s, "skill", { id, target: m.uid }).ok, true);
    const casts = events(s).filter(e => e.kind === "skill");
    assert.equal(casts.length, 1); assert.equal(casts[0].skillId, id); assert.equal(casts[0].magic, !!skill.magic);
    assert.equal(casts[0].facing, ["self", "sanctuary"].includes(skill.kind) ? 0 : 1);
    assert.equal(casts[0].phase, "direct");
    const impacts = events(s).filter(e => e.kind === "impact");
    assert.equal(impacts.length, ["self", "trap"].includes(skill.kind) ? 0 : skill.hits || 1);
    assert.equal(impacts.reduce((sum, e) => sum + e.amount, 0), before - m.hp);
    impacts.forEach(e => { assert.equal(e.skillId, id); assert.equal(e.phase, "direct"); assert.equal(e.result, "hit"); assert.equal(e.magic, !!skill.magic); });
    assert.equal(s.player.sp, 1000 - skill.sp); assert.equal(s.cooldowns[id], skill.cooldown);
  });
}

test("DOT and trap impacts carry actual skill, phase and finite kill locations", () => {
  for (const id of ["moon_venom", "tiger_rend", "naga_trap"]) {
    const s = makeState(Core, D.skills[id].owner), m = s.monsters[0];
    assert.equal(Core.act(s, "skill", { id, target: m.uid }).ok, true);
    feedback().clear(s); m.hp = 1;
    const location = { x: m.x, y: m.y };
    s.player.x = 100; s.player.y = 100;
    advance(Core, s, id === "naga_trap" ? .1 : 1);
    const e = events(s).find(e => e.kind === "impact"); assert.ok(e, id);
    assert.equal(e.skillId, id); assert.equal(e.phase, id === "naga_trap" ? "trap" : "dot");
    assert.deepEqual(e.target, location); assert.equal(e.result, "hit"); assert.ok(m.dead > 0);
    assert.deepEqual(e.source, id === "naga_trap" ? location : { x: 100, y: 100 });
  }
});

test("rejected attacks and casts produce no feedback and do not allocate transient state", () => {
  const cases = [
    s => Core.act(s, "attack", { target: "missing" }),
    s => { s.monsters[0].x = 900; return Core.act(s, "attack", { target: s.monsters[0].uid }); },
    s => { s.cooldowns.attack = 1; return Core.act(s, "attack", { target: s.monsters[0].uid }); },
    s => Core.act(s, "skill", { id: "lotus_bolt", target: s.monsters[0].uid }),
    s => { s.player.sp = 0; return Core.act(s, "skill", { id: "arun_slash", target: s.monsters[0].uid }); },
    s => { s.cooldowns.arun_slash = 1; return Core.act(s, "skill", { id: "arun_slash", target: s.monsters[0].uid }); },
    s => Core.act(s, "skill", { id: "arun_slash", target: "missing" }),
    s => { s.monsters[0].x = 900; return Core.act(s, "skill", { id: "arun_slash", target: s.monsters[0].uid }); },
    s => { s.inventory.potion = 100000; return Core.act(s, "attack", { target: s.monsters[0].uid }); },
  ];
  for (const run of cases) { const s = makeState(); assert.equal(run(s).ok, false); assert.equal(s.combatFeedback, undefined); }
  const s = makeState(Core, "divine_scribe"); s.monsters.forEach(m => m.x = 900); s.player.hp = Core.stats(s).maxHp;
  assert.equal(Core.act(s, "skill", { id: "sanctuary" }).ok, false); assert.equal(s.combatFeedback, undefined);
});

test("shared First Aid emits a real cast while removed skills cannot execute", () => {
  const s = makeState();
  assert.equal(Core.act(s, "skill", { id:'first_aid' }).ok, true);
  assert.equal(events(s).filter(e=>e.kind==='skill').length,1);
  assert.equal(events(s)[0].skillId,'first_aid');
  for (const id of ['bash','magnum','provoke']) {
    const current=makeState(),before=Core.serialize(current);
    assert.equal(Core.act(current,'skill',{id,target:current.monsters[0].uid}).ok,false);
    assert.equal(Core.serialize(current),before);
    assert.equal(events(current).length,0);
  }
});

test("class helpers forward direct, DOT and trap metadata while damage retains its boolean result", () => {
  const s = makeState(Core, "moon_shadow"), emitted = [], options = [];
  const h = { stats: Core.stats, feedback: (_s, e) => emitted.push(e), damage: (_s, _m, _p, _a, o) => { options.push(o); return true; } };
  assert.equal(ClassCombat.cast(s, "moon_venom", { target: s.monsters[0].uid }, h).ok, true);
  ClassCombat.tick(s, 1, h);
  assert.equal(emitted.length, 1); assert.equal(emitted[0].skillId, "moon_venom");
  assert.deepEqual(options.map(o => [o.skillId, o.phase]), [["moon_venom", "direct"], ["moon_venom", "dot"]]);
  const orb = makeState(Core, "orb_weaver"); Core.act(orb, "attack", { target: orb.monsters[0].uid });
  assert.equal(orb.classCombat.orbCharges, 1, "true damage result still enables landed-attack charge");
});

test("spawn, actual travel, death and import clear feedback; rejected travel and frozen time preserve it", () => {
  const s = makeState(); Core.act(s, "attack", { target: s.monsters[0].uid }); const F = feedback();
  const before = JSON.stringify(s.combatFeedback); Core.tick(s, 0); Core.tick(s, NaN); assert.equal(JSON.stringify(s.combatFeedback), before);
  assert.equal(Core.act(s, "travel", { direction: 1 }).ok, false); assert.equal(events(s).length, 2);
  Core.tick(s, .1); assert.equal(events(s)[0].age, .1);
  Core.spawn(s); assert.equal(events(s).length, 0);
  F.emit(s, payload()); s.player.x = 900; s.player.y = 280;
  assert.equal(Core.act(s, "travel", { direction: 1 }).ok, true); assert.equal(events(s).length, 0);
  F.emit(s, payload()); s.player.hp = 0; Core.tick(s, .1); assert.equal(events(s).length, 0); assert.equal(s.zone, 0);
  s.player.sp = Math.min(s.player.sp, Core.stats(s).maxSp);
  F.emit(s, payload()); const save = Core.serialize(s); assert.equal(save.includes("combatFeedback"), false);
  const raw = JSON.parse(save); raw.state.combatFeedback = { nextId: 90, events: [payload()] };
  assert.equal(Core.deserialize(JSON.stringify(raw)).combatFeedback, undefined);
});

test("retained numerical state, normalized saves and seeded RNG match after explicit schema and cosmetic projections", (t) => {
  // Recovery commit contains the exact published 1.12 runtime. Reconstruct its
  // engine privately so parity also works in a fresh source clone, without a
  // retained /tmp checkout or contamination from current CommonJS dependencies.
  const recovery = "eefb5c30bdf2a2f28ccc6210f25d3bebe3231149";
  if (!process.env.BC_BASELINE_ROOT) {
    try {
      execFileSync("git", ["cat-file", "-e", `${recovery}:js/core.js`], { cwd: path.resolve(__dirname, ".."), stdio: "ignore" });
    } catch {
      t.skip("Baseline parity requires recovery Git history or BC_BASELINE_ROOT; real action/outcome tests still run");
      return;
    }
  }
  const baselineRoot = process.env.BC_BASELINE_ROOT || fs.mkdtempSync(path.join(os.tmpdir(), "bc-parity-"));
  if (!process.env.BC_BASELINE_ROOT) {
    t.after(() => fs.rmSync(baselineRoot, { recursive: true, force: true }));
    fs.mkdirSync(path.join(baselineRoot, "js"));
    for (const file of ["core.js", "class-combat.js", "classic-data.js", "stat-rules.js", "item-rules.js", "auto-quest.js"])
      fs.writeFileSync(path.join(baselineRoot, "js", file), execFileSync("git", ["show", `${recovery}:js/${file}`], {
        cwd: path.resolve(__dirname, ".."), maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
      }));
  }
  assert.ok(fs.existsSync(path.join(baselineRoot, "js/core.js")), "untouched 1.12 baseline is required for parity");
  const Old = require(path.join(baselineRoot, "js/core.js"));
  let checkpoints = 0;
  for (const [classId, cls] of Object.entries(D.classes).filter(([id]) => !["swordsman","royal_duelist","city_guardian"].includes(id))) for (const seed of [1, 97, 123456789, 0xffffffff]) {
    const a = makeState(Old, classId, seed), b = makeState(Core, classId, seed);
    const check = (label) => {
      assert.deepEqual(canonical(b), canonical(a), `${classId}/${seed}/${label}: full gameplay state`);
      assert.deepEqual(canonical(JSON.parse(Core.serialize(b)).state), canonical(JSON.parse(Old.serialize(a)).state), `${classId}/${seed}/${label}: saved progress excluding removed content`);
      assert.equal(b.seed, a.seed); checkpoints++;
    };
    const action = (name, args) => { assert.deepEqual(Core.act(b, name, args), Old.act(a, name, args)); check(name); };
    check("initial");
    for (let round = 0; round < 3; round++) {
      action("attack", { target: a.monsters[0].uid });
      for (let i = 0; i < 14; i++) { Old.tick(a, .1); Core.tick(b, .1); check("attack tick"); }
      if (cls.tier) action("skill", { id: cls.skill, target: a.monsters[0].uid });
      for (let i = 0; i < 61; i++) { Old.tick(a, .1); Core.tick(b, .1); check("signature tick"); }
    }
    // Include actual drop/XP paths, failed guards, travel and recovery in parity.
    a.cooldowns = {}; b.cooldowns = {}; a.monsters[0].hp = b.monsters[0].hp = 1;
    action("attack", { target: a.monsters[0].uid });
    action("skill", { id: "missing", target: "missing" });
    a.player.x = b.player.x = 900; a.player.y = b.player.y = 280; action("travel", { direction: 1 });
    a.player.hp = b.player.hp = 0; Old.tick(a, .1); Core.tick(b, .1); check("death");
  }
  assert.equal(checkpoints, 12260, "all declared seeded action/tick checkpoints must execute");
  t.diagnostic(`${checkpoints} normalized state/save/RNG parity checkpoints across 13 unchanged classes and 4 seeds; excludes the approved sword-lineage redesign, deleted content, asserted zero-level new keys, skill schema metadata and cosmetic feedback only`);
});


test("real casts and basic attacks snapshot all four committed directions", () => {
  for (const [facing, dx, dy] of [[0, 0, 25], [1, 25, 0], [2, 0, -25], [3, -25, 0]]) {
    for (const action of ["attack", "skill"]) {
      const s = makeState(), m = s.monsters[0]; m.x = s.player.x + dx; m.y = s.player.y + dy;
      assert.equal(Core.act(s, action, { id: "arun_slash", target: m.uid }).ok, true);
      assert.equal(s.player.facing, facing); assert.equal(events(s)[0].facing, facing);
      assert.equal(events(s)[1].facing, facing);
    }
  }
});

test("early combo kills emit only the impacts actually resolved", () => {
  for (const id of ["royal_flurry", "garuda_combo"]) {
    const s = makeState(Core, D.skills[id].owner), m = s.monsters[0]; m.hp = 1;
    assert.equal(Core.act(s, "skill", { id, target: m.uid }).ok, true);
    assert.deepEqual(events(s).map(e => e.kind), ["skill", "impact"]);
    assert.equal(events(s)[1].skillId, id); assert.ok(m.dead > 0);
  }
});

test("AoE impacts match actual skill radius and individual damage rather than the cast center", () => {
  for (const id of ["lotus_storm", "sanctuary", "arcane_volley"]) {
    const skill = D.skills[id], s = makeState(Core, skill.owner), target = s.monsters[0];
    const center = skill.kind === "sanctuary" ? s.player : target;
    s.monsters[1].x = center.x; s.monsters[1].y = center.y + skill.radius;
    s.monsters[2].x = center.x; s.monsters[2].y = center.y + skill.radius + .01;
    const coords = s.monsters.slice(0, 2).map(m => ({ x: m.x, y: m.y }));
    assert.equal(Core.act(s, "skill", { id, target: target.uid }).ok, true);
    const impacts = events(s).filter(e => e.kind === "impact");
    assert.equal(impacts.length, 2); assert.deepEqual(impacts.map(e => e.target), coords);
    assert.equal(s.monsters[2].hp, 10000);
    impacts.forEach((e, i) => assert.equal(e.amount, 10000 - s.monsters[i].hp));
  }
});

test("rejected commands preserve existing event IDs, ages and coordinate snapshots", () => {
  const s = makeState(); Core.act(s, "attack", { target: s.monsters[0].uid });
  const before = JSON.stringify(s.combatFeedback);
  assert.equal(Core.act(s, "attack", { target: s.monsters[0].uid }).ok, false);
  s.player.sp = 0; assert.equal(Core.act(s, "skill", { id: "arun_slash", target: s.monsters[0].uid }).ok, false);
  assert.equal(JSON.stringify(s.combatFeedback), before);
});
