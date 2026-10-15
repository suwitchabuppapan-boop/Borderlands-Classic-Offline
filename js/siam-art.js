/* Original Siam item/headgear atlas dimensions. See ASSET_PROVENANCE.md. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCSiamArt = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return Object.freeze({
  "atlases": {
    "siam-weapons": {"width":1536,"height":1024,"columns":4,"rows":2},
    "siam-equipment": {"width":1536,"height":1024,"columns":4,"rows":2},
    "siam-headgear": {"width":1448,"height":1086,"columns":4,"rows":3}
  },
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
