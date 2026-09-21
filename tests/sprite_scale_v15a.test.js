const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const anchor=fs.readFileSync(path.join(root,'js/sprite-anchors.js'),'utf8');
const start=game.indexOf('const MONSTER_DRAW_SCALE='),end=game.indexOf('initActorVisual(s.player);',start);
assert.ok(start>=0&&end>start);
const calls=[],context={Image:class{constructor(){this.complete=true;this.naturalWidth=1248;}set src(s){this._src=s;}get src(){return this._src;}},
 s:{player:{hairStyle:0,classId:'novice'},equipment:{weapon:null}},
 C:{ITEMS:{rusty_sword:{slot:'weapon'}}},now:0,
 // The stub models only what the draw path touches. drawGroundShadow adds path calls;
 // they push nothing onto calls, so the drawImage assertions below are unaffected.
 g:{drawImage(...args){calls.push(args)},save(){},restore(){},translate(){},rotate(){},
    beginPath(){},ellipse(){},fill(){}}};
context.window=context;vm.createContext(context);vm.runInContext(anchor,context);
vm.runInContext(game.slice(start,end)+`
this.measure=(key,state='idle',facing='down')=>{let actor={facing,animState:state,animStartedAt:0,deadUntil:0};return drawEntitySprite(key,actor,240,240);};
this.measureMonster=(key)=>monsterVisual(key);`,context);
for(const [job,w] of [['novice',64],['swordman',96]]){
 calls.length=0;assert.equal(context.measure(job),true);assert.equal(calls.length,2,'body + independent head');
 let [,sx,sy,sw,sh,dx,dy,dw,dh]=calls[0];assert.equal(sw,w);assert.equal(dw,w);assert.equal(dh,112);
 assert.equal(dx,240-w/2);assert.equal(dy+108,240);assert.ok(Number.isInteger(dx)&&Number.isInteger(dy));
 assert.equal(calls[1][3],64,'shared hair source width');assert.equal(calls[1][4],48,'shared hair source height');
}
calls.length=0;assert.equal(context.measure('poring'),true);assert.equal(calls[0][7],48);assert.equal(calls[0][8],48);
calls.length=0;assert.equal(context.measure('boss'),true);assert.equal(calls[0][7],96);assert.equal(calls[0][8],96);
context.s.equipment.weapon='rusty_sword';calls.length=0;assert.equal(context.measure('swordman','attack','down'),true);assert.equal(calls.length,3,'body hair equipped sword');assert.ok(calls[2][0].src.endsWith('/rusty_sword.png'));
calls.length=0;assert.equal(context.measure('swordman','attack','up'),true);assert.ok(calls[0][0].src.endsWith('/rusty_sword.png'),'weapon must render behind back-facing body');
assert.match(game,/imageSmoothingEnabled=false/);const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');assert.match(css,/\.game-wrap #game\{[^}]*image-rendering:pixelated/);
console.log('SPRITE SCALE PASS: independent body/head, grounded position, monster per-type enlargement, equipped sword layer order, pixelated canvas');
