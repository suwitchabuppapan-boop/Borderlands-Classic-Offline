"""Real Chromium Canvas, temporal geometry, and live RAF acceptance.

Run: python tests/combat_effects_ui.py [--base-url URL] [--artifacts DIRECTORY]
Each contact sheet is streamed separately and is smaller than 3000px per side.
"""
import argparse
import asyncio
import base64
import json
from pathlib import Path


async def run_checks(page, artifacts=None):
    output = Path(artifacts or '/workspace/vfx115')
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.set_viewport_size({'width': 1440, 'height': 1000})
    await page.wait_for_function('window.BCGame && window.BCCombatEffects && window.BCWeaponVFX && window.BCSkillVFX && BCRender.assets.ready')
    await page.keyboard.press('Escape')
    await page.evaluate(r'''() => {
      const FX=BCCombatEffects,D=BCData,directions=[[0,1],[1,0],[0,-1],[-1,0]],times=[0,.25,.5,.8];
      const event=(patch={})=>({id:1,kind:'attack',source:{x:150,y:145},target:{x:205,y:145},facing:1,weaponType:'sword',skillId:null,result:null,phase:'direct',amount:null,magic:false,age:.10,duration:.28,...patch});
      const state=(events=[],extra={})=>({player:{x:150,y:145,facing:1},clock:1,monsters:[],combatFeedback:{events},...extra});
      const canvas=(w,h)=>{if(w>=3000||h>=3000)throw Error('Contact sheet exceeds size budget');const a=document.createElement('canvas');a.width=w;a.height=h;return a;};
      const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
      const geometryMethods=new Set(['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','translate','rotate','scale','fillRect']);
      const pixels=s=>{
        const a=canvas(360,320),real=a.getContext('2d',{willReadFrequently:true}),geometry=[];
        const c=new Proxy(real,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return (...args)=>{if(geometryMethods.has(key))geometry.push([key,...args]);return Reflect.apply(value,target,args);};},set(target,key,value){return Reflect.set(target,key,value,target);}});
        const before=JSON.stringify(s);freeze(s);FX.drawGround(c,s);FX.drawFront(c,s);
        if(before!==JSON.stringify(s))throw Error('Canvas draw mutated state');
        const data=real.getImageData(0,0,a.width,a.height).data;let count=0,opaque=0,alphaMass=0,maxAlpha=0,hash=2166136261;
        for(let i=0;i<data.length;i++){if(i%4===3){if(data[i])count++;if(data[i]>=96)opaque++;alphaMass+=data[i];maxAlpha=Math.max(maxAlpha,data[i]);}hash=Math.imul(hash^data[i],16777619)>>>0;}
        let corePixels=0;for(let i=3;i<data.length;i+=4)if(data[i]>=Math.max(1,maxAlpha*.7))corePixels++;
        let geometryHash=2166136261;for(const ch of JSON.stringify(geometry))geometryHash=Math.imul(geometryHash^ch.charCodeAt(0),16777619)>>>0;
        return {count,opaque,corePixels,maxAlpha,alphaMass,hash,geometryHash};
      };
      const painter=(a,x,y,w,h,title)=>{const c=a.getContext('2d');c.fillStyle='#263b41';c.fillRect(x,y,w-1,h-1);c.fillStyle='#f5e5bd';c.font='13px sans-serif';c.fillText(title,x+10,y+21);return c;};
      const person=(c,source,cls,facing)=>BCRender.person(c,source.x,source.y,{classId:cls,facing,hair:0,pose:{mode:'attack',facing,progress:.45}});
      const paint=(a,x,y,w,h,title,s,cls,facing=1)=>{const c=painter(a,x,y,w,h,title);c.save();c.translate(x,y);FX.drawGround(c,s);if(cls)person(c,s.player,cls,facing);FX.drawFront(c,s);c.restore();};
      const types=Object.keys(FX.weaponProfiles),skills=Object.values(D.classes).filter(c=>c.tier>0).map(c=>c.skill); // Retain all 15 original signature profiles; class_skills_ui covers the expanded catalog.
      window.__classicFX={FX,D,directions,times,event,state,canvas,pixels,painter,person,paint,types,skills};
    }''')
    image_paths = []

    async def save_sheet(name, record):
        data = record.pop('image')
        path = output / name
        path.write_bytes(base64.b64decode(data.split(',', 1)[1]))
        image_paths.append(str(path))
        return record

    # 12 weapon profiles x 4 directions x 4 real normalized ages: 192 frames.
    # Two six-profile sheets keep browser Canvas allocations and transfer bounded.
    weapon_checks = []
    for start in (0, 6):
        record = await page.evaluate(r'''start => {
          const {FX,D,directions,times,event,state,canvas,pixels,paint,types}=__classicFX;
          const sheet=canvas(1280,1680),checks=[];
          types.slice(start,start+6).forEach((weaponType,row)=>{
            const cls=Object.keys(D.classes).find(id=>D.classes[id].weaponType===weaponType)||'villager';
            for(let facing=0;facing<4;facing++){
              const [dx,dy]=directions[facing],source={x:150,y:145},target={x:150+dx*55,y:145+dy*55};
              const frames=times.map(progress=>{
                const e=event({weaponType,facing,source,target,age:progress*.28,magic:!!D.weaponTypes[weaponType].basicMagic});
                const s=state([e],{player:{...source,facing}}),check={weaponType,facing,progress,...pixels(s)};
                if(check.count<60||check.corePixels<8||check.maxAlpha<10)throw Error(weaponType+' needs a legible filled silhouette at '+progress);
                checks.push(check);return check;
              });
              if(new Set(frames.map(x=>x.geometryHash)).size!==4)throw Error(weaponType+' geometry does not evolve in direction '+facing);
              const e=event({weaponType,facing,source,target,age:.10,magic:!!D.weaponTypes[weaponType].basicMagic});
              paint(sheet,facing*320,row*280,320,280,weaponType+' · '+['DOWN','RIGHT','UP','LEFT'][facing],state([e],{player:{...source,facing}}),cls,facing);
            }
            for(const progress of times)if(new Set(checks.filter(x=>x.weaponType===weaponType&&x.progress===progress).map(x=>x.hash)).size!==4)throw Error(weaponType+' directional pixels duplicate');
          });
          return {image:sheet.toDataURL(),checks};
        }''', start)
        record = await save_sheet(f'classic-weapons-directions-{start // 6 + 1}.png', record)
        weapon_checks.extend(record['checks'])
    assert len(weapon_checks) == 192
    for progress in (0, .25, .5, .8):
        at_time = [c for c in weapon_checks if c['progress'] == progress and c['facing'] == 1]
        assert len({c['hash'] for c in at_time}) == 12, f'Weapon profiles share pixels at {progress}'

    # Dedicated motion strips make the redesign reviewable as shapes, not just counts.
    for start in (0, 6):
        record = await page.evaluate(r'''start => {
          const {D,times,event,state,canvas,paint,types}=__classicFX,sheet=canvas(1280,1680);
          types.slice(start,start+6).forEach((weaponType,row)=>times.forEach((progress,column)=>{
            const cls=Object.keys(D.classes).find(id=>D.classes[id].weaponType===weaponType)||'villager';
            paint(sheet,column*320,row*280,320,280,weaponType+' · '+Math.round(progress*280)+' / 280 ms',state([event({weaponType,age:progress*.28,magic:!!D.weaponTypes[weaponType].basicMagic})]),cls);
          }));return {image:sheet.toDataURL()};
        }''', start)
        await save_sheet(f'classic-weapons-motion-{start // 6 + 1}.png', record)

    skill_checks = []
    for start in (0, 5, 10):
        record = await page.evaluate(r'''start => {
          const {D,times,event,state,canvas,pixels,paint,skills}=__classicFX,sheet=canvas(1280,1500),checks=[];
          skills.slice(start,start+5).forEach((skillId,row)=>{
            const definition=D.skills[skillId],cls=definition.owner,weaponType=D.classes[cls].weaponType;
            const source=definition.radius?{x:160,y:170}:{x:110,y:170},target=definition.radius?{x:160,y:170}:{x:225,y:170};
            const frames=times.map((progress,column)=>{
              const s=state([event({kind:'skill',skillId,weaponType,source,target,magic:!!definition.magic,duration:.45,age:progress*.45})],{player:{...source,facing:1}});
              const check={skillId,progress,...pixels(s)};
              if(check.count<90||check.corePixels<10||check.maxAlpha<10)throw Error(skillId+' needs a filled silhouette at '+progress);
              checks.push(check);paint(sheet,column*320,row*300,320,300,skillId+' · '+Math.round(progress*450)+' / 450 ms',s,cls);return check;
            });
            if(new Set(frames.map(x=>x.geometryHash)).size!==4)throw Error(skillId+' geometry does not evolve');
          });return {image:sheet.toDataURL(),checks};
        }''', start)
        record = await save_sheet(f'classic-skills-motion-{start // 5 + 1}.png', record)
        skill_checks.extend(record['checks'])
    assert len(skill_checks) == 60
    for progress in (0, .25, .5, .8):
        assert len({c['hash'] for c in skill_checks if c['progress'] == progress}) == 15

    details = await page.evaluate(r'''() => {
      const {D,event,state,canvas,pixels,paint,painter,person}=__classicFX;
      const base={buffs:{},traps:[],orbCharges:0,orbTimer:0};
      const persistentStates=[
        ['ward_script',{classCombat:{...base,buffs:{ward_script:{remaining:3}}}}],
        ['shield_counter',{classCombat:{...base,buffs:{shield_counter:{remaining:3}}}}],
        ['garuda_combo',{classCombat:{...base,buffs:{garuda_combo:{remaining:3}}}}],
        ['orb charges 3/3',{classCombat:{...base,orbCharges:3,orbTimer:8}}],
        ['naga_trap · radius 34',{classCombat:{...base,traps:[{id:'naga_trap',x:150,y:145,remaining:8}]}}],
        ['moon_venom DOT',{monsters:[{x:150,y:145,hp:10,dead:0,classDots:[{id:'moon_venom',remaining:3}]}]}],
        ['tiger_rend DOT',{monsters:[{x:150,y:145,hp:10,dead:0,classDots:[{id:'tiger_rend',remaining:3}]}]}],
        ['expired · no geometry',{classCombat:{...base,buffs:{ward_script:{remaining:0}},orbCharges:3,orbTimer:0,traps:[{id:'naga_trap',x:150,y:145,remaining:0}]}}]
      ];
      const sheet=canvas(1280,560),checks=[];
      persistentStates.forEach(([name,extra],i)=>{
        const s=state([],extra),check=pixels(s);if(i<7&&check.count<10)throw Error(name+' missing pixels');if(i===7&&check.count!==0)throw Error('Expired state has pixels');
        checks.push({name,...check});paint(sheet,(i%4)*320,Math.floor(i/4)*280,320,280,name,s,i===5||i===6?null:'acolyte');
      });
      const hit=e=>pixels(state([event({kind:'impact',duration:.25,...e})]));
      const miss=hit({result:'miss'}),normal=hit({result:'hit'}),crit=hit({result:'crit'}),magic=hit({result:'hit',magic:true}),magicCrit=hit({result:'crit',magic:true});
      if(miss.count!==0||crit.hash===normal.hash||magic.hash!==magicCrit.hash)throw Error('Actual hit/critical/miss pixels incorrect');
      const realCase=(seed,classId='swordsman')=>{
        const s=BCCore.createState(),cls=D.classes[classId];
        Object.assign(s,{classId,weaponSchool:cls.weaponType,job:'Swordman',seed});s.equipment.weapon=cls.trainingWeapon;
        s.stats.luk=99;s.stats.dex=1;s.player.x=105;s.player.y=150;
        s.monsters=[{uid:'critical-target',kind:'guardian',x:145,y:150,hp:10000,cd:9999,dead:0,provoke:0}];
        const r=BCCore.act(s,'attack',{target:'critical-target'});if(!r.ok)throw Error(r.message);
        const impact=s.combatFeedback.events.find(e=>e.kind==='impact');
        if(impact.duration!==.25)throw Error('Critical lifetime no longer matches actual impact event');
        const savedTarget={...impact.target};s.monsters[0].x=900;
        if(impact.target.x!==savedTarget.x||!Object.isFrozen(impact.target))throw Error('Impact lost its immutable hit target');
        return {classId,seed,impact,hpLost:10000-s.monsters[0].hp};
      };
      const criticalCases=[realCase(158),realCase(1),realCase(161),realCase(1,'mage')];
      if(criticalCases.map(v=>v.impact.result).join(',')!=='hit,crit,miss,hit')throw Error('Seeded actual damage outcomes changed');
      const criticalChecks=criticalCases.map(record=>({...record,...pixels(state([{...record.impact,age:.08}]))}));
      const critical=criticalChecks[1],normalHit=criticalChecks[0];
      if(critical.count<1200||critical.opaque<120)throw Error('Critical needs a readable solid flash on the target body');
      if(critical.count<normalHit.count*1.35)throw Error('Critical does not stand out from a normal hit');
      const times=[0,.04,.08,.14,.20,.249,.25],criticalTimesteps=times.map(age=>({age,...pixels(state([{...criticalCases[1].impact,age}]))}));
      if(!criticalTimesteps[0].count||criticalTimesteps.at(-1).count)throw Error('Critical must appear immediately and expire at 250ms');
      window.__classicFX.criticalCases=criticalCases;
      return {image:sheet.toDataURL(),persistentChecks:checks,impacts:{miss,normal,crit,magic,magicCrit},criticalChecks,criticalTimesteps};
    }''')
    details = await save_sheet('classic-persistent-states.png', details)
    for name, mode in [('classic-real-critical-vs-normal.png', 'cases'), ('classic-critical-timesteps.png', 'time')]:
        record = await page.evaluate(r'''mode => {
          const {FX,event,state,canvas,painter,person,criticalCases}=__classicFX,times=[0,.04,.08,.14,.20,.249,.25];
          const sheet=canvas(mode==='cases'?1120:1960,250),records=mode==='cases'?criticalCases:times;
          records.forEach((record,i)=>{
            const e=mode==='cases'?{...record.impact,age:.08}:{...criticalCases[1].impact,age:record};
            const title=mode==='cases'?record.classId+' · '+e.result+' · seed '+record.seed:Math.round(record*1000)+' / 250 ms';
            const c=painter(sheet,i*280,0,280,250,title);c.save();c.translate(i*280,0);person(c,e.source,mode==='cases'?record.classId:'swordsman',1);
            const body=BCRender.cells.sprites[14],height=48,width=height*body.w/body.h;
            c.drawImage(BCRender.images.sprites,body.x,body.y,body.w,body.h,e.target.x-width/2,e.target.y-height,width,height);
            FX.drawFront(c,state([e]));c.restore();
          });return {image:sheet.toDataURL()};
        }''', mode)
        await save_sheet(name, record)
    sheets = {'weaponChecks': weapon_checks, 'skillChecks': skill_checks, **details}

    # All three original map images still pass through the actual renderer.
    # Their untouched corner pixels must be identical with combat effects present.
    backgrounds = await page.evaluate(r'''() => {
      const names=['meadow','woodland','cavern'],result=[];
      const a=document.createElement('canvas');a.style.cssText='width:960px;height:560px;position:fixed;left:-2000px';document.body.append(a);
      try{
        const c=a.getContext('2d'),original=c.drawImage,mapDraws=[];
        c.drawImage=function(image,...args){const name=names.find(name=>BCRender.images[name]===image);if(name)mapDraws.push(name);return original.call(this,image,...args);};
        const hash=data=>{let h=2166136261;for(const value of data)h=Math.imul(h^value,16777619)>>>0;return h;};
        for(let zone=0;zone<3;zone++){
          const s=BCCore.createState();s.zone=zone;s.monsters=[];s.player.x=470;s.player.y=280;
          BCRender.draw(a,s);const before=hash(c.getImageData(100,100,32,32).data);
          s.combatFeedback={events:[__classicFX.event({source:{x:470,y:280},target:{x:510,y:280},age:.1})]};
          BCRender.draw(a,s);const after=hash(c.getImageData(100,100,32,32).data),image=BCRender.images[names[zone]];
          if(before!==after||!mapDraws.includes(names[zone])||!image.complete||!image.naturalWidth)throw Error('Original background lost in zone '+zone);
          result.push({zone,name:names[zone],src:image.src,width:image.naturalWidth,height:image.naturalHeight,cornerHash:before,cornerPreserved:before===after});
        }
        if(new Set(result.map(x=>x.cornerHash)).size!==3)throw Error('Map backgrounds no longer distinct');
        return result;
      }finally{a.remove();}
    }''')

    # Observe actual game RAF drawing; do not replace RAF, simulation time, or damage.
    await page.evaluate(r'''() => {
      const original=BCRender.draw;
      window.__combatRaf={frames:0,seen:[],draws:0};
      BCRender.draw=function(canvas,s){
        original(canvas,s);const record=window.__combatRaf;record.frames++;
        if(s.combatFeedback?.events.length){record.draws++;record.seen=s.combatFeedback.events.map(e=>({...e}));}
        const critical=s.combatFeedback?.events.find(e=>e.kind==='impact'&&e.result==='crit'&&!e.magic&&e.age>=.03&&e.age<.14);
        if(critical&&!record.criticalFrame){record.criticalFrame=canvas.toDataURL();record.criticalEvent={...critical};}
      };
      window.__combatSetup=classId=>{
        const target=BCGame.state,next=BCCore.createState(),job=BCData.classes[classId];
        next.classId=classId;next.job=job.tier?'Swordman':'Novice';next.weaponSchool=job.weaponType;next.equipment.weapon=job.trainingWeapon;
        next.player.x=470;next.player.y=280;
        next.stats.dex=60;next.stats.int=60;next.stats.luk=1;const stats=BCCore.stats(next);next.player.sp=stats.maxSp;next.player.hp=stats.maxHp;
        next.monsters=[{uid:'fx-target',kind:'guardian',x:510,y:280,hp:BCData.monsters.guardian.hp,cd:9999,dead:0,provoke:0}];next.target='fx-target';
        next.auto=false;next.settings.autoSkill=false;next.settings.autoPotion=0;next.skills[job.skill]=1;next.hotbar[0]='skill:'+job.skill;
        for(const key of Object.keys(target))delete target[key];Object.assign(target,next);return target;
      };
      __combatSetup('swordsman');
    }''')
    await page.locator('#game').focus()
    await page.keyboard.press('Space')
    await page.wait_for_function('__combatRaf.draws>0 && BCGame.state.combatFeedback.events.some(e=>e.kind==="attack" && e.age>0)')
    attack = await page.evaluate('''() => ({events:BCGame.state.combatFeedback.events.map(e=>({...e})), frames:__combatRaf.frames,hp:BCGame.state.monsters[0].hp})''')
    assert any(e['kind'] == 'attack' for e in attack['events'])
    assert any(e['kind'] == 'impact' for e in attack['events'])
    assert attack['hp'] < 700
    # The real menu remains open while the RAF simulation ages and expires the attack.
    await page.evaluate("BCGame.openPanel('help')")
    menu_clock = await page.evaluate('BCGame.state.clock')
    menu_frames = await page.evaluate('__combatRaf.frames')
    await page.wait_for_timeout(220)
    assert await page.evaluate('BCGame.state.clock') > menu_clock
    assert await page.evaluate('__combatRaf.frames') > menu_frames
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')
    await page.keyboard.press('Escape')
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')

    # A seeded real critical resolves through C.act and is captured from an actual RAF draw.
    real_critical = await page.evaluate('''() => {
      const s=__combatSetup('swordsman');s.seed=1;s.stats.luk=99;s.stats.dex=1;
      delete __combatRaf.criticalFrame;delete __combatRaf.criticalEvent;
      const before=s.monsters[0].hp,r=BCCore.act(s,'attack',{target:s.target});if(!r.ok)throw Error(r.message);
      const impact=s.combatFeedback.events.find(e=>e.kind==='impact');
      if(impact.result!=='crit'||impact.magic)throw Error('Seed did not resolve an actual physical critical');
      return {impact:{...impact},hpLost:before-s.monsters[0].hp};
    }''')
    await page.wait_for_function('!!__combatRaf.criticalFrame')
    critical_frame = await page.evaluate('__combatRaf.criticalFrame')
    critical_path = output / 'classic-real-raf-critical.png'
    critical_path.write_bytes(base64.b64decode(critical_frame.split(',', 1)[1]))
    image_paths.append(str(critical_path))
    real_critical['rafImpact'] = await page.evaluate('__combatRaf.criticalEvent')
    assert real_critical['hpLost'] == real_critical['impact']['amount'] > 0
    assert real_critical['rafImpact']['target'] == real_critical['impact']['target']
    assert real_critical['rafImpact']['duration'] == .25
    assert 0 < real_critical['rafImpact']['age'] < .25
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')

    # Hotbar keyboard cast follows real validation/SP/CD and is seen in actual RAF drawing.
    await page.evaluate("__combatSetup('mage');__combatRaf.draws=0")
    cast_sp = await page.evaluate('BCGame.state.player.sp')
    await page.locator('#game').focus()
    await page.keyboard.press('1')
    await page.wait_for_function('__combatRaf.draws>0 && __combatRaf.seen.some(e=>e.kind==="skill" && e.skillId==="lotus_bolt")')
    cast = await page.evaluate('''() => ({events:__combatRaf.seen,sp:BCGame.state.player.sp,cd:BCGame.state.cooldowns.lotus_bolt})''')
    assert cast['sp'] == cast_sp - 7 and cast['cd'] > 0
    await page.screenshot(path=str(output / 'classic-real-raf-cast.png'))
    image_paths.append(str(output / 'classic-real-raf-cast.png'))
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')

    # Capture real keyboard combat at both requested viewports, against the live map.
    viewport_combat = []
    render_timings = []
    for width, height in [(1440, 1000), (390, 844)]:
        await page.set_viewport_size({'width': width, 'height': height})
        await page.evaluate("__combatSetup('lotus_mage');__combatRaf.draws=0")
        await page.locator('#game').focus()
        await page.keyboard.press('1')
        await page.wait_for_function('__combatRaf.draws>0 && __combatRaf.seen.some(e=>e.kind==="skill" && e.skillId==="lotus_storm")')
        frame = await page.evaluate('''() => ({width:innerWidth,height:innerHeight,events:BCGame.state.combatFeedback.events.map(e=>({...e})),map:BCGame.state.zone,canvas:{width:document.querySelector('#game').width,height:document.querySelector('#game').height}})''')
        assert frame['width'] == width
        assert any(e['kind'] == 'skill' and e['skillId'] == 'lotus_storm' for e in frame['events']), frame
        shot = output / f'classic-combat-{width}.png'
        await page.screenshot(path=str(shot))
        image_paths.append(str(shot))
        viewport_combat.append(frame)
        await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')
        timing = await page.evaluate(r'''() => {
          const s=BCCore.createState(),job=BCData.classes.lotus_mage,live=document.querySelector('#game');
          Object.assign(s,{classId:'lotus_mage',weaponSchool:job.weaponType,job:job.name,seed:1});
          s.equipment.weapon=job.trainingWeapon;s.skills.lotus_storm=1;s.stats.int=60;s.stats.dex=60;
          s.player.x=470;s.player.y=280;s.player.sp=BCCore.stats(s).maxSp;
          s.monsters=Array.from({length:6},(_,i)=>({uid:'timing-'+i,kind:'guardian',x:530+Math.cos(i*Math.PI/3)*25,y:280+Math.sin(i*Math.PI/3)*25,hp:BCData.monsters.guardian.hp,cd:9999,dead:0,provoke:0}));
          const cast=BCCore.act(s,'skill',{id:'lotus_storm',target:'timing-0'});if(!cast.ok)throw Error(cast.message);
          BCCombatFeedback.tick(s,.08);
          const impacts=s.combatFeedback.events.filter(e=>e.kind==='impact').length;
          if(impacts!==6)throw Error('Timing fixture did not create six actual damage impacts');
          const baseline=structuredClone(s);baseline.combatFeedback.events=[];
          const a=document.createElement('canvas');a.style.cssText='position:fixed;left:-3000px;width:'+live.clientWidth+'px;height:'+live.clientHeight+'px';document.body.append(a);
          try{
            const measure=state=>{for(let i=0;i<5;i++)BCRender.draw(a,state);const samples=[];
              for(let i=0;i<20;i++){const start=performance.now();BCRender.draw(a,state);samples.push(performance.now()-start);}
              samples.sort((a,b)=>a-b);return {samples:20,medianMs:samples[10],p95Ms:samples[18],maxMs:samples[19]};};
            return {viewportWidth:innerWidth,canvasWidth:a.clientWidth,canvasHeight:a.clientHeight,devicePixelRatio,actualSkill:'lotus_storm',actualImpacts:impacts,events:s.combatFeedback.events.length,baseline:measure(baseline),withEffects:measure(s),measurement:'Warmed synchronous BCRender.draw CPU submission; diagnostic, no FPS assertion.'};
          }finally{a.remove();}
        }''')
        render_timings.append(timing)
    await page.set_viewport_size({'width': 1440, 'height': 1000})

    # Real skill state remains visible after the cast gesture and expires via real RAF tick.
    await page.evaluate("__combatSetup('acolyte')")
    await page.locator('#game').focus()
    await page.keyboard.press('1')
    await page.wait_for_function('BCGame.state.classCombat?.buffs.ward_script?.remaining>0')
    await page.wait_for_timeout(520)
    assert await page.evaluate('BCGame.state.combatFeedback.events.length') == 0
    assert await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining') > 0
    await page.evaluate("BCGame.openPanel('help')")
    buff_time = await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining')
    await page.wait_for_timeout(120)
    assert await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining') < buff_time
    await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining=.12')
    await page.wait_for_function('!BCGame.state.classCombat.buffs.ward_script')
    await page.keyboard.press('Escape')

    await page.evaluate("__combatSetup('orb_weaver')")
    await page.locator('#game').focus()
    await page.keyboard.press('Space')
    await page.wait_for_function('BCGame.state.classCombat?.orbCharges===1')
    await page.evaluate('BCGame.state.classCombat.orbTimer=.12')
    await page.wait_for_function('BCGame.state.classCombat.orbCharges===0')

    await page.evaluate("__combatSetup('moon_shadow')")
    await page.locator('#game').focus()
    await page.keyboard.press('1')
    await page.wait_for_function('BCGame.state.monsters[0].classDots?.length===1')
    await page.evaluate('BCGame.state.monsters[0].classDots[0].remaining=.12')
    await page.wait_for_function('BCGame.state.monsters[0].classDots.length===0')

    # Cast real trap then let its validated target move out before the next simulation frame.
    await page.evaluate('''() => {const s=__combatSetup('naga_ranger');const r=BCCore.act(s,'skill',{id:'naga_trap',target:s.target});if(!r.ok)throw Error(r.message);s.monsters[0].x=650;}''')
    await page.wait_for_timeout(80)
    assert await page.evaluate('BCGame.state.classCombat.traps.length') == 1
    await page.evaluate('BCGame.state.classCombat.traps[0].remaining=.12')
    await page.wait_for_function('BCGame.state.classCombat.traps.length===0')

    # Real travel clears transient events, persistent class state and restores the map.
    travel = await page.evaluate('''() => {const s=__combatSetup('mage');BCCore.act(s,'skill',{id:'lotus_bolt',target:s.target});s.player.x=920;const result=BCCore.act(s,'travel',{direction:1});return{ok:result.ok,zone:s.zone,count:s.combatFeedback.events.length,persistent:!!s.classCombat};}''')
    assert travel == {'ok': True, 'zone': 1, 'count': 0, 'persistent': False}, travel
    await page.wait_for_timeout(60)
    # Reload is a real import/save boundary; no transient events can survive it.
    await page.evaluate('BCGame.save()')
    await page.reload()
    await page.wait_for_function('window.BCGame && BCRender.assets.ready')
    assert await page.evaluate('BCGame.state.combatFeedback?.events.length || 0') == 0
    assert await page.evaluate('!!BCGame.state.classCombat') is False
    assert not errors, errors
    result = {**sheets, 'attack': attack, 'realCritical': real_critical, 'cast': cast, 'travel': travel, 'backgrounds': backgrounds, 'viewportCombat': viewport_combat, 'renderTimings': render_timings,
              'rafChecks': ['keyboard attack', 'seeded actual physical critical captured during RAF', 'keyboard hotbar cast', 'menu advances simulation, events and buff expiry while RAF draws',
                            'event expiry', 'buff expiry', 'orb charge expiry', 'DOT expiry', 'trap expiry', 'map clear', 'save/reload clear'],
              'images': image_paths, 'pageErrors': errors}
    (output / 'classic-canvas-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


async def main():
    from playwright.async_api import async_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8767/')
    parser.add_argument('--artifacts', default='/workspace/vfx115')
    args = parser.parse_args()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            page = await browser.new_page()
            await page.goto(args.base_url)
            result = await run_checks(page, args.artifacts)
            print(json.dumps({'weaponFrames': len(result['weaponChecks']), 'skillFrames': len(result['skillChecks']), 'signatures': len({x['skillId'] for x in result['skillChecks']}),
                              'persistentStates': len(result['persistentChecks']), 'rafChecks': result['rafChecks'],
                              'images': result['images'], 'pageErrors': result['pageErrors']}, indent=2))
        finally:
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
