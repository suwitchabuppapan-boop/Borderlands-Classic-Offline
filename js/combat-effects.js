/* Original classic Siam combat VFX. Reads snapshots/timers; never changes gameplay. */
(function(root){
  "use strict";
  const D=typeof module==="object"?require("./classic-data.js"):root.BCData;
  const P=typeof module==="object"?require("./vfx-painter.js"):root.BCVFXPainter;
  const W=typeof module==="object"?require("./vfx-weapons.js"):root.BCWeaponVFX;
  const S=typeof module==="object"?require("./vfx-skills.js"):root.BCSkillVFX;
  const TAU=Math.PI*2,MAX_EVENTS=64,IVORY="#fff1d0";
  const own=(o,k)=>!!o&&typeof k==="string"&&Object.prototype.hasOwnProperty.call(o,k);
  const finite=Number.isFinite,point=p=>p&&finite(p.x)&&finite(p.y)&&Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
  const phase=value=>value%TAU;
  function active(e){
    return e&&["attack","skill","impact"].includes(e.kind)&&point(e.source)&&point(e.target)
      &&Number.isInteger(e.facing)&&e.facing>=0&&e.facing<4&&finite(e.age)&&e.age>=0
      &&finite(e.duration)&&e.duration>0&&e.age<e.duration&&own(W.profiles,e.weaponType);
  }
  function events(s,paint){
    const list=s?.combatFeedback?.events;if(!Array.isArray(list))return;
    for(let i=Math.max(0,list.length-MAX_EVENTS);i<list.length;i++)if(active(list[i]))paint(list[i]);
  }
  function serpent(c,x,y,r,t){
    const path=[];
    for(let i=0;i<=14;i++){const a=-.5+i*TAU*.88/14;const d=r*(.72+.07*Math.sin(t+i*.6));path.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}
    P.withSaved(c,.2,()=>P.ribbon(c,path,6,"#94bd7c","#a8d390"));
    P.ribbon(c,path,2.7,"#8bb77a","#e4d196");
    const last=path[path.length-1];P.petal(c,last[0],last[1]+4,9,1.4,"#8ebd83",IVORY);
    P.glowDot(c,last[0]+1,last[1]-1,1,"#edca7d",IVORY);
  }
  function buffs(s,paint){
    const cs=s?.classCombat;if(!cs||!point(s.player))return;
    for(const id of ["ward_script","shield_counter","garuda_combo"]){
      const b=own(cs.buffs,id)?cs.buffs[id]:null;
      if(finite(b?.remaining)&&b.remaining>0)paint(id,b.remaining,s.player,phase(b.remaining));
    }
  }
  function drawGround(c,s){
    events(s,e=>{if(e.kind==="skill"&&own(S.profiles,e.skillId))P.withSaved(c,P.envelope(P.progress(e)),()=>S.drawGround(c,e));});
    const traps=s?.classCombat?.traps;
    if(Array.isArray(traps))for(let i=0;i<Math.min(8,traps.length);i++){
      const t=traps[i];if(t?.id!=="naga_trap"||!point(t)||!finite(t.remaining)||t.remaining<=0)continue;
      P.withSaved(c,Math.min(1,t.remaining/.5)*.7,()=>{
        P.halo(c,t.x,t.y,D.skills.naga_trap.radius,D.skills.naga_trap.radius,"#8fb98570",.7);
        serpent(c,t.x,t.y,D.skills.naga_trap.radius,phase(t.remaining));
      });
    }
    buffs(s,(id,remaining,p,t)=>P.withSaved(c,Math.min(1,remaining/.5)*.42,()=>{
      const gold=id==="garuda_combo",color=gold?"#d8ac68":id==="shield_counter"?"#bfa46a":"#95bc91";
      P.halo(c,p.x,p.y+2,18+Math.sin(t)*1.3,6,color,1);
      if(id==="ward_script")for(const side of [-1,1])P.petal(c,p.x+side*12,p.y+3,6,side*1.1,color,IVORY);
      else if(id==="shield_counter")P.arcRibbon(c,p.x,p.y+2,20,7,-.3+Math.sin(t)*.1,2.3,3,color,IVORY);
      else for(const side of [-1,1])P.ribbon(c,[[p.x+side*6,p.y],[p.x+side*15,p.y+5],[p.x+side*20,p.y+1-Math.sin(t)]],3,color,IVORY);
    }));
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
  function persistentFront(c,s){
    buffs(s,(id,remaining,p,t)=>P.withSaved(c,Math.min(1,remaining/.5)*.75,()=>{
      if(id==="ward_script"){
        for(const side of [-1,1])P.glyph(c,p.x+side*(19+Math.sin(t)*1.1),p.y-16+Math.cos(t+side)*2,5.2,"#a9c692",IVORY,t);
      }else if(id==="shield_counter"){
        const x=p.x+18,y=p.y-17+Math.sin(t)*1.2;
        P.polygon(c,[[x-7,y-8],[x+7,y-8],[x+6,y+3],[x,y+9],[x-6,y+3]],"#bea166");
        P.polygon(c,[[x-3,y-6],[x+2,y-6],[x+1,y+4],[x,y+6]],IVORY);
        P.spark(c,x+5,y-6,3.6,"#dfbc7c",IVORY,t*.2);
      }else{
        for(const side of [-1,1]){
          const x=p.x+side*15,y=p.y-13+Math.sin(t+side)*1.3;
          P.petal(c,x,y,10,side*.7,"#d9ab6a",IVORY);P.petal(c,x+side*4,y+2,7,side*1.1,"#e6c281",IVORY);
        }
      }
    }));
    const cs=s?.classCombat,player=s?.player;
    if(cs&&point(player)&&finite(cs.orbTimer)&&cs.orbTimer>0&&finite(cs.orbCharges)){
      const count=P.clamp(Math.floor(cs.orbCharges),0,3),t=phase(cs.orbTimer);
      P.withSaved(c,Math.min(1,cs.orbTimer/.5)*.9,()=>{for(let i=0;i<count;i++){
        const a=-Math.PI/2+(i-1)*.8+Math.sin(t)*.1,x=player.x+Math.cos(a)*24,y=player.y-25+Math.sin(a)*15;
        P.glowDot(c,x,y,3.8,"#79bdc7",IVORY);
        P.polygon(c,[[x,y-5],[x+3,y],[x,y+4],[x-3,y]],"#8ccfd0");
        P.polygon(c,[[x,y-4],[x+1,y],[x,y+1],[x-1,y]],IVORY);
      }});
    }
    const monsters=Array.isArray(s?.monsters)?s.monsters:[];
    for(let i=0;i<Math.min(64,monsters.length);i++){
      const m=monsters[i];if(!point(m)||m.dead||!(m.hp>0)||!Array.isArray(m.classDots))continue;
      for(let j=0;j<Math.min(2,m.classDots.length);j++){
        const d=m.classDots[j];if(!["moon_venom","tiger_rend"].includes(d?.id)||!finite(d.remaining)||d.remaining<=0)continue;
        const t=phase(d.remaining),poison=d.id==="moon_venom",color=poison?"#a5bc80":"#d58489";
        P.withSaved(c,Math.min(1,d.remaining/.5)*.8,()=>{for(let k=0;k<3;k++){
          const x=m.x+(k-1)*6,y=m.y-22-Math.sin(t*2+k)*2;
          if(poison)P.petal(c,x,y,4.5+k*.5,.3*Math.sin(t+k),color,IVORY);
          else P.ribbon(c,[[x+2,y-4],[x-1,y+1],[x-2,y+6]],2.8,color,IVORY);
        }});
      }
    }
  }
  function drawFront(c,s){
    persistentFront(c,s);
    events(s,e=>{
      if(e.kind==="impact"&&!["hit","crit"].includes(e.result))return;
      if(e.kind==="skill"&&!own(S.profiles,e.skillId))return;
      const p=P.progress(e),alpha=e.kind==="impact"?.96*Math.pow(1-p,1.1):P.envelope(p);
      P.withSaved(c,alpha,()=>{if(e.kind==="impact")impact(c,e);else if(e.kind==="skill")S.drawFront(c,e);else W.draw(c,e);});
    });
  }
  const api=Object.freeze({drawGround,drawFront,weaponProfiles:W.profiles,skillProfiles:S.profiles});
  if(typeof module==="object")module.exports=api;else root.BCCombatEffects=api;
})(typeof window==="object"?window:globalThis);
