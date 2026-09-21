# Replacement character art brief

What to generate so `tools/build-sprite-atlas.py` can compose it into the
atlases `js/game.js` loads. Written for an AI pixel-art generator, but any
artist can work from it.

## Originality

Draw original characters. Matching the general look of early-2000s isometric
Korean MMO sprites is fine -- a visual style is not what copyright protects.
Reproducing Ragnarok Online's actual Novice or Swordman sprites is not, and is
the reason the current art cannot ship. Never feed RO sprite sheets in as a
reference image or an img2img source: the output inherits the original pixels.
If a result looks like a specific RO job sprite rather than a character of that
genre, regenerate it.

`.gitignore` blocks these filenames by name, so finished art is added with
`git add -f assets/sprites/` after checking where it came from.

## Style direction

- 3/4 overhead view, the camera looking down at roughly 45 degrees.
- Chibi proportions, about 2.5 heads tall. The head is large and round.
- Soft, desaturated palette. The existing monsters and item icons sit around
  70-90% saturation with mid-tone shadows, no pure black outline.
- Keep the palette small, roughly 16-32 colours per character. The original art
  used 71-117 colours across a whole sheet.
- No anti-aliasing on the silhouette edge; the canvas renders with
  `imageSmoothingEnabled=false` and soft edges turn to mud.
- Transparent background, not a colour key.

## Canvas and placement

These are hard constraints. Frames that ignore them render floating, sunk into
the ground, or off-centre, because `SPRITE_LIBRARY` positions every frame by
the same anchor.

| | frame size | centre x | feet y | head box |
|---|---|---|---|---|
| novice | 64x112 | 32 | 108 | x 18-45, y 21-46 |
| swordman | 96x112 | 47 | 108 | x 34-61, y 20-45 |
| hair | 64x48 | 32 | - | fills the frame |

The head box matters because `js/sprite-anchors.js` holds 208 offsets that drop
the 64x48 hair sprite onto each body frame, measured against the original art.
Put the head inside that box and the existing anchors keep working. Put it
elsewhere and every anchor needs re-measuring, which is doable but is extra
work -- say so and the anchors can be regenerated from the new art instead.

Hair sprites are drawn on top of the body, so they only need the hair itself
plus whatever of the head it covers. They must line up with the head box above.

## Directions

Three drawings cover four directions when the atlas is built with `--mirror`:

- `down` -- facing the camera
- `side` -- facing left; the builder flips it for the right-facing row
- `up` -- seen from behind

## Frames

Columns map to animations in `SPRITE_ANIMS`. The recommended 8-column set is
marked; the builder fills the rest by cycling within the same animation, so a
two-frame walk becomes a real two-step cycle.

| column | animation | draw? | pose |
|---|---|---|---|
| 00 | idle | yes | standing at rest, weight even |
| 01 | idle | no | fills from 00 |
| 02 | walk | yes | left foot forward, body dipped slightly |
| 03 | walk | yes | right foot forward, body dipped slightly |
| 04-05 | walk | no | fills from 02, 03 |
| 06 | attack | yes | wind-up, arm drawn back |
| 07 | attack | yes | strike, arm extended, body leaning in |
| 08 | attack | no | fills from 06 |
| 09 | hit | yes | recoiling backwards, head tilted back |
| 10 | death | yes | collapsing, knees buckling |
| 11 | death | yes | on the ground, flat |
| 12 | death | no | fills from 10 |

Column 12 never draws the hair layer, so hair needs no frame for it.

## The two characters

**novice** -- a beginner. Plain cloth tunic, simple trousers, no armour, no
weapon in hand. The game draws the weapon as a separate layer
(`drawEquippedWeapon`), so leave the hands empty.

**swordman** -- the same character grown up. Light armour over the tunic,
shoulder pieces, boots. Wider frame at 96px because of the stance and armour.
Again no weapon in hand.

## Hair

19 styles are selectable in the appearance picker. Generate as many distinct
designs as you want the player to have; the builder repeats whatever it is
given across all 19 files and reports which ones were reused.

Draw them in a neutral light tone. The original art used near-white hair so a
palette swap could recolour it, and that still reads fine unrecoloured.

## File count and naming

```
body_<novice|swordman>_<down|side|up>_<00..12>.png
hair_<00..18>_<down|side|up>.png
```

| set | bodies | hair | total |
|---|---|---|---|
| full, all 13 columns, 19 styles | 78 | 57 | 135 |
| **recommended: 8 columns, 6 styles** | **48** | **18** | **66** |
| floor: idle only, 1 style | 6 | 3 | 9 |

Without `--mirror` the body and hair counts rise by a third.

## Building

```
python3 tools/build-sprite-atlas.py <frames-dir> --mirror --check
```

Writes `assets/sprites/body_novice.png`, `body_swordman.png` and
`hair_00..18.png`, then verifies the sizes `tests/layered_sprite_v15b.test.js`
asserts. Check the result with the Node suite and a real launch:

```
for f in tests/*.test.js tests/offline_check.js; do node "$f"; done
```
