"""Desktop examples acceptance mixin for ``check_examples.py``.

``ExamplesDesktopMixin.desktop_examples(page, case)`` expects a TestplayChecks
instance and an already opened ``examples-desktop-eraN`` fixture. All mutations
use native controls or the harness's normal save import, never live state writes.
The caller owns matrix dispatch, browser lifetime, reports, and output location.
"""
import gzip
import json
import re

from playwright.sync_api import expect

from check_stage8b import CURRENT_SCHEMA_VERSION, ROOT


DESKTOP_LOGICAL_SIZES = {0: (800, 600), 1: (1024, 768),
                         2: (1366, 768), 3: (1366, 768)}


class ExamplesDesktopMixin:
    def _desktop_message(self, case, key):
        language = 'ja' if case['language'] == 'ja' else 'en'
        messages = json.loads((ROOT / f'game/src/content/locales/{language}.json').read_text())['messages']
        text = messages[key]
        assert isinstance(text, str), key
        if case['language'] == 'en-XA':
            text = '[' + re.sub(r'\{\w+\}|[^{}]+', lambda match: match[0] if match[0].startswith('{') else match[0] + '~' * ((len(match[0]) * 4 + 9) // 10), text) + ']'
        return text

    def _desktop_app_list_reachability(self, page):
        desktop = page.locator('.desktop-live')
        apps = desktop.locator(':scope>.desktop-taskbar>.taskbar-apps')
        buttons = apps.locator(':scope>button')
        assert buttons.count(), 'Native taskbar app list is missing'
        before = self.box(desktop)
        viewport_scroll = page.evaluate('({x:scrollX,y:scrollY})')
        metrics = apps.evaluate('node=>({overflow:getComputedStyle(node).overflowX,width:node.clientWidth,content:node.scrollWidth,left:node.scrollLeft})')
        overflowing = metrics['content'] > metrics['width'] + 1

        def shown(button, label):
            result = button.evaluate('''node=>{const r=node.getBoundingClientRect(),p=node.parentElement.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.x>=p.x-1&&r.right<=p.right+1&&r.y>=p.y-1&&r.bottom<=p.bottom+1,hit:!!hit&&node.contains(hit),button:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},list:{x:p.x,y:p.y,right:p.right,bottom:p.bottom}};}''')
            assert result['inside'] and result['hit'], (label, result)
            self.same_box(before, self.box(desktop), label + ' leaves the desktop stage fixed')
            assert page.evaluate('({x:scrollX,y:scrollY})') == viewport_scroll, label + ' scrolls the page'

        if overflowing:
            assert metrics['overflow'] in ['auto', 'scroll'], ('Taskbar apps are clipped without a way to reach them', metrics)
            r = self.box(apps)
            page.mouse.move(r['x'] + r['width'] / 2, r['y'] + r['height'] / 2)
            page.mouse.wheel(0, 10000)
            page.clock.run_for(40)
            assert apps.evaluate('node=>node.scrollLeft') > 0, 'Vertical wheel did not scroll the native app list'
            shown(buttons.last, 'Wheel reaches the last app')
            page.mouse.wheel(0, -10000)
            page.clock.run_for(40)
            assert apps.evaluate('node=>node.scrollLeft') <= 1, 'Reverse wheel did not return to the first app'
            shown(buttons.first, 'Reverse wheel reaches the first app')
        # Tab through actual controls. Focus must reveal even the last Settings
        # slot locally, without moving the scaled desktop or its outer page.
        buttons.first.focus()
        page.clock.run_for(20)
        shown(buttons.first, 'First app focus')
        for index in range(1, buttons.count()):
            buttons.nth(index - 1).press('Tab')
            page.clock.run_for(20)
            expect(buttons.nth(index)).to_be_focused()
            shown(buttons.nth(index), 'Tab reaches app ' + str(index + 1))
        buttons.first.focus()
        page.clock.run_for(20)
        shown(buttons.first, 'Focus returns to the first app')
        return {'count': buttons.count(), 'overflowing': overflowing, 'wheelBothDirections': overflowing,
                'allTabTargetsInView': True, 'stageAndPageFixed': True}

    def _desktop_example_shell(self, page, case, camera=False):
        """Measure actual rendered taskbar regions, including the compact eras."""
        desktop = page.locator('.desktop-live')
        reachable = self._desktop_app_list_reachability(page)
        data = desktop.evaluate('''root => {
          const box = node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
          const visible = node => {const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
          const taskbar=root.querySelector(':scope>.desktop-taskbar');
          const apps=taskbar.querySelector('.taskbar-apps'),appBox=box(apps);
          const painted=node=>{const r=box(node);if(node.parentElement!==apps)return r;const x=Math.max(r.x,appBox.x),y=Math.max(r.y,appBox.y),right=Math.min(r.right,appBox.right),bottom=Math.min(r.bottom,appBox.bottom);return {x,y,right,bottom,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};};
          const regions=[...taskbar.children].filter(visible).map(node=>({name:node.className,box:box(node)}));
          const buttons=[...taskbar.querySelectorAll('button')].filter(visible).map(node=>({name:node.className||node.getAttribute('aria-label'),box:painted(node),fullBox:box(node),parent:node.parentElement.className})).filter(item=>item.box.width>0&&item.box.height>0);
          const resources=[...root.querySelectorAll(':scope>.desktop-resources button')].filter(visible).map(node=>({name:node.className,box:box(node)}));
          const toolbar=root.querySelector(':scope>.screenshot-toolbar');
          return {desktop:box(root),taskbar:box(taskbar),regions,buttons,resources,
            apps:appBox,
            appButtons:[...apps.querySelectorAll(':scope>button')].filter(visible).map(node=>({name:node.getAttribute('aria-label'),box:painted(node),fullBox:box(node)})),
            camera:visible(toolbar)?box(toolbar):null,toggle:box(root.querySelector(':scope>.screenshot-toggle')),
            app:box(root.querySelector(':scope>.desktop-window[data-app=tessera]'))};
        }''')

        def inside(inner, outer, label):
            assert inner['x'] >= outer['x'] - 1 and inner['right'] <= outer['right'] + 1 and inner['y'] >= outer['y'] - 1 and inner['bottom'] <= outer['bottom'] + 1, (label, inner, outer)

        def separate(first, second, label):
            overlap_x = min(first['right'], second['right']) - max(first['x'], second['x'])
            overlap_y = min(first['bottom'], second['bottom']) - max(first['y'], second['y'])
            assert overlap_x <= 1 or overlap_y <= 1, (label, first, second)

        def native_taskbar_bounds(box, name):
            # The inherited glass-era rendering uses a 42px product orb across
            # its 40px bar, preserving the reference's protruding circular shape.
            # This exception applies only to that inherited shape, never the
            # examples button, app list, resources, release or camera controls.
            if case['era'] != 2 or name != 'taskbar-product':
                return box
            scale = data['desktop']['width'] / DESKTOP_LOGICAL_SIZES[2][0]
            assert box['y'] >= data['taskbar']['y'] - scale - .2 and box['bottom'] <= data['taskbar']['bottom'] + scale + .2, ('Native product orb exceeds its reference bleed', box, data['taskbar'])
            return {**box, 'y': max(box['y'], data['taskbar']['y']),
                    'bottom': min(box['bottom'], data['taskbar']['bottom'])}

        inside(data['taskbar'], data['desktop'], 'Taskbar outside desktop')
        inside(data['toggle'], data['desktop'], 'Camera grab outside desktop')
        for index, region in enumerate(data['regions']):
            native_bounds = native_taskbar_bounds(region['box'], region['name'])
            inside(native_bounds, data['taskbar'], ('Taskbar region outside taskbar', region['name']))
            separate(native_bounds, data['app'], ('Taskbar overlaps maximized Tessera', region['name']))
            for other in data['regions'][index + 1:]:
                separate(region['box'], other['box'], ('Taskbar regions overlap', region['name'], other['name']))
        for index, button in enumerate(data['buttons']):
            inside(native_taskbar_bounds(button['box'], button['name']), data['taskbar'], ('Taskbar button outside taskbar', button['name']))
            for other in data['buttons'][index + 1:]:
                separate(button['box'], other['box'], ('Taskbar buttons overlap', button['name'], other['name']))
        assert data['appButtons'], 'Native taskbar app list is missing'
        for button in data['appButtons']:
            if button['box']['width'] > 0:
                inside(button['box'], data['apps'], ('Visible taskbar app outside app list', button['name']))
        for resource in data['resources']:
            inside(resource['box'], data['desktop'], ('Desktop resource outside desktop', resource['name']))
            for region in data['regions']:
                separate(resource['box'], region['box'], ('Desktop resource overlaps taskbar', resource['name'], region['name']))
        assert bool(data['camera']) == camera, ('Camera strip open state', camera, data['camera'])
        if camera:
            inside(data['camera'], data['desktop'], 'Camera strip outside desktop')
            separate(data['camera'], data['toggle'], 'Camera strip covers its grab')
            for region in data['regions']:
                separate(data['camera'], region['box'], ('Camera strip overlaps taskbar', region['name']))
            self.geometry(page, desktop.locator(':scope>.screenshot-toolbar'))
        # The original camera drawer may cover the app title while open. Its
        # collapsed grab and new taskbar guidance must leave app controls usable.
        else:
            controls = desktop.locator(':scope>.desktop-window[data-app=tessera]>.window-title button, :scope>.desktop-window[data-app=tessera] .ws-app-title>button, :scope>.desktop-window[data-app=tessera] .ws-menu-actions>button, :scope>.desktop-window[data-app=tessera] [data-workshop-action=generate]')
            for box in controls.evaluate_all('nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};})'):
                separate(data['toggle'], box, 'Collapsed camera grab overlaps app control')
        self.geometry(page, desktop.locator(':scope>.desktop-taskbar'))
        data['appReachability'] = reachable
        if case['era'] == 2:
            data['nativeOrbBleed'] = 1
        return data

    def _desktop_examples_settings(self, page):
        frame = self.launch(page, 'settings')
        self.maximize(page, 'settings')
        frame.locator('.settings-app>aside>button').nth(1).click()
        control = frame.locator('[data-examples-input]')
        expect(control).to_be_visible()
        return frame, control

    def _desktop_examples_route(self, page, case):
        self.launch(page, 'tessera')
        frame = self.maximize(page, 'tessera')
        workshop = frame.locator('[data-workshop=true]')
        expect(workshop).to_be_visible()
        expect(workshop.locator('[data-workshop-next-hand]')).to_have_count(0)
        expect(workshop.locator('.ws-navigation-heading')).to_have_text(self._desktop_message(case, 'tp.workshop.route'))
        assert workshop.locator('.ws-navigation-rows .ws-navigation-target').count() >= 4, 'The existing TP2 route disappeared with examples OFF'
        expect(workshop.locator('[data-workshop-set-selection]')).to_be_visible()
        self.geometry(page, frame)
        return frame, workshop

    def _desktop_examples_guides(self, page, case, workshop):
        # These desktop fixtures retain this run's guide mail, while their
        # persistent archive can be empty. Read that actual character message.
        workshop.locator('[data-workshop-set-selection]').select_option('mail')
        workshop.locator('[data-workshop-zoom]').select_option('0.5')
        message = workshop.locator('[data-workshop-canvas-part=mail-list] .ws-target-mail>button').first
        expect(message).to_be_visible()
        message.click()
        expect(message).to_have_attribute('data-mail-read', 'true')
        body = workshop.locator('[data-workshop-canvas-part=mail-body] .ws-destination-mail-body p')
        expect(body).to_be_visible()
        assert body.inner_text().strip()
        body.scroll_into_view_if_needed()
        self.capture(page, case, 'お手本を切っても人物のガイドをメールで読める', 'off-guide-mail')

    def _desktop_examples_old_photos(self, page, case):
        path = ROOT / 'game/src/systems/testdata/examples-v16-7005674-desktop-records.json.gz'
        old = json.loads(gzip.decompress(path.read_bytes()))
        assert old['schemaVersion'] == 16 and 'examplesEnabled' not in old['persistent']
        imported = self.import_state(page, old, case)
        assert imported['schemaVersion'] == CURRENT_SCHEMA_VERSION
        assert imported['persistent']['examplesEnabled'] is True
        expect(page.locator('.desktop-live>.desktop-taskbar>[data-example-next]')).to_have_count(1)
        original = {shot['id']: shot['data'] for shot in old['persistent']['screenshots']}
        assert {shot['id']: shot['data'] for shot in imported['persistent']['screenshots']} == original
        files = self.launch(page, 'files')
        self.maximize(page, 'files')
        files.locator('[data-files-folder=screenshots]').click()
        formats = {}
        for shot in old['persistent']['screenshots']:
            version = json.loads(shot['data'])['version']
            if version in formats:
                continue
            row = files.locator(f'[data-file="shot:{shot["id"]}"]')
            row.scroll_into_view_if_needed()
            row.dblclick()
            preview = files.locator(f'[data-preview-shot="{shot["id"]}"]').first
            expect(preview).to_be_visible()
            expect(preview).to_have_attribute('data-capture-format', str(version))
            expect(preview.locator('[data-example-next],[data-workshop-next-hand],.taskbar-next-hand')).to_have_count(0)
            expect(preview.locator('.capture-taskbar')).to_be_visible()
            formats[version] = shot['id']
            self.capture(page, case, f'旧形式{version}の写真には新しい次の手を混ぜない', f'old-photo-format{version}')
            files.locator('.file-preview>header>button').click()
        assert set(formats) == {1, 11, 12}, formats
        saved = self.state(page)
        assert {shot['id']: shot['data'] for shot in saved['persistent']['screenshots']} == original
        return {'authenticSchema16': True, 'formats': formats, 'frozenBytesPreserved': True, 'newNextAbsent': True}

    def desktop_examples(self, page, c):
        """Exercise desktop examples across the caller's era/language/size matrix."""
        case = c
        initial = self.state(page)
        if case['era'] == 2:
            case['nativeOrbBleed'] = {'logicalPixels': 1, 'basis': 'Inherited 42px native product orb across the 40px taskbar; protruding circular shape follows docs/mockups/03-2-desktop-glass.html', 'onlyProductControl': True}
        assert initial['schemaVersion'] == CURRENT_SCHEMA_VERSION
        expected_size = DESKTOP_LOGICAL_SIZES[case['era']]
        assert initial['run']['desktop']['screen'] == dict(zip(('width', 'height'), expected_size))
        assert initial['persistent']['examplesEnabled'] is True
        self.notices(page)
        self.dismiss_help(page)
        frame = self.maximize(page, 'tessera')
        workshop = frame.locator('[data-workshop=true]')
        expect(workshop).to_be_visible()
        next_button = page.locator('.desktop-live>.desktop-taskbar>[data-example-next]')
        expect(next_button).to_have_count(1)
        expect(next_button).to_be_visible()
        kind = next_button.get_attribute('data-example-next')
        assert kind == 'desktop-open', ('Fixture should offer a concrete closed app', kind)
        full_text = next_button.locator('.example-next-action').inner_text().strip()
        assert full_text and len(full_text) > 2
        full_label = self._desktop_message(case, 'examples.next') + ': ' + full_text
        expect(next_button).to_have_attribute('title', full_label)
        expect(next_button).to_have_attribute('aria-label', full_label)
        # Click the advertised action, then keep all available taskbar apps open
        # so the compact layouts are checked with a realistic crowded app list.
        next_button.click()
        after_click = self.state(page)
        assert after_click['run']['desktop']['active'] == 'files'
        assert after_click['run']['desktop']['windows']['files']['open']
        for app in ['mail', 'photo', 'manager', 'note']:
            if app in after_click['run']['desktop']['apps'] or app == 'note':
                self.launch(page, app)
        self.launch(page, 'tessera')
        self.maximize(page, 'tessera')
        self.geometry(page, frame)
        on_geometry = self._desktop_example_shell(page, case)
        self.capture(page, case, '最大化した組み込みTesseraとタスクバーの具体的な次の手', 'desktop-on')
        desktop = page.locator('.desktop-live')
        desktop.locator(':scope>.screenshot-toggle').click()
        expect(desktop.locator(':scope>.screenshot-toolbar')).to_be_visible()
        camera_geometry = self._desktop_example_shell(page, case, camera=True)
        self.capture(page, case, '撮影の帯を開いてもタスクバーの次の手と資源は重ならない', 'desktop-on-camera')
        page.keyboard.press('Escape')
        expect(desktop.locator(':scope>.screenshot-toolbar')).to_be_hidden()

        settings, control = self._desktop_examples_settings(page)
        expect(control).to_be_checked()
        before_off = self.state(page)
        control.uncheck()
        off = self.state(page)
        assert off['persistent']['examplesEnabled'] is False
        assert off['persistent']['guideArchive'] == before_off['persistent']['guideArchive']
        assert off['run']['workshop']['guide'] == before_off['run']['workshop']['guide']
        assert off['run']['advice'] == before_off['run']['advice']
        assert off['run']['workshop']['parts'] == before_off['run']['workshop']['parts']
        expect(desktop.locator('[data-example-next]')).to_have_count(0)
        self.geometry(page, settings)
        self.capture(page, case, 'デスクトップ本来の設定アプリでお手本を切る', 'native-settings-off')
        frame, workshop = self._desktop_examples_route(page, case)
        off_geometry = self._desktop_example_shell(page, case)
        self.capture(page, case, 'OFFでも元の制作ルートとセットの一覧は使える', 'desktop-off-route')
        self._desktop_examples_guides(page, case, workshop)

        # Fixture preferences live only in memory. Import the actual exported
        # OFF save at the normal URL before testing a browser reload.
        migrated = self.import_state(page, off, case)
        assert migrated['persistent']['examplesEnabled'] is False
        page.reload()
        # The pseudo language is deliberately test-only and is never persisted.
        page.locator('.debug-panel select').first.select_option(case['language'])
        page.evaluate('document.fonts.ready')
        page.locator('.debug-panel').evaluate('node=>node.style.display="none"')
        page.clock.run_for(100)
        reloaded = self.state(page)
        assert reloaded['persistent']['examplesEnabled'] is False
        assert reloaded['run']['desktop']['screen'] == initial['run']['desktop']['screen']
        expect(page.locator('.desktop-live [data-example-next]')).to_have_count(0)
        self._desktop_examples_route(page, case)
        self.capture(page, case, '通常の保存データを再読み込みしてもOFFを保つ', 'desktop-off-reload')
        settings, control = self._desktop_examples_settings(page)
        expect(control).not_to_be_checked()
        control.check()
        assert self.state(page)['persistent']['examplesEnabled'] is True
        expect(page.locator('.desktop-live>.desktop-taskbar>[data-example-next]')).to_have_count(1)
        self.launch(page, 'tessera')
        self.maximize(page, 'tessera')
        self._desktop_example_shell(page, case)
        self.capture(page, case, '設定アプリでONに戻すと具体的な次の手が戻る', 'desktop-on-restored')

        old_photos = self._desktop_examples_old_photos(page, case)
        case['desktopExamples'] = {'logicalScreen': list(expected_size), 'nextKind': kind,
                                  'fullAccessibleLabel': full_label, 'nativeNextWorks': True,
                                  'nativeSettingsToggle': True, 'offSurvivesNormalReload': True,
                                  'oldRouteAndGuidesRetained': True, 'oldPhotos': old_photos,
                                  'geometry': {'on': on_geometry, 'camera': camera_geometry, 'off': off_geometry}}
