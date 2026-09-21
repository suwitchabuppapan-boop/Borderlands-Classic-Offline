const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(scripts,['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/sprite-anchors.js','js/game.js']);
assert.ok(html.includes('data-tab="codex"'),'Codex tab must exist');
for(const p of [...scripts,...styles]){
  assert.ok(!/^(?:https?:)?\/\//.test(p),p);
  assert.ok(fs.statSync(path.resolve(root,p)).isFile(),p);
}
for(const p of scripts){const code=fs.readFileSync(path.join(root,p),'utf8');assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bimport\s*\(/.test(code),p+' cannot require a remote endpoint');}
const bat=fs.readFileSync(path.join(root,'START.bat'),'utf8');
const importer=fs.readFileSync(path.join(root,'tools','import-divine-pride.ps1'),'utf8');
assert.ok(/Read-Host[^\n]*-AsSecureString/.test(importer),'key input must be masked');
assert.ok(!importer.includes('YOUR_API_KEY'),'no example key in importer');
assert.ok(fs.existsSync(path.join(root,'IMPORT_DIVINE_PRIDE.bat')),'Windows importer entry point');
assert.ok(bat.includes('index.html'));
console.log('OFFLINE PASS: script order, local asset paths, no network APIs, Windows launcher');
