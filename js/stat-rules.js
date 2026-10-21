/* Original SOLO stat balance inspired by the supplied six-stat reference.
 * 1.9: base cap 30 / stat cap 99. Costs 2..11, 48 starting points, level award
 * 4+floor(level/5). Flat defense is scaled to 25% because monsters deal 7..38
 * damage; gear uses 100/(100+DEF), so neither channel becomes immune.
 * Weapon attack intervals are seconds, AGI contributes four times DEX.
 * Regeneration occurs every four seconds, never during 50%+ carried weight.
 */
(function (root) {
  'use strict';
  const D = typeof module === 'object' ? require('./classic-data.js') : root.BCData;
  const Skills = typeof module === 'object' ? require('./skill-rules.js') : root.BCSkillRules;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const factors = {
    villager: [1, 1], swordsman: [1.1, 0.95], mage: [0.95, 1.15], acolyte: [1, 1.15], scout: [1, 1], archer: [1, 1],
    royal_duelist: [1.2, 1], city_guardian: [1.35, 0.95], lotus_mage: [1, 1.3], orb_weaver: [1, 1.3], divine_scribe: [1.1, 1.3],
    garuda_monk: [1.25, 1], moon_shadow: [1.1, 1], night_tiger: [1.2, 0.95], naga_ranger: [1.1, 1], arcane_archer: [1.05, 1.2],
  };
  const value = (s, id) => Number.isFinite(s.stats?.[id]) ? clamp(s.stats[id], 1, 99) : 1;
  const classFactors = s => Object.prototype.hasOwnProperty.call(factors, s.classId) ? factors[s.classId] : factors.villager;
  const maxHp = s => Math.round((140 + (s.baseLevel || 1) * 10) * (1 + (value(s, 'vit') - 1) / 100) * classFactors(s)[0] * Skills.passives(s).maxHpMultiplier);
  const maxSp = s => Math.round((48 + (s.baseLevel || 1) * 2) * (1 + (value(s, 'int') - 1) / 100) * classFactors(s)[1] * Skills.passives(s).maxSpMultiplier);
  const statCost = current => Number.isInteger(current) && current >= 1 && current < 99 ? 2 + Math.floor((current - 1) / 10) : Infinity;
  const levelAward = level => 4 + Math.floor(level / 5);
  function levelTotal(level) { let total = 0; for (let l = 2; l <= level; l++) total += levelAward(l); return total; }
  function statRefund(s) { let total = 0; for (const key of Object.keys(D.statNames)) for (let n = 1; n < value(s, key); n++) total += statCost(n); return total; }
  function calculate(s, mods = {}) {
    const a = Object.fromEntries(Object.keys(D.statNames).map(id => [id, value(s, id)]));
    const info = D.classes[s.classId] || D.classes.villager, profile = D.weaponTypes[info.weaponType];
    const equipment = Object.values(s.equipment || {}).filter(Boolean).map(id => D.items[id]).filter(Boolean);
    const weapon = s.equipment?.weapon ? D.items[s.equipment.weapon] : null;
    const sum = key => equipment.reduce((n, item) => n + (item[key] || 0), 0);
    const bow = profile.primaryStat === 'dex', physicalPrimary = bow ? a.dex : a.str, secondary = bow ? a.str : a.dex;
    const passive = Skills.passives(s);
    const debuff = Object.values(s.player?.skillDebuffs || {}).filter(b => b.remaining > 0);
    const attackPenalty = debuff.reduce((n,b) => Math.min(n,b.atkMultiplier ?? 1),1);
    const hitPenalty = debuff.reduce((n,b) => Math.max(n,b.hitPenalty || 0),0);
    const buff = (mods.atkMultiplier || 1) * passive.physicalMultiplier * attackPenalty;
    // Every display contribution includes its current buff; their sum is ATK/MATK.
    const baseAtk = (8 + (s.baseLevel || 1) + physicalPrimary + Math.floor(secondary / 5) + Math.floor(a.luk / 3)) * buff;
    const gearAtk = (sum('atk') + (weapon?.atk || 0) * (physicalPrimary - 1) * 0.005) * buff;
    const baseMatk = 8 + (s.baseLevel || 1) + Math.floor(a.int * 1.5) + Math.floor(a.dex / 5) + Math.floor(a.luk / 3);
    const gearMatk = sum('matk') + (weapon?.matk || 0) * (a.int - 1) * 0.005;
    const softDef = Math.floor(a.vit / 2) + Math.floor(a.agi / 5), hardDef = sum('def') + (mods.defBonus || 0) + passive.defBonus;
    const softMdef = a.int + Math.floor(a.vit / 5) + Math.floor(a.dex / 5), hardMdef = sum('mdef') + (mods.mdefBonus || 0) + passive.mdefBonus;
    const interval = Math.max(0.35, profile.interval * passive.intervalMultiplier * (mods.intervalMultiplier || 1) / (1 + (a.agi - 1) * 0.008 + (a.dex - 1) * 0.002));
    const hp = maxHp(s), sp = maxSp(s);
    let weight = sum('weight');
    for (const [id, count] of Object.entries(s.inventory || {})) weight += (D.items[id]?.weight || 0) * count;
    return {
      maxHp: hp, maxSp: sp, baseAtk, gearAtk, atk: baseAtk + gearAtk, baseMatk, gearMatk, matk: baseMatk + gearMatk,
      softDef, hardDef, def: softDef + hardDef, softMdef, hardMdef, mdef: softMdef + hardMdef,
      hit: 80 + (s.baseLevel || 1) + a.dex + Math.floor(a.luk / 3) + passive.hitBonus + (mods.hitBonus || 0) - hitPenalty,
      flee: (s.baseLevel || 1) + a.agi + Math.floor(a.luk / 5) + (mods.fleeBonus || 0),
      crit: Math.min(35, 1 + a.luk * 0.3), perfectDodge: a.luk / 10,
      interval, aspd: 200 - 50 * interval, primaryStat: profile.primaryStat, basicMagic: profile.basicMagic,
      hpRegen: 2 + Math.floor(a.vit / 5) + Math.floor(hp / 200), spRegen: 2 + Math.floor(a.int / 6) + Math.floor(sp / 100),
      hpItemMultiplier: 1 + a.vit * 0.02, spItemMultiplier: 1 + a.int * 0.01,
      // Level growth gives every weapon path room for a long farming trip;
      // STR retains its carrying bonus without burdening INT/DEX builds.
      weight, capacity: 6000 + (s.baseLevel || 1) * 800 + a.str * 30,
    };
  }
  const damageTaken = (power, soft, hard, multiplier = 1) => Math.max(1, Math.round((power * 100 / (100 + Math.max(0, hard)) - Math.max(0, soft) * 0.25) * multiplier));
  const playerHitChance = (st, monster) => clamp(st.hit - monster.level * 2 - (monster.agi || 0), 5, 95);
  const enemyHitChance = (monster, st) => clamp(88 + monster.level + (monster.dex || 0) * 0.5 - st.flee, 5, 95);
  const api = { calculate, maxHp, maxSp, statCost, statRefund, levelAward, levelTotal, damageTaken, playerHitChance, enemyHitChance };
  if (typeof module === 'object') module.exports = api; else root.BCStatRules = api;
})(typeof window === 'undefined' ? globalThis : window);
