/* Independent solo RPG game rules. Classic database values are curated in classic-data.js. */
(function(root){'use strict';
const D=root.BorderClassicData||(typeof require!=='undefined'?require('./classic-data.js'):null);
const VERSION=2,MONSTERS=D.MONSTERS,SKILLS=D.SKILLS, clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ITEMS={
 rusty_sword:{name:'Training Sword · SOLO',slot:'weapon',weaponType:'one-hand-sword',weaponLevel:1,element:'Neutral',atk:5,price:65,icon:'⚔',rarity:'common'},
 iron_sword:{name:'Iron Sword · SOLO',slot:'weapon',weaponType:'one-hand-sword',weaponLevel:1,element:'Neutral',atk:12,price:240,icon:'⚔',rarity:'uncommon'},
 moon_blade:{name:'Moon Blade · SOLO',slot:'weapon',weaponType:'one-hand-sword',weaponLevel:1,element:'Neutral',atk:22,price:760,icon:'🗡',rarity:'rare'},
 cloth_armor:{name:'Cloth Armor · SOLO',slot:'armor',def:3,price:65,icon:'♜',rarity:'common'},
 leather_armor:{name:'Leather Armor · SOLO',slot:'armor',def:8,price:200,icon:'♜',rarity:'uncommon'},
 moon_armor:{name:'Moon Armor · SOLO',slot:'armor',def:16,price:730,icon:'♜',rarity:'rare'},
 bronze_ring:{name:'Bronze Ring · SOLO',slot:'accessory',maxHp:24,price:150,icon:'◉',rarity:'uncommon'},
 wolf_fang:{name:'Fang Charm · SOLO',slot:'accessory',atk:3,crit:.04,price:290,icon:'◈',rarity:'uncommon'},
 moon_charm:{name:'Moon Charm · SOLO',slot:'accessory',atk:7,maxSp:25,price:900,icon:'✦',rarity:'rare'},
 potion:{name:'HP Potion · SOLO',slot:'consumable',price:18,icon:'♥',rarity:'common'},
 ether:{name:'SP Potion · SOLO',slot:'consumable',price:28,icon:'✦',rarity:'common'},
 green_potion:{name:'Green Potion',slot:'consumable',price:40,weight:7,icon:'✚',rarity:'common',cures:['poison','silence','blind','chaos']},
 ...Object.fromEntries(Object.entries(D.MATERIALS).map(([id,it])=>[id,{...it,slot:'material',price:0,rarity:'common'}]))
};
// Custom SOLO equipment and potions have explicit local weights; official Green Potion is 7.
const WEIGHTS={rusty_sword:20,iron_sword:30,moon_blade:40,cloth_armor:10,leather_armor:20,moon_armor:40,bronze_ring:10,wolf_fang:10,moon_charm:10,potion:7,ether:7};
for(const [id,item] of Object.entries(ITEMS))if(item.weight===undefined)item.weight=WEIGHTS[id]??1;
const STATUS_IDS=['blind','poison','silence','sleep','stun','freeze','chaos'];
const DISABLED=['stun','sleep','freeze'];
function activeStatus(s,id,nowMs=Date.now()){const expiration=s?.statuses?.[id];return typeof expiration==='number'&&Number.isFinite(expiration)&&expiration>nowMs;}
function applyStatus(s,id,duration=10,nowMs=Date.now()){
 if(!STATUS_IDS.includes(id)||!Number.isFinite(duration)||duration<=0||!s||typeof s!=='object')return false;
 if(!s.statuses||typeof s.statuses!=='object')s.statuses={};
 s.statuses[id]=Math.max(s.statuses[id]||0,nowMs+duration*1000);return true;
}
function clearStatus(s,id){if(!s?.statuses?.[id])return false;delete s.statuses[id];return true;}
function weightStatus(s){let weight=0;for(const [id,n] of Object.entries(s.inventory||{}))if(ITEMS[id])weight+=(ITEMS[id].weight||0)*n;
 for(const id of Object.values(s.equipment||{}))if(ITEMS[id])weight+=ITEMS[id].weight||0;
 const capacity=2000+30*Math.max(1,s.player?.str||1)+(s.player?.classId==='swordman'?800:0);return {weight,capacity,ratio:weight/capacity,over50:weight/capacity>=.5,over90:weight/capacity>=.9};}
function canAct(s,action='attack',nowMs=Date.now()){
 if(DISABLED.some(id=>activeStatus(s,id,nowMs)))return false;
 if(action==='skill'&&activeStatus(s,'silence',nowMs))return false;
 if((action==='attack'||action==='skill')&&weightStatus(s).over90)return false;
 return true;
}
function canRecover(s,kind,nowMs=Date.now()){return !weightStatus(s).over50&&!(kind==='sp'&&activeStatus(s,'poison',nowMs));}
function poisonTick(s,nowMs=Date.now()){
 if(!activeStatus(s,'poison',nowMs))return 0;
 const max=stats(s,nowMs).maxHp,min=Math.ceil(max*.25),p=s.player;
 const loss=Math.min(Math.max(0,p.hp-min),Math.floor(max*.015+2));p.hp-=loss;return loss;
}
function castTime(baseCast,DEX,equipmentMod=1){return Math.max(0,baseCast*equipmentMod*Math.max(0,1-DEX/150));}
function canInterruptCast(cast){return !!cast?.active&&!cast.uninterruptible;}
const QUESTS=[
 {title:'ฝึกหัด: Poring',description:'กำจัด Poring ในทุ่งเริ่มต้น',target:'poring',count:5,exp:12,silver:50},
 {title:'Fabre ในทุ่ง',description:'กำจัด Fabre',target:'fabre',count:5,exp:24,silver:75},
 {title:'Lunatic กระโดด!',description:'กำจัด Lunatic',target:'lunatic',count:4,exp:35,silver:90},
 {title:'Woodland: Willow',description:'กำจัด Willow บริเวณป่าทางขวา',target:'willow',count:5,exp:42,silver:105},
 {title:'ระวัง Hornet',description:'กำจัด Hornet',target:'hornet',count:5,exp:80,silver:175},
 {title:'Poporing ในถ้ำ',description:'กำจัด Poporing ภายในถ้ำ',target:'poporing',count:4,exp:120,silver:235},
 {title:'Guardian · SOLO',description:'เอาชนะ Cavern Guardian',target:'boss',count:1,exp:260,silver:450},
 {title:'Classic Field Hunter',description:'กำจัดมอนสเตอร์ประเภทใดก็ได้ 12 ตัว (ทำซ้ำ)',target:'any',count:12,exp:90,silver:110}
];
const baseExpNext=lv=>lv>=99?0:(D.BASE_NEXT[lv-1]??Math.round(D.BASE_NEXT[D.BASE_NEXT.length-1]*Math.pow(1.17,lv-D.BASE_NEXT.length)));
const jobCap=p=>p.classId==='novice'?10:50;
const jobExpNext=p=>p.jobLv>=jobCap(p)?0:(p.classId==='novice'?D.NOVICE_NEXT[p.jobLv-1]:D.SWORDMAN_NEXT[p.jobLv-1])||0;
const statCost=value=>value<10?2:value<20?3:value<30?4:value<40?5:value<50?6:value<60?8:value<70?10:value<80?12:value<90?15:20;
function newGame(){return {version:VERSION,player:{name:'Novice',classId:'novice',baseLv:1,jobLv:1,exp:0,expNext:9,jobExp:0,jobExpNext:10,statPoints:0,skillPoints:0,str:5,agi:5,vit:5,int:5,dex:5,luk:5,hp:42,sp:11,silver:45,x:250,y:290,zone:0,kills:0,deaths:0},skills:{first_aid:1,bash:0,magnum_break:0,provoke:0},inventory:{potion:5,ether:3},equipment:{weapon:null,armor:null,accessory:null},quest:{stage:0,kills:0,claimed:0},settings:{autoPotion:true,autoSkill:true,potionThreshold:.4,sound:false},statuses:{},log:[],savedAt:Date.now()};}
// iRO Wiki Classic refs: /classic/Attacks, /classic/Stats, /classic/ASPD, /classic/HP,
// /classic/Max_SP, /classic/DEF, /classic/Element and /classic/Size.
// Limited to this game's Novice/Swordman, fist/1H sword, normal physical hits and 4 skills.
const ELEMENTS=['Neutral','Water','Earth','Fire','Wind','Poison','Holy','Shadow','Ghost','Undead'];
const ELEMENT_MATRIX=[
 // Wiki Classic element tables: rows = defender, columns = attacker, both in ELEMENTS order.
 [[1,1,1,1,1,1,1,1,.25,1],[1,.25,1,.5,1.75,1,1,1,1,1],[1,1,1,1.5,.5,1.25,1,1,1,1],[1,1.5,.5,.25,1,1.25,1,1,1,1],[1,.5,1.5,1,.25,1.25,1,1,1,1],[1,1,1,1,1,0,1,.5,1,.5],[1,.75,.75,.75,.75,.75,0,1.25,.75,1],[1,1,1,1,1,.5,1.25,0,.75,0],[.25,1,1,1,1,1,1,1,1.25,1],[1,1,1,1.25,1,-.25,1.5,-.25,1,0]],
 [[1,1,1,1,1,1,1,1,0,1],[1,0,1,.25,1.75,.75,1,1,.75,.75],[1,1,.5,1.75,.25,1.25,1,1,.75,.75],[1,1.75,.25,0,1,1.25,1,1,.75,.75],[1,.25,1.75,1,0,1.25,1,1,.75,.75],[1,1,1,1,1,0,1,.25,.75,.25],[1,.5,.5,.5,.5,.5,-.25,1.5,.5,1.25],[1,.75,.75,.75,.75,.25,1.5,-.25,.5,0],[.25,1,1,1,1,.75,1,1,1.5,1],[1,1,1,1.5,1,-.5,1.75,-.5,1.25,0]],
 [[1,1,1,1,1,1,1,1,0,1],[1,-.25,1,0,2,.5,1,1,.5,.5],[1,1,0,2,0,1,1,1,.5,.5],[1,2,0,-.25,1,1,1,1,.5,.5],[1,0,2,1,-.25,1,1,1,.5,.5],[1,1,1,1,1,0,1.25,0,.5,0],[1,.25,.25,.25,.25,.25,-.5,1.75,.25,1.5],[1,.5,.5,.5,.5,0,1.75,-.5,.25,0],[0,1,1,1,1,.5,1,1,1.75,1],[1,1.25,1,1.75,1,-.75,2,-.75,1.5,0]],
 [[1,1,1,1,1,1,1,1,0,1],[1,-.5,1,0,2,.25,.75,.75,.25,.25],[1,1,-.25,2,0,.75,.75,.75,.25,.25],[1,2,0,-.5,1,.75,.75,.75,.25,.25],[1,0,2,1,-.5,.75,.75,.75,.25,.25],[1,.75,.75,.75,.75,0,1.25,-.25,.25,-.25],[1,0,0,0,0,0,-1,2,0,1.75],[1,.25,.25,.25,.25,-.25,2,-1,0,0],[0,1,1,1,1,.25,1,1,2,1],[1,1.5,.5,2,1,-1,2,-1,1.75,0]]
];
const SIZE_MATRIX={fist:{Small:1,Medium:1,Large:1},'one-hand-sword':{Small:.75,Medium:1,Large:.75}};
function sizeModifier(type='fist',size='Medium'){return SIZE_MATRIX[type]?.[size]??1;}
function elementModifier(attack='Neutral',defense='Neutral',level=1){const a=ELEMENTS.indexOf(attack),b=ELEMENTS.indexOf(defense);return a<0||b<0?1:ELEMENT_MATRIX[clamp(Math.floor(level)-1,0,3)][b][a];}
function weaponInfo(s){const item=ITEMS[s.equipment?.weapon];return item&&item.slot==='weapon'?item:null;}
function classicASPD(s){const p=s.player,w=weaponInfo(s),type=w?.weaponType||'fist',jobBase=156;
 const weaponPenalty=type==='one-hand-sword'?(p.classId==='swordman'?-7:-17):0;
 const wd=200-(jobBase+weaponPenalty),agi=p.agi,dex=p.dex;
 const speedMod=clamp(Number(s.combatModifiers?.attackSpeed)||0,-.9,.9);
 const aspd=200-(wd-(Math.round(wd*agi/25)+Math.round(wd*dex/100))/10)*(1-speedMod);
 return Math.round(clamp(aspd,0,190)*100)/100;
}
function attackInterval(s){return (200-classicASPD(s))/50;}
function hitChance(attackerHit,defenderFlee){return clamp((80+attackerHit-defenderFlee)/100,.05,1);}
function attackHits(attackerHit,defenderFlee,roll=Math.random()){return roll<hitChance(attackerHit,defenderFlee);}
function effectiveFlee(flee,attackers=1){return Math.floor(flee*Math.max(0,1-Math.max(0,attackers-2)*.1));}
function monsterCombatStats(monster){const lv=monster.level||1;return {hit:lv+(monster.dex??1),flee:lv+(monster.agi??1),attackInterval:(monster.attackDelay||1600)/1000};}
function baseHp(p){let hp=35+5*p.baseLv;if(p.classId==='swordman')for(let i=2;i<=p.baseLv;i++)hp+=Math.round(.7*i);return hp;}
function stats(s,nowMs=Date.now()){const p=s.player,eq=Object.values(s.equipment||{}).map(id=>ITEMS[id]).filter(Boolean),bonus=k=>eq.reduce((acc,it)=>acc+(it[k]||0),0),w=weaponInfo(s);
 const baseAtk=p.str+Math.floor(p.str/10)**2+Math.floor(p.dex/5)+Math.floor(p.luk/5)+(eq.filter(it=>it.slot!=='weapon').reduce((sum,it)=>sum+(it.atk||0),0));
 const hardDef=bonus('def'),softDef=Math.floor(p.vit/2)+Math.max(Math.floor(p.vit*.3),Math.floor(p.vit*p.vit/150)-1);
 const maxHp=Math.floor(baseHp(p)*(1+p.vit/100))+bonus('maxHp');
 const maxSp=Math.floor((10+p.baseLv*(p.classId==='swordman'?2:1))*(1+p.int/100))+bonus('maxSp');
 const aspd=classicASPD(s),interval=(200-aspd)/50,weaponAtk=w?.atk||0;
 const blinded=activeStatus(s,'blind',nowMs),immobile=['stun','sleep','freeze'].some(id=>activeStatus(s,id,nowMs));
 const critBonus=bonus('crit'),critDisplay=Math.floor(p.luk/3)+Math.round(critBonus*100);
 return {maxHp,maxSp,atk:baseAtk+weaponAtk,baseAtk,weaponAtk,weaponLevel:w?.weaponLevel||0,weaponType:w?.weaponType||'fist',weaponElement:w?.element||'Neutral',
  matkMin:p.int+Math.floor(p.int/7)**2,matkMax:p.int+Math.floor(p.int/5)**2,
  def:hardDef,hardDef,softDef:activeStatus(s,'poison',nowMs)?Math.floor(softDef*.75):softDef,hardMdef:bonus('mdef'),softMdef:p.int+Math.floor(p.vit/2),
  hit:blinded?Math.floor((p.baseLv+p.dex)*.75):p.baseLv+p.dex,flee:immobile?0:blinded?Math.floor((p.baseLv+p.agi)*.75):p.baseLv+p.agi,perfectDodge:immobile?0:1+Math.floor(p.luk/10),aspd,attackInterval:interval,
  crit:clamp((1+p.luk*.3+critBonus*100)/100,0,1),critDisplay,speed:135};
}
function criticalChance(s,target){const st=stats(s),weaponMult=st.weaponType==='katar'?2:1;return clamp(st.crit*weaponMult-(target.luk||0)/500,0,1);}
function perfectDodgeChance(s,nowMs=Date.now()){return stats(s,nowMs).perfectDodge/100;}
function skillCost(id,level=1){level=clamp(Math.floor(level),1,10);if(id==='first_aid')return 3;if(id==='bash')return level<=5?8:15;if(id==='magnum_break')return 30;if(id==='provoke')return 3+level;return 0;}
function skillHeal(id,level=1){return id==='first_aid'?5:0;}
function skillMultiplier(id,level=1){level=clamp(Math.floor(level),1,10);if(id==='bash')return [1.3,1.6,1.9,2.1,2.4,2.7,3,3.3,3.6,4][level-1];if(id==='magnum_break')return 1+(level-1)/6;return 1;}
function skillAccuracy(id,level=1){return id==='bash'?1+.05*level:id==='magnum_break'?1+.1*level:1;}
function provokeModifiers(level=1){level=clamp(Math.floor(level),1,10);return {success:(50+3*level)/100,defReduction:(5+5*level)/100,atkBoost:(2+3*level)/100,duration:30};}
// The 120-300% table includes an extra 20% Fire portion, which bypasses DEF;
// base physical portion is (1.2 + .2*(level-1))/1.2, before rounding.
function magnumFireBonus(preDefenseDamage,target,bonuses={}){
 const element=elementModifier('Fire',target.element||'Neutral',target.elementLevel||1);
 if(!element)return 0;
 return Math.trunc(Math.max(0,preDefenseDamage)*.2*element*damageBonus({bonuses},target));
}
function rollInt(min,max,roll=Math.random()){ return Math.floor(min+clamp(roll,0,.999999999)*(max-min+1));}
function monsterSoftDef(monster,roll=.5){const v=monster.vit??1;return v+rollInt(0,Math.max(0,Math.floor(v/20)**2-1),roll);}
function playerSoftDef(s,roll=.5){const vit=s.player.vit;return Math.floor(vit/2)+rollInt(Math.floor(vit*.3),Math.max(Math.floor(vit*.3),Math.floor(vit*vit/150)-1),roll);}
// Formula phases from Classic Attacks: Base + variable Weapon*size -> skill -> Hard DEF -> Soft DEF
// -> upgrade/mastery -> element -> race/size/element card bonuses. Empty modifier maps = 1.
function damageBonus(options,target){const b=options.bonuses||{};return (1+(b.size?.[target.size]||0))*(1+(b.race?.[target.race]||0))*(1+(b.element?.[target.element]||0));}
function calculatePhysical({baseAtk,weaponAtk,weaponMin=weaponAtk,size=1,multiplier=1,hardDef=0,softDef=0,critical=false,element='Neutral',targetElement='Neutral',elementLevel=1,upgradeAtk=0,masteryAtk=0,bonuses={},reductions={},target={size:'Medium',race:'Formless',element:'Neutral'},weaponRoll=.5}){
 const rolledWeapon=critical?weaponAtk:rollInt(weaponMin,weaponAtk,weaponRoll);
 let raw=Math.floor((baseAtk+Math.floor(rolledWeapon*size))*multiplier);
 let dmg=critical?raw:Math.max(1,Math.floor(raw*(1-clamp(hardDef,0,100)/100))-softDef);
 dmg=Math.max(1,dmg)+upgradeAtk+masteryAtk;
 const elem=elementModifier(element,targetElement,elementLevel);
if(elem===0)return 0;
 const reduction=(1-(reductions.size?.[target.size]||0))*(1-(reductions.race?.[target.race]||0))*(1-(reductions.element?.[element]||0));
 if(reduction<=0)return 0;
 const abs=Math.max(1,Math.floor(dmg*Math.abs(elem)*damageBonus({bonuses},target)*reduction));
 return elem<0?-abs:abs;
}
function resolvePlayerAttack(s,target,options={}){
 const r=options.rolls||{},rng=options.random||Math.random,draw=k=>r[k]===undefined?rng():r[k],st=stats(s);
 const skillId=options.skillId||null,level=options.level||1,isSkill=!!skillId;
 const crit=!isSkill&&draw('critical')<criticalChance(s,target);
 const targetFlee=activeStatus(target,'stun')||activeStatus(target,'sleep')||activeStatus(target,'freeze')?0:activeStatus(target,'blind')?Math.floor(monsterCombatStats(target).flee*.75):monsterCombatStats(target).flee;
 const chance=clamp(hitChance(st.hit,targetFlee)*skillAccuracy(skillId,level),.05,1);
 if(!crit&&draw('hit')>=chance)return {outcome:'miss',damage:0,critical:false,chance};
 const mod=options.provoke||null,defMultiplier=mod?1-mod.defReduction:1;
 const weaponMin=Math.min(st.weaponAtk,Math.floor(s.player.dex*(.8+.2*st.weaponLevel)));
 const weaponRoll=draw('weapon');
 const rolledWeapon=crit?st.weaponAtk:rollInt(weaponMin,st.weaponAtk,weaponRoll);
 const preDefenseDamage=Math.floor((st.baseAtk+Math.floor(rolledWeapon*sizeModifier(st.weaponType,target.size)))*(options.multiplier??skillMultiplier(skillId,level)));
 const damage=calculatePhysical({baseAtk:st.baseAtk,weaponAtk:st.weaponAtk,weaponMin,
  size:sizeModifier(st.weaponType,target.size),multiplier:options.multiplier??skillMultiplier(skillId,level),hardDef:(target.def||0)*defMultiplier,
  softDef:Math.floor(monsterSoftDef(target,draw('soft'))*defMultiplier*(activeStatus(target,'poison')?.75:1)),critical:crit,element:skillId==='magnum_break'?'Fire':st.weaponElement,
  targetElement:target.element||'Neutral',elementLevel:target.elementLevel||1,bonuses:options.bonuses||{},target,weaponRoll});
 return {outcome:damage<0?'absorb':damage===0?'immune':crit?'critical':'hit',damage:Math.max(0,damage),heal:Math.max(0,-damage),preDefenseDamage,critical:crit,chance};
}
function resolveMonsterAttack(monster,s,options={}){
 const r=options.rolls||{},rng=options.random||Math.random,draw=k=>r[k]===undefined?rng():r[k],st=stats(s);
 if(draw('perfect')<perfectDodgeChance(s))return {outcome:'lucky',damage:0};
 const attackers=options.attackers||1,chance=hitChance(monsterCombatStats(monster).hit,effectiveFlee(st.flee,attackers));
 if(draw('hit')>=chance)return {outcome:'dodge',damage:0,chance};
 const raw=rollInt(monster.atk,monster.atkMax||monster.atk,draw('weapon'))*(1+(options.provoke?.atkBoost||0));
 const soft=playerSoftDef(s,draw('soft'));
 const damage=calculatePhysical({baseAtk:0,weaponAtk:Math.floor(raw),weaponMin:Math.floor(raw),size:1,hardDef:st.hardDef,
  softDef:activeStatus(s,'poison')?Math.floor(soft*.75):soft,element:'Neutral',targetElement:'Neutral',target:s.player});
 return {outcome:damage<0?'absorb':'hit',damage:Math.max(0,damage),heal:Math.max(0,-damage),chance};
}
// Pure magic pipeline for upcoming magic-capable classes; no current Swordman skill is magic.
function resolveMagicAttack(s,target,options={}){
 const st=stats(s),roll=options.rolls?.matk??Math.random();
 const min=options.matkMin??st.matkMin,max=options.matkMax??st.matkMax;
 const raw=Math.floor(rollInt(min,max,roll)*(options.itemModifier??1)*(options.multiplier??1));
 const hard=clamp(target.mdef||0,0,100),soft=Math.floor((target.int||0)+(target.vit||0)/2);
 const undefended=Math.max(1,Math.floor(raw*(1-hard/100))-soft);
 const ratio=elementModifier(options.element||'Neutral',target.element||'Neutral',target.elementLevel||1);
 const amount=Math.floor(undefended*Math.abs(ratio));
 return {outcome:ratio<0?'absorb':ratio===0?'immune':'hit',damage:ratio>0?Math.max(1,amount):0,heal:ratio<0?Math.max(1,amount):0};
}
function hpRecovery(s){const st=stats(s);return Math.max(1,Math.floor(st.maxHp/200))+Math.floor(s.player.vit/5);}
function spRecovery(s){const st=stats(s),int=s.player.int;return 1+Math.floor(st.maxSp/100)+Math.floor(int/6)+(int>=120?Math.floor(int/2-56):0);}
function gainExp(s,base=0,job=0){const p=s.player;let levels=0,jobs=0;p.exp+=Math.max(0,Math.floor(base));p.jobExp+=Math.max(0,Math.floor(job));while(p.baseLv<99&&p.expNext>0&&p.exp>=p.expNext){p.exp-=p.expNext;p.baseLv++;p.statPoints+=Math.floor((p.baseLv+14)/5)+2;p.expNext=baseExpNext(p.baseLv);levels++;}if(p.baseLv>=99){p.exp=0;p.expNext=0;}while(p.jobLv<jobCap(p)&&p.jobExpNext>0&&p.jobExp>=p.jobExpNext){p.jobExp-=p.jobExpNext;p.jobLv++;if(p.classId==='swordman')p.skillPoints++;p.jobExpNext=jobExpNext(p);jobs++;}if(p.jobLv>=jobCap(p)){p.jobExp=0;p.jobExpNext=0;}if(levels||jobs){const st=stats(s);p.hp=st.maxHp;p.sp=st.maxSp;}return {levels,jobs};}
function changeJob(s,next){const p=s.player;if(next!=='swordman'||p.classId!=='novice'||p.jobLv<10)return false;p.classId='swordman';p.name='Swordman';p.jobLv=1;p.jobExp=0;p.jobExpNext=jobExpNext(p);p.skillPoints=0;p.hp=stats(s).maxHp;p.sp=stats(s).maxSp;return true;}
function learnSkill(s,id){const sk=SKILLS[id],p=s.player;if(!sk||sk.classId!==p.classId||p.skillPoints<1||(s.skills[id]||0)>=sk.max)return false;if(sk.requires&&Object.entries(sk.requires).some(([dep,lv])=>(s.skills[dep]||0)<lv))return false;s.skills[id]=(s.skills[id]||0)+1;p.skillPoints--;return true;}
function damage(s,target,roll=.5,multiplier=1){return resolvePlayerAttack(s,target,{multiplier,rolls:{critical:roll,weapon:roll,soft:roll,hit:0}}).damage;}
function addItem(s,id,count=1){if(!ITEMS[id]||!Number.isFinite(count)||count<1)return false;s.inventory[id]=Math.min(9999,(s.inventory[id]||0)+Math.floor(count));return true;}
function equip(s,id){const it=ITEMS[id];if(!it||!['weapon','armor','accessory'].includes(it.slot)||(s.inventory[id]||0)<1)return false;const old=s.equipment[it.slot];s.inventory[id]--;if(!s.inventory[id])delete s.inventory[id];if(old)addItem(s,old);s.equipment[it.slot]=id;const st=stats(s);s.player.hp=Math.min(s.player.hp,st.maxHp);s.player.sp=Math.min(s.player.sp,st.maxSp);return true;}
function unequip(s,slot){if(!['weapon','armor','accessory'].includes(slot)||!s.equipment[slot])return false;addItem(s,s.equipment[slot]);s.equipment[slot]=null;const st=stats(s);s.player.hp=Math.min(s.player.hp,st.maxHp);s.player.sp=Math.min(s.player.sp,st.maxSp);return true;}
function usePotion(s,id='potion'){if(!['potion','ether','green_potion'].includes(id)||(s.inventory[id]||0)<1||!canAct(s,'item'))return false;if(id==='green_potion'){if(!ITEMS.green_potion.cures.some(status=>activeStatus(s,status)))return false;s.inventory[id]--;if(!s.inventory[id])delete s.inventory[id];for(const status of ITEMS.green_potion.cures)clearStatus(s,status);return true;}const st=stats(s),key=id==='potion'?'hp':'sp',max=id==='potion'?st.maxHp:st.maxSp;if(s.player[key]>=max)return false;s.inventory[id]--;if(s.inventory[id]===0)delete s.inventory[id];s.player[key]=Math.min(max,s.player[key]+(id==='potion'?85:55));return true;}
function rollDrops(type,random=Math.random){const mob=MONSTERS[type];if(!mob)return [];const drops=[];for(const [id,rate] of mob.drops){if(random()<rate/10000&&ITEMS[id])drops.push({id,count:1});}return drops;}
function sell(s,id,count=1){const it=ITEMS[id];count=Math.floor(count);if(!it||it.slot!=='material'||count<1||(s.inventory[id]||0)<count)return false;s.inventory[id]-=count;if(s.inventory[id]===0)delete s.inventory[id];s.player.silver+=count*it.sell;return true;}
function recordKill(s,type){s.player.kills++;const q=QUESTS[Math.min(s.quest.stage,QUESTS.length-1)];if(q&&(q.target==='any'||q.target===type))s.quest.kills=Math.min(q.count,s.quest.kills+1);}
function claimQuest(s){const q=QUESTS[Math.min(s.quest.stage,QUESTS.length-1)];if(!q||s.quest.kills<q.count)return false;s.player.silver+=q.silver;gainExp(s,q.exp*D.SOLO_EXP_RATE,Math.ceil(q.exp*.4)*D.SOLO_EXP_RATE);s.quest.claimed++;s.quest.stage=Math.min(QUESTS.length-1,s.quest.stage+1);s.quest.kills=0;return true;}
function buy(s,id,count=1){const it=ITEMS[id];count=Math.floor(count);if(!it||it.slot==='material'||count<1||s.player.silver<it.price*count)return false;s.player.silver-=it.price*count;return addItem(s,id,count);}
function upgrade(s,key){if(!['str','agi','vit','int','dex','luk'].includes(key))return false;const p=s.player,cost=statCost(p[key]);if(p[key]>=99||p.statPoints<cost)return false;p.statPoints-=cost;p[key]++;return true;}
function hydrate(raw){try{const src=typeof raw==='string'?JSON.parse(raw):raw;if(!src||![1,VERSION].includes(src.version)||!src.player||!src.inventory||!src.equipment||!src.quest)return newGame();const s=newGame(),p=s.player,o=src.player,old=src.version===1;for(const key of ['baseLv','jobLv','exp','jobExp','statPoints','str','agi','vit','int','dex','luk','hp','sp','silver','x','y','zone','kills','deaths','skillPoints'])if(typeof o[key]==='number'&&Number.isFinite(o[key]))p[key]=o[key];p.classId=!old&&o.classId==='swordman'?'swordman':'novice';p.name=p.classId==='swordman'?'Swordman':'Novice';p.baseLv=clamp(Math.floor(p.baseLv),1,99);p.jobLv=clamp(Math.floor(p.jobLv),1,jobCap(p));for(const key of ['str','agi','vit','int','dex','luk'])p[key]=clamp(Math.floor(p[key]),1,99);p.statPoints=clamp(Math.floor(p.statPoints),0,2000);p.skillPoints=clamp(Math.floor(p.skillPoints),0,p.classId==='swordman'?49:0);p.silver=clamp(Math.floor(p.silver),0,99999999);p.zone=clamp(Math.floor(p.zone),0,2);p.x=clamp(p.x,45,1860);p.y=clamp(p.y,45,1150);p.kills=clamp(Math.floor(p.kills),0,1e8);p.deaths=clamp(Math.floor(p.deaths),0,1e7);p.expNext=baseExpNext(p.baseLv);p.jobExpNext=jobExpNext(p);p.exp=clamp(Math.floor(p.exp),0,Math.max(0,p.expNext-1));p.jobExp=clamp(Math.floor(p.jobExp),0,Math.max(0,p.jobExpNext-1));s.inventory={};s.statuses={};if(src.statuses&&typeof src.statuses==='object')for(const id of STATUS_IDS){const until=src.statuses[id];if(typeof until==='number'&&Number.isFinite(until)&&until>Date.now()&&until<Date.now()+86400000)s.statuses[id]=until;}for(const [id,n] of Object.entries(src.inventory))if(ITEMS[id]&&Number.isInteger(n)&&n>0)s.inventory[id]=clamp(n,1,9999);for(const slot of ['weapon','armor','accessory']){const id=src.equipment[slot];if(ITEMS[id]&&ITEMS[id].slot===slot)s.equipment[slot]=id;}if(!old){s.quest.stage=clamp(Math.floor(src.quest.stage||0),0,QUESTS.length-1);s.quest.kills=clamp(Math.floor(src.quest.kills||0),0,QUESTS[s.quest.stage].count);s.quest.claimed=clamp(Math.floor(src.quest.claimed||0),0,99999);if(src.skills&&typeof src.skills==='object'&&p.classId==='swordman'){for(const id of ['bash','magnum_break','provoke'])s.skills[id]=clamp(Math.floor(Number(src.skills[id])||0),0,SKILLS[id].max);}}if(src.settings&&typeof src.settings==='object'){s.settings.autoPotion=src.settings.autoPotion!==false;s.settings.autoSkill=src.settings.autoSkill!==false;s.settings.potionThreshold=clamp(Number(src.settings.potionThreshold)||.4,.1,.9);}p.hp=clamp(p.hp,1,stats(s).maxHp);p.sp=clamp(p.sp,0,stats(s).maxSp);return s;}catch(_){return newGame();}}
const api={VERSION,ITEMS,STATUS_IDS,activeStatus,applyStatus,clearStatus,weightStatus,canAct,canRecover,poisonTick,castTime,canInterruptCast,magnumFireBonus,resolveMagicAttack,QUESTS,MONSTERS,SKILLS,SOLO_EXP_RATE:D.SOLO_EXP_RATE,SOLO_DAMAGE_RATE:D.SOLO_DAMAGE_RATE,BASE_NEXT:D.BASE_NEXT,NOVICE_NEXT:D.NOVICE_NEXT,SWORDMAN_NEXT:D.SWORDMAN_NEXT,newGame,stats,attackInterval,hitChance,attackHits,effectiveFlee,monsterCombatStats,criticalChance,perfectDodgeChance,sizeModifier,elementModifier,skillCost,skillHeal,skillMultiplier,skillAccuracy,provokeModifiers,resolvePlayerAttack,resolveMonsterAttack,hpRecovery,spRecovery,calculatePhysical,gainExp,changeJob,learnSkill,damage,addItem,rollDrops,sell,equip,unequip,usePotion,recordKill,claimQuest,buy,upgrade,statCost,baseExpNext,jobExpNext,hydrate,clamp};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BorderCore=api;
})(typeof window!=='undefined'?window:globalThis);
