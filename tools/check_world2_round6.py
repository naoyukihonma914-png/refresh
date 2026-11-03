"""PR29 round 6: bounded workbench, fitting/export feedback and the persistent desktop shelf."""
import argparse
import json
from playwright.sync_api import expect, sync_playwright
from check_world2_fitting import ROOT, preflight
from check_world2_round5 import PuzzleReview


class FinishReview(PuzzleReview):
    def select_set(self, page, identity):
        category = self.category_for(identity)
        self.panel(page).locator(f'[data-workshop-category="{category}"]').click()
        self.panel(page).locator(f'[data-workshop-select-set="{identity}"]').click()
        self.dismiss_help(page)

    def select_all(self, page):
        for button in self.panel(page).locator('[data-workshop-part]').all():
            if button.get_attribute('aria-pressed') != 'true':
                button.click()

    def contained(self, page):
        return self.canvas(page).evaluate('''node=>{
          const v=node.getBoundingClientRect(),shelf=node.querySelector('[data-workshop-shelf]').getBoundingClientRect(),
           preview=node.parentElement.querySelector('[data-fitting-preview]')?.getBoundingClientRect();
          const pieces=[...node.querySelectorAll('.wf-loose-piece')].map(n=>{
            const r=n.getBoundingClientRect();return {part:n.dataset.fittingPart,piece:n.dataset.fittingPiece,
              inside:r.left>=v.left&&r.top>=v.top&&r.right<=v.right+.1&&r.bottom<=v.bottom+.1,
              clear:[shelf,preview].filter(Boolean).every(o=>r.right<=o.left||r.left>=o.right||r.bottom<=o.top||r.top>=o.bottom)};});
          return {pieces,overflow:getComputedStyle(node).overflow,scrollTop:node.scrollTop,scrollLeft:node.scrollLeft};
        }''')

    def complete_visible(self, page):
        # Keyboard fitting is the public accessible alternative to dragging, not a state shortcut.
        while self.canvas(page).locator('.wf-loose-piece').count():
            self.canvas(page).locator('.wf-loose-piece').first.press('Enter')

    def check_case(self, language, era, reduced=False):
        self.args.language, self.args.reduced_motion = language, reduced
        case = {'id': f'{language}:era{era}:reduce{int(reduced)}', 'status': 'running', 'images': [],
                'console': [], 'pageErrors': [], 'externalRequests': []}
        self.report['cases'].append(case)
        context, page = self.open(f'stage8a-catalog-era{era}', case)
        try:
            self.dismiss_help(page)
            catalog = []
            for identity in ['common','foundation','files','mail','photo','bin','clock','theme','terminal','manager','extras']:
                self.select_set(page, identity)
                self.select_all(page)
                bounded = self.contained(page)
                assert all(p['inside'] and p['clear'] for p in bounded['pieces']), (identity, bounded)
                dimensions = self.canvas(page).evaluate('''node=>[...node.querySelectorAll('.wf-loose-piece')].map(piece=>{
                  const socket=[...node.querySelectorAll(`[data-fitting-shell="${piece.dataset.fittingPart}"] [data-fitting-socket]`)]
                   .find(s=>s.dataset.socketAccepts.split(',').includes(piece.dataset.fittingPiece));
                  const a=piece.getBoundingClientRect(),b=socket.getBoundingClientRect();
                  return Math.abs(a.width-b.width)<.1&&Math.abs(a.height-b.height)<.1;})''')
                assert all(dimensions), (identity, dimensions)
                text = self.canvas(page).locator('.wf-loose-piece [data-loose]').evaluate_all('''nodes=>nodes.flatMap(node=>{
                  const box=node.getBoundingClientRect(),walker=node.ownerDocument.createTreeWalker(node,NodeFilter.SHOW_TEXT),errors=[];
                  for(let t=walker.nextNode();t;t=walker.nextNode()){
                    if(!t.textContent.trim()||t.parentElement.closest('svg,option,[hidden]'))continue;
                    const range=node.ownerDocument.createRange();range.selectNode(t);const r=range.getBoundingClientRect();
                    if(!r.width||!r.height)continue;
                    const vertical=!t.parentElement.closest('.wf-list,article,pre');
                    if(r.left<box.left-1||r.right>box.right+1||(vertical&&(r.top<box.top-1||r.bottom>box.bottom+1)))errors.push({piece:node.dataset.workshopControlPiece,text:t.textContent,font:getComputedStyle(node).fontSize});
                  }return errors;})''')
                assert not text, (identity, text)
                catalog.append({'set': identity, 'pieces': len(bounded['pieces']), 'inside': True, 'sameSize': True, 'textFits': True})
            self.select_set(page, 'photo')
            self.select_all(page)
            measure = self.contained(page)
            assert len(measure['pieces']) == 16 and all(p['inside'] and p['clear'] for p in measure['pieces']), measure
            assert measure['overflow'] == 'clip' and measure['scrollTop'] == measure['scrollLeft'] == 0, measure
            page.mouse.wheel(0, 1000)
            assert self.contained(page)['scrollTop'] == 0
            page.mouse.move(1200, 850)
            if era == 0 and not reduced:
                self.capture(page, case, '01-all-pieces-contained', '16ピースと窓を、スクロールなしで画面内に収納')
            self.select_set(page, 'common')
            self.part(page, 'common-heading')
            self.fit(page, 'common-heading', 'label', 'label')
            self.loose(page, 'common-heading', 'separator').hover()
            frame = self.loose(page, 'common-heading', 'separator').locator('[data-loose]')
            expect(frame).to_have_attribute('data-loose-frame', 'true')
            fitted = self.canvas(page).locator('.wf-fitted-piece[data-fitting-part="common-heading"] [data-workshop-control-piece="label"]')
            assert fitted.get_attribute('data-loose') is None
            if era == 0 and not reduced:
                page.mouse.move(1200, 850)
                self.capture(page, case, '04-loose-piece-border', '未装着の区切り線だけに縁を付け、装着済みの実物には付けない')
            self.piece_row(page, 'common-heading', 'separator').hover()
            expect(page.locator('[data-workshop-hover="piece"] [data-loose]')).to_have_attribute('data-loose-frame', 'true')
            self.fit(page, 'common-heading', 'separator', 'separator')
            effect = self.canvas(page).locator('[data-fitting-snap="separator"]')
            if reduced:
                expect(effect).to_have_count(0)
            else:
                expect(effect).to_be_visible()
                effect.evaluate('n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=100;})')
                if era == 0:
                    self.capture(page, case, '02-fitting-effect', '最後のピースをはめた瞬間、縁が短く光る')
            export = page.locator('.ws-export-button')
            expect(export).to_have_attribute('data-export-pending', 'true')
            animation = export.evaluate('n=>getComputedStyle(n).animationName')
            assert (animation == 'none') if reduced else (animation == 'ws-export-ready'), animation
            if not reduced:
                export.evaluate('n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=650;})')
            if era == 0 and not reduced:
                page.mouse.move(1200, 850)
                self.capture(page, case, '03-export-ready', '書き出し待ちの上部ボタンを点滅と光で強調')
            before = self.state(page)
            export.click()
            expect(page.locator('[data-shelf-entry="part:common-heading"]')).to_be_visible()
            expect(export).to_have_attribute('data-export-pending', 'false')
            assert export.evaluate('n=>getComputedStyle(n).animationName') == 'none'
            if reduced:
                expect(page.locator('[data-export-flight]')).to_have_count(0)
            else:
                expect(page.locator('[data-export-flight="common-heading"]')).to_be_visible()
                flight = page.locator('[data-export-flight="common-heading"]')
                frames = flight.evaluate('n=>n.getAnimations()[0].effect.getKeyframes()')
                assert frames and frames[-1]['width'] != frames[0]['width'], frames
                flight.evaluate('n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=650;})')
                landed=self.box(flight)
                destination=self.box(page.locator('[data-shelf-entry="part:common-heading"] .ws-shelf-image'))
                for axis in ('x','y','width','height'):
                    assert abs(landed[axis]-destination[axis]) < 1, (landed,destination)
            after = self.state(page)
            # Catalog is past the first-run funding gate; one export still pays exactly one token.
            assert after['resources']['tokens'] == before['resources']['tokens'] + 1
            page.clock.run_for(1000)
            self.select_set(page, 'foundation')
            self.select_all(page)
            self.complete_visible(page)
            export.click()
            expect(page.locator('[data-shelf-entry="app:foundation"]')).to_be_visible()
            expect(page.locator('[data-shelf-entry^="part:foundation-"]')).to_have_count(0)
            if not reduced:
                expect(page.locator('[data-shelf-entry="app:foundation"]')).to_have_attribute('data-shelf-merging', 'true')
            page.clock.run_for(1000)
            self.select_set(page, 'files')
            self.select_all(page)
            self.complete_visible(page)
            export.click()
            expect(page.locator('[data-shelf-entry="app:files"]')).to_be_visible()
            page.clock.run_for(1000)
            page.mouse.move(1200, 850)
            if era == 0 and not reduced:
                self.capture(page, case, '05-exported-desktop-shelf', '共通パーツは個別に残り、全パーツを書き出したデスクトップとファイルはアプリのアイコンに合体')
            expected = page.locator('[data-shelf-entry]').evaluate_all('ns=>ns.map(n=>n.dataset.shelfEntry)')
            self.import_for_reload(page)
            page.reload()
            expect(page.locator('[data-workshop]')).to_be_visible()
            page.locator('.debug-panel').evaluate('n=>n.style.display="none"')
            assert page.locator('[data-shelf-entry]').evaluate_all('ns=>ns.map(n=>n.dataset.shelfEntry)') == expected
            expect(page.locator('[data-export-flight]')).to_have_count(0)
            assert not case['console'] and not case['pageErrors'] and not case['externalRequests'], case
            case['checks'] = {'catalog': catalog, '16PiecesContained': measure, 'noWorkbenchScroll': True, 'fittingEffect': not reduced,
                              'reducedMotion': reduced, 'exportPending': True, 'looseBorderAndPreview': True,
                              'flightToIcon': not reduced, 'mergedApps': ['foundation', 'files'],
                              'commonPartsRemain': True, 'normalSaveReload': True, 'noDuplicateRewards': True}
            case['status'] = 'passed'
            print('PASS', case['id'], flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            self.capture(page, case, 'failure', str(error))
            raise
        finally:
            context.close()
            self.save()
            index = self.out / 'index.html'
            index.write_text(index.read_text().replace('世界2 パネル修正の確認','世界2 第6ラウンドの確認').replace('世界2：常設パネル・灰色の窪み・背景パレット','世界2：画面への収納と書き出し演出'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8187/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-round6'))
    parser.add_argument('--language', action='append', choices=['ja', 'en', 'en-XA'], dest='languages')
    parser.add_argument('--era', type=int, action='append', choices=[0, 1], dest='eras')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    parser.add_argument('--no-screenshots', action='store_true')
    parser.add_argument('--reduced-motion', action='store_true')
    args = parser.parse_args()
    args.languages = args.languages or ['ja', 'en']
    args.language = args.languages[0]
    args.base_url = args.base_url.rstrip('/') + '/'
    preflight(args.base_url)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            review = FinishReview(args, browser)
            review.report['references'] = ['docs/世界2-修正指示書-第6ラウンド.md']
            for language in args.languages:
                for era in args.eras or (0, 1):
                    review.check_case(language, era, args.reduced_motion)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
