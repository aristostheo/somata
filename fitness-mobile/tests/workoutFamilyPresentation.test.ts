import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));
const {createRuntime}=require('./tools/home-preview-runtime.cjs');
const {fixtures:f,scenarios,renderCase}=require('./tools/render-workout-family-preview.cjs');
const work='app/workouts/',mods='app/(modals)/';
function setup(route:string,states:any={},options:any={},props:any={}){
 const flow={validateNativeText:true,params:{sessionKey:'session:'+f.draft.id},states,...options};
 const r=createRuntime({account:{uid:options.signedOut?null:'synthetic-workout-10'},workoutFlow:flow});
 const draw=()=>r.render(r.load(route).default,props);draw();
 return{r,flow,draw,state:(n:string)=>r.flow.state.get(route+':'+n)};
}
const text=(c:any):string=>c==null?'':typeof c==='string'?c:Array.isArray(c)?c.map(text).join(' '):text(c.props?.children);
const action=(r:any,label:string)=>{const a=r.actions.find((a:any)=>a.accessibilityLabel===label||text(a.children).trim()===label);assert(a,'Action: '+label);return a;};
const input=(r:any,label:string)=>{const i=r.inputs.find((i:any)=>i.accessibilityLabel===label);assert(i,'Input: '+label);return i;};
const settle=()=>new Promise(done=>setImmediate(done));

test('all workout surfaces render real JSX with native raw-text constraints in both modes',()=>{
 for(const s of scenarios)for(const dark of [true,false]){
  const {runtime}=renderCase(s,{dark,width:320,fontScale:1.8});assert.equal(runtime.writes.length,0,s[0]);assert.equal(runtime.flow.providerCalls.length,0);
 }
});

test('active session keeps explicit completion, set edit values, units and UID draft writes',async()=>{
 const {r,draw,state}=setup(work+'session.tsx',{draft:f.draft,profile:{weightUnit:'lb'}});
 assert.equal(state('draft').items[0].done,false);action(r,'Mark complete').onPress();assert.equal(state('draft').items[0].done,true);draw();
 action(r,'Edit set 2').onPress();draw();
 input(r,'Weight · lb').onChangeText('44.0924524');input(r,'Reps').onChangeText('0');draw();
 // The editor and add-set form have the same labels; target the editor last.
 const reps=r.inputs.filter((i:any)=>i.accessibilityLabel==='Reps').at(-1);
 const weight=r.inputs.filter((i:any)=>i.accessibilityLabel==='Weight · lb').at(-1);
 reps.onChangeText('0');weight.onChangeText('44.0924524');draw();action(r,'Save set').onPress();
 const changed=state('draft').items.find((i:any)=>i.id===state('edit').itemId);assert.equal(changed.reps,0);assert(Math.abs(changed.weightKg-20)<0.01);
 for(const timer of r.flow.timers)await timer.fn();
 const writes=r.writes.filter((w:any)=>w[0]==='storage');assert(writes.length);assert(writes.every((w:any)=>w[1]==='workout:draft:synthetic-workout-10'));
 assert.equal(r.writes.filter((w:any)=>w[0]==='workout-add').length,0);
});

test('session rename cancellation and set removal retain explicit confirmation',()=>{
 const {r,draw,state}=setup(work+'session.tsx',{draft:f.draft});
 action(r,'Rename workout').onPress();draw();input(r,'Title').onChangeText('Changed draft');draw();action(r,'Cancel').onPress();assert.equal(state('draft').title,f.draft.title);
 draw();action(r,'Remove set').onPress();assert.equal(state('draft').items.length,2);
 r.alerts.at(-1)[2].find((x:any)=>x.text==='Remove').onPress();assert.equal(state('draft').items.length,1);
});

test('finish requires confirmation; write failure retains draft and clears busy state',async()=>{
 const {r,state}=setup(work+'session.tsx',{draft:f.draft},{failSave:true});
 await action(r,'Finish workout').onPress();assert.equal(r.writes.length,0);
 await r.alerts.at(-1)[2].find((x:any)=>x.text==='Finish').onPress();
 assert.equal(state('isFinishing'),false);assert.equal(state('draft').id,f.draft.id);assert(!r.routes.includes('BACK'));
 assert.equal(r.writes.find((w:any)=>w[0]==='workout-add')[1],'synthetic-workout-10');
});

test('browser favorites and exercise selection use the account store and return to the session',async()=>{
 const {r,draw,state}=setup(mods+'browse.tsx',{items:[f.exercise],preview:f.exercise,previewOpen:true});
 await action(r,'Favorite '+f.exercise.name).onPress();assert(r.writes.some((w:any)=>w[0]==='favorite'&&w[2]==='synthetic-workout-10'));
 await action(r,'Use exercise').onPress();const w=r.writes.find((w:any)=>w[0]==='local');assert.equal(w[1],'session:browsePick');assert.equal(w[3],'synthetic-workout-10');assert(r.routes.includes('BACK'));
 draw();input(r,'Search the library').onChangeText('missing');draw();assert.equal(state('query'),'missing');assert.equal(r.listProps.data.length,0);
});

test('template creation preserves order, optional load, owner and failed-save draft',async()=>{
 const route=mods+'create-template.tsx';const {r,draw,state,flow}=setup(route,{name:'Synthetic routine',items:[...f.template.items,{exercise:'Squat',sets:3,reps:8}],addOpen:true,exName:'Row',weightKg:''},{failSave:true});
 action(r,'Add to routine').onPress();assert.equal(state('items').at(-1).weightKg,undefined);draw();
 action(r,'Move later').onPress();assert.equal(state('items')[0].exercise,'Squat');draw();
 await action(r,'Save template').onPress();assert.equal(state('name'),'Synthetic routine');assert.equal(r.routes.length,0);assert.equal(r.alerts.at(-1)[0],'Could not save template');
 flow.failSave=false;draw();await action(r,'Save template').onPress();assert(r.routes.includes('BACK'));assert.equal(r.writes.at(-1)[1],'synthetic-workout-10');assert.equal(r.writes.at(-1)[3].items.length,3);
});

test('history dates reject reversed ranges and recap keeps the selected session key',()=>{
 const {r,draw,state}=setup(work+'history.tsx',{loading:false,workouts:f.rows});
 action(r,'Open workout recap').onPress();assert.equal(r.routes[0].params.sessionKey,'session:'+f.draft.id);
 action(r,'Custom dates').onPress();draw();input(r,'From').onChangeText('2026-10-20');input(r,'To').onChangeText('2026-10-01');draw();action(r,'Apply dates').onPress();assert(state('err'));assert.equal(state('customOpen'),true);
});

test('record details repeat owner-scoped seeds and require confirmation before deleting',async()=>{
 const {r}=setup(work+'session-detail.tsx',{rows:f.rows,profile:{weightUnit:'lb'}});
 await action(r,'Repeat workout').onPress();assert.equal(r.writes[0][1],'workout:referenceSeed:synthetic-workout-10');
 action(r,'Delete workout').onPress();assert(!r.writes.some((w:any)=>w[0]==='workout-delete'));
 const confirm=r.alerts.at(-1)[2].find((x:any)=>x.style==='destructive');await confirm.onPress();assert.equal(r.writes.filter((w:any)=>w[0]==='workout-delete').length,2);
 assert(r.writes.filter((w:any)=>w[0]==='workout-delete').every((w:any)=>w[1]==='synthetic-workout-10'));
});

test('manual activity keeps missing values separate from zero and edit deletion explicit',()=>{
 const created:any[]=[],deleted:any[]=[];const props={visible:true,onClose(){},onCreate:(e:any)=>created.push(e),onUpdate:(e:any)=>created.push(e),onDelete:(id:string)=>deleted.push(id)};
 const {r}=setup('components/activity/ActivityLogSheet.tsx',{tab:'log',calories:'0',steps:''},{},props);
 action(r,'Log activity').onPress();assert.equal(created[0].calories,0);assert.equal(created[0].steps,undefined);
 const edited=setup('components/activity/ActivityLogSheet.tsx',{tab:'log'},{},{...props,editing:f.activity});action(edited.r,'Delete activity').onPress();assert.equal(deleted.length,0);edited.r.alerts.at(-1)[2].find((x:any)=>x.text==='Delete').onPress();assert.deepEqual(deleted,[f.activity.id]);
});

test('quick workout preserves selected units, per-set notes and owner save',async()=>{
 const {r}=setup(mods+'quick-workout.tsx',{profile:{weightUnit:'lb'},exercises:[{id:'q',name:'Row',note:'Synthetic',sets:[{reps:10,weight:44.0924524},{reps:8,weight:44.0924524}]}]});
 await action(r,'Save workout · 1').onPress();const w=r.writes.find((w:any)=>w[0]==='workout-add');assert.equal(w[1],'synthetic-workout-10');assert(Math.abs(w[2].weight-20)<0.01);assert.equal(w[2].sets,2);assert(w[2].notes.includes('Sets:'));assert(r.routes.includes('BACK'));
});

test('Coach Spark handles mocked success, 429 and malformed results without logging workouts',async()=>{
 for(const options of [{providerResult:{...f.generated,difficulty:'Moderate'}},{providerError:'AI usage is temporarily limited.'},{providerResult:{bad:true}}]){
  const {r,state}=setup(mods+'coach-spark.tsx',{},options);await action(r,'Generate workout').onPress();assert.equal(r.flow.providerCalls.length,1);assert.equal(state('loading'),false);assert(!r.writes.some((w:any)=>w[0]==='workout-add'));
  if('providerError'in options||'bad'in(options.providerResult||{})){assert(state('error'));assert.equal(state('generated'),null);}else{assert.equal(state('generated').name,f.generated.name);assert(r.writes.some((w:any)=>w[0]==='local'));}
 }
});

test('Coach swap stays in review; start uses zero-load UID seed and template save retains guard',async()=>{
 const {r,draw,state}=setup(mods+'coach-spark.tsx',{generated:f.generated,swapExercise:f.generated.exercises[0]});
 action(r,'Push-up').onPress();assert.equal(state('generated').exercises[0].name,'Push-up');assert.equal(r.writes.length,0);draw();
 await action(r,'Start this workout').onPress();const seed=JSON.parse(r.writes[0][2]);assert.equal(seed.exercises[0].weightKg,0);assert.equal(seed.exercises[0].reps,8);assert.equal(r.writes[0][1],'workout:templateSeed:synthetic-workout-10');
 const busy=setup(mods+'coach-spark.tsx',{generated:f.generated,savingTemplate:true});assert.equal(action(busy.r,'Saving…').disabled,true);await action(busy.r,'Saving…').onPress();assert.equal(busy.r.writes.length,0);
});
