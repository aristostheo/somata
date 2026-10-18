const test=require('node:test'),assert=require('node:assert/strict');
if(process.env.GCLOUD_PROJECT!=='demo-somata-fitadapt'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FUNCTIONS_EMULATOR_HOST!=='127.0.0.1:5001'||process.env.STORAGE_EMULATOR_HOST!=='http://127.0.0.1:9199')throw Error('Explicit local demo Auth/Firestore/Functions/Storage only');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword}=require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,terminate}=require('firebase/firestore');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
const {getStorage,connectStorageEmulator,ref,uploadBytes,getBytes}=require('firebase/storage');
const admin=require('firebase-admin/app'),{getFirestore:adminDb}=require('firebase-admin/firestore'),{getAuth:adminAuth}=require('firebase-admin/auth');
const a=admin.initializeApp({projectId:'demo-somata-fitadapt',storageBucket:'demo-somata-fitadapt.appspot.com'}),db=adminDb(a),auth=adminAuth(a);
const bucket=require('firebase-admin/storage').getStorage(a).bucket();
const {deleteAccount,auditStorageBucket}=require('../lib/account/deletion');
const {setForActiveAccount}=require('../lib/account/guard');
const {queueAutomaticReview}=require('../lib/fitadapt/automatic');
const {requestPlanEvaluation}=require('../lib/fitadapt/planService');
const {setSharing}=require('../lib/friends/service');
const clients=[];
async function client(){const app=initializeApp({projectId:'demo-somata-fitadapt',apiKey:'synthetic'},crypto.randomUUID());const au=getAuth(app);connectAuthEmulator(au,'http://127.0.0.1:9099',{disableWarnings:true});const{user}=await createUserWithEmailAndPassword(au,`deletion-${crypto.randomUUID()}@example.test`,'synthetic-password');const fs=getFirestore(app);connectFirestoreEmulator(fs,'127.0.0.1',8080);const f=getFunctions(app,'us-central1');connectFunctionsEmulator(f,'127.0.0.1',5001);const c={app,fs,user,call:httpsCallable(f,'deleteSomataAccount',{timeout:30000})};clients.push(c);return c;}
const confirm={confirmation:'DELETE_MY_ACCOUNT'}, denied=e=>e.code.endsWith('permission-denied');
const deps={db,getUser:uid=>auth.getUser(uid),deleteUser:uid=>auth.deleteUser(uid),auditStorage:()=>auditStorageBucket(bucket)};
const identity=uid=>({uid,token:{auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'password'}}});
async function seed(uid,other){
  const paths=[`users/${uid}`,`users/${uid}/nutritionEntries/meal`,`users/${uid}/workouts/workout`,`users/${uid}/fitadaptWeightEntries/day`,`users/${uid}/unknown/a/deep/b`,
  `profiles/${uid}`,`fitadaptPlans/${uid}`,`fitadaptPlans/${uid}/history/proposal`,`fitadaptAutoJobs/${uid}`,`aiUsageLimits/${uid}`,`aiSuggestions/${uid}/days/day`,`aiMacroCompletion/${uid}/days/day`,`aiMealV2/${uid}/days/day`,`overrides_scanUnlimited/${uid}`,`friendSummaryGrants/${uid}/viewers/${other}`];
  for(const p of paths)await db.doc(p).set({synthetic:true});
  await db.doc(`users/${other}/friends/${uid}`).set({friendUid:uid,status:'accepted'});
  await db.doc(`users/${other}/blocks/${uid}`).set({targetUid:uid,blocked:true});
  await db.doc(`users/${other}/notifications/departing-${uid}`).set({data:{fromUid:uid},body:'Synthetic departing friend'});
  await db.doc(`users/${other}/comments/departing-${uid}`).set({createdByUid:uid,text:'Synthetic departing comment'});
  await db.doc(`users/${other}/reactions/departing-${uid}`).set({createdByUid:uid});
  await db.doc(`users/${other}/routines/from-${uid}`).set({fromFriendUid:uid,name:'Keep my routine'});
  await db.doc(`friendSummaryGrants/${other}/viewers/${uid}`).set({enabled:true});
  await db.doc(`foodCatalog/synthetic-${uid}`).set({submitterUid:uid,name:'Keep shared food'});
  await db.doc(`usage_scanDaily/${uid}_2026-10-14`).set({uid});
  await db.doc(`aiQuota/${uid}_2026-10-14_macro_completion`).set({count:1});
  for(const n of ['mealv2','scanmealv1']) await db.doc(`aiRate/${uid}_${n}`).set({ts:1});
  return paths;
}
test('deletion complete cleanup, retries, ownership, callable and rules with synthetic emulators',async t=>{
  const owner=await client(),other=await client(),uid=owner.user.uid,peer=other.user.uid;
  await db.doc(`users/${peer}`).set({private:'other account must remain'});
  await db.doc(`users/${peer}/nutritionEntries/keep`).set({name:'Other meal'});
  await db.doc(`users/${peer}/notifications/keep`).set({data:{fromUid:peer},body:'Other notification'});
  await bucket.file('public/exercises.seed.json').save('synthetic shared catalog');
  try{
    await t.test('HTTP Auth and confirmation/UID spoof fail before deletion',async()=>{
      const url='http://127.0.0.1:5001/demo-somata-fitadapt/us-central1/deleteSomataAccount';
      for(const Authorization of ['', 'Bearer invalid'])assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization},body:JSON.stringify({data:confirm})})).status,401);
      await assert.rejects(owner.call({...confirm,uid:peer}),e=>e.code.endsWith('invalid-argument'));
      await assert.rejects(owner.call({confirmation:'DELETE'}),e=>e.code.endsWith('invalid-argument'));
      assert.ok(await auth.getUser(uid));
    });
    await t.test('Storage rules preserve public assets and reject all unsupported client uploads', async()=>{
      const storage=getStorage(owner.app,'gs://demo-somata-fitadapt.appspot.com');connectStorageEmulator(storage,'127.0.0.1',9199);
      assert.ok((await getBytes(ref(storage,'public/exercises.seed.json'))).byteLength>0);
      for(const path of [`users/${uid}/photo.jpg`, `users/${peer}/photo.jpg`, 'public/exercises.seed.json'])
        await assert.rejects(uploadBytes(ref(storage,path),new Uint8Array([1,2,3])),e=>e.code==='storage/unauthorized');
    });
    await t.test('stale authentication cannot create deletion state',async()=>{
      await assert.rejects(deleteAccount(deps,{uid,token:{auth_time:1}},confirm),e=>e.details.code==='reauthentication_required');
      assert.equal((await db.doc(`accountDeletions/${uid}`).get()).exists,false);
    });
    await t.test('unknown Storage, shared legacy caches and safety records fail before freezing or deleting Auth',async()=>{
      const file=bucket.file('unknown-user-photo.jpg');await file.save('synthetic unknown ownership');
      await assert.rejects(owner.call(confirm),e=>e.details.code==='storage_review_required');await file.delete();
      const cache=db.doc('aiExerciseEstimates/synthetic-unknown-owner');await cache.set({cachePayload:{text:'synthetic'}});
      await assert.rejects(owner.call(confirm),e=>e.details.code==='retention_review_required');await cache.delete();
      const report=db.doc('reports/synthetic');await report.set({targetUid:uid});
      await assert.rejects(owner.call(confirm),e=>e.details.code==='retention_review_required');await report.delete();
      assert.equal((await db.doc(`accountDeletions/${uid}`).get()).exists,false);assert.ok(await auth.getUser(uid));
    });
    const paths=await seed(uid,peer);
    await t.test('partial failure keeps Auth, freezes client/late backend writes and is retryable',async()=>{
      await assert.rejects(deleteAccount({...deps,beforeStep:async step=>{if(step==='root:fitadaptPlans')throw Error('synthetic interruption');}},identity(uid),confirm),e=>e.details.code==='deletion_retry_required');
      assert.ok(await auth.getUser(uid));assert.equal((await db.doc(`users/${uid}`).get()).exists,false);
      await assert.rejects(setDoc(doc(owner.fs,'users',uid),{displayName:'restore'}),denied);
      await assert.rejects(setDoc(doc(other.fs,'users',peer,'friends',uid),{friendUid:uid,status:'pending',direction:'outgoing'}),denied);
      await assert.rejects(setDoc(doc(other.fs,'users',peer,'blocks',uid),{targetUid:uid}),denied);
      await assert.rejects(setDoc(doc(owner.fs,'accountDeletions',uid),{}),denied);
      await assert.rejects(getDoc(doc(owner.fs,'accountDeletions',uid)),denied);
      await assert.rejects(setForActiveAccount(db,uid,db.doc(`aiMealV2/${uid}/days/late`),{synthetic:true}));
      await queueAutomaticReview(db,uid);assert.equal((await db.doc(`fitadaptAutoJobs/${uid}`).get()).data().synthetic,true); // no new queue fields
      await assert.rejects(requestPlanEvaluation(db,{uid},{},{readInputs:async()=>{throw Error('must not read');},callEngine:async()=>{throw Error('must not call');}}));
      await assert.rejects(setSharing(db,uid,{friendUid:peer,enabled:false}));
    });
    await t.test('callable retry removes every audited root/nested record and deletes Auth last',async()=>{
      assert.deepEqual((await owner.call(confirm)).data,{status:'deleted'});
      for(const p of paths) assert.equal((await db.doc(p).get()).exists,false,p);
      for(const p of [`users/${peer}/friends/${uid}`,`users/${peer}/blocks/${uid}`,`users/${peer}/notifications/departing-${uid}`,`users/${peer}/comments/departing-${uid}`,`users/${peer}/reactions/departing-${uid}`,`friendSummaryGrants/${peer}/viewers/${uid}`,`usage_scanDaily/${uid}_2026-10-14`,`aiQuota/${uid}_2026-10-14_macro_completion`,`aiRate/${uid}_mealv2`,`aiRate/${uid}_scanmealv1`])assert.equal((await db.doc(p).get()).exists,false,p);
      await assert.rejects(auth.getUser(uid),e=>e.code==='auth/user-not-found');
      await queueAutomaticReview(db,uid); assert.equal((await db.doc(`fitadaptAutoJobs/${uid}`).get()).exists,false);
      assert.equal((await db.doc(`accountDeletions/${uid}`).get()).data().status,'complete');
      // Old still-valid token may acknowledge a lost completion response; no new deletion runs.
      assert.deepEqual(await deleteAccount(deps,{uid,token:{auth_time:1}},confirm),{status:'deleted'});
    });
    await t.test('other accounts, their copied data, and shared assets survive; attribution only is removed',async()=>{
      assert.deepEqual((await db.doc(`users/${peer}`).get()).data(),{private:'other account must remain'});
      assert.deepEqual((await db.doc(`users/${peer}/nutritionEntries/keep`).get()).data(),{name:'Other meal'});
      assert.equal((await db.doc(`users/${peer}/notifications/keep`).get()).exists,true);
      assert.deepEqual((await db.doc(`users/${peer}/routines/from-${uid}`).get()).data(),{name:'Keep my routine'});
      assert.deepEqual((await db.doc(`foodCatalog/synthetic-${uid}`).get()).data(),{name:'Keep shared food'});
      assert.equal((await bucket.file('public/exercises.seed.json').exists())[0],true);assert.ok(await auth.getUser(peer));
      await setDoc(doc(other.fs,'users',peer),{displayName:'Ordinary edit'},{merge:true});
    });
    await t.test('concurrent requests cannot execute cleanup twice and Auth failure resumes at final step',async()=>{
      const c=await client();await db.doc(`users/${c.user.uid}`).set({synthetic:true});
      let release,started;const ready=new Promise(r=>started=r),hold=new Promise(r=>release=r);
      const run=deleteAccount({...deps,beforeStep:async step=>{if(step==='friends'){started();await hold;}}},identity(c.user.uid),confirm);
      await ready;await assert.rejects(deleteAccount(deps,identity(c.user.uid),confirm),e=>e.details.code==='deletion_in_progress');release();await run;
      const failed=await client();await db.doc(`users/${failed.user.uid}`).set({synthetic:true});
      await assert.rejects(deleteAccount({...deps,deleteUser:async()=>{throw Error('Auth unavailable');}},identity(failed.user.uid),confirm));
      assert.ok(await auth.getUser(failed.user.uid));await deleteAccount(deps,identity(failed.user.uid),confirm);
      await assert.rejects(auth.getUser(failed.user.uid),e=>e.code==='auth/user-not-found');
      const lost=await client();
      await assert.rejects(deleteAccount({...deps,deleteUser:async id=>{await auth.deleteUser(id);throw Error('Lost Auth acknowledgment');}},identity(lost.user.uid),confirm));
      assert.equal((await db.doc(`accountDeletions/${lost.user.uid}`).get()).data().status,'deleting');
      assert.deepEqual(await deleteAccount(deps,{uid:lost.user.uid,token:{auth_time:1}},confirm),{status:'deleted'});

    });
  }finally{await Promise.all(clients.map(async c=>{await terminate(c.fs);await deleteApp(c.app);}));await admin.deleteApp(a);}
});
