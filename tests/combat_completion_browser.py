"""End-to-end inline/offline-rendered checks for new weight, status, potion, skill and save paths."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, re
R=Path(__file__).resolve().parents[1]
html=(R/'index.html').read_text(encoding='utf8')
css=(R/'css/style.css').read_text(encoding='utf8')
css=re.sub(r'url\("\.\./assets/phieti/([^"/]+\.png)"\)',lambda m:'url("data:image/png;base64,'+base64.b64encode((R/'assets/phieti'/m.group(1)).read_bytes()).decode()+'")',css)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/game.js']:
    js=(R/rel).read_text(encoding='utf8')
    if rel=='js/game.js':
        marker="function strikeMonster(m,options={},color="
        assert marker in js
        probe='''window.__completionProbe={
          statusAndPotion(){s.player.hp=30;C.applyStatus(s,'poison',30);C.addItem(s,'green_potion',1);s.hotbar[8]={type:'item',id:'green_potion'};const before=s.inventory.green_potion;useHotbar(9);return {before,after:s.inventory.green_potion||0,cured:!C.activeStatus(s,'poison'),hotbar:s.hotbar[8]};},
          overweight(){s.inventory.potion=9999;refresh();return {capacity:C.weightStatus(s).capacity,weight:C.weightStatus(s).weight,canAttack:attack(),canSkill:skill(1),hud:document.getElementById('weight-val').textContent};},
          saveRoundTrip(){s.inventory={};s.statuses={};C.applyStatus(s,'blind',35);s.hotbar[8]={type:'skill',id:'first_aid'};const copy=hydrateWithHotbar(JSON.stringify(s));return {potion:copy.inventory.potion||0,ether:copy.inventory.ether||0,blind:C.activeStatus(copy,'blind'),slot:copy.hotbar[8]};},
          magnum(){s.inventory={};s.player.classId='swordman';s.player.hp=C.stats(s).maxHp;s.player.sp=100;s.skills.bash=5;s.skills.magnum_break=1;cool[3]=0;cool.attack=0;let m=mobs[0];m.alive=true;m.hp=m.maxHp;m.x=s.player.x+40;m.y=s.player.y+10;target=m;const hp=s.player.hp,sp=s.player.sp;const result=skill(3);return {result,costHp:hp-s.player.hp,costSp:sp-s.player.sp,fireBuff:fireBuffUntil-now,delay:cool.attack,remaining:m.hp};}
        };\n'''
        js=js.replace(marker,probe+marker,1)
    html=html.replace('<script src="'+rel+'"></script>','<script>'+js+'</script>')
html=html.replace('<body>','<body><script>window.requestAnimationFrame=()=>0;</script>')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    r=page.evaluate('window.__completionProbe.statusAndPotion()')
    assert r['before']==1 and r['after']==0 and r['cured'] and r['hotbar']['id']=='green_potion',r
    r=page.evaluate('window.__completionProbe.overweight()')
    assert r['canAttack']==False and r['canSkill']==False and 'OVER 90%' in r['hud'],r
    r=page.evaluate('window.__completionProbe.saveRoundTrip()')
    assert r['potion']==0 and r['ether']==0 and r['blind'] and r['slot']['id']=='first_aid',r
    r=page.evaluate('window.__completionProbe.magnum()')
    assert r['result'] and r['costHp']==20 and r['costSp']==30 and r['fireBuff']==10 and r['delay']>=2,r
    assert not errors,errors
    print('BROWSER INTEGRATION PASS: green potion Hotbar cure, 90% overweight blocks, zero-item save+status+Hotbar, Magnum skill HP/SP/delay/buff, no page errors')
    browser.close()
