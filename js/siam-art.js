/* Original Siam item/headgear atlas dimensions. See ASSET_PROVENANCE.md. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCSiamArt = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return Object.freeze({
  "atlases": {
    "class-weapons": {"width":1536,"height":1024,"columns":4,"rows":2},
    "siam-weapons": {"width":1536,"height":1024,"columns":4,"rows":2},
    "siam-equipment": {"width":1536,"height":1024,"columns":4,"rows":2},
    "siam-headgear": {"width":1448,"height":1086,"columns":4,"rows":3}
  },
  "iconBounds": {"class-weapons":[{"x":64,"y":64,"w":277,"h":407},{"x":403,"y":31,"w":362,"h":451},{"x":824,"y":181,"w":242,"h":241},{"x":1136,"y":149,"w":363,"h":315},{"x":37,"y":504,"w":372,"h":465},{"x":423,"y":511,"w":311,"h":445},{"x":764,"y":619,"w":370,"h":280},{"x":1181,"y":502,"w":310,"h":454}]},
  "headgear": {
    "rowPixelBands": [
      0,
      382,
      706,
      1086
    ],
    "runtimeDirectionColumns": [
      0,
      3,
      2,
      1
    ]
  }
  });
});
