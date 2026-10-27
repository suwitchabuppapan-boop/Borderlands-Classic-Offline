"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../js/core.js");
const Combat = require("../js/class-combat.js");
const Data = require("../js/classic-data.js");

function setup() {
  const s = Core.createState();
  s.classId = "swordsman";
  s.weaponSchool = "sword";
  s.job = "Swordman";
  s.equipment.weapon = Data.classes.swordsman.trainingWeapon;
  for (const id of ["arun_slash", "swordsman_sweep", "swordsman_stance", "swordsman_provoke"]) s.skills[id] = ["arun_slash", "swordsman_provoke"].includes(id) ? 5 : 1;
  Object.assign(s.player, { x: 400, y: 300, sp: 1000 });
  s.monsters = s.monsters.slice(0, 1);
  Object.assign(s.monsters[0], { x: 440, y: 300, hp: 10000, cd: 999 });
  return s;
}
const cast = (s, id) => Core.act(s, "skill", { id, target: s.monsters[0]?.uid });
const gameplay = s => { const copy = JSON.parse(JSON.stringify(s)); delete copy.log; return copy; };
function advance(s, seconds) {
  while (seconds > 1e-9) { const dt = Math.min(.1, seconds); Core.tick(s, dt); seconds -= dt; }
}

test("different learned hotbar skills cannot commit during the same character action", () => {
  const s = setup();
  assert.equal(cast(s, "arun_slash").ok, true);
  const before = gameplay(s);
  for (const id of ["swordsman_sweep", "swordsman_stance", "first_aid"]) {
    assert.equal(cast(s, id).ok, false, id);
    assert.deepEqual(gameplay(s), before, "rejection preserves SP, cooldowns, effects, statuses and RNG");
  }
  assert.deepEqual(s.combatFeedback.events.filter(e => e.kind === "skill").map(e => e.skillId), ["arun_slash"]);
});

test("shared recovery follows the actual skill animation, then a different skill is usable before the first cooldown", () => {
  const s = setup();
  assert.equal(cast(s, "arun_slash").ok, true);
  const duration = s.combatFeedback.events.find(e => e.kind === "skill").duration;
  assert.equal(duration, .45);
  advance(s, duration - .01);
  const before = gameplay(s);
  assert.equal(cast(s, "swordsman_sweep").ok, false);
  assert.deepEqual(gameplay(s), before);
  advance(s, .01);
  assert.ok(s.cooldowns.arun_slash > 0, "individual cooldown is still running");
  assert.equal(cast(s, "swordsman_sweep").ok, true);
  assert.equal(s.cooldowns.swordsman_sweep, Data.skills.swordsman_sweep.cooldown);
});

test("normal attacks and skills share recovery while normal attack cadence is retained", () => {
  const s = setup(), target = s.monsters[0].uid;
  assert.equal(Core.act(s, "attack", { target }).ok, true);
  advance(s, .27);
  const before = gameplay(s);
  assert.equal(cast(s, "arun_slash").ok, false);
  assert.deepEqual(gameplay(s), before);
  advance(s, .01);
  assert.equal(cast(s, "arun_slash").ok, true);
  s.cooldowns.attack = 0;
  assert.equal(Core.act(s, "attack", { target }).ok, false, "attack cannot overlap the skill animation");
  advance(s, .45);
  assert.equal(Core.act(s, "attack", { target }).ok, true);
});

test("class combat direct entry and Auto suggestions share the same lock", () => {
  const s = setup(), target = s.monsters[0].uid;
  assert.equal(Combat.cast(s, "swordsman_stance", {}, { stats: Core.stats }).ok, true);
  const before = gameplay(s);
  assert.equal(cast(s, "arun_slash").ok, false);
  assert.equal(Combat.cast(s, "swordsman_sweep", { target }).ok, false);
  assert.deepEqual(gameplay(s), before);
  assert.equal(Combat.suggestSkill(s, s.monsters[0], { stats: Core.stats, dist: Core.dist }), null);
});

test("direct class combat simulation advances recovery without requiring the Core tick wrapper", () => {
  const s = setup();
  assert.equal(Combat.cast(s, "swordsman_stance", {}, { stats: Core.stats }).ok, true);
  Combat.tick(s, .44, { stats: Core.stats });
  assert.equal(cast(s, "arun_slash").ok, false);
  Combat.tick(s, .01, { stats: Core.stats });
  assert.equal(cast(s, "arun_slash").ok, true);
});

test("Auto waits for shared skill recovery and resumes with a different learned skill", () => {
  const s = setup(); s.skills.swordsman_stance = 0;
  assert.equal(cast(s, "arun_slash").ok, true);
  s.auto = true; s.target = s.monsters[0].uid;
  const before = { sp: s.player.sp, hp: s.monsters[0].hp, seed: s.seed };
  advance(s, .44);
  assert.deepEqual({ sp: s.player.sp, hp: s.monsters[0].hp, seed: s.seed }, before);
  assert.equal(s.cooldowns.swordsman_sweep, undefined);
  assert.equal(s.cooldowns.attack, undefined);
  advance(s, .01);
  assert.equal(s.cooldowns.swordsman_sweep, Data.skills.swordsman_sweep.cooldown);
});

test("readiness reports the limiting action or individual cooldown without mutating simulation", () => {
  const s = setup(), p = { target: s.monsters[0].uid };
  assert.equal(cast(s, "arun_slash").ok, true);
  const before = gameplay(s);
  const shared = Core.actionReadiness(s, "swordsman_sweep", p);
  assert.deepEqual({ ready: shared.ready, remaining: shared.remaining, source: shared.source }, { ready: false, remaining: .45, source: "action" });
  assert.ok(shared.reason);
  const own = Core.actionReadiness(s, "arun_slash", p);
  assert.equal(own.source, "cooldown");
  assert.equal(own.remaining, Data.skills.arun_slash.cooldown);
  assert.deepEqual(gameplay(s), before);
  advance(s, .45);
  assert.deepEqual(Core.actionReadiness(s, "swordsman_sweep", p), { ready: true, reason: "", remaining: 0, source: null });
});

test("action recovery is transient and spawn, death, new state and import do not retain a lock", () => {
  const s = setup(); s.player.sp = Core.stats(s).maxSp;
  assert.equal(cast(s, "arun_slash").ok, true);
  const save = Core.serialize(s);
  const imported = Core.deserialize(save);
  assert.equal(Core.serialize(imported), save);
  assert.equal(Core.actionReadiness(imported, "first_aid").ready, true);
  assert.equal(cast(imported, "first_aid").ok, true);
  assert.equal(Core.actionReadiness(Core.createState(), "first_aid").ready, true);
  Core.spawn(s);
  assert.equal(cast(s, "first_aid").ok, true, "spawn clears recovery independently of skill cooldowns");
  const dead = setup(); cast(dead, "arun_slash"); dead.player.hp = 0; Core.tick(dead, .01);
  assert.equal(cast(dead, "first_aid").ok, true, "death recovery clears the action");
  const reset = setup(); cast(reset, "arun_slash");
  Object.assign(reset.player, Data.npcs.find(n => n.id === "guide"));
  assert.equal(Core.act(reset, "reset-stats").ok, true);
  assert.equal(cast(reset, "first_aid").ok, true, "stat reset clears combat recovery");
});

test("rejected casts do not acquire recovery and consumables remain usable during an action", () => {
  const s = setup(); s.cooldowns.arun_slash = 1;
  assert.equal(cast(s, "arun_slash").ok, false);
  assert.equal(cast(s, "swordsman_sweep").ok, true);
  assert.equal(Core.act(s, "use", { id: "potion" }).ok, true);
  assert.equal(Core.act(s, "move", { x: 500, y: 300 }).ok, true);
  assert.equal(cast(s, "first_aid").ok, false);
});

test("Auto Quest waits to use First Aid during shared recovery without stopping its route", () => {
  for (const health of [.5, .15]) {
    const s = setup(); s.zone = 1; s.questActive = true;
    s.settings.autoPotion = 0;
    assert.equal(cast(s, "arun_slash").ok, true);
    s.player.hp = Core.stats(s).maxHp * health;
    s.autoQuest = { active: true, phase: "fighting" };
    Core.tick(s, .1);
    assert.equal(s.autoQuest.active, true, "a temporary action lock is not missing recovery supplies");
    assert.equal(s.cooldowns.first_aid, undefined);
    advance(s, .35);
    assert.equal(s.autoQuest.active, true);
    assert.equal(s.cooldowns.first_aid, Data.skills.first_aid.cooldown);
  }
});
