# PixelLab generation pipeline

How the character art in `assets/sprites/` was made. Nothing here is derived from
Ragnarok Online material: every frame is generated from a text description, and RO
sheets were never used as a reference or img2img input.

Requests go to `https://api.pixellab.ai/v1` with no key in the code. The key is stored
as an API credential on the cloud environment, and the agent proxy attaches it after the
request leaves the session, so it never reaches these scripts or the environment.

## Order

1. `generate.py` — bald bodies (`generate-image-pixflux`), the other two facings
   (`rotate`), the animations (`animate-with-text`), and hair inpainted onto the bald
   head (`inpaint`). Writes `raw/`, skips what already exists, so a crash resumes.
2. `regen.py` — re-runs attack and death into `raw2/`, which `assemble.py` prefers.
   The first pass asked for "slash attack" and "die falling down"; the model answered
   with swords the game draws separately, slash VFX, and some frames that were not
   characters at all. "punch forward with fist" and "fall down and lie on the ground",
   with weapons and creatures in the negative prompt, behave.
3. `slash.py` + `genslash.py` — the attack frames. Rotating the weapon sprite is not a
   slash: the arm never moves, so it reads as a spinning prop. `/animate-with-skeleton`
   takes exactly 3 keypoint frames, which is exactly the attack's column count, so the
   arm can be told to swing: raised, out, across. `estimate-skeleton` gives the resting
   pose; the arc is applied as offsets from the shoulder. Pick the sword arm by its x on
   screen, never by the LEFT/RIGHT label -- the estimator guesses which way the character
   faces, so the labels flip between directions and between the two classes.
4. `fall.py` — the death frames. `animate-with-text` cannot do this one: at the
   default image guidance the character drifts into a fish or a winged creature, and
   raising it to 3.0 anchors it so hard that "stagger backwards and collapse" returns a
   character standing still. Rotating the idle pose instead is deterministic, and is how
   2D games have always done it. Body and head rotate about the same pivot, the centre
   of the feet, so the head stays on the neck; 30, 62 and 90 degrees fill columns 10-12.
5. `assemble.py` — cuts each frame at the neck, since the game draws a headless body
   and drops a head sprite on top. Places bodies in the game frame with feet at y=108
   and writes `js/sprite-anchors.js`, measuring head placement against the bald skull,
   which is the same across hairstyles; hair silhouettes are not.
6. `tools/build-sprite-atlas.py frames --mirror --check` — composes the atlases.

`js/game.js` used to skip the hair layer on column 12, because the original art baked a
head into that body frame. `death` is `loop:false`, so the character holds that frame for
as long as it is dead — which showed a bald head the whole time. The condition is gone and
column 12 now carries its own head like every other column.

`decompose.py` holds the neck-finding heuristic: the narrowest row between 25% and 55%
of the character's height. A raised arm has no narrow neck in that band -- the width just
falls away, so the minimum lands on the band's lower edge and the cut takes the upper
torso with the head. Five of the six attack sets hit this. Every frame now passes the
idle pose's neck as a hint and falls back to it when its own answer drifts more than 4px,
which is sound because all frames are generated from the same reference and stand at the
same height.

A 502 from this API is usually transient. The first skeleton call failed through every
retry and looked like a paid-tier wall; the same request succeeded moments later.

## Rerunning one animation

Delete its files from `raw2/` (or `raw/`) and run the script again; both skip what is
already on disk.
