/* Class combat is simulation-owned. Rendering reads outcomes and never resolves hits. */
(function (root) {
  'use strict';
  const D = typeof module === 'object' ? require('./classic-data.js') : root.BCData;
  const Rules = typeof module === 'object' ? require('./stat-rules.js') : root.BCStatRules;
  const Skills = typeof module === 'object' ? require('./skill-rules.js') : root.BCSkillRules;
  const own = (o,k) => !!o && Object.prototype.hasOwnProperty.call(o,k);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const live = m => !!m && !m.dead && m.hp>0;
  const scaled = (sk,key,per,lv) => (sk[key]||0)+(sk[per]||0)*(lv-1);
  const maxHp = (s,h) => h?.stats ? h.stats(s).maxHp : Rules.maxHp(s);
  const selfKinds = new Set(['self','sanctuary','radial','shield','cleanse','empower','debuff']);
  const areaKinds = new Set(['aoe','sanctuary','radial','cone','pierce','chain']);
  const point = p => Object.freeze({x:p.x,y:p.y});
  // Character actions recover for their existing feedback animation duration.
  // Keep this runtime-only: new/imported states cannot inherit a stale lock.
  const actionRecovery = new WeakMap();
  function beginAction(s,id) { actionRecovery.set(s,id==='attack'?.28:.45); }
  function clearAction(s) { actionRecovery.delete(s); }
  function tickAction(s,dt) {
    const remaining=(actionRecovery.get(s)||0)-dt;
    if(remaining>1e-9)actionRecovery.set(s,remaining);else clearAction(s);
  }
  function actionTiming(s,id) {
    const recovery=actionRecovery.get(s)||0,cooldown=s.cooldowns?.[id]||0;
    if(cooldown>0&&cooldown>=recovery)return{error:D.skills[id]?.owner?'กำลังรอสกิลพร้อมใช้งาน':'กำลังรอสกิลหรือการโจมตีพร้อมใช้งาน',remaining:cooldown,source:'cooldown'};
    if(recovery>0)return{error:'กำลังใช้ท่าก่อนหน้า • รอให้จบท่าก่อน',remaining:recovery,source:'action'};
    return null;
  }
  function state(s) {
    if(!s.classCombat) s.classCombat={buffs:{},traps:[],orbCharges:0,orbTimer:0};
    return s.classCombat;
  }
  function signal(s,id,kind,source=s.player,target=s.player,amount=0) {
    const cs=state(s); if(!cs.signals)cs.signals=[];
    cs.signalSeq=(cs.signalSeq||0)+1;
    cs.signals.push({id:cs.signalSeq,skillId:id,kind,source:point(source),target:point(target),amount,age:0,duration:.7,classId:s.classId,facing:s.player.facing});
    if(cs.signals.length>32)cs.signals.splice(0,cs.signals.length-32);
  }
  function accessible(s,id) {return Skills.accessible(s,id,true)&&Number.isInteger(s.skills[id])&&s.skills[id]<=D.skills[id].max&&!Skills.isPassive(id)&&!!D.skills[id]?.owner;}
  function face(s,m) {
    if(!m)return;const dx=m.x-s.player.x,dy=m.y-s.player.y;
    if(dx||dy)s.player.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?0:2);
  }
  function facingVector(s,target) {
    if(target){const d=distance(s.player,target);if(d>0)return{x:(target.x-s.player.x)/d,y:(target.y-s.player.y)/d};}
    return [{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}][s.player.facing||0];
  }
  function targets(s,sk,target) {
    const living=(s.monsters||[]).filter(live), origin=s.player, dir=facingVector(s,target);
    const range=sk.adaptive&&!D.weaponTypes[D.classes[s.classId].weaponType].basicMagic?sk.meleeRange:sk.range;
    const sort=arr=>arr.sort((a,b)=>distance(origin,a)-distance(origin,b)||String(a.uid).localeCompare(String(b.uid)));
    if(sk.kind==='aoe'||sk.kind==='sanctuary'||sk.kind==='radial'||sk.kind==='debuff') {
      const center=sk.kind==='aoe'?target:origin;
      return center?sort(living.filter(m=>distance(center,m)<=sk.radius)).slice(0,sk.maxTargets||Infinity):[];
    }
    if(sk.kind==='cone')return sort(living.filter(m=>{const d=distance(origin,m);return d<=range&&(d===0||((m.x-origin.x)*dir.x+(m.y-origin.y)*dir.y)/d>=Math.cos((sk.angle||1.8)/2));})).slice(0,sk.maxTargets||5);
    if(sk.kind==='pierce')return sort(living.filter(m=>{const dx=m.x-origin.x,dy=m.y-origin.y,along=dx*dir.x+dy*dir.y;return along>=0&&along<=sk.range&&Math.abs(dx*dir.y-dy*dir.x)<=sk.width;})).slice(0,sk.maxTargets||4);
    if(sk.kind==='chain') {
      if(!live(target))return[];const result=[target];
      while(result.length<(sk.maxTargets||3)) {
        const last=result.at(-1),next=living.filter(m=>!result.includes(m)&&distance(last,m)<=sk.chainRange).sort((a,b)=>distance(last,a)-distance(last,b)||String(a.uid).localeCompare(String(b.uid)))[0];
        if(!next)break;result.push(next);
      }return result;
    }
    return live(target)?[target]:[];
  }
  function movement(s,sk,level,target) {
    const dir=facingVector(s,target),back=sk.moveMode==='backward',gap=target?distance(s.player,target):0;
    const amount=scaled(sk,'distance','distancePerLevel',level);
    const step=back?amount:Math.min(amount,Math.max(0,gap-38));
    if(step<2)return null;
    const sign=back?-1:1;
    const next={x:clamp(s.player.x+dir.x*step*sign,Math.min(s.player.x,80),Math.max(s.player.x,880)),y:clamp(s.player.y+dir.y*step*sign,60,510)};
    // Skills stay inside the current map. Portals remain an explicit travel action.
    if(distance(next,s.player)<2)return null;
    return next;
  }
  function inspect(s,id,p={},h) {
    if(!accessible(s,id))return{error:'ยังไม่ได้เรียนสกิลใช้งานของอาชีพนี้'};
    const skill=D.skills[id],level=s.skills[id],cost=Skills.spCost(s,id);
    const timing=actionTiming(s,id);if(timing)return timing;
    if(!(s.player.sp>=cost))return{error:'SP ไม่เพียงพอ'};
    if(skill.chargeCost&&(s.classCombat?.orbCharges||0)<skill.chargeCost)return{error:'ประจุมณีไม่เพียงพอ'};
    let target=null;
    if(!selfKinds.has(skill.kind) && !(skill.kind==='move'&&skill.moveMode==='backward')) {
      target=(s.monsters||[]).find(m=>m.uid===(p.target??s.target)&&live(m));
      if(!target||(h?.dist||distance)(s.player,target)>Skills.rangeFor(s,id))return{error:'เลือกศัตรูและเดินเข้าใกล้ก่อน'};
    }
    const affected=targets(s,skill,target);
    if(skill.kind==='sanctuary'&&s.player.hp>=maxHp(s,h)&&!affected.length)return{error:'ไม่มีศัตรูในระยะและ HP เต็มแล้ว'};
    if(['radial','debuff'].includes(skill.kind)&&!affected.length)return{error:'ไม่มีศัตรูในระยะ'};
    const next=skill.kind==='move'?movement(s,skill,level,target):null;
    if(skill.kind==='move'&&!next)return{error:'ไม่มีพื้นที่เคลื่อนตัว'};
    return{skill,target,level,cost,affected,next};
  }
  function effect(s,h,x,y,text,color) {if(h?.effect)h.effect(s,x,y,text,color);}
  function afterHeal(s,id,amount) {
    if(Number.isFinite(amount)&&amount>0)signal(s,id,'heal',s.player,s.player,amount);
  }
  function heal(s,id,sk,lv,h) {
    const amount=Math.min(Math.max(0,maxHp(s,h)-s.player.hp),Math.round(scaled(sk,'heal','healPerLevel',lv)*Skills.passives(s).healMultiplier));
    s.player.hp+=amount;if(amount>0){effect(s,h,s.player.x,s.player.y-30,`+${amount} HP`,'#b6edb8');afterHeal(s,id,amount);}
  }
  function buff(s,id,sk,lv) {
    const b={remaining:sk.duration,atkMultiplier:sk.atkMultiplier?scaled(sk,'atkMultiplier','atkPerLevel',lv):1,defBonus:scaled(sk,'defBonus','defPerLevel',lv),damageTaken:sk.damageTaken??1,fleeBonus:scaled(sk,'fleeBonus','fleePerLevel',lv)};
    for(const [key,per]of[['mdefBonus','mdefPerLevel'],['hitBonus','hitPerLevel'],['intervalMultiplier','intervalPerLevel'],['moveMultiplier','movePerLevel']])if(sk[key]!==undefined)b[key]=scaled(sk,key,per,lv);
    if(sk.shield) {
      b.shieldRemaining=scaled(sk,'shield','shieldPerLevel',lv);
      for(const [otherId,other] of Object.entries(state(s).buffs)) {
        if(otherId===id||!(other.remaining>0)||!(other.shieldRemaining>0))continue;
        if(other.shieldRemaining>=b.shieldRemaining)b.shieldRemaining=0;
        else other.shieldRemaining=0;
      }
    }
    if(sk.empowerMultiplier){b.empowerRemaining=1;b.empowerMultiplier=scaled(sk,'empowerMultiplier','empowerPerLevel',lv);b.empowerCategory=sk.empowerCategory;}
    state(s).buffs[id]=b;return b;
  }
  function applyDebuff(s,m,id,sk,lv) {
    if(!live(m))return;
    const record={remaining:sk.duration,atkMultiplier:sk.enemyAtkMultiplier??1,hitPenalty:scaled(sk,'enemyHitPenalty','enemyHitPerLevel',lv),speedMultiplier:sk.enemySpeedMultiplier??1};
    if(!m.skillDebuffs)m.skillDebuffs={};m.skillDebuffs[id]=record;signal(s,id,'apply',s.player,m);
  }
  function conditional(s,m,sk) {
    if(sk.condition==='garuda_combo')return(s.classCombat?.buffs.garuda_combo?.remaining||0)>0;
    const dot=sk.condition==='poison'?'moon_venom':sk.condition==='bleed'?'tiger_rend':null;
    return!!dot&&!!m.classDots?.some(d=>d.id===dot&&d.remaining>0);
  }
  function hit(s,m,power,sk,h,id,phase='direct',source=s.player) {
    if(!live(m))return false;
    return h.damage(s,m,power,true,{magic:Skills.magicFor(s,id),defenseScale:sk.defenseScale??1,skillId:id,phase,source});
  }
  function cast(s,id,p={},h) {
    const check=inspect(s,id,p,h);if(check.error)return{ok:false,message:check.error};
    const{skill:sk,target,level,cost,affected,next}=check;let power=scaled(sk,'power','powerPerLevel',level);
    // No mutations (including feedback/transient allocation) occur before validation.
    beginAction(s,id);s.player.sp-=cost;if(!s.cooldowns)s.cooldowns={};s.cooldowns[id]=sk.cooldown;s.cooldowns.swing=.22;face(s,target);
    if(h?.feedback)h.feedback(s,{kind:'skill',source:s.player,target:target||s.player,facing:s.player.facing,weaponType:D.classes[s.classId].weaponType,skillId:id,result:null,phase:'direct',amount:null,magic:Skills.magicFor(s,id)});
    if(sk.chargeCost) {const cs=state(s);cs.orbCharges-=sk.chargeCost;if(!cs.orbCharges)cs.orbTimer=0;signal(s,id,'consume',s.player,s.player,sk.chargeCost);}
    if(['self','shield','cleanse','empower'].includes(sk.kind)) {
      heal(s,id,sk,level,h);buff(s,id,sk,level);
      if(sk.kind==='cleanse') {
        const debuffs=s.player.skillDebuffs||{},removed=Object.values(debuffs).filter(b=>b.remaining>0).length;
        if(removed){s.player.skillDebuffs={};signal(s,id,'cleanse',s.player,s.player,removed);}
      }
      if(!['ward_script'].includes(id))signal(s,id,'apply');
    }else if(sk.kind==='move') {
      const before=point(s.player);s.player.x=next.x;s.player.y=next.y;
      // Preserve Auto Quest's travel target/destination. This is movement only.
      signal(s,id,'movement',before,s.player,distance(before,s.player));
    }else if(sk.kind==='mark') {
      if(hit(s,target,power,sk,h,id)&&live(target)) {
        if(!target.skillMarks)target.skillMarks={};target.skillMarks[id]={remaining:sk.duration,powerBonus:scaled(sk,'markMultiplier','markPerLevel',level)};signal(s,id,'apply',s.player,target);
      }
    }else if(sk.kind==='debuff') {
      for(const m of affected)applyDebuff(s,m,id,sk,level);
    }else if(sk.kind==='trap') {
      const trap={x:target.x,y:target.y,remaining:sk.duration,id,level};if(s.autoQuest?.active)trap.requiredKind=target.kind;
      state(s).traps=[trap];effect(s,h,target.x,target.y,sk.name,sk.color);
    }else {
      let castMultiplier=1;const aoe=areaKinds.has(sk.kind),arrow=['bow','magic_bow'].includes(D.classes[s.classId].weaponType);
      if(sk.kind==='orb') {const cs=state(s),charges=clamp(cs.orbCharges||0,0,sk.chargeCap);cs.orbCharges=0;cs.orbTimer=0;power+=charges*sk.chargePower;}
      const boosts=Object.entries(s.classCombat?.buffs||{}).filter(([,b])=>b.remaining>0&&b.empowerRemaining>0&&((b.empowerCategory==='aoe'&&aoe)||(b.empowerCategory==='arrow'&&arrow)));
      // Same-category amplification takes the strongest value; every one-use record is consumed once for this cast.
      for(const[,b]of boosts)castMultiplier=Math.max(castMultiplier,b.empowerMultiplier);
      const marks=[];let landed=false;
      for(let i=0;i<affected.length;i++) {
        const m=affected[i];let multiplier=castMultiplier*(sk.kind==='chain'?Math.pow(sk.chainFalloff??1,i):1);
        const mark=aoe&&m.skillMarks?.blossom_mark;
        if(mark?.remaining>0)multiplier*=mark.powerBonus;
        const bonus=conditional(s,m,sk);if(bonus)multiplier*=scaled(sk,'conditionMultiplier','conditionPerLevel',level);
        let targetLanded=false;
        const source=sk.kind==='chain'&&i>0?affected[i-1]:s.player;
        for(let n=0;n<(sk.hits||1)&&live(m);n++)targetLanded=hit(s,m,power*multiplier,sk,h,id,'direct',source)||targetLanded;
        landed=landed||targetLanded;
        if(targetLanded&&bonus)signal(s,id,'conditional',s.player,m,multiplier);
        if(targetLanded&&mark)marks.push(m);
        if(targetLanded&&sk.enemyAtkMultiplier&&live(m))applyDebuff(s,m,id,sk,level);
        if(targetLanded&&sk.kind==='dot'&&live(m)) {
          const dots=(m.classDots||[]).filter(d=>d.id!==id);dots.push({id,power:scaled(sk,'dotPower','dotPerLevel',level),remaining:sk.duration,elapsed:0});m.classDots=dots.slice(-2);
        }
      }
      if(landed) {
        for(const[boostId,b]of boosts){b.empowerRemaining=0;signal(s,boostId,'consume',s.player,target||s.player);}
        for(const m of marks){delete m.skillMarks.blossom_mark;signal(s,'blossom_mark','consume',s.player,m);}
      }
      if(sk.kind==='guard'||sk.kind==='combo_buff')buff(s,id,sk,level);
      if(sk.kind==='sanctuary')heal(s,id,sk,level,h);
      if(sk.kind==='aoe'||sk.kind==='sanctuary') {const center=sk.kind==='sanctuary'?s.player:target;effect(s,h,center.x,center.y,sk.name,sk.color);}
    }
    return{ok:true,message:''};
  }
  function modifiers(s) {
    const result={atkMultiplier:1,defBonus:0,damageTaken:1,fleeBonus:0,mdefBonus:0,hitBonus:0,intervalMultiplier:1,moveMultiplier:1};
    for(const b of Object.values(s.classCombat?.buffs||{})) {
      if(!(b.remaining>0))continue;
      for(const key of ['atkMultiplier','moveMultiplier'])if(Number.isFinite(b[key]))result[key]=Math.max(result[key],clamp(b[key],1,3));
      for(const key of ['defBonus','mdefBonus','fleeBonus','hitBonus'])if(Number.isFinite(b[key]))result[key]=Math.max(result[key],clamp(b[key],0,100));
      if(Number.isFinite(b.damageTaken))result.damageTaken=Math.min(result.damageTaken,clamp(b.damageTaken,.1,1));
      if(Number.isFinite(b.intervalMultiplier))result.intervalMultiplier=Math.min(result.intervalMultiplier,clamp(b.intervalMultiplier,.5,1));
    }return result;
  }
  function enemyModifiers(m) {
    const result={atkMultiplier:1,hitPenalty:0,speedMultiplier:1};
    for(const b of Object.values(m?.skillDebuffs||{}))if(b.remaining>0){result.atkMultiplier=Math.min(result.atkMultiplier,b.atkMultiplier??1);result.hitPenalty=Math.max(result.hitPenalty,b.hitPenalty||0);result.speedMultiplier=Math.min(result.speedMultiplier,b.speedMultiplier??1);}
    return result;
  }
  function absorbDamage(s,amount) {
    let left=amount;
    // Shields in one category do not stack: only the strongest active pool absorbs this hit.
    const entry=Object.entries(s.classCombat?.buffs||{}).filter(([,b])=>b.remaining>0&&b.shieldRemaining>0).sort((a,b)=>b[1].shieldRemaining-a[1].shieldRemaining)[0];
    if(entry){const[id,b]=entry,taken=Math.min(left,b.shieldRemaining);b.shieldRemaining-=taken;left-=taken;if(taken>0){signal(s,id,'absorb',s.player,s.player,taken);if(!b.shieldRemaining)signal(s,id,'break');}}
    return left;
  }
  function afterAttack(s,m,h) {
    if(s.classId!=='orb_weaver'||!m)return;
    const sk=D.skills.orb_burst,cs=state(s);cs.orbCharges=clamp((cs.orbCharges||0)+1,0,sk.chargeCap);cs.orbTimer=sk.chargeDuration;
    effect(s,h,s.player.x,s.player.y-42,`แก้วมณี ${cs.orbCharges}/${sk.chargeCap}`,sk.color);
  }
  function tickRecords(records,dt,s,target=s.player) {if(!records)return;for(const[id,b]of Object.entries(records)){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining){delete records[id];if(own(D.skills,id))signal(s,id,'expire',target,target);}}}
  function tick(s,seconds,h) {
    const dt=Number.isFinite(seconds)?clamp(seconds,0,60):0;if(!dt)return;const cs=s.classCombat;
    tickAction(s,dt);
    if(cs){if(cs.signals)cs.signals=cs.signals.filter(e=>(e.age+=dt)<e.duration);tickRecords(cs.buffs,dt,s);cs.orbTimer=Math.max(0,cs.orbTimer-dt);if(!cs.orbTimer)cs.orbCharges=0;}
    tickRecords(s.player.skillDebuffs,dt,s);
    for(const m of s.monsters||[]) {
      m.snare=Math.max(0,(m.snare||0)-dt);
      if(!live(m)){if(m.classDots)m.classDots=[];if(m.skillDebuffs)m.skillDebuffs={};if(m.skillMarks)m.skillMarks={};m.snare=0;continue;}
      tickRecords(m.skillDebuffs,dt,s,m);tickRecords(m.skillMarks,dt,s,m);
      if(!m.classDots?.length)continue;const remaining=[];
      for(const dot of m.classDots){if(!live(m)||!own(D.skills,dot.id))break;const sk=D.skills[dot.id];dot.elapsed+=Math.min(dt,Math.max(0,dot.remaining));dot.remaining=Math.max(0,dot.remaining-dt);
        const due=Math.min(60,Math.floor((dot.elapsed+1e-9)/sk.interval));for(let i=0;i<due&&live(m);i++)hit(s,m,dot.power,sk,h,dot.id,'dot');dot.elapsed=Math.max(0,dot.elapsed-due*sk.interval);if(dot.remaining>0&&live(m))remaining.push(dot);else if(live(m))signal(s,dot.id,'expire',m,m);
      }m.classDots=remaining;
    }
    if(!cs)return;
    cs.traps=cs.traps.filter(trap=>{trap.remaining=Math.max(0,trap.remaining-dt);if(!trap.remaining||!own(D.skills,trap.id)){if(own(D.skills,trap.id))signal(s,trap.id,'expire',trap,trap);return false;}const sk=D.skills[trap.id];
      const m=(s.monsters||[]).find(m=>live(m)&&(!trap.requiredKind||m.kind===trap.requiredKind)&&(h?.dist||distance)(trap,m)<=sk.radius);if(!m)return true;
      hit(s,m,scaled(sk,'power','powerPerLevel',trap.level),sk,h,trap.id,'trap',trap);
      if(live(m)) {
        if(!D.monsters[m.kind].boss)m.snare=Math.max(m.snare||0,sk.snareDuration);
        if(Skills.passives(s).huntMultiplier>1){if(!m.skillMarks)m.skillMarks={};m.skillMarks.naga_trap={remaining:D.skills.naga_hunt_mastery.huntDuration,powerBonus:Skills.passives(s).huntMultiplier};signal(s,trap.id,'apply',trap,m);}
      }
      effect(s,h,trap.x,trap.y,sk.name,sk.color);return false;
    });
  }
  function safeForQuest(s,id,target) {
    if(!s.autoQuest?.active)return true;const sk=D.skills[id];
    if(sk.kind==='move')return false;
    return !targets(s,sk,target).some(m=>m.kind!==target.kind);
  }
  function suggestSkill(s,m,h) {
    const all=Skills.skillsFor(s.classId).filter(id=>id!=='first_aid'&&accessible(s,id)&&safeForQuest(s,id,m));
    const available=all.filter(id=>!inspect(s,id,{target:m?.uid},h).error);
    const hp=s.player.hp/maxHp(s,h),cs=s.classCombat;
    const choose=predicate=>available.find(id=>predicate(D.skills[id],id));
    if(hp<.8){const survival=choose((sk,id)=>['self','shield','cleanse','sanctuary'].includes(sk.kind)&&((sk.heal&&hp<.8)||sk.shield&&!cs?.buffs[id]?.remaining||sk.cleanse&&Object.values(s.player.skillDebuffs||{}).some(b=>b.remaining>0)));if(survival)return survival;}
    const mobility=suggestMovement(s,m,h);if(mobility)return mobility;
    const prep=choose((sk,id)=>{
      if(sk.kind==='mark')return!m.skillMarks?.[id]?.remaining&&all.some(k=>areaKinds.has(D.skills[k].kind));
      if(sk.kind==='empower')return!cs?.buffs[id]?.remaining&&all.some(k=>D.skills[k].category==='attack');
      return sk.kind==='self'&&!sk.heal&&!cs?.buffs[id]?.remaining;
    });if(prep)return prep;
    const attacks=available.filter(id=>{const sk=D.skills[id];if(sk.kind==='trap')return!cs?.traps?.length;return sk.power>0&&!['self','shield','cleanse','empower','mark','move','debuff'].includes(sk.kind);});
    attacks.sort((a,b)=>{
      const score=id=>{const sk=D.skills[id],count=targets(s,sk,m).length,combo=conditional(s,m,sk)?20:0;return combo+Math.min(count,4)*4+(sk.owner===s.classId?2:0)+(sk.kind==='dot'&&!m.classDots?.some(d=>d.id===id&&d.remaining>0)?4:0);};return score(b)-score(a);
    });
    if(attacks.length)return attacks[0];
    return choose((sk,id)=>sk.kind==='debuff'&&!m.skillDebuffs?.[id]?.remaining)||null;
  }
  function suggestMovement(s,m,h) {
    if(!live(m)||s.autoQuest?.active)return null;
    const gap=distance(s.player,m),profile=D.weaponTypes[D.classes[s.classId].weaponType];
    for(const id of Skills.skillsFor(s.classId)) {
      const sk=D.skills[id];if(sk.kind!=='move'||!accessible(s,id))continue;
      if(sk.moveMode==='toward'&&gap<=profile.approachRange+15)continue;
      if(sk.moveMode==='backward'&&gap>48)continue;
      const check=inspect(s,id,{target:m.uid},h);if(check.error)continue;
      if(sk.moveMode==='backward'&&distance(check.next,m)<gap+15)continue;
      return id;
    }return null;
  }
  const api={cast,tick,inspect,actionTiming,beginAction,clearAction,modifiers,afterAttack,afterHeal,suggestSkill,suggestMovement,enemyModifiers,absorbDamage,targets,safeForQuest};
  if(typeof module==='object')module.exports=api;else root.BCClassCombat=api;
})(typeof window==='object'?window:globalThis);
