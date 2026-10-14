/* Original Siam artwork source-pixel calibration. See ASSET_PROVENANCE.md. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCSiamArt = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return Object.freeze({
  "atlases": {
    "siam-weapons": {
      "width": 1536,
      "height": 1024,
      "columns": 4,
      "rows": 2
    },
    "siam-equipment": {
      "width": 1536,
      "height": 1024,
      "columns": 4,
      "rows": 2
    },
    "siam-headgear": {
      "width": 1448,
      "height": 1086,
      "columns": 4,
      "rows": 3
    },
    "siam-novice-body": {
      "width": 1254,
      "height": 1254,
      "columns": 4,
      "rows": 4
    },
    "siam-swordman-body": {
      "width": 1254,
      "height": 1254,
      "columns": 4,
      "rows": 4
    }
  },
  "weapons": {
    "0": {
      "pivot": [
        202,
        405
      ],
      "pivotAlpha": 253
    },
    "1": {
      "pivot": [
        589,
        397
      ],
      "pivotAlpha": 252
    },
    "2": {
      "pivot": [
        960,
        349
      ],
      "support": [
        960,
        425
      ],
      "pivotAlpha": 252,
      "supportAlpha": 253
    },
    "3": {
      "pivot": [
        1348,
        300
      ],
      "support": [
        1348,
        368
      ],
      "pivotAlpha": 252,
      "supportAlpha": 252
    },
    "4": {
      "pivot": [
        65,
        842
      ],
      "support": [
        342,
        842
      ],
      "pivotAlpha": 253,
      "supportAlpha": 253
    },
    "5": {
      "pivot": [
        588,
        783
      ],
      "pivotAlpha": 252,
      "note": "Pivot is the central gold palm strip between the four lower finger holes, positions the single brass guard over a glove; runtime draws two independent copies."
    },
    "6": {
      "pivot": [
        964,
        870
      ],
      "pivotAlpha": 252
    },
    "7": {
      "pivot": [
        1423,
        744
      ],
      "support": [
        1321,
        747
      ],
      "string": [
        [
          1320,
          596
        ],
        [
          1320,
          896
        ]
      ],
      "pivotAlpha": 252,
      "supportAlpha": 245
    }
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
  },
  "bodies": {
    "siam-novice-body": [
      {
        "shoulders": [
          [
            155,
            173
          ],
          [
            205,
            173
          ]
        ],
        "head": [
          181,
          89.36
        ],
        "crown": [
          181,
          62
        ],
        "bounds": {
          "x": 121,
          "y": 62,
          "w": 122,
          "h": 228
        },
        "gutters": [
          121,
          62,
          71,
          24
        ]
      },
      {
        "shoulders": [
          [
            454,
            174
          ],
          [
            503,
            174
          ]
        ],
        "head": [
          480,
          90.6
        ],
        "crown": [
          480,
          63
        ],
        "bounds": {
          "x": 417,
          "y": 63,
          "w": 121,
          "h": 230
        },
        "gutters": [
          103,
          63,
          89,
          21
        ]
      },
      {
        "shoulders": [
          [
            755,
            174
          ],
          [
            806,
            174
          ]
        ],
        "head": [
          782,
          89.72
        ],
        "crown": [
          782,
          62
        ],
        "bounds": {
          "x": 720,
          "y": 62,
          "w": 122,
          "h": 231
        },
        "gutters": [
          93,
          62,
          99,
          21
        ]
      },
      {
        "shoulders": [
          [
            1065,
            179
          ],
          [
            1116,
            179
          ]
        ],
        "head": [
          1092,
          91.76
        ],
        "crown": [
          1092,
          65
        ],
        "bounds": {
          "x": 1019,
          "y": 65,
          "w": 137,
          "h": 223
        },
        "gutters": [
          78,
          65,
          98,
          26
        ]
      },
      {
        "shoulders": [
          [
            168,
            487
          ],
          [
            192,
            486
          ]
        ],
        "head": [
          181,
          397.44
        ],
        "crown": [
          181,
          369
        ],
        "bounds": {
          "x": 113,
          "y": 369,
          "w": 130,
          "h": 237
        },
        "gutters": [
          113,
          55,
          71,
          21
        ]
      },
      {
        "shoulders": [
          [
            470,
            490
          ],
          [
            493,
            489
          ]
        ],
        "head": [
          483,
          398.32
        ],
        "crown": [
          483,
          370
        ],
        "bounds": {
          "x": 417,
          "y": 370,
          "w": 133,
          "h": 236
        },
        "gutters": [
          103,
          56,
          77,
          21
        ]
      },
      {
        "shoulders": [
          [
            773,
            489
          ],
          [
            796,
            489
          ]
        ],
        "head": [
          785,
          398.2
        ],
        "crown": [
          785,
          370
        ],
        "bounds": {
          "x": 720,
          "y": 370,
          "w": 129,
          "h": 235
        },
        "gutters": [
          93,
          56,
          92,
          22
        ]
      },
      {
        "shoulders": [
          [
            1080,
            495
          ],
          [
            1104,
            494
          ]
        ],
        "head": [
          1093,
          400.08
        ],
        "crown": [
          1093,
          372
        ],
        "bounds": {
          "x": 1015,
          "y": 372,
          "w": 154,
          "h": 234
        },
        "gutters": [
          74,
          58,
          85,
          21
        ]
      },
      {
        "shoulders": [
          [
            154,
            797
          ],
          [
            211,
            797
          ]
        ],
        "head": [
          182,
          709.48
        ],
        "crown": [
          182,
          682
        ],
        "bounds": {
          "x": 115,
          "y": 682,
          "w": 134,
          "h": 229
        },
        "gutters": [
          115,
          55,
          65,
          30
        ]
      },
      {
        "shoulders": [
          [
            455,
            797
          ],
          [
            513,
            797
          ]
        ],
        "head": [
          482,
          709.72
        ],
        "crown": [
          482,
          682
        ],
        "bounds": {
          "x": 419,
          "y": 682,
          "w": 131,
          "h": 231
        },
        "gutters": [
          105,
          55,
          77,
          28
        ]
      },
      {
        "shoulders": [
          [
            753,
            800
          ],
          [
            811,
            800
          ]
        ],
        "head": [
          782,
          710.72
        ],
        "crown": [
          782,
          683
        ],
        "bounds": {
          "x": 715,
          "y": 683,
          "w": 134,
          "h": 231
        },
        "gutters": [
          88,
          56,
          92,
          27
        ]
      },
      {
        "shoulders": [
          [
            1066,
            801
          ],
          [
            1124,
            801
          ]
        ],
        "head": [
          1093,
          709.88
        ],
        "crown": [
          1093,
          683
        ],
        "bounds": {
          "x": 1011,
          "y": 683,
          "w": 169,
          "h": 224
        },
        "gutters": [
          70,
          56,
          74,
          34
        ]
      },
      {
        "shoulders": [
          [
            162,
            1084
          ],
          [
            189,
            1085
          ]
        ],
        "head": [
          181,
          997.24
        ],
        "crown": [
          181,
          970
        ],
        "bounds": {
          "x": 117,
          "y": 970,
          "w": 127,
          "h": 227
        },
        "gutters": [
          117,
          29,
          70,
          57
        ]
      },
      {
        "shoulders": [
          [
            462,
            1084
          ],
          [
            489,
            1084
          ]
        ],
        "head": [
          482,
          993.48
        ],
        "crown": [
          482,
          966
        ],
        "bounds": {
          "x": 415,
          "y": 966,
          "w": 131,
          "h": 229
        },
        "gutters": [
          101,
          25,
          81,
          59
        ]
      },
      {
        "shoulders": [
          [
            760,
            1085
          ],
          [
            785,
            1084
          ]
        ],
        "head": [
          782,
          992.84
        ],
        "crown": [
          782,
          965
        ],
        "bounds": {
          "x": 716,
          "y": 965,
          "w": 132,
          "h": 232
        },
        "gutters": [
          89,
          24,
          93,
          57
        ]
      },
      {
        "shoulders": [
          [
            1063,
            1085
          ],
          [
            1087,
            1085
          ]
        ],
        "head": [
          1087,
          994.48
        ],
        "crown": [
          1087,
          967
        ],
        "bounds": {
          "x": 1015,
          "y": 967,
          "w": 159,
          "h": 229
        },
        "gutters": [
          74,
          26,
          80,
          58
        ]
      }
    ],
    "siam-swordman-body": [
      {
        "shoulders": [
          [
            161,
            179
          ],
          [
            216,
            179
          ]
        ],
        "head": [
          188,
          94.32
        ],
        "crown": [
          188,
          66
        ],
        "bounds": {
          "x": 123,
          "y": 66,
          "w": 132,
          "h": 236
        },
        "gutters": [
          123,
          66,
          59,
          12
        ]
      },
      {
        "shoulders": [
          [
            460,
            180
          ],
          [
            512,
            180
          ]
        ],
        "head": [
          486,
          93.68
        ],
        "crown": [
          486,
          65
        ],
        "bounds": {
          "x": 419,
          "y": 65,
          "w": 130,
          "h": 239
        },
        "gutters": [
          105,
          65,
          78,
          10
        ]
      },
      {
        "shoulders": [
          [
            749,
            180
          ],
          [
            804,
            180
          ]
        ],
        "head": [
          777,
          93.68
        ],
        "crown": [
          777,
          65
        ],
        "bounds": {
          "x": 707,
          "y": 65,
          "w": 130,
          "h": 239
        },
        "gutters": [
          80,
          65,
          104,
          10
        ]
      },
      {
        "shoulders": [
          [
            1038,
            180
          ],
          [
            1092,
            180
          ]
        ],
        "head": [
          1065,
          93.44
        ],
        "crown": [
          1065,
          65
        ],
        "bounds": {
          "x": 993,
          "y": 65,
          "w": 149,
          "h": 237
        },
        "gutters": [
          52,
          65,
          112,
          12
        ]
      },
      {
        "shoulders": [
          [
            174,
            482
          ],
          [
            200,
            480
          ]
        ],
        "head": [
          187,
          391.64
        ],
        "crown": [
          187,
          362
        ],
        "bounds": {
          "x": 119,
          "y": 362,
          "w": 138,
          "h": 247
        },
        "gutters": [
          119,
          48,
          57,
          18
        ]
      },
      {
        "shoulders": [
          [
            474,
            481
          ],
          [
            499,
            480
          ]
        ],
        "head": [
          488,
          391.88
        ],
        "crown": [
          488,
          362
        ],
        "bounds": {
          "x": 416,
          "y": 362,
          "w": 138,
          "h": 249
        },
        "gutters": [
          102,
          48,
          73,
          16
        ]
      },
      {
        "shoulders": [
          [
            764,
            482
          ],
          [
            792,
            480
          ]
        ],
        "head": [
          779,
          391.88
        ],
        "crown": [
          779,
          362
        ],
        "bounds": {
          "x": 711,
          "y": 362,
          "w": 136,
          "h": 249
        },
        "gutters": [
          84,
          48,
          94,
          16
        ]
      },
      {
        "shoulders": [
          [
            1068,
            480
          ],
          [
            1095,
            480
          ]
        ],
        "head": [
          1082,
          391.64
        ],
        "crown": [
          1082,
          362
        ],
        "bounds": {
          "x": 1005,
          "y": 362,
          "w": 153,
          "h": 247
        },
        "gutters": [
          64,
          48,
          96,
          18
        ]
      },
      {
        "shoulders": [
          [
            151,
            774
          ],
          [
            214,
            774
          ]
        ],
        "head": [
          182,
          689.32
        ],
        "crown": [
          182,
          661
        ],
        "bounds": {
          "x": 114,
          "y": 661,
          "w": 133,
          "h": 236
        },
        "gutters": [
          114,
          34,
          67,
          44
        ]
      },
      {
        "shoulders": [
          [
            446,
            774
          ],
          [
            509,
            774
          ]
        ],
        "head": [
          479,
          689.56
        ],
        "crown": [
          479,
          661
        ],
        "bounds": {
          "x": 412,
          "y": 661,
          "w": 133,
          "h": 238
        },
        "gutters": [
          98,
          34,
          82,
          42
        ]
      },
      {
        "shoulders": [
          [
            744,
            774
          ],
          [
            807,
            774
          ]
        ],
        "head": [
          779,
          688.56
        ],
        "crown": [
          779,
          660
        ],
        "bounds": {
          "x": 714,
          "y": 660,
          "w": 135,
          "h": 238
        },
        "gutters": [
          87,
          33,
          92,
          43
        ]
      },
      {
        "shoulders": [
          [
            1041,
            773
          ],
          [
            1104,
            773
          ]
        ],
        "head": [
          1078,
          688.32
        ],
        "crown": [
          1078,
          660
        ],
        "bounds": {
          "x": 999,
          "y": 660,
          "w": 157,
          "h": 236
        },
        "gutters": [
          58,
          33,
          98,
          45
        ]
      },
      {
        "shoulders": [
          [
            168,
            1065
          ],
          [
            194,
            1066
          ]
        ],
        "head": [
          183,
          977.16
        ],
        "crown": [
          183,
          948
        ],
        "bounds": {
          "x": 109,
          "y": 948,
          "w": 139,
          "h": 243
        },
        "gutters": [
          109,
          7,
          66,
          63
        ]
      },
      {
        "shoulders": [
          [
            468,
            1063
          ],
          [
            495,
            1065
          ]
        ],
        "head": [
          480,
          978.28
        ],
        "crown": [
          480,
          949
        ],
        "bounds": {
          "x": 409,
          "y": 949,
          "w": 137,
          "h": 244
        },
        "gutters": [
          95,
          8,
          81,
          61
        ]
      },
      {
        "shoulders": [
          [
            765,
            1064
          ],
          [
            791,
            1065
          ]
        ],
        "head": [
          778,
          978.04
        ],
        "crown": [
          778,
          949
        ],
        "bounds": {
          "x": 696,
          "y": 949,
          "w": 150,
          "h": 242
        },
        "gutters": [
          69,
          8,
          95,
          63
        ]
      },
      {
        "shoulders": [
          [
            1058,
            1064
          ],
          [
            1085,
            1064
          ]
        ],
        "head": [
          1072,
          978.16
        ],
        "crown": [
          1072,
          949
        ],
        "bounds": {
          "x": 993,
          "y": 949,
          "w": 161,
          "h": 243
        },
        "gutters": [
          52,
          8,
          100,
          62
        ]
      }
    ]
  }
});
});
