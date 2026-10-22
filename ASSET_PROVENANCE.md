# Asset provenance

The current game uses 27 Siam fantasy WebP images under `assets/art/`. They were recovered without alteration from published 1.12 `gh-pages` commit `f7b3cf90fe7a513c8c452d7085b40dbfe9cb04d8`, preserved in source recovery commit `eefb5c30bdf2a2f28ccc6210f25d3bebe3231149`.

They comprise three maps, one monster atlas, one townsfolk atlas, sixteen complete class/weapon animation atlases and six equipment/item/headgear atlases. Class sprites contain their own body, arms and canonical held weapons. Runtime portrait/crop metadata is in `js/siam-art.js` and `js/school-art.js`.

Versions 1.13–1.18 change none of these image bytes or authored class crop definitions. Version 1.15 uses original Canvas shapes in `js/vfx-painter.js`, `js/vfx-weapons.js`, `js/vfx-skills.js` and `js/combat-effects.js`. Version 1.16 adds original five-by-seven pixel letter masks and geometric critical stars in `js/damage-text.js`, using the user's reference as a style guide. Version 1.17 adds 58 original reusable geometric templates and 61 skill recipes in `js/effect-parts.js`; weapon-tip sockets use the canonical full-body animation poses without separate arm or weapon artwork. The classic fantasy effects and combat text use no downloaded images, fonts or third-party effect assets.

Version 1.18 arranges the existing original SVG skill icons into compact class boards; it copies no images or icons from the supplied skill-planner reference.

The current public runtime does not use the historical user-provided Ragnarok/Phieti sprite or skin packages. Do not copy those old packages or personal saves into the public site. The obsolete package README files were removed in 1.16. `LICENSE-GPL-3.0.txt` does not grant rights to unrelated third-party artwork.
