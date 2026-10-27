"""Shared action recovery through native Hotbar input and the real simulation.

Legal learned-skill fixtures prepare each scenario. Keyboard, pointer, menus,
Auto Battle, background catchup and save/load use the normal game handlers.
"""
import argparse
import asyncio
import json
from pathlib import Path


async def run_checks(page, artifacts=None):
    output = Path(artifacts or "/workspace/combat120/skill_action_ui")
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.wait_for_function("window.BCGame && BCCore.actionReadiness && BCRender.assets.ready")
    await page.keyboard.press("Escape")
    await page.evaluate(r'''() => {
      window.__action120={};
      __action120.setup=()=>{
        const C=BCCore,s=C.createState(),cls=BCData.classes.lotus_mage;
        Object.assign(s,{classId:'lotus_mage',weaponSchool:cls.weaponType,job:'Swordman',skillPoints:100,seed:1});
        s.equipment.weapon=cls.trainingWeapon;s.stats.int=40;s.stats.dex=30;
        for(const id of ['gather_petals','lotus_veil','lotus_bolt','lotus_storm']){
          const r=C.act(s,'learn',{id});if(!r.ok)throw Error(r.message);
        }
        const st=C.stats(s);Object.assign(s.player,{x:470,y:280,sp:st.maxSp,hp:Math.floor(st.maxHp*.4)});
        s.monsters=[{uid:'action-target',kind:'guardian',x:510,y:280,hp:100000,dead:0,cd:9999}];
        s.target=null;s.auto=false;s.settings.autoSkill=false;s.settings.autoPotion=0;
        s.hotbar=['skill:gather_petals','skill:lotus_veil','skill:first_aid','skill:lotus_bolt','item:potion','action:attack','action:auto',null,null];
        BCGame.loadSave(C.serialize(s));return {sp:BCGame.state.player.sp,seed:BCGame.state.seed};
      };
      __action120.snapshot=()=>{
        const s=BCGame.state;return {clock:s.clock,sp:s.player.sp,seed:s.seed,cooldowns:{...s.cooldowns},
          events:(s.combatFeedback?.events||[]).map(e=>({...e})),
          slots:[...document.querySelectorAll('.hot-slot')].map(el=>({disabled:el.disabled,title:el.title,
            source:el.dataset.readinessSource,remaining:Number(el.dataset.readinessRemaining),
            overlay:parseFloat(el.querySelector('.cooldown').style.height)||0}))};
      };
    }''')

    async def setup():
        await page.keyboard.press("Escape")
        initial = await page.evaluate("__action120.setup()")
        await page.wait_for_function("document.querySelector('[data-hot=\"0\"]').title.includes(BCData.skills.gather_petals.name)")
        await page.locator("#game").focus()
        return initial

    async def pointer(slot):
        box = await page.locator(f'[data-hot="{slot}"]').bounding_box()
        assert box
        # A native pointer click on a disabled slot must stay inert. Locator.click
        # would wait for it to recover and miss the rapid-input case entirely.
        await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

    records = []
    for width, height in [(1440, 900), (390, 844)]:
        await page.set_viewport_size({"width": width, "height": height})
        initial = await setup()
        await page.keyboard.press("1")
        await page.keyboard.press("2")
        await page.keyboard.press("3")
        await pointer(1)
        await pointer(2)
        await page.wait_for_function("document.querySelector('[data-hot=\"1\"]').disabled")
        blocked = await page.evaluate("__action120.snapshot()")
        assert blocked["sp"] == initial["sp"] - await page.evaluate("BCSkillRules.spCost(BCGame.state,'gather_petals')")
        assert blocked["seed"] == initial["seed"]
        assert {key for key, value in blocked["cooldowns"].items() if value > 0 and key != "swing"} == {"gather_petals"}
        assert [e["skillId"] for e in blocked["events"] if e["kind"] == "skill"] == ["gather_petals"]
        for slot in blocked["slots"][:4]:
            assert slot["disabled"] and slot["title"] and slot["overlay"] > 0, slot
        for slot in blocked["slots"][1:4]:
            assert slot["source"] == "action" and slot["remaining"] > 0, slot
        assert not blocked["slots"][4]["disabled"], "items keep their existing independent behavior"
        await page.screenshot(path=str(output / f"hotbar-recovery-{width}.png"))
        # The same real clock releases shared recovery, while the first skill's
        # ten-second individual cooldown keeps only that skill unavailable.
        await page.wait_for_function("BCCore.actionReadiness(BCGame.state,'lotus_veil').ready")
        await page.wait_for_function("!document.querySelector('[data-hot=\"1\"]').disabled")
        unlocked = await page.evaluate("__action120.snapshot()")
        assert unlocked["slots"][0]["disabled"] and unlocked["slots"][0]["source"] == "cooldown"
        assert not unlocked["slots"][1]["disabled"] and not unlocked["slots"][2]["disabled"]
        assert 0 < unlocked["cooldowns"]["gather_petals"] < 10
        await pointer(1)
        await page.keyboard.press("3")
        second = await page.evaluate("__action120.snapshot()")
        assert second["cooldowns"].get("lotus_veil", 0) > 0 and not second["cooldowns"].get("first_aid", 0)
        await page.wait_for_function("BCCore.actionReadiness(BCGame.state,'first_aid').ready")
        await page.locator("#game").focus()
        await page.keyboard.press("3")
        third = await page.evaluate("__action120.snapshot()")
        expected_cost = await page.evaluate("['gather_petals','lotus_veil','first_aid'].reduce((sum,id)=>sum+BCSkillRules.spCost(BCGame.state,id),0)")
        assert third["sp"] == initial["sp"] - expected_cost
        assert third["cooldowns"].get("first_aid", 0) > 0
        assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth+1")
        records.append({"width": width, "blocked": blocked, "unlocked": unlocked, "second": second, "third": third})

    await page.set_viewport_size({"width": 1440, "height": 900})
    await setup()
    await page.keyboard.press("1")
    await page.evaluate("BCGame.openPanel('skills')")
    for skill_id in ["gather_petals", "lotus_veil", "first_aid", "lotus_bolt", "lotus_storm"]:
        button = page.locator(f'.skill-use[data-id="{skill_id}"]')
        assert await button.is_disabled() and await button.get_attribute("title")
    await page.wait_for_function("BCCore.actionReadiness(BCGame.state,'lotus_veil').ready")
    await page.wait_for_function("!document.querySelector('.skill-use[data-id=\"lotus_veil\"]').disabled")
    menu_clock = await page.evaluate("BCGame.state.clock")
    await page.keyboard.press("3")
    assert not await page.evaluate("BCGame.state.cooldowns.first_aid>0"), "an open menu suppresses game hotkeys"
    await page.locator('.skill-use[data-id="first_aid"]').click()
    assert await page.evaluate("BCGame.state.cooldowns.first_aid>0")
    await page.evaluate("window.dispatchEvent(new Event('blur'))")
    await page.wait_for_function("BCCore.actionReadiness(BCGame.state,'lotus_veil').ready")
    assert await page.evaluate("BCGame.state.clock") > menu_clock + .4
    await page.evaluate("window.dispatchEvent(new Event('focus'))")
    await page.screenshot(path=str(output / "skill-panel-recovery.png"))
    await page.keyboard.press("Escape")

    # Actual browser freezing resumes the action clock through normal catchup.
    await setup()
    await page.keyboard.press("1")
    cdp = await page.context.new_cdp_session(page)
    await cdp.send("Page.setWebLifecycleState", {"state": "frozen"})
    await asyncio.sleep(.65)
    await cdp.send("Page.setWebLifecycleState", {"state": "active"})
    await page.wait_for_function("BCCore.actionReadiness(BCGame.state,'lotus_veil').ready")
    await cdp.detach()
    resumed = await page.evaluate("__action120.snapshot()")
    assert resumed["cooldowns"]["gather_petals"] > 0 and not resumed["cooldowns"].get("lotus_veil", 0)

    # Auto Battle joins the same character recovery and then resumes naturally.
    await setup()
    await page.keyboard.press("1")
    await page.evaluate("BCGame.state.settings.autoSkill=true")
    await page.keyboard.press("f")
    await page.wait_for_timeout(160)
    auto_blocked = await page.evaluate("__action120.snapshot()")
    assert not auto_blocked["cooldowns"].get("attack", 0)
    assert not auto_blocked["cooldowns"].get("lotus_bolt", 0) and not auto_blocked["cooldowns"].get("lotus_storm", 0)
    await page.wait_for_function("BCGame.state.cooldowns.lotus_bolt>0 || BCGame.state.cooldowns.lotus_storm>0 || BCGame.state.cooldowns.lotus_veil>0")
    auto_resumed = await page.evaluate("__action120.snapshot()")
    await page.keyboard.press("f")

    # A real save/reload starts with no transient action or individual cooldown.
    await setup()
    await page.keyboard.press("1")
    await page.locator("#save-button").click()
    saved = await page.evaluate("JSON.parse(localStorage.getItem(BCData.saveKey)).state")
    assert not {"actionRecovery", "actionLock", "cooldowns", "classCombat", "combatFeedback"}.intersection(saved)
    await page.reload()
    await page.wait_for_function("window.BCGame && BCCore.actionReadiness && BCRender.assets.ready")
    assert await page.evaluate("BCCore.actionReadiness(BCGame.state,'lotus_veil').ready")
    await page.locator("#game").focus()
    await page.keyboard.press("2")
    assert await page.evaluate("BCGame.state.cooldowns.lotus_veil>0")
    assert not errors, errors
    result = {"nativeInput": records, "menuAndBlur": True, "actualFreezeCatchup": resumed,
              "autoBlocked": auto_blocked, "autoResumed": auto_resumed, "saveReloadClearsTransient": True,
              "pageErrors": errors}
    (output / "skill-action-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


async def main():
    from playwright.async_api import async_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8775/")
    parser.add_argument("--artifacts", default="/workspace/combat120/skill_action_ui")
    args = parser.parse_args()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        try:
            page = await browser.new_page()
            await page.goto(args.base_url)
            result = await run_checks(page, args.artifacts)
            print(json.dumps({"nativeViewports": len(result["nativeInput"]), "menuAndBlur": result["menuAndBlur"],
                              "saveReloadClearsTransient": result["saveReloadClearsTransient"], "pageErrors": result["pageErrors"]}))
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
