"""Continuous real simulation through menus, blur and actual Chromium page freezing."""
import asyncio
from pathlib import Path


async def run_checks(page, artifacts=None):
    output=Path(artifacts or "/workspace/combat114/background")
    output.mkdir(parents=True,exist_ok=True)
    await page.set_viewport_size({"width":1440,"height":900})
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    await page.keyboard.press("Escape")
    # Prepare a legal strong farmer; subsequent kills use the normal engine and RNG.
    await page.evaluate("""()=>{
      const C=BCCore,s=C.createState(); C.gain(s,5000,5000);
      s.stats.str=25;s.stats.vit=18;s.stats.dex=12;
      s.player.hp=C.stats(s).maxHp;s.player.sp=C.stats(s).maxSp;
      BCGame.loadSave(C.serialize(s));
      const live=BCGame.state;Object.assign(live.player,{x:440,y:135});
      C.act(live,'auto'); C.act(live,'target',{target:live.monsters[0].uid});
      live.auto=true;window.__farmStart=live.clock;
    }""")
    intent=await page.evaluate("""()=>{const s=BCGame.state,m=s.monsters.find(m=>!m.dead);
      BCCore.act(s,'target',{target:m.uid});s.auto=true;const before=s.target;
      BCGame.openPanel('inventory');return{before,after:s.target};}""")
    assert intent["before"] and intent["after"] == intent["before"], "opening a menu must preserve the combat target"
    await page.wait_for_timeout(450)
    assert await page.evaluate("BCGame.state.clock-__farmStart") > .35, "menu must not pause simulation"
    assert await page.locator("#panel-window").is_visible()
    await page.wait_for_function("(BCGame.state.kills.poring||0)>0")
    loot=await page.evaluate("({kills:BCGame.state.kills.poring,items:BCGame.state.inventory.jellopy,silver:BCGame.state.silver})")
    assert loot["kills"]>=1 and loot["items"]>=1 and loot["silver"]>45,loot
    # Window focus is not a pause trigger; auto and click/chase intent survive.
    before=await page.evaluate("({clock:BCGame.state.clock,now:Date.now(),auto:BCGame.state.auto})")
    await page.evaluate("window.dispatchEvent(new Event('blur'))")
    await page.wait_for_timeout(450)
    after=await page.evaluate("({clock:BCGame.state.clock,now:Date.now(),auto:BCGame.state.auto})")
    assert after["clock"]-before["clock"]>.35
    assert after["auto"] is before["auto"] is True
    await page.evaluate("window.dispatchEvent(new Event('focus'))")
    await page.keyboard.press("Escape")
    # Actually freeze RAF AND background timers. On resume, elapsed wall time must be
    # reconciled; merely continuing new ticks would lag this comparison by ~0.9s.
    cdp=await page.context.new_cdp_session(page)
    start=await page.evaluate("({clock:BCGame.state.clock,wall:Date.now()})")
    await cdp.send("Page.setWebLifecycleState",{"state":"frozen"})
    await asyncio.sleep(.9)
    await cdp.send("Page.setWebLifecycleState",{"state":"active"})
    await page.wait_for_timeout(100)
    end=await page.evaluate("({clock:BCGame.state.clock,wall:Date.now()})")
    elapsed=(end["wall"]-start["wall"])/1000
    simulated=end["clock"]-start["clock"]
    assert elapsed>=.9 and abs(simulated-elapsed)<.12,(simulated,elapsed)
    await cdp.detach()
    # One clock serves RAF and interval: neither may double the same elapsed time.
    start=await page.evaluate("({clock:BCGame.state.clock,wall:Date.now()})")
    await page.wait_for_timeout(700)
    end=await page.evaluate("({clock:BCGame.state.clock,wall:Date.now()})")
    assert abs((end["clock"]-start["clock"])-(end["wall"]-start["wall"])/1000)<.1
    # Menus suppress held manual keys, not Auto Battle. No stuck movement on blur.
    await page.evaluate("BCCore.act(BCGame.state,'auto');BCGame.state.target=null;BCGame.state.destination=null;Object.assign(BCGame.state.player,{x:250,y:310})")
    await page.locator("#game").focus()
    await page.keyboard.down("d")
    await page.wait_for_timeout(120)
    await page.evaluate("window.dispatchEvent(new Event('blur'))")
    await page.keyboard.up("d")
    stopped=await page.evaluate("BCGame.state.player.x")
    await page.wait_for_timeout(200)
    assert await page.evaluate("BCGame.state.player.x") == stopped
    await page.evaluate("window.dispatchEvent(new Event('focus'))")
    # Existing save whitelist still excludes all runtime clocks and auto intent.
    save=await page.evaluate("JSON.parse(BCCore.serialize(BCGame.state)).state")
    assert "simulationClock" not in save and "auto" not in save and "combatFeedback" not in save
    await page.evaluate("BCGame.save()")
    await page.reload()
    await page.wait_for_function("window.BCGame && BCRender.assets.ready")
    assert await page.evaluate("!BCGame.state.auto && !BCGame.state.autoQuest?.active && BCGame.state.clock<1")
    # Fault injection: a denied/quota-full autosave must retain its 10s attempt
    # cadence rather than retrying serialization/storage on every RAF frame.
    await page.evaluate("""()=>{
      window.__realNow=Date.now;window.__realSetItem=Storage.prototype.setItem;
      window.__failedAutoSaves=0;
      Storage.prototype.setItem=function(key,value){if(key===BCData.saveKey){__failedAutoSaves++;throw new DOMException('full','QuotaExceededError');}return __realSetItem.call(this,key,value);};
      const future=Date.now()+11000;Date.now=()=>future;
    }""")
    await page.wait_for_timeout(250)
    failed_attempts=await page.evaluate("__failedAutoSaves")
    await page.evaluate("Date.now=__realNow;Storage.prototype.setItem=__realSetItem;BCGame.loadSave(BCCore.serialize(BCCore.createState()))")
    assert failed_attempts == 1,("failed autosave must not retry every frame",failed_attempts)
    await page.screenshot(path=str(output/"continuous-farming.png"))
    return {"menu_kills_and_loot":loot,"frozen_wall_seconds":elapsed,"replayed_simulation_seconds":simulated,
      "checks":["target retained","menu ticks and real kills/loot","blur ticks","actual page freeze catchup","no duplicate RAF/interval time","manual keys released","save/reload epoch","failed autosave cadence"]}
