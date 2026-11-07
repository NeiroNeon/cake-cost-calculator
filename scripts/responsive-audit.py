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
    active_page={'name':'landing'}
    page.on('pageerror',lambda e:errors.append(f"{active_page['name']}: {e}"))
    page.on('console',lambda m:errors.append(f"{active_page['name']}: {m.text}") if m.type=='error' else None)
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
    active_page['name']='calculator'
    page.goto(f'http://127.0.0.1:{server.server_port}/app/',wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
    page.locator('.calc-card').first.click()
    assert page.locator('#calcOverlay').evaluate("e=>e.classList.contains('open')")
    page.screenshot(path=str(OUT/f'app-{w}.png'),full_page=True)

    # Composite recipe editor responsive audit
    active_page['name']='recipes'
    page.goto(f'http://127.0.0.1:{server.server_port}/app/recipes.html', wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')

    page.screenshot(path=str(OUT/f'recipes-{w}.png'), full_page=True)

    page.locator('#newRecipe').click()
    editor = page.locator('#editor')
    assert editor.is_visible(), 'Recipe editor did not open'

    fits_viewport = editor.evaluate("""e => {
      const r = e.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 &&
             r.right <= window.innerWidth + 1 &&
             r.bottom <= window.innerHeight + 1;
    }""")
    assert fits_viewport, f'Recipe editor exceeds viewport: {w}x{h}'

    components = page.locator('#components > *')
    before_components = components.count()
    page.locator('#addComponent').click()
    assert components.count() == before_components + 1, 'Adding nested component failed'

    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'), 'Horizontal page overflow after adding component'
    assert editor.evaluate('e => e.scrollWidth <= e.clientWidth + 1'), 'Horizontal overflow inside recipe editor'
    body = editor.locator('.body')
    assert body.evaluate("e => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)"), 'Recipe editor body is not vertically scrollable'
    assert body.evaluate("e => e.clientHeight > 0 && e.scrollHeight >= e.clientHeight"), 'Recipe editor body has invalid scroll dimensions'
    assert editor.locator('#recipeForm').is_visible(), 'Recipe form is not visible'

    page.screenshot(path=str(OUT/f'recipes-editor-{w}.png'), full_page=True)
    page.locator('#closeEditor').click()
    assert not editor.is_visible(), 'Recipe editor did not close'
    report['viewports'].append({'width':w,'height':h,'errors':errors})
    report['errors']+=errors
    ctx.close()

   # Composite recipe end-to-end workflow
   flow_context = browser.new_context(viewport={'width':1280,'height':900})
   flow = flow_context.new_page()
   flow_errors = []
   flow.on('pageerror', lambda e: flow_errors.append(str(e)))

   flow.goto(f'http://127.0.0.1:{server.server_port}/app/recipes.html', wait_until='networkidle')
   flow.evaluate("localStorage.clear()")
   flow.reload(wait_until='networkidle')

   # Create base recipe
   flow.locator('#newRecipe').click()
   flow.locator('#name').fill('Тестовый бисквит')
   flow.locator('#yield').fill('500')
   flow.locator('#ingredients .ing-name').first.fill('Мука')
   flow.locator('#ingredients .ing-qty').first.fill('100')
   flow.locator('#ingredients .ing-unit').first.select_option(label='г')
   flow.locator('#recipeForm button[type="submit"]').click()
   flow.wait_for_function("!document.querySelector('#editor').open")

   base = flow.evaluate("""() => JSON.parse(localStorage.getItem('bento_recipes_v1') || '[]')
      .find(recipe => recipe.name === 'Тестовый бисквит')""")
   assert base, 'Base recipe was not saved'

   # Create parent recipe with nested component
   flow.locator('#newRecipe').click()
   flow.locator('#name').fill('Тестовый торт')
   flow.locator('#yield').fill('1000')
   flow.locator('#ingredients .ing-name').first.fill('Сахар')
   flow.locator('#ingredients .ing-qty').first.fill('50')
   flow.locator('#ingredients .ing-unit').first.select_option(label='г')

   flow.locator('#addComponent').click()
   component = flow.locator('#components .component-row').last
   component.locator('.component-recipe').select_option(base['id'])
   component.locator('.component-qty').fill('500')

   assert 'Тестовый бисквит' in flow.locator('#costPanel').inner_text()
   flow.locator('#recipeForm button[type="submit"]').click()
   flow.wait_for_function("!document.querySelector('#editor').open")

   saved = flow.evaluate("""() => JSON.parse(localStorage.getItem('bento_recipes_v1') || '[]')
      .find(recipe => recipe.name === 'Тестовый торт')""")
   assert saved, 'Parent recipe was not saved'
   assert len(saved['components']) == 1, 'Nested component was not saved'
   assert saved['components'][0]['recipeId'] == base['id'], 'Wrong nested recipe reference'
   assert saved['components'][0]['qtyGrams'] == 500, 'Wrong nested component quantity'

   # Reopen parent and verify persisted component
   flow.locator('.card').filter(has_text='Тестовый торт').locator('[data-edit]').click()
   assert flow.locator('#components .component-row').count() == 1
   assert flow.locator('#components .component-recipe').input_value() == base['id']
   assert flow.locator('#components .component-qty').input_value() == '500'
   flow.locator('#closeEditor').click()

   # Verify UI prevents selecting a dependent recipe and creating a cycle
   flow.locator('.card').filter(has_text='Тестовый бисквит').locator('[data-edit]').click()
   flow.locator('#addComponent').click()
   options = flow.locator('#components .component-recipe option').all_text_contents()
   assert options, 'Component recipe options were not rendered'
   assert not any('Тестовый торт' in option for option in options), 'Cycle-producing recipe is available for selection'
   flow.locator('#closeEditor').click()

   # Verify deletion protection for a recipe used as a component
   flow.locator('.card').filter(has_text='Тестовый бисквит').locator('[data-delete]').click()
   assert 'Нельзя удалить карту' in flow.locator('#pageStatus').inner_text()
   assert flow.locator('.card').filter(has_text='Тестовый бисквит').count() == 1

   assert not flow_errors, f'Browser errors in composite workflow: {flow_errors}'
   flow.screenshot(path=str(OUT/'recipes-functional.png'), full_page=True)
   report['composite_workflow'] = {
     'base_recipe_saved': True,
     'nested_component_saved': True,
     'nested_component_reopened': True,
     'cycle_prevention': True,
     'delete_protection': True,
     'browser_errors': flow_errors
   }
   flow_context.close()
   browser.close()
 finally:
  server.shutdown(); server.server_close()
 (OUT/'responsive-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if report['errors']: raise SystemExit('Browser errors detected')
 print('Responsive smoke passed:',len(report['viewports']))
if __name__=='__main__': main()
