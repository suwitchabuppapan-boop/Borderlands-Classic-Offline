"""Release 1.17: real class learning, combat, saves and Canvas Part acceptance.

Fixtures select legal classes and paid skill levels; outcomes always run through
BCCore. Native requestAnimationFrame and the normal keyboard/menu handlers remain
running. No replacement RNG, synthetic hit receipts or test-only runtime hooks.
"""
import argparse
import asyncio
import base64
import json
from pathlib import Path


ORIGINAL_SKILLS = [
    "first_aid", "arun_slash", "royal_flurry", "shield_counter", "lotus_bolt",
    "lotus_storm", "orb_burst", "ward_script", "sanctuary", "garuda_combo",
    "quick_stab", "moon_venom", "tiger_rend", "aimed_shot", "naga_trap", "arcane_volley",
]


async def run_checks(page, artifacts=None):
    output = Path(artifacts or "/workspace/skills117/browser/class_skills_ui")
    output.mkdir(parents=True, exist_ok=True)
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.wait_for_function("window.BCGame && window.BCSkillRules && window.BCFXParts && BCRender.assets.ready")
    await page.keyboard.press("Escape")
    await page.evaluate(r'''() => {
      const C=BCCore,D=BCData,R=BCSkillRules;
      const ensure=(condition,message)=>{if(!condition)throw Error(message);};
      const directions=[[0,1],[1,0],[0,-1],[-1,0]];
      const setup=(classId,learn=[],facing=1,distance=40)=>{
        const s=C.createState(),cls=D.classes[classId],[dx,dy]=directions[facing];
        Object.assign(s,{classId,weaponSchool:cls.weaponType,job:cls.tier?'Swordman':'Novice',skillPoints:100,seed:1});
        s.equipment.weapon=cls.trainingWeapon;
        s.stats={str:30,agi:10,vit:20,int:30,dex:30,luk:1};
        for(const id of learn)if(id!=='first_aid')ensure(C.act(s,'learn',{id}).ok,'Cannot learn '+id);
        Object.assign(s.player,{x:470,y:280,facing});
        const st=C.stats(s);s.player.hp=Math.floor(st.maxHp*.4);s.player.sp=st.maxSp;
        s.monsters=[
          {uid:'primary',kind:'guardian',x:470+dx*distance,y:280+dy*distance,hp:100000,dead:0,cd:9999},
          {uid:'forward',kind:'guardian',x:470+dx*(distance+20),y:280+dy*(distance+20),hp:100000,dead:0,cd:9999},
          {uid:'behind',kind:'guardian',x:470-dx*40,y:280-dy*40,hp:100000,dead:0,cd:9999},
        ];
        s.target='primary';s.auto=false;s.settings.autoSkill=false;s.settings.autoPotion=0;
        return s;
      };
      const advance=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*10);i++)C.tick(s,.1);};
      const cast=(s,id)=>C.act(s,'skill',{id,target:s.monsters[0]?.uid});
      const waitReady=(s,id)=>{
        // Preserve the chosen target while ordinary engine ticks age recovery.
        // An active target would otherwise request extra ordinary attacks.
        const target=s.target,p={target:s.monsters[0]?.uid};s.target=null;
        try{
          for(let i=0;i<2000;i++){
            const ready=C.actionReadiness(s,id,p);if(ready.ready)return;
            ensure(ready.remaining>0,id+' cannot recover: '+ready.reason);
            C.tick(s,Math.min(.05,ready.remaining));
          }
          throw Error(id+' did not become ready through normal ticks');
        }finally{s.target=target;}
      };
      const resources=s=>JSON.stringify({sp:s.player.sp,hp:s.player.hp,x:s.player.x,y:s.player.y,seed:s.seed,
        cooldowns:s.cooldowns,classCombat:s.classCombat,monsters:s.monsters,feedback:s.combatFeedback});
      const outcome=s=>JSON.stringify({hp:s.player.hp,x:s.player.x,y:s.player.y,classCombat:s.classCombat,
        targets:s.monsters.map(m=>({hp:m.hp,snare:m.snare,dots:m.classDots,marks:m.skillMarks,debuffs:m.skillDebuffs}))});
      const charge=s=>{
        const target=s.monsters[0];
        for(let i=0;i<3;i++){waitReady(s,'attack');ensure(C.act(s,'attack',{target:target.uid}).ok,'charge attack failed');}
        ensure(s.classCombat?.orbCharges===3,'Only landed ordinary attacks must create actual orb charges');
        waitReady(s,'first_aid');s.combatFeedback.events=[];
      };
      const live=s=>{
        // Import creates a new runtime identity, just like a genuine new scene;
        // reusing the old object could retain its WeakMap action recovery.
        BCGame.loadSave(C.serialize(s));const dst=BCGame.state;
        for(const k of Object.keys(dst))delete dst[k];Object.assign(dst,s);return dst;
      };
      window.__skills117={C,D,R,ensure,directions,setup,advance,waitReady,cast,resources,outcome,charge,live};
    }''')
    catalog = await page.evaluate(r'''() => {
      const {D,R,ensure}=__skills117,ids=Object.keys(D.skills),passives=ids.filter(id=>R.isPassive(id));
      ensure(ids.length===61&&passives.length===15,'Expected 61 skills / 15 passives');
      ensure(Object.keys(BCFXParts.definitions).length===58,'Expected all 58 Parts');
      ensure(Object.keys(BCFXParts.recipes).length===61,'Expected all 61 recipes');
      for(const [classId,cls] of Object.entries(D.classes)){
        ensure(cls.skillIds.length===(cls.tier?4:1),classId+' native skills');
        const ids=R.skillsFor(classId);
        ensure(ids.length===(cls.tier===2?9:cls.tier===1?5:1),classId+' ancestry count');
        ensure(ids.filter(R.isPassive).length===cls.tier,classId+' inherited passive count');
      }
      for(const [id,recipe] of Object.entries(BCFXParts.recipes)){
        ensure(recipe.id===id&&Array.isArray(recipe.parts),id+' recipe schema');
        ensure(recipe.passive===R.isPassive(id),id+' passive recipe mismatch');
        for(const p of recipe.parts)ensure(BCFXParts.definitions[p.partId],id+' missing Part '+p.partId);
      }
      return {skills:ids.length,active:ids.length-passives.length,passives:passives.length,parts:58,recipes:61,classes:Object.keys(D.classes)};
    }''')

    # Use the real current dialog and delegated learn handlers in every identity.
    ui_classes = []
    for class_id in catalog["classes"]:
        await page.evaluate("id => {const s=__skills117.setup(id);BCGame.loadSave(BCCore.serialize(s));BCGame.openPanel('skills');}", class_id)
        expected = await page.evaluate("BCCore.skillsFor(BCGame.state)")
        cards = page.locator(".skill-card")
        assert await cards.evaluate_all("els=>els.map(el=>el.dataset.skill)") == expected
        passive_ids = await page.evaluate("BCCore.skillsFor(BCGame.state).filter(id=>BCSkillRules.isPassive(id))")
        for skill_id in passive_ids:
            card = page.locator(f'.skill-card[data-skill="{skill_id}"]')
            assert await card.get_attribute("data-kind") == "passive"
            assert await card.locator('[data-act="skill"],[data-bind-skill]').count() == 0
            points = await page.evaluate("BCGame.state.skillPoints")
            await card.locator('[data-act="learn"]').click()
            assert await page.evaluate("id=>BCGame.state.skills[id]", skill_id) == 1
            assert await page.evaluate("BCGame.state.skillPoints") == points - 1
        await page.locator('[data-skills-tab="tree"]').click()
        nodes = page.locator(".skill-tree-node")
        assert await nodes.count() == len(expected) - 1
        assert await nodes.locator('[data-kind="passive"]').count() == 0  # kind belongs to each article itself
        assert await page.locator('.skill-tree-node[data-kind="passive"]').count() == len(passive_ids)
        await page.locator('[data-open="hotbar"]').click()
        assert await page.locator('[data-bind]').count() == 9
        for skill_id in passive_ids:
            assert await page.locator(f'[data-bind] option[value="skill:{skill_id}"]').count() == 0
        ui_classes.append({"classId": class_id, "cards": len(expected), "passivesLearned": passive_ids})
        await page.keyboard.press("Escape")

    # Upgrade the actual 1.16 schema (16 keys, no skillVersion) without inventing
    # points, refunding learned skills or changing retained fields, in all classes.
    migrations = await page.evaluate(r'''oldIds => {
      const {C,D,setup,ensure}=__skills117,records=[];
      for(const classId of Object.keys(D.classes)){
        const cls=D.classes[classId],s=setup(classId,cls.tier?[cls.skill]:[]);
        Object.assign(s,{silver:321,skillPoints:17,statPoints:23,quest:1,questActive:true});
        s.inventory.potion=7;s.inventory.novice_cap=1;s.equipment.head='novice_cap';s.stats.str=17;
        s.hotbar[1]=cls.tier?'skill:'+cls.skill:null;
        const modern=JSON.parse(C.serialize(s)),legacy=structuredClone(modern);
        delete legacy.state.skillVersion;
        for(const id of Object.keys(legacy.state.skills))if(!oldIds.includes(id))delete legacy.state.skills[id];
        ensure(Object.keys(legacy.state.skills).length===16,'Not a complete 1.16 skill schema');
        const loaded=C.deserialize(JSON.stringify(legacy)),saved=JSON.parse(C.serialize(loaded)).state;
        ensure(saved.skillVersion===2&&Object.keys(saved.skills).length===61,classId+' upgrade completeness');
        for(const id of oldIds)ensure(saved.skills[id]===legacy.state.skills[id],classId+' changed retained '+id);
        for(const id of Object.keys(D.skills).filter(id=>!oldIds.includes(id)))ensure(saved.skills[id]===0,classId+' granted '+id);
        for(const k of ['classId','weaponSchool','job','silver','skillPoints','statPoints','quest','questActive','stats','inventory','equipment','hotbar'])
          ensure(JSON.stringify(saved[k])===JSON.stringify(legacy.state[k]),classId+' changed '+k);
        ensure(!saved.classCombat&&!saved.combatFeedback&&!saved.cooldowns,'Transient state leaked into save');
        // A second import is now strict modern format, without another migration.
        ensure(C.serialize(C.deserialize(JSON.stringify({version:1,state:saved})))===C.serialize(loaded),'Modern roundtrip drift');
        records.push({classId,retained:16,addedZero:45,points:saved.skillPoints,skillVersion:saved.skillVersion});
      }
      return records;
    }''', ORIGINAL_SKILLS)
    assert len(migrations) == 16

    # All 46 actives resolve genuine outcomes in each of the four directions.
    # Utilities are required to change HP, position or actual status, not only SP/CD.
    active_checks = await page.evaluate(r'''() => {
      const {C,D,R,setup,cast,charge,advance,outcome,ensure}=__skills117,records=[];
      for(const [id,sk] of Object.entries(D.skills).filter(([id])=>!R.isPassive(id))){
        for(let facing=0;facing<4;facing++){
          const s=setup(sk.owner||'villager',[id],facing,id==='garuda_step'?100:40);
          if(sk.chargeCost)charge(s);
          const hp=s.player.hp,sp=s.player.sp,before=outcome(s),cost=R.spCost(s,id);
          const result=cast(s,id);ensure(result.ok,id+' direction '+facing+': '+result.message);
          ensure(s.player.sp===sp-cost,id+' actual SP spend');ensure(s.cooldowns[id]===sk.cooldown,id+' real CD');
          if(sk.kind==='trap')advance(s,.1);
          ensure(outcome(s)!==before,id+' no actual HP/movement/status outcome');
          const events=s.combatFeedback?.events||[],receipt=events.find(e=>e.kind==='skill'&&e.skillId===id);
          ensure(receipt,id+' missing genuine cast receipt');
          ensure(receipt.facing===facing,id+' wrong cast direction '+receipt.facing);
          const damage=s.monsters.map(m=>100000-m.hp),impacts=events.filter(e=>e.kind==='impact'&&e.skillId===id);
          if(['self','shield','cleanse','empower','move','debuff'].includes(sk.kind))ensure(!impacts.length,id+' utility invented a hit');
          for(const e of impacts)ensure(e.amount>0&&e.result==='hit',id+' invalid impact');
          if(id==='first_aid'||id==='ward_script'||id==='sanctuary')ensure(s.player.hp>hp,id+' did not heal');
          records.push({id,facing,spSpent:sp-s.player.sp,cooldown:sk.cooldown,hpRecovered:s.player.hp-hp,
            damage,impacts:impacts.length,x:s.player.x,y:s.player.y,status:!!s.classCombat});
        }
      }
      ensure(records.length===184,'46 active skills x 4 directions');return records;
    }''')

    # Failed actions remain atomic; passive skills cannot cast or bind even by
    # forged direct actions. Check every active's SP/CD guards independently.
    rejection_checks = await page.evaluate(r'''() => {
      const {C,D,R,setup,cast,charge,resources,ensure}=__skills117,records=[];
      for(const [id,sk] of Object.entries(D.skills)){
        const s=setup(sk.owner||'villager',[id]);if(sk.chargeCost)charge(s);
        if(R.isPassive(id)){
          const before=resources(s),hotbar=JSON.stringify(s.hotbar);
          ensure(!cast(s,id).ok,id+' passive cast allowed');ensure(resources(s)===before,id+' passive cast changed state');
          ensure(!C.act(s,'bind',{slot:0,value:'skill:'+id}).ok,id+' passive bind allowed');
          ensure(JSON.stringify(s.hotbar)===hotbar,id+' passive binding changed');records.push({id,checks:['cast','bind']});
        }else{
          const checked=[];
          for(const mode of ['sp','cooldown',...(id==='first_aid'?[]:['unlearned'])]){
            const a=setup(sk.owner||'villager',[id]);if(sk.chargeCost)charge(a);
            if(mode==='sp')a.player.sp=0;if(mode==='cooldown')a.cooldowns[id]=1;if(mode==='unlearned')a.skills[id]=0;
            const before=resources(a);ensure(!cast(a,id).ok,id+' '+mode+' accepted');ensure(resources(a)===before,id+' '+mode+' mutation');checked.push(mode);
          }
          records.push({id,checks:checked});
        }
      }
      return records;
    }''')

    mechanics = await page.evaluate(r'''() => {
      const {C,D,setup,cast,charge,advance,waitReady,ensure}=__skills117;
      const damaged=s=>100000-s.monsters[0].hp;
      // Absorption changes the normal incoming enemy attack, not just a shield icon.
      const bare=setup('mage'),shield=setup('mage',['lotus_veil']);cast(shield,'lotus_veil');
      const initialShield=shield.classCombat.buffs.lotus_veil.shieldRemaining;
      for(const s of [bare,shield]){s.target=null;s.monsters=s.monsters.slice(0,1);s.monsters[0].x=s.player.x+25;s.monsters[0].cd=0;s.seed=1;}
      const beforeBare=bare.player.hp,beforeShield=shield.player.hp;C.tick(bare,.1);C.tick(shield,.1);
      ensure(beforeBare-bare.player.hp>0,'Control enemy did not damage player');
      ensure(beforeShield-shield.player.hp<beforeBare-bare.player.hp,'Shield did not absorb actual incoming damage');
      ensure(shield.classCombat.buffs.lotus_veil.shieldRemaining<initialShield,'Shield capacity not consumed');
      const absorbed=initialShield-shield.classCombat.buffs.lotus_veil.shieldRemaining;
      ensure(shield.classCombat.signals.some(e=>e.kind==='absorb'),'No genuine absorption signal');
      // Enemy ATK debuff must reduce that same incoming attack.
      const normal=setup('city_guardian'),weak=setup('city_guardian',['city_guardian_wave']);cast(weak,'city_guardian_wave');
      for(const s of [normal,weak]){s.target=null;s.monsters=s.monsters.slice(0,1);s.monsters[0].x=s.player.x+25;s.monsters[0].cd=0;s.seed=1;}
      const a=normal.player.hp,b=weak.player.hp;C.tick(normal,.1);C.tick(weak,.1);
      ensure(b-weak.player.hp<a-normal.player.hp,'ATK debuff did not change actual incoming damage');
      const cleansed=setup('divine_scribe',['cleansing_script']);cleansed.player.skillDebuffs={poison:{remaining:5,atkMultiplier:.5}};
      const originalMdef=C.stats(cleansed).mdef;cast(cleansed,'cleansing_script');
      ensure(Object.keys(cleansed.player.skillDebuffs).length===0,'Cleanse failed');
      ensure(C.stats(cleansed).mdef>originalMdef,'Cleanse MDEF buff missing');
      ensure(cleansed.classCombat.signals.some(e=>e.kind==='cleanse'),'Cleanse signal without successful removal');
      // One-use sources remain through an unrelated single attack, then both are
      // consumed exactly once by the actual matching area skill.
      const lotus=setup('lotus_mage',['blossom_mark','gather_petals','lotus_bolt','lotus_storm']);
      cast(lotus,'blossom_mark');waitReady(lotus,'gather_petals');cast(lotus,'gather_petals');waitReady(lotus,'lotus_bolt');cast(lotus,'lotus_bolt');
      ensure(lotus.monsters[0].skillMarks.blossom_mark,'Single skill consumed area mark');
      ensure(lotus.classCombat.buffs.gather_petals.empowerRemaining>0,'Single skill consumed area empower');
      waitReady(lotus,'lotus_storm');const markHp=lotus.monsters[0].hp;cast(lotus,'lotus_storm');const amplified=markHp-lotus.monsters[0].hp;
      ensure(!lotus.monsters[0].skillMarks.blossom_mark,'Blossom mark was not consumed');
      ensure(lotus.classCombat.buffs.gather_petals.empowerRemaining===0,'Gather empower not consumed');
      waitReady(lotus,'lotus_storm');const secondHp=lotus.monsters[0].hp;cast(lotus,'lotus_storm');const ordinary=secondHp-lotus.monsters[0].hp;
      ensure(amplified>ordinary,'Consumed area amplification did not change actual damage');
      const arcane=setup('arcane_archer',['arcane_arrow_inscription','arcane_harmonic_arrow']);
      cast(arcane,'arcane_arrow_inscription');waitReady(arcane,'arcane_harmonic_arrow');const arrowBefore=arcane.monsters[0].hp;cast(arcane,'arcane_harmonic_arrow');const firstArrow=arrowBefore-arcane.monsters[0].hp;
      ensure(arcane.classCombat.buffs.arcane_arrow_inscription.empowerRemaining===0,'Arrow inscription not consumed');
      waitReady(arcane,'arcane_harmonic_arrow');const nextHp=arcane.monsters[0].hp;cast(arcane,'arcane_harmonic_arrow');
      ensure(firstArrow>nextHp-arcane.monsters[0].hp,'Arrow one-use bonus did not affect actual damage');
      // Charges come from landed basics; the empty shield rejects without spending.
      const orb=setup('orb_weaver',['prism_veil']);const zeroSp=orb.player.sp;
      ensure(!cast(orb,'prism_veil').ok&&orb.player.sp===zeroSp,'Empty charge shield accepted');charge(orb);cast(orb,'prism_veil');
      ensure(orb.classCombat.orbCharges===2,'Prism shield must consume exactly one of three real charges');
      // Boss hunt marks are distinct from hard-root resistance.
      const naga=setup('naga_ranger',['naga_trap','naga_hunt_mastery']);
      naga.monsters[0].kind=Object.keys(D.monsters).find(k=>D.monsters[k].boss);cast(naga,'naga_trap');advance(naga,.1);
      ensure(!naga.monsters[0].snare,'Boss received hard root');ensure(naga.monsters[0].skillMarks.naga_trap.remaining>0,'Boss lost genuine hunt mark');
      // Timer expiry comes from engine ticks. Clear target so tick does not add attacks.
      for(const s of [shield,weak,cleansed,orb,naga]){s.target=null;s.monsters.forEach(m=>m.cd=9999);advance(s,14);}
      ensure(!shield.classCombat.buffs.lotus_veil&&!cleansed.classCombat.buffs.cleansing_script,'Expired defense persists');
      ensure(orb.classCombat.orbCharges===0,'Expired charges persist');
      return {shield:{incoming:beforeBare-bare.player.hp,absorbed},
        area:{amplified,ordinary},arrow:{amplified:firstArrow,ordinary:nextHp-arcane.monsters[0].hp},chargeConsumed:1,bossRoot:false,cleanse:true,timerExpiry:true};
    }''')

    # A passive must change a real calculated stat or a real combat/healing/cost
    # outcome. Comparing helper metadata alone would not prove game integration.
    passive_checks = await page.evaluate(r'''() => {
      const {C,D,R,setup,cast,advance,ensure}=__skills117,records=[];
      const combat={lotus_mastery:'lotus_storm',orb_attunement:'attack',mercy_scripture:'first_aid',
        moon_shadow_toxicology:'moon_venom',arcane_dual_art:'arcane_harmonic_arrow'};
      for(const [id,sk] of Object.entries(D.skills).filter(([id])=>R.isPassive(id))){
        const a=setup(sk.owner),b=setup(sk.owner);b.skillPoints=100;
        for(let level=0;level<5;level++)ensure(C.act(b,'learn',{id}).ok,id+' passive learn');
        let metric='stats',before=C.stats(a),after=C.stats(b),changed=JSON.stringify(before)!==JSON.stringify(after);
        if(['royal_duelist_rhythm','mana_focus'].includes(id)){
          // SP is explicitly rounded up: the 6-SP starter bolt remains 6 at
          // 12.5% reduction. Use the native 9-SP wave to observe paid savings.
          const active=id==='mana_focus'?'petal_wave':D.classes[sk.owner].skill;a.skills[active]=b.skills[active]=1;
          const sa=a.player.sp,sb=b.player.sp;cast(a,active);cast(b,active);
          before=sa-a.player.sp;after=sb-b.player.sp;changed=after<before;metric='actualSP';
        }else if(combat[id]){
          const active=combat[id];if(active!=='attack')a.skills[active]=b.skills[active]=1;
          if(id==='mercy_scripture'){a.player.hp=b.player.hp=1;cast(a,active);cast(b,active);before=a.player.hp;after=b.player.hp;changed=after>before;metric='actualHealing';}
          else{
            if(active==='attack'){C.act(a,'attack',{target:'primary'});C.act(b,'attack',{target:'primary'});}
            else{cast(a,active);cast(b,active);}
            if(id==='moon_shadow_toxicology'){a.target=b.target=null;advance(a,1.1);advance(b,1.1);}
            before=100000-a.monsters[0].hp;after=100000-b.monsters[0].hp;changed=after>before;metric='actualDamage';
          }
        }else if(id==='naga_hunt_mastery'){
          a.skills.naga_trap=b.skills.naga_trap=1;cast(a,'naga_trap');cast(b,'naga_trap');advance(a,.1);advance(b,.1);
          before=a.monsters[0].skillMarks?.naga_trap||null;after=b.monsters[0].skillMarks?.naga_trap||null;changed=!!after&&!before;metric='actualHuntMark';
        }
        ensure(changed,id+' did not affect real '+metric);records.push({id,metric,before,after});
      }
      ensure(records.length===15,'Missing passive outcomes');return records;
    }''')

    # All Parts use native Canvas at actual scale, evolving over four ages and
    # four facings. Commands must be finite/bounded and options stay immutable.
    image_paths = []
    part_checks = []
    part_ids = await page.evaluate("Object.keys(BCFXParts.definitions)")
    for start in range(0, len(part_ids), 8):
        record = await page.evaluate(r'''start => {
          const ids=Object.keys(BCFXParts.definitions).slice(start,start+8),sheet=document.createElement('canvas');sheet.width=1280;sheet.height=ids.length*210;
          const ctx=sheet.getContext('2d'),checks=[],methods=new Set(['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','translate','rotate','scale','fillRect']);
          for(const [row,id] of ids.entries())for(let facing=0;facing<4;facing++){
            const geometries=[],pixels=[];
            for(const progress of [0,.25,.5,.8]){
              const c=document.createElement('canvas');c.width=320;c.height=210;const real=c.getContext('2d',{willReadFrequently:true}),commands=[];
              const proxy=new Proxy(real,{get(t,k){const v=Reflect.get(t,k,t);return typeof v==='function'?(...args)=>{if(methods.has(k)){if(args.some(x=>typeof x==='number'&&!Number.isFinite(x)))throw Error(id+' nonfinite geometry');commands.push([k,...args]);}return Reflect.apply(v,t,args);}:v;},set(t,k,v){return Reflect.set(t,k,v,t);}});
              const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][facing],vector=BCFXParts.definitions[id].directionMode==='vector';
              // Part paint receives an explicit resolved angle from the skill
              // compositor; facing alone is socket metadata, not a rotation.
              const options=Object.freeze({x:160,y:128,source:Object.freeze({x:160,y:128}),target:Object.freeze({x:160+dx*75,y:128+dy*75}),classId:id.split('.')[0]==='common'?'swordsman':id.split('.')[0],facing,angle:vector?Math.atan2(dy,dx):0,progress,radius:70,count:3,remaining:3,persistent:true,seed:1});
              const before=JSON.stringify(options);BCFXParts.draw(proxy,id,options);if(before!==JSON.stringify(options))throw Error(id+' mutated options');
              if(commands.length>900)throw Error(id+' exceeds bounded geometry budget');
              const data=real.getImageData(0,0,320,210).data;let count=0,hash=2166136261;for(let i=0;i<data.length;i++){if(i%4===3&&data[i])count++;hash=Math.imul(hash^data[i],16777619)>>>0;}
              geometries.push(JSON.stringify(commands));pixels.push({progress,count,hash,commands:commands.length});
              if(progress===.5){const x=facing*320,y=row*210;ctx.fillStyle=row%2?'#e5ddcd':'#263b41';ctx.fillRect(x,y,319,209);ctx.drawImage(c,x,y);ctx.fillStyle=row%2?'#253944':'#f5e5bd';ctx.font='12px sans-serif';ctx.fillText(id+' / '+['DOWN','RIGHT','UP','LEFT'][facing],x+8,y+18);}
            }
            if(!pixels.some(v=>v.count>5))throw Error(id+' missing actual Part pixels');
            if(new Set(geometries).size<2)throw Error(id+' geometry never evolves');
            checks.push({id,facing,frames:pixels});
          }
          return {image:sheet.toDataURL(),checks};
        }''', start)
        name = output / f"parts-all-directions-{start // 8 + 1}.png"
        name.write_bytes(base64.b64decode(record.pop("image").split(",", 1)[1]))
        image_paths.append(str(name));part_checks.extend(record["checks"])
    assert len(part_checks) == 58 * 4

    # Compose genuine cast receipts and live status records around the canonical
    # complete class sprites. Pixel checks isolate VFX before scene/sprite paint;
    # a visible character or map cannot conceal a missing skill composition.
    skill_frames = []
    active_ids = [row["id"] for row in active_checks if row["facing"] == 0]
    for start in range(0, len(active_ids), 6):
        record = await page.evaluate(r'''ids => {
          const {C,D,setup,cast,charge,ensure}=__skills117,FX=BCCombatEffects;
          const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=ids.length*240;
          const ctx=sheet.getContext('2d'),checks=[],stages=[0,.10,.22,.36];
          const read=c=>{const data=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;let count=0,hash=2166136261;
            for(let i=0;i<data.length;i++){if(i%4===3&&data[i])count++;hash=Math.imul(hash^data[i],16777619)>>>0;}return {count,hash};};
          ids.forEach((id,row)=>{
            const sk=D.skills[id],classId=sk.owner||'villager';
            for(let facing=0;facing<4;facing++){
              const frames=[];
              for(const age of stages){
                const s=setup(classId,[id],facing,id==='garuda_step'?100:40);s.zone=1;
                if(sk.chargeCost)charge(s);ensure(cast(s,id).ok,id+' native composition cast failed');
                s.target=null;
                let left=age;while(left>1e-8){const dt=Math.min(.05,left);C.tick(s,dt);left-=dt;}
                const fx=document.createElement('canvas');fx.width=320;fx.height=240;
                const f=fx.getContext('2d');f.translate(160-s.player.x,160-s.player.y);FX.drawGround(f,s);FX.drawFront(f,s);
                const result=read(fx);ensure(result.count>5,id+' missing native VFX pixels facing '+facing+' at '+age);
                frames.push({age,...result});
                if(age===.10){
                  const x=facing*320,y=row*240;ctx.save();ctx.beginPath();ctx.rect(x,y,319,239);ctx.clip();ctx.translate(x+160-s.player.x,y+160-s.player.y);
                  ctx.drawImage(BCRender.images.woodland,0,0,960,560);FX.drawGround(ctx,s);
                  const pose=BCAppearance.sample(BCAppearance.createTracker(),s);
                  BCRender.person(ctx,s.player.x,s.player.y,{classId,head:s.equipment.head,hair:0,pose});
                  FX.drawFront(ctx,s);ctx.restore();ctx.fillStyle='#172b31dd';ctx.fillRect(x,y,319,27);ctx.fillStyle='#fff1d0';ctx.font='12px sans-serif';ctx.fillText(id+' / '+['DOWN','RIGHT','UP','LEFT'][facing],x+7,y+18);
                }
              }
              ensure(new Set(frames.map(f=>f.hash)).size>=2,id+' native composition does not evolve');
              checks.push({id,classId,facing,frames});
            }
          });return {image:sheet.toDataURL(),checks};
        }''', active_ids[start:start + 6])
        path = output / f"skills-real-casts-directions-{start // 6 + 1}.png"
        path.write_bytes(base64.b64decode(record.pop("image").split(",", 1)[1]))
        image_paths.append(str(path));skill_frames.extend(record["checks"])
    assert len(skill_frames) == 46 * 4

    # Every class can choose at least one learned native active under real Auto.
    auto_checks = await page.evaluate(r'''() => {
      const {C,D,R,setup,ensure}=__skills117,records=[];
      for(const [classId,cls] of Object.entries(D.classes).filter(([,c])=>c.tier)){
        const ids=R.skillsFor(classId),s=setup(classId,ids);s.auto=true;s.settings.autoSkill=true;
        const seen=new Set();for(let i=0;i<60;i++){C.tick(s,.1);for(const e of s.combatFeedback?.events||[])if(e.kind==='skill'&&e.skillId!=='first_aid')seen.add(e.skillId);}
        ensure(seen.size>0,classId+' Auto never used a learned class skill');
        ensure([...seen].every(id=>R.accessible(s,id,true)&&!R.isPassive(id)),classId+' Auto used foreign/passive skill');
        records.push({classId,skills:[...seen],sp:s.player.sp});
      }
      return records;
    }''')

    # Run real Auto Quest ticks with learned new area shapes. An unrelated kind
    # stands inside the cone/ring/pierce/chain traversal; Auto must fall back to
    # ordinary attacks instead of damaging that monster or stealing movement.
    quest_safety = await page.evaluate(r'''() => {
      const {C,setup,ensure}=__skills117,records=[];
      for(const [classId,id] of [['swordsman','swordsman_sweep'],['royal_duelist','royal_duelist_ring'],['orb_weaver','orb_chain'],['naga_ranger','naga_piercing_shot']]){
        const s=setup(classId,[id]);Object.assign(s,{quest:0,questActive:true,zone:0});
        s.player.x=600;s.player.y=300;s.player.hp=C.stats(s).maxHp;s.settings.autoSkill=true;
        s.monsters=[{uid:'quest-target',kind:'poring',x:640,y:300,hp:100000,dead:0,cd:9999},
          {uid:'unrelated',kind:'willow',x:660,y:300,hp:100000,dead:0,cd:9999}];
        ensure(C.act(s,'auto-quest').ok,'Cannot start genuine Auto Quest');
        for(let i=0;i<25;i++)C.tick(s,.1);
        ensure(s.autoQuest.active,classId+' unexpectedly stopped Auto Quest');
        ensure(s.monsters[0].hp<100000,classId+' Auto Quest made no genuine attack');
        ensure(s.monsters[1].hp===100000,classId+' new area skill hit unrelated quest kind');
        ensure(!(s.cooldowns[id]>0),id+' should not be spent on unsafe target traversal');
        records.push({classId,id,questDamage:100000-s.monsters[0].hp,unrelatedDamage:0,phase:s.autoQuest.phase});
      }
      return records;
    }''')

    # Real keyboard cast and persistent buffs are observed from the untouched RAF
    # on original map scenes at desktop/mobile widths, while the menu stays open.
    await page.evaluate(r'''() => {
      const original=BCRender.draw;window.__classRaf={frames:0,captured:[],pending:null};
      BCRender.draw=function(canvas,s){original(canvas,s);const rec=__classRaf;rec.frames++;
        if(rec.pending&&s.combatFeedback?.events.some(e=>e.kind==='skill'&&e.skillId===rec.pending&&e.age>=.08&&e.age<.25)){
          rec.captured.push({id:rec.pending,image:canvas.toDataURL(),events:s.combatFeedback.events.map(e=>({...e})),clock:s.clock});rec.pending=null;
        }};
    }''')
    live_checks = []
    for width, height in [(1440, 900), (390, 844)]:
        await page.set_viewport_size({"width": width, "height": height})
        await page.evaluate(r'''() => {
          // Keep the chosen target inside storm range and outside the ordinary
          // staff approach range while the native keyboard event is delivered.
          const s=__skills117.setup('lotus_mage',['lotus_storm','blossom_mark','gather_petals'],0,175);s.zone=0;
          s.monsters.forEach(m=>m.hp=BCData.monsters[m.kind].hp);
          s.hotbar[0]='skill:lotus_storm';__skills117.cast(s,'blossom_mark');__skills117.waitReady(s,'gather_petals');__skills117.cast(s,'gather_petals');__skills117.waitReady(s,'lotus_storm');
          __skills117.live(s);BCGame.openPanel('skills');__classRaf.pending='lotus_storm';
        }''')
        # Menus intentionally suppress game hotkeys, so close for the actual key,
        # then reopen immediately while farming/simulation and effect ages run.
        await page.keyboard.press("Escape")
        await page.locator("#game").focus();await page.keyboard.press("1")
        await page.evaluate("BCGame.openPanel('skills')")
        await page.wait_for_function("__classRaf.pending===null")
        frame = await page.evaluate("__classRaf.captured.at(-1)")
        path = output / f"class-skills-real-raf-{width}.png"
        path.write_bytes(base64.b64decode(frame.pop("image").split(",", 1)[1]));image_paths.append(str(path))
        assert any(e["kind"] == "impact" and e["skillId"] == "lotus_storm" for e in frame["events"])
        clock = await page.evaluate("BCGame.state.clock")
        await page.wait_for_timeout(250)
        assert await page.evaluate("BCGame.state.clock") > clock
        await page.screenshot(path=str(output / f"class-skills-menu-{width}.png"))
        geometry = await page.locator("#panel-window").evaluate("el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,client:el.clientWidth,scroll:el.scrollWidth})")
        assert geometry["left"] >= 0 and geometry["right"] <= width and geometry["bottom"] <= height
        assert geometry["scroll"] <= geometry["client"]
        live_checks.append({"width": width, "events": frame["events"], "geometry": geometry})
        await page.keyboard.press("Escape")
    await page.set_viewport_size({"width": 1440, "height": 900})
    result = {"catalog": catalog, "ui_classes": ui_classes, "legacy116_imports": migrations,
              "active_casts": active_checks, "rejections": rejection_checks, "mechanics": mechanics,
              "passive_outcomes": passive_checks, "part_frames": part_checks, "skill_frames": skill_frames, "auto_classes": auto_checks, "quest_safety": quest_safety,
              "native_raf": live_checks, "images": image_paths}
    (output / "class-skills-browser.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


async def main():
    from playwright.async_api import async_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8770/")
    parser.add_argument("--artifacts", default="/workspace/skills117/browser/class_skills_ui")
    args = parser.parse_args()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(args.base_url)
        result = await run_checks(page, args.artifacts)
        print(json.dumps({"catalog": result["catalog"], "casts": len(result["active_casts"]), "images": result["images"]}, ensure_ascii=False))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
