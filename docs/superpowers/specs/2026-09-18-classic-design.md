# Borderlands Classic Pre-Renewal v1.1 Design

Approved direction: Option A Classic, reuse Borderlands Solo Offline v1; distribute offline Windows ZIP with rights-cleared artwork.

## Scope
- Keep v1 UI, movement, 3 maps, combat, quests, auto battle, export/import save, and file:// launch.
- Provide an original pixel-art visual interpretation; no Gravity sprites, sounds, or copied source code.
- Introduce curated classic monster records with reference IDs / level / base & job EXP / HP / attacks / curated drops, sourced from rAthena pre-re data. Balance using explicit SOLO_SCALE and mark any invented content.
- Base EXP thresholds from Classic iRO Wiki, Novice and Swordman Job progression and skill-point spending; Novice -> Swordman at Job 10 using existing local NPC at starting map.
- Six stats STR AGI VIT INT DEX LUK, escalating stat-point cost, classic-inspired derived stats (not exact RO combat formula).
- Unlock active skills through allocated skill points: First Aid (Novice) and Bash/Magnum Break/Provoke (Swordman). Four active hotbar keys; old skill slots replaced. Use explicit local-rule descriptions.
- Versioned save migration from v1; do not modify v1 save key until verified migration. Retain previous Silver/equipment and convert old monster quest progress only where safe. Export JSON compatible with v1.1.
- Item IDs for materials and revised weapons & consumables; add simple sell action for materials to prevent inventory soft-lock.
- No external runtime dependencies or network calls; bundle tests, license and source notes.

## Sources / license
- rAthena pre-re monster file (GPL v3+ project): https://github.com/rathena/rathena/blob/master/db/pre-re/mob_db.yml . Copy only limited factual game values into separately attributed dataset, no rAthena software code.
- iRO Wiki Classic base EXP: https://irowiki.org/classic/Base_EXP_Chart ; Swordman: https://irowiki.org/classic/Swordman ; Job EXP: https://irowiki.org/classic/Job_EXP_Chart .
- All visuals and code in this ZIP authored for this prototype; no upstream sprites bundled. If Kenney assets added later, use only verified CC0 packs and include credit link.

## Verification
- Core tests for Classic EXP, job change, skill allocation, drops, sell, 6 stats, v1 save migration and inventory validation.
- Browser smoke for file URL game load, job switch + interaction, basic movement/auto, no JS exceptions.
- Confirm archive paths and offline CSP/no external URLs.

## Non-goals
Not exact Gravity client, server, authentic formula parity, all jobs, full world, API backend or official affiliation.
