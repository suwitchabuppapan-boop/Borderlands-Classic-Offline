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
    "siam-headgear": {"width":1448,"height":1086,"columns":4,"rows":3},
    "item-catalog": {"width":1254,"height":1254,"columns":4,"rows":4},
    "weapon-upgrades-v2": {"width":1254,"height":1254,"columns":4,"rows":4}
  },
  "iconBounds": {
    "class-weapons":[{"x":64,"y":64,"w":277,"h":407},{"x":403,"y":31,"w":362,"h":451},{"x":824,"y":181,"w":242,"h":241},{"x":1136,"y":149,"w":363,"h":315},{"x":37,"y":504,"w":372,"h":465},{"x":423,"y":511,"w":311,"h":445},{"x":764,"y":619,"w":370,"h":280},{"x":1181,"y":502,"w":310,"h":454}],
    "weapon-upgrades-v2":[
      {"x":79,"y":105,"w":197,"h":213},{"x":381,"y":103,"w":191,"h":216},
      {"x":664,"y":102,"w":217,"h":218},{"x":966,"y":91,"w":232,"h":226},
      {"x":79,"y":400,"w":191,"h":229},{"x":378,"y":400,"w":192,"h":228},
      {"x":671,"y":403,"w":215,"h":232},{"x":975,"y":405,"w":221,"h":229},
      {"x":70,"y":713,"w":228,"h":175},{"x":363,"y":706,"w":231,"h":182},
      {"x":689,"y":699,"w":213,"h":197},{"x":1014,"y":696,"w":169,"h":214},
      {"x":75,"y":990,"w":214,"h":191},{"x":389,"y":982,"w":207,"h":198},
      {"x":721,"y":930,"w":176,"h":259},{"x":1005,"y":930,"w":172,"h":263}
    ],
    "item-catalog":[
      {"x":14,"y":63,"w":308,"h":196},{"x":334,"y":63,"w":292,"h":218},
      {"x":630,"y":63,"w":304,"h":210},{"x":956,"y":63,"w":287,"h":216},
      {"x":21,"y":365,"w":304,"h":187},{"x":350,"y":355,"w":258,"h":189},
      {"x":653,"y":401,"w":270,"h":136},{"x":959,"y":352,"w":270,"h":192},
      {"x":46,"y":599,"w":232,"h":330},{"x":345,"y":593,"w":253,"h":347},
      {"x":631,"y":605,"w":298,"h":341},{"x":947,"y":635,"w":290,"h":320},
      {"x":53,"y":948,"w":261,"h":274},{"x":345,"y":955,"w":257,"h":261},
      {"x":616,"y":975,"w":314,"h":230},{"x":955,"y":996,"w":276,"h":200}
    ]
  },
  "headgear": {
    "overlays": {
      "lotus_hat": {"atlas":"item-catalog","frames":[
        {"cell":0,"width":18,"socket":[168,199]},
        {"cell":3,"width":16,"socket":[1091,207]},
        {"cell":2,"width":18,"socket":[782,214]},
        {"cell":1,"width":16,"socket":[486,208]}
      ]},
      "moon_crown": {"atlas":"item-catalog","frames":[
        {"cell":4,"width":16,"socket":[173,461]},
        {"cell":5,"width":14,"socket":[479,456]},
        {"cell":6,"width":16,"socket":[788,456]},
        {"cell":7,"width":14,"socket":[1094,451]}
      ]}
    },
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
