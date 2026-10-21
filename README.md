# Siam Arun — สยามอรุณ

A single-player Thai fantasy browser RPG. Start as a villager, choose one of five Class 1 paths, then one of ten Class 2 branches. Explore three maps, fight monsters, complete quests and collect equipment. Progress is saved locally in your browser.

Play: https://suwitchabuppapan-boop.github.io/Borderlands-Classic-Offline/

Version **1.18** gives the skill tree compact icon boards grouped by Class 1, Class 2 and shared skills. Select an icon for its description, SP cost and requirements. Desktop shows four skills per row; mobile shows two, with the selected details kept nearby.

Use **− / +** to prepare an allocation, then **ยืนยันเรียน** to spend its points together. Previewing changes neither combat nor saved progress. Minus removes only unconfirmed additions; learned skills cannot be refunded. Closing the window discards the draft. The current-skills tab still supports immediate single-level learning.

All 61 skills, 58 reusable Effect Parts, current-class inheritance, passive mechanics and background farming remain available. Auto Battle and Auto Quest continue while the tree is open. Existing version 1.16/1.17 progress imports retain their current rules.

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
