# Siam Arun — สยามอรุณ

A single-player Thai fantasy browser RPG. Start as a villager, choose one of five Class 1 paths, then one of ten Class 2 branches. Explore three maps, fight monsters, complete quests and collect equipment. Progress is saved locally in your browser.

Play: https://suwitchabuppapan-boop.github.io/Borderlands-Classic-Offline/

Version **1.21** replaces นักดาบอรุณ's skill set with ten Thai skills: seven main skills up to level 10 and three special skills learned free near ครูอิน. The former dual-sword Class 2 branch becomes **ขุนดาบราชัน**, using a two-handed sword. Its three existing weapon item IDs, prices and powers remain intact. Other classes retain four native skills up to level 5. See [the swordsman rules and adaptation notes](docs/swordsman-1.21.md).

The skill tree shows only the current class and inherited skills. Use **− / +** to prepare an allocation, then **ยืนยันเรียน** to learn it. Prerequisites can be satisfied within the same draft; minus removes only unconfirmed levels and cannot invalidate a dependent skill. Free special skills can be confirmed with zero points while near the teacher. Skill details show all ten levels, variable SP costs and current buff state. There are **67 skills: 48 active, including shared First Aid, and 19 passive**, using 58 Effect Parts.

Character actions still play one at a time: skills have 0.45-second shared recovery and normal attacks 0.28 seconds, alongside their own cooldowns. **ระเบิดเพลิง** adds two seconds of skill delay while normal attacks can resume after shared recovery. **ยืนหยัด** prevents hit flinching for seven landed monster hits without reducing their damage, and adds MDEF. **คลั่งอัตโนมัติ** must be switched on manually for 1 SP; it then works below 25% HP even with no SP and can be switched off free. Potions and menus remain usable during action recovery.

Combat VFX retain the classic fantasy style with actual hit and status gates. The new swordsman effects distinguish the square fire burst, successful taunts, stun and low-HP Berserk. The two-handed sword uses one broad trail and complete authored character poses rather than separate arms or a floating weapon. The other 26 image files are preserved.

Quantity trading remains available: type a whole number or use **− / + / สูงสุด**, inspect the total price and projected weight, then buy/sell near the merchant. Purchases allow 1–999 items per transaction; sales allow 1–100,000. Equipped copies are excluded from sale stock. Capacity is **6,000 + Base Lv. × 800 + STR × 30**, with live weight, percentage, free room and three heaviest stacks. Natural recovery stops at 50% and attacks at 90%. Carrying balance targets 2–3 hours between selling trips; actual duration and survival depend on build, map and supplies.

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

See [scripts/README.md](scripts/README.md) for packaging and verification of public files. The parity tests use the 1.12 recovery commit in Git history; those comparisons are explicitly skipped in a source ZIP without Git history. The 1.21 comparison excludes the intentionally redesigned sword lineage and checks the other thirteen classes. Current verification evidence and limits are in [TEST_RESULTS.md](TEST_RESULTS.md).

Move with WASD/arrows or click the map. Click a monster to approach and attack, use Space to attack, and use hotbar keys 1–9. Menus keep the simulation running. Shops require proximity to the merchant; ครูอิน handles quests, special skill training and class changes; หมอมะลิ heals for free. Auto Quest handles the three main quests using normal movement, combat, supplies and rewards. Prepare equipment and stats first.

Keep the game page open for background farming. A shared fixed-step clock prevents RAF and background timers from counting time twice. If the browser freezes or throttles a minimized tab, elapsed time is replayed through actual combat on resume in bounded chunks; commands wait until outstanding time is settled. Browser/OS suspension may prevent real-time work while hidden. Closing/reloading the page does not grant offline rewards or restore automatic farming.

## Saves, source and artwork

Use the Settings menu to export/import a backup. Storage key: `borderlands-solo-rebuilt-v1`. Current-format saves require the current class, stat version and four equipment slots. Unrecognized item/skill IDs and their bindings are discarded. Earlier classless/statless/headless formats are rejected.

New saves use **skill schema version 3**. Loading a supported 1.16 or schema-2 save refunds only points learned in the four former swordsman skills and resets the new ten-skill set for reallocation. Bindings to those four refunded skills are cleared. Class 2 skills, other classes, levels, stats, items and adventure progress remain. The refund runs once; importing a schema-3 save does not refund again. A former royal dual-sword character becomes the corresponding two-handed sword character, retaining its equipment IDs. Runtime buffs, Berserk switch, action delays and stun start neutral after loading.

The catalog contains **59 items: 42 obtainable now and 17 planned**. Planned bosses and drops shown in the guide are not live encounters. The 11 weapon paths each have three grades. Main skills cost points; the three swordsman special skills are free at the teacher rather than automatically unlocked. Item powers, prices and drop chances remain unchanged by this skill update.

Current art consists of 27 Siam fantasy atlases/images. This release replaces only the royal character atlas with 24 complete two-handed-sword poses; the other 26 files remain unchanged from published 1.12. See [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). The earlier class skills and Part design is recorded in [the design](docs/superpowers/specs/2026-10-20-class-skills-effect-parts-design.md), with the swordsman changes in [the 1.21 rules](docs/swordsman-1.21.md).

The cloud checkout initially contained old `main`; published 1.12 was recovered from `gh-pages` into commit `eefb5c3`. Current source, tests and docs are maintained on `codex/siam-arun-combat-effects`. Do not overwrite this version with historical sprite packages.
