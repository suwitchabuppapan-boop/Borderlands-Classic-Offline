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
      window.skillTreeFixture = (classId, points = 12, legacy = false) => {
        const s = BCCore.createState(), d = BCData.classes[classId];
        s.classId = classId; s.weaponSchool = d.weaponType;
        s.job = d.tier ? 'Swordman' : 'Novice'; s.equipment.weapon = null;
        s.skillPoints = points;
        if (legacy) { s.skills.bash = 5; s.skills.magnum = 1; s.skills.provoke = 1; }
        BCGame.loadSave(BCCore.serialize(s)); BCGame.openPanel('skills');
      };
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
        before_browse = page.evaluate("BCCore.serialize(BCGame.state)")
        page.locator('[data-skills-tab="tree"]').click()
        assert page.locator('[data-skills-tab="tree"]').get_attribute("aria-selected") == "true"
        assert page.locator('.skill-tree-node').count() == 15
        assert page.locator('.skill-tree-shared [data-skill="first_aid"]').count() == 1
        own = page.evaluate("BCData.classes[BCGame.state.classId].skill")
        ancestry = page.evaluate("BCSkillTree.nodesFor(BCGame.state.classId).ancestry.map(n => n.skillId)")
        for node in page.locator('.skill-tree-node').all():
            skill = node.get_attribute("data-skill")
            state = node.get_attribute("data-state")
            assert state == ("own" if skill == own else "inherited" if skill in ancestry else "locked"), (class_id, skill, state)
            assert node.locator('[data-act="learn"]').is_disabled() == (skill not in ancestry)
        assert page.locator('.skill-tree-requirement').first.inner_text().find("10") >= 0
        assert "40" in page.locator('.skill-tree-requirement').nth(1).inner_text()
        assert page.evaluate("BCCore.serialize(BCGame.state)") == before_browse
        checked.append(class_id)

    page.evaluate("skillTreeFixture('royal_duelist', 8, true)")
    assert page.locator('.skill-card[data-skill="bash"]').count() == 1
    page.locator('[data-skills-tab="tree"]').click()
    assert page.locator('.skill-tree-legacy [data-skill="bash"]').count() == 1
    own = page.locator('.skill-tree-node[data-skill="royal_flurry"]')
    inherited = page.locator('.skill-tree-node[data-skill="arun_slash"]')
    sibling = page.locator('.skill-tree-node[data-skill="shield_counter"]')
    assert "SP 12" in own.inner_text() and "CD 5" in own.inner_text() and "58" in own.inner_text()
    assert sibling.locator('button').is_disabled()
    before = page.evaluate("({points:BCGame.state.skillPoints,skills:{...BCGame.state.skills},classId:BCGame.state.classId,weaponSchool:BCGame.state.weaponSchool})")
    sibling.locator('button').dispatch_event("click")
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
    own.locator('button').dispatch_event("click")
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
        page.locator('.skill-tree-node[data-skill="arcane_volley"]').scroll_into_view_if_needed()
        assert page.locator('.skill-tree-node[data-skill="arcane_volley"]').is_visible()
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
    assert page.locator('.skill-tree-node[data-skill="arun_slash"] button').is_disabled()
    result = {"classes": len(checked), "class_signatures": 15, "catalog_skills": 19, "learning_max": 5,
              "checks": ["current compatibility", "own/inherited/locked", "SP/CD/range", "Job 10/40 trial requirements", "learn points/max", "disabled sibling action", "legacy separation", "hotbar", "save/reload", "tabs/arrows/focus/trap", "1440/390 layout"], "screenshots": screenshots}
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
