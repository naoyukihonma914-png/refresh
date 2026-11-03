"""TP-1..TP-3 acceptance through real controls of the built single HTML.

Serve game/dist at /play/, then e.g.:
  python tools/check_testplay.py --step tp1 --output-dir game/artifacts/testplay-tp1
  python tools/check_testplay.py --step route --output-dir game/artifacts/testplay-route

Setup, exports/imports, frozen time, geometry, and screenshots reuse the existing
browser harness. Old four-part page flows and generic finishing actions are not
used as evidence for this redesign. No gameplay state is injected into the page.
"""
import argparse
import gzip
import hashlib
import html
import json
import re
import shutil
import zipfile
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright,expect
from check_stage8b import Review,ROOT,LANGUAGES,SIZES,CURRENT_SCHEMA_VERSION

MAIN_SETS=['common','foundation','files','mail']
PAGE_PARTS=['heading','notice','pixels','generator','cursors','upgrades']
SEED_ITEMS=['border','save','color','font','layout','motion','bars','workspace','export']


def catalog():
    source=(ROOT/'game/src/content/workshopCatalog.ts').read_text()
    pattern=r"make\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^]]*)\]\s*,\s*'([^']+)'"
    parts=[]
    for identity,kind,elements,interaction in re.findall(pattern,source):
        parts.append({'id':identity,'kind':kind,'set':'extras' if identity.startswith('plugin-') else identity.split('-')[0],'elements':re.findall(r"'([^']+)'",elements),'interaction':interaction})
    assert len([p for p in parts if p['set'] in MAIN_SETS])==22
    return parts


def schematic_regions():
    source=(ROOT/'game/src/config/balance.ts').read_text()
    start=source.index('{',source.index('workshopHelp:'))
    help_config,_=json.JSONDecoder().raw_decode(source[start:])
    return help_config['regions']


class TestplayChecks(Review):
    def geometry(self,page,scope):
        super().geometry(page,scope)
        bad=scope.locator('.tp-finish-trial li').evaluate_all('''nodes=>nodes.flatMap(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);if(!r.width||!r.height||n.closest('[inert]'))return [];return n.scrollWidth>n.clientWidth+2&&!['auto','scroll'].includes(s.overflowX)?[{text:n.textContent,client:n.clientWidth,scroll:n.scrollWidth}]:[];})''')
        assert not bad,('Finish trial letter rows overflow',bad)

    def persist(self):
        cases=self.report['cases']
        self.report.update(passed=sum(c['status']=='passed' for c in cases),failed=sum(c['status']=='failed' for c in cases),pageErrors=[v for c in cases for v in c['pageErrors']],externalRequests=[v for c in cases for v in c['externalRequests']],console=[{'case':c['id'],**v} for c in cases for v in c['console']])
        (self.out/'summary.json').write_text(json.dumps(self.report,ensure_ascii=False,indent=2)+'\n')
        intro='<!doctype html><html lang="ja"><meta charset="utf-8"><title>TP-1〜TP-3確認</title><style>body{font:14px/1.5 sans-serif;background:#eee;color:#222;margin:20px}h1{font-size:22px}h2{font-size:16px}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}a{display:block;color:#222;background:white;border:1px solid #aaa;padding:6px}img{display:block;width:100%}pre{white-space:pre-wrap;color:#900}</style><h1>TP-1〜TP-3：初動・配置・制作</h1>'
        for step in [None,'tp1','shell','route','help','preview','fresh','replay','migration','embedded','motion-scale']:
            selected=cases if step is None else [c for c in cases if c['step']==step]
            cards=[]
            for c in selected:
                images=''.join('<a href="'+html.escape(i['file'])+'"><img loading="lazy" src="'+html.escape(i['file'])+'"><span>'+html.escape(i['label'])+'</span></a>' for i in c['images'])
                cards.append('<section><h2>'+html.escape(c['id'])+' — '+c['status']+'</h2>'+('<pre>'+html.escape(c['error'])+'</pre>' if c.get('error') else '')+'<div>'+images+'</div></section>')
            (self.out/('index.html' if step is None else step+'.html')).write_text(intro+''.join(cards)+'</html>')

    def open(self,fixture,c):
        context=self.browser.new_context(viewport={'width':c['width'],'height':SIZES[c['width']]},locale='ja-JP' if c['language']=='ja' else 'en-US',timezone_id='Asia/Tokyo',reduced_motion='reduce' if c['step']=='motion-scale' else 'no-preference')
        def route(request):
            if request.request.url.startswith(self.args.base_url):request.continue_()
            else:c['externalRequests'].append(request.request.url);request.abort()
        context.route('**/*',route)
        page=context.new_page();page.set_default_timeout(12000)
        page.on('pageerror',lambda e:c['pageErrors'].append(str(e)))
        page.on('console',lambda m:c['console'].append({'type':m.type,'text':m.text}) if m.type in ['warning','error','assert'] else None)
        now=datetime(2026,11,3,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
        self.navigate(page,fixture,c)
        return context,page

    def run(self,step,language,width,era):
        identity=f'{step}-era{era}-{language}-{width}'
        old=next((c for c in self.report['cases'] if c['id']==identity),None)
        if self.args.resume and not self.args.recheck and old and old['status']=='passed':return
        c={'id':identity,'step':step,'language':language,'width':width,'era':era,'status':'running','images':[],'pageErrors':[],'externalRequests':[],'console':[]}
        build=(ROOT/'game/dist/index.html').read_bytes();c['buildSha256']=hashlib.sha256(build).hexdigest()
        self.report['cases']=[x for x in self.report['cases'] if x['id']!=identity]+[c]
        context=page=None
        try:
            fixture={'tp1':f'tp1-before-layout-era{era}','shell':f'tp1-workshop-shell-era{era}','route':f'tp2-route-era{era}','help':f'tp2-help-catalog-era{era}','preview':f'tp3-progress-0-era{era}','fresh':None,'replay':f'tp3-second-run-era{era}','migration':f'tp1-stable-era{era}','embedded':f'stage8b-editor-era{era}','motion-scale':f'tp1-before-layout-era{era}'}[step]
            context,page=self.open(fixture,c)
            {'tp1':self.page_layout,'shell':self.workshop_shell,'route':self.mainline,'help':self.all_help,'preview':self.preview,'fresh':self.fresh_start,'replay':self.replay,'migration':self.migration,'embedded':self.embedded,'motion-scale':self.motion_scale}[step](page,c)
            assert not c['pageErrors'],c['pageErrors'];assert not c['externalRequests'],c['externalRequests'];assert not c['console'],c['console']
            c['status']='passed';print('PASS',identity,flush=True)
        except Exception as e:
            c.update(status='failed',error=str(e))
            if page:self.capture(page,c,'確認中の問題','failure')
            print('FAIL',identity,str(e),flush=True)
            if not self.args.keep_going:raise
        finally:
            if context:context.close()
            self.persist()

    def seed(self,page):return page.locator('[data-seed-construction]').first

    def parts(self,root):
        return root.locator('[data-page-part]').evaluate_all('nodes=>Object.fromEntries(nodes.filter(n=>!n.closest("[inert]")).map(n=>{const r=n.getBoundingClientRect();return [n.dataset.pagePart,{x:r.x,y:r.y,width:r.width,height:r.height}]}))')

    def box(self,node):return node.evaluate('node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}')

    def same_box(self,a,b,label,keys=('x','y','width','height')):
        for key in keys:assert abs(a[key]-b[key])<=1,(label,key,a,b)

    def logical_scale(self,root):return root.evaluate('node=>node.getBoundingClientRect().width/node.offsetWidth')

    def dismiss_help(self,page):
        dialog=page.locator('[data-workshop-help-dialog]')
        if dialog.count() and dialog.is_visible():dialog.locator('[data-workshop-help-close]').click()

    def quiet(self,page):
        for _ in range(4):
            close=page.locator('.ws-guide>button,.achievement-toast header>button,.seed-construction-notice button')
            visible=[close.nth(i) for i in range(close.count()) if close.nth(i).is_visible()]
            if not visible:break
            visible[0].click()

    def drag(self,page,node,dx,dy):
        node.scroll_into_view_if_needed();r=self.box(node)
        x,y=r['x']+r['width']/2,r['y']+r['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=10);page.mouse.up()

    def page_layout(self,page,c):
        root=self.seed(page);expect(root).to_be_visible()
        generator=root.locator('[data-part=primary]')
        before=self.box(generator);scale=self.logical_scale(root)
        assert before['width']/scale>=160-1 and before['height']/scale>=40-1,('Generator minimum',before,scale)
        before_space=self.state(page)
        generator.focus();generator.press('Space');page.clock.run_for(50)
        # Passive UI production is allowed; a Space press must not produce a manual click.
        state=self.state(page);assert not any(key in state['persistent']['seedSkills'] for key in ['keyboard','hold'])
        assert state['run']['seed']['lastActionAt']==before_space['run']['seed']['lastActionAt'],'Unowned Space must not perform a manual generation'
        self.same_box(before,self.box(generator),'Unowned Space')
        point=(before['x']+before['width']/2,before['y']+before['height']/2)
        for _ in range(25):page.mouse.click(*point);page.clock.run_for(40)
        self.same_box(before,self.box(generator),'25 fixed-point presses')
        assert page.evaluate('p=>!!document.elementFromPoint(p[0],p[1])?.closest("[data-part=primary]")',point)
        self.geometry(page,root);self.capture(page,c,'通知が出ても固定された生成ボタン','fixed-generator')
        self.quiet(page);self.same_box(before,self.box(generator),'Guide closes')
        self.capture(page,c,'お知らせを閉じても生成位置は同じ','fixed-generator-quiet')
        for _ in range(2):root.locator('[data-seed-upgrade=cursor]').click()
        cursors=root.locator('.seed-auto-cursor');expect(cursors).to_have_count(2)
        cursor_boxes=cursors.evaluate_all('nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))')
        for cursor in cursor_boxes:
            assert abs(cursor['width']/scale-18)<1 and abs(cursor['height']/scale-24)<1,('PR22 cursor size',cursor,scale)
        self.same_box(before,self.box(generator),'Auto cursor purchase leaves generator fixed')
        root.locator('[data-seed-upgrade=layout]').click()
        if c['era']==0:
            expect(root.locator('[data-page-layout-mode=true]')).to_be_visible()
            expect(root.locator('[data-page-first-guide]')).to_be_visible()
            assert not root.locator('[data-page-first-guide]').text_content().strip(),'The first placement ghost must be an outline without visible text'
            assert root.locator('[data-page-first-guide]').get_attribute('aria-label'),'The text-free ghost retains its accessible explanation'
            if c['step']=='motion-scale':assert root.locator('[data-page-first-guide]').evaluate('n=>getComputedStyle(n).animationName')=='none'
            self.capture(page,c,'レイアウト購入で自動的に開いた配置の見本','first-layout-guide')
        else:
            assert root.locator('[data-page-first-guide]').count()==0,'Experienced versions must not replay first-ever guide'
            root.locator('[data-page-action=arrange]').click()
        expect(root.locator('[data-page-layout-mode=true]')).to_be_visible()
        assert set(self.parts(root))==set(PAGE_PARTS)
        canvas_box=self.box(root.locator('.page-layout-canvas'))
        grip_boxes=root.locator('.page-part-grip').evaluate_all('nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {part:n.dataset.pagePartGrip,x:r.x,y:r.y,width:r.width,height:r.height,title:n.title,label:n.getAttribute("aria-label")}})')
        assert len(grip_boxes)==6
        for grip in grip_boxes:
            assert grip['title'] and grip['label'],'A truncated visual grip name must keep its complete accessible explanation'
            assert grip['x']>=canvas_box['x']-.5 and grip['y']>=canvas_box['y']-.5 and grip['x']+grip['width']<=canvas_box['x']+canvas_box['width']+.5 and grip['y']+grip['height']<=canvas_box['y']+canvas_box['height']+.5,('Placement grip outside canvas',grip,canvas_box)
        # Keyboard editing works without invoking a generation shortcut.
        before_edit=self.state(page)
        gen_part=root.locator('[data-page-part=generator]')
        grip=gen_part.locator('.page-part-grip,[data-page-grip]').first
        expect(grip).to_be_visible()
        root.locator('[data-page-action=finish]').first.click()
        self.capture(page,c,'通常時にも残る薄い配置の取っ手','normal-handles')
        parts_before=self.parts(root)
        controls=root.locator('[data-page-part-setting=generator]')
        if not controls.count():
            root.locator('[data-page-action=arrange]').click();controls=root.locator('[data-page-part-setting=generator]')
        controls.locator('[data-page-size=extraLarge]').click()
        if root.locator('[data-page-layout-mode=true]').count():root.locator('[data-page-action=finish]').first.click()
        parts_after=self.parts(root)
        assert parts_after['generator']['width']>parts_before['generator']['width'] or parts_after['generator']['height']>parts_before['generator']['height']
        for part in ['pixels','cursors']:self.same_box(parts_before[part],parts_after[part],'Generator-only resize leaves '+part)
        self.geometry(page,root);self.capture(page,c,'生成ボタンだけを特大にした状態','generator-extra-large')
        root.locator('[data-page-action=arrange]').click()
        selected=root.locator('[data-page-selected-part]');selected.select_option('heading')
        root.locator('[data-page-font-size]').select_option('large')
        root.locator('[data-page-action=finish]').first.click()
        stored=self.state(page);assert stored['run']['seed']['page']['partFonts']['heading']=='large'
        root.locator('[data-page-action=settings]').click();expect(root.locator('[data-ui-scale]')).to_be_visible()
        self.capture(page,c,'個別部品の設定と全体UIスケールの設定','page-settings')
        root.locator('[data-ui-scale]').select_option('1.25')
        assert self.state(page)['run']['seed']['page']==stored['run']['seed']['page'],'UI scale must not rewrite saved page coordinates'
        root.locator('[data-ui-scale]').select_option('1')
        # Fixture preferences are isolated memory; prove persistence on a normal URL after real import.
        migrated=self.import_state(page,stored,c);assert migrated['schemaVersion']==CURRENT_SCHEMA_VERSION
        root=self.seed(page);assert root.locator('[data-page-first-guide]').count()==0
        root.locator('[data-page-action=settings]').click();root.locator('[data-ui-scale]').select_option('1.25')
        expect(page.locator('[data-stage-ui-scale]')).to_have_attribute('data-stage-ui-scale','1.25')
        self.navigate(page,None,c)
        expect(page.locator('[data-stage-ui-scale]')).to_have_attribute('data-stage-ui-scale','1.25')
        assert self.state(page)['run']['seed']['page']==stored['run']['seed']['page']
        root=self.seed(page);assert root.locator('[data-page-first-guide]').count()==0
        root.locator('[data-page-action=settings]').click();root.locator('[data-ui-scale]').select_option('1')
        if c['era']>0:
            root.locator('.page-settings form .skill-row input[type=checkbox]').first.check()
            root.locator('.page-settings form button[type=submit]').click()
            assert 'keyboard' in self.state(page)['persistent']['seedSkills']
            field=root.locator('.page-design-settings input').first
            field.focus();before_input=self.state(page)['resources']['pixels'];field.press('Space')
            assert self.state(page)['resources']['pixels']==before_input,'Space in a settings input must not generate pixels'
            root.locator('.page-settings>button').first.click();generator=root.locator('[data-part=primary]')
            before_space=self.state(page)['resources']['pixels'];generator.focus();generator.press('Space')
            after_space=self.state(page)['resources']['pixels'];generator.click();after_click=self.state(page)['resources']['pixels']
            assert after_space>before_space
            assert abs((after_space-before_space)-(after_click-after_space))<.001,'Owned Space and one pointer press must produce exactly the same amount'
            root.locator('[data-page-action=arrange]').click();before_arrange=self.state(page)['resources']['pixels']
            root.locator('[data-page-part-grip=generator]').focus();page.keyboard.press('Space')
            assert self.state(page)['resources']['pixels']==before_arrange,'Arrangement controls must not invoke generation shortcuts'
            root.locator('[data-page-action=finish]').first.click()
        c['layout']={'fixedGeneratorBefore':before,'generatorOnlyBefore':parts_before,'generatorOnlyAfter':parts_after,'cursorLogicalSize':[18,24],'partFonts':stored['run']['seed']['page']['partFonts'],'firstGuideOnce':True,'uiScaleDoesNotRewriteLayout':True,'uiScaleSurvivesNormalReload':True,'realImportReload':True,'gripsInsideCanvas':True,'gripBounds':grip_boxes}
        self.navigate(page,f'tp1-stable-era{c["era"]}',c);root=self.seed(page);self.quiet(page)
        expect(root.locator('[data-seed-future-preview]')).to_have_attribute('data-seed-future-remaining','1')
        assert not root.locator('[data-page-first-guide]').count()
        self.geometry(page,root);self.capture(page,c,'作業台まわりまで完成した素の画面の最終状態','seed-editor-ready')

    def mainline(self,page,c):
        workshop=page.locator('[data-workshop=true]');expect(workshop).to_be_visible();self.quiet(page)
        done=[];sets=[]
        future=workshop.locator('[data-future-desktop]')
        expect(future).to_have_attribute('data-trial-open','false')
        for part in [part for part in catalog() if part['set'] in MAIN_SETS]:
            marker=workshop.locator('[data-workshop-next]')
            expect(marker).to_have_count(1)
            kind=marker.get_attribute('data-next-kind')
            if kind=='set':
                target=marker if marker.evaluate('n=>n.tagName')=='BUTTON' else marker.locator('[data-workshop-set]').first
                assert target.get_attribute('data-workshop-set')==part['set']
                before=self.state(page);target.click();sets.append(part['set'])
                dialog=page.locator('[data-workshop-help-dialog]');expect(dialog).to_be_visible();expect(dialog).to_have_attribute('data-help-set',part['set'])
                self.capture(page,c,'購入したセットを初めて案内する模式図','first-help-'+part['set'])
                self.dismiss_help(page);after=self.state(page)
                assert sum(x['step']==4 for x in after['run']['workshop']['parts'].values())==len(done)
                assert len(after['run']['workshop']['parts'])>len(before['run']['workshop']['parts'])
                marker=workshop.locator('[data-workshop-next]');expect(marker).to_have_count(1)
            target=marker if marker.evaluate('n=>n.tagName')=='BUTTON' else marker.locator('[data-workshop-part]').first
            assert target.get_attribute('data-workshop-part')==part['id'],(part['id'],target.get_attribute('data-workshop-part'))
            target.click();self.prepare_part(page,workshop,part)
            trial=workshop.locator(f'[data-finish-trial="{part["id"]}"]')
            if part['id']!='common-frame':expect(trial).to_be_visible()
            self.geometry(page,workshop)
            self.capture(page,c,'固有の仕上げを試す: '+part['id'],'finish-'+part['id'])
            before=self.state(page);self.finish_part(page,workshop,part,c)
            expect(workshop.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4')
            after=self.state(page);assert after['run']['workshop']['parts'][part['id']]['tested']
            assert after['resources']['pixels']>=before['resources']['pixels']
            done.append(part['id'])
            future=workshop.locator('[data-future-desktop]');expect(future).to_have_attribute('data-completed-count',str(len(done)))
            expect(future).to_have_attribute('data-trial-open','true')
            expect(future).to_have_attribute('data-trial-part',part['id'])
            if len(done) in [5,11,17,22]:self.capture(page,c,'完成したパーツがはまった未来のデスクトップ','future-'+str(len(done)))
            page.clock.run_for(2800)
            expect(future).to_have_attribute('data-trial-open','false')
            assert self.state(page)['run']['workshop']['parts'][part['id']]==after['run']['workshop']['parts'][part['id']],'The preview must not remake or pay for a completed part'
            self.quiet(page)
        assert sets==MAIN_SETS
        expect(workshop.locator('[data-workshop-next]')).to_have_count(1)
        expect(workshop.locator('[data-workshop-next]')).to_have_attribute('data-next-kind','exit')
        c['mainline']={'sets':sets,'completed':done,'usedOnlyNextMarker':True,'futureCount':len(done),'fourStageProduction':True}

    def workshop_shell(self,page,c):
        w=page.locator('[data-workshop=true]');expect(w).to_be_visible();self.quiet(page)
        gen=w.locator('[data-workshop-action=generate]');before=self.box(gen)
        resources=w.locator('.ws-fixed-resources');before_resources=self.box(resources)
        if c['era']==0:assert w.locator('.ws-token-count').count()==0,'First tokens must appear only when earned'
        self.capture(page,c,'固定された資源と生成ボタン、初エクスポートの前','shell-before-token')
        w.locator('[data-trial-action=apply]').click()
        expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4')
        w.locator('[data-workshop-action=exportPart]').click()
        expect(w.locator('.ws-token-count')).to_be_visible()
        self.same_box(before,self.box(gen),'First token appears without moving generator')
        self.same_box(before_resources,self.box(resources),'First token reserved resource slot')
        point=(before['x']+before['width']/2,before['y']+before['height']/2)
        for _ in range(20):page.mouse.click(*point);page.clock.run_for(40)
        self.same_box(before,self.box(gen),'Workshop fixed-point generator')
        self.capture(page,c,'初トークンとガイドが現れても生成位置は同じ','shell-after-token')
        self.quiet(page);self.same_box(before,self.box(gen),'Workshop guide closes')
        w.locator('.ws-menu-actions>button').nth(1).click()
        w.locator('.ws-editor-settings select:has(option[value="bottom"])').select_option('bottom')
        w.locator('.ws-page-scroll>button').first.click()
        assert self.state(page)['persistent']['editorCustomization']['bandPosition']=='bottom'
        self.same_box(before,self.box(gen),'Moving movable information band down leaves generator fixed at top')
        self.same_box(before_resources,self.box(resources),'Resources stay above a bottom information band')
        assert self.box(resources)['y']<self.box(w)['y']+self.box(w)['height']*.2
        self.geometry(page,w);self.capture(page,c,'情報帯を下にしても資源と生成は上の定位置','shell-bottom-band')
        c['shell']={'generatorBefore':before,'resourceBefore':before_resources,'firstTokenReserved':True,'guideAndTwentyClicksFixed':True,'bottomBandDoesNotMoveResources':True}

    def prepare_part(self,page,w,part):
        step=w.locator('[data-workshop-step]')
        if step.get_attribute('data-workshop-step')=='0':
            guided=w.locator('[data-workshop-example-action=place]')
            if guided.count() and guided.is_visible():guided.click()
            else:w.locator('[data-workshop-action=place]').first.click()
        if step.get_attribute('data-workshop-step')=='1':
            batch=w.locator('[data-workshop-example-action=addAll]')
            if batch.count() and batch.is_visible():batch.click()
            else:
                for element in part['elements']:
                    control=w.locator(f'[data-workshop-element="{element}"]').first
                    if control.is_enabled():control.click()
        if step.get_attribute('data-workshop-step')=='2':
            example=w.locator('[data-workshop-action=useExample]')
            if example.count() and example.is_visible():example.click()
            else:w.locator('[data-workshop-action=confirmAdjustment]').click()
        expect(step).to_have_attribute('data-workshop-step','3');self.quiet(page)

    def finish_part(self,page,w,part,c=None):
        identity=part['id'];trial=w.locator(f'[data-finish-trial="{identity}"]')
        def capture(label):
            if c and c['language']=='ja' and c['width']==1920:self.capture(page,c,label,'playing-'+identity)
        if identity=='common-frame':
            w.locator('[data-workshop-control=minimize]').click()
            restore=w.locator('[data-workshop-action=restoreTarget]')
            if restore.count() and restore.is_visible():restore.click()
        elif identity in ['common-scrollbar','mail-body']:
            scroll=trial.locator('[data-trial-scroll]');before=scroll.evaluate('n=>n.scrollTop');scroll.hover();page.mouse.wheel(0,64);page.clock.run_for(100);page.wait_for_timeout(100)
            expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','3')
            assert scroll.evaluate('n=>n.scrollTop')>before,'The real scroller did not roll'
            capture('実際のページを途中まで転がして滑らかさを試す: '+identity)
            for _ in range(10):
                if not trial.count():break
                scroll.hover();page.mouse.wheel(0,240);page.clock.run_for(200);page.wait_for_timeout(100)
        elif identity=='common-button':trial.locator('[data-trial-action=apply]').click()
        elif identity=='common-heading':
            trial.locator('[data-trial-action=heading]').click();capture('見出しを畳んでから、もう一度開く');trial.locator('[data-trial-action=heading]').click()
        elif identity=='common-progress':
            trial.locator('[data-trial-action=fill]').click();capture('進み具合のバーが満ちる様子を試す');page.clock.run_for(2500)
        elif identity=='foundation-taskbar':trial.locator('[data-trial-app=mail]').click()
        elif identity=='foundation-desktop':trial.locator('[data-trial-selection]').focus();page.keyboard.press('Space')
        elif identity=='foundation-icons':trial.locator('[data-trial-icon]').first.dblclick()
        elif identity=='foundation-notification':trial.locator('[data-trial-action=notice]').click()
        elif identity=='foundation-wallpaper':trial.locator('[data-trial-wallpaper-fit]').select_option('cover')
        elif identity=='foundation-upgrades':trial.locator('[data-trial-action=upgrade]').click()
        elif identity=='files-list':trial.locator('[data-trial-file]').first.click()
        elif identity=='files-back':trial.locator('[data-trial-folder]').select_option('sets');trial.locator('[data-trial-action=back]').click()
        elif identity=='files-sort':trial.locator('[data-trial-sort]').select_option('date')
        elif identity=='files-search':
            target=trial.get_attribute('data-trial-query-target') or trial.locator('[data-trial-query]').get_attribute('data-trial-query-target')
            assert target,'Search trial must identify its real target';trial.locator('[data-trial-query]').fill(target)
        elif identity=='files-large':trial.locator('[data-trial-large]').click()
        elif identity=='files-storage':trial.locator('[data-trial-action=storage]').click()
        elif identity=='mail-list':trial.locator('[data-trial-message]').first.click()
        elif identity=='mail-reply':trial.locator('[data-trial-action=reply]').click();trial.locator('[data-trial-draft]').fill('確認しました' if not c or c['language']=='ja' else 'Checked.');capture('返信の下書きを書いてから保存する');trial.locator('[data-trial-action=save-draft]').click()
        elif identity=='mail-folders':trial.locator('[data-trial-action=archive]').click();capture('手紙を移してから保管庫を開く');trial.locator('[data-trial-folder=archive]').click()
        elif identity=='mail-unread':
            toggle=trial.locator('[data-trial-read-toggle]')
            if toggle.is_checked():toggle.uncheck()
            trial.locator('[data-trial-action=read-message]').click()
        else:raise AssertionError('No specific stage-four operation for '+identity)

    def all_help(self,page,c):
        self.quiet(page);self.dismiss_help(page)
        if page.locator('.desktop-live').count():self.maximize(page,'tessera')
        w=page.locator('[data-workshop=true]');covered=[]
        for set_id in dict.fromkeys(part['set'] for part in catalog()):
            w.locator('[data-workshop-set-selection]').select_option(set_id)
            w.locator(f'[data-workshop-help-set="{set_id}"]').first.click()
            dialog=page.locator('[data-workshop-help-dialog]');expect(dialog).to_be_visible()
            expected={p['id'] for p in catalog() if p['set']==set_id}
            found=set(dialog.locator('[data-help-region][data-highlighted=true]').evaluate_all('n=>n.map(x=>x.dataset.helpRegion)'))
            assert found==expected,(set_id,expected,found)
            self.capture(page,c,'セットの行き先を示す模式図: '+set_id,'help-set-'+set_id)
            page.keyboard.press('Escape');expect(dialog).not_to_be_visible()
            for part in [p for p in catalog() if p['set']==set_id]:
                w.locator(f'[data-workshop-help-part="{part["id"]}"]').click()
                dialog=page.locator('[data-workshop-help-dialog]');expect(dialog).to_have_attribute('data-help-part',part['id'])
                found=dialog.locator('[data-help-region][data-highlighted=true]')
                expect(found).to_have_count(1);expect(found).to_have_attribute('data-help-region',part['id'])
                color=found.evaluate('node=>getComputedStyle(node).stroke')
                assert color in ['rgb(200, 85, 61)','#c8553d'],(part['id'],color)
                actual=found.evaluate('n=>{const m=n.transform.baseVal.consolidate().matrix,b=n.getBBox();return {x:m.e,y:m.f,artX:b.x,artY:b.y,width:b.width,height:b.height}}')
                expected=schematic_regions()[part['id']]
                assert actual['x']==expected['x'] and actual['y']==expected['y'],('Schematic destination',part['id'],actual,expected)
                assert actual['artX']>=-1 and actual['artY']>=-1 and actual['artX']+actual['width']<=expected['width']+1 and actual['artY']+actual['height']<=expected['height']+1,('Schematic art bounds',part['id'],actual,expected)
                if c['language']=='ja' and c['width']==1920:self.capture(page,c,'パーツの行き先を示す模式図: '+part['id'],'help-part-'+part['id'])
                self.geometry(page,dialog);dialog.locator('[data-workshop-help-close]').click();covered.append(part['id'])
        assert len(covered)==len(catalog());c['help']={'setCount':len(set(p['set'] for p in catalog())),'parts':covered,'matchesSchematicRegions':True}

    def preview(self,page,c):
        states=[]
        for count in [0,5,11,17,22]:
            self.navigate(page,f'tp3-progress-{count}-era{c["era"]}',c);self.quiet(page)
            future=page.locator('[data-future-desktop]');expect(future).to_have_attribute('data-completed-count',str(count))
            expect(future).to_have_attribute('data-trial-open','false')
            assert future.get_attribute('data-trial-part') is None,'Loading old completed parts must not replay the test run'
            self.geometry(page,page.locator('[data-workshop=true]'))
            self.capture(page,c,'未来のデスクトップ: 完成'+str(count)+'パーツ','preview-'+str(count));states.append(count)
        c['preview']={'completionCounts':states}

    def fresh_start(self,page,c):
        note=page.locator('.intro-note');expect(note).to_be_visible();note.locator('button').click()
        root=self.seed(page);gen=root.locator('[data-part=primary]');original=self.box(gen);point=(original['x']+original['width']/2,original['y']+original['height']/2)
        ghost=root.locator('[data-seed-future-preview]');expect(ghost).to_be_visible()
        expect(ghost).to_have_attribute('data-seed-future-remaining','9');expect(ghost).to_have_attribute('data-seed-future-next','border')
        assert set(ghost.locator('[data-seed-ghost-part]').evaluate_all('n=>n.map(x=>x.dataset.seedGhostPart)'))==set(SEED_ITEMS)
        start=page.evaluate('Date.now()');purchases=[];presses=0
        gen.focus();gen.press('Space');assert float(root.locator('[data-seed-pixels]').get_attribute('data-seed-pixels'))==0
        while page.evaluate('Date.now()')-start<=60000 and len(purchases)<3:
            page.mouse.click(*point);presses+=1;page.clock.run_for(1000)
            self.same_box(original,self.box(gen),'Fresh fixed click target')
            next_id=['border','save','color'][len(purchases)]
            button=root.locator(f'[data-seed-upgrade="{next_id}"]')
            if button.is_enabled():
                page.clock.run_for(4000);button.click();purchases.append({'item':next_id,'ms':page.evaluate('Date.now()')-start})
                expect(ghost).to_have_attribute('data-seed-future-remaining',str(9-len(purchases)))
                expect(ghost).to_have_attribute('data-seed-future-next',SEED_ITEMS[len(purchases)])
                assert ghost.locator('[data-seed-ghost-part][data-built=true]').count()==len(purchases)
                self.capture(page,c,'新規から'+next_id+'を制作','fresh-'+next_id)
        assert [p['item'] for p in purchases]==['border','save','color'],purchases
        assert purchases[-1]['ms']<=60000,purchases
        state=self.state(page);assert state['run']['seed']['built']==['border','save','color']
        self.geometry(page,root);c['fresh']={'purchases':purchases,'presses':presses,'manualClicksPerSecond':1,'decisionMsPerPurchase':4000,'timeZero':'intro note closed','noDebugPixels':True}

    def migration(self,page,c):
        cases=[]
        for name in ['seed-before-layout','seed-custom-layout','seed-inherited-layout','workshop-mid','desktop-records','shipping']:
            path=ROOT/f'game/src/systems/testdata/tp-v15-main-{name}.json.gz';old=json.loads(gzip.decompress(path.read_bytes()))
            assert old['schemaVersion']==15
            migrated=self.import_state(page,old,c);assert migrated['schemaVersion']==CURRENT_SCHEMA_VERSION
            for key in ['pixels','tokens','dollars']:assert migrated['resources'][key]>=old['resources'][key],(name,key)
            for key in ['specs','seedSkills','editorSkills','products','setDocuments','screenshots']:assert migrated['persistent'][key]==old['persistent'][key],(name,key)
            assert migrated['run']['workshop']['parts']==old['run']['workshop']['parts']
            if old['run']['seed']['page']['layout']:assert set(migrated['run']['seed']['page']['layout']['parts'])==set(PAGE_PARTS)
            if name in ['seed-custom-layout','seed-inherited-layout']:assert migrated['persistent']['testplay']['layoutGuideSeen']
            self.navigate(page,None,c);saved=self.state(page);assert saved['schemaVersion']==CURRENT_SCHEMA_VERSION
            assert saved['persistent']['screenshots']==old['persistent']['screenshots']
            self.capture(page,c,'本物のmain形式15を移行: '+name,'migration-'+name);cases.append(name)
        c['migration']={'sources':cases,'walletsAndWorksPreserved':True,'oldCaptureBytesPreserved':True}

    def replay(self,page,c):
        root=self.seed(page);expect(root).to_be_visible()
        before=self.state(page);assert before['run']['seed']['built']==[]
        assert before['persistent']['products'] and before['persistent']['testplay']['layoutGuideSeen']
        bulk=root.locator('[data-seed-replay]');expect(bulk).to_be_enabled()
        assert bulk.get_attribute('data-seed-replay-count')=='9'
        assert bulk.get_attribute('data-seed-replay-items')==','.join(SEED_ITEMS)
        cost=float(bulk.get_attribute('data-seed-replay-cost'));assert cost>0
        self.capture(page,c,'前の版で作ったUIを一括で作る入口','replay-before')
        bulk.click();after=self.state(page)
        assert after['run']['seed']['built']==SEED_ITEMS
        assert after['run']['world']=='kumiki'
        assert abs((before['resources']['pixels']-after['resources']['pixels'])-cost)<.01,'Known UI must charge its normal quoted pixel cost'
        assert after['resources']['tokens']==before['resources']['tokens'],'Batching must not spend tokens'
        assert after['persistent']['products']==before['persistent']['products']
        assert after['run']['workshop']['purchasedSets']==[] and not after['run']['workshop']['parts']
        assert after['persistent']['testplay']['layoutGuideSeen']
        page.clock.run_for(2000);expect(page.locator('[data-workshop=true]')).to_be_visible()
        self.capture(page,c,'一括制作でも正規のエディタ起動を通り、パーツは作り直す','replay-after')
        assert page.locator('[data-page-first-guide]').count()==0
        c['replay']={'items':after['run']['seed']['built'],'pixelCost':before['resources']['pixels']-after['resources']['pixels'],'tokensUnchanged':True,'materialsMustBeRemade':True,'guideNotRepeated':True}

    def embedded(self,page,c):
        self.quiet(page);self.dismiss_help(page)
        w=self.maximize(page,'tessera');workshop=w.locator('[data-workshop=true]')
        generate=workshop.locator('[data-workshop-action=generate]');before=self.box(generate)
        for _ in range(20):generate.click();page.clock.run_for(40)
        self.same_box(before,self.box(generate),'Embedded generator fixed')
        self.geometry(page,w);self.capture(page,c,'デスクトップの中でも同じ制作画面と固定帯','embedded-workshop')
        assert workshop.locator('[data-future-desktop]').count()==1
        c['embedded']={'generatorFixed':True,'futurePreviewPresent':True}

    def motion_scale(self,page,c):
        self.page_layout(page,c)
        root=self.seed(page)
        if not root.locator('[data-ui-scale]').count():root.locator('[data-page-action=settings]').click()
        select=root.locator('[data-ui-scale]');stored=self.state(page)
        for value in ['0.75','1.5','1']:
            select.select_option(value)
            assert self.state(page)['run']['seed']['page']==stored['run']['seed']['page']
            self.capture(page,c,'動きを減らす設定とUI倍率'+value,'scale-'+value.replace('.','-'))
        self.navigate(page,f'tp3-finish-common-progress-era{c["era"]}',c);self.quiet(page)
        w=page.locator('[data-workshop=true]');future=w.locator('[data-future-desktop]')
        expect(future).to_have_attribute('data-trial-open','false')
        self.finish_part(page,w,next(part for part in catalog() if part['id']=='common-progress'))
        expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4')
        expect(future).to_have_attribute('data-completed-count','5')
        expect(future).to_have_attribute('data-trial-open','true')
        assert future.locator('.ws-schematic-window').evaluate('n=>getComputedStyle(n).animationName')=='none'
        self.capture(page,c,'動きを減らしても仕上げが完了し未来の窓が開く','reduced-motion-completed')
        page.clock.run_for(2800);expect(future).to_have_attribute('data-trial-open','false')
        c['reducedMotion']={'layoutGuideStatic':True,'progressCanComplete':True,'previewStaticAndSettles':True}


def main():
    a=argparse.ArgumentParser();a.add_argument('--base-url',default='http://127.0.0.1:4173');a.add_argument('--output-dir',default='game/artifacts/testplay')
    a.add_argument('--step',action='append',choices=['tp1','shell','route','help','preview','fresh','replay','migration','embedded','motion-scale'])
    a.add_argument('--language',action='append',choices=LANGUAGES);a.add_argument('--width',action='append',type=int,choices=SIZES);a.add_argument('--era',action='append',type=int,choices=[0,1,2,3])
    a.add_argument('--resume',action='store_true');a.add_argument('--recheck',action='store_true');a.add_argument('--keep-going',action='store_true');args=a.parse_args()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);review=TestplayChecks(args,browser)
        for step in args.step or ['tp1','shell','route','help','preview','fresh','replay','migration']:
            eras=args.era or ([0,1,2,3] if step=='embedded' else [0] if step in ['fresh','migration'] else [0,1,2])
            for era in eras:
                for language in args.language or LANGUAGES:
                    for width in args.width or SIZES:review.run(step,language,width,era)
        browser.close()
    assert not review.report['failed'] and not review.report['pageErrors'] and not review.report['console'] and not review.report['externalRequests']
    with zipfile.ZipFile(review.out/'testplay-screens.zip','w',zipfile.ZIP_DEFLATED) as z:
        files=['index.html','summary.json']+[step+'.html' for step in ['tp1','shell','route','help','preview','fresh','replay','migration','embedded','motion-scale']]+[i['file'] for c in review.report['cases'] for i in c['images']]
        for name in dict.fromkeys(files):z.write(review.out/name,name)
    print(json.dumps({key:review.report[key] for key in ['passed','failed','pageErrors','console','externalRequests']},ensure_ascii=False))

if __name__=='__main__':main()
