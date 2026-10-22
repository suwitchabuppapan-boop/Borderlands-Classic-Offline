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
test("every native skill is exposed in catalog order while class signatures stay stable", () => {
  const classes = Object.fromEntries(Object.entries(D.classes).map(([id, c]) => [id, { ...c }]));
  const skills = { ...D.skills };
  for (const [id, c] of Object.entries(classes)) {
    if (!c.tier) continue;
    c.skillIds = [c.skill, `${id}_attack`, `${id}_utility`, `${id}_passive`];
    for (const skillId of c.skillIds.slice(1)) skills[skillId] = { owner: id, kind: skillId.endsWith("passive") ? "passive" : "active" };
  }
  const browser = { BCData: { ...D, classes, skills } };
  vm.runInNewContext(fs.readFileSync(treeFile, "utf8"), { window: browser });
  const expanded = browser.BCSkillTree;
  const route = expanded.paths().find(n => n.classId === "swordsman");
  assert.equal(route.skillId, classes.swordsman.skill, "catalog signature stays compatible");
  assert.deepEqual(Array.from(route.skills, n => n.skillId), classes.swordsman.skillIds);
  const current = expanded.nodesFor("royal_duelist");
  assert.deepEqual(Array.from(current.ancestry, n => n.skillId), [...classes.swordsman.skillIds, ...classes.royal_duelist.skillIds]);
  assert.equal(current.ancestry.length, 8);
  assert.equal(current.ancestry.filter(n => n.skill.kind === "passive").length, 2);
  assert.equal(expanded.nodesFor("swordsman").ancestry.length, 4);
  assert.equal(expanded.nodesFor("villager").ancestry.length, 0);
});
for (const [classId, def] of Object.entries(D.classes)) {
  test(`${classId} exposes only its own ancestry and shared First Aid`, () => {
    const result = T.nodesFor(classId), expected = [];
    for (let id = classId; D.classes[id]?.tier > 0; id = D.classes[id].parent) expected.unshift(id);
    assert.equal(result.classId, classId);
    assert.deepEqual(result.ancestry.map(n => n.classId), expected.flatMap(id => (D.classes[id].skillIds || [D.classes[id].skill]).map(() => id)));
    assert.deepEqual(result.ancestry.map(n => n.skillId), expected.flatMap(id => D.classes[id].skillIds || [D.classes[id].skill]));
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
test("filtered current-class views retain every future and foreign catalog path", () => {
  const catalog = T.paths().map(n => [n.classId, ...n.children.map(child => child.classId)]);
  for (const classId of Object.keys(D.classes)) {
    const s = C.createState();
    s.classId = classId;
    // Forged in-memory foreign signatures must not turn into current-class skills.
    for (const skillId of Object.keys(D.skills)) s.skills[skillId] = D.skills[skillId].max;
    const { ancestry, shared } = T.nodesFor(classId);
    const expected = [...ancestry, ...shared].map(n => n.skillId).sort();
    assert.deepEqual(C.skillsFor(s).filter(id => D.skills[id].owner || id === "first_aid").sort(), expected);
    assert.deepEqual(T.paths().map(n => [n.classId, ...n.children.map(child => child.classId)]), catalog);
  }
});
test("callers can change node collections without affecting another view or canonical data", () => {
  const a = T.paths(), b = T.paths();
  assert.notEqual(a, b); assert.notEqual(a[0], b[0]); assert.notEqual(a[0].children, b[0].children);
  assert.notEqual(a[0].skills, b[0].skills); assert.notEqual(a[0].skills[0], b[0].skills[0]);
  a[0].skills.pop();
  a[0].children.pop(); a.pop();
  assert.equal(T.paths().length, 5); assert.equal(T.paths()[0].children.length, 2);
  const first = T.nodesFor("royal_duelist"), second = T.nodesFor("royal_duelist");
  assert.notEqual(first.ancestry[0], second.ancestry[0]);
  assert.notEqual(first.shared[0], second.shared[0]);
  first.ancestry.reverse(); first.shared.pop();
  assert.deepEqual(T.nodesFor("royal_duelist").ancestry.map(n => n.skillId), ["swordsman", "royal_duelist"].flatMap(id => D.classes[id].skillIds || [D.classes[id].skill]));
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
test("only current ancestral skills can be learned, bound and round tripped", () => {
  const s = C.createState();
  s.classId = "royal_duelist"; s.weaponSchool = "dual_sword"; s.job = "Swordman"; s.equipment.weapon = null;
  s.skillPoints = 8;
  for(const id of ["bash","magnum","provoke"]) {
    assert.equal(C.skillAvailable(s,id),false);
    assert.equal(C.act(s,"learn",{id}).ok,false);
    assert.equal(C.act(s,"bind",{slot:1,value:`skill:${id}`}).ok,false);
  }
  assert.equal(C.act(s, "learn", { id: "arun_slash" }).ok, true);
  assert.equal(C.act(s, "learn", { id: "royal_flurry" }).ok, true);
  assert.equal(C.act(s, "bind", { slot: 1, value: "skill:royal_flurry" }).ok, true);
  const restored = C.deserialize(C.serialize(s));
  assert.deepEqual(restored.skills, s.skills); assert.deepEqual(restored.hotbar, s.hotbar);
  const nodes = T.nodesFor(s.classId);
  assert.deepEqual(nodes.ancestry.map(n=>n.skillId),["swordsman", "royal_duelist"].flatMap(id => D.classes[id].skillIds || [D.classes[id].skill]));
});
