# Class-specific skill tree and directional combat feedback

Approved scope carried forward from16October: feedback for11combat weapon types and15existing class signatures; a functional skill tree with5Class1families/10Class2branches. Class2 inherits only its parent and its own branch; FirstAid stays shared and old learned legacy skills remain compatible/separate. No new skill IDs/passives/power/SP/CD/points/drop/timing rules.

Recovery19October: cloud checkout contained legacy main9c24fc0, so published1.12runtime was recovered byte-for-byte from gh-pages f7b3cf90fe7a513c8c452d7085b40dbfe9cb04d8 into source recovery commit eefb5c3. `/tmp/siam-base-1.12` retains the untouched baseline for parity tests. Previous session test files were not published and are absent in this checkout; fresh meaningful tests must be written and recorded honestly. No third-party sprites from the old branch are used.

## Shared event contract

`js/combat-feedback.js`: CommonJS/browser `BCCombatFeedback` exports emit(s,event),tick(s,dt),clear(s),MAX_EVENTS64. Optional transient `s.combatFeedback={nextId,events}` is excluded from saved fields. An event has id,kind,source,target,facing,weaponType,skillId,result,phase,amount,magic,age,duration. Source/target are frozen finite world-foot{x,y}; facing0down/1right/2up/3left; kind attack/skill/impact; result hit/miss/crit ornull; phase direct/dot/trap; duration attack.28/skill.45/impact.25 seconds.

Validate payloads before creating state; snapshot inputs; cap64oldest eviction; monotonic cosmetic IDs never consume gameplayRNG. Tick ages using simulationdt and removesexpired; real mapspawn/death/travel clears; import never injects events. Paused menus/tab keep time frozen.

Core emits attack only after guards, actual impact from damage outcome before targetkill, and skill after signature validation/SP/CD/facing commit. Existing damage boolean return remains; options add skillId/phase for direct/DOT/trap. Helpers expose feedback(s,event) to class-combat. Rejected casts/attacks emit nothing. Effects never schedule another hit or delay current real damage.

## Canvas renderer

`js/combat-effects.js`: CommonJS/browser `BCCombatEffects.drawGround(ctx,s)`,drawFront(ctx,s), profile metadata. Pure bounded Canvas geometry; no DOM/network/time/random calls, no state writes, balanced save/restore. Renderer draws ground FX before sortedentities, frontFX before floatingtext in existing camera transform. All27images/classbody/arms/heldweapons unchanged.

Distinct profiles: gold dha crescents; crosseddual cuts; shieldglints; lotusstaff bolts; blue/gold orb; green/gold scripture; garudafist sparks; thinvioletkris; crimsonclaw rakes; creamarrow; violet/cyan magicarrow. Training gets smallneutralstroke. Actual miss has no successfulhit burst; critbrightens actualphysicalcritical only.

Fifteen signature compositions: sunrise arc, lotusbolt, protectiveglyph, narrowstab, focusedarrow, triplecrosscuts, shieldoutline/counter, floralstorm, chargedorbdischarge, scripthealingcircle, doublegarudapunch, poisonsting, crimsonrend, greennagacoil, magicalvolley. AoEzones use real radii90/105/85. Persistent visuals derive actual classCombat buffs/traps/orbCharges/timers and live monster.classDots, then disappear on actual expiry/clear. No fullscreenflash or shake.

## Skill tree

`js/skill-tree.js`: data-derived CommonJS/browser BCSkillTree.paths()->5families each2children, nodesFor(classId)->ancestryandsharedFirstAid. Nodes carry actual classDef/skill references; no duplicate15catalog. Invalid IDs return empty/invalid result without prototype access. Collections/nodes are fresh.

Existing Skills dialog adds current/tree tabs; defaultcurrent preserves oldskillCard/learn/hotbar controls. Tree shows class-specific own/inherited/locked state, actual levels/max5, description/SP/CD/range, Job10 and Job40+trial requirements. Existing core learn/cast/access guards remain sole authority, so sibling/foreignskills are locked. SharedFirstAid and learnedlegacy are explicitly separate. Browse tree never promotes/unlocks another weapon type. Keyboardfocus/tab controls and1440/390dialog stay compact.

## Acceptance and release

Write RED tests before new code. Verify real action outcomes/failedactionnone, bounds64/finite snapshots/expiry, actual direct/DOT/trap/crit/miss, save/import/map/death/pause and baseline numericalstate/RNG parity. Render tests cover11×4directions and15skills/persistentstates via real Canvas pixels and no state mutation. Tree tests all16identities, all15skills, siblinglocks, realpointspend/max, hotbar/save/focus/390layout. Fresh baseline regression covers61items/42available17future2legacy, economy/quests/travel/classes and rawsave compatibility.

Publish1.13 after independent review and browser evidence. Three newJSmodules give45runtimefiles/14JS/27unchangedimages. Verify all44public contentfiles exactbytes with TLS, test actualpublic bytes, preserve archives and push sourcefeaturebranch for durable continuation. No merge into main without user request.
