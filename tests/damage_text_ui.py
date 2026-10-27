"""Native Canvas and real combat acceptance for original classic damage glyphs.

Run through scripts/test_browser.py; no reference sprite sheet is redistributed.
"""
import base64
import json
from pathlib import Path


async def run_checks(page, artifacts=None):
    output = Path(artifacts or "/workspace/legacy116/browser-worker/damage_text_ui")
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.set_viewport_size({"width": 1440, "height": 1000})
    await page.wait_for_function("window.BCGame && window.BCDamageText && BCRender.assets.ready")
    await page.keyboard.press("Escape")
    await page.evaluate(r'''() => {
      const damage=(patch={})=>({x:180,y:110,ttl:.85,kind:'damage',amount:1234,
        critical:false,magic:false,target:'monster',text:'old damage label',color:'#fff',...patch});
      const canvas=(w=360,h=180)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
      const stats=c=>{
        const ctx=c.getContext('2d',{willReadFrequently:true}),p=ctx.getImageData(0,0,c.width,c.height).data;
        let count=0,alphaMass=0,bright=0,dark=0,red=0,blue=0,hash=2166136261,left=c.width,top=c.height,right=-1,bottom=-1;
        for(let i=0;i<p.length;i++)hash=Math.imul(hash^p[i],16777619)>>>0;
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
          const i=(y*c.width+x)*4,a=p[i+3];if(!a)continue;count++;alphaMass+=a;
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
          if(a>128&&Math.min(p[i],p[i+1],p[i+2])>195)bright++;
          if(a>128&&Math.max(p[i],p[i+1],p[i+2])<110)dark++;
          if(a>128&&p[i]>p[i+1]*1.4&&p[i]>p[i+2]*1.2)red++;
          if(a>128&&p[i+2]>p[i]*1.2)blue++;
        }
        return {count,alphaMass,bright,dark,red,blue,hash,bounds:count?{left,top,right,bottom,width:right-left+1,height:bottom-top+1}:null};
      };
      const raster=(event,scale=1)=>{
        const a=canvas(),c=a.getContext('2d');c.setTransform(scale,0,0,scale,0,0);
        const e=Object.freeze({...event,x:180/scale,y:110/scale}),before=JSON.stringify(e);
        const transform=c.getTransform(),alpha=c.globalAlpha,style=c.fillStyle;
        const result=BCDamageText.draw(c,e,{scale});
        if(JSON.stringify(e)!==before)throw Error('Damage painter mutated event');
        const after=c.getTransform();
        if(['a','b','c','d','e','f'].some(k=>after[k]!==transform[k])||c.globalAlpha!==alpha||c.fillStyle!==style)throw Error('Damage painter leaked Canvas state');
        return {result,...stats(a)};
      };
      const cell=(sheet,x,y,w,h,title,event,scale=1)=>{
        const c=sheet.getContext('2d');c.fillStyle='#314841';c.fillRect(x,y,w-1,h-1);
        c.fillStyle='#e2d9b7';c.font='12px sans-serif';c.fillText(title,x+8,y+18);
        c.save();c.translate(x+w/2,y+h*.7);c.scale(scale,scale);
        BCDamageText.draw(c,{...event,x:0,y:0},{scale});c.restore();
      };
      window.__damageTest={damage,canvas,stats,raster,cell};
    }''')
    paths = []

    async def save_image(name, record):
        image = record.pop("image")
        path = output / name
        path.write_bytes(base64.b64decode(image.split(",", 1)[1]))
        paths.append(str(path))
        return record

    glyphs = await page.evaluate(r'''() => {
      const {damage,canvas,raster,cell}=__damageTest,sheet=canvas(1200,360),digits=[],scales=[];
      for(let digit=0;digit<10;digit++){
        const e=damage({amount:digit}),a=raster(e),b=raster(e);
        if(!a.result||a.count<20||a.bright<5||a.dark<5)throw Error('Digit '+digit+' lacks white fill / dark outline');
        if(a.hash!==b.hash)throw Error('Digit draw is nondeterministic');
        digits.push({digit,...a});cell(sheet,digit*120,0,120,120,String(digit),e);
      }
      if(new Set(digits.map(d=>d.hash)).size!==10)throw Error('Digit glyphs are not distinct');
      for(const [i,scale] of [.55,1,1.5,2].entries()){
        const e=damage(),s=raster(e,scale);scales.push({scale,...s});
        cell(sheet,i*300,120,300,120,'camera '+scale+'x / fixed CSS glyphs',e,scale);
      }
      const variants=[['normal',damage()],['magic',damage({magic:true})],['incoming',damage({target:'player'})],
        ['Critical!!',damage({critical:true})],['Miss',damage({kind:'miss',amount:undefined})],['Lucky!!',damage({kind:'lucky',target:'player',amount:undefined})]];
      const outcomes=variants.map(([name,e],i)=>{cell(sheet,i*200,240,200,120,name,e);return{name,...raster(e)};});
      if(outcomes.some(x=>!x.result||x.count<30))throw Error('Missing outcome raster');
      if(new Set(outcomes.map(x=>x.hash)).size!==outcomes.length)throw Error('Outcome pixels duplicate');
      if(outcomes.find(x=>x.name==='Critical!!').count<=outcomes[0].count*1.5)throw Error('Critical burst/text must stand out');
      return{image:sheet.toDataURL(),digits,scales,outcomes};
    }''')
    glyphs = await save_image("classic-damage-digits-outcomes.png", glyphs)
    widths = [record["bounds"]["width"] for record in glyphs["scales"]]
    heights = [record["bounds"]["height"] for record in glyphs["scales"]]
    assert max(widths) - min(widths) <= 2, widths
    assert max(heights) - min(heights) <= 2, heights

    temporal = await page.evaluate(r'''() => {
      const {damage,canvas,raster,cell}=__damageTest,times=[1,.85,.6,.3,.05,0],sheet=canvas(1440,320);
      const states=[['normal',damage()],['critical',damage({critical:true})]],checks=[];
      states.forEach(([name,e],row)=>{
        const frames=times.map((ttl,column)=>{
          const event={...e,ttl},record={name,ttl,...raster(event)};
          cell(sheet,column*240,row*160,240,160,name+' / '+Math.round((1-ttl)*1000)+'ms',event);
          checks.push(record);return record;
        });
        if(!frames[0].count||frames.at(-1).count||frames.at(-1).result)throw Error(name+' has invalid birth/expiry pixels');
        if(frames[4].alphaMass>=frames[1].alphaMass*.5)throw Error(name+' fails to fade before expiry');
        if(frames[4].bounds.top>=frames[1].bounds.top)throw Error(name+' does not float upward');
      });
      const routine=raster(damage({kind:undefined,text:'+20 HP'}));
      if(routine.result||routine.count)throw Error('Routine game labels must not become damage glyphs');
      return{image:sheet.toDataURL(),checks,routine};
    }''')
    temporal = await save_image("classic-damage-lifetime.png", temporal)

    # Every result is produced by the actual hit/dodge rules, never assigned to
    # an event manually. The returned numbers must equal the actual HP delta.
    actual = await page.evaluate(r'''() => {
      const C=BCCore,D=BCData;
      const outbound=(seed,classId='swordsman')=>{
        const s=C.createState(),job=D.classes[classId];
        Object.assign(s,{classId,weaponSchool:job.weaponType,job:'Swordman',seed});
        s.equipment.weapon=job.trainingWeapon;s.stats.luk=99;s.stats.dex=1;
        Object.assign(s.player,{x:470,y:280});s.monsters=[{uid:'damage-target',kind:'guardian',x:510,y:280,hp:D.monsters.guardian.hp,cd:9999,dead:0,provoke:0}];
        const result=C.act(s,'attack',{target:'damage-target'});if(!result.ok)throw Error(result.message);
        const events=s.effects.filter(e=>['damage','miss','lucky'].includes(e.kind));
        if(events.length!==1)throw Error('Attack must emit exactly one structured damage or miss event');
        const e=events[0],lost=D.monsters.guardian.hp-s.monsters[0].hp,impact=s.combatFeedback.events.find(e=>e.kind==='impact');
        if(e.target!=='monster'||(e.kind==='damage'?e.amount!==lost:lost!==0))throw Error('Outgoing label does not equal HP loss');
        if(e.kind==='damage'&&(e.critical!==(impact.result==='crit')||e.magic!==impact.magic))throw Error('Outgoing critical/magic is not actual impact result');
        return{classId,seed,lost,event:{...e},impact:{...impact}};
      };
      const outgoing=[outbound(158),outbound(1),outbound(161),outbound(1,'mage')];
      if(outgoing.map(x=>x.impact.result).join(',')!=='hit,crit,miss,hit')throw Error('Seeded actual hit/crit/miss outcomes changed');
      if(!outgoing[3].event.magic||outgoing[3].event.critical)throw Error('Magic cannot fabricate a physical critical');
      const incoming={};
      for(let seed=1;seed<=10000&&Object.keys(incoming).length<3;seed++){
        const s=C.createState();Object.assign(s,{seed});Object.assign(s.player,{x:470,y:280});
        s.stats.luk=99;s.settings.autoPotion=0;s.settings.autoSkill=false;
        s.monsters=[{uid:'enemy',kind:'guardian',x:500,y:280,hp:700,cd:0,dead:0,provoke:0}];
        const hp=s.player.hp;C.tick(s,1/60);
        const e=s.effects.find(e=>e.target==='player'&&['damage','miss','lucky'].includes(e.kind));
        if(!e||incoming[e.kind])continue;
        const lost=hp-s.player.hp;
        if(e.kind==='damage'?e.amount!==lost||lost<=0:lost!==0)throw Error('Incoming label does not equal HP loss');
        incoming[e.kind]={seed,lost,event:{...e}};
      }
      if(Object.keys(incoming).sort().join(',')!=='damage,lucky,miss')throw Error('Real hit/ordinary dodge/perfect dodge not observed');
      window.__actualDamage={outgoing,incoming};return __actualDamage;
    }''')

    # Instrument the real renderer on a detached Canvas. Combat events go through
    # the bitmap painter exactly once and cannot also fall through to fillText.
    rendering = await page.evaluate(r'''() => {
      const {outgoing,incoming}=__actualDamage,events=[...outgoing.map(v=>v.event),...Object.values(incoming).map(v=>v.event)];
      const s=BCCore.createState();s.effects=events.map((e,i)=>({...e,x:470,y:i<4?230:350,text:'__obsolete_damage_fallback_'+i,ttl:.8}));
      s.effects.push({x:470,y:350,text:'__routine_HP_label__',color:'#b6edb8',ttl:.8});
      const a=document.createElement('canvas');a.style.cssText='width:960px;height:560px;position:fixed;left:-2000px';document.body.append(a);
      const c=a.getContext('2d'),originalText=c.fillText,labels=[],calls=[],api=BCDamageText;
      c.fillText=function(text,...args){labels.push(String(text));return originalText.call(this,text,...args);};
      window.BCDamageText={...api,draw(ctx,e,options){const result=api.draw(ctx,e,options);if(result)calls.push({event:{...e},options:{...options},box:api.bounds(e,options)});return result;}};
      try{BCRender.draw(a,s);}finally{window.BCDamageText=api;a.remove();}
      if(calls.length!==events.length)throw Error('Renderer did not paint each structured combat event exactly once');
      if(calls[3].options.offsetY!==0||calls[6].options.offsetY!==0)throw Error('Newest event must stay closest to its own target');
      for(const target of ['monster','player']){
        const boxes=calls.filter(c=>c.event.target===target).map(c=>c.box).sort((a,b)=>a.top-b.top);
        for(let i=1;i<boxes.length;i++)if(boxes[i-1].bottom+5>boxes[i].top)throw Error('Simultaneous bounds lack their six-pixel gap');
      }
      if(labels.some(v=>v.startsWith('__obsolete_damage_fallback_')))throw Error('Duplicate old combat fillText label');
      if(labels.filter(v=>v==='__routine_HP_label__').length!==1)throw Error('Routine labels changed');
      if(labels.some(v=>/^guard$/i.test(v)))throw Error('Guard fabricated without a guard outcome');
      return{image:a.toDataURL(),events:events.length,calls,labels};
    }''')
    rendering = await save_image("classic-damage-simultaneous.png", rendering)

    # Rasterize the actual options chosen by the renderer independently of its
    # advertised bounds, then exercise more than four simultaneous hits.
    lanes = await page.evaluate(r'''() => {
      const {canvas,stats}=__damageTest,events=__actualDamage.outgoing.map(v=>v.event),checks=[];
      const s=BCCore.createState();s.monsters=[];
      s.effects=Array.from({length:8},(_,i)=>({...events[i%4],x:470,y:490,ttl:1-i*.08}));
      const game=canvas(960,560);game.style.cssText='width:960px;height:560px;position:fixed;left:-2000px';document.body.append(game);
      const calls=[],api=BCDamageText;
      window.BCDamageText={...api,draw(c,e,options){calls.push({event:e,options});return api.draw(c,e,options);}};
      try{BCRender.draw(game,s);}finally{window.BCDamageText=api;game.remove();}
      if(calls.length!==8||new Set(calls.map(c=>c.options.offsetY)).size!==8)throw Error('Packing reused a position after four events');
      for(const [index,{event,options}] of calls.entries()){
        const a=canvas(360,700),e={...event,x:180,y:650};
        api.draw(a.getContext('2d'),e,{...options,scale:1,snapX:0,snapY:0});
        checks.push({index,kind:e.kind,critical:e.critical,options,...stats(a)});
      }
      const sorted=checks.slice().sort((a,b)=>a.bounds.top-b.bounds.top);
      for(let i=1;i<sorted.length;i++)if(sorted[i-1].bounds.bottom>=sorted[i].bounds.top)throw Error('Simultaneous native glyph/flash pixels overlap between events '+sorted[i-1].index+' and '+sorted[i].index);
      return checks;
    }''')

    # A real hit and miss use different text Y offsets. The target at Y=310
    # straddled the old 20-world-unit bucket boundary despite being one target.
    boundary = await page.evaluate(r'''() => {
      const {canvas,stats}=__damageTest,events=[];
      for(const seed of [158,161]){
        const s=BCCore.createState(),job=BCData.classes.swordsman;
        Object.assign(s,{classId:'swordsman',weaponSchool:job.weaponType,job:'Swordman',seed});
        s.equipment.weapon=job.trainingWeapon;s.stats.luk=99;s.stats.dex=1;
        Object.assign(s.player,{x:250,y:310});
        s.monsters=[{uid:'boundary',kind:'guardian',x:280,y:310,hp:700,cd:9999,dead:0}];
        if(!BCCore.act(s,'attack',{target:'boundary'}).ok)throw Error('Boundary attack rejected');
        events.push(s.effects.find(e=>['damage','miss'].includes(e.kind)));
      }
      if(events[0].kind!=='damage'||events[1].kind!=='miss'||events[0].y!==285||events[1].y!==290)throw Error('Real hit/miss fixture changed');
      const s=BCCore.createState();s.monsters=[];s.effects=events;
      const game=canvas(1440,1000);game.style.cssText='width:1440px;height:1000px;position:fixed;left:-2000px';document.body.append(game);
      const api=BCDamageText,records=[];
      window.BCDamageText={...api,draw(c,e,options){
        const isolated=canvas(game.width,game.height),ic=isolated.getContext('2d');ic.setTransform(c.getTransform());
        api.draw(ic,e,options);records.push({event:e,options,...stats(isolated)});return api.draw(c,e,options);
      }};
      try{BCRender.draw(game,s);}finally{window.BCDamageText=api;game.remove();}
      if(records.length!==2||records.some(r=>!r.bounds))throw Error('Missing real boundary glyph pixels');
      const [a,b]=records.map(r=>r.bounds);
      if(a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top)throw Error('Real hit/miss pixels overlap across a target-position boundary');
      return records;
    }''')

    # Keep the existing live game loop and use a real keyboard attack. Capture
    # the first visible critical frame from native RAF, then wait for expiry.
    await page.evaluate(r'''() => {
      const C=BCCore,D=BCData,target=BCGame.state,s=C.createState(),job=D.classes.swordsman;
      Object.assign(s,{classId:'swordsman',weaponSchool:job.weaponType,job:'Swordman',seed:1});
      s.equipment.weapon=job.trainingWeapon;s.stats.luk=99;s.stats.dex=1;
      s.settings.autoPotion=0;s.settings.autoSkill=false;Object.assign(s.player,{x:470,y:280});
      s.monsters=[{uid:'live-critical',kind:'guardian',x:510,y:280,hp:D.monsters.guardian.hp,cd:9999,dead:0,provoke:0}];s.target='live-critical';
      for(const key of Object.keys(target))delete target[key];Object.assign(target,s);
      const original=BCRender.draw;window.__damageRAF={frames:0};
      BCRender.draw=function(canvas,state){original(canvas,state);__damageRAF.frames++;
        const event=state.effects.find(e=>e.kind==='damage'&&e.critical&&e.ttl<.9&&e.ttl>.65);
        if(event&&!__damageRAF.image){__damageRAF.image=canvas.toDataURL();__damageRAF.event={...event};}
      };
    }''')
    await page.locator("#game").focus()
    await page.keyboard.press("Space")
    await page.wait_for_function("__damageRAF.image")
    live = await page.evaluate("({image:__damageRAF.image,event:__damageRAF.event,frames:__damageRAF.frames,hpLost:BCData.monsters.guardian.hp-BCGame.state.monsters[0].hp})")
    live = await save_image("classic-damage-real-raf-critical.png", live)
    assert live["event"]["amount"] == live["hpLost"]
    await page.wait_for_function("!BCGame.state.effects.some(e=>e.kind==='damage')")

    # Render the exact real outcomes together on original game scenery; capture
    # both the desktop/mobile game canvas and the complete UI layout.
    viewport_checks = []
    for width, height in [(1440, 1000), (390, 844)]:
        await page.set_viewport_size({"width": width, "height": height})
        await page.wait_for_timeout(100)
        shot = await page.evaluate(r'''() => {
          const s=BCCore.createState(),events=[...__actualDamage.outgoing.map(v=>v.event),...Object.values(__actualDamage.incoming).map(v=>v.event)];
          Object.assign(s.player,{x:470,y:280});s.monsters=[];
          const game=document.getElementById('game'),camera=BCRender.view(game,s),center=camera.x+camera.width/2;
          s.effects=events.map((e,i)=>({...e,x:center+(i%3-1)*Math.min(95,camera.width/4),y:220+Math.floor(i/3)*75,ttl:.85}));
          window.__damageViewportState=s;
          window.__damageViewportDraw=BCRender.draw;
          // Keep this outcome replay visible for the screenshot while the real
          // simulation continues. This fixture uses copies of actual outcomes.
          BCRender.draw=function(canvas,state){return __damageViewportDraw(canvas,canvas.id==='game'?s:state);};
          BCRender.draw(game,s);
          const c=game.getContext('2d'),data=c.getImageData(0,0,game.width,game.height).data;
          if(!data.some((v,i)=>i%4===3&&v))throw Error('Game canvas empty');
          return{image:game.toDataURL(),viewport:innerWidth,canvasWidth:game.width,canvasHeight:game.height,camera,
            overflow:document.documentElement.scrollWidth>innerWidth+1,events:s.effects.map(e=>({kind:e.kind,amount:e.amount,critical:e.critical,magic:e.magic,target:e.target}))};
        }''')
        shot = await save_image(f"classic-damage-game-{width}.png", shot)
        assert not shot["overflow"], shot
        assert len(shot["events"]) == 7
        await page.screenshot(path=str(output / f"classic-damage-ui-{width}.png"), full_page=True)
        combo = await page.evaluate(r'''() => {
          const s=__damageViewportState,game=document.getElementById('game'),camera=BCRender.view(game,s),center=camera.x+camera.width/2;
          const events=[...__actualDamage.outgoing.map(v=>v.event),...Object.values(__actualDamage.incoming).map(v=>v.event)];
          s.effects=events.map((e,i)=>({...e,x:center,y:i<4?300:440,ttl:.85}));
          BCRender.draw(game,s);return{image:game.toDataURL(),events:s.effects.length};
        }''')
        await save_image(f"classic-damage-combo-{width}.png", combo)
        await page.evaluate("() => { BCRender.draw=__damageViewportDraw; }")
        paths.append(str(output / f"classic-damage-ui-{width}.png"))
        viewport_checks.append(shot)
    assert not errors, errors
    result = {"glyphs": glyphs, "temporal": temporal, "actualCombat": actual,
              "renderer": rendering, "simultaneousLanes": lanes, "realBoundaryPacking": boundary, "liveCritical": live, "viewports": viewport_checks,
              "checks": ["ten original outlined white bitmap digits", "deterministic immutable native Canvas painter",
                         "fixed CSS glyph size across camera scales", "distinct normal/magic/player/critical/miss/lucky",
                         "immediate birth and one-second float/fade/expiry", "outgoing and incoming HP deltas equal numbers",
                         "real physical critical, ordinary miss and perfect dodge", "no fabricated Guard",
                         "single painter call per combat event without duplicate fallback text", "routine labels preserved",
                         "real keyboard/RAF critical capture and expiry", "1440/390 original scenery and UI"],
              "images": paths, "pageErrors": errors}
    (output / "damage-text-browser.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return result
