'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const D = require('../js/classic-data.js');
let R;
try { R = require('../js/skill-rules.js'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }

const native = {
  villager: ['first_aid'],
  swordsman: ['arun_slash', 'swordsman_sweep', 'swordsman_stance', 'swordsman_discipline'],
  mage: ['lotus_bolt', 'petal_wave', 'lotus_veil', 'mana_focus'],
  acolyte: ['glyph_strike', 'scripture_wave', 'ward_script', 'steady_mind'],
  scout: ['quick_stab', 'scout_sweep', 'scout_shadow_step', 'scout_weakpoint'],
  archer: ['aimed_shot', 'archer_double_shot', 'archer_backstep', 'archer_bow_mastery'],
  royal_duelist: ['royal_flurry', 'royal_duelist_ring', 'royal_duelist_tempo', 'royal_duelist_rhythm'],
  city_guardian: ['shield_counter', 'city_guardian_wave', 'city_guardian_vow', 'city_guardian_foundation'],
  lotus_mage: ['lotus_storm', 'blossom_mark', 'gather_petals', 'lotus_mastery'],
  orb_weaver: ['orb_burst', 'orb_chain', 'prism_veil', 'orb_attunement'],
  divine_scribe: ['sanctuary', 'verdict_seal', 'cleansing_script', 'mercy_scripture'],
  garuda_monk: ['garuda_combo', 'garuda_pierce', 'garuda_step', 'garuda_body'],
  moon_shadow: ['moon_venom', 'moon_shadow_finisher', 'moon_shadow_veil', 'moon_shadow_toxicology'],
  night_tiger: ['tiger_rend', 'night_tiger_sweep', 'night_tiger_tempo', 'night_tiger_instinct'],
  naga_ranger: ['naga_trap', 'naga_piercing_shot', 'naga_forest_veil', 'naga_hunt_mastery'],
  arcane_archer: ['arcane_volley', 'arcane_harmonic_arrow', 'arcane_arrow_inscription', 'arcane_dual_art'],
};
const state = (classId, skills = {}) => ({ classId, skills });
const rules = () => { assert.ok(R, 'BCSkillRules module exists'); return R; };
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseKeys = ['name','thai','owner','max','sp','cooldown','kind','range','power','powerPerLevel','magic','icon','color','description'];
const originalExtras = {
  arun_slash: [], lotus_bolt: [], ward_script: ['heal','healPerLevel','duration','defBonus','defPerLevel','damageTaken'],
  quick_stab: [], aimed_shot: [], royal_flurry: ['hits'], shield_counter: ['duration','defBonus','defPerLevel','damageTaken'],
  lotus_storm: ['radius'], orb_burst: ['chargePower','chargeCap','chargeDuration'], sanctuary: ['radius','heal','healPerLevel'],
  garuda_combo: ['hits','duration','atkMultiplier','atkPerLevel'], moon_venom: ['dotPower','dotPerLevel','duration','interval'],
  tiger_rend: ['defenseScale','dotPower','dotPerLevel','duration','interval'], naga_trap: ['radius','duration','snareDuration'], arcane_volley: ['radius'],
};

test('approved catalog has exactly 61 matching Thai names, four native skills and 15 passives', () => {
  assert.equal(Object.keys(D.skills).length, 61);
  const approvedIds = Object.values(native).flat();
  assert.equal(new Set(approvedIds).size, 61);
  assert.deepEqual(Object.keys(D.skills).sort(), approvedIds.sort());
  const spec = fs.readFileSync(path.join(__dirname, '../docs/superpowers/specs/2026-10-20-class-skills-effect-parts-design.md'), 'utf8');
  for (const [classId, ids] of Object.entries(native)) {
    assert.deepEqual(D.classes[classId].skillIds, ids);
    for (const id of ids) {
      const match = spec.match(new RegExp('^\\| `' + id + '` \\| ([^|]+) \\|', 'm'));
      assert.ok(match, id + ' in approved spec');
      const name = match[1].replace(/^★\s*/, '').split('·')[0].trim();
      assert.equal(D.skills[id].name, name, id);
      assert.equal(D.skills[id].thai, name, id);
      assert.equal(D.skills[id].owner, classId === 'villager' ? undefined : classId, id);
    }
  }
  assert.equal(Object.values(D.skills).filter(skill => skill.kind === 'passive').length, 15);
  assert.equal(Object.values(D.skills).filter(skill => skill.owner && skill.kind !== 'passive').length, 45);
  assert.equal(D.world.release, '1.19');
});

test('original signatures and non-weight item properties retain exact balance and descriptions', () => {
  const originals = Object.fromEntries(Object.entries(originalExtras).map(([id, extras]) => [id, Object.fromEntries([...baseKeys, ...extras].map(key => [key, D.skills[id][key]]))]));
  originals.first_aid = Object.fromEntries(['name','thai','max','sp','cooldown','icon','description','color'].map(key => [key, D.skills.first_aid[key]]));
  assert.equal(digest(originals), 'a6e1360ab3d4af6a2ecbdc96eb1ad158d52a601ba00a8bf6bf0d102424a863e4');
  const itemsWithoutWeights=Object.fromEntries(Object.entries(D.items).map(([id,{weight,...item}])=>[id,item]));
  assert.equal(digest(itemsWithoutWeights), 'c76ddb1c7806958caa7339af26314a31047a65056e9ac99fc576b8c6551083fc');
  assert.equal(Object.keys(D.items).length, 59);
  for (const [classId, info] of Object.entries(D.classes)) assert.equal(info.skill, classId === 'acolyte' ? 'ward_script' : native[classId][0]);
});

test('every catalog entry has finite explicit balance, category and meaningful description', () => {
  for (const [id, skill] of Object.entries(D.skills)) {
    assert.equal(skill.max, id === 'first_aid' ? 1 : 5, id);
    for (const key of ['sp','cooldown','range','power','powerPerLevel']) assert.ok(Number.isFinite(skill[key]) && skill[key] >= 0, id + ':' + key);
    assert.ok(['attack','buff','utility','passive','heal'].includes(skill.category), id);
    assert.ok(skill.description.length > 15, id);
    if (skill.kind === 'passive') {
      assert.equal(skill.sp, 0, id); assert.equal(skill.cooldown, 0, id); assert.equal(skill.power, 0, id);
      assert.ok(skill.passive && Object.values(skill.passive).some(Number.isFinite), id + ' numerical passive');
    } else { assert.ok(skill.sp > 0, id); assert.ok(skill.cooldown > 0, id); }
  }
});

test('shared and ancestor access excludes future, siblings, foreign and prototype IDs', () => {
  const r = rules();
  for (const [classId, info] of Object.entries(D.classes)) {
    const expected = ['first_aid', ...(info.parent && info.parent !== 'villager' ? native[info.parent] : []), ...(classId === 'villager' ? [] : native[classId])];
    assert.deepEqual(r.skillsFor(classId), expected, classId);
    assert.deepEqual(r.nativeSkills(classId), native[classId]);
    for (const id of Object.keys(D.skills)) assert.equal(r.accessible(state(classId), id), expected.includes(id), classId + ':' + id);
    for (const id of ['__proto__','constructor','toString','unknown','']) assert.equal(r.accessible(state(classId), id), false);
  }
  assert.deepEqual(r.skillsFor('__proto__'), []); assert.deepEqual(r.nativeSkills('constructor'), []);
  assert.equal(r.accessible(state('constructor'), 'first_aid'), false);
  assert.equal(r.accessible(state('swordsman', {arun_slash: 0}), 'arun_slash', true), false);
  assert.equal(r.accessible(state('swordsman', {arun_slash: 1}), 'arun_slash', true), true);
  assert.equal(r.accessible(state('swordsman', {royal_flurry: 5}), 'royal_flurry', true), false);
  assert.equal(r.accessible(state('swordsman', Object.create({arun_slash: 5})), 'arun_slash', true), false);
});

test('helper calls are pure and result collections do not expose catalog arrays', () => {
  const r = rules(), s = state('royal_duelist', {swordsman_discipline: 3, royal_duelist_rhythm: 2});
  const before = JSON.stringify(s), original = [...D.classes.royal_duelist.skillIds];
  for (let i=0;i<3;i++) { r.accessible(s,'arun_slash'); r.spCost(s,'arun_slash'); r.passives(s); r.magicFor(s,'arun_slash'); }
  r.nativeSkills('royal_duelist').pop(); r.skillsFor('royal_duelist').pop();
  assert.deepEqual(D.classes.royal_duelist.skillIds, original); assert.equal(JSON.stringify(s), before);
});

test('zero and inaccessible passives leave exact neutral modifiers and base SP costs', () => {
  const r = rules(), neutral = r.passives(state('villager'));
  for (const classId of Object.keys(D.classes)) {
    assert.deepEqual(r.passives(state(classId)), neutral, classId);
    const foreign = Object.fromEntries(Object.entries(D.skills).filter(([id,skill])=>skill.kind==='passive' && !r.accessible(state(classId),id)).map(([id])=>[id,5]));
    assert.deepEqual(r.passives(state(classId, foreign)), neutral, classId + ' foreign');
    for (const id of r.skillsFor(classId)) assert.equal(r.spCost(state(classId), id), D.skills[id].sp, classId + ':' + id);
  }
});

const passiveExpectations = {
  swordsman_discipline: ['swordsman', 'physicalMultiplier', 1.125],
  royal_duelist_rhythm: ['royal_duelist', 'swordSpReduction', .15],
  city_guardian_foundation: ['city_guardian', 'defBonus', 10],
  mana_focus: ['mage', 'magicSpReduction', .125],
  lotus_mastery: ['lotus_mage', 'aoeMultiplier', 1.15],
  orb_attunement: ['orb_weaver', 'normalMagicMultiplier', 1.175],
  steady_mind: ['acolyte', 'maxHpMultiplier', 1.1],
  mercy_scripture: ['divine_scribe', 'healMultiplier', 1.2],
  garuda_body: ['garuda_monk', 'damageTakenMultiplier', .925],
  scout_weakpoint: ['scout', 'hitBonus', 10],
  moon_shadow_toxicology: ['moon_shadow', 'poisonMultiplier', 1.25],
  night_tiger_instinct: ['night_tiger', 'intervalMultiplier', .875],
  archer_bow_mastery: ['archer', 'bowMultiplier', 1.125],
  naga_hunt_mastery: ['naga_ranger', 'huntMultiplier', 1.2],
  arcane_dual_art: ['arcane_archer', 'magicBowDexFactor', 1.4],
};
for (const [id, [classId,key,expected]] of Object.entries(passiveExpectations)) test(id + ' changes its real numerical modifier only at bounded learned levels', () => {
  const r=rules(), modifiers=r.passives(state(classId,{[id]:5}));
  assert.ok(Math.abs(modifiers[key]-expected)<1e-12, id);
  assert.notEqual(modifiers[key], r.passives(state(classId))[key]);
  assert.deepEqual(r.passives(state(classId,{[id]:999})), modifiers, 'overlevel clamps');
  for (const level of [-10,NaN,Infinity,'5',null]) assert.deepEqual(r.passives(state(classId,{[id]:level})),r.passives(state(classId)),String(level));
});

test('secondary passive values and inherited bonuses apply without double counting', () => {
  const r=rules();
  assert.equal(r.passives(state('city_guardian',{city_guardian_foundation:5})).mdefBonus,5);
  assert.ok(Math.abs(r.passives(state('garuda_monk',{steady_mind:5,garuda_body:5})).maxHpMultiplier-1.2)<1e-12);
  assert.equal(r.passives(state('garuda_monk',{steady_mind:5})).maxSpMultiplier,1.1);
  assert.equal(r.passives(state('night_tiger',{scout_weakpoint:5})).physicalMultiplier,1.075);
  assert.equal(r.passives(state('arcane_archer',{archer_bow_mastery:5})).hitBonus,5);
  assert.equal(r.passives(state('arcane_archer',{arcane_dual_art:5})).magicBowIntFactor,.6);
  assert.deepEqual(r.passives(state('mage',Object.create({mana_focus:5}))),r.passives(state('mage')));
});

test('effective cost discounts only the matching learned skill family and stays finite', () => {
  const r=rules();
  assert.equal(r.spCost(state('royal_duelist',{royal_duelist_rhythm:5}), 'royal_flurry'),11);
  assert.equal(r.spCost(state('royal_duelist',{royal_duelist_rhythm:5}), 'first_aid'),3);
  assert.equal(r.spCost(state('lotus_mage',{mana_focus:5}), 'lotus_storm'),14);
  assert.equal(r.spCost(state('swordsman',{mana_focus:5}), 'arun_slash'),6);
  assert.equal(r.spCost(state('royal_duelist',{royal_duelist_rhythm:999}), 'royal_flurry'),11);
  assert.equal(r.spCost(state('mage'), 'mana_focus'),0);
  assert.equal(r.spCost(state('mage'), 'constructor'),0);
});

test('inherited acolyte attacks adapt to books and knuckles and magic bow remains skill magic', () => {
  const r=rules();
  for (const id of ['glyph_strike','scripture_wave']) {
    assert.equal(r.magicFor(state('acolyte'),id),true);
    assert.equal(r.magicFor(state('divine_scribe'),id),true);
    assert.equal(r.magicFor(state('garuda_monk'),id),false);
  }
  assert.equal(r.magicFor(state('arcane_archer'),'arcane_harmonic_arrow'),true);
  assert.equal(r.magicFor(state('arcane_archer'),'aimed_shot'),false);
  assert.equal(r.magicFor(state('mage'),'constructor'),false);
});
