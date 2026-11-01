"""Appendix E's player assumptions, using the implementation's prices and bonuses.
Input: BALANCE as JSON on stdin, supplied by measure_stage65.mjs. Appendix E stays unchanged.
"""
import copy,json,sys
from economy_sim import CONFIG,Run
B=json.load(sys.stdin);C=copy.deepcopy(CONFIG)
seed={'border':'枠線','save':'保存','color':'色','font':'書体','layout':'配置','motion':'動き','kumiki':'組木を作る'}
parts={'select':'選択ツール','button':'ボタン','extensions':'拡張機能','input':'入力欄','frame':'窓の枠','taskbar':'タスクバー'}
apps={'files':'ファイル','sort':'ファイル：並べ替え','mail':'メール','draft':'メール：返信の下書き','jobs':'持ち場','manager':'タスクマネージャー','search':'ファイル：検索','large':'ファイル：大きいアイコン表示','photo':'写真','crop':'写真：切り抜き','compare':'写真：比べて見る','bin':'ごみ箱','undo':'ごみ箱：元に戻す','folders':'メール：フォルダ分け','clock':'時計','timer':'時計：タイマー','calendar':'時計：カレンダー','theme':'テーマ','slideshow':'テーマ：壁紙のスライドショー','iconSize':'テーマ：アイコンの大きさ','terminal':'ターミナル'}
C['w1']['items']=[(seed[i['id']],i['cost']) for i in B['w1']['items']]
C['w1'].update({k:B['w1'][k] for k in ['cursor_cost','cursor_growth','cursor_press_per_sec']})
C['w2']['items']=[(parts[i['id']],i['cost']) for i in B['w2']['items']]+[('デスクトップとして組み立てる',B['w2']['desktopCost'])]
C['w2']['icons_extra']=10
C['w3']['items']=[(apps[i['id']],i['cost']) for i in B['w3']['apps']]
for old,new in [('post_cursor_growth','cursorGrowth'),('update_cost_mult','updateBase'),('update_cost_growth','updateGrowth'),('update_mult','updateMultiplier'),('feature_post_mult','featureMultiplier'),('feature_parts','featureParts')]:C['w3'][old]=B['w3'][new]
C['longplay'].update(achievement_bonus=B['longPlay']['achievementBonus'],icon_synergy=B['longPlay']['iconBonus'],icon_synergy_cap=B['longPlay']['iconCap'],cursor_synergy=B['longPlay']['cursorBonus'])
class ImplementationRun(Run):
 ICON_AFTER=[None,'ボタン','拡張機能','入力欄','窓の枠','タスクバー']
 def __init__(self,*args,earned=(),prior_icons=0,**kwargs):
  super().__init__(*args,**kwargs);self.earned=set(earned);self.prior_icons=prior_icons
 def achievements(self):
  facts={'first-pixel':self.total_px>0,'save-created':self.has('保存'),'cursors10':self.cursors>=10,'cursors50':self.cursors>=50,'kumiki-created':self.has('組木を作る'),'first-export':self.icons_done>0 or self.parts_exported>0,'icons6':self.icons_done>=6,'practice10':self.icons_done>=16,'parts-all':self.has('タスクバー'),'prototype-released':self.label!='v0.1','first-shot':self.has('ファイル'),'shots100':self.has('写真'),'feedback10':self.mails>=10,'feedback50':self.mails>=50,'jobs-full':len(self.posts)>=self.post_limit() and all(n for n,lv in self.posts.values()),'apps7':sum(self.has(apps[k]) for k in ['files','mail','manager','photo','bin','clock','theme','terminal'])+1>=7,'wallpaper':self.has('写真'),'terminal':self.has('ターミナル')}
  self.earned.update(k for k,v in facts.items() if v);return len(self.earned)
 def posts_rate(self):
  rate=super().posts_rate();lp=self.c['longplay'];return rate/(1+lp['icon_synergy']*min(self.icons_done,lp['icon_synergy_cap']))*(1+lp['icon_synergy']*min(self.prior_icons+self.icons_done,lp['icon_synergy_cap']))
 def world1(self):
  # In the implementation, configuration inheritance is unlocked in v1, not v0.1.
  had='構成を引き継ぐ' in self.tree;self.tree.discard('構成を引き継ぐ');super().world1()
  if had:self.tree.add('構成を引き継ぐ')
def run_model(config,cls):
 spec={'color':'16色','hz':30,'memory':'4GB','res_cells':1,'res_tokens':1}
 r0=cls(config,dict(spec),0,[],'v0.1');r0.world1();r0.world2(stop_at_gate=True)
 while r0.icons_done<2:r0.draw(1)
 r0.t+=5*60
 spec['color']='256色';kwargs={'earned':r0.earned|{'prototype-released'},'prior_icons':r0.icons_done} if cls is ImplementationRun else {}
 r1=cls(config,dict(spec),r0.tokens,r0.tree,'v1',**kwargs);r1.world1();r1.world2(stop_at_gate=False);r1.world3();return r0,r1
base0,base1=run_model(CONFIG,Run);r0,r1=run_model(C,ImplementationRun)
report={'assumptions':C['player'],'appendixE':{'v01Seconds':base0.t,'v1Seconds':base1.t,'v1Hours':base1.t/3600},'implementationModel':{'v01Seconds':r0.t,'v1Seconds':r1.t,'v1Hours':r1.t/3600,'withinSixToEightHours':6<=r1.t/3600<=8,'homeCursors':r1.cursors,'exportedIconsThisVersion':r1.icons_done,'exportedIconsLifetime':r1.prior_icons+r1.icons_done,'achievements':sorted(r1.earned),'jobs':r1.posts,'entryRate':r1.rate_in,'exitRate':r1.rate_out,'pixels':r1.total_px,'revenue':r1.sales(),'purchases':[{'seconds':t,'world':w,'name':n} for t,w,n in r1.log]},'limits':['Appendix E is a planning model, not a browser speedrun. It retains averaged drawing, recycling and half-active screenshot/feedback assumptions.','No optional secrets, stray pixels, repair/restart rewards, contract rewards, paid cosmetic upgrades or background hours are assumed.','The screenshot count milestone is estimated at the photo unlock, as E averages screenshots instead of storing individual captures.','App construction time and the actual window layout can change the result; the functional game rules are tested separately.']}
# Appendix C 10.5 says prices after Photo were tripled, while its table, E and BALANCE
# still agree on the original prices. Record the alternative rather than silently retuning.
tripled=copy.deepcopy(C);late=False
for i,(name,cost) in enumerate(tripled['w3']['items']):
 if name=='写真':late=True
 if late:tripled['w3']['items'][i]=(name,cost*3)
_,alternative=run_model(tripled,ImplementationRun)
report['latePriceSensitivity']={'factor':3,'v1Seconds':alternative.t,'v1Hours':alternative.t/3600,'withinSixToEightHours':6<=alternative.t/3600<=8}
print(json.dumps(report,ensure_ascii=False,indent=2))
