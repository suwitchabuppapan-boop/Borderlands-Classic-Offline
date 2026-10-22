'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/core.js'),D=require('../js/classic-data.js');
function setup(classId='royal_duelist') {
  const s=C.createState(),cls=D.classes[classId];s.classId=classId;s.weaponSchool=cls.weaponType;s.job='Swordman';s.equipment.weapon=cls.trainingWeapon;s.skillPoints=8;s.auto=true;
  return s;
}
function plan(s,increments) {return {classId:s.classId,baseline:Object.fromEntries(C.skillsFor(s).filter(id=>D.skills[id].owner).map(id=>[id,s.skills[id]])),increments};}
test('confirming a plan spends exactly its cost across inherited active and passive skills once',()=>{
  const s=setup(),p=plan(s,{arun_slash:2,royal_flurry:1,royal_duelist_rhythm:2});
  const before={seed:s.seed,hp:s.player.hp,sp:s.player.sp,auto:s.auto,quest:s.quest};
  assert.equal(C.act(s,'learn-plan',p).ok,true);assert.equal(s.skillPoints,3);
  for(const [id,n] of Object.entries(p.increments))assert.equal(s.skills[id],n);
  assert.deepEqual({seed:s.seed,hp:s.player.hp,sp:s.player.sp,auto:s.auto,quest:s.quest},before);
  const once=C.serialize(s);assert.equal(C.act(s,'learn-plan',p).ok,false);assert.equal(C.serialize(s),once,'same stale plan cannot be charged twice');
});
test('invalid, stale or unaffordable plans never apply even a valid first entry',()=>{
  const bad=[p=>p.increments.royal_flurry=6,p=>p.increments.shield_counter=1,p=>p.increments.first_aid=1,p=>p.increments.royal_flurry=-1,p=>p.increments.royal_flurry=1.5,p=>p.increments.royal_flurry='1',p=>p.classId='swordsman',p=>delete p.baseline.arun_slash,p=>p.baseline.arun_slash=1,p=>p.increments={},p=>p.increments=[],p=>p.increments=JSON.parse('{"arun_slash":1,"__proto__":1}'),p=>p.increments={arun_slash:5,royal_flurry:5}];
  for(const alter of bad){const s=setup(),p=plan(s,{arun_slash:1,royal_flurry:1});alter(p);const before=C.serialize(s);assert.equal(C.act(s,'learn-plan',p).ok,false);assert.equal(C.serialize(s),before);}
});
test('point growth is allowed and every class uses the existing access and level caps',()=>{
  for(const classId of Object.keys(D.classes).filter(id=>D.classes[id].tier)) {
    const s=setup(classId),id=D.classes[classId].skill,p=plan(s,{[id]:5});s.skillPoints=9;
    assert.equal(C.act(s,'learn-plan',p).ok,true,classId);assert.equal(s.skills[id],5);assert.equal(s.skillPoints,4);
    const max=C.serialize(s);assert.equal(C.act(s,'learn-plan',plan(s,{[id]:1})).ok,false);assert.equal(C.serialize(s),max);
  }
});
