"""Examples/combo acceptance using real controls of the single HTML.

Build/serve at /play/, then run --step route --era 0 etc. Old TP3 galleries
remain immutable. Fixtures grant a debug budget, never a fake finished UI.
"""
import argparse,gzip,hashlib,html,json,re,shutil,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from check_testplay import TestplayChecks,catalog,MAIN_SETS
from check_stage8b import ROOT,LANGUAGES,SIZES,CURRENT_SCHEMA_VERSION
from check_examples_desktop import ExamplesDesktopMixin

STEPS=['settings','route','placement','adjustment','economy','migration','desktop','pending','reduced']

class ExampleChecks(ExamplesDesktopMixin,TestplayChecks):
 def persist(self):
  cases=self.report['cases'];self.report.update(passed=sum(c['status']=='passed' for c in cases),failed=sum(c['status']=='failed' for c in cases),pageErrors=[v for c in cases for v in c['pageErrors']],externalRequests=[v for c in cases for v in c['externalRequests']],console=[{'case':c['id'],**v} for c in cases for v in c['console']])
  (self.out/'summary.json').write_text(json.dumps(self.report,ensure_ascii=False,indent=2)+'\n')
  head='<!doctype html><meta charset="utf-8"><title>お手本の実操作確認</title><style>body{font:14px/1.5 sans-serif;background:#eee;color:#222;margin:20px}h1{font-size:22px}h2{font-size:16px}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:10px}a{display:block;background:#fff;color:#222;padding:6px;border:1px solid #aaa}img{display:block;width:100%}pre{white-space:pre-wrap;color:#900}</style><h1>お手本：実操作・旧セーブ・経済不変</h1>'
  for step in [None,*STEPS]:
   selected=cases if step is None else [c for c in cases if c['step']==step];sections=[]
   for c in selected:
    images=''.join('<a href="'+html.escape(i['file'])+'"><img loading="lazy" src="'+html.escape(i['file'])+'">'+html.escape(i['label'])+'</a>' for i in c['images'])
    sections.append('<section><h2>'+html.escape(c['id'])+' — '+c['status']+'</h2>'+('<pre>'+html.escape(c['error'])+'</pre>' if c.get('error') else '')+'<div>'+images+'</div></section>')
   (self.out/('index.html' if step is None else step+'.html')).write_text(head+''.join(sections))

 def open(self,fixture,c):
  actual=c['step']
  if actual=='reduced':c['step']='motion-scale'
  context,page=super().open(fixture,c);c['step']=actual
  return context,page

 def navigate(self,page,fixture,c):
  super().navigate(page,fixture,c)
  # Observe actual oscillator starts without changing sound output or game state.
  page.evaluate('''()=>{globalThis.__exampleAudio=[];if(!globalThis.__exampleAudioInstrumented&&globalThis.OscillatorNode){const params=new WeakMap(),create=BaseAudioContext.prototype.createOscillator,set=AudioParam.prototype.setValueAtTime,start=OscillatorNode.prototype.start;BaseAudioContext.prototype.createOscillator=function(...args){const node=create.apply(this,args);params.set(node.frequency,node);return node};AudioParam.prototype.setValueAtTime=function(value,...args){const node=params.get(this);if(node)node.__exampleFrequency=value;return set.call(this,value,...args)};OscillatorNode.prototype.start=function(...args){globalThis.__exampleAudio.push({frequency:this.__exampleFrequency??this.frequency.value,type:this.type});return start.apply(this,args)};globalThis.__exampleAudioInstrumented=true;}}''')

 def run(self,step,language,width,era):
  identity=f'{step}-era{era}-{language}-{width}';old=next((c for c in self.report['cases'] if c['id']==identity),None)
  if self.args.resume and not self.args.recheck and old and old['status']=='passed':return
  c={'id':identity,'step':step,'language':language,'width':width,'era':era,'status':'running','images':[],'pageErrors':[],'externalRequests':[],'console':[],'buildSha256':hashlib.sha256((ROOT/'game/dist/index.html').read_bytes()).hexdigest()}
  self.report['cases']=[x for x in self.report['cases'] if x['id']!=identity]+[c];context=page=None
  try:
   mode={'settings':'seed-layout-on','route':'route-on','placement':'place-on','adjustment':'adjust-custom','economy':'finish-on','migration':'seed-layout-on','desktop':'desktop','pending':'desktop-pending','reduced':'finish-on'}[step]
   context,page=self.open(f'examples-{mode}-era{era}',c)
   {'settings':self.settings,'route':self.guided_route,'placement':self.placement,'adjustment':self.adjustment,'economy':self.economy_examples,'migration':self.migration_examples,'desktop':self.desktop_examples,'pending':self.pending,'reduced':self.reduced}[step](page,c)
   assert not c['pageErrors'],c['pageErrors'];assert not c['console'],c['console'];assert not c['externalRequests'],c['externalRequests']
   c['status']='passed';print('PASS',identity,flush=True)
  except Exception as e:
   c.update(status='failed',error=str(e))
   if page:self.capture(page,c,'確認中の問題','failure')
   print('FAIL',identity,str(e),flush=True)
   if not self.args.keep_going:raise
  finally:
   if context:context.close()
   self.persist()

 def set_workshop_examples(self,page,w,enabled,c=None,label=None):
  w.locator('.ws-menu-actions>button').nth(1).click()
  toggle=w.locator('[data-examples-input]');expect(toggle).to_be_visible();toggle.set_checked(enabled)
  assert self.state(page)['persistent']['examplesEnabled']==enabled
  if c:self.capture(page,c,label or ('お手本ON' if enabled else 'お手本OFF'),'workshop-setting-'+str(enabled).lower())
  w.locator('.ws-page-scroll>button').first.click()

 def set_sound(self,page,w,enabled):
  w.locator('.ws-menu-actions>button').nth(1).click();w.locator('.ws-settings-tabs>button').nth(2).click()
  w.locator('.sound-settings input[type=checkbox]').set_checked(enabled);w.locator('.ws-page-scroll>button').first.click()
  page.evaluate('globalThis.__exampleAudio=[]')

 def settings(self,page,c):
  if c['era']==0:
   self.navigate(page,None,c);page.locator('.intro-note button').click();fresh=self.seed(page)
   assert self.state(page)['persistent']['examplesEnabled']
   expect(fresh.locator('[data-example-next]')).to_have_attribute('data-example-next','seed-generate')
   self.capture(page,c,'初回はお手本ONで、最初の次の手は生成','new-game-on')
   fresh.locator('[data-page-action=settings]').click();fresh.locator('[data-examples-input]').uncheck();fresh.locator('.page-settings>button').first.click();assert not fresh.locator('[data-example-next]').count()
   self.capture(page,c,'カラーを作る前からお手本を切り替えられる','new-game-off')
   self.navigate(page,f'examples-seed-layout-on-era{c["era"]}',c)
  root=self.seed(page);gen=root.locator('[data-part=primary]');before=self.box(gen);state=self.state(page)
  assert state['persistent']['examplesEnabled'];expect(root.locator('[data-example-next]')).to_have_count(1)
  point=(before['x']+before['width']/2,before['y']+before['height']/2)
  for _ in range(20):page.mouse.click(*point);page.clock.run_for(40)
  self.same_box(before,self.box(gen),'A constant next-hand does not move the generator')
  old_page=self.state(page)['run']['seed']['page'];guide=self.state(page)['run']['seed']['guide']
  self.capture(page,c,'常時の次の手と固定された生成ボタン','seed-on')
  root.locator('[data-page-action=settings]').click();root.locator('[data-examples-input]').uncheck();self.capture(page,c,'素の画面の設定でお手本を切る','seed-setting-off');root.locator('.page-settings>button').first.click()
  assert root.locator('[data-example-next]').count()==0
  off=self.state(page);assert not off['persistent']['examplesEnabled'];assert off['run']['seed']['page']==old_page and off['run']['seed']['guide']==guide
  self.same_box(before,self.box(gen),'Turning examples off leaves the generator fixed')
  self.capture(page,c,'OFFでも人物のコメントと自由な画面は残る','seed-off')
  root.locator('[data-seed-upgrade=layout]').click()
  assert not root.locator('[data-page-first-guide]').count() and not root.locator('[data-page-layout-mode=true]').count(),'OFF must not start first-placement guidance'
  off=self.state(page);old_page=off['run']['seed']['page']
  self.capture(page,c,'OFFで配置を作っても初回のお手本を始めない','seed-off-layout')
  imported=self.import_state(page,off,c);assert not imported['persistent']['examplesEnabled'];self.navigate(page,None,c);assert not self.state(page)['persistent']['examplesEnabled']
  root=self.seed(page);root.locator('[data-page-action=settings]').click();root.locator('[data-examples-input]').check();root.locator('.page-settings>button').first.click();expect(root.locator('[data-example-next]')).to_have_count(1)
  assert self.state(page)['run']['seed']['page']==old_page
  self.navigate(page,f'examples-replay-off-era{c["era"]}',c);assert not self.state(page)['persistent']['examplesEnabled'];assert self.seed(page).locator('[data-example-next]').count()==0
  self.capture(page,c,'出荷から次の版へOFF設定が残る','seed-off-next-version')
  c['settings']={'fixedTwentyClicks':True,'offDoesNotRemoveGuideOrPage':True,'offLayoutNoAutoGuide':True,'normalImportReload':True,'offSurvivesNextVersion':True}

 def hand(self,w,kind=None):
  hand=w.locator('section[data-workshop-next-hand]');expect(hand).to_have_count(1)
  if kind:expect(hand).to_have_attribute('data-workshop-next-hand',kind)
  return hand

 def rate(self,w):
  node=w.locator('[data-workshop-rate]');value=node.get_attribute('data-workshop-rate')
  if value!='true':return float(value)
  # Earlier candidate builds used a boolean measurement marker. The localized
  # W2 rates in this matrix are below compact-unit thresholds.
  match=re.search(r'[-+]?\d[\d,]*(?:\.\d+)?',node.inner_text());assert match,node.inner_text()
  return float(match[0].replace(',',''))

 def counter_rate(self,node):
  match=re.search(r'[-+]?\d[\d,]*(?:\.\d+)?',node.inner_text());assert match,node.inner_text()
  return float(match[0].replace(',',''))

 def finish_part(self,page,w,part,c=None):
  if part['id']=='common-progress':
   w.locator('[data-trial-action=fill]').click()
   expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4',timeout=5000)
  else:super().finish_part(page,w,part,c)

 def guided_route(self,page,c):
  w=page.locator('[data-workshop=true]');self.quiet(page);done=[];seen=[];stages={};loops=0
  definitions={p['id']:p for p in catalog() if p['set'] in MAIN_SETS}
  while len(done)<22:
   loops+=1;assert loops<250,'Guidance did not make progress'
   hand=self.hand(w);kind=hand.get_attribute('data-workshop-next-hand');seen.append(kind)
   state=self.state(page);part_id=state['run']['workshop']['activePart'];part=definitions.get(part_id)
   if kind in ['buySet','selectPart']:
    hand.locator('[data-workshop-example-action]').click();self.dismiss_help(page);self.quiet(page);continue
   assert part,(kind,part_id)
   if kind in ['place','useExample','finish']:
    self.geometry(page,w);self.capture(page,c,'お手本の工程 '+kind+': '+part_id,kind+'-'+part_id)
    stages.setdefault(part_id,[]).append(kind)
   if kind=='place':
    expect(w.locator(f'[data-workshop-example-outline="{part_id}"]')).to_be_visible()
    outline=self.box(w.locator(f'[data-workshop-example-outline="{part_id}"]'))
    hand.locator('[data-workshop-example-action=place]').click()
    if part_id=='common-frame':self.same_box(outline,self.box(w.locator('[data-workshop-snap=common-frame]')),'The frame example matches the real native outer frame')
   elif kind in ['addElement','addAll']:hand.locator('[data-workshop-example-action]').click()
   elif kind=='useExample':
    expect(w.locator('[data-workshop-customization]')).to_be_attached();hand.locator('[data-workshop-example-action=useExample]').click();expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','3')
   elif kind=='finish':
    before=self.state(page);rate_before=self.rate(w)
    self.finish_part(page,w,part,c);expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4')
    after=self.state(page);done.append(part_id);assert after['run']['workshop']['parts'][part_id]['tested']
    assert after['run']['workshop']['combo']['count']==len(done)
    combo=w.locator('[data-workshop-combo]');expect(combo).to_have_attribute('data-workshop-combo',str(len(done)))
    assert abs(float(combo.get_attribute('data-workshop-next-step-multiplier'))-(1+min(.10,len(done)*.02)))<1e-9
    feedback=w.locator(f'[data-workshop-completion="{part_id}"]');expect(feedback).to_be_visible();expect(feedback).to_have_attribute('data-workshop-completion-growing','true')
    assert self.rate(w)>rate_before
    expect(w.locator(f'[data-workshop-rate-flight="{part_id}"]')).to_be_visible();self.capture(page,c,'完成した部品の毎秒が合計へ飛ぶ: '+part_id,'completion-'+part_id)
    page.clock.run_for(2800);assert not w.locator('[data-workshop-rate-flight]').count();assert not w.locator('[data-workshop-completion]').count()
    assert self.state(page)['run']['workshop']['parts'][part_id]==after['run']['workshop']['parts'][part_id]
   elif kind=='export':hand.locator('[data-workshop-example-action=export]').click()
   else:raise AssertionError('Unexpected mainline next hand: '+kind)
  self.hand(w,'export').locator('[data-workshop-example-action=export]').click();self.hand(w,'exit')
  self.capture(page,c,'全パーツを標準で仕上げ、出口の次の手へ到達','route-exit')
  c['route']={'completed':done,'nextKinds':list(dict.fromkeys(seen)),'stages':stages,'nativeFinishes':22,'comboCap':1.1,'noRequiredDesignChoices':True,'frameOutlineMatchesNativeWindow':True,'exportedAndReachedExit':True}

 def drag_part(self,page,w,rect):
  state=self.state(page);frame=state['run']['workshop']['parts'].get('common-frame');origin=frame['rect'] if frame and frame['step']>0 else {'x':0,'y':0,'width':608,'height':416}
  canvas=w.locator('[data-workshop-canvas]');canvas.scroll_into_view_if_needed();b=self.box(canvas)
  point=lambda x,y:(b['x']+(x-origin['x'])/origin['width']*b['width'],b['y']+(y-origin['y'])/origin['height']*b['height'])
  start=point(rect['x'],rect['y']);end=point(rect['x']+rect['width'],rect['y']+rect['height'])
  page.mouse.move(*start);page.mouse.down();page.mouse.move(*end,steps=12);page.mouse.up()

 def placement(self,page,c):
  results=[]
  for mode,offset,sound in [('on',8,True),('on',32,True),('off',8,True),('on',8,False)]:
   self.navigate(page,f'examples-place-{mode}-era{c["era"]}',c);w=page.locator('[data-workshop=true]');self.quiet(page)
   self.set_sound(page,w,sound);state=self.state(page);target=state['run']['workshop']['parts']['common-button']['rect'];candidate={**target,'x':target['x']+offset,'y':target['y']+offset}
   assert bool(w.locator('[data-workshop-example-outline]').count())==(mode=='on')
   self.drag_part(page,w,candidate);after=self.state(page);actual=after['run']['workshop']['parts']['common-button']['rect'];snapped=mode=='on' and offset==8
   assert actual==(target if snapped else candidate),(mode,offset,target,candidate,actual)
   sounds=page.evaluate('globalThis.__exampleAudio')
   if sound:assert len(sounds)==1 and abs(sounds[0]['frequency']-(440 if snapped else 660))<5,sounds
   else:assert sounds==[],sounds
   snap=w.locator('[data-workshop-snap]');assert bool(snap.count())==snapped
   self.geometry(page,w);self.capture(page,c,'近くは吸着・遠くとOFFは自由: '+mode+'/'+str(offset)+'/sound'+str(sound),f'placement-{mode}-{offset}-sound{sound}')
   page.clock.run_for(650);assert not w.locator('[data-workshop-snap]').count()
   saved=self.state(page);self.import_state(page,saved,c);assert not page.locator('[data-workshop-snap]').count()
   results.append({'mode':mode,'offset':offset,'sound':sound,'snapped':snapped,'actual':actual,'oscillators':sounds})
  c['placement']=results

 def adjustment(self,page,c):
  w=page.locator('[data-workshop=true]');self.quiet(page);before=self.state(page);p=before['run']['workshop']['parts']['common-button']
  detail=w.locator('[data-workshop-customization]');expect(detail).to_be_attached();detail.locator('summary').click();self.capture(page,c,'途中でも自由な設定を開ける','custom-adjustment')
  self.set_workshop_examples(page,w,False,c);off=self.state(page);assert off['run']['workshop']['parts']['common-button']==p
  assert not w.locator('[data-workshop-next-hand]').count();assert not w.locator('[data-workshop-action=useExample]').count();expect(w.locator('[data-workshop-inspector]')).to_be_visible()
  self.capture(page,c,'OFFでも自由な設計を保ったまま調整できる','custom-off')
  self.set_workshop_examples(page,w,True,c);assert self.state(page)['run']['workshop']['parts']['common-button']==p
  self.hand(w,'useExample').locator('[data-workshop-example-action=useExample]').click();after=self.state(page);q=after['run']['workshop']['parts']['common-button']
  assert q['step']==3 and q['rect']==p['rect'];assert q['design']['radius']==0 and not q['design']['shadow'];assert after['resources']['pixels']>off['resources']['pixels']
  assert not w.locator('[data-workshop-action=useExample]').count();expect(w.locator('[data-workshop-customization]')).to_be_attached();self.capture(page,c,'おまかせ1回で標準値を適用し仕上げへ進む','example-applied')
  self.finish_part(page,w,next(p for p in catalog() if p['id']=='common-button'));expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4');page.clock.run_for(2000)
  detail=w.locator('[data-workshop-customization]');expect(detail).to_be_attached()
  if not detail.get_attribute('open'):detail.locator('summary').click()
  before_edit=self.state(page);detail.locator('input[type=range]').first.focus();page.keyboard.press('ArrowRight');after_edit=self.state(page)
  assert after_edit['run']['workshop']['parts']['common-button']['step']==4 and after_edit['run']['workshop']['combo']==before_edit['run']['workshop']['combo'];assert after_edit['resources']==before_edit['resources'];assert not w.locator('[data-workshop-completion]').count()
  self.capture(page,c,'完成後もこだわりを開け、報酬を二重に得ない','completed-customization');c['adjustment']={'togglePreservesFreeDesign':True,'explicitStandardOnly':True,'onePayment':True,'completedEditingNoReplay':True}

 def economy_examples(self,page,c):
  results=[]
  for mode in ['on','off']:
   self.navigate(page,f'examples-finish-{mode}-era{c["era"]}',c);w=page.locator('[data-workshop=true]');self.quiet(page);before=self.state(page);rate_before=self.rate(w)
   self.finish_part(page,w,next(p for p in catalog() if p['id']=='common-button'));after=self.state(page)
   expect(w.locator('[data-workshop-completion]')).to_be_visible();expect(w.locator('[data-workshop-feedback-counter]')).to_be_visible();expect(w.locator('[data-workshop-rate-flight]')).to_be_visible()
   rate=self.rate(w);counter=w.locator('[data-workshop-feedback-counter]').text_content();assert abs(self.counter_rate(w.locator('[data-workshop-feedback-counter]'))-rate_before)<=.11
   page.clock.run_for(350)
   assert self.rate(w)==rate
   assert rate_before-.11<=self.counter_rate(w.locator('[data-workshop-feedback-counter]'))<=rate+.11
   self.capture(page,c,'ON/OFFで同じ完成払いと実毎秒、数字だけを補間する','economy-'+mode)
   page.clock.run_for(400);assert abs(self.counter_rate(w.locator('[data-workshop-feedback-counter]'))-rate)<=.11;assert not w.locator('[data-workshop-rate-flight]').count()
   results.append({'mode':mode,'delta':after['resources']['pixels']-before['resources']['pixels'],'rateBefore':rate_before,'rate':rate,'combo':after['run']['workshop']['combo']['count'],'counterStart':counter})
   page.clock.run_for(2000);assert not w.locator('[data-workshop-completion]').count()
   normal=w.locator('[data-workshop-canvas-part=common-button] button').first;normal.click();assert self.state(page)['run']['workshop']['combo']==after['run']['workshop']['combo'];assert not w.locator('[data-workshop-completion]').count()
   export=w.locator('[data-workshop-action=exportPart]');export.click();assert not w.locator('[data-workshop-completion]').count()
   saved=self.state(page);self.import_state(page,saved,c);assert not page.locator('[data-workshop-completion]').count();assert self.state(page)['run']['workshop']['combo']==saved['run']['workshop']['combo']
  assert abs(results[0]['delta']-results[1]['delta'])<.001 and results[0]['rate']==results[1]['rate'] and results[0]['combo']==results[1]['combo'],results
  self.navigate(page,f'examples-finish-on-era{c["era"]}',c);w=page.locator('[data-workshop=true]');page.clock.run_for(16000);assert not w.locator('[data-workshop-combo]').count();self.finish_part(page,w,next(p for p in catalog() if p['id']=='common-button'));assert self.state(page)['run']['workshop']['combo']['count']==1
  self.capture(page,c,'15秒を過ぎると次の工程は等倍、次完成は1回目','combo-timeout');c['economy']={'paired':results,'timeoutResets':True,'loadAndExportAndReuseNoReplay':True}

 def migration_examples(self,page,c):
  inputs=[*sorted((ROOT/'game/src/systems/testdata').glob('tp-v15-main-*.json.gz')),*sorted((ROOT/'game/src/systems/testdata').glob('examples-v16-7005674-*.json.gz'))];sources=[]
  for path in inputs:
   old=json.loads(gzip.decompress(path.read_bytes()));assert old['schemaVersion'] in [15,16]
   after=self.import_state(page,old,c);assert after['schemaVersion']==17 and after['persistent']['examplesEnabled'] is True;assert after['run']['workshop']['combo']=={'count':0,'lastCompletedAt':None}
   for key in ['specs','seedSkills','editorSkills','products','setDocuments','screenshots']:assert after['persistent'][key]==old['persistent'][key],(path.name,key)
   for key in ['pixels','tokens','dollars']:assert after['resources'][key]>=old['resources'][key]
   assert after['run']['workshop']['parts']==old['run']['workshop']['parts']
   if old['schemaVersion']==16:assert after['run']['seed']['page']==old['run']['seed']['page']
   self.navigate(page,None,c);assert not page.locator('[data-workshop-completion]').count();assert not page.locator('[data-workshop-snap]').count();assert self.state(page)['persistent']['screenshots']==old['persistent']['screenshots']
   self.capture(page,c,'真正旧保存の自由設定と作品を保持: '+path.stem,'migration-'+path.stem);sources.append(path.name)
  assert len(sources)==12;c['migration']={'sources':sources,'oldPayloadUnchanged':True,'noCompletionOrSnapReplay':True}

 def pending(self,page,c):
  self.quiet(page);frame=self.maximize(page,'tessera');w=frame.locator('[data-workshop=true]');before=self.state(page);assert before['run']['workshop']['activePart']=='photo-crop'
  w.locator('[data-workshop-zoom]').select_option('0.5');control=w.locator('[data-workshop-canvas-part=photo-crop] input[type=range]').first
  start=float(control.input_value());minimum=float(control.get_attribute('min'));maximum=float(control.get_attribute('max'));assert maximum>minimum
  direction='ArrowLeft' if start>minimum else 'ArrowRight';control.focus();page.keyboard.press(direction)
  expect(w.locator('[data-workshop-step]')).to_have_attribute('data-workshop-step','4');expect(w.locator('[data-workshop-completion]')).to_have_attribute('data-workshop-completion-growing','false');assert not w.locator('[data-workshop-rate-flight]').count();assert not w.locator('[data-workshop-feedback-counter]').count()
  assert float(control.input_value())!=start
  self.geometry(page,frame);self.capture(page,c,'未採用の材料は合計を架空に増やさず、組み込み待ちと知らせる','pending-material');c['pending']={'unadoptedNoPartRateAddition':True,'noFlightOrCounter':True,'range':{'min':minimum,'max':maximum,'before':start,'after':float(control.input_value()),'key':direction}}

 def reduced(self,page,c):
  w=page.locator('[data-workshop=true]');self.quiet(page);self.finish_part(page,w,next(p for p in catalog() if p['id']=='common-button'))
  expect(w.locator('[data-workshop-completion]')).to_be_visible();assert not w.locator('[data-workshop-rate-flight]').count() and not w.locator('[data-workshop-feedback-counter]').count();self.capture(page,c,'動きを減らしても完成と実毎秒を即表示','reduced-completion');page.clock.run_for(2000);assert not w.locator('[data-workshop-completion]').count()
  self.navigate(page,f'examples-place-on-era{c["era"]}',c);w=page.locator('[data-workshop=true]');self.quiet(page);target=self.state(page)['run']['workshop']['parts']['common-button']['rect'];self.drag_part(page,w,{**target,'x':target['x']+8,'y':target['y']+8});expect(w.locator('[data-workshop-snap]')).to_be_visible();self.capture(page,c,'動きを減らしても吸着が伝わり、時間後に消える','reduced-snap');page.clock.run_for(650);assert not w.locator('[data-workshop-snap]').count();c['reduced']={'noMotionButImmediateFeedback':True,'snapSettles':True}


def main():
 a=argparse.ArgumentParser();a.add_argument('--base-url',default='http://127.0.0.1:4173');a.add_argument('--output-dir',default='game/artifacts/examples')
 a.add_argument('--step',action='append',choices=STEPS);a.add_argument('--language',action='append',choices=LANGUAGES);a.add_argument('--width',action='append',type=int,choices=SIZES);a.add_argument('--era',action='append',type=int,choices=[0,1,2,3]);a.add_argument('--resume',action='store_true');a.add_argument('--recheck',action='store_true');a.add_argument('--keep-going',action='store_true');args=a.parse_args()
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);review=ExampleChecks(args,browser)
  for step in args.step or STEPS[:-1]:
   eras=args.era or ([0,1,2,3] if step in ['desktop','pending'] else [0] if step=='migration' else [0,1,2])
   for era in eras:
    for language in args.language or LANGUAGES:
     for width in args.width or SIZES:review.run(step,language,width,era)
  browser.close()
 print(json.dumps({k:review.report[k] for k in ['passed','failed','pageErrors','console','externalRequests']},ensure_ascii=False))
 assert not review.report['failed']
 with zipfile.ZipFile(review.out/'examples-screens.zip','w',zipfile.ZIP_DEFLATED) as z:
  names=['index.html','summary.json',*[step+'.html' for step in STEPS],*[i['file'] for c in review.report['cases'] for i in c['images']]]
  for name in dict.fromkeys(names):z.write(review.out/name,name)
if __name__=='__main__':main()
