# Siam Arun — สยามอรุณ

A single-player Thai fantasy browser RPG. Start as a villager, choose one of five Class 1 paths, then one of ten Class 2 branches. Explore three maps, fight monsters, complete quests and collect equipment. Progress is saved locally in your browser.

Play: https://suwitchabuppapan-boop.github.io/Borderlands-Classic-Offline/

Version **1.19** adds quantity controls to merchant purchases and inventory sales. Type a whole number, use **− / +**, or choose **สูงสุด** for the current funds, available stock and carrying room. Check the total price and projected weight before trading. Purchases allow 1–999 items per transaction; sales allow a whole stack up to 100,000. Only items in the inventory can be sold, and trading requires proximity to the merchant.

Item weights now use smaller units, with weapons weighing 4–13 and most supplies/drops weighing 1–2. Capacity is **6,000 + Base Lv. × 800 + STR × 30**; it grows with level for every class. The bag shows its live weight, percent used, free room and three heaviest item stacks. Equipped items count once. Natural recovery still stops at 50% weight and attacking at 90%. This balance targets 2–3 hours between selling trips; the actual duration depends on build, map and supplies.

The skill tree retains compact Class 1, Class 2 and shared icon boards. Use **− / +** to prepare skill points, then **ยืนยันเรียน** to learn the complete allocation. Minus removes only unconfirmed additions. All 61 skills, 58 Effect Parts, current-class inheritance and background farming remain available. Item prices and drop chances are unchanged. Existing current-format 1.16/1.17/1.18 progress imports retain their progress and quantities; weights are recalculated from the current catalog.

## Run and test

The game uses static HTML, CSS and JavaScript Canvas. No npm packages, build step, server backend, API key or database is required. For local development:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

From another terminal in the repository, with Node.js, Python Playwright and Chromium installed:

```sh
node --test tests/*.test.js
python3 scripts/test_browser.py --base-url http://127.0.0.1:8765/ --artifacts /tmp/siam-browser
python3 scripts/release_site.py stage --out /tmp/siam-release
```

See [scripts/README.md](scripts/README.md) for packaging and verification of public files. The parity tests use the 1.12 recovery commit in Git history; those comparisons are explicitly skipped in a source ZIP without Git history. The remaining action and browser tests still run. Current evidence and limits are in [TEST_RESULTS.md](TEST_RESULTS.md).

Move with WASD/arrows or click the map. Click a monster to approach and attack, use Space to attack, and use hotbar keys 1–9. Menus keep the simulation running. Shops require proximity to the merchant; ครูอิน handles quests and class changes; หมอมะลิ heals for free. Auto Quest handles the three main quests using normal movement, combat, supplies and rewards. Prepare equipment and stats first.

Keep the game page open for background farming. A shared fixed-step clock prevents RAF and background timers from counting time twice. If the browser freezes or throttles a minimized tab, elapsed time is replayed through actual combat on resume in bounded chunks; commands wait until outstanding time is settled. Browser/OS suspension may prevent real-time work while hidden. Closing/reloading the page does not grant offline rewards or restore automatic farming.

## Saves, source and artwork

Use the Settings menu to export/import a backup. Storage key: `borderlands-solo-rebuilt-v1`. Current-format saves require the current class, stat version and four equipment slots. Unrecognized item/skill IDs and their bindings are discarded; current progress is preserved. A current 1.16 save upgrades its 45 new skills to level zero while preserving progress and points. New saves include skill schema version 2. Earlier classless/statless/headless formats are rejected.

The catalog contains 59 items: 42 obtainable now and 17 planned. There are 61 skills: 45 class actives, 15 class passives and shared First Aid. Skills cost points to learn; new skills are not automatically unlocked. Planned bosses and drops shown in the guide are not live encounters. The 11 weapon paths each have three grades.

Current art consists of 27 Siam fantasy atlases/images, preserved from published 1.12. This release adds Canvas geometry and no bitmap artwork. The approved skill and Part recipes are recorded in [the design](docs/superpowers/specs/2026-10-20-class-skills-effect-parts-design.md). See [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). Historical pre-rebuild package README files have been removed.

The cloud checkout initially contained old `main`; published 1.12 was recovered from `gh-pages` into commit `eefb5c3`. Current source, tests and docs are maintained on `codex/siam-arun-combat-effects`. Do not overwrite this version with historical sprite packages.
