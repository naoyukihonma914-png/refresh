"""World 2 acceptance through the real controls of the built, single-file game.

Build game/, serve game/dist, then run:
  python tools/check_world2_fitting.py --base-url http://127.0.0.1:8173/

Only documented fixed-state URLs set up gameplay. The debug panel is used solely
to select a language and download a read-only state snapshot. No JavaScript game
state injection, debug currency, or synthetic reducer calls are used.
"""
import argparse
import hashlib
import html
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CASES = ('frame', 'era1', 'mail', 'entry', 'partial')


class FittingReview:
    def __init__(self, args, browser):
        self.args, self.browser = args, browser
        self.out = Path(args.output_dir).resolve()
        self.out.mkdir(parents=True, exist_ok=True)
        if not args.no_screenshots:
            (self.out / 'screenshots').mkdir(exist_ok=True)
        build = ROOT / 'game/dist/index.html'
        self.report = {
            'viewport': {'width': args.width, 'height': args.height},
            'language': args.language,
            'reducedMotion': args.reduced_motion,
            'baseUrl': args.base_url,
            'buildSha256': hashlib.sha256(build.read_bytes()).hexdigest(),
            'setup': 'public fixed fixtures; real controls; frozen browser clock; debug export is read-only',
            'references': ['docs/mockups/02-1-tessera-aseprite-old.html',
                           'docs/mockups/02-2-tessera-aseprite-new.html'],
            'cases': [],
        }

    def save(self):
        cases = self.report['cases']
        self.report.update(passed=sum(c['status'] == 'passed' for c in cases),
                           failed=sum(c['status'] == 'failed' for c in cases))
        (self.out / 'summary.json').write_text(json.dumps(self.report, ensure_ascii=False, indent=2) + '\n')
        cards = []
        for case in cases:
            pictures = ''.join('<a href="' + html.escape(image['file']) + '"><img src="' +
                               html.escape(image['file']) + '"><span>' + html.escape(image['label']) +
                               '</span></a>' for image in case['images'])
            error = '<pre>' + html.escape(case['error']) + '</pre>' if case.get('error') else ''
            cards.append('<section><h2>' + html.escape(case['id']) + ': ' + case['status'] +
                         '</h2>' + error + '<div>' + pictures + '</div></section>')
        (self.out / 'index.html').write_text(
            '<!doctype html><html lang="ja"><meta charset="utf-8"><title>世界2 はめる制作の確認</title>'
            '<style>body{font:14px/1.5 sans-serif;background:#eee;color:#222;margin:20px}'
            'h1{font-size:22px}h2{font-size:17px}section>div{display:grid;'
            'grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:12px}'
            'a{display:block;color:#222;background:#fff;border:1px solid #aaa;padding:6px}'
            'img{display:block;width:100%}pre{white-space:pre-wrap;color:#900}</style>'
            '<h1>世界2：実操作・保存・段アップ</h1>' + ''.join(cards) + '</html>')

    def open(self, fixture, case):
        context = self.browser.new_context(viewport=self.report['viewport'], locale=self.args.language,
                                           timezone_id='Asia/Tokyo', accept_downloads=True,
                                           reduced_motion='reduce' if self.args.reduced_motion else 'no-preference')

        def route(request):
            url = request.request.url
            if url.startswith(self.args.base_url) or url.startswith(('data:', 'blob:')):
                request.continue_()
            else:
                case['externalRequests'].append(url)
                request.abort()

        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(12_000)
        page.on('pageerror', lambda error: case['pageErrors'].append(error.stack or str(error)))

        def console(message):
            if message.type in ('error', 'warning', 'assert') and not message.location.get('url', '').endswith('/favicon.ico'):
                case['console'].append({'type': message.type, 'text': message.text})

        page.on('console', console)
        now = datetime(2026, 11, 3, tzinfo=timezone.utc)
        page.clock.install(time=now)
        page.clock.pause_at(now + timedelta(minutes=1))
        page.goto(self.args.base_url + '?' + urlencode({'state': fixture, 'debug': 1}))
        panel = page.locator('.debug-panel')
        panel.locator('select').first.select_option(self.args.language)
        panel.evaluate('node=>node.style.display="none"')
        page.evaluate('document.fonts.ready')
        page.clock.run_for(100)
        expect(page.locator('[data-workshop]')).to_be_visible()
        if self.args.reduced_motion:
            assert page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')
            expect(self.canvas(page).locator('[data-fitting-board]')).to_have_attribute('data-reduced-motion', 'true')
        return context, page

    @staticmethod
    def state(page):
        panel = page.locator('.debug-panel')
        panel.evaluate('node=>node.style.display="block"')
        try:
            with page.expect_download() as download:
                panel.locator('.debug-actions').last.locator('button').first.click()
            return json.loads(Path(download.value.path()).read_text())
        finally:
            panel.evaluate('node=>node.style.display="none"')

    def capture(self, page, case, filename, label):
        if self.args.no_screenshots:
            return
        target = self.out / 'screenshots' / (filename + '.png')
        page.screenshot(path=str(target), full_page=False)
        case['images'].append({'file': str(target.relative_to(self.out)), 'label': label})

    @staticmethod
    def canvas(page):
        return page.locator(".ws-production-area > .wf-workbench-scroll").first

    @staticmethod
    def shell(page):
        return FittingReview.canvas(page).locator('.wf-part-shell.is-active')

    @staticmethod
    def box(locator):
        result = locator.bounding_box()
        assert result and result['width'] > 0 and result['height'] > 0, 'Control has no visible bounds'
        return result

    def drag(self, page, piece, socket=None, detach=False):
        scope = self.shell(page) if detach else self.canvas(page)
        source = scope.locator(f'[data-fitting-piece="{piece}"][data-piece-status="{"fitted" if detach else "spawned"}"]')
        expect(source).to_be_visible()
        source.scroll_into_view_if_needed()
        if detach:
            source.hover()
            source = source.locator('[data-fitting-grip]')
        target = self.canvas(page).locator('[data-fitting-tray]') if detach else self.shell(page).locator(f'[data-fitting-socket="{socket}"]')
        target.scroll_into_view_if_needed()
        a, b = self.box(source), self.box(target)
        page.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2)
        page.mouse.down()
        page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2, steps=12)
        page.mouse.up()

    def spawn(self, page, piece):
        button = page.locator(f'[data-workshop-piece="{piece}"]')
        expect(button).to_be_enabled()
        button.click()
        expect(self.canvas(page).locator(f'[data-fitting-piece="{piece}"][data-piece-status="spawned"]')).to_be_visible()

    def fit(self, page, piece, socket):
        if page.locator(f'[data-workshop-piece="{piece}"]').is_enabled():
            self.spawn(page, piece)
        self.drag(page, piece, socket)
        expect(self.shell(page).locator(f'[data-fitting-piece="{piece}"][data-piece-status="fitted"]')).to_be_visible()
        expect(self.shell(page).locator(f'[data-fitting-piece="{piece}"][data-piece-status="fitted"]')).to_have_attribute('data-fitting-seat', socket)

    def select_part(self, page, part):
        page.locator(f'[data-workshop-part="{part}"]').first.click()
        expect(self.canvas(page).locator(f'[data-fitting-shell="{part}"]')).to_be_visible()

    @staticmethod
    def close_adjustments(page):
        page.locator('[data-workshop-customization] header button').click()
        expect(page.locator('[data-workshop-customization]')).to_have_count(0)

    def shell_geometry(self, page, era):
        w = page.locator('[data-workshop]')
        panel = w.locator('[data-workshop-parts-panel],.editor-shell-parts')
        if not panel.count():
            panel = w.locator('.ws-panel-parts')
        measurements = self.canvas(page).locator('[data-fitting-board]').evaluate('node=>({width:node.getBoundingClientRect().width,logical:node.offsetWidth})')
        measurements['panelWidth'] = panel.first.evaluate('node=>parseFloat(getComputedStyle(node).width)')
        measurements['era'] = era
        expected_width = (320, 288)[era]
        assert abs(measurements['panelWidth'] - expected_width) <= 3, measurements
        state = self.state(page)
        measurements['manualZoom'] = state['run']['workshop']['zoom']
        measurements['effectiveScale'] = measurements['width'] / measurements['logical']
        measurements['viewportScale'] = w.evaluate('node=>node.getBoundingClientRect().width/node.clientWidth')
        measurements['eraScale'] = measurements['effectiveScale'] / measurements['manualZoom'] / measurements['viewportScale']
        assert abs(measurements['eraScale'] - (.85, 1)[era]) < .025, measurements
        if not self.args.skip_upgrade:
            options = page.locator('[data-workshop-zoom] option').evaluate_all('nodes=>nodes.map(node=>node.value)')
            numeric = [float(value) for value in options if value != 'fit']
            if era == 0:
                assert numeric == [.5, .85, 1] and 'fit' not in options, options
            else:
                assert len(numeric) > 3 and 'fit' in options, options
            measurements['zoomOptions'] = options
        return measurements

    def common_frame_geometry(self, page):
        canvas = self.canvas(page)
        expect(canvas.locator('.wf-target-title')).to_have_count(0)
        expect(canvas.locator('.wf-frame-title-surface')).to_have_count(1)
        geometry = canvas.evaluate('''node=>{
          const frame=node.querySelector('[data-fitting-shell="common-frame"]');
          const bounds=frame.getBoundingClientRect(),content=frame.querySelector('.wf-frame-content').getBoundingClientRect();
          const children=[...node.querySelectorAll('.wf-part-shell:not(.wf-frame-shell)')]
            .map(part=>part.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
          return {contentTop:content.top-bounds.top,
                  childBottom:Math.max(0,...children.map(rect=>rect.bottom-bounds.top)),
                  childCount:children.length};
        }''')
        assert geometry['childCount'] > 0, geometry
        assert geometry['contentTop'] + 1 >= geometry['childBottom'], geometry
        return geometry

    def frame(self, page, case):
        page.locator('[data-workshop-action="backToParts"]').click()
        page.locator('[data-workshop-action="backToSets"]').click()
        expect(page.locator('[data-workshop-panel-view]')).to_have_attribute('data-workshop-panel-view', 'sets')
        self.capture(page, case, '01-era0-set-list', '段①・UIセット一覧')
        page.locator('[data-workshop-set="common"]').click()
        self.select_part(page, 'common-frame')
        before = self.state(page)
        self.spawn(page, 'title')
        self.spawn(page, 'minimize')
        spawned = self.state(page)
        assert spawned['resources'] == before['resources'], 'Spawning must not pay or install a piece'
        assert spawned['run']['workshop']['parts']['common-frame']['elements'] == [], 'Spawn auto-fitted a piece'
        self.capture(page, case, '02-era0-frame-work-in-progress', '段①・窓枠の窪みと出現中のピース')
        self.drag(page, 'title', 'scrollbar')
        invalid = self.state(page)
        assert invalid['resources'] == spawned['resources'], 'An incompatible drop paid pixels'
        assert invalid['run']['workshop']['parts']['common-frame']['elements'] == []
        page.locator('[data-workshop-action="openAdjustments"]').click()
        expect(page.locator('[data-workshop-customization]')).to_be_visible()
        self.capture(page, case, '03-era0-adjustments', '段①・任意の調整だけを開く')
        self.close_adjustments(page)
        case['geometry'] = self.shell_geometry(page, 0)
        order = [('title', 'title'), ('minimize', 'control-2'), ('maximize', 'control-0'), ('close', 'control-1'), ('scrollbar', 'scrollbar')]
        for piece, socket in order:
            self.fit(page, piece, socket)
        page.clock.run_for(1)
        expect(page.locator('[data-workshop-completion="common-frame"]')).to_be_visible()
        if self.args.reduced_motion:
            expect(page.locator('[data-workshop-rate-flight="common-frame"]')).to_have_count(0)
        else:
            expect(page.locator('[data-workshop-rate-flight="common-frame"]')).to_be_visible()
        self.capture(page, case, '05-completion-flight', '完成した毎秒の値が上部の合計へ飛ぶ')
        made = self.state(page)
        production = made['run']['workshop']['parts']['common-frame']
        assert production['step'] == 4 and production['completedAt'] is not None
        assert production['fitting']['sockets']['minimize'] == 'control-2'
        self.shell(page).locator('[data-fitting-piece="minimize"] [data-workshop-control="minimize"]').click()
        expect(page.locator('[data-workshop-action="restoreTarget"]')).to_be_visible()
        page.locator('[data-workshop-action="restoreTarget"]').click()
        normal = self.box(self.canvas(page).locator('[data-workshop-target]'))
        self.shell(page).locator('[data-fitting-piece="maximize"] [data-workshop-control="maximize"]').click()
        maximized = self.box(self.canvas(page).locator('[data-workshop-target]'))
        assert maximized['width'] > normal['width'], 'Swapped maximize piece did not maximize'
        self.shell(page).locator('[data-fitting-piece="maximize"] [data-workshop-control="maximize"]').click()
        assert abs(self.box(self.canvas(page).locator('[data-workshop-target]'))['width'] - normal['width']) < 1
        self.shell(page).locator('[data-fitting-piece="close"] [data-workshop-control="close"]').click()
        expect(self.canvas(page).locator('[data-workshop-target]')).to_have_count(0)
        page.locator('[data-workshop-action="restoreTarget"]').click()
        before_refit = self.state(page)
        self.drag(page, 'close', detach=True)
        expect(self.canvas(page).locator('[data-fitting-piece="close"][data-piece-status="spawned"]')).to_be_visible()
        self.fit(page, 'close', 'control-1')
        after_refit = self.state(page)
        assert after_refit['resources'] == before_refit['resources'], 'Removal/refitting paid twice'
        assert after_refit['run']['workshop']['parts']['common-frame']['completedAt'] == production['completedAt']
        assert after_refit['run']['workshop']['parts']['common-frame']['exportedAt'] == production['exportedAt']
        content = self.canvas(page).locator('.wf-frame-content')
        old_scroll = content.evaluate('node=>node.scrollTop')
        self.canvas(page).locator('.wf-frame-scroll-rail>button').last.click()
        new_scroll = content.evaluate('node=>node.scrollTop')
        assert new_scroll > old_scroll, 'Fitted scrollbar did not move the real destination content'
        case['checks'] = {'spawnOnly': True, 'incompatibleDropNoReward': True, 'sharedControlIdentity': True,
                          'completionFlight': True, 'detachRefitExactWalletAndDates': True,
                          'actualScroll': {'before': old_scroll, 'after': new_scroll}}
        if not self.args.skip_upgrade:
            self.upgrade(page, case)

    def upgrade(self, page, case):
        before_export = self.state(page)
        page.locator('[data-workshop-action="export"]').click()
        after_export = self.state(page)
        assert after_export['resources']['tokens'] == before_export['resources']['tokens'] + 1
        guide = after_export['run']['workshop']['guide']
        assert guide['current'] == 'updateAvailable', guide
        expect(page.locator('[data-workshop-next-hand="update"]')).to_be_visible()
        self.drag(page, 'close', detach=True)
        self.fit(page, 'close', 'control-1')
        refitted = self.state(page)
        assert refitted['resources'] == after_export['resources']
        for key in ('completedAt', 'exportedAt'):
            assert refitted['run']['workshop']['parts']['common-frame'][key] == after_export['run']['workshop']['parts']['common-frame'][key]
        page.locator('[data-workshop-action="plugins"]').click()
        update = page.locator('[data-workshop-skill="update"]')
        expect(update).to_be_disabled()
        assert after_export['resources']['tokens'] == 1, after_export['resources']
        page.locator('.ws-plugin-dialog header button').click()
        self.select_part(page, 'common-button')
        case['checks']['commonFrameContainsWidgets'] = self.common_frame_geometry(page)
        self.fit(page, 'label', 'label')
        self.select_part(page, 'common-heading')
        case['checks']['commonFrameContainsWidgets'] = self.common_frame_geometry(page)
        self.fit(page, 'label', 'label')
        self.fit(page, 'separator', 'separator')
        page.locator('[data-workshop-action="export"]').click()
        ready = self.state(page)
        assert ready['resources']['tokens'] == 3, ready['resources']
        # Let earlier completion paint finish before photographing the upgrade.
        # This advances ordinary gameplay time; it does not alter the saved state directly.
        page.clock.run_for(2_000)
        page.locator('[data-workshop-action="plugins"]').click()
        expect(update).to_be_enabled()
        update.click()
        page.locator('.ws-plugin-dialog header button').click()
        upgraded = self.state(page)
        assert upgraded['resources']['tokens'] == ready['resources']['tokens'] - 3
        assert 'update' in upgraded['persistent']['editorSkills']
        assert upgraded['persistent']['appearance']['editor'] == 1
        self.capture(page, case, '06-just-after-update', '初回エクスポートの案内から実際にアップデートした直後')
        case['upgradeGeometry'] = self.shell_geometry(page, 1)
        self.select_part(page, 'common-progress')
        self.fit(page, 'track', 'track')
        self.fit(page, 'fill', 'fill')
        self.fit(page, 'percent', 'percent')
        upgraded_part = self.state(page)['run']['workshop']['parts']['common-progress']
        assert upgraded_part.get('createdStage') == 1, upgraded_part
        completed = page.locator('[data-workshop-completion="common-progress"]')
        expect(completed).to_be_visible()
        part_rate = float(completed.get_attribute('data-workshop-completion-part-rate'))
        assert abs(part_rate - 9 * 1.15) < 1e-9, part_rate
        case['checks']['realUpgrade'] = {'tokenCost': 3, 'oneTokenDisabled': True,
                                       'earnedTokensBeforePurchase': ready['resources']['tokens'],
                                       'newPartCreatedStage': upgraded_part['createdStage'],
                                       'newPartRate': part_rate, 'newPartMultiplier': 1.15}

    def era1(self, page, case):
        self.spawn(page, 'title')
        self.spawn(page, 'minimize')
        case['geometry'] = self.shell_geometry(page, 1)
        layers = page.locator('[data-workshop-layers],.ws-layer-strip,.ws-timeline-layers')
        assert any(layers.nth(i).is_visible() for i in range(layers.count())), 'Era 2 has no visible layer row'
        self.capture(page, case, '04-era1-frame-and-layers', '段②・同じ制作場面と増えたレイヤーの行')
        before_layers = self.state(page)
        page.locator('[data-workshop-layer="shell"]').uncheck()
        expect(self.canvas(page).locator('[data-fitting-socket]')).to_have_count(0)
        page.locator('[data-workshop-layer="shell"]').check()
        expect(self.canvas(page).locator('[data-fitting-socket]')).to_have_count(5)
        page.locator('[data-workshop-layer="pieces"]').uncheck()
        expect(self.canvas(page).locator('[data-fitting-piece]')).to_have_count(0)
        page.locator('[data-workshop-layer="pieces"]').check()
        expect(self.canvas(page).locator('[data-fitting-piece][data-piece-status="spawned"]')).to_have_count(2)
        after_layers = self.state(page)
        assert after_layers['resources'] == before_layers['resources']
        assert after_layers['run']['workshop']['parts'] == before_layers['run']['workshop']['parts']
        # OFF only removes guidance. Structural sockets remain fully available.
        page.locator('.ws-menu-actions>button').nth(1).click()
        page.locator('[data-examples-input]').uncheck()
        page.locator('.ws-page-scroll>button').first.click()
        expect(self.canvas(page).locator('[data-fitting-socket]')).to_have_count(5)
        expect(page.locator('[data-example-next],[data-workshop-next-hand]')).to_have_count(0)
        expect(self.canvas(page).locator('.wf-socket.is-next')).to_have_count(0)
        self.fit(page, 'minimize', 'control-2')
        case['checks'] = {'layersVisible': True, 'layerVisibilityOnly': True,
                          'examplesOffKeepsSockets': True, 'examplesOffStillFits': True}

    def mail(self, page, case):
        self.spawn(page, 'sender')
        self.spawn(page, 'subject')
        self.fit(page, 'sender', 'sender')
        wrong = self.state(page)
        self.drag(page, 'subject', 'date')
        assert self.state(page)['resources'] == wrong['resources']
        self.capture(page, case, '07-mail-columns-work-in-progress', 'メールセット・異なる幅の列ピースを制作中')
        self.fit(page, 'subject', 'subject')
        self.fit(page, 'date', 'date')
        self.shell(page).locator('[data-fitting-piece="subject"][data-piece-status="fitted"] button').first.click()
        expect(self.shell(page).locator('[data-fitting-piece="subject"][data-piece-status="fitted"] button[aria-pressed="true"]')).to_have_count(1)
        case['checks'] = {'dedicatedColumnSeats': True, 'fittedColumnSelectsRealMessage': True}

    def entry(self, page, case):
        expect(page.locator('[data-workshop-panel-view]')).to_have_attribute('data-workshop-panel-view', 'sets')
        expect(self.canvas(page).locator('[data-fitting-shell]')).to_have_count(0)
        expect(page.locator('[data-workshop-set="common"]')).to_be_visible()
        assert self.state(page)['run']['workshop']['purchasedSets'] == []
        self.capture(page, case, '08-era0-world-entry', '段①・世界に入った直後、最初のUIセットだけが入口になる')
        case['checks'] = {'noAutomaticPurchasedSet': True, 'firstSetVisible': True}

    def partial(self, page, case):
        self.fit(page, 'query', 'query')
        query = self.shell(page).locator('[data-fitting-piece="query"][data-piece-status="fitted"] input')
        query.fill('Tessera')
        expect(query).to_have_value('Tessera')
        assert self.state(page)['run']['workshop']['parts']['files-search']['step'] == 1
        case['checks'] = {'unfinishedSearchInputWorks': True}
        context, slider_page = self.open('stage8a-part-photo-brightness-step-0-era0', case)
        try:
            self.fit(slider_page, 'thumb', 'thumb')
            slider = self.shell(slider_page).locator('[data-fitting-piece="thumb"][data-piece-status="fitted"] input[type="range"]')
            maximum = slider.get_attribute('max')
            slider.fill(maximum)
            expect(slider).to_have_value(maximum)
            assert self.state(slider_page)['run']['workshop']['parts']['photo-brightness']['step'] == 1
            case['checks']['unfinishedSliderWorks'] = True
        finally:
            context.close()

    def run(self, name):
        fixture = {'frame': 'fitting-frame-era0', 'era1': 'fitting-frame-era1',
                   'mail': 'fitting-mail-era0', 'entry': 'fitting-entry-era0',
                   'partial': 'stage8a-part-files-search-step-0-era0'}[name]
        case = {'id': name, 'fixture': fixture, 'status': 'running', 'images': [],
                'pageErrors': [], 'console': [], 'externalRequests': []}
        self.report['cases'].append(case)
        context = page = None
        try:
            context, page = self.open(fixture, case)
            getattr(self, name)(page, case)
            assert not case['pageErrors'], case['pageErrors']
            assert not case['console'], case['console']
            assert not case['externalRequests'], case['externalRequests']
            case['status'] = 'passed'
            print('PASS', name, flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            if page:
                self.capture(page, case, 'failure-' + name, '確認中の問題')
            print('FAIL', name, str(error), flush=True)
            if not self.args.keep_going:
                raise
        finally:
            if context:
                context.close()
            self.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8173/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-fitting'))
    parser.add_argument('--language', choices=('ja', 'en', 'en-XA'), default='ja')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    parser.add_argument('--reduced-motion', action='store_true')
    parser.add_argument('--case', action='append', choices=CASES, dest='cases')
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--skip-upgrade', action='store_true', help='W2-1/W2-2 smoke check before W2-3 exists')
    parser.add_argument('--no-screenshots', action='store_true', help='Exercise controls without creating screenshot artifacts')
    parser.add_argument('--keep-going', action='store_true')
    args = parser.parse_args()
    args.base_url = args.base_url.rstrip('/') + '/'
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
        try:
            review = FittingReview(args, browser)
            for case in args.cases or CASES:
                review.run(case)
            if review.report['failed']:
                raise SystemExit(1)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
