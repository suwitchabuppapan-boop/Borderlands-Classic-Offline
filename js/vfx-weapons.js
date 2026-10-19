/* Siam weapon gestures: immutable combat snapshots, painted in body space. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const P = typeof module === "object" ? require("./vfx-painter.js") : root.BCVFXPainter;
  const IVORY = "#fff3cf", WARM = "#edc684";
  const profiles = Object.freeze(Object.fromEntries([
    ["training", "Practice stroke", "#ccb68d", "#f4e9c8"],
    ["sword", "Dha crescent", "#e1ae50", "#fff0bc"],
    ["dual_sword", "Crossed royal cuts", "#e8bd65", "#fff2cd"],
    ["sword_shield", "Guardian glint", "#d6ae59", "#fff3cf"],
    ["staff", "Lotus comet", "#d7a0de", "#fff0c5"],
    ["orb", "Jade discharge", "#76d6b1", "#fff0c8"],
    ["book", "Scripture bolt", "#8fcf9a", "#f8df99"],
    ["knuckle", "Garuda sparks", "#efad60", "#fff0c7"],
    ["dagger", "Moon kris", "#b49bdf", "#f1e9ff"],
    ["claw", "Tiger rakes", "#dc7580", "#ffdfbd"],
    ["bow", "Forest arrow", "#c7aa75", "#fff5d9"],
    ["magic_bow", "Arcane arrow", "#b39ce4", "#a8eee2"]
  ].filter(([id]) => Object.prototype.hasOwnProperty.call(D.weaponTypes, id))
    .map(([id, name, color, light]) => [id, Object.freeze({ name, color, light })])));
  const ranged = new Set(["staff", "orb", "book", "bow", "magic_bow"]);
  const facingAngle = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const valid = e => e && Object.prototype.hasOwnProperty.call(profiles, e.weaponType)
    && finitePoint(e.source) && finitePoint(e.target) && Number.isInteger(e.facing)
    && e.facing >= 0 && e.facing < 4 && Number.isFinite(e.age) && e.age >= 0
    && Number.isFinite(e.duration) && e.duration > 0 && e.age < e.duration;

  function ribbon(c, points, width, q, alpha = 1) {
    P.withSaved(c, alpha * .19, () => P.ribbon(c, points, width * 1.9, q.color, q.color));
    P.withSaved(c, alpha, () => P.ribbon(c, points, width, q.color, IVORY));
  }
  function crescent(c, p, q, radius, offset, width, tilt = 0) {
    const start = -1.28 + p * .46 + tilt, end = .53 + p * 1.18 + tilt;
    P.withSaved(c, .18, () => P.arcRibbon(c, 3, offset, radius, radius * .87, start - .05, end + .06, width * 1.9, q.color, q.color));
    P.arcRibbon(c, 3, offset, radius, radius * .87, start, end, width, q.color, IVORY);
    const x = 3 + Math.cos(end) * radius, y = offset + Math.sin(end) * radius * .87;
    P.spark(c, x, y, width * .72, q.color, IVORY, end + .3);
  }
  function plate(c, x, y, size, q, p) {
    // A filled bronze plate catches a narrow moving ivory reflection.
    P.withSaved(c, .24, () => P.polygon(c, [[x-size*.9,y-size],[x+size*.85,y-size],[x+size,y+size*.05],[x,y+size*1.18],[x-size,y+size*.05]], q.color));
    P.polygon(c, [[x-size*.67,y-size*.83],[x+size*.67,y-size*.83],[x+size*.57,y+size*.26],[x,y+size*.9],[x-size*.57,y+size*.26]], "#b68c43");
    P.polygon(c, [[x-size*.49,y-size*.65],[x+size*.46,y-size*.65],[x+size*.36,y+size*.12],[x,y+size*.65],[x-size*.38,y+size*.12]], q.color);
    const shift = (p - .35) * size * .6;
    P.polygon(c, [[x-size*.33+shift,y-size*.62],[x-size*.05+shift,y-size*.66],[x+size*.17+shift,y+size*.23],[x-size*.06+shift,y+size*.5]], IVORY);
    P.spark(c, x + size*.4, y - size*.65, size*.42, WARM, IVORY, p*.7);
  }
  function paper(c, x, y, size, angle, q) {
    P.withSaved(c, 1, () => {
      c.translate(x, y); c.rotate(angle);
      P.polygon(c, [[-size*.8,-size*.46],[size*.47,-size*.63],[size*.95,-size*.28],[size*.56,-size*.1],[size*.77,size*.19],[size*.1,size*.55],[-size*.55,size*.43],[-size*.35,size*.1]], "#ead7a1");
      P.polygon(c, [[-size*.56,-size*.29],[size*.38,-size*.44],[size*.53,-size*.21],[-size*.35,size*.31]], IVORY);
      P.stroke(c, [[-size*.24,-size*.1],[size*.22,-size*.2],[size*.1,size*.15],[-size*.13,size*.11]], q.color, Math.max(.7, size*.12));
    });
  }
  function arrow(c, x, size, q, magic, p) {
    const length = size * (magic ? 29 : 28), head = size * (magic ? 8 : 7);
    if (magic) {
      ribbon(c, [[x-length-9*size,0],[x-length*.6,-2*size],[x-head*.6,0]], 4.2*size, q, .75);
      P.polygon(c, [[x-head*1.5,-head*.6],[x+head*.55,0],[x-head*1.5,head*.6],[x-head*.55,0]], q.light);
      P.polygon(c, [[x-head,-head*.21],[x+head*.55,0],[x-head,head*.21],[x-head*.45,0]], IVORY);
      P.glyph(c, x-length*.46, 0, 5.6*size*(.88+p*.2), q.color, q.light, p);
      for (let i=0;i<2;i++) P.petal(c, x-length*.8-i*8*size, (i?1:-1)*(3+p*3)*size, 2.1*size, i?-.5:.5, q.color, q.light);
    } else {
      // The wooden wake stays subordinate to the bright solid arrowhead.
      P.withSaved(c, .2, () => P.ribbon(c, [[x-length-12*size,2*size],[x-length*.6,size],[x-head,0]], 5*size, q.color, q.color));
      P.polygon(c, [[x-length,-1.1*size],[x-head,-1.1*size],[x-head,1.1*size],[x-length,1.1*size]], "#b9915e");
      P.polygon(c, [[x-head,-head*.68],[x+head*.48,0],[x-head,head*.68],[x-head*.56,0]], IVORY);
      P.polygon(c, [[x-length-3*size,-4*size],[x-length+6*size,-1*size],[x-length+2*size,0],[x-length-3*size,4*size],[x-length-1*size,0]], q.light);
      P.stroke(c, [[x-length+5*size,-.45*size],[x-head*.65,-.45*size]], q.light, .8*size);
    }
  }

  function paint(c, e, q, p, large) {
    const grow = .63 + .37 * P.clamp(p / .3, 0, 1);
    const shrink = p > .68 ? 1 - (p-.68)*1.35 : 1;
    const size = (large ? 1.3 : 1) * grow;
    const width = (large ? 8.4 : 6.4) * grow * shrink;
    const reach = Math.min(250, Math.hypot(e.target.x-e.source.x, e.target.y-e.source.y));
    const travel = 1 - Math.pow(1-P.clamp(p/.72, 0, 1), 1.45);
    const launch = Math.min(13, reach), x = launch + (reach-launch)*travel;
    const seed = Number.isFinite(e.id) ? e.id : 0;
    let moteX = 28*size, moteY = 0;
    switch (e.weaponType) {
      case "training": {
        const tip = 19 + p*10;
        P.withSaved(c, .25, () => P.ribbon(c, [[11,-7],[18,0],[tip,5+p*3]], 4*size*shrink, q.color, q.color));
        P.ribbon(c, [[12,-6],[19,0],[tip,5+p*3]], 2*size*shrink, q.color, q.light);
        moteX=tip; moteY=5;
        break;
      }
      case "sword":
        crescent(c, p, q, 31*size, 0, width);
        break;
      case "dual_sword":
        crescent(c, p, q, 29*size, -7*size, width*.78, -.24);
        P.withSaved(c, .8, () => {
          c.rotate(-.64+p*.13);
          crescent(c, 1-p*.65, q, 30*size, 9*size, width*.72, .22);
        });
        break;
      case "sword_shield":
        crescent(c, p, q, 30*size, 5*size, width*.69, .15);
        plate(c, 16*size, -5*size, 10.3*size, q, p);
        break;
      case "staff": {
        const tail = Math.max(0, x-(25+9*p)*size), bend = (4+Math.sin(p*Math.PI)*5)*size;
        ribbon(c, [[tail,bend],[x-15*size,2*size],[x,0]], 6.6*size*shrink, q);
        P.petal(c, x-9*size, -5*size, 4*size, -.3-p*.4, q.color, IVORY);
        P.petal(c, x-15*size, 5*size, 3*size, .5+p*.3, q.color, IVORY);
        P.lotus(c, x, 0, 7.7*size*(.8+.2*Math.sin(p*Math.PI)), q.color, IVORY, .5+p*.5);
        moteX=x-8*size; moteY=4*size;
        break;
      }
      case "orb": {
        const bend = (8+5*Math.sin(p*Math.PI))*size;
        ribbon(c, [[Math.max(0,x-32*size),-bend],[x-20*size,-bend*.8],[x-9*size,-2*size],[x,0]], 6*size*shrink, q);
        P.glowDot(c, x, 0, 6.4*size, q.color, IVORY);
        P.polygon(c, [[x-3*size,-3*size],[x+size,-4*size],[x+3*size,-size],[x-size,size]], "#b5f0ca");
        P.spark(c, x-2*size, -3*size, 2.7*size, q.light, IVORY, p);
        moteX=x-10*size; moteY=-4*size;
        break;
      }
      case "book":
        ribbon(c, [[Math.max(0,x-31*size),4*size],[x-18*size,-4*size],[x,0]], 5*size*shrink, q, .75);
        paper(c, x-22*size, -7*size*(.7+p), 5.3*size, -.45-p*.65, q);
        paper(c, x-12*size, 7*size*(.7+p), 3.8*size, .6+p*.4, q);
        P.glyph(c, x, 0, 7.2*size, q.color, q.light, p);
        P.polygon(c, [[x-2*size,-2*size],[x+6*size,0],[x-2*size,2*size],[x,0]], IVORY);
        moteX=x-8*size; moteY=2*size;
        break;
      case "knuckle": {
        const fist=25+9*p, h=5.4*size;
        ribbon(c, [[9,3*size],[fist-11*size,0],[fist,0]], 7*size*shrink, q);
        // A compact clenched silhouette, with three bright knuckles and Garuda wings.
        P.polygon(c, [[fist-6*size,-h],[fist+2*size,-h],[fist+7*size,-h*.2],[fist+5*size,h*.7],[fist-3*size,h],[fist-7*size,h*.2]], q.color);
        P.polygon(c, [[fist-4*size,-h*.67],[fist+2*size,-h*.67],[fist+4*size,-h*.1],[fist+2*size,h*.4],[fist-3*size,h*.48]], IVORY);
        for (let i=0;i<3;i++) P.polygon(c, [[fist-3*size+i*2.6*size,-h],[fist-1*size+i*2.6*size,-h],[fist-1*size+i*2.6*size,-h*.5],[fist-3*size+i*2.6*size,-h*.5]], q.light);
        for (const sign of [-1,1]) P.polygon(c, [[fist-9*size,sign*3*size],[fist-17*size,sign*10*size],[fist-9*size,sign*7*size],[fist-3*size,sign*4*size]], q.color);
        P.spark(c, fist+6*size, 0, 5*size*shrink, WARM, IVORY, Math.PI/4+p*.25);
        moteX=fist; break;
      }
      case "dagger": {
        const tip=(32+p*10)*size;
        P.withSaved(c, .22, () => P.polygon(c, [[9,7*size],[tip-7*size,2*size],[tip+3*size,3*size],[tip-9*size,7*size]], q.color));
        ribbon(c, [[10,3*size],[tip*.66,0],[tip,-2*size]], 4.2*size*shrink, q);
        P.polygon(c, [[tip-11*size,-4.3*size],[tip+3*size,-2*size],[tip-11*size,.3*size],[tip-7*size,-2*size]], IVORY);
        P.petal(c, tip-15*size, 5*size, 2.5*size, -.35+p*.3, q.color, q.light);
        moteX=tip-6*size; moteY=3*size; break;
      }
      case "claw":
        for (let i=-1;i<=1;i++) {
          const offset=i*7*size, end=(33+5*p-Math.abs(i)*2)*size;
          ribbon(c, [[11*size,offset-9*size],[24*size,offset-4*size],[end,offset+7*size]], 4.6*size*shrink, q, i===0?1:.84);
        }
        moteX=31*size; moteY=6*size;
        break;
      case "bow":
      case "magic_bow":
        arrow(c, x, size, q, e.weaponType==="magic_bow", p);
        moteX=x-19*size;
        break;
    }
    P.withSaved(c, .65, () => P.motes(c, moteX, moteY, p, e.weaponType==="training"?2:3, WARM, IVORY, seed, (e.weaponType==="training"?8:12)*size));
  }

  function draw(c, e, large = false) {
    if (!c || !valid(e)) return;
    const p = P.progress(e), dx=e.target.x-e.source.x, dy=e.target.y-e.source.y;
    // The combat router applies the whole-event envelope exactly once.
    P.withSaved(c, 1, () => {
      c.translate(e.source.x, e.source.y-17);
      c.rotate(ranged.has(e.weaponType) && (dx || dy) ? Math.atan2(dy,dx) : facingAngle[e.facing]);
      paint(c, e, profiles[e.weaponType], p, large);
    });
  }
  const api = Object.freeze({ draw, profiles });
  if (typeof module === "object") module.exports=api;
  else root.BCWeaponVFX=api;
})(typeof window !== "undefined" ? window : globalThis);
