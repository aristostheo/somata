import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const { fixtures } = require('./tools/render-nutrition-family-preview.cjs');
const base = 'app/(modals)/';
function setup(route: string, states: any = {}, options: any = {}, props: any = {}) {
  const f = { params: { date: fixtures.date, meal: 'lunch' }, states, ...options };
  const r = createRuntime({ account: { uid: options.signedOut ? null : 'synthetic-nutrition-9' }, nutritionFlow: f });
  const draw = () => r.render(r.load(route).default, props);
  draw(); return { r, f, draw, state: (name: string) => r.flow.state.get(`${route}:${name}`) };
}
const action = (r: any, label: string) => { const found = r.actions.find((a: any) => a.accessibilityLabel === label || a.children?.props?.children === label); assert(found, label); return found; };
const input = (r: any, label: string) => { const found = r.inputs.find((i: any) => i.accessibilityLabel === label); assert(found, label); return found; };
const settle = () => new Promise(done => setImmediate(done));

test('both scanner paths render capture, processing and review without raw native text children', () => {
  for (const route of ['app/nutrition/scan-meal.tsx', 'app/nutrition/scan-meal-v2.tsx']) {
    for (const state of ['idle', 'photo_ready', 'analyzing', 'review']) {
      for (const cameraGranted of [false, true]) {
        assert.doesNotThrow(() => setup(route, {
          state, photoUri: state === 'idle' ? null : 'synthetic-photo',
          foods: state === 'review' ? [fixtures.scanned] : [],
        }, { validateNativeText: true, cameraGranted }), `${route}: ${state}, permission=${cameraGranted}`);
      }
    }
  }
});

test('food source selection keeps all six modes and scanner date/builder destination', () => {
  const route = base + 'add-meal.tsx';
  const { r, draw, state } = setup(route, {}, { params: { date: fixtures.date, meal: 'dinner', returnTo: 'meal-builder', builderSessionId: 'synthetic-session-9' } });
  for (const [label, value] of [['Search','search'],['Recent','recents'],['Frequent','favorites'],['Describe','describe'],['Barcode','barcode'],['Manual','manual']]) {
    action(r,label).onPress(); assert.equal(state('tab'),value); draw();
  }
  action(r,'Scan a meal photo').onPress();
  assert.equal(r.routes[0].params.date, fixtures.date); assert.equal(r.routes[0].params.returnTo,'meal-builder');
  assert.equal(r.routes[0].params.builderSessionId,'synthetic-session-9'); assert.equal(r.writes.length,0);
});

test('description success opens review without logging; 429/malformed responses retain the draft', async () => {
  const { meal, date, ...estimate } = fixtures.food;
  for (const options of [{providerResult:estimate},{providerError:'429 synthetic limit'},{providerResult:{unexpected:true}}]) {
    const {r,draw,state}=setup(base+'add-meal.tsx',{tab:'describe',descText:'Synthetic lunch'},options);
    await action(r,'Calculate nutrition').onPress(); draw();
    assert.equal(r.flow.providerCalls.length,1);assert.equal(r.writes.length,0);assert.equal(state('descText'),'Synthetic lunch');
    if ('providerError' in options || 'unexpected' in (options.providerResult||{})) assert(state('descError'));
    else assert.equal(state('confirmOpen'),true);
  }
});

test('selected food needs explicit review; quantity scales once and optional missing nutrients remain absent', async () => {
  const {r,draw,state}=setup(base+'add-meal.tsx',{tab:'search',q:'grain',results:[fixtures.food]});
  const text=(x:any):string=>!x?'':typeof x==='string'?x:Array.isArray(x)?x.map(text).join(' '):text(x.props?.children);
  const row=r.actions.find((a:any)=>text(a.children).toLowerCase().includes(fixtures.food.name.toLowerCase()));
  assert(row,'food result row'); row.onPress(); draw();
  assert.equal(state('confirmOpen'),true);assert.equal(r.writes.length,0);
  input(r,'Quantity').onChangeText('2');draw();assert.equal(state('confirmEdits').calories,'1040');
  action(r,'Add to log').onPress();await settle();
  const write=r.writes.find((w:any)=>w[0]==='handoff');assert(write);
  assert.equal(write[2].date,fixtures.date);assert.equal(write[2].qty,2);assert.equal(write[2].calories,1040);
  assert.equal(write[2].sugar,undefined);assert.equal(write[3],'synthetic-nutrition-9');
});

test('quick macros retain explicit zero, chosen meal/date and synthetic owner handoff', async () => {
  const {r}=setup(base+'quick-add.tsx',{macroOpen:true,quickDraft:{name:'Synthetic zero',calories:'0',protein:'0',carbs:'0',fat:'0'}});
  await action(r,'Add to meal').onPress();const w=r.writes[0];assert.equal(w[0],'handoff');assert.equal(w[2].calories,0);
  assert.equal(w[2].date,fixtures.date);assert.equal(w[2].meal,'lunch');assert.equal(w[3],'synthetic-nutrition-9');
});

test('logged-food editor scales original portion and retains save/delete/close and busy states', () => {
  const saved:any[]=[];const deleted:any[]=[];let closed=0;
  const props={open:true,item:fixtures.food,onSave:(p:any)=>saved.push(p),onDelete:(id:string)=>deleted.push(id),onClose:()=>closed++};
  const {r,draw,state}=setup('components/nutrition/uiNew/EditFoodSheet.tsx',{values:fixtures.edits},{},props);
  input(r,'Quantity').onChangeText('2');draw();assert.equal(state('values').calories,'1040');
  action(r,'Save changes').onPress();assert.equal(saved[0].qty,2);assert.equal(saved[0].calories,1040);
  action(r,'Delete food').onPress();assert.equal(deleted[0],fixtures.food.id);
  action(r,'Close').onPress();assert.equal(closed,1);
  const busy=setup('components/nutrition/uiNew/EditFoodSheet.tsx',{values:fixtures.edits},{},{...props,saving:true});
  assert.equal(action(busy.r,'Saving…').disabled,true);assert.equal(action(busy.r,'Delete food').disabled,true);
});

test('both scanner reviews require confirmation, keep missing extras, and guard repeated delivery', async () => {
  for(const route of ['app/nutrition/scan-meal.tsx','app/nutrition/scan-meal-v2.tsx']) {
    let release!:()=>void;const saveWait=new Promise<void>(r=>release=r);
    const {r}=setup(route,{state:'review',foods:[{...fixtures.scanned,macros:{...fixtures.scanned.macros,protein:0,sodiumMg:0}}]},
      {saveWait,params:{date:fixtures.date,meal:'dinner',returnTo:'meal-builder',builderSessionId:'synthetic-session-9'}});
    assert.equal(r.writes.length,0);const confirm=action(r,route.includes('v2')?'Add to meal':'Confirm & log');
    const first=confirm.onPress();await settle();await confirm.onPress();assert.equal(r.writes.filter((w:any)=>w[0]==='handoff').length,1);
    const w=r.writes.find((w:any)=>w[0]==='handoff');assert.equal(w[1],'@pending_meal_builder_additions_v1');
    assert.equal(w[2].builderSessionId,'synthetic-session-9');assert.equal(w[2].date,fixtures.date);
    assert.equal(w[2].items[0].protein,0);assert.equal(w[2].items[0].sodium,0);assert.equal(w[2].items[0].sugar,undefined);
    release();await first;assert(r.routes.includes('BACK'));
  }
});

test('scanner failed handoff keeps review and allows retry; an inactive owner cannot queue', async () => {
  for(const route of ['app/nutrition/scan-meal.tsx','app/nutrition/scan-meal-v2.tsx']) {
    const {r,f,draw,state}=setup(route,{state:'review',foods:[fixtures.scanned]},{failSave:true});
    await action(r,route.includes('v2')?'Add to meal':'Confirm & log').onPress();assert.equal(state('state'),'review');assert.equal(r.routes.length,0);assert(r.alerts.length);
    f.failSave=false;draw();await action(r,route.includes('v2')?'Add to meal':'Confirm & log').onPress();assert(r.routes.includes('BACK'));
    const inactive=setup(route,{state:'review',foods:[fixtures.scanned]},{accountInactive:true});
    await action(inactive.r,route.includes('v2')?'Add to meal':'Confirm & log').onPress();assert.equal(inactive.r.writes.length,0);
  }
});

test('scanner quota/provider failures never log; provider calls use only the mocked service', async () => {
  for(const options of [{quotaDenied:true},{providerError:'Synthetic timeout'},{scanResult:{foods:[fixtures.scanned]}}]){
    const {r,state}=setup('app/nutrition/scan-meal.tsx',{state:'photo_ready',photoUri:'synthetic-photo'},options);
    await action(r,'Scan with AI').onPress();assert.equal(r.writes.length,0);
    if('quotaDenied' in options){assert.equal(r.flow.providerCalls.length,0);assert(r.alerts.some((a:any)=>a[0]==='Daily scan limit reached'));}
    else {assert.equal(r.flow.providerCalls.length,1);if('scanResult' in options)assert.equal(state('state'),'review');}
  }
});

test('scan add/refine sheets keep portion validation, confidence and explicit callbacks', () => {
  const added:any[]=[];const a=setup('components/scanMeal/new/AddFoodSheet.tsx',{name:'Synthetic item',amt:'0'},{},{visible:true,onClose(){},onAdd:(f:any)=>added.push(f)});
  assert.equal(action(a.r,'Add item').disabled,true);input(a.r,'Quantity').onChangeText('2');a.draw();action(a.r,'Add item').onPress();assert.equal(added[0].portion.amount,2);assert.equal(added[0].confidence,'manual');
  const saved:any[]=[];const e=setup('components/scanMeal/new/EditFoodSheet.tsx',{}, {},{visible:true,food:fixtures.scanned,onClose(){},onSave:(f:any)=>saved.push(f)});
  input(e.r,'Portion').onChangeText('2');e.draw();action(e.r,'Save changes').onPress();assert.equal(saved[0].macros.calories,1040);assert.equal(saved[0].confidence,'medium');
});

test('builder quantity, unit, reorder and remove remain independent from final logging', async () => {
  const {r,draw,state}=setup(base+'meal-builder.tsx',{items:[fixtures.item,{...fixtures.item,id:'synthetic-second',name:'Second ingredient'}],mealName:'Synthetic meal'});
  action(r,`Increase ${fixtures.item.name}`).onPress();draw();assert(state('items')[0].qty>1);assert.equal(r.writes.length,0);
  input(r,'Unit').onChangeText('g');draw();assert.equal(state('items')[0].unit,'g');
  action(r,'Move later').onPress();draw();assert.equal(state('items')[0].id,'synthetic-second');
  action(r,'Remove Second ingredient').onPress();draw();assert.equal(state('items').length,1);
  await action(r,'Log meal').onPress();const w=r.writes.find((w:any)=>w[0]==='handoff');assert(w);assert.equal(w[2].date,fixtures.date);assert.equal(w[2].name,'Synthetic meal');
});

test('builder retains all four input modes, preset actions, error notice retry and empty-log guard', () => {
  const {r,draw,state}=setup(base+'meal-builder.tsx',{handoffNotice:'Synthetic failed transfer',handoffCanRetry:true});
  assert.equal(action(r,'Log meal').disabled,true);
  action(r,'Photo').onPress();assert.equal(r.routes[0].pathname,'/(modals)/scan-meal-v2');assert.equal(r.routes[0].params.returnTo,'meal-builder');assert.equal(state('activeMethod'),null);
  for(const [label,value] of [['Describe','describe'],['Barcode','barcode'],['Manual','manual']]){
    action(r,label).onPress();draw();assert.equal(state('activeMethod'),value);action(r,'Close').onPress();draw();assert.equal(state('activeMethod'),null);
  }
  action(r,'Retry scan transfer').onPress();assert.equal(state('handoffRetry'),1);
  assert(action(r,'Save as a meal preset'));assert(action(r,'Browse meal presets'));assert.equal(r.writes.length,0);
});

test('diet choices persist through existing owner update only on save; failed saves retain selections', async () => {
  const {r,draw,state,f}=setup(base+'diet-preferences.tsx',{}, {failSave:true});
  action(r,'Vegetarian').onPress();draw();assert(state('prefs').restrictions.includes('vegetarian'));assert.equal(r.writes.length,0);
  await action(r,'Save preferences').onPress();assert.equal(r.routes.length,0);assert(state('prefs').restrictions.includes('vegetarian'));
  f.failSave=false;draw();await action(r,'Save preferences').onPress();assert.equal(r.writes.at(-1)[1],'synthetic-nutrition-9');assert(r.routes.includes('BACK'));
});

test('water uses the separate UID quick-log key and disables signed-out/busy controls', async () => {
  const {r}=setup(base+'quick-hydration.tsx');await action(r,'Log 250 milliliters').onPress();
  assert.equal(r.writes[0][1],'hydration:quickLogs:synthetic-nutrition-9');assert.equal(JSON.parse(r.writes[0][2])[0].ml,250);
  for(const [state,options] of [[{busy:true},{}],[{},{signedOut:true}]]){const x=setup(base+'quick-hydration.tsx',state,options);assert.equal(action(x.r,'Log 250 milliliters').disabled,true);}
});

test('AI ideas keep the Pro/disabled-checkout gate, provider failure and explicit review routing', async () => {
  const locked=setup(base+'ai-meal-suggestions.tsx');await action(locked.r,'Generate ideas').onPress();await settle();assert.equal(locked.r.flow.providerCalls.length,0);assert.equal(locked.r.routes.length,0);assert(locked.r.alerts[0][1].includes('unavailable'));
  const failed=setup(base+'ai-meal-suggestions.tsx',{}, {isPro:true,providerError:'429 synthetic limit'});action(failed.r,'Generate ideas').onPress();await settle();assert.equal(failed.r.flow.providerCalls.length,1);assert.equal(failed.r.writes.length,0);assert(failed.r.alerts.length);
  const ready=setup(base+'ai-meal-suggestions.tsx',{ideas:[fixtures.food]},{isPro:true});action(ready.r,'Review and add').onPress();assert.equal(ready.r.routes[0].pathname,'/(modals)/add-meal');assert.equal(ready.r.routes[0].params.date,fixtures.date);assert.equal(ready.r.writes.length,0);
});

test('remaining-target presentation distinguishes absent parameters from explicit zero', () => {
  const missing=setup(base+'what-should-i-eat.tsx');const missingBody=missing.draw().body;assert(missingBody.includes('—'));assert(missingBody.includes('not fully available'));
  const zero=setup(base+'what-should-i-eat.tsx',{}, {params:{date:fixtures.date,meal:'lunch',kcalLeft:'0',proteinLeft:'0',carbsLeft:'0',fatLeft:'0'}});
  assert(zero.draw().body.includes('0 kcal'));action(zero.r,'Find and log this meal').onPress();assert.equal(zero.r.routes[0].params.date,fixtures.date);assert.equal(zero.r.writes.length,0);
});
