# Full Class Skills and Effect Parts Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement the tasks with test-first checks and an independent final review. User explicitly requested the complete approved design be put into the game and published; execution proceeds in the current isolated feature checkout.

**Goal:** Publish Siam Arun 1.17 with all 61 approved skills, 58 reusable effect templates, class inheritance, passive effects, guarded combos/Auto and retained current saves.

**Architecture:** Keep the static browser/CommonJS structure. Extend classic-data with the approved catalog, add pure skill-rules for access/cost/passives and pure effect-parts for the original composable artwork, and integrate these into the existing engine, skill UI and renderer. Actual engine outcomes/timers own visuals; rendering never computes damage or changes game state.

**Tech Stack:** Plain JavaScript Canvas, Node node:test, Python Playwright/Chromium, deterministic stdlib ZIP/TLS release tooling; no new dependency or backend.

**Spec:** docs/superpowers/specs/2026-10-20-class-skills-effect-parts-design.md

## Global Constraints

- Exact approved 61 skill IDs/Thai names and 58 Part IDs from the spec; four native skills per non-villager class, 15 passives, shared First Aid.
- Preserve 59 items, 27 image bytes, full canonical character/weapon sprites, class routes and save key. No old items/skills/ancient schema migrations return.
- Existing 15 active signatures retain original base balance; new passive/synergy effects may modify outcomes when learned. Every new class skill max level 5; First Aid remains level 1.
- New Class 1 attacks target roughly 1.0–1.35 base power, SP 5–10, CD 2–5s. New Class 2 attacks roughly 1.3–2.0, SP 10–18, CD 4–8s. Utilities SP 7–14, CD 7–12s, timed 4–8s; modest capped passive bonuses. Final chosen exact values live in classic-data and descriptions.
- Status buffs of the same type use the strongest value; bounded refresh/marks/chain targets. No infinite healing/SP/charge loop or unbounded crowd control. Only landed ordinary attacks create orb charges, at most three.
- All skills are usable manually; Auto chooses learned accessible active skills by survival/preparation/resource/target count. Auto Quest avoids unrelated targets and preserves travel ownership.
- Current-format 1.16 saves upgrade missing NEW skill keys to zero once. Add explicit skillVersion 2 to new saves; modern saves validate all 61 keys. Existing 16 keys and current stat/class/equipment schema remain required; malformed retained values reject.
- Short effects read immutable snapshots; persistent effects follow real living owners/timers. Four directions use canonical-sprite tip/body/feet anchors, never separate arm/weapon rendering.
- Final release: 52 runtime files, 21 JS modules, 51 public content files, 27 images. New files are js/skill-rules.js and js/effect-parts.js.

## Review Focus

1. Updating actual 1.16 saves for all 16 classes preserves learned skills, points, gear, money and quests; passives cannot enter hotbar or be cast.
2. Early combo kills, failed casts, blocked movement, zero orb charges and missing marks spend no invalid resources and create no false hits/states.
3. Shield absorption, enemy ATK/HIT debuffs, cleanse, movement, marks and one-use amplification affect real combat and expire/consume once, including boss cases.
4. Inherited acolyte attacks work for books/knuckles, magic bow uses approved DEX/INT progression, passive/buff modifiers apply once and never leak across classes.
5. Live Auto/Auto Quest, background catchup, four-direction anchors, layered effects and damage labels remain readable and deterministic at 1440/390px.

## Task 1: Catalog and pure skill rules

**Files:** js/classic-data.js; new js/skill-rules.js; tests/skill-catalog.test.js.

**Interfaces:** BCData.skills contains all 61 definitions; BCData.classes[classId].skillIds lists its four native IDs (villager only first_aid), preserving .skill as original signature. Skill definitions include owner/kind/category/sp/cooldown/range/power and explicit effect fields. BCSkillRules exports accessible(s,id,requireLearned=false), isPassive(id), nativeSkills(classId), skillsFor(classId), spCost(s,id), passives(s), magicFor(s,id). Module consumes only classic-data; no engine/DOM/state writes. All consumers use the same helper contract.

- [ ] Assert exact names/counts/ownership/4-per-class/15-passive and finite balance values; observe RED.
- [ ] Implement 45 new entries, grouping and meaningful Thai descriptions; preserve original 16 base fields except optional metadata and release 1.17.
- [ ] Test valid learned ancestry, spoof/prototype IDs, cost reduction and every passive's bounded numerical modifier; implement helpers and observe GREEN.
- [ ] Document exact helper result keys for engine/UI owners and freeze edits for review.

## Task 2: Real mechanics, stats, learning and saves

**Files:** js/core.js, js/class-combat.js, js/stat-rules.js, js/auto-quest.js if needed; tests/full-class-combat.test.js and tests/full-class-saves.test.js.

**Interfaces:** Retain BCCore public actions and BCClassCombat cast/tick/modifiers/afterAttack/suggestSkill. Consume BCSkillRules. Engine may add helper methods privately; coordinate any exported hooks. New status records live under transient classCombat or monster skillDebuffs/marks, with remaining timers and owner skill IDs. Optional bounded classCombat.signals records successful application/consumption/absorption/cleanse/movement with immutable source/target snapshots and age/duration; renderer only reads them. Send final state field shapes to renderer owner before integration.

- [ ] Test and observe RED for all 45 new skills' expected mechanic, rejection atomicity and manual use; passive casting/binding rejects.
- [ ] Implement cone/radial/piercing/chain/double attacks, shields, debuffs, one-use marks/empowers, cleanse, movement and all 15 passive stats/costs.
- [ ] Apply effects to actual incoming/outgoing calculations; consume one-use bonuses once per successful cast, not per animation frame/target. Acolyte adaptive damage follows book/knuckle; magic-bow DEX/INT support is explicitly conditioned on the learned passive.
- [ ] Keep existing signatures' zero-new-skill behavior and lifetimes; bound all timers/lists/target traversal and stop status loops on death/travel/import.
- [ ] Test current 1.16 import across all 16 classes, 61-key new save roundtrips, deleted-ID sanitation, malformed retained data, no invented points/refunds and transient exclusion; implement skillVersion 2 upgrade.
- [ ] Implement learned-skill Auto priority and safe Auto Quest AoE/movement routing; test all 15 class rotations plus real quest completion/background equality. Run focused Node tests and freeze interfaces.

## Task 3: Actual Part library and all active/persistent effects

**Files:** new js/effect-parts.js; js/vfx-skills.js, js/combat-effects.js; optional authored socket metadata in effect-parts; tests/effect-parts.test.js and tests/full-skill-vfx.test.js.

**Interfaces:** BCFXParts exports frozen definitions (58 IDs), recipes (61 IDs), draw(ctx,partId,options), socket(classId,facing,phase,source) and pure layer helpers as needed. Existing BCSkillVFX.drawGround/drawFront and BCCombatEffects interfaces remain. New parts can use existing painter primitives as original procedural RGBA art; actual class-specific shapes must exist and recipes must use them. No font/network/RNG/scheduler/game-state mutation. Signals/status contracts come from Task 2.

- [ ] Test spec ID equality, unique geometry, bounded immutable drawing, zero expiry and all recipe references; observe RED then implement actual 58 templates.
- [ ] Prepare four-direction sockets against real canonical sprites and attack frames; use snapshots/current owner timers appropriately. No floating weapons, extra arms or face-covering bursts.
- [ ] Compose all 46 active skills including First Aid. Passives have no permanent effects; conditional hunt mark follows only actual mark state. Preserve genuine current radii/ticks/hit counts and global critical/damage layer.
- [ ] Implement successful status application/consumption, shield break/absorb, cleanse and real movement trails; failed/inert casts show no fabricated results.
- [ ] Verify short phases, all 58 templates and every active skill over native Canvas, four directions, expired/dead states and actual maps. Freeze renderer and report visual findings.

## Task 4: Playable class skill UI and hotbar

**Files:** js/skill-tree.js, js/game.js, css/style.css; tests/skill-tree.test.js plus browser owner tests.

**Interfaces:** Tree exposes all four native skills at each accessible ancestor; preserve class path guide/catalog. UI consumes actual owner/kind/effective SP cost and Core learning guards. Passives learn with points but have no cast/hotbar controls. Current identity only: Class 1 four + First Aid, Class 2 eight + First Aid.

- [ ] Test accessible counts, ordering, ownership/inheritance and foreign/future exclusion; observe RED.
- [ ] Render concise active/passive labels, effective SP/cooldowns and role descriptions; show learned passive levels and real temporary status icons/timers where relevant.
- [ ] Keep keyboard/focus, learn-point changes, hotbar 1–9 and responsive 1440/390px layouts usable. Prevent passive binding and ensure active utility targeting works.
- [ ] Run focused tests and report controls for real browser acceptance.

## Task 5: Fresh full browser/regression acceptance

**Files:** new tests/class_skills_ui.py; existing tests/*_ui.py and gameplay_regression.py; root adapts obsolete Node baseline assertions.

- [ ] Test real UI learning and retained saves for all 16 identities, seven active slots vs two passives, actual class progression and purchases.
- [ ] Exercise every active skill with real Core actions, SP/HP/target deltas, shields/marks/cleanses/movement, four facings, primitive/profile sheets and actual RAF/manual attack/cast capture.
- [ ] Verify no page/resource errors, readable stacking on original scenery, expired loops, menu/background farming, current saves and real full Auto Quest route.
- [ ] Update old assertions only for explicitly intended catalog/skill-count/mechanics changes. Retain meaningful existing gameplay/RNG checks with new skills unlearned; add independent new-skill outcome tests rather than erasing failures.
- [ ] Run node --test tests/*.test.js and all six browser suites on frozen local runtime, independent code/visual review, then public-byte replay after deployment.

## Task 6: Publish 1.17 and preserve evidence

**Files:** scripts/release_site.py, scripts/README.md; root owns index.html loading/version, current READMEs/provenance/TEST_RESULTS and publication.

- [ ] Require skill-rules immediately after classic-data and effect-parts after vfx-weapons/before vfx-skills; all references use ?v=1.17.
- [ ] Stage/verify exact 52-file runtime and deterministic source/runtime ZIPs; preserve old releases and all 27 image bytes.
- [ ] Commit/push source on the current feature branch and retain draft PR #2; no main merge. Publish guarded gh-pages commit with exact expected parent, wait for built, verify all 51 public TLS content files.
- [ ] Execute six browser suites on verified public bytes, archive exact source/public evidence, update docs/PR and versioned downloads, then report the playable URL and actual validation counts.
