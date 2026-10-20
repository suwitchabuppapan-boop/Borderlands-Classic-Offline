/* Original classic Siam combat VFX. Snapshot/timer reads never change gameplay. */
(function(root){
  "use strict";
  const D=typeof module==="object"?require("./classic-data.js"):root.BCData;
  const P=typeof module==="object"?require("./vfx-painter.js"):root.BCVFXPainter;
  const W=typeof module==="object"?require("./vfx-weapons.js"):root.BCWeaponVFX;
  const S=typeof module==="object"?require("./vfx-skills.js"):root.BCSkillVFX;
  const F=typeof module==="object"?require("./effect-parts.js"):root.BCFXParts;
  const TAU=Math.PI*2,MAX_EVENTS=64,IVORY="#fff1d0";
  const own=(o,k)=>!!o&&typeof k==="string"&&Object.prototype.hasOwnProperty.call(o,k);
  const finite=Number.isFinite,point=p=>p&&finite(p.x)&&finite(p.y)&&Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
  const alive=p=>point(p)&&!p.dead&&!(p.hp<=0);
  const positive=b=>finite(b?.remaining)&&b.remaining>0;
  const phase=remaining=>((remaining%TAU)/TAU+.2)%1;
  function active(e){return e&&["attack","skill","impact"].includes(e.kind)&&point(e.source)&&point(e.target)&&Number.isInteger(e.facing)&&e.facing>=0&&e.facing<4&&finite(e.age)&&e.age>=0&&finite(e.duration)&&e.duration>0&&e.age<e.duration&&own(W.profiles,e.weaponType);}
  function events(s,paint){const list=s?.combatFeedback?.events;if(!Array.isArray(list))return;for(let i=Math.max(0,list.length-MAX_EVENTS);i<list.length;i++)if(active(list[i])){const e=list[i];paint(own(D.classes,s.classId)?{...e,classId:s.classId}:e);}}
  function serpent(c,x,y,r,t){const path=[];for(let i=0;i<=14;i++){const a=-.5+i*TAU*.88/14,d=r*(.72+.07*Math.sin(t+i*.6));path.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}P.ribbon(c,path,2.7,"#8bb77a","#e4d196");}
  function statePart(c,partId,owner,remaining,layer,extra={}){
    if(!alive(owner)||!finite(remaining)||remaining<=0)return;
    const def=F.definitions[partId];if(!def||(layer==="front"?def.layer!=="front":def.layer==="front"))return;
    const anchor=extra.anchor||def.anchor,body=anchor==="body"||anchor==="target_body";
    F.draw(c,partId,{x:owner.x,y:owner.y-(body?17:0),progress:phase(remaining),remaining,persistent:true,facing:owner.facing||0,alpha:Math.min(1,remaining/.5)*.75,...extra});
  }
  const buffParts=Object.freeze({
    ward_script:"acolyte.ward_cage",shield_counter:"city_guardian.shield_face",garuda_combo:"garuda_monk.garuda_feather",
    swordsman_stance:"swordsman.stance_seal",royal_duelist_tempo:"royal_duelist.tempo_streak",city_guardian_vow:"city_guardian.vow_shell",
    lotus_veil:"mage.lotus_veil",gather_petals:"lotus_mage.gathering_petals",prism_veil:"orb_weaver.prism_shell",
    cleansing_script:"divine_scribe.cleansing_seal",scout_shadow_step:"scout.shadow_step",night_tiger_tempo:"night_tiger.hunt_trail",
    naga_forest_veil:"archer.fletching_trail",arcane_arrow_inscription:"arcane_archer.rune_seal"
  });
  const shields=new Set(["city_guardian_vow","lotus_veil","prism_veil"]),empowers=new Set(["gather_petals","arcane_arrow_inscription"]);
  function persistent(c,s,layer){
    const cs=s?.classCombat,player=s?.player;
    if(alive(player)&&cs){
      for(const [id,part]of Object.entries(buffParts)){const b=own(cs.buffs,id)?cs.buffs[id]:null;if(!positive(b)||shields.has(id)&&!(b.shieldRemaining>0)||empowers.has(id)&&!(b.empowerRemaining>0))continue;statePart(c,part,player,b.remaining,layer,id==="arcane_arrow_inscription"?{anchor:"body"}:{});}
      if(finite(cs.orbTimer)&&cs.orbTimer>0&&finite(cs.orbCharges)&&cs.orbCharges>0)statePart(c,"orb_weaver.charge_jewel",player,cs.orbTimer,layer,{count:P.clamp(Math.floor(cs.orbCharges),0,3)});
    }
    const traps=cs?.traps;
    if(Array.isArray(traps)&&layer==="ground")for(let i=0;i<Math.min(8,traps.length);i++){const t=traps[i];if(t?.id!=="naga_trap"||!point(t)||!positive(t))continue;P.withSaved(c,Math.min(1,t.remaining/.5)*.4,()=>{c.strokeStyle="#8fb985";c.lineWidth=.7;c.beginPath();c.arc(t.x,t.y,D.skills.naga_trap.radius,0,TAU);c.stroke();});statePart(c,"naga_ranger.waiting_coil",t,t.remaining,layer,{radius:D.skills.naga_trap.radius});}
    const monsters=Array.isArray(s?.monsters)?s.monsters:[];
    for(let i=0;i<Math.min(64,monsters.length);i++){
      const m=monsters[i];if(!alive(m))continue;
      const dots=Array.isArray(m.classDots)?m.classDots:[];
      const seen=new Set();for(let j=0;j<Math.min(2,dots.length);j++){const d=dots[j];if(seen.has(d?.id))continue;seen.add(d?.id);if(positive(d)&&["moon_venom","tiger_rend"].includes(d.id))statePart(c,d.id==="moon_venom"?"moon_shadow.poison_cloud":"night_tiger.bleed_mark",m,d.remaining,layer);}
      if(finite(m.snare)&&m.snare>0)statePart(c,"naga_ranger.binding_ribbon",m,m.snare,layer);
      if(positive(m.skillMarks?.blossom_mark))statePart(c,"lotus_mage.blossom_mark",m,m.skillMarks.blossom_mark.remaining,layer);
      const hunt=m.skillMarks?.naga_trap||m.skillMarks?.naga_hunt_mastery;
      if(positive(hunt))statePart(c,"naga_ranger.hunt_sigil",m,hunt.remaining,layer);
      if(positive(m.skillDebuffs?.city_guardian_wave))statePart(c,"city_guardian.shield_wave",m,m.skillDebuffs.city_guardian_wave.remaining,layer,{scale:.3});
      if(positive(m.skillDebuffs?.moon_shadow_veil))statePart(c,"moon_shadow.veil_mist",m,m.skillDebuffs.moon_shadow_veil.remaining,layer,{scale:.5});
    }
  }
  function signals(c,s,layer){
    const list=s?.classCombat?.signals;if(!Array.isArray(list))return;
    for(let i=Math.max(0,list.length-32);i<list.length;i++){
      const e=list[i];if(!e||!point(e.source)||!point(e.target)||!finite(e.age)||e.age<0||!finite(e.duration)||e.duration<=0||e.age>=e.duration||!own(F.recipes,e.skillId))continue;
      if(!["apply","consume","absorb","cleanse","movement","heal","conditional","expire","break"].includes(e.kind))continue;
      if(["absorb","cleanse","movement","heal"].includes(e.kind)&&!(e.amount>0))continue;
      const recipe=F.recipes[e.skillId],matched=recipe.parts.filter(p=>p.eventGate===e.kind);
      const defaults={heal:"common.heal_wisp",cleanse:"common.status_tick",absorb:"common.hit_spark",consume:"common.fade_motes",conditional:"common.power_glint",expire:"common.fade_motes",break:"common.fade_motes"};
      const parts=matched.length?matched:defaults[e.kind]?[{partId:defaults[e.kind],anchor:e.kind==="movement"?"feet":"body",layer:"front"}]:[];
      const p=e.age/e.duration,dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;
      for(const part of parts){
        if(layer==="front"?part.layer!=="front":part.layer==="front")continue;
        const ground=part.anchor==="feet"||part.anchor==="ground_point";
        const origin=e.kind==="movement"&&part.variant!=="end_foot"?e.source:part.anchor==="weapon_tip"?e.source:e.target;
        const socket=part.anchor==="weapon_tip"?F.socket(e.classId,e.facing,Math.min(1,e.age/.22),origin):null;
        const sx=socket?.x??origin.x,sy=socket?.y??(origin.y-(ground?0:17)),shot=part.partId==="arcane_archer.rune_arrow",tx=e.target.x-sx,ty=e.target.y-17-sy;
        F.draw(c,part.partId,{x:sx,y:sy,progress:p,angle:shot?Math.atan2(ty,tx):e.kind==="movement"?Math.atan2(dy,dx):0,distance:shot?Math.hypot(tx,ty):Math.hypot(dx,dy),variant:part.variant,alpha:P.envelope(p),seed:e.id||1,scale:part.scale});
      }
    }
  }
  function critical(c,e,p){
    const x=e.target.x,y=e.target.y-16;
    P.withSaved(c,1,()=>{
      c.translate(x,y);
      const drift=p*8;
      P.withSaved(c,.16,()=>P.spark(c,0,0,23*(1-p*.6),"#edb477",IVORY,-.2));
      P.ribbon(c,[[-24-drift,-18-drift],[0,-2],[25+drift,17+drift]],8*(1-p*.5),"#e34c43","#fff1b0");
      P.ribbon(c,[[-17-drift,23+drift],[-1,1],[20+drift,-25-drift]],6*(1-p*.4),"#e99759",IVORY);
      P.spark(c,-2,0,8*(1-p*.6),"#f4cb83",IVORY,p*.4);
      P.withSaved(c,.65,()=>P.halo(c,0,0,22+p*10,15+p*8,"#e6bc70",1.5*(1-p*.5)));
      P.motes(c,0,0,p,7,"#e99c60",IVORY,e.id,34);
    });
  }
  function impact(c,e){
    const p=P.progress(e),q=W.profiles[e.weaponType],x=e.target.x,y=e.target.y-16;
    if(e.result==="crit"&&!e.magic){critical(c,e,p);return;}
    if(own(S.profiles,e.skillId)){S.drawFront(c,e);return;}
    if(e.phase==="trap"){
      serpent(c,x,y+7,15+p*8,p*TAU);P.spark(c,x,y,8*(1-p*.5),"#b6d094",IVORY,p);return;
    }
    const poison=e.skillId==="moon_venom",dot=e.phase==="dot";
    const color=dot?(poison?"#98bf7f":"#d57b80"):q.color;
    if(dot){
      if(poison)P.petal(c,x,y+4,9*(1-p*.3),p*.7,color,IVORY);
      else P.ribbon(c,[[x-7,y-5-p*3],[x,y+1],[x+6,y+9+p*3]],4,color,IVORY);
      P.motes(c,x,y,p,3,color,IVORY,e.id,12);return;
    }
    P.glowDot(c,x,y,4.5*(1-p*.65),q.light,IVORY);
    if(e.magic){
      P.lotus(c,x,y+4,12*(.8+p*.5),color,q.light,p);
      P.motes(c,x,y,p,5,color,q.light,e.id,20);
    }else{
      P.spark(c,x,y,10+p*6,"#d6ad70",IVORY,-.22+p*.2);
      for(let i=0;i<3;i++){
        const a=-.75+i*2.15,r=8+p*12;
        P.ribbon(c,[[x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3],[x+Math.cos(a)*r,y+Math.sin(a)*r]],2.7*(1-p*.5),color,IVORY);
      }
      P.motes(c,x,y,p,3,"#d1a665",IVORY,e.id,20);
    }
  }
  function drawGround(c,s){persistent(c,s,"ground");signals(c,s,"ground");events(s,e=>{if((e.kind==="skill"||e.kind==="impact"&&["hit","crit"].includes(e.result))&&own(S.profiles,e.skillId))P.withSaved(c,P.envelope(P.progress(e)),()=>S.drawGround(c,e));});}
  function drawFront(c,s){
    persistent(c,s,"front");signals(c,s,"front");
    events(s,e=>{if(e.kind==="impact"&&!["hit","crit"].includes(e.result)||e.kind==="skill"&&!own(S.profiles,e.skillId))return;const p=P.progress(e),alpha=e.kind==="impact"?.96*Math.pow(1-p,1.1):P.envelope(p);P.withSaved(c,alpha,()=>{if(e.kind==="impact")impact(c,e);else if(e.kind==="skill")S.drawFront(c,e);else W.draw(c,e);});});
  }
  const api=Object.freeze({drawGround,drawFront,weaponProfiles:W.profiles,skillProfiles:S.profiles});
  if(typeof module==="object")module.exports=api;else root.BCCombatEffects=api;
})(typeof window==="object"?window:globalThis);
