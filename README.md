# Siam Arun — สยามอรุณ

A single-player Thai fantasy browser RPG. Start as a villager, choose one of five Class 1 paths, then one of ten Class 2 branches. Explore three maps, fight monsters, complete quests and collect equipment. Progress is saved locally in your browser.

Play: https://suwitchabuppapan-boop.github.io/Borderlands-Classic-Offline/

Version **1.15** redraws all 11 weapon families and 15 class skills in an original classic Siam fantasy style: filled blade trails, ivory cores, lotus petals, jade fragments, scripture and Naga snares. Effects have distinct release/impact/dissipation shapes, with readable physical criticals and timer-driven wards, charges and DOT marks.

**สกิล → ผังสกิลอาชีพ** shows only the current class and its inherited skills, with shared First Aid and learned legacy skills separate. Auto Battle and Auto Quest keep running through in-game menus and focus changes. Combat powers, SP costs, cooldowns, loot and save compatibility retain their existing rules.

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

Use the Settings menu to export/import a backup. Storage key: `borderlands-solo-rebuilt-v1`. Version 1.12 saves and supported earlier rebuilt saves migrate through the existing validator. Saves from the unrelated historical pre-rebuild game are not supported.

The catalog contains 61 items: 42 obtainable now, 17 planned, and 2 retained for legacy saves. Planned bosses and drops shown in the guide are not live encounters. The 11 weapon paths each have three grades.

Current art consists of 27 Siam fantasy atlases/images, preserved from published 1.12. This release adds Canvas geometry and no bitmap artwork. See [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). The versioned v1.3–v1.5b README files describe historical packages, not this game.

The cloud checkout initially contained old `main`; published 1.12 was recovered from `gh-pages` into commit `eefb5c3`. Current source, tests and docs are maintained on `codex/siam-arun-combat-effects`. Do not overwrite this version with historical sprite packages.
