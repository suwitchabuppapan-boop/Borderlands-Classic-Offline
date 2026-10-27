"""Release 1.21 acceptance through the real staged tree, teacher and hotbar.

Fixtures prepare earned points and legal saves; all purchases of skill levels,
confirmation, keyboard casts and timer recovery use normal product handlers.
"""
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright


def run_checks(page, output_dir="/workspace/sword121/browser/swordsman_ui"):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_function("window.BCGame && window.BCSwordRules && window.BCSwordSave && BCRender.assets.ready")
    page.keyboard.press("Escape")
    page.evaluate(r"""() => {
      window.swordFixture=(options={})=>{
        const C=BCCore,D=BCData,s=C.createState(),classId=options.classId||'swordsman',cls=D.classes[classId];
        Object.assign(s,{classId,weaponSchool:cls.weaponType,job:'Swordman',skillPoints:options.points??12,seed:1,baseLevel:20});
        s.equipment.weapon=cls.trainingWeapon;s.stats.int=40;s.stats.dex=99;s.stats.vit=20;
        Object.assign(s.player,D.npcs.find(n=>n.id==='guide'));
        if(options.far)Object.assign(s.player,{x:650,y:280});
        for(const [id,level] of Object.entries(options.skills||{}))s.skills[id]=level;
        const st=C.stats(s);s.player.hp=Math.floor(st.maxHp*.8);s.player.sp=st.maxSp;
        BCGame.loadSave(C.serialize(s));BCGame.openPanel('skills');
      };
      window.swordSaved=()=>JSON.parse(BCCore.serialize(BCGame.state)).state;
    }""")

    def setup(**options):
        page.evaluate("o=>swordFixture(o)", options)

    def tree():
        page.locator('[data-skills-tab="tree"]').click()

    def plus(skill):
        return page.locator(f'[data-skill-adjust="{skill}"][data-delta="1"]')

    def minus(skill):
        return page.locator(f'[data-skill-adjust="{skill}"][data-delta="-1"]')

    def level(skill):
        return int(re.search(r"\d+", page.locator(f'[data-skill="{skill}"] .skill-node-level').inner_text()).group())

    def select(skill):
        page.locator(f'[data-skill-select="{skill}"]').click()

    setup(points=12)
    names = page.evaluate("BCData.classes.swordsman.skillIds.map(id=>BCData.skills[id].name)")
    assert len(names) == 10 and all(re.search(r"[ก-๙]", name) for name in names)
    tree()
    assert page.locator('.skill-tree-node').count() == 10
    assert plus('swordsman_twohand_mastery').is_disabled()
    assert plus('swordsman_sweep').is_disabled()
    assert plus('swordsman_stance').is_disabled()
    initial = page.evaluate("swordSaved()")
    plus('swordsman_discipline').click()
    plus('swordsman_twohand_mastery').click()
    assert level('swordsman_twohand_mastery') == 1
    assert page.evaluate("swordSaved()") == initial
    page.locator('[data-plan-reset]').click()
    for _ in range(5):
        plus('arun_slash').click()
    plus('swordsman_sweep').click()
    assert level('arun_slash') == 5 and level('swordsman_sweep') == 1
    assert minus('arun_slash').is_disabled(), "A draft must retain its dependent prerequisite"
    minus('arun_slash').dispatch_event('click')
    assert level('arun_slash') == 5
    assert page.evaluate("swordSaved()") == initial
    page.locator('[data-plan-apply]').click()
    assert page.evaluate("BCGame.state.skills.arun_slash===5&&BCGame.state.skills.swordsman_sweep===1&&BCGame.state.skillPoints===6")
    select('arun_slash')
    assert page.locator('.skill-tree-detail .skill-level-table tbody tr').count() == 10
    page.locator('.skill-tree-detail .skill-level-table summary').click()
    row5 = page.locator('.skill-tree-detail [data-level="5"]').inner_text()
    row6 = page.locator('.skill-tree-detail [data-level="6"]').inner_text()
    assert '250%' in row5 and 'SP 8' in row5
    assert '280%' in row6 and 'SP 15' in row6
    for _ in range(5):
        plus('arun_slash').click()
    page.locator('[data-plan-apply]').click()
    assert page.evaluate("BCGame.state.skills.arun_slash===10&&BCGame.state.skillPoints===1")
    assert plus('arun_slash').is_disabled()
    assert 'SP 15' in page.locator('.skill-tree-detail').inner_text()
    page.screenshot(path=str(output / 'swordsman-tree-levels-1440.png'))

    # Special skills have a real teacher restriction, and cost no earned points.
    specials = ['swordsman_moving_recovery', 'swordsman_fatal_blow', 'swordsman_auto_berserk']
    setup(points=0, far=True)
    for skill in specials:
        assert page.locator(f'.skill-card[data-skill="{skill}"] [data-act="learn"]').is_disabled()
    setup(points=0)
    for skill in specials:
        card = page.locator(f'.skill-card[data-skill="{skill}"]')
        assert 'เรียนฟรี' in card.inner_text()
        card.locator('[data-act="learn"]').click()
        assert page.evaluate('id=>BCGame.state.skills[id]', skill) == 1
        assert page.evaluate('BCGame.state.skillPoints') == 0
    tree()
    assert page.locator('[data-plan-apply]').is_disabled()
    page.screenshot(path=str(output / 'swordsman-specials-1440.png'))
    # A zero-cost staged confirmation must also work at zero points.
    setup(points=0)
    tree()
    for skill in specials:
        plus(skill).click()
    assert page.locator('[data-plan-spent]').inner_text() == '0'
    assert not page.locator('[data-plan-apply]').is_disabled()
    page.locator('[data-plan-apply]').click()
    assert page.evaluate('ids=>ids.every(id=>BCGame.state.skills[id]===1)&&BCGame.state.skillPoints===0', specials)

    # Historical sword points refund once; C2 levels, equipment and the rest of
    # the existing adventure survive the actual Game import and second import.
    migration = page.evaluate(r"""() => {
      const C=BCCore,D=BCData,s=C.createState(),cls=D.classes.royal_duelist;
      Object.assign(s,{classId:'royal_duelist',weaponSchool:cls.weaponType,job:'Swordman',skillPoints:19,silver:4321,quest:1,questActive:true});
      s.equipment.weapon='palace_dual_blades';s.inventory.palace_dual_blades=1;s.skills.royal_flurry=2;
      const raw=JSON.parse(C.serialize(s));raw.state.skillVersion=2;raw.state.weaponSchool='dual_sword';
      for(const id of ['swordsman_twohand_mastery','swordsman_recovery','swordsman_provoke','swordsman_moving_recovery','swordsman_fatal_blow','swordsman_auto_berserk'])delete raw.state.skills[id];
      Object.assign(raw.state.skills,{arun_slash:2,swordsman_sweep:3,swordsman_stance:4,swordsman_discipline:5});
      raw.state.hotbar[0]='skill:arun_slash';raw.state.hotbar[1]='skill:royal_flurry';
      BCGame.loadSave(JSON.stringify(raw));const first=C.serialize(BCGame.state),saved=JSON.parse(first).state;
      BCGame.loadSave(first);return {saved,again:JSON.parse(C.serialize(BCGame.state)).state};
    }""")
    saved = migration['saved']
    assert saved['skillVersion'] == 3 and saved['skillPoints'] == 33
    assert saved['weaponSchool'] == 'two_hand_sword' and saved['skills']['royal_flurry'] == 2
    assert saved['equipment']['weapon'] == 'palace_dual_blades' and saved['inventory']['palace_dual_blades'] == 1
    assert saved['silver'] == 4321 and saved['quest'] == 1 and saved['questActive']
    assert saved['hotbar'][0] is None and saved['hotbar'][1] == 'skill:royal_flurry'
    assert all(saved['skills'][skill] == 0 for skill in page.evaluate('BCData.classes.swordsman.skillIds'))
    assert migration['again'] == saved
    assert page.evaluate("BCData.classes.royal_duelist.name==='ขุนดาบราชัน'&&BCData.items.palace_dual_blades.weaponType==='two_hand_sword'")

    # Live skill controls reflect actual runtime buffs and a free Berserk-off,
    # including when no SP remains after paying the one-SP activation.
    setup(points=0, skills={'swordsman_auto_berserk': 1})
    page.locator('[data-skills-tab="current"]').click()
    page.evaluate("""() => {const s=BCGame.state;s.monsters=[];s.target=null;s.player.hp=Math.floor(BCCore.stats(s).maxHp*.2);s.player.sp=1;}""")
    berserk = page.locator('.skill-card[data-skill="swordsman_auto_berserk"]')
    before_atk = page.evaluate('BCCore.stats(BCGame.state).atk')
    berserk.locator('.skill-use').click()
    page.wait_for_function("BCGame.state.classCombat?.autoBerserk?.active===true")
    assert page.evaluate('BCGame.state.player.sp') == 0
    assert abs(page.evaluate('BCCore.stats(BCGame.state).atk') - before_atk*1.32) < 1e-8
    page.wait_for_function("document.querySelector('[data-skill-live=\"swordsman_auto_berserk\"]').textContent.includes('คลั่งทำงาน')")
    page.wait_for_function("document.querySelector('.skill-card[data-skill=\"swordsman_auto_berserk\"] [data-effective-sp]').textContent==='SP 0'")
    page.wait_for_function("document.querySelector('.skill-card[data-skill=\"swordsman_auto_berserk\"] .skill-use').textContent==='ปิด'")
    assert not berserk.locator('.skill-use').is_disabled()
    aura = page.evaluate(r'''() => {
      const s=BCGame.state,canvas=document.createElement('canvas');canvas.width=canvas.height=160;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.translate(80-s.player.x,80-s.player.y);
      const snapshot={...s,combatFeedback:{events:[]},classCombat:{...s.classCombat,signals:[]}};
      BCCombatEffects.drawFront(ctx,snapshot);
      return [...ctx.getImageData(0,0,160,160).data].filter((v,i)=>i%4===3&&v>0).length;
    }''')
    assert aura > 0, 'An actual active low-HP Berserk must paint persistent aura pixels'
    page.evaluate('BCGame.state.player.hp=Math.floor(BCCore.stats(BCGame.state).maxHp*.8)')
    page.wait_for_function('BCGame.state.classCombat.autoBerserk.active===false')
    inactive_aura = page.evaluate(r'''() => {
      const s=BCGame.state,canvas=document.createElement('canvas');canvas.width=canvas.height=160;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.translate(80-s.player.x,80-s.player.y);
      BCCombatEffects.drawFront(ctx,{...s,combatFeedback:{events:[]},classCombat:{...s.classCombat,signals:[]}});
      return [...ctx.getImageData(0,0,160,160).data].filter((v,i)=>i%4===3&&v>0).length;
    }''')
    assert inactive_aura == 0, 'The aura must stop above the actual HP threshold'
    berserk.locator('.skill-use').click()
    assert page.evaluate('BCGame.state.classCombat.autoBerserk.enabled') is False
    assert page.evaluate('BCGame.state.player.sp') == 0
    page.wait_for_function("document.querySelector('[data-skill-live=\"swordsman_auto_berserk\"]').textContent==='ปิดอยู่'")

    setup(points=0, skills={'arun_slash': 5, 'swordsman_sweep': 10, 'swordsman_provoke': 5, 'swordsman_stance': 10})
    page.locator('[data-skills-tab="current"]').click()
    page.evaluate('BCGame.state.monsters=[];BCGame.state.target=null')
    endure = page.locator('.skill-card[data-skill="swordsman_stance"] .skill-use')
    endure.click()
    page.wait_for_function("document.querySelector('[data-skill-live=\"swordsman_stance\"]').textContent.includes('เหลือ 7 ครั้ง')")
    assert page.evaluate('BCGame.state.classCombat.buffs.swordsman_stance.mdefBonus') == 10
    page.wait_for_function("BCCore.actionReadiness(BCGame.state,'swordsman_sweep').ready")
    page.locator('.skill-card[data-skill="swordsman_sweep"] .skill-use').click()
    page.wait_for_function("document.querySelector('[data-skill-live=\"swordsman_sweep\"]').textContent.includes('เสริมพลังไฟ 20%')")
    assert page.evaluate('BCGame.state.classCombat.buffs.swordsman_sweep.fireBonus') == .2
    page.screenshot(path=str(output / 'swordsman-live-buffs-1440.png'))

    # Native keys share animation recovery. Magnum's additional aftercast blocks
    # another skill while ordinary attacks remain available after their cadence.
    setup(points=0, skills={'arun_slash': 10, 'swordsman_provoke': 5, 'swordsman_stance': 1, 'swordsman_sweep': 1})
    page.evaluate(r"""() => {
      const s=BCGame.state;Object.assign(s.player,{x:470,y:280});s.monsters=[{uid:'sword-ui-target',kind:'guardian',x:510,y:280,hp:100000,dead:0,cd:9999}];
      s.target=null;s.auto=false;s.settings.autoSkill=false;s.settings.autoPotion=0;
      s.hotbar=['skill:arun_slash','skill:swordsman_stance','skill:swordsman_sweep','action:attack','item:potion',null,null,null,null];
      s.target='sword-ui-target';
      // Hold only ordinary attack cadence in this input fixture. A selected
      // target otherwise launches basic attacks during unrelated Playwright
      // round trips and can reacquire action recovery before key 1 arrives.
      // The shared action lock, skill CDs, SP and normal key handlers stay real.
      s.cooldowns.attack=60;
    }""")
    # Keep the menu open until the complete fixture is ready, then focus canvas.
    page.keyboard.press('Escape')
    page.locator('#game').focus()
    # Only ordinary cadence is held above; both keys still share the actual
    # animation recovery guard and pay through normal keyboard handlers.
    page.wait_for_function("BCCore.actionReadiness(BCGame.state,'arun_slash',{target:'sword-ui-target'}).ready")
    before_sp = page.evaluate('BCGame.state.player.sp')
    page.keyboard.press('1')
    page.keyboard.press('2')
    pair = page.evaluate("""() => {const s=BCGame.state;return {bash:s.cooldowns.arun_slash||0,endure:s.cooldowns.swordsman_stance||0,sp:s.player.sp,readiness:BCCore.actionReadiness(s,'arun_slash'),toast:document.querySelector('#toast').textContent};}""")
    assert pair['bash'] > 0, pair
    assert page.evaluate('BCGame.state.player.sp') == before_sp - 15
    assert page.evaluate('BCGame.state.cooldowns.swordsman_stance||0') == 0
    page.wait_for_function("BCCore.actionReadiness(BCGame.state,'swordsman_sweep',{target:'sword-ui-target'}).ready")
    page.keyboard.press('3')
    page.wait_for_function("BCGame.state.classCombat?.afterCastDelay>1")
    page.wait_for_function("BCCore.actionReadiness(BCGame.state,'swordsman_stance').source==='aftercast'")
    # End the isolated keypair phase and enable the normal attack for its
    # own aftercast assertion; the skill aftercast itself is untouched.
    page.evaluate('BCGame.state.target=null;BCGame.state.cooldowns.attack=0')
    page.wait_for_function("document.querySelector('[data-hot=\"1\"]').dataset.readinessSource==='aftercast'")
    assert page.locator('[data-hot="1"]').is_disabled()
    page.wait_for_function("BCCore.actionReadiness(BCGame.state,'attack',{target:'sword-ui-target'}).ready")
    assert page.evaluate("BCCore.actionReadiness(BCGame.state,'swordsman_stance').source") == 'aftercast'
    page.locator('[data-hot="3"]').click()
    page.wait_for_function("BCGame.state.combatFeedback.events.some(e=>e.kind==='attack')")
    page.screenshot(path=str(output / 'swordsman-aftercast-1440.png'))

    # All ten icons and expanded details remain reachable on narrow viewports.
    for width, height in [(390, 844), (700, 390)]:
        setup(points=12)
        page.set_viewport_size({'width': width, 'height': height})
        tree()
        for skill in page.evaluate('BCData.classes.swordsman.skillIds'):
            select(skill)
            assert page.locator('#skill-tree-detail-title').inner_text() == page.evaluate('id=>BCData.skills[id].name', skill)
        geometry = page.locator('#panel-window').evaluate('el=>({scroll:el.scrollWidth,client:el.clientWidth})')
        assert geometry['scroll'] <= geometry['client']
        page.screenshot(path=str(output / f'swordsman-tree-{width}.png'))
    page.set_viewport_size({'width': 1440, 'height': 900})
    result = {'skills': names, 'regularMax': 10, 'questSkills': specials, 'selectiveRefund': 14, 'schema': 3,
              'checks': ['Thai names', 'staged prerequisites', 'dependent subtraction guarded', '10-level tables', 'SP 8/15 transition',
                         'free teacher skills', 'zero-cost staged confirmation', 'one-time migration', 'two-handed weapon identity',
                         'Berserk free-off at zero SP', 'actual HP-gated Berserk aura pixels', 'live Endure and Fire buff counters', 'native shared hotbar recovery', 'Magnum skill-only aftercast', 'mobile icon/detail reachability']}
    (output / 'swordsman-browser.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8777')
    parser.add_argument('--output-dir', default='/workspace/sword121/browser/swordsman_ui')
    args = parser.parse_args()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        result = run_checks(page, args.output_dir)
        assert not errors, errors
        print(json.dumps(result, ensure_ascii=False))
        browser.close()


if __name__ == '__main__':
    main()
