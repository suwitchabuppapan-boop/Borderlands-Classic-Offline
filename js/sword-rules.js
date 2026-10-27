/* Pure swordsman tables shared by combat, skill details and allocation views. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const CELL_SIZE = 32;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const isSwordSkill = id => typeof id === "string" && own(D.skills, id) && D.skills[id].owner === "swordsman";
  function isSwordLineage(s) {
    const seen = new Set();
    for (let id = s?.classId; own(D.classes, id) && !seen.has(id); id = D.classes[id].parent) {
      if (id === "swordsman") return true;
      seen.add(id);
    }
    return false;
  }
  function levelInfo(id, level = 1, baseLevel = 1) {
    if (!isSwordSkill(id)) return null;
    const sk = D.skills[id], lv = clamp(Number.isFinite(level) ? Math.floor(level) : 1, 1, sk.max);
    const baseLv = clamp(Number.isFinite(baseLevel) ? Math.floor(baseLevel) : 1, 1, 30);
    // Return independent tables and metadata; callers may prepare view state.
    const info = Object.fromEntries(Object.entries(sk).map(([key, value]) => [key,
      Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value]));
    const scaled = (key, per) => (sk[key] || 0) + (sk[per] || 0) * (lv - 1);
    Object.assign(info, {
      level: lv, power: scaled("power", "powerPerLevel"),
      sp: sk.spByLevel ? sk.spByLevel[lv - 1] : sk.sp,
      hpCost: sk.hpCostByLevel ? sk.hpCostByLevel[lv - 1] : 0,
      hitBonus: scaled("hitBonus", "hitPerLevel"), duration: scaled("duration", "durationPerLevel"),
      mdefBonus: scaled("mdefBonus", "mdefPerLevel"),
      successChance: sk.successChance === undefined ? 0 : clamp(scaled("successChance", "successPerLevel"), 0, 1),
      enemyAtkMultiplier: sk.enemyAtkMultiplier === undefined ? 1 : scaled("enemyAtkMultiplier", "enemyAtkPerLevel"),
      enemyDefMultiplier: sk.enemyDefMultiplier === undefined ? 1 : scaled("enemyDefMultiplier", "enemyDefPerLevel"),
      fatalBlowChance: id === "arun_slash" && lv >= 6 ? clamp(0.05 * (lv - 5) + baseLv * D.skills.swordsman_fatal_blow.baseLevelStunBonus, 0, 1) : 0,
    });
    for (const key of ["masteryFlat", "hpRecoveryLevel", "hpItemBonus", "movingHpRecovery", "fatalBlow"])
      info[key] = (sk.passive?.[key] || 0) * lv;
    return info;
  }
  function fireMultiplier(target, definition) {
    for (const object of [target, definition]) {
      if (own(object, "fireMultiplier") && Number.isFinite(object.fireMultiplier) && object.fireMultiplier >= 0 && object.fireMultiplier <= 2)
        return object.fireMultiplier;
    }
    // The current catalog has neutral elemental targets. Optional resistance
    // metadata can be supplied without changing the neutral baseline.
    return 1;
  }
  const api = Object.freeze({ CELL_SIZE, isSwordLineage, isSwordSkill, levelInfo, fireMultiplier });
  if (typeof module === "object") module.exports = api;
  else root.BCSwordRules = api;
})(typeof window === "undefined" ? globalThis : window);
