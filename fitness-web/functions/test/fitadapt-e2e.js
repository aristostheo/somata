/** Run against local Auth, Firestore, Functions emulators and local FitAdapt only. */
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const project = "demo-somata-fitadapt";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
  throw new Error("This test requires the local demo project emulators only.");
}
initializeApp({ projectId: project });
const db = getFirestore();

async function user() {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `fitadapt-${crypto.randomUUID()}@example.test`, password: "local-test-password", returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function invoke(name, token, data = {}) {
  const response = await fetch(`http://127.0.0.1:5001/${project}/us-central1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}

async function seed(owner) {
  const ownRef = db.collection("users").doc(owner.localId);
  await ownRef.set({ age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
    goalInputs: { mode: "cut", proteinPriority: "standard" },
    goalResult: { weeklyPaceKg: -0.4, dailyCalories: 2319, protein: 144, carbs: 290, fat: 64 },
    dailyCaloriesTarget: 2319, dailyProteinTarget: 144, carbGoal: 290, fatGoal: 64 });
  const start = new Date(Date.UTC(2026, 7, 25));
  const batch = db.batch();
  for (let index = 0; index < 42; index++) {
    const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    batch.set(ownRef.collection("nutritionEntries").doc(date), { date, calories: 2400 });
    batch.set(ownRef.collection("fitadaptWeightEntries").doc(date), { date, weightKg: 80 - 0.03 * index });
  }
  await batch.commit();
  return ownRef;
}

async function main() {
  const owner = await user();
  const stranger = await user();
  assert.equal((await invoke("getFitAdaptPlan", null)).body.error.status, "UNAUTHENTICATED");
  const ownRef = await seed(owner);
  const evaluation = await invoke("evaluateFitAdapt", owner.idToken);
  assert.equal(evaluation.status, 200, JSON.stringify(evaluation.body));
  assert.equal(evaluation.body.result.kind, "evaluation");
  assert.ok(evaluation.body.result.state.pending);
  const proposalId = evaluation.body.result.state.pending.id;
  assert.equal(evaluation.body.result.state.currentRecommendation, null);
  assert.equal((await invoke("getFitAdaptPlan", stranger.idToken)).body.result.pending, null);
  assert.equal((await invoke("acceptFitAdaptPlan", stranger.idToken, { proposalId })).body.error.details.code, "stale_proposal");
  const accepted = await invoke("acceptFitAdaptPlan", owner.idToken, { proposalId });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.result.pending, null);
  assert.equal(accepted.body.result.currentRecommendation.proposalId, proposalId);
  assert.deepEqual((await ownRef.get()).data().activeFitAdaptTargets,
    accepted.body.result.currentRecommendation.targets);
  assert.equal((await db.collection("fitadaptPlans").doc(owner.localId).collection("history").doc(proposalId).get()).data().status, "accepted");
  const repeated = await invoke("acceptFitAdaptPlan", owner.idToken, { proposalId });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.result.currentRecommendation.proposalId, proposalId);

  const declineUser = await user();
  const declineRef = await seed(declineUser);
  const beforeDecline = (await declineRef.get()).data().dailyCaloriesTarget;
  const declineEval = await invoke("evaluateFitAdapt", declineUser.idToken);
  const declineId = declineEval.body.result.state.pending.id;
  const declined = await invoke("declineFitAdaptPlan", declineUser.idToken, { proposalId: declineId });
  assert.equal(declined.status, 200);
  assert.equal(declined.body.result.currentRecommendation, null);
  assert.equal((await declineRef.get()).data().dailyCaloriesTarget, beforeDecline);
  assert.equal((await invoke("declineFitAdaptPlan", declineUser.idToken, { proposalId: declineId })).status, 200);
  assert.equal((await db.collection("fitadaptPlans").doc(declineUser.localId).collection("history").doc(declineId).get()).data().status, "declined");

  const staleUser = await user();
  const staleRef = await seed(staleUser);
  const staleEval = await invoke("evaluateFitAdapt", staleUser.idToken);
  const staleId = staleEval.body.result.state.pending.id;
  await staleRef.update({ "goalInputs.proteinPriority": "high" });
  const stale = await invoke("acceptFitAdaptPlan", staleUser.idToken, { proposalId: staleId });
  assert.equal(stale.body.error.details.code, "stale_proposal");
  assert.equal((await staleRef.get()).data().activeFitAdaptTargets, undefined);
  await staleRef.update({ sex: "other" });
  const invalidated = await invoke("evaluateFitAdapt", staleUser.idToken);
  assert.equal(invalidated.body.result.kind, "insufficient_data");
  assert.equal(invalidated.body.result.state.pending, null);
  assert.equal((await db.collection("fitadaptPlans").doc(staleUser.localId).collection("history").doc(staleId).get()).data().status, "superseded");

  const incomplete = await user();
  await db.collection("users").doc(incomplete.localId).set({ age: 30 });
  const noInputs = await invoke("evaluateFitAdapt", incomplete.idToken);
  assert.equal(noInputs.body.result.kind, "insufficient_data");
  assert.equal((await invoke("getFitAdaptPlan", incomplete.idToken)).body.result.pending, null);

  const concurrentUser = await user();
  await seed(concurrentUser);
  const [first, second] = await Promise.all([
    invoke("evaluateFitAdapt", concurrentUser.idToken),
    invoke("evaluateFitAdapt", concurrentUser.idToken),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.result.state.pending.id, second.body.result.state.pending.id);
  console.log("Local callable E2E passed: auth isolation, pending review, acceptance, decline, staleness, insufficiency, history, idempotence, concurrent evaluation, target projection.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
