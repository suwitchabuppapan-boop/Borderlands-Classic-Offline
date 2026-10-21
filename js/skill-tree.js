(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (catalog, id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog, id);
  function node(classId, skillId = D.classes[classId].skill) {
    const classDef = D.classes[classId];
    return { classId, classDef, skillId, skill: D.skills[skillId] };
  }
  function nativeNodes(classId) {
    const c = D.classes[classId];
    return (c.skillIds || [c.skill]).filter(id => own(D.skills, id)).map(id => node(classId, id));
  }
  function classNode(classId) {
    return { ...node(classId), skills: nativeNodes(classId) };
  }
  function paths() {
    return Object.keys(D.classes).filter(id => D.classes[id].tier === 1).map(classId => ({
      ...classNode(classId),
      children: Object.keys(D.classes).filter(id => D.classes[id].parent === classId && D.classes[id].tier === 2).map(classNode),
    }));
  }
  function nodesFor(classId) {
    const result = { classId: null, ancestry: [], shared: [] };
    if (!own(D.classes, classId)) return result;
    result.classId = classId;
    const seen = new Set();
    for (let id = classId; own(D.classes, id) && !seen.has(id); id = D.classes[id].parent) {
      seen.add(id);
      if (D.classes[id].tier > 0) result.ancestry.unshift(...nativeNodes(id));
    }
    const sharedClass = Object.keys(D.classes).find(id => D.classes[id].tier === 0 && D.classes[id].skill === "first_aid");
    if (sharedClass) result.shared.push(node(sharedClass));
    return result;
  }
  // Allocation drafts are view state. They never learn, refund or serialize a skill.
  const record = value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) return false;
    return Reflect.ownKeys(value).every(key => {
      const field = Object.getOwnPropertyDescriptor(value, key);
      return typeof key === "string" && field.enumerable && Object.prototype.hasOwnProperty.call(field, "value");
    });
  };
  function allocationState(s) {
    if (!record(s) || !own(s, "classId") || !own(D.classes, s.classId) ||
        !own(s, "skills") || !record(s.skills) || !own(s, "skillPoints") ||
        !Number.isInteger(s.skillPoints) || s.skillPoints < 0 || s.skillPoints > 10000) return null;
    const ids = nodesFor(s.classId).ancestry.map(n => n.skillId), levels = {};
    for (const id of ids) {
      const level = s.skills[id];
      if (!own(s.skills, id) || !Number.isInteger(level) || level < 0 || level > D.skills[id].max) return null;
      levels[id] = level;
    }
    return { classId: s.classId, ids, levels, points: s.skillPoints };
  }
  function createAllocation(s) {
    const current = allocationState(s);
    return current ? { classId: current.classId, baseline: { ...current.levels }, increments: {} } : null;
  }
  function validateAllocation(s, draft) {
    const current = allocationState(s);
    const invalid = message => ({ ok: false, message, spent: 0, remaining: current?.points || 0, levels: {}, entries: [] });
    if (!current) return invalid("ข้อมูลอาชีพหรือแต้มสกิลไม่ถูกต้อง");
    if (!record(draft) || Object.keys(draft).length !== 3 ||
        !["classId", "baseline", "increments"].every(key => own(draft, key)) ||
        !record(draft.baseline) || !record(draft.increments)) return invalid("รูปแบบแผนสกิลไม่ถูกต้อง");
    if (draft.classId !== current.classId) return invalid("อาชีพเปลี่ยนแล้ว กรุณาจัดแผนสกิลใหม่");
    if (Object.keys(draft.baseline).length !== current.ids.length ||
        current.ids.some(id => !own(draft.baseline, id) || draft.baseline[id] !== current.levels[id])) return invalid("ระดับสกิลเปลี่ยนแล้ว กรุณาจัดแผนสกิลใหม่");
    const levels = { ...current.levels }, entries = [];
    let spent = 0;
    for (const [id, count] of Object.entries(draft.increments)) {
      if (!own(current.levels, id)) return invalid("จัดแต้มได้เฉพาะสกิลอาชีพในสายปัจจุบัน");
      if (!Number.isInteger(count) || count <= 0 || levels[id] + count > D.skills[id].max) return invalid("ระดับสกิลในแผนไม่ถูกต้องหรือเกินระดับสูงสุด");
      levels[id] += count;
      spent += count;
    }
    if (spent > current.points) return invalid("แต้มสกิลไม่เพียงพอสำหรับแผนนี้");
    for (const id of current.ids) if (own(draft.increments, id)) entries.push({ id, count: draft.increments[id] });
    return { ok: true, message: "", spent, remaining: current.points - spent, levels, entries };
  }
  function adjustAllocation(s, draft, id, delta) {
    const reject = message => ({ ok: false, message, draft: null });
    if (delta !== 1 && delta !== -1) return reject("ปรับแผนได้ครั้งละ 1 แต้ม");
    const checked = validateAllocation(s, draft);
    if (!checked.ok) return reject(checked.message);
    if (typeof id !== "string" || !own(checked.levels, id)) return reject("จัดแต้มได้เฉพาะสกิลอาชีพในสายปัจจุบัน");
    const count = (draft.increments[id] || 0) + delta;
    if (count < 0) return reject("ลดได้เฉพาะแต้มที่ยังไม่ได้ยืนยัน");
    const next = { classId: draft.classId, baseline: { ...draft.baseline }, increments: { ...draft.increments } };
    if (count) next.increments[id] = count;
    else delete next.increments[id];
    const result = validateAllocation(s, next);
    return result.ok ? { ok: true, message: "", draft: next } : reject(result.message);
  }
  const api = { paths, nodesFor, createAllocation, validateAllocation, adjustAllocation };
  if (typeof module === "object") module.exports = api;
  else root.BCSkillTree = api;
})(typeof window === "undefined" ? globalThis : window);
