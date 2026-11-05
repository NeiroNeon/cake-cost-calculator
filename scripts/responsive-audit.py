#!/usr/bin/env python3
from __future__ import annotations
import json, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'
VIEWPORTS=[(320,720),(360,800),(390,844),(430,932),(768,1024),(1024,768),(1280,800),(1440,900)]
def main():
 OUT.mkdir(exist_ok=True)
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 report={'viewports':[],'errors':[],'limitations':['Viewport emulation is not physical device testing.','Safari/WebKit and Firefox are not covered.']}
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   for w,h in VIEWPORTS:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<=430,has_touch=w<=430,device_scale_factor=2 if w<=430 else 1)
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
    if w<=680:
     page.get_by_role('button',name='Открыть меню').click()
     assert page.locator('#primary-navigation').evaluate("e=>e.classList.contains('open')")
     page.keyboard.press('Escape')
    before=page.locator('#demoTotal').inner_text()
    page.locator('#demoRows input').first.fill('200')
    assert before!=page.locator('#demoTotal').inner_text()
    page.screenshot(path=str(OUT/f'landing-{w}.png'),full_page=True)
    page.goto(f'http://127.0.0.1:{server.server_port}/app/',wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
    page.locator('.calc-card').first.click()
    assert page.locator('#calcOverlay').evaluate("e=>e.classList.contains('open')")
    page.screenshot(path=str(OUT/f'app-{w}.png'),full_page=True)
    report['viewports'].append({'width':w,'height':h,'errors':errors})
    report['errors']+=errors
    ctx.close()
   browser.close()
 finally:
  server.shutdown(); server.server_close()
 (OUT/'responsive-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if report['errors']: raise SystemExit('Browser errors detected')
 print('Responsive smoke passed:',len(report['viewports']))
if __name__=='__main__': main()
