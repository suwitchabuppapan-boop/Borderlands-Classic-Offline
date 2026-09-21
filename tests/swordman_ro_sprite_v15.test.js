const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const file=(name)=>path.join(root,'assets','sprites',name);
const body=fs.readFileSync(file('body_swordman.png'));
assert.equal(body.readUInt32BE(16),96*13);
assert.equal(body.readUInt32BE(20),112*4);
for(let i=0;i<19;i++){const b=fs.readFileSync(file('hair_'+String(i).padStart(2,'0')+'.png'));assert.equal(b.readUInt32BE(16),64*13);assert.equal(b.readUInt32BE(20),48*4);}
assert.ok(game.includes("swordman:{src:'assets/sprites/body_swordman.png'"),'body must be separate from hairstyle');
assert.ok(game.includes('function drawLayeredCharacter('));
assert.ok(game.includes('hairStyle'));
assert.ok(game.includes('data-setting="hairStyle"'));
assert.ok(!game.includes("'swordman_ro_hair_'"),'precomposited images must no longer be referenced');
console.log('SWORDMAN LAYERED PASS: 19 reusable hairstyles, independent 96x112 body, preserved hair selection');
