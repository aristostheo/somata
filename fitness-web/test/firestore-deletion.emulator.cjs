const test=require('node:test'),assert=require('node:assert/strict');
if(process.env.GCLOUD_PROJECT!=='demo-somata-fitadapt'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Local synthetic demo Auth and Firestore only');
const {initializeApp,deleteApp}=require('firebase/app');const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword}=require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,deleteDoc,terminate}=require('firebase/firestore');const admin=require('firebase-admin/app');
async function client(){const app=initializeApp({projectId:'demo-somata-fitadapt',apiKey:'synthetic'},crypto.randomUUID());const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const{user}=await createUserWithEmailAndPassword(auth,`delete-rules-${crypto.randomUUID()}@example.test`,'synthetic-password');const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);return{app,db,uid:user.uid};}
const denied=e=>e.code==='permission-denied';
test('server-only deletion fence prevents resurrection without locking unrelated owners',async t=>{
 const owner=await client(),other=await client(),a=admin.initializeApp({projectId:'demo-somata-fitadapt'},crypto.randomUUID()),db=require('firebase-admin/firestore').getFirestore(a);
 try{
  await t.test('clients cannot create, read, modify or remove deletion control state',async()=>{
   for(const c of [owner,other])await assert.rejects(setDoc(doc(c.db,'accountDeletions',owner.uid),{status:'complete'}),denied);
   await db.doc(`accountDeletions/${owner.uid}`).set({status:'deleting'});
   for(const c of [owner,other]){await assert.rejects(getDoc(doc(c.db,'accountDeletions',owner.uid)),denied);await assert.rejects(deleteDoc(doc(c.db,'accountDeletions',owner.uid)),denied);}
  });
  await t.test('frozen caller cannot recreate profile, arbitrary nested logs, quotas, or accepted plans',async()=>{
   for(const parts of [['users',owner.uid],['users',owner.uid,'unknown','a','nested','b'],['profiles',owner.uid],['fitadaptPlans',owner.uid],['fitadaptPlans',owner.uid,'history','new'],['usage_scanDaily',`${owner.uid}_2026-10-14`]])await assert.rejects(setDoc(doc(owner.db,...parts),{uid:owner.uid}),denied);
   await db.doc(`accountDeletions/${owner.uid}`).update({status:'complete'});
   await assert.rejects(setDoc(doc(owner.db,'users',owner.uid),{displayName:'revive'}),denied);
  });
  await t.test('other owner retains ordinary access but cannot recreate references to deleting account',async()=>{
   await setDoc(doc(other.db,'users',other.uid),{displayName:'Other owner'});
   await setDoc(doc(other.db,'users',other.uid,'nutritionEntries','meal'),{name:'Own meal'});
   assert.equal((await getDoc(doc(other.db,'users',other.uid))).data().displayName,'Other owner');
   await assert.rejects(setDoc(doc(other.db,'users',other.uid,'blocks',owner.uid),{targetUid:owner.uid}),denied);
   await assert.rejects(setDoc(doc(other.db,'users',other.uid,'routines','ref'),{fromFriendUid:owner.uid}),denied);
   await assert.rejects(setDoc(doc(other.db,'users',other.uid),{activeFitAdaptTargets:{}},{merge:true}),denied);
  });
 }finally{await Promise.all([owner,other].map(async c=>{await terminate(c.db);await deleteApp(c.app);}));await admin.deleteApp(a);}
});
