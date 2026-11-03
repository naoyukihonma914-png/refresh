"""TP page controls: real preset/text changes, without injecting game state.

Build and serve the single HTML at /play/, then run e.g.:
  python tools/check_testplay_controls.py
  python tools/check_testplay_controls.py --part generator --era 0 --era 1 --era 2

The default covers six page parts, three dimension presets, three text stages,
three languages, and two viewport sizes at editor era 0 (324 combinations).
A disabled preset is a valid rejection of an unsafe size; its saved geometry must
remain unchanged. Only the selected part may move/resize after an accepted preset.
Reports/screenshots are outside Git under game/artifacts/testplay-controls.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from check_testplay import TestplayChecks
from check_stage8b import ROOT,LANGUAGES,SIZES,CURRENT_SCHEMA_VERSION

PARTS=['heading','notice','pixels','generator','cursors','upgrades']
PRESETS=['small','large','extraLarge']
FONTS=['small','normal','large']


CLIPPED_RECT_SCRIPT = """n=>{
                  const r=n.getBoundingClientRect();let clipped={left:r.left,top:r.top,right:r.right,bottom:r.bottom};
                  for(let p=n.parentElement;p;p=p.parentElement){
                    const style=getComputedStyle(p),b=p.getBoundingClientRect(),scale=p.offsetWidth?b.width/p.offsetWidth:1;
                    if(['hidden','clip','auto','scroll'].includes(style.overflowX)){
                      const hidden=['hidden','clip'].includes(style.overflowX);
                      const left=hidden?b.left+parseFloat(style.borderLeftWidth)*scale:b.left+p.clientLeft*scale;
                      const right=hidden?b.right-parseFloat(style.borderRightWidth)*scale:b.left+(p.clientLeft+p.clientWidth)*scale;
                      clipped.left=Math.max(clipped.left,left);clipped.right=Math.min(clipped.right,right);
                    }
                    if(['hidden','clip','auto','scroll'].includes(style.overflowY)){
                      // Hidden boxes have no scrollbar: preserve fractional padding-box edges rather than rounded clientHeight.
                      const hidden=['hidden','clip'].includes(style.overflowY);
                      const top=hidden?b.top+parseFloat(style.borderTopWidth)*scale:b.top+p.clientTop*scale;
                      const bottom=hidden?b.bottom-parseFloat(style.borderBottomWidth)*scale:b.top+(p.clientTop+p.clientHeight)*scale;
                      clipped.top=Math.max(clipped.top,top);clipped.bottom=Math.min(clipped.bottom,bottom);
                    }
                  }
                  clipped.left=Math.max(clipped.left,0);clipped.top=Math.max(clipped.top,0);clipped.right=Math.min(clipped.right,innerWidth);clipped.bottom=Math.min(clipped.bottom,innerHeight);
                  return {width:r.width,height:r.height,text:n.textContent,visible:clipped.right>clipped.left&&clipped.bottom>clipped.top?[Math.max(0,(clipped.left-r.left)/r.width),Math.max(0,(clipped.top-r.top)/r.height),Math.min(1,(clipped.right-r.left)/r.width),Math.min(1,(clipped.bottom-r.top)/r.height)]:null};
                }"""


def local_overflows(scope):
    return scope.evaluate('''scope=>[...scope.querySelectorAll('button,th,td,label,h1,h2,h3,p,output,small,span')].flatMap(n=>{
      const s=getComputedStyle(n),r=n.getBoundingClientRect();
      if(n.closest('[inert]')||n.closest('[data-generator-measure]')||s.display==='none'||s.visibility==='hidden'||r.width<=0||r.height<=0||n.clientWidth<=0||n.clientHeight<=0)return [];
      // Compact inline glyphs may extend their line box while remaining inside the outer label.
      if(n.closest('[data-seed-generate-label]')&&!n.hasAttribute('data-seed-generate-label'))return [];
      if(s.textOverflow==='ellipsis'&&n.title)return [];
      const x=n.scrollWidth>n.clientWidth+2&&!['auto','scroll'].includes(s.overflowX);
      const y=n.scrollHeight>n.clientHeight+2&&!['auto','scroll'].includes(s.overflowY);
      return x||y?[{tag:n.tagName,cls:n.className,text:n.textContent,client:[n.clientWidth,n.clientHeight],scroll:[n.scrollWidth,n.scrollHeight],font:s.fontSize,x,y}]:[];
    })''')


class ControlChecks(TestplayChecks):
    def persist(self):
        cases=self.report['cases']
        self.report.update(passed=sum(c['status']=='passed' for c in cases),failed=sum(c['status']=='failed' for c in cases),pageErrors=[v for c in cases for v in c['pageErrors']],externalRequests=[v for c in cases for v in c['externalRequests']],console=[{'case':c['id'],**v} for c in cases for v in c['console']])
        (self.out/'summary.json').write_text(json.dumps(self.report,ensure_ascii=False,indent=2)+'\n')
        start='<!doctype html><meta charset="utf-8"><title>TP 個別部品の寸法と文字</title><style>body{font:14px/1.5 sans-serif;background:#eee;color:#222;margin:20px}h1{font-size:22px}h2{font-size:15px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}section{padding:6px;background:#fff;border:1px solid #aaa}img{width:100%;display:block}pre{white-space:pre-wrap;color:#900}</style><h1>TP 個別部品の寸法と文字</h1>'
        sections=[]
        for c in cases:
            images=''.join('<a href="'+html.escape(i['file'])+'"><img loading="lazy" src="'+html.escape(i['file'])+'"></a>' for i in c['images'])
            sections.append('<section><h2>'+html.escape(c['id'])+' — '+c['status']+'</h2>'+('<pre>'+html.escape(c['error'])+'</pre>' if c.get('error') else '')+images+'</section>')
        (self.out/'index.html').write_text(start+'<main>'+''.join(sections)+'</main>')

    def resource_reachability(self,page,root,c):
        rail=root.locator('[data-seed-resources]')
        targets={
            'pixels':'.seed-resource-values>[data-seed-pixels]',
            'rate':'.seed-resource-values>[data-seed-rate]',
            'name':'.seed-resource-name>b',
            'document':'.seed-resource-name>small',
            'settings':':scope>[data-page-action=settings]',
        }
        for selector in targets.values():expect(rail.locator(selector)).to_have_count(1)
        def wait_scroll():
            page.wait_for_timeout(75);page.clock.run_for(60)
        def move_to(x,y):
            rail.hover()
            for _ in range(4):
                current=rail.evaluate('n=>({x:n.scrollLeft,y:n.scrollTop})')
                if abs(current['x']-x)<=1 and abs(current['y']-y)<=1:return
                page.mouse.wheel(x-current['x'],y-current['y']);wait_scroll()
            current=rail.evaluate('n=>({x:n.scrollLeft,y:n.scrollTop})')
            assert abs(current['x']-x)<=2 and abs(current['y']-y)<=2,('Resource scroller did not respond to native wheel',x,y,current)
        metrics=rail.evaluate('n=>({width:n.clientWidth,height:n.clientHeight,maxX:n.scrollWidth-n.clientWidth,maxY:n.scrollHeight-n.clientHeight})')
        def positions(limit,viewport):
            step=max(16,int(viewport*.8));return list(dict.fromkeys([*range(0,int(limit)+1,step),limit]))
        coverage={key:[] for key in targets};samples=[]
        def snapshot():
            values={}
            for key,selector in targets.items():
                value=rail.locator(selector).evaluate(CLIPPED_RECT_SCRIPT)
                assert value['width']>1 and value['height']>1,('Resource must not collapse',key,value)
                if value['visible']:coverage[key].append(value['visible'])
                values[key]=value
            samples.append({'scroll':rail.evaluate('n=>({x:n.scrollLeft,y:n.scrollTop})'),'targets':values})
        for y in positions(metrics['maxY'],metrics['height']):
            for x in positions(metrics['maxX'],metrics['width']):move_to(x,y);snapshot()
        def visible_area(rectangles):
            xs=sorted({0,1,*[v for rect in rectangles for v in [rect[0],rect[2]]]})
            area=0
            for left,right in zip(xs,xs[1:]):
                if right-left<1e-6:continue
                spans=sorted((rect[1],rect[3]) for rect in rectangles if rect[0]<=left+1e-6 and rect[2]>=right-1e-6)
                end=0;height=0
                for top,bottom in spans:
                    if bottom>end:height+=bottom-max(top,end);end=bottom
                area+=(right-left)*height
            return area
        areas={key:visible_area(rectangles) for key,rectangles in coverage.items()}
        assert all(area>=.98 for area in areas.values()),('A resource remains clipped after native scrolling',areas,samples)
        settings=rail.locator(':scope>[data-page-action=settings]')
        position=settings.evaluate("n=>{const p=n.closest('[data-seed-resources]'),r=n.getBoundingClientRect(),v=p.getBoundingClientRect(),scale=v.width/p.offsetWidth;return {left:(r.left-v.left)/scale+p.scrollLeft,width:r.width/scale}}")
        target=max(0,min(metrics['maxX'],position['left']+(position['width']-metrics['width'])/2))
        move_to(target,0)
        self.capture(page,c,'資源の小さい枠も内部スクロールで設定へ届く','resource-scroll')
        settings.click()
        expect(root.locator('.page-settings')).to_be_visible()
        root.locator('.page-settings>.text-button').first.click()
        expect(root.locator('[data-seed-resources]')).to_be_visible()
        c['resourceReachability']={'method':'native horizontal/vertical wheel and real settings click','metrics':metrics,'targetVisibleAreaFractions':areas,'sampleCount':len(samples),'counterWidth':samples[0]['targets']['pixels']['width'],'settingsOpenedAndReturned':True}

    def notice_reachability(self,page,root,c):
        rail=root.locator('.seed-notice-stack')
        targets={'title':'[data-example-next]>h2','explanation':'[data-example-next]>p'}
        for selector in targets.values():expect(rail.locator(selector)).to_have_count(1)
        metrics=rail.evaluate('n=>({height:n.clientHeight,maxY:n.scrollHeight-n.clientHeight})')
        intervals={key:[] for key in targets};samples=[]
        step=max(16,int(metrics['height']*.6))
        positions=list(dict.fromkeys([*range(0,int(metrics['maxY'])+1,step),metrics['maxY']]))
        for y in positions:
            rail.hover()
            for _ in range(4):
                current=rail.evaluate('n=>n.scrollTop')
                if abs(current-y)<=1:break
                page.mouse.wheel(0,y-current);page.wait_for_timeout(75);page.clock.run_for(60)
            current=rail.evaluate('n=>n.scrollTop')
            assert abs(current-y)<=2,('Notice scroller did not respond to native wheel',y,current)
            current_sample={}
            for key,selector in targets.items():
                value=rail.locator(selector).evaluate(CLIPPED_RECT_SCRIPT)
                assert value['width']>1 and value['height']>1,('Next hand text must not collapse',key,value)
                if value['visible']:intervals[key].append((value['visible'][1],value['visible'][3]))
                current_sample[key]=value
            samples.append({'scrollTop':current,'targets':current_sample})
        def coverage(spans):
            total=end=0
            for top,bottom in sorted(spans):
                if bottom>end:total+=bottom-max(top,end);end=bottom
            return total
        areas={key:coverage(spans) for key,spans in intervals.items()}
        assert all(area>=.98 for area in areas.values()),('Next hand text remains clipped after native scrolling',areas,samples)
        self.capture(page,c,'お知らせ内のお手本も最後までスクロールできる','notice-scroll')
        rail.hover();page.mouse.wheel(0,-100000);page.wait_for_timeout(75);page.clock.run_for(60)
        c['noticeReachability']={'method':'native vertical wheel','metrics':metrics,'targetVisibleHeightFractions':areas,'sampleCount':len(samples)}

    def run_control(self,language,width,era,part,preset,font):
        identity=f'control-era{era}-{language}-{width}-{part}-{preset}-{font}'
        prior=next((c for c in self.report['cases'] if c['id']==identity),None)
        if self.args.resume and not self.args.recheck and prior and prior['status']=='passed':return
        c={'id':identity,'step':'controls','language':language,'width':width,'era':era,'part':part,'preset':preset,'font':font,'status':'running','images':[],'pageErrors':[],'externalRequests':[],'console':[]}
        self.report['cases']=[x for x in self.report['cases'] if x['id']!=identity]+[c]
        context=page=None
        try:
            context,page=self.open(f'tp1-stable-era{era}',c)
            root=self.seed(page);expect(root).to_be_visible()
            initial=self.state(page)
            assert initial['schemaVersion']==CURRENT_SCHEMA_VERSION,initial['schemaVersion']
            assert initial['persistent']['examplesEnabled'] is True,'The current default must keep examples enabled'
            expect(root.locator('[data-example-next]')).to_have_count(1)
            c['schemaVersion']=initial['schemaVersion'];c['examplesEnabled']=initial['persistent']['examplesEnabled']
            root.locator('[data-page-action=arrange]').click()
            root.locator('[data-page-selected-part]').select_option(part)
            controls=root.locator(f'[data-page-part-setting={part}]')
            before=self.parts(root)
            button=controls.locator(f'[data-page-size={preset}]');accepted=button.is_enabled()
            if accepted:button.click()
            after_size=self.parts(root)
            for sibling in PARTS:
                if sibling!=part or not accepted:self.same_box(before[sibling],after_size[sibling],'Only the selected part may change: '+sibling)
            controls.locator('[data-page-font-size]').select_option(font)
            after_font=self.parts(root)
            for sibling in PARTS:self.same_box(after_size[sibling],after_font[sibling],'Changing type does not move geometry: '+sibling)
            root.locator('[data-page-action=finish]').first.click();page.clock.run_for(100)
            selected=root.locator(f'[data-page-part={part}]')
            self.geometry(page,selected)
            overflows=local_overflows(selected)
            assert not overflows,overflows
            if part=='notice':self.notice_reachability(page,root,c)
            if part=='pixels':
                self.resource_reachability(page,root,c)
                returned=self.parts(root)
                for sibling in PARTS:self.same_box(after_font[sibling],returned[sibling],'Resource scrolling/settings preserves every part: '+sibling)
            if part=='generator':
                generator=selected.locator('[data-part=primary]');label=generator.locator('[data-seed-generate-label]')
                if not label.count():label=generator.locator('.seed-generate-label')
                expect(generator).to_be_enabled();assert generator.get_attribute('aria-label'), 'Generator must retain its complete accessible label'
                measurement=label.evaluate('n=>({visibleText:n.querySelector(".seed-generate-label-content")?.textContent??n.textContent,mode:n.dataset.seedGenerateLabel??null,client:[n.clientWidth,n.clientHeight],scroll:[n.scrollWidth,n.scrollHeight]})')
                assert measurement['scroll'][0]<=measurement['client'][0]+2 and measurement['scroll'][1]<=measurement['client'][1]+2,measurement
                self.same_box(after_font[part],self.box(generator),'Generator hit box follows the selected part')
                generator.click()
                # Keep the operation check but photograph the settled label, after the 800ms gain feedback.
                page.clock.run_for(1000)
                c['generatorLabel']=measurement
                c['generatorCapture']='settled after real click and 1000ms of game time'
            assert not c['pageErrors'],c['pageErrors'];assert not c['externalRequests'],c['externalRequests'];assert not c['console'],c['console']
            self.capture(page,c,'個別の大きさと文字を変えた画面','controls')
            c.update(status='passed',accepted=accepted,before=before,afterSize=after_size,afterFont=after_font)
            print('PASS',identity,'accepted='+str(accepted),flush=True)
        except Exception as error:
            c.update(status='failed',error=str(error))
            if page:self.capture(page,c,'確認中の問題','failure')
            print('FAIL',identity,str(error),flush=True)
            if not self.args.keep_going:raise
        finally:
            if context:context.close()
            self.persist()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='http://127.0.0.1:4173');parser.add_argument('--output-dir',default='game/artifacts/testplay-controls')
    parser.add_argument('--language',action='append',choices=LANGUAGES);parser.add_argument('--width',action='append',type=int,choices=SIZES)
    parser.add_argument('--era',action='append',type=int,choices=[0,1,2]);parser.add_argument('--part',action='append',choices=PARTS)
    parser.add_argument('--preset',action='append',choices=PRESETS);parser.add_argument('--font',action='append',choices=FONTS)
    parser.add_argument('--resume',action='store_true');parser.add_argument('--recheck',action='store_true');parser.add_argument('--keep-going',action='store_true')
    args=parser.parse_args()
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        review=ControlChecks(args,browser)
        build=ROOT/'game/dist/index.html'
        review.report['buildSha256']=hashlib.sha256(build.read_bytes()).hexdigest() if build.exists() else None
        for era in args.era or [0]:
            for language in args.language or LANGUAGES:
                for width in args.width or SIZES:
                    for part in args.part or PARTS:
                        for preset in args.preset or PRESETS:
                            for font in args.font or FONTS:review.run_control(language,width,era,part,preset,font)
        browser.close()
        print(json.dumps({key:review.report[key] for key in ['passed','failed']},ensure_ascii=False),flush=True)
        raise SystemExit(1 if review.report['failed'] else 0)


if __name__=='__main__':main()
