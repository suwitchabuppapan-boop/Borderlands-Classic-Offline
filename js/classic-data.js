/* Curated factual reference values: rAthena db/pre-re/mob_db.yml and iRO Wiki Classic.
   Standalone selection and implementation for a non-official solo game. No copied artwork.
   Runtime attack speed/AI/drop extras are custom SOLO rules (see README). */
(function(root){'use strict';
const BASE_NEXT=[9,16,25,36,77,112,153,200,253,320,385,490,585,700,830,970,1120,1260,1420,1620,1860,1990,2240,2504,2950,3426,3934,4474,6889,7995];
const NOVICE_NEXT=[10,18,28,40,91,151,205,268,340];
const SWORDMAN_NEXT=[30,43,58,76,116,180,220,272,336,520,604,699,802,948,1125,1668,1937,2226,3040,3988,5564,6272,7021,9114,11473,15290,16891,18570,23229,28359,36478,39716,43088,52417,62495,78160,84175,90404,107611,125915,153941,191781,204351,248352,286212,386371,409795,482092,509596];
const MONSTERS={
 poring:{roId:1002,name:'Poring',level:1,hp:50,atk:7,atkMax:10,def:0,exp:2,jobExp:1,zone:0,speed:32,range:30,aggro:0,spawn:5,color:'#f29ab2',silver:3,drops:[['jellopy',7000],['sticky_mucus',400],['apple',1000],['empty_bottle',1500]]},
 fabre:{roId:1007,name:'Fabre',level:2,hp:63,atk:8,atkMax:11,def:0,exp:3,jobExp:2,zone:0,speed:36,range:30,aggro:0,spawn:5,color:'#8bc69b',silver:4,drops:[['fluff',6500],['clover',1000],['green_herb',700]]},
 lunatic:{roId:1063,name:'Lunatic',level:3,hp:60,atk:9,atkMax:12,def:0,exp:6,jobExp:2,zone:0,speed:42,range:30,aggro:0,spawn:5,color:'#e3dae4',silver:4,drops:[['clover',6500],['apple',2000],['red_herb',600],['carrot',1100]]},
 willow:{roId:1010,name:'Willow',level:4,hp:95,atk:9,atkMax:12,def:5,exp:5,jobExp:4,zone:1,speed:32,range:33,aggro:0,spawn:5,color:'#7fa46c',silver:6,drops:[['tree_root',9000],['resin',1500]]},
 hornet:{roId:1004,name:'Hornet',level:8,hp:169,atk:22,atkMax:27,def:5,exp:19,jobExp:15,zone:1,speed:54,range:32,aggro:130,spawn:7,color:'#e7bc5c',silver:12,drops:[['bee_sting',9000],['jellopy',3500],['green_herb',350],['honey',150]]},
 poporing:{roId:1031,name:'Poporing',level:14,hp:344,atk:59,atkMax:72,def:0,exp:81,jobExp:44,zone:2,speed:46,range:34,aggro:165,spawn:9,color:'#6eae77',silver:25,drops:[['sticky_mucus',5500],['garlet',1500],['green_herb',500],['grape',200]]},
 boss:{roId:null,name:'Cavern Guardian · SOLO',level:17,hp:720,atk:64,atkMax:76,def:14,exp:140,jobExp:85,zone:2,speed:40,range:48,aggro:220,spawn:30,color:'#be7894',silver:135,drops:[['guardian_core',10000],['grape',3500]]}
};
// Verified six monster stats: rAthena db/pre-re/mob_db.yml (2026-09-18); omitted YAML fields default Str/Agi/Vit/Dex/Luk=1, other combat defaults 0. Guardian explicitly fictional.
Object.assign(MONSTERS.poring,{str:1,agi:1,vit:1,int:0,dex:6,luk:30,mdef:5,size:'Medium',race:'Plant',element:'Water',elementLevel:1,attackDelay:1872,reference:'rathena-pre-re'});
Object.assign(MONSTERS.fabre,{str:1,agi:2,vit:4,int:0,dex:7,luk:5,mdef:0,size:'Small',race:'Insect',element:'Earth',elementLevel:1,attackDelay:1672,reference:'rathena-pre-re'});
Object.assign(MONSTERS.lunatic,{str:1,agi:3,vit:3,int:10,dex:8,luk:60,mdef:20,size:'Small',race:'Brute',element:'Neutral',elementLevel:3,attackDelay:1456,reference:'rathena-pre-re'});
Object.assign(MONSTERS.willow,{str:1,agi:4,vit:8,int:30,dex:9,luk:10,mdef:15,size:'Medium',race:'Plant',element:'Earth',elementLevel:1,attackDelay:1672,reference:'rathena-pre-re'});
Object.assign(MONSTERS.hornet,{str:6,agi:20,vit:8,int:10,dex:17,luk:5,mdef:5,size:'Small',race:'Insect',element:'Wind',elementLevel:1,attackDelay:1292,reference:'rathena-pre-re'});
Object.assign(MONSTERS.poporing,{str:1,agi:14,vit:14,int:0,dex:19,luk:15,mdef:10,size:'Medium',race:'Plant',element:'Poison',elementLevel:1,attackDelay:1672,reference:'rathena-pre-re'});
Object.assign(MONSTERS.boss,{str:25,agi:18,vit:25,int:10,dex:22,luk:10,mdef:5,size:'Large',race:'Demon',element:'Neutral',elementLevel:1,attackDelay:1600,isBoss:true,reference:'solo',statusOnHit:{id:'poison',chance:.15,duration:18}});
const MATERIALS={
 jellopy:{name:'Jellopy',icon:'◈',sell:2},sticky_mucus:{name:'Sticky Mucus',icon:'◉',sell:4},apple:{name:'Apple',icon:'●',sell:6},empty_bottle:{name:'Empty Bottle',icon:'▫',sell:4},fluff:{name:'Fluff',icon:'☁',sell:3},clover:{name:'Clover',icon:'♣',sell:4},green_herb:{name:'Green Herb',icon:'♧',sell:6},red_herb:{name:'Red Herb',icon:'♧',sell:6},carrot:{name:'Carrot',icon:'♦',sell:4},tree_root:{name:'Tree Root',icon:'♣',sell:7},resin:{name:'Resin',icon:'◈',sell:9},bee_sting:{name:'Bee Sting',icon:'✦',sell:10},honey:{name:'Honey',icon:'⬡',sell:18},garlet:{name:'Garlet',icon:'◉',sell:9},grape:{name:'Grape',icon:'●',sell:16},guardian_core:{name:'Guardian Core · SOLO',icon:'✺',sell:140}
};
const SKILLS={
 first_aid:{name:'First Aid · Quest Skill',classId:'novice',max:1,sp:3,cd:0,icon:'♥',desc:'ฟื้น HP 5 ใช้ SP 3 · Quest Skill (เริ่มรู้แล้วตามเซฟเก่า)'},
 bash:{name:'Bash',classId:'swordman',max:10,sp:8,cd:0,icon:'⚔',desc:'โจมตี 130–400% ตามระดับ · ใช้ SP 8/15 · โบนัสแม่นยำ 5–50% · Delay ตาม ASPD'},
 magnum_break:{name:'Magnum Break',classId:'swordman',max:10,sp:30,cd:2,icon:'✺',requires:{bash:5},desc:'AOE Fire 120–300% · SP 30 · HP 20–16 · Cast Delay 2s · 5×5 · Knockback 2 cells · Fire bonus 20% แยกจากธาตุอาวุธ'},
 provoke:{name:'Provoke',classId:'swordman',max:10,sp:4,cd:0,icon:'!',desc:'ใช้ SP 4–13 ลด DEF และเพิ่ม ATK ศัตรู 30 วินาที · มีโอกาสล้มเหลว · ใช้กับ Boss/Undead ไม่ได้'}
};
const data={BASE_NEXT,NOVICE_NEXT,SWORDMAN_NEXT,MONSTERS,MATERIALS,SKILLS,SOLO_EXP_RATE:5,SOLO_DAMAGE_RATE:0.52};
if(typeof module!=='undefined'&&module.exports)module.exports=data;
root.BorderClassicData=data;
})(typeof window!=='undefined'?window:globalThis);
