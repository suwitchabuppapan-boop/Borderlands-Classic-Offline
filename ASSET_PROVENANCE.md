# Asset provenance

The current game uses 27 Siam fantasy WebP images under `assets/art/`. They were recovered without alteration from published 1.12 `gh-pages` commit `f7b3cf90fe7a513c8c452d7085b40dbfe9cb04d8`, preserved in source recovery commit `eefb5c30bdf2a2f28ccc6210f25d3bebe3231149`.

They comprise three maps, one monster atlas, one townsfolk atlas, sixteen complete class/weapon animation atlases and six equipment/item/headgear atlases. Class sprites contain their own body, arms and canonical held weapons. Runtime portrait/crop metadata is in `js/siam-art.js` and `js/school-art.js`.

Versions 1.13–1.18 change none of these image bytes or authored class crop definitions. Version 1.15 uses original Canvas shapes in `js/vfx-painter.js`, `js/vfx-weapons.js`, `js/vfx-skills.js` and `js/combat-effects.js`. Version 1.16 adds original five-by-seven pixel letter masks and geometric critical stars in `js/damage-text.js`, using the user's reference as a style guide. Version 1.17 adds 58 original reusable geometric templates and 61 skill recipes in `js/effect-parts.js`; weapon-tip sockets use the canonical full-body animation poses without separate arm or weapon artwork. The classic fantasy effects and combat text use no downloaded images, fonts or third-party effect assets.

Version 1.18 arranges the existing original SVG skill icons into compact class boards; it copies no images or icons from the supplied skill-planner reference.

The current public runtime does not use the historical user-provided Ragnarok/Phieti sprite or skin packages. Do not copy those old packages or personal saves into the public site. The obsolete package README files were removed in 1.16. `LICENSE-GPL-3.0.txt` does not grant rights to unrelated third-party artwork.


Version 1.21 replaces only `assets/art/school-dual-sword.webp` for the authorized conversion of Royal Duelist to **ขุนดาบราชัน**, wielding one two-handed Siam greatsword. The existing asset path and class ID remain stable for save compatibility. The other 26 original image files remain byte-for-byte unchanged.

The replacement is original AI-generated art based on the existing complete class sprite as a visual reference. The final atlas uses the full-sheet generation `exec-e7beac7b-a6ed-4505-944b-88cfc77712a0.png` and one complete back-facing windup pose from `exec-bf5cf006-3a65-41e5-9476-7f8351e7a00d.png`. Intermediate generations corrected the weapon grip. All poses contain their body, clothing, arms, hands and single sword together; no separate limb or held-weapon overlay is attached at runtime. Idle/walking frames include a relaxed carrying grip, while attack poses use the authored windup, contact and recovery grip.

ImageMagick mechanically isolated complete connected poses, resized them as intact units, arranged 24 poses in a transparent 1536×1024 atlas, and encoded the result as lossless WebP. No body part or weapon was painted or independently transformed during packing. `js/school-art.js` stores the measured absolute bounds, foot, head, hair rectangle and body height for those 24 frames. New atlas SHA-256: `9009963aa95dda63464dc9cce25ca8850d15975c0801d4bfb81015bab9d2fd1e`. Weapon-tip effect sockets are measured from the same authored attack poses.
