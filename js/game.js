/* Borderlands SOLO: original implementation inspired by the public-facing interface.
   Designed for local file launch; no server, runtime network calls, external libraries or API keys. UI uses bundled user-provided skin images. */
(function(){'use strict';
const C=window.BorderCore, $=id=>document.getElementById(id), canvas=$('game'),g=canvas.getContext('2d');
g.imageSmoothingEnabled=false;
const KEY='borderlands-solo-save-v2', W=1900,H=1200; let VW=960,VH=560;
const minimap=$('minimap'),mg=minimap.getContext('2d');mg.imageSmoothingEnabled=false;
function resizeScene(){const box=$('game-wrap'),width=Math.max(1,box.clientWidth),height=Math.max(1,box.clientHeight);VH=560;VW=Math.min(W,Math.max(300,Math.round(VH*width/height)));canvas.width=VW;canvas.height=VH;g.imageSmoothingEnabled=false;}
window.addEventListener('resize',resizeScene);resizeScene();
const ZONES=[{name:'CLASSIC STARTER MEADOW · 01',sub:'PORING · FABRE · LUNATIC',ground:'#367b47',tile:'#428b50',light:'#60a563',fog:'#0d221b',types:['poring','fabre','lunatic']},
{name:'CLASSIC WOODLAND · 02',sub:'WILLOW · HORNET',ground:'#2c6744',tile:'#3c7d4a',light:'#66965b',fog:'#10281e',types:['willow','hornet']},
{name:'CLASSIC CAVERN · 03',sub:'POPORING · SOLO GUARDIAN',ground:'#3c4e41',tile:'#50624c',light:'#7a765d',fog:'#211729',types:['poporing']}];
const HOTBAR_DEFAULT=[
 {type:'skill',id:'first_aid'},{type:'skill',id:'bash'},
 {type:'skill',id:'magnum_break'},{type:'skill',id:'provoke'},
 {type:'item',id:'potion'},{type:'item',id:'ether'},null,null,null
];
function validHotbarEntry(entry){
 if(!entry||typeof entry!=='object'||typeof entry.id!=='string')return false;
 if(entry.type==='skill')return Object.prototype.hasOwnProperty.call(C.SKILLS,entry.id);
 return entry.type==='item'&&C.ITEMS[entry.id]?.slot==='consumable';
}
function normalizeHotbar(entries){
 const source=Array.isArray(entries)?entries:HOTBAR_DEFAULT;
 return Array.from({length:9},(_,i)=>validHotbarEntry(source[i])?{type:source[i].type,id:source[i].id}:null);
}
function hydrateWithHotbar(raw){
 const state=C.hydrate(raw);
 let data=null;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch(_){/* legacy/invalid save */}
 state.hotbar=normalizeHotbar(data?.hotbar);
 // Preserve the optional visual field; C.hydrate intentionally copies gameplay fields only.
 state.player.hairStyle=Number.isInteger(data?.player?.hairStyle)&&data.player.hairStyle>=0&&data.player.hairStyle<19?data.player.hairStyle:0;
 return state;
}
let s;try{const current=localStorage.getItem(KEY),legacy=!current?localStorage.getItem('borderlands-solo-save-v1'):null;s=hydrateWithHotbar(current||legacy);if(legacy)localStorage.setItem(KEY,JSON.stringify(s));}catch(_){s=C.newGame();s.hotbar=normalizeHotbar(null);}

const SKILL_SLOTS=['first_aid','bash','magnum_break','provoke'];
let mobs=[],decor=[],particles=[],target=null,moveTo=null,auto=false,tab='status',inventoryFilter='all',keys={},cam={x:0,y:0},cool={attack:0,1:0,2:0,3:0,4:0},now=0,elapsed=0,last=performance.now(),lastPanel=0,lastSave=0,lastHeroPulse=0,toastUntil=0,hitFlash=0,anim=0,hpRegenClock=0,spRegenClock=0,poisonClock=0,fireBuffUntil=0;
let saveReady=true,hotbarEdit=false,selectedHotbarSlot=null,pendingHotbar=null,draggedHotbarSlot=null,selectedItem=null;
let fpsFrames=0,fpsSince=performance.now();
const MONSTER_DRAW_SCALE={poring:1.5,fabre:1.5,lunatic:1.5,willow:2,hornet:1.75,poporing:1.75,boss:2};
const SPRITE_LIBRARY={
 novice:{src:'assets/sprites/body_novice.png',w:64,h:112,anchorX:32,anchorY:108},
 swordman:{src:'assets/sprites/body_swordman.png',w:96,h:112,anchorX:48,anchorY:108},
 poring:{src:'assets/sprites/monster_poring.png',w:32,h:32,anchorX:16,anchorY:28},
 fabre:{src:'assets/sprites/monster_fabre.png',w:32,h:32,anchorX:16,anchorY:28},
 lunatic:{src:'assets/sprites/monster_lunatic.png',w:32,h:32,anchorX:16,anchorY:28},
 willow:{src:'assets/sprites/monster_willow.png',w:32,h:32,anchorX:16,anchorY:28},
 hornet:{src:'assets/sprites/monster_hornet.png',w:32,h:32,anchorX:16,anchorY:28},
 poporing:{src:'assets/sprites/monster_poporing.png',w:32,h:32,anchorX:16,anchorY:28},
 boss:{src:'assets/sprites/monster_boss.png',w:48,h:48,anchorX:24,anchorY:42}
};
const SPRITE_ANIMS={idle:{start:0,count:2,fps:2,loop:true},walk:{start:2,count:4,fps:7,loop:true},attack:{start:6,count:3,fps:11,loop:false},hit:{start:9,count:1,fps:1,loop:false},death:{start:10,count:3,fps:7,loop:false}};
const DIR_ROWS={down:0,left:1,right:2,up:3};
const spriteImages={};
for(const [key,info] of Object.entries(SPRITE_LIBRARY)){const img=new Image();img.src=info.src;spriteImages[key]=img;}
const weaponImages={};
for(const id of ['rusty_sword','iron_sword','moon_blade']){const img=new Image();img.src='assets/weapons/'+id+'.png';weaponImages[id]=img;}
function playerSpriteKey(){return s.player.classId==='swordman'?'swordman':'novice';}
function initActorVisual(actor){if(!actor||typeof actor!=='object')return actor;if(!actor.facing)actor.facing='down';if(!actor.animState)actor.animState='idle';if(typeof actor.animStartedAt!=='number')actor.animStartedAt=0;if(typeof actor.animUntil!=='number')actor.animUntil=0;if(typeof actor.deadUntil!=='number')actor.deadUntil=0;if(typeof actor.prevX!=='number')actor.prevX=actor.x||0;if(typeof actor.prevY!=='number')actor.prevY=actor.y||0;return actor;}
function setActorState(actor,state,duration=0,restart=true){initActorVisual(actor);if(restart||actor.animState!==state){actor.animState=state;actor.animStartedAt=now;}if(duration>0)actor.animUntil=Math.max(actor.animUntil||0,now+duration);}
function updateActorFacing(actor,dx,dy){if(Math.abs(dx)>Math.abs(dy)){if(Math.abs(dx)>.05)actor.facing=dx<0?'left':'right';}else if(Math.abs(dy)>.05)actor.facing=dy<0?'up':'down';}
function syncActorMotion(actor,oldX,oldY){initActorVisual(actor);const dx=(actor.x||0)-oldX,dy=(actor.y||0)-oldY;updateActorFacing(actor,dx,dy);if(actor.deadUntil>now)return;if(actor.animUntil>now&&(actor.animState==='attack'||actor.animState==='hit'))return;const moving=Math.hypot(dx,dy)>.2;const nextState=moving?'walk':'idle';if(actor.animState!==nextState){actor.animState=nextState;actor.animStartedAt=now;}}
function spriteFrame(actor){initActorVisual(actor);const state=actor.deadUntil>now?'death':(actor.animState||'idle');const def=SPRITE_ANIMS[state]||SPRITE_ANIMS.idle;const elapsed=Math.max(0,now-(actor.animStartedAt||0));const rawFrame=Math.floor(elapsed*def.fps);const frame=def.loop?(rawFrame%def.count):Math.min(def.count-1,rawFrame);return {row:DIR_ROWS[actor.facing]??0,col:def.start+frame,state};}
function loaded(img){return Boolean(img&&img.complete&&img.naturalWidth>0);}
function monsterVisual(type){const info=SPRITE_LIBRARY[type],scale=MONSTER_DRAW_SCALE[type]||1;return {width:Math.round(info.w*scale),height:Math.round(info.h*scale),foot:Math.round(info.anchorY*scale),scale};}
function pickMobAt(point){
 let best=null,distance=Infinity;
 for(const m of mobs){
  if(!m.alive)continue;
  const visual=monsterVisual(m.type),padding=8,top=m.y-visual.foot;
  if(Math.abs(point.x-m.x)>visual.width/2+padding||point.y<top-padding||point.y>top+visual.height+padding)continue;
  const score=Math.hypot(point.x-m.x,point.y-(top+visual.height/2));
  if(score<distance){best=m;distance=score;}
 }
 return best;
}
function drawEquippedWeapon(actor,x,y,frame,bodyInfo){
 // Weapon sprites are original replacement art. RO inventory icons are not used as body weapons.
 const weaponId=s.equipment.weapon,img=weaponImages[weaponId];
 if(!loaded(img)||frame.state==='death'||!C.ITEMS[weaponId]||C.ITEMS[weaponId].slot!=='weapon')return false;
 const direction=actor.facing||'down',attacking=frame.state==='attack';
 const xSide=direction==='left'?-1:1;
 // Hand is relative to the body's feet anchor, not to screen/canvas origin.
 const swing=attacking?[-12,0,12][Math.max(0,Math.min(2,frame.col-6))]:0;
 const px=Math.round(x+xSide*(direction==='up'?14:17)+(direction==='left'?-2:0)+(attacking?xSide*3:0));
 const py=Math.round(y-(direction==='up'?54:48)+(attacking?-4:frame.state==='walk'?(frame.col%2?1:0):0));
 const angle=(direction==='left'?-0.32:0.32)+(attacking?xSide*swing*Math.PI/180:0)+(direction==='up'?Math.PI:0);
 g.save();g.translate(px,py);g.rotate(angle);g.drawImage(img,-12,-29,24,36);g.restore();return true;
}
function drawLayeredCharacter(key,actor,x,y){
 const info=SPRITE_LIBRARY[key],body=spriteImages[key];if(!info||!loaded(body))return false;
 const style=Number.isInteger(s.player.hairStyle)&&s.player.hairStyle>=0&&s.player.hairStyle<19?s.player.hairStyle:0;
 const hairKey='hair-'+style;
 if(!spriteImages[hairKey]){const img=new Image();img.src='assets/sprites/hair_'+String(style).padStart(2,'0')+'.png';spriteImages[hairKey]=img;}
 const hair=spriteImages[hairKey],frame=spriteFrame(actor),dx=Math.round(x-info.anchorX),dy=Math.round(y-info.anchorY);
 const anchors=window.BorderSpriteAnchors?.[key],head=anchors?.[frame.row]?.[frame.col];
 if(actor.facing==='up')drawEquippedWeapon(actor,x,y,frame,info);
 g.drawImage(body,frame.col*info.w,frame.row*info.h,info.w,info.h,dx,dy,info.w,info.h);
 if(loaded(hair)&&head){g.drawImage(hair,frame.col*64,frame.row*48,64,48,dx+head[0],dy+head[1],64,48);}
 if(actor.facing!=='up')drawEquippedWeapon(actor,x,y,frame,info);
 return true;
}
function drawEntitySprite(key,actor,x,y){
 const info=SPRITE_LIBRARY[key];if(!info)return false;
 if(key==='novice'||key==='swordman')return drawLayeredCharacter(key,actor,x,y);
 const img=spriteImages[key];if(!loaded(img))return false;
 const frame=spriteFrame(actor),scale=MONSTER_DRAW_SCALE[key]||1,drawW=Math.round(info.w*scale),drawH=Math.round(info.h*scale);
 g.drawImage(img,frame.col*info.w,frame.row*info.h,info.w,info.h,Math.round(x-info.anchorX*scale),Math.round(y-info.anchorY*scale),drawW,drawH);return true;
}
initActorVisual(s.player);
function save(silent=false){s.savedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(s));saveReady=true;$('save-indicator').textContent='● บันทึกแล้ว';if(!silent)notify('บันทึกเกมลงเครื่องแล้ว ✓');return true;}catch(_){saveReady=false;$('save-indicator').textContent='● บันทึกไม่ได้';if(!silent)notify('พื้นที่บันทึกไม่พร้อม ใช้ Settings → Export Save');return false;}}
function log(text){s.log.unshift({time:new Date().toLocaleTimeString('th-TH',{hour12:false}),text});s.log=s.log.slice(0,65);$('system-message').textContent='◉ '+text;}
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=now+2.1;log(text);}
function hash(x,y,seed=0){let n=(x*374761393+y*668265263+seed*1234567)|0;n=(n^(n>>>13))*1274126177;n=n^(n>>>16);return (n>>>0)/4294967296;}
function makeDecor(zone){decor=[];for(let yy=65;yy<H-35;yy+=70)for(let xx=65;xx<W-35;xx+=70){let h=hash(Math.floor(xx/70),Math.floor(yy/70),zone+8);if(h<.22)continue;if(zone===0&&xx<480&&yy>110&&yy<740)continue;if(Math.abs(yy-585)<90)continue;if(zone===2&&Math.hypot(xx-1360,yy-440)<160)continue;decor.push({x:xx+(h-.5)*42,y:yy+(hash(xx,yy,3)-.5)*36,type:h>.82?'rock':h>.51?'tree':'bush',h});}}
function createMobs(zone){mobs=[];const zoneSpec=ZONES[zone],total=zone===0?16:zone===1?15:11;for(let i=0;i<total;i++){const type=zoneSpec.types[i%zoneSpec.types.length],spec=C.MONSTERS[type];let x=zone===0?575+hash(i,17,zone)*1150:270+hash(i,17,zone)*1430,y=110+hash(i,71,zone)*940;if(zone===0&&i<6){x=610+i*114;y=260+(i%3)*100;}if(zone===1&&i<3){x=490+i*160;y=340+i*90;}if(zone===2&&Math.hypot(x-1360,y-440)<210)x-=340;const mob={id:zone+'-'+i,type,x,y,homeX:x,homeY:y,hp:spec.hp,maxHp:spec.hp,alive:true,respawnAt:0,attackAt:0,phase:hash(i,99,zone)*7,flash:0,debuffUntil:0,provoke:null,statuses:{}};initActorVisual(mob);mobs.push(mob);}if(zone===2){const spec=C.MONSTERS.boss;const boss={id:'boss',type:'boss',x:1360,y:440,homeX:1360,homeY:440,hp:spec.hp,maxHp:spec.hp,alive:true,respawnAt:0,attackAt:0,phase:0,flash:0,debuffUntil:0,provoke:null,statuses:{}};initActorVisual(boss);mobs.push(boss);}}
function enterZone(zone,side='start'){s.player.zone=C.clamp(zone,0,2);if(side!=='restore'){s.player.x=side==='right'?W-160:side==='left'?160:260;s.player.y=side==='start'?290:585;}target=null;moveTo=null;auto=false;fireBuffUntil=0;hpRegenClock=0;spRegenClock=0;$('auto-button').classList.remove('enabled');$('auto-button').setAttribute('aria-pressed','false');$('combat-mode').textContent='OFF';makeDecor(s.player.zone);createMobs(s.player.zone);const z=ZONES[s.player.zone];$('zone-label').textContent=z.name;$('zone-caption').textContent=z.sub;$('map-location').textContent=z.name.split(' · ')[0];log('เข้าสู่ '+z.name);refresh();}
function playerStats(){return C.stats(s);}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function closest(max=Infinity){let best=null,bd=max;for(const m of mobs)if(m.alive&&dist(m,s.player)<bd){best=m;bd=dist(m,s.player);}return best;}
function fx(x,y,text,color='#f5d68e'){particles.push({x,y,text,color,life:1,vy:-28});if(particles.length>50)particles.shift();}
function loot(m){const spec=C.MONSTERS[m.type],p=s.player;const silver=spec.silver+Math.floor(Math.random()*Math.max(2,spec.silver*.5));p.silver+=silver;const xp=spec.exp*C.SOLO_EXP_RATE,jxp=spec.jobExp*C.SOLO_EXP_RATE,up=C.gainExp(s,xp,jxp);C.recordKill(s,m.type);const drops=C.rollDrops(m.type);for(const d of drops){C.addItem(s,d.id,d.count);log('DROP: '+C.ITEMS[d.id].name);}if(m.type==='fabre'&&Math.random()<.04)C.addItem(s,'rusty_sword');if(m.type==='hornet'&&Math.random()<.04)C.addItem(s,'leather_armor');if(m.type==='boss'){C.addItem(s,Math.random()<.5?'iron_sword':'moon_armor');notify('ปราบ Cavern Guardian แล้ว! (บอสสร้างใหม่สำหรับ SOLO)');}log('กำจัด '+spec.name+' · Base +'+xp+' / Job +'+jxp+' · +'+silver+' Silver');if(up.levels||up.jobs)notify('LEVEL UP! Base '+p.baseLv+' · '+(p.classId==='novice'?'Novice':'Swordman')+' Job '+p.jobLv+' ✦');if(p.classId==='novice'&&p.jobLv>=10)notify('Novice Job 10 พร้อมเปลี่ยนเป็น Swordman ที่ Guild Guide!');fx(m.x,m.y-26,'+'+xp+' XP','#f4d588');if(C.QUESTS[s.quest.stage].count===s.quest.kills)notify('เควสต์สำเร็จ! เปิด Quest Journal เพื่อรับรางวัล');}
function harmMonster(m,damage,color){if(!m||!m.alive)return;initActorVisual(m);m.hp=Math.max(0,m.hp-damage);m.flash=.14;fx(m.x+(Math.random()-.5)*12,m.y-24,'-'+damage,color||'#ffbd9d');if(!m.hp){setActorState(m,'death',.46,true);m.alive=false;m.deadUntil=Math.max(m.deadUntil,now+.46);m.respawnAt=now+C.MONSTERS[m.type].spawn;if(target===m)target=null;loot(m);}else setActorState(m,'hit',.16,true);hitFlash=.10;}
// All skills and normal attacks use the same Classic combat outcome pipeline.
function strikeMonster(m,options={},color='#ffbd9d'){
 if(!m||!m.alive)return false;
 const spec=C.MONSTERS[m.type],provoke=now<(m.debuffUntil||0)?m.provoke:null;
 const outcome=C.resolvePlayerAttack(s,{...spec,statuses:m.statuses},{...options,provoke});
 if(outcome.outcome==='miss'){fx(m.x,m.y-24,'MISS','#d4e6ef');return false;}
 if(outcome.heal>0){m.hp=Math.min(m.maxHp,m.hp+outcome.heal);fx(m.x,m.y-24,'HEAL +'+outcome.heal,'#80e4a9');}
 if(outcome.damage>0)harmMonster(m,outcome.damage,outcome.critical?'#ff625f':color);
 else if(!outcome.heal)fx(m.x,m.y-24,'IMMUNE','#d4e6ef');
 // 20% of pre-DEF physical hit as independent Fire property; never endows the weapon.
 // Magnum Break includes this extra Fire damage in the cast itself.
 let extra=0;
 if(m.alive&&(now<fireBuffUntil||options.skillId==='magnum_break')){
   extra=C.magnumFireBonus(outcome.preDefenseDamage,spec,options.bonuses);
   if(extra>0)harmMonster(m,extra,'#ff9c58');
   else if(extra<0){m.hp=Math.min(m.maxHp,m.hp-extra);fx(m.x,m.y-24,'HEAL +'+(-extra),'#80e4a9');}
 }
 return outcome.damage>0||extra>0;
}
function attack(){
 if(cool.attack>0||!C.canAct(s,'attack'))return false;
 if(!target||!target.alive)target=closest(85);
 if(!target||dist(target,s.player)>70)return false;
 cool.attack=C.attackInterval(s);
 setActorState(s.player,'attack',Math.min(.34,Math.max(.2,cool.attack*.7)),true);
 strikeMonster(target);
 fx(s.player.x+22,s.player.y-15,'✧','#ffe3a7');return true;
}
function skill(n){
 const id=SKILL_SLOTS[n-1],k=C.SKILLS[id],p=s.player,lv=s.skills[id]||0;
 if(!k||cool[n]>0||lv<1||!C.canAct(s,'skill'))return false;
 const cost=C.skillCost(id,lv);
 if(p.sp<cost){if(!auto)notify('SP ไม่เพียงพอ');return false;}
 if(id==='first_aid'){
  if(p.hp>=playerStats().maxHp)return false;
  const heal=C.skillHeal('first_aid',lv);p.sp-=cost;p.hp=Math.min(playerStats().maxHp,p.hp+heal);
  cool[n]=C.attackInterval(s);setActorState(p,'attack',.24,true);fx(p.x,p.y-30,'+'+heal,'#80e4a9');return true;
 }
 if(id==='provoke'){
  if(!target||!target.alive||dist(target,p)>135)return false;
  const spec=C.MONSTERS[target.type];
  if(spec.isBoss||spec.element==='Undead'){if(!auto)notify('Provoke ใช้กับ Boss / Undead ไม่ได้');return false;}
  p.sp-=cost;cool[n]=C.attackInterval(s);setActorState(p,'attack',.3,true);
  const effect=C.provokeModifiers(lv);
  if(Math.random()<effect.success){target.provoke=effect;target.debuffUntil=now+effect.duration;fx(target.x,target.y-37,'DEF ↓ ATK ↑','#e8b576');}
  else fx(target.x,target.y-37,'RESIST','#e8b576');
  return true;
 }
 if(id==='bash'&&(!target||!target.alive||dist(target,p)>86))return false;
 const victims=id==='bash'?[target]:mobs.filter(m=>m.alive&&Math.abs(m.x-p.x)<=96&&Math.abs(m.y-p.y)<=96);
 if(!victims.length)return false;
 const hpCost=id==='magnum_break'?21-Math.ceil(lv/2):0;
 if(p.hp<=hpCost){if(!auto)notify('HP ไม่เพียงพอสำหรับ Magnum Break');return false;}
 p.sp-=cost;p.hp-=hpCost;cool[n]=id==='magnum_break'?2:C.attackInterval(s);
 cool.attack=Math.max(cool.attack,id==='magnum_break'?2:C.attackInterval(s));setActorState(p,'attack',id==='magnum_break'?.42:.28,true);
 for(const mob of [...victims]){
  const dx=mob.x-p.x,dy=mob.y-p.y;
  const hit=strikeMonster(mob,{skillId:id,level:lv},id==='magnum_break'?'#ffaf65':'#f4d289');
  if(id==='magnum_break'&&hit&&mob.alive){const distance=Math.max(1,Math.hypot(dx,dy));mob.x=C.clamp(mob.x+dx/distance*96,24,W-24);mob.y=C.clamp(mob.y+dy/distance*96,40,H-28);}
 }
 if(id==='magnum_break')fireBuffUntil=now+10;
 fx(p.x,p.y-34,k.name,id==='magnum_break'?'#ffaf65':'#e7d39b');return true;
}
function toggleAuto(){auto=!auto;moveTo=null;$('auto-button').classList.toggle('enabled',auto);$('combat-mode').textContent=auto?'ACTIVE':'OFF';$('auto-button').setAttribute('aria-pressed',String(auto));notify(auto?'เริ่ม Auto Play — กด F หรือคลิกพื้นเพื่อหยุด':'หยุด Auto Play');refresh();}
function setHotbarEdit(enabled){
 hotbarEdit=Boolean(enabled);selectedHotbarSlot=null;
 const box=document.querySelector('.combatbar'),button=document.querySelector('.hotbar-edit');
 box.classList.toggle('editing',hotbarEdit);button.classList.toggle('active',hotbarEdit);
 button.setAttribute('aria-pressed',String(hotbarEdit));button.textContent=hotbarEdit?'เสร็จ':'จัดช่อง';
 renderHotbar();
}
function renderHotbar(){
 const bar=document.querySelector('.combatbar');
 bar.classList.toggle('binding',!!pendingHotbar);
 for(let i=1;i<=9;i++){
  const entry=s.hotbar[i-1],node=document.querySelector('[data-slot="'+i+'"]');
  const cell=node.closest('.hotbar-cell'),overlay=node.querySelector('.cool');
  const icon=node.querySelector('b'),label=node.querySelector('span');
  const clear=cell.querySelector('[data-clear-slot]');
  cell.classList.toggle('selected',selectedHotbarSlot===i);
  node.dataset.kind=entry?.type||'empty';node.dataset.id=entry?.id||'';
  node.draggable=Boolean(hotbarEdit&&entry);
  clear.hidden=!entry;
  node.classList.remove('unavailable');overlay.classList.remove('active');overlay.textContent='';
  if(!entry){icon.textContent='＋';label.textContent='ว่าง';node.title='ช่อง '+i+' ว่าง · เปิด Skills หรือ Bag เพื่อใส่ของ';node.setAttribute('aria-label','ช่อง '+i+' ว่าง');continue;}
  const spec=entry.type==='skill'?C.SKILLS[entry.id]:C.ITEMS[entry.id];
  icon.innerHTML=entry.type==='item'?itemIconHtml(entry.id,spec.icon):escapeHtml(spec.icon);
  if(entry.type==='skill'){
   const lv=s.skills[entry.id]||0,index=SKILL_SLOTS.indexOf(entry.id)+1,secs=cool[index]||0;
   label.textContent=spec.name.split(' · ')[0];
   node.title=spec.name+' Lv.'+lv+' · ปุ่ม '+i;
   node.classList.toggle('unavailable',lv===0);
   if(lv===0||secs>.08){overlay.textContent=lv===0?'LOCK':secs.toFixed(1);overlay.classList.add('active');}
  }else{
   const count=s.inventory[entry.id]||0;
   label.textContent=(entry.id==='potion'?'HP':entry.id==='ether'?'SP':spec.name)+' ×'+count;
   node.title=spec.name+' ×'+count+' · ปุ่ม '+i;
   node.classList.toggle('unavailable',count===0);
   if(count===0){overlay.textContent='หมด';overlay.classList.add('active');}
  }
  node.setAttribute('aria-label','ช่อง '+i+' '+node.title);
 }
}
function assignHotbar(number,entry){
 if(!Number.isInteger(number)||number<1||number>9||!validHotbarEntry(entry))return false;
 s.hotbar[number-1]={type:entry.type,id:entry.id};
 pendingHotbar=null;setHotbarEdit(false);save(true);renderHotbar();
 notify('กำหนดช่อง '+number+' เป็น '+(entry.type==='skill'?C.SKILLS[entry.id].name:C.ITEMS[entry.id].name));
 panel();return true;
}
function clearHotbar(number){
 if(!Number.isInteger(number)||number<1||number>9)return;
 s.hotbar[number-1]=null;selectedHotbarSlot=null;save(true);renderHotbar();
 notify('นำสิ่งที่กำหนดไว้ออกจากช่อง '+number+' แล้ว (ไม่ลบไอเทมในกระเป๋า)');
}
function swapHotbar(first,second){
 if(first===second){selectedHotbarSlot=null;renderHotbar();return;}
 [s.hotbar[first-1],s.hotbar[second-1]]=[s.hotbar[second-1],s.hotbar[first-1]];
 selectedHotbarSlot=null;save(true);renderHotbar();notify('สลับช่อง '+first+' กับ '+second+' แล้ว');
}
function chooseHotbarBinding(type,id){
 const entry={type,id};if(!validHotbarEntry(entry))return;
 if(type==='skill'&&!(s.skills[id]>0)){notify('ต้องเรียนสกิลก่อนนำไปใส่ช่อง');return;}
 if(type==='item'&&!(s.inventory[id]>0)){notify('ไอเทมนี้ไม่มีในกระเป๋า');return;}
 pendingHotbar=entry;setHotbarEdit(false);
 notify('เลือกช่อง 1–9 ในหน้าต่างหรือคลิกที่ Hotbar เพื่อใส่ '+(type==='skill'?C.SKILLS[id].name:C.ITEMS[id].name));
 panel();renderHotbar();
}
function useHotbar(number){
 const entry=s.hotbar[number-1];if(!entry)return false;
 if(entry.type==='skill'){
  const id=SKILL_SLOTS.indexOf(entry.id)+1;
  if(id<1||!skill(id)){notify('ใช้สกิลไม่ได้ · ตรวจ HP/SP / ระยะ / ระดับสกิล / Cooldown');return false;}
  refresh();return true;
 }
 if((s.inventory[entry.id]||0)<1){notify(C.ITEMS[entry.id].name+' หมด · ซื้อจากร้านค้าได้');return false;}
 if(!C.usePotion(s,entry.id)){notify('ตอนนี้ยังใช้ '+C.ITEMS[entry.id].name+' ไม่ได้');return false;}
 notify('ใช้ '+C.ITEMS[entry.id].name);refresh();save(true);return true;
}
function clickHotbar(number){
 if(pendingHotbar){assignHotbar(number,pendingHotbar);return;}
 if(hotbarEdit){
  if(selectedHotbarSlot===null){selectedHotbarSlot=number;renderHotbar();notify('เลือกช่อง '+number+' แล้ว · คลิกช่องปลายทางเพื่อสลับ หรือกด × เพื่อนำออก');}
  else swapHotbar(selectedHotbarSlot,number);
  return;
 }
 useHotbar(number);
}
function portal(){if(s.player.zone<2&&s.player.x>W-135&&Math.abs(s.player.y-585)<115)enterZone(s.player.zone+1,'left');else if(s.player.zone>0&&s.player.x<115&&Math.abs(s.player.y-585)<115)enterZone(s.player.zone-1,'right');}
function update(dt){now+=dt;elapsed+=dt;anim+=dt;for(const k of Object.keys(cool))cool[k]=Math.max(0,cool[k]-dt);hitFlash=Math.max(0,hitFlash-dt);if(toastUntil&&now>toastUntil){$('toast').classList.remove('show');toastUntil=0;}
const p=s.player;initActorVisual(p);const oldPx=p.x,oldPy=p.y,st=playerStats();p.hp=Math.min(st.maxHp,p.hp);p.sp=Math.min(st.maxSp,p.sp);let dx=0,dy=0;
if(keys.ArrowLeft||keys.KeyA)dx--;if(keys.ArrowRight||keys.KeyD)dx++;if(keys.ArrowUp||keys.KeyW)dy--;if(keys.ArrowDown||keys.KeyS)dy++;
if(!C.canAct(s,'move')){dx=0;dy=0;moveTo=null;}
if(dx||dy){moveTo=null;const norm=Math.hypot(dx,dy);p.x+=dx/norm*st.speed*dt;p.y+=dy/norm*st.speed*dt;}
else {if(auto&&C.canAct(s,'move')){if(s.settings.autoPotion&&p.hp/st.maxHp<s.settings.potionThreshold){if(C.usePotion(s)){fx(p.x,p.y-28,'+HP','#88df9e');log('Auto Potion: ฟื้นฟู HP');}}if(p.sp<ksp()&&s.inventory.ether>0)C.usePotion(s,'ether');if(s.settings.autoSkill&&p.hp/st.maxHp<.55)skill(1);
if(!target||!target.alive)target=closest();if(target&&dist(target,p)>57){moveTo={x:target.x,y:target.y,range:51};}else if(target){moveTo=null;if(s.settings.autoSkill&&mobs.filter(m=>m.alive&&dist(m,p)<120).length>=3)skill(3);if(s.settings.autoSkill&&s.skills.provoke>0&&now>(target.debuffUntil||0))skill(4);if(s.settings.autoSkill&&!skill(2))attack();else if(!s.settings.autoSkill)attack();}}
if(target&&target.alive&&moveTo&&auto)moveTo={x:target.x,y:target.y,range:51};if(moveTo){let vx=moveTo.x-p.x,vy=moveTo.y-p.y,d=Math.hypot(vx,vy);if(d>(moveTo.range||10)){const amt=Math.min(d-(moveTo.range||10),st.speed*dt);p.x+=vx/d*amt;p.y+=vy/d*amt;}else{moveTo=null;if(!auto&&target&&dist(target,p)<72)attack();}}}
// Classic natural recovery only ticks on timers rather than every animation frame.
const walking=!!(dx||dy||moveTo);
if(walking)hpRegenClock=0;else hpRegenClock+=dt;
spRegenClock+=dt;
while(hpRegenClock>=6){hpRegenClock-=6;if(C.canRecover(s,'hp'))p.hp=Math.min(st.maxHp,p.hp+C.hpRecovery(s));}
while(spRegenClock>=8){spRegenClock-=8;if(C.canRecover(s,'sp'))p.sp=Math.min(st.maxSp,p.sp+C.spRecovery(s));}
poisonClock+=dt;while(poisonClock>=1){poisonClock-=1;const loss=C.poisonTick(s);if(loss)fx(p.x,p.y-37,'POISON -'+loss,'#b2d46c');}
p.x=C.clamp(p.x,24,W-24);p.y=C.clamp(p.y,40,H-28);syncActorMotion(p,oldPx,oldPy);portal();
for(const m of mobs){initActorVisual(m);if(!m.alive){if(now>=m.respawnAt){m.alive=true;m.hp=m.maxHp;m.x=m.homeX;m.y=m.homeY;m.debuffUntil=0;m.provoke=null;m.statuses={};m.deadUntil=0;m.animUntil=0;m.animState='idle';m.animStartedAt=now;}continue;}const oldMx=m.x,oldMy=m.y;const spec=C.MONSTERS[m.type];m.flash=Math.max(0,m.flash-dt);let d=dist(m,p);if((d<spec.aggro||(target===m&&d<185))&&!(p.zone===0&&p.x<445)){if(d>spec.range+11){const speed=spec.speed*dt;m.x+=(p.x-m.x)/d*speed;m.y+=(p.y-m.y)/d*speed;}else if(now>=m.attackAt){
 m.attackAt=now+C.monsterCombatStats(spec).attackInterval;setActorState(m,'attack',.3,true);
 const attackers=mobs.filter(other=>other.alive&&dist(other,p)<=C.MONSTERS[other.type].range+15).length;
 const outcome=C.resolveMonsterAttack(spec,s,{attackers,provoke:now<(m.debuffUntil||0)?m.provoke:null});
 if(outcome.damage===0){fx(p.x,p.y-35,outcome.outcome==='lucky'?'LUCKY':'DODGE','#a4e2fa');syncActorMotion(m,oldMx,oldMy);continue;}
 p.hp-=outcome.damage;setActorState(p,'hit',.18,true);fx(p.x,p.y-35,'-'+outcome.damage,'#ff7f83');
 if(C.activeStatus(s,'sleep'))C.clearStatus(s,'sleep');
 // Cavern Guardian is a fictional SOLO boss; its poison chance is explicitly custom.
 if(spec.statusOnHit&&Math.random()<spec.statusOnHit.chance){
  const effect=spec.statusOnHit;if(!C.activeStatus(s,effect.id))notify('ติดสถานะ '+effect.id.toUpperCase()+'! Green Potion แก้ได้');
  C.applyStatus(s,effect.id,effect.duration);
 }
 if(p.hp<=0){p.deaths++;s.statuses={};poisonClock=0;p.hp=st.maxHp;p.sp=st.maxSp;p.silver=Math.max(0,p.silver-Math.min(30,p.silver));enterZone(0,'start');notify('คุณหมดสติ! กลับมายังจุดเริ่มต้น · เสีย Silver เล็กน้อย');break;}
}}else if(d>spec.aggro*1.7&&Math.hypot(m.x-m.homeX,m.y-m.homeY)>8){m.x+=(m.homeX-m.x)*dt*.35;m.y+=(m.homeY-m.y)*dt*.35;}syncActorMotion(m,oldMx,oldMy);}
for(const f of particles){f.y+=f.vy*dt;f.life-=dt*.85;}particles=particles.filter(f=>f.life>0);
if(now-lastPanel>.23){refresh();drawMinimap();lastPanel=now;}if(now-lastSave>18){save(true);lastSave=now;}}
function ksp(){return s.player.jobLv>=3?12:12;}
function fill(x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function label(text,x,y,color='#fff',size=11,align='center'){g.textAlign=align;g.font='bold '+size+'px Tahoma,Arial';g.lineWidth=3;g.strokeStyle='#07111bd9';g.strokeText(text,Math.round(x),Math.round(y));g.fillStyle=color;g.fillText(text,Math.round(x),Math.round(y));}
function drawTile(x,y,z){const h=hash(x,y,z+9),px=x*48,py=y*48;fill(px,py,48,48,h>.8?ZONES[z].tile:ZONES[z].ground);if(z===0&&px<480&&py<760){fill(px,py,48,48,h>.5?'#4b5846':'#465544');if(py>440&&py<675)fill(px,py,48,48,'#6a654b');}
if(py>525&&py<640){fill(px,py,48,48,z===2?'#665164':'#6a644c');if(h>.68)fill(px+9,py+12,4,3,'#a49977');}
if(h>.82){fill(px+8,py+15,3,3,ZONES[z].light);fill(px+28,py+37,5,2,z===2?'#97718c':'#76976f');}else if(h<.15){fill(px+23,py+29,2,4,'#182e2b');fill(px+21,py+28,6,2,z===2?'#9f8eae':'#629977');}}
function drawDecor(d,z){const x=d.x,y=d.y;if(d.type==='rock'){fill(x-17,y-5,34,13,'#19272b77');fill(x-15,y-21,29,20,z===2?'#5e5868':'#647571');fill(x-12,y-20,23,7,z===2?'#8a7b90':'#93a097');fill(x+3,y-14,8,6,'#44555d');}
else if(d.type==='tree'){fill(x-5,y-11,11,31,'#3b2d2c');fill(x-2,y+11,7,8,'#765444');fill(x-22,y-44,45,33,z===2?'#454050':'#1a4037');fill(x-28,y-39,51,22,z===2?'#5a4a63':'#295a46');fill(x-13,y-51,33,16,z===2?'#695a70':'#386a50');fill(x-18,y-40,13,5,z===2?'#80718d':'#4c8660');}else{fill(x-12,y-7,22,13,z===2?'#5e4862':'#255241');fill(x-9,y-14,17,12,z===2?'#736176':'#37735a');fill(x-6,y-10,4,4,z===2?'#ad92af':'#7ca780');}}
function drawHouse(x,y,type){const shop=type==='shop';fill(x-59,y-14,120,72,'#171c20aa');fill(x-53,y-72,108,106,'#876a4b');fill(x-55,y-80,112,28,shop?'#b96f55':'#6b8e87');fill(x-64,y-55,18,63,'#352f2a');fill(x+48,y-55,17,63,'#352f2a');fill(x-17,y-14,34,47,'#211c20');fill(x-12,y-8,23,41,'#63513a');fill(x-35,y-41,18,17,'#eec77b');fill(x+19,y-41,18,17,'#eec77b');fill(x-32,y-35,10,12,'#665548');fill(x+23,y-35,10,12,'#665548');fill(x-58,y-81,115,5,'#b5a077');label(shop?'ITEM MERCHANT':'SWORDMAN GUILD',x,y-93,'#ead19e',10);}
function drawPortal(x,y,color,labelText){fill(x-38,y-34,76,87,'#11192599');fill(x-43,y-55,17,99,'#565365');fill(x+28,y-55,17,99,'#565365');fill(x-40,y-64,82,17,'#938477');fill(x-24,y-37,48,71,'#261e43');for(let i=0;i<4;i++){g.strokeStyle=i%2?color:'#e2c7ff';g.lineWidth=2;g.strokeRect(x-20+i*5+Math.sin(anim*2+i)*2,y-34+i*6,40-i*10,64-i*12);}fill(x-20,y+39,40,5,color);label(labelText,x,y-73,'#e6d2ab',11);}
function drawFallbackCharacter(x,y,enemyType=null){const frame=Math.sin(anim*8+(enemyType?x:0))>0?1:0;fill(x-18,y+14,36,8,'#08151b8c');if(!enemyType){const sword=s.player.classId==='swordman';fill(x-7,y-12,14,24,sword?'#9b6c4e':'#2b4f7e');fill(x-11,y-15,22,13,sword?'#c29c67':'#4b7299');fill(x-8,y-33,16,18,'#edc7a1');fill(x-10,y-35,20,7,'#463329');fill(x-13,y-27,5,8,'#48362e');fill(x-7,y+11,6,12,'#2c3544');fill(x+2,y+11,6,12+frame*2,'#2c3544');fill(x-16,y-10,6,18,'#c7a17a');fill(x+11,y-10,6,18,'#c7a17a');fill(x+15,y-14,4,20,'#e6cda1');fill(x+17,y-23,4,13,'#faf0d1');fill(x+12,y+4,12,4,'#6a5246');if(sword){fill(x-13,y-20,26,5,'#d4bc86');fill(x-9,y-12,18,7,'#a7a9ae');}return;}
const col=C.MONSTERS[enemyType].color;
if(['poring','poporing'].includes(enemyType)){fill(x-19,y-5,38,20,enemyType==='poring'?'#ab5268':'#3f7251');fill(x-17,y-18,34,28,col);fill(x-12,y-24,24,15,enemyType==='poring'?'#ffd1dc':'#a2dea2');fill(x-8,y-9,4,5,'#283c32');fill(x+6,y-9,4,5,'#283c32');fill(x-8,y-17,9,3,'#ffecf2');if(enemyType==='poporing'){fill(x-17,y+9,34,5,'#4b7e5b');fill(x+10,y-22,4,5,'#c4ecb1');}return;}
if(enemyType==='lunatic'){fill(x-14,y-22,28,34,'#e3dae4');fill(x-9,y-45,8,26,'#ded4de');fill(x+4,y-45,8,26,'#ded4de');fill(x-7,y-42,4,18,'#ecadbd');fill(x+6,y-42,4,18,'#ecadbd');fill(x-10,y-7,4,5,'#4e485a');fill(x+6,y-7,4,5,'#4e485a');fill(x-18,y+5,8,11,'#bbb1bc');fill(x+9,y+5,9,11,'#bbb1bc');return;}
if(enemyType==='fabre'){fill(x-19,y-11,37,23,'#59865f');fill(x-13,y-22,24,23,'#8bc69b');fill(x-11,y-15,4,4,'#2c4435');fill(x+6,y-15,4,4,'#2c4435');fill(x-21,y+9,6,10,'#54794d');fill(x+13,y+9,6,10,'#54794d');fill(x-10,y-29,2,11,'#a5db9b');fill(x+9,y-29,2,11,'#a5db9b');return;}
if(enemyType==='willow'){fill(x-8,y-19,17,39,'#685039');fill(x-21,y-42,42,33,'#476b42');fill(x-27,y-35,54,22,'#639151');fill(x-17,y-49,34,15,'#82ad64');fill(x-7,y-11,4,4,'#e1bd7a');fill(x+5,y-11,4,4,'#e1bd7a');return;}
if(enemyType==='hornet'){fill(x-22,y-21,44,28,'#9b7847');fill(x-16,y-26,31,26,'#e7bc5c');fill(x-11,y-16,9,8,'#4d3829');fill(x+4,y-16,9,8,'#4d3829');fill(x-25,y-35,18,16,'#a6b9c9a8');fill(x+8,y-35,18,16,'#a6b9c9a8');fill(x-7,y+8,14,14,'#e6c4a2');return;}
fill(x-30,y-24,60,54,'#423047');fill(x-25,y-44,50,42,'#755273');fill(x-15,y-56,30,24,'#a45d75');fill(x-22,y-60,9,21,'#c09e7e');fill(x+14,y-60,9,21,'#c09e7e');fill(x-12,y-27,8,6,'#ff6a86');fill(x+6,y-27,8,6,'#ff6a86');fill(x-17,y+17,10,21,'#59344e');fill(x+9,y+17,10,21,'#59344e');fill(x+27,y-36,8,65,'#e6b1bc');fill(x+25,y-46,12,12,'#e6b1bc');}
function drawCharacter(x,y,enemyType=null,actor=null){
 const key=enemyType||playerSpriteKey();
 if(actor&&drawEntitySprite(key,actor,x,y))return;
 drawFallbackCharacter(x,y,enemyType);
}

function drawNpc(x,y,name,kind){fill(x-15,y+17,30,6,'#08111cb0');fill(x-11,y-15,22,29,kind==='shop'?'#8d6049':'#716b95');fill(x-9,y-32,18,20,'#f0c9a8');fill(x-10,y-35,20,8,kind==='shop'?'#7c5141':'#dfd1a8');fill(x-5,y+14,6,12,'#453f40');fill(x+3,y+14,6,12,'#453f40');label(name,x,y-44,'#ffdea2',10);if(dist({x,y},s.player)<125)label('E · พูดคุย',x,y-56,'#a8e6c0',9);}
function drawMob(m){if(!m.alive&&!(m.deadUntil>now))return;
 const visual=monsterVisual(m.type),top=m.y-visual.foot,half=Math.ceil(visual.width/2),barWidth=Math.max(48,visual.width);
 drawCharacter(m.x,m.y+Math.sin(anim*2+m.phase)*2,m.type,m);
 if(m.flash>0){g.globalAlpha=.35;fill(m.x-half,top,visual.width,visual.height,'#fff');g.globalAlpha=1;}
 const st=C.MONSTERS[m.type];if(m.alive&&(target===m||m.hp<m.maxHp||m.type==='boss')){
  fill(m.x-barWidth/2,top-15,barWidth,5,'#1a1019');fill(m.x-barWidth/2+1,top-14,(barWidth-2)*m.hp/m.maxHp,3,m.type==='boss'?'#e26783':'#db7d77');
 }
 label(st.name+' Lv.'+st.level,m.x,top-23,m.type==='boss'?'#ffa5af':'#e3d5b7',m.type==='boss'?12:10);
 if(m.alive&&m===target){g.strokeStyle='#ffd989';g.lineWidth=2;g.strokeRect(Math.round(m.x-half-3),Math.round(top-3),visual.width+6,visual.height+6);g.beginPath();g.moveTo(m.x,top-22);g.lineTo(m.x-6,top-15);g.lineTo(m.x+6,top-15);g.closePath();g.fillStyle='#ffe2a1';g.fill();}
}
function render(){let z=s.player.zone;cam.x=C.clamp(s.player.x-VW/2,0,W-VW);cam.y=C.clamp(s.player.y-VH/2,0,H-VH);g.clearRect(0,0,VW,VH);fill(0,0,VW,VH,ZONES[z].ground);g.save();g.translate(-Math.round(cam.x),-Math.round(cam.y));let startX=Math.floor(cam.x/48),startY=Math.floor(cam.y/48),endX=Math.min(Math.ceil((cam.x+VW)/48),Math.ceil(W/48)),endY=Math.min(Math.ceil((cam.y+VH)/48),Math.ceil(H/48));for(let yy=startY;yy<=endY;yy++)for(let xx=startX;xx<=endX;xx++)drawTile(xx,yy,z);
// Small non-interactive terrain details are deterministic, so no external assets are required.
if(z===0){fill(25,150,445,600,'#67705023');drawHouse(155,270,'hall');drawHouse(155,460,'shop');fill(300,260,36,12,'#736143');fill(315,245,6,29,'#5d4536');label('QUESTS',315,238,'#e5cf9c',10);drawNpc(305,344,'Guild Guide','guide');drawNpc(175,524,'Merchant','shop');drawNpc(370,385,'Healer','healer');}
else if(z===2){fill(1230,290,270,260,'#5c435080');fill(1290,320,150,14,'#80737c');fill(1290,540,150,14,'#80737c');fill(1290,320,12,230,'#80737c');fill(1430,320,12,230,'#80737c');label('SOLO CAVERN GUARDIAN',1360,305,'#dab6c9',15);}
for(const d of decor)if(d.x>cam.x-80&&d.x<cam.x+VW+80&&d.y>cam.y-80&&d.y<cam.y+VH+80)drawDecor(d,z);
if(z>0)drawPortal(70,585,'#82cabc','← RETURN');if(z<2)drawPortal(1830,585,z===1?'#b69be5':'#9cc9b0','NEXT AREA →');
const renderables=mobs.filter(m=>m.alive||m.deadUntil>now).map(m=>({y:m.y,draw:()=>drawMob(m)}));renderables.push({y:s.player.y,draw:()=>drawCharacter(s.player.x,s.player.y,null,s.player)});renderables.sort((a,b)=>a.y-b.y);for(const r of renderables)r.draw();
if(moveTo&&!auto){g.strokeStyle='#ddc894';g.lineWidth=2;g.beginPath();g.arc(moveTo.x,moveTo.y,11+Math.sin(anim*7)*3,0,Math.PI*2);g.stroke();}
for(const f of particles){g.globalAlpha=Math.max(0,f.life);label(f.text,f.x,f.y,f.color,14);}g.globalAlpha=1;g.restore();
// World minimap is rendered separately as an always-visible HUD canvas.
if(hitFlash>0){g.globalAlpha=hitFlash*1.3;fill(0,0,VW,VH,'#b3525a');g.globalAlpha=1;}
}
function drawMinimap(){
 const z=s.player.zone,mw=minimap.width,mh=minimap.height,sx=mw/W,sy=mh/H;
 mg.clearRect(0,0,mw,mh);mg.fillStyle=z===2?'#50634b':'#438a50';mg.fillRect(0,0,mw,mh);
 // Deterministic terrain: no network, no copied game sprites.
 for(let y=0;y<H;y+=28)for(let x=0;x<W;x+=28){const v=hash(x/28|0,y/28|0,z+20);mg.fillStyle=v>.65?'#368343':v<.20?'#559d53':'#488f52';mg.fillRect(Math.floor(x*sx),Math.floor(y*sy),Math.ceil(28*sx)+1,Math.ceil(28*sy)+1);if(v>.72){mg.fillStyle='#235c37';mg.fillRect(x*sx+2,y*sy+1,3,2);}}
 mg.lineWidth=z===2?8:13;mg.strokeStyle=z===2?'#79755d':'#63583a';mg.lineCap='round';mg.beginPath();if(z===0){mg.moveTo(100*sx,550*sy);mg.lineTo(520*sx,565*sy);mg.bezierCurveTo(740*sx,80*sy,1060*sx,250*sy,1150*sx,610*sy);mg.bezierCurveTo(1290*sx,900*sy,1620*sx,640*sy,1870*sx,600*sy);mg.moveTo(1100*sx,570*sy);mg.lineTo(1430*sx,210*sy);}else{mg.moveTo(50*sx,580*sy);mg.bezierCurveTo(650*sx,300*sy,1250*sx,1000*sy,1830*sx,580*sy);}mg.stroke();
 for(const d of decor){if(d.type==='tree'){mg.fillStyle='#195e3b';mg.beginPath();mg.arc(d.x*sx,d.y*sy,2.4,0,Math.PI*2);mg.fill();}else if(d.type==='rock'){mg.fillStyle='#7d8069';mg.fillRect(d.x*sx,d.y*sy,2.5,2);}}
 if(z===0){mg.fillStyle='#433d36';mg.fillRect(108*sx,210*sy,98*sx,90*sy);mg.fillRect(125*sx,423*sy,68*sx,70*sy);}
 for(const m of mobs)if(m.alive){mg.fillStyle=m.type==='boss'?'#fa7990':'#e9d0a1';mg.fillRect(m.x*sx-1,m.y*sy-1,3,3);}
 mg.strokeStyle='#e8e7b0';mg.lineWidth=1.5;mg.strokeRect(cam.x*sx,cam.y*sy,VW*sx,VH*sy);
 const x=s.player.x*sx,y=s.player.y*sy;mg.fillStyle='#fff6c1';mg.strokeStyle='#284f44';mg.lineWidth=2;mg.beginPath();mg.moveTo(x,y-7);mg.lineTo(x+6,y);mg.lineTo(x,y+7);mg.lineTo(x-6,y);mg.closePath();mg.fill();mg.stroke();
}
function safePct(v,top){return Math.max(0,Math.min(100,(v/top||0)*100))+'%';}
function refresh(){const p=s.player,st=playerStats();$('hero-name').textContent=p.name;$('silver').textContent=Math.floor(p.silver).toLocaleString();$('hp-val').textContent=Math.ceil(p.hp)+' / '+st.maxHp;$('hp-bar').style.width=safePct(p.hp,st.maxHp);$('sp-val').textContent=Math.floor(p.sp)+' / '+st.maxSp;$('sp-bar').style.width=safePct(p.sp,st.maxSp);$('level').textContent='Base Lv.'+p.baseLv;$('job-level').textContent=(p.classId==='novice'?'Novice':'Swordman')+' · Job Lv.'+p.jobLv;$('exp-val').textContent=p.exp+' / '+(p.expNext||'MAX');$('jexp-val').textContent=p.jobExp+' / '+(p.jobExpNext||'MAX');$('exp-bar').style.width=safePct(p.exp,p.expNext);$('jexp-bar').style.width=safePct(p.jobExp,p.jobExpNext);const wt=C.weightStatus(s);$('weight-val').textContent=wt.weight+' / '+wt.capacity+' ('+Math.floor(wt.ratio*100)+'%)'+(wt.over90?' · OVER 90%':wt.over50?' · OVER 50%':'');$('weight-val').style.color=wt.over90?'#ff7777':wt.over50?'#d9a456':'';$('stat-points').textContent=p.statPoints+' POINTS';const q=C.QUESTS[s.quest.stage];$('mini-quest').innerHTML='<h3>'+q.title+'</h3><p>'+q.description+'</p><div class="progress-line"><span>PROGRESS</span><span>'+s.quest.kills+' / '+q.count+'</span></div><div class="progress-track"><div style="width:'+safePct(s.quest.kills,q.count)+'"></div></div>';$('mob-count').textContent='◈ '+mobs.filter(m=>m.alive).length+' MONSTERS';$('clock').textContent=new Date(elapsed*1000).toISOString().slice(14,19);renderHotbar();$('coordinates').textContent='X:'+Math.round(p.x)+' Y:'+Math.round(p.y);$('target-box').hidden=!target||!target.alive;if(target&&target.alive){const t=C.MONSTERS[target.type];$('target-box').innerHTML='<strong>◈ '+t.name+' Lv.'+t.level+'</strong><span style="float:right;color:#d4c1a5">'+Math.ceil(target.hp)+' / '+target.maxHp+'</span><div class="meter"><div class="fill hp" style="width:'+safePct(target.hp,target.maxHp)+'"></div></div>';}if(now-lastPanel>.18&&!document.activeElement?.matches('#panel-window input,#panel-window select,#panel-window textarea'))panel();}
function head(kicker,title){return '<div class="panel-head"><div><small>'+kicker+'</small><h2>'+title+'</h2></div><span class="tag">SOLO</span></div>';}
function itemIconPath(id){return Object.prototype.hasOwnProperty.call(C.ITEMS,id)&&/^[a-z0-9_]+$/.test(id)?'assets/icons/items/'+id+'.png':null;}
function itemIconHtml(id,fallback='◈'){const path=itemIconPath(id);return path?'<img class="item-icon" src="'+path+'" alt="" draggable="false">':escapeHtml(fallback);}
function itemText(id){const it=C.ITEMS[id];if(!it)return '';const attr=['atk','def','maxHp','maxSp'].filter(k=>it[k]).map(k=>k.toUpperCase()+' +'+it[k]).join(' · ');return attr||(id==='green_potion'?'แก้ Poison / Silence / Blind / Chaos':it.slot==='material'?'ขาย '+it.sell+' Silver / ชิ้น':'ยาฟื้นฟู');}
function panel(){const p=s.player,st=playerStats();let out='';if(tab==='status'){out=head('CHARACTER / CLASSIC','Status · ค่าสถานะ')+'<p class="panel-note">6 สเตตัส Classic · แต้มที่ใช้เพิ่มขึ้นตามค่าปัจจุบัน (SOLO progression)</p><span class="tag gold">เหลือ '+p.statPoints+' แต้ม</span><div class="ro-stat-grid">';for(const [id,name,desc] of [['str','STR · Strength','พลังโจมตี'],['agi','AGI · Agility','FLEE และ ASPD'],['vit','VIT · Vitality','HP และ DEF'],['int','INT · Intelligence','SP และ MATK'],['dex','DEX · Dexterity','ATK / HIT'],['luk','LUK · Luck','CRITICAL']])out+='<div class="stat-row"><div><strong>'+name+'</strong><small>'+desc+'</small></div><strong>'+p[id]+'</strong><button data-stat="'+id+'" title="ใช้ '+C.statCost(p[id])+' แต้ม" '+(p.statPoints>=C.statCost(p[id])&&p[id]<99?'':'disabled')+'>+'+C.statCost(p[id])+'</button></div>';out+='</div><div class="equip-section"><h3>CLASSIC COMBAT · NOVICE / SWORDMAN</h3><div class="stat-row">BASE / WEAPON ATK <strong>'+st.baseAtk+' + '+st.weaponAtk+'</strong></div><div class="stat-row">HARD / SOFT DEF <strong>'+st.hardDef+' / '+st.softDef+'</strong></div><div class="stat-row">MATK MIN–MAX <strong>'+st.matkMin+'–'+st.matkMax+'</strong></div><div class="stat-row">HARD / SOFT MDEF <strong>'+st.hardMdef+' / '+st.softMdef+'</strong></div><div class="stat-row">HIT / FLEE <strong>'+st.hit+' / '+st.flee+'</strong></div><div class="stat-row">ASPD / INTERVAL <strong>'+st.aspd+' / '+st.attackInterval.toFixed(2)+'s</strong></div><div class="stat-row">MAX HP / SP <strong>'+st.maxHp+' / '+st.maxSp+'</strong></div><div class="stat-row">CRIT STATUS / LUCKY <strong>'+st.critDisplay+' / '+st.perfectDodge+'%</strong></div><div class="stat-row">WEIGHT <strong>'+C.weightStatus(s).weight+' / '+C.weightStatus(s).capacity+'</strong></div><div class="stat-row">STATUS <strong>'+C.STATUS_IDS.filter(id=>C.activeStatus(s,id)).map(id=>id.toUpperCase()).join(', ')+'</strong></div></div>';}
else if(tab==='skills'){
 out=head('CLASS / SKILL POINTS','Skills · Novice → Swordman')+'<p class="panel-note">Job EXP ตามตาราง Classic · EXP ×'+C.SOLO_EXP_RATE+' สำหรับ Solo</p><span class="tag gold">'+(p.classId==='novice'?'Novice':'Swordman')+' · Job '+p.jobLv+' · คงเหลือ '+p.skillPoints+' Skill Points</span>';
 if(p.classId==='novice')out+='<div class="quest-card" style="margin-top:10px"><h3>เปลี่ยนเป็น Swordman</h3><p>Novice Job Lv.10 · อยู่ใกล้ Guild Guide ในแผนที่ 1</p><button class="button green full" data-act="jobchange" '+(p.jobLv>=10?'':'disabled')+'>⚔ เปลี่ยนอาชีพ</button></div>';
 out+='<div class="ro-skill-list" aria-label="รายการสกิล">';
 for(const [id,k] of Object.entries(C.SKILLS)){
  const lv=s.skills[id]||0;if(k.classId==='swordman'&&p.classId!=='swordman')continue;
  const prerequisites=k.requires?Object.entries(k.requires).map(([req,need])=>C.SKILLS[req].name+' Lv.'+need).join(', '):'ไม่มี';
  const locked=!!(k.requires&&Object.entries(k.requires).some(([req,need])=>(s.skills[req]||0)<need));
  out+='<article class="ro-skill-card" data-skill-card="'+id+'"><div class="ro-skill-card-head"><span class="icon-block" aria-hidden="true">'+k.icon+'</span><div><strong>'+escapeHtml(k.name)+'</strong><small>Lv. '+lv+' / '+k.max+'</small></div></div><p>'+escapeHtml(k.desc)+'</p><div class="ro-skill-meta"><span>SP '+C.skillCost(id,lv||1)+'</span><span>Cooldown / Delay '+(id==='magnum_break'?2:st.attackInterval.toFixed(2))+'s</span><span>เงื่อนไข: '+escapeHtml(prerequisites)+'</span></div><div class="ro-skill-actions">'+(lv>0?'<button class="tiny-button bind-button" data-bind-skill="'+id+'">＋ ใส่ Hotbar</button>':'')+(id==='first_aid'?'':'<button class="tiny-button" data-learn="'+id+'" '+(p.skillPoints<=0||lv>=k.max||locked?'disabled':'')+'>เรียน +1</button>')+'</div></article>';
 }
 out+='</div><p class="panel-note">คลิก + ใส่ Hotbar เพื่อเลือกช่อง 1–9 · สกิลที่ล็อกยังเรียนไม่ได้</p>';
}
else if(tab==='equipment'){
 out=head('EQUIPMENT / SOLO','Equipment · อุปกรณ์')+'<p class="panel-note">ช่องอุปกรณ์ตามระบบเกมปัจจุบัน · ใช้หน้ากระเป๋าเพื่อสวมใส่หรือสลับอุปกรณ์</p>';
 out+='<div class="ro-equipment-layout"><div class="ro-equip-list">';
 for(const [slot,desc] of [['weapon','⚔ อาวุธ'],['armor','◇ เสื้อเกราะ']]){
   const id=s.equipment[slot],it=id?C.ITEMS[id]:null;
   out+='<div class="ro-equip-slot"><small>'+desc+'</small><strong>'+(it?it.name:'— ว่าง —')+'</strong>'+(it?'<button class="tiny-button" data-unequip="'+slot+'">ถอด</button>':'')+'</div>';
 }
 out+='</div><div class="ro-paperdoll" aria-label="โครงช่องตัวละคร"><div class="ro-paperdoll-avatar" aria-hidden="true">♙</div><strong>'+escapeHtml(p.name)+'</strong><small>'+(p.classId==='novice'?'Novice':'Swordman')+'</small></div><div class="ro-equip-list">';
 const slot='accessory',id=s.equipment[slot],it=id?C.ITEMS[id]:null;
 out+='<div class="ro-equip-slot"><small>✧ เครื่องประดับ</small><strong>'+(it?it.name:'— ว่าง —')+'</strong>'+(it?'<button class="tiny-button" data-unequip="'+slot+'">ถอด</button>':'')+'</div>';
 out+='</div></div><button class="button outline full ro-to-inventory" data-tab="inventory">เปิดกระเป๋าเพื่อสวมอุปกรณ์ ↗</button>';
}
else if(tab==='inventory'){
 out=head('ITEMS / CLASSIC','Inventory · กระเป๋า')+'<p class="panel-note">คลิกช่องไอเทมเพื่อดูรายละเอียด · เลือกใช้ สวมใส่ ขาย หรือใส่ Hotbar จากด้านล่าง</p>';
 const filters=[['all','ทั้งหมด'],['consumable','ใช้ได้'],['equipment','อุปกรณ์'],['material','วัตถุดิบ']];
 out+='<div class="ro-inventory-tabs" role="group" aria-label="กรองประเภทไอเทม">'+filters.map(([key,name])=>'<button type="button" data-item-filter="'+key+'" aria-pressed="'+(inventoryFilter===key)+'">'+name+'</button>').join('')+'</div>';
 const entries=Object.entries(s.inventory).filter(([id,count])=>{
  const item=C.ITEMS[id];if(!item||count<=0)return false;
  return inventoryFilter==='all'||(inventoryFilter==='equipment'?(item.slot!=='material'&&item.slot!=='consumable'):item.slot===inventoryFilter);
 });
 if(!entries.some(([id])=>id===selectedItem))selectedItem=entries.length?entries[0][0]:null;
 out+='<div class="ro-inventory-grid" role="group" aria-label="ช่องไอเทมในกระเป๋า">';
 for(const [id,count] of entries){const it=C.ITEMS[id];out+='<button type="button" class="ro-item-slot" data-inspect-item="'+id+'" aria-pressed="'+(id===selectedItem)+'" title="'+escapeHtml(it.name)+' ×'+count+'"><span class="ro-slot-icon" aria-hidden="true">'+itemIconHtml(id,it.icon)+'</span><span class="ro-slot-count">'+count+'</span></button>';}
 for(let i=entries.length;i<Math.max(24,Math.ceil(entries.length/8)*8);i++)out+='<span class="ro-item-slot ro-empty-slot" aria-hidden="true"></span>';
 out+='</div>';
 if(selectedItem&&C.ITEMS[selectedItem]&&(s.inventory[selectedItem]||0)>0){
  const id=selectedItem,it=C.ITEMS[id],count=s.inventory[id],category={consumable:'ไอเทมใช้งาน',material:'วัตถุดิบ',weapon:'อาวุธ',armor:'ชุดเกราะ',accessory:'เครื่องประดับ'}[it.slot]||'ไอเทม';
  const bind=it.slot==='consumable'?'<button class="tiny-button bind-button" data-bind-item="'+id+'">＋ ใส่ Hotbar</button>':'';
  const action=it.slot==='material'?'<button class="tiny-button" data-sell="'+id+'">ขาย ×'+count+'</button>':'<button class="tiny-button" data-item="'+id+'">'+(it.slot==='consumable'?'ใช้ไอเทม':'สวมใส่')+'</button>';
  out+='<section class="ro-item-detail" data-item-details aria-live="polite"><div class="ro-detail-title"><span class="icon-block" aria-hidden="true">'+itemIconHtml(id,it.icon)+'</span><div><strong>'+escapeHtml(it.name)+'</strong><small>'+category+' · จำนวน '+count+'</small></div></div><p>'+escapeHtml(itemText(id))+'</p><div class="ro-item-actions">'+bind+action+'</div></section>';
 }else out+='<section class="ro-item-detail" data-item-details><p>ไม่มีไอเทมในหมวดนี้</p></section>';
 out+='<button class="button outline full ro-to-equipment" data-tab="equipment">ดูอุปกรณ์ที่สวมใส่ ↗</button>';
}
else if(tab==='quest'){const q=C.QUESTS[s.quest.stage];out=head('FIELD NOTES / '+(s.quest.stage+1),'Quest Journal')+'<div class="quest-card"><span class="tag gold">QUEST '+(s.quest.stage+1)+' / '+C.QUESTS.length+'</span><h3 class="quest-name" style="margin-top:14px">'+q.title+'</h3><p>'+q.description+'</p><div class="progress-line"><span>กำจัดเป้าหมาย</span><strong>'+s.quest.kills+' / '+q.count+'</strong></div><div class="progress-track"><div style="width:'+safePct(s.quest.kills,q.count)+'"></div></div><div class="quest-reward">◉ '+q.silver+' Silver &nbsp; ✦ '+q.exp*C.SOLO_EXP_RATE+' Base EXP</div><button class="button green full" data-act="claim" '+(s.quest.kills>=q.count?'':'disabled')+'>★ รับรางวัลภารกิจ</button></div><p class="panel-note" style="margin-top:15px">Poring → Fabre → Lunatic → Willow → Hornet → Poporing → Guardian → ล่าซ้ำได้</p><span class="tag">สำเร็จแล้ว '+s.quest.claimed+' ครั้ง</span>';}
else if(tab==='shop'){out=head('MERCHANT / TRADING','Item Shop')+'<p class="panel-note">ซื้ออุปกรณ์/ยา SOLO ด้วย Silver · วัสดุขายใน Inventory</p><span class="tag gold">◉ '+Math.floor(p.silver)+' SILVER</span>';for(const [id,it] of Object.entries(C.ITEMS)){if(it.slot==='material')continue;out+='<div class="shop-row"><div class="icon-block">'+itemIconHtml(id,it.icon)+'</div><div class="item-info"><strong>'+it.name+'</strong><small>'+itemText(id)+'</small></div><button class="tiny-button" data-buy="'+id+'" '+(p.silver<it.price?'disabled':'')+'>'+it.price+' ◉</button></div>';}}
else if(tab==='auto'){out=head('AUTO BATTLE / LOCAL','Auto Play')+'<p class="panel-note">หาเป้าหมายใกล้สุดและโจมตี · กด F / คลิกพื้นเพื่อหยุด</p><button class="button '+(auto?'danger':'green')+' full" data-act="auto">'+(auto?'■ หยุด AUTO PLAY':'▶ เริ่ม AUTO PLAY')+'</button><div class="equip-section"><h3>AUTO SETTINGS</h3><label class="setting-row">ใช้ยา HP อัตโนมัติ <input type="checkbox" data-setting="autoPotion" '+(s.settings.autoPotion?'checked':'')+'></label><label class="setting-row">ใช้สกิลอัตโนมัติ <input type="checkbox" data-setting="autoSkill" '+(s.settings.autoSkill?'checked':'')+'></label><label class="setting-row">ใช้ยาเมื่อ HP ต่ำกว่า <select data-setting="potionThreshold">'+[.25,.4,.5,.65,.8].map(n=>'<option value="'+n+'" '+(Math.abs(s.settings.potionThreshold-n)<.01?'selected':'')+'>'+Math.round(n*100)+'%</option>').join('')+'</select></label></div><p class="panel-note" style="margin-top:17px">Auto ทำงานเมื่อเปิดหน้าเกมเท่านั้น</p>';}
else if(tab==='codex'){out=window.BorderCodex.render(window.BorderDivinePrideCache,C);}
else if(tab==='log'){out=head('LOCAL / SYSTEM','Battle Log')+'<p class="panel-note">บันทึกในเครื่อง ไม่ส่งข้อความออกอินเทอร์เน็ต</p>'+(s.log.length?s.log.slice(0,34).map(l=>'<div class="log-entry"><span class="time">['+l.time+']</span>'+escapeHtml(l.text)+'</div>').join(''):'<div class="empty">ยังไม่มีบันทึก</div>')+'<button class="button outline full" data-act="clearlog" style="margin-top:14px">ล้างบันทึก</button>';}
else if(tab==='settings'){out=head('LOCAL DATA / OPTIONS','Settings')+'<p class="panel-note">เซฟ v1 ย้ายเข้า v1.1 อัตโนมัติบนเบราว์เซอร์เดียวกันเมื่อมีข้อมูลเดิม · เซฟภารกิจเริ่มใหม่เนื่องจากประเภทศัตรูเปลี่ยน</p><button class="button green full" data-act="save">◫ SAVE GAME</button><div style="height:9px"></div><button class="button outline full" data-act="export">⇩ Export Save (.json)</button><div style="height:9px"></div><button class="button outline full" data-act="import">⇧ Import Save v1 / v2</button><div style="height:18px"></div><div class="equip-section"><h3>CHARACTER APPEARANCE</h3><label class="setting-row">ทรงผมตัวละคร <select data-setting="hairStyle">'+Array.from({length:19},(_,i)=>'<option value="'+i+'" '+((s.player.hairStyle||0)===i?'selected':'')+'>แบบ '+(i+1)+'</option>').join('')+'</select></label><p class="panel-note">สำหรับ Novice / Swordman ชาย · เปลี่ยนอาชีพแล้วใช้ทรงผมเดิม</p></div><div style="height:9px"></div><div class="equip-section"><h3>GAME INFORMATION</h3><div class="stat-row">โหมด<strong>Single Player / Offline</strong></div><div class="stat-row">แผนที่<strong>3 Zones</strong></div><div class="stat-row">คลาส<strong>Novice → Swordman</strong></div><div class="stat-row">EXP Multiplier<strong>×'+C.SOLO_EXP_RATE+'</strong></div><div class="stat-row">Combat<strong>Classic / supported scope</strong></div><div class="stat-row">บันทึกล่าสุด<strong>'+(s.savedAt?new Date(s.savedAt).toLocaleTimeString('th-TH'):'—')+'</strong></div></div><div style="height:22px"></div><button class="button danger full" data-act="reset">⟲ เริ่มเกมใหม่ / ลบเซฟ v2</button><p class="panel-note" style="margin-top:14px">ก่อนย้ายเครื่องให้ Export Save · Sprite Novice / Swordman ที่ผู้ใช้ส่งมาใช้ส่วนตัวเท่านั้น; ตรวจสิทธิ์ก่อนเผยแพร่</p>';}
const picker=pendingHotbar?'<div class="hotbar-picker"><strong>ใส่ '+escapeHtml(pendingHotbar.type==='skill'?C.SKILLS[pendingHotbar.id].name:C.ITEMS[pendingHotbar.id].name)+' ลงช่องไหน?</strong><div class="hotbar-pick-grid">'+Array.from({length:9},(_,i)=>'<button type="button" data-assign-slot="'+(i+1)+'" title="เลือกช่อง '+(i+1)+'">'+(i+1)+'</button>').join('')+'</div><button class="tiny-button" data-act="cancelbinding">ยกเลิก</button></div>':'';
 $('side-panel').innerHTML=picker+out;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function selectTab(name){if(!['status','skills','equipment','inventory','quest','shop','auto','codex','log','settings'].includes(name))return;setMenu(false);tab=name;$('panel-window').hidden=false;$('panel-window-title').textContent=({status:'STATUS',equipment:'EQUIPMENT',inventory:'ITEM',skills:'SKILL',quest:'QUEST',shop:'SHOP',auto:'AUTO PLAY',codex:'CODEX',log:'BATTLE LOG',settings:'OPTIONS'})[name];for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);panel();}
function interact(){if(s.player.zone===0){const loc=[{x:305,y:344,tab:'skills',text:'Guild Guide: Job 10 เปลี่ยนอาชีพ Swordman ได้ที่เมนู Skills'},{x:175,y:524,tab:'shop',text:'Merchant: ยินดีต้อนรับ!'},{x:370,y:385,tab:'shop',text:'Healer: ฟื้นฟู HP/SP'}].sort((a,b)=>dist(a,s.player)-dist(b,s.player))[0];if(loc&&dist(loc,s.player)<110){if(loc.text.startsWith('Healer')){s.player.hp=playerStats().maxHp;s.player.sp=playerStats().maxSp;notify('Healer: ฟื้น HP และ SP เต็มแล้ว');}else notify(loc.text);selectTab(loc.tab);return;}}notify('ไม่มี NPC ใกล้เคียง · Guild Guide อยู่ในทุ่งแรกทางซ้าย');}
function exportSave(){const text=JSON.stringify({...s,savedAt:Date.now()},null,2),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Borderlands_Classic_Save_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('ส่งออกไฟล์ Save แล้ว');}
function setMenu(open){const menu=$('game-menu'),button=document.querySelector('.menu-toggle');menu.hidden=!open;button.setAttribute('aria-expanded',String(open));button.title=open?'ปิดเมนูเกม':'เปิดเมนูเกม';}
function setMinimapCollapsed(collapse){const wrap=$('minimap-panel'),button=document.querySelector('.minimap-toggle');wrap.classList.toggle('is-collapsed',collapse);button.setAttribute('aria-expanded',String(!collapse));button.setAttribute('aria-label',collapse?'ขยายแผนที่ย่อ':'พับแผนที่ย่อ');button.textContent=collapse?'▣':'−';}
function setHotbarCollapsed(collapse){const wrap=document.querySelector('.combatbar'),button=document.querySelector('.hotbar-handle');wrap.classList.toggle('is-collapsed',collapse);button.setAttribute('aria-expanded',String(!collapse));button.setAttribute('aria-label',collapse?'ขยาย Hotbar':'พับ Hotbar');button.textContent=collapse?'⌃':'⌄';}
function handleAction(act){switch(act){case 'togglemenu':setMenu($('game-menu').hidden);break;case 'toggleminimap':setMinimapCollapsed(!$('minimap-panel').classList.contains('is-collapsed'));break;case 'togglehotbar':setHotbarCollapsed(!document.querySelector('.combatbar').classList.contains('is-collapsed'));break;case 'edithotbar':pendingHotbar=null;setHotbarEdit(!hotbarEdit);break;case 'cancelbinding':pendingHotbar=null;renderHotbar();panel();break;case 'save':save();break;case 'attack':if(!attack())log('คลิกเลือกมอนสเตอร์หรือเข้าไปใกล้เพื่อโจมตี');break;case 'potion':if(C.usePotion(s))notify('ใช้ HP Potion');else notify('ใช้ HP Potion ไม่ได้');break;case 'ether':if(C.usePotion(s,'ether'))notify('ใช้ SP Potion');else notify('ใช้ SP Potion ไม่ได้');break;case 'auto':toggleAuto();break;case 'interact':interact();break;case 'closepanel':$('panel-window').hidden=true;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));break;case 'collapsehud':{const el=document.querySelector('.portrait-pane'),collapsed=el.classList.toggle('collapsed'),b=el.querySelector('.hud-collapse');b.setAttribute('aria-expanded',String(!collapsed));b.setAttribute('aria-label',collapsed?'ขยายข้อมูลตัวละคร':'พับข้อมูลตัวละคร');b.textContent=collapsed?'+':'−';break;}case 'map':$('minimap-panel').hidden=!$('minimap-panel').hidden;break;case 'togglequest':{const body=document.querySelector('.field-pane .quest-body'),box=document.querySelector('.field-pane'),b=box.querySelector('[data-act=togglequest]');body.hidden=!body.hidden;box.classList.toggle('is-collapsed',body.hidden);b.setAttribute('aria-expanded',String(!body.hidden));b.textContent=body.hidden?'+':'−';break;}case 'help':$('help-panel').hidden=false;break;case 'closehelp':$('help-panel').hidden=true;break;case 'jobchange':if(s.player.zone===0&&dist(s.player,{x:305,y:344})<115&&C.changeJob(s,'swordman')){notify('JOB CHANGE! Swordman · เรียน Bash ที่ Skills');save(true);}else notify('ต้องเป็น Novice Job 10 และอยู่ใกล้ Guild Guide ก่อน');break;case 'claim':if(C.claimQuest(s)){notify('รับรางวัลภารกิจเรียบร้อย ✦');save(true);}break;case 'clearlog':s.log=[];log('ล้างบันทึกแล้ว');break;case 'export':exportSave();break;case 'import':$('import-file').click();break;case 'reset':if(confirm('เริ่มเกมใหม่และลบความคืบหน้าบนเครื่องนี้?\nแนะนำ Export Save ก่อน หากต้องการเก็บไฟล์เดิม')){s=C.newGame();s.hotbar=normalizeHotbar(null);pendingHotbar=null;setHotbarEdit(false);now=0;elapsed=0;particles=[];cool={attack:0,1:0,2:0,3:0,4:0};enterZone(0,'start');save();notify('เริ่มการผจญภัยใหม่แล้ว');}break;}}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.clearSlot){clearHotbar(Number(b.dataset.clearSlot));refresh();return;}
 if(b.dataset.assignSlot){assignHotbar(Number(b.dataset.assignSlot),pendingHotbar);refresh();return;}
 if(b.dataset.bindSkill){chooseHotbarBinding('skill',b.dataset.bindSkill);return;}
 if(b.dataset.bindItem){chooseHotbarBinding('item',b.dataset.bindItem);return;}
 if(b.dataset.slot){clickHotbar(Number(b.dataset.slot));refresh();return;}
 if(b.dataset.tab){selectTab(b.dataset.tab);return;}
 if(b.dataset.itemFilter){inventoryFilter=b.dataset.itemFilter;selectedItem=null;panel();return;}
 if(b.dataset.inspectItem){selectedItem=b.dataset.inspectItem;panel();return;}
 if(b.dataset.act){handleAction(b.dataset.act);if(b.closest('#game-menu'))setMenu(false);refresh();return;}
 if(b.dataset.skill){if(!skill(Number(b.dataset.skill)))log('สกิลยังไม่พร้อม · ตรวจระดับ Job / ระยะ / SP');refresh();return;}
 if(b.dataset.learn){if(C.learnSkill(s,b.dataset.learn)){notify('เรียน '+C.SKILLS[b.dataset.learn].name+' Lv.'+s.skills[b.dataset.learn]);save(true);}else notify('Skill Points ไม่พอหรือยังไม่ผ่านเงื่อนไข');refresh();panel();return;}
 if(b.dataset.sell){const id=b.dataset.sell,count=s.inventory[id]||0;if(C.sell(s,id,count)){notify('ขาย '+C.ITEMS[id].name+' ×'+count);save(true);}refresh();panel();return;}
 if(b.dataset.stat){if(C.upgrade(s,b.dataset.stat)){notify('เพิ่ม '+b.dataset.stat.toUpperCase()+' +1');save(true);}refresh();panel();return;}
 if(b.dataset.item){const id=b.dataset.item;if(C.ITEMS[id].slot==='consumable'){if(C.usePotion(s,id))notify('ใช้ '+C.ITEMS[id].name);else notify('ยังไม่จำเป็นต้องใช้');}else if(C.equip(s,id))notify('สวม '+C.ITEMS[id].name);refresh();panel();save(true);return;}
 if(b.dataset.unequip){if(C.unequip(s,b.dataset.unequip)){notify('ถอดอุปกรณ์แล้ว');save(true);}refresh();panel();return;}
 if(b.dataset.buy){if(C.buy(s,b.dataset.buy)){notify('ซื้อ '+C.ITEMS[b.dataset.buy].name+' สำเร็จ');save(true);}else notify('Silver ไม่เพียงพอ');refresh();panel();}
});
// Drag & drop is optional; click Edit → select source → select destination also works with touch.
document.addEventListener('dragstart',e=>{const b=e.target.closest('[data-slot]');if(!b||!hotbarEdit||!s.hotbar[Number(b.dataset.slot)-1]){e.preventDefault();return;}draggedHotbarSlot=Number(b.dataset.slot);if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(draggedHotbarSlot));}});
document.addEventListener('dragover',e=>{if(hotbarEdit&&draggedHotbarSlot&&e.target.closest('[data-slot]'))e.preventDefault();});
document.addEventListener('drop',e=>{const b=e.target.closest('[data-slot]');if(!hotbarEdit||!b||!draggedHotbarSlot)return;e.preventDefault();swapHotbar(draggedHotbarSlot,Number(b.dataset.slot));draggedHotbarSlot=null;});
document.addEventListener('dragend',()=>{draggedHotbarSlot=null;});
document.addEventListener('change',e=>{const key=e.target.dataset.setting;if(key==='hairStyle'){s.player.hairStyle=Math.max(0,Math.min(18,Math.floor(Number(e.target.value)||0)));save(true);panel();return;}if(key){s.settings[key]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);save(true);panel();}});
$('import-file').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);if(![1,C.VERSION].includes(obj.version)||!obj.player||!obj.quest||!obj.inventory||!obj.equipment)throw Error('invalid save');if(confirm('นำเข้า Save นี้แทนความคืบหน้าปัจจุบัน?')){s=hydrateWithHotbar(obj);s.log=[];pendingHotbar=null;setHotbarEdit(false);particles=[];enterZone(s.player.zone,'restore');save();notify('นำเข้า Save สำเร็จ');}}catch(_){notify('ไฟล์ Save ไม่ถูกต้องหรือเวอร์ชันไม่รองรับ');}};reader.readAsText(file);e.target.value='';});
function pointFromEvent(e){let r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*VW+cam.x,y:(e.clientY-r.top)/r.height*VH+cam.y};}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const at=pointFromEvent(e);const hit=pickMobAt(at);if(hit){target=hit;moveTo={x:hit.x,y:hit.y,range:50};if(!auto&&dist(hit,s.player)<70)attack();notify('เป้าหมาย: '+C.MONSTERS[hit.type].name);}else{if(auto)toggleAuto();target=null;moveTo={x:C.clamp(at.x,24,W-24),y:C.clamp(at.y,38,H-28),range:7};}});
// Move just the floating UI window without touching the game camera or save data.
(function(){
 const win=$('panel-window'),handle=win.querySelector('.window-title');let drag=null;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const rect=win.getBoundingClientRect();drag={startX:e.clientX,startY:e.clientY,left:rect.left,top:rect.top};
  handle.setPointerCapture(e.pointerId);
 });
 handle.addEventListener('pointermove',e=>{
  if(!drag)return;
  const left=Math.max(4,Math.min(window.innerWidth-win.offsetWidth-4,drag.left+e.clientX-drag.startX));
  const top=Math.max(4,Math.min(window.innerHeight-win.offsetHeight-4,drag.top+e.clientY-drag.startY));
  win.style.transform='none';win.style.left=left+'px';win.style.top=top+'px';
 });
 handle.addEventListener('pointerup',()=>{drag=null;});
 handle.addEventListener('pointercancel',()=>{drag=null;});
 window.addEventListener('resize',()=>{
  if(!win.style.left)return;
  win.style.left=Math.max(4,Math.min(window.innerWidth-win.offsetWidth-4,parseFloat(win.style.left)))+'px';
  win.style.top=Math.max(4,Math.min(window.innerHeight-win.offsetHeight-4,parseFloat(win.style.top)))+'px';
 });
})();
document.addEventListener('keydown',e=>{const tag=document.activeElement&&document.activeElement.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;const code=e.code;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyD','KeyA','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyM'].includes(code))e.preventDefault();if(code==='KeyF'&&!e.repeat){toggleAuto();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))keys[code]=true;if(code==='Space')attack();if(/^Digit[1-9]$/.test(code)&&!e.repeat)useHotbar(Number(code.slice(-1)));if(code==='KeyH'&&!e.repeat){if(C.usePotion(s))notify('ใช้ HP Potion');}if(code==='KeyI'&&!e.repeat)selectTab('inventory');if(code==='KeyQ'&&!e.repeat)selectTab('quest');if(code==='KeyE'&&!e.repeat)interact();if(code==='Escape'){pendingHotbar=null;renderHotbar();$('panel-window').hidden=true;$('help-panel').hidden=true;setMenu(false);}if(code==='KeyM'&&!e.repeat)handleAction('map');});
minimap.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=minimap.getBoundingClientRect();const x=C.clamp((e.clientX-r.left)/r.width*W,24,W-24),y=C.clamp((e.clientY-r.top)/r.height*H,40,H-28);if(auto)toggleAuto();target=null;moveTo={x,y,range:10};notify('เดินไปยังจุดบนแผนที่');});
document.addEventListener('keyup',e=>{keys[e.code]=false;});window.addEventListener('blur',()=>{keys={};save(true);});window.addEventListener('beforeunload',()=>save(true));
function frame(t){let dt=Math.min(.05,(t-last)/1000||0);last=t;fpsFrames++;if(t-fpsSince>=1000){$('fps').textContent=Math.round(fpsFrames*1000/(t-fpsSince));fpsFrames=0;fpsSince=t;}try{update(dt);render();}catch(err){console.error('Game frame error',err);$('system-message').textContent='เกิดข้อผิดพลาดในเฟรมเกม: '+err.message;}requestAnimationFrame(frame);}
makeDecor(s.player.zone);createMobs(s.player.zone);drawMinimap();$('zone-label').textContent=ZONES[s.player.zone].name;$('zone-caption').textContent=ZONES[s.player.zone].sub;$('map-location').textContent=ZONES[s.player.zone].name.split(' · ')[0];log('CLASSIC SOLO: Novice → Job 10 เปลี่ยน Swordman ที่ Guild Guide · กด F เปิด Auto · v1.5 Sprite Runtime');refresh();requestAnimationFrame(frame);
})();
