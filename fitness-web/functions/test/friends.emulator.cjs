const test = require('node:test');
const assert = require('node:assert/strict');
if (process.env.GCLOUD_PROJECT !== 'demo-somata-fitadapt' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FUNCTIONS_EMULATOR_HOST !== '127.0.0.1:5001')
  throw new Error('Explicit local demo Auth, Firestore and Functions emulators required.');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, terminate } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const admin = require('firebase-admin/app');
const app = admin.initializeApp({ projectId: 'demo-somata-fitadapt' }, crypto.randomUUID());
const db = require('firebase-admin/firestore').getFirestore(app);
const { FieldValue } = require('firebase-admin/firestore');
async function client() {
  const app = initializeApp({ projectId: 'demo-somata-fitadapt', apiKey: 'synthetic-key' }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `friend-summary-${crypto.randomUUID()}@example.test`, 'synthetic-test-password');
  const firestore = getFirestore(app); connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  const f = getFunctions(app, 'us-central1'); connectFunctionsEmulator(f, '127.0.0.1', 5001);
  return { app, user, firestore, summary: httpsCallable(f, 'getFriendSummary'), share: httpsCallable(f, 'setFriendSummarySharing') };
}
const denied = e => e.code.endsWith('permission-denied');
const iso = ms => new Date(ms).toISOString().slice(0,10);
const today = iso(Date.now()), yesterday = iso(Date.now()-86400000);
const visibility = { enabled:true, nutrition:{mealsLoggedToday:true,dailyCaloriesTotal:true,macroBreakdown:true,streakStatus:true},
  workouts:{workoutsLogged:true,workoutDetails:true,weeklyVolume:true,personalRecords:true},
  progress:{consistencyStreak:true,badgeCollection:true,weightTrend:true,weeklyReportCard:true},activity:{stepCount:true,cardioSessions:true} };
test('authenticated redacted friend summary with real emulators and unchanged raw-record denial', async t => {
  const owner = await client(), friend = await client(), stranger = await client();
  const root = db.doc(`users/${owner.user.uid}`), peer = friend.user.uid;
  const edge = db.doc(`users/${owner.user.uid}/friends/${peer}`), reverse = db.doc(`users/${peer}/friends/${owner.user.uid}`);
  const grant = db.doc(`friendSummaryGrants/${owner.user.uid}/viewers/${peer}`);
  const query = { friendUid: owner.user.uid, endDate: today };
  const get = async (c=friend) => (await c.summary(query)).data;
  const approval = () => owner.share({ friendUid: peer, enabled: true });
  const pair = async () => { const batch=db.batch(); batch.set(edge,{friendUid:peer,status:'accepted',direction:'outgoing',respondedAt:FieldValue.serverTimestamp()});
    batch.set(reverse,{friendUid:owner.user.uid,status:'accepted',direction:'incoming',respondedAt:FieldValue.serverTimestamp()}); await batch.commit(); };
  const saved = { friendVisibility: visibility, email:'private-account-sentinel', weightKg:87, targetWeightKg:70,
    activeFitAdaptTargets:{ calories:2100 }, steps:{[today]:0}, privateExtra:'private-account-sentinel' };
  await root.set(saved); await pair();
  await root.collection('nutritionEntries').doc('meal').set({date:today,name:'Synthetic toast',calories:0,protein:8,carbs:20,fat:0,notes:'private-notes-sentinel',items:[{name:'private-ingredients-sentinel'}],qty:999,unit:'private-unit-sentinel'});
  await root.collection('workouts').doc('workout').set({date:today,sessionId:'private-session-id',sessionTitle:'Synthetic training',exercise:'Squat',sets:3,reps:5,weight:0,notes:'private-notes-sentinel',privateExtra:'private-workout-sentinel'});
  await root.collection('fitadaptWeightEntries').doc('a').set({date:yesterday,weightKg:90});
  await root.collection('fitadaptWeightEntries').doc('b').set({date:today,weightKg:89});
  await root.collection('badges').doc('badge').set({earnedAt:Date.now(),meta:'private-badge-sentinel'});
  const plan = db.doc(`fitadaptPlans/${owner.user.uid}`); await plan.set({currentRecommendation:{privatePlan:'private-plan-sentinel'},pending:{privateProposal:'private-proposal-sentinel'}});
  try {
    await t.test('missing/invalid auth, non-friend and spoofed caller denied', async () => {
      const url='http://127.0.0.1:5001/demo-somata-fitadapt/us-central1/getFriendSummary';
      for (const Authorization of ['', 'Bearer invalid']) assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization},body:JSON.stringify({data:query})})).status,401);
      await assert.rejects(get(stranger),denied);
      await assert.rejects(stranger.share({friendUid:owner.user.uid,enabled:true}),denied);
      await assert.rejects(owner.summary({...query,uid:peer}),e=>e.code.endsWith('invalid-argument'));
    });
    await t.test('legacy accepted edges alone cannot expose data; owner preview uses identical redaction', async () => {
      assert.equal((await get()).status,'private');
      assert.equal((await get()).days.length,0);
      assert.equal((await get(owner)).status,'shared');
      await approval();
      const summary=await get(); assert.equal(summary.status,'shared');
      assert.deepEqual(summary.days,(await get(owner)).days);
      assert.equal(summary.sharingWithFriend,false); // recipient has not authorized reciprocal access
    });
    await t.test('exact allowlist, zeros/missing, dated direction and no false PR or plan-derived targets',async()=>{
      const s=await get(); const day=s.days[0];
      assert.deepEqual(Object.keys(s).sort(),['version','status','window','sharingWithFriend','days','progress'].sort());
      assert.deepEqual(day.meals.data,[{name:'Synthetic toast',calories:0}]);
      assert.deepEqual(day.workouts.data,[{title:'Synthetic training',exercises:[{exercise:'Squat',sets:3,reps:5,weightKg:0}]}]);
      assert.equal(day.calories.data,0);assert.equal(day.steps.data,0);assert.equal(s.days[1].steps.data,null);assert.equal(s.days[1].calories.data,null);
      assert.equal(s.progress.weightTrend.data,'down');assert.equal(s.progress.badgeCount.data,1);
      assert.equal(s.progress.personalRecords.status,'unavailable'); assert.equal(s.progress.cardio.status,'unavailable');
      assert.ok(!JSON.stringify(s).includes('private-')); assert.ok(!JSON.stringify(s).includes('weightKg":89'));
      assert.equal(s.days.length,10);
    });
    await t.test('independent flags: dates do not expose workout details, meals do not expose macros or goals',async()=>{
      await root.update({friendVisibility:{enabled:true,nutrition:{mealsLoggedToday:true},workouts:{workoutsLogged:true}}});
      const s=await get(); assert.equal(s.days[0].meals.status,'shared');assert.equal(s.days[0].macros.status,'private');
      assert.equal(s.days[0].calories.status,'private');assert.equal(s.days[0].workoutCount.data,1);assert.equal(s.days[0].workouts.status,'private');
      assert.equal(s.progress.weightTrend.status,'private');assert.equal(s.days[0].steps.status,'private');
    });
    await t.test('disabled or absent privacy choices never inherit sharing defaults',async()=>{
      for (const v of [{}, {enabled:false,nutrition:{mealsLoggedToday:true}}]) {await root.update({friendVisibility:v});assert.equal((await get()).status,'private');}
      await root.update({friendVisibility:{enabled:true}});const s=await get();assert.ok(s.days.every(d=>d.meals.status==='private'));
      await root.update({friendVisibility:visibility});
    });
    await t.test('owner revocation immediate; forged grant and private/FitAdapt raw reads remain denied',async()=>{
      await owner.share({friendUid:peer,enabled:false});assert.equal((await get()).status,'private');await approval();
      for(const c of [owner,friend,stranger]){
        await assert.rejects(setDoc(doc(c.firestore,grant.path),{enabled:true}),denied);
        await assert.rejects(getDoc(doc(c.firestore,grant.path)),denied);
      }
      for(const path of [root.path,root.path+'/nutritionEntries/meal',root.path+'/workouts/workout',root.path+'/fitadaptWeightEntries/b',plan.path])
        await assert.rejects(getDoc(doc(friend.firestore,path)),denied);
      await assert.rejects(setDoc(doc(owner.firestore,root.path),{activeFitAdaptTargets:{calories:1}},{merge:true}),denied);
      await assert.rejects(setDoc(doc(owner.firestore,plan.path),{pending:{}}),denied);
      await setDoc(doc(owner.firestore,root.path),{displayName:'Synthetic owner edit'},{merge:true});
    });
    await t.test('both blocks, pending edges and removal deny reads; new relationship needs new approval',async()=>{
      for(const [a,b] of [[owner.user.uid,peer],[peer,owner.user.uid]]){
        const block=db.doc(`users/${a}/blocks/${b}`);await block.set({blocked:true});await assert.rejects(get(),denied);await block.delete();
      }
      await reverse.update({status:'pending'});await assert.rejects(get(),denied);await reverse.update({status:'accepted'});
      await edge.delete();await assert.rejects(get(),denied);await pair();assert.equal((await get()).status,'private');await approval();
      await edge.update({friendDisplayName:'changed nickname'});assert.equal((await get()).status,'shared');
    });
    await t.test('incomplete/oversized record windows are unavailable rather than partial or fabricated totals',async()=>{
      await root.collection('nutritionEntries').doc('incomplete').set({date:today,name:'Synthetic incomplete'});
      assert.equal((await get()).days[0].calories.data,null);
      for(let start=0;start<500;start+=250){const b=db.batch();for(let i=start;i<start+250;i++)b.set(root.collection('nutritionEntries').doc(`limit-${i}`),{date:today,name:'Synthetic bound',calories:1});await b.commit();}
      const s=await get();assert.equal(s.days[0].meals.status,'unavailable');assert.equal(s.days[0].calories.status,'unavailable');
      assert.equal(s.progress.consistencyStreak.status,'unavailable');
    });
    await t.test('read/consent path leaves profile, targets and plans unchanged except explicit owner profile edit',async()=>{
      assert.deepEqual((await root.get()).data(),{...saved,displayName:'Synthetic owner edit'});
      assert.deepEqual((await plan.get()).data(),{currentRecommendation:{privatePlan:'private-plan-sentinel'},pending:{privateProposal:'private-proposal-sentinel'}});
    });
  } finally {
    await Promise.all([owner,friend,stranger].map(async c=>{await terminate(c.firestore);await deleteApp(c.app);}));await admin.deleteApp(app);
  }
});
