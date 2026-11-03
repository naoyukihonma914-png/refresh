"""PR29 round 4: selected-row customization and one-time Tessera update funds.

Uses public fixtures and real controls, export/import, and ordinary URL reload.
No JavaScript gameplay-state injection or debug resource grants.
"""
import argparse

from playwright.sync_api import expect, sync_playwright

from check_world2_fitting import ROOT, preflight
from check_world2_panel import PanelReview


class Round4Review(PanelReview):
    def selected_customization(self, page, identity):
        panel = self.panel(page)
        buttons = panel.locator('[data-workshop-customize]')
        expect(buttons).to_have_count(1)
        expect(buttons).to_have_attribute('data-workshop-customize', identity)
        expect(panel.locator(f'[data-navigation-part="{identity}"] [data-workshop-customize]')).to_have_count(1)
        expect(panel.locator('[data-workshop-zone="pieces"] [data-workshop-customize]')).to_have_count(0)
        expect(panel.locator('[data-workshop-action="openAdjustments"],.ws-fitting-open-adjustments')).to_have_count(0)
        bounds = buttons.evaluate('''node=>{const r=node.getBoundingClientRect(),p=node.closest('[data-navigation-part]').getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,rowLeft:p.left,rowRight:p.right,rowTop:p.top,rowBottom:p.bottom,
                  client:node.clientWidth,scroll:node.scrollWidth};}''')
        assert bounds['left'] >= bounds['rowLeft'] and bounds['right'] <= bounds['rowRight'] + 1, bounds
        assert bounds['top'] >= bounds['rowTop'] and bounds['bottom'] <= bounds['rowBottom'] + 1, bounds
        assert bounds['scroll'] <= bounds['client'] + 1, bounds
        return buttons

    def customization(self, page, case):
        self.dismiss_help(page)
        button = self.selected_customization(page, 'common-frame')
        self.capture(page, case, '01-selected-part-customize', '選択したパーツ行だけにカスタマイズボタンを表示')
        button.click()
        expect(page.locator('[data-workshop-customization]')).to_be_visible()
        expect(page.locator('[data-workshop-customization] [data-workshop-adjust="scrollbarWidth"]')).to_be_visible()
        self.capture(page, case, '02-customization-open', 'パーツ行のボタンから従来の調整パネルを開く')
        self.close_adjustments(page)
        self.select_part(page, 'common-button')
        self.selected_customization(page, 'common-button').click()
        expect(page.locator('[data-workshop-customization] [data-workshop-adjust="scrollbarWidth"]')).to_have_count(0)
        self.close_adjustments(page)
        self.fit(page, 'label', 'label')
        state = self.state(page)
        assert state['run']['workshop']['parts']['common-button']['step'] == 4
        self.selected_customization(page, 'common-button').click()
        radius = page.locator('[data-workshop-customization] [data-workshop-adjust="radius"]')
        radius.focus()
        page.keyboard.press('ArrowRight')
        assert self.state(page)['run']['workshop']['parts']['common-button']['design']['radius'] == 1
        self.close_adjustments(page)
        case['checks'] = {'selectedRowOnly': True, 'oldPieceZoneEntryRemoved': True,
                          'unfinishedAndCompletedCustomizable': True, 'selectedPartOnlyAdjusted': True}

    def funding(self, page, case):
        self.dismiss_help(page)
        self.select_part(page, 'common-button')
        self.fit(page, 'label', 'label')
        before = self.state(page)
        assert before['resources']['tokens'] == 0
        page.locator('[data-workshop-action="export"]').click()
        gifted = self.state(page)
        assert gifted['resources']['tokens'] == 4
        assert gifted['persistent']['tesseraUpdateGrantReceived'] is True
        assert gifted['run']['workshop']['guide']['current'] == 'updateAvailable'
        expect(page.locator('.ws-token-count')).to_contain_text('4')
        comment = page.locator('.fe-comment-row p')
        expect(comment).to_contain_text('3')
        expect(comment).not_to_contain_text('{count}')
        page.mouse.move(1250, 800)
        page.clock.run_for(2000)
        self.capture(page, case, '03-first-export-funds', '初回エクスポートの1＋進呈3＝4トークンと榎本の案内')
        page.locator('[data-workshop-action="plugins"]').click()
        update = page.locator('[data-workshop-skill="update"]')
        expect(update).to_be_enabled()
        for identity in ('presets', 'eyedropper'):
            expect(page.locator(f'[data-workshop-skill="{identity}"]')).to_be_disabled()
            expect(page.locator(f'[data-workshop-skill-reason="{identity}"]')).to_be_visible()
        self.capture(page, case, '04-other-purchases-locked', 'アップデート前は他の消費先を閉じ、理由を表示')
        page.locator('.ws-plugin-dialog header button').click()
        page.locator('.fe-comment-row>button').click()
        expect(page.locator('[data-workshop-next-hand="update"]')).to_be_visible()
        # Import the unchanged exported save through the normal file chooser, then reload.
        self.import_for_reload(page)
        page.reload()
        expect(page.locator('[data-workshop]')).to_be_visible()
        page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
        page.clock.run_for(100)
        reloaded = self.state(page)
        assert reloaded['resources']['tokens'] == 4
        assert reloaded['persistent']['tesseraUpdateGrantReceived'] is True
        page.locator('[data-workshop-action="plugins"]').click()
        expect(page.locator('[data-workshop-skill="presets"]')).to_be_disabled()
        update.click()
        upgraded = self.state(page)
        assert upgraded['resources']['tokens'] == 1
        assert 'update' in upgraded['persistent']['editorSkills']
        expect(page.locator('[data-editor-stage]')).to_have_attribute('data-editor-stage', '1')
        for identity in ('presets', 'eyedropper'):
            expect(page.locator(f'[data-workshop-skill="{identity}"]')).to_be_enabled()
            expect(page.locator(f'[data-workshop-skill-reason="{identity}"]')).to_have_count(0)
        page.locator('.ws-plugin-dialog header button').click()
        page.locator('[data-workshop-action="plugins"]').click()
        page.mouse.move(1320, 880)
        page.evaluate('document.fonts.ready')
        page.clock.run_for(100)
        self.capture(page, case, '05-update-unlocks-purchases', 'アップデート購入後は残り1トークン・他の購入が可能')
        page.locator('[data-workshop-skill="presets"]').click()
        assert self.state(page)['resources']['tokens'] == 0
        page.locator('.ws-plugin-dialog header button').click()
        self.select_part(page, 'common-heading')
        self.fit(page, 'label', 'label')
        self.fit(page, 'separator', 'separator')
        page.locator('[data-workshop-action="export"]').click()
        repeated = self.state(page)
        assert repeated['resources']['tokens'] == 1
        page.reload()
        expect(page.locator('[data-workshop]')).to_be_visible()
        page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
        assert self.state(page)['resources']['tokens'] == 1
        case['checks'] = {'ordinaryReward': 1, 'grant': 3, 'balanceAfterExport': 4,
                          'balanceAfterUpdate': 1, 'normalImportReloadNoDuplicate': True,
                          'otherPurchasesBlockedBeforeUpdate': True, 'dismissalKeepsUpdateGoal': True,
                          'otherPurchasesAvailableImmediately': True, 'secondExportRewardOnly': 1}

    def run_case(self, name, language):
        self.args.language = language
        case = {'id': f'{language}:{name}', 'status': 'running', 'images': [],
                'pageErrors': [], 'console': [], 'externalRequests': []}
        self.report['cases'].append(case)
        context, page = self.open('fitting-frame-era0', case)
        try:
            getattr(self, name)(page, case)
            assert not case['pageErrors'] and not case['console'] and not case['externalRequests'], case
            case['status'] = 'passed'
            print('PASS', case['id'], flush=True)
        except Exception as error:
            case.update(status='failed', error=str(error))
            self.capture(page, case, 'failure-' + name, str(error))
            raise
        finally:
            context.close()
            self.save()
            index = self.out / 'index.html'
            index.write_text(index.read_text().replace('世界2 パネル修正の確認', '世界2 第4ラウンドの確認')
                             .replace('世界2：常設パネル・灰色の窪み・背景パレット', '世界2：カスタマイズの入り口・アップデート資金'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8185/')
    parser.add_argument('--output-dir', default=str(ROOT / 'docs/reviews/world2-round4'))
    parser.add_argument('--language', action='append', choices=('ja', 'en'), dest='languages')
    parser.add_argument('--case', action='append', choices=('customization', 'funding'), dest='cases')
    parser.add_argument('--no-screenshots', action='store_true')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    args = parser.parse_args()
    args.base_url = args.base_url.rstrip('/') + '/'
    args.languages = args.languages or ['ja', 'en']
    args.language, args.reduced_motion = args.languages[0], False
    preflight(args.base_url)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            review = Round4Review(args, browser)
            review.report['references'] = ['docs/世界2-修正指示書-第4ラウンド.md']
            review.report['setup'] = 'public fixtures; real controls; unchanged exported save imported through file chooser; normal URL reload'
            for language in args.languages:
                for case in args.cases or ('customization', 'funding'):
                    review.run_case(case, language)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
