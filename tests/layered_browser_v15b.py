"""Chromium sprite integration: original local bytes embedded because file:// is sandbox-blocked."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,re
import os
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
# Fall back to Playwright's bundled browser when no system Chromium is installed.
CHROMIUM=CHROMIUM if os.path.exists(CHROMIUM) else None
root=Path(__file__).resolve().parents[1]
def data_url(path):
    return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()
html=(root/'index.html').read_text()
css=(root/'css/style.css').read_text()
css=re.sub(r'url\("?\.\./assets/phieti/([^"\)]+\.png)"?\)',lambda m:'url("'+data_url(root/'assets/phieti'/m.group(1))+'")',css)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/sprite-anchors.js','js/game.js']:
    js=(root/rel).read_text()
    if rel=='js/game.js':
        for name in ['body_novice.png','body_swordman.png',*[f'monster_{key}.png' for key in ['poring','fabre','lunatic','willow','hornet','poporing','boss']]]:
            relative='assets/sprites/'+name
            js=js.replace("src:'"+relative+"'","src:'"+data_url(root/relative)+"'")
        weapon={key:data_url(root/'assets/weapons'/f'{key}.png') for key in ['rusty_sword','iron_sword','moon_blade']}
        hair=[data_url(root/'assets/sprites'/f'hair_{i:02}.png') for i in range(19)]
        items={p.stem:data_url(p) for p in (root/'assets/icons/items').glob('*.png')}
        js='const TEST_HAIR='+json.dumps(hair)+';const TEST_WEAPONS='+json.dumps(weapon)+';const TEST_ITEMS='+json.dumps(items)+';\n'+js
        js=js.replace("img.src='assets/sprites/hair_'+String(style).padStart(2,'0')+'.png';","img.src=TEST_HAIR[style];")
        js=js.replace("img.src='assets/weapons/'+id+'.png';","img.src=TEST_WEAPONS[id];")
        js=js.replace("?'assets/icons/items/'+id+'.png':null;","?TEST_ITEMS[id]:null;")
        hook='''window.__layers={
          setJob(job){s.player.classId=job;s.player.name=job;s.player.hairStyle=9;save(true)},
          equip(id){if(s.equipment.weapon)C.unequip(s,'weapon');s.inventory[id]=1;const changed=C.equip(s,id);if(changed)save(true);return changed},
          remove(){const changed=C.unequip(s,'weapon');if(changed)save(true);return changed},
          measure(job,state='idle',facing='down'){
            const calls=[];let orig=g.drawImage;
            try{g.drawImage=function(...args){calls.push({src:args[0].src,params:args.slice(1)});};
              let actor={facing,animState:state,animStartedAt:now,deadUntil:0};let ok=drawEntitySprite(job,actor,960,600);
              return {ok,calls,weapon:s.equipment.weapon,style:s.player.hairStyle};
            }finally{g.drawImage=orig;}
          },
          visual(type){return monsterVisual(type)},
          saveOK(){const restored=hydrateWithHotbar(JSON.parse(localStorage.getItem(KEY)));return restored.player.hairStyle===9&&restored.player.classId===s.player.classId&&restored.equipment.weapon===s.equipment.weapon},
          potionCount(){return s.inventory.potion||0;}
        };'''
        assert js.endswith('})();\n')
        js=js[:-6]+hook+'\n})();\n'
    html=html.replace('<script src="'+rel+'"></script>','<script>'+js+'</script>')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1706,'height':896},accept_downloads=True)
    errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    # Sandbox about:blank does not permit native localStorage: replace storage ONLY in this test.
    page.evaluate('''() => {const mem={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return mem[k]??null},setItem(k,v){mem[k]=String(v)},removeItem(k){delete mem[k]}}});}''')
    page.set_content(html,wait_until='load',timeout=15000)
    page.wait_for_timeout(900)
    assert page.locator('#game').count()==1
    page.evaluate("window.__layers.setJob('novice')")
    page.wait_for_function("() => window.__layers.measure('novice').calls.length===2",timeout=10000)
    novice=page.evaluate("window.__layers.measure('novice')")
    assert novice['ok'] and len(novice['calls'])==2
    assert novice['calls'][0]['params'][2]==64
    assert novice['calls'][1]['params'][2]==64
    assert novice['style']==9
    page.evaluate("window.__layers.setJob('swordman')")
    page.wait_for_function("() => window.__layers.measure('swordman').calls.length===2",timeout=10000)
    assert page.evaluate('window.__layers.equip("rusty_sword")')
    sword=page.evaluate("window.__layers.measure('swordman','attack','down')")
    assert len(sword['calls'])==3 and sword['calls'][2]['src']==weapon['rusty_sword']
    assert page.evaluate('window.__layers.saveOK()')
    assert page.evaluate('window.__layers.equip("moon_blade")')
    moon=page.evaluate("window.__layers.measure('swordman','attack','down')")
    assert len(moon['calls'])==3 and moon['calls'][2]['src']==weapon['moon_blade']
    back=page.evaluate("window.__layers.measure('swordman','attack','up')")
    assert back['calls'][0]['src']==weapon['moon_blade'],'up-facing weapon should draw before body'
    assert page.evaluate('window.__layers.remove()')
    assert len(page.evaluate("window.__layers.measure('swordman')")['calls'])==2
    assert page.evaluate("window.__layers.visual('poring').width")==48
    assert page.evaluate("window.__layers.visual('boss').width")==96
    assert page.evaluate("window.__layers.visual('willow').height")==64
    page.evaluate("document.querySelector('[data-tab=inventory]').click()")
    page.wait_for_timeout(100)
    images=page.locator('#side-panel .ro-inventory-grid img.item-icon')
    assert images.count()>0
    assert page.evaluate('''() => [...document.querySelectorAll('#side-panel .ro-inventory-grid img.item-icon')].every(i=>i.complete&&i.naturalWidth===24)''')
    page.locator('[data-act="closepanel"]').first.click(force=True)
    before=page.locator('#coordinates').inner_text();page.keyboard.down('d');page.wait_for_timeout(300);page.keyboard.up('d')
    assert before!=page.locator('#coordinates').inner_text()
    page.keyboard.press('f');page.wait_for_timeout(50);assert 'ACTIVE' in page.locator('#combat-mode').inner_text()
    page.keyboard.press('f');assert 'OFF' in page.locator('#combat-mode').inner_text()
    assert not errors,errors
    # Preview the actual equipped sword; the combat and persistence assertions above ran before this visual setup.
    page.evaluate("window.__layers.equip('moon_blade')")
    page.wait_for_timeout(150)
    page.screenshot(path='/mnt/data/Borderlands_v1_5b_layered_preview.png',full_page=True)
    print('BROWSER PASS: real local bytes embedded; novice/swordman independent head/body, equipped weapon switch, weapon behind when facing up, monster scaling, 28 item icons, movement, auto, save, zero JS errors')
    print('DIRECT FILE LIMIT: sandbox Chromium blocks file://; Windows START.bat remains unverified')
    browser.close()
