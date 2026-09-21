# Asset provenance

This repository is intended to contain the **GitHub-safe v1.5b master**, not the personal-use artwork package.

- Character head/body sprites derived from user-provided Ragnarok Online sheets: **not uploaded**. The GitHub-safe package provides independently drawn, simple placeholder head/body sprites instead.
- Phieti skin bitmaps provided by the user: **not uploaded**. The GitHub-safe package replaces their CSS image backgrounds with plain styling.
- Generated monster sprites, item icons and sword replacements belong to the offline project; do not mistake them for official Ragnarok art.
- Existing `LICENSE-GPL-3.0.txt` in the source package does not license any third-party artwork.
- Do not upload credentials, save files, or original third-party sprite sheets. A private repository is not a copyright license.

**Current state:** complete. The source tree, the project's own art (7 monster sprites, 28 item icons, 3 weapon sprites) and generated character atlases (`hair_00..18.png`, `body_novice.png`, `body_swordman.png`) are all here, and `css/style.css` no longer references `assets/phieti/` at all - that window chrome is drawn with CSS gradients. Every character frame was generated from a text description through PixelLab; no Ragnarok sheet was used as a reference or img2img source. `tools/pixellab/` documents how, so the art can be regenerated or replaced.
