"""PR29 jigsaw acceptance: real selection, dragging, staging, previews and normal-save reload."""
import argparse
import re
from playwright.sync_api import expect, sync_playwright
from check_world2_fitting import ROOT, preflight
from check_world2_panel import PanelReview


class PuzzleReview(PanelReview):
    def part(self, page, identity, selected=True):
        button = self.panel(page).locator(f'[data-workshop-part="{identity}"]')
        if button.get_attribute('aria-pressed') != str(selected).lower():
            button.click()
        expect(button).to_have_attribute('aria-pressed', str(selected).lower())

    def loose(self, page, identity, piece):
        return self.canvas(page).locator(f'.wf-loose-piece[data-fitting-part="{identity}"][data-fitting-piece="{piece}"]')

    def piece_row(self, page, identity, piece):
        return self.panel(page).locator(f'[data-workshop-piece-owner="{identity}"][data-workshop-piece="{piece}"]')

    def socket(self, page, identity, seat):
        return self.canvas(page).locator(f'[data-fitting-shell="{identity}"] [data-fitting-socket="{seat}"]')

    def grab(self, page, identity, piece, fitted=False):
        source = self.canvas(page).locator(f'.wf-fitted-piece[data-fitting-part="{identity}"][data-fitting-piece="{piece}"]') if fitted else self.loose(page, identity, piece)
        source.scroll_into_view_if_needed()
        a = self.box(source)
        if fitted:
            source.hover()
            grip = self.box(source.locator('[data-fitting-grip]'))
            x, y = grip['x'] + grip['width'] / 2, grip['y'] + grip['height'] / 2
        else:
            x, y = a['x'] + a['width'] * .4, a['y'] + a['height'] * .4
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 12, y + 8, steps=3)
        ghost = self.canvas(page).locator('[data-fitting-drag]')
        expect(ghost).to_be_visible()
        b = self.box(ghost)
        for axis in ('width', 'height'):
            assert abs(a[axis] - b[axis]) < .1, (identity, piece, a, b)
        return a

    def fit(self, page, identity, piece, seat):
        a = self.grab(page, identity, piece)
        socket = self.socket(page, identity, seat)
        socket.scroll_into_view_if_needed()
        b = self.box(socket)
        for axis in ('width', 'height'):
            assert abs(a[axis] - b[axis]) < .1, (identity, piece, a, b)
        page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2, steps=10)
        page.mouse.up()
        expect(self.canvas(page).locator(f'.wf-fitted-piece[data-fitting-part="{identity}"][data-fitting-piece="{piece}"]')).to_be_visible()

    def stage(self, page, identity, piece, at, fitted=False):
        a = self.grab(page, identity, piece, fitted)
        self.canvas(page).evaluate('node=>node.scrollTop=0')
        board = self.canvas(page).locator('[data-fitting-board]')
        target = board.evaluate('''(node,at)=>{const r=node.getBoundingClientRect(),scale=r.width/node.offsetWidth;
          return {x:r.left+at.x*scale,y:r.top+at.y*scale};}''', at)
        page.mouse.move(target['x'] + (0 if fitted else a['width'] * .4), target['y'] + (0 if fitted else a['height'] * .4), steps=12)
        page.mouse.up()
        expect(self.loose(page, identity, piece)).to_be_visible()

    def puzzle(self, page, case, era):
        self.dismiss_help(page)
        self.part(page, 'common-frame', False)
        self.part(page, 'common-button')
        self.part(page, 'common-heading')
        expect(self.canvas(page).locator('[data-fitting-tray]')).to_have_count(0)
        expect(self.canvas(page).locator('.wf-part-shell.is-active')).to_have_count(2)
        expect(self.canvas(page).locator('.wf-loose-piece')).to_have_count(3)
        expect(self.panel(page).locator('[data-piece-part]')).to_have_count(2)
        expect(self.panel(page).locator('[data-workshop-customize]')).to_have_count(2)
        initial = self.state(page)
        positions = {identity: initial['run']['workshop']['parts'][identity]['fitting']['positions']
                     for identity in ('common-button', 'common-heading')}
        page.mouse.move(1250, 850)
        self.capture(page, case, '01-multiple-parts' if era == 0 else '05-era1-pieces',
                     '段①・2つのパーツと全ピースが下側に一斉出現' if era == 0 else '段②・複数選択と全ピースの一斉出現')
        case['noImages'] = bool(era)
        self.loose(page, 'common-button', 'label').hover()
        expect(self.socket(page, 'common-button', 'label')).to_have_class(re.compile('is-compatible'))
        self.stage(page, 'common-button', 'label', {'x': 280, 'y': 340})
        staged = self.state(page)
        at = staged['run']['workshop']['parts']['common-button']['fitting']['positions']['label']['at']
        assert abs(at['x'] - 280) < .1 and abs(at['y'] - 340) < .1, at
        assert staged['resources'] == initial['resources']
        assert staged['run']['workshop']['parts']['common-button']['elements'] == []
        page.mouse.move(1250, 850)
        self.capture(page, case, '02-staged-piece', '窪みにはまらなかったピースは落とした場所に仮置き')
        self.piece_row(page, 'common-heading', 'label').click()
        expect(self.loose(page, 'common-heading', 'label')).to_have_count(0)
        self.import_for_reload(page)
        page.reload()
        expect(page.locator('[data-workshop]')).to_be_visible()
        page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
        restored = self.state(page)
        assert restored['run']['workshop']['parts']['common-button']['fitting']['positions']['label']['at'] == at
        assert restored['run']['workshop']['parts']['common-heading']['fitting']['positions'] == positions['common-heading']
        expect(self.loose(page, 'common-heading', 'label')).to_have_count(0)
        self.piece_row(page, 'common-heading', 'label').click()
        expect(self.loose(page, 'common-heading', 'label')).to_be_visible()
        self.fit(page, 'common-button', 'label', 'label')
        expect(self.panel(page).locator('[data-workshop-part="common-button"]')).to_have_attribute('aria-pressed', 'false')
        expect(self.panel(page).locator('[data-piece-part="common-button"]')).to_have_count(0)
        self.part(page, 'common-heading', False)
        self.part(page, 'common-frame')
        self.fit(page, 'common-frame', 'minimize', 'control-0')
        self.piece_row(page, 'common-frame', 'maximize').click()
        levels = self.panel(page).locator('[data-brightness]').evaluate_all('''nodes=>nodes.map(node=>({
          level:node.dataset.brightness,filter:getComputedStyle(node).filter}))''')
        for level in ('selected', 'default', 'complete'):
            assert any(row['level'] == level for row in levels), levels
        for row in levels:
            assert row['filter'] == 'none' if row['level'] == 'selected' else ('brightness(0.55)' if row['level'] == 'complete' else 'brightness(0.75)') in row['filter'], row
        page.mouse.move(1250, 850)
        self.capture(page, case, '03-three-levels', '選択中・未設置・チェック付きの完了を3段階の明るさで表示')
        self.panel(page).locator('[data-navigation-part="common-heading"]').hover()
        expect(page.locator('[data-workshop-hover="part"]')).to_be_visible()
        self.capture(page, case, '04a-part-preview', 'パーツ行のホバーで完成した姿を表示')
        self.piece_row(page, 'common-frame', 'title').hover()
        preview = page.locator('[data-workshop-hover="piece"] .ws-hover-preview-content')
        expect(preview).to_be_visible()
        actual, target = self.box(preview), self.box(self.socket(page, 'common-frame', 'title'))
        for axis in ('width', 'height'):
            assert abs(actual[axis] - target[axis]) < .1, (actual, target)
        self.capture(page, case, '04b-piece-preview', 'ピース行のホバーで窪みと同寸の実物を表示')
        before_preview = self.state(page)
        self.piece_row(page, 'common-frame', 'scrollbar').hover()
        tall = self.box(page.locator('[data-workshop-hover="piece"]'))
        assert tall['y'] >= 0 and tall['y'] + tall['height'] <= self.args.height, tall
        assert self.state(page) == before_preview
        page.mouse.move(1250, 850)
        paid = self.state(page)['resources']
        self.stage(page, 'common-frame', 'minimize', {'x': 300, 'y': 330}, fitted=True)
        removed = self.state(page)
        assert 'minimize' not in removed['run']['workshop']['parts']['common-frame']['elements']
        assert removed['resources'] == paid
        # Dropping over the panel returns the piece to its persistent original position.
        self.grab(page, 'common-frame', 'minimize')
        panel = self.box(self.panel(page))
        page.mouse.move(panel['x'] + 60, panel['y'] + 200, steps=12)
        page.mouse.up()
        outside = self.state(page)['run']['workshop']['parts']['common-frame']['fitting']['positions']['minimize']
        assert outside['at'] == outside['origin'], outside
        self.panel(page).locator('[data-workshop-category="optional"]').click()
        expect(self.panel(page).locator('[data-workshop-part][aria-pressed="true"]')).to_have_count(0)
        expect(self.canvas(page).locator('.wf-loose-piece')).to_have_count(0)
        self.panel(page).locator('[data-workshop-set="clock"]').click()
        self.dismiss_help(page)
        expect(self.panel(page).locator('[data-workshop-part="clock-time"]')).to_have_attribute('aria-pressed', 'true')
        self.panel(page).locator('[data-workshop-select-set="photo"]').click()
        expect(self.panel(page).locator('[data-workshop-part][aria-pressed="true"]')).to_have_count(0)
        expect(self.canvas(page).locator('.wf-loose-piece')).to_have_count(0)
        self.panel(page).locator('[data-workshop-category="shared"]').click()
        expect(self.canvas(page).locator('.wf-fitted-piece[data-fitting-part="common-button"]')).to_be_visible()
        expect(self.canvas(page).locator('.wf-loose-piece')).to_have_count(0)
        case['checks'] = {'multipleSelection': True, 'pieceToggle': True, 'normalSaveReload': True,
                          'stablePositions': True, 'noPaymentWhileStaged': True, 'completionDeselects': True,
                          'threeBrightnessLevels': levels, 'realPreviews': True, 'matchingSocketGlow': True,
                          'previewKeepsState': True, 'tallPreviewFits': True, 'setClearsSelection': True,
                          'fittedPieceStaging': True, 'outsideReturnsToOrigin': True, 'categoryClearsSelection': True}

    def run_case(self, language, era):
        self.args.language = language
        case = {'id': f'{language}:era{era}', 'status': 'running', 'images': [],
                'pageErrors': [], 'console': [], 'externalRequests': []}
        self.report['cases'].append(case)
        context, page = self.open(f'fitting-frame-era{era}', case)
        try:
            self.puzzle(page, case, era)
            assert not case['pageErrors'] and not case['console'] and not case['externalRequests'], case
            case['status'] = 'passed'
            print('PASS', case['id'], flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            self.capture(page, case, 'failure-' + case['id'].replace(':', '-'), str(error))
            raise
        finally:
            context.close()
            self.save()
            index = self.out / 'index.html'
            index.write_text(index.read_text().replace('世界2 パネル修正の確認', '世界2 第5ラウンドの確認')
                             .replace('世界2：常設パネル・灰色の窪み・背景パレット', '世界2：はめ込みのパズル方式'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8186/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-round5'))
    parser.add_argument('--language', action='append', choices=('ja', 'en'), dest='languages')
    parser.add_argument('--era', type=int, action='append', choices=(0, 1), dest='eras')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    parser.add_argument('--no-screenshots', action='store_true')
    args = parser.parse_args()
    args.base_url = args.base_url.rstrip('/') + '/'
    args.languages = args.languages or ['ja', 'en']
    args.language, args.reduced_motion = args.languages[0], False
    preflight(args.base_url)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            review = PuzzleReview(args, browser)
            review.report['references'] = ['docs/世界2-修正指示書-第5ラウンド.md']
            for language in args.languages:
                for era in args.eras or (0, 1):
                    review.run_case(language, era)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
