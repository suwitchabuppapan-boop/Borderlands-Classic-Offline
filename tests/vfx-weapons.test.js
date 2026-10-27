"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const D = require("../js/classic-data.js");
const filename = path.join(__dirname, "../js/vfx-weapons.js");
const exists = fs.existsSync(filename);
const FX = exists ? require(filename) : null;
const types = Object.keys(D.weaponTypes);
const ranged = ["staff", "orb", "book", "bow", "magic_bow"];
const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

function context() {
  const calls = [], stack = [];
  const initial = { globalAlpha: .67, fillStyle: "#123456", strokeStyle: "#654321", lineWidth: 9,
    lineCap: "butt", lineJoin: "miter", globalCompositeOperation: "source-over", transform: [1, 0, 0, 1, 7, 11] };
  let state = structuredClone(initial);
  const c = { calls, get depth() { return stack.length; }, snapshot: () => structuredClone(state) };
  for (const name of ["beginPath", "closePath", "stroke", "fill", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse", "fillRect", "setLineDash"])
    c[name] = (...args) => {
      for (const n of args.flat()) if (typeof n === "number") assert.ok(Number.isFinite(n), name + " must stay finite");
      calls.push([name, ...args]);
    };
  c.save = () => { stack.push(structuredClone(state)); calls.push(["save"]); };
  c.restore = () => { assert.ok(stack.length, "restore has a matching save"); state = stack.pop(); calls.push(["restore"]); };
  c.translate = (x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    const [a, b, d, e, f, g] = state.transform;
    state.transform = [a, b, d, e, f + a * x + d * y, g + b * x + e * y];
    calls.push(["translate", x, y]);
  };
  c.rotate = angle => {
    assert.ok(Number.isFinite(angle));
    const [a, b, d, e, f, g] = state.transform, cos = Math.cos(angle), sin = Math.sin(angle);
    state.transform = [a * cos + d * sin, b * cos + e * sin, d * cos - a * sin, e * cos - b * sin, f, g];
    calls.push(["rotate", angle]);
  };
  c.scale = (x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); const t = state.transform; state.transform = [t[0] * x, t[1] * x, t[2] * y, t[3] * y, t[4], t[5]]; calls.push(["scale", x, y]); };
  for (const name of Object.keys(initial).filter(name => name !== "transform")) Object.defineProperty(c, name, {
    get: () => state[name], set: value => { if (typeof value === "number") assert.ok(Number.isFinite(value)); state[name] = value; calls.push([name, value]); }
  });
  return c;
}
const event = (extra = {}) => ({ id: 17, kind: "attack", source: { x: 140, y: 160 }, target: { x: 190, y: 160 }, facing: 1,
  weaponType: "sword", age: .28 * .35, duration: .28, ...extra });
function render(e, large = false) {
  const c = context(), before = c.snapshot();
  FX.draw(c, freeze(e), large);
  assert.equal(c.depth, 0);
  assert.deepEqual(c.snapshot(), before, "draw restores every Canvas style and the incoming transform");
  assert.ok(c.calls.length < 2000, "one event has a bounded Canvas budget");
  return c.calls;
}
const geometry = calls => JSON.stringify(calls.filter(([op]) => ["moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse", "translate", "rotate", "scale"].includes(op)));

test("weapon VFX module provides the twelve immutable data profiles", () => {
  assert.equal(exists, true, "weapon VFX renderer must exist");
  assert.equal(typeof FX.draw, "function");
  assert.deepEqual(Object.keys(FX.profiles).sort(), types.sort());
  assert.ok(Object.isFrozen(FX) && Object.isFrozen(FX.profiles));
  for (const profile of Object.values(FX.profiles)) {
    assert.ok(Object.isFrozen(profile));
    assert.ok(profile.name && /^#[0-9a-f]{6}$/i.test(profile.color) && /^#[0-9a-f]{6}$/i.test(profile.light));
  }
});

if (FX) {
  test("all twelve weapon silhouettes draw in all four facings without mutating snapshots or Canvas state", () => {
    const silhouettes = [];
    for (const weaponType of types) {
      const orientations = [];
      for (let facing = 0; facing < 4; facing++) {
        const [dx, dy] = [[0, 1], [1, 0], [0, -1], [-1, 0]][facing];
        const e = freeze(event({ weaponType, facing, target: { x: 140 + dx * 50, y: 160 + dy * 50 } }));
        const before = JSON.stringify(e), calls = render(e);
        assert.equal(JSON.stringify(e), before);
        assert.ok(calls.some(([op]) => op === "fill"), weaponType + " has a filled silhouette");
        assert.ok(calls.some(([op]) => op === "fillStyle"), weaponType + " has painted color");
        orientations.push(geometry(calls));
      }
      assert.equal(new Set(orientations).size, 4, weaponType + " responds to every facing");
      silhouettes.push(geometry(render(event({ weaponType }))));
    }
    assert.equal(new Set(silhouettes).size, 12, "every weapon has its own geometry");
  });

  test("ranged projectiles aim at the immutable diagonal target and share its body-height endpoint", () => {
    for (const weaponType of ranged) {
      const calls = render(event({ weaponType, facing: 3, target: { x: 180, y: 190 } }));
      assert.deepEqual(calls.find(([op]) => op === "translate"), ["translate", 140, 143]);
      assert.ok(calls.some(([op, angle]) => op === "rotate" && Math.abs(angle - Math.atan2(30, 40)) < 1e-12), weaponType);
    }
    for (const weaponType of types.filter(type => !ranged.includes(type))) {
      const calls = render(event({ weaponType, facing: 2, target: { x: 180, y: 190 } }));
      assert.ok(calls.some(([op, angle]) => op === "rotate" && angle === -Math.PI / 2), weaponType + " follows its body facing");
    }
  });

  test("all weapons grow, strike, and dissolve with changing geometry across their actual duration", () => {
    for (const weaponType of types) {
      const phases = [.08, .35, .75, .97].map(p => render(event({ weaponType, age: p * .28 })));
      assert.equal(new Set(phases.map(geometry)).size, 4, weaponType + " has four distinct phases");
      assert.ok(phases[0].some(([op]) => op === "fill"), weaponType + " is visible early");
      for (const calls of phases) assert.equal(calls.find(([op]) => op === "globalAlpha")[1], .67, weaponType + " leaves whole-event fading to the caller");
      assert.ok(phases[3].some(([op]) => op === "fill"), weaponType + " still has a dissolving shape before expiry");
      const normal = geometry(render(event({ weaponType, age: .28 * .35 })));
      const skill = geometry(render(event({ weaponType, duration: .45, age: .45 * .35 })));
      assert.equal(normal, skill, weaponType + " uses normalized event age");
      assert.notEqual(normal, geometry(render(event({ weaponType }), true)), weaponType + " supports a larger skill gesture");
    }
  });

  test("replaying weapon snapshots in a different age order produces identical marks", () => {
    for (const weaponType of types) {
      const phases = [0, .13, .38, .68, .94];
      const expected = new Map(phases.map(p => [p, render(event({ weaponType, age: .28*p }))]));
      for (const p of [.94, .13, .68, 0, .38, .13])
        assert.deepEqual(render(event({ weaponType, age: .28*p })), expected.get(p), weaponType + " depends only on its immutable snapshot");
    }
  });

  test("ranged gestures at zero distance retain their body-facing fallback", () => {
    for (const weaponType of ranged) for (let facing = 0; facing < 4; facing++) {
      const calls = render(event({ weaponType, facing, target: { x: 140, y: 160 } }));
      assert.deepEqual(calls.find(([op]) => op === "translate"), ["translate", 140, 143]);
      assert.deepEqual(calls.find(([op]) => op === "rotate"), ["rotate", [Math.PI / 2, 0, -Math.PI / 2, Math.PI][facing]]);
      assert.ok(calls.some(([op]) => op === "fill"), weaponType + " remains visible at point-blank range");
    }
  });

  test("ranged travel is capped at 250 and early, late, large gestures keep finite bounded geometry", () => {
    for (const weaponType of ranged) {
      const capped = geometry(render(event({ weaponType, target: { x: 390, y: 160 }, age: .28*.75 })));
      const distant = geometry(render(event({ weaponType, target: { x: 10140, y: 160 }, age: .28*.75 })));
      assert.equal(distant, capped, weaponType + " travels at most 250 world pixels");
    }
    for (const weaponType of types) for (const p of [0, .08, .35, .75, .97]) {
      const calls = render(event({ weaponType, target: { x: 100000, y: 100000 }, age: p * .28 }), true);
      for (const [op, ...args] of calls) if (["moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse"].includes(op))
        for (const n of args) if (typeof n === "number") assert.ok(Math.abs(n) < 400, weaponType + " local art stays near the capped path");
    }
  });

  test("invalid, unsupported, and expired snapshots make no marks", () => {
    for (const invalid of [null, {}, event({ weaponType: "no-such-weapon" }), event({ age: -.1 }), event({ age: .28 }), event({ duration: Infinity }), event({ source: { x: NaN, y: 160 } }), event({ facing: 9 })])
      assert.equal(render(invalid).length, 0);
  });

  test("browser export shares the API and art has no external or nondeterministic effects", () => {
    const source = fs.readFileSync(filename, "utf8"), root = { BCData: D, BCVFXPainter: require("../js/vfx-painter.js") };
    vm.runInNewContext(source, { window: root, globalThis: root });
    assert.equal(typeof root.BCWeaponVFX.draw, "function");
    assert.deepEqual(Object.keys(root.BCWeaponVFX.profiles).sort(), types.sort());
    assert.doesNotMatch(source, /Math\.random|Date\.|performance\.|requestAnimationFrame|setTimeout|document\.|fetch\(|createLinearGradient|createRadialGradient|shadowBlur|new Image/);
  });
}

test("two-handed greatsword uses one broad release instead of two crossed blade tracks",()=>{
 assert.ok(FX.profiles.two_hand_sword);assert.equal(FX.profiles.dual_sword,undefined);
 const calls=render(event({weaponType:'two_hand_sword'}));
 const arcs=calls.filter(v=>v[0]==='bezierCurveTo');
 assert.equal(arcs.length,8,'one four-layer crescent has two curves per layer');
 const single=render(event({weaponType:'sword'})).filter(v=>v[0]==='bezierCurveTo');
 assert.ok(Math.max(...arcs.flatMap(v=>v.slice(1)))>Math.max(...single.flatMap(v=>v.slice(1))),'heavy blade needs a wider reach silhouette');
});
