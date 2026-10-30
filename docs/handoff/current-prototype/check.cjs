const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const economy=fs.readFileSync('dist/economy.js','utf8'),screens=fs.readFileSync('dist/screens.js','utf8');
for(const file of ['economy.js','screens.js','computer.js'])new vm.Script(fs.readFileSync('dist/'+file,'utf8'));
const ctx=vm.createContext({console,assert,TextEncoder});vm.runInContext(economy+'\n'+screens,ctx);
vm.runInContext(`
assert.equal(buyRecipe('color'),false);assert.equal(buyCursor(),false);earn(8);assert.equal(buyRecipe('border'),true);assert.equal(clickPower(),2);assert.equal(buyRecipe('border'),false);earn(15);assert.equal(buyCursor(),true);assert.equal(validate(JSON.parse(JSON.stringify(state))).cursors,1);
assert.throws(()=>validate({...state,px:Infinity}));assert.throws(()=>validate({...state,owned:['glass']}));
for(const count of [0,5,10,13,17,22,27]){const legacy={...fresh(),owned:RECIPES.slice(0,count).map(r=>r.id)};delete legacy.workspace;delete legacy.design;delete legacy.motionPaused;assert.equal(validate(legacy).owned.length,count);assert.equal(validate(legacy).workspace,0)}
state.owned=RECIPES.slice(0,8).map(r=>r.id);state.gauge=19;const before=state.px,r=rate();tick(2);assert.ok(Math.abs(state.px-before-r*12)<.00001);
for(let count=0;count<=27;count++){state={...fresh(),owned:RECIPES.slice(0,count).map(r=>r.id),cursors:12};const level=worldLevel(),html=screen(level);assert.ok(html.includes('data-world="'+level+'"'));assert.ok(!html.includes('undefined'));assert.ok(html.length<500000,'Renderer must stay bounded');if(level>0&&count<27)assert.ok(html.includes('data-act="purchase"'),'Purchasing must be inside the rendered computer');assert.ok(!/scene-desk|scene-display|monitor-stand|traffic/.test(html),'No physical desk or Mac traffic lights');}
const sizes=[];for(let i=0;i<WORLDS.length;i++){state={...fresh(),owned:RECIPES.slice(0,WORLDS[i].sample||WORLDS[i].count).map(r=>r.id),notes:'確認用ノート'};assert.equal(worldLevel(),i);sizes.push(screen(i).length)}console.log('Screen sizes:',sizes.join(', '));
state={...fresh(),owned:RECIPES.slice(0,27).map(r=>r.id),notes:'<script>bad</script>'};uiState.filesOpen=true;assert.ok(!screen(7).includes('<script>bad</script>'));uiState.filesOpen=false;
state=fresh();let completedAt=-1;for(let t=0;t<7200;t++){earn(clickPower()*2);tick(1);const r=nextRecipe();if(r&&state.px>=r.cost)buyRecipe(r.id);else if(has('border')&&state.px>=cursorCost()&&cursorCost()<((r?.cost||1e8)*.18)&&state.cursors<40)buyCursor();assert.ok(Number.isFinite(state.px)&&state.px>=0);if(has('ecosystem')){completedAt=t;break}}assert.ok(completedAt>=0);console.log('Progression:',completedAt,'seconds');
`,ctx);
const html=fs.readFileSync('dist/index.html','utf8');assert.ok(!html.includes('id="workshop"'),'No separate game sidebar');for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)"/g))assert.ok(fs.existsSync('dist/'+m[1]),'Missing asset '+m[1]);
for(const name of ['wallpaper-coast.png','wallpaper-city.png'])assert.ok(fs.statSync('dist/assets/'+name).size>100000);
console.log('PASS: purchases, integrated economy, legacy saves, 28 progression states, renderer bounds, no physical scenes, no Mac traffic lights, ending, scripts and assets.');
