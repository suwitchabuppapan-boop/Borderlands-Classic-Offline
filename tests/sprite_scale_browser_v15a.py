"""Browser regression using the actual bundled asset bytes (file:// blocked in sandbox)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, json, re
import os
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
# Fall back to Playwright's bundled browser when no system Chromium is installed.
CHROMIUM=CHROMIUM if os.path.exists(CHROMIUM) else None

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'css/style.css').read_text(encoding='utf-8')
def inline_css(match):
    name=match.group(1)
    p=root/'assets/phieti'/name
    return 'url("data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()+'")' if p.is_file() else match.group(0)
css=re.sub(r'url\("\.\./assets/phieti/([^"/]+\.png)"\)', inline_css,css)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/game.js']:
    js=(root/rel).read_text(encoding='utf-8')
    if rel=='js/game.js':
        for asset in sorted((root/'assets/sprites').glob('*.png')):
            relative='assets/sprites/'+asset.name
            js=js.replace("src:'"+relative+"'","src:'data:image/png;base64,"+base64.b64encode(asset.read_bytes()).decode()+"'")
        hair=[]; sword=[]
        for i in range(19):
            hair.append('data:image/png;base64,'+base64.b64encode((root/'assets/sprites'/f'novice_ro_hair_{i:02d}.png').read_bytes()).decode())
            sword.append('data:image/png;base64,'+base64.b64encode((root/'assets/sprites'/f'swordman_ro_hair_{i:02d}.png').read_bytes()).decode())
        js='const HAIR_TEST_IMAGES='+json.dumps(hair)+';const SWORD_TEST_IMAGES='+json.dumps(sword)+';\n'+js
        dynamic="hair.src='assets/sprites/'+prefix+String(style).padStart(2,'0')+'.png';"
        assert dynamic in js
        js=js.replace(dynamic,"hair.src=key==='swordman'?SWORD_TEST_IMAGES[style]:HAIR_TEST_IMAGES[style];")
        marker='initActorVisual(s.player);'
        assert marker in js
        js=js.replace(marker,"s.player.classId='swordman';s.player.hairStyle=9;s.player.name='Swordman';s.player.x=960;s.player.y=580;"+marker,1)
        hook='''window.__scaleProbe = () => {
          const results=[];const original=g.drawImage;
          try {g.drawImage=function(...args){results.push(args.slice(1));};
            const ok=drawEntitySprite('swordman',s.player,960,580);
            return {ok,draw:results[0],smoothing:g.imageSmoothingEnabled,style:s.player.hairStyle};
          }finally {g.drawImage=original;}
        };'''
        prefix,suffix=js.rsplit('})();',1)
        js=prefix+hook+'\n})();'+suffix
    html=html.replace('<script src="'+rel+'"></script>','<script>'+js+'</script>')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1706,'height':734})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(html,wait_until='load')
    page.wait_for_function('() => window.__scaleProbe?.().ok',timeout=12000)
    result=page.evaluate('window.__scaleProbe()')
    assert result['draw'][6:8]==[96,112],result
    assert result['draw'][4]==960-48 and result['draw'][5]==580-108,result
    assert all(float(v).is_integer() for v in result['draw'][4:8]),result
    assert result['smoothing'] is False,result
    assert page.locator('#game').evaluate('(el)=>getComputedStyle(el).imageRendering')=='pixelated'
    assert result['style']==9
    page.screenshot(path='/mnt/data/Borderlands_v1_5a_preview.png',full_page=True)
    before=page.locator('#coordinates').inner_text()
    page.keyboard.down('d');page.wait_for_timeout(250);page.keyboard.up('d')
    assert page.locator('#coordinates').inner_text()!=before
    page.keyboard.press('f');page.wait_for_timeout(100)
    assert 'ACTIVE' in page.locator('#combat-mode').inner_text()
    page.keyboard.press('f')
    assert 'OFF' in page.locator('#combat-mode').inner_text()
    assert not errors,errors
    print('BROWSER SCALE PASS: native 96x112 draw, integer grounded foot anchor, smoothing off, preserved hair style, movement and Auto; 0 JS errors')
    print('OFFLINE LIMIT: direct file:// navigation blocked in this environment; local assets tested as embedded original PNG bytes')
    browser.close()
