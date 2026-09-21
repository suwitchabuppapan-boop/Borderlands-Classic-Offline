# Asset provenance

This repository is intended to contain the **GitHub-safe v1.5b master**, not the personal-use artwork package.

- Character head/body sprites derived from user-provided Ragnarok Online sheets: **not uploaded**. The GitHub-safe package provides independently drawn, simple placeholder head/body sprites instead.
- Phieti skin bitmaps provided by the user: **not uploaded**. The GitHub-safe package replaces their CSS image backgrounds with plain styling.
- Generated monster sprites, item icons and sword replacements belong to the offline project; do not mistake them for official Ragnarok art.
- Existing `LICENSE-GPL-3.0.txt` in the source package does not license any third-party artwork.
- Do not upload credentials, save files, or original third-party sprite sheets. A private repository is not a copyright license.

**Current state:** the source tree and the project's own art (7 monster sprites, 28 item icons, 3 weapon sprites) are committed. Character head/body atlases and the Phieti skin bitmaps remain **not uploaded**, so `css/style.css` still references `../assets/phieti/*.png` files that are absent here and `js/game.js` still loads `assets/sprites/hair_*.png` and `body_*.png` that are absent here. Replacing that artwork is the remaining work; until then this repository is source-complete but art-incomplete.
