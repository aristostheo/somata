import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));
const {createRuntime}=require('./tools/home-preview-runtime.cjs');
const {fixtures:f,scenarios,renderCase}=require('./tools/render-profile-family-preview.cjs');
const mods='app/(modals)/', pages='app/profile/';
function setup(route:string,states:any={},options:any={}) {
 const flow={validateNativeText:true,states,...options};
 const r=createRuntime({account:{uid:options.signedOut?null:'synthetic-profile-11'},profileFlow:flow});
 const draw=()=>r.render(r.load(route).default);draw();
 return{r,flow,draw,state:(n:string)=>r.flow.state.get(route+':'+n)};
}
const text=(c:any):string=>c==null?'':typeof c==='string'?c:Array.isArray(c)?c.map(text).join(' '):text(c.props?.children);
const action=(r:any,label:string)=>{const a=r.actions.find((a:any)=>a.accessibilityLabel===label||text(a.children).trim()===label);assert(a,'Action: '+label);return a;};
const input=(r:any,label:string)=>{const i=r.inputs.find((i:any)=>i.accessibilityLabel===label);assert(i,'Input: '+label);return i;};
const settle=()=>new Promise(done=>setImmediate(done));

test('all 23 Profile-family surfaces and eight analytics desks render both themes with native text constraints',()=>{
 for(const s of scenarios)for(const dark of [true,false]){
  const {runtime}=renderCase(s,{dark,width:320,fontScale:1.8});assert.equal(runtime.writes.length,0,s[0]);assert.equal(runtime.flow.providerCalls.length,0);
 }
});
test('saved goals retain draft edits, validation, explicit owner save and accepted target authority',async()=>{
 const route=pages+'goal-setup.tsx';const {r,draw,state}=setup(route,{...f.goalState,profile:{...f.profile,activeFitAdaptTargets:f.accepted}});
 assert.match(draw().body,/Your accepted plan stays active/);
 input(r,'Age').onChangeText('31');assert.equal(state('draft').age,31);assert.equal(r.writes.length,0);draw();
 await action(r,'Save changes').onPress();const write=r.writes.find((x:any)=>x[0]==='profile');assert.equal(write[1],'synthetic-profile-11');assert.equal(write[2].age,31);
 assert(!Object.hasOwn(write[2],'activeFitAdaptTargets'));assert(!Object.hasOwn(write[2],'currentRecommendation'));
 const invalid=setup(route,{...f.goalState,ageInput:''});assert.equal(action(invalid.r,'Save changes').disabled,true);
});
test('advanced settings edit the shared goal draft and reset without saving the profile',()=>{
 const {r,draw,state}=setup(pages+'goal-advanced.tsx',{draft:{...f.goal,manualTDEEOverride:2600}});
 input(r,'Maintenance · kcal').onChangeText('2550');assert.equal(state('draft').manualTDEEOverride,2550);draw();action(r,'Reset advanced settings').onPress();
 assert.equal(state('draft').manualTDEEOverride,null);assert.equal(r.writes.length,0);
});
test('FitAdapt confirmation saves before review, deduplicates taps and preserves insufficient-data continuation',async()=>{
 const {r,state}=setup('app/fitadapt-setup.tsx',{...f.setupState,step:'confirm'});
 const submit=action(r,'Save and request review').onPress;submit();submit();await settle();await settle();
 assert.equal(r.writes.filter((x:any)=>x[0]==='profile').length,1);assert.equal(r.writes.filter((x:any)=>x[0]==='evaluate').length,1);
 assert(r.writes.findIndex((x:any)=>x[0]==='profile')<r.writes.findIndex((x:any)=>x[0]==='evaluate'));
 assert.equal(state('saved'),true);assert.equal(state('step'),'result');assert.match(state('notice'),/goals are saved/);
});
test('existing accepted and pending setup states offer Profile only; failed review retains saved data',async()=>{
 for(const plan of [{currentRecommendation:{id:'accepted'}},{pending:{id:'pending'}}]){
  const {r}=setup('app/fitadapt-setup.tsx',{...f.setupState,plan});assert(!r.actions.some((a:any)=>text(a.children).includes('Save and request')));assert.equal(r.writes.length,0);
 }
 const {r,state}=setup('app/fitadapt-setup.tsx',{...f.setupState,step:'confirm'},{reviewError:'Synthetic service unavailable'});
 action(r,'Save and request review').onPress();await settle();await settle();assert.equal(state('saved'),true);assert.equal(state('step'),'result');assert.match(state('notice'),/saved profile is intact/);assert.equal(state('busy'),false);
});
test('measurement picker edits draft only; discard and recalculation retain explicit decisions',async()=>{
 const {r,draw,state}=setup(mods+'body-metrics.tsx',{...f.bodyState,original:{...f.bodyDraft,weightLb:175}});
 action(r,'Update weight').onPress();draw();await action(r,'Increase Current weight').onPress();assert.equal(state('draft').weightLb,177);assert.equal(r.writes.length,0);
 action(r,'Done').onPress();assert.equal(state('sheet'),null);draw();action(r,'Back').onPress();draw();assert.equal(state('discardOpen'),true);action(r,'Keep editing').onPress();assert.equal(state('discardOpen'),false);assert.equal(r.writes.length,0);
 const pending=setup(mods+'body-metrics.tsx',{...f.bodyState,recalcOpen:true,pendingRecalc:{previousWeightKg:82,newWeightKg:80}});action(pending.r,'Keep current goals').onPress();assert.equal(pending.r.writes.length,0);
});
test('photo baseline/view controls are local; cancel and delete remain explicit',async()=>{
 const {r,draw,state}=setup(mods+'progress-photos.tsx',f.photoState);action(r,'Set baseline').onPress();assert.equal(state('baselineId'),f.photos[0].id);assert.equal(r.writes.length,0);
 action(r,'View photo').onPress();draw();action(r,'Delete photo').onPress();assert.equal(r.writes.length,0);await r.alerts.at(-1)[2].find((x:any)=>x.text==='Delete').onPress();assert.equal(r.writes[0][0],'photo-delete');assert.equal(r.writes[0][2].uid,'synthetic-profile-11');
 const cancel=setup(mods+'progress-photos.tsx',{pendingUri:'synthetic:review'});action(cancel.r,'Cancel').onPress();assert.equal(cancel.state('pendingUri'),null);assert.equal(cancel.r.writes.length,0);
});
test('photo missing-image states preserve captions, comparison controls and explicit deletion',()=>{
 const photos=f.photos.map((p:any)=>({...p,imageStatus:'missing'}));
 const {r,draw}=setup(mods+'progress-photos.tsx',{...f.photoState,photos,viewerIndex:0});
 const body=draw().body;
 assert.match(body,/Image unavailable on this device/);assert.match(body,/Your dates and notes have been kept/);
 assert.match(body,/Synthetic private journal note/);assert.match(body,/Synthetic recent journal note/);
 action(r,'Set baseline');action(r,'View photo');action(r,'Delete photo');assert.equal(r.writes.length,0);
});
test('check-in answers persist only on completion with the same account store',async()=>{
 const {r,draw,state}=setup(mods+'weekly-checkin.tsx',{...f.checkState,step:3},{stats:f.stats});
 input(r,'Mood notes · optional').onChangeText('Synthetic reflection');draw();action(r,'Complete check-in').onPress();await settle();await settle();
 const w=r.writes.find((x:any)=>x[0]==='checkin-save');assert.equal(w[1].energy,4);assert.equal(w[1].moodNote,'Synthetic reflection');assert.equal(w[2].uid,'synthetic-profile-11');assert.equal(state('step'),4);
});
test('steps retain missing/zero distinction and account ownership; progress controls keep routes',()=>{
 const found=scenarios.find((s:any)=>s[0]==='P07-steps');const {body}=renderCase(found);assert.match(body,/0 steps recorded/);assert.match(body,/No record/);
 const wrong=setup(pages+'steps-history.tsx',{ownedProfile:{uid:'different-user',value:f.profile}});assert.match(wrong.draw().body,/Loading your steps/);assert.doesNotMatch(wrong.draw().body,/9,400/);
 const insights=setup(pages+'insights-progress.tsx',f.progress);action(insights.r,'Expand weight trend').onPress();assert.equal(insights.state('expanded'),'weight');action(insights.r,'Explore advanced metrics').onPress();assert.equal(insights.r.routes.at(-1),'/profile/advanced-metrics');
});
test('FitAdapt history hides values and keeps declined/superseded events separate without plan writes',()=>{
 const {r,draw}=setup(pages+'fitadapt-insights.tsx',{...f.fitState,section:'decisions'});const body=draw().body;assert.match(body,/Accepted/);assert.match(body,/Declined/);assert.match(body,/Superseded/);assert.match(body,/did not change active targets/);assert.match(body,/Previous accepted/);
 action(r,'Hide values').onPress();assert.doesNotMatch(draw().body,/2,400/);assert.equal(r.writes.length,0);
});
test('history retry and pagination call the read-only service with the authenticated owner',async()=>{
 const {r}=setup(pages+'fitadapt-insights.tsx',{...f.fitState,section:'decisions',cursor:{resolvedAt:1,id:'synthetic-cursor'},historyError:true});
 action(r,'Load older decisions').onPress();await settle();assert.equal(r.subscriptions.at(-1).kind,'history');assert.equal(r.subscriptions.at(-1).args[0],'synthetic-profile-11');assert.equal(r.writes.length,0);
});
