"""PR29 round 3: real selection, gray controls and socket-sized loose/dragged pieces.

Build game/ and serve game/dist on localhost first. Fixtures only establish
starting states; all spawning, fitting, zooming and customization use real UI.
"""
import argparse
import re
from urllib.parse import urlencode

from playwright.sync_api import expect, sync_playwright

from check_world2_fitting import ROOT, preflight
from check_world2_panel import PanelReview


class Round3Review(PanelReview):
    def dimensions(self, page, piece):
        source = self.canvas(page).locator(f'.wf-loose-piece[data-fitting-piece="{piece}"]')
        compatible = (f'[data-socket-accepts="{piece}"], [data-socket-accepts^="{piece},"], '
                      f'[data-socket-accepts$=",{piece}"], [data-socket-accepts*=",{piece},"]')
        empty = self.shell(page).locator(f':is({compatible}):not([data-socket-filled])')
        socket = empty.first if empty.count() else self.shell(page).locator(compatible).first
        a, b = self.box(source), self.box(socket)
        for axis in ('width', 'height'):
            assert abs(a[axis] - b[axis]) < .1, (piece, axis, a, b)
        return source, socket, a, b

    def gray_controls(self, page):
        controls = self.canvas(page).locator('[data-workshop-control="minimize"],'
                                            '[data-workshop-control="maximize"],'
                                            '[data-workshop-control="close"]')
        faces = controls.evaluate_all('''nodes=>nodes.map(node=>{const s=getComputedStyle(node);
          return {background:s.backgroundColor,color:s.color,opacity:s.opacity};})''')
        assert faces and all(face == {'background': 'rgb(192, 192, 192)', 'color': 'rgb(16, 16, 16)',
                                     'opacity': '1'} for face in faces), faces
        return faces

    def held(self, page, piece, case, capture=False, fit=False):
        source, socket, _, _ = self.dimensions(page, piece)
        source.scroll_into_view_if_needed()
        a = self.box(source)
        # An off-center grab proves that pickup preserves the exact grab position.
        x, y = a['x'] + a['width'] * .4, a['y'] + a['height'] * .4
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 10, y + 8, steps=2)
        ghost = self.canvas(page).locator(f'[data-fitting-drag="{piece}"]')
        expect(ghost).to_be_visible()
        g = self.box(ghost)
        assert abs(g['x'] - a['x'] - 10) < .1 and abs(g['y'] - a['y'] - 8) < .1, (a, g)
        for axis in ('width', 'height'):
            assert abs(g[axis] - a[axis]) < .1, (piece, axis, a, g)
        if fit or capture:
            socket.scroll_into_view_if_needed()
            b = self.box(socket)
            page.mouse.move(b['x'] + b['width'] * .4, b['y'] + b['height'] * .4, steps=8)
            g = self.box(ghost)
            for axis in ('width', 'height'):
                assert abs(g[axis] - b[axis]) < .1, (piece, axis, g, b)
            if capture:
                # Keep the ghost adjacent to the empty socket for a direct comparison.
                page.mouse.move(b['x'] - b['width'] * 1.2, b['y'] + b['height'] * .4, steps=3)
                self.gray_controls(page)
                self.capture(page, case, '04-small-piece-drag', '最小化ピースと窪みはドラッグ中も同寸')
                page.mouse.move(b['x'] + b['width'] * .4, b['y'] + b['height'] * .4, steps=3)
        page.mouse.up()
        if fit:
            expect(self.shell(page).locator(f'.wf-fitted-piece[data-fitting-piece="{piece}"]')).to_be_visible()
        return {'piece': piece, 'width': g['width'], 'height': g['height']}

    def selection(self, page, era):
        panel = self.panel(page)
        self.faces(page, era)
        measurements = panel.locator('[data-navigation-part]').evaluate_all('''nodes=>nodes.map(node=>({
          part:node.dataset.navigationPart,selected:node.dataset.selected,filter:getComputedStyle(node).filter,
          border:getComputedStyle(node.querySelector('button')).borderTopColor}))''')
        assert sum(row['selected'] == 'true' for row in measurements) == 1, measurements
        for row in measurements:
            assert row['filter'] == 'none' if row['selected'] == 'true' else 'brightness(0.72)' in row['filter'], row
        return measurements

    def display(self, page, case, era):
        self.dismiss_help(page)
        self.select_part(page, 'common-button')
        case['selection'] = self.selection(page, era)
        self.capture(page, case, '01-part-selection' if era == 0 else '05-era1-selection',
                     '段①・選んだパーツ以外を暗く表示' if era == 0 else '段②・同じゾーン内の非選択行を暗く表示')
        if era:
            return
        self.panel(page).locator('[data-workshop-category="required"]').click()
        self.faces(page, 0)
        sets = self.panel(page).locator('[data-navigation-set]').evaluate_all('''nodes=>nodes.map(node=>({
          selected:node.dataset.selected,filter:getComputedStyle(node).filter}))''')
        assert sum(row['selected'] == 'true' for row in sets) == 1
        assert all(row['filter'] == 'none' if row['selected'] == 'true' else 'brightness(0.72)' in row['filter'] for row in sets)
        self.capture(page, case, '02-category-selection', '分類タブとセットの各ゾーンで選択中だけ通常の明るさ')
        self.panel(page).locator('[data-workshop-category="shared"]').click()
        self.select_part(page, 'common-frame')
        for piece in ('title', 'minimize', 'maximize', 'close', 'scrollbar'):
            self.spawn(page, piece)
        self.gray_controls(page)
        selected_pieces = self.panel(page).locator('.ws-fitting-piece-list')
        expect(selected_pieces).to_have_attribute('data-has-selection', 'true')
        expect(selected_pieces.locator('[aria-pressed="true"]')).to_have_attribute('data-workshop-piece', 'scrollbar')
        case['sizes'] = []
        for piece in ('title', 'minimize', 'maximize', 'close', 'scrollbar'):
            case['sizes'].append(self.held(page, piece, case, capture=piece == 'minimize', fit=True))
        case['controls'] = self.gray_controls(page)
        self.canvas(page).evaluate('node=>node.scrollTop=0')
        page.mouse.move(1250, 800)
        page.clock.run_for(1500)
        self.capture(page, case, '03-fitted-gray-controls', '灰色の最小化・最大化・閉じるボタンと濃紺のタイトル帯')
        page.locator('[data-workshop-action="openAdjustments"]').click()
        adjustments = page.locator('[data-workshop-customization]')
        expect(adjustments.locator('.ws-window-controls-editor')).to_have_count(0)
        adjustments.locator('.ws-colors').first.locator('button[aria-label$=" #1f3f7a"]').click()
        self.close_adjustments(page)
        case['customTitleControls'] = self.gray_controls(page)
        title = self.shell(page).locator('.wf-element-title')
        assert title.evaluate('node=>getComputedStyle(node).backgroundColor') == 'rgb(31, 63, 122)'

    def catalog(self, page, case):
        parts = [identity for identity in re.findall(r"make\(\s*'([^']+)'", (ROOT / 'game/src/content/workshopCatalog.ts').read_text())
                 if identity != 'common-scrollbar']
        assert len(parts) == 52
        if self.args.parts:
            assert set(self.args.parts).issubset(parts)
            parts = [identity for identity in parts if identity in self.args.parts]
        case['parts'] = parts
        case['sizes'] = []
        for identity in parts:
            streaming = identity.startswith('stream-')
            fixture = 'stage8b-stream-draft-era0' if streaming else f'stage8a-part-{identity}-step-0-era0'
            page.goto(self.args.base_url + '?' + urlencode({'state': fixture, 'debug': 1}))
            page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
            page.clock.run_for(100)
            self.dismiss_help(page)
            if streaming:
                page.locator('.desktop-window[data-app="tessera"] > .window-title [data-window-symbol="maximize"]').click()
                page.locator('[data-workshop-zoom]').select_option('0.5')
                page.locator('[data-fitting-preview]>header>button').click()
                preview = page.locator('[data-fitting-preview]')
                expect(preview).to_have_attribute('data-collapsed', 'true')
                assert preview.evaluate('node=>node.clientHeight') == preview.locator('header').evaluate('node=>node.offsetHeight')
                self.select_set(page, 'stream')
                self.select_part(page, identity)
            expect(self.shell(page)).to_have_attribute('data-fitting-shell', identity)
            pieces = self.panel(page).locator('[data-workshop-piece]').evaluate_all('nodes=>nodes.map(node=>node.dataset.workshopPiece)')
            for piece in pieces:
                if self.shell(page).locator(f'.wf-fitted-piece[data-fitting-piece="{piece}"]').count():
                    self.drag(page, piece, detach=True)
                if self.panel(page).locator(f'[data-workshop-piece="{piece}"]').is_enabled():
                    self.spawn(page, piece)
            for piece in pieces:
                result = self.held(page, piece, case)
                case['sizes'].append({'part': identity, **result})
            print('CHECK socket-sized pieces', identity, len(case['sizes']), flush=True)

    def zooms(self, page, case):
        self.dismiss_help(page)
        for piece in ('title', 'minimize', 'maximize', 'close', 'scrollbar'):
            self.spawn(page, piece)
        case['sizes'] = []
        for zoom in ('0.5', '1', '1.5'):
            page.locator('[data-workshop-zoom]').select_option(zoom)
            for piece in ('title', 'minimize', 'maximize', 'close', 'scrollbar'):
                case['sizes'].append({'zoom': zoom, **self.held(page, piece, case)})
        # Fitted maximization adds another transform; loose pieces and their content follow it too.
        self.held(page, 'maximize', case, fit=True)
        self.shell(page).locator('[data-workshop-control="maximize"]').click()
        expect(self.canvas(page).locator('.wf-destination-window')).to_have_class(re.compile('is-maximized'))
        for piece in ('title', 'minimize', 'close', 'scrollbar'):
            case['sizes'].append({'maximized': True, **self.held(page, piece, case)})
        self.gray_controls(page)

    def run_case(self, name):
        case = {'id': name, 'status': 'running', 'images': [], 'pageErrors': [], 'console': [], 'externalRequests': []}
        self.report['cases'].append(case)
        context, page = self.open('fitting-frame-era1' if name in ('era1', 'zooms') else 'fitting-frame-era0', case)
        try:
            if name in ('era0', 'era1'):
                self.display(page, case, int(name[-1]))
            else:
                getattr(self, name)(page, case)
            assert not case['pageErrors'] and not case['console'] and not case['externalRequests'], case
            case['status'] = 'passed'
            print('PASS', name, flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            self.capture(page, case, 'failure-' + name, str(error))
            raise
        finally:
            context.close()
            self.save()
            index = self.out / 'index.html'
            index.write_text(index.read_text().replace('世界2 パネル修正の確認', '世界2 第3ラウンドの確認')
                             .replace('世界2：常設パネル・灰色の窪み・背景パレット', '世界2：選択表示・灰色ボタン・実寸ピース'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8184/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-round3'))
    parser.add_argument('--language', choices=('ja', 'en'), default='ja')
    parser.add_argument('--case', action='append', choices=('era0', 'era1', 'catalog', 'zooms'), dest='cases')
    parser.add_argument('--no-screenshots', action='store_true')
    parser.add_argument('--part', action='append', dest='parts')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    args = parser.parse_args()
    args.base_url = args.base_url.rstrip('/') + '/'
    args.reduced_motion, args.languages = False, [args.language]
    preflight(args.base_url)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            review = Round3Review(args, browser)
            review.report['references'] = ['docs/世界2-修正指示書-第3ラウンド.md']
            for case in args.cases or ('era0', 'era1', 'catalog', 'zooms'):
                review.run_case(case)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
