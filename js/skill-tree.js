(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (catalog, id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog, id);
  function node(classId) {
    const classDef = D.classes[classId], skillId = classDef.skill;
    return { classId, classDef, skillId, skill: D.skills[skillId] };
  }
  function paths() {
    return Object.keys(D.classes).filter(id => D.classes[id].tier === 1).map(classId => ({
      ...node(classId),
      children: Object.keys(D.classes).filter(id => D.classes[id].parent === classId && D.classes[id].tier === 2).map(node),
    }));
  }
  function nodesFor(classId) {
    const result = { classId: null, ancestry: [], shared: [] };
    if (!own(D.classes, classId)) return result;
    result.classId = classId;
    const seen = new Set();
    for (let id = classId; own(D.classes, id) && !seen.has(id); id = D.classes[id].parent) {
      seen.add(id);
      if (D.classes[id].tier > 0) result.ancestry.unshift(node(id));
    }
    const sharedClass = Object.keys(D.classes).find(id => D.classes[id].tier === 0 && D.classes[id].skill === "first_aid");
    if (sharedClass) result.shared.push(node(sharedClass));
    return result;
  }
  const api = { paths, nodesFor };
  if (typeof module === "object") module.exports = api;
  else root.BCSkillTree = api;
})(typeof window === "undefined" ? globalThis : window);
