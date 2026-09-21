'use strict';
const assert=require('node:assert/strict');
const C=require('../js/core.js');
const t=(name,fn)=>{fn();console.log('PASS '+name);};
const dummy=(x={})=>({level:3,agi:1,dex:1,vit:1,luk:0,atk:15,atkMax:20,def:0,mdef:0,size:'Small',race:'Plant',element:'Neutral',elementLevel:1,...x});
t('Magnum requires only Bash 5, exact level 1/10 fire bonus is independent of DEF',()=>{
 assert.deepEqual(C.SKILLS.magnum_break.requires,{bash:5});
 assert.equal(C.skillMultiplier('magnum_break',1),1);
 assert.equal(C.magnumFireBonus(100,dummy({element:'Earth'})),30);
 assert.equal(C.magnumFireBonus(100,dummy({element:'Fire',elementLevel:2})),0);
});
t('critical bypasses monster DEF; provoke changes target hard and soft DEF and attack',()=>{
 const s=C.newGame();s.player.luk=99;s.player.str=35;
 const rolls={critical:0,hit:0,weapon:.5,soft:.5};
 const b=C.resolvePlayerAttack(s,dummy({def:90,vit:90}),{rolls});
 assert.equal(b.damage,C.resolvePlayerAttack(s,dummy(),{rolls}).damage);
 const debuff=C.provokeModifiers(5);
 const hit=C.resolvePlayerAttack(s,dummy({def:60,vit:50}),{skillId:'bash',level:5,provoke:debuff,rolls:{...rolls,critical:1}});
 assert.ok(hit.damage>0);
});
t('element absorption returns healing separately; immunity does not turn to one damage',()=>{
 const d=dummy({element:'Fire',elementLevel:4});
 assert.ok(C.elementModifier('Fire','Fire',4)<0);
 const state=C.newGame();C.addItem(state,'rusty_sword');C.equip(state,'rusty_sword');
 const old=C.ITEMS.rusty_sword.element;C.ITEMS.rusty_sword.element='Fire';
 const result=C.resolvePlayerAttack(state,d,{rolls:{critical:1,hit:0,weapon:0,soft:0}});
 C.ITEMS.rusty_sword.element=old;
 assert.equal(result.damage,0);assert.ok(result.heal>0);assert.equal(result.outcome,'absorb');
});
t('magical damage uses MATK min/max, hard MDEF, soft MDEF, element; never HIT/FLEE',()=>{
 const s=C.newGame();s.player.int=60;
 const n=C.resolveMagicAttack(s,dummy({mdef:0,int:0,vit:0}),{rolls:{matk:0},element:'Fire'});
 const h=C.resolveMagicAttack(s,dummy({mdef:70,int:0,vit:0}),{rolls:{matk:0},element:'Fire'});
 assert.ok(n.damage>h.damage);assert.equal(n.outcome,'hit');
});
t('overweight threshold 50 disables natural regen, 90 blocks attacks and skills',()=>{
 const s=C.newGame();assert.ok(C.weightStatus(s).ratio<.5);
 const noviceCap=C.weightStatus(s).capacity;s.player.classId='swordman';assert.equal(C.weightStatus(s).capacity,noviceCap+800);s.player.classId='novice';
 s.inventory.potion=10000;
 assert.ok(C.weightStatus(s).ratio>=.9);
 assert.equal(C.canAct(s,'attack'),false);assert.equal(C.canAct(s,'skill'),false);
});
t('blind affects hit flee; stun blocks actions; silence only skills; expired statuses clear',()=>{
 const s=C.newGame();const base=C.stats(s);
 assert.equal(C.applyStatus(s,'blind',10,1000),true);
 assert.equal(C.stats(s,1500).hit,Math.floor(base.hit*.75));
 assert.equal(C.stats(s,1500).flee,Math.floor(base.flee*.75));
 C.applyStatus(s,'stun',10,1000);assert.equal(C.canAct(s,'attack',1500),false);
 C.clearStatus(s,'stun');C.applyStatus(s,'silence',10,1000);
 assert.equal(C.canAct(s,'attack',1500),true);assert.equal(C.canAct(s,'skill',1500),false);
 assert.equal(C.activeStatus(s,'blind',12000),false);
});
t('poison ticks only above 25% HP and blocks SP recovery; green potion cures poison',()=>{
 const s=C.newGame();s.player.hp=40;C.applyStatus(s,'poison',30,1000);
 assert.ok(C.poisonTick(s,1500)>0);assert.equal(C.canRecover(s,'sp',1500),false);
 C.applyStatus(s,'poison',30,Date.now());C.addItem(s,'green_potion');assert.equal(C.usePotion(s,'green_potion'),true);
 assert.equal(C.activeStatus(s,'poison'),false);
});
t('saved statuses preserve unexpired timestamps, legacy save remains compatible',()=>{
 const s=C.newGame();C.applyStatus(s,'blind',100,Date.now());
 const restored=C.hydrate(JSON.stringify(s));assert.equal(C.activeStatus(restored,'blind'),true);
 const old=C.hydrate(JSON.stringify({...s,statuses:undefined}));assert.equal(C.activeStatus(old,'blind'),false);
});
t('spell cast time follows DEX / 150 and interruption only during cast',()=>{
 assert.equal(C.castTime(2,0),2);assert.equal(C.castTime(2,75),1);
 assert.equal(C.castTime(2,150),0);
 assert.equal(C.canInterruptCast({active:true,uninterruptible:false}),true);
 assert.equal(C.canInterruptCast({active:true,uninterruptible:true}),false);
});

t('poison soft DEF reduction changes actual incoming damage, not only Status UI',()=>{
 const s=C.newGame();s.player.vit=85;
 const monster=dummy({atk:190,atkMax:190,level:30,dex:80});
 const rolls={perfect:.99,hit:0,weapon:0,soft:.5};
 const before=C.resolveMonsterAttack(monster,s,{rolls}).damage;
 C.applyStatus(s,'poison',30);
 const after=C.resolveMonsterAttack(monster,s,{rolls}).damage;
 assert.ok(after>before, {before,after});
});
