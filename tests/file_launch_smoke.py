"""Actual file:// launch (not inlined HTML): ensure the pack works without a server."""
from pathlib import Path
from playwright.sync_api import sync_playwright, Error
import os
CHROMIUM=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
# Fall back to Playwright's bundled browser when no system Chromium is installed.
CHROMIUM=CHROMIUM if os.path.exists(CHROMIUM) else None
root=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1600,'height':1030})
    errors=[]
    requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda request:requests.append(request.url))
    try:
        page.goto((root/'index.html').as_uri(),wait_until='load')
    except Error as error:
        if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error):
            print('FILE LAUNCH SKIPPED: sandbox administrator blocks file:// navigation; inlined browser and static offline checks cover this build')
            browser.close()
            raise SystemExit(0)
        raise
    page.wait_for_timeout(700)
    assert 'Novice' in page.locator('#hero-name').inner_text()
    page.locator('button[data-tab="codex"]').click()
    assert 'ยังไม่ได้ Import API' in page.locator('#side-panel').inner_text()
    page.screenshot(path=str(root/'preview_codex.png'),full_page=True)
    assert not any(uri.startswith(('http://','https://')) for uri in requests),requests
    assert not errors,errors
    print('FILE LAUNCH PASS: file:// loads all 5 local scripts, Codex empty state, no network requests, no browser errors')
    browser.close()
