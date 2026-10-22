"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../js/classic-data.js");
const C = require("../js/core.js");
const I = require("../js/item-rules.js");
const removedSkills = ["bash", "magnum", "provoke"];
const removedItems = ["rusty_sword", "yak_greatsword"];
const rawSave = () => JSON.parse(C.serialize(C.createState()));
const read = raw => C.deserialize(JSON.stringify(raw));
function fighter(classId = "swordsman", seed = 1) {
  const s = C.createState(), cls = D.classes[classId];
  Object.assign(s,{classId,weaponSchool:cls.weaponType,job:cls.tier?"Swordman":"Novice",seed});
  s.equipment.weapon = cls.trainingWeapon; s.player.sp = 1000;
  s.monsters.forEach((m,i)=>Object.assign(m,{x:i?800:280,y:i?100:310,hp:10000,cd:999}));
  return s;
}
test("current content exposes 59 items and 61 skills with no old-save entries or availability category",()=>{
  assert.equal(Object.keys(D.items).length,59); assert.equal(Object.keys(D.skills).length,61);
  assert.equal("legacy" in D.itemCatalog,false);
  for(const id of removedItems){assert.equal(Object.hasOwn(D.items,id),false);assert.equal(I.availability(id),null);assert.deepEqual(I.sourcesFor(id),[]);}
  for(const id of removedSkills){assert.equal(Object.hasOwn(D.skills,id),false);const s=C.createState();s.skills[id]=5;assert.equal(C.skillAvailable(s,id),false);assert.equal(C.act(s,"skill",{id,target:s.monsters[0].uid}).ok,false);assert.equal(C.act(s,"bind",{slot:1,value:`skill:${id}`}).ok,false);}
});
test("a current-format save preserves progress while dropping obsolete identifiers and dangling references",()=>{
  const raw = rawSave(), v = raw.state;
  Object.assign(v,{classId:"swordsman",weaponSchool:"sword",job:"Swordman",baseLevel:12,jobLevel:9,exp:31,jexp:15,silver:1234,statPoints:27,skillPoints:6,quest:1,questActive:true});
  v.skills.arun_slash=3;for(const id of removedSkills)v.skills[id]=0;
  v.skills.unknown_skill=3;v.inventory.rusty_sword=2;v.inventory.yak_greatsword=1;v.inventory.unknown_item=9;
  v.inventory.arun_sword=2;v.equipment.weapon="rusty_sword";v.equipment.accessory="unknown_item";
  v.hotbar=["skill:bash","item:rusty_sword","skill:unknown_skill","item:unknown_item","skill:arun_slash","item:potion","action:attack",null,null];
  const s=read(raw);
  for(const key of ["baseLevel","jobLevel","exp","jexp","silver","statPoints","skillPoints","quest","questActive","classId"])assert.equal(s[key],v[key],key);
  assert.equal(s.skills.arun_slash,3);assert.equal(s.inventory.arun_sword,2);assert.equal(s.inventory.potion,5);
  assert.equal(s.equipment.weapon,null);assert.equal(s.equipment.accessory,null);
  assert.deepEqual(s.hotbar,[null,null,null,null,"skill:arun_slash","item:potion","action:attack",null,null]);
  for(const id of [...removedSkills,"unknown_skill"])assert.equal(Object.hasOwn(s.skills,id),false);
  for(const id of [...removedItems,"unknown_item"])assert.equal(Object.hasOwn(s.inventory,id),false);
  assert.deepEqual(read(JSON.parse(C.serialize(s))).skills,s.skills);
});
test("ancient classless, statless, headless and greatsword schemas are rejected without migration",()=>{
  for(const alter of [v=>delete v.classId,v=>delete v.classTrial,v=>delete v.statVersion,v=>delete v.weaponSchool,v=>delete v.equipment.head,v=>{v.weaponSchool="greatsword";}]){const raw=rawSave();alter(raw.state);assert.throws(()=>read(raw),/ไฟล์เซฟ/);}
});
test("dropping unknown identifiers never relaxes validation for retained data or malformed references",()=>{
  for(const alter of [v=>v.inventory.potion="5",v=>v.skills.first_aid=0,v=>v.skills.arun_slash="0",v=>delete v.skills.arun_slash,v=>v.equipment.weapon="potion",v=>v.equipment.weapon=3,v=>v.equipment.weapon="",v=>v.hotbar[0]="action:obsolete",v=>v.hotbar[0]=17,v=>v.hotbar[0]="skill:obsolete:extra",v=>v.hotbar[0]="item:arun_sword",v=>v.equipment.extra=null]){const raw=rawSave();alter(raw.state);assert.throws(()=>read(raw),/ไฟล์เซฟ/);}
});
test("real attacks expose numeric damage, actual critical and magic outcomes without changing text values",()=>{
  const outcomes=new Set();
  for(let seed=1;seed<=500&&!['hit','critical','miss'].every(k=>outcomes.has(k));seed++){
    const s=fighter("swordsman",seed);s.stats.luk=99;s.stats.dex=1;
    assert.equal(C.act(s,"attack",{target:s.monsters[0].uid}).ok,true);
    const e=s.effects.find(e=>['damage','miss'].includes(e.kind));assert.ok(e);
    assert.equal(e.target,"monster");assert.equal(e.ttl,1);
    if(e.kind==="miss"){outcomes.add("miss");assert.equal(e.text,"MISS");assert.equal(s.monsters[0].hp,10000);}
    else {outcomes.add(e.critical?"critical":"hit");assert.equal(e.amount,10000-s.monsters[0].hp);assert.equal(e.magic,false);assert.equal(e.text,(e.critical?"CRIT ":"")+e.amount);}
  }
  assert.deepEqual([...outcomes].sort(),["critical","hit","miss"]);
  const magic=fighter("mage");C.act(magic,"attack",{target:magic.monsters[0].uid});
  const e=magic.effects.find(e=>e.kind==="damage");assert.ok(e);assert.equal(e.magic,true);assert.equal(e.critical,false);assert.equal(e.amount,10000-magic.monsters[0].hp);
});
test("real incoming hits, ordinary evasion and perfect dodge have distinct structured outcomes",()=>{
  const outcomes=new Set();
  for(let seed=1;seed<=1000&&outcomes.size<3;seed++){
    const s=fighter("swordsman",Math.imul(seed,2654435761)>>>0);s.stats.agi=99;s.stats.luk=99;s.player.x=400;s.player.y=310;s.monsters=s.monsters.slice(0,1);Object.assign(s.monsters[0],{x:420,y:310,cd:0});
    const hp=s.player.hp;C.tick(s,.01);const e=s.effects.find(e=>['damage','miss','lucky'].includes(e.kind));assert.ok(e);assert.equal(e.target,"player");
    outcomes.add(e.kind);if(e.kind==="damage"){assert.equal(e.amount,hp-s.player.hp);assert.equal(e.critical,false);assert.equal(e.magic,false);}else{assert.equal(s.player.hp,hp);assert.equal(e.text,e.kind==="lucky"?"LUCKY":"DODGE");}
  }
  assert.deepEqual([...outcomes].sort(),["damage","lucky","miss"]);
  const s=fighter();s.player.x=400;s.monsters=s.monsters.slice(0,1);Object.assign(s.monsters[0],{kind:"willow",x:420,y:310,cd:0});
  const hp=s.player.hp;C.tick(s,.01);const e=s.effects.find(e=>e.kind==="damage");
  assert.ok(e);assert.equal(e.target,"player");assert.equal(e.magic,true);assert.equal(e.critical,false);assert.equal(e.amount,hp-s.player.hp);
});
