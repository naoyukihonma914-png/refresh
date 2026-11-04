"""Group puzzle acceptance: public fixtures and real pointer/file-chooser controls.

Build and serve game/dist, then run this against that server. No reducer calls or
state injection: debug is used only for language and read-only save downloads.
"""
import argparse
from playwright.sync_api import expect, sync_playwright
from check_world2_fitting import FittingReview, ROOT, preflight
from check_world2_panel import PanelReview

TOOLS = {'files': ('frame', 'heading', 'list', 'toolbar', 'display'),
         'mail': ('frame', 'list', 'body', 'folders'),
         'foundation': ('ground', 'taskbar', 'icons', 'wallpaper', 'notice'),
         'photo': ('frame', 'surface', 'adjust', 'finish'),
         'bin': ('frame', 'list', 'actions'), 'clock': ('frame', 'time', 'functions'),
         'theme': ('frame', 'colors', 'shape'),
         'terminal': ('frame', 'surface', 'commands', 'execution'),
         'manager': ('frame', 'processes', 'performance'),
         'tabs': ('tab', 'page'), 'table': ('time', 'pixels')}

class GroupReview(PanelReview):
    @staticmethod
    def canvas(page):
        return page.locator('[data-group-workbench]')

    def save(self):
        FittingReview.save(self)
        path = self.out / 'index.html'
        path.write_text(path.read_text().replace('世界2 はめる制作の確認', '世界2 グループパズルの確認').replace('世界2：実操作・保存・段アップ','世界2：グループパズル・完成・保存'))

    @staticmethod
    def loose(page, tool, piece):
        return page.locator(f'[data-group-loose][data-group-owner="{tool}"][data-group-piece="{piece}"]')

    def gesture(self, page, tool, piece, at=None, fitted=False, release=True):
        source = (page.locator(f'[data-group-socket-owner="{tool}"][data-group-socket="{piece}"] [data-group-grip]')
                  if fitted else self.loose(page, tool, piece))
        if fitted:
            source.locator('..').hover()
        a = self.box(source)
        # Frame headers are above every interactive native control.
        ox, oy = (a['width']*.35, min(a['height']*.4, 8)) if piece in ('frame', 'ground', 'tab', 'time') else (a['width']*.4, a['height']*.5)
        page.mouse.move(a['x']+ox, a['y']+oy)
        page.mouse.down()
        page.mouse.move(a['x']+ox+5, a['y']+oy, steps=2)
        if at is None:
            socket = page.locator(f'[data-group-socket-owner="{tool}"][data-group-socket="{piece}"]')
            b = self.box(socket)
            x, y = b['x']+b['width']/2, b['y']+b['height']/2
        else:
            board = page.locator('[data-group-board]')
            b = self.box(board)
            scale = board.evaluate('n=>n.getBoundingClientRect().width/n.offsetWidth')
            x, y = b['x']+at[0]*scale+ox, b['y']+at[1]*scale+oy
        page.mouse.move(x, y, steps=12)
        ghost = page.locator(f'[data-group-drag="{piece}"][data-group-drag-owner="{tool}"]')
        expect(ghost).to_be_visible()
        if at is None:
            g = self.box(ghost)
            assert abs(g['width']-b['width']) < 1 and abs(g['height']-b['height']) < 1, (g,b)
        if release:
            page.mouse.up()
        return ghost

    def fit(self, page, tool, piece):
        self.gesture(page, tool, piece)
        if piece == TOOLS[tool][-1]:
            expect(page.locator(f'[data-group-icon="{tool}"]')).to_be_visible()
        else:
            expect(page.locator(f'[data-group-socket-owner="{tool}"][data-group-socket="{piece}"]')).to_have_attribute('data-group-installed','true')

    def place(self, page, tool, at=(32,32)):
        self.gesture(page, tool, TOOLS[tool][0], at=at)
        expect(page.locator(f'[data-group-frame="{tool}"]')).to_be_visible()

    def settled(self, page):
        page.mouse.move(125,100)
        page.clock.run_for(1100)

    def text_fits(self,page):
        errors=self.canvas(page).locator('.gp-loose .wf-piece-content:not([hidden])').evaluate_all("""nodes=>nodes.flatMap(node=>{
          const box=node.getBoundingClientRect(),walker=node.ownerDocument.createTreeWalker(node,NodeFilter.SHOW_TEXT),errors=[];
          for(let t=walker.nextNode();t;t=walker.nextNode()){
            if(!t.textContent.trim()||t.parentElement.closest('svg,option,[hidden]'))continue;
            const range=node.ownerDocument.createRange();range.selectNode(t);const r=range.getBoundingClientRect();
            if(!r.width||!r.height)continue;
            const vertical=!t.parentElement.closest('.wf-list,article,pre');
            if(r.left<box.left-1||r.right>box.right+1||(vertical&&(r.top<box.top-1||r.bottom>box.bottom+1)))errors.push({piece:node.dataset.workshopControlPiece,text:t.textContent,font:getComputedStyle(node).fontSize});
          }return errors;})""")
        assert not errors,errors

    def core(self, page, case):
        panel = self.panel(page)
        assert panel.locator('[data-group-category]').count() == 3
        assert panel.locator('[data-group-zone]').evaluate_all('ns=>ns.map(n=>n.dataset.groupZone)') == ['groups','tools','pieces']
        page.locator('[data-group-buy="required"]').click()
        expect(page.locator('[data-group-loose]')).to_have_count(9)
        expect(page.locator('[data-group-frame]')).to_have_count(0)
        page.locator('[data-group-tool="mail"]').click()
        expect(page.locator('[data-group-loose]')).to_have_count(9)
        self.settled(page)
        self.text_fits(page)
        self.capture(page, case, '01-mixed-pieces', '必須グループ購入直後：2ツールの9ピース')
        self.capture(page, case, '04-panel', '分類・グループ・ツール・全未完成ピース')
        geometry = self.canvas(page).evaluate('''n=>{const r=n.getBoundingClientRect();return {scroll:[n.scrollWidth,n.clientWidth,n.scrollHeight,n.clientHeight],pieces:[...n.querySelectorAll('[data-group-loose]')].map(p=>{const b=p.getBoundingClientRect();return {tool:p.dataset.groupOwner,piece:p.dataset.groupPiece,inside:b.left>=r.left&&b.right<=r.right+1&&b.top>=r.top&&b.bottom<=r.bottom+1}})}}''')
        assert all(p['inside'] for p in geometry['pieces']), geometry
        assert geometry['scroll'][0] <= geometry['scroll'][1]+1 and geometry['scroll'][2] <= geometry['scroll'][3]+1, geometry
        self.place(page,'files',(32,32));self.place(page,'mail',(704,32))
        frame=page.locator('[data-group-frame="files"]')
        frame.locator('.gp-frame-art > header button').first.click()
        assert frame.evaluate('n=>n.offsetHeight') == 32
        frame.locator('.gp-restore').click()
        assert frame.evaluate('n=>n.offsetHeight') == 448
        self.fit(page,'files','heading')
        self.fit(page,'mail','list')
        self.gesture(page,'files','heading',at=(680,1000),fitted=True)
        self.fit(page,'files','heading')
        self.gesture(page,'mail','body',at=(100,920))
        self.settled(page)
        self.capture(page,case,'02-two-frames-placed','両方の枠・交互の嵌合・メール本文の仮置き')
        staged=self.state(page)['run']['workshop']['groupPuzzle']
        assert staged['tools']['mail']['positions']['body']['at'] != staged['tools']['mail']['positions']['body']['origin']
        assert staged['tools']['files']['locked'] and staged['tools']['mail']['locked']
        self.import_for_reload(page)
        page.reload();page.clock.run_for(100)
        page.locator('.debug-panel').evaluate('n=>n.style.display="none"')
        assert self.state(page)['run']['workshop']['groupPuzzle'] == staged
        self.fit(page,'files','list');self.fit(page,'mail','body')
        self.fit(page,'files','toolbar');self.fit(page,'mail','folders')
        self.settled(page)
        # Mail has completed first because it has only four pieces.
        first=self.state(page)
        assert first['resources']['tokens'] == (5 if case['era'] else 8), first['resources']
        self.capture(page,case,'03-tool-completed-icon','完成ツールが自動で棚へ収納されトークンを受領')
        self.fit(page,'files','display')
        if not self.args.reduced_motion:
            flight=page.locator('[data-group-completion="files"]')
            expect(flight).to_be_visible()
            flight.evaluate("n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=Number(a.effect.getTiming().duration);})")
            landed=self.box(flight);target=self.box(page.locator('[data-group-icon="files"] .gp-shelf-image'))
            assert all(abs(landed[k]-target[k])<2 for k in ('x','y','width','height')),(landed,target)
        self.settled(page)
        complete=self.state(page)
        assert complete['resources']['tokens'] == (11 if case['era'] else 14), complete['resources']
        assert complete['run']['workshop']['groupPuzzle']['shelf'] == ['mail','files']
        assert page.locator('.ws-export-button,[data-workshop-action="export"]').count() == 0
        page.locator('[data-group-icon="files"]').click()
        expect(page.locator('.gp-tool-dialog')).to_be_visible()
        search=page.locator('.gp-tool-dialog [data-workshop-control="query"]')
        search.fill('missing-tool-query')
        expect(search).to_have_value('missing-tool-query')
        search.fill('')
        page.locator('.gp-tool-dialog > header button').click()
        page.locator('[data-group-category="desktop"]').click()
        page.locator('[data-group-buy="foundation"]').click()
        self.place(page,'foundation')
        self.fit(page,'foundation','taskbar');self.fit(page,'foundation','icons')
        self.settled(page)
        self.capture(page,case,'05-desktop-group','デスクトップの地を土台にした組み立て')
        self.fit(page,'foundation','wallpaper');self.fit(page,'foundation','notice')
        self.settled(page)
        exit_button=page.locator('[data-group-exit]')
        expect(exit_button).to_be_enabled()
        done=self.state(page)
        assert done['schemaVersion']==19
        assert done['resources']['tokens']==(17 if case['era'] else 20),done['resources']
        if case['era']:
            exit_button.click()
            expect(page.locator('.desktop-live')).to_be_visible()
            assert self.state(page)['run']['world']=='desktop'
        case['checks']={'mixedPieces':9,'allInsideCanvas':geometry,'twoFramesAndAlternatingFits':True,
          'stagingAndRelativeFitsSurviveNormalImportReload':True,'sameSizeDragGhosts':True,
          'automaticSeparateShelfIcons':True,'tokensAfterThreeTools':done['resources']['tokens'],
          'realWorld3Exit':bool(case['era']),'schemaVersion':19}

    def catalog(self,page,case):
        inspected=[]
        page.locator('[data-group-tool="photo"]').click()
        page.locator('[data-group-customize="photo"]').click()
        custom=page.locator('[data-group-customization]')
        custom.locator('select').first.select_option('common-frame')
        custom.locator('select').filter(has=page.locator('option[value="square"]')).select_option('square')
        custom.locator('select').first.select_option('photo-brightness')
        custom.locator('[data-workshop-adjust="fontSize"]').fill('12')
        before=self.state(page)
        assert before['run']['workshop']['groupPuzzle']['tools']['photo']['designs']['photo-brightness']['fontSize']==12
        custom.locator('header button').click()
        expect(page.locator('[data-tool-frame="photo"]')).to_have_attribute('data-symbol-shape','square')
        assert page.locator('[data-tool-frame="photo"] > header button').first.evaluate('n=>getComputedStyle(n).borderTopStyle') == 'solid'
        page.locator('[data-group-tool-row="photo"]').hover()
        expect(page.locator('[data-group-hover="tool"]')).to_be_visible()
        page.mouse.move(125,100)
        for tool,pieces in TOOLS.items():
            if tool in ('files','mail'):continue
            group='extras' if tool in ('tabs','table') else tool
            page.locator('[data-group-category="desktop"' + ']' if group=='foundation' else '[data-group-category="optional"]').click()
            page.locator(f'[data-group-select="{group}"]').click()
            self.text_fits(page)
            self.place(page,tool)
            seats=page.locator(f'[data-group-socket-owner="{tool}"]:not([data-group-installed])')
            for color in seats.evaluate_all('ns=>ns.map(n=>getComputedStyle(n).backgroundColor)'):
                nums=[int(n) for n in __import__('re').findall(r'\d+',color)[:3]]
                assert max(nums)-min(nums)<24,color
            for piece in pieces[1:]:self.fit(page,tool,piece)
            self.settled(page);inspected.append(tool)
        final=self.state(page)
        assert len(final['run']['workshop']['groupPuzzle']['shelf'])==11
        assert final['run']['workshop']['groupPuzzle']['tools']['photo']['designs']['photo-brightness']['fontSize']==12
        case['checks']={'allElevenToolIcons':True,'grayEmptySockets':True,'completedAdditionalTools':inspected}

    def run_case(self,name,language):
        self.args.language=language
        era=1 if name=='era1' else 0
        fixture=f'group-catalog-era{era}' if name=='catalog' else f'group-entry-era{era}'
        case={'id':f'{language}:{name}','era':era,'language':language,'fixture':fixture,'status':'running',
              'images':[],'pageErrors':[],'console':[],'externalRequests':[],'noImages':name!='core'}
        self.report['cases'].append(case);context=page=None
        try:
            context,page=self.open(fixture,case)
            (self.catalog if name=='catalog' else self.core)(page,case)
            for key in ('pageErrors','console','externalRequests'):assert not case[key],case[key]
            case['status']='passed';print('PASS',case['id'],flush=True)
        except Exception as error:
            case.update(status='failed',error=str(error))
            if page and not self.args.no_screenshots:FittingReview.capture(self,page,case,'failure-'+name,'失敗時')
            print('FAIL',case['id'],str(error),flush=True)
            if not self.args.keep_going:raise
        finally:
            if context:context.close()
            self.save()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base-url',default='http://127.0.0.1:8188/')
    p.add_argument('--output-dir',default=str(ROOT/'docs/reviews/world2-group-puzzle'))
    p.add_argument('--language',action='append',choices=('ja','en','en-XA'),dest='languages')
    p.add_argument('--case',action='append',choices=('core','era1','catalog'),dest='cases')
    p.add_argument('--width',type=int,default=1920);p.add_argument('--height',type=int,default=1080)
    p.add_argument('--reduced-motion',action='store_true');p.add_argument('--no-screenshots',action='store_true')
    p.add_argument('--keep-going',action='store_true');p.add_argument('--chromium',default='/usr/bin/chromium')
    args=p.parse_args();args.languages=args.languages or ['ja','en'];args.language=args.languages[0]
    args.base_url=args.base_url.rstrip('/')+'/'
    preflight(args.base_url)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
        try:
            review=GroupReview(args,browser)
            review.report['references']=['docs/世界2-改修指示書-グループパズル.md']
            for language in args.languages:
                for name in args.cases or ('core','era1','catalog'):review.run_case(name,language)
            if review.report['failed']:raise SystemExit(1)
        finally:browser.close()
if __name__=='__main__':main()
