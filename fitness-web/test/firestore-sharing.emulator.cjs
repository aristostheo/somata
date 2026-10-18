const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, limit, terminate } = require('firebase/firestore');
const { initializeApp: adminApp, deleteApp: deleteAdmin } = require('firebase-admin/app');
const { getFirestore: adminDb } = require('firebase-admin/firestore');

const projectId = 'demo-somata-fitadapt';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)) {
  throw new Error('Synthetic local demo Auth/Firestore emulators only.');
}
async function client(signedIn = true) {
  const app = initializeApp({ apiKey: 'synthetic-key', projectId }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const uid = signedIn ? (await createUserWithEmailAndPassword(auth,
    `sharing-${crypto.randomUUID()}@example.test`, 'synthetic-local-password')).user.uid : null;
  return { app, db, uid };
}
const edge = (db, a, b) => doc(db, 'users', a, 'friends', b);
const denied = async (promise) => assert.rejects(promise, e => e.code === 'permission-denied');
async function request(sender, recipient) {
  const batch = writeBatch(sender.db);
  batch.set(edge(sender.db, sender.uid, recipient.uid), { friendUid: recipient.uid, status: 'pending',
    direction: 'outgoing', friendEmail: null, friendDisplayName: 'Private nickname', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  batch.set(edge(sender.db, recipient.uid, sender.uid), { friendUid: sender.uid, status: 'pending',
    direction: 'incoming', friendEmail: 'synthetic@example.test', friendDisplayName: 'Synthetic sender', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}
async function respond(actor, sender, recipient, status) {
  const batch = writeBatch(actor.db);
  batch.update(edge(actor.db, sender.uid, recipient.uid), { status, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(edge(actor.db, recipient.uid, sender.uid), { status, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return batch.commit();
}
async function remove(actor, other) {
  const batch = writeBatch(actor.db);
  batch.delete(edge(actor.db, actor.uid, other.uid)); batch.delete(edge(actor.db, other.uid, actor.uid));
  return batch.commit();
}
const notification = (type, data) => ({ type, title: 'Synthetic contact', body: '', data,
  createdAt: serverTimestamp(), createdAtMs: Date.now(), readAt: null });

test('sharing rules fail closed for raw fitness documents and preserve paired friend actions', async t => {
  const owner = await client(), friend = await client(), stranger = await client(), anonymous = await client(false);
  const admin = adminApp({ projectId }, crypto.randomUUID()); const db = adminDb(admin);
  t.after(async () => {
    await Promise.all([owner, friend, stranger, anonymous].map(async c => { await terminate(c.db); await deleteApp(c.app); }));
    await deleteAdmin(admin);
  });
  const ownerRef = db.doc(`users/${owner.uid}`);
  await ownerRef.set({ email: 'private@example.test', weightKg: 80, steps: { '2026-10-14': 4321 },
    activeFitAdaptTargets: { calories: 2200, protein: 150, carbs: 250, fat: 65 },
    friendVisibility: { enabled: true, nutrition: { mealsLoggedToday: true, macroBreakdown: true },
      workouts: { workoutsLogged: true, workoutDetails: true }, progress: { weightTrend: true } } });
  const privatePaths = ['nutritionEntries', 'workouts', 'exerciseEntries', 'fitadaptWeightEntries',
    'activity', 'badges', 'foodEntries', 'meals', 'health', 'settings', 'mealPresets', 'workoutTemplates',
    'comments', 'reactions', 'blocks', 'privateFutureData'];
  for (const path of privatePaths) await ownerRef.collection(path).doc('record').set({
    date: '2026-10-14', name: 'Synthetic private record', calories: 300, weightKg: 80, notes: 'Private notes' });
  await db.doc(`fitadaptPlans/${owner.uid}`).set({ pending: { id: 'pending' }, currentRecommendation: { id: 'accepted' } });
  await db.doc(`fitadaptPlans/${owner.uid}/history/accepted`).set({ status: 'accepted' });

  await t.test('sharing approvals are server-only even for either participant', async () => {
    const path = `friendSummaryGrants/${owner.uid}/viewers/${friend.uid}`;
    await db.doc(path).set({ enabled: true, revision: 'synthetic-server-grant' });
    for (const actor of [owner, friend, stranger, anonymous]) {
      const ref = doc(actor.db, path);
      await denied(getDoc(ref));
      await denied(setDoc(ref, { enabled: true }, { merge: true }));
      await denied(deleteDoc(ref));
    }
  });

  await t.test('owner reads own records and edits normal profile/goals without changing accepted targets', async () => {
    for (const path of privatePaths) {
      assert.ok((await getDoc(doc(owner.db, 'users', owner.uid, path, 'record'))).exists());
      assert.equal((await getDocs(collection(owner.db, 'users', owner.uid, path))).size, 1);
    }
    await updateDoc(doc(owner.db, 'users', owner.uid), { displayName: 'Updated', dailyCaloriesTarget: 2100 });
    assert.equal((await ownerRef.get()).data().activeFitAdaptTargets.calories, 2200);
    const food = doc(owner.db, 'users', owner.uid, 'nutritionEntries', 'new');
    await setDoc(food, { date: '2026-10-14', meal: 'lunch', name: 'Synthetic food', qty: 1, unit: 'g', calories: 0 });
    await updateDoc(food, { calories: 1 }); await deleteDoc(food);
    const workout = doc(owner.db, 'users', owner.uid, 'workouts', 'new');
    await setDoc(workout, { date: '2026-10-14', exercise: 'Squat', sets: 1, reps: 5, weight: 0 });
    await updateDoc(workout, { reps: 6 }); await deleteDoc(workout);
  });

  await t.test('legitimate paired request works, but sender cannot self-accept or edit recipient nickname', async () => {
    await request(owner, friend);
    await request(owner, friend); // retry the same sender's already-persisted request
    await denied(respond(owner, owner, friend, 'accepted'));
    await denied(updateDoc(edge(owner.db, friend.uid, owner.uid), { friendDisplayName: 'Spoof' }));
    await denied(setDoc(edge(stranger.db, owner.uid, stranger.uid), { friendUid: stranger.uid, status: 'accepted', direction: 'incoming' }));
    await denied(setDoc(edge(stranger.db, stranger.uid, owner.uid), { friendUid: owner.uid, status: 'accepted', direction: 'outgoing' }));
    await denied(setDoc(edge(stranger.db, stranger.uid, owner.uid), { friendUid: owner.uid, status: 'pending', direction: 'outgoing' }));
    await denied(updateDoc(edge(friend.db, friend.uid, owner.uid), { status: 'accepted' }));
    await denied(updateDoc(edge(owner.db, owner.uid, friend.uid), { direction: 'incoming' }));
    await respond(friend, owner, friend, 'accepted');
  });

  await t.test('intended connection summary is readable from own edge, not another person’s private mirror', async () => {
    const own = (await getDoc(edge(owner.db, owner.uid, friend.uid))).data();
    assert.equal(own.status, 'accepted'); assert.equal(own.friendUid, friend.uid);
    assert.equal((await getDocs(query(collection(owner.db, 'users', owner.uid, 'friends'), where('status', '==', 'accepted')))).size, 1);
    await denied(getDoc(edge(friend.db, owner.uid, friend.uid)));
    await denied(getDocs(collection(stranger.db, 'users', owner.uid, 'friends')));
    await updateDoc(edge(owner.db, owner.uid, friend.uid), { friendDisplayName: 'Only on my edge', lastPingAt: serverTimestamp() });
  });

  await t.test('accepted friend, stranger and signed-out reader cannot get or query raw private data even with every sharing flag on', async () => {
    for (const reader of [friend, stranger, anonymous]) {
      await denied(getDoc(doc(reader.db, 'users', owner.uid)));
      await denied(getDoc(doc(reader.db, 'fitadaptPlans', owner.uid)));
      await denied(getDocs(collection(reader.db, 'fitadaptPlans', owner.uid, 'history')));
      for (const path of privatePaths) {
        await denied(getDoc(doc(reader.db, 'users', owner.uid, path, 'record')));
        await denied(getDocs(collection(reader.db, 'users', owner.uid, path)));
      }
      await denied(getDocs(query(collection(reader.db, 'users', owner.uid, 'nutritionEntries'), where('date', '==', '2026-10-14'), limit(1))));
      await denied(getDocs(query(collection(reader.db, 'users', owner.uid, 'workouts'), where('date', '>=', '2026-10-01'), limit(10))));
      await denied(getDocs(collection(reader.db, 'users')));
    }
  });

  await t.test('disabled or absent sharing does not open raw records; partial flags cannot grant document reads', async () => {
    for (const friendVisibility of [{ enabled: false }, { enabled: true, nutrition: { mealsLoggedToday: true } }, {}]) {
      await ownerRef.update({ friendVisibility });
      await denied(getDoc(doc(friend.db, 'users', owner.uid, 'nutritionEntries', 'record')));
      await denied(getDoc(doc(friend.db, 'users', owner.uid, 'workouts', 'record')));
      await denied(getDoc(doc(friend.db, 'users', owner.uid)));
    }
  });

  await t.test('cross-account writes are denied on private records, comments/reactions and protected plan state', async () => {
    for (const actor of [friend, stranger]) {
      for (const path of privatePaths) {
        const ref = doc(actor.db, 'users', owner.uid, path, 'record');
        await denied(updateDoc(ref, { notes: 'attack' })); await denied(deleteDoc(ref));
        await denied(setDoc(doc(actor.db, 'users', owner.uid, path, 'forged'), { createdByUid: owner.uid }));
      }
      await denied(updateDoc(doc(actor.db, 'users', owner.uid), { activeFitAdaptTargets: {} }));
      await denied(setDoc(doc(actor.db, 'fitadaptPlans', owner.uid), { pending: {}, currentRecommendation: {}, adaptationHistory: [] }));
      await denied(setDoc(doc(actor.db, 'fitadaptPlans', owner.uid, 'history', 'forged'), { status: 'accepted' }));
    }
    // Recursive owner fallback must not permit fabricated relationship state.
    await denied(setDoc(doc(owner.db, 'users', owner.uid, 'friends', stranger.uid, 'extra', 'state'), { status: 'accepted' }));
  });

  await t.test('only relationship-scoped notifications with the authenticated sender are allowed', async () => {
    const ref = (c, id) => doc(c.db, 'users', owner.uid, 'notifications', id);
    await setDoc(ref(friend, 'accepted'), notification('friend:accepted', { friendUid: friend.uid }));
    await setDoc(ref(friend, 'ping'), notification('ping', { fromUid: friend.uid }));
    await denied(setDoc(ref(stranger, 'spam'), notification('ping', { fromUid: stranger.uid })));
    await denied(setDoc(ref(friend, 'spoof'), notification('ping', { fromUid: stranger.uid })));
    await denied(setDoc(ref(friend, 'arbitrary'), notification('info', { fromUid: friend.uid })));
    await denied(setDoc(ref(friend, 'extra'), notification('ping', { fromUid: friend.uid, privatePayload: 'not allowed' })));
    await denied(getDocs(collection(friend.db, 'users', owner.uid, 'notifications')));
    await denied(updateDoc(ref(friend, 'ping'), { title: 'Changed' }));
    await updateDoc(ref(owner, 'ping'), { readAt: serverTimestamp() });
    await deleteDoc(ref(owner, 'ping'));
  });

  await t.test('pending, declined, removed and blocked relationships confer no fitness access', async () => {
    await remove(owner, friend);
    await request(owner, friend);
    await remove(owner, friend); // outgoing cancellation also removes the pair
    await request(owner, friend);
    await setDoc(doc(owner.db, 'users', friend.uid, 'notifications', 'request'), notification('friend:request', { fromUid: owner.uid, email: null }));
    await denied(setDoc(doc(owner.db, 'users', friend.uid, 'notifications', 'pending-ping'), notification('ping', { fromUid: owner.uid })));
    await respond(friend, owner, friend, 'declined');
    await denied(respond(owner, owner, friend, 'accepted'));
    await denied(getDoc(doc(friend.db, 'users', owner.uid, 'nutritionEntries', 'record')));
    await request(owner, friend); // re-request after a decline remains supported
    await respond(friend, owner, friend, 'accepted');
    await denied(request(owner, friend)); // cannot downgrade an accepted connection
    await setDoc(doc(friend.db, 'users', friend.uid, 'blocks', owner.uid), { blocked: true });
    await denied(setDoc(doc(owner.db, 'users', friend.uid, 'notifications', 'blocked-ping'), notification('ping', { fromUid: owner.uid })));
    await denied(getDoc(doc(owner.db, 'users', friend.uid)));
    await updateDoc(edge(friend.db, friend.uid, owner.uid), { status: 'blocked', updatedAt: serverTimestamp() });
    await denied(request(owner, friend));
    await denied(remove(owner, friend)); // cannot erase the recipient's block edge
  });
});
