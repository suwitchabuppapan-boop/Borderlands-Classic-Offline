'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../js/classic-data.js');
const file = require('node:path').join(__dirname, '../js/sword-save.js');
const oldFour = ['arun_slash', 'swordsman_sweep', 'swordsman_stance', 'swordsman_discipline'];
const addedSix = ['swordsman_twohand_mastery', 'swordsman_recovery', 'swordsman_provoke', 'swordsman_moving_recovery', 'swordsman_fatal_blow', 'swordsman_auto_berserk'];
const nativeTen = [...oldFour, ...addedSix];
const originals = ['first_aid', 'arun_slash', 'royal_flurry', 'shield_counter', 'lotus_bolt', 'lotus_storm', 'orb_burst', 'ward_script', 'sanctuary', 'garuda_combo', 'quick_stab', 'moon_venom', 'tiger_rend', 'aimed_shot', 'naga_trap', 'arcane_volley'];
const clone = value => JSON.parse(JSON.stringify(value));
function api() { assert.ok(fs.existsSync(file), 'pure swordsman save upgrader exists'); return require(file); }
function fixture(classId = 'royal_duelist') {
  const skills = Object.fromEntries(Object.keys(D.skills).filter(id => !addedSix.includes(id)).map(id => [id, id === 'first_aid' ? 1 : 0]));
  const state = {skillVersion: 2, classId, weaponSchool: classId === 'royal_duelist' ? 'dual_sword' : D.classes[classId].weaponType,
    skillPoints: 7, skills, statVersion: 2, stats: {str: 14, agi: 9, vit: 7, int: 1, dex: 8, luk: 1}, statPoints: 11,
    silver: 984, inventory: {palace_dual_blades: 2, banyan_dual_blades: 1, sun_royal_dual_blades: 1, potion: 5},
    equipment: {weapon: D.classes[classId].trainingWeapon, armor: 'cloth_armor', accessory: null, head: null},
    hotbar: ['skill:arun_slash', 'skill:swordsman_sweep', 'skill:swordsman_stance', null, 'item:potion', null, 'action:attack', null, null],
    baseLevel: 20, jobLevel: 42, exp: 48, jexp: 12, seed: 15423, classTrial: null, quest: 2, questActive: true,
    settings: {autoSkill: true, autoPotion: 30, hair: 1}, player: {x: 240, y: 300, hp: 140, sp: 30, facing: 2}};
  if (['swordsman', 'royal_duelist', 'city_guardian'].includes(classId)) {
    oldFour.forEach((id, i) => skills[id] = [3, 2, 1, 4][i]);
  } else state.hotbar = state.hotbar.map(binding => binding?.startsWith('skill:') ? null : binding);
  if (classId === 'royal_duelist') Object.assign(skills, {royal_flurry: 5, royal_duelist_ring: 3, royal_duelist_tempo: 2, royal_duelist_rhythm: 1});
  return state;
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('v2 refunds exactly four former swordsman skills and conserves C2 progression and equipment', () => {
  const input = fixture(), before = clone(input), result = api().upgrade(freeze(input));
  assert.deepEqual(input, before);
  assert.equal(result.skillVersion, 3); assert.equal(result.skillPoints, 17);
  assert.equal(result.weaponSchool, 'two_hand_sword');
  assert.equal(Object.keys(result.skills).length, 67);
  for (const id of nativeTen) assert.equal(result.skills[id], 0, id);
  for (const id of ['royal_flurry', 'royal_duelist_ring', 'royal_duelist_tempo', 'royal_duelist_rhythm']) assert.equal(result.skills[id], before.skills[id], id);
  assert.deepEqual(result.hotbar, [null, null, null, null, 'item:potion', null, 'action:attack', null, null]);
  for (const key of Object.keys(before).filter(key => !['skillVersion', 'skillPoints', 'weaponSchool', 'skills', 'hotbar'].includes(key))) assert.deepEqual(result[key], before[key], key);
  assert.notEqual(result.inventory, input.inventory); assert.notEqual(result.stats, input.stats); assert.notEqual(result.equipment, input.equipment);
  assert.deepEqual(api().upgrade(result), result, 'reimporting v3 never refunds twice');
});

test('the reset applies to swordsman and both descendants without touching other class skill levels', () => {
  for (const classId of ['swordsman', 'royal_duelist', 'city_guardian', 'mage', 'moon_shadow', 'villager']) {
    const input = fixture(classId), result = api().upgrade(input);
    assert.equal(result.skillPoints, input.skillPoints + (['swordsman', 'royal_duelist', 'city_guardian'].includes(classId) ? 10 : 0), classId);
    for (const [id, value] of Object.entries(input.skills)) if (!oldFour.includes(id)) assert.equal(result.skills[id], value, classId + ':' + id);
    assert.equal(result.weaponSchool, classId === 'royal_duelist' ? 'two_hand_sword' : input.weaponSchool);
  }
});

test('actual unversioned sixteen-key saves refund their Bash only and fill new keys at zero', () => {
  const input = fixture(); delete input.skillVersion;
  input.skills = Object.fromEntries(originals.map(id => [id, input.skills[id]]));
  const result = api().upgrade(input);
  assert.equal(result.skillPoints, 10); assert.equal(Object.keys(result.skills).length, 67);
  for (const id of nativeTen) assert.equal(result.skills[id], 0, id);
  assert.equal(result.skills.royal_flurry, 5);
  input.skills.swordsman_sweep = 2;
  assert.equal(api().upgrade(input).skillPoints, 12, 'present newer historical keys are validated and refunded');
  input.skills.swordsman_sweep = 6;
  assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/);
});

test('historical missing, malformed, overlevel and foreign learned keys reject before refund', () => {
  for (const id of oldFour) for (const value of [6, -1, 0.5, '1', null, NaN, Infinity]) {
    const input = fixture(); input.skills[id] = value;
    assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/, id + ':' + value);
  }
  for (const id of oldFour) { const input = fixture(); delete input.skills[id]; assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/, id); }
  for (const id of oldFour) { const input = fixture('mage'); input.skills[id] = 1; assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/, 'foreign ' + id); }
  const missing = fixture(); delete missing.skillVersion; missing.skills = Object.fromEntries(originals.map(id => [id, missing.skills[id]])); delete missing.skills.arun_slash;
  assert.throws(() => api().upgrade(missing), /ไฟล์เซฟ/);
});

test('unknown legacy IDs and six out-of-era new keys never grant refund or learning', () => {
  const input = fixture(); Object.assign(input.skills, {bash: 99, magnum: 99, provoke: 99, unknown_skill: 999});
  for (const id of addedSix) input.skills[id] = 10;
  const result = api().upgrade(input);
  assert.equal(result.skillPoints, 17);
  for (const id of addedSix) assert.equal(result.skills[id], 0);
  for (const id of ['bash', 'magnum', 'provoke', 'unknown_skill']) assert.equal(Object.hasOwn(result.skills, id), false);
});

test('v3 keeps current levels and requires complete bounded skills, ownership and prerequisites', () => {
  const input = api().upgrade(fixture());
  Object.assign(input.skills, {arun_slash: 10, swordsman_sweep: 10, swordsman_discipline: 1, swordsman_twohand_mastery: 10, swordsman_provoke: 5, swordsman_stance: 10, swordsman_fatal_blow: 1});
  const result = api().upgrade(input); assert.deepEqual(result, input);
  for (const alter of [v => delete v.skills.swordsman_recovery, v => v.skills.arun_slash = 11, v => v.skills.swordsman_fatal_blow = 2,
    v => v.skills.arun_slash = 4, v => v.skills.swordsman_discipline = 0, v => v.skills.swordsman_provoke = 4,
    v => v.skills.lotus_bolt = 1]) {
    const invalid = clone(input); alter(invalid); assert.throws(() => api().upgrade(invalid), /ไฟล์เซฟ/);
  }
});

test('migration cannot inflate the point cap or extend migration to other weapon or class schemas', () => {
  for (const points of [10000, -1, 1.5, '7', Infinity]) { const input = fixture(); input.skillPoints = points; assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/); }
  for (const version of [1, 4, null, '2']) { const input = fixture(); input.skillVersion = version; assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/); }
  for (const classId of ['missing', '__proto__', 'constructor']) { const input = fixture(); input.classId = classId; assert.throws(() => api().upgrade(input), /ไฟล์เซฟ/); }
  const old = fixture('city_guardian'); old.weaponSchool = 'dual_sword'; assert.equal(api().upgrade(old).weaponSchool, 'dual_sword');
  const modern = api().upgrade(fixture()); modern.weaponSchool = 'dual_sword'; assert.equal(api().upgrade(modern).weaponSchool, 'dual_sword');
  const absent = fixture(); delete absent.statVersion; assert.equal(Object.hasOwn(api().upgrade(absent), 'statVersion'), false);
});

test('the browser entry point uses the same pure data-only migration', () => {
  const context = {window: {BCData: D}};
  assert.ok(fs.existsSync(file), 'pure swordsman save upgrader exists');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  const result = context.window.BCSwordSave.upgrade(fixture());
  assert.equal(result.skillPoints, 17); assert.equal(result.skillVersion, 3);
});
