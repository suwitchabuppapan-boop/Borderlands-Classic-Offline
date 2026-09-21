'use strict';
// Regression: runtime must resolve regular, skills and monster hits via a single Classic combat core.
const assert=require('node:assert/strict');
const fs=require('node:fs'),src=fs.readFileSync(require('node:path').join(__dirname,'../js/game.js'),'utf8');
assert.match(src,/cool\.attack=C\.attackInterval\(s\)/,'dynamic attack delay');
assert.match(src,/C\.resolvePlayerAttack\(s,\{\.\.\.spec,statuses:m\.statuses\}/,'player normal/skill hit checks share Classic resolver');
assert.match(src,/C\.resolveMonsterAttack\(spec,s/,'monster damage shares Classic resolver');
assert.match(src,/C\.monsterCombatStats\(spec\)\.attackInterval/,'monster attack interval comes from DB');
assert.match(src,/\bMISS\b/,'visible misses');
assert.match(src,/\bDODGE\b/,'visible dodge');
assert.match(src,/\bLUCKY\b/,'visible perfect dodge');
assert.doesNotMatch(src,/C\.SOLO_DAMAGE_RATE/,'no scaled-down solo damage in combat');
console.log('PASS runtime uses Classic unified combat resolver and database attack intervals');
