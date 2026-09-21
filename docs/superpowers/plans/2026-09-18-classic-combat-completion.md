# Classic Combat Completion Plan (v1.4.2)

Goal: repair previously documented limitations in currently playable Novice/Swordman combat while preserving saves, UI, and local API cache.

Architecture: extend pure functions in js/core.js, wire state changes via js/game.js, maintain curated DB in js/classic-data.js and refresh release documentation. Do not invent additional player classes or import proprietary art.

- [x] Add tests proving fire bonus and Magnum prerequisite calculations; change matching DB/core formulas.
- [x] Add test cases for elemental immunity and absorb, critical/DEF, magic resolver, then implement pure functions.
- [x] Add tests for weight thresholds and Swordman job capacity; wire weight HUD, regen and action guards.
- [x] Add tests for Poison, Blind, Stun, Silence, status Save/Load and Green Potion; wire core and browser gameplay.
- [x] Verify Poison reduces actual incoming damage (red test then fix).
- [x] Run game-in-browser integration (Hotbar, Magnum, Save/Load, weight and main gameplay).
- [x] Final ZIP integrity and full regression verification (release gate completed; rerun before handoff).

Known limitation: complete for supported single-player subset only, not complete Ragnarok.
