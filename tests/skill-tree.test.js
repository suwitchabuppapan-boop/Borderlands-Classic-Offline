"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const D = require("../js/classic-data.js");
const C = require("../js/core.js");
const treeFile = require.resolve("../js/classic-data.js").replace("classic-data.js", "skill-tree.js");
let T;
test("skill tree exposes its browser and CommonJS contracts", () => {
  assert.ok(fs.existsSync(treeFile), "missing data-derived skill tree module");
  T = require(treeFile);
  assert.equal(typeof T.paths, "function");
  assert.equal(typeof T.nodesFor, "function");
  const browser = { BCData: D };
  vm.runInNewContext(fs.readFileSync(treeFile, "utf8"), { window: browser });
  assert.equal(browser.BCSkillTree.paths().length, 5);
});
test("five families contain all fifteen existing class signatures exactly once", () => {
  const paths = T.paths();
  assert.equal(paths.length, 5);
  const all = paths.flatMap(n => [n, ...n.children]);
  assert.equal(all.length, 15);
  assert.equal(new Set(all.map(n => n.skillId)).size, 15);
  assert.deepEqual(all.map(n => n.classId).sort(), Object.keys(D.classes).filter(id => D.classes[id].tier > 0).sort());
  for (const parent of paths) {
    assert.equal(parent.classDef.tier, 1);
    assert.equal(parent.children.length, 2);
    for (const n of [parent, ...parent.children]) {
      assert.equal(n.classDef, D.classes[n.classId]);
      assert.equal(n.skillId, n.classDef.skill);
      assert.equal(n.skill, D.skills[n.skillId]);
      assert.equal(n.skill.max, 5);
    }
    for (const child of parent.children) assert.equal(child.classDef.parent, parent.classId);
  }
});
for (const [classId, def] of Object.entries(D.classes)) {
  test(`${classId} exposes only its own ancestry and shared First Aid`, () => {
    const result = T.nodesFor(classId), expected = [];
    for (let id = classId; D.classes[id]?.tier > 0; id = D.classes[id].parent) expected.unshift(id);
    assert.equal(result.classId, classId);
    assert.deepEqual(result.ancestry.map(n => n.classId), expected);
    assert.deepEqual(result.shared.map(n => n.skillId), ["first_aid"]);
    assert.equal(result.shared[0].skill, D.skills.first_aid);
    const s = C.createState();
    s.classId = classId; s.weaponSchool = def.weaponType; s.skillPoints = 100;
    const accessible = new Set([...result.ancestry, ...result.shared].map(n => n.skillId));
    for (const [skillId, skill] of Object.entries(D.skills)) {
      assert.equal(C.skillAvailable(s, skillId), accessible.has(skillId), `${classId}/${skillId} access`);
      const before = s.skillPoints;
      const learned = C.act(s, "learn", { id: skillId });
      if (skill.owner && accessible.has(skillId)) {
        assert.equal(learned.ok, true);
        assert.equal(s.skills[skillId], 1);
        assert.equal(s.skillPoints, before - 1);
        for (let level = 2; level <= skill.max; level++) assert.equal(C.act(s, "learn", { id: skillId }).ok, true);
        const maxPoints = s.skillPoints;
        assert.equal(C.act(s, "learn", { id: skillId }).ok, false);
        assert.equal(s.skillPoints, maxPoints);
      } else {
        assert.equal(learned.ok, false);
        assert.equal(s.skillPoints, before);
      }
    }
  });
}
test("invalid and prototype class IDs return fresh empty results", () => {
  for (const id of [null, undefined, "", "missing", "__proto__", "constructor", "toString", 3, {}, []]) {
    assert.deepEqual(T.nodesFor(id), { classId: null, ancestry: [], shared: [] });
  }
  assert.notEqual(T.nodesFor(null).shared, T.nodesFor(null).shared);
});
test("callers can change node collections without affecting another view or canonical data", () => {
  const a = T.paths(), b = T.paths();
  assert.notEqual(a, b); assert.notEqual(a[0], b[0]); assert.notEqual(a[0].children, b[0].children);
  a[0].children.pop(); a.pop();
  assert.equal(T.paths().length, 5); assert.equal(T.paths()[0].children.length, 2);
  const first = T.nodesFor("royal_duelist"), second = T.nodesFor("royal_duelist");
  assert.notEqual(first.ancestry[0], second.ancestry[0]);
  assert.notEqual(first.shared[0], second.shared[0]);
  first.ancestry.reverse(); first.shared.pop();
  assert.deepEqual(T.nodesFor("royal_duelist").ancestry.map(n => n.classId), ["swordsman", "royal_duelist"]);
});
test("the tree reads the catalog instead of duplicating its labels or family list", () => {
  const classes = Object.fromEntries(Object.entries(D.classes).map(([id, c]) => [id, { ...c }]));
  classes.mage.name = "changed catalog name";
  const browser = { BCData: { ...D, classes } };
  vm.runInNewContext(fs.readFileSync(treeFile, "utf8"), { window: browser });
  assert.equal(browser.BCSkillTree.paths().find(n => n.classId === "mage").classDef.name, "changed catalog name");
  delete classes.mage; delete classes.lotus_mage; delete classes.orb_weaver;
  assert.equal(browser.BCSkillTree.paths().length, 4);
});
test("learned legacy skills remain separate, retain prerequisites, bind and round trip", () => {
  const s = C.createState();
  s.classId = "royal_duelist"; s.weaponSchool = "dual_sword"; s.job = "Swordman"; s.equipment.weapon = null;
  s.skills.bash = 4; s.skills.magnum = 1; s.skills.provoke = 1; s.skillPoints = 8;
  assert.equal(C.skillAvailable(s, "magnum"), true);
  assert.match(C.learnReason(s, "magnum"), /ระดับ 5/);
  assert.equal(C.act(s, "learn", { id: "magnum" }).ok, false);
  assert.equal(C.act(s, "learn", { id: "bash" }).ok, true);
  assert.equal(C.act(s, "learn", { id: "magnum" }).ok, true);
  assert.equal(C.act(s, "learn", { id: "royal_flurry" }).ok, true);
  assert.equal(C.act(s, "bind", { slot: 1, value: "skill:royal_flurry" }).ok, true);
  const restored = C.deserialize(C.serialize(s));
  assert.deepEqual(restored.skills, s.skills); assert.deepEqual(restored.hotbar, s.hotbar);
  const nodes = T.nodesFor(s.classId);
  assert.equal([...nodes.ancestry, ...nodes.shared].some(n => ["bash", "magnum", "provoke"].includes(n.skillId)), false);
});
