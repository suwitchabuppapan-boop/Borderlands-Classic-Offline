# Combat feedback and class tree implementation plan

**Goal:** Finish the approved11weapon/15skill VFX and class-specific skill tree in1.13.
**Spec:** ../specs/2026-10-19-combat-feedback-design.md
**Stack:** staticJS/CommonJS,Canvas,Node,PythonPlaywright/Chromium. Existing cloudcheckout; no worktree/install required.

## Constraints and review focus

Preserve numerical combat/RNG/61items27art/saves; transient64eventcap and snapshotcoordinates; nohit onmiss/failedcast; direct/DOT/trapkills keepvalidcoordinates; realstateexpiry/mapdeathimport clears; classinheritance/siblinglocks/legacycompatible; pureCanvas and1440/390keyboard/focus. Baseline eefb5c3 matches published1.12; oldsessiontests absent, newtest outcomes recorded without claiming their oldcounts.

## Tasks / owners

1. Core: js/combat-feedback.js,js/core.js,js/class-combat.js,tests/combat-feedback.test.js. RED→GREEN events contract fromspec, actual validatedattack/skill/impact, direct/DOT/trapphase, tick/clear/save exclusion. h.feedback forwarder and h.damage optional skillId/phase preserveboolean. Compare realstates/RNG/actions to untouched /tmp/siam-base-1.12 under equal seeds. Report /workspace/combat-fx-work/core-report.md.
2. Renderer: js/combat-effects.js,js/render.js,tests/combat-effects.test.js,tests/combat_effects_ui.py. RED→GREEN CommonJS/browser ground/front pure drawing from agreed eventcontract,11profiles×4directions/15signatures and real persistentstates. RealCanvaspixels/sheets and actualRAFactions; reusable run_checks(page). Report /workspace/combat-fx-work/render-report.md.
3. UI: js/skill-tree.js,js/game.js,css/style.css,tests/skill-tree.test.js,tests/skill_tree_ui.py. RED→GREEN data-derived paths/nodes, current/tree tabs with existingselectorspreserved, real guard learning/hotbar/save/class locks, keyboard/focus and1440/390. Selector[data-skills-tab=tree]. Reusable run_checks(page), screenshot. Report /workspace/combat-fx-work/ui-report.md.
4. Root: index/release1.13/docs/provenance, freshbaseline Node/browser regression, final independentreview/scopedfixes, exact45filepackage/TLSpublicbytes/Pagesbuild, durable sourcebranch+draftPR, final testedsourcecommit.

Workers own disjointfiles, no commits/publish/spawn. Allmodules contracts in spec; root owns index/script order feedback beforecore and effects/tree beforerender/game. Onebrowserperworker,max2total during acceptance. Root runs finalfullNode oncefrozen and regression/publicflows. No newskillIDs/castingdelay/balancefeatures.

## Progress

- [x] Recover published1.12 and preserve clean baseline.
- [x] Core events and baseline parity: 46 tests and 15,092 exact checkpoints.
- [x] Directional Canvas and real pixel acceptance: 13 tests, 48 directional cases, 15 signatures.
- [x] Class-specific current/tree UI and real learning: 22 tests and all 16 class identities in Chromium.
- [x] Baseline gameplay, 109 full Node tests and independent review; 3 local browser suites pass.
- [x] Publish 1.13, verify all 44 public content files and replay 3 browser suites; source branch and draft PR #2 preserved with deterministic archives.
