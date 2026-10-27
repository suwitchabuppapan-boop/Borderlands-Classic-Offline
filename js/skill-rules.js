/* Pure shared catalog/access/balance rules. No engine, timers or rendering state. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
  const definition = id => typeof id === "string" && own(D.skills, id) ? D.skills[id] : null;
  const classInfo = id => typeof id === "string" && own(D.classes, id) ? D.classes[id] : null;
  const isPassive = id => definition(id)?.kind === "passive";
  const nativeSkills = classId => classInfo(classId) ? [...classInfo(classId).skillIds] : [];
  function skillsFor(classId) {
    if (!classInfo(classId)) return [];
    const lineage = [], visited = new Set();
    for (let id = classId; classInfo(id) && !visited.has(id); id = classInfo(id).parent) {
      visited.add(id); lineage.unshift(id);
    }
    return lineage.flatMap(nativeSkills);
  }
  function learnedLevel(s, id) {
    const value = own(s?.skills, id) ? s.skills[id] : 0;
    return Number.isFinite(value) ? Math.min(definition(id)?.max || 0, Math.max(0, Math.floor(value))) : 0;
  }
  function accessible(s, id, requireLearned = false) {
    return !!definition(id) && skillsFor(s?.classId).includes(id) && (!requireLearned || learnedLevel(s, id) > 0);
  }
  function magicFor(s, id) {
    if (!accessible(s, id)) return false;
    const skill = definition(id);
    return skill.adaptive ? D.weaponTypes[classInfo(s.classId).weaponType].basicMagic : skill.magic === true;
  }
  function rangeFor(s, id) {
    if (!accessible(s, id)) return 0;
    const skill = definition(id);
    return skill.adaptive && !magicFor(s, id) ? skill.meleeRange : skill.range;
  }
  function passives(s) {
    // Multipliers add their learned coefficient to one. Flat values add to zero.
    // Arcane factors stay zero until learned so the previous INT formula survives.
    const result = {
      physicalMultiplier: 1, normalMagicMultiplier: 1, maxHpMultiplier: 1, maxSpMultiplier: 1,
      defBonus: 0, mdefBonus: 0, hitBonus: 0, intervalMultiplier: 1, healMultiplier: 1,
      aoeMultiplier: 1, poisonMultiplier: 1, bowMultiplier: 1, huntMultiplier: 1,
      damageTakenMultiplier: 1, magicBowDexFactor: 0, magicBowIntFactor: 0,
      swordSpReduction: 0, magicSpReduction: 0,
      masteryFlat: 0, hpRecoveryLevel: 0, hpItemBonus: 0, movingHpRecovery: 0, fatalBlow: 0,
    };
    const type = classInfo(s?.classId)?.weaponType;
    for (const id of skillsFor(s?.classId)) {
      const skill = definition(id), level = learnedLevel(s, id);
      if (!isPassive(id) || !level || (skill.weaponTypes && !skill.weaponTypes.includes(type))) continue;
      for (const [key, coefficient] of Object.entries(skill.passive)) {
        if (!own(result, key) || !Number.isFinite(coefficient)) continue;
        if (id === "arcane_dual_art") result[key] = key === "magicBowDexFactor" ? skill.magicBowDexBase + coefficient * level : coefficient;
        else result[key] += coefficient * level;
      }
    }
    return result;
  }
  function learnCost(id) {
    const skill = definition(id);
    return skill ? skill.learnCost ?? 1 : 0;
  }
  function prerequisiteReason(s, id, levels = s?.skills) {
    if (!accessible(s, id)) return "อาชีพนี้เรียนสกิลนี้ไม่ได้";
    for (const [required, level] of Object.entries(definition(id).requirements || {})) {
      if (!own(levels, required) || !Number.isInteger(levels[required]) || levels[required] < level)
        return `ต้องเรียน${definition(required)?.name || required}ระดับ ${level}`;
    }
    return "";
  }
  function trainingReason(s, id) {
    if (!definition(id)?.questSkill) return "";
    if (!accessible(s, id)) return "อาชีพนี้เรียนสกิลนี้ไม่ได้";
    const guide = D.npcs.find(n => n.id === "guide");
    return guide && s?.zone === 0 && Number.isFinite(s.player?.x) && Number.isFinite(s.player?.y) &&
      Math.hypot(s.player.x - guide.x, s.player.y - guide.y) < 85 ? "" : "คุยครูอินที่เมืองเพื่อเรียนสกิลพิเศษฟรี";
  }
  function spCost(s, id, deactivating = false) {
    if (!accessible(s, id) || isPassive(id)) return 0;
    const skill = definition(id), mods = passives(s);
    if (skill.kind === "toggle" && deactivating) return 0;
    const swordFamily = ["swordsman", "royal_duelist", "city_guardian"].includes(skill.owner);
    const discount = Math.min(0.35, (swordFamily ? mods.swordSpReduction : 0) + (magicFor(s, id) ? mods.magicSpReduction : 0));
    const level = Math.max(1, learnedLevel(s, id));
    const base = skill.spByLevel ? skill.spByLevel[level - 1] : skill.sp;
    return Math.max(1, Math.ceil(base * (1 - discount)));
  }
  const api = Object.freeze({accessible, isPassive, nativeSkills, skillsFor, spCost, passives, magicFor, rangeFor, learnCost, prerequisiteReason, trainingReason});
  if (typeof module === "object") module.exports = api; else root.BCSkillRules = api;
})(typeof window === "undefined" ? globalThis : window);
