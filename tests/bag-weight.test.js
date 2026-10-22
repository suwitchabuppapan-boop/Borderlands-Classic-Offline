'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/classic-data.js');
const C = require('../js/core.js');
const I = require('../js/item-rules.js');

// Approved 1.19 unit weights. Prices, item power and drop probabilities are
// independently locked by baseline-regression and skill-catalog tests.
const weights = {
  training_stick:8, potion:1, ether:1, green_potion:1, apple:1,
  iron_sword:10, moon_blade:10, arun_sword:8, palace_dual_blades:11,
  lotus_staff:9, golden_scripture:6, garuda_knuckles:5, moon_kris:4,
  naga_bow:9, arun_sword_shield:13, jade_orb:7, tiger_claws:6, arcane_bow:9,
  cloth_armor:5, leather_armor:10, moon_armor:12, bronze_ring:1, moon_charm:1,
  novice_cap:2, cat_ears:1, silver_circlet:2, jellopy:1, fluff:1,
  tree_root:1, bee_sting:1, guardian_core:2, banyan_robe:7, lotus_hat:2,
  banyan_charm:1, bronze_guard_token:1, moon_crown:2, sun_king_token:1,
  strong_potion:1, bronze_scrap:1, banyan_staff:9, sun_staff:9,
  silverwing_bow:9, sun_bow:9, banyan_dual_blades:11, sun_royal_dual_blades:11,
  banyan_sword_shield:13, bronze_general_sword_shield:13, rain_jade_orb:7,
  sun_jade_orb:7, banyan_scripture:6, sun_scripture:6, stone_garuda_knuckles:5,
  royal_garuda_knuckles:5, crystal_fang_kris:4, moon_shadow_kris:4,
  forest_shadow_claws:6, moon_tiger_claws:6, naga_rune_bow:9, moon_arcane_bow:9,
};
const at = (s,id) => Object.assign(s.player,D.npcs.find(n=>n.id===id));
const emptyGear = () => ({weapon:null,armor:null,accessory:null,head:null});
const counts = s => {
  const result = {...s.inventory};
  for(const id of Object.values(s.equipment).filter(Boolean)) result[id]=(result[id]||0)+1;
  return result;
};
const economy = s => JSON.stringify({silver:s.silver,inventory:s.inventory,equipment:s.equipment});

test('all 59 item IDs have the approved small positive unit weights',()=>{
  assert.equal(Object.keys(weights).length,59);
  assert.deepEqual(Object.fromEntries(Object.entries(D.items).map(([id,item])=>[id,item.weight])),weights);
});

test('a fresh bag includes equipped gear and starter supplies once',()=>{
  const s=C.createState(), st=C.stats(s);
  assert.equal(st.weight,23);
  assert.equal(st.capacity,6830);
  assert.deepEqual(counts(s),{potion:5,ether:3,novice_cap:1,training_stick:1,cloth_armor:1});
});

test('carrying room grows with base level and STR without a class penalty',()=>{
  for(const classId of Object.keys(D.classes)) {
    const s=C.createState();s.classId=classId;
    for(const [level,str,capacity] of [[1,1,6830],[5,1,10030],[15,1,18030],[25,1,26030],[30,1,30030],[30,25,30750],[30,99,32970]]) {
      s.baseLevel=level;s.stats.str=str;
      assert.equal(C.stats(s).capacity,capacity,`${classId}: level ${level}, STR ${str}`);
    }
  }
});

test('earned levels and paid STR reset change capacity without removing carried items',()=>{
  const s=C.createState(), before=counts(s), originalWeight=C.stats(s).weight;
  C.gain(s,1000000,0);
  assert.equal(s.baseLevel,30);assert.equal(C.stats(s).capacity,30030);
  while(s.stats.str<25) assert.equal(C.act(s,'stat',{id:'str'}).ok,true);
  assert.equal(C.stats(s).capacity,30750);
  at(s,'guide');assert.equal(C.act(s,'reset-stats').ok,true);
  assert.equal(s.stats.str,1);assert.equal(C.stats(s).capacity,30030);
  assert.equal(C.stats(s).weight,originalWeight);assert.deepEqual(counts(s),before);
});

for(const [classId,cls] of Object.entries(D.classes)) {
  test(`${classId} counts every carried item once while swapping and removing gear`,()=>{
    const s=C.createState();s.classId=classId;s.weaponSchool=cls.weaponType;
    s.equipment={weapon:cls.trainingWeapon,armor:'cloth_armor',accessory:'bronze_ring',head:'novice_cap'};
    s.inventory=Object.fromEntries(Object.keys(weights).map(id=>[id,2]));
    const owned=counts(s), expected=Object.entries(owned).reduce((total,[id,qty])=>total+weights[id]*qty,0);
    assert.equal(C.stats(s).weight,expected);
    const compatible=Object.keys(D.items).filter(id=>D.items[id].weaponType===cls.weaponType);
    for(const id of [...compatible,'moon_armor','moon_charm','silver_circlet']) {
      assert.equal(C.act(s,'equip',{id}).ok,true,id);
      assert.deepEqual(counts(s),owned,id);assert.equal(C.stats(s).weight,expected,id);
    }
    for(const slot of Object.keys(s.equipment)) {
      assert.equal(C.act(s,'unequip',{slot}).ok,true,slot);
      assert.deepEqual(counts(s),owned,slot);assert.equal(C.stats(s).weight,expected,slot);
    }
    assert.deepEqual(s.equipment,emptyGear());
  });
}

test('quantity buys, sales and consumables change weight by their actual item count',()=>{
  const s=C.createState();s.silver=100000;at(s,'merchant');
  const before=C.stats(s), silver=s.silver;
  assert.equal(C.act(s,'buy',{id:'potion',qty:7}).ok,true);
  assert.equal(C.stats(s).weight,before.weight+7);
  assert.equal(s.silver,silver-7*I.buyPrice('potion'));
  assert.equal(C.act(s,'sell',{id:'potion',qty:3}).ok,true);
  assert.equal(C.stats(s).weight,before.weight+4);
  s.player.hp=1;assert.equal(C.act(s,'use',{id:'potion'}).ok,true);
  assert.equal(C.stats(s).weight,before.weight+3);assert.ok(s.player.hp>1);
  const withEther=C.stats(s).weight;s.player.sp=0;
  assert.equal(C.act(s,'use',{id:'ether'}).ok,true);
  assert.equal(C.stats(s).weight,withEther-1);assert.ok(s.player.sp>0);
});

test('a purchase can exactly fill capacity and rejects the next item atomically',()=>{
  const s=C.createState();at(s,'merchant');s.silver=100000;s.equipment=emptyGear();
  s.inventory={potion:6829};
  assert.equal(C.act(s,'buy',{id:'potion',qty:1}).ok,true);
  assert.equal(C.stats(s).weight,6830);assert.equal(C.stats(s).capacity,6830);
  const before=economy(s);assert.equal(C.act(s,'buy',{id:'potion',qty:1}).ok,false);
  assert.equal(economy(s),before);
  assert.equal(C.act(s,'sell',{id:'potion',qty:100}).ok,true);
  assert.equal(C.stats(s).weight,6730);
});

test('HP and SP regenerate below 50 percent weight and stop exactly at 50 percent',()=>{
  for(const [quantity,regenerates] of [[3414,true],[3415,false]]) {
    const s=C.createState();s.equipment=emptyGear();s.inventory={potion:quantity};s.monsters=[];
    const st=C.stats(s);s.player.hp=st.maxHp-20;s.player.sp=st.maxSp-10;s.regen=3.95;
    const hp=s.player.hp,sp=s.player.sp;C.tick(s,.1);
    assert.equal(s.player.hp,hp+(regenerates?st.hpRegen:0));
    assert.equal(s.player.sp,sp+(regenerates?st.spRegen:0));
  }
});

test('attacks work below 90 percent weight and stop exactly at 90 percent',()=>{
  for(const [quantity,allowed] of [[6146,true],[6147,false]]) {
    const s=C.createState();s.equipment=emptyGear();s.inventory={potion:quantity};
    const target=s.monsters[0];target.x=s.player.x+10;target.y=s.player.y;target.hp=10000;
    const before=target.hp;assert.equal(C.act(s,'attack',{target:target.uid}).ok,allowed);
    if(!allowed) assert.equal(target.hp,before);
  }
});
