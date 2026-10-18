const assert = require('node:assert/strict');
const test = require('node:test');
if (process.env.GCLOUD_PROJECT !== 'demo-somata-fitadapt' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FUNCTIONS_EMULATOR_HOST !== '127.0.0.1:5001')
  throw new Error('Only the explicit local demo emulators are allowed');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, terminate } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const adminApp = require('firebase-admin/app').initializeApp({ projectId: 'demo-somata-fitadapt' });
const db = require('firebase-admin/firestore').getFirestore();
const base = 'http://127.0.0.1:5001/demo-somata-fitadapt/us-central1/generateSomataAI';
async function client() {
  const app = initializeApp({ projectId: 'demo-somata-fitadapt', apiKey: 'demo-key' }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await createUserWithEmailAndPassword(auth, `synthetic-${crypto.randomUUID()}@example.test`, 'local-only-test-password');
  const firestore = getFirestore(app); connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'us-central1'); connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { app, auth, firestore, call: httpsCallable(functions, 'generateSomataAI'), uid: auth.currentUser.uid };
}
const code = expected => error => error.details?.code === expected;
test('real authenticated callable protocol with mocked provider: ownership, validation, response/error handling and no meal/plan writes', async t => {
  const owner = await client(); const other = await client();
  try {
    const saved = { displayName: 'Synthetic', dailyCaloriesTarget: 2200, activeFitAdaptTargets: { calories: 2300, protein: 150, carbs: 260, fat: 70 } };
    await db.collection('users').doc(owner.uid).set(saved);
    const token = await owner.auth.currentUser.getIdToken();
    const raw = (body, headers = {}) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body) });
    await t.test('missing/invalid auth and client UID are rejected; clients cannot read or edit quota state', async () => {
      for (const authorization of ['', 'Bearer invalid-synthetic']) assert.equal((await raw({ data: { operation: 'meal', text: 'toast' } }, { Authorization: authorization })).status, 401);
      await assert.rejects(owner.call({ operation: 'meal', text: 'toast', uid: other.uid }), code('invalid_input'));
      const quota = doc(owner.firestore, 'aiUsageLimits', owner.uid);
      await assert.rejects(setDoc(quota, { dayCount: 0 }), e => e.code === 'permission-denied');
      await assert.rejects(getDoc(quota), e => e.code === 'permission-denied');
      await assert.rejects(getDoc(doc(other.firestore, 'aiUsageLimits', owner.uid)), e => e.code === 'permission-denied');
    });
    await t.test('content type, malformed envelopes, media and size fail before provider/quota use', async () => {
      assert.equal((await raw({ data: {} }, { 'Content-Type': 'text/plain' })).status, 400);
      assert.equal((await raw({ secretImageMarker: 'synthetic-content-not-for-logs' })).status, 400);
      await assert.rejects(owner.call({ operation: 'photo', text: 'meal', imageDataUrl: 'https://remote.invalid/image.png' }), code('unsupported_media'));
      await assert.rejects(owner.call({ operation: 'photo', text: 'meal', imageDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(2 * 1024 * 1024) }), code('too_large'));
      assert.equal((await db.collection('aiUsageLimits').doc(owner.uid).get()).exists, false);
    });
    await t.test('all existing operations produce validated mock results through the exported HTTP endpoint', async () => {
      for (const operation of ['meal', 'mealFoods', 'foodMacros', 'photo', 'workout', 'mealIdeas', 'macroCompletion']) {
        await db.collection('aiUsageLimits').doc(owner.uid).delete(); // Synthetic test reset only.
        const result = await owner.call({ operation, text: 'synthetic test', ...(operation === 'photo' ? { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' } : {}) });
        assert.ok(result.data);
        if (operation === 'meal') assert.equal(result.data.fat, 0);
      }
      assert.deepEqual((await db.collection('users').doc(owner.uid).get()).data(), saved);
      assert.equal((await db.collection('users').doc(owner.uid).collection('nutritionEntries').get()).empty, true);
      assert.equal((await db.collection('fitadaptPlans').doc(owner.uid).get()).exists, false);
      assert.equal((await db.collection('aiUsageLimits').doc(other.uid).get()).exists, false);
    });
    await t.test('429, service error, timeout and malformed output are safe; quota counts one attempt each', async () => {
      for (const [text, expected] of [['test:429','rate_limited'], ['test:500','unavailable'], ['test:timeout','timeout'], ['test:malformed','invalid_response']]) {
        await db.collection('aiUsageLimits').doc(owner.uid).delete();
        await assert.rejects(owner.call({ operation: 'meal', text }), code(expected));
        assert.equal((await db.collection('aiUsageLimits').doc(owner.uid).get()).data().dayCount, 1);
      }
    });
    await t.test('concurrent cost limits use verified UID and cannot be bypassed through another account field', async () => {
      await db.collection('aiUsageLimits').doc(owner.uid).delete();
      const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => owner.call({ operation: 'meal', text: 'synthetic toast' })));
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 5);
      const denied = outcomes.find(result => result.status === 'rejected'); assert.equal(denied.reason.details.code, 'rate_limited');
      assert.equal((await db.collection('aiUsageLimits').doc(owner.uid).get()).data().dayCount, 5);
      await other.call({ operation: 'meal', text: 'synthetic toast' });
      assert.equal((await db.collection('aiUsageLimits').doc(other.uid).get()).data().dayCount, 1);
    });
  } finally {
    await Promise.all([terminate(owner.firestore), terminate(other.firestore)]);
    await Promise.all([deleteApp(owner.app), deleteApp(other.app), require('firebase-admin/app').deleteApp(adminApp)]);
  }
});
