"""Real Chromium Canvas and RAF acceptance; reusable with an existing Playwright page.

Run: python tests/combat_effects_ui.py [--base-url URL] [--artifacts DIRECTORY]
"""
import argparse
import asyncio
import base64
import json
from pathlib import Path


async def run_checks(page, artifacts=None):
    output = Path(artifacts or '/workspace/combat-fx-work')
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.set_viewport_size({'width': 1440, 'height': 1000})
    await page.wait_for_function('window.BCGame && window.BCCombatEffects && BCRender.assets.ready')
    await page.keyboard.press('Escape')
    sheets = await page.evaluate(r'''() => {
      const FX=BCCombatEffects,D=BCData, directions=[[0,1],[1,0],[0,-1],[-1,0]];
      const event=(patch={})=>({id:1,kind:'attack',source:{x:120,y:100},target:{x:175,y:100},facing:1,weaponType:'sword',skillId:null,result:null,phase:'direct',amount:null,magic:false,age:.10,duration:.28,...patch});
      const state=(events=[],extra={})=>({player:{x:120,y:100,facing:1},clock:1,monsters:[],combatFeedback:{events},...extra});
      const canvas=(w,h)=>{const a=document.createElement('canvas');a.width=w;a.height=h;return a;};
      const pixels=s=>{
        const a=canvas(320,280),c=a.getContext('2d'); const before=JSON.stringify(s); FX.drawGround(c,s);FX.drawFront(c,s);
        if(before!==JSON.stringify(s))throw Error('Canvas draw mutated state');
        const data=c.getImageData(0,0,a.width,a.height).data;let count=0,hash=2166136261;
        for(let i=0;i<data.length;i++){if(i%4===3&&data[i])count++;hash=Math.imul(hash^data[i],16777619)>>>0;}
        return {count,hash};
      };
      const painter=(a,x,y,w,h,title)=>{const c=a.getContext('2d');c.fillStyle='#203e43';c.fillRect(x,y,w-1,h-1);c.fillStyle='#f5e5bd';c.font='13px sans-serif';c.fillText(title,x+12,y+21);return c;};
      const person=(c,source,cls,facing)=>BCRender.person(c,source.x,source.y,{classId:cls,facing,hair:0,pose:{mode:'attack',facing,progress:.45}});
      const profile=canvas(960,2040), weaponChecks=[];
      Object.keys(FX.weaponProfiles).forEach((weaponType,row)=>{
        const cls=Object.keys(D.classes).find(id=>D.classes[id].weaponType===weaponType);
        for(let facing=0;facing<4;facing++){
          const [dx,dy]=directions[facing],source={x:120,y:103},target={x:120+dx*52,y:103+dy*52};
          const e=event({weaponType,facing,source,target,magic:D.weaponTypes[weaponType].basicMagic}),s=state([e]);
          const check=pixels(s); if(check.count<15)throw Error(weaponType+' missing pixels');weaponChecks.push({weaponType,facing,...check});
          const c=painter(profile,facing*240,row*170,240,170,weaponType+' · '+['DOWN','RIGHT','UP','LEFT'][facing]);
          c.save();c.translate(facing*240,row*170);FX.drawGround(c,s);person(c,source,cls,facing);FX.drawFront(c,s);c.restore();
        }
      });
      for(const type of Object.keys(FX.weaponProfiles))if(new Set(weaponChecks.filter(x=>x.weaponType===type).map(x=>x.hash)).size!==4)throw Error(type+' directional pixels duplicate');
      const skill=canvas(1400,810),skillChecks=[];
      Object.keys(FX.skillProfiles).forEach((skillId,i)=>{
        const definition=D.skills[skillId],cls=definition.owner,weaponType=D.classes[cls].weaponType;
        const source={x:75,y:165},target={x:175,y:165}; if(definition.radius){source.x=140;source.y=150;target.x=140;target.y=150;}
        const e=event({kind:'skill',skillId,weaponType,source,target,magic:!!definition.magic,duration:.45,age:.12}),s=state([e]);
        const check=pixels(s);if(check.count<30)throw Error(skillId+' missing pixels');skillChecks.push({skillId,...check});
        const x=(i%5)*280,y=Math.floor(i/5)*270,c=painter(skill,x,y,280,270,skillId);
        c.save();c.translate(x,y);FX.drawGround(c,s);person(c,source,cls,1);FX.drawFront(c,s);c.restore();
      });
      if(new Set(skillChecks.map(x=>x.hash)).size!==15)throw Error('Signatures have duplicate pixels');
      const base={buffs:{},traps:[],orbCharges:0,orbTimer:0};
      const persistentStates=[
        ['ward_script',{classCombat:{...base,buffs:{ward_script:{remaining:3}}}}],
        ['shield_counter',{classCombat:{...base,buffs:{shield_counter:{remaining:3}}}}],
        ['garuda_combo',{classCombat:{...base,buffs:{garuda_combo:{remaining:3}}}}],
        ['orb charges 3/3',{classCombat:{...base,orbCharges:3,orbTimer:8}}],
        ['naga_trap · radius 34',{classCombat:{...base,traps:[{id:'naga_trap',x:120,y:100,remaining:8}]}}],
        ['moon_venom DOT',{monsters:[{x:120,y:100,hp:10,dead:0,classDots:[{id:'moon_venom',remaining:3}]}]}],
        ['tiger_rend DOT',{monsters:[{x:120,y:100,hp:10,dead:0,classDots:[{id:'tiger_rend',remaining:3}]}]}],
        ['expired · no geometry',{classCombat:{...base,buffs:{ward_script:{remaining:0}},orbCharges:3,orbTimer:0,traps:[{id:'naga_trap',x:120,y:100,remaining:0}]}}]
      ];
      const persistent=canvas(960,360),persistentChecks=[];
      persistentStates.forEach(([name,extra],i)=>{
        const s=state([],extra),check=pixels(s);if(i<7&&check.count<10)throw Error(name+' missing pixels');if(i===7&&check.count!==0)throw Error('Expired state has pixels');
        persistentChecks.push({name,...check});const x=(i%4)*240,y=Math.floor(i/4)*180,c=painter(persistent,x,y,240,180,name);
        c.save();c.translate(x,y);FX.drawGround(c,s);if(i!==5&&i!==6)person(c,s.player,'acolyte',1);FX.drawFront(c,s);c.restore();
      });
      const hit=e=>pixels(state([event({kind:'impact',...e})]));
      const miss=hit({result:'miss'}),normal=hit({result:'hit'}),crit=hit({result:'crit'}),magic=hit({result:'hit',magic:true}),magicCrit=hit({result:'crit',magic:true});
      if(miss.count!==0||crit.count<=normal.count||magic.hash!==magicCrit.hash)throw Error('Actual hit/crit/miss pixels incorrect');
      return {images:{'combat-weapons-4-directions.png':profile.toDataURL(),'combat-15-signatures.png':skill.toDataURL(),'combat-persistent-states.png':persistent.toDataURL()},weaponChecks,skillChecks,persistentChecks,impacts:{miss,normal,crit,magic,magicCrit}};
    }''')
    image_paths = []
    for name, data in sheets.pop('images').items():
        path = output / name
        path.write_bytes(base64.b64decode(data.split(',', 1)[1]))
        image_paths.append(str(path))

    # Observe actual game RAF drawing; do not replace RAF, simulation time, or damage.
    await page.evaluate(r'''() => {
      const original=BCRender.draw;
      window.__combatRaf={frames:0,seen:[],draws:0};
      BCRender.draw=function(canvas,s){
        original(canvas,s);const record=window.__combatRaf;record.frames++;
        if(s.combatFeedback?.events.length){record.draws++;record.seen=s.combatFeedback.events.map(e=>({...e}));}
      };
      window.__combatSetup=classId=>{
        const target=BCGame.state,next=BCCore.createState(),job=BCData.classes[classId];
        next.classId=classId;next.job=job.tier===2?'Class2':'Class1';next.weaponSchool=job.weaponType;next.equipment.weapon=job.trainingWeapon;
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
    # Real menu opens synchronously after the event so its age is frozen during RAF draws.
    await page.evaluate("BCGame.openPanel('help')")
    frozen_age = await page.evaluate('BCGame.state.combatFeedback.events[0].age')
    frozen_frames = await page.evaluate('__combatRaf.frames')
    await page.wait_for_timeout(220)
    assert await page.evaluate('BCGame.state.combatFeedback.events[0].age') == frozen_age
    assert await page.evaluate('__combatRaf.frames') > frozen_frames
    await page.keyboard.press('Escape')
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')

    # Hotbar keyboard cast follows real validation/SP/CD and is seen in actual RAF drawing.
    await page.evaluate("__combatSetup('mage');__combatRaf.draws=0")
    cast_sp = await page.evaluate('BCGame.state.player.sp')
    await page.locator('#game').focus()
    await page.keyboard.press('1')
    await page.wait_for_function('__combatRaf.draws>0 && __combatRaf.seen.some(e=>e.kind==="skill" && e.skillId==="lotus_bolt")')
    cast = await page.evaluate('''() => ({events:__combatRaf.seen,sp:BCGame.state.player.sp,cd:BCGame.state.cooldowns.lotus_bolt})''')
    assert cast['sp'] == cast_sp - 7 and cast['cd'] > 0
    await page.screenshot(path=str(output / 'combat-real-raf-cast.png'))
    await page.wait_for_function('BCGame.state.combatFeedback.events.length===0')

    # Real skill state remains visible after the cast gesture and expires via real RAF tick.
    await page.evaluate("__combatSetup('acolyte')")
    await page.locator('#game').focus()
    await page.keyboard.press('1')
    await page.wait_for_function('BCGame.state.classCombat?.buffs.ward_script?.remaining>0')
    await page.wait_for_timeout(520)
    assert await page.evaluate('BCGame.state.combatFeedback.events.length') == 0
    assert await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining') > 0
    await page.evaluate("BCGame.openPanel('help')")
    buff_age = await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining')
    await page.wait_for_timeout(120)
    assert await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining') == buff_age
    await page.keyboard.press('Escape')
    await page.evaluate('BCGame.state.classCombat.buffs.ward_script.remaining=.12')
    await page.wait_for_function('!BCGame.state.classCombat.buffs.ward_script')

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
    result = {**sheets, 'attack': attack, 'cast': cast, 'travel': travel,
              'rafChecks': ['keyboard attack', 'keyboard hotbar cast', 'menu freezes event and buff time while RAF draws',
                            'event expiry', 'buff expiry', 'orb charge expiry', 'DOT expiry', 'trap expiry', 'map clear', 'save/reload clear'],
              'images': image_paths + [str(output / 'combat-real-raf-cast.png')], 'pageErrors': errors}
    (output / 'combat-canvas-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


async def main():
    from playwright.async_api import async_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8765/')
    parser.add_argument('--artifacts', default='/workspace/combat-fx-work')
    args = parser.parse_args()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            page = await browser.new_page()
            await page.goto(args.base_url)
            result = await run_checks(page, args.artifacts)
            print(json.dumps({'weaponFrames': len(result['weaponChecks']), 'signatures': len(result['skillChecks']),
                              'persistentStates': len(result['persistentChecks']), 'rafChecks': result['rafChecks'],
                              'images': result['images'], 'pageErrors': result['pageErrors']}, indent=2))
        finally:
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
