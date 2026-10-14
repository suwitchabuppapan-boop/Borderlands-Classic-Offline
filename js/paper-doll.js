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
    const distance = Math.hypot(dx, dy);
    // A small outward bend gives an actual upper arm and forearm, even while a
    // two-hand grip dictates the exact endpoint. Rounded sleeves cover the join.
    const bend = Math.min(2.2 * scale, distance * .25);
    const normal = (side === "left" ? -1 : 1) * (dy < 0 ? -1 : 1);
    return { x: (shoulder.x + wrist.x) / 2 + (distance ? dy / distance : 1) * bend * normal,
      y: (shoulder.y + wrist.y) / 2 - (distance ? dx / distance : 0) * bend * normal };
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
    const carryAngle = mirror * (facing === 2 ? .65 : .78 + walk * .035);

    if (profile === "sword" || profile === "dagger") {
      const thrust = profile === "dagger" ? strike * 3.2 : strike * 1.5;
      put(main, mirror * (7.5 + (facing === 1 || facing === 3 ? thrust : strike)), -12.8 - windup * 1.6 + walk * .3);
      const angle = attack ? mirror * lerp(.12, profile === "dagger" ? 1.35 : 1.95, strike) : carryAngle;
      addWeapon(main, angle);
    } else if (profile === "dual_sword") {
      for (const side of ["left", "right"]) {
        const sideSign = side === "left" ? -1 : 1;
        const active = side === main ? strike : windup;
        const x = facing === 1 && side === "left" ? -.5 : facing === 3 && side === "right" ? .5 : sideSign * (7.5 + active * 1.4);
        put(side, x, -12.7 - active * 1.8 + sideSign * walk * .3);
        addWeapon(side, sideSign * (attack ? lerp(.25, 1.95, active) : .8 + sideSign * walk * .035));
      }
    } else if (profile === "greatsword") {
      put(main, mirror * (7.8 + strike * 1.6), -13.8 - windup * 2 + walk * .25);
      const model = addWeapon(main, attack ? mirror * lerp(.2, 1.72, strike) : mirror * .8);
      support(model, off);
    } else if (profile === "staff") {
      put(main, mirror * (8.7 + strike * 1.8), -12.5 - strike * 1.3 + walk * .3);
      const model = addWeapon(main, mirror * (attack ? .32 + strike * .5 : .22 + walk * .02));
      support(model, off);
      if (attack) extras.push({ kind: "magic", point: project(model, [art.pivot[0], b.y + b.h * .12]), phase: progress, color: "#9ef4e2" });
    } else if (profile === "book") {
      // The source artwork is an open book. Its two measured bottom grips, not
      // the sprite center, determine both palms; its top stays below the face.
      const bookHand = "left";
      const sx = facing === 1 || facing === 3 ? .72 : 1;
      const angle = facing === 3 ? -.08 : facing === 1 ? .08 : 0;
      const model = addWeapon(bookHand, angle, Math.min(length, 10.5 * scale), sx);
      model.behind = facing === 2; arm(bookHand).behind = model.behind;
      const center = project(model, [b.x + b.w / 2, b.y + b.h / 2]);
      const target = offset(facing === 1 ? 4.5 : facing === 3 ? -4.5 : 0, -11.8 - strike * .5 + walk * .2);
      const dx = target.x - center.x, dy = target.y - center.y;
      model.wrist.x += dx; model.wrist.y += dy; arm(bookHand).wrist = { ...model.wrist };
      support(model, bookHand === "left" ? "right" : "left");
      if (attack) extras.push({ kind: "magic", point: { x: target.x, y: target.y - 8 * scale }, phase: progress, color: "#ffdf8a" });
    } else if (profile === "knuckle") {
      for (const side of ["left", "right"]) {
        const sign = side === "left" ? -1 : 1;
        const punch = side === main ? strike : windup * .65;
        const dir = forward[facing];
        put(side, sign * 6.4 + dir[0] * punch * 6.4, -12.8 + dir[1] * punch * 3.2 - punch * 1.2 + walk * sign * .4);
        addWeapon(side, attack ? Math.atan2(dir[1], dir[0]) + Math.PI / 2 : sign * .2, Math.min(length, 6.5 * scale));
      }
    } else if (profile === "bow") {
      // The naga's head curls inward from its actual grip. A modest side-view
      // cant and a lower front carry keep that painted curl below/outside eyes.
      const angle = [Math.PI / 2, .4, -Math.PI / 2, -.4][facing];
      const flip = facing === 3 ? -1 : 1;
      const dir = [Math.cos(angle) * flip, Math.sin(angle) * flip];
      // Hold with anatomical left; the dominant right arm pulls the string.
      put(off, facing === 0 || facing === 2 ? (facing === 2 ? -4.5 : 4.5) : mirror * (12.8 + strike), facing === 2 ? -16.5 : facing === 0 ? -8.3 : -13.5);
      const model = addWeapon(off, angle, length, flip);
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
      const draw = !attack ? -1.7 : progress < .6 ? 2.5 + Math.sin(progress / .6 * Math.PI / 2) * 5.2 : 2.3;
      arm(main).wrist = { x: midpoint.x - dir[0] * draw * scale, y: midpoint.y - dir[1] * draw * scale };
      arm(main).behind = model.behind;
      extras.push({ kind: "bowstring", points: [ends[0], { ...arm(main).wrist }, ends[1]], behind: model.behind });
      if (attack) extras.push({ kind: "arrow", from: { ...arm(main).wrist }, direction: { x: dir[0], y: dir[1] }, phase: progress, behind: model.behind });
    }

    // Painted pivots can sit far from a crop's center (especially crescent bows).
    // Keep its complete painted extent off the floor while moving the actual
    // wrist and any supporting palm with it, so clearance cannot detach gear.
    for (const model of weapons) {
      const outline = Array.isArray(b.hull) && b.hull.length >= 3 && b.hull.every(point)
        ? b.hull : [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]];
      const bottom = Math.max(...outline.map(p => project(model, p).y));
      const lift = Math.max(0, bottom + .8 * scale);
      if (!lift) continue;
      model.wrist.y -= lift; arm(model.hand).wrist.y -= lift;
      if (model.supportHand) arm(model.supportHand).wrist.y -= lift;
      if (weapons.length === 1) for (const extra of extras) {
        if (extra.point) extra.point.y -= lift;
        if (extra.from) extra.from.y -= lift;
        if (extra.points) for (const p of extra.points) p.y -= lift;
      }
      if (profile === "bow") arm(main).wrist.y -= lift;
    }
    for (const a of arms) a.elbow = elbow(a.shoulder, a.wrist, a.side, scale);
    const head = validBounds(options.bodyBounds) && sourceBody && point(sourceBody.head)
      ? bodyPoint(sourceBody.head) : offset(0, -30);
    return { profile, facing, mode, progress, scale, body, arms, weapons, extras, head,
      face: { x: (facing === 1 ? -1 : facing === 3 ? -6 : -4.6) * scale + lean,
        y: -29.5 * scale + bob, w: (facing === 1 || facing === 3 ? 7 : 9.2) * scale, h: 11.5 * scale },
      palette: options.job === "Swordman"
        ? { outline: "#392c38", sleeve: "#405676", light: "#7186a1", cuff: "#dbb767", glove: "#e0c39c", shadow: "#977451" }
        : { outline: "#453934", sleeve: "#e9ddc0", light: "#fff2d4", cuff: "#b88e42", glove: "#edc59a", shadow: "#a57450" } };
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
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    for (const a of plan.arms.filter(a => a.behind === behind)) {
      const cuff = { x: lerp(a.elbow.x, a.wrist.x, .68), y: lerp(a.elbow.y, a.wrist.y, .68) };
      if (!glovesOnly) {
        line(a.shoulder, a.elbow, p.outline, 3.5); line(a.elbow, a.wrist, p.outline, 2.8);
        line(a.shoulder, a.elbow, p.sleeve, 2.7); line(a.elbow, a.wrist, p.sleeve, 2.15);
        line({ x: a.shoulder.x - .4 * s, y: a.shoulder.y - .5 * s }, { x: a.elbow.x - .4 * s, y: a.elbow.y - .5 * s }, p.light, .7);
        line(cuff, a.wrist, p.cuff, 2.3);
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
