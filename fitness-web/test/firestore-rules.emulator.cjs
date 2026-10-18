const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp: deleteClientApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, deleteField, runTransaction, query, orderBy, limit, startAfter } = require("firebase/firestore");
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");

const projectId = "demo-somata-fitadapt";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
  throw new Error("Run only with the local demo Auth and Firestore emulators.");
}

async function client(name, signedIn = true) {
  const app = initializeApp({ apiKey: "demo-key", authDomain: "localhost", projectId }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const email = `${name}-${Date.now()}@example.test`;
  const password = "local-test-password";
  const uid = signedIn
    ? (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    : null;
  return { app, auth, db, uid, email, password };
}

async function denied(operation) {
  await assert.rejects(operation, (error) => error?.code === "permission-denied");
}

test("FitAdapt Firestore rules protect plans and targets without blocking ordinary profile writes", async (t) => {
  const adminApp = initializeAdminApp({ projectId }, `rules-${Date.now()}`);
  const admin = getAdminFirestore(adminApp);
  const owner = await client("rules-owner");
  const other = await client("rules-other");
  const fresh = await client("rules-fresh");
  const anonymous = await client("rules-anonymous", false);
  t.after(async () => {
    await Promise.all([owner, other, fresh, anonymous].map(async ({ auth, app }) => {
      try { await signOut(auth); } catch { /* anonymous auth has no session */ }
      await deleteClientApp(app);
    }));
    await deleteAdminApp(adminApp);
  });

  const targets = { calories: 2300, protein: 145, carbs: 285, fat: 65 };
  const ownerUser = admin.collection("users").doc(owner.uid);
  const ownerPlan = admin.collection("fitadaptPlans").doc(owner.uid);
  const ownerHistory = ownerPlan.collection("history").doc("proposal-a");
  const ownerAutoJob = admin.collection("fitadaptAutoJobs").doc(owner.uid);
  const ownerLegacy = admin.collection("profiles").doc(owner.uid);
  await ownerUser.set({ displayName: "Owner", activeFitAdaptTargets: targets });
  await ownerPlan.set({ pending: { id: "proposal-b", status: "pending" },
    currentRecommendation: { proposalId: "proposal-a", targets }, adaptationHistory: [{ action: "activate" }] });
  await ownerHistory.set({ status: "accepted", proposalId: "proposal-a" });
  await ownerAutoJob.set({ dueAt: Date.now(), generation: 1 });
  await ownerLegacy.set({ calorieGoal: 2100, proteinGoal: 120, email: "synthetic@example.test" });

  await t.test("legacy web profile is owner-readable but cannot be listed or changed by clients", async () => {
    assert.equal((await getDoc(doc(owner.db, "profiles", owner.uid))).data().calorieGoal, 2100);
    await denied(getDoc(doc(other.db, "profiles", owner.uid)));
    await denied(getDoc(doc(anonymous.db, "profiles", owner.uid)));
    await denied(getDocs(collection(owner.db, "profiles")));
    await denied(setDoc(doc(owner.db, "profiles", owner.uid), { calorieGoal: 1 }, { merge: true }));
    await denied(updateDoc(doc(owner.db, "profiles", owner.uid), { calorieGoal: 1 }));
    await denied(deleteDoc(doc(owner.db, "profiles", owner.uid)));
    await denied(setDoc(doc(other.db, "profiles", owner.uid), { calorieGoal: 1 }));
    assert.equal((await ownerLegacy.get()).data().calorieGoal, 2100);
  });

  await t.test("automatic review bookkeeping is server-owned and private", async () => {
    await denied(getDoc(doc(owner.db, "fitadaptAutoJobs", owner.uid)));
    await denied(getDoc(doc(other.db, "fitadaptAutoJobs", owner.uid)));
    await denied(setDoc(doc(owner.db, "fitadaptAutoJobs", owner.uid), { dueAt: 1 }, { merge: true }));
    await denied(deleteDoc(doc(owner.db, "fitadaptAutoJobs", owner.uid)));
    await denied(setDoc(doc(fresh.db, "fitadaptAutoJobs", fresh.uid), { dueAt: 1 }));
    await ownerAutoJob.update({ dueAt: Date.now() + 1000 });
    assert.ok((await ownerAutoJob.get()).data().dueAt);
  });

  await t.test("owner can read accepted state, pending status, history, and targets", async () => {
    assert.deepEqual((await getDoc(doc(owner.db, "users", owner.uid))).data().activeFitAdaptTargets, targets);
    const plan = (await getDoc(doc(owner.db, "fitadaptPlans", owner.uid))).data();
    assert.equal(plan.currentRecommendation.proposalId, "proposal-a");
    assert.equal(plan.pending.status, "pending");
    assert.equal(plan.adaptationHistory[0].action, "activate");
    assert.equal((await getDoc(doc(owner.db, "fitadaptPlans", owner.uid, "history", "proposal-a"))).data().status, "accepted");
    assert.equal((await getDocs(collection(owner.db, "fitadaptPlans", owner.uid, "history"))).size, 1);
  });

  await t.test("owner can page resolved history in order; another UID cannot list it", async () => {
    await ownerHistory.set({ resolvedAt: 1000 }, { merge: true });
    await ownerPlan.collection("history").doc("proposal-newer").set({ status: "declined", resolvedAt: 3000,
      targets: { ...targets, calories: 1950 } });
    await ownerPlan.collection("history").doc("proposal-middle").set({ status: "superseded", resolvedAt: 2000,
      targets: { ...targets, calories: 2050 } });
    const history = collection(owner.db, "fitadaptPlans", owner.uid, "history");
    const first = await getDocs(query(history, orderBy("resolvedAt", "desc"), limit(2)));
    assert.deepEqual(first.docs.map((item) => item.id), ["proposal-newer", "proposal-middle"]);
    const second = await getDocs(query(history, orderBy("resolvedAt", "desc"), startAfter(first.docs[1]), limit(2)));
    assert.deepEqual(second.docs.map((item) => item.id), ["proposal-a"]);
    await denied(getDocs(query(collection(other.db, "fitadaptPlans", owner.uid, "history"),
      orderBy("resolvedAt", "desc"), limit(2))));
    assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
  });

  await t.test("other and anonymous clients cannot read or write another user's state", async () => {
    await denied(getDoc(doc(other.db, "users", owner.uid)));
    await denied(getDoc(doc(other.db, "fitadaptPlans", owner.uid)));
    await denied(getDoc(doc(other.db, "fitadaptPlans", owner.uid, "history", "proposal-a")));
    await denied(getDocs(collection(other.db, "fitadaptPlans", owner.uid, "history")));
    await denied(getDoc(doc(anonymous.db, "fitadaptPlans", owner.uid)));
    await denied(updateDoc(doc(other.db, "users", owner.uid), { activeFitAdaptTargets: { ...targets, calories: 1 } }));
    await denied(setDoc(doc(other.db, "fitadaptPlans", owner.uid), { pending: null }, { merge: true }));
    await denied(setDoc(doc(other.db, "fitadaptPlans", owner.uid, "history", "proposal-a"), { status: "declined" }, { merge: true }));
  });

  await t.test("client writes to plan, proposal, adaptation history, and nested history are denied", async () => {
    const planRef = doc(owner.db, "fitadaptPlans", owner.uid);
    const historyRef = doc(owner.db, "fitadaptPlans", owner.uid, "history", "proposal-a");
    await denied(setDoc(doc(fresh.db, "fitadaptPlans", fresh.uid), { pending: { id: "injected" } }));
    await denied(updateDoc(planRef, { pending: null }));
    await denied(updateDoc(planRef, { currentRecommendation: { proposalId: "injected" } }));
    await denied(updateDoc(planRef, { adaptationHistory: [] }));
    await denied(setDoc(planRef, { pending: null }, { merge: true }));
    await denied(setDoc(planRef, { pending: null }));
    await denied(deleteDoc(planRef));
    await denied(setDoc(doc(owner.db, "fitadaptPlans", owner.uid, "history", "new"), { status: "accepted" }));
    await denied(updateDoc(historyRef, { status: "declined" }));
    await denied(setDoc(historyRef, { status: "declined" }, { merge: true }));
    await denied(deleteDoc(historyRef));
  });

  await t.test("protected target cannot be created, changed, removed, merged, or deleted by client", async () => {
    const ownerRef = doc(owner.db, "users", owner.uid);
    await denied(setDoc(doc(fresh.db, "users", fresh.uid), { displayName: "Fresh", activeFitAdaptTargets: targets }));
    await denied(updateDoc(ownerRef, { activeFitAdaptTargets: { ...targets, calories: 1 } }));
    await denied(updateDoc(ownerRef, { "activeFitAdaptTargets.protein": 1 }));
    await denied(setDoc(ownerRef, { activeFitAdaptTargets: { ...targets, calories: 1 } }, { merge: true }));
    await denied(updateDoc(ownerRef, { activeFitAdaptTargets: deleteField() }));
    for (const field of ["pending", "currentRecommendation", "adaptationHistory"]) {
      await denied(updateDoc(ownerRef, { [field]: { forged: true } }));
      await denied(setDoc(doc(fresh.db, "users", fresh.uid), { [field]: { forged: true } }));
    }
    await denied(setDoc(ownerRef, { displayName: "Replace" }));
    await denied(deleteDoc(ownerRef));
    assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
  });

  await t.test("owner can still create and update unrelated profile fields and permitted user data", async () => {
    const freshRef = doc(fresh.db, "users", fresh.uid);
    await setDoc(freshRef, { displayName: "Fresh" });
    await updateDoc(doc(owner.db, "users", owner.uid), { displayName: "Updated", weightKg: 79.5 });
    await setDoc(doc(owner.db, "users", owner.uid), { stepsGoal: 9000,
      dailyCaloriesTarget: 2050, proteinGoal: 125, carbGoal: 235, fatGoal: 60 }, { merge: true });
    await setDoc(doc(owner.db, "users", owner.uid, "fitadaptWeightEntries", "2026-10-05"),
      { date: "2026-10-05", weightKg: 79.5 });
    assert.equal((await ownerUser.get()).data().stepsGoal, 9000);
    assert.equal((await ownerUser.get()).data().dailyCaloriesTarget, 2050);
    assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
  });

  await t.test("same UID sees the canonical fallback on a second client and can import only its old values", async () => {
    const second = await client("rules-same-uid", false);
    try {
      const session = await signInWithEmailAndPassword(second.auth, owner.email, owner.password);
      assert.equal(session.user.uid, owner.uid);
      const firstData = (await getDoc(doc(owner.db, "users", owner.uid))).data();
      const secondData = (await getDoc(doc(second.db, "users", owner.uid))).data();
      assert.equal(secondData.dailyCaloriesTarget, firstData.dailyCaloriesTarget);
      assert.equal(secondData.proteinGoal, firstData.proteinGoal);
      assert.equal(secondData.carbGoal, firstData.carbGoal);

      const legacyDoc = doc(second.db, "profiles", owner.uid);
      const sharedDoc = doc(second.db, "users", owner.uid);
      const importOnce = () => runTransaction(second.db, async (tx) => {
        const old = await tx.get(legacyDoc);
        const current = await tx.get(sharedDoc);
        assert.equal(old.data().calorieGoal, 2100);
        assert.deepEqual(current.data().activeFitAdaptTargets, targets);
        if (current.data().calorieGoal === old.data().calorieGoal) return false;
        tx.set(sharedDoc, { calorieGoal: old.data().calorieGoal,
          dailyCaloriesTarget: old.data().calorieGoal,
          proteinGoal: old.data().proteinGoal,
          dailyProteinTarget: old.data().proteinGoal }, { merge: true });
        return true;
      });
      assert.equal(await importOnce(), true);
      assert.equal(await importOnce(), false);
      assert.equal((await getDoc(doc(owner.db, "users", owner.uid))).data().dailyCaloriesTarget, 2100);
      assert.equal((await ownerLegacy.get()).data().calorieGoal, 2100);
      assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
    } finally {
      await signOut(second.auth);
      await deleteClientApp(second.app);
    }
  });

  await t.test("trusted Admin writes still update targets, plans, and history", async () => {
    const next = { ...targets, calories: 2250 };
    const batch = admin.batch();
    batch.update(ownerUser, { activeFitAdaptTargets: next });
    batch.set(ownerPlan, { pending: null, currentRecommendation: { proposalId: "proposal-c", targets: next },
      adaptationHistory: [{ action: "activate" }, { action: "activate" }] }, { merge: true });
    batch.set(ownerPlan.collection("history").doc("proposal-c"), { status: "accepted" });
    await batch.commit();
    assert.deepEqual((await getDoc(doc(owner.db, "users", owner.uid))).data().activeFitAdaptTargets, next);
    assert.equal((await getDoc(doc(owner.db, "fitadaptPlans", owner.uid))).data().currentRecommendation.proposalId, "proposal-c");
    assert.equal((await getDoc(doc(owner.db, "fitadaptPlans", owner.uid, "history", "proposal-c"))).data().status, "accepted");
  });
});
