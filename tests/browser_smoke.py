"""Self-contained Chromium smoke: load file:// game bytes through set_content when local URLs are blocked by test sandbox."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+ (root/'css/style.css').read_text(encoding='utf-8')+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/game.js']:
 html=html.replace('<script src="'+rel+'"></script>','<script>'+(root/rel).read_text(encoding='utf-8')+'</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html,wait_until='load');page.wait_for_timeout(600)
 assert 'Status' in page.locator('#side-panel').inner_text()
 assert 'CLASSIC' in page.locator('#zone-label').inner_text()
 assert 'Novice' in page.locator('#job-level').inner_text()
 assert page.locator('#game').evaluate('(e)=>e.width')==960
 page.locator('button[data-tab="codex"]').click()
 assert 'ยังไม่ได้ Import API' in page.locator('#side-panel').inner_text()
 page.evaluate('''() => { window.BorderDivinePrideCache = {schema:1,region:'thROC',fetchedAt:'2026-09-18T06:00:00Z',monsters:{'1002':{id:1002,name:'Poring',health:60,level:1,def:0}},items:{'501':{id:501,name:'Red Potion',buyPrice:50}},skills:{'7':{id:7,name:'Magnum Break',maxLevel:10}}}; document.querySelector('[data-tab=status]').click(); document.querySelector('[data-tab=codex]').click(); }''')
 assert 'HP 60' in page.locator('#side-panel').inner_text()
 assert 'HP 50' in page.locator('#side-panel').inner_text()
 assert 'ไม่ได้แทนที่' in page.locator('#side-panel').inner_text()
 page.locator('button[data-tab="status"]').first.click()
 page.screenshot(path=str(root/'preview.png'),full_page=True)
 a=page.locator('#coordinates').inner_text()
 page.keyboard.down('d');page.wait_for_timeout(400);page.keyboard.up('d')
 assert a!=page.locator('#coordinates').inner_text(),(a,page.locator('#coordinates').inner_text())
 page.keyboard.press('f');page.wait_for_timeout(230)
 assert 'ACTIVE' in page.locator('#combat-mode').inner_text()
 page.keyboard.press('f')
 assert 'MANUAL' in page.locator('#combat-mode').inner_text()
 page.locator('button[data-tab="skills"]').click()
 assert 'Swordman' in page.locator('#side-panel').inner_text()
 page.locator('button[data-tab="inventory"]').click()
 assert 'HP Potion' in page.locator('#side-panel').inner_text()
 page.locator('button[data-tab="shop"]').click()
 before=int(page.locator('#silver').inner_text().replace(',',''))
 page.locator('button[data-buy="potion"]').click()
 assert int(page.locator('#silver').inner_text().replace(',',''))==before-18
 page.locator('button[data-tab="settings"]').first.click()
 with page.expect_download() as dl:page.locator('button[data-act="export"]').click()
 assert dl.value.suggested_filename.endswith('.json')
 # Reload a test-only game with a Novice at job 10; no changes to packaged files.
 stamp='let s;try{const current=localStorage.getItem(KEY),legacy=!current?localStorage.getItem(\'borderlands-solo-save-v1\'):null;s=C.hydrate(current||legacy);if(legacy)localStorage.setItem(KEY,JSON.stringify(s));}catch(_){s=C.newGame();}'
 seed="let s=C.newGame();s.player.jobLv=10;s.player.jobExpNext=0;s.player.jobExp=0;"
 assert stamp in html
 page.close();page=browser.new_page(viewport={'width':1600,'height':1000});page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html.replace(stamp,seed),wait_until='load');page.wait_for_timeout(250)
 page.locator('button[data-tab="skills"]').click()
 page.locator('button[data-act="jobchange"]').click()
 assert 'Swordman' in page.locator('#job-level').inner_text(),page.locator('#system-message').inner_text()
 # separate seeded Swordman state validates learn skill UI
 seed2="let s=C.newGame();s.player.classId='swordman';s.player.name='Swordman';s.player.jobLv=4;s.player.jobExpNext=76;s.player.skillPoints=3;"
 page.close();page=browser.new_page(viewport={'width':1600,'height':1000});page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html.replace(stamp,seed2),wait_until='load');page.wait_for_timeout(210)
 page.locator('button[data-tab="skills"]').click()
 page.locator('button[data-learn="bash"]').click()
 assert 'Lv.1' in page.locator('[data-skill="2"] small').inner_text()
 print('BROWSER PASS: launch/draw, optional Codex cache, movement, auto, inventory/shop, export, Job Change, learned Bash')
 print('Browser page errors:',errors)
 assert not errors,errors
 browser.close()
