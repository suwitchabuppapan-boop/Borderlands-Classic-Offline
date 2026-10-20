/* Original pixel lettering for actual combat outcomes. No image/font dependency. */
(function (root) {
  'use strict';
  // Five by seven ink masks, drawn on an integer CSS-pixel grid. A one-pixel
  // dark contour stays readable over both the sunlit meadow and the cavern.
  const glyphs=Object.freeze({
    '0':'01110/10001/10011/10101/11001/10001/01110',
    '1':'00100/01100/00100/00100/00100/00100/01110',
    '2':'01110/10001/00001/00010/00100/01000/11111',
    '3':'11110/00001/00001/01110/00001/00001/11110',
    '4':'00010/00110/01010/10010/11111/00010/00010',
    '5':'11111/10000/10000/11110/00001/00001/11110',
    '6':'01110/10000/10000/11110/10001/10001/01110',
    '7':'11111/00001/00010/00100/01000/01000/01000',
    '8':'01110/10001/10001/01110/10001/10001/01110',
    '9':'01110/10001/10001/01111/00001/00001/01110',
    'C':'01111/10000/10000/10000/10000/10000/01111',
    'M':'10001/11011/10101/10101/10001/10001/10001',
    'L':'10000/10000/10000/10000/10000/10000/11111',
    'r':'00000/00000/10110/11001/10000/10000/10000',
    'i':'00100/00000/01100/00100/00100/00100/01110',
    't':'00100/00100/11111/00100/00100/00100/00011',
    'c':'00000/00000/01110/10000/10000/10000/01110',
    'a':'00000/00000/01110/00001/01111/10001/01111',
    'l':'01100/00100/00100/00100/00100/00100/01110',
    's':'00000/00000/01111/10000/01110/00001/11110',
    'u':'00000/00000/10001/10001/10001/10011/01101',
    'k':'10000/10000/10010/10100/11000/10100/10010',
    'y':'00000/00000/10001/10001/01111/00001/01110',
    '!':'00100/00100/00100/00100/00100/00000/00100',
  });
  const masks=Object.freeze(Object.fromEntries(Object.entries(glyphs).map(([key,mask])=>[key,
    Object.freeze(mask.split('/').flatMap((row,y)=>Array.from(row,(ink,x)=>ink==='1'?Object.freeze([x,y]):null).filter(Boolean)))
  ])));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function lettering(c,text,cell,y,ink,shade,slant=false) {
    const left=-Math.round((text.length*6-1)*cell/2);
    // All contours precede all ink so adjacent bitmap pixels never cover ink.
    c.fillStyle='#19252e';
    for(let i=0;i<text.length;i++)for(const [x,row] of masks[text[i]]||[]){
      const skew=slant?Math.floor((6-row)/3):0;
      c.fillRect(left+i*6*cell+x*cell+skew-1,y+row*cell-1,cell+2,cell+2);
    }
    for(let i=0;i<text.length;i++)for(const [x,row] of masks[text[i]]||[]){
      const skew=slant?Math.floor((6-row)/3):0;
      c.fillStyle=row<4?ink:shade;
      c.fillRect(left+i*6*cell+x*cell+skew,y+row*cell,cell,cell);
    }
  }
  function star(c,rx,ry,fill,offsetX=0,offsetY=0) {
    // Deliberately uneven rays give the short impact flash a classic silhouette.
    const points=[[1,0],[.44,.2],[.78,.7],[.24,.49],[.14,1],[-.1,.48],[-.62,.82],[-.4,.3],[-1,.13],[-.48,-.12],[-.81,-.67],[-.26,-.43],[-.09,-1],[.16,-.45],[.74,-.85],[.42,-.26]];
    c.fillStyle=fill;c.beginPath();
    points.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](Math.round(x*rx+offsetX),Math.round(y*ry+offsetY)));
    c.closePath();c.fill();
  }
  function valid(e) {
    if(!e||!['damage','miss','lucky'].includes(e.kind)||!Number.isFinite(e.x)||!Number.isFinite(e.y)
      ||Math.abs(e.x)>100000||Math.abs(e.y)>100000||!Number.isFinite(e.ttl)||e.ttl<=0||e.ttl>1
      ||!['monster','player'].includes(e.target))return false;
    if(e.kind==='damage'&&(!Number.isSafeInteger(e.amount)||e.amount<0||e.amount>999999999))return false;
    return true;
  }
  const isCritical=e=>e.kind==='damage'&&e.critical===true&&e.magic!==true;
  function placement(e,options) {
    const age=1-e.ttl;
    const lane=Number.isFinite(options.lane)?clamp(Math.floor(options.lane),0,39):0;
    const offset=Number.isFinite(options.offsetY)?clamp(options.offsetY,0,4096):0;
    const snapX=Number.isFinite(options.snapX)?clamp(options.snapX,-.5,.5):0;
    const snapY=Number.isFinite(options.snapY)?clamp(options.snapY,-.5,.5):0;
    const rise=Math.round(age*30+Math.sin(Math.min(age/.3,1)*Math.PI)*7);
    return {x:snapX,y:-rise-lane*66-offset+snapY};
  }
  function bounds(e,options={}) {
    if(!valid(e))return null;
    const p=placement(e,options),critical=isCritical(e),cell=critical?3:e.kind==='lucky'?1:2;
    const text=e.kind==='damage'?String(e.amount):e.kind==='miss'?'Miss':'Lucky!!';
    const width=(text.length*6-1)*cell+2;
    // Reserve the full critical flash footprint throughout its lifetime so
    // neighboring numbers never jump down when the short star fades away.
    const half=critical?Math.max(Math.ceil(width/2),43):Math.ceil(width/2);
    return {left:p.x-half,right:p.x+half,top:p.y+(critical?-41:e.kind==='lucky'?-11:-15),bottom:p.y+(critical?21:e.kind==='lucky'?-2:1)};
  }
  function draw(c,e,options={}) {
    if(!valid(e))return false;
    const age=1-e.ttl,critical=isCritical(e);
    const scale=Number.isFinite(options.scale)&&options.scale>0?clamp(options.scale,.1,20):1;
    const p=placement(e,options);
    c.save();
    try {
      c.globalAlpha*=Math.min(1,e.ttl*3);
      c.translate(e.x,e.y);c.scale(1/scale,1/scale);c.translate(p.x,p.y);
      if(e.kind==='damage'){
        const incoming=e.target==='player',cell=critical?3:2;
        if(critical&&age<.34){
          const flash=1-age/.34;
          c.save();
          try {
            c.globalAlpha*=flash;
            star(c,30+12*(1-flash),22+8*(1-flash),'#d45b3c',0,-10);
            star(c,25+9*(1-flash),18+6*(1-flash),'#ffc978',0,-11);
            star(c,17+5*(1-flash),12+4*(1-flash),'#fff8df',1,-11);
          } finally {c.restore();}
        }
        const ink=incoming?'#fff0ea':e.magic?'#f2f5ff':'#ffffff';
        const shade=incoming?'#fa8d83':e.magic?'#a9c7ef':critical?'#ffeab2':'#dce4e3';
        lettering(c,String(e.amount),cell,-7*cell,ink,shade);
        if(critical)lettering(c,'Critical!!',1,-7*cell-12,'#ffffff','#c9ebd1',true);
      } else if(e.kind==='miss')lettering(c,'Miss',2,-14,'#ffffff','#dce4e3');
      else lettering(c,'Lucky!!',1,-10,'#fff6ce','#ef9869');
      return true;
    } finally {c.restore();}
  }
  const api=Object.freeze({draw,bounds});
  if(typeof module==='object')module.exports=api;
  else root.BCDamageText=api;
})(typeof window==='object'?window:globalThis);
