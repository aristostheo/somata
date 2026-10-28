import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require=createRequire(resolve('package.json'));
const {createRuntime}=require('./tools/home-preview-runtime.cjs');
const {scenarios,renderCase,fixtures:f}=require('./tools/render-social-family-preview.cjs');
const text=(c:any):string=>c==null?'':typeof c==='string'?c:Array.isArray(c)?c.map(text).join(' '):text(c.props?.children);
function action(r:any,label:string){const a=r.actions.find((a:any)=>a.accessibilityLabel===label||text(a.children).trim()===label);assert(a,'Action '+label);return a;}
function input(r:any,label:string){const i=r.inputs.find((i:any)=>i.accessibilityLabel===label);assert(i,'Input '+label);return i;}
function setup(route:string,states:any={},options:any={}){
 const flow={validateNativeText:true,states,...options};
 const r=createRuntime({account:{uid:options.signedOut?null:f.u,user:{email:'synthetic@example.invalid',providerData:[{providerId:'password'}],...options.user}},socialFlow:flow});
 const draw=()=>r.render(r.load(route).default);draw();
 return{r,flow,draw,state:(n:string)=>r.flow.state.get(route+':'+n)};
}
const settle=()=>new Promise(done=>setImmediate(done));
const confirm=async(r:any,label:string)=>{const b=r.alerts.at(-1)?.[2]?.find((b:any)=>b.text===label);assert(b,'Confirm '+label);await b.onPress();};

test('all 21 assigned surfaces and their state variants render dark/light with native text constraints at narrow large text',()=>{
 const ids=new Set<string>();
 for(const s of scenarios){ids.add(s[0].split('-')[0]);for(const dark of [true,false]){const {runtime}=renderCase(s,{dark,width:320,fontScale:1.8});assert.equal(runtime.writes.length,0,s[0]);assert.equal(runtime.flow.providerCalls.length,0);}}
 assert.equal(ids.size,21);
});
test('Friends search, requests and UID invitation retain the authenticated caller and explicit actions',async()=>{
 const {r,draw,state}=setup('app/friends.tsx',f.friends);
 input(r,'Find a friend').onChangeText('not a match');assert.doesNotMatch(draw().body,/Jordan · synthetic/);
 action(r,'Requests · 1').onPress();draw();await action(r,'Accept request').onPress();
 assert.equal(r.writes.find((w:any)=>w[0]==='respond')[1],f.u);assert.equal(r.writes.find((w:any)=>w[0]==='respond')[3],true);
 const add=setup('app/friends.tsx',{...f.friends,addOpen:true,target:'synthetic-friend',displayName:'Buddy'});
 await action(add.r,'Send request').onPress();assert.equal(add.r.writes.find((w:any)=>w[0]==='request')[1],f.u);assert.equal(add.state('addOpen'),false);
 const invalid=setup('app/friends.tsx',{addOpen:true,target:'x'});assert.equal(action(invalid.r,'Send request').disabled,true);
});
test('relationship removal, blocking and reporting remain behind native confirmations',async()=>{
 const a=setup('app/friends.tsx',{...f.friends,selected:f.selected,detailOpen:true},{summary:f.summary});
 await action(a.r,'Remove friend').onPress();assert.equal(a.r.writes.length,0);await confirm(a.r,'Remove');assert.deepEqual(a.r.writes[0],['remove-friend',f.u,f.friend]);
 const b=setup('app/friends.tsx',{...f.friends,selected:f.selected,detailOpen:true},{summary:f.summary});
 await action(b.r,'Block').onPress();assert.equal(b.r.writes.length,0);await confirm(b.r,'Block');assert.equal(b.r.writes[0][0],'block');assert.equal(b.r.writes[1][0],'remove-friend');
 const c=setup('app/friends.tsx',{...f.friends,selected:f.selected,detailOpen:true},{summary:f.summary});
 await action(c.r,'Report').onPress();assert.equal(c.r.writes.length,0);await confirm(c.r,'Spam');assert.deepEqual(c.r.writes[0],['report',f.u,f.friend,'spam']);
});
test('nickname failure retains draft and ping requires a choice',async()=>{
 const a=setup('app/friends.tsx',{selected:f.selected,nicknameEditorOpen:true,nicknameValue:'My buddy'},{failSave:true});
 await action(a.r,'Save nickname').onPress();assert.equal(a.state('nicknameEditorOpen'),true);assert.equal(a.state('nicknameValue'),'My buddy');assert.match(a.r.alerts.at(-1)[0],/save nickname/);
 const b=setup('app/friends.tsx',{pendingPing:f.selected,pingPickerOpen:true});assert.equal(action(b.r,'Send').disabled,true);
 action(b.r,'Keep it up!').onPress();b.draw();await action(b.r,'Send').onPress();assert.equal(b.r.writes[0][0],'ping');assert.equal(b.r.writes[0][1],f.u);
});
test('redacted summaries distinguish zero, missing, private and unavailable; nonfriend sees no fitness summary',()=>{
 const a=setup('app/friends/[id].tsx',{}, {summary:f.summary,params:{id:f.friend}});const body=a.draw().body;
 assert.match(body,/Fat 0 g/);assert.match(body,/Carbs Not recorded/);assert.match(body,/Synthetic meal/);
 const b=setup('app/friends/[id]/progress.tsx',{}, {summary:f.summary,params:{id:f.friend}});assert.match(b.draw().body,/Private/);assert.match(b.draw().body,/Not available from recorded data/);
 const c=setup('app/friends/[id].tsx',{}, {summaryError:'Not accepted friends',params:{id:f.friend}});assert.doesNotMatch(c.draw().body,/Synthetic meal/);
 assert(c.r.subscriptions.every((s:any)=>s.kind==='summary'));
});
test('sharing consent is explicit, UID checked, and owner preview cannot change per-friend consent',async()=>{
 const a=setup('app/friends/preview.tsx',{}, {summary:f.summary});assert(!a.r.actions.some((a:any)=>text(a.children).includes('Allow my selected fields')));
 const b=setup('app/friends.tsx',{selected:f.selected,detailOpen:true},{summary:f.summary});
 action(b.r,'Allow my selected fields for this friend').onPress();assert.equal(b.r.writes.length,0);await confirm(b.r,'Allow sharing');assert.deepEqual(b.r.writes[0],['consent',f.friend,true]);
 const c=setup('app/friends.tsx',{selected:f.selected,detailOpen:true},{summary:f.summary});action(c.r,'Allow my selected fields for this friend').onPress();c.flow.accountInactive=true;await confirm(c.r,'Allow sharing');assert.equal(c.r.writes.length,0);
});
test('shared template save refetches consent/data before copying to the owner',async()=>{
 const a=setup('app/friends/[id]/workouts.tsx',{}, {summary:f.summary,params:{id:f.friend}});
 action(a.r,'Save as template').onPress();assert.equal(a.r.writes.length,0);await confirm(a.r,'Save');assert.equal(a.r.writes[0][0],'refetch-summary');assert.equal(a.r.writes[1][0],'template-save');assert.equal(a.r.writes[1][1],f.u);
 const b=setup('app/friends/[id]/workouts.tsx',{}, {summary:f.summary,freshSummary:{...f.summary,days:[]},params:{id:f.friend}});
 action(b.r,'Save as template').onPress();await confirm(b.r,'Save');assert(!b.r.writes.some((w:any)=>w[0]==='template-save'));assert.match(b.draw().body,/no longer available/);
});
test('visibility switches preserve immediate owner saves and sensitive trend confirmation',async()=>{
 const a=setup('app/profile/friend-visibility.tsx',{profile:f.profile});await input(a.r,'Share activity with friends').onValueChange(false);
 assert.equal(a.r.writes[0][1],f.u);assert.equal(a.r.writes[0][2].friendVisibility.enabled,false);
 const b=setup('app/profile/friend-visibility.tsx',{profile:f.profile});await input(b.r,'Weight / body metrics').onValueChange(true);assert.equal(b.r.writes.length,0);await confirm(b.r,'Share');assert.equal(b.r.writes[0][2].friendVisibility.progress.weightTrend,true);
 const c=setup('app/profile/friend-visibility.tsx',{});assert.equal(input(c.r,'Share activity with friends').disabled,true);
});
test('badge feature changes use the existing account-scoped store and locked criteria stay truthful',async()=>{
 const a=setup('app/(modals)/badges.tsx',{...f.badges,selectedId:'streak_1'});await action(a.r,'Remove from featured').onPress();assert.equal(a.r.writes[0][0],'featured');assert.equal(a.r.writes[0][2].uid,f.u);
 const b=setup('app/(modals)/badges.tsx',{...f.badges,selectedId:'streak_3'});assert.match(b.draw().body,/Log on 3 consecutive days/);assert.match(b.draw().body,/Locked/);
});
test('reminder time remains draft until Save, cancel is write-free, and ordinary switches save immediately',async()=>{
 const route='app/(modals)/settings.tsx';const timeDraft={key:'breakfast',value:new Date('2026-10-19T09:15:00')};
 const a=setup(route,{...f.settings,timeDraft});action(a.r,'Cancel').onPress();assert.equal(a.r.writes.length,0);assert.equal(a.state('timeDraft'),null);
 const b=setup(route,{...f.settings,timeDraft});action(b.r,'Save time').onPress();await settle();assert.equal(b.r.writes[0][0],'notification-settings');assert.equal(b.r.writes[0][1].mealReminders.breakfast.hour,9);assert.equal(b.r.writes[0][2].uid,f.u);
 const c=setup(route,f.settings);await input(c.r,'Friend pings').onValueChange(false);assert.equal(c.r.writes[0][1].friendPings,false);
});
test('connections preserve scoped sync, preferences and history; unsupported providers stay disabled',async()=>{
 const a=setup('app/profile/integrations.tsx',{snapshot:f.snapshot});assert.equal(input(a.r,'Connect Google Fit').disabled,true);await action(a.r,'Sync now').onPress();assert.equal(a.r.writes[0][1],f.u);assert.equal(a.r.writes[0][3].uid,f.u);action(a.r,'Sync history').onPress();assert.equal(a.r.routes.at(-1),'/profile/sync-history');
 const b=setup('app/profile/integrations.tsx',{snapshot:f.snapshot,section:'sync'});await input(b.r,'Automatic sync').onValueChange(false);assert.equal(b.r.writes[0][1].autoSync,false);
});
test('Account email actions preserve provider availability and sign-out confirmation',async()=>{
 const a=setup('app/account/index.tsx',{profile:f.profile,verified:false});await action(a.r,'Send verification link').onPress();assert.equal(a.r.writes[0][0],'verify-email');assert.equal(a.r.writes[0][1].uid,f.u);
 action(a.r,'Sign out of this device').onPress();assert(!a.r.writes.some((w:any)=>w[0]==='signout'));await confirm(a.r,'Sign out');assert(a.r.writes.some((w:any)=>w[0]==='signout'));
 const b=setup('app/account/index.tsx',{verified:true},{user:{providerData:[{providerId:'apple.com'}]}});assert(!b.r.actions.some((a:any)=>a.accessibilityLabel==='Reset password'));
});
test('missing legal URLs never open a browser and checkout stays disabled',()=>{
 const a=setup('app/account/legal.tsx');assert.match(a.draw().body,/Privacy policy unavailable/);assert.match(a.draw().body,/Support unavailable/);assert.equal(a.r.writes.length,0);
 const b=setup('app/paywall.tsx');assert.match(b.draw().body,/Purchases are unavailable/);assert(!b.r.actions.some((a:any)=>a.accessibilityLabel==='View checkout'));
});
test('deletion keeps reauthentication, exact confirmation, native final dialog and UID-switch protection',async()=>{
 const route='app/account/delete.tsx';const a=setup(route);assert.equal(action(a.r,'Delete my account / resume cleanup').disabled,true);
 input(a.r,'Current password').onChangeText('synthetic-password');a.draw();await action(a.r,'Verify password').onPress();await settle();assert.equal(a.state('verifiedUid'),f.u);assert.equal(a.state('password'),'');
 input(a.r,'Type DELETE').onChangeText('DELETE');a.draw();action(a.r,'Delete my account / resume cleanup').onPress();assert(!a.r.writes.some((w:any)=>w[0]==='delete-server'));a.flow.accountInactive=true;await confirm(a.r,'Delete my account');assert(!a.r.writes.some((w:any)=>w[0]==='delete-server'));
});
test('synthetic deletion runs server cleanup before local/signout; partial failure retains retry',async()=>{
 const route='app/account/delete.tsx',states={verifiedUid:f.u,confirmation:'DELETE'};
 const a=setup(route,states);action(a.r,'Delete my account / resume cleanup').onPress();await confirm(a.r,'Delete my account');assert.deepEqual(a.r.writes.map((w:any)=>w[0]),['delete-server','delete-local','signout']);assert.equal(a.r.routes.at(-1),'/(auth)/login');
 const b=setup(route,states,{fail:'delete-server'});action(b.r,'Delete my account / resume cleanup').onPress();await confirm(b.r,'Delete my account');assert.equal(b.r.writes.length,1);assert.equal(b.state('confirmation'),'DELETE');assert.match(b.draw().body,/Deletion has not completed/);
 const c=setup(route,states,{fail:'delete-local'});action(c.r,'Delete my account / resume cleanup').onPress();await confirm(c.r,'Delete my account');assert.equal(c.state('deletedUid'),f.u);assert.match(c.draw().body,/Device cleanup needs a retry/);c.flow.fail=null;await action(c.r,'Retry device cleanup and sign out').onPress();await settle();assert.equal(c.r.writes.at(-1)[0],'signout');
});
