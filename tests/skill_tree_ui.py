"""Real Skills dialog acceptance. Import run_checks(page) to reuse a browser."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright


def run_checks(page, output_dir="/workspace/combat-fx-work"):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    page.wait_for_function("window.BCGame && window.BCCore && window.BCData")
    page.evaluate("""() => {
      window.skillTreeFixture = (classId, points = 12, obsolete = false) => {
        const s = BCCore.createState(), d = BCData.classes[classId];
        s.classId = classId; s.weaponSchool = d.weaponType;
        s.job = d.tier ? 'Swordman' : 'Novice'; s.equipment.weapon = null;
        s.skillPoints = points;
        const st = BCCore.stats(s); s.player.hp = st.maxHp; s.player.sp = st.maxSp;
        const save = JSON.parse(BCCore.serialize(s));
        if (obsolete) {
          // A current-format import keeps progress and prunes obsolete
          // definitions rather than keeping hidden cast/equip/hotbar support.
          Object.assign(save.state.skills, {bash: 5, magnum: 1, provoke: 1});
          Object.assign(save.state.inventory, {rusty_sword: 2, yak_greatsword: 1});
          save.state.equipment.weapon = 'rusty_sword';
          save.state.equipment.armor = 'cloth_armor';
          save.state.hotbar[4] = 'skill:bash';
          save.state.hotbar[5] = 'item:yak_greatsword';
          save.state.baseLevel = 12; save.state.exp = 20; save.state.silver = 321;
          save.state.stats.str = 17;
          window.obsoleteSkillTreeImport = save.state;
        }
        BCGame.loadSave(JSON.stringify(save)); BCGame.openPanel('skills');
      };
      window.skillTreeUserState = () => JSON.parse(BCCore.serialize(BCGame.state)).state;
      skillTreeFixture('villager');
    }""")
    assert page.locator('[data-skills-tab="current"]').count() == 1, "Skills current/tree tabs are missing"
    assert page.locator('[data-skills-tab="current"]').get_attribute("aria-selected") == "true"
    assert page.locator('.skill-card[data-skill="first_aid"]').count() == 1
    identities = page.evaluate("Object.keys(BCData.classes)")
    checked = []
    for class_id in identities:
        page.evaluate("id => skillTreeFixture(id)", class_id)
        expected = page.evaluate("BCCore.skillsFor(BCGame.state)")
        assert page.locator('.skill-card').evaluate_all("els => els.map(el => el.dataset.skill)") == expected
        before_browse = page.evaluate("skillTreeUserState()")
        page.locator('[data-skills-tab="tree"]').click()
        assert page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") == "true"
        ancestry = page.evaluate("""() => {
          const ids = [];
          for (let id = BCGame.state.classId; BCData.classes[id]?.tier > 0; id = BCData.classes[id].parent) ids.unshift(id);
          return ids.flatMap(id => BCData.classes[id].skillIds.map(skillId => ({classId: id, skillId})));
        }""")
        actual = page.locator('.skill-tree-node').evaluate_all("els => els.map(el => ({classId: el.dataset.class, skillId: el.dataset.skill}))")
        assert actual == ancestry, (class_id, "Skills tree must contain only current/inherited classes", actual, ancestry)
        assert page.locator('.skill-tree-node[data-state="locked"]').count() == 0
        assert page.locator('.skill-tree-shared [data-skill="first_aid"]').count() == 1
        own = page.evaluate("BCGame.state.classId")
        for node in page.locator('.skill-tree-node').all():
            skill = node.get_attribute("data-skill")
            state = node.get_attribute("data-state")
            assert state == ("own" if node.get_attribute("data-class") == own else "inherited"), (class_id, skill, state)
            assert not node.locator('[data-act="learn"]').is_disabled()
            assert ("10" if state == "inherited" or len(ancestry) == 4 else "40") in node.locator('.skill-tree-requirement').inner_text()
        assert page.evaluate("skillTreeUserState()") == before_browse
        checked.append(class_id)

    page.evaluate("skillTreeFixture('swordsman', 8, true)")
    migration = page.evaluate("""() => ({
      classId:BCGame.state.classId, level:BCGame.state.baseLevel, exp:BCGame.state.exp,
      silver:BCGame.state.silver, str:BCGame.state.stats.str, points:BCGame.state.skillPoints,
      skills:Object.keys(BCGame.state.skills), inventory:Object.keys(BCGame.state.inventory),
      equipment:BCGame.state.equipment, bindings:BCGame.state.hotbar.slice(4,6)
    })""")
    assert migration["classId"] == "swordsman" and migration["level"] == 12
    assert migration["exp"] == 20 and migration["silver"] == 321 and migration["str"] == 17
    assert migration["points"] == 8
    assert not {"bash", "magnum", "provoke"}.intersection(migration["skills"])
    assert not {"rusty_sword", "yak_greatsword"}.intersection(migration["inventory"])
    assert migration["equipment"]["weapon"] is None and migration["equipment"]["armor"] == "cloth_armor"
    assert migration["bindings"] == [None, None]
    assert page.locator('.skill-card[data-skill="bash"]').count() == 0
    assert page.locator('[data-skill="shield_counter"]').count() == 0
    page.evaluate("skillTreeFixture('royal_duelist', 8)")
    page.locator('[data-skills-tab="tree"]').click()
    assert page.locator('.skill-tree-legacy').count() == 0
    assert not {"bash", "magnum", "provoke"}.intersection(page.locator('[data-skill]').evaluate_all("els=>els.map(el=>el.dataset.skill)"))
    own = page.locator('.skill-tree-node[data-skill="royal_flurry"]')
    inherited = page.locator('.skill-tree-node[data-skill="arun_slash"]')
    sibling = page.locator('.skill-tree-node[data-skill="shield_counter"]')
    assert "SP 12" in own.inner_text() and "CD 5" in own.inner_text() and "58" in own.inner_text()
    assert sibling.count() == 0
    before = page.evaluate("({points:BCGame.state.skillPoints,skills:{...BCGame.state.skills},classId:BCGame.state.classId,weaponSchool:BCGame.state.weaponSchool})")
    # A forged foreign learn action must still fail at the real delegated handler.
    page.locator('#side-panel').evaluate("""el => {
      const forged = document.createElement('button');
      forged.dataset.act = 'learn'; forged.dataset.id = 'shield_counter';
      el.append(forged); forged.click(); forged.remove();
    }""")
    assert page.evaluate("({points:BCGame.state.skillPoints,skills:{...BCGame.state.skills},classId:BCGame.state.classId,weaponSchool:BCGame.state.weaponSchool})") == before
    for level in range(1, 6):
        own.locator('[data-act="learn"]').click()
        assert page.evaluate("BCGame.state.skills.royal_flurry") == level
        assert page.evaluate("BCGame.state.skillPoints") == 8 - level
        assert page.locator('[data-skill-points]').inner_text() == str(8 - level)
        assert f"Lv.{level} / 5" in own.locator('h3').inner_text()
        assert own.locator('[data-act="learn"]').evaluate("el => el === document.activeElement") or level == 5
    assert own.locator('[data-act="learn"]').is_disabled()
    points = page.evaluate("BCGame.state.skillPoints")
    own.locator('[data-act="learn"]').dispatch_event("click")
    assert page.evaluate("BCGame.state.skillPoints") == points
    assert page.evaluate("BCGame.state.skills.royal_flurry") == 5
    inherited.locator('[data-act="learn"]').click()
    assert page.evaluate("BCGame.state.skills.arun_slash") == 1
    # Tabs are keyboard navigable, preserve selection on learning, and stay in the modal.
    page.locator('[data-skills-tab="tree"]').focus()
    page.keyboard.press("ArrowLeft")
    assert page.locator('[data-skills-tab="current"]').get_attribute("aria-selected") == "true"
    assert page.locator('[data-skills-tab="current"]').evaluate("el => el === document.activeElement")
    page.keyboard.press("End")
    assert page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") == "true"
    page.locator('[data-open="hotbar"]').click()
    assert page.locator('option[value="skill:bash"],option[value="skill:magnum"],option[value="skill:provoke"],option[value="item:rusty_sword"],option[value="item:yak_greatsword"]').count() == 0
    page.locator('[data-bind="1"]').select_option("skill:royal_flurry")
    assert page.evaluate("BCGame.state.hotbar[1]") == "skill:royal_flurry"
    assert page.locator('[data-bind="1"] option[value="skill:shield_counter"]').count() == 0
    page.evaluate("BCGame.save()")
    saved = page.evaluate("localStorage.getItem(BCData.saveKey)")
    page.reload()
    page.wait_for_function("window.BCGame")
    assert page.evaluate("BCGame.state.skills.royal_flurry") == 5
    assert page.evaluate("BCGame.state.hotbar[1]") == "skill:royal_flurry"
    assert json.loads(saved)["state"]["skills"]["arun_slash"] == 1
    page.locator('[data-panel="skills"]').click()
    assert page.locator('[data-skills-tab="current"]').get_attribute("aria-selected") == "true"
    page.locator('[data-skills-tab="tree"]').click()
    page.locator('#panel-window [data-action="close"]').focus()
    page.keyboard.press("Shift+Tab")
    assert page.locator('[data-open="hotbar"]').evaluate("el => el === document.activeElement")
    page.keyboard.press("Tab")
    assert page.locator('#panel-window [data-action="close"]').evaluate("el => el === document.activeElement")
    page.keyboard.press("Escape")
    assert page.locator('[data-panel="skills"]').evaluate("el => el === document.activeElement")
    # Screenshots are made with the real dialog, not a recreated DOM fixture.
    screenshots = []
    for width, height in [(1440, 900), (390, 844)]:
        page.set_viewport_size({"width": width, "height": height})
        page.locator('[data-panel="skills"]').click()
        page.locator('[data-skills-tab="tree"]').click()
        geometry = page.locator('#panel-window').evaluate("el => ({x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,scroll:el.scrollWidth,client:el.clientWidth})")
        assert geometry["x"] >= 0 and geometry["right"] <= width
        assert geometry["top"] >= 0 and geometry["bottom"] <= height
        assert geometry["scroll"] <= geometry["client"], geometry
        assert page.locator('.skill-tree-node').count() == 8
        page.locator('.skill-tree-node[data-skill="royal_flurry"]').scroll_into_view_if_needed()
        assert page.locator('.skill-tree-node[data-skill="royal_flurry"]').is_visible()
        assert page.locator('.skill-tree-node[data-skill="arcane_volley"]').count() == 0
        page.locator('#panel-window').evaluate("el => el.scrollTop = 0")
        screenshot = output / f"skill-tree-{width}.png"
        page.screenshot(path=str(screenshot))
        screenshots.append(str(screenshot))
        page.keyboard.press("Escape")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.evaluate("""() => {
      const s = BCGame.state; s.skillPoints = 0;
      BCGame.openPanel('skills');
    }""")
    page.locator('[data-skills-tab="tree"]').click()
    assert page.locator('.skill-tree-node[data-skill="arun_slash"] [data-act="learn"]').is_disabled()
    result = {"classes": len(checked), "class_skills": 60, "catalog_skills": 61, "tree_node_counts": {"villager": 0, "class_1": 4, "class_2": 8}, "learning_max": 5,
              "checks": ["current compatibility", "exact current/inherited ancestry", "no sibling/foreign/future class cards", "SP/CD/range", "Job 10/40 trial requirements", "learn points/max", "forged foreign action rejected", "current-format import preserves progress and prunes obsolete skills/items/equipment/bindings", "no obsolete hotbar options", "hotbar", "save/reload", "tabs/arrows/focus/trap", "1440/390 layout"], "migration": migration, "screenshots": screenshots}
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
