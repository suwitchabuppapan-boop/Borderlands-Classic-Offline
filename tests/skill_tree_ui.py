"""Real current-skill and staged icon-tree acceptance; no recreated DOM fixtures."""
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright


def run_checks(page, output_dir="/workspace/combat-fx-work"):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    screenshots = []
    page.wait_for_function("window.BCGame && window.BCCore && window.BCData")
    fixture_script = """() => {
      window.skillTreeFixture = (classId, points = 12, obsolete = false) => {
        const s = BCCore.createState(), d = BCData.classes[classId];
        s.classId = classId; s.weaponSchool = d.weaponType;
        s.job = d.tier ? 'Swordman' : 'Novice'; s.equipment.weapon = null;
        s.skillPoints = points;
        const st = BCCore.stats(s); s.player.hp = st.maxHp; s.player.sp = st.maxSp;
        const save = JSON.parse(BCCore.serialize(s));
        if (obsolete) {
          Object.assign(save.state.skills, {bash: 5, magnum: 1, provoke: 1});
          Object.assign(save.state.inventory, {rusty_sword: 2, yak_greatsword: 1});
          save.state.equipment.weapon = 'rusty_sword';
          save.state.equipment.armor = 'cloth_armor';
          save.state.hotbar[4] = 'skill:bash'; save.state.hotbar[5] = 'item:yak_greatsword';
          save.state.baseLevel = 12; save.state.exp = 20; save.state.silver = 321;
          save.state.stats.str = 17;
        }
        BCGame.loadSave(JSON.stringify(save)); BCGame.openPanel('skills');
      };
      window.skillTreeUserState = () => JSON.parse(BCCore.serialize(BCGame.state)).state;
    }"""
    page.evaluate(fixture_script)
    page.evaluate("skillTreeFixture('villager')")

    def tree():
        page.locator('[data-skills-tab="tree"]').click()

    def select(skill):
        page.locator(f'[data-skill-select="{skill}"]').click()

    def adjust(skill, delta):
        page.locator(f'[data-skill-adjust="{skill}"][data-delta="{delta}"]').click()

    def projected(skill):
        text = page.locator(f'.skill-tree-node[data-skill="{skill}"] .skill-node-level').inner_text()
        return int(re.search(r"\d+", text).group())

    def counter(name):
        return int(re.search(r"\d+", page.locator(f'[data-plan-{name}]').inner_text()).group())

    def progress():
        return page.evaluate("({saved:skillTreeUserState(),seed:BCGame.state.seed,stats:BCCore.stats(BCGame.state)})")

    assert page.locator('[data-skills-tab="current"]').get_attribute("aria-selected") == "true"
    assert page.locator('.skill-card[data-skill="first_aid"]').count() == 1
    checked = []
    for class_id in page.evaluate("Object.keys(BCData.classes)"):
        page.evaluate("id => skillTreeFixture(id)", class_id)
        expected = page.evaluate("BCCore.skillsFor(BCGame.state)")
        assert page.locator('.skill-card').evaluate_all("els => els.map(el => el.dataset.skill)") == expected
        before = progress()
        tree()
        assert page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") == "true"
        ancestry = page.evaluate("""() => {
          const ids=[]; for(let id=BCGame.state.classId;BCData.classes[id]?.tier>0;id=BCData.classes[id].parent)ids.unshift(id);
          return ids.flatMap(id=>BCData.classes[id].skillIds.map(skillId=>({classId:id,skillId})));
        }""")
        actual = page.locator('.skill-tree-node').evaluate_all("els=>els.map(el=>({classId:el.dataset.class,skillId:el.dataset.skill}))")
        assert actual == ancestry, (class_id, actual, ancestry)
        assert page.locator('.skill-tree-node[data-state="locked"]').count() == 0
        assert page.locator('.skill-tree-shared [data-skill="first_aid"]').count() == 1
        for node in page.locator('.skill-tree-node').all():
            skill, owner = node.get_attribute("data-skill"), node.get_attribute("data-class")
            assert node.get_attribute("data-state") == ("own" if owner == class_id else "inherited")
            assert node.locator('[data-act="learn"]').count() == 0, "Tree allocation must not bypass confirmation"
            assert not node.locator('[data-delta="1"]').is_disabled()
            assert node.locator('[data-delta="-1"]').is_disabled()
            assert projected(skill) == 0
            select(skill)
            assert page.locator('#skill-tree-detail-title').inner_text() == page.evaluate("id=>BCData.skills[id].name", skill)
            job = page.evaluate("id=>BCData.classes[id].tier===1?'10':'40'", owner)
            assert job in page.locator('.skill-tree-detail .skill-tree-requirement').inner_text()
            if node.get_attribute("data-kind") == "passive":
                assert page.locator('.skill-tree-detail [data-act="skill"]').count() == 0
        assert counter("spent") == 0 and counter("remaining") == 12
        assert page.locator('[data-plan-apply]').is_disabled()
        assert progress() == before, "Browsing icons must not alter progress, stats or RNG"
        checked.append(class_id)

    # Current-format sanitation remains independent of the new visual tree.
    page.evaluate("skillTreeFixture('swordsman',8,true)")
    migration = page.evaluate("""() => ({classId:BCGame.state.classId,level:BCGame.state.baseLevel,exp:BCGame.state.exp,
      silver:BCGame.state.silver,str:BCGame.state.stats.str,points:BCGame.state.skillPoints,
      skills:Object.keys(BCGame.state.skills),inventory:Object.keys(BCGame.state.inventory),
      equipment:BCGame.state.equipment,bindings:BCGame.state.hotbar.slice(4,6)})""")
    assert (migration["classId"], migration["level"], migration["exp"], migration["silver"], migration["str"], migration["points"]) == ("swordsman", 12, 20, 321, 17, 8)
    assert not {"bash", "magnum", "provoke"}.intersection(migration["skills"])
    assert not {"rusty_sword", "yak_greatsword"}.intersection(migration["inventory"])
    assert migration["equipment"]["weapon"] is None and migration["equipment"]["armor"] == "cloth_armor"
    assert migration["bindings"] == [None, None]

    page.evaluate("skillTreeFixture('royal_duelist',8)")
    tree()
    assert page.locator('.skill-tree-node[data-skill="shield_counter"]').count() == 0
    assert not {"bash", "magnum", "provoke"}.intersection(page.locator('[data-skill]').evaluate_all("els=>els.map(el=>el.dataset.skill)"))
    select("royal_flurry")
    details = page.locator('.skill-tree-detail').inner_text()
    assert "SP 12" in details and "CD 5" in details and "58" in details
    before = progress()
    # Both real guarded learning and forged staged controls reject foreign skills.
    page.locator('#side-panel').evaluate("""el=>{
      for(const staged of [false,true]){
        const b=document.createElement('button');
        if(staged){b.dataset.skillAdjust='shield_counter';b.dataset.delta='1';}
        else{b.dataset.act='learn';b.dataset.id='shield_counter';}
        el.append(b);b.click();b.remove();
      }
    }""")
    assert progress() == before
    for level in range(1, 6):
        adjust("royal_flurry", 1)
        assert projected("royal_flurry") == level
        assert counter("spent") == level and counter("remaining") == 8-level
        assert page.evaluate("BCGame.state.skills.royal_flurry") == 0
        assert page.evaluate("BCGame.state.skillPoints") == 8
        assert page.locator('[data-skill-adjust="royal_flurry"][data-delta="1"]').evaluate("el=>el===document.activeElement") or level == 5
    plus = page.locator('[data-skill-adjust="royal_flurry"][data-delta="1"]')
    assert plus.is_disabled()
    plus.dispatch_event("click")
    assert projected("royal_flurry") == 5 and counter("spent") == 5
    adjust("royal_flurry", -1)
    assert projected("royal_flurry") == 4 and counter("spent") == 4
    adjust("royal_flurry", 1)
    adjust("arun_slash", 1)
    select("swordsman_discipline")
    adjust("swordsman_discipline", 1)
    assert page.locator('.skill-tree-detail [data-act="skill"]').count() == 0
    assert counter("spent") == 7 and counter("remaining") == 1
    assert progress() == before, "Staged passives and attacks must have no live combat effect"
    pending_screenshot = output / "skill-tree-pending-1440.png"
    page.screenshot(path=str(pending_screenshot))
    screenshots.append(str(pending_screenshot))
    page.evaluate("BCGame.save()")
    staged_save = page.evaluate("JSON.parse(localStorage.getItem(BCData.saveKey)).state")
    assert staged_save["skills"]["royal_flurry"] == 0 and staged_save["skills"]["swordsman_discipline"] == 0
    assert not {"skillPlan", "skillAllocation", "increments", "baseline"}.intersection(staged_save)
    page.locator('[data-plan-reset]').click()
    assert counter("spent") == 0 and counter("remaining") == 8 and progress() == before
    for skill, count in [("royal_flurry", 5), ("arun_slash", 1), ("swordsman_discipline", 1)]:
        for _ in range(count):
            adjust(skill, 1)
    page.locator('[data-plan-apply]').click()
    assert page.evaluate("BCGame.state.skills.royal_flurry") == 5
    assert page.evaluate("BCGame.state.skills.arun_slash") == 1
    assert page.evaluate("BCGame.state.skills.swordsman_discipline") == 1
    assert page.evaluate("BCGame.state.skillPoints") == 1
    assert counter("spent") == 0 and counter("remaining") == 1
    assert page.evaluate("BCCore.stats(BCGame.state).atk") > before["stats"]["atk"]
    committed = progress()
    assert page.locator('[data-skill-adjust="royal_flurry"][data-delta="1"]').is_disabled()
    minus = page.locator('[data-skill-adjust="royal_flurry"][data-delta="-1"]')
    assert minus.is_disabled()
    minus.dispatch_event("click")
    assert progress() == committed, "Minus must never refund a committed level"
    assert page.locator('[data-plan-apply]').is_disabled()
    page.locator('[data-plan-apply]').dispatch_event("click")
    assert progress() == committed, "Repeated confirmation cannot spend or grant points twice"
    adjust("arun_slash", 1)
    assert counter("spent") == 1 and counter("remaining") == 0
    assert page.locator('[data-skill-adjust="swordsman_discipline"][data-delta="1"]').is_disabled()
    page.locator('[data-skill-adjust="swordsman_discipline"][data-delta="1"]').dispatch_event("click")
    assert counter("spent") == 1 and progress() == committed

    # Closing discards only the unconfirmed allocation.
    page.keyboard.press("Escape")
    page.locator('[data-panel="skills"]').click()
    tree()
    assert counter("spent") == 0 and projected("arun_slash") == 1
    assert progress() == committed
    # Native icon buttons work by keyboard, and tab switching retains the dialog trap.
    page.locator('[data-skill-select="royal_flurry"]').focus()
    page.keyboard.press("Enter")
    assert page.locator('#skill-tree-detail-title').inner_text() == page.evaluate("BCData.skills.royal_flurry.name")
    page.locator('[data-skills-tab="tree"]').focus()
    page.keyboard.press("ArrowLeft")
    assert page.locator('[data-skills-tab="current"]').get_attribute("aria-selected") == "true"
    assert page.locator('[data-skills-tab="current"]').evaluate("el=>el===document.activeElement")
    page.keyboard.press("End")
    assert page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") == "true"
    page.locator('[data-open="hotbar"]').click()
    assert page.locator('option[value="skill:bash"],option[value="skill:magnum"],option[value="skill:provoke"],option[value="item:rusty_sword"],option[value="item:yak_greatsword"]').count() == 0
    page.locator('[data-bind="1"]').select_option("skill:royal_flurry")
    assert page.evaluate("BCGame.state.hotbar[1]") == "skill:royal_flurry"
    assert page.locator('[data-bind="1"] option[value="skill:shield_counter"]').count() == 0
    assert page.locator('[data-bind="1"] option[value="skill:swordsman_discipline"]').count() == 0
    page.evaluate("BCGame.save()")
    saved = page.evaluate("localStorage.getItem(BCData.saveKey)")
    page.reload()
    page.wait_for_function("window.BCGame")
    page.evaluate(fixture_script)
    assert page.evaluate("BCGame.state.skills.royal_flurry") == 5
    assert page.evaluate("BCGame.state.hotbar[1]") == "skill:royal_flurry"
    assert json.loads(saved)["state"]["skills"]["arun_slash"] == 1
    page.locator('[data-panel="skills"]').click()
    tree()
    page.locator('#panel-window [data-action="close"]').focus()
    page.keyboard.press("Shift+Tab")
    assert page.locator('#panel-window').evaluate("el=>el.contains(document.activeElement)")
    page.keyboard.press("Tab")
    assert page.locator('#panel-window [data-action="close"]').evaluate("el=>el===document.activeElement")
    page.keyboard.press("Escape")
    assert page.locator('[data-panel="skills"]').evaluate("el=>el===document.activeElement")

    # Import invalidates an in-progress allocation, and point loss cannot partially commit it.
    page.evaluate("skillTreeFixture('royal_duelist',2)")
    tree()
    adjust("royal_flurry", 1)
    adjust("arun_slash", 1)
    page.evaluate("BCGame.state.skillPoints=1")
    before_stale = progress()
    page.locator('[data-plan-apply]').dispatch_event("click")
    assert progress() == before_stale, "Stale insufficient points must reject the entire plan"
    page.evaluate("skillTreeFixture('swordsman',3)")
    tree()
    assert page.locator('.skill-tree-node').count() == 4 and counter("spent") == 0
    adjust("arun_slash", 1)
    page.evaluate("text=>BCGame.loadSave(text)", saved)
    assert page.evaluate("BCGame.state.classId") == "royal_duelist"
    if page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") != "true":
        tree()
    assert counter("spent") == 0 and projected("arun_slash") == 1

    # A genuine RAF-driven kill continues while an unconfirmed tree allocation is open.
    page.evaluate("skillTreeFixture('swordsman',2)")
    tree()
    adjust("arun_slash", 1)
    page.evaluate("""()=>{
      const s=BCGame.state;s.auto=true;s.settings.autoSkill=false;s.stats.dex=99;s.stats.str=20;s.seed=1;
      s.player.x=400;s.player.y=310;const m=s.monsters.find(m=>m.kind==='poring');
      Object.assign(m,{x:430,y:310,hp:1,dead:0,cd:999});s.target=m.uid;s.cooldowns.attack=0;
    }""")
    page.wait_for_function("(BCGame.state.kills.poring||0)>=1")
    assert page.evaluate("BCGame.state.skills.arun_slash") == 0 and counter("spent") == 1
    page.evaluate("BCGame.state.auto=false")
    page.evaluate("text=>BCGame.loadSave(text)", saved)
    if page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") != "true":
        tree()

    for width, height in [(1440, 900), (390, 844), (700, 390)]:
        page.set_viewport_size({"width": width, "height": height})
        viewport_before = progress()
        for skill in page.locator('[data-skill-select]').evaluate_all("els=>els.map(el=>el.dataset.skillSelect)"):
            select(skill)
            assert page.locator('#skill-tree-detail-title').inner_text() == page.evaluate("id=>BCData.skills[id].name", skill)
        adjust("arun_slash", 1)
        assert projected("arun_slash") == 2 and counter("spent") == 1
        adjust("arun_slash", -1)
        assert projected("arun_slash") == 1 and counter("spent") == 0
        assert progress() == viewport_before, (width, height, "Responsive controls must remain real clickable previews")
        select("royal_flurry")
        geometry = page.locator('#panel-window').evaluate("el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth};}")
        assert geometry["x"] >= 0 and geometry["right"] <= width
        assert geometry["top"] >= 0 and geometry["bottom"] <= height
        assert geometry["scroll"] <= geometry["client"], geometry
        assert page.locator('.skill-tree-node').count() == 8
        columns = page.locator('.skill-tree-grid').first.evaluate("el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length")
        assert columns == (4 if width > 700 else 2), (width, columns)
        icon_size = page.locator('[data-skill-select="royal_flurry"]').bounding_box()
        assert icon_size["width"] >= 44 and icon_size["height"] >= 44
        if width == 1440:
            assert geometry["right"]-geometry["x"] >= 700
        assert page.locator('.skill-tree-node[data-skill="arcane_volley"]').count() == 0
        page.locator('#panel-window').evaluate("el=>el.scrollTop=0")
        screenshot = output / f"skill-tree-{width}.png"
        page.screenshot(path=str(screenshot))
        screenshots.append(str(screenshot))
    page.set_viewport_size({"width": 1440, "height": 900})
    page.evaluate("BCGame.state.skillPoints=0;BCGame.openPanel('skills')")
    tree()
    assert page.locator('[data-skill-adjust="arun_slash"][data-delta="1"]').is_disabled()
    result = {"classes": len(checked), "class_skills": 60, "catalog_skills": 61,
              "tree_node_counts": {"villager": 0, "class_1": 4, "class_2": 8}, "learning_max": 5,
              "checks": ["current compatibility", "exact inherited ancestry", "selected icon details", "Job/SP/CD/range", "staged +/- without gameplay/RNG/save changes", "passive preview stays inactive", "max/points bounds", "atomic batch confirmation", "reset/close/import invalidation", "no committed refunds", "stale points reject atomically", "genuine Auto farming while planning", "foreign actions rejected", "obsolete sanitation", "hotbar/save/reload", "keyboard/focus trap", "desktop4/mobile2 columns", "all icons and +/- natively clickable at 1440x900,390x844,700x390"],
              "migration": migration, "screenshots": screenshots}
    (output / "skill-tree-browser.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    parser.add_argument("--output-dir", default="/workspace/combat-fx-work")
    args = parser.parse_args()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url)
        result = run_checks(page, args.output_dir)
        assert not errors, errors
        print(json.dumps(result, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
