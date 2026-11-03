"""PR29 panel revision acceptance through actual browser controls.

After building and serving game/dist, run this harness and check_world2_fitting.py
sequentially. Public fixtures supply starting points; gameplay state is never
injected. Persistence uses a real export, file-chooser import on the ordinary
URL, and reload. Japanese captures supply the six requested 1920x1080 images.
"""
import argparse
import json
import re
import tempfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from check_world2_fitting import FittingReview, ROOT, preflight

CASES = ('entry', 'production', 'optional', 'era1', 'palette', 'gray-catalog', 'legacy-palette')


def rgb(value):
    channels = [float(channel) for channel in re.findall(r'[\d.]+', value)]
    assert len(channels) >= 3, value
    if len(channels) > 3:
        assert channels[3] == 1, ('Socket must have an opaque neutral surface', value)
    return channels[:3]


def luminance(value):
    red, green, blue = rgb(value)
    return .2126 * red + .7152 * green + .0722 * blue


def part_designs(state):
    return {identity: part['design'] for identity, part in state['run']['workshop']['parts'].items()}


class PanelReview(FittingReview):
    def __init__(self, args, browser):
        super().__init__(args, browser)
        self.report.pop('language', None)
        self.report['languages'] = args.languages
        self.report['setup'] = ('public fixtures; real controls; frozen browser clock; '
                                'unchanged exported fixture imported through the product file chooser for normal-URL reload; '
                                'no JavaScript state injection')
        self.report['references'] = ['docs/世界2-パネル修正指示書.md', 'docs/spec.md §4.2',
                                     'docs/デザインの決まり.md §4']

    def save(self):
        super().save()
        index = self.out / 'index.html'
        index.write_text(index.read_text().replace('世界2 はめる制作の確認', '世界2 パネル修正の確認')
                         .replace('世界2：実操作・保存・段アップ', '世界2：常設パネル・灰色の窪み・背景パレット'))

    def capture(self, page, case, filename, label):
        if self.args.language == 'ja' and not case.get('noImages'):
            super().capture(page, case, filename, label)

    @staticmethod
    def panel(page):
        return page.locator('[data-workshop-panel-scroll]')

    @staticmethod
    def category_for(set_id):
        return 'shared' if set_id == 'common' else 'required' if set_id in ('foundation', 'files', 'mail') else 'optional'

    def zones(self, page):
        panel = self.panel(page)
        expect(panel).to_be_visible()
        for identity in ('sets', 'parts', 'pieces'):
            expect(panel.locator(f'[data-workshop-zone="{identity}"]')).to_have_count(1)
            expect(panel.locator(f'[data-workshop-zone-heading="{identity}"]')).to_have_count(1)
        expect(panel.locator('[data-workshop-category]')).to_have_count(3)
        expect(panel.locator('[data-workshop-next]')).to_have_count(1)
        expect(panel.locator('.ws-next-indicator')).to_have_count(1)
        expect(panel.locator('[data-workshop-action="backToSets"],[data-workshop-action="backToParts"],.ws-fitting-part-chips')).to_have_count(0)
        scroll = panel.evaluate('''node=>({overflow:getComputedStyle(node).overflowY,
          nested:[...node.querySelectorAll('[data-workshop-zone],.ws-panel-set-rows,.ws-panel-part-rows,.ws-fitting-piece-list')]
           .filter(child=>['auto','scroll'].includes(getComputedStyle(child).overflowY)&&child.scrollHeight>child.clientHeight+1)
           .map(child=>child.className),
          heads:[...node.querySelectorAll('[data-workshop-zone-heading]')].map(head=>getComputedStyle(head).position)})''')
        assert scroll['overflow'] in ('auto', 'scroll') and not scroll['nested'], scroll
        assert scroll['heads'] == ['sticky'] * 3, scroll
        scroll['tabs'] = panel.locator('[data-workshop-category]').evaluate_all('''nodes=>nodes.map(node=>({
          category:node.dataset.workshopCategory,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
          clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}))''')
        assert all(tab['scrollWidth'] <= tab['clientWidth'] + 1 and tab['scrollHeight'] <= tab['clientHeight'] + 1
                   for tab in scroll['tabs']), scroll['tabs']
        return scroll

    def price(self, page, era=0):
        button = self.panel(page).locator('[data-workshop-set="common"]')
        measurement = button.evaluate('''node=>{
          const r=node.getBoundingClientRect(),s=getComputedStyle(node),range=document.createRange();
          range.selectNodeContents(node);const text=range.getBoundingClientRect();
          return {text:node.textContent.trim(),font:parseFloat(s.fontSize),spacing:s.letterSpacing,
                  left:r.left,right:r.right,textLeft:text.left,textRight:text.right,client:node.clientWidth,scroll:node.scrollWidth};
        }''')
        numeric_label = re.sub(r'[^0-9K,.]', '', measurement['text'])
        assert re.search(r'4[,.]?000|4K', numeric_label), measurement
        assert measurement['font'] >= (14 if era == 0 else 12), measurement
        assert measurement['textLeft'] >= measurement['left'] - 1 and measurement['textRight'] <= measurement['right'] + 1, measurement
        assert measurement['scroll'] <= measurement['client'] + 1, measurement
        return measurement

    def faces(self, page, era):
        panel = self.panel(page)
        selected = panel.locator('[data-workshop-select-set][aria-pressed="true"]')
        expect(selected).to_have_count(1)
        style = selected.evaluate('node=>{const s=getComputedStyle(node);return {top:s.borderTopColor,bottom:s.borderBottomColor}}')
        assert luminance(style['top']) > luminance(style['bottom']), style
        assert selected.evaluate('node=>getComputedStyle(node.closest("[data-navigation-set]")).filter') == 'none'
        other_tabs = panel.locator('[data-workshop-category][aria-selected="false"]')
        assert all('brightness(0.72)' in value for value in other_tabs.evaluate_all('nodes=>nodes.map(node=>getComputedStyle(node).filter)'))
        disabled = panel.locator('[data-workshop-action="exit"]')
        if disabled.count():
            expect(disabled).to_be_disabled()
            sunk = disabled.evaluate('node=>{const s=getComputedStyle(node);return {top:s.borderTopColor,bottom:s.borderBottomColor,text:s.color,background:s.backgroundColor}}')
            assert luminance(sunk['top']) < luminance(sunk['bottom']), sunk
            assert max(rgb(sunk['text'])) - min(rgb(sunk['text'])) <= 24, sunk
        enabled = panel.locator('[data-workshop-part]:enabled[aria-pressed="false"]').first
        if not enabled.count():
            enabled = panel.locator('[data-workshop-category][aria-selected="false"]').first
        raised = enabled.evaluate('node=>{const s=getComputedStyle(node);return {top:s.borderTopColor,bottom:s.borderBottomColor,background:s.backgroundColor}}')
        panel_background = panel.evaluate('node=>getComputedStyle(node).backgroundColor')
        assert luminance(raised['top']) > luminance(raised['bottom']), raised
        assert raised['background'] != panel_background, (raised, panel_background)
        bars = panel.locator('.ws-panel-state-bar').evaluate_all('nodes=>nodes.map(node=>getComputedStyle(node).width)')
        assert bars and all(float(width.rstrip('px')) >= 3 for width in bars), bars
        return {'era': era, 'selected': style, 'raised': raised, 'stateBars': len(bars)}

    def neutral_sockets(self, page):
        sockets = self.shell(page).locator('.wf-socket:not(.is-filled)')
        surfaces = sockets.evaluate_all('nodes=>nodes.map(node=>({socket:node.dataset.fittingSocket,color:getComputedStyle(node).backgroundColor}))')
        assert surfaces, 'No empty sockets to inspect'
        for surface in surfaces:
            channels = rgb(surface['color'])
            assert max(channels) - min(channels) <= 2, surface
            assert 32 <= sum(channels) / 3 <= 224, surface
        return surfaces

    def select_set(self, page, identity):
        panel = self.panel(page)
        category = self.category_for(identity)
        panel.locator(f'[data-workshop-category="{category}"]').click()
        if category == 'optional':
            toggle = panel.locator('[data-workshop-optional-toggle]')
            if toggle.get_attribute('aria-expanded') == 'false':
                toggle.click()
        panel.locator(f'[data-workshop-select-set="{identity}"]').click()
        expect(panel.locator(f'[data-workshop-select-set="{identity}"]')).to_have_attribute('aria-pressed', 'true')

    @staticmethod
    def dismiss_help(page):
        close = page.locator('[data-workshop-help-close]')
        if close.count():
            close.click()

    def entry(self, page, case):
        case['scroll'] = self.zones(page)
        panel = self.panel(page)
        expect(panel.locator('[data-workshop-category="shared"]')).to_have_attribute('aria-selected', 'true')
        state = self.state(page)
        assert state['run']['workshop']['activePart'] is None
        assert state['run']['workshop']['purchasedSets'] == []
        case['price'] = self.price(page)
        case['faces'] = self.faces(page, 0)
        self.capture(page, case, '01-era0-entry-zones', '段①・入場直後から分類、セット、パーツ、ピースの場所が分かる')
        before = self.state(page)
        panel.locator('[data-workshop-next] button').click()
        after = self.state(page)
        assert after['run']['workshop']['purchasedSets'] == ['common']
        assert before['resources']['pixels'] - after['resources']['pixels'] == 4_000
        assert len(after['run']['workshop']['parts']) == 4
        self.dismiss_help(page)
        # The new goal may select or spawn a piece; it must never charge this set again.
        next_button = panel.locator('[data-workshop-next] button')
        if next_button.count():
            next_button.click()
        repeated = self.state(page)
        assert repeated['resources'] == after['resources']
        assert repeated['run']['workshop']['purchasedSets'] == ['common']
        self.zones(page)
        case['checks'] = {'initialCategoryFollowsGoal': True, 'oneGoal': True, 'purchaseExactlyOnce': True}

    def production(self, page, case):
        self.zones(page)
        self.spawn(page, 'title')
        self.spawn(page, 'minimize')
        case['gray'] = self.neutral_sockets(page)
        self.capture(page, case, '05-gray-empty-sockets', '未装着のタイトル帯と各ボタンの窪みは灰色')
        self.fit(page, 'title', 'title')
        fitted_title = self.shell(page).locator('[data-fitting-piece="title"] .wf-piece-content').evaluate('node=>getComputedStyle(node).backgroundColor')
        assert max(rgb(fitted_title)) - min(rgb(fitted_title)) >= 64, fitted_title
        self.neutral_sockets(page)
        self.capture(page, case, '02-era0-production-zones', '段①・制作中もセットとパーツを隠さず、下にピースを置く')
        panel = self.panel(page)
        panel.evaluate('node=>node.scrollTop=0')
        sets = panel.locator('[data-workshop-zone="sets"]').bounding_box()
        tabs = panel.locator('[data-workshop-category="shared"]').bounding_box()
        self.select_part(page, 'common-button')
        panel.evaluate('node=>node.scrollTop=0')
        assert abs(panel.locator('[data-workshop-zone="sets"]').bounding_box()['y'] - sets['y']) < 1
        assert abs(panel.locator('[data-workshop-category="shared"]').bounding_box()['y'] - tabs['y']) < 1
        case['faces'] = self.faces(page, 0)
        case['checks'] = {'permanentZones': True, 'partSelectionDoesNotMoveSetsOrTabs': True,
                          'fittedPieceKeepsColor': True, 'emptySocketsNeutral': True}

    def optional(self, page, case):
        self.zones(page)
        panel = self.panel(page)
        panel.locator('[data-workshop-category="optional"]').click()
        toggle = panel.locator('[data-workshop-optional-toggle]')
        expect(toggle).to_be_visible()
        assert toggle.evaluate('node=>node.closest("[data-workshop-zone]").dataset.workshopZone') == 'sets'
        expect(toggle).to_have_attribute('aria-expanded', 'true')
        expected_sets = ['photo', 'bin', 'clock', 'theme', 'terminal', 'manager', 'extras', 'stream']
        for identity in expected_sets:
            expect(panel.locator(f'[data-workshop-select-set="{identity}"]')).to_have_count(1)
        self.capture(page, case, '03-era0-optional-tab', '段①・任意ツールの分類の中に開閉ボタンを置く')
        metrics = panel.evaluate('node=>({client:node.clientHeight,scroll:node.scrollHeight})')
        assert metrics['scroll'] > metrics['client'], metrics
        panel.evaluate('node=>node.scrollTop=300')
        sticky = panel.locator('[data-workshop-zone-heading="sets"]').evaluate('''node=>{
          const owner=node.closest('[data-workshop-panel-scroll]'),s=getComputedStyle(node);
          return {position:s.position,actual:node.getBoundingClientRect().top-owner.getBoundingClientRect().top,
                  expected:parseFloat(s.top),scrollTop:owner.scrollTop};
        }''')
        assert sticky['position'] == 'sticky' and sticky['scrollTop'] > 0, sticky
        assert abs(sticky['actual'] - sticky['expected']) <= 2, sticky
        panel.evaluate('node=>node.scrollTop=0')
        toggle.click()
        expect(panel.locator('[data-workshop-select-set]')).to_have_count(0)
        toggle.click()
        self.select_set(page, 'clock')
        expect(panel.locator('[data-workshop-part="clock-time"]')).to_be_disabled()
        case['sticky'] = sticky
        case['checks'] = {'allOptionalSetsHavePlaces': True, 'optionalToggleInOptionalTab': True,
                          'oneVerticalScroller': True, 'actualStickyHeader': True}

    def era1(self, page, case):
        self.zones(page)
        self.spawn(page, 'title')
        self.spawn(page, 'minimize')
        case['gray'] = self.neutral_sockets(page)
        case['faces'] = self.faces(page, 1)
        expect(page.locator('[data-workshop-layers]')).to_be_visible()
        self.capture(page, case, '04-era1-production-zones', '段②・暗色でも浮いた行、選択の朱色、沈んだ無効操作を区別')

    def import_for_reload(self, page):
        """Move an unchanged public fixture through the product's ordinary import UI."""
        with tempfile.TemporaryDirectory(prefix='world2-panel-import-') as directory:
            destination = Path(directory) / 'fixture.json'
            debug = page.locator('.debug-panel')
            debug.evaluate('node=>node.style.display="block"')
            with page.expect_download() as download:
                debug.locator('.debug-actions').last.locator('button').first.click()
            download.value.save_as(destination)
            page.goto(self.args.base_url + '?debug=1')
            page.on('dialog', lambda dialog: dialog.accept())
            intro = page.locator('.intro-note button')
            if intro.count():
                intro.click()
            debug = page.locator('.debug-panel')
            debug.locator('select').first.select_option(self.args.language)
            with page.expect_file_chooser() as chooser:
                debug.locator('.debug-actions').last.locator('button').nth(1).click()
            chooser.value.set_files(str(destination))
            expect(page.locator('[data-workshop]')).to_be_visible()
            debug.evaluate('node=>node.style.display="none"')

    def palette(self, page, case):
        self.import_for_reload(page)
        before = self.state(page)
        assert before['run']['workshop']['activePart'] is None
        palette = page.locator('[data-workshop-palette-target="background"]')
        color = '#1f3f7a'
        swatch = palette.locator(f'[data-workshop-background-color="{color}"]')
        expect(swatch).to_be_enabled()
        swatch.click()
        after = self.state(page)
        assert after['persistent']['editorCustomization']['background'] == color
        assert after['persistent']['editorCustomization']['nativeBackground'] is False
        assert after['resources'] == before['resources'] and part_designs(after) == part_designs(before)
        assert rgb(self.canvas(page).evaluate('node=>getComputedStyle(node).backgroundColor')) == [31, 63, 122]
        page.reload()
        expect(page.locator('[data-workshop]')).to_be_visible()
        page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
        reloaded = self.state(page)
        assert reloaded['persistent']['editorCustomization']['background'] == color
        assert part_designs(reloaded) == part_designs(after)
        assert reloaded['run']['workshop']['activePart'] is None
        self.panel(page).locator('[data-workshop-set="common"]').click()
        self.dismiss_help(page)
        self.select_part(page, 'common-frame')
        active_before = self.state(page)
        color = '#2f6b3a'
        palette.locator(f'[data-workshop-background-color="{color}"]').click()
        active_after = self.state(page)
        assert part_designs(active_before) == part_designs(active_after)
        assert active_after['resources'] == active_before['resources']
        assert active_after['persistent']['editorCustomization']['background'] == color
        self.capture(page, case, '06-palette-changes-background', 'メインパレットは作業台の背景だけを変える')
        page.locator('[data-workshop-action="openAdjustments"]').click()
        editor_before = active_after['persistent']['editorCustomization']
        page.locator('[data-workshop-customization] .ws-colors').first.locator('button[aria-label$=" #1f3f7a"]').click()
        adjusted = self.state(page)
        assert adjusted['persistent']['editorCustomization'] == editor_before
        assert adjusted['run']['workshop']['parts']['common-frame']['design'] != active_after['run']['workshop']['parts']['common-frame']['design']
        assert {key: design for key, design in part_designs(adjusted).items() if key != 'common-frame'} == {key: design for key, design in part_designs(active_after).items() if key != 'common-frame'}
        self.close_adjustments(page)
        case['checks'] = {'backgroundWorksWithoutSelectedPart': True, 'normalImportAndReloadPreservesBackground': True,
                          'palettePreservesEveryPartDesignAndWallet': True,
                          'adjustmentChangesOnlySelectedPart': True, 'background': color}

    def legacy_palette(self, page, case):
        self.palette(page, case)
        case['checks']['legacyRenderer'] = True

    def gray_catalog(self, page, case):
        source = (ROOT / 'game/src/content/workshopCatalog.ts').read_text()
        parts = [identity for identity in re.findall(r"make\(\s*'([^']+)'", source) if identity != 'common-scrollbar']
        assert len(parts) == 52, len(parts)
        inspection = []
        case['surfaces'] = inspection
        for era in (0, 1):
            for streaming in (False, True):
                fixture = f'stage8b-stream-draft-era{era}' if streaming else f'stage8a-catalog-era{era}'
                context, catalog_page = self.open(fixture, case)
                try:
                    self.dismiss_help(catalog_page)
                    for identity in parts:
                        if identity.startswith('stream-') != streaming:
                            continue
                        set_id = 'extras' if identity.startswith('plugin-') else identity.split('-')[0]
                        self.select_set(catalog_page, set_id)
                        self.select_part(catalog_page, identity)
                        surfaces = self.neutral_sockets(catalog_page)
                        inspection.append({'era': era, 'part': identity, 'sockets': surfaces})
                    print('CHECK', self.args.language, 'gray sockets', era,
                          'stream' if streaming else 'catalog', len(inspection), flush=True)
                finally:
                    context.close()
        assert len(inspection) == 104, len(inspection)
        case['checks'] = {'all52PartsInBothEras': True, 'inspected': len(inspection)}
        case['surfaces'] = inspection

    def run_case(self, name, language):
        self.args.language = language
        fixture = {'entry': 'fitting-entry-era0', 'production': 'fitting-frame-era0',
                   'optional': 'fitting-entry-era0', 'era1': 'fitting-frame-era1',
                   'palette': 'fitting-entry-era0', 'gray-catalog': 'fitting-entry-era0',
                   'legacy-palette': 'stage8a-entry-era2'}[name]
        case = {'id': f'{language}:{name}', 'language': language, 'fixture': fixture, 'status': 'running',
                'images': [], 'pageErrors': [], 'console': [], 'externalRequests': []}
        if name == 'legacy-palette':
            case['noImages'] = True
        self.report['cases'].append(case)
        context = page = None
        try:
            context, page = self.open(fixture, case)
            getattr(self, name.replace('-', '_'))(page, case)
            assert not case['pageErrors'], case['pageErrors']
            assert not case['console'], case['console']
            assert not case['externalRequests'], case['externalRequests']
            case['status'] = 'passed'
            print('PASS', case['id'], flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            if page:
                self.capture(page, case, f'failure-{language}-{name}', '確認中の問題')
            print('FAIL', case['id'], str(error), flush=True)
            if not self.args.keep_going:
                raise
        finally:
            if context:
                context.close()
            self.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8173/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-panel'))
    parser.add_argument('--language', action='append', choices=('ja', 'en', 'en-XA'), dest='languages')
    parser.add_argument('--case', action='append', choices=CASES, dest='cases')
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--no-screenshots', action='store_true')
    parser.add_argument('--keep-going', action='store_true')
    args = parser.parse_args()
    args.base_url = args.base_url.rstrip('/') + '/'
    preflight(args.base_url)
    args.languages = args.languages or ['ja', 'en']
    args.language, args.width, args.height, args.reduced_motion, args.skip_upgrade = args.languages[0], 1920, 1080, False, True
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
        try:
            review = PanelReview(args, browser)
            for language in args.languages:
                for case in args.cases or CASES:
                    review.run_case(case, language)
            if not args.cases and 'en-XA' not in args.languages:
                review.run_case('entry', 'en-XA')
            if review.report['failed']:
                raise SystemExit(1)
            for path in (review.out / 'screenshots').glob('failure-*.png'):
                path.unlink()
        finally:
            browser.close()


if __name__ == '__main__':
    main()
