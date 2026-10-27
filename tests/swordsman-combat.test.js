'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/core.js'),D=require('../js/classic-data.js'),Combat=require('../js/class-combat.js'),Rules=require('../js/stat-rules.js');
function setup(classId='swordsman') {
  const s=C.createState(),cl=D.classes[classId];s.classId=classId;s.weaponSchool=cl.weaponType;s.job='Swordman';s.equipment.weapon=cl.trainingWeapon;
  Object.assign(s.player,{x:400,y:300,sp:1000});s.monsters=[{uid:'target',kind:'guardian',x:440,y:300,hp:100000,dead:0,cd:999}];
  return s;
}
function advance(s,seconds) {while(seconds>1e-8){const dt=Math.min(.1,seconds);C.tick(s,dt);seconds-=dt;}}
const cast=(s,id)=>C.act(s,'skill',{id,target:s.monsters[0]?.uid});
function seedFor(predicate) {for(let seed=0;seed<100000;seed++){let n=(seed*1664525+1013904223)>>>0;const a=n/4294967296;n=(n*1664525+1013904223)>>>0;if(predicate(a,n/4294967296))return seed;}throw Error('seed');}
function impact(s){return s.combatFeedback.events.filter(e=>e.kind==='impact').at(-1);}
function plan(s,increments){return{classId:s.classId,baseline:Object.fromEntries(C.skillsFor(s).filter(id=>D.skills[id].owner).map(id=>[id,s.skills[id]])),increments};}

test('mastery adds four per level after armor on each physical hit without changing ATK',()=>{
  for(const [classId,skill,mastery] of [['swordsman','arun_slash','swordsman_discipline'],['royal_duelist','royal_flurry','swordsman_twohand_mastery']]){
    const a=setup(classId),b=setup(classId);a.skills[skill]=b.skills[skill]=10> D.skills[skill].max?D.skills[skill].max:10;b.skills[mastery]=10;
    a.seed=b.seed=seedFor(x=>x<.9);assert.equal(C.stats(a).atk,C.stats(b).atk);cast(a,skill);cast(b,skill);
    assert.equal(a.monsters[0].hp-b.monsters[0].hp,40*(D.skills[skill].hits||1));
  }
});
test('Bash and Magnum use their HIT bonuses while other physical class skills retain guaranteed accuracy',()=>{
  const s=setup();s.skills.arun_slash=1;s.seed=seedFor(x=>x>.9);cast(s,'arun_slash');assert.equal(impact(s).result,'miss');
  const high=setup();high.skills.arun_slash=10;high.seed=seedFor(x=>x>.9&&x<.95);cast(high,'arun_slash');assert.equal(impact(high).result,'hit');
  const other=setup('scout');other.skills.quick_stab=1;other.seed=s.seed;cast(other,'quick_stab');assert.equal(impact(other).result,'hit');
});
test('Fatal Blow stuns living nonboss targets and stops their movement and attacks for five seconds',()=>{
  const s=setup();s.skills.arun_slash=10;s.skills.swordsman_fatal_blow=1;s.monsters[0].kind='poring';s.seed=seedFor((a,b)=>a<.9&&b<.25);cast(s,'arun_slash');assert.equal(s.monsters[0].stun,5);
  s.monsters[0].x=480;s.monsters[0].cd=0;const x=s.monsters[0].x;advance(s,1);assert.equal(s.monsters[0].x,x);assert.ok(s.monsters[0].stun>3.9);advance(s,4);assert.equal(s.monsters[0].stun,0,'stun expires after exactly five simulated seconds');assert.ok(s.monsters[0].x<x);
  const boss=setup();boss.skills.arun_slash=10;boss.skills.swordsman_fatal_blow=1;boss.seed=seedFor((a,b)=>a<.9&&b<.25);cast(boss,'arun_slash');assert.ok(!boss.monsters[0].stun);
});
test('Provoke succeeds by level and combines ATK increases with existing reductions while lowering physical DEF',()=>{
  const s=setup();s.monsters[0].kind='willow';s.skills.swordsman_provoke=10;s.seed=seedFor(x=>x<.8);cast(s,'swordsman_provoke');
  const m=s.monsters[0];assert.equal(m.skillDebuffs.swordsman_provoke.remaining,30);assert.equal(Combat.enemyModifiers(m).atkMultiplier,1.32);assert.ok(Math.abs(Combat.enemyModifiers(m).defMultiplier-.45)<1e-9);
  m.skillDebuffs.other={remaining:10,atkMultiplier:.85};assert.ok(Math.abs(Combat.enemyModifiers(m).atkMultiplier-1.32*.85)<1e-9);
  const immune=setup();immune.skills.swordsman_provoke=10;const seed=immune.seed;cast(immune,'swordsman_provoke');assert.ok(!immune.monsters[0].skillDebuffs);assert.equal(immune.seed,seed);
  const undead=setup();undead.monsters[0].kind='poring';undead.monsters[0].element='undead';undead.skills.swordsman_provoke=10;cast(undead,'swordsman_provoke');assert.ok(!undead.monsters[0].skillDebuffs);
});
test('Magnum hits square corners, pushes landed targets two cells, pays nonlethal HP and delays skills only',()=>{
  const s=setup();s.skills.swordsman_sweep=10;s.skills.arun_slash=10;s.monsters[0].x=480;s.monsters[0].y=380;s.player.hp=10;s.seed=seedFor(x=>x<.95);cast(s,'swordsman_sweep');
  assert.ok(s.monsters[0].hp<100000);assert.ok(Math.abs(C.dist(s.monsters[0],{x:480,y:380})-64)<1e-7);assert.equal(s.player.hp,1);assert.equal(s.classCombat.buffs.swordsman_sweep.remaining,10);
  s.monsters[0].x=440;s.monsters[0].y=300;advance(s,.45);assert.equal(C.actionReadiness(s,'arun_slash',{target:'target'}).source,'aftercast');assert.equal(C.act(s,'attack',{target:'target'}).ok,true);advance(s,1.55);assert.equal(cast(s,'arun_slash').ok,true);
});
test('Magnum fire bonus adds a separate elemental portion on future physical hits and expires',()=>{
  const a=setup(),b=setup();for(const s of [a,b]){s.skills.arun_slash=10;s.skills.swordsman_discipline=10;s.seed=seedFor(x=>x<.9);}
  b.classCombat={buffs:{swordsman_sweep:{remaining:10,fireBonus:.2}},traps:[],orbCharges:0,orbTimer:0};b.monsters[0].fireMultiplier=.5;
  cast(a,'arun_slash');cast(b,'arun_slash');assert.ok(impact(b).amount>impact(a).amount);assert.equal(impact(b).amount,Math.round(impact(a).amount*1.1));
  advance(b,10);assert.ok(!b.classCombat.buffs.swordsman_sweep);
});
test('Magnum can empower a sword without a nearby target and failed casts preserve all combat resources',()=>{
  const s=setup();s.monsters=[];s.skills.swordsman_sweep=1;s.player.hp=5;const seed=s.seed;
  assert.equal(cast(s,'swordsman_sweep').ok,true);assert.equal(s.player.hp,1);assert.equal(s.seed,seed);assert.equal(s.classCombat.buffs.swordsman_sweep.fireBonus,.2);
  const before=JSON.stringify({...s,log:[]});assert.equal(cast(s,'swordsman_sweep').ok,false);assert.equal(JSON.stringify({...s,log:[]}),before);
});
test('Endure adds only MDEF, protects seven landed monster hits including absorbed hits, then permits sword flinch',()=>{
  const s=setup();s.skills.swordsman_stance=10;const before=C.stats(s);cast(s,'swordsman_stance');assert.equal(C.stats(s).hardMdef,before.hardMdef+10);assert.equal(C.stats(s).hardDef,before.hardDef);assert.equal(s.classCombat.buffs.swordsman_stance.remaining,37);
  for(let n=0;n<7;n++)Combat.afterPlayerHit(s,n===0?0:1);assert.ok(!s.classCombat.buffs.swordsman_stance);assert.ok(!s.classCombat.flinch);
  Combat.afterPlayerHit(s,1);assert.equal(s.classCombat.flinch,.12);assert.equal(C.actionReadiness(s,'arun_slash',{target:'target'}).ready,false);
});
test('standing recovery waits ten full seconds; moving recovery uses half ordinary HP only',()=>{
  const s=setup();s.monsters=[];s.skills.swordsman_recovery=10;s.player.hp=1;const st=C.stats(s);advance(s,10);assert.ok(Math.abs(s.player.hp-(1+st.hpRegen*2+50+.02*st.maxHp))<1e-7);
  const moving=setup();moving.monsters=[];moving.player.x=320;moving.player.hp=1;moving.skills.swordsman_recovery=10;moving.skills.swordsman_moving_recovery=1;C.act(moving,'move',{x:930,y:510});advance(moving,4);assert.equal(moving.player.hp,1+C.stats(moving).hpRegen*.5);
  const no=setup();no.monsters=[];no.player.x=320;no.player.hp=1;C.act(no,'move',{x:930,y:510});advance(no,4);assert.equal(no.player.hp,1);
});
test('HP item recovery adds the recovery coefficient to VIT rather than multiplying the bonuses',()=>{
  const s=setup();s.skills.swordsman_recovery=10;s.stats.vit=20;s.baseLevel=30;s.player.hp=1;const hp=D.items.potion.hp;assert.equal(C.stats(s).hpItemMultiplier,2.4);C.act(s,'use',{id:'potion'});assert.equal(s.player.hp,1+Math.round(hp*2.4));
});
test('Auto Berserk toggles for one SP, persists at exactly25%, only reduces VIT defense and switches off freely',()=>{
  const s=setup();s.skills.swordsman_auto_berserk=1;s.stats.vit=40;s.stats.agi=20;s.player.hp=C.stats(s).maxHp*.2;const normal=C.stats(s);s.player.sp=1;cast(s,'swordsman_auto_berserk');assert.equal(s.player.sp,0);assert.ok(s.classCombat.autoBerserk.active);
  assert.ok(Math.abs(C.stats(s).atk-normal.atk*1.32)<1e-8);assert.equal(C.stats(s).softDef,Math.floor(40/2)*.45+Math.floor(20/5));assert.equal(C.stats(s).hardDef,normal.hardDef);
  const snapshot=JSON.stringify(s);C.stats(s);assert.equal(JSON.stringify(s),snapshot,'stats are pure');s.player.hp=C.stats(s).maxHp*.25;advance(s,.1);assert.ok(s.classCombat.autoBerserk.active);s.player.hp++;advance(s,.1);assert.ok(!s.classCombat.autoBerserk.active);advance(s,.25);assert.equal(cast(s,'swordsman_auto_berserk').ok,true);assert.ok(!s.classCombat.autoBerserk.enabled);
});
test('a projected plan can satisfy prerequisites in either order and free quest learning requires the guide',()=>{
  const s=setup();s.skillPoints=6;assert.equal(C.act(s,'learn-plan',plan(s,{swordsman_sweep:1,arun_slash:5})).ok,true);assert.equal(s.skillPoints,0);
  assert.equal(C.act(s,'learn',{id:'swordsman_fatal_blow'}).ok,false);Object.assign(s.player,D.npcs.find(n=>n.id==='guide'));s.zone=0;assert.equal(C.act(s,'learn',{id:'swordsman_fatal_blow'}).ok,true);assert.equal(s.skillPoints,0);
});
test('new saves use schema3 and runtime buffs, stun, delays and berserk reset on load',()=>{
  const s=setup();s.skills.swordsman_stance=1;s.skills.swordsman_provoke=5;cast(s,'swordsman_stance');const raw=C.serialize(s);assert.equal(JSON.parse(raw).state.skillVersion,3);const n=C.deserialize(raw);assert.equal(n.classCombat,undefined);assert.deepEqual(n.skills,s.skills);
});

test('unchanged class ticks never allocate sword-only runtime fields',()=>{
  const s=setup('mage');s.monsters[0].cd=999;s.classCombat={buffs:{},traps:[],orbCharges:0,orbTimer:0};
  advance(s,.1);
  assert.equal(Object.hasOwn(s.classCombat,'afterCastDelay'),false);
  assert.equal(Object.hasOwn(s.classCombat,'flinch'),false);
  assert.equal(Object.hasOwn(s.monsters[0],'stun'),false);
  s.monsters[0].dead=1;advance(s,.1);
  assert.equal(Object.hasOwn(s.monsters[0],'stun'),false);
});

test('Auto Quest waits through Endure flinch and Magnum aftercast before using recovery',()=>{
  const Q=require('../js/auto-quest.js');
  for(const source of ['flinch','aftercast']){
    const s=setup();s.player.hp=C.stats(s).maxHp*.4;s.settings.autoPotion=0;s.settings.autoSkill=true;
    Object.assign(s,{zone:1,quest:0,questActive:true,autoQuest:{active:true,phase:'fighting',message:''}});
    const attempts=[];
    Q.tick(s,.1,{stats:C.stats,dist:C.dist,actionReadiness:()=>({ready:false,source,remaining:.1,reason:'temporary'}),act:(_s,action,p)=>{
      attempts.push([action,p]);return {ok:action!=='skill',message:'temporary'};
    }});
    assert.equal(s.autoQuest.active,true,source+' must not permanently block recovery');
    assert.equal(attempts.some(([action,p])=>action==='skill'&&p?.id==='first_aid'),false);
  }
});

test('Auto Berserk stays enabled across portals while temporary battle buffs reset, and death clears the toggle',()=>{
  const s=setup();s.skills.swordsman_auto_berserk=1;s.player.hp=C.stats(s).maxHp*.2;
  assert.equal(cast(s,'swordsman_auto_berserk').ok,true);
  s.classCombat.buffs.swordsman_sweep={remaining:10,fireBonus:.2};s.classCombat.afterCastDelay=2;s.classCombat.flinch=.12;
  Object.assign(s.player,{x:900,y:280});
  assert.equal(C.act(s,'travel',{direction:1}).ok,true);
  assert.deepEqual(s.classCombat.autoBerserk,{enabled:true,active:true});
  assert.deepEqual(s.classCombat.buffs,{});assert.equal(s.classCombat.afterCastDelay,undefined);assert.equal(s.classCombat.flinch,undefined);
  s.player.hp=0;advance(s,.1);assert.equal(s.zone,0);assert.equal(s.classCombat,undefined);
});
