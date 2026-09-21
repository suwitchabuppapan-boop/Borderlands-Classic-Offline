"""Deterministic attack/miss/dodge and AGI interval browser test with test-only closure probe."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,re
R=Path(__file__).resolve().parents[1]
html=(R/'index.html').read_text(encoding='utf-8')
css=(R/'css/style.css').read_text(encoding='utf-8')
css=re.sub(r'url\("\.\./assets/phieti/([^"/]+\.png)"\)',lambda m:'url("data:image/png;base64,'+base64.b64encode((R/'assets/phieti'/m.group(1)).read_bytes()).decode()+'")',css)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
for rel in ['js/classic-data.js','js/core.js','data/divine-pride-cache.js','js/divine-pride-codex.js','js/game.js']:
 js=(R/rel).read_text(encoding='utf-8')
 if rel=='js/game.js':
  marker="function strikeMonster(m,options={},color="
  assert marker in js
  probe="""window.__combatProbe={
  setup(){mobs.splice(1);let m=mobs[0];m.alive=true;m.hp=m.maxHp;m.attackAt=0;target=m;s.player.x=m.x;s.player.y=m.y;s.player.hp=30;s.player.agi=5;cool.attack=0;return m.hp;},
  hit(){return attack()},
  bash(){s.player.classId='swordman';s.skills.bash=1;s.player.sp=100;cool[2]=0;return skill(2)},
  agi(n){s.player.agi=n;return C.attackInterval(s)},
  next(){cool.attack=0;target=mobs[0];mobs[0].alive=true;mobs[0].hp=mobs[0].maxHp;},
  step(dt){return update(dt)},
  get(){return {hp:s.player.hp,mobHp:mobs[0].hp,cool:cool.attack,interval:C.attackInterval(s),fx:particles.map(x=>x.text)}}
 };
"""
  js=js.replace(marker,probe+marker,1)
 html=html.replace('<script src="'+rel+'"></script>','<script>'+js+'</script>')
html=html.replace('<body>','<body><script>window.requestAnimationFrame=()=>0;</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768});page.set_default_timeout(5000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load')
 hp=page.evaluate('window.__combatProbe.setup()')
 page.evaluate('Math.random=()=>.99;window.__combatProbe.hit()')
 missed=page.evaluate('window.__combatProbe.get()')
 assert missed['mobHp']==hp,missed
 assert 'MISS' in missed['fx'],missed
 assert abs(missed['cool']-missed['interval'])<.001,missed
 page.evaluate('window.__combatProbe.next();Math.random=()=>.5;window.__combatProbe.hit()')
 landed=page.evaluate('window.__combatProbe.get()')
 assert landed['mobHp']<hp,landed
 page.evaluate('window.__combatProbe.next();Math.random=()=>.99;window.__combatProbe.bash()')
 bash_miss=page.evaluate('window.__combatProbe.get()')
 assert bash_miss['mobHp']==hp,bash_miss
 page.evaluate('window.__combatProbe.next();Math.random=()=>.99;window.__combatProbe.agi(99)')
 before=page.evaluate('window.__combatProbe.get()')
 page.evaluate('window.__combatProbe.step(.05)')
 after=page.evaluate('window.__combatProbe.get()')
 assert after['hp']>=before['hp'],(before,after)
 assert 'DODGE' in after['fx'],after
 assert not errors,errors
 print('COMBAT BROWSER PASS: normal MISS and HIT, Bash MISS, AGI attack delay, monster DODGE, no JS errors')
 browser.close()
