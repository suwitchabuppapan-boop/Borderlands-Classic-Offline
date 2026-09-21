'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const game=fs.readFileSync(require('node:path').join(__dirname,'../js/game.js'),'utf8');
function test(name,fn){fn();console.log('PASS '+name);}
test('all melee attacks use shared Classic resolver',()=>{assert.match(game,/C\.resolvePlayerAttack\(s,\{\.\.\.spec,statuses:m\.statuses\}/);assert.doesNotMatch(game,/C\.damage\(s,\{\.\.\.spec,def\}/);});
test('monster damage uses Classic attack resolver and attack delay',()=>{assert.match(game,/C\.resolveMonsterAttack\(spec,s/);assert.match(game,/C\.monsterCombatStats\(spec\)\.attackInterval/);assert.doesNotMatch(game,/C\.SOLO_DAMAGE_RATE/);});
test('all four skills read skill level cost and first aid heals exactly five',()=>{assert.match(game,/C\.skillCost\(id,lv\)/);assert.match(game,/C\.skillHeal\('first_aid',lv\)/);assert.match(game,/C\.provokeModifiers\(lv\)/);assert.match(game,/strikeMonster\(mob,\{skillId:id,level:lv/);});
test('recovery ticks rather than per-frame flat regen',()=>{assert.match(game,/C\.hpRecovery\(s\)/);assert.match(game,/C\.spRecovery\(s\)/);assert.doesNotMatch(game,/p\.hp=Math\.min\(st\.maxHp,p\.hp\+dt\*/);});
