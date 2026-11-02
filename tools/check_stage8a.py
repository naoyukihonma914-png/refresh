"""Exercise the new stage 8a construction and workshop through real controls.

Only browser setup, save downloads, geometry, and artifact conventions are
shared with earlier checks. No drawing actions or removed document types are used.
"""
import argparse
import html
import json
import re
import shutil
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SEED_ITEMS = ['border', 'save', 'color', 'font', 'layout', 'motion', 'bars', 'workspace', 'export']


def catalog():
    source = (ROOT / 'game/src/content/workshopCatalog.ts').read_text()
    pattern = r"make\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^]]*)\]\s*,\s*'([^']+)'"
    parts = [{'id': identity, 'kind': kind, 'set': 'extras' if identity.startswith('plugin-') else identity.split('-')[0], 'elements': re.findall(r"'([^']+)'", elements), 'interaction': interaction} for identity, kind, elements, interaction in re.findall(pattern, source)]
    if 'testAlternatives' in source:
        for part in parts:
            part['alternatives'] = ['select'] if part['interaction'] == 'scroll' else []
    assert len([part for part in parts if part['set'] != 'extras']) == 47, 'Catalog must contain 47 base parts'
    return parts


class Checks:
    def __init__(self, args, browser):
        self.args, self.browser = args, browser
        self.out = ROOT / args.output_dir
        self.out.mkdir(parents=True, exist_ok=True)
        summary = self.out / 'summary.json'
        self.report = json.loads(summary.read_text()) if args.resume and summary.exists() else {'cases': [], 'pageErrors': [], 'externalRequests': []}

    def persist(self):
        self.report['passed'] = sum(case['status'] == 'passed' for case in self.report['cases'])
        self.report['failed'] = sum(case['status'] == 'failed' for case in self.report['cases'])
        self.report['pageErrors'] = [error for case in self.report['cases'] for error in case.get('pageErrors', [])]
        self.report['externalRequests'] = [url for case in self.report['cases'] for url in case.get('externalRequests', [])]
        self.report['consoleMessages'] = [{'case': case['id'], **message} for case in self.report['cases'] for message in case.get('console', [])]
        production = [case for case in self.report['cases'] if case['step'] == '8a2' and len(case.get('completedParts', [])) == 29]
        self.report['coverage'] = {
            'seedPurchases': sum(len(case.get('purchases', [])) for case in self.report['cases'] if case['step'] == '8a1'),
            'workshopPartsCompletedThroughFourSteps': sum(len(case['completedParts']) for case in production),
            'workshopStageTransitions': 4 * sum(len(case['completedParts']) for case in production),
            'additionalWidgetFinishes': sum(len(case.get('completedParts', [])) for case in self.report['cases'] if case['step'] == '8a2' and len(case.get('completedParts', [])) == 1),
            'interactionTypes': sorted({gesture for case in production for gesture in case.get('interactions', {}).values()}),
            'sevenControlSaveRoundtrips': sum(bool(case.get('saveRoundtrip')) and len(case.get('editorControls', [])) == 7 for case in self.report['cases']),
            'nativeWindowScenarios': sum(len(case.get('nativeWindowActions', {})) for case in self.report['cases']),
        }
        (self.out / 'summary.json').write_text(json.dumps(self.report, ensure_ascii=False, indent=2) + '\n')
        cards = []
        for case in self.report['cases']:
            pictures = ''.join('<a href="' + html.escape(item['file']) + '"><img loading="lazy" src="' + html.escape(item['file']) + '"><span>' + html.escape(item['label']) + '</span></a>' for item in case['images'])
            cards.append('<section data-step="' + case['step'] + '"><h2>' + html.escape(case['id']) + ' — ' + case['status'] + '</h2>' + ('<pre>' + html.escape(case['error']) + '</pre>' if case.get('error') else '') + '<div>' + pictures + '</div></section>')
        header = '<!doctype html><html lang="ja"><meta charset="utf-8"><title>段階8a確認</title><style>body{font:14px/1.5 sans-serif;background:#eee;margin:20px}h1{font-size:22px}h2{font-size:16px}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}a{background:white;color:#222;padding:6px;border:1px solid #aaa}img{display:block;width:100%}span{display:block}pre{white-space:pre-wrap;color:#900}</style><h1>段階8a：構築・制作・カスタマイズ</h1><nav><a href="8a1.html">8a1：素の画面</a> <a href="8a2.html">8a2：制作工程</a> <a href="8a3.html">8a3：共通部品と設定</a></nav>'
        (self.out / 'index.html').write_text(header + ''.join(cards) + '</html>')
        for step in ['8a1', '8a2', '8a3']:
            selected = [card for card, case in zip(cards, self.report['cases']) if case['step'] == step]
            (self.out / (step + '.html')).write_text(header + ''.join(selected) + '</html>')

    def open(self, fixture, case):
        context = self.browser.new_context(viewport={'width': case['width'], 'height': 1080 if case['width'] == 1920 else 768}, locale='ja-JP' if case['language'] == 'ja' else 'en-US', timezone_id='Asia/Tokyo')
        def route(request):
            if request.request.url.startswith(self.args.base_url):
                request.continue_()
            else:
                case['externalRequests'].append(request.request.url)
                request.abort()
        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(12000)
        page.on('pageerror', lambda error: (case['pageErrors'].append(str(error)), self.report['pageErrors'].append(str(error))))
        page.on('console', lambda message: case['console'].append({'type': message.type, 'text': message.text}) if message.type in ['warning', 'error', 'assert'] else None)
        now = datetime(2026, 11, 2, tzinfo=timezone.utc)
        page.clock.install(time=now)
        page.clock.pause_at(now + timedelta(minutes=1))
        self.navigate(page, fixture, case)
        return context, page

    def navigate(self, page, fixture, case):
        page.goto(self.args.base_url + '/play/?debug=1' + ('&state=' + fixture if fixture else ''))
        page.locator('.debug-panel select').first.select_option(case['language'])
        page.evaluate('document.fonts.ready')
        page.locator('.debug-panel').evaluate('element=>element.style.display="none"')
        page.clock.run_for(100)

    def state(self, page):
        panel = page.locator('.debug-panel')
        panel.evaluate('element=>{element.style.display="block";element.style.position="fixed";element.style.top="0";element.style.left="0";element.style.zIndex="2147483647"}')
        try:
            with page.expect_download() as event:
                panel.locator('.debug-actions').last.locator('button').first.click()
        finally:
            panel.evaluate('element=>element.style.display="none"')
        return json.loads(Path(event.value.path()).read_text())

    def capture(self, page, case, label, name):
        if name != '16color-exit':
            page.locator('.editor-shell-parts,.editor-shell-left-rail,.editor-shell-right-rail').evaluate_all('nodes=>nodes.forEach(node=>node.scrollTop=0)')
        filename = case['id'] + '-' + name + '.png'
        page.screenshot(path=str(self.out / filename))
        case['images'] = [image for image in case['images'] if image['file'] != filename]
        case['images'].append({'file': filename, 'label': label})

    def geometry(self, page, root):
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal viewport overflow'
        bad = root.locator('button,th,td,label,h1,h2,h3,p').evaluate_all('''nodes=>nodes.flatMap(node=>{
          const style=getComputedStyle(node),box=node.getBoundingClientRect();
          if(node.closest('[inert]')||style.display==='none'||style.visibility==='hidden'||box.width<=0||box.height<=0)return [];
          const x=node.clientWidth>0&&node.scrollWidth>node.clientWidth+2&&!['auto','scroll'].includes(style.overflowX);
          const y=node.clientHeight>0&&node.scrollHeight>node.clientHeight+2&&!['auto','scroll'].includes(style.overflowY);
          return x||y?[{tag:node.tagName,cls:node.className,text:node.textContent,x,y}]:[];
        })''')
        assert not bad, bad

    def seed(self, page, case):
        root = page.locator('[data-seed-construction]')
        expect(root).to_be_visible()
        generator = root.locator('.seed-generate')
        pixels = root.locator('[data-seed-pixels]')
        before_space = pixels.get_attribute('data-seed-pixels')
        generator.focus()
        generator.press('Space')
        page.clock.run_for(80)
        assert pixels.get_attribute('data-seed-pixels') == before_space, 'Focused generator must not bypass the keyboard skill'
        case['focusedSpaceBeforeUnlock'] = True
        self.capture(page, case, '構築前', 'start')
        for item in SEED_ITEMS:
            before = self.state(page)
            assert item not in before['run']['seed']['built']
            button = root.locator(f'[data-seed-upgrade="{item}"]')
            expect(button).to_be_enabled()
            if item == 'export':
                self.geometry(page, root)
                self.capture(page, case, 'エクスポートを作る直前', 'before-export')
            button.click()
            after = self.state(page)
            assert item in after['run']['seed']['built'], item
            assert after['resources']['pixels'] < before['resources']['pixels'], item
            if item != 'export':
                self.geometry(page, root)
                self.capture(page, case, item + '購入後', 'after-' + item)
            else:
                workshop = page.locator('[data-workshop="true"]')
                expect(workshop).to_be_visible()
                expect(workshop).to_have_attribute('data-workshop-boot', 'true')
                self.capture(page, case, 'エディタ起動直後', 'boot-start')
                page.clock.run_for(600)
                self.capture(page, case, 'エディタ起動途中', 'boot-middle')
                page.clock.run_for(650)
                assert self.state(page)['run']['workshop']['enterMs'] == 0
                assert workshop.get_attribute('data-workshop-boot') is None
                self.geometry(page, workshop)
                self.capture(page, case, '約1.2秒後の制作画面', 'boot-complete')
        case['purchases'] = SEED_ITEMS

    def dismiss_guide(self, root):
        close = root.locator('.ws-guide > button')
        if close.count():
            close.click()

    def drag_rect(self, page, canvas, rect):
        canvas.scroll_into_view_if_needed()
        box = canvas.bounding_box()
        assert box, 'Destination canvas missing'
        logical = canvas.evaluate('node=>{const frame=node.closest("[data-workshop-target]");return {width:node.clientWidth,height:node.clientHeight,x:parseFloat(frame.style.left)||0,y:parseFloat(frame.style.top)||0}}')
        point = lambda x, y: (box['x'] + box['width'] * (x - logical['x']) / logical['width'], box['y'] + box['height'] * (y - logical['y']) / logical['height'])
        start, end = point(rect['x'], rect['y']), point(rect['x'] + rect['width'], rect['y'] + rect['height'])
        page.mouse.move(*start)
        page.mouse.down()
        page.mouse.move(*end, steps=12)
        page.mouse.up()

    def real_interaction(self, page, root, part):
        identity, interaction = part['id'], part['interaction']
        marked = root.locator(f'[data-workshop-test-part="{identity}"]')
        scope = marked.first if marked.count() else root.locator(f'[data-workshop-canvas-part="{identity}"]')
        expect(scope).to_be_visible()
        scope.scroll_into_view_if_needed()
        if identity == 'files-back':
            folder = scope.locator('select').first
            folder.select_option('sets' if folder.input_value() != 'sets' else 'all')
        if identity in ['bin-undo', 'bin-empty']:
            root.locator('[data-workshop-test-part="bin-list"] .ws-optional-bin-source button').click()
        if identity == 'mail-unread':
            inbox = root.locator('[data-workshop-test-part="mail-folders"] button').first
            if inbox.count() and inbox.get_attribute('aria-pressed') == 'false':
                inbox.click()
        if interaction == 'slide':
            control = scope.locator('input[type=range]').first
            previous = control.input_value()
            control.focus()
            control.press('ArrowRight' if float(previous) < float(control.get_attribute('max') or 100) else 'ArrowLeft')
            assert control.input_value() != previous, 'Slider did not move'
        elif interaction == 'input':
            scope.locator('input:not([type=range]):not([type=checkbox]),textarea').first.fill('test')
        elif interaction == 'resize':
            handle = scope.locator('[data-workshop-test-resize],[data-workshop-preview-resize]').first
            expect(handle).to_be_visible()
            box = handle.bounding_box()
            page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] / 2 - 24, box['y'] + box['height'] / 2 - 8, steps=6)
            page.mouse.up()
        elif interaction == 'scroll':
            candidates = scope.locator('*').evaluate_all('''nodes=>nodes.flatMap((node,index)=>{
              const s=getComputedStyle(node),r=node.getBoundingClientRect();
              return r.width>0&&r.height>0&&node.scrollHeight>node.clientHeight+4&&['auto','scroll'].includes(s.overflowY)?[index]:[];
            })''')
            own = scope.evaluate('node=>node.scrollHeight>node.clientHeight+4&&["auto","scroll"].includes(getComputedStyle(node).overflowY)')
            scroller = scope if own else scope.locator('*').nth(candidates[0]) if candidates else None
            if scroller is None:
                assert 'select' in part.get('alternatives', []), f'{identity}: no real scrolling area or permitted alternative'
                readers = scope.locator('[tabindex]')
                reader = readers.first if readers.count() else scope.locator('button,[role=option]').first
                expect(reader).to_be_visible()
                reader.focus()
                return 'select'
            previous = scroller.evaluate('node=>node.scrollTop')
            scroller.hover()
            page.mouse.wheel(0, 180)
            page.clock.run_for(80)
            page.wait_for_timeout(150)
            assert scroller.evaluate('node=>node.scrollTop') > previous, f'{identity}: list did not scroll'
        elif interaction == 'toggle' and scope.locator('input[type=checkbox]').count():
            control = scope.locator('input[type=checkbox]').first
            control.set_checked(not control.is_checked())
        elif interaction == 'select' and scope.locator('select').count():
            control = scope.locator('select').first
            choices = control.locator('option').evaluate_all('options=>options.map(option=>option.value)')
            control.select_option(next(value for value in choices if value != control.input_value()))
        else:
            unselected = scope.locator('button[aria-pressed=false],button[aria-selected=false]')
            control = unselected.first if unselected.count() else scope.locator('button,[role=button],progress,[tabindex]').first
            expect(control).to_be_enabled()
            control.click()
        if identity in ['clock-timer', 'theme-slideshow']:
            page.clock.run_for(1100)
        return interaction

    def make_part(self, page, root, case, part, detailed=False):
        identity = part['id']
        selector = root.locator('[data-workshop-set-selection]')
        if selector.input_value() != part['set']:
            selector.select_option(part['set'])
        root.locator(f'[data-workshop-part="{identity}"]').click()
        self.dismiss_guide(root)
        before = self.state(page)
        production = before['run']['workshop']['parts'][identity]
        assert production['step'] == 0, identity
        self.drag_rect(page, root.locator('[data-workshop-canvas]'), production['rect'])
        progress = root.locator('[data-workshop-step]')
        expect(progress).to_have_attribute('data-workshop-step', '1')
        if detailed:
            self.capture(page, case, '同じパーツ：①土台を置く', identity + '-step1')
        for element in part['elements']:
            root.locator(f'[data-workshop-element="{element}"]').click()
        expect(progress).to_have_attribute('data-workshop-step', '2')
        self.dismiss_guide(root)
        if detailed:
            self.capture(page, case, '同じパーツ：②要素を足す', identity + '-step2')
        adjust = root.locator('[data-workshop-adjust=radius]')
        adjust.focus()
        adjust.press('ArrowRight')
        root.locator('[data-workshop-action=confirmAdjustment]').click()
        expect(progress).to_have_attribute('data-workshop-step', '3')
        self.dismiss_guide(root)
        if detailed:
            self.capture(page, case, '同じパーツ：③調整する', identity + '-step3')
        case.setdefault('interactions', {})[identity] = self.real_interaction(page, root, part)
        expect(progress).to_have_attribute('data-workshop-step', '4')
        after = self.state(page)
        assert after['run']['workshop']['parts'][identity]['tested'] is True
        assert after['resources']['pixels'] > before['resources']['pixels'], identity
        self.geometry(page, root)
        self.capture(page, case, '④実際に操作して完成：' + identity, identity + '-step4')
        case.setdefault('completedParts', []).append(identity)

    def workshop(self, page, case):
        root = page.locator('[data-workshop=true]')
        self.workshop_space_gate(page, root, case)
        self.geometry(page, root)
        self.capture(page, case, '工房に入った直後', 'entry')
        optional = root.locator('.ws-text-button').first
        optional.click()
        self.capture(page, case, 'UIセットの購入', 'set-shop')
        before = self.state(page)
        root.locator('[data-workshop-set=clock]').click()
        bought = self.state(page)
        assert bought['resources']['pixels'] < before['resources']['pixels']
        assert bought['run']['workshop']['purchasedSets'] == ['clock']
        assert all(part['step'] == 0 for part in bought['run']['workshop']['parts'].values())
        self.capture(page, case, '購入したのは材料と制作する権利', 'set-purchased')
        self.navigate(page, f'stage8a-main-era{case["era"]}', case)
        root = page.locator('[data-workshop=true]')
        parts = [part for part in catalog() if part['set'] in ['common', 'foundation', 'files', 'mail', 'photo']]
        assert len(parts) == 29
        initial_tokens = self.state(page)['resources']['tokens']
        for index, part in enumerate(parts):
            self.make_part(page, root, case, part, detailed=index == 0)
            if index == len(parts) - 1 or parts[index + 1]['set'] != part['set']:
                if part['set'] == 'files':
                    root.locator('[data-workshop-part="files-list"]').click()
                    self.capture(page, case, 'ファイルの6パーツが完成した窓', 'files-complete')
                root.locator('[data-workshop-action=export]').click()
                self.dismiss_guide(root)
                self.capture(page, case, 'セットをエクスポート：' + part['set'], 'export-' + part['set'])
        exported = self.state(page)
        assert exported['resources']['tokens'] == initial_tokens + 29
        assert {doc['set'] for doc in exported['persistent']['setDocuments']} == {'common', 'foundation', 'files', 'mail', 'photo'}
        expect(root.locator('[data-workshop-action=export]')).to_be_disabled()
        root.locator('.ws-menu > button').first.click()
        expect(root.locator('.ws-export-list > li')).to_have_count(5)
        self.geometry(page, root)
        self.capture(page, case, 'エクスポートしたセットの一覧', 'exports-list')
        root.locator('.ws-menu > button').first.click()
        root.locator('[data-workshop-action=exit]').click()
        expect(root.locator('.ws-exit-requirements')).to_be_visible()
        assert self.state(page)['run']['world'] == 'kumiki'
        expect(root.locator('[data-workshop-action=release]')).to_be_enabled()
        self.capture(page, case, '16色の表示要件とリリースの入口', '16color-exit')

    def workshop_space_gate(self, page, root, case):
        before = self.state(page)
        assert not {'keyboard', 'hold'} & set(before['persistent']['seedSkills'])
        generator = root.locator('[data-workshop-action=generate]')
        generator.focus()
        generator.press('Space')
        assert self.state(page)['resources']['pixels'] == before['resources']['pixels'], 'Workshop generator must preserve the keyboard skill gate'
        case['workshopFocusedSpaceBeforeUnlock'] = True

    def part_variant(self, page, case, part):
        root = page.locator('[data-workshop=true]')
        self.dismiss_guide(root)
        self.capture(page, case, '実操作前：' + part['id'], 'before-test')
        self.real_interaction(page, root, part)
        expect(root.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step', '4')
        assert self.state(page)['run']['workshop']['parts'][part['id']]['tested']
        self.geometry(page, root)
        self.capture(page, case, '実際に操作して完成：' + part['id'], 'completed')
        case['completedParts'] = [part['id']]

    def customization(self, page, case):
        self.navigate(page, f'stage8a-part-common-frame-step-2-era{case["era"]}', case)
        root = page.locator('[data-workshop=true]')
        before = self.state(page)
        rows = root.locator('.ws-window-controls-editor > fieldset')
        expect(rows).to_have_count(3)
        rows.first.locator('select').first.select_option('start')
        rows.last.locator('.ws-order-controls button').first.click()
        inspector = root.locator('.ws-inspector')
        inspector.locator(':scope > .ws-colors').first.locator(':scope > div > button').nth(11).click()
        inspector.locator(':scope > .ws-colors').nth(1).locator(':scope > div > button').nth(4).click()
        title_options = inspector.locator(':scope > label > select')
        title_options.nth(0).select_option('center')
        title_options.nth(1).select_option('square')
        rows.first.locator('.ws-colors > div > button').nth(4).click()
        after = self.state(page)
        frame = after['run']['workshop']['parts']['common-frame']
        assert frame['elements'] != before['run']['workshop']['parts']['common-frame']['elements']
        assert frame['design']['controlSides']['minimize'] == 'start'
        assert frame['design']['color'] == '#1f3f7a' and frame['design']['textColor'] == '#f4efe4'
        assert frame['design']['nativeColors'] is False and frame['design']['symbolShape'] == 'square' and frame['design']['titleAlign'] == 'center'
        self.geometry(page, root)
        self.capture(page, case, '共通の窓記号：左右と並びを変更', 'common-symbols')
        root.locator('[data-workshop-action=confirmAdjustment]').click()
        self.dismiss_guide(root)
        self.real_interaction(page, root, next(part for part in catalog() if part['id'] == 'common-frame'))
        expect(root.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step', '4')
        case['commonDesign'] = frame['design']
        self.navigate(page, f'stage8a-editor-custom-era{case["era"]}', case)
        root = page.locator('[data-workshop=true]')
        settings = root.locator('.ws-editor-settings')
        previous = self.state(page)['persistent']['editorCustomization']
        width = settings.locator('[data-workshop-customize=panelWidth]')
        width.focus()
        width.press('End')
        settings.locator('select').first.select_option('bottom')
        grid = settings.locator('input[type=checkbox]').first
        grid.set_checked(not grid.is_checked())
        settings.locator('.ws-colors').first.locator(':scope > div > button').nth(8).click()
        settings.locator('.ws-colors').nth(1).locator(':scope > div > button').nth(0).click()
        for control in [settings.locator('input[type=range]').nth(0), settings.locator('input[type=range]').nth(1)]:
            previous_value = control.input_value()
            control.focus()
            control.press('ArrowRight' if float(previous_value) < float(control.get_attribute('max')) else 'ArrowLeft')
            assert control.input_value() != previous_value
        customized = self.state(page)
        saved = customized['persistent']['editorCustomization']
        assert saved['panelWidth'] == float(width.get_attribute('max')) and saved['panelWidth'] > previous['panelWidth']
        assert saved['bandPosition'] != previous['bandPosition'] and saved['grid'] != previous['grid']
        assert saved['accent'] == '#f6d27a' and saved['background'] == '#101018' and saved['nativeBackground'] is False
        assert saved['gridSpacing'] != previous['gridSpacing'] and saved['fontSize'] != previous['fontSize']
        case['editorControls'] = ['accent', 'bandPosition', 'panelWidth', 'background', 'grid', 'gridSpacing', 'fontSize']
        self.geometry(page, root)
        self.capture(page, case, '工房自身の設定を実操作で変更', 'editor-settings')
        root.locator('.ws-page-scroll > button').first.click()
        self.geometry(page, root)
        self.capture(page, case, 'カスタマイズした工房', 'customized-editor')
        persisted = self.state(page)
        page.evaluate('state=>localStorage.setItem("refresh.save",JSON.stringify(state))', persisted)
        self.navigate(page, None, case)
        reloaded = self.state(page)
        assert reloaded['persistent']['editorCustomization'] == saved
        case['saveRoundtrip'] = True
        root = page.locator('[data-workshop=true]')
        root.locator('.ws-menu > button').nth(1).click()
        root.locator('[data-workshop-action=resetCustomization]').click()
        reset = self.state(page)['persistent']['editorCustomization']
        assert reset['bandPosition'] == 'top' and reset['panelWidth'] != saved['panelWidth']
        self.capture(page, case, '標準に戻す', 'reset-editor')
        tabs = root.locator('.ws-settings-tabs > button')
        tabs.nth(1).click()
        self.geometry(page, root)
        self.capture(page, case, '工房の記録とガイドの履歴', 'editor-records')
        tabs.nth(2).click()
        sound = root.locator('.sound-settings')
        enabled = sound.locator('input[type=checkbox]')
        enabled.set_checked(not enabled.is_checked())
        volume = sound.locator('input[type=range]')
        original_volume = volume.input_value()
        volume.focus()
        volume.press('ArrowLeft' if float(original_volume) >= 1 else 'ArrowRight')
        assert volume.input_value() != original_volume
        self.geometry(page, root)
        self.capture(page, case, '工房の効果音の設定', 'editor-sound')
        case['soundControls'] = True

    def native_frame(self, page, case, desktop_era=None):
        era = case['era'] if desktop_era is None else desktop_era
        self.navigate(page, f'stage8a-desktop-common-custom-era{era}', case)
        desktop = page.locator('.desktop-live')
        achievement = desktop.locator('.achievement-toast header > button')
        if achievement.count():
            achievement.click()
        frame = desktop.locator('.desktop-window[data-app=files]')
        expect(frame).to_be_visible()
        start = frame.locator(':scope > .window-title [data-produced-controls=start]')
        end = frame.locator(':scope > .window-title [data-produced-controls=end]')
        expect(start.locator('button')).to_have_count(1)
        expect(start.locator('.window-close')).to_have_count(1)
        expect(end.locator('button')).to_have_count(2)
        close_box, end_box = start.bounding_box(), end.bounding_box()
        frame_box = frame.bounding_box()
        assert close_box['x'] < frame_box['x'] + frame_box['width'] * .3 and end_box['x'] > frame_box['x'] + frame_box['width'] * .6, 'Produced start/end controls must keep their selected sides'
        self.geometry(page, frame)
        self.capture(page, case, '共通記号が実際のデスクトップ窓へ反映', f'native-era{era}-frame')
        end.locator('button').nth(1).click()
        assert self.state(page)['run']['desktop']['windows']['files']['maximized'] is True
        self.capture(page, case, '作った記号から最大化', f'native-era{era}-frame-maximized')
        end.locator('button').nth(1).click()
        before = self.state(page)['run']['desktop']['windows']['files']
        title = frame.locator(':scope > .window-title').bounding_box()
        page.mouse.move(title['x'] + title['width'] / 2, title['y'] + title['height'] / 2)
        page.mouse.down()
        page.mouse.move(title['x'] + title['width'] / 2 - 20, title['y'] + title['height'] / 2 - 12, steps=6)
        page.mouse.up()
        moved = self.state(page)['run']['desktop']['windows']['files']
        assert moved['x'] != before['x'] or moved['y'] != before['y'], 'Produced title must still move its window'
        end.locator('button').first.click()
        assert self.state(page)['run']['desktop']['windows']['files']['minimized'] is True
        desktop.locator('[data-shortcut=files]').dblclick()
        start.locator('.window-close').click()
        assert self.state(page)['run']['desktop']['windows']['files']['open'] is False
        desktop.locator('[data-shortcut=files]').dblclick()
        expect(frame).to_be_visible()
        case.setdefault('nativeWindowActions', {})[str(era)] = ['maximize', 'restore', 'move', 'minimize', 'close', 'reopen']

    def run_case(self, step, language, width, era, part=None):
        identity = f'{step}-' + (part['id'] + '-' if part else '') + f'era{era}-{language}-{width}'
        old = next((row for row in self.report['cases'] if row['id'] == identity), None)
        if self.args.resume and not self.args.recheck and old and old['status'] == 'passed':
            return
        case = {'id': identity, 'step': step, 'language': language, 'width': width, 'era': era, 'status': 'running', 'images': [], 'pageErrors': [], 'externalRequests': [], 'console': []}
        self.report['cases'] = [row for row in self.report['cases'] if row['id'] != identity] + [case]
        context = page = None
        try:
            fixture = f'stage8a-part-{part["id"]}-step-3-era{era}' if part else 'stage8a-seed-ready' + (f'-era{era}' if era else '') if step == '8a1' else f'stage8a-entry-era{era}'
            context, page = self.open(fixture, case)
            if step == '8a1':
                self.seed(page, case)
            elif step == '8a2' and part:
                self.part_variant(page, case, part)
            elif step == '8a2':
                self.workshop(page, case)
            else:
                self.customization(page, case)
                self.native_frame(page, case)
                if era == 2:
                    self.native_frame(page, case, desktop_era=3)
            assert not case['pageErrors'], case['pageErrors']
            case['status'] = 'passed'
            print('PASS', identity, flush=True)
        except Exception as error:
            case['status'], case['error'] = 'failed', str(error)
            if page:
                self.capture(page, case, '確認中の問題', 'failure')
            print('FAIL', identity, str(error), flush=True)
            if not self.args.keep_going:
                raise
        finally:
            if context:
                context.close()
            self.persist()

    def recapture(self, step, language, width, era):
        assert step == '8a2', 'Only 8a2 has corrected screenshot framing'
        identity = f'{step}-era{era}-{language}-{width}'
        case = next(row for row in self.report['cases'] if row['id'] == identity and row['status'] == 'passed')
        case.setdefault('console', [])
        context, page = self.open(f'stage8a-files-complete-era{era}', case)
        try:
            old_file = identity + '-files-complete.png'
            exports_file = identity + '-exports-list.png'
            if (self.out / old_file).exists() and not (self.out / exports_file).exists():
                (self.out / old_file).rename(self.out / exports_file)
                for image in case['images']:
                    if image['file'] == old_file:
                        image.update(file=exports_file, label='エクスポートしたセットの一覧')
            root = page.locator('[data-workshop=true]')
            fixture = self.state(page)
            workshop = fixture['run']['workshop']
            assert workshop['activePart'] == 'files-list'
            assert workshop['purchasedSets'] == ['common', 'foundation', 'files']
            assert all(production['step'] == 4 and production['exportedAt'] is None for identity, production in workshop['parts'].items() if identity.startswith('files-'))
            assert [document['set'] for document in fixture['persistent']['setDocuments']] == ['common', 'foundation', 'files']
            case['filesCompleteBeforeExport'] = {'completedParts': 17, 'filesCompleted': 6, 'filesExported': 0, 'setDocuments': ['common', 'foundation', 'files']}
            self.workshop_space_gate(page, root, case)
            expect(root.locator('[data-workshop-target=files]')).to_be_visible()
            self.geometry(page, root)
            case['fileTargetChromeGeometry'] = root.locator('.ws-actual-window-controls > button').evaluate_all('nodes=>nodes.map(node=>({width:node.clientWidth,height:node.clientHeight,scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight}))')
            assert all(button['scrollHeight'] <= button['height'] + 2 for button in case['fileTargetChromeGeometry'])
            self.capture(page, case, 'ファイルの6パーツが完成した窓', 'files-complete')
            if language == 'ja' and width == 1920:
                for phase in [1, 2, 3, 4]:
                    self.navigate(page, f'stage8a-part-common-frame-step-{phase}-era{era}', case)
                    self.capture(page, case, f'同じパーツ：工程{phase}（パーツ名・工程表示つき）', f'common-frame-step{phase}')
            self.navigate(page, f'stage8a-entry-era{era}', case)
            root = page.locator('[data-workshop=true]')
            self.geometry(page, root)
            self.capture(page, case, '工房に入った直後（最終既定色）', 'entry')
            root.locator('.ws-text-button').first.click()
            self.geometry(page, root)
            self.capture(page, case, 'UIセットの購入（最終既定色）', 'set-shop')
            root.locator('[data-workshop-set=clock]').click()
            self.geometry(page, root)
            self.capture(page, case, '購入したのは材料と制作する権利（最終既定色）', 'set-purchased')
            self.navigate(page, f'stage8a-required-complete-16color-era{era}', case)
            root = page.locator('[data-workshop=true]')
            expect(root.locator('.ws-exit-requirements')).to_be_visible()
            expect(root.locator('[data-workshop-action=release]')).to_be_enabled()
            root.locator('.ws-exit-requirements').scroll_into_view_if_needed()
            self.geometry(page, root)
            self.capture(page, case, '16色の表示要件とリリースの入口（最終既定色）', '16color-exit')
            case['correctedFraming'] = True
        finally:
            context.close()
            self.persist()

    def recheck_flat_native(self, language, width, era):
        assert era == 2, 'The additional flat desktop belongs to the editor-era-2 case'
        identity = f'8a3-era{era}-{language}-{width}'
        case = next(row for row in self.report['cases'] if row['id'] == identity)
        assert case.get('saveRoundtrip') and len(case.get('editorControls', [])) == 7
        assert case.get('nativeWindowActions', {}).get('2') == ['maximize', 'restore', 'move', 'minimize', 'close', 'reopen']
        context, page = self.open('stage8a-desktop-common-custom-era3', case)
        try:
            self.native_frame(page, case, desktop_era=3)
            assert not case['pageErrors'], case['pageErrors']
            case['status'] = 'passed'
            case.pop('error', None)
            case['images'] = [item for item in case['images'] if not item['file'].endswith('-failure.png')]
            print('PASS flat-native', identity, flush=True)
        finally:
            context.close()
            self.persist()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--output-dir', default='game/artifacts/stage8a')
    parser.add_argument('--step', action='append', choices=['8a1', '8a2', '8a3'])
    parser.add_argument('--language', action='append', choices=['ja', 'en', 'en-XA'])
    parser.add_argument('--width', action='append', type=int, choices=[1920, 1366])
    parser.add_argument('--era', action='append', type=int, choices=[0, 1, 2])
    parser.add_argument('--catalog-only', action='store_true', help='Exercise optional and plugin widgets from new step-3 fixtures')
    parser.add_argument('--captures-only', action='store_true', help='Refresh corrected Files and primary phase screenshots without replaying passed flows')
    parser.add_argument('--flat-native-only', action='store_true', help='Finish verified editor-era-2 cases by checking the additional flat desktop')
    parser.add_argument('--part', action='append', help='Limit catalog-only checks to named new catalog IDs')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--recheck', action='store_true')
    parser.add_argument('--keep-going', action='store_true')
    args = parser.parse_args()
    if args.part:
        assert args.catalog_only, '--part requires --catalog-only'
        assert set(args.part) <= {part['id'] for part in catalog()}, 'Unknown workshop part ID'
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
        checks = Checks(args, browser)
        for step in args.step or ['8a1']:
            for era in args.era or [0, 1, 2]:
                for language in args.language or ['ja', 'en', 'en-XA']:
                    for width in args.width or [1920, 1366]:
                        if args.flat_native_only:
                            assert step == '8a3', '--flat-native-only belongs to 8a3'
                            checks.recheck_flat_native(language, width, era)
                        elif args.captures_only:
                            checks.recapture(step, language, width, era)
                        elif args.catalog_only:
                            assert step == '8a2', '--catalog-only belongs to 8a2'
                            parts = [part for part in catalog() if part['id'] in args.part] if args.part else [part for part in catalog() if part['set'] not in ['common', 'foundation', 'files', 'mail', 'photo']]
                            for part in parts:
                                checks.run_case(step, language, width, era, part=part)
                        else:
                            checks.run_case(step, language, width, era)
        browser.close()
    print(json.dumps({key: checks.report[key] for key in ['passed', 'failed', 'pageErrors', 'externalRequests']}, ensure_ascii=False))
    assert not checks.report['failed'] and not checks.report['pageErrors'] and not checks.report['externalRequests']
    archive = checks.out / 'stage8a-screens.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for name in ['index.html', '8a1.html', '8a2.html', '8a3.html', 'summary.json'] + [image['file'] for case in checks.report['cases'] for image in case['images']]:
            output.write(checks.out / name, name)


if __name__ == '__main__':
    main()
