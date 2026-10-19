/* Original Siam combat geometry. Cosmetic only: reads simulation snapshots and timers. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const TAU = Math.PI * 2, MAX_EVENTS = 64;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = v => Number.isFinite(v);
  const point = p => p && finite(p.x) && finite(p.y) && Math.abs(p.x) <= 10000 && Math.abs(p.y) <= 10000;
  const weaponProfiles = Object.freeze(Object.fromEntries([
    ["training", "Practice stroke", "#d9d4bd", "#f2edda"],
    ["sword", "Dha crescent", "#dfad52", "#fff2bd"],
    ["dual_sword", "Crossed royal cuts", "#e7c46b", "#fff0c2"],
    ["sword_shield", "Guardian glint", "#e4bd66", "#e7f6ec"],
    ["staff", "Lotus bolt", "#d7a0e7", "#fff1bd"],
    ["orb", "Jade discharge", "#70cfed", "#ffe5a2"],
    ["book", "Scripture glyph", "#90d9a4", "#f8df99"],
    ["knuckle", "Garuda sparks", "#f1b866", "#fff2cc"],
    ["dagger", "Moon kris", "#bc9be9", "#eee6ff"],
    ["claw", "Tiger rakes", "#db6b7a", "#ffd2b3"],
    ["bow", "Forest arrow", "#d8cba0", "#fff6d7"],
    ["magic_bow", "Arcane arrow", "#b89aea", "#a9f6ed"]
  ].map(([id,name,color,light])=>[id,Object.freeze({name,color,light})])));
  const skillProfiles = Object.freeze(Object.fromEntries([
    ["arun_slash","Sunrise arc"], ["lotus_bolt","Lotus bolt"], ["ward_script","Protective glyph"],
    ["quick_stab","Narrow kris stab"], ["aimed_shot","Focused arrow"], ["royal_flurry","Triple crossed cuts"],
    ["shield_counter","Shield counter"], ["lotus_storm","Floral storm"], ["orb_burst","Charged discharge"],
    ["sanctuary","Healing scripture"], ["garuda_combo","Double Garuda punch"], ["moon_venom","Poison sting"],
    ["tiger_rend","Crimson rend"], ["naga_trap","Naga coil"], ["arcane_volley","Magical volley"]
  ].map(([id,name])=>[id,Object.freeze({name,radius:D.skills[id].radius || 0})])));
  const angle = facing => [Math.PI / 2, 0, -Math.PI / 2, Math.PI][facing];
  function stroke(c, color, width, paint) {
    c.strokeStyle=color; c.lineWidth=width; c.beginPath(); paint(); c.stroke();
  }
  function line(c, color, width, points) {
    stroke(c,color,width,()=>points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)));
  }
  function circle(c,x,y,r,color,width=1) { stroke(c,color,width,()=>c.arc(x,y,r,0,TAU)); }
  function disc(c,x,y,r,color) { c.fillStyle=color; c.beginPath(); c.arc(x,y,r,0,TAU); c.fill(); }
  function diamond(c,x,y,r,color,width=1) { line(c,color,width,[[x,y-r],[x+r*.65,y],[x,y+r],[x-r*.65,y],[x,y-r]]); }
  function spark(c,x,y,r,color) {
    line(c,color,1.3,[[x-r,y],[x+r,y]]); line(c,color,1.3,[[x,y-r],[x,y+r]]);
    diamond(c,x,y,r*.55,color);
  }
  function lotus(c,x,y,r,color,light) {
    for(let i=0;i<5;i++) {
      const a=-Math.PI/2+(i-2)*.48;
      stroke(c,color,1.35,()=>{ c.moveTo(x,y+r*.35); c.quadraticCurveTo(x+Math.cos(a-.4)*r*1.25,y+Math.sin(a-.4)*r*1.25,x+Math.cos(a)*r,y+Math.sin(a)*r); c.quadraticCurveTo(x+Math.cos(a+.4)*r*1.25,y+Math.sin(a+.4)*r*1.25,x,y+r*.35); });
    }
    disc(c,x,y,r*.18,light);
  }
  function glyph(c,x,y,r,color,light) {
    diamond(c,x,y,r,color,1.4); diamond(c,x,y,r*.65,light);
    line(c,light,1,[[x-r*.22,y-r*.4],[x+r*.22,y-r*.4],[x+r*.22,y+r*.4],[x-r*.22,y+r*.4]]);
  }
  function shield(c,x,y,r,color,light) {
    const p=[[x-r*.7,y-r],[x+r*.7,y-r],[x+r*.7,y+r*.15],[x,y+r],[x-r*.7,y+r*.15],[x-r*.7,y-r]];
    line(c,color,3,p); line(c,light,1,p); line(c,light,1.3,[[x,y-r*.65],[x,y+r*.55]]);
    line(c,light,1.3,[[x-r*.4,y-r*.1],[x+r*.4,y-r*.1]]);
  }
  function crescent(c,r,offset,color,light,p=0) {
    const start=-1.2+p*.25, end=1.1+p*.25;
    stroke(c,color,4,()=>c.arc(5,offset,r,start,end));
    stroke(c,light,1.2,()=>c.arc(5,offset,r-1,start+.07,end-.1));
  }
  function arrow(c,x,y,color,light,scale=1) {
    line(c,color,2,[[x-25*scale,y],[x+5*scale,y]]);
    line(c,light,1,[[x-24*scale,y-1],[x+4*scale,y-1]]);
    line(c,light,1.8,[[x-2*scale,y-4*scale],[x+5*scale,y],[x-2*scale,y+4*scale]]);
    line(c,color,1.4,[[x-20*scale,y-4*scale],[x-15*scale,y],[x-20*scale,y+4*scale]]);
  }
  function coil(c,x,y,r,p=0) {
    circle(c,x,y,r,"#8fce9890",1.1);
    stroke(c,"#b5e7a9",2,()=>{for(let i=0;i<=40;i++){const a=i/40*TAU*1.8; const d=r*(.25+.65*i/40); const px=x+Math.cos(a+p)*d,py=y+Math.sin(a+p)*d; if(i)c.lineTo(px,py);else c.moveTo(px,py);}});
    diamond(c,x+r*.84,y,r*.14,"#ffe4a1",1.2);
  }
  function activeEvent(e) {
    return !!e && ["attack","skill","impact"].includes(e.kind) && point(e.source) && point(e.target)
      && Number.isInteger(e.facing) && e.facing>=0 && e.facing<4 && finite(e.age) && finite(e.duration)
      && e.age>=0 && e.duration>0 && e.age<e.duration && own(weaponProfiles,e.weaponType);
  }
  function events(s,paint) {
    const list=s?.combatFeedback?.events;
    if(!Array.isArray(list))return;
    for(let i=Math.max(0,list.length-MAX_EVENTS);i<list.length;i++) if(activeEvent(list[i]))paint(list[i]);
  }
  function saved(c,alpha,paint) {
    c.save();
    try { c.globalAlpha=alpha; c.lineCap="round"; c.lineJoin="round"; paint(); }
    finally { c.restore(); }
  }
  function zone(c,e) {
    const id=e.skillId, radius=skillProfiles[id].radius;
    if(!radius)return;
    const p=e.age/e.duration, center=id==="sanctuary"?e.source:e.target;
    if(id==="naga_trap") { coil(c,center.x,center.y,radius,p); return; }
    const green=id==="sanctuary", color=green?"#b4e0a8":"#bea2e9", light=green?"#f2df9f":"#b0ebed";
    c.fillStyle=green?"#8abf9620":"#bc98df18"; c.beginPath(); c.arc(center.x,center.y,radius,0,TAU); c.fill();
    circle(c,center.x,center.y,radius,color,1.5);
    c.setLineDash([4,7]); circle(c,center.x,center.y,radius-5,light,1); c.setLineDash([]);
    for(let i=0;i<8;i++) {
      const a=i*TAU/8, x=center.x+Math.cos(a)*radius*.68, y=center.y+Math.sin(a)*radius*.68;
      if(id==="lotus_storm")lotus(c,x,y-5,9+2*Math.sin(p*Math.PI),color,"#ffeac1");
      else if(green)glyph(c,x,y,7,color,light);
      else { c.save(); c.translate(x,y); c.rotate(a+Math.PI/2); arrow(c,0,0,color,light,.55); c.restore(); }
    }
    circle(c,center.x,center.y,radius*.32,light,1);
  }
  function drawGround(c,s) {
    events(s,e=>{if(e.kind==="skill"&&own(skillProfiles,e.skillId)&&skillProfiles[e.skillId].radius)
      saved(c,(1-e.age/e.duration)*.8,()=>zone(c,e));});
    const cs=s?.classCombat;
    if(!cs)return;
    const traps=Array.isArray(cs.traps)?cs.traps:[];
    for(let i=0;i<Math.min(8,traps.length);i++){
      const t=traps[i]; if(t?.id!=="naga_trap"||!point(t)||!finite(t.remaining)||t.remaining<=0)continue;
      saved(c,Math.min(1,t.remaining/.5)*.75,()=>coil(c,t.x,t.y,D.skills.naga_trap.radius,t.remaining*.35));
    }
    if(!point(s.player))return;
    for(const id of ["ward_script","shield_counter","garuda_combo"]){
      const b=own(cs.buffs,id)?cs.buffs[id]:null;
      if(!finite(b?.remaining)||b.remaining<=0)continue;
      saved(c,Math.min(1,b.remaining/.5)*.55,()=>{
        const col=id==="garuda_combo"?"#efbf72":"#a8dba4";
        c.strokeStyle=col; c.lineWidth=1.2; c.beginPath(); c.ellipse(s.player.x,s.player.y+1,19,7,0,0,TAU); c.stroke();
        for(let i=0;i<4;i++){const a=i*TAU/4; diamond(c,s.player.x+Math.cos(a)*19,s.player.y+1+Math.sin(a)*7,2.3,"#f7dc9a");}
      });
    }
  }
  function weapon(c,e,large=false) {
    const q=weaponProfiles[e.weaponType], p=e.age/e.duration;
    const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;
    const ranged=["staff","orb","book","bow","magic_bow"].includes(e.weaponType);
    c.translate(e.source.x,e.source.y-17);
    c.rotate(ranged&&(dx||dy)?Math.atan2(dy,dx):angle(e.facing));
    const travel=clamp(p*1.35,0,1), reach=Math.min(250,Math.hypot(dx,dy));
    const x=15+Math.max(0,reach-15)*travel;
    switch(e.weaponType){
      case "training":line(c,q.color,2,[[12,-7],[27,5]]);break;
      case "sword":crescent(c,large?42:31,0,q.color,q.light,p);break;
      case "dual_sword":
        c.save(); c.rotate(-.35); crescent(c,large?39:28,-7,q.color,q.light,p); c.restore();
        c.save(); c.rotate(.35); crescent(c,large?39:28,7,q.color,q.light,p); c.restore();break;
      case "sword_shield":shield(c,17,-4,large?18:12,q.color,q.light); crescent(c,large?35:26,5,q.color,q.light,p);break;
      case "staff":
        line(c,q.color,2,[[Math.max(5,x-27),0],[x,0]]); lotus(c,x,0,large?14:8,q.color,q.light); break;
      case "orb":
        stroke(c,q.color,2,()=>{c.moveTo(Math.max(5,x-35),0);c.quadraticCurveTo(x-18,-12,x,0);});
        circle(c,x,0,large?12:6,q.light,1.5); disc(c,x,0,large?7:3.5,q.color);circle(c,x,0,large?16:10,q.color,.7);break;
      case "book":
        line(c,q.color,1.3,[[Math.max(6,x-32),-5],[x-5,0],[Math.max(6,x-32),5]]);glyph(c,x,0,large?15:9,q.color,q.light);break;
      case "knuckle":
        line(c,q.color,3,[[10,-3],[25,0]]); spark(c,large?35:28,0,large?13:8,q.light);
        line(c,q.color,1.2,[[20,-9],[25,-6]]);line(c,q.color,1.2,[[20,9],[25,6]]);break;
      case "dagger":
        line(c,q.color,2.6,[[9,3],[large?47:34,-2]]);line(c,q.light,1,[[13,1],[large?47:34,-2],[large?35:25,-5]]);break;
      case "claw":
        for(let i=-1;i<=1;i++)stroke(c,i? q.color:q.light,i?2:2.6,()=>{c.moveTo(12,i*7-9);c.quadraticCurveTo(29,i*7-3,large?46:36,i*7+8);});break;
      case "bow":arrow(c,x,0,q.color,q.light,large?1.35:1);break;
      case "magic_bow":
        arrow(c,x,0,q.color,q.light,large?1.25:1);
        diamond(c,x-12,0,large?10:7,q.light);for(let i=0;i<3;i++)disc(c,x-19-i*8,(i%2?1:-1)*5,1.6,q.color);break;
    }
  }
  function signature(c,e) {
    const id=e.skillId,p=e.age/e.duration;
    if(["lotus_storm","sanctuary","arcane_volley","naga_trap"].includes(id)) {
      const pos=id==="sanctuary"?e.source:e.target;
      if(id==="lotus_storm")lotus(c,pos.x,pos.y-20,22,"#dab0e6","#ffecbd");
      else if(id==="sanctuary")glyph(c,pos.x,pos.y-20,24,"#a5d7a5","#ffe5a2");
      else if(id==="arcane_volley")for(let i=-1;i<=1;i++){
        c.save(); c.translate(pos.x+i*19,pos.y-26-Math.abs(i)*9); c.rotate(Math.PI/2+.15*i); arrow(c,0,0,"#bd9ce5","#b1eee6",1);c.restore();
      }
      else {c.save();c.translate(pos.x,pos.y-5);line(c,"#b3e09b",2,[[0,0],[0,-22],[7,-27],[12,-23]]);diamond(c,12,-23,3,"#ffe5a2");c.restore();}
      return;
    }
    if(id==="ward_script") {
      glyph(c,e.source.x,e.source.y-22,25,"#a7dfa8","#f8df9a");
      c.strokeStyle="#c5ecae"; c.lineWidth=1; c.beginPath();c.ellipse(e.source.x,e.source.y-23,21,31,0,0,TAU);c.stroke();return;
    }
    const type={arun_slash:"sword",lotus_bolt:"staff",quick_stab:"dagger",aimed_shot:"bow",royal_flurry:"dual_sword",shield_counter:"sword_shield",orb_burst:"orb",garuda_combo:"knuckle",moon_venom:"dagger",tiger_rend:"claw"}[id];
    if(!type)return;
    weapon(c,{...e,weaponType:type},true);
    const q=weaponProfiles[type];
    if(id==="arun_slash")for(let i=-2;i<=2;i++) { const a=i*.36;line(c,"#ffe5a4",1.4,[[Math.cos(a)*46,Math.sin(a)*46],[Math.cos(a)*53,Math.sin(a)*53]]); }
    else if(id==="lotus_bolt") {diamond(c,10,0,12,q.light);circle(c,10,0,17,q.color);}
    else if(id==="quick_stab")line(c,"#eee2ff",1,[[13,5],[39,5]]);
    else if(id==="aimed_shot"){const d=Math.min(250,Math.hypot(e.target.x-e.source.x,e.target.y-e.source.y));circle(c,d,0,12,q.light,1);line(c,q.color,1,[[d-18,0],[d-9,0]]);line(c,q.color,1,[[d+9,0],[d+18,0]]);}
    else if(id==="royal_flurry"){c.save();c.rotate(-.15);crescent(c,47,0,"#f5e0aa","#fff9dd",p);c.restore();}
    else if(id==="shield_counter")spark(c,37,-13,10,"#fff2c1");
    else if(id==="orb_burst")for(let i=-1;i<=1;i++)line(c,"#b0ecf2",1.5,[[13,i*6],[24,i*10],[35,i*4],[46,i*10]]);
    else if(id==="garuda_combo"){spark(c,23,-16,11,q.color);line(c,q.light,2,[[9,-16],[20,-16]]);}
    else if(id==="moon_venom"){line(c,"#a9d894",2,[[30,0],[37,7],[42,2]]);disc(c,43,2,3,"#bee3a0");}
    else if(id==="tiger_rend"){for(let i=0;i<3;i++)line(c,"#eea0a0",1,[[21+i*8,-18],[15+i*8,18]]);}
  }
  function critical(c,x,y,p) {
    const radius=22+p*14, reach=29+p*8, half=5.8*(1-p*.4);
    // Tapered crossed cuts have a solid silhouette over the monster sprite.
    for(const a of [-Math.PI/4,Math.PI/4]) {
      const cos=Math.cos(a),sin=Math.sin(a);
      for(const [length,width,color] of [[reach,half,"#e34c43"],[reach*.88,half*.38,"#fff1b0"]]) {
        c.fillStyle=color;c.beginPath();
        [[-length,0],[0,-width],[length,0],[0,width]].forEach(([dx,dy],i)=>{
          const px=x+dx*cos-dy*sin,py=y+dx*sin+dy*cos;
          if(i)c.lineTo(px,py);else c.moveTo(px,py);
        });
        c.closePath();c.fill();
      }
    }
    circle(c,x,y,radius,"#ffcb68",2.3);
    circle(c,x,y,radius*.79,"#e34c43",1.2);
    for(let i=0;i<8;i++) {
      const a=i*TAU/8,inner=radius+3,outer=inner+5+p*3;
      line(c,i%2?"#fff1b0":"#ef7350",1.8,[[x+Math.cos(a)*inner,y+Math.sin(a)*inner],[x+Math.cos(a)*outer,y+Math.sin(a)*outer]]);
    }
    disc(c,x,y,2.5*(1-p*.5),"#fff1b0");
  }
  function impact(c,e) {
    const p=e.age/e.duration, q=weaponProfiles[e.weaponType], crit=e.result==="crit"&&!e.magic;
    const x=e.target.x,y=e.target.y-16,r=8+p*9;
    const color=e.phase==="dot"?(e.skillId==="moon_venom"?"#bde29e":"#ef9b9b"):q.light;
    if(e.phase==="trap") {coil(c,x,y,15+p*8,p);return;}
    if(crit){critical(c,x,y,p);return;}
    for(let i=0;i<5;i++) {
      const a=i*TAU/5+.2;
      line(c,color,1.5,[[x+Math.cos(a)*r*.48,y+Math.sin(a)*r*.48],[x+Math.cos(a)*r,y+Math.sin(a)*r]]);
    }
    if(e.magic)circle(c,x,y,r*.7,q.color,1);
  }
  function persistentFront(c,s) {
    const cs=s?.classCombat, player=s?.player;
    if(cs&&point(player)) {
      for(const id of ["ward_script","shield_counter","garuda_combo"]) {
        const b=own(cs.buffs,id)?cs.buffs[id]:null;if(!finite(b?.remaining)||b.remaining<=0)continue;
        saved(c,Math.min(1,b.remaining/.5)*.7,()=>{
          if(id==="shield_counter")shield(c,player.x+15,player.y-19,13,"#d8be78","#eaf3cb");
          else if(id==="ward_script"){glyph(c,player.x,player.y-22,21,"#b0d6a0","#e8d694");}
          else {for(const side of [-1,1]){diamond(c,player.x+side*16,player.y-18,5,"#f6c979",1.5);line(c,"#ffe6ae",1,[[player.x+side*13,player.y-10],[player.x+side*17,player.y-14]]);}}
        });
      }
      if(finite(cs.orbTimer)&&cs.orbTimer>0&&finite(cs.orbCharges)) {
        const count=clamp(Math.floor(cs.orbCharges),0,3);
        saved(c,Math.min(1,cs.orbTimer/.5)*.85,()=>{for(let i=0;i<count;i++){
          const a=-Math.PI/2+(i-1)*.85+Math.sin(cs.orbTimer)*.08;
          const x=player.x+Math.cos(a)*23,y=player.y-27+Math.sin(a)*15;
          disc(c,x,y,3.5,"#8ad9e6");circle(c,x,y,5.5,"#efdb96",1);disc(c,x-1,y-1,1.2,"#edfaff");
        }});
      }
    }
    const monsters=Array.isArray(s?.monsters)?s.monsters:[];
    for(let i=0;i<Math.min(monsters.length,64);i++){
      const m=monsters[i];if(!point(m)||m.dead||!(m.hp>0)||!Array.isArray(m.classDots))continue;
      for(let j=0;j<Math.min(m.classDots.length,2);j++){
        const d=m.classDots[j];if(!["moon_venom","tiger_rend"].includes(d?.id)||!finite(d.remaining)||d.remaining<=0)continue;
        saved(c,Math.min(1,d.remaining/.5)*.65,()=>{
          const poison=d.id==="moon_venom",color=poison?"#acd793":"#e19194";
          for(let k=0;k<3;k++){
            const x=m.x+(k-1)*7,y=m.y-23-(Math.sin((d.remaining%TAU)*3+k)*.5+.5)*7;
            if(poison){disc(c,x,y,2,color);circle(c,x,y,3.3,color,.7);}
            else line(c,color,1.8,[[x+2,y-3],[x-1,y+5]]);
          }
        });
      }
    }
  }
  function drawFront(c,s) {
    persistentFront(c,s);
    events(s,e=>{
      if(e.kind==="impact"&&!["hit","crit"].includes(e.result))return;
      if(e.kind==="skill"&&!own(skillProfiles,e.skillId))return;
      const alpha=e.kind==="impact"&&e.result==="crit"&&!e.magic
        ? .96*Math.pow(1-e.age/e.duration,.65)
        : Math.sin(Math.PI*(.15+.85*(1-e.age/e.duration)))*.9;
      saved(c,alpha,()=>{
        if(e.kind==="impact")impact(c,e);
        else if(e.kind==="skill")signature(c,e);
        else weapon(c,e);
      });
    });
  }
  const api=Object.freeze({drawGround,drawFront,weaponProfiles,skillProfiles});
  if(typeof module==="object")module.exports=api;
  else root.BCCombatEffects=api;
})(typeof window==="object"?window:globalThis);
