/* Original luminous fantasy brushwork: tapered light, transparent edges and compact cores. */
(function(root){
  "use strict";
  const TAU=Math.PI*2, finite=Number.isFinite;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const xy=(x,y)=>finite(x)&&finite(y)&&Math.abs(x)<=20000&&Math.abs(y)<=20000;
  const radius=r=>finite(r)&&r>0;
  function rgba(color,alpha){
    const h=typeof color==="string"?color.replace(/^#/,""):"";
    const value=/^[0-9a-f]{3}$/i.test(h)?h.split("").map(x=>x+x).join(""):h;
    if(!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))return `rgba(145,205,235,${clamp(alpha,0,1)})`;
    const a=value.length===8?parseInt(value.slice(6),16)/255:1;
    return `rgba(${parseInt(value.slice(0,2),16)},${parseInt(value.slice(2,4),16)},${parseInt(value.slice(4,6),16)},${clamp(alpha*a,0,1)})`;
  }
  function linear(c,a,b,color,light){
    if(typeof c.createLinearGradient!=="function")return color;
    const g=c.createLinearGradient(a[0],a[1],b[0],b[1]);
    g.addColorStop(0,rgba(color,0));g.addColorStop(.22,rgba(color,.44));
    g.addColorStop(.68,rgba(color,.95));g.addColorStop(.88,rgba(light||color,1));g.addColorStop(1,rgba(light||color,.08));return g;
  }
  function withSaved(c,alpha,paint){
    if(!finite(alpha)||alpha<=0)return;
    c.save();
    try{c.globalAlpha=(finite(c.globalAlpha)?c.globalAlpha:1)*clamp(alpha,0,1);c.lineCap="round";c.lineJoin="round";paint();}
    finally{c.restore();}
  }
  function polygon(c,points,color){
    if(!Array.isArray(points)||points.length<3)return;
    const list=points.slice(0,40);if(!list.every(p=>p&&xy(p[0],p[1])))return;
    c.fillStyle=color;c.beginPath();list.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  }
  function stroke(c,points,color,width=1){
    if(!Array.isArray(points)||points.length<2||!radius(width))return;
    const list=points.slice(0,40);if(!list.every(p=>p&&xy(p[0],p[1])))return;
    c.strokeStyle=color;c.lineWidth=Math.min(30,width);c.beginPath();list.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  }
  function ribbon(c,points,width,color,core){
    if(!Array.isArray(points)||points.length<2||!radius(width))return;
    let list=points.slice(0,16);if(!list.every(p=>p&&xy(p[0],p[1])))return;
    if(list.length===2)list=[list[0],[(list[0][0]+list[1][0])/2,(list[0][1]+list[1][1])/2],list[1]];
    const shape=w=>{
      const a=[],b=[];
      list.forEach(([x,y],i)=>{
        const prev=list[Math.max(0,i-1)],next=list[Math.min(list.length-1,i+1)];
        const dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1;
        const taper=(.035+Math.pow(Math.max(0,Math.sin(Math.PI*i/(list.length-1))),.65)*.965)*w/2;
        a.push([x-dy/length*taper,y+dx/length*taper]);b.push([x+dy/length*taper,y-dx/length*taper]);
      });return a.concat(b.reverse());
    };
    const w=Math.min(40,width),head=list.at(-1),tail=list[0];
    polygon(c,shape(w),linear(c,tail,head,color,core));
    if(core)polygon(c,shape(w*.24),typeof c.createLinearGradient==="function"?linear(c,tail,head,core,core):core);
  }
  function arcRibbon(c,x,y,rx,ry,start,end,width,color,core){
    if(!xy(x,y)||!radius(rx)||!radius(ry)||!radius(width)||!finite(start)||!finite(end))return;
    const sweep=clamp(end-start,-TAU,TAU);
    rx=Math.min(512,rx);ry=Math.min(512,ry);start%=TAU;end=start+sweep;
    const points=[];for(let i=0;i<=12;i++){const a=start+(end-start)*i/12;points.push([x+Math.cos(a)*rx,y+Math.sin(a)*ry]);}
    ribbon(c,points,width,color,core);
  }
  function disc(c,x,y,r,color){
    if(!xy(x,y)||!radius(r))return;c.fillStyle=color;c.beginPath();c.arc(x,y,Math.min(r,512),0,TAU);c.fill();
  }
  function aura(c,x,y,rx,ry,color,alpha=.3){
    if(!xy(x,y)||!radius(rx)||!radius(ry)||!finite(alpha)||alpha<=0)return;
    rx=Math.min(160,rx);ry=Math.min(160,ry);
    withSaved(c,alpha,()=>{
      if(typeof c.createRadialGradient==="function"&&typeof c.scale==="function"){
        c.translate(x,y);c.scale(rx,ry);
        const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(color,.8));g.addColorStop(.32,rgba(color,.5));g.addColorStop(.68,rgba(color,.13));g.addColorStop(1,rgba(color,0));
        c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,TAU);c.fill();
      }else{c.fillStyle=rgba(color,.2);c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
    });
  }
  function glowDot(c,x,y,r,color,core){
    if(!xy(x,y)||!radius(r))return;r=Math.min(20,r);
    aura(c,x,y,r*3.3,r*3.3,color,.6);
    if(typeof c.createRadialGradient==="function"){
      const g=c.createRadialGradient(x-r*.15,y-r*.15,0,x,y,r);
      g.addColorStop(0,rgba(core||color,1));g.addColorStop(.24,rgba(core||color,.98));g.addColorStop(.57,rgba(color,.9));g.addColorStop(1,rgba(color,0));disc(c,x,y,r,g);
    }else{disc(c,x,y,r,color);if(core)disc(c,x-r*.2,y-r*.2,r*.32,core);}
  }
  function spark(c,x,y,r,color,core,rotation=0){
    if(!xy(x,y)||!radius(r)||!finite(rotation))return;r=Math.min(80,r);
    const shape=scale=>Array.from({length:8},(_,i)=>{const a=rotation+i*TAU/8,d=(i%2?.085:1)*r*scale;return[x+Math.cos(a)*d,y+Math.sin(a)*d];});
    aura(c,x,y,r*1.1,r*.85,color,.22);
    polygon(c,shape(1),linear(c,[x-r,y],[x+r,y],color,core));if(core)polygon(c,shape(.62),core);
  }
  function rays(c,x,y,p,count,color,light,reach=24){
    if(!xy(x,y)||!finite(p)||p<0||p>=1||!finite(count)||!radius(reach))return;
    count=clamp(Math.floor(count),0,6);reach=Math.min(120,reach);
    withSaved(c,Math.pow(1-p,.7),()=>{for(let i=0;i<count;i++){
      const a=i*2.39996-.55,near=reach*(.12+.45*p),far=reach*(.4+.75*p),dx=Math.cos(a),dy=Math.sin(a);
      ribbon(c,[[x+dx*near,y+dy*near],[x+dx*(near+far)*.5,y+dy*(near+far)*.5],[x+dx*far,y+dy*far]],Math.max(.6,2.5*(1-p)),color,light);
    }});
  }
  function petal(c,x,y,r,angle,color,core){
    if(!xy(x,y)||!radius(r)||!finite(angle))return;r=Math.min(128,r);
    withSaved(c,1,()=>{
      c.translate(x,y);c.rotate(angle);c.fillStyle=linear(c,[0,1],[0,-r],color,core);c.beginPath();c.moveTo(0,0);
      c.quadraticCurveTo(-r*.6,-r*.64,0,-r);c.quadraticCurveTo(r*.6,-r*.64,0,0);c.closePath();c.fill();
      if(core)ribbon(c,[[0,-r*.08],[-r*.05,-r*.52],[0,-r*.85]],r*.1,core,core);
    });
  }
  function lotus(c,x,y,r,color,core,open=1){
    if(!xy(x,y)||!radius(r)||!finite(open))return;
    const spread=.35+.35*clamp(open,0,1);
    for(let i=-2;i<=2;i++)petal(c,x,y,r*(1-Math.abs(i)*.1),i*spread,color,core);
    glowDot(c,x,y-r*.16,Math.max(1,r*.1),color,core);
  }
  function glyph(c,x,y,r,color,core,p=0){
    if(!xy(x,y)||!radius(r)||!finite(p))return;r=Math.min(128,r);
    withSaved(c,.12,()=>polygon(c,[[x,y-r],[x+r*.7,y],[x,y+r],[x-r*.7,y]],color));
    stroke(c,[[x-r*.6,y],[x,y-r*.9],[x+r*.6,y],[x,y+r*.9],[x-r*.6,y]],color,1.4);
    ribbon(c,[[x-r*.18,y+r*.38],[x+r*.17,y+r*.18],[x-r*.13,y-r*.12],[x+r*.14,y-r*.38]],r*.1,color,core);
    for(let i=0;i<4;i++){const a=-Math.PI/2+i*Math.PI/2;spark(c,x+Math.cos(a)*r,y+Math.sin(a)*r,2.2,color,core,p*.3);}
  }
  function halo(c,x,y,rx,ry,color,width=1){
    if(!xy(x,y)||!radius(rx)||!radius(ry)||!radius(width))return;
    c.strokeStyle=color;c.lineWidth=Math.min(20,width);c.beginPath();c.ellipse(x,y,Math.min(512,rx),Math.min(512,ry),0,0,TAU);c.stroke();
  }
  function motes(c,x,y,p,count,color,core,seed=0,reach=18){
    if(!xy(x,y)||!finite(p)||!finite(count)||!finite(seed)||!radius(reach))return;
    p=clamp(p,0,1);count=clamp(Math.floor(count),0,10);seed%=997;reach=Math.min(150,reach);
    withSaved(c,Math.pow(1-p,1.4),()=>{
      for(let i=0;i<count;i++){
        const a=i*2.39996+Math.sin(seed+i)*.5,d=reach*(.25+.75*p)*( .65+(i%3)*.17);
        glowDot(c,x+Math.cos(a)*d,y+Math.sin(a)*d-p*6,.7+(i%3)*.4,color,core);
      }
    });
  }
  function progress(e){return e&&finite(e.age)&&finite(e.duration)&&e.duration>0?clamp(e.age/e.duration,0,1):1;}
  function envelope(p){if(!finite(p)||p<0||p>=1)return 0;return p<.12?.55+.45*p/.12:Math.pow((1-p)/.88,1.2);}
  const api=Object.freeze({clamp,withSaved,polygon,stroke,ribbon,arcRibbon,aura,rays,glowDot,spark,petal,lotus,glyph,halo,motes,progress,envelope});
  if(typeof module==="object")module.exports=api;else root.BCVFXPainter=api;
})(typeof window==="object"?window:globalThis);
