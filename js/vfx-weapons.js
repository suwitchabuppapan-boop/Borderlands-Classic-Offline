/* Siam weapon gestures: immutable combat snapshots, painted in body space. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const P = typeof module === "object" ? require("./vfx-painter.js") : root.BCVFXPainter;
  const IVORY = "#fff9e8", STEEL = "#d9e8f0";
  const profiles = Object.freeze(Object.fromEntries([
    ["training", "Practice stroke", "#a8bac6", "#e6ebda"],
    ["sword", "Dha crescent", "#90bdde", "#f4f5ed"],
    ["two_hand_sword", "Royal greatsword", "#a0b6df", "#f3f3ed"],
    ["sword_shield", "Guardian glint", "#9bc9d8", "#fff4d6"],
    ["staff", "Lotus comet", "#c4a5f3", "#fff1dc"],
    ["orb", "Jade discharge", "#72d4bb", "#d9fff1"],
    ["book", "Scripture bolt", "#d8c17e", "#fff4ce"],
    ["knuckle", "Garuda sparks", "#e6bf86", "#fff4d9"],
    ["dagger", "Moon kris", "#b6b5ed", "#f3efff"],
    ["claw", "Tiger rakes", "#b6b8dc", "#fff0e0"],
    ["bow", "Forest arrow", "#b7b9a5", "#fff5db"],
    ["magic_bow", "Arcane arrow", "#a6b4ef", "#defff7"]
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
    P.withSaved(c, alpha, () => P.ribbon(c, points, width, q.color, q.light));
  }
  function curve(c, from, control, to, width, q, alpha = 1) {
    const points = Array.from({length: 9}, (_, i) => {
      const t = i / 8, a = 1-t;
      return [a*a*from[0]+2*a*t*control[0]+t*t*to[0], a*a*from[1]+2*a*t*control[1]+t*t*to[1]];
    });
    ribbon(c, points, width, q, alpha);
  }
  function crescent(c, p, q, radius, offset, width, tilt = 0) {
    const release = 1 - Math.pow(1 - P.clamp(p / .58, 0, 1), 2.4);
    // Two smooth curves meet at needle points; the broad edge stays translucent.
    P.withSaved(c, 1, () => {
      c.translate(4 + p * 4, offset); c.rotate(-.53 + release * .82 + tilt);
      const shape = (thickness, color) => {
        c.fillStyle = color; c.beginPath(); c.moveTo(radius * .18, -radius * .94);
        c.bezierCurveTo(radius * 1.25, -radius * .58, radius * 1.25, radius * .58, radius * .18, radius * .94);
        c.bezierCurveTo(radius * 1.25 - thickness, radius * .45, radius * 1.25 - thickness, -radius * .45, radius * .18, -radius * .94);
        c.closePath(); c.fill();
      };
      P.withSaved(c, .17, () => shape(width * 2.1, q.color));
      P.withSaved(c, .46, () => shape(width * 1.18, q.color));
      shape(width * .7, STEEL);
      shape(width * .46, IVORY);
    });
  }
  function paper(c, x, y, size, angle, q) {
    P.withSaved(c, 1, () => {
      c.translate(x, y); c.rotate(angle);
      c.fillStyle = q.light; c.beginPath(); c.moveTo(-size, -size * .48);
      c.quadraticCurveTo(0, -size * .74, size, -size * .4);
      c.lineTo(size * .83, size * .5);
      c.quadraticCurveTo(-size * .15, size * .24, -size * .96, size * .54);
      c.closePath(); c.fill();
      P.stroke(c, [[-size*.42,-size*.2],[size*.34,-size*.12],[size*.1,size*.13]], q.color, Math.max(.6, size*.12));
      P.stroke(c, [[-size*.42,size*.14],[-size*.05,size*.21]], q.color, Math.max(.6, size*.1));
    });
  }
  function arrow(c, x, size, q, magic, p, shrink) {
    const length = size * (magic ? 29 : 26), head = size * (magic ? 6 : 5.3);
    const tail = x - length;
    P.withSaved(c, magic ? .58 : .22, () => P.ribbon(c,
      [[tail-13*size,1.1*size],[tail+5*size,.5*size],[x-head,0]], (magic ? 2.8 : 1.9)*size*shrink, q.color, magic ? q.light : null));
    if (magic) {
      P.aura(c, x-head*.45, 0, 9*size, 4.5*size, q.color, .24);
      P.polygon(c, [[tail,0],[x-head,-1.2*size],[x+2*size,0],[x-head,1.2*size]], q.light);
      P.polygon(c, [[x-head*1.5,-head*.55],[x+2*size,0],[x-head*1.5,head*.55],[x-head*.78,0]], q.color);
      P.polygon(c, [[x-head,-head*.23],[x+2*size,0],[x-head,head*.23],[x-head*.7,0]], IVORY);
      P.withSaved(c, .6*(1-p), () => P.stroke(c, [[tail-6*size,-2*size],[tail+7*size,-1.5*size]], q.light, .7*size));
    } else {
      P.polygon(c, [[tail,-.65*size],[x-head,-.65*size],[x-head,.65*size],[tail,.65*size]], "#a98b65");
      P.polygon(c, [[x-head,-head*.48],[x+1.5*size,0],[x-head,head*.48],[x-head*.66,0]], STEEL);
      P.stroke(c, [[x-head*.7,-.5*size],[x+size,0]], IVORY, .7*size);
      P.polygon(c, [[tail-2*size,-2.6*size],[tail+5*size,-.4*size],[tail+2*size,0],[tail-2*size,2.6*size],[tail,0]], q.light);
    }
  }

  function paint(c, e, q, p, large) {
    const grow = .72 + .28 * (1-Math.pow(1-P.clamp(p/.28,0,1),2));
    const shrink = p > .52 ? 1 - (p-.52)*1.65 : 1;
    const size = (large ? 1.3 : 1) * (e.weaponType === "bow" || e.weaponType === "magic_bow" ? 1 : grow);
    const width = (large ? 8 : 6.2) * grow * shrink;
    const reach = Math.min(250, Math.hypot(e.target.x-e.source.x, e.target.y-e.source.y));
    const travel = 1 - Math.pow(1-P.clamp(p/.76, 0, 1), 1.5);
    const launch = Math.min(13, reach), x = launch + (reach-launch)*travel;
    switch (e.weaponType) {
      case "training": {
        crescent(c, p, q, 21*size, 0, width*.52, -.18);
        break;
      }
      case "sword":
        crescent(c, p, q, 31*size, 0, width);
        break;
      case "two_hand_sword":
        // One committed broad cut follows the two-handed full-body attack pose.
        crescent(c, p, q, 39*size, 2*size, width*1.18, -.2);
        break;
      case "sword_shield":
        crescent(c, p, q, 30*size, 5*size, width*.69, .15);
        P.withSaved(c, .45*(1-p), () => P.arcRibbon(c, 7*size, -5*size, 12*size, 15*size, -1.25, 1.1, 3*size*shrink, q.color, q.light));
        P.spark(c, 17*size, -11*size, 2.3*size*shrink, q.light, IVORY, .3);
        break;
      case "staff": {
        const tail = Math.max(0, x-(30+10*p)*size), bend = Math.sin(p*Math.PI)*3*size;
        P.aura(c, x-5*size, 0, 17*size, 9*size, q.color, .38);
        curve(c, [tail,bend], [x-17*size,-5*size], [x+3*size,0], 6.2*size*shrink, q, .86);
        curve(c, [x-25*size,-4*size], [x-11*size,-5*size], [x,0], 2.2*size*shrink, q, .48);
        P.glowDot(c, x, 0, 4.6*size*(.92+.08*Math.sin(p*Math.PI*2)), q.color, IVORY);
        break;
      }
      case "orb": {
        P.aura(c, x, 0, 13*size, 12*size, q.color, .38);
        ribbon(c, [[Math.max(0,x-21*size),2*size],[x-12*size,0],[x,0]], 3.5*size*shrink, q, .55);
        P.withSaved(c, .55, () => {
          P.arcRibbon(c, x, 0, 8.2*size, 5.2*size, -.9+p*2.8, 1.3+p*2.8, 1.6*size*shrink, q.color, q.light);
          P.arcRibbon(c, x, 0, 8.2*size, 6.3*size, 2.2+p*2.8, 3.5+p*2.8, 1.1*size*shrink, q.color, q.light);
        });
        P.glowDot(c, x, 0, 5.5*size, q.color, q.light);
        break;
      }
      case "book": {
        const flutter = Math.sin(p*Math.PI*3)*size;
        P.aura(c, x, 0, 12*size, 8*size, q.color, .33);
        ribbon(c, [[Math.max(0,x-27*size),3*size],[x-15*size,-2*size],[x,0]], 3.2*size*shrink, q, .75);
        P.withSaved(c, .4*(1-p), () => paper(c, x-12*size, 5*size+flutter, 3.3*size, -.35+p*.3, q));
        paper(c, x, 0, 6.6*size, -.12+flutter*.05, q);
        P.glowDot(c, x+4*size, -1.5*size, 1.7*size, q.color, IVORY);
        break;
      }
      case "knuckle": {
        const thrust = (22+12*(1-Math.pow(1-p,3)))*size;
        ribbon(c, [[9*size,0],[thrust-10*size,0],[thrust,0]], 5.2*size*shrink, q);
        for (const side of [-1,1]) P.withSaved(c, .52, () =>
          P.ribbon(c, [[11*size,side*4*size],[thrust-9*size,side*2*size],[thrust-2*size,side*.5*size]], 1.6*size*shrink, q.color, IVORY));
        P.aura(c, thrust, 0, 10*size, 8*size, q.color, .32);
        P.arcRibbon(c, thrust-3*size, 0, (4+p*3)*size, (6+p*4)*size, -1.15, 1.15, 2*size*shrink, q.color, IVORY);
        P.withSaved(c, .7*(1-p), () => P.rays(c, thrust, 0, p, 5, q.color, IVORY, (9+p*9)*size));
        P.glowDot(c, thrust, 0, 2.5*size*shrink, q.color, IVORY);
        break;
      }
      case "dagger": {
        const tip=(29+12*(1-Math.pow(1-p,2)))*size;
        curve(c, [9*size,5*size], [tip*.58,1.5*size], [tip,-3*size], 3.2*size*shrink, q);
        P.polygon(c, [[tip-15*size,-2.4*size],[tip+2*size,-3*size],[tip-10*size,-.5*size]], IVORY);
        P.withSaved(c, .32, () => P.arcRibbon(c, tip-14*size, 0, 11*size, 7*size, .25, 1.45, 1.3*size*shrink, q.color, q.light));
        break;
      }
      case "claw":
        for (let i=-1;i<=1;i++) {
          const offset=i*6*size, end=(31+8*p-Math.abs(i)*2)*size;
          curve(c, [10*size,offset-8*size], [27*size,offset-7*size], [end,offset+5*size], 2.8*size*shrink, q, i===0?1:.78);
        }
        break;
      case "bow":
      case "magic_bow":
        arrow(c, x, size, q, e.weaponType==="magic_bow", p, shrink);
        break;
    }
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
