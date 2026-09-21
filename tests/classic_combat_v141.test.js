'use strict';
const assert=require('node:assert/strict');
const C=require('../js/core.js');
const test=(title,fn)=>{fn();console.log('PASS '+title)};
const rolls={critical:0,hit:0,weapon:0.5,soft:0.5,perfect:0.5};
const dummy=(overrides={})=>({level:5,atk:12,atkMax:15,def:0,vit:1,dex:8,agi:1,luk:0,size:'Medium',race:'Plant',element:'Neutral',elementLevel:1,...overrides});
test('Classic base ATK separates STR quadratic, DEX and LUK; MATK uses INT squares',()=>{
 const s=C.newGame();s.player.str=30;s.player.dex=5;s.player.luk=5;s.player.int=33;
 const t=C.stats(s);assert.equal(t.baseAtk,41);assert.equal(t.matkMin,49);assert.equal(t.matkMax,69);
 assert.equal(t.hardDef,0);assert.ok(t.softDef>0);assert.equal(t.maxHp,42);assert.equal(t.maxSp,14);
});
test('actual CRIT applies target LUK shield and does not use old 60 percent cap',()=>{
 const s=C.newGame();s.player.luk=99;C.addItem(s,'wolf_fang');C.equip(s,'wolf_fang');
 assert.equal(C.stats(s).critDisplay,37);
 assert.ok(Math.abs(C.criticalChance(s, {luk:30})-(.01+.3*99/100+.04-.06))<1e-10);
 assert.equal(C.criticalChance(s,{luk:200}),0);
});
test('Critical ignores hard/soft DEF and ordinary attacks do not use 1.5 multiplier',()=>{
 const s=C.newGame();s.player.luk=99;s.player.str=50;
 const low=C.resolvePlayerAttack(s,dummy(),{rolls});
 const hard=C.resolvePlayerAttack(s,dummy({def:90,vit:80}),{rolls});
 assert.equal(low.outcome,'critical');assert.equal(hard.outcome,'critical');assert.equal(low.damage,hard.damage);
 const skill=C.resolvePlayerAttack(s,dummy(),{skillId:'bash',level:1,rolls});
 assert.notEqual(skill.outcome,'critical');assert.ok(skill.damage>0);
});
test('Weapon level and DEX affect attack variance, size penalties are applied only to weapon ATK',()=>{
 const s=C.newGame();C.addItem(s,'rusty_sword');C.equip(s,'rusty_sword');
 const st=C.stats(s);assert.equal(st.weaponType,'one-hand-sword');
 assert.equal(C.sizeModifier('one-hand-sword','Large'),.75);
 assert.equal(C.sizeModifier('one-hand-sword','Medium'),1);
 assert.equal(C.elementModifier('Fire','Earth',1),1.5);
 assert.equal(C.elementModifier('Neutral','Ghost',2),.25);
 const small=C.resolvePlayerAttack(s,dummy({size:'Small'}),{rolls:{...rolls,critical:.99}});
 const medium=C.resolvePlayerAttack(s,dummy({size:'Medium'}),{rolls:{...rolls,critical:.99}});
 assert.ok(small.damage<=medium.damage);
});
test('Perfect dodge precedes normal hit, only on players; monster weapon attack uses min to max',()=>{
 const s=C.newGame();s.player.luk=99;
 const m=C.MONSTERS.hornet;
 const lucky=C.resolveMonsterAttack(m,s,{rolls:{perfect:0,hit:0,weapon:0.5,soft:0.5}});
 assert.equal(lucky.outcome,'lucky');assert.equal(lucky.damage,0);
 assert.equal(C.monsterCombatStats(m).hit,m.level+m.dex);
 assert.equal(C.monsterCombatStats(m).flee,m.level+m.agi);
 assert.ok(m.atkMax>m.atk&&m.attackDelay>0);
});
test('ASPD uses Classic weapon and class delays; AGI does not change walk speed',()=>{
 const s=C.newGame(),start=C.stats(s);
 assert.equal(start.aspd<=190,true);assert.ok(Math.abs(start.attackInterval-(200-start.aspd)/50)<.00001);
 s.player.agi=70;const next=C.stats(s);assert.equal(start.speed,next.speed);assert.ok(next.aspd>start.aspd);
 C.addItem(s,'rusty_sword');C.equip(s,'rusty_sword');assert.notEqual(C.stats(s).aspd,next.aspd);
});
test('Classic skill properties, SP costs, prerequisites and effect values by level',()=>{
 assert.equal(C.skillCost('first_aid',1),3);assert.equal(C.skillHeal('first_aid',1),5);
 assert.equal(C.skillCost('bash',5),8);assert.equal(C.skillCost('bash',6),15);
 assert.equal(C.skillMultiplier('bash',4),2.1);assert.equal(C.skillMultiplier('bash',10),4);
 assert.equal(C.skillCost('magnum_break',5),30);assert.ok(Math.abs(C.skillMultiplier('magnum_break',5)*1.2-2)<1e-10); // total includes separate Fire bonus
 assert.equal(C.skillCost('provoke',10),13);assert.deepEqual(C.provokeModifiers(10),{success:.8,defReduction:.55,atkBoost:.32,duration:30});
 assert.equal(C.SKILLS.provoke.requires,undefined);assert.deepEqual(C.SKILLS.magnum_break.requires,{bash:5});
});
test('All six Ragnarok monster combat fields carry reference metadata; custom boss explicitly SOLO',()=>{
 for(const [id,m] of Object.entries(C.MONSTERS)){
  if(id==='boss'){assert.equal(m.reference,'solo');continue;}
  for(const f of ['str','agi','vit','int','dex','luk','size','race','element','elementLevel','attackDelay','mdef'])assert.notEqual(m[f],undefined,id+': '+f);
  assert.equal(m.reference,'rathena-pre-re');
 }
 assert.equal(C.MONSTERS.poring.dex,6);assert.equal(C.MONSTERS.poring.luk,30);
 assert.equal(C.MONSTERS.poporing.element,'Poison');
});
