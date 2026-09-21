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

Bodies are animated, so each column is its own drawing. Hair is not: the
shipped atlases repeat one image per direction across columns 0-11 and leave
column 12 empty, because drawLayeredCharacter() skips the hair layer on the
last death frame. So one hair image per direction is all this script needs.

Missing body columns are filled from the idle frame of the same direction and
reported, so a partial set still produces a loadable atlas.

Feet sit at y=108 in a 112px body frame (anchorY in SPRITE_LIBRARY) and the
character is centred on x=32 (novice) or x=48 (swordman). Frames that ignore
that will render at the wrong height or off-centre.

Head placement comes from js/sprite-anchors.js, which was measured against the
original art. New body frames that put the head somewhere else need those
anchors re-measured -- this script does not do that.

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
# Column 12 is the only one drawLayeredCharacter() never draws hair on.
HAIR_BLANK_COLUMN = 12
IDLE_COLUMN = 0


def load_exact(path, size):
    """Open a PNG and fail loudly if it is not exactly the expected size."""
    img = Image.open(path).convert("RGBA")
    if img.size != size:
        raise SystemExit(f"{path.name}: expected {size[0]}x{size[1]}, got {img.width}x{img.height}")
    return img


def build_body(name, src_dir, out_dir):
    fw, fh = BODIES[name]
    atlas = Image.new("RGBA", (fw * COLUMNS, fh * ROWS), (0, 0, 0, 0))
    substituted = []
    for row, direction in enumerate(DIRECTIONS):
        idle_path = src_dir / f"body_{name}_{direction}_{IDLE_COLUMN:02d}.png"
        if not idle_path.exists():
            raise SystemExit(f"missing {idle_path.name}; the idle frame of every direction is required")
        idle = load_exact(idle_path, (fw, fh))
        for col in range(COLUMNS):
            path = src_dir / f"body_{name}_{direction}_{col:02d}.png"
            if path.exists():
                frame = load_exact(path, (fw, fh))
            else:
                frame = idle
                substituted.append(path.name)
            atlas.paste(frame, (col * fw, row * fh))
    out = out_dir / f"body_{name}.png"
    atlas.save(out)
    return out, atlas.size, substituted


def build_hair(style, src_dir, out_dir):
    atlas = Image.new("RGBA", (HAIR_W * COLUMNS, HAIR_H * ROWS), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        path = src_dir / f"hair_{style:02d}_{direction}.png"
        if not path.exists():
            raise SystemExit(f"missing {path.name}")
        frame = load_exact(path, (HAIR_W, HAIR_H))
        for col in range(COLUMNS):
            if col == HAIR_BLANK_COLUMN:
                continue
            atlas.paste(frame, (col * HAIR_W, row * HAIR_H))
    out = out_dir / f"hair_{style:02d}.png"
    atlas.save(out)
    return out, atlas.size


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
    args = ap.parse_args()

    if not args.input_dir.is_dir():
        sys.exit(f"{args.input_dir} is not a directory")
    args.out.mkdir(parents=True, exist_ok=True)

    substituted = []
    for name in BODIES:
        path, size, subs = build_body(name, args.input_dir, args.out)
        substituted += subs
        print(f"wrote {path}  {size[0]}x{size[1]}")
    for style in range(HAIR_STYLES):
        path, size = build_hair(style, args.input_dir, args.out)
        print(f"wrote {path}  {size[0]}x{size[1]}")

    if substituted:
        print(f"\n{len(substituted)} body frames were missing and reused their direction's idle frame:")
        for name in substituted:
            print(f"  {name}")
        print("The atlas loads, but those animations will not move.")

    if args.check:
        print("\nchecking written atlases against the sizes tests/layered_sprite_v15b.test.js asserts:")
        if check(args.out):
            sys.exit(1)
        print("all atlases match")


if __name__ == "__main__":
    main()
