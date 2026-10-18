const test = require('node:test'), assert = require('node:assert/strict');
const { deleteAccount, requireRecentAuth, auditStorageBucket } = require('../lib/account/deletion');
const now=Date.now(), fresh={uid:'synthetic-owner',token:{auth_time:Math.floor(now/1000),firebase:{sign_in_provider:'password'}}};
test('deletion auth, ownership and explicit confirmation are validated before data access',async()=>{
  const deps={db:{doc(){throw Error('Must not access records');}}};
  await assert.rejects(deleteAccount(deps,undefined,{confirmation:'DELETE_MY_ACCOUNT'}),e=>e.code==='unauthenticated');
  for(const body of [null,{},[],{confirmation:true},{confirmation:'DELETE'},{confirmation:'DELETE_MY_ACCOUNT',uid:'another-user'}])
    await assert.rejects(deleteAccount(deps,fresh,body),e=>e.code==='invalid-argument');
  for(const auth_time of [undefined,0,Math.floor(now/1000)-301,Math.floor(now/1000)+120,NaN])
    assert.throws(()=>requireRecentAuth({...fresh,token:{auth_time}},now),e=>e.details.code==='reauthentication_required');
  assert.throws(()=>requireRecentAuth({...fresh,token:{...fresh.token,firebase:{sign_in_provider:'anonymous'}}},now));
  assert.doesNotThrow(()=>requireRecentAuth(fresh,now));
});
test('Storage audit preserves known shared assets and rejects unowned/unknown objects instead of guessing paths',async()=>{
  const file=(name,metadata={})=>({name,getMetadata:async()=>[{metadata}]});
  await auditStorageBucket({getFiles:async()=>[[file('public/exercises.seed.json'),file('exercises/squat/demo.gif')],null]});
  for(const f of [file('uploads/unknown.jpg'),file('exercises/squat/demo.gif',{ownerUid:'someone'})])
    await assert.rejects(auditStorageBucket({getFiles:async()=>[[f],null]}),e=>e.details.code==='storage_review_required');
});
test('retention holds name only the category, never freeze an active account, and never delete ambiguous records',async()=>{
  for(const [collection,field,reason] of [['aiMealIdeas',null,'legacy_ai_cache'],['aiExerciseEstimates',null,'legacy_ai_cache'],['reports','reporterUid','safety_report'],['reports','targetUid','safety_report']]){
    let reads=0;
    const db={doc:path=>{assert.equal(path,`accountDeletions/${fresh.uid}`);return{get:async()=>({data:()=>undefined})};},
      collection:name=>{
        let filter=null;
        const query={where:(key,op,uid)=>{assert.equal(op,'==');assert.equal(uid,fresh.uid);filter=key;return query;},limit:n=>{assert.equal(n,1);return query;},get:async()=>{reads++;return{empty:!(name===collection&&filter===field)};}};
        return query;
      },runTransaction:()=>assert.fail('Do not freeze before the retention hold is resolved')};
    const deps={db,now:()=>now,getUser:async uid=>assert.equal(uid,fresh.uid),deleteUser:async()=>assert.fail('No deletion'),auditStorage:async()=>assert.fail('Retention holds precede Storage')};
    await assert.rejects(deleteAccount(deps,fresh,{confirmation:'DELETE_MY_ACCOUNT'}),e=>e.code==='failed-precondition'&&e.details.code==='retention_review_required'&&e.details.reason===reason&&Object.keys(e.details).length===2);
    assert.ok(reads>0);
  }
});
