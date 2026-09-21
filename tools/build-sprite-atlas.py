#!/usr/bin/env python3
"""Compose individual character frames into the sprite atlases js/game.js loads.

The game reads three kinds of atlas, each laid out as 13 columns by 4 rows:

    rows    0 down, 1 left, 2 right, 3 up          (DIR_ROWS in js/game.js)
    columns 0-1 idle, 2-5 walk, 6-8 attack,        (SPRITE_ANIMS in js/game.js)
            9 hit, 10-12 death

    assets/sprites/body_novice.png     64x112 frames -> 832x448
    assets/sprites/body_swordman.png   96x112 frames -> 1248x448
    assets/sprites/hair_00..18.png     64x48  frames -> 832x192

Input files are individual PNGs in one directory, named:

    body_<novice|swordman>_<down|left|right|up>_<00..12>.png
    hair_<00..18>_<down|left|right|up>.png

Bodies are animated, so each column is its own drawing. Hair mostly is not: one
image per direction is repeated across the row, which is why 19 styles cost 57
drawings rather than 988. A column that needs its own head supplies
hair_<NN>_<direction>_<col>.png, which wins for that column alone -- the death
frames use this, because a character tipping over has to tip its head too.

Missing body columns are filled from the idle frame of the same direction and
reported, so a partial set still produces a loadable atlas.

Feet sit at y=108 in a 112px body frame (anchorY in SPRITE_LIBRARY) and the
character is centred on x=32 (novice) or x=48 (swordman). Frames that ignore
that will render at the wrong height or off-centre.

Head placement comes from js/sprite-anchors.js. tools/pixellab/assemble.py
regenerates it alongside the frames; body art from anywhere else that puts the
head elsewhere needs those anchors re-measured, which this script does not do.

Usage:
    python3 tools/build-sprite-atlas.py <input-dir> [--out assets/sprites] [--check]
"""
import argparse
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

DIRECTIONS = ["down", "left", "right", "up"]
COLUMNS = 13
ROWS = 4
HAIR_W, HAIR_H = 64, 48
HAIR_STYLES = 19
BODIES = {"novice": (64, 112), "swordman": (96, 112)}
# Column 12 is the last death frame. drawLayeredCharacter() used to skip the hair
# layer there, because the original art baked a head into that body frame; it now
# draws every column, so column 12 needs its own head like any other.
HAIR_BLANK_COLUMN = None
IDLE_COLUMN = 0
# Which columns belong to each animation, so a short set can be cycled to fill
# its own animation instead of freezing on the idle pose.
ANIM_GROUPS = {
    "idle": [0, 1],
    "walk": [2, 3, 4, 5],
    "attack": [6, 7, 8],
    "hit": [9],
    "death": [10, 11, 12],
}


def load_exact(path, size):
    """Open a PNG and fail loudly if it is not exactly the expected size."""
    img = Image.open(path).convert("RGBA")
    if img.size != size:
        raise SystemExit(f"{path.name}: expected {size[0]}x{size[1]}, got {img.width}x{img.height}")
    return img


def source_directions(mirror):
    """Which directions the input must supply, and how rows are filled from them.

    With --mirror the caller draws 'side' once and row 2 (right) becomes its
    horizontal flip, which is a third less drawing. The original art does not
    work this way -- its left and right rows are separate drawings, not flips --
    but nothing in the game requires them to differ.
    """
    if mirror:
        return ["down", "side", "up"], [("down", False), ("side", False), ("side", True), ("up", False)]
    return DIRECTIONS, [(d, False) for d in DIRECTIONS]


def resolve_columns(prefix, src_dir, ext="png"):
    """Map all 13 columns onto the frames actually supplied.

    Columns provided for an animation are cycled across the rest of that same
    animation, so two walk drawings become a real two-step walk cycle rather
    than four identical frames.
    """
    mapping, filled = {}, []
    idle_given = [c for c in ANIM_GROUPS["idle"] if (src_dir / f"{prefix}_{c:02d}.{ext}").exists()]
    if not idle_given:
        raise SystemExit(f"missing {prefix}_{IDLE_COLUMN:02d}.{ext}; every direction needs at least its idle frame")
    for anim, cols in ANIM_GROUPS.items():
        given = [c for c in cols if (src_dir / f"{prefix}_{c:02d}.{ext}").exists()]
        pool = given or idle_given
        for i, col in enumerate(cols):
            if col in given:
                mapping[col] = col
            else:
                mapping[col] = pool[i % len(pool)]
                filled.append((f"{prefix}_{col:02d}.{ext}", anim, mapping[col]))
    return mapping, filled


def build_body(name, src_dir, out_dir, mirror=False):
    fw, fh = BODIES[name]
    atlas = Image.new("RGBA", (fw * COLUMNS, fh * ROWS), (0, 0, 0, 0))
    substituted = []
    for row, (direction, flip) in enumerate(source_directions(mirror)[1]):
        prefix = f"body_{name}_{direction}"
        mapping, filled = resolve_columns(prefix, src_dir)
        if not flip:
            substituted += filled
        cache = {}
        for col in range(COLUMNS):
            src_col = mapping[col]
            if src_col not in cache:
                frame = load_exact(src_dir / f"{prefix}_{src_col:02d}.png", (fw, fh))
                cache[src_col] = frame.transpose(Image.FLIP_LEFT_RIGHT) if flip else frame
            atlas.paste(cache[src_col], (col * fw, row * fh))
    out = out_dir / f"body_{name}.png"
    atlas.save(out)
    return out, atlas.size, substituted


def available_hair_styles(src_dir, mirror):
    """Style numbers that have every direction they need."""
    needed, _ = source_directions(mirror)
    return [s for s in range(HAIR_STYLES)
            if all((src_dir / f"hair_{s:02d}_{d}.png").exists() for d in needed)]


def build_hair(style, source_style, src_dir, out_dir, mirror=False):
    """One head per direction fills the row, except where a column overrides it.

    Most columns reuse a single drawing, which is why 19 styles cost 57 drawings
    rather than 988. A column that needs its own head -- the death frames, where the
    character is tipping over and the head has to tip with the body -- supplies
    hair_<NN>_<direction>_<col>.png and that file wins for that column alone.
    """
    atlas = Image.new("RGBA", (HAIR_W * COLUMNS, HAIR_H * ROWS), (0, 0, 0, 0))
    overrides = 0
    for row, (direction, flip) in enumerate(source_directions(mirror)[1]):
        default = load_exact(src_dir / f"hair_{source_style:02d}_{direction}.png", (HAIR_W, HAIR_H))
        for col in range(COLUMNS):
            if col == HAIR_BLANK_COLUMN:
                continue
            per_col = src_dir / f"hair_{source_style:02d}_{direction}_{col:02d}.png"
            if per_col.exists():
                frame = load_exact(per_col, (HAIR_W, HAIR_H))
                if not flip:
                    overrides += 1
            else:
                frame = default
            if flip:
                frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
            atlas.paste(frame, (col * HAIR_W, row * HAIR_H))
    out = out_dir / f"hair_{style:02d}.png"
    atlas.save(out)
    return out, atlas.size, overrides


def check(out_dir):
    """Re-read what was written and confirm it matches what the tests assert."""
    expected = {"body_novice.png": (832, 448), "body_swordman.png": (1248, 448)}
    for style in range(HAIR_STYLES):
        expected[f"hair_{style:02d}.png"] = (832, 192)
    bad = 0
    for name, size in sorted(expected.items()):
        path = out_dir / name
        if not path.exists():
            print(f"  MISSING  {name}")
            bad += 1
            continue
        got = Image.open(path).size
        flag = "ok" if got == size else f"WRONG, expected {size[0]}x{size[1]}"
        if got != size:
            bad += 1
        print(f"  {got[0]}x{got[1]:<4} {name}  {flag}")
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input_dir", type=pathlib.Path, help="directory holding the individual frame PNGs")
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path("assets/sprites"))
    ap.add_argument("--check", action="store_true", help="verify the written atlases and exit non-zero on a mismatch")
    ap.add_argument("--mirror", action="store_true",
                    help="take 'side' instead of 'left' and 'right', and flip it for the right-facing row")
    args = ap.parse_args()

    if not args.input_dir.is_dir():
        sys.exit(f"{args.input_dir} is not a directory")
    args.out.mkdir(parents=True, exist_ok=True)

    substituted = []
    for name in BODIES:
        path, size, subs = build_body(name, args.input_dir, args.out, args.mirror)
        substituted += subs
        print(f"wrote {path}  {size[0]}x{size[1]}")

    styles = available_hair_styles(args.input_dir, args.mirror)
    if not styles:
        sys.exit("no complete hair style found; hair_00 needs every direction at minimum")
    reused, overridden = [], 0
    for style in range(HAIR_STYLES):
        source = style if style in styles else styles[style % len(styles)]
        if source != style:
            reused.append((style, source))
        path, size, ov = build_hair(style, source, args.input_dir, args.out, args.mirror)
        overridden += ov
        print(f"wrote {path}  {size[0]}x{size[1]}")

    if substituted:
        print(f"\n{len(substituted)} body frames were not supplied and were filled from their own animation:")
        for missing, anim, src_col in substituted:
            print(f"  {missing:<28} {anim} <- column {src_col:02d}")
        print("Animations with a single source frame will not appear to move.")

    if reused:
        print(f"\n{len(reused)} hair styles were not drawn and reuse another style:")
        print("  " + ", ".join(f"{s:02d}<-{src:02d}" for s, src in reused))
        print("Those entries in the appearance picker will look identical.")

    if overridden:
        print(f"\n{overridden} head frames came from a per-column file rather than the "
              "direction's single drawing.")

    if args.check:
        print("\nchecking written atlases against the sizes tests/layered_sprite_v15b.test.js asserts:")
        if check(args.out):
            sys.exit(1)
        print("all atlases match")


if __name__ == "__main__":
    main()
