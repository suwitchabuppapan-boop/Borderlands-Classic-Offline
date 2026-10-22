"""Bulk merchant controls and carried-weight acceptance using the actual game UI."""
import json
from pathlib import Path


def run_checks(page, output_dir="/workspace/trade119/browser"):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    page.wait_for_function("window.BCGame && window.BCCore && window.BCData && BCRender.assets.ready")
    page.set_viewport_size({"width": 1440, "height": 900})
    fixture = r"""() => {
      window.tradeFixture = (options={}) => {
        const C=BCCore,D=BCData,s=C.createState();
        s.silver=options.silver??5000;
        if(options.inventory)s.inventory={...options.inventory};
        if(options.emptyEquipment)s.equipment={weapon:null,armor:null,head:null,accessory:null};
        Object.assign(s.player,D.npcs.find(n=>n.id==='merchant'));
        if(options.far)s.player.x=650;
        const st=C.stats(s);s.player.hp=st.maxHp;s.player.sp=st.maxSp;
        BCGame.loadSave(C.serialize(s));BCGame.openPanel(options.panel||'shop');
      };
      window.tradeEconomic = () => {
        const s=BCGame.state,st=BCCore.stats(s);
        return {silver:s.silver,inventory:{...s.inventory},equipment:{...s.equipment},weight:st.weight,capacity:st.capacity,seed:s.seed};
      };
      window.tradeQuoteNumbers = element => [...element.textContent.replaceAll(',','').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
    }"""
    page.evaluate(fixture)
    screenshots = []
    checks = []

    def setup(**options):
        page.evaluate("options=>tradeFixture(options)", options)

    def control(mode, item):
        return page.locator(f'.trade-controls[data-trade-mode="{mode}"][data-trade-id="{item}"]')

    def quantity(mode, item):
        return control(mode, item).locator('input[data-trade-qty]')

    def action(mode, item):
        return page.locator(f'[data-act="{mode}"][data-id="{item}"]')

    def economic():
        return page.evaluate("tradeEconomic()")

    def owned(item):
        return page.evaluate("id=>BCGame.state.inventory[id]||0", item)

    def pick(item):
        page.locator(f'[data-choose-item="{item}"]').click()

    def assert_preview(mode, item, amount):
        expected = page.evaluate("""({mode,id,amount})=>{
          const s=BCGame.state,st=BCCore.stats(s),I=BCItemRules;
          const price=mode==='buy'?I.buyPrice(id):I.sellPrice(id),delta=BCData.items[id].weight*amount*(mode==='buy'?1:-1);
          return {total:price*amount,weight:st.weight+delta};
        }""", {"mode": mode, "id": item, "amount": amount})
        totals = control(mode, item).locator('[data-trade-total]').evaluate("tradeQuoteNumbers")
        weights = control(mode, item).locator('[data-trade-weight]').evaluate("tradeQuoteNumbers")
        assert expected["total"] in totals, (mode, item, expected, totals)
        assert expected["weight"] in weights, (mode, item, expected, weights)

    # Quantity inputs preview real unit-price totals and resulting carried weight.
    setup()
    assert quantity("buy", "potion").input_value() == "1"
    price = page.evaluate("BCItemRules.buyPrice('potion')")
    before = economic()
    assert control("buy", "potion").locator('[data-trade-adjust="-1"]').is_disabled()
    control("buy", "potion").locator('[data-trade-adjust="1"]').click()
    assert quantity("buy", "potion").input_value() == "2"
    control("buy", "potion").locator('[data-trade-adjust="-1"]').click()
    assert quantity("buy", "potion").input_value() == "1" and economic() == before
    for amount in (3, 7):
        field = quantity("buy", "potion")
        field.scroll_into_view_if_needed()
        scroll = page.locator('#panel-window').evaluate("el=>el.scrollTop")
        field.fill(str(amount))
        assert field.input_value() == str(amount)
        assert field.evaluate("el=>el===document.activeElement"), "Typing must retain the actual input focus"
        assert abs(page.locator('#panel-window').evaluate("el=>el.scrollTop")-scroll) < 2
        assert_preview("buy", "potion", amount)
        assert economic() == before, "Quantity preview must not move coins/items/weight/RNG"
        action("buy", "potion").click()
        after = economic()
        assert after["silver"] == before["silver"]-price*amount
        assert after["inventory"]["potion"] == before["inventory"]["potion"]+amount
        assert after["weight"] == before["weight"]+page.evaluate("BCData.items.potion.weight")*amount
        before = after
    checks.append("native bulk purchases 3 and 7; exact price/weight; stable typing and preview")

    # Blank, decimal, negative, zero and over-limit requests are never changed to 1.
    for raw in ("", "0", "-2", "1.5", "1000"):
        setup()
        field=quantity("buy", "potion");before=economic();field.fill(raw)
        assert field.input_value() == raw, (raw, field.input_value())
        assert action("buy", "potion").is_disabled(), raw
        action("buy", "potion").dispatch_event("click")
        assert economic() == before, "Invalid quantity must not fall back to a single-item trade"
    checks.append("invalid/empty quantities disabled and atomic, no coercion")

    # MAX uses available money, current weight room and stack constraints.
    setup(silver=price*2+1)
    control("buy", "potion").locator('[data-trade-max]').click()
    assert quantity("buy", "potion").input_value() == "2"
    assert_preview("buy", "potion", 2)
    action("buy", "potion").click()
    assert page.evaluate("BCGame.state.silver") == 1
    assert owned("potion") == 7
    assert action("buy", "potion").is_disabled()

    page.evaluate("""() => {
      const C=BCCore,D=BCData,s=C.createState();
      s.silver=999999;s.equipment={weapon:null,armor:null,head:null,accessory:null};
      const cap=C.stats(s).capacity;
      s.inventory={jellopy:Math.floor((cap-D.items.potion.weight*2-1)/D.items.jellopy.weight)};
      Object.assign(s.player,D.npcs.find(n=>n.id==='merchant'));
      BCGame.loadSave(C.serialize(s));BCGame.openPanel('shop');
    }""")
    room = page.evaluate("Math.floor((BCCore.stats(BCGame.state).capacity-BCCore.stats(BCGame.state).weight)/BCData.items.potion.weight)")
    assert 1 <= room < 999, room
    control("buy", "potion").locator('[data-trade-max]').click()
    assert quantity("buy", "potion").input_value() == str(room)
    before=economic();quantity("buy", "potion").fill(str(room+1))
    assert action("buy", "potion").is_disabled()
    action("buy", "potion").dispatch_event("click");assert economic()==before
    quantity("buy", "potion").fill(str(room));action("buy", "potion").click()
    assert owned("potion")==room
    assert economic()["weight"] <= economic()["capacity"]
    setup(silver=1000000,inventory={"potion":100000})
    assert action("buy", "potion").is_disabled()
    before=economic();action("buy", "potion").dispatch_event("click");assert economic()==before
    checks.append("MAX purchase money/weight limits and full-stack rejection")

    # Selling can dispose of a large real stack, not only the old 999-item limit.
    setup(panel="inventory", inventory={"potion":30,"jellopy":1001,"novice_cap":1})
    pick("potion");quantity("sell", "potion").fill("7");assert_preview("sell", "potion", 7)
    before=economic();sale=page.evaluate("BCItemRules.sellPrice('potion')")
    action("sell", "potion").click()
    assert owned("potion")==23 and economic()["silver"]==before["silver"]+7*sale
    pick("jellopy");control("sell", "jellopy").locator('[data-trade-max]').click()
    assert quantity("sell", "jellopy").input_value()=="1001"
    assert_preview("sell", "jellopy", 1001)
    before=economic();sale=page.evaluate("BCItemRules.sellPrice('jellopy')")
    action("sell", "jellopy").click()
    assert owned("jellopy")==0 and economic()["silver"]==before["silver"]+1001*sale
    assert economic()["weight"]==before["weight"]-1001*page.evaluate("BCData.items.jellopy.weight")
    checks.append("partial sale and whole 1,001-item stack with exact coins/weight")

    # MAX sale honors the currency ceiling, and equipped copies cannot be sold.
    sale=page.evaluate("BCItemRules.sellPrice('potion')")
    setup(panel="inventory",silver=100000000-sale*3,inventory={"potion":1000,"novice_cap":1})
    pick("potion");control("sell", "potion").locator('[data-trade-max]').click()
    assert quantity("sell", "potion").input_value()=="3"
    action("sell", "potion").click()
    assert economic()["silver"]==100000000 and owned("potion")==997
    assert action("sell", "potion").is_disabled()
    setup(panel="inventory",inventory={"novice_cap":1,"potion":5})
    pick("novice_cap");before=economic();action("equip", "novice_cap").click()
    after=economic();assert after["weight"]==before["weight"] and after["equipment"]["head"]=="novice_cap"
    assert owned("novice_cap")==0
    result=page.evaluate("BCCore.act(BCGame.state,'sell',{id:'novice_cap',qty:1})")
    assert not result["ok"] and economic()==after
    checks.append("currency ceiling, inventory-only sales and equip weight conservation")

    # A valid-looking form cannot spend changed resources or sell missing stock.
    setup();quantity("buy", "potion").fill("3")
    page.evaluate("BCGame.state.silver=0");before=economic()
    action("buy", "potion").dispatch_event("click");assert economic()==before
    setup(panel="inventory",inventory={"potion":10});pick("potion");quantity("sell", "potion").fill("4")
    page.evaluate("BCGame.state.inventory.potion=2");before=economic()
    action("sell", "potion").dispatch_event("click");assert economic()==before
    setup(far=True);assert action("buy", "potion").is_disabled()
    setup(panel="inventory",far=True,inventory={"potion":10});pick("potion")
    assert action("sell", "potion").is_disabled()
    checks.append("changed funds/stock and merchant distance revalidated atomically")

    # Bag overview explains total weight and the heaviest stacks without a fake slot cap.
    setup(panel="inventory",inventory={"jellopy":100,"potion":4,"novice_cap":1})
    summary=page.locator('.inventory-weight-summary')
    st=economic();numbers=summary.evaluate("tradeQuoteNumbers")
    assert st["weight"] in numbers and st["capacity"] in numbers and '%' in summary.inner_text()
    heavy=page.locator('.inventory-heavy-list').inner_text()
    assert page.evaluate("BCData.items.jellopy.name") in heavy
    stack_weight=page.evaluate("BCData.items.jellopy.weight*100")
    assert '100' in heavy and str(stack_weight) in heavy.replace(',','')
    checks.append("actual bag totals, percent and heavy-stack breakdown")

    # Weapon filtering, quantity focus, and mobile/desktop dialog bounds remain usable.
    setup(silver=100000)
    page.locator('#shop-weapon-type').select_option('bow')
    bow=page.evaluate("Object.keys(BCData.items).find(id=>BCData.items[id].weaponType==='bow'&&BCItemRules.buyPrice(id)!==null)")
    quantity("buy",bow).fill('2')
    assert quantity("buy",bow).evaluate("el=>el===document.activeElement")
    assert page.locator('#shop-weapon-type').input_value()=='bow'
    action("buy",bow).click()
    assert page.locator('#shop-weapon-type').input_value()=='bow'
    for width,height in [(1440,900),(390,844)]:
        page.set_viewport_size({"width":width,"height":height})
        setup(silver=5000)
        quantity("buy","potion").fill('7');assert_preview("buy","potion",7)
        assert quantity("buy","potion").evaluate("el=>el===document.activeElement")
        bounds=page.locator('#panel-window').evaluate("el=>{const r=el.getBoundingClientRect();return{x:r.x,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth}}")
        assert bounds['x']>=0 and bounds['right']<=width and bounds['top']>=0 and bounds['bottom']<=height
        assert bounds['scroll']<=bounds['client'],bounds
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        quantity("buy","potion").scroll_into_view_if_needed()
        image=output/f'trade-buy-{width}.png';page.screenshot(path=str(image));screenshots.append(str(image))
        setup(panel="inventory",inventory={"potion":30,"jellopy":1001,"novice_cap":1})
        pick("jellopy");control("sell","jellopy").locator('[data-trade-max]').click()
        assert quantity("sell","jellopy").input_value()=='1001'
        image=output/f'trade-sell-{width}.png';page.screenshot(path=str(image));screenshots.append(str(image))
    checks.append("weapon filter, native typing/focus and 1440/390 layouts")

    # Real Auto farming continues with the bag open; live totals follow the actual drop.
    page.set_viewport_size({"width":1440,"height":900})
    start=page.evaluate("""() => {
      const C=BCCore,D=BCData,s=C.createState(),at=id=>Object.assign(s.player,D.npcs.find(n=>n.id===id));
      C.gain(s,5000,5000);at('merchant');C.act(s,'buy',{id:'arun_sword'});at('guide');C.act(s,'class',{id:'swordsman'});
      for(const [id,max]of Object.entries({str:30,vit:18,dex:12,agi:8}))while(s.stats[id]<max){if(!C.act(s,'stat',{id}).ok)break;}
      at('healer');C.act(s,'heal');s.player.x=430;s.player.y=135;s.settings.autoPotion=0;s.settings.autoSkill=false;
      BCGame.loadSave(C.serialize(s));const live=BCGame.state;C.act(live,'auto');BCGame.openPanel('inventory');
      return {kills:live.kills.poring||0,weight:C.stats(live).weight};
    }""")
    page.wait_for_function("n=>(BCGame.state.kills.poring||0)>n",arg=start['kills'],timeout=20000)
    page.wait_for_function("""() => {
      const el=document.querySelector('.inventory-weight-summary'),footer=document.querySelector('[data-bag-footer-weight]'),money=document.querySelector('[data-bag-footer-money]');
      if(!el||!footer||!money)return false;
      const values=tradeQuoteNumbers(el),weights=tradeQuoteNumbers(footer),coins=tradeQuoteNumbers(money),s=BCGame.state,st=BCCore.stats(s);
      return values.includes(st.weight)&&values.includes(st.capacity)&&weights.includes(st.weight)&&weights.includes(st.capacity)&&coins.includes(s.silver);
    }""")
    assert page.locator('#panel-window').is_visible() and page.evaluate('BCGame.state.auto')
    checks.append("real Auto kill and live summary/footer weight and coins while inventory remains open")

    # The existing save format preserves completed bulk transactions.
    setup(panel="inventory",inventory={"potion":20,"jellopy":17})
    pick("potion");quantity("sell","potion").fill('7');action("sell","potion").click()
    expected=economic();page.evaluate("BCGame.save()")
    page.reload();page.wait_for_function("window.BCGame && BCRender.assets.ready")
    actual=page.evaluate("({silver:BCGame.state.silver,inventory:{...BCGame.state.inventory},weight:BCCore.stats(BCGame.state).weight})")
    assert actual['silver']==expected['silver'] and actual['inventory']==expected['inventory'] and actual['weight']==expected['weight']
    assert not page.evaluate('BCGame.state.auto')
    checks.append("completed bulk trades survive save/reload without restarting Auto")
    result={"checks":checks,"screenshots":screenshots,"quantity_limits":{"buy":999,"sell":100000},"saved_trade":actual}
    (output/'trade-browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    return result
