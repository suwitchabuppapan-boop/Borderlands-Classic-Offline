"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const vm = require("node:vm");
const D = require("../js/classic-data.js");
const C = require("../js/core.js");
const I = require("../js/item-rules.js");
const at = (s, id) => Object.assign(s.player, D.npcs.find(n => n.id === id));
const saved = s => JSON.parse(C.serialize(s)).state;
const economic = s => JSON.stringify({ silver:s.silver, inventory:s.inventory, equipment:s.equipment });

test("all catalog, class, skill, combat and drop data matches published 1.12 except release", t => {
  const context = { module: { exports: {} } };
  let source;
  try { source=execFileSync("git", ["show", "eefb5c3:js/classic-data.js"], {encoding:"utf8",stdio:["ignore","pipe","pipe"]}); }
  catch { t.skip("Published 1.12 parity requires recovery commit eefb5c3 from the source Git branch"); return; }
  vm.runInNewContext(source, context);
  const baseline = JSON.parse(JSON.stringify(context.module.exports));
  const actual = JSON.parse(JSON.stringify(D));
  assert.equal(actual.world.release, "1.15");
  delete actual.world.release; delete baseline.world.release;
  assert.deepEqual(actual, baseline);
});

test("61 items retain 11 complete weapon paths and honest live/planned/legacy sources", () => {
  assert.equal(Object.keys(D.items).length,61);
  const counts={available:0,planned:0,legacy:0};
  for(const id of Object.keys(D.items)) counts[I.availability(id)]++;
  assert.deepEqual(counts,{available:42,planned:17,legacy:2});
  assert.equal(Object.keys(D.itemCatalog.progressions).length,11);
  for(const [type,ids] of Object.entries(D.itemCatalog.progressions)) {
    assert.equal(ids.length,3);
    ids.forEach(id=>assert.equal(D.items[id].weaponType,type));
  }
  for(const id of Object.keys(D.items).filter(id=>I.availability(id)==="planned")) {
    assert.equal(I.buyPrice(id),null);
    assert.ok(I.sourcesFor(id).every(s=>!s.available));
  }
});

for(const classId of Object.keys(D.classes).filter(id=>D.classes[id].tier===1)) {
  test(`fresh ${classId} route buys its starter, changes class and learns through guarded actions`,()=>{
    const s=C.createState(), def=D.classes[classId], weapon=def.trainingWeapon;
    at(s,"merchant"); const before=s.silver;
    assert.equal(C.act(s,"buy",{id:weapon}).ok,true);
    assert.equal(s.silver,before-I.buyPrice(weapon));
    at(s,"guide"); assert.equal(C.act(s,"class",{id:classId}).ok,false);
    C.gain(s,5000,5000); assert.equal(s.jobLevel,10);
    assert.equal(C.act(s,"class",{id:classId}).ok,true);
    assert.equal(s.equipment.weapon,weapon);
    const points=s.skillPoints;
    assert.equal(C.act(s,"learn",{id:def.skill}).ok,true);
    assert.equal(s.skillPoints,points-1); assert.equal(s.skills[def.skill],1);
    const foreign=Object.values(D.classes).find(c=>c.tier===1&&c.skill!==def.skill).skill;
    assert.equal(C.act(s,"learn",{id:foreign}).ok,false);
    assert.equal(s.skills[foreign],0);
  });
}

test("merchant rejects invalid purchases and sales without moving money, gear or items",()=>{
  const s=C.createState();
  const reject=(action,p)=>{const before=economic(s);assert.equal(C.act(s,action,p).ok,false);assert.equal(economic(s),before);};
  reject("buy",{id:"potion"});
  at(s,"merchant");
  for(const qty of [0,-1,1.5,1000,NaN,Infinity,"1"]) reject("buy",{id:"potion",qty});
  for(const id of ["__proto__","constructor","nope","jellopy","moon_blade","training_stick"]) reject("buy",{id});
  reject("buy",{id:"potion",qty:999});
  reject("sell",{id:"training_stick"}); reject("sell",{id:"potion",qty:6});
  s.inventory.potion=100000; reject("buy",{id:"potion"});
  s.inventory.potion=5; s.silver=100000000; reject("sell",{id:"potion"});
});

test("real buy/equip/unequip/sell conserves item quantities and pays exactly advertised prices",()=>{
  const s=C.createState(); at(s,"merchant");
  const initial=s.silver, id="novice_cap", old=s.inventory[id];
  assert.equal(C.act(s,"buy",{id}).ok,true);
  assert.equal(s.inventory[id],old+1);
  assert.equal(C.act(s,"equip",{id}).ok,true);
  assert.equal(s.equipment.head,id); assert.equal(s.inventory[id],old);
  assert.equal(C.act(s,"unequip",{slot:"head"}).ok,true);
  assert.equal(s.inventory[id],old+1);
  assert.equal(C.act(s,"sell",{id}).ok,true);
  assert.equal(s.inventory[id],old);
  assert.equal(s.silver,initial-I.buyPrice(id)+I.sellPrice(id));
});

for(const [id,cls] of Object.entries(D.classes)) {
  test(`raw 1.12 ${id} save preserves class, gear, all 61 item IDs and ancestral skills`,()=>{
    const s=C.createState(); s.classId=id; s.weaponSchool=cls.weaponType;
    s.job=cls.tier?"Swordman":"Novice"; s.equipment.weapon=cls.trainingWeapon;
    for(const key of Object.keys(D.items)) s.inventory[key]=2;
    for(const key of C.skillsFor(s)) if(D.skills[key].owner) s.skills[key]=2;
    s.player.hp=C.stats(s).maxHp; s.player.sp=C.stats(s).maxSp;
    const original=saved(s), raw={version:1,state:original};
    raw.state.combatFeedback={nextId:10,events:[{kind:"attack"}]};
    raw.state.classCombat={orbCharges:3}; raw.state.autoQuest={active:true};
    const next=C.deserialize(JSON.stringify(raw));
    assert.equal(next.classId,id); assert.equal(next.equipment.weapon,cls.trainingWeapon);
    assert.deepEqual(next.inventory,s.inventory); assert.deepEqual(next.skills,s.skills);
    assert.ok(!next.combatFeedback?.events?.length); assert.equal(next.classCombat,undefined);
    assert.ok(!next.autoQuest?.active);
    delete original.combatFeedback; delete original.classCombat; delete original.autoQuest;
    assert.deepEqual(saved(next),original);
  });
}

test("legacy old save migrates school, missing head slot and old stat points",()=>{
  const raw=JSON.parse(C.serialize(C.createState()));
  delete raw.state.classId; delete raw.state.classTrial; delete raw.state.statVersion;
  delete raw.state.equipment.head;
  for(const [id,skill] of Object.entries(D.skills)) if(skill.owner) delete raw.state.skills[id];
  const s=C.deserialize(JSON.stringify(raw));
  assert.equal(s.classId,"villager"); assert.equal(s.statVersion,2);
  assert.equal(s.equipment.head,null); assert.equal(s.skills.first_aid,1);
});

test("final quest reward is atomic at stack ceiling and can only be collected once",()=>{
  // Explicit reward fixture; real kills and travel are covered by the complete route below.
  const s=C.createState(); at(s,"guide");
  s.quest=2; s.questActive=true; s.kills.guardian=1; s.inventory.silver_circlet=100000;
  const before=saved(s); assert.equal(C.act(s,"quest").ok,false);
  assert.deepEqual(saved(s),before);
  s.inventory.silver_circlet=99999; const silver=s.silver;
  assert.equal(C.act(s,"quest").ok,true);
  assert.equal(s.inventory.silver_circlet,100000); assert.equal(s.silver,silver+300);
  const rewarded=saved(s); assert.equal(C.act(s,"quest").ok,false); assert.deepEqual(saved(s),rewarded);
});

test("prepared Auto Quest completes three real quests, six portals and seeded boss loot",()=>{
  const s=C.createState(); C.gain(s,5000,5000); at(s,"merchant");
  assert.equal(C.act(s,"buy",{id:"arun_sword"}).ok,true);
  at(s,"guide"); assert.equal(C.act(s,"class",{id:"swordsman"}).ok,true);
  for(const [id,max] of Object.entries({str:25,vit:18,dex:12,agi:8})) {
    while(s.stats[id]<max) assert.equal(C.act(s,"stat",{id}).ok,true);
  }
  at(s,"healer"); assert.equal(C.act(s,"heal").ok,true);
  assert.equal(C.act(s,"auto-quest").ok,true);
  const transitions=[]; let previous=s.zone, iterations=0;
  for(;iterations<18000 && s.autoQuest.active;iterations++) {
    C.tick(s,.1);
    if(s.zone!==previous) {transitions.push([previous,s.zone]);previous=s.zone;}
  }
  assert.equal(s.autoQuest.phase,"complete",JSON.stringify({status:s.autoQuest,kills:s.kills,iterations}));
  assert.equal(s.quest,3); assert.equal(s.questActive,false); assert.equal(s.zone,0);
  assert.deepEqual(transitions,[[0,1],[1,0],[0,1],[1,2],[2,1],[1,0]]);
  assert.ok(s.kills.poring>=5); assert.ok(s.kills.willow>=5); assert.equal(s.kills.guardian,1);
  assert.ok(s.inventory.jellopy>=5); assert.ok(s.inventory.tree_root>=5);
  assert.equal(s.inventory.guardian_core,1); assert.ok(s.inventory.silver_circlet>=1);
  assert.ok(C.dist(s.player,D.npcs.find(n=>n.id==="guide"))<85);
  assert.equal(JSON.parse(C.serialize(s)).state.quest,3);
});
