# Asset provenance

The current game uses 27 Siam fantasy WebP images under `assets/art/`. They were recovered without alteration from published 1.12 `gh-pages` commit `f7b3cf90fe7a513c8c452d7085b40dbfe9cb04d8`, preserved in source recovery commit `eefb5c30bdf2a2f28ccc6210f25d3bebe3231149`.

They comprise three maps, one monster atlas, one townsfolk atlas, sixteen complete class/weapon animation atlases and six equipment/item/headgear atlases. Class sprites contain their own body, arms and canonical held weapons. Runtime portrait/crop metadata is in `js/siam-art.js` and `js/school-art.js`.

Versions 1.13–1.15 change none of these image bytes or authored class crop definitions. Version 1.15 uses original Canvas shapes in `js/vfx-painter.js`, `js/vfx-weapons.js`, `js/vfx-skills.js` and `js/combat-effects.js`. The classic fantasy effects, including the red/gold critical burst, use no downloaded images or third-party effect assets.

The current public runtime does not use the historical user-provided Ragnarok/Phieti sprite or skin packages. Do not copy those old packages or personal saves into the public site. Historical v1.3–v1.5b README files refer to older packages and are not a manifest of the present art. `LICENSE-GPL-3.0.txt` does not grant rights to unrelated third-party artwork.
