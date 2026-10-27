/* Narrow skill-schema upgrade. Other save validation remains in the engine. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const originalSkills = new Set(["first_aid", "arun_slash", "royal_flurry", "shield_counter", "lotus_bolt", "lotus_storm", "orb_burst", "ward_script", "sanctuary", "garuda_combo", "quick_stab", "moon_venom", "tiger_rend", "aimed_shot", "naga_trap", "arcane_volley"]);
  const formerSwordSkills = ["arun_slash", "swordsman_sweep", "swordsman_stance", "swordsman_discipline"];
  const addedSwordSkills = ["swordsman_twohand_mastery", "swordsman_recovery", "swordsman_provoke", "swordsman_moving_recovery", "swordsman_fatal_blow", "swordsman_auto_berserk"];
  const swordSkills = [...formerSwordSkills, ...addedSwordSkills];
  const copy = value => Array.isArray(value) ? value.map(copy) : record(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)])) : value;
  const validLevel = (value, max, min = 0) => Number.isInteger(value) && value >= min && value <= max;
  function bad() { throw new Error("ไฟล์เซฟไม่ถูกต้อง หรือเป็นคนละรุ่น"); }
  function lineage(classId) {
    const owners = new Set();
    for (let id = classId; typeof id === "string" && own(D.classes, id) && !owners.has(id); id = D.classes[id].parent) owners.add(id);
    return owners;
  }
  function upgrade(value) {
    if (!record(value) || !record(value.skills) || typeof value.classId !== "string" || !own(D.classes, value.classId) ||
        !Number.isInteger(value.skillPoints) || value.skillPoints < 0 || value.skillPoints > 10000) bad();
    const unversioned = !own(value, "skillVersion");
    if (!unversioned && value.skillVersion !== 2 && value.skillVersion !== 3) bad();
    const old = unversioned || value.skillVersion === 2;
    const ids = Object.keys(D.skills), historical = ids.filter(id => !addedSwordSkills.includes(id));
    const owners = lineage(value.classId), skills = {};
    for (const id of old ? historical : ids) {
      const present = own(value.skills, id);
      if (!present && (!unversioned || originalSkills.has(id))) bad();
      const level = present ? value.skills[id] : 0;
      const max = old && formerSwordSkills.includes(id) ? 5 : D.skills[id].max;
      if (!validLevel(level, max, id === "first_aid" ? 1 : 0)) bad();
      if (level > 0 && D.skills[id].owner && !owners.has(D.skills[id].owner)) bad();
      skills[id] = level;
    }
    if (!old) {
      for (const id of ids) {
        if (!skills[id]) continue;
        for (const [required, minimum] of Object.entries(D.skills[id].requirements || {})) {
          if (!own(skills, required) || skills[required] < minimum) bad();
        }
      }
    }
    const refund = old ? formerSwordSkills.reduce((total, id) => total + (skills[id] || 0), 0) : 0;
    if (value.skillPoints + refund > 10000) bad();
    if (old) for (const id of swordSkills) skills[id] = 0;
    const result = copy(value);
    result.skillVersion = 3;
    result.skillPoints = value.skillPoints + refund;
    result.skills = Object.fromEntries(ids.map(id => [id, skills[id]]));
    if (old && value.classId === "royal_duelist" && value.weaponSchool === "dual_sword") result.weaponSchool = "two_hand_sword";
    if (old && Array.isArray(result.hotbar)) {
      result.hotbar = result.hotbar.map(binding => typeof binding === "string" && formerSwordSkills.some(id => binding === `skill:${id}`) ? null : binding);
    }
    return result;
  }
  const api = Object.freeze({upgrade});
  if (typeof module === "object") module.exports = api; else root.BCSwordSave = api;
})(typeof window === "undefined" ? globalThis : window);
