const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const pngDims=(p)=>{const b=fs.readFileSync(path.join(root,p));assert.equal(b.toString('ascii',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];};
assert.deepEqual(pngDims('assets/sprites/body_novice.png'),[64*13,112*4]);
assert.deepEqual(pngDims('assets/sprites/body_swordman.png'),[96*13,112*4]);
assert.deepEqual(pngDims('assets/sprites/hair_00.png'),[64*13,48*4]);
assert.deepEqual(pngDims('assets/sprites/hair_18.png'),[64*13,48*4]);
assert.ok(!game.includes("'novice_ro_hair_'"),'runtime must not select pre-baked composites');
assert.ok(!game.includes("'swordman_ro_hair_'"),'runtime must not select pre-baked composites');
assert.match(game,/function drawLayeredCharacter\(/);
assert.match(game,/function drawEquippedWeapon\(/);
assert.match(game,/const MONSTER_DRAW_SCALE=/);
assert.match(game,/function pickMobAt\(/); 
assert.match(game,/s\.equipment\.weapon/);
assert.deepEqual(pngDims('assets/weapons/rusty_sword.png'),[24,36]);
assert.deepEqual(pngDims('assets/weapons/iron_sword.png'),[24,36]);
assert.deepEqual(pngDims('assets/weapons/moon_blade.png'),[24,36]);
for(const id of ['potion','ether','green_potion','rusty_sword','moon_blade','cloth_armor','jellopy']){
  assert.deepEqual(pngDims('assets/icons/items/'+id+'.png'),[24,24]);
}
assert.match(game,/function itemIconHtml\(/);
assert.match(game,/function itemIconPath\(/);
assert.match(game,/icon\.innerHTML=entry\.type===.*itemIconHtml/);
// Confirm the graphics-only patch did not drop the gameplay and save entry points.
// This used to diff against js/game.js.base, a scratch copy from the patch process that
// was never shipped in the package or listed in PATCH_MANIFEST_v1_5b.txt, so the check
// could not run at all. Asserting on the current js/game.js still catches a deletion;
// it cannot prove the bodies are byte-identical to the pre-patch file.
for(const line of ['const KEY=','function attack(', 'function skill(', 'function save(', 'function hydrateWithHotbar(']){
 assert.ok(game.includes(line),'gameplay/save function '+line+' must survive');
}
console.log('LAYERED V15B PASS: head/body independent, weapon assets, 7-monster scale configuration, item icons, save/combat hooks');
