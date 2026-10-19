/* Original class magic and martial silhouettes, painted from immutable combat snapshots. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const P = typeof module === "object" ? require("./vfx-painter.js") : root.BCVFXPainter;
  const W = typeof module === "object" ? require("./vfx-weapons.js") : root.BCWeaponVFX;
  const TAU = Math.PI * 2;
  const gold = "#d5a24e", ivory = "#fff0c6", brass = "#b88643";
  const violet = "#a982bf", lilac = "#e9d6eb", jade = "#77b49b", pale = "#d9eed3";
  const profiles = Object.freeze(Object.fromEntries([
    ["arun_slash", "Rising dha and crown rays"], ["lotus_bolt", "Petal comet and lotus bloom"],
    ["ward_script", "Layered scripture ward"], ["quick_stab", "Narrow violet flash thrust"],
    ["aimed_shot", "Ivory pinpoint arrow"], ["royal_flurry", "Three royal gold cuts"],
    ["shield_counter", "Brass shield and counter fan"], ["lotus_storm", "Falling petals and floral whorls"],
    ["orb_burst", "Jade crystal and three ribbons"], ["sanctuary", "Healing lotus footprint"],
    ["garuda_combo", "Twin vermillion fist blasts"], ["moon_venom", "Violet kris and poison petals"],
    ["tiger_rend", "Three crimson claw rakes"], ["naga_trap", "Decorated naga snare"],
    ["arcane_volley", "Three violet and cyan rain arrows"]
  ].map(([id,name]) => [id,Object.freeze({name,radius:D.skills[id].radius || 0})])));
  const owns = id => Object.prototype.hasOwnProperty.call(profiles,id);
  const point = v => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Math.abs(v.x)<=10000 && Math.abs(v.y)<=10000;
  function active(e) {
    return e && owns(e.skillId) && point(e.source) && point(e.target) &&
      Number.isInteger(e.facing) && e.facing>=0 && e.facing<4 &&
      Number.isFinite(e.age) && Number.isFinite(e.duration) && e.duration>0 && e.age>=0 && e.age<e.duration;
  }
  function saved(c, fn) { c.save(); try { fn(); } finally { c.restore(); } }
  function frame(c,e,fn) {
    const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;
    const a=dx || dy ? Math.atan2(dy,dx) : [Math.PI/2,0,-Math.PI/2,Math.PI][e.facing];
    saved(c,()=>{ c.translate(e.source.x,e.source.y-17);c.rotate(a);fn(Math.min(260,Math.hypot(dx,dy))); });
  }
  function groundFrame(c,e,fn) {
    const dx=e.target.x-e.source.x,dy=e.target.y-e.source.y;
    const a=dx || dy ? Math.atan2(dy,dx) : [Math.PI/2,0,-Math.PI/2,Math.PI][e.facing];
    saved(c,()=>{
      c.translate(e.source.x,e.source.y);c.rotate(a);c.translate(0,-17);
      fn(Math.min(260,Math.hypot(dx,dy)));
    });
  }
  function boundary(c,x,y,r,color) {
    P.withSaved(c,.27,()=>{c.strokeStyle=color;c.lineWidth=.8;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();});
  }
  function shard(c,x,y,r,a,color,core) {
    const ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;
    P.polygon(c,[[x+ux*r,y+uy*r],[x+vx*r*.32,y+vy*r*.32],
      [x-ux*r*.7,y-uy*r*.7],[x-vx*r*.32,y-vy*r*.32]],color);
    P.stroke(c,[[x-ux*r*.45,y-uy*r*.45],[x+ux*r*.75,y+uy*r*.75]],core,.8);
  }
  function dha(c,x,y,r,a,color,core,width=9) {
    saved(c,()=>{
      c.translate(x,y);c.rotate(a);c.fillStyle=color;c.beginPath();
      c.moveTo(-r*.63,r*.57);
      c.bezierCurveTo(r*.6,r*.5,r*1.08,-r*.25,r*.36,-r);
      c.bezierCurveTo(r*.82,-r*.18,r*.16,r*.25,-r*.63,r*.57);
      c.closePath();c.fill();
      P.ribbon(c,[[-r*.5,r*.48],[r*.12,r*.15],[r*.47,-r*.39],[r*.36,-r*.9]],width*.23,core,ivory);
    });
  }
  function arrow(c,x,y,length,color,core,width=2) {
    P.ribbon(c,[[x-length,y],[x-7,y],[x+3,y]],width,color,core);
    P.polygon(c,[[x+9,y],[x-2,y-4],[x,y],[x-2,y+4]],core);
    P.polygon(c,[[x-length+4,y],[x-length-2,y-4],[x-length+10,y-1]],color);
    P.polygon(c,[[x-length+4,y],[x-length-2,y+4],[x-length+10,y+1]],color);
  }
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
  function ground(c,e,p) {
    const id=e.skillId,tx=e.target.x,ty=e.target.y,sx=e.source.x,sy=e.source.y;
    const swell=.7+Math.sin(p*Math.PI)*.35;
    switch(id) {
      case "arun_slash":
        groundFrame(c,e,()=>{for(let i=0;i<3;i++)P.polygon(c,[[6+i*6,17],[19+i*8+12*p,14-i*3],[13+i*6,18]],"#c699493d");});
        break;
      case "lotus_bolt":
        P.withSaved(c,.32,()=>{P.lotus(c,tx,ty+1,13*swell,"#bb86b0",ivory,.4+p*.6);P.petal(c,sx-5,sy,6,p,"#c8a3c4",ivory);});
        break;
      case "ward_script":
        P.withSaved(c,.37,()=>{P.lotus(c,sx,sy+2,23*swell,"#b5be91",ivory,.35+p*.65);P.glyph(c,sx,sy-1,13+4*p,"#d1bf88",ivory,p);});
        break;
      case "quick_stab":
        groundFrame(c,e,d=>{for(let i=0;i<2;i++)P.polygon(c,[[7+i*8,17],[Math.min(65,d)+p*12,13+i*5],[18+i*8,18]],"#9773a544");});
        break;
      case "aimed_shot":
        groundFrame(c,e,()=>{for(let i=0;i<3;i++)P.stroke(c,[[i*5,14],[13+p*20+i*5,17],[i*5,20]],"#c5b68250",1);});
        break;
      case "royal_flurry":
        P.withSaved(c,.28,()=>{for(let i=0;i<3;i++)P.petal(c,tx+(i-1)*12,ty+2,10+i*2,p*.8+(i-1)*.7,gold,ivory);});
        break;
      case "shield_counter":
        groundFrame(c,e,()=>{P.polygon(c,[[3,18],[17+9*p,9],[34+7*p,17],[17+9*p,23]],"#ad843d43");P.stroke(c,[[6,18],[19,13],[29,17]],ivory,.9);});
        break;
      case "lotus_storm": {
        const r=profiles[id].radius;boundary(c,tx,ty,r,"#ac91b4");
        P.withSaved(c,.25,()=>{
          for(let i=0;i<8;i++) {
            const a=i*TAU/8+.1*p,rr=r*(.4+(i%2)*.25);
            P.petal(c,tx+Math.cos(a)*rr,ty+Math.sin(a)*rr,15*swell,a-p*.5,"#b59cbd",ivory);
          }
          P.lotus(c,tx,ty+3,24*swell,"#b699c2",ivory,.35+p*.65);
        });break;
      }
      case "orb_burst":
        P.withSaved(c,.34,()=>{for(let i=0;i<5;i++){const a=i*TAU/5;shard(c,tx+Math.cos(a)*(9+p*15),ty+Math.sin(a)*9,5+p*2,a,jade,ivory);}});
        break;
      case "sanctuary": {
        const r=profiles[id].radius;boundary(c,sx,sy,r,"#9db991");
        P.withSaved(c,.22,()=>{
          for(let i=0;i<8;i++) {
            const a=i*TAU/8,rr=r*(.43+.05*Math.sin(p*Math.PI));
            P.petal(c,sx+Math.cos(a)*rr,sy+Math.sin(a)*rr,27*swell,a+Math.PI/2,"#a6c49a",ivory);
          }
          P.lotus(c,sx,sy,32*swell,"#bfd0a4",ivory,.4+p*.6);
          for(let i=0;i<4;i++){const a=i*TAU/4+Math.PI/4;P.glyph(c,sx+Math.cos(a)*73,sy+Math.sin(a)*73,5+2*p,"#b8c59e",ivory,p);}
        });break;
      }
      case "garuda_combo":
        groundFrame(c,e,()=>{for(let side=-1;side<=1;side+=2)for(let i=0;i<3;i++)P.polygon(c,[[7,17],[19+i*5+10*p,17+side*(6+i*4)],[12,17+side*3]],"#c68b4d44");});
        break;
      case "moon_venom":
        P.withSaved(c,.34,()=>{for(let i=0;i<5;i++){const a=i*TAU/5+p*.4;P.petal(c,tx+Math.cos(a)*(10+p*9),ty+Math.sin(a)*8,4+2*p,a,violet,lilac);}});
        break;
      case "tiger_rend":
        groundFrame(c,e,d=>{for(let i=0;i<3;i++)P.polygon(c,[[d-20+i*3,12+i*4],[d+12+12*p,12+i*5],[d-8,14+i*4]],"#b7615a42");});
        break;
      case "naga_trap":
        boundary(c,tx,ty,profiles[id].radius,"#86ab85");
        P.withSaved(c,.75,()=>serpent(c,tx,ty,profiles[id].radius,p,false));
        P.withSaved(c,.24,()=>P.lotus(c,tx,ty+2,12+3*p,"#a6b78a",ivory,.4+p*.6));
        break;
      case "arcane_volley":
        boundary(c,tx,ty,profiles[id].radius,"#9997ba");
        P.withSaved(c,.32,()=>{for(let i=0;i<3;i++) {
          const x=tx+(i-1)*31,y=ty+(i===1?14:-9),r=8+6*p;
          P.polygon(c,[[x-r,y-3],[x,y+4],[x+r,y-3],[x,y+r*.8]],"#9a89b7");
          P.stroke(c,[[x-r*.8,y-4],[x,y],[x+r*.8,y-4]],"#b9d8d6",1);
        }});break;
    }
  }
  function front(c,e,p) {
    const id=e.skillId,tx=e.target.x,ty=e.target.y-17,sx=e.source.x,sy=e.source.y;
    const release=P.clamp((p-.04)/.5,0,1),crest=Math.sin(Math.PI*p);
    switch(id) {
      case "arun_slash":
        frame(c,e,d=>{
          dha(c,Math.min(d,42)*.55,8-20*p,34+crest*12,-.25-p*.7,gold,ivory);
          for(let i=0;i<5;i++) {
            const a=-1.2+i*.34,rr=26+14*release;
            P.polygon(c,[[12+Math.cos(a)*rr,-4+Math.sin(a)*rr],
              [12+Math.cos(a-.07)*(rr+10),-4+Math.sin(a-.07)*(rr+10)],
              [12+Math.cos(a+.07)*(rr+18),-4+Math.sin(a+.07)*(rr+18)]],i%2?ivory:gold);
          }
          P.motes(c,d,0,p,4,gold,ivory,e.id,16);
        });break;
      case "lotus_bolt":
        frame(c,e,d=>{
          const x=8+(d-8)*release;
          P.ribbon(c,[[Math.max(2,x-43),4],[x-18,2],[x,0]],6,"#b48eb4",ivory);
          for(let i=0;i<3;i++)P.petal(c,x-i*7,(i-1)*5,8-i,Math.PI+.18*(i-1),"#c7a0c5",ivory);
          if(p>.17)P.lotus(c,d,2,10+19*release,"#c59ebd",ivory,release);
        });break;
      case "ward_script":
        for(let i=0;i<3;i++) {
          const a=(i-1)*.65,x=sx+Math.sin(a)*(16+4*crest),y=sy-19-i*6-8*release;
          P.glyph(c,x,y,11+(i===1?4:0)+3*crest,"#d7c99c",ivory,p+i*.16);
          P.stroke(c,[[x-5,y-13],[x-2,y-16-5*p],[x+2,y-14],[x+5,y-18-5*p]],"#eadbb6",.9);
        }
        P.withSaved(c,.55,()=>P.lotus(c,sx,sy-2-9*p,23+9*crest,"#b9c4a0",ivory,.3+.7*release));
        P.motes(c,sx,sy-12,p,6,"#c7d3aa",ivory,e.id,23);
        break;
      case "quick_stab":
        frame(c,e,d=>{
          const tip=Math.min(76,d+13)*(.4+.6*release);
          P.polygon(c,[[5,2],[tip-14,-3],[tip+8,0],[tip-14,3]],violet);
          P.polygon(c,[[12,1],[tip-10,-.9],[tip+8,0]],lilac);
          for(let i=0;i<3;i++)shard(c,tip-13-i*9,6+i*2,5-i*.6,-.25,violet,lilac);
          P.spark(c,d,0,5+4*crest,violet,lilac,p*.6);
        });break;
      case "aimed_shot":
        frame(c,e,d=>{
          const x=10+(d-10)*release;
          P.ribbon(c,[[Math.max(0,x-70),0],[x-25,0],[x,0]],2.5,"#cabb8b",ivory);
          arrow(c,x,0,43,"#b9aa7a",ivory,2);
          if(p>.18){P.spark(c,d,0,5+7*crest,"#d6c994",ivory,Math.PI/4);P.stroke(c,[[d-7,-7],[d-3,-7],[d-3,-11]],ivory,1);}
        });break;
      case "royal_flurry":
        frame(c,e,d=>{
          for(let i=0;i<3;i++) {
            const t=P.clamp((p-i*.13)/.62,0,1),a=[-.9,.8,-.2][i]+t*.45;
            P.withSaved(c,.35+.6*Math.sin(Math.PI*t),()=>{
              dha(c,Math.min(d,47)*.58+(i-1)*4,(i-1)*9,27+12*Math.sin(t*Math.PI),a,gold,ivory,7);
              shard(c,Math.min(d,52)+i*2,-13+i*12,7+5*t,a,ivory,gold);
            });
          }
        });break;
      case "shield_counter":
        frame(c,e,()=>{
          const x=11+3*crest;
          P.polygon(c,[[x-7,-19],[x+10,-13],[x+12,5],[x+1,20],[x-10,6]],brass);
          P.polygon(c,[[x-4,-15],[x+7,-10],[x+8,4],[x+1,14],[x-7,4]],"#d1ad68");
          P.stroke(c,[[x+1,-12],[x+1,10]],ivory,1.4);
          P.polygon(c,[[x-4,-2],[x+1,-7],[x+6,-2],[x+1,5]],ivory);
          for(let i=0;i<5;i++) {
            const a=(i-2)*.24,l=17+26*release;
            P.polygon(c,[[x+13,0],[x+16+Math.cos(a)*l,Math.sin(a)*l-2],
              [x+18+Math.cos(a)*(l+9),Math.sin(a)*(l+9)],[x+16+Math.cos(a)*l,Math.sin(a)*l+2]],i%2?ivory:gold);
          }
        });break;
      case "lotus_storm":
        for(let i=0;i<8;i++) {
          const a=i*TAU/8+.16*p,rr=28+(i%3)*17,x=tx+Math.cos(a)*rr,y=ty+17+Math.sin(a)*rr;
          const drop=48*(1-release)+i%2*9;
          P.ribbon(c,[[x-4,y-drop-18],[x-2,y-drop-7],[x,y-drop]],1.3,"#bd9dbf","#f0dfce");
          P.petal(c,x,y-drop,9+5*crest,a+p*.7,"#b69bbf",ivory);
          if(p>.2&&i%2===0)P.arcRibbon(c,x,y-5-20*p,11+8*crest,7,-Math.PI*.8,Math.PI*.55,2,"#bca1c4",ivory);
        }
        P.lotus(c,tx,ty+15-10*p,19+11*crest,"#baa2c2",ivory,.25+release*.75);
        break;
      case "orb_burst":
        frame(c,e,d=>{
          const rr=9+31*release;
          for(let i=0;i<3;i++) {
            const a=i*TAU/3+p*.7;
            P.ribbon(c,[[Math.max(0,d-35),-3+i*3],[d-8+Math.cos(a)*rr*.5,Math.sin(a)*rr*.7],
              [d+Math.cos(a)*rr,Math.sin(a)*rr]],4,"#6baf9e",ivory);
          }
          for(let i=0;i<7;i++) {
            const a=i*TAU/7+p*.35;
            shard(c,d+Math.cos(a)*rr,Math.sin(a)*rr,7+5*crest,a,"#79bba6",ivory);
          }
          P.glowDot(c,d,0,7+4*crest,jade,ivory);
        });break;
      case "sanctuary":
        P.withSaved(c,.65,()=>{
          P.lotus(c,sx,sy-3-10*release,30+12*crest,"#b2c59c",ivory,.3+.7*release);
          for(let i=0;i<6;i++) {
            const a=i*TAU/6,x=sx+Math.cos(a)*56,y=sy+Math.sin(a)*38-8-24*release;
            P.petal(c,x,y,8+4*crest,-Math.PI/2+.2*Math.sin(a),"#b6ceaa",ivory);
            P.stroke(c,[[x,y+13],[x+2,y+7],[x,y+2]],"#d9e3bf",.8);
          }
          P.glyph(c,sx,sy-29-13*release,11+4*crest,"#c7d0a4",ivory,p);
        });break;
      case "garuda_combo":
        frame(c,e,d=>{
          for(let i=0;i<2;i++) {
            const t=P.clamp((p-i*.17)/.6,0,1),x=16+Math.min(d,48)*t,y=i===0?-10:12;
            P.ribbon(c,[[2,y+4],[x-11,y],[x+3,y]],8,"#b96842",gold);
            P.polygon(c,[[x-8,y-7],[x+4,y-10],[x+13,y-5],[x+15,y+5],[x+7,y+10],[x-7,y+6]],"#bc6845");
            for(let k=0;k<3;k++)P.polygon(c,[[x+k*5-3,y-9],[x+k*5+1,y-12],[x+k*5+5,y-6],[x+k*5+1,y-3]],gold);
            P.stroke(c,[[x+1,y-4],[x+8,y-3],[x+9,y+4]],ivory,1.4);
            for(let k=0;k<3;k++)P.polygon(c,[[x-4,y],[x-15-k*5,y+(i?1:-1)*(10+k*5)],[x-9,y+(i?1:-1)*3]],k%2?gold:"#cd8451");
          }
        });break;
      case "moon_venom":
        frame(c,e,d=>{
          const tip=Math.min(70,d+10)*(.5+.5*release);
          P.polygon(c,[[5,1],[tip*.42,-4],[tip*.58,1],[tip*.74,-4],[tip+5,0],
            [tip*.77,4],[tip*.6,1],[tip*.43,4]],violet);
          P.stroke(c,[[12,1],[tip*.43,-1],[tip*.6,2],[tip*.76,-1],[tip+4,0]],lilac,1.1);
          for(let i=0;i<5;i++){const a=i*TAU/5;P.petal(c,d+Math.cos(a)*(8+9*release),Math.sin(a)*12-8*p,4+crest*2,a,violet,"#d4c2d9");}
        });break;
      case "tiger_rend":
        frame(c,e,d=>{
          for(let i=0;i<3;i++) {
            const x=Math.min(d,51)+(i-1)*7,y=(i-1)*8,r=26+12*release;
            saved(c,()=>{
              c.translate(x,y);c.rotate(-.65+p*.22);
              P.polygon(c,[[-r*.7,-r*.7],[-r*.25,-r*.5],[r*.65,r*.5],[r*.85,r*.9],[r*.35,r*.64],[-r*.5,-r*.24]],"#b95551");
              P.polygon(c,[[-r*.55,-r*.55],[r*.48,r*.38],[r*.7,r*.7],[r*.27,r*.45]],"#ecc7a1");
            });
          }
        });break;
      case "naga_trap":
        P.withSaved(c,.6,()=>{
          serpent(c,tx,ty+14,profiles[id].radius,p,true);
          for(let i=0;i<3;i++)P.petal(c,tx+(i-1)*12,ty-3-11*p,5+crest*2,-Math.PI/2+(i-1)*.3,"#89ac84",ivory);
        });break;
      case "arcane_volley":
        for(let i=0;i<3;i++) {
          const t=P.clamp((p-i*.08)/.6,0,1),x=tx+(i-1)*31,y=ty+(i===1?14:-9)+17;
          const tipy=y-76*(1-t),tipx=x-20*(1-t);
          P.ribbon(c,[[tipx-15,tipy-53],[tipx-6,tipy-23],[tipx,tipy]],3.3,"#9b83bb","#c5e6e0");
          P.polygon(c,[[tipx+3,tipy+9],[tipx-5,tipy-4],[tipx,tipy-1],[tipx+4,tipy-6]],"#c0e0d9");
          P.polygon(c,[[tipx-11,tipy-36],[tipx-17,tipy-43],[tipx-10,tipy-42],[tipx-6,tipy-36]],violet);
          if(t>.35)P.spark(c,x,y-4,5+6*Math.sin(t*Math.PI),violet,"#c5e6df",Math.PI/4);
        }
        break;
    }
  }
  function drawGround(c,e) {
    if(!active(e))return;
    const p=P.progress(e);
    P.withSaved(c,1,()=>ground(c,e,p));
  }
  function drawFront(c,e) {
    if(!active(e))return;
    const p=P.progress(e);
    P.withSaved(c,1,()=>front(c,e,p));
  }
  const api=Object.freeze({drawGround,drawFront,profiles});
  if(typeof module === "object")module.exports=api;
  else root.BCSkillVFX=api;
})(typeof window === "object" ? window : globalThis);
