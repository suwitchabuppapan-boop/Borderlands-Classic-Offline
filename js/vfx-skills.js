/* Compose original Siam skill Parts from immutable, committed combat snapshots. */
(function(root){
  "use strict";
  const D=typeof module==="object"?require("./classic-data.js"):root.BCData;
  const P=typeof module==="object"?require("./vfx-painter.js"):root.BCVFXPainter;
  const F=typeof module==="object"?require("./effect-parts.js"):root.BCFXParts;
  const TAU=Math.PI*2,gold="#d5a24e",ivory="#fff0c6",brass="#b88643",jade="#77b49b";
  const owns=(o,k)=>!!o&&typeof k==="string"&&Object.prototype.hasOwnProperty.call(o,k);
  const profiles=Object.freeze(Object.fromEntries(Object.entries(D.skills).filter(([,s])=>s.kind!=="passive").map(([id,s])=>[id,Object.freeze({name:s.name,radius:s.radius||0})])));
  const point=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<=10000&&Math.abs(v.y)<=10000;
  function active(e){return e&&owns(profiles,e.skillId)&&point(e.source)&&point(e.target)&&Number.isInteger(e.facing)&&e.facing>=0&&e.facing<4&&Number.isFinite(e.age)&&Number.isFinite(e.duration)&&e.duration>0&&e.age>=0&&e.age<e.duration;}
  function direction(e){const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;return dx||dy?Math.atan2(dy,dx):[Math.PI/2,0,-Math.PI/2,Math.PI][e.facing];}
  function groundFrame(c,e,fn){const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;P.withSaved(c,1,()=>{c.translate(e.source.x,e.source.y);c.rotate(direction(e));c.translate(0,-17);fn(Math.min(260,Math.hypot(dx,dy)));});}
  function boundary(c,x,y,r,color){P.withSaved(c,.27,()=>{c.strokeStyle=color;c.lineWidth=.8;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();});}
  function shard(c,x,y,r,a,color,core){const ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;P.polygon(c,[[x+ux*r,y+uy*r],[x+vx*r*.32,y+vy*r*.32],[x-ux*r*.7,y-uy*r*.7],[x-vx*r*.32,y-vy*r*.32]],color);P.stroke(c,[[x-ux*r*.45,y-uy*r*.45],[x+ux*r*.75,y+uy*r*.75]],core,.8);}
  function serpent(c,x,y,r,p,raised) {
    const points=[],phase=p*.55;
    for(let i=0;i<=36;i++) {
      const a=-.25+i/36*TAU*.94,rr=r*(.71+.06*Math.sin(a*3+phase));
      points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*(raised?.5:.9)-(raised?8*p:0)]);
    }
    // Overlapping short sections preserve the complete coil within the painter's point bound.
    for(let i=0;i<points.length-1;i+=14)
      P.ribbon(c,points.slice(i,i+15),raised?3.4:4.2,"#4d9777","#d3dba6");
    for(let i=3;i<33;i+=5) {
      const [px,py]=points[i];shard(c,px,py,2.2,-.5+i*.15,brass,ivory);
    }
    const hx=points[0][0],hy=points[0][1];
    P.polygon(c,[[hx-5,hy+3],[hx-3,hy-5],[hx+5,hy-9],[hx+8,hy-2],[hx+3,hy+4]],jade);
    P.polygon(c,[[hx-3,hy-5],[hx-1,hy-13],[hx+2,hy-7],[hx+5,hy-14],[hx+6,hy-6]],gold);
    P.glowDot(c,hx+4,hy-4,1.1,ivory,"#fff8da");
    P.stroke(c,[[hx+7,hy],[hx+12,hy-2],[hx+14,hy-1]],"#a96469",.7);
  }
  function ground(c,e,p){
    const id=e.skillId,tx=e.target.x,ty=e.target.y;
    switch(id){
      case "arun_slash":groundFrame(c,e,()=>{for(let i=0;i<3;i++)P.polygon(c,[[6+i*6,17],[19+i*8+12*p,14-i*3],[13+i*6,18]],"#c699493d");});break;
      case "quick_stab":groundFrame(c,e,d=>{for(let i=0;i<2;i++)P.polygon(c,[[7+i*8,17],[Math.min(65,d)+p*12,13+i*5],[18+i*8,18]],"#9773a544");});break;
      case "aimed_shot":groundFrame(c,e,()=>{for(let i=0;i<3;i++)P.stroke(c,[[i*5,14],[13+p*20+i*5,17],[i*5,20]],"#c5b68250",1);});break;
      case "shield_counter":groundFrame(c,e,()=>{P.polygon(c,[[3,18],[17+9*p,9],[34+7*p,17],[17+9*p,23]],"#ad843d43");P.stroke(c,[[6,18],[19,13],[29,17]],ivory,.9);});break;
      case "garuda_combo":groundFrame(c,e,()=>{for(let side=-1;side<=1;side+=2)for(let i=0;i<3;i++)P.polygon(c,[[7,17],[19+i*5+10*p,17+side*(6+i*4)],[12,17+side*3]],"#c68b4d44");});break;
      case "tiger_rend":groundFrame(c,e,d=>{for(let i=0;i<3;i++)P.polygon(c,[[d-20+i*3,12+i*4],[d+12+12*p,12+i*5],[d-8,14+i*4]],"#b7615a42");});break;
      case "naga_trap":boundary(c,tx,ty,D.skills[id].radius,"#86ab85");P.withSaved(c,.7,()=>serpent(c,tx,ty,D.skills[id].radius,p,false));break;
      default:{const sk=D.skills[id];if(sk.radius){const anchor=sk.kind==="sanctuary"||sk.kind==="radial"?e.source:e.target;boundary(c,anchor.x,anchor.y,sk.radius,"#a69eb1");}}
    }
  }
  function compose(c,e,layer){
    if(!active(e))return;
    const recipe=F.recipes[e.skillId];if(!recipe||recipe.passive)return;
    const p=P.progress(e),sk=D.skills[e.skillId],classId=owns(D.classes,e.classId)?e.classId:recipe.owner;
    const socket=F.socket(classId,e.facing,Math.min(1,e.age/.22),e.source);
    const self=["self","sanctuary","shield","buff","empower","cleanse","backstep","radial"].includes(sk.kind);
    const angle=self?[Math.PI/2,0,-Math.PI/2,Math.PI][e.facing]:direction(e);
    const gate=e.kind==="impact"?(e.phase==="dot"?"tick":"impact"):"cast";
    if(e.kind==="impact"&&!["hit","crit"].includes(e.result))return;
    for(const part of recipe.parts){
      if(part.eventGate!==gate||(layer==="front"?part.layer!=="front":part.layer==="front"))continue;
      if(sk.adaptive&&part.partId==="common.hit_spark"&&e.magic||sk.adaptive&&part.partId==="common.hit_bloom"&&!e.magic)continue;
      let anchor;
      if(part.anchor==="weapon_tip")anchor=socket?.weapon_tip||{x:e.source.x,y:e.source.y-17};
      else if(part.anchor==="feet")anchor=e.source;
      else if(part.anchor==="body")anchor={x:e.source.x,y:e.source.y-17};
      else if(part.anchor==="target_body")anchor={x:e.target.x,y:e.target.y-17};
      else anchor=self?e.source:e.target;
      const definition=F.definitions[part.partId];
      const vector=definition.directionMode==="vector"||part.variant==="chain_head";
      const projectile=["mage.petal_bolt","archer.arrow_flight","arcane_archer.rune_arrow","scout.needle_thrust","garuda_monk.fist_burst"].includes(part.partId);
      const dx=e.target.x-anchor.x,dy=e.target.y-17-anchor.y;
      const reach=sk.adaptive&&e.weaponType==="knuckle"?(sk.meleeRange||70):sk.range||60;
      const radius=sk.kind==="cone"?reach:sk.radius||34;
      F.draw(c,part.partId,{x:anchor.x+(part.offset?.[0]||0),y:anchor.y+(part.offset?.[1]||0),progress:p,angle:vector?(projectile?Math.atan2(dy,dx):angle)+(part.rotation||0):part.rotation||0,scale:part.scale,radius,distance:Math.min(260,Math.hypot(dx,dy)),seed:e.id||1,facing:e.facing,variant:part.variant});
    }
  }
  function drawGround(c,e){if(!active(e))return;P.withSaved(c,1,()=>{if(e.kind!=="impact")ground(c,e,P.progress(e));compose(c,e,"ground");});}
  function drawFront(c,e){if(!active(e))return;P.withSaved(c,1,()=>compose(c,e,"front"));}
  const api=Object.freeze({drawGround,drawFront,profiles});
  if(typeof module==="object")module.exports=api;else root.BCSkillVFX=api;
})(typeof window==="object"?window:globalThis);
