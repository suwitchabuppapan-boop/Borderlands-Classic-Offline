# 1.14 verification — 2026-10-19

User scope: show only the current class and inherited skills; make physical criticals visually distinct; continue farming through in-game menus and minimized/unfocused windows. The user clarified that popups mean in-game menus, not a separate browser window.

- Frozen runtime: `node --test tests/*.test.js` — **119 passed, 0 failed, 0 skipped**: 46 feedback/core, 15 renderer, 23 skill tree, 7 simulation clock, 28 baseline tests. Existing 15,092 baseline state/save/RNG parity checkpoints still pass. Core combat, class-combat, all 27 images and class crop metadata are unchanged from 1.13.
- `python3 scripts/test_browser.py --base-url http://127.0.0.1:8766/ --artifacts /workspace/combat114/browser-local` — **4 suites passed, 0 failed**: background farming, combat effects, skills and existing gameplay. No page/resource/HTTP errors. Real merchant/save/three-quest regressions remain covered.
- Skills browser coverage checks all 16 identities: villager has no class signature card, Class 1 has its own card, and Class 2 has its own plus its parent. Shared First Aid and learned legacy skills remain separate. Foreign/sibling/future cards are absent; catalog paths and core access guards are preserved. Learning, hotbar/save, focus and 1440/390px layouts pass; screenshots inspected.
- Actual seeded physical criticals draw red/gold crossed slashes, expanding rings and sparks for the original 250ms impact duration at the frozen hit location. Real Canvas critical geometry at 80ms covers 1,603 pixels versus 522 in 1.13 and 100 for a normal hit. Normal/miss/magic pixel hashes remain unchanged. 48 weapon/direction cases, 15 signatures, persistent-state checks and 11 real RAF scenarios pass; contact sheets and actual RAF critical screenshot inspected.
- A shared 60Hz elapsed-time ledger drives RAF and 250ms background callbacks without duplicate time. Each pump performs at most 3,600 real engine steps, retains all debt and yields between chunks. Mutating commands wait for debt to settle. No drop/EXP approximation or offline reward formula is used.
- Scheduler tests replay one simulated hour without dropping steps, compare regular versus delayed real Auto Battle state/RNG/saves, and compare 900 seconds of real Auto Quest scheduling through all three quests and six portals with complete state equality.
- Chromium checks actual kills/loot while the inventory popup remains open, continued time/auto intent on blur, actual CDP page freezing and elapsed catchup, RAF/interval time equality, manual-key release and save/reload epoch. A targeted denied-storage fixture confirms autosave attempts retain their 10s cadence. Regression evidence: the old menu froze time; backward clock overlap failed before the high-water correction; failed autosaves retried 17 times per 250ms before the cadence fix, once afterward.
- Independent review identified the backward-time and failed-autosave issues; both are fixed and verified. No unresolved Important/Critical runtime findings remain. Python compilation and `git diff --check` pass.

Keep the page open for background farming. Browsers/OS may suspend hidden or minimized pages; actual elapsed work is reconciled through the engine on resume. Closing or reloading grants no offline rewards and does not restart Auto. Direct file startup and Windows START.bat remain untested on an actual Windows machine. Previous 1.13 evidence is retained below as history.

### Published 1.14

- Pages commit `d80cad97f97dff46dfb1db6a024018665cec30d0` completed with **built** status and a successful deployment workflow. It changes six runtime text files, including the new clock, and preserves all image bytes.
- `python3 scripts/release_site.py verify-public --stage /workspace/combat114/release-1.14 --out /workspace/combat114/public-1.14` — **45/45 public content files match staged bytes**, with normal HTTPS certificate/hostname verification. Index SHA-256: `49939c7ef21d606e2bd9fa5e4e6fe2168c002a3214989a5ad320437af33c3e20`.
- `python3 scripts/test_browser.py --public-cache /workspace/combat114/public-1.14 --artifacts /workspace/combat114/browser-public` — **4 suites passed, 0 failed**, with zero page errors, failed requests, HTTP errors or unknown cache requests. The runner uses exactly the TLS-fetched public bytes at their original Pages origin; it does not substitute local runtime or disable HTTPS verification.
- Added a further real-browser hour-backlog check: a purchase during pending replay is rejected without changing money/items, the full hour is replayed in bounded chunks, and a fresh purchase succeeds after settlement. This targeted check passes locally and against the verified public bytes, with no resource/runtime errors (`backlog-gate-local` and `backlog-gate-public` artifacts).
- Runtime/source archives contain 46/76 files, respectively, with CRC and extracted bytes verified and SHA-256 manifests. Source is pushed on `codex/siam-arun-combat-effects` and retained in draft PR #2; main remains unmerged. Cloud startup instructions were saved for 1.14/four suites/119 Node tests without install, credential or network changes.

## Historical 1.13 verification — 2026-10-19

Baseline: published 1.12 recovered from `gh-pages` commit `f7b3cf90fe7a513c8c452d7085b40dbfe9cb04d8`, preserved as source commit `eefb5c30bdf2a2f28ccc6210f25d3bebe3231149`. This checkout did not contain the previous session's test files. The counts below describe fresh tests in this branch, not historical checks.

## Local acceptance

`node --test tests/*.test.js`: **109 passed, 0 failed, 0 skipped** on the frozen runtime.

- 46 feedback/core tests, including 15,092 complete state/save/RNG parity checkpoints across 16 classes and four seeds against 1.12. Only cosmetic `combatFeedback` state is excluded from state comparison; serialized saves and gameplay seeds match exactly. Valid/invalid attacks, all 15 signatures, actual miss/critical outcomes, direct/DOT/trap kills, early combo kills, AoE boundaries, snapshots, cap/expiry, travel/death/import and legacy skills are exercised.
- 13 renderer tests: all 11 combat weapon profiles plus training, four directions, diagonal ranged aiming, 15 distinct signatures, real AoE radii, physical critical accents, no hit burst for misses, actual persistent timers, finite bounded geometry and no drawing side effects.
- 22 skill tree tests: five families, all 16 identities, inherited versus sibling access, data-derived references, invalid IDs, separate shared/legacy skills, guarded learning and save/hotbar compatibility.
- 28 baseline regression tests: exact catalog/class/skill/drop data equality except release label; all 61 item IDs, 42 obtainable/17 planned/2 legacy sources; five paid starter/class routes; guarded money/item conservation; 16 raw 1.12 class saves; old save migration; atomic once-only quest rewards; real complete Auto Quest route.

`python3 scripts/test_browser.py --base-url http://127.0.0.1:8765/ --artifacts /workspace/combat-fx-work/browser-local`: **3 suites passed, 0 failed**; no page errors, failed requests or HTTP errors.

- Canvas: 48 weapon/direction pixel cases, 15 distinct signature pixel compositions, 8 persistent/expired state cases and 10 real RAF lifecycle checks. Actual keyboard attack/cast, menu pause, expiry, map clearing, invalid casts, save/import and bounded event stress are checked. Contact sheets and actual game frame inspected.
- Skills: all 16 identities and 15 class nodes, actual point spending and level 1–5 learning, inherited learning, sibling rejection, legacy separation, hotbar/save reload, keyboard tab navigation/focus and 1440/390px layouts. Both screenshots inspected.
- Gameplay: nine menus, 27 successfully loaded images, real keyboard movement, merchant buy/equip/sell clicks, save/reload, responsive gameplay frames. Prepared Auto Quest uses earned EXP, paid stats and purchased starter gear; subsequent movement/combat/rewards are real. It completes 5 หยดบัว, 5 ภูตไทร and 1 ยักษ์แก้วพิทักษ์, crosses six portals, receives actual drops and returns to ครูอิน in 865 simulation ticks (86.5s).

All 27 image bytes plus character/crop metadata remain identical to the recovered 1.12 source. `git diff --check` and Python syntax compilation pass. An independent reviewer found no Important/Critical issues, including the final rendering changes and release tooling, and independently reran all 109 tests successfully.

## Reproduction and limits

Use the commands in README.md and scripts/README.md. Python Playwright and Chromium are development tools, not game runtime dependencies. Browsers pause the simulation while menus or an unfocused tab are open. This release adds effects and a view of the existing 15 skills; it does not add skill levels, passive abilities or planned map encounters.

Git-based parity comparisons explicitly skip when the recovery history is unavailable, such as in the optional source ZIP; the other action/browser tests remain runnable. Chromium HTTP gameplay is checked. Direct file startup and START.bat have not been tested on an actual Windows machine.

## Published 1.13

- GitHub Pages commit `61ae25f14b4afd1986f3bdd78fa8f9880ef5201d` completed with status **built**. It updates ten text files from the 1.12 parent, preserves every image, and serves exactly 45 runtime files including `.nojekyll`.
- `python3 scripts/release_site.py verify-public --stage /workspace/combat-fx-work/release-1.13 --out /workspace/combat-fx-work/public-1.13`: **44/44 content files match staged bytes**, fetched over HTTPS with certificate/hostname verification. Index SHA-256: `8d96da0079607b2ba1d2c56f9ca8c9677ba0ef942c59ba35bff59c8806d9ccd9`.
- `python3 scripts/test_browser.py --public-cache /workspace/combat-fx-work/public-1.13 --artifacts /workspace/combat-fx-work/browser-public`: **3 passed, 0 failed**, with 0 page errors, failed requests, HTTP errors or unrecognized cache requests. The same combat, tree and gameplay checks replay the exact TLS-fetched public bytes at their original Pages origin. Chromium's cloud proxy trust issue is handled by verified-byte replay; HTTPS verification is never disabled and local source bytes are not substituted.
- Public desktop/mobile tree and gameplay screenshots plus combat contact sheets were inspected. The complete prepared Auto Quest route also succeeds using public bytes.
- Source is pushed to `codex/siam-arun-combat-effects`, with draft [PR #2](https://github.com/suwitchabuppapan-boop/Borderlands-Classic-Offline/pull/2) preserving the recovered source and tests for review. Main is not merged. Deterministic runtime/source ZIPs are read back for exact bytes and CRC; manifests record their SHA-256 digests.
- The cloud `start_skill` draft was updated with the current source branch, startup and tested validation commands. No install script, credential or network changes were needed. This confirms saved instructions and current-instance checks; a fresh environment restore has not been exercised.
