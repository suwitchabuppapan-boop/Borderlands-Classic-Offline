'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/classic-data.js'),R=require('../js/skill-rules.js');
const digest=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ids=['swordsman_discipline','swordsman_twohand_mastery','swordsman_recovery','arun_slash','swordsman_provoke','swordsman_sweep','swordsman_stance','swordsman_moving_recovery','swordsman_fatal_blow','swordsman_auto_berserk'];
const names=['เชี่ยวชาญดาบ','เชี่ยวชาญดาบสองมือ','ฟื้นฟูพลังชีวิต','ฟาดฟันรุนแรง','ยั่วยุ','ระเบิดเพลิง','ยืนหยัด','ฟื้นฟูขณะเคลื่อนที่','กระแทกมึนงง','คลั่งอัตโนมัติ'];
function swordRules(){const file=require.resolve('../js/classic-data.js').replace('classic-data.js','sword-rules.js');assert.ok(fs.existsSync(file),'pure swordsman rules exist');return require(file);}
test('every unaffected skill, item and class property remains byte-exact to release 1.20',()=>{
  const otherSkills=Object.fromEntries(Object.entries(D.skills).filter(([id,s])=>s.owner!=='swordsman').map(([id,s])=>[id,s.owner==='royal_duelist'?Object.fromEntries(Object.entries(s).filter(([k])=>!['name','thai','description'].includes(k))):s]));
  assert.equal(digest(otherSkills),'88e0dd3b8c77bfa44852ee94317abad550458e013c7f4f6d37b3311c40acab1b');
  assert.equal(digest(Object.fromEntries(Object.entries(D.items).filter(([id])=>!['palace_dual_blades','banyan_dual_blades','sun_royal_dual_blades'].includes(id)))),'7c84e479b7513ddf9f8e979faa1515c29c551a828ecc464fb2798fdb44973bdc');
  assert.equal(digest(Object.fromEntries(Object.entries(D.classes).filter(([id])=>!['swordsman','royal_duelist'].includes(id)))),'436583f7318e0e2942417c04629b50ba0bb8ec2963d96ef860fe01c6efd53230');
});
test('the ten Thai swordsman skills have exact caps, prerequisites and free training metadata',()=>{
  assert.deepEqual(D.classes.swordsman.skillIds,ids);assert.equal(Object.keys(D.skills).length,67);
  ids.forEach((id,i)=>{const sk=D.skills[id];assert.equal(sk.name,names[i],id);assert.equal(sk.thai,names[i]);assert.equal(sk.max,i<7?10:1);assert.equal(R.learnCost(id),i<7?1:0);assert.equal(sk.questSkill===true,i>=7);});
  assert.deepEqual(D.skills.swordsman_twohand_mastery.requirements,{swordsman_discipline:1});
  assert.deepEqual(D.skills.swordsman_sweep.requirements,{arun_slash:5});assert.deepEqual(D.skills.swordsman_stance.requirements,{swordsman_provoke:5});
  assert.equal(Object.values(D.skills).filter(s=>s.kind==='passive').length,19);
});
test('two handed swords replace the old weapon family without changing progression IDs or economy',()=>{
  assert.equal(D.weaponTypes.dual_sword,undefined);assert.deepEqual(D.weaponTypes.two_hand_sword,{primaryStat:'str',basicMagic:false,interval:1.08,name:'ดาบสองมือ',hands:2,range:58,approachRange:48,attack:'heavy_swing'});
  assert.equal(D.classes.royal_duelist.weaponType,'two_hand_sword');assert.equal(D.classes.royal_duelist.name,'ขุนดาบราชัน');
  const gear=['palace_dual_blades','banyan_dual_blades','sun_royal_dual_blades'];assert.deepEqual(D.itemCatalog.progressions.two_hand_sword,gear);assert.equal(D.itemCatalog.progressions.dual_sword,undefined);
  gear.forEach((id,i)=>{assert.equal(D.items[id].weaponType,'two_hand_sword');assert.equal(D.items[id].appearance.profile,'two_hand_sword');assert.equal(D.items[id].atk,[10,18,30][i]);assert.equal(D.items[id].price,[65,120,400][i]);assert.equal(D.items[id].weight,11);});
});
test('all ten levels follow the supplied power, SP, HP, duration and status tables',()=>{
  const S=swordRules();assert.equal(S.CELL_SIZE,32);
  for(let lv=1;lv<=10;lv++){
    const bash=S.levelInfo('arun_slash',lv,20),mag=S.levelInfo('swordsman_sweep',lv),pro=S.levelInfo('swordsman_provoke',lv),end=S.levelInfo('swordsman_stance',lv);
    assert.ok(Math.abs(bash.power-(1+.3*lv))<1e-12);assert.equal(bash.sp,lv<=5?8:15);assert.equal(bash.hitBonus,5*lv);
    assert.ok(Math.abs(mag.power-(1+.2*lv))<1e-12);assert.equal(mag.sp,30);assert.equal(mag.hpCost,[20,20,19,19,18,18,17,17,16,16][lv-1]);assert.equal(mag.hitBonus,lv*10);
    assert.ok(Math.abs(pro.successChance-(.5+.03*lv))<1e-12);assert.ok(Math.abs(pro.enemyAtkMultiplier-(1.02+.03*lv))<1e-12);assert.ok(Math.abs(pro.enemyDefMultiplier-(.95-.05*lv))<1e-12);assert.equal(pro.sp,lv+3);
    assert.equal(end.duration,7+3*lv);assert.equal(end.mdefBonus,lv);assert.equal(end.hitLimit,7);
    assert.ok(Math.abs(bash.fatalBlowChance-(lv<6?0:.05*(lv-5)+.02))<1e-12);
  }
  assert.equal(S.levelInfo('swordsman_sweep',10).areaCells,5);assert.equal(S.levelInfo('swordsman_sweep',10).fireBonus,.2);
  assert.equal(S.levelInfo('unknown'),null);assert.equal(S.levelInfo('__proto__'),null);assert.equal(S.levelInfo('arun_slash',99).level,10);
});
test('masteries use equipped sword families and all recovery coefficients stay separate',()=>{
  for(const classId of ['swordsman','city_guardian','royal_duelist']){
    const s={classId,skills:{swordsman_discipline:10,swordsman_twohand_mastery:10,swordsman_recovery:10,swordsman_moving_recovery:1,swordsman_fatal_blow:1}};
    const p=R.passives(s);assert.equal(p.masteryFlat,40,classId);assert.equal(p.physicalMultiplier,1);assert.equal(p.hpRecoveryLevel,10);assert.equal(p.hpItemBonus,1);assert.equal(p.movingHpRecovery,.5);assert.equal(p.fatalBlow,1);
  }
  const neutral=R.passives({classId:'mage',skills:{swordsman_recovery:10,swordsman_discipline:10}});assert.equal(neutral.masteryFlat,0);assert.equal(neutral.hpItemBonus,0);
});
test('learning validates projected prerequisites and free quest training requires the existing guide',()=>{
  const s={classId:'swordsman',zone:0,player:{...D.npcs.find(n=>n.id==='guide')},skills:{arun_slash:0,swordsman_provoke:0,swordsman_discipline:0}};
  assert.ok(R.prerequisiteReason(s,'swordsman_sweep'));assert.equal(R.prerequisiteReason(s,'swordsman_sweep',{arun_slash:5}),'');assert.equal(R.prerequisiteReason(s,'swordsman_twohand_mastery',{swordsman_discipline:1}),'');
  assert.equal(R.trainingReason(s,'swordsman_fatal_blow'),'');s.zone=1;assert.ok(R.trainingReason(s,'swordsman_fatal_blow'));assert.equal(R.trainingReason(s,'arun_slash'),'');
});
test('SP tables preserve inherited discounts and toggle deactivation is free',()=>{
  const s={classId:'royal_duelist',skills:{arun_slash:5,swordsman_provoke:10,swordsman_auto_berserk:1,royal_duelist_rhythm:5}};
  assert.equal(R.spCost(s,'arun_slash'),7);s.skills.arun_slash=6;assert.equal(R.spCost(s,'arun_slash'),13);assert.equal(R.spCost(s,'swordsman_provoke'),12);
  assert.equal(R.spCost(s,'swordsman_auto_berserk'),1);assert.equal(R.spCost(s,'swordsman_auto_berserk',true),0);assert.equal(R.spCost(s,'royal_flurry',true),11);
});
test('pure rule APIs run in browsers, expose finite fire defaults and never mutate source objects',()=>{
  const S=swordRules(),browser={BCData:D};vm.runInNewContext(fs.readFileSync(require.resolve('../js/sword-rules.js'),'utf8'),{window:browser});assert.equal(browser.BCSwordRules.levelInfo('arun_slash',6).sp,15);
  const target=Object.freeze({fireMultiplier:.5}),definition=Object.freeze({fireMultiplier:1.5});assert.equal(S.fireMultiplier(target,definition),.5);assert.equal(S.fireMultiplier({},definition),1.5);assert.equal(S.fireMultiplier({},{}),1);assert.equal(S.fireMultiplier({fireMultiplier:3},{}),1);
  assert.equal(S.isSwordLineage({classId:'royal_duelist'}),true);assert.equal(S.isSwordLineage({classId:'mage'}),false);assert.equal(S.isSwordSkill('swordsman_auto_berserk'),true);assert.equal(S.isSwordSkill('royal_flurry'),false);
  const result=S.levelInfo('swordsman_sweep',10);result.hpCost=999;assert.equal(S.levelInfo('swordsman_sweep',10).hpCost,16);
});
