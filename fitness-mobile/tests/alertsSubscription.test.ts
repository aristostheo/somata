import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Executes the real client service against inert SDK doubles. Never initializes Firebase.
function service() {
  const calls: any[] = [], listeners: any[] = [], docs: any[] = [];
  const firestore = {
    getFirestore: () => 'synthetic-db',
    collection: (_db:any,...path:any[]) => path.join('/'),
    doc: (...path:any[]) => path.join('/'),
    where: (...args:any[]) => ['where',...args], limit: (n:number) => ['limit',n], orderBy: (...args:any[]) => ['orderBy',...args],
    query: (...args:any[]) => args,
    onSnapshot: (query:any,success:any,error:any) => { const l={query,success,error,stopped:false}; listeners.push(l); return () => {l.stopped=true;}; },
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    updateDoc: async (...args:any[]) => calls.push(['update',...args]), deleteDoc: async (...args:any[]) => calls.push(['delete',...args]),
    getDocs: async (query:any) => {calls.push(['get',query]); return { empty:docs.length===0, forEach:(cb:any)=>docs.forEach(cb) };},
    writeBatch: () => ({update:(...args:any[])=>calls.push(['batch-update',...args]),commit:async()=>calls.push(['commit'])}),
  };
  const modules:any = {
    './local/notificationOwnership': {notificationBelongsToAccount:()=>false},
    '@/services/local/accountStore': {accountStorage:()=>{throw Error('No device data in tests');}},
    'expo-constants': {},'expo-device':{},'expo-notifications':{setNotificationHandler:()=>{}},
    'firebase/firestore':firestore,'react-native':{Platform:{OS:'ios'}},'@/lib/firebase':{auth:{currentUser:null},db:'synthetic-db'},
  };
  const exports:any={};
  const code=ts.transpileModule(readFileSync(resolve('services/notifications.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  runInNewContext(code,{exports,require:(name:string)=>{if(!(name in modules))throw Error(`Unexpected dependency ${name}`);return modules[name];},console:{warn:()=>{}}});
  return { api:exports,calls,listeners,docs };
}
const plain=(value:any)=>JSON.parse(JSON.stringify(value));

test('real notification subscription preserves owner path, order/bounds, timestamps and read flags',()=>{
  const {api,listeners}=service();let rows:any;
  const stop=api.subscribeNotifications('synthetic-owner',(value:any)=>{rows=value;},{max:120});
  assert.deepEqual(plain(listeners[0].query),['users/synthetic-owner/notifications',['orderBy','createdAt','desc'],['limit',120]]);
  listeners[0].success({forEach:(cb:any)=>cb({id:'notice',data:()=>({type:'info',title:'Synthetic',readAt:123,createdAtMs:456})})});
  assert.equal(rows[0].id,'notice');assert.equal(rows[0].readAt,123);assert.equal(rows[0].createdAtMs,456);
  stop();assert(listeners[0].stopped);
});

test('fetch failure retains legacy empty callback and signals optional presentation observer',()=>{
  const {api,listeners}=service();let rows:any=['old'];let errors=0;
  api.subscribeNotifications('synthetic-owner',(value:any)=>{rows=value;},{onError:()=>{errors++;}});
  listeners[0].error(new Error('synthetic offline'));assert.equal(rows.length,0);assert.equal(errors,1);
  api.subscribeNotifications('synthetic-other',()=>{});assert.doesNotThrow(()=>listeners[1].error(new Error('synthetic offline')));
  api.subscribeNotifications('',(value:any)=>{rows=value;});assert.equal(rows.length,0);assert.equal(listeners.length,2);
});

test('real read/dismiss/mark-all service writes keep owner paths and unchanged 400-record bound',async()=>{
  const {api,calls,docs}=service();
  await api.markNotificationRead('synthetic-owner','notice');await api.deleteNotification('synthetic-owner','notice');
  docs.push({ref:'users/synthetic-owner/notifications/notice'});await api.markAllNotificationsRead('synthetic-owner');
  assert.deepEqual(plain(calls),[
    ['update','users/synthetic-owner/notifications/notice',{readAt:'SERVER_TIMESTAMP'}],
    ['delete','users/synthetic-owner/notifications/notice'],
    ['get',['users/synthetic-owner/notifications',['where','readAt','==',null],['limit',400]]],
    ['batch-update','users/synthetic-owner/notifications/notice',{readAt:'SERVER_TIMESTAMP'}],['commit'],
  ]);
});
