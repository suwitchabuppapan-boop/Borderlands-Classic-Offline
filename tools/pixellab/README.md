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
3. `assemble.py` — cuts each frame at the neck, since the game draws a headless body
   and drops a head sprite on top. Places bodies in the game frame with feet at y=108
   and writes `js/sprite-anchors.js`, measuring head placement against the bald skull,
   which is the same across hairstyles; hair silhouettes are not.
4. `tools/build-sprite-atlas.py frames --mirror --check` — composes the atlases.

`decompose.py` holds the neck-finding heuristic: the narrowest row between 25% and 55%
of the character's height. It is reliable on upright poses and unreliable on the ones
that are lying down, which is another reason the death frames are the weak set.

## Rerunning one animation

Delete its files from `raw2/` (or `raw/`) and run the script again; both skip what is
already on disk.
