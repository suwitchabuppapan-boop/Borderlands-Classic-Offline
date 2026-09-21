# Classic Pre-Renewal Implementation Plan

> For agentic workers: use superpowers:test-driven-development; verification before completion.

**Goal:** A runnable standalone ZIP derived from Borderlands Offline v1 with a playable Novice -> Swordman Classic-inspired loop.

**Architecture:** retain file:// HTML/CSS/Canvas engine; isolate curated Classic data into js/classic-data.js, game rules / persistence into js/core.js, world UI / renderer into js/game.js. Tests run in Node; browser smoke in Playwright when present.

**Tech Stack:** Vanilla JS / HTML / CSS / Node built-in assert and optional Playwright.

**Spec:** docs/superpowers/specs/2026-09-18-classic-design.md

## Global constraints
Preserve original independent code; no Gravity asset redistribution; fully offline; expose explicit distinctions between referenced values and solo-adjusted formulas; v1 save must survive migration.

### Task 1: classic data + core rules
- [x] Write failing tests for pre-re monster IDs, EXP charts, 6 stats, class change, skill point allocation, drops, sell, save migration.
- [x] Run Node tests and verify failure for missing rules.
- [x] Add classic-data.js and revise core.js, keep API stable where needed.
- [x] Run tests; address any failures.

### Task 2: runtime integration
- [x] Write browser smoke assertions for initial render, tabs / job UI, no errors.
- [x] Replace zone mobs, drops, quest tracking, class skills, stat/skill UI, save key migration, and custom sprite rendering in game.js; change index.html script order and copy.
- [x] Run Chromium inline-document smoke for launch/UI/job/skill with game scripts embedded; direct file:// navigation blocked by test environment. Validate v1 migration in core unit test and static file references.

### Task 3: packaging + QA
- [x] Update Thai README and data/rights notes with source URLs and exact vs balanced distinction.
- [x] Verify all test results, archive structure, and runtime paths; zip entire deliverable.
