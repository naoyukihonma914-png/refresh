const RECIPES=[
 ['border',8,'輪郭','□','最初の一本の線。ボタンに枠線が宿る。','クリック +1'],
 ['color',45,'最初の色','◐','白黒の世界に、あなたの色を落とす。','クリック ×2・自動生成 ×2'],
 ['font',100,'文字の表情','Aa','文字にリズムが生まれ、画面が読みやすくなる。','クリック +2'],
 ['shadow',210,'小さな奥行き','▱','ボタンが浮かび、押す感触が生まれる。','全生産 ×1.5'],
 ['motion',400,'時間の息吹','↗','静止したカーソルが動き、クリックが光を残す。','自動生成 ×2'],
 ['window',800,'ひとつの窓','▣','作ったものを包む、最初のウィンドウ。','全生産 ×2'],
 ['slider',1300,'生成リズム','☷','手で生む力と、自動で生む力を調律する。','スライダーを配置・全生産 ×1.5'],
 ['gauge',2200,'満ちる光','▰','生産がゲージに溜まり、満ちると弾ける。','20秒ごとに通常生産10秒分を還元'],
 ['corners',3400,'やわらかな角','▢','窓も部品も、触れたくなる輪郭へ。','全生産 ×1.5'],
 ['tabs',5200,'アプリケーション','▦','操作盤が、サイドバーとダッシュボードのある Pixel Studio に変わる。','アプリ化・観測画面・全生産 ×1.5'],
 ['break',9000,'窓の、その先','⤢','この窓が世界のすべてだと思っていた。','デスクトップを解放・全生産 ×2'],
 ['wallpaper',14500,'余白に色を','░','空っぽの外側に、模様と淡い色が広がる。','全生産 ×1.5'],
 ['dock',23000,'世界の足場','▥','窓の下に、小さなドックを組み上げる。','全生産 ×1.5'],
 ['atelier',37000,'制作スタジオ','✧','Chromatic が起動。アプリが色と形を描き、作品を作りはじめる。','デザインアプリ・追加生産 +80%'],
 ['gradient',59000,'動きを作るアプリ','≋','Flow が起動。モーションが脈打ち、世界にリズムが生まれる。','モーションアプリ・グラデーション・全生産 ×1.5'],
 ['glass',92000,'素材のライブラリ','◇','作った部品が Library に並ぶ。窓が透明になり、重なる景色が透ける。','ライブラリ・ガラス・全生産 ×1.5'],
 ['light',145000,'光の居場所','☼','部品の輪郭に光が宿り、周囲を照らす。','全生産 ×1.5'],
 ['blueprint',225000,'Creative OS','✺','アプリの集まりが、ひとつのOSへ。画面全体が再編成される。','OS化・カーソル自動錬成・全生産 ×2'],
 ['palette',350000,'世界のパレット','◉','一滴の色が、すべての窓へ行き渡る。','追加の配色・全生産 ×1.5'],
 ['material',540000,'質感の錬金術','◈','ガラスの透明感、真鍮の温かさ。世界に手触りを。','素材切替・全生産 ×1.5'],
 ['constellation',830000,'呼吸する景色','⁂','光がゆっくり移ろい、設備が脈打つ。','全生産 ×1.5'],
 ['harmony',1300000,'統一された様式','✺','すべてのアプリに、あなたのデザインが行き渡る。まだ、その先がある。','全生産 ×2'],
 ['workspaces',2200000,'複数の作業空間','▥','ひとつのデスクトップが3つになる。生成、色と形、動きと光。','3つの景色を切替・全生産 ×2'],
 ['launchpad',3800000,'アプリの星座','▦','育てたアプリがランチャーに並ぶ。ひと押しで、自分の世界を行き来する。','アプリランチャー・全生産 ×2'],
 ['network',6500000,'創造の同期','↔','ひとつのアプリから次のアプリへ、光が伝わる。世界が連動して働く。','アプリ間の同期演出・全生産 ×2'],
 ['panorama',11000000,'世界を見渡す','▧','たくさんの画面が、ひとつの大きな制作環境になる。','パノラマの装飾・全生産 ×2'],
 ['ecosystem',19000000,'創造する世界','✹','最初のボタンから、自分のOSとアプリの生態系を作り上げた。','新しい完成形・全生産 ×2.5']
].map(([id,cost,name,icon,desc,effect],i)=>({id,cost:i>8?Math.round(cost*Math.pow(1.3,i-8)*Math.pow(0.82,Math.max(0,i-17))/10)*10:cost,name,icon,desc,effect}));
const fresh=()=>({version:1,px:0,total:0,clicks:0,cursors:0,owned:[],rhythm:1,gauge:0,tint:'sage',material:'glass',auto:true,sound:false,started:Date.now(),saved:Date.now(),history:[],workspace:0,design:0,motionPaused:false});
let state=fresh();
const has=id=>state.owned.includes(id);
function multiplier(){let m=1;for(const [id,x] of [['shadow',1.5],['window',2],['slider',1.5],['corners',1.5],['tabs',1.5],['break',2],['wallpaper',1.5],['dock',1.5],['gradient',1.5],['glass',1.5],['light',1.5],['blueprint',2],['palette',1.5],['material',1.5],['constellation',1.5],['harmony',2],['workspaces',2],['launchpad',2],['network',2],['panorama',2],['ecosystem',2.5]])if(has(id))m*=x;return m}
function rhythm(){return has('slider')?state.rhythm:1}
function clickPower(){return ((1+(has('border')?1:0))*(has('color')?2:1)+(has('font')?2:0))*multiplier()*[2,1,.55][rhythm()]}
function originRate(){return state.cursors*.65*(has('color')?2:1)*(has('motion')?2:1)*multiplier()*[.55,1,1.5][rhythm()]}
function rate(){return originRate()*(has('atelier')?1.8:1)}
function cursorCost(){return Math.ceil(15*Math.pow(1.19,state.cursors))}
function earn(n){if(Number.isFinite(n)&&n>0){state.px+=n;state.total+=n}}
function nextRecipe(){return RECIPES.find(r=>!has(r.id))}
function tick(seconds){if(seconds<=0)return;earn(rate()*seconds);if(has('gauge')){state.gauge+=seconds;let cycles=Math.floor(state.gauge/20);state.gauge%=20;if(cycles)earn(cycles*rate()*10)}if(has('blueprint')&&state.auto){let reserve=nextRecipe()?.cost||0;for(let i=0;i<100&&state.px>=reserve+cursorCost()&&state.cursors<300;i++){state.px-=cursorCost();state.cursors++}}}
function buyRecipe(id){const r=nextRecipe();if(!r||r.id!==id||state.px<r.cost)return false;state.px-=r.cost;state.owned.push(id);state.history.push({id,at:Date.now()});return true}
function buyCursor(){if(!has('border')||state.px<cursorCost()||state.cursors>=300)return false;state.px-=cursorCost();state.cursors++;return true}
function validate(s){if(!s||s.version!==1)throw Error('対応していないセーブデータです');for(const key of ['px','total','clicks','cursors','gauge','saved'])if(!Number.isFinite(s[key])||s[key]<0)throw Error('セーブデータを確認できません');if(!Array.isArray(s.owned)||s.owned.some((v,i)=>v!==RECIPES[i]?.id)||s.owned.length>RECIPES.length)throw Error('錬成の記録が正しくありません');return {...fresh(),...s,workspace:[0,1,2].includes(s.workspace)?s.workspace:0,design:[0,1,2].includes(s.design)?s.design:0,motionPaused:s.motionPaused===true,cursors:Math.min(300,Math.floor(s.cursors)),rhythm:[0,1,2].includes(s.rhythm)?s.rhythm:1,tint:['sage','amber','rose','ice','lilac'].includes(s.tint)?s.tint:'sage',material:s.material==='brass'?'brass':'glass',history:Array.isArray(s.history)?s.history.filter(h=>RECIPES.some(r=>r.id===h.id)&&Number.isFinite(h.at)):[]}}


