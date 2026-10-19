"""Browser regression using actual game actions. Reusable against local or verified public bytes."""
import argparse
import asyncio
from pathlib import Path


async def run_checks(page, artifacts=None):
    output = Path(artifacts or "/workspace/combat-fx-work")
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.set_viewport_size({"width": 1440, "height": 1000})
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    await page.evaluate("localStorage.clear()")
    await page.reload()
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    assert await page.locator("#release-label").inner_text() == "รุ่น 1.14"
    assert await page.evaluate("Object.keys(BCData.items).length") == 61
    assert await page.locator(".menu-grid [data-panel]").count() == 9
    menus = await page.locator(".menu-grid [data-panel]").evaluate_all("els=>els.map(e=>e.dataset.panel)")
    for name in menus:
        await page.locator(f'.menu-grid [data-panel="{name}"]').click()
        assert await page.locator("#panel-window").is_visible()
        assert await page.locator("#side-panel").inner_text()
        await page.keyboard.press("Escape")
        assert await page.locator("#panel-window").is_hidden()
    # A real movement key advances the player through the normal RAF simulation.
    before = await page.evaluate("BCGame.state.player.x")
    await page.locator("#game").focus()
    await page.keyboard.down("d")
    await page.wait_for_function("x=>BCGame.state.player.x>x+5", arg=before)
    await page.keyboard.up("d")

    # Buy, equip and sell through the actual dialog click handlers, near the merchant.
    await page.evaluate("Object.assign(BCGame.state.player,{x:170,y:365})")
    await page.locator('.menu-grid [data-panel="shop"]').click()
    await page.locator('[data-act="buy"][data-id="potion"]').click()
    assert await page.evaluate("BCGame.state.silver===33 && BCGame.state.inventory.potion===6")
    await page.keyboard.press("Escape")
    await page.locator('.menu-grid [data-panel="inventory"]').click()
    await page.locator('[data-choose-item="novice_cap"]').click()
    await page.locator('[data-act="equip"][data-id="novice_cap"]').click()
    assert await page.evaluate("BCGame.state.equipment.head==='novice_cap'")
    await page.locator('[data-choose-item="potion"]').click()
    await page.locator('[data-act="sell"][data-id="potion"]').click()
    assert await page.evaluate("BCGame.state.silver===39 && BCGame.state.inventory.potion===5")
    await page.keyboard.press("Escape")
    await page.locator('#save-button').click()
    await page.reload()
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    assert await page.evaluate("BCGame.state.silver===39 && BCGame.state.inventory.potion===5 && BCGame.state.equipment.head==='novice_cap'")

    # Existing world and sprite assets must load using actual Image decoding.
    images = await page.evaluate("BCRender.assets.loaded")
    assert images == 27, images
    assert await page.evaluate("BCRender.assets.total===27 && BCRender.assets.failed.length===0")

    # Prepared route: setup uses earned EXP, paid stat points and shop/core actions.
    # Automation itself gets no fabricated kills, teleports, drops or healing.
    route = await page.evaluate(r'''()=>{
      const C=BCCore,D=BCData,s=C.createState();
      const at=id=>Object.assign(s.player,D.npcs.find(n=>n.id===id));
      const act=(a,p)=>{const r=C.act(s,a,p);if(!r.ok)throw Error(a+': '+r.message);};
      C.gain(s,5000,5000);at('merchant');act('buy',{id:'arun_sword'});at('guide');act('class',{id:'swordsman'});
      for(const [id,max] of Object.entries({str:25,vit:18,dex:12,agi:8}))while(s.stats[id]<max)act('stat',{id});
      at('healer');act('heal');BCGame.loadSave(C.serialize(s));const live=BCGame.state;
      C.act(live,'auto-quest');const portals=[];let previous=live.zone,ticks=0;
      for(;ticks<18000&&live.autoQuest.active;ticks++){
        C.tick(live,.1);if(live.zone!==previous){portals.push([previous,live.zone]);previous=live.zone;}
      }
      BCGame.save();return {quest:live.quest,phase:live.autoQuest.phase,kills:live.kills,
        loot:{jellopy:live.inventory.jellopy,root:live.inventory.tree_root,core:live.inventory.guardian_core,circlet:live.inventory.silver_circlet},
        portals,ticks,guideDistance:C.dist(live.player,D.npcs.find(n=>n.id==='guide'))};
    }''')
    assert route["phase"] == "complete", route
    assert route["quest"] == 3 and route["guideDistance"] < 85, route
    assert route["kills"]["poring"] >= 5 and route["kills"]["willow"] >= 5 and route["kills"]["guardian"] == 1
    assert route["portals"] == [[0,1],[1,0],[0,1],[1,2],[2,1],[1,0]]
    assert route["loot"]["jellopy"] >= 5 and route["loot"]["root"] >= 5
    assert route["loot"]["core"] == 1 and route["loot"]["circlet"] >= 1
    await page.reload()
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    assert await page.evaluate("BCGame.state.quest===3 && !BCGame.state.autoQuest?.active && !BCGame.state.combatFeedback?.events.length")

    # Compact desktop/mobile gameplay frames, with no horizontal page overflow.
    for width, height in [(1440,1000),(390,844)]:
        await page.set_viewport_size({"width":width,"height":height})
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(120)
        assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        await page.screenshot(path=str(output/f"gameplay-{width}.png"),full_page=True)
    assert not errors, errors
    return {"menus":len(menus),"decoded_images":images,"merchant_save":True,"auto_quest":route,"page_errors":errors}


async def main():
    from playwright.async_api import async_playwright
    parser=argparse.ArgumentParser()
    parser.add_argument("--base-url",default="http://127.0.0.1:8765/")
    parser.add_argument("--artifacts",default="/workspace/combat-fx-work")
    args=parser.parse_args()
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path="/usr/bin/chromium",headless=True,args=["--no-sandbox"])
        page=await browser.new_page()
        await page.goto(args.base_url)
        print(await run_checks(page,args.artifacts))
        await browser.close()


if __name__=="__main__":
    asyncio.run(main())
