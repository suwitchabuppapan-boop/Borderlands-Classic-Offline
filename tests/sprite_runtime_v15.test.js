const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const source=['assets/sprites/body_novice.png','assets/sprites/body_swordman.png',
...['poring','fabre','lunatic','willow','hornet','poporing','boss'].map(id=>'assets/sprites/monster_'+id+'.png')];
for(const file of source){assert.ok(fs.existsSync(path.join(root,file)),file+' missing');assert.ok(game.includes(file),file+' not wired');}
for(let i=0;i<19;i++)assert.ok(fs.existsSync(path.join(root,'assets/sprites/hair_'+String(i).padStart(2,'0')+'.png')));
assert.ok(game.includes('const MONSTER_DRAW_SCALE='));assert.ok(game.includes('function drawLayeredCharacter('));
assert.ok(game.includes("setActorState(s.player,'attack'"));assert.ok(game.includes("setActorState(m,'attack'"));
assert.ok(game.includes('m.deadUntil'));assert.ok(game.includes('drawEquippedWeapon('));
assert.ok(fs.existsSync(path.join(root,'js/sprite-anchors.js')));
console.log('SPRITE RUNTIME PASS: standalone body/head atlases, seven monster atlases, equipped weapon and animation hooks');
