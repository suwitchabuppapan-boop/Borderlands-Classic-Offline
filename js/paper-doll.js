/* Articulated Siam equipment. Coordinates are local to the character's feet. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCPaperDoll = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const PROFILES = ["sword", "dual_sword", "greatsword", "staff", "book", "knuckle", "dagger", "bow"];
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const point = p => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite);
  const validBounds = b => b && [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.w > 0 && b.h > 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  const forward = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  // Project absolute painted pixels, including atlas offsets, through the exact
  // same pivot, rotation and scale used by Canvas. No cell-center assumptions.
  function project(model, sourcePoint) {
    const b = model.bounds;
    const sx = (model.dx + (sourcePoint[0] - b.x) / b.w * model.width) * model.scaleX;
    const sy = (model.dy + (sourcePoint[1] - b.y) / b.h * model.height) * model.scaleY;
    const cs = Math.cos(model.angle), sn = Math.sin(model.angle);
    return { x: model.wrist.x + sx * cs - sy * sn, y: model.wrist.y + sx * sn + sy * cs };
  }

  function elbow(shoulder, wrist, side, scale) {
    const dx = wrist.x - shoulder.x, dy = wrist.y - shoulder.y;
    const distance = Math.max(.0001, Math.hypot(dx, dy)), bone = 4.8 * scale;
    const bend = Math.sqrt(Math.max(0, bone * bone - distance * distance / 4));
    // The two equal-length links use one bend branch for each screen-side arm.
    // Crossing shoulder height never flips an elbow to the other solution.
    const sign = side === "left" ? 1 : -1;
    return { x: (shoulder.x + wrist.x) / 2 - dy / distance * bend * sign,
      y: (shoulder.y + wrist.y) / 2 + dx / distance * bend * sign };
  }

  function plan(appearance, pose = {}, options = {}) {
    const art = options.art, b = options.bounds;
    if (!appearance || appearance.atlas !== "siam-weapons" || !PROFILES.includes(appearance.profile)
      || !Number.isInteger(appearance.cell) || appearance.cell < 0 || appearance.cell > 7
      || !art || !point(art.pivot) || !validBounds(b)) return null;
    pose = pose || {};
    const profile = appearance.profile;
    if ((profile === "greatsword" || profile === "book") && !point(art.support)) return null;
    const facing = clamp(Math.round(finite(pose.facing)), 0, 3);
    const height = Math.max(1, finite(options.height, 34)), scale = height / 34;
    const lean = finite(pose.lean), bob = finite(pose.bob);
    const mode = ["walk", "attack"].includes(pose.mode) ? pose.mode : "idle";
    const frame = clamp(Math.round(finite(pose.frame)), 0, mode === "attack" ? 1 : 3);
    const progress = mode === "attack" ? clamp(finite(pose.progress, frame * .5), 0, 1) : 0;
    const walk = mode === "walk" ? [0, 1, 0, -1][frame] : 0;
    const attack = mode === "attack";
    const attackMix = attack ? Math.sin(Math.PI * progress) ** 2 : 0;
    const strike = attack ? Math.sin(Math.PI * clamp((progress - .18) / .82, 0, 1)) : 0;
    const windup = attack ? Math.sin(Math.PI * clamp(progress / .55, 0, 1)) : 0;
    const mirror = facing === 0 || facing === 3 ? -1 : 1;
    const offset = (x, y) => ({ x: x * scale + lean, y: y * scale + bob });
    const main = ["left", "right", "right", "left"][facing], off = main === "right" ? "left" : "right";
    const body = { atlas: options.job === "Swordman" ? "siam-swordman-body" : "siam-novice-body",
      cell: facing * 4 + (mode === "attack" ? 3 : mode === "walk" ? [1, 2, 1, 2][frame] : 0), height };
    const bodyWidth = validBounds(options.bodyBounds) ? height * options.bodyBounds.w / options.bodyBounds.h : 18 * scale;
    body.bounds = { x: -bodyWidth / 2 + lean, y: -height + bob, w: bodyWidth, h: height };
    const sourceBody = options.bodyArt;
    const shoulderDefaults = [[[-4.1,-17],[4.1,-17]], [[-1.2,-17.2],[3.8,-17.2]], [[-4.1,-17],[4.1,-17]], [[-3.8,-17.2],[1.2,-17.2]]][facing];
    const bodyPoint = p => ({ x: ((p[0] - options.bodyBounds.x) - options.bodyBounds.w / 2) * height / options.bodyBounds.h + lean,
      y: -height + (p[1] - options.bodyBounds.y) * height / options.bodyBounds.h + bob });
    const shoulders = validBounds(options.bodyBounds) && sourceBody && Array.isArray(sourceBody.shoulders)
      && sourceBody.shoulders.length === 2 && sourceBody.shoulders.every(point)
      ? sourceBody.shoulders.map(bodyPoint) : shoulderDefaults.map(p => offset(...p));
    const arms = ["left", "right"].map((side, i) => ({ side, shoulder: shoulders[i],
      wrist: offset(side === "left" ? -6.3 : 6.3, -10.8 + (side === main ? walk * .35 : -walk * .35)),
      behind: facing === 2 || facing === 1 && side === "left" || facing === 3 && side === "right" }));
    const arm = side => arms.find(a => a.side === side);
    const put = (side, x, y) => { arm(side).wrist = offset(x, y); };
    const weapons = [], extras = [];
    const length = Math.max(3, finite(appearance.length, [22, 19, 29, 31, 12, 7, 15, 25][appearance.cell])) * scale;
    const addWeapon = (hand, angle, lengthOverride = length, scaleX = 1, scaleY = 1) => {
      const w = lengthOverride * b.w / b.h;
      const model = { cell: appearance.cell, hand, wrist: { ...arm(hand).wrist }, angle,
        scaleX, scaleY, dx: -(art.pivot[0] - b.x) / b.w * w,
        dy: -(art.pivot[1] - b.y) / b.h * lengthOverride, width: w, height: lengthOverride,
        pivot: [...art.pivot], bounds: { ...b }, behind: facing === 2 || arm(hand).behind };
      weapons.push(model);
      return model;
    };
    const support = (model, hand) => {
      if (!point(art.support)) return;
      model.support = [...art.support]; model.supportHand = hand;
      arm(hand).wrist = project(model, art.support);
      arm(hand).behind = model.behind;
    };
    const centerGrips = (model, x, y) => {
      const other = project(model, art.support), target = offset(x, y);
      model.wrist.x += target.x - (model.wrist.x + other.x) / 2;
      model.wrist.y += target.y - (model.wrist.y + other.y) / 2;
      arm(model.hand).wrist = { ...model.wrist };
    };
    const angleBetween = (carry, active) => carry + Math.atan2(Math.sin(active-carry), Math.cos(active-carry)) * attackMix;
    const carryAngle = mirror * (facing === 2 ? .65 : .78 + walk * .035);

    // A source blade points upward. Attack rotations are based on the target's
    // world heading; carrying remains outward from the anatomical holding hand.
    const dir = forward[facing];
    const aim = Math.atan2(dir[1], dir[0]) + Math.PI / 2;
    // Toward-camera attacks shorten in projection; rear blades retain their
    // length so the strike remains visible above/beside the back of the head.
    const foreshorten = facing === 0;
    if (profile === "sword" || profile === "dagger") {
      const thrust = profile === "dagger" ? strike * 3.2 : strike * 1.5;
      put(main, mirror * 7.5 + (attack ? dir[0] * thrust : 0),
        -12.8 - windup * 1.6 + walk * .3 + (attack ? dir[1] * thrust : 0));
      const angle = angleBetween(carryAngle, profile === "dagger" ? aim : aim + mirror * lerp(-.72, .22, strike));
      addWeapon(main, angle, length, 1, foreshorten ? lerp(1,.48,attackMix) : 1);
    } else if (profile === "dual_sword") {
      for (const side of ["left", "right"]) {
        const sideSign = side === "left" ? -1 : 1;
        const active = side === main ? strike : windup;
        const x = facing === 1 && side === "left" ? -.5 : facing === 3 && side === "right" ? .5 : sideSign * 7.5;
        put(side, x + (attack ? dir[0] * active * 1.4 : 0),
          -12.7 - active * 1.8 + sideSign * walk * .3 + (attack ? dir[1] * active * 1.2 : 0));
        addWeapon(side, angleBetween(sideSign * (.8 + sideSign * walk * .035), aim + sideSign * lerp(-.5,.22,active)),
          length, 1, foreshorten ? lerp(1,.5,attackMix) : 1);
      }
    } else if (profile === "greatsword") {
      put(main, mirror * 7.8 + (attack ? dir[0] * strike * 1.6 : 0),
        -13.8 - windup * 2 + walk * .25 + (attack ? dir[1] * strike * 1.6 : 0));
      const model = addWeapon(main, angleBetween(mirror*1.25,aim + mirror * lerp(-.75,.15,strike)),
        length, 1, foreshorten ? lerp(1,.45,attackMix) : 1);
      centerGrips(model,(facing===1?4.8:facing===3?-4.8:0)+dir[0]*strike*.8,(facing===0?-12:facing===2?-13.5:-12)+dir[1]*strike*.8+walk*.15);
      support(model, off);
    } else if (profile === "staff") {
      put(main, mirror * 8.7 + (attack ? dir[0] * strike * 1.8 : 0),
        -12.5 - strike * 1.3 + walk * .3 + (attack ? dir[1] * strike * 1.8 : 0));
      const model = addWeapon(main, angleBetween(mirror*(.9+walk*.02),aim + mirror * lerp(-.3,.08,strike)),
        length, 1, foreshorten ? lerp(1,.52,attackMix) : 1);
      centerGrips(model,(facing===1?4.8:facing===3?-4.8:0)+dir[0]*strike*.8,(facing===0?-12.5:facing===2?-13.5:-12)+dir[1]*strike*.8+walk*.15);
      support(model, off);
      if (attack) extras.push({ kind: "magic", point: project(model, [art.pivot[0], b.y + b.h * .12]), phase: progress, color: "#9ef4e2", behind: model.behind });
    } else if (profile === "book") {
      // The source artwork is an open book. Its two measured bottom grips, not
      // the sprite center, determine both palms; its top stays below the face.
      const bookHand = "left";
      const sx = facing === 1 || facing === 3 ? .72 : 1;
      const angle = facing === 3 ? -.08 : facing === 1 ? .08 : 0;
      const model = addWeapon(bookHand, angle, Math.min(length, (facing===1||facing===3?9.5:10.5) * scale), sx);
      model.behind = facing === 2; arm(bookHand).behind = model.behind;
      const center = project(model, [b.x + b.w / 2, b.y + b.h / 2]);
      const target = offset(facing === 1 ? 2.5 : facing === 3 ? -2.5 : 0, -12.2 - strike * .5 + walk * .2);
      const dx = target.x - center.x, dy = target.y - center.y;
      model.wrist.x += dx; model.wrist.y += dy; arm(bookHand).wrist = { ...model.wrist };
      support(model, bookHand === "left" ? "right" : "left");
      if (attack) extras.push({ kind: "magic", point: { x: target.x + dir[0] * 6 * scale, y: target.y + dir[1] * 6 * scale }, phase: progress, color: "#ffdf8a", behind: model.behind });
    } else if (profile === "knuckle") {
      for (const side of ["left", "right"]) {
        const sign = side === "left" ? -1 : 1;
        const punch = side === main ? strike : windup * .65;
        const dir = forward[facing];
        put(side, sign * 5.5 + dir[0] * punch * 4.5, -12.8 + dir[1] * punch * 3.2 - punch * 1.2 + walk * sign * .4);
        addWeapon(side, angleBetween(sign*.2,Math.atan2(dir[1],dir[0])+Math.PI/2), Math.min(length, 6.5 * scale));
      }
    } else if (profile === "bow") {
      // The naga's head curls inward from its actual grip. A modest side-view
      // cant and a lower front carry keep that painted curl below/outside eyes.
      const angle = [Math.PI / 2, .75, -Math.PI / 2, -.75][facing];
      const flip = facing === 3 ? -1 : 1;
      // The naga sprite is canted for face clearance; its firing axis is the world target heading.
      const dir = forward[facing];
      // Hold with anatomical left; the dominant right arm pulls the string.
      put(off, facing === 0 || facing === 2 ? (facing === 2 ? -.5 : 3.5) : mirror * (6 + strike*.4), facing === 2 ? -17 : facing === 0 ? -9.8 : -10.4);
      const model = addWeapon(off, angle, length, flip*(facing===0||facing===2?.55:1));
      model.behind = facing === 2; arm(off).behind = model.behind;
      const ends = Array.isArray(art.string) && art.string.length === 2 && art.string.every(point)
        ? art.string.map(p => project(model, p))
        : [[art.pivot[0], b.y + b.h * .06], [art.pivot[0], b.y + b.h * .94]].map(p => project(model, p));
      if (Array.isArray(art.string) && art.string.length === 2 && art.string.every(point)) {
        model.string = art.string.map(p => [...p]);
        if (validBounds(art.stringMask)) model.stringMask = { ...art.stringMask };
      }
      const midpoint = { x: (ends[0].x + ends[1].x) / 2, y: (ends[0].y + ends[1].y) / 2 };
      // A relaxed carry lets the string slack toward the bow. Pulling it back
      // in idle lifts the opposite forearm across the front-facing mouth.
      // A continuous draw/release returns to the same resting grip. Depth in
      // front/rear projection is shorter than a side-view string pull.
      const peak = facing===0||facing===2 ? 1.8 : 3.6;
      const pull = progress<=.6 ? Math.sin(progress/.6*Math.PI/2)**2 : Math.cos((progress-.6)/.4*Math.PI/2)**2;
      const draw = .4 + (peak-.4)*(attack?pull:0);
      arm(main).wrist = { x: midpoint.x - dir[0] * draw * scale, y: midpoint.y - dir[1] * draw * scale };
      arm(main).behind = model.behind;
      model.drawHand=main;
      extras.push({ kind: "bowstring", points: [ends[0], { ...arm(main).wrist }, ends[1]], behind: model.behind });
      if (attack) extras.push({ kind: "arrow", from: { ...arm(main).wrist }, direction: { x: dir[0], y: dir[1] }, phase: progress, behind: model.behind });
    }

    // Move a rigid held object and all its hands together into the intersection
    // of the arms' reachable regions. Preserve painted grips/string endpoints.
    const minReach=3.1*scale,maxReach=9.3*scale;
    const correction=a=>{
      const dx=a.wrist.x-a.shoulder.x,dy=a.wrist.y-a.shoulder.y,d=Math.hypot(dx,dy);
      const target=clamp(d,minReach,maxReach),factor=(target-d)/(d||1);
      return d ? {x:dx*factor,y:dy*factor} : {x:(a.side==='left'?-minReach:minReach),y:0};
    };
    const held=new Set();
    for (const model of weapons) {
      const hands=[...new Set([model.hand,model.supportHand,model.drawHand].filter(Boolean))].map(arm);
      hands.forEach(a=>held.add(a.side));
      const outline = Array.isArray(b.hull) && b.hull.length >= 3 && b.hull.every(point)
        ? b.hull : [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]];
      let bottom = Math.max(...outline.map(p => project(model, p).y));
      const move=(dx,dy)=>{
        model.wrist.x+=dx;model.wrist.y+=dy;bottom+=dy;
        for(const a of hands){a.wrist.x+=dx;a.wrist.y+=dy;}
        if(weapons.length===1)for(const e of extras){
          for(const p of [e.point,e.from,...(e.points||[])].filter(Boolean)){p.x+=dx;p.y+=dy;}
        }
      };
      for(let iteration=0;iteration<32;iteration++){
        let amount=0;
        for(const a of hands){const d=correction(a);move(d.x,d.y);amount+=Math.hypot(d.x,d.y);}
        const lift=Math.max(0,bottom+.8*scale);if(lift){move(0,-lift);amount+=lift;}
        if(amount<1e-8)break;
      }
    }
    for(const a of arms)if(!held.has(a.side)){const d=correction(a);a.wrist.x+=d.x;a.wrist.y+=d.y;}
    for (const a of arms) a.elbow = elbow(a.shoulder, a.wrist, a.side, scale);
    const head = validBounds(options.bodyBounds) && sourceBody && point(sourceBody.head)
      ? bodyPoint(sourceBody.head) : offset(0, -30);
    return { profile, facing, mode, progress, scale, body, arms, weapons, extras, head,
      face: { x: (facing === 1 ? -1 : facing === 3 ? -6 : -4.6) * scale + lean,
        y: -29.5 * scale + bob, w: (facing === 1 || facing === 3 ? 7 : 9.2) * scale, h: 11.5 * scale },
      palette: options.job === "Swordman"
        ? { outline: "#633e34", skin: "#fbc5a9", light: "#ffddc3", shade: "#be8268", cuff: "#deaa6a", trim: "#f6d28e", glove: "#fbc5a9", shadow: "#b87c62" }
        : { outline: "#694335", skin: "#fdcfb2", light: "#ffdfc5", shade: "#c48b6d", cuff: "#83252a", trim: "#b5734d", glove: "#fdcfb2", shadow: "#be8268" } };
  }

  function frame(plan, width, height, options = {}) {
    const s = plan.scale, points = [];
    const rect = b => points.push({ x:b.x,y:b.y },{ x:b.x+b.w,y:b.y+b.h });
    rect(plan.body.bounds);
    rect({ x:-7*s,y:-1.1*s,w:14*s,h:5.2*s });
    if (options.headBounds) rect(options.headBounds);
    for (const a of plan.arms) for (const p of [a.shoulder,a.elbow,a.wrist]) rect({ x:p.x-1.9*s,y:p.y-1.9*s,w:3.8*s,h:3.8*s });
    for (const model of plan.weapons) {
      const b = model.bounds;
      for (const p of [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]]) points.push(project(model,p));
    }
    const left = Math.min(...points.map(p=>p.x)), right = Math.max(...points.map(p=>p.x));
    const top = Math.min(...points.map(p=>p.y)), bottom = Math.max(...points.map(p=>p.y));
    const padding = clamp(finite(options.padding,4),0,Math.min(width,height)/3);
    const scale = Math.min((width-padding*2)/(right-left),(height-padding*2)/(bottom-top));
    return { x:(width-(right-left)*scale)/2-left*scale, y:(height-(bottom-top)*scale)/2-top*scale,
      scale, bounds:{ x:left,y:top,w:right-left,h:bottom-top } };
  }

  function drawArms(c, plan, x, y, behind, glovesOnly = false) {
    const p = plan.palette, s = plan.scale;
    const line = (from, to, color, width) => {
      c.strokeStyle = color; c.lineWidth = width * s;
      c.beginPath(); c.moveTo(x + from.x, y + from.y); c.lineTo(x + to.x, y + to.y); c.stroke();
    };
    const skin = (from, to, width) => {
      const dx=to.x-from.x, dy=to.y-from.y, length=Math.hypot(dx,dy) || 1;
      const nx=-dy/length*width*s/2, ny=dx/length*width*s/2;
      const paint=c.createLinearGradient(x+from.x+nx,y+from.y+ny,x+from.x-nx,y+from.y-ny);
      paint.addColorStop(0,p.shade); paint.addColorStop(.4,p.skin); paint.addColorStop(.8,p.light); paint.addColorStop(1,p.skin);
      line(from,to,paint,width);
    };
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    for (const a of plan.arms.filter(a => a.behind === behind)) {
      const cuff = { x: lerp(a.elbow.x, a.wrist.x, .72), y: lerp(a.elbow.y, a.wrist.y, .72) };
      if (!glovesOnly) {
        // Both authored job costumes are sleeveless. Skin continues from the
        // measured bare shoulder; only the small wrist binding is clothing.
        line(a.shoulder, a.elbow, p.outline, 3); line(a.elbow, a.wrist, p.outline, 2.5);
        skin(a.shoulder,a.elbow,2.2); skin(a.elbow,a.wrist,1.75);
        c.save(); c.lineCap="butt";
        line(cuff,a.wrist,p.outline,2.35); line(cuff,a.wrist,p.cuff,1.9);
        const dx=a.wrist.x-cuff.x,dy=a.wrist.y-cuff.y,d=Math.hypot(dx,dy) || 1;
        line({x:cuff.x-dy/d*.85*s,y:cuff.y+dx/d*.85*s},{x:cuff.x+dy/d*.85*s,y:cuff.y-dx/d*.85*s},p.trim,.4);
        c.restore();
      }
      // The equipment has already been drawn when restoring the tiny gripping
      // fingers. Knuckles cover the fist; do not paint a large hand over them.
      if (glovesOnly && plan.profile === "knuckle") continue;
      c.fillStyle = p.outline;
      c.beginPath(); c.ellipse(x + a.wrist.x, y + a.wrist.y, 1.65 * s, 1.45 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = glovesOnly ? p.glove : p.shadow;
      c.beginPath(); c.ellipse(x + a.wrist.x, y + a.wrist.y - .2 * s, (glovesOnly ? 1.05 : 1.3) * s, (glovesOnly ? .9 : 1.1) * s, 0, 0, Math.PI * 2); c.fill();
      if (glovesOnly) line({ x: a.wrist.x - .7 * s, y: a.wrist.y - .35 * s }, { x: a.wrist.x + .65 * s, y: a.wrist.y - .35 * s }, p.light, .45);
    }
    c.restore();
  }
  return { plan, project, frame, drawArms };
});
