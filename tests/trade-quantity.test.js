'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/classic-data.js'),I=require('../js/item-rules.js'),C=require('../js/core.js');
const merchant=D.npcs.find(n=>n.id==='merchant');
const state=()=>({zone:0,player:{x:merchant.x,y:merchant.y},silver:1000,inventory:{potion:5},equipment:{weapon:'arun_sword'},seed:713});
const unit={potion:D.items.potion.weight,jellopy:D.items.jellopy.weight,sword:D.items.arun_sword.weight};
// Five owned potions plus equipped gear; this fixture has room for exactly 25 more.
const carrying={weight:5*unit.potion+unit.sword,capacity:30*unit.potion+unit.sword};
const quote=(s,id='potion',mode='buy',qty=1,load=carrying)=>{assert.equal(typeof I.tradeQuote,'function','pure quote helper must exist');return I.tradeQuote(s,id,mode,qty,load);};
const fields=['ok','message','unitPrice','quantity','total','weightDelta','weightAfter','maxQuantity','owned','near','limit'].sort();

test('buy quote exposes exact unit/total price and projected weight without mutating state',()=>{
  const s=state(),before=JSON.stringify(s),q=quote(s,'potion','buy',3);
  assert.deepEqual(Object.keys(q).sort(),fields);assert.equal(q.ok,true);assert.equal(q.unitPrice,12);assert.equal(q.quantity,3);assert.equal(q.total,36);
  assert.equal(q.weightDelta,3*unit.potion);assert.equal(q.weightAfter,carrying.weight+3*unit.potion);assert.equal(q.maxQuantity,25);assert.equal(q.owned,5);assert.equal(q.near,true);assert.equal(q.limit,999);assert.equal(JSON.stringify(s),before);
});
test('buy maximum respects money, exact weight boundary and stack ceiling independently',()=>{
  const s=state();s.silver=25;let q=quote(s,'potion','buy',3);assert.equal(q.ok,false);assert.equal(q.maxQuantity,2);assert.match(q.message,/ไม่เพียงพอ/);assert.equal(q.total,36);
  const exact={weight:carrying.weight,capacity:carrying.weight+2*unit.potion};
  s.silver=1000;q=quote(s,'potion','buy',2,exact);assert.equal(q.ok,true);assert.equal(q.weightAfter,exact.capacity);assert.equal(q.maxQuantity,2);
  q=quote(s,'potion','buy',3,exact);assert.equal(q.ok,false);assert.equal(q.maxQuantity,2);assert.match(q.message,/น้ำหนัก/);
  const stackLoad=owned=>({weight:owned*unit.potion+unit.sword,capacity:100002*unit.potion+unit.sword});
  s.inventory.potion=99999;s.silver=100000;q=quote(s,'potion','buy',2,stackLoad(99999));assert.equal(q.ok,false);assert.equal(q.maxQuantity,1);assert.match(q.message,/เต็มกระเป๋า/);
  s.inventory.potion=100000;q=quote(s,'potion','buy',1,stackLoad(100000));assert.equal(q.maxQuantity,0);assert.equal(q.ok,false);
});
test('sell quote uses only inventory stock, permits overweight selling and supports more than 999',()=>{
  const s=state();let q=quote(s,'potion','sell',3);assert.equal(q.ok,true);assert.equal(q.unitPrice,6);assert.equal(q.total,18);assert.equal(q.weightDelta,-3*unit.potion);assert.equal(q.weightAfter,carrying.weight-3*unit.potion);assert.equal(q.maxQuantity,5);assert.equal(q.limit,100000);
  const lootLoad={weight:5000*unit.jellopy+unit.sword,capacity:100*unit.jellopy+unit.sword};
  s.inventory={jellopy:5000};q=quote(s,'jellopy','sell',1000,lootLoad);assert.equal(q.ok,true);assert.equal(q.total,2000);assert.equal(q.weightAfter,4000*unit.jellopy+unit.sword);assert.ok(q.weightAfter>lootLoad.capacity,'overweight selling remains possible');assert.equal(q.maxQuantity,5000);
  q=quote(s,'arun_sword','sell',1,lootLoad);assert.equal(q.ok,false);assert.equal(q.owned,0);assert.equal(q.maxQuantity,0);assert.match(q.message,/จำนวนไอเทม/);
  s.inventory.jellopy=100000;q=quote(s,'jellopy','sell',100000,{weight:100000*unit.jellopy+unit.sword,capacity:lootLoad.capacity});assert.equal(q.ok,true);assert.equal(q.maxQuantity,100000);assert.equal(q.total,200000);assert.equal(q.weightAfter,unit.sword,'selling the full stack leaves equipped weight intact');
});
test('sale maximum respects owned stock and the money ceiling without losing leftover stock',()=>{
  const s=state();s.silver=99999988;let q=quote(s,'potion','sell',2);assert.equal(q.ok,true);assert.equal(q.maxQuantity,2);assert.equal(q.total,12);
  q=quote(s,'potion','sell',3);assert.equal(q.ok,false);assert.equal(q.maxQuantity,2);assert.match(q.message,/จำนวนอัฐเต็ม/);
  s.silver=99999995;q=quote(s,'potion','sell',1);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);
  s.silver=1000;q=quote(s,'potion','sell',6);assert.equal(q.ok,false);assert.equal(q.maxQuantity,5);assert.match(q.message,/จำนวนไอเทม/);
});
test('far or wrong-map trading is disabled at the exact proximity boundary',()=>{
  const s=state();s.player.x+=85;let q=quote(s);assert.equal(q.near,false);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);assert.match(q.message,/เดินเข้าใกล้/);
  s.player.x-=.1;assert.equal(quote(s).near,true);s.zone=1;q=quote(s);assert.equal(q.near,false);assert.equal(q.maxQuantity,0);
});
test('quantities are strict safe integers and rejected requests cannot coerce or mutate state',()=>{
  for(const mode of ['buy','sell'])for(const qty of [0,-1,1.5,'2',true,null,undefined,NaN,Infinity,Number.MAX_SAFE_INTEGER,mode==='buy'?1000:100001]){
    const s=state(),before=JSON.stringify(s),q=I.tradeQuote(s,'potion',mode,qty,carrying);assert.equal(q.ok,false,mode+'/'+String(qty));assert.equal(q.quantity,0);assert.equal(q.total,0);assert.equal(JSON.stringify(s),before);
  }
});
test('unknown and prototype item IDs and invalid modes return a stable safe rejection',()=>{
  for(const id of ['__proto__','constructor','toString','missing','',null,17,new String('potion')]){
    const q=quote(state(),id);assert.deepEqual(Object.keys(q).sort(),fields);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);assert.equal(q.total,0);
  }
  for(const mode of ['BUY','purchase',null,{},new String('buy')]){const q=quote(state(),'potion',mode);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);}
});
test('shop-only and unsellable rules retain their existing catalog behavior',()=>{
  let q=quote(state(),'jellopy','buy');assert.equal(q.ok,false);assert.match(q.message,/ร้านไม่ขาย/);
  const s=state();s.inventory.training_stick=1;q=quote(s,'training_stick','sell');assert.equal(q.ok,false);assert.match(q.message,/ขายไอเทมนี้ไม่ได้/);
});
test('malformed state and carrying values reject safely without NaN or negative projections',()=>{
  const bad=[null,{}, {...state(),inventory:null},{...state(),silver:NaN},{...state(),silver:-1},{...state(),inventory:{potion:'5'}},{...state(),inventory:{potion:-1}},{...state(),player:{x:Infinity,y:1}}];
  for(const s of bad){const q=quote(s);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);for(const key of ['total','weightDelta','weightAfter','maxQuantity'])assert.ok(Number.isFinite(q[key]),key);}
  for(const load of [null,{}, {weight:NaN,capacity:2000},{weight:1,capacity:Infinity},{weight:-1,capacity:2000},{weight:1,capacity:-1}]){const q=quote(state(),'potion','buy',1,load);assert.equal(q.ok,false);assert.equal(q.maxQuantity,0);}
});
test('zero-weight and free catalog fixtures avoid division errors and still obey stack/quantity limits',()=>{
  const sandbox={window:{BCData:{...D,items:{...D.items,free_token:{type:'use',price:0,weight:0,sellable:false}},npcs:D.npcs}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/item-rules.js'),'utf8'),sandbox);
  const api=sandbox.window.BCItemRules;assert.equal(typeof api.tradeQuote,'function');const s=state();s.silver=0;s.inventory={free_token:0};
  let q=api.tradeQuote(s,'free_token','buy',999,{weight:400,capacity:400});assert.equal(q.ok,true);assert.equal(q.maxQuantity,999);assert.equal(q.total,0);assert.equal(q.weightDelta,0);assert.equal(q.weightAfter,400);
  s.inventory.free_token=99999;q=api.tradeQuote(s,'free_token','buy',2,{weight:400,capacity:400});assert.equal(q.ok,false);assert.equal(q.maxQuantity,1);
});
test('fresh quotes immediately reflect funds, inventory and weight changes',()=>{
  const s=state();assert.equal(quote(s).maxQuantity,25);s.silver=12;assert.equal(quote(s).maxQuantity,1);s.silver=0;assert.equal(quote(s).maxQuantity,0);
  s.inventory.potion=4;assert.equal(quote(s,'potion','sell',1).maxQuantity,4);assert.equal(quote(s,'potion','sell',1,{weight:4*unit.potion,capacity:10*unit.potion}).weightAfter,3*unit.potion);
});

const marketState=()=>{const s=C.createState();Object.assign(s.player,{x:merchant.x,y:merchant.y});return s;};
const rejectUnchanged=(s,action,p)=>{
  const before=C.serialize(s),seed=s.seed;
  const result=C.act(s,action,p);
  assert.equal(result.ok,false,`${action} ${String(p.id)} ×${String(p.qty)}`);
  assert.equal(C.serialize(s),before,'rejected trades preserve all saved progress and economics');
  assert.equal(s.seed,seed,'rejected trades do not consume combat/drop randomness');
  return result;
};

test('Core buys the requested quantity and pays for exactly its count and weight',()=>{
  const s=marketState(),before=C.stats(s),coins=s.silver,owned=s.inventory.potion,gear={...s.equipment},seed=s.seed;
  assert.equal(C.act(s,'buy',{id:'potion',qty:3}).ok,true);
  assert.equal(s.silver,coins-3*I.buyPrice('potion'));
  assert.equal(s.inventory.potion,owned+3);
  assert.equal(C.stats(s).weight,before.weight+3*unit.potion);
  assert.deepEqual(s.equipment,gear);assert.equal(s.seed,seed);
});

test('Core sells stacks above 999 and the exact 100000 transaction limit while overweight',()=>{
  for(const quantity of [1500,100000]) {
    const s=marketState();s.inventory={jellopy:quantity};
    // The large case also verifies selling remains available after exceeding capacity.
    const before=C.stats(s),coins=s.silver,gear={...s.equipment},seed=s.seed;
    if(quantity===100000)assert.ok(before.weight>before.capacity);
    assert.equal(C.act(s,'sell',{id:'jellopy',qty:quantity}).ok,true);
    assert.equal(s.silver,coins+quantity*I.sellPrice('jellopy'));
    assert.equal(Object.hasOwn(s.inventory,'jellopy'),false,'a fully sold stack is removed');
    assert.equal(C.stats(s).weight,before.weight-quantity*unit.jellopy);
    assert.deepEqual(s.equipment,gear);assert.equal(s.seed,seed);
  }
});

test('Core rejects malformed quantities and item IDs without mutating progress or RNG',()=>{
  for(const mode of ['buy','sell']) {
    for(const qty of [0,-1,1.5,'2',true,null,NaN,Infinity,Number.MAX_SAFE_INTEGER,mode==='buy'?1000:100001]) {
      rejectUnchanged(marketState(),mode,{id:'potion',qty});
    }
    for(const id of ['__proto__','constructor','toString','missing',null,17])rejectUnchanged(marketState(),mode,{id,qty:1});
  }
});

test('Core recomputes stale quotes against live funds, stock and carrying weight',()=>{
  let s=marketState();
  assert.equal(I.tradeQuote(s,'potion','buy',3,C.stats(s)).ok,true);
  s.silver=3*I.buyPrice('potion')-1;
  assert.match(rejectUnchanged(s,'buy',{id:'potion',qty:3}).message,/ไม่เพียงพอ/);

  s=marketState();
  assert.equal(I.tradeQuote(s,'potion','sell',5,C.stats(s)).ok,true);
  s.inventory.potion=4;
  assert.match(rejectUnchanged(s,'sell',{id:'potion',qty:5}).message,/จำนวนไอเทม/);

  s=marketState();
  assert.equal(I.tradeQuote(s,'potion','buy',3,C.stats(s)).ok,true);
  const load=C.stats(s);
  s.inventory.jellopy=Math.floor((load.capacity-load.weight)/unit.jellopy);
  assert.ok(C.stats(s).weight+3*unit.potion>C.stats(s).capacity);
  assert.match(rejectUnchanged(s,'buy',{id:'potion',qty:3}).message,/น้ำหนัก/);
});

test('Core enforces buy stack and sale currency ceilings without partial transactions',()=>{
  let s=marketState();s.silver=100000;s.inventory.potion=100000;
  assert.match(rejectUnchanged(s,'buy',{id:'potion',qty:1}).message,/เต็มกระเป๋า/);
  s=marketState();s.silver=100000000-I.sellPrice('potion');
  assert.match(rejectUnchanged(s,'sell',{id:'potion',qty:2}).message,/จำนวนอัฐเต็ม/);
  assert.equal(C.act(s,'sell',{id:'potion',qty:1}).ok,true);
  assert.equal(s.silver,100000000);assert.equal(s.inventory.potion,4);
});

test('Core cannot sell a worn item until the player returns it to the inventory',()=>{
  const s=marketState();assert.equal(C.act(s,'equip',{id:'novice_cap'}).ok,true);
  assert.equal(s.equipment.head,'novice_cap');assert.equal(Object.hasOwn(s.inventory,'novice_cap'),false);
  assert.match(rejectUnchanged(s,'sell',{id:'novice_cap',qty:1}).message,/จำนวนไอเทม/);
  const coins=s.silver,weight=C.stats(s).weight;
  assert.equal(C.act(s,'unequip',{slot:'head'}).ok,true);
  assert.equal(C.act(s,'sell',{id:'novice_cap',qty:1}).ok,true);
  assert.equal(s.equipment.head,null);assert.equal(s.silver,coins+I.sellPrice('novice_cap'));
  assert.equal(C.stats(s).weight,weight-D.items.novice_cap.weight);
});

test('earned currency above the save ceiling can still be spent to restore a loadable balance',()=>{
  let s=C.createState();s.silver=100000000;s=C.deserialize(C.serialize(s));
  const target=s.monsters.find(m=>m.kind==='poring');
  Object.assign(s.player,{x:target.x-10,y:target.y});
  assert.equal(C.act(s,'auto').ok,true);
  for(let ticks=0;ticks<300&&!s.kills.poring;ticks++)C.tick(s,.1);
  assert.equal(s.kills.poring,1,'a real seeded combat kill supplies the reward');
  assert.equal(s.silver,100000000+D.monsters.poring.silver);
  assert.ok(s.silver>100000000);
  C.act(s,'auto');Object.assign(s.player,{x:merchant.x,y:merchant.y});
  const owned=s.inventory.potion,coins=s.silver;
  assert.equal(I.tradeQuote(s,'potion','sell',1,C.stats(s)).maxQuantity,0);
  assert.match(rejectUnchanged(s,'sell',{id:'potion',qty:1}).message,/จำนวนอัฐเต็ม/);
  assert.equal(C.act(s,'buy',{id:'potion',qty:1}).ok,true);
  assert.equal(s.silver,coins-I.buyPrice('potion'));assert.equal(s.inventory.potion,owned+1);
  assert.ok(s.silver<=100000000);
  const restored=C.deserialize(C.serialize(s));
  assert.equal(restored.silver,s.silver);assert.deepEqual(restored.inventory,s.inventory);
});

test('unequipping onto a full legal stack can be recovered by selling the excess item',()=>{
  let s=C.createState();s.inventory.cloth_armor=100000;s=C.deserialize(C.serialize(s));
  Object.assign(s.player,{x:merchant.x,y:merchant.y});
  assert.equal(C.act(s,'unequip',{slot:'armor'}).ok,true);
  assert.equal(s.inventory.cloth_armor,100001);assert.equal(s.equipment.armor,null);
  const before=C.stats(s),coins=s.silver,seed=s.seed;
  const sale=I.tradeQuote(s,'cloth_armor','sell',1,before);
  assert.equal(sale.ok,true);assert.equal(sale.owned,100001);assert.equal(sale.maxQuantity,100000);
  assert.equal(I.tradeQuote(s,'cloth_armor','buy',1,before).maxQuantity,0);
  rejectUnchanged(s,'sell',{id:'cloth_armor',qty:100001});
  assert.equal(C.act(s,'sell',{id:'cloth_armor',qty:1}).ok,true);
  assert.equal(s.inventory.cloth_armor,100000);
  assert.equal(s.silver,coins+I.sellPrice('cloth_armor'));
  assert.equal(C.stats(s).weight,before.weight-D.items.cloth_armor.weight);assert.equal(s.seed,seed);
  const restored=C.deserialize(C.serialize(s));
  assert.equal(restored.inventory.cloth_armor,100000);assert.equal(restored.equipment.armor,null);
});
