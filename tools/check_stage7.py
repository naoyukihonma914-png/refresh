"""Stage 7: real release controls, native notices, and responsive screenshots.

Build game/dist and serve it at /play/ before running. Captures stay in the
ignored game/artifacts/stage7 directory; review images are selected separately.
"""
import argparse
import json
import math
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/artifacts/stage7'
WORDS = {lang: json.loads((ROOT / f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja', 'en']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--flow-only', action='store_true')
    parser.add_argument('--extras-only', action='store_true')
    parser.add_argument('--desktop-only', action='store_true')
    parser.add_argument('--taskbar-only', action='store_true')
    parser.add_argument('--seed-only', action='store_true')
    parser.add_argument('--apps-only', action='store_true')
    parser.add_argument('--language', action='append', choices=['ja', 'en', 'en-XA'])
    parser.add_argument('--width', action='append', type=int, choices=[1920, 1366])
    parser.add_argument('--app', action='append', choices=['files', 'mail', 'manager', 'photo', 'bin', 'clock', 'theme', 'terminal', 'note', 'settings', 'tessera'])
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--recheck-app', action='append', default=[])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    errors, checks, scenes = [], [], []
    languages = args.language or (['ja'] if args.smoke else ['ja', 'en', 'en-XA'])
    widths = args.width or ([1920] if args.smoke else [1920, 1366])
    sizes = [(width, 1080 if width == 1920 else 768) for width in widths]
    eras = [3] if args.smoke else [0, 1, 2, 3]

    def text(lang, key):
        value = WORDS['ja' if lang == 'ja' else 'en'][key]
        return '[' + value + '~' * math.ceil(len(value) * .4) + ']' if lang == 'en-XA' else value

    def passed(name):
        checks.append(name)
        print('PASS', name, flush=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])

        def scene(name, lang='ja', size=(1920, 1080), save=None, reduced='no-preference'):
            context = browser.new_context(viewport={'width': size[0], 'height': size[1]}, locale='ja-JP' if lang == 'ja' else 'en-US', timezone_id='Asia/Tokyo', reduced_motion=reduced)
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(args.base_url) else route.abort())
            if save:
                context.add_init_script('if(!localStorage.getItem("refresh.save"))localStorage.setItem("refresh.save",' + json.dumps(json.dumps(save)) + ')')
            page = context.new_page()
            page.set_default_timeout(12000)
            page.on('pageerror', lambda error: (errors.append(str(error)), print('PAGE ERROR', error, flush=True)))
            now = datetime(2026, 11, 2, tzinfo=timezone.utc)
            page.clock.install(time=now)
            page.clock.pause_at(now + timedelta(minutes=1))
            page.goto(args.base_url + '/play/?debug=1' + ('' if save else '&state=' + name))
            page.locator('.debug-panel select').first.select_option(lang)
            page.evaluate('document.fonts.ready')
            page.locator('.debug-panel').evaluate('e=>e.style.display="none"')
            page.clock.run_for(2500)
            return context, page

        def export(page):
            with page.expect_download() as download:
                page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('e=>e.click()')
            return json.loads(Path(download.value.path()).read_text())

        def clipping(root):
            clipped = root.locator('button,th,td,label,h1,h2,h3,p').evaluate_all('''es=>es.filter(e=>{
              const s=getComputedStyle(e),r=e.getBoundingClientRect();
              return !e.closest('[inert]')&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&e.scrollWidth>e.clientWidth+2;
            }).map(e=>({tag:e.tagName,class:e.className,text:e.textContent}))''')
            assert not clipped, clipped

        def whole(page, locator):
            box = locator.bounding_box()
            assert box, locator
            viewport = page.viewport_size
            assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= viewport['width'] + 1 and box['y'] + box['height'] <= viewport['height'] + 1, box

        def separate_notices(page, native):
            notices = [native] + page.locator('.desktop-live > .feedback-toast').all()
            boxes = [notice.bounding_box() for notice in notices if notice.is_visible()]
            for i, a in enumerate(boxes):
                for b in boxes[i + 1:]:
                    assert a['x'] + a['width'] <= b['x'] + 1 or b['x'] + b['width'] <= a['x'] + 1 or a['y'] + a['height'] <= b['y'] + 1 or b['y'] + b['height'] <= a['y'] + 1, (a, b)

        def snap(page, name):
            page.screenshot(path=str(OUT / (name + '.png')))

        def button(root, lang, key):
            return root.get_by_role('button', name=text(lang, key), exact=True)

        if not args.extras_only and not args.desktop_only and not args.taskbar_only and not args.seed_only and not args.apps_only:
            for era in eras:
                for lang in languages:
                    for size in sizes:
                        context, page = scene('stage7-ready' + str(era), lang, size)
                        label = f'{era}-{lang}-{size[0]}'
                        desktop = page.locator('.desktop-live')
                        desktop.locator('.taskbar-progress').click()
                        conditions = desktop.locator('.desktop-conditions')
                        assert conditions.locator('input:checked').count() == 5
                        clipping(conditions)
                        snap(page, 'conditions-' + label)
                        conditions.locator('.desktop-release-action').click()
                        dialog = desktop.locator('.release-confirmation')
                        expect(dialog).to_be_visible()
                        clipping(dialog)
                        whole(page, dialog.locator(':scope > footer'))
                        snap(page, 'confirmation-' + label)
                        dialog.locator('.release-photo-picker summary').click()
                        expect(dialog.locator('.release-photo-grid')).to_be_visible()
                        clipping(dialog)
                        snap(page, 'photos-' + label)
                        available = [shot for shot in export(page)['persistent']['screenshots'] if not shot.get('deleted')]
                        newest = available[-1]['id']
                        dialog.locator('.release-photo-grid input').first.uncheck()
                        if dialog.locator('.release-photo-pager').count():
                            dialog.locator('.release-photo-pager button').last.click()
                            dialog.locator('.release-photo-grid input').first.check()
                        dialog.locator(':scope > footer button').first.click()
                        store = page.locator('.store-page')
                        expect(store).to_be_visible()
                        released = export(page)
                        assert released['run']['shipping']['phase'] == 'store'
                        assert newest not in [shot['id'] for shot in released['persistent']['products'][-1]['screenshots']]
                        snap(page, 'store-counting-' + label)
                        page.clock.run_for(3100)
                        clipping(store)
                        snap(page, 'store-' + label)
                        store.locator('.store-navigation button').last.click()
                        clipping(store.locator('.store-reviews'))
                        snap(page, 'store-reviews-' + label)
                        button(store, lang, 'store.viewSales').click()
                        shipping = page.locator('.shipping-page')
                        expect(shipping).to_be_visible()
                        page.clock.run_for(2000)
                        snap(page, 'shipping-counting-' + label)
                        page.clock.run_for(6100)
                        clipping(shipping)
                        columns = [page.locator(selector).bounding_box() for selector in ['.shipping-left', '.shipping-sales', '.shipping-right']]
                        assert columns[0]['x'] + columns[0]['width'] <= columns[1]['x'] and columns[1]['x'] + columns[1]['width'] <= columns[2]['x']
                        before = export(page)
                        assert 'v1-released' in before['persistent']['progress']['records']
                        expect(shipping.locator('.contract-selection')).to_be_visible()
                        whole(page, button(shipping, lang, 'release.startNext'))
                        snap(page, 'shipping-' + label)
                        shipping.locator('[data-spec=refresh] button').click()
                        shipping.locator('.contract-selection select').select_option('no-color' if era % 2 else '')
                        snap(page, 'shipping-ready-' + label)
                        button(shipping, lang, 'release.startNext').click()
                        page.clock.run_for(1200)
                        snap(page, 'v2-inheriting-' + label)
                        page.clock.run_for(10800)
                        current = export(page)
                        assert current['run']['version'] == 'v2' and current['run']['world'] == 'seed'
                        assert current['persistent']['specs']['refresh'] >= 1
                        assert current['persistent']['seedAppearance'].get('era') == 1
                        assert current['run']['play']['contract']['id'] == 'no-color' if era % 2 else current['run']['play']['contract'] is None
                        if era % 2:
                            assert 'color' not in current['run']['seed']['built']
                        assert len(current['persistent']['products']) == len(before['persistent']['products'])
                        clipping(page.locator('.seed-page'))
                        snap(page, 'v2-' + label)
                        if era == 3:
                            button(page.locator('.seed-page'), lang, 'seed.settings').click()
                            appearance = page.locator('.seed-era-setting select')
                            appearance.select_option('0')
                            clipping(page.locator('.page-settings'))
                            snap(page, 'seed-appearance-settings-' + label)
                            button(page.locator('.page-settings'), lang, 'settings.back').click()
                            assert 'seed-era-1' not in page.locator('.seed-page').get_attribute('class')
                            snap(page, 'seed-classic-' + label)
                        context.close()
                        scenes.append({'scene': 'release flow', 'era': era, 'language': lang, 'viewport': size})
                        print('FLOW', label, flush=True)
            passed('All desktop eras, languages, and sizes: five conditions, screenshot selection, store, shipping, v1 achievement, optional contract, 60Hz purchase, and v2 seed start')

        if not args.flow_only and not args.desktop_only and not args.taskbar_only and not args.seed_only and not args.apps_only:
            for era in ([2] if args.smoke else [0, 1, 2]):
                for lang in languages:
                    for size in sizes:
                        context, page = scene('editor-stage' + str(era), lang, size)
                        page.locator('.k-menu-end .k-release-progress').click()
                        expect(page.locator('.k-condition-popover')).to_be_visible()
                        clipping(page.locator('.k-condition-popover'))
                        snap(page, f'editor-conditions-{era}-{lang}-{size[0]}')
                        context.close()
                        scenes.append({'scene': 'editor conditions', 'era': era, 'language': lang, 'viewport': size})
            passed('All three editor eras: the release ring opens the current five-condition list')

            for lang in languages:
                for size in sizes:
                    context, page = scene('release-ready', lang, size)
                    page.locator('.prototype-release').click()
                    dialog = page.locator('.release-confirmation')
                    clipping(dialog)
                    dialog.locator(':scope > footer button').first.click()
                    expect(page.locator('.store-freeware')).to_be_visible()
                    page.clock.run_for(3100)
                    clipping(page.locator('.store-page'))
                    snap(page, f'prototype-store-{lang}-{size[0]}')
                    button(page.locator('.store-page'), lang, 'store.viewSales').click()
                    page.clock.run_for(8100)
                    page.locator('[data-spec=color] button').click()
                    button(page.locator('.shipping-page'), lang, 'release.startNext').click()
                    page.clock.run_for(1200)
                    current = export(page)
                    assert current['run']['version'] == 'v1' and current['persistent']['specs']['color'] == 1
                    context.close()
                    scenes.append({'scene': 'prototype release flow', 'language': lang, 'viewport': size})
            passed('Prototype follows its own freeware page, then buys 256 colors and restarts v1')

            for era in eras:
                for lang in languages:
                    for size in sizes:
                        for notice in ['advice', 'offline']:
                            context, page = scene('stage7-' + notice + str(era), lang, size)
                            native = page.locator('.' + ('advice-notification' if notice == 'advice' else 'offline-notification'))
                            expect(native).to_be_visible()
                            clipping(native)
                            whole(page, native)
                            if notice == 'offline':
                                for _ in range(10):
                                    page.locator('.desktop-live > .desktop-taskbar .taskbar-clock').click()
                                expect(page.locator('.desktop-live > .achievement-toast')).to_be_visible()
                                page.clock.run_for(20)
                            separate_notices(page, native)
                            snap(page, f'{notice}-{era}-{lang}-{size[0]}')
                            native.get_by_role('button').last.click()
                            expect(native).not_to_be_visible()
                            context.close()
                            print('NOTICE', notice, era, lang, size[0], flush=True)
                            scenes.append({'scene': notice, 'era': era, 'language': lang, 'viewport': size})
            passed('Each desktop era renders native advice and absence notices; both are readable and dismissible')

            context, page = scene('release-ready')
            keyboard_save = export(page)
            context.close()
            keyboard_save['persistent']['seedSkills'] = list(set(keyboard_save['persistent']['seedSkills'] + ['keyboard', 'hold']))
            context, page = scene('keyboard-summary', save=keyboard_save)
            page.locator('.prototype-release').click()
            before = export(page)['resources']['pixels']
            summary = page.locator('.release-confirmation .release-photo-picker summary')
            summary.focus()
            page.keyboard.press('Space')
            expect(page.locator('.release-photo-picker')).to_have_attribute('open', '')
            after = export(page)['resources']['pixels']
            assert before == after, (before, after)
            context.close()
            passed('Space opens the release screenshot summary with keyboard/hold skills and does not press the background generator')

            context, page = scene('stage7-ready2')
            legacy = export(page)
            context.close()
            for shot in legacy['persistent']['screenshots']:
                capture = json.loads(shot['data'])
                if capture['version'] == 9:
                    capture['version'] = 8
                    shot['data'] = json.dumps(capture, separators=(',', ':'))
            context, page = scene('scene-eight', save=legacy)
            page.locator('.desktop-live > .desktop-taskbar .taskbar-product').click()
            page.locator('.desktop-programs [data-app-launcher=files]').click()
            files = page.locator('.desktop-live > [data-app=files]')
            files.locator('.files-sidebar button').last.click()
            latest = legacy['persistent']['screenshots'][-1]['id']
            files.locator('[data-file="shot:' + str(latest) + '"]').dblclick()
            frozen = files.locator('.screenshot-preview .desktop-frozen').first
            expect(frozen).to_be_visible()
            assert frozen.locator('.release-progress-ring').count() == 0
            assert frozen.locator('.era-progress').count() == 1
            context.close()
            passed('A valid previous Scene-8 picture keeps the original progress bars and does not receive the new release ring')

            for lang in languages:
                for size in sizes:
                    context, page = scene('stage7-no-photos', lang, size)
                    page.locator('.taskbar-progress').click()
                    page.locator('.desktop-release-action').click()
                    page.locator('.release-confirmation > footer button').first.click()
                    expect(page.locator('.store-hero .desktop-frozen')).to_be_visible()
                    assert export(page)['persistent']['products'][-1]['screenshots'] == []
                    snap(page, f'store-fallback-{lang}-{size[0]}')
                    context.close()
                    scenes.append({'scene': 'store without photos', 'language': lang, 'viewport': size})
            passed('A release with no screenshots renders its frozen current desktop as the product image')
        if args.desktop_only:
            def open_app(page, app):
                page.locator('.desktop-live > .desktop-taskbar .taskbar-product').click()
                page.locator('.desktop-programs [data-app-launcher=' + app + ']').click()
                app_window = page.locator('.desktop-live > [data-app=' + app + ']')
                if 'is-maximized' not in app_window.get_attribute('class'):
                    app_window.locator('.window-controls button').nth(1).click()
                return app_window

            for lang in languages:
                for size in sizes:
                    context, page = scene('stage7-ready2', lang, size)
                    settings = open_app(page, 'settings')
                    skill = settings.locator('.desktop-skill').filter(has_text=text(lang, 'desktop.skill.major3'))
                    skill.get_by_role('button').click()
                    page.clock.run_for(2100)
                    assert 'desktop-era-3' in page.locator('.desktop-live').get_attribute('class')
                    files = open_app(page, 'files')
                    expect(files.locator('.files-ribbon')).to_be_visible()
                    clipping(files)
                    snap(page, f'desktop-flat-files-{lang}-{size[0]}')
                    settings = open_app(page, 'settings')
                    button(settings.locator('aside'), lang, 'settings.records').click()
                    assert settings.locator('[data-achievement]').count() == 28
                    clipping(settings)
                    snap(page, f'desktop-flat-records-{lang}-{size[0]}')
                    button(settings.locator('aside'), lang, 'settings.sound').click()
                    expect(settings.get_by_label(text(lang, 'sound.enabled'), exact=True)).to_be_checked()
                    slider = settings.get_by_label(text(lang, 'sound.volume'), exact=True)
                    slider.focus()
                    page.keyboard.press('ArrowRight')
                    assert export(page)['persistent']['progress']['sound']['volume'] == .2
                    clipping(settings)
                    snap(page, f'desktop-flat-sound-{lang}-{size[0]}')
                    context.close()
                    scenes.append({'scene': 'desktop third update, ribbon, records, sound', 'era': 3, 'language': lang, 'viewport': size})
                    print('FLAT', lang, size[0], flush=True)
            passed('Buy the third major update through Settings; maximized Files ribbon, records, and sound remain readable in all languages and sizes')

        if args.taskbar_only:
            for lang in languages:
                for size in sizes:
                    context, page = scene('stage7-ready3', lang, size)
                    progress = page.locator('.desktop-live > .desktop-taskbar .taskbar-progress')
                    number = progress.locator('.release-progress-count')
                    expect(number).to_be_visible()
                    assert '5' in number.inner_text()
                    whole(page, number)
                    assert progress.get_attribute('title') == progress.get_attribute('aria-label')
                    snap(page, f'desktop-flat-ready-{lang}-{size[0]}')
                    progress.click()
                    clipping(page.locator('.desktop-live > .desktop-conditions'))
                    snap(page, f'conditions-3-{lang}-{size[0]}')
                    page.locator('.desktop-live > .desktop-conditions .desktop-release-action').click()
                    dialog = page.locator('.release-confirmation')
                    clipping(dialog)
                    snap(page, f'confirmation-3-{lang}-{size[0]}')
                    dialog.locator(':scope > footer button').first.click()
                    page.clock.run_for(3100)
                    clipping(page.locator('.store-page'))
                    snap(page, f'store-3-{lang}-{size[0]}')
                    button(page.locator('.store-page'), lang, 'store.viewSales').click()
                    page.clock.run_for(8100)
                    clipping(page.locator('.shipping-page'))
                    snap(page, f'shipping-3-{lang}-{size[0]}')
                    page.locator('[data-spec=refresh] button').click()
                    page.locator('.contract-selection select').select_option('no-color')
                    snap(page, f'shipping-ready-3-{lang}-{size[0]}')
                    button(page.locator('.shipping-page'), lang, 'release.startNext').click()
                    page.clock.run_for(1200)
                    snap(page, f'v2-inheriting-3-{lang}-{size[0]}')
                    page.clock.run_for(10800)
                    clipping(page.locator('.seed-page'))
                    snap(page, f'v2-3-{lang}-{size[0]}')
                    context.close()
                    scenes.append({'scene': 'flat taskbar count and refreshed release images', 'era': 3, 'language': lang, 'viewport': size})
                    print('TASKBAR', lang, size[0], flush=True)
            passed('Flat taskbar keeps n/5 visible with a complete title; refreshed principal release images retain readable controls')

        if args.seed_only:
            for lang in languages:
                for size in sizes:
                    context, page = scene('stage7-v2-inherit', lang, size)
                    expect(page.locator('.seed-page.seed-era-1')).to_be_visible()
                    snap(page, f'v2-inheriting-3-{lang}-{size[0]}')
                    page.clock.run_for(12000)
                    assert export(page)['run']['seed']['installer'] is None
                    seed = page.locator('.seed-page')
                    expect(seed.locator('.guide-body')).to_have_text(text(lang, 'guide.return.v2'))
                    content = seed.locator('.seed-content')
                    card = content.bounding_box()
                    assert abs(card['x'] + card['width'] / 2 - size[0] / 2) <= 2, card
                    tools = seed.locator('.page-tools').bounding_box()
                    assert tools['y'] >= card['y'] + card['height'] - 1, (tools, card)
                    clipping(seed)
                    snap(page, f'v2-3-{lang}-{size[0]}')
                    button(seed, lang, 'seed.settings').click()
                    select = page.locator('.seed-era-setting select')
                    select.select_option('0')
                    clipping(page.locator('.page-settings'))
                    snap(page, f'seed-appearance-settings-3-{lang}-{size[0]}')
                    button(page.locator('.page-settings'), lang, 'settings.back').click()
                    assert 'seed-era-1' not in page.locator('.seed-page').get_attribute('class')
                    snap(page, f'seed-classic-3-{lang}-{size[0]}')
                    context.close()
                    scenes.append({'scene': 'v2 homepage, guide and appearance settings', 'language': lang, 'viewport': size})
                    print('SEED', lang, size[0], flush=True)
            passed('The v2 homepage is centered, keeps layout controls below it, and can return to the classic appearance')

        if args.apps_only:
            if args.resume and (OUT / 'apps.json').exists():
                previous = json.loads((OUT / 'apps.json').read_text())
                scenes.extend(previous['scenes'])
            completed = {(scene['app'], scene['language'], scene['viewport'][0]) for scene in scenes}
            for lang in languages:
                for size in sizes:
                    context, page = scene('stage7-ready3', lang, size)
                    for app in ['files', 'mail', 'manager', 'photo', 'bin', 'clock', 'theme', 'terminal', 'note', 'settings', 'tessera']:
                        if args.app and app not in args.app:
                            continue
                        if (app, lang, size[0]) in completed and app not in args.recheck_app:
                            continue
                        page.locator('.desktop-live > .desktop-taskbar .taskbar-product').click()
                        page.locator('.desktop-programs [data-app-launcher=' + app + ']').click()
                        app_window = page.locator('.desktop-live > [data-app=' + app + ']')
                        if 'is-maximized' not in app_window.get_attribute('class'):
                            app_window.locator('.window-controls button').nth(1).click()
                        expect(app_window).to_be_visible()
                        whole(page, app_window)
                        snap(page, f'flat-app-{app}-{lang}-{size[0]}')
                        clipping(app_window)
                        if app == 'files':
                            ribbon = app_window.locator('.files-ribbon').bounding_box()
                            content = app_window.locator('.window-content').bounding_box()
                            assert ribbon['y'] + ribbon['height'] <= content['y'] + 1, (ribbon, content)
                            button(app_window.locator('.files-ribbon'), lang, 'files.sort.date').click()
                            assert export(page)['run']['desktop']['fileSort'] == 'date'
                        if app == 'clock':
                            whole(page, app_window.locator('[data-app-part=time] .clock-face p'))
                            timer = app_window.locator('[data-app-part=timer]')
                            whole(page, timer.locator('.clock-timer > button'))
                            timer.locator('input').fill('09:30')
                            def readable(locator):
                                contrast = locator.evaluate(r'''e=>{const s=getComputedStyle(e),lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}''')
                                assert contrast >= 4.5, contrast
                            readable(timer.locator('.clock-timer > button'))
                            timer.locator('.clock-timer > button').click()
                            assert export(page)['run']['desktop']['reservation']['done'] is False
                            clipping(timer)
                            whole(page, timer.locator('.clock-timer > button'))
                            readable(timer.locator('.clock-timer > button'))
                            timer.locator('input').fill('')
                            expect(timer.locator('.clock-timer > button')).to_be_disabled()
                            readable(timer.locator('.clock-timer > button'))
                            snap(page, f'flat-app-clock-disabled-{lang}-{size[0]}')
                            timer.locator('input').fill('09:30')
                        if app == 'photo':
                            ranges = app_window.locator('input[type=range]')
                            assert ranges.count() >= 1
                            for control in ranges.all():
                                assert control.evaluate('e=>getComputedStyle(e).appearance') == 'none'
                                assert control.evaluate('e=>getComputedStyle(e,"::-webkit-slider-thumb").borderRadius') == '0px'
                        snap(page, f'flat-app-{app}-{lang}-{size[0]}')
                        scenes[:] = [scene for scene in scenes if (scene['app'], scene['language'], scene['viewport'][0]) != (app, lang, size[0])]
                        scenes.append({'scene': 'maximized flat application', 'app': app, 'era': 3, 'language': lang, 'viewport': size})
                        (OUT / 'apps.json').write_text(json.dumps({'checks': checks, 'scenes': scenes, 'pageErrors': errors, 'complete': False}, ensure_ascii=False, indent=2) + '\n')
                        print('APP', app, lang, size[0], flush=True)
                    context.close()
            passed('All 11 flat-era apps maximize without clipped text; the Files ribbon stays above content, clock date/reservation fit, and photo controls keep square thumbs')

        browser.close()

    assert not errors, errors
    report = {'checks': checks, 'scenes': scenes, 'pageErrors': errors}
    if args.apps_only:
        report['complete'] = True
    name = 'smoke.json' if args.smoke else 'apps.json' if args.apps_only else 'seed.json' if args.seed_only else 'taskbar.json' if args.taskbar_only else 'desktop.json' if args.desktop_only else 'extras.json' if args.extras_only else 'flow.json' if args.flow_only else 'checks.json'
    (OUT / name).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'checks': len(checks), 'scenes': len(scenes), 'pageErrors': errors}, ensure_ascii=False))


if __name__ == '__main__':
    main()
