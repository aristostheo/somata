const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp: deleteClientApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, deleteField } = require("firebase/firestore");
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
  const uid = signedIn
    ? (await createUserWithEmailAndPassword(auth, `${name}-${Date.now()}@example.test`, "local-test-password")).user.uid
    : null;
  return { app, auth, db, uid };
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
  await ownerUser.set({ displayName: "Owner", activeFitAdaptTargets: targets });
  await ownerPlan.set({ pending: { id: "proposal-b", status: "pending" },
    currentRecommendation: { proposalId: "proposal-a", targets }, adaptationHistory: [{ action: "activate" }] });
  await ownerHistory.set({ status: "accepted", proposalId: "proposal-a" });

  await t.test("owner can read accepted state, pending status, history, and targets", async () => {
    assert.deepEqual((await getDoc(doc(owner.db, "users", owner.uid))).data().activeFitAdaptTargets, targets);
    const plan = (await getDoc(doc(owner.db, "fitadaptPlans", owner.uid))).data();
    assert.equal(plan.currentRecommendation.proposalId, "proposal-a");
    assert.equal(plan.pending.status, "pending");
    assert.equal(plan.adaptationHistory[0].action, "activate");
    assert.equal((await getDoc(doc(owner.db, "fitadaptPlans", owner.uid, "history", "proposal-a"))).data().status, "accepted");
    assert.equal((await getDocs(collection(owner.db, "fitadaptPlans", owner.uid, "history"))).size, 1);
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
    await denied(setDoc(ownerRef, { displayName: "Replace" }));
    await denied(deleteDoc(ownerRef));
    assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
  });

  await t.test("owner can still create and update unrelated profile fields and permitted user data", async () => {
    const freshRef = doc(fresh.db, "users", fresh.uid);
    await setDoc(freshRef, { displayName: "Fresh" });
    await updateDoc(doc(owner.db, "users", owner.uid), { displayName: "Updated", weightKg: 79.5 });
    await setDoc(doc(owner.db, "users", owner.uid), { stepsGoal: 9000 }, { merge: true });
    await setDoc(doc(owner.db, "users", owner.uid, "fitadaptWeightEntries", "2026-10-05"),
      { date: "2026-10-05", weightKg: 79.5 });
    assert.equal((await ownerUser.get()).data().stepsGoal, 9000);
    assert.deepEqual((await ownerUser.get()).data().activeFitAdaptTargets, targets);
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
