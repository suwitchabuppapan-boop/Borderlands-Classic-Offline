/* Signature skills use classic-data as their sole balance source. No DOM dependencies. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const Rules = typeof module === "object" ? require("./stat-rules.js") : root.BCStatRules;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const live = (m) => !!m && !m.dead && m.hp > 0;
  const scaled = (skill, key, perKey, level) => (skill[key] || 0) + (skill[perKey] || 0) * (level - 1);
  const maxHp = (s, h) => h?.stats ? h.stats(s).maxHp : Rules.maxHp(s);

  function accessible(s, id) {
    if (!own(D.skills, id) || !D.skills[id].owner || !own(D.classes, s.classId)) return false;
    const level = own(s.skills, id) ? s.skills[id] : 0;
    if (!Number.isInteger(level) || level < 1 || level > D.skills[id].max) return false;
    const seen = new Set();
    for (let cid = s.classId; own(D.classes, cid) && !seen.has(cid); cid = D.classes[cid].parent) {
      if (D.skills[id].owner === cid) return true;
      seen.add(cid);
    }
    return false;
  }
  function inspect(s, id, p = {}, h) {
    if (!accessible(s, id)) return { error: "ยังไม่ได้เรียนสกิลของอาชีพนี้" };
    const skill = D.skills[id];
    if ((s.cooldowns?.[id] || 0) > 0) return { error: "กำลังรอสกิลพร้อมใช้งาน" };
    if (!(s.player.sp >= skill.sp)) return { error: "SP ไม่เพียงพอ" };
    let target = null;
    if (skill.kind !== "self" && skill.kind !== "sanctuary") {
      target = (s.monsters || []).find((m) => m.uid === (p.target ?? s.target) && live(m));
      if (!target || (h?.dist || distance)(s.player, target) > skill.range)
        return { error: "เลือกศัตรูและเดินเข้าใกล้ก่อน" };
    }
    if (skill.kind === "sanctuary" && s.player.hp >= maxHp(s, h) &&
        !(s.monsters || []).some((m) => live(m) && (h?.dist || distance)(s.player, m) <= skill.radius))
      return { error: "ไม่มีศัตรูในระยะและ HP เต็มแล้ว" };
    return { skill, target, level: s.skills[id] };
  }
  function state(s) {
    if (!s.classCombat) s.classCombat = { buffs: {}, traps: [], orbCharges: 0, orbTimer: 0 };
    return s.classCombat;
  }
  function effect(s, h, x, y, text, color) {
    if (h?.effect) h.effect(s, x, y, text, color);
  }
  function hit(s, m, power, skill, h, id, phase = "direct", source = s.player) {
    if (!live(m)) return;
    return h.damage(s, m, power, true, { magic: !!skill.magic, defenseScale: skill.defenseScale ?? 1, skillId: id, phase, source });
  }
  function face(s, m) {
    if (!m) return;
    const dx = m.x - s.player.x, dy = m.y - s.player.y;
    if (dx || dy) s.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);
  }
  function heal(s, skill, level, h) {
    const amount = Math.min(Math.max(0, maxHp(s, h) - s.player.hp), scaled(skill, "heal", "healPerLevel", level));
    s.player.hp += amount;
    if (amount > 0) effect(s, h, s.player.x, s.player.y - 30, `+${amount} HP`, "#b6edb8");
  }
  function buff(s, id, skill, level) {
    state(s).buffs[id] = {
      remaining: skill.duration,
      atkMultiplier: skill.atkMultiplier ? scaled(skill, "atkMultiplier", "atkPerLevel", level) : 1,
      defBonus: scaled(skill, "defBonus", "defPerLevel", level),
      damageTaken: skill.damageTaken ?? 1,
      fleeBonus: skill.fleeBonus || 0,
    };
  }
  function cast(s, id, p = {}, h) {
    const check = inspect(s, id, p, h);
    if (check.error) return { ok: false, message: check.error };
    const { skill, target, level } = check;
    const power = scaled(skill, "power", "powerPerLevel", level);
    // All state writes start after access, readiness, SP, and target validation.
    s.player.sp -= skill.sp;
    if (!s.cooldowns) s.cooldowns = {};
    s.cooldowns[id] = skill.cooldown;
    s.cooldowns.swing = 0.22;
    face(s, target);
    if (h?.feedback) h.feedback(s, {
      kind: "skill", source: s.player, target: target || s.player,
      facing: s.player.facing, weaponType: D.classes[s.classId].weaponType,
      skillId: id, result: null, phase: "direct", amount: null, magic: !!skill.magic,
    });
    if (skill.kind === "self") {
      heal(s, skill, level, h);
      buff(s, id, skill, level);
    } else if (skill.kind === "sanctuary" || skill.kind === "aoe") {
      const center = skill.kind === "sanctuary" ? s.player : target;
      for (const m of s.monsters || [])
        if (live(m) && (h?.dist || distance)(center, m) <= skill.radius) hit(s, m, power, skill, h, id);
      if (skill.kind === "sanctuary") heal(s, skill, level, h);
      effect(s, h, center.x, center.y, skill.name, skill.color);
    } else if (skill.kind === "trap") {
      // Replacing the previous trap bounds both storage and future damage.
      const trap = { x: target.x, y: target.y, remaining: skill.duration, id, level };
      // A quest trap may outlive placement and an unrelated enemy can walk
      // into it later. Retain the validated target kind until it triggers.
      if (s.autoQuest?.active) trap.requiredKind = target.kind;
      state(s).traps = [trap];
      effect(s, h, target.x, target.y, skill.name, skill.color);
    } else if (skill.kind === "orb") {
      const cs = state(s), charges = clamp(cs.orbCharges || 0, 0, skill.chargeCap);
      cs.orbCharges = 0;
      cs.orbTimer = 0;
      hit(s, target, power + charges * skill.chargePower, skill, h, id);
    } else {
      const hits = skill.hits || 1;
      for (let i = 0; i < hits && live(target); i++) hit(s, target, power, skill, h, id);
      if (skill.kind === "guard" || skill.kind === "combo_buff") buff(s, id, skill, level);
      if (skill.kind === "dot" && live(target)) {
        const dots = (target.classDots || []).filter((dot) => dot.id !== id);
        dots.push({ id, power: scaled(skill, "dotPower", "dotPerLevel", level), remaining: skill.duration, elapsed: 0 });
        target.classDots = dots.slice(-2);
      }
    }
    return { ok: true, message: "" };
  }

  function modifiers(s) {
    const result = { atkMultiplier: 1, defBonus: 0, damageTaken: 1, fleeBonus: 0 };
    for (const b of Object.values(s.classCombat?.buffs || {})) {
      if (!(b.remaining > 0)) continue;
      if (Number.isFinite(b.atkMultiplier)) result.atkMultiplier = Math.max(result.atkMultiplier, clamp(b.atkMultiplier, 1, 3));
      if (Number.isFinite(b.defBonus)) result.defBonus = Math.max(result.defBonus, clamp(b.defBonus, 0, 100));
      if (Number.isFinite(b.damageTaken)) result.damageTaken = Math.min(result.damageTaken, clamp(b.damageTaken, 0.1, 1));
      if (Number.isFinite(b.fleeBonus)) result.fleeBonus = Math.max(result.fleeBonus, clamp(b.fleeBonus, 0, 100));
    }
    return result;
  }
  function afterAttack(s, m, h) {
    if (s.classId !== "orb_weaver" || !m) return;
    const skill = D.skills.orb_burst;
    const cs = state(s);
    cs.orbCharges = clamp((cs.orbCharges || 0) + 1, 0, skill.chargeCap);
    cs.orbTimer = skill.chargeDuration;
    effect(s, h, s.player.x, s.player.y - 42, `แก้วมณี ${cs.orbCharges}/${skill.chargeCap}`, skill.color);
  }
  function tick(s, seconds, h) {
    const dt = Number.isFinite(seconds) ? clamp(seconds, 0, 60) : 0;
    if (!dt) return;
    const cs = s.classCombat;
    if (cs) {
      for (const id of Object.keys(cs.buffs)) {
        cs.buffs[id].remaining = Math.max(0, cs.buffs[id].remaining - dt);
        if (!cs.buffs[id].remaining) delete cs.buffs[id];
      }
      cs.orbTimer = Math.max(0, cs.orbTimer - dt);
      if (!cs.orbTimer) cs.orbCharges = 0;
    }
    for (const m of s.monsters || []) {
      m.snare = Math.max(0, (m.snare || 0) - dt);
      if (!live(m)) {
        if (m.classDots) m.classDots = [];
        m.snare = 0;
        continue;
      }
      if (!m.classDots?.length) continue;
      const remaining = [];
      for (const dot of m.classDots) {
        if (!live(m) || !own(D.skills, dot.id)) break;
        const skill = D.skills[dot.id];
        dot.elapsed += Math.min(dt, Math.max(0, dot.remaining));
        dot.remaining = Math.max(0, dot.remaining - dt);
        // Carry fractional time while keeping every DOT's total hit count bounded.
        const due = Math.min(60, Math.floor((dot.elapsed + 1e-9) / skill.interval));
        for (let i = 0; i < due && live(m); i++) hit(s, m, dot.power, skill, h, dot.id, "dot");
        dot.elapsed = Math.max(0, dot.elapsed - due * skill.interval);
        if (dot.remaining > 0 && live(m)) remaining.push(dot);
      }
      m.classDots = remaining;
    }
    if (!cs) return;
    cs.traps = cs.traps.filter((trap) => {
      trap.remaining = Math.max(0, trap.remaining - dt);
      if (!trap.remaining || !own(D.skills, trap.id)) return false;
      const skill = D.skills[trap.id];
      const m = (s.monsters || []).find((enemy) => live(enemy) &&
        (!trap.requiredKind || enemy.kind === trap.requiredKind) &&
        (h?.dist || distance)(trap, enemy) <= skill.radius);
      if (!m) return true;
      hit(s, m, scaled(skill, "power", "powerPerLevel", trap.level), skill, h, trap.id, "trap", trap);
      if (live(m)) m.snare = Math.max(m.snare || 0, skill.snareDuration);
      effect(s, h, trap.x, trap.y, skill.name, skill.color);
      return false;
    });
  }
  function suggestSkill(s, m, h) {
    const seen = new Set();
    for (let cid = s.classId; own(D.classes, cid) && !seen.has(cid); cid = D.classes[cid].parent) {
      seen.add(cid);
      const id = D.classes[cid].skill;
      if (!accessible(s, id)) continue;
      const skill = D.skills[id];
      if (skill.kind === "self" && s.player.hp >= maxHp(s, h) * 0.8) continue;
      if (skill.kind === "trap" && s.classCombat?.traps?.length) continue;
      if (!inspect(s, id, { target: m?.uid }, h).error) return id;
    }
    return null;
  }
  const api = { cast, tick, modifiers, afterAttack, suggestSkill };
  if (typeof module === "object") module.exports = api;
  else root.BCClassCombat = api;
})(typeof window === "object" ? window : globalThis);
