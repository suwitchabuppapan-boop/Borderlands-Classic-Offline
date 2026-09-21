"""Offline Chromium integration using only inlined bytes; file:// is sandbox-blocked."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,re
import os
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
# Fall back to Playwright's bundled browser when no system Chromium is installed.
CHROMIUM=CHROMIUM if os.path.exists(CHROMIUM) else None
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'css/style.css').read_text(encoding='utf-8')
def inline_css(m):
    raw=m.group(1).strip().strip('"\'')
    if raw.startswith('../assets/'):
        asset=(root/'css'/raw).resolve()
        if asset.is_file():return 'url("data:image/png;base64,'+base64.b64encode(asset.read_bytes()).decode()+'")'
    return m.group(0)
css=re.sub(r'url\(([^)]+)\)',inline_css,css)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/game.js']:
    js=(root/rel).read_text(encoding='utf-8')
    if rel=='js/game.js':
        for asset in sorted((root/'assets/sprites').glob('*.png')):
            path='assets/sprites/'+asset.name
            js=js.replace("src:'"+path+"'","src:'data:image/png;base64,"+base64.b64encode(asset.read_bytes()).decode()+"'")
        url_data=['data:image/png;base64,'+base64.b64encode((root/'assets/sprites'/f'novice_ro_hair_{i:02d}.png').read_bytes()).decode() for i in range(19)]
        sword_data=['data:image/png;base64,'+base64.b64encode((root/'assets/sprites'/f'swordman_ro_hair_{i:02d}.png').read_bytes()).decode() for i in range(19)]
        js='const USER_RO_IMAGE_DATA='+json.dumps(url_data)+';\nconst USER_SWORD_IMAGE_DATA='+json.dumps(sword_data)+';\n'+js
        js=js.replace("hair.src='assets/sprites/'+prefix+String(style).padStart(2,'0')+'.png';","hair.src=key==='swordman'?USER_SWORD_IMAGE_DATA[style]:USER_RO_IMAGE_DATA[style];")
        # Test-only hook: the game intentionally keeps its runtime state private in an IIFE.
        hook="""window.__spriteTest={
          setSwordman(){s.player.classId='swordman';save(true)},
          spriteReady(){return Boolean(spriteImages['swordman-hair-9']?.complete&&spriteImages['swordman-hair-9']?.naturalWidth===1248)},
          spriteKey(){return playerSpriteKey()},
          canRender(){return drawEntitySprite('swordman',s.player,240,240)},
          dimensions(){const im=spriteImages['swordman-hair-9'];return [im.naturalWidth,im.naturalHeight]},
          rehydrateOK(){const loaded=hydrateWithHotbar(JSON.parse(localStorage.getItem(KEY)));return loaded.player.classId==='swordman'&&loaded.player.hairStyle===9},
          triggerAttack(){setActorState(s.player,'attack',0.4);return spriteFrame(s.player).col}
        };"""
        prefix,suffix=js.rsplit('})();',1)
        js=prefix+hook+'\n})();'+suffix
    html=html.replace('<script src="'+rel+'"></script>','<script>'+js+'</script>')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1706,'height':896},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    # about:blank has no native localStorage; emulate its synchronous API strictly
    # for this sandbox-only UI integration test. Native file:// persistence remains unverified.
    page.evaluate("""() => {
        const memory={};
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem(k){return Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null},
            setItem(k,v){memory[k]=String(v)},removeItem(k){delete memory[k]}
        }});
    }""")
    page.set_content(html,wait_until='load')
    page.wait_for_timeout(600)
    assert 'Novice' in page.locator('#job-level').inner_text()
    page.evaluate("document.querySelector('[data-tab=settings]').click()")
    sel=page.locator('[data-setting="hairStyle"]')
    assert sel.locator('option').count()==19
    sel.select_option('9')
    page.wait_for_timeout(350)
    assert page.evaluate("JSON.parse(localStorage.getItem('borderlands-solo-save-v2')).player.hairStyle")==9
    # Exact image bytes in the browser; not a pathname-only test.
    dimensions=page.evaluate("() => new Promise(resolve=>{let im=new Image();im.onload=()=>resolve([im.naturalWidth,im.naturalHeight]);im.onerror=()=>resolve(null);im.src=USER_RO_IMAGE_DATA[9];})")
    assert dimensions==[832,448],dimensions
    saved=page.evaluate("localStorage.getItem('borderlands-solo-save-v2')")
    page.close()
    page=browser.new_page(viewport={'width':1706,'height':896},accept_downloads=True)
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.evaluate("""(saved) => {
        const memory={'borderlands-solo-save-v2':saved};
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem(k){return Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null},
            setItem(k,v){memory[k]=String(v)},removeItem(k){delete memory[k]}
        }});
    }""",saved)
    page.set_content(html,wait_until='load');page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-tab=settings]').click()")
    assert page.locator('[data-setting="hairStyle"]').input_value()=='9'
    # The same hair selection must also be applied after changing into Swordman.
    page.evaluate("() => window.__spriteTest.setSwordman()")
    page.wait_for_function("() => window.__spriteTest.spriteReady()")
    assert page.evaluate("window.__spriteTest.spriteKey()")=='swordman'
    assert page.evaluate("window.__spriteTest.canRender()") is True
    assert page.evaluate("window.__spriteTest.dimensions()")==[1248,448]
    assert page.evaluate("() => window.__spriteTest.rehydrateOK()")
    assert page.evaluate("() => window.__spriteTest.triggerAttack()") in (6,7,8)
    page.evaluate("document.querySelector('[data-act=closepanel]').click()")
    before=page.locator('#coordinates').inner_text()
    page.keyboard.down('d');page.wait_for_timeout(300);page.keyboard.up('d')
    assert page.locator('#coordinates').inner_text()!=before
    assert not errors,errors
    page.screenshot(path=str(root/'preview_user_novice.png'),full_page=True)
    print('OFFLINE_RENDER_PASS: 19 hairstyle atlases loaded from bundled local bytes in Chromium')
    print('BROWSER_PASS: Novice + Swordman hair picker, save/reload, attack frames, movement, zero JavaScript errors')
    print('FILE_URL_LIMITATION: file:// navigation blocked by sandbox; Windows double-click not verified')
    browser.close()
