"""Stage 8b browser acceptance through the built single HTML.

Build and serve game/dist at /play/, then run:
  python tools/check_stage8b.py
  python tools/check_stage8b.py --step 8b-migration --era 0
  python tools/check_stage8b.py --step 8b-release --era 2

Needs Python Playwright and Chromium. --resume retains passed cases; --recheck reruns
selected cases. Fixtures skip waiting with a debug budget, then each check uses actual
controls, exports, imports, and domain-produced snapshots. No live state injection.
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

ROOT=Path(__file__).resolve().parents[1]
CURRENT_SCHEMA_VERSION=int(re.search(r'SCHEMA_VERSION\s*=\s*(\d+)',(ROOT/'game/src/systems/state.ts').read_text()).group(1))
LANGUAGES=['ja','en','en-XA']
SIZES={1920:1080,1366:768}

class Review:
    def __init__(self,args,browser):
        self.args,self.browser=args,browser
        self.out=ROOT/args.output_dir
        self.out.mkdir(parents=True,exist_ok=True)
        old=self.out/'summary.json'
        self.report=json.loads(old.read_text()) if args.resume and old.exists() else {'cases':[]}

    def persist(self):
        cases=self.report['cases']
        self.report.update(passed=sum(c['status']=='passed' for c in cases),failed=sum(c['status']=='failed' for c in cases),pageErrors=[v for c in cases for v in c['pageErrors']],externalRequests=[v for c in cases for v in c['externalRequests']],console=[{'case':c['id'],**v} for c in cases for v in c['console']])
        (self.out/'summary.json').write_text(json.dumps(self.report,ensure_ascii=False,indent=2)+'\n')
        style='body{font:14px/1.5 sans-serif;background:#eee;color:#222;margin:20px}h1{font-size:22px}h2{font-size:16px}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}a{display:block;color:#222;background:white;border:1px solid #aaa;padding:6px}img{display:block;width:100%}pre{white-space:pre-wrap;color:#900}'
        intro='<!doctype html><meta charset="utf-8"><title>段階8bの確認</title><style>'+style+'</style><h1>段階8b：経済・撮影・周回</h1>'
        for step in [None,'8b1','8b2','8b3']:
            selected=cases if step is None else [c for c in cases if c['step']==step]
            cards=[]
            for c in selected:
                images=''.join('<a href="'+html.escape(i['file'])+'"><img loading="lazy" src="'+html.escape(i['file'])+'"><span>'+html.escape(i['label'])+'</span></a>' for i in c['images'])
                cards.append('<section><h2>'+html.escape(c['id'])+' — '+c['status']+'</h2>'+('<pre>'+html.escape(c['error'])+'</pre>' if c.get('error') else '')+'<div>'+images+'</div></section>')
            (self.out/('index.html' if step is None else step+'.html')).write_text(intro+''.join(cards))

    def open(self,fixture,case):
        context=self.browser.new_context(viewport={'width':case['width'],'height':SIZES[case['width']]},locale='ja-JP' if case['language']=='ja' else 'en-US',timezone_id='Asia/Tokyo')
        def route(request):
            if request.request.url.startswith(self.args.base_url):request.continue_()
            else:case['externalRequests'].append(request.request.url);request.abort()
        context.route('**/*',route)
        page=context.new_page();page.set_default_timeout(12000)
        page.on('pageerror',lambda e:case['pageErrors'].append(str(e)))
        page.on('console',lambda m:case['console'].append({'type':m.type,'text':m.text}) if m.type in ['warning','error','assert'] else None)
        now=datetime(2026,11,3,tzinfo=timezone.utc)
        page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
        self.navigate(page,fixture,case)
        return context,page

    def navigate(self,page,fixture,case):
        page.goto(self.args.base_url+'/play/?debug=1'+('&state='+fixture if fixture else ''))
        page.locator('.debug-panel select').first.select_option(case['language'])
        page.evaluate('document.fonts.ready')
        page.locator('.debug-panel').evaluate('el=>el.style.display="none"')
        page.clock.run_for(100)

    def state(self,page):
        panel=page.locator('.debug-panel')
        panel.evaluate('el=>{el.style.display="block";el.style.position="fixed";el.style.top="0";el.style.left="0";el.style.zIndex="2147483647"}')
        try:
            with page.expect_download() as event:panel.locator('.debug-actions').last.locator('button').first.click()
        finally:panel.evaluate('el=>el.style.display="none"')
        return json.loads(Path(event.value.path()).read_text())

    def capture(self,page,case,label,name):
        filename=case['id']+'-'+name+'.png'
        page.mouse.move(0,0)
        page.screenshot(path=str(self.out/filename))
        case['images']=[i for i in case['images'] if i['file']!=filename]+[{'file':filename,'label':label}]

    def geometry(self,page,scope):
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal viewport overflow'
        bad=scope.locator('button,th,td,label,h1,h2,h3,p,output').evaluate_all('''nodes=>nodes.flatMap(node=>{
          const s=getComputedStyle(node),r=node.getBoundingClientRect();
          const closed=node.closest('details:not([open])');
          if(node.closest('[inert]')||closed&&!closed.querySelector(':scope>summary')?.contains(node)||s.display==='none'||s.visibility==='hidden'||r.width<=0||r.height<=0)return [];
          const x=node.clientWidth>0&&node.scrollWidth>node.clientWidth+2&&!['auto','scroll'].includes(s.overflowX);
          const y=node.clientHeight>0&&node.scrollHeight>node.clientHeight+2&&!['auto','scroll'].includes(s.overflowY);
          return x||y?[{tag:node.tagName,cls:node.className,text:node.textContent,x,y,client:[node.clientWidth,node.clientHeight],scroll:[node.scrollWidth,node.scrollHeight]}]:[];
        })''')
        assert not bad,bad
        clipped=scope.locator('[data-app-part] output').evaluate_all('''nodes=>nodes.flatMap(node=>{
          const r=node.getBoundingClientRect(),part=node.closest('[data-app-part]'),p=part.getBoundingClientRect();
          if(r.width<=0||r.height<=0||node.closest('[inert]'))return [];
          return r.top<p.top-2||r.bottom>p.bottom+2||r.left<p.left-2||r.right>p.right+2?[{part:part.dataset.appPart,text:node.textContent,output:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},bounds:{top:p.top,bottom:p.bottom,left:p.left,right:p.right}}]:[];
        })''')
        assert not clipped,('A readout is outside its adopted slot',clipped)

    def notices(self,page):
        for _ in range(4):
            close=page.locator('.achievement-toast header>button,.seed-achievement>button,.ws-guide>button')
            visible=[close.nth(i) for i in range(close.count()) if close.nth(i).is_visible()]
            if not visible:break
            visible[0].click()

    def run(self,step,language,width,era):
        identity=f'{step}-era{era}-{language}-{width}'
        old=next((c for c in self.report['cases'] if c['id']==identity),None)
        if self.args.resume and not self.args.recheck and old and old['status']=='passed':return
        c={'id':identity,'step':step,'language':language,'width':width,'era':era,'status':'running','images':[],'pageErrors':[],'externalRequests':[],'console':[]}
        self.report['cases']=[x for x in self.report['cases'] if x['id']!=identity]+[c]
        context=page=None
        try:
            fixture={'8b1':'economy-before','8b2':'capture-overlap','8b3':'files-archive','8b-migration':'files-archive','8b-release':'files-archive','8b-custom':'files-archive','8b-photo':'economy-after'}[step]
            context,page=self.open(f'stage8b-{fixture}-era{era}',c)
            {'8b1':self.economy,'8b2':self.capture_content,'8b3':self.roundtrip,'8b-migration':self.migration,'8b-release':self.release_cycle,'8b-custom':self.customize_desktop,'8b-photo':self.photo_album}[step](page,c)
            assert not c['pageErrors'],c['pageErrors']
            assert not c['externalRequests'],c['externalRequests']
            assert not c['console'],c['console']
            c['status']='passed';print('PASS',identity,flush=True)
        except Exception as e:
            c.update(status='failed',error=str(e))
            if page:self.capture(page,c,'確認中の問題','failure')
            print('FAIL',identity,str(e),flush=True)
            if not self.args.keep_going:raise
        finally:
            if context:context.close()
            self.persist()

    def launch(self,page,app):
        desktop=page.locator('.desktop-live')
        desktop.locator('.taskbar-product').click()
        desktop.locator(f'[data-app-launcher="{app}"]').click()
        frame=desktop.locator(f'.desktop-window[data-app="{app}"]').first
        expect(frame).to_be_visible()
        self.notices(page)
        return frame

    def maximize(self,page,app):
        frame=page.locator(f'.desktop-live>.desktop-window[data-app="{app}"]')
        if not self.state(page)['run']['desktop']['windows'][app]['maximized']:
            frame.locator(':scope>.window-title [data-produced-controls=end] button').nth(1).click()
        expect(frame).to_have_class(__import__('re').compile(r'.*is-maximized.*'))
        return frame

    def close(self,page,app):
        frame=page.locator(f'.desktop-live>.desktop-window[data-app="{app}"]')
        if 'is-active' not in (frame.get_attribute('class') or ''):frame=self.launch(page,app)
        frame.locator(':scope>.window-title .window-close').click()

    def ledger(self,page,c,picture=None):
        frame=self.launch(page,'manager');self.maximize(page,'manager')
        manager=frame.locator('[data-producer-total]')
        total=float(manager.get_attribute('data-producer-total'))
        rows=manager.locator('[data-producer-id]').evaluate_all('nodes=>nodes.map(n=>({id:n.dataset.producerId,base:Number(n.dataset.producerBase),rate:Number(n.dataset.producerRate),sources:n.dataset.producerSources.split(/[ ,]+/).filter(Boolean)}))')
        assert abs(sum(row['rate'] for row in rows)-total)<=max(1,abs(total))*1e-9,'Ledger sum differs from displayed total'
        self.geometry(page,frame)
        if picture:self.capture(page,c,'毎秒の内訳',picture)
        self.close(page,'manager')
        return {'total':total,'rows':rows}

    def economy(self,page,c):
        desktop=page.locator('.desktop-live')
        photo=self.maximize(page,'photo')
        self.notices(page)
        before=self.ledger(page,c)
        self.geometry(page,photo)
        self.capture(page,c,'パーツを増やす前のデスクトップ','desktop-before')
        before_text=desktop.locator('.taskbar-pixels:visible small').all_text_contents()
        self.launch(page,'tessera');self.maximize(page,'tessera')
        workshop=desktop.locator('[data-workshop=true]')
        expect(workshop.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','3')
        workshop.locator('[data-workshop-zoom]').select_option('0.5')
        preview=workshop.locator('[data-workshop-canvas-part="photo-crop"] .ws-destination-part').first
        expect(preview).to_be_visible();preview.scroll_into_view_if_needed()
        handle=preview.locator('input[type=range]').first
        box=handle.bounding_box();assert box,'Real crop handle missing'
        page.mouse.move(box['x']+box['width']*.75,box['y']+box['height']/2)
        page.mouse.down();page.mouse.move(box['x']+box['width']*.4,box['y']+box['height']/2,steps=6);page.mouse.up()
        expect(workshop.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4')
        unadopted=self.ledger(page,c)
        photo_row=lambda ledger:next(row for row in ledger['rows'] if row['id']=='app:photo')
        assert 'photo-crop' not in photo_row(before)['sources'] and 'photo-crop' not in photo_row(unadopted)['sources']
        assert photo_row(before)['base']==photo_row(unadopted)['base'],'Unadopted production must not change the app producer'
        frame=self.launch(page,'photo')
        frame.locator(':scope>.window-title .app-rebuild').click()
        builder=desktop.locator('[data-building=photo]')
        expect(builder).to_be_visible()
        material=builder.locator('[data-assembly-source="photo-crop"]')
        expect(material).to_be_visible()
        builder.locator('[data-assembly-action=recommend]').click()
        assert 'photo-crop' in builder.get_attribute('data-assembly-adopted').split()
        builder.locator('[data-assembly-action=install]').click()
        if desktop.locator('.desktop-window[data-app=tessera]').count():self.close(page,'tessera')
        photo=self.maximize(page,'photo')
        after=self.ledger(page,c,'producer-breakdown')
        assert 'photo-crop' in photo_row(after)['sources']
        assert photo_row(after)['base']>photo_row(before)['base'] and after['total']>before['total']
        after_text=desktop.locator('.taskbar-pixels:visible small').all_text_contents()
        assert after_text!=before_text,'The new app rate must be visible in the desktop rate'
        self.geometry(page,photo)
        self.capture(page,c,'新しく作ったパーツを採用した後のデスクトップ','desktop-after')
        photo.locator(':scope>.window-title [data-produced-controls=end] button').first.click()
        minimized=self.ledger(page,c)
        assert abs(minimized['total']-after['total'])<1e-8,'A minimized owned tool must keep producing'
        self.launch(page,'photo');self.close(page,'photo')
        closed=self.ledger(page,c)
        assert abs(closed['total']-after['total'])<1e-8,'A closed owned tool must keep producing'
        c['economy']={'before':before,'unadopted':unadopted,'after':after,'windowLifecycleInvariant':True}

    def take_photo(self,page):
        desktop=page.locator('.desktop-live')
        before=self.state(page)
        desktop.locator('.screenshot-toggle').click()
        desktop.locator('.screenshot-toolbar .capture-button').click()
        after=self.state(page)
        shot=after['persistent']['screenshots'][-1]
        assert len(after['persistent']['screenshots'])==len(before['persistent']['screenshots'])+1
        scene=json.loads(shot['data']);evaluation=scene['evaluation']
        assert scene['version']==12 and evaluation['origin']=='dom'
        assert evaluation['visibleCount']==sum(bool(p['visible']) for p in evaluation['parts'])
        assert all(not p['visibleRects'] and not p['visibleArea'] for p in evaluation['parts'] if not p['visible'])
        assert not any(key in evaluation for key in ['placement','neatness','layoutBonus','perSecond'])
        return shot,evaluation

    def capture_content(self,page,c):
        self.notices(page)
        overlap_state=self.state(page)
        windows=overlap_state['run']['desktop']['windows'];file_rect=windows['files'];note_rect=windows['note']
        desktop=page.locator('.desktop-live');scale=desktop.bounding_box()['width']/overlap_state['run']['desktop']['screen']['width']
        note=desktop.locator('>.desktop-window[data-app=note]')
        header=note.locator(':scope>.window-title').bounding_box();x=header['x']+40*scale;y=header['y']+header['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+(file_rect['x']-note_rect['x'])*scale,y,steps=6);page.mouse.up()
        handle=note.locator(':scope>.window-resize').bounding_box();x=handle['x']+handle['width']/2;y=handle['y']+handle['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+(file_rect['width']-note_rect['width'])*scale,y,steps=6);page.mouse.up()
        self.capture(page,c,'窓を重ねた状態で撮影','capture-overlap')
        partial,pe=self.take_photo(page)
        assert any(p['visible'] and p['hiddenArea']>0 for p in pe['parts'] if p.get('app')=='files'),'Overlap fixture must partially obscure actual Files content'
        assert any(not p['visible'] for p in pe['parts'] if p.get('app')=='files'),'The representative overlap must completely hide some actual Files components'
        frozen=partial['data']
        files=self.launch(page,'files');self.maximize(page,'files')
        files.locator('[data-files-folder=screenshots]').click()
        files.locator(f'[data-file="shot:{partial["id"]}"]').dblclick()
        panel=files.locator('[data-capture-evaluation]')
        expect(panel).to_have_attribute('data-capture-visible',str(pe['visibleCount']))
        expect(panel).to_have_attribute('data-capture-kinds',str(pe['kinds']))
        expect(files.locator(f'[data-preview-shot="{partial["id"]}"]')).to_be_visible()
        self.geometry(page,panel)
        self.capture(page,c,'重なった窓の撮影結果と可視パーツの評価','capture-evaluation')
        preview=files.locator(f'[data-preview-shot="{partial["id"]}"]')
        preview.scroll_into_view_if_needed()
        self.capture(page,c,'アルバムに凍結された重なりの写真','capture-album-photo')
        saved=self.state(page)
        assert next(s for s in saved['persistent']['screenshots'] if s['id']==partial['id'])['data']==frozen,'Album must use a frozen capture'
        self.navigate(page,f'stage8b-capture-covered-era{c["era"]}',c)
        self.notices(page)
        self.capture(page,c,'手前のメモで下のファイルを完全に隠した撮影','capture-covered')
        full,fe=self.take_photo(page)
        fileparts=[p for p in fe['parts'] if p.get('app')=='files']
        assert fileparts and all(not p['visible'] and not p['visibleRects'] for p in fileparts),'Fully obscured Files components must not count'
        assert any(p.get('app')=='note' and p['visible'] for p in fe['parts'])
        assert all(not p['visible'] for p in fe['parts'] if p['type']=='desktop-icon' or p['id']=='desktop:background'),'Covered icons and desktop base must not count'
        files=self.launch(page,'files');self.maximize(page,'files')
        files.locator('[data-files-folder=screenshots]').click();files.locator(f'[data-file="shot:{full["id"]}"]').dblclick()
        panel=files.locator('[data-capture-evaluation]')
        expect(panel).to_have_attribute('data-capture-fully-hidden',str(fe['fullyHidden']))
        self.capture(page,c,'完全に隠れたパーツを除外した評価','capture-covered-evaluation')
        self.navigate(page,f'stage8b-capture-uncovered-era{c["era"]}',c)
        self.notices(page)
        uncovered,ue=self.take_photo(page)
        visible_files={p['id'] for p in ue['parts'] if p.get('app')=='files' and p['visible']}
        partial_files={p['id'] for p in pe['parts'] if p.get('app')=='files' and p['visible']}
        assert partial_files<=visible_files and not any(p.get('app')=='files' and p['visible'] for p in fe['parts'])
        c['capture']={'overlap':pe,'covered':fe,'uncovered':ue,'frozenAlbum':True,'visibleOnly':True}

    def import_state(self,page,state,c):
        self.navigate(page,None,c)
        panel=page.locator('.debug-panel');panel.evaluate('el=>{el.style.display="block";el.style.zIndex="2147483647";el.style.position="fixed";el.style.top="0"}')
        page.once('dialog',lambda dialog:dialog.accept())
        with page.expect_file_chooser() as event:panel.locator('.debug-actions').last.locator('button').nth(1).click()
        event.value.set_files({'name':'stage8b-save.json','mimeType':'application/json','buffer':json.dumps(state,ensure_ascii=False).encode()})
        page.clock.run_for(100)
        panel.evaluate('el=>el.style.display="none"')
        return self.state(page)

    def finish_stream(self,page,workshop,part):
        workshop.locator(f'[data-workshop-part="{part}"]').click()
        step=workshop.locator('[data-workshop-step]')
        if step.get_attribute('data-workshop-step')=='0':
            # Place through the same affordable, validated action as a normal player.
            workshop.locator('[data-workshop-action=place]').click()
        if step.get_attribute('data-workshop-step')=='1':
            elements=workshop.locator('[data-workshop-element]')
            for i in range(elements.count()):
                if elements.nth(i).is_enabled():elements.nth(i).click()
        if step.get_attribute('data-workshop-step')=='2':workshop.locator('[data-workshop-action=confirmAdjustment]').click()
        expect(step).to_have_attribute('data-workshop-step','3')
        target=workshop.locator(f'[data-stream-part="{part}"]')
        target.scroll_into_view_if_needed()
        self.geometry(page,workshop)
        if part=='stream-preview':target.locator('[data-stream-preview-source]').click()
        if part=='stream-sources':target.locator('[data-stream-source]').select_option('1')
        if part=='stream-scenes':target.locator('[data-stream-scene=messages]').click()
        if part=='stream-comments':target.locator('[data-workshop-control=message]').focus()
        expect(step).to_have_attribute('data-workshop-step','4')

    def roundtrip(self,page,c):
        self.notices(page)
        files=self.maximize(page,'files')
        library=files.locator('[data-document-library]')
        current=library.locator('[data-file-kind=set][data-file-edition=current]')
        archive=library.locator('[data-file-kind=set][data-file-edition=archive]')
        current_count=current.count()
        assert current_count>=4 and archive.count()>=4
        assert set(current.evaluate_all('nodes=>nodes.map(n=>n.dataset.fileVersion)'))=={'v1'}
        assert set(archive.evaluate_all('nodes=>nodes.map(n=>n.dataset.fileVersion)'))=={'v0.1'}
        expect(library.locator('[data-file=note]')).to_be_visible()
        self.geometry(page,files)
        self.capture(page,c,'今のセットと旧バージョンの書類が並ぶファイル','files-current-archive')
        blueprint=library.locator('[data-file="blueprint:v1:files"]')
        expect(blueprint).to_be_visible();blueprint.dblclick()
        builder=page.locator('.desktop-live [data-building=files]')
        expect(builder).to_be_visible();builder.locator('[data-assembly-action=recommend]').click();builder.locator('[data-assembly-action=install]').click()
        self.launch(page,'files');self.maximize(page,'files')
        baseline=self.state(page)
        olddocs=[d for d in baseline['persistent']['setDocuments'] if d['version']!='v1']
        archive.first.dblclick()
        old=library.locator('[data-document-readonly=true]')
        expect(old).to_have_attribute('data-document-edition','archive')
        assert old.locator('[data-document-open-editor]').count()==0
        old.locator('.set-document-parts>summary').click()
        assert old.locator('[data-document-part]').count()>0
        self.capture(page,c,'旧バージョンの書類は保存時の内容を読む','files-old-readonly')
        library.locator('.file-preview>header button').click()
        library.locator('[data-file=note]').dblclick()
        note=self.maximize(page,'note')
        textarea=note.locator('textarea');assert textarea.input_value().strip()
        self.capture(page,c,'最初から置いてある制作ノート.txt','production-note')
        textarea.fill(textarea.input_value()+'\n8b');textarea.blur()
        self.launch(page,'tessera');editor=self.maximize(page,'tessera')
        workshop=editor.locator('[data-workshop=true]')
        self.notices(page)
        expect(workshop.locator('[data-workshop-version]')).to_have_attribute('data-workshop-version','v1')
        workshop.locator('[data-workshop-zoom]').select_option('fit')
        fit=workshop.locator('.ws-workbench-scroll').evaluate('node=>({width:node.clientWidth,height:node.clientHeight,scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight})')
        assert fit['scrollWidth']<=fit['width']+2 and fit['scrollHeight']<=fit['height']+2,('Fit must use logical workspace dimensions',fit)
        self.capture(page,c,'世界3に残るエディタのアプリ','desktop-editor')
        workshop.locator('.ws-menu>button').nth(1).click()
        settings=workshop.locator('.ws-editor-settings')
        settings.locator('select').first.select_option('top')
        settings.locator('[data-workshop-customize=panelWidth]').focus()
        settings.locator('[data-workshop-customize=panelWidth]').press('ArrowLeft')
        state=self.state(page);custom=state['persistent']['editorCustomization'];note_text=state['persistent']['productionNote']
        assert [d for d in state['persistent']['setDocuments'] if d['version']!='v1']==olddocs,'Live editing must not mutate archived documents'
        imported=self.import_state(page,state,c)
        assert imported['schemaVersion']==CURRENT_SCHEMA_VERSION and imported['persistent']['editorCustomization']==custom and imported['persistent']['productionNote']==note_text
        self.navigate(page,None,c)
        reloaded=self.state(page)
        assert reloaded['persistent']['editorCustomization']==custom and reloaded['persistent']['productionNote']==note_text,'Save import and a true reload must preserve the customization and note'
        assert [d for d in reloaded['persistent']['setDocuments'] if d['version']!='v1']==olddocs
        self.navigate(page,f'stage8b-stream-draft-era{c["era"]}',c)
        self.notices(page);self.close(page,'tessera')
        page.locator('.desktop-live .taskbar-pixels:visible').first.click()
        upgrades=page.locator('.desktop-live .desktop-upgrades')
        upgrades.locator('[data-world4-open-set]').click()
        expect(page.locator('.desktop-live>.desktop-window[data-app=tessera]')).to_be_visible()
        expect(upgrades).to_be_hidden()
        self.maximize(page,'tessera')
        workshop=page.locator('.desktop-live [data-workshop=true]');workshop.locator('[data-workshop-zoom]').select_option('0.5')
        target=workshop.locator('[data-stream-part=stream-preview]');target.scroll_into_view_if_needed()
        self.capture(page,c,'世界3の工房で次の世界のプレビューを制作中','world4-crafting')
        self.finish_stream(page,workshop,'stream-preview')
        preview=workshop.locator('[data-stream-preview-source]');before_source=preview.get_attribute('data-stream-preview-source')
        self.finish_stream(page,workshop,'stream-sources')
        assert preview.get_attribute('data-stream-preview-source')!=before_source,'Source selection must change the actual preview'
        self.finish_stream(page,workshop,'stream-scenes')
        expect(preview).to_have_attribute('data-stream-preview-scene','messages')
        self.finish_stream(page,workshop,'stream-comments')
        comments=workshop.locator('[data-stream-message]');assert comments.count()>0,'Comments must be actual guide messages'
        readiness=workshop.locator('[data-world4-preparation]');readiness.scroll_into_view_if_needed()
        expect(readiness).to_have_attribute('data-world4-ready','true')
        expect(readiness.locator('[data-world4-document-stored]')).to_have_attribute('data-world4-document-stored','true')
        self.geometry(page,readiness)
        self.capture(page,c,'セットの格納と60Hzがそろった次の世界への進行条件','world4-ready')
        panel=page.locator('.debug-panel');panel.evaluate('el=>el.style.display="block"')
        panel.locator('select').nth(2).select_option('0');panel.evaluate('el=>el.style.display="none"')
        expect(readiness).to_have_attribute('data-world4-ready','false')
        expect(readiness.locator('[data-world4-spec-ready]')).to_have_attribute('data-world4-spec-ready','false')
        self.capture(page,c,'必須セットが格納済みでも表示周波数が足りない状態','world4-spec-blocked')
        stream_state=self.state(page)
        assert any(d['set']=='stream' and d['version']=='v2' for d in stream_state['persistent']['setDocuments'])
        self.navigate(page,f'stage8b-second-workshop-era{min(c["era"],2)}',c)
        workshop=page.locator('[data-workshop=true]');self.notices(page)
        fresh=self.state(page)
        assert fresh['run']['version']=='v2' and fresh['run']['workshop']['purchasedSets']==['common']
        expect(workshop.locator('[data-workshop-version]')).to_have_attribute('data-workshop-version','v2')
        assert all(p['step']==0 for p in fresh['run']['workshop']['parts'].values())
        assert len(fresh['persistent']['setDocuments'])>=8
        expect(workshop.locator('[data-workshop-action=exit]')).to_be_disabled()
        self.geometry(page,workshop)
        workshop.locator('[data-workshop-action=place]').click()
        expect(workshop.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','1')
        expect(workshop.locator('[data-workshop-action=exit]')).to_be_disabled()
        self.capture(page,c,'2周目の世界2では今の版のセットを作り直す','second-workshop-rebuild')
        c['roundtrip']={'currentDocuments':current_count,'archivedDocuments':len(olddocs),'frozenArchive':True,'realImportReload':True,'customization':custom,'streamSourceInteractive':True,'streamSceneInteractive':True,'streamStored':True,'refreshGate':True,'secondRunGate':True,'closedEditorEntry':True}

    def migration(self,page,c):
        import gzip
        samples=[]
        for kind in ['workshop','desktop','release']:
            path=ROOT/f'game/src/systems/testdata/v14-stage8a-{kind}.json.gz'
            legacy=json.loads(gzip.decompress(path.read_bytes()))
            assert legacy['schemaVersion']==14
            converted=self.import_state(page,legacy,c)
            assert converted['schemaVersion']==CURRENT_SCHEMA_VERSION
            for resource in ['pixels','tokens','dollars']:assert converted['resources'][resource]>=legacy['resources'][resource],(kind,resource)
            for key in ['specs','productionNote','seedSkills','editorSkills']:
                assert converted['persistent'][key]==legacy['persistent'][key],(kind,key)
            for key in ['setDocuments','screenshots','products']:
                old=legacy['persistent'][key];new=converted['persistent'][key]
                assert len(new)>=len(old),(kind,key)
                if key in ['screenshots','products']:assert all(item in new for item in old),(kind,key)
            assert set(legacy['run']['desktop']['apps'])<=set(converted['run']['desktop']['apps'])
            self.navigate(page,None,c)
            saved=self.state(page);assert saved['schemaVersion']==CURRENT_SCHEMA_VERSION
            assert saved['persistent']['screenshots']==converted['persistent']['screenshots']
            self.capture(page,c,'形式14の実データを移行した画面: '+kind,'migration-'+kind)
            samples.append({'source':path.name,'format':saved['schemaVersion'],'noLoss':True})
        c['migration']=samples

    def release_cycle(self,page,c):
        self.navigate(page,f'stage7-ready{c["era"]}',c);self.notices(page)
        before=self.state(page)
        assert before['run']['version']=='v1'
        page.locator('.desktop-live .taskbar-progress:visible').click()
        checks=page.locator('.desktop-live .desktop-conditions input[type=checkbox]')
        assert checks.count()==5 and all(checks.nth(i).is_checked() for i in range(5))
        page.locator('.desktop-live .desktop-release-action').click()
        modal=page.locator('.release-confirmation');expect(modal).to_be_visible()
        self.capture(page,c,'新しい制作内容で5条件を満たしたリリースの確認','release-confirm')
        modal.locator('footer button').first.click();page.clock.run_for(3100)
        store=page.locator('[data-store-generation]');expect(store).to_be_visible()
        record=self.state(page)['persistent']['products'][-1]
        assert record['version']=='v1.0'
        self.capture(page,c,'部品とアプリとセットで売上を計算した製品ページ','release-store')
        page.locator('[data-store-action=sales]').click();page.clock.run_for(8100)
        report=page.locator('[data-report-info=revenue]');expect(report).to_be_visible()
        assert int(report.get_attribute('data-total'))==record['revenue']
        self.capture(page,c,'製品の売上とスペック購入の報告','release-shipping')
        refresh=page.locator('[data-spec=refresh] button')
        if self.state(page)['persistent']['specs']['refresh']==0:refresh.click()
        page.locator('[data-report-info=next-version]>button').click();page.clock.run_for(1100)
        after=self.state(page)
        assert after['run']['version']=='v2' and after['run']['world']=='seed'
        assert after['run']['workshop']['purchasedSets']==[] and after['run']['workshop']['parts']=={}
        assert after['persistent']['specs']['refresh']>=1
        assert 'v1-released' in after['persistent']['progress']['records']
        assert len(after['persistent']['setDocuments'])>=len(before['persistent']['setDocuments'])
        assert all(doc['version']!='v2' for doc in after['persistent']['setDocuments'])
        self.capture(page,c,'60Hzを購入してv2の素の画面を開始','release-v2-start')
        c['release']={'revenue':record['revenue'],'fiveConditions':True,'normalUiCycle':True,'newVersion':'v2','mandatorySetsReset':True,'archivePreserved':True}

    def customize_desktop(self,page,c):
        self.notices(page)
        self.launch(page,'tessera');self.maximize(page,'tessera')
        original=page.locator('.desktop-live>.desktop-window[data-app=files]>.window-title').evaluate('node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,image:getComputedStyle(node).backgroundImage})')
        w=page.locator('.desktop-live [data-workshop=true]')
        w.locator('[data-workshop-set-selection]').select_option('common')
        w.locator('[data-workshop-part=common-frame]').click()
        overlap=w.locator('.ws-palette-col button').evaluate_all('''nodes=>{
          const boxes=nodes.map(n=>({label:n.getAttribute('aria-label'),r:n.getBoundingClientRect()})),bad=[];
          for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
            const a=boxes[i].r,b=boxes[j].r;
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.25&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.25)bad.push([boxes[i].label,boxes[j].label]);
          }return bad.slice(0,5);
        }''')
        assert not overlap,('Palette cells must not overlap',overlap)
        w.locator('.ws-palette-col [aria-label$="#000000"]').click()
        state=self.state(page);design=state['run']['workshop']['parts']['common-frame']['design']
        assert design['color']=='#000000' and not design['nativeColors']
        unchanged=page.locator('.desktop-live>.desktop-window[data-app=files]>.window-title').evaluate('node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,image:getComputedStyle(node).backgroundImage})')
        assert unchanged==original,'Editing materials must leave the installed app unchanged until rebuilt'
        files=self.launch(page,'files');files.locator(':scope>.window-title .app-rebuild').click()
        builder=page.locator('.desktop-live [data-building=files]');builder.locator('[data-assembly-action=refresh]').click();builder.locator('[data-assembly-action=recommend]').click();builder.locator('[data-assembly-action=install]').click()
        files=self.maximize(page,'files')
        title=files.locator(':scope>.window-title')
        color=title.evaluate('node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,image:getComputedStyle(node).backgroundImage})')
        def rgb(value):return 'rgb('+', '.join(str(int(value[i:i+2],16)) for i in [1,3,5])+')'
        assert color['background']==rgb(design['color']) and color['color']==rgb(design['textColor']),color
        controls=title.locator('.window-controls>button').evaluate_all('nodes=>nodes.map(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor}))')
        def luminance(css):
            import re
            channels=[float(v)/255 for v in re.findall(r'[\d.]+',css)[:3]]
            assert len(channels)==3,css
            channels=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels]
            return sum(v*weight for v,weight in zip(channels,[.2126,.7152,.0722]))
        for control in controls:
            foreground=luminance(control['color']);background=luminance(control['background'])
            assert (max(foreground,background)+.05)/(min(foreground,background)+.05)>=3,(c['era'],control)
        self.capture(page,c,'世界3の工房で窓枠を調整し、入れ直したアプリへ反映','customized-desktop-app')
        self.launch(page,'tessera');w.locator('[data-workshop-set-selection]').select_option('foundation');w.locator('[data-workshop-part=foundation-taskbar]').click()
        for background in ['#ffffff','#000000']:
            w.locator(f'.ws-palette-col [aria-label$="{background}"]').click()
            source=self.state(page)['run']['workshop']['parts']['foundation-taskbar']['design']
            resource=page.locator('.desktop-live .taskbar-pixels:visible').first
            assert resource.evaluate('node=>getComputedStyle(node).color')==rgb(source['textColor'])
            assert resource.locator('small').evaluate('node=>getComputedStyle(node).color')==rgb(source['textColor'])
            assert page.locator('.desktop-live .taskbar-tokens:visible').first.evaluate('node=>getComputedStyle(node).color')==rgb(source['textColor'])
            self.capture(page,c,'世界3で制作した帯の色を変更','customized-desktop-shell-'+('light' if background=='#ffffff' else 'dark'))
        c['customization']={'sourceChangesFrozenUntilInstall':True,'newSourceInstalled':True,'readableWindowSymbols':True,'shellForegroundApplied':True}

    def photo_album(self,page,c):
        self.notices(page);photo=self.maximize(page,'photo')
        expected={}
        for role in ['brightness','tone','crop']:
            part=photo.locator(f'[data-app-part="{role}"]')
            control=part.locator('input[type=range]');control.focus();control.press('ArrowRight')
            expected[role]={'value':control.input_value(),'output':part.locator('output').inner_text()}
        self.geometry(page,photo)
        self.capture(page,c,'撮影直前の3つの調整値','photo-live-values')
        shot,_=self.take_photo(page)
        captured_specs=json.loads(shot['data'])['display']['specs']
        assert captured_specs['color']==1
        files=self.launch(page,'files');self.maximize(page,'files')
        files.locator('[data-files-folder=screenshots]').click();files.locator(f'[data-file="shot:{shot["id"]}"]').dblclick()
        preview=files.locator(f'[data-preview-shot="{shot["id"]}"]');preview.scroll_into_view_if_needed()
        photograph=preview.locator('[data-recorded-app=photo] [data-recorded-role=image]>.photo-surface')
        expect(photograph).to_have_attribute('data-color-steps','6')
        expect(photograph).to_have_attribute('data-photo-resolution',str(captured_specs['resolution']))
        for role,values in expected.items():
            part=preview.locator(f'[data-recorded-app=photo] [data-recorded-role="{role}"]')
            expect(part.locator('output')).to_have_text(values['output'])
            assert part.locator('input[type=range]').input_value()==values['value']
            assert part.locator('input[type=range]').evaluate('node=>node.readOnly')
            bounds=part.evaluate('node=>{const p=node.getBoundingClientRect(),o=node.querySelector("output").getBoundingClientRect();return {top:o.top-p.top,bottom:p.bottom-o.bottom,left:o.left-p.left,right:p.right-o.right}}')
            assert all(value>=-2 for value in bounds.values()),(role,bounds)
        self.capture(page,c,'アルバムにも保存された明るさ・色味・切り抜きの値','photo-album-values')
        self.launch(page,'photo');photo.locator('[data-app-part=brightness] input').focus();photo.locator('[data-app-part=brightness] input').press('ArrowRight')
        panel=page.locator('.debug-panel');panel.evaluate('node=>node.style.display="block"');panel.locator('select').nth(1).select_option('2');panel.evaluate('node=>node.style.display="none"')
        expect(photo.locator('[data-app-part=image] .photo-surface')).to_have_attribute('data-color-steps','full')
        self.launch(page,'files')
        for role,values in expected.items():expect(preview.locator(f'[data-recorded-role="{role}"] output')).to_have_text(values['output'])
        expect(photograph).to_have_attribute('data-color-steps','6')
        expect(photograph).to_have_attribute('data-photo-resolution',str(captured_specs['resolution']))
        current=self.state(page)
        assert next(item for item in current['persistent']['screenshots'] if item['id']==shot['id'])['data']==shot['data']
        self.capture(page,c,'実画面の色深度と値を変えても撮影時の姿で再生','photo-album-frozen-specs')
        c['photoAlbum']={'values':expected,'threeRangesAndReadouts':True,'frozenAfterLiveEdit':True,'capturedSpecs':captured_specs,'frozenColorSteps':6,'liveColorSteps':'full','resolutionUsesCapturedSpecs':True,'captureDataFrozen':True}


def main():
    a=argparse.ArgumentParser()
    a.add_argument('--base-url',default='http://127.0.0.1:4173')
    a.add_argument('--output-dir',default='game/artifacts/stage8b')
    a.add_argument('--step',action='append',choices=['8b1','8b2','8b3','8b-migration','8b-release','8b-custom','8b-photo'])
    a.add_argument('--language',action='append',choices=LANGUAGES)
    a.add_argument('--width',action='append',type=int,choices=SIZES)
    a.add_argument('--era',action='append',type=int,choices=[0,1,2,3])
    a.add_argument('--resume',action='store_true');a.add_argument('--recheck',action='store_true');a.add_argument('--keep-going',action='store_true')
    args=a.parse_args()
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        review=Review(args,b)
        for step in args.step or ['8b1','8b2','8b3']:
            for era in args.era or [0,1,2,3]:
                for language in args.language or LANGUAGES:
                    for width in args.width or SIZES:review.run(step,language,width,era)
        b.close()
    assert review.report['failed']==0 and not review.report['pageErrors'] and not review.report['externalRequests'] and not review.report['console']
    with zipfile.ZipFile(review.out/'stage8b-screens.zip','w',zipfile.ZIP_DEFLATED) as z:
        for name in ['index.html','8b1.html','8b2.html','8b3.html','summary.json']+[i['file'] for c in review.report['cases'] for i in c['images']]:z.write(review.out/name,name)
    print(json.dumps({k:review.report[k] for k in ['passed','failed','pageErrors','externalRequests','console']},ensure_ascii=False))

if __name__=='__main__':main()
