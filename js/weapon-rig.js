/* Painted-frame hand sockets and hilt pivots for the original Siam sprite atlases. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCWeaponRig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Absolute source pixels, measured at the center of the closed glove. Body
  // cropping varies by frame, so reproject these through its actual bounds.
  // Each entry is [source x, source y, behind body]. Names match render.js.
  const HANDS = {
    "sprites": [[99,215,0],[444,215,0],[834,214,1],[1120,216,0],[86,531,0],[442,532,0],[846,532,1],[1124,533,0]],
    "novice-walk": [[122,195,0],[425,207,0],[725,197,0],[1043,205,0],[113,511,0],[425,512,0],[731,512,0],[1074,520,0],[229,828,1],[539,830,1],[848,830,1],[1155,828,1],[223,1127,0],[532,1127,0],[838,1127,0],[1142,1127,0]],
    "swordman-walk": [[125,193,0],[409,201,0],[721,203,0],[1032,203,0],[219,501,0],[434,516,0],[839,503,0],[1153,497,0],[211,810,1],[536,803,1],[841,794,1],[1158,794,1],[110,1113,0],[411,1124,0],[725,1112,0],[1052,1126,0]],
    "attacks": [[86,121,0],[573,159,0],[691,125,0],[1190,162,0],[87,429,0],[580,466,0],[705,447,0],[1203,471,0],[256,747,1],[581,767,1],[866,752,1],[1203,766,1],[247,1049,0],[373,1087,0],[842,1061,0],[968,1089,0]],
  };
  // The center of the painted handle, not the center/bottom of a weapon cell.
  const HILTS = { 12: [161, 1125], 13: [469, 1125], 14: [790, 1126] };
  const REST = [-.6, .48, .18, -.48];
  const WALK = [
    [-.65, -.5, -.85, -.58], [.4, .6, .15, .45],
    [.28, .12, .4, .18], [-.4, -.6, -.15, -.45],
  ];
  const WINDUP = [[-1.1, -.8], [-1.15, -.55], [.95, .45], [1.15, .55]];
  const SLASH = [[1.35, 2.15], [1.05, 1.75], [-.35, .2], [-1.05, -1.75]];
  const PROJECTION = [[1, .82], [.64, 1], [.9, .88], [-.64, 1]];
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const index = (n, limit) => clamp(Math.round(finite(n)), 0, limit);
  const validBounds = (b) => b && [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.w > 0 && b.h > 0;

  function hand(atlas, cell, bodyBounds, height, pose = {}) {
    if (!Number.isInteger(cell) || cell < 0) return null;
    const socket = Object.prototype.hasOwnProperty.call(HANDS, atlas) && HANDS[atlas][cell];
    if (!socket || !validBounds(bodyBounds) || !Number.isFinite(height) || height <= 0) return null;
    pose = pose || {};
    const b = bodyBounds, scale = height / b.h;
    const lean = finite(pose.lean), bob = finite(pose.bob);
    const left = -b.w * scale / 2 + lean, top = -height + bob;
    const x = left + (socket[0] - b.x) * scale;
    const y = top + (socket[1] - b.y) * scale;
    // Restore this source patch with the exact body transform. The fingers sit
    // over the hilt while rotation happens at the glove's center.
    const sx = socket[0] - 11, sy = socket[1] - 11;
    return {
      x, y, behind: Boolean(socket[2]),
      patch: {
        sx, sy, sw: 22, sh: 22,
        dx: left + (sx - b.x) * scale, dy: top + (sy - b.y) * scale,
        dw: 22 * scale, dh: 22 * scale,
      },
    };
  }

  function weapon(cell, weaponBounds, length, pose = {}) {
    if (!Number.isInteger(cell)) return null;
    const hilt = Object.prototype.hasOwnProperty.call(HILTS, cell) && HILTS[cell];
    if (!hilt || !validBounds(weaponBounds) || !Number.isFinite(length) || length <= 0) return null;
    pose = pose || {};
    const b = weaponBounds, facing = index(pose.facing, 3);
    const height = length + 5, width = height * b.w / b.h;
    let angle = REST[facing];
    if (pose.mode === "walk") angle = WALK[facing][index(pose.frame, 3)];
    else if (pose.mode === "attack") {
      const frame = index(pose.frame, 1);
      const progress = finite(pose.progress, frame * .5);
      const t = clamp((progress - frame * .5) * 2, 0, 1);
      const pair = (frame ? SLASH : WINDUP)[facing];
      angle = pair[0] + (pair[1] - pair[0]) * t;
    }
    // Translate the hilt to the wrist, then rotate and foreshorten around it.
    return {
      dx: -(hilt[0] - b.x) / b.w * width,
      dy: -(hilt[1] - b.y) / b.h * height,
      width, height, angle,
      scaleX: PROJECTION[facing][0], scaleY: PROJECTION[facing][1],
    };
  }
  return { hand, weapon };
});
