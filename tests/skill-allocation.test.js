"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const D = require("../js/classic-data.js");
const C = require("../js/core.js");
const T = require("../js/skill-tree.js");
const api = () => {
  for(const name of ["createAllocation","validateAllocation","adjustAllocation"]) assert.equal(typeof T[name],"function",name+" is a pure allocation API");
  return T;
};
function state(classId="royal_duelist",points=8) {
  const s=C.createState(),cls=D.classes[classId];
  Object.assign(s,{classId,weaponSchool:cls.weaponType,job:cls.tier?"Swordman":"Novice",skillPoints:points});
  s.equipment.weapon=cls.trainingWeapon;
  return s;
}
const copy=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function planned(s,increments) {const draft=api().createAllocation(s);draft.increments={...increments};return draft;}

test("allocation snapshot includes every owned ancestral level, with a fresh empty plan",()=>{
  const r=api();
  for(const classId of Object.keys(D.classes)) {
    const s=state(classId),owned=T.nodesFor(classId).ancestry.map(n=>n.skillId);
    for(const id of owned)s.skills[id]=2;
    const a=r.createAllocation(s),b=r.createAllocation(s);
    assert.deepEqual(a,{classId,baseline:Object.fromEntries(owned.map(id=>[id,2])),increments:{}});
    assert.notEqual(a,b);assert.notEqual(a.baseline,b.baseline);assert.notEqual(a.increments,b.increments);
    assert.equal(Object.hasOwn(a.baseline,"first_aid"),false);
    const check=r.validateAllocation(s,a);assert.equal(check.ok,true);assert.equal(check.spent,0);assert.equal(check.remaining,8);assert.deepEqual(check.entries,[]);
  }
});

test("projected levels and payment entries follow ancestry order rather than click order",()=>{
  const s=state();s.skills.arun_slash=2;
  const draft=planned(s,{royal_duelist_rhythm:1,royal_flurry:2,arun_slash:1});
  const result=api().validateAllocation(s,draft);
  assert.equal(result.ok,true);assert.equal(result.spent,4);assert.equal(result.remaining,4);
  assert.equal(result.levels.arun_slash,3);assert.equal(result.levels.royal_flurry,2);assert.equal(result.levels.royal_duelist_rhythm,1);
  assert.deepEqual(result.entries,[{id:"arun_slash",count:1},{id:"royal_flurry",count:2},{id:"royal_duelist_rhythm",count:1}]);
  assert.equal(s.skills.arun_slash,2);assert.equal(s.skills.royal_flurry,0);assert.equal(s.skillPoints,8);
});

test("plus and minus edit only unconfirmed increments and cannot refund learned levels",()=>{
  const s=state();s.skills.arun_slash=3;
  const initial=api().createAllocation(s);
  assert.equal(T.adjustAllocation(s,initial,"arun_slash",-1).ok,false);
  const add=T.adjustAllocation(s,initial,"arun_slash",1);assert.equal(add.ok,true);assert.deepEqual(add.draft.increments,{arun_slash:1});
  assert.deepEqual(initial.increments,{});
  const remove=T.adjustAllocation(s,add.draft,"arun_slash",-1);assert.equal(remove.ok,true);assert.deepEqual(remove.draft.increments,{});
  assert.equal(s.skills.arun_slash,3);assert.equal(s.skillPoints,8);
});

test("previewing valid or rejected plans never changes actual stats, save bytes, seed or input objects",()=>{
  const s=freeze(state("swordsman")),draft=freeze(planned(s,{swordsman_discipline:3,arun_slash:2}));
  const before=C.serialize(s),stats=C.stats(s),seed=s.seed,original=copy(draft);
  assert.equal(api().validateAllocation(s,draft).ok,true);
  assert.equal(T.adjustAllocation(s,draft,"swordsman_discipline",1).ok,true);
  assert.equal(T.adjustAllocation(s,draft,"shield_counter",1).ok,false);
  assert.equal(T.adjustAllocation(s,draft,"swordsman_discipline",-1).ok,true);
  assert.equal(C.serialize(s),before);assert.deepEqual(C.stats(s),stats);assert.equal(s.seed,seed);assert.deepEqual(draft,original);
});

test("shared, future, sibling, foreign, unknown and prototype skill identifiers are rejected",()=>{
  const s=state("swordsman");
  for(const id of ["first_aid","royal_flurry","shield_counter","lotus_bolt","unknown","__proto__","constructor","toString",null,{},3]) {
    const initial=api().createAllocation(s),adjusted=T.adjustAllocation(s,initial,id,1);
    assert.equal(adjusted.ok,false,String(id));assert.equal(adjusted.draft,null);assert.ok(adjusted.message);
    if(typeof id==="string")assert.equal(T.validateAllocation(s,planned(s,Object.fromEntries([[id,1]]))).ok,false,id);
  }
});

test("missing, extra and changed baseline fields invalidate a plan instead of silently rebasing",()=>{
  const s=state();
  for(const change of [d=>delete d.baseline.arun_slash,d=>d.baseline.first_aid=1,d=>d.baseline.arun_slash=1,d=>d.baseline.arun_slash="0",d=>d.baseline.arun_slash=.5]) {
    const draft=planned(s,{royal_flurry:1});change(draft);assert.equal(T.validateAllocation(s,draft).ok,false);
  }
  const draft=planned(s,{royal_flurry:1});draft.baseline=Object.create(draft.baseline);
  assert.equal(T.validateAllocation(s,draft).ok,false,"inherited baseline values are not progress");
});

test("increment values must be positive finite integers and stay within each skill maximum",()=>{
  const s=state();
  for(const count of [0,-1,1.5,NaN,Infinity,"1",true,null,[],{},6,999]) {
    assert.equal(api().validateAllocation(s,planned(s,{royal_flurry:count})).ok,false,String(count));
  }
  s.skills.royal_flurry=4;
  assert.equal(T.validateAllocation(s,planned(s,{royal_flurry:1})).ok,true);
  assert.equal(T.validateAllocation(s,planned(s,{royal_flurry:2})).ok,false);
  s.skills.royal_flurry=5;
  assert.equal(T.adjustAllocation(s,T.createAllocation(s),"royal_flurry",1).ok,false);
});

test("adjustment deltas accept only exactly numeric plus one or minus one",()=>{
  const s=state(),draft=planned(s,{royal_flurry:1});
  for(const delta of [0,2,-2,.5,NaN,Infinity,"1","-1",true,null,undefined,{},[]])assert.equal(api().adjustAllocation(s,draft,"royal_flurry",delta).ok,false,String(delta));
});

test("available points may grow while a plan is open but insufficient live points invalidate it",()=>{
  const s=state("royal_duelist",2),draft=planned(s,{royal_flurry:2});
  assert.equal(api().validateAllocation(s,draft).remaining,0);
  assert.equal(T.adjustAllocation(s,draft,"arun_slash",1).ok,false);
  s.skillPoints=5;assert.equal(T.validateAllocation(s,draft).remaining,3);assert.equal(T.adjustAllocation(s,draft,"arun_slash",1).ok,true);
  s.skillPoints=1;assert.equal(T.validateAllocation(s,draft).ok,false);assert.equal(T.adjustAllocation(s,draft,"royal_flurry",-1).ok,false,"stale drafts require an explicit fresh snapshot");
});

test("actual learning and class changes invalidate every old baseline",()=>{
  const s=state(),draft=planned(s,{royal_flurry:1});
  assert.equal(C.act(s,"learn",{id:"arun_slash"}).ok,true);
  assert.equal(api().validateAllocation(s,draft).ok,false);
  assert.equal(T.validateAllocation(s,T.createAllocation(s)).ok,true);
  const renewed=T.createAllocation(s);s.classId="city_guardian";
  assert.equal(T.validateAllocation(s,renewed).ok,false);
});

test("malformed states and inherited state fields cannot create or validate an allocation",()=>{
  for(const bad of [null,undefined,{},[],{classId:"__proto__",skills:{},skillPoints:4},Object.create(state())]) {
    assert.equal(api().createAllocation(bad),null);assert.equal(T.validateAllocation(bad,{}).ok,false);
  }
  for(const change of [s=>s.skillPoints=-1,s=>s.skillPoints="8",s=>s.skillPoints=.5,s=>s.skillPoints=Infinity,s=>s.skills=[],s=>delete s.skills.arun_slash,s=>s.skills.arun_slash=6,s=>s.skills.arun_slash=NaN]) {
    const s=state();change(s);assert.equal(T.createAllocation(s),null);assert.equal(T.validateAllocation(s,{}).ok,false);
  }
});

test("draft shape rejects arrays, missing fields, unknown fields and inherited records",()=>{
  const s=state();
  for(const draft of [null,undefined,[],"plan",{}, {classId:s.classId,baseline:{},increments:{}},Object.create(planned(s,{}))])assert.equal(api().validateAllocation(s,draft).ok,false);
  for(const change of [d=>delete d.classId,d=>delete d.increments,d=>d.extra=true,d=>d.increments=[],d=>d.increments=Object.create({royal_flurry:1}),d=>d.baseline=[]]) {
    const draft=planned(s,{});change(draft);assert.equal(T.validateAllocation(s,draft).ok,false);
  }
});

test("valid allocation round trips JSON and returns detached result collections",()=>{
  const s=state(),draft=planned(s,{royal_flurry:2});
  const result=api().validateAllocation(s,copy(draft));assert.equal(result.ok,true);
  result.levels.arun_slash=99;result.entries[0].count=99;
  const again=T.validateAllocation(s,draft);assert.equal(again.levels.arun_slash,0);assert.deepEqual(again.entries,[{id:"royal_flurry",count:2}]);
  assert.equal(s.skills.royal_flurry,0);assert.deepEqual(draft.increments,{royal_flurry:2});
});

test("validated entries can be paid through real core learn actions without refunds or phantom levels",()=>{
  const s=state("royal_duelist",6),draft=planned(s,{swordsman_discipline:1,royal_flurry:3,arun_slash:2});
  const check=api().validateAllocation(s,draft);assert.equal(check.ok,true);
  for(const {id,count} of check.entries)for(let n=0;n<count;n++)assert.equal(C.act(s,"learn",{id}).ok,true);
  assert.equal(s.skillPoints,0);assert.equal(s.skills.arun_slash,2);assert.equal(s.skills.royal_flurry,3);assert.equal(s.skills.swordsman_discipline,1);
  assert.equal(T.validateAllocation(s,draft).ok,false,"paid draft cannot be replayed");
  assert.deepEqual(C.deserialize(C.serialize(s)).skills,s.skills);
});

test("browser export supports the same allocation workflow without core or DOM dependencies",()=>{
  api();const context={window:{BCData:D}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve("../js/skill-tree.js"),"utf8"),context);
  const raw=JSON.stringify(state("swordsman",4));
  const result=vm.runInContext(`(()=>{const s=JSON.parse(${JSON.stringify(raw)}),T=window.BCSkillTree;const d=T.createAllocation(s);return T.validateAllocation(s,T.adjustAllocation(s,d,'arun_slash',1).draft);})()`,context);
  assert.equal(result.ok,true);assert.equal(result.spent,1);assert.equal(result.remaining,3);assert.equal(result.levels.arun_slash,1);
});
