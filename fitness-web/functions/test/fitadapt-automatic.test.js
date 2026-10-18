const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  sourceChanged, relevantProfile, relevantNutrition, relevantWeight,
  queueAutomaticReview, processAutomaticReview, AUTO_DEBOUNCE_MS, AUTO_MAX_WAIT_MS,
} = require("../lib/fitadapt/automatic");

test("local full-path harness refuses missing emulator guards before loading Firebase", () => {
  const result = spawnSync(process.execPath, [require.resolve("./fitadapt-schedule-local.js")],
    { env: {}, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Local demo Auth, Firestore, Functions, and Pub\/Sub emulators are required/);
});

test("only inputs used by the mapper trigger automatic review", () => {
  const profile = { age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
    goalInputs: { mode: "cut", proteinPriority: "standard" }, goalResult: { weeklyPaceKg: -0.4 },
    steps: { "2026-10-05": 8000 } };
  assert.equal(sourceChanged(profile, { ...profile, displayName: "New name" }, relevantProfile), false);
  assert.equal(sourceChanged(profile, { ...profile, activeFitAdaptTargets: { calories: 2300 } }, relevantProfile), false);
  assert.equal(sourceChanged(profile, { ...profile, weightKg: 79 }, relevantProfile), true);
  assert.equal(sourceChanged(profile, { ...profile, steps: { "2026-10-05": 9000 } }, relevantProfile), true);
  assert.equal(sourceChanged({ date: "2026-10-05", calories: 0 },
    { date: "2026-10-05", calories: null }, relevantNutrition), true);
  assert.equal(sourceChanged({ date: "2026-10-05", calories: 200 },
    { date: "2026-10-05", calories: 200, name: "Changed" }, relevantNutrition), false);
  assert.equal(sourceChanged({ date: "2026-10-05", weightKg: 80 },
    { date: "2026-10-05", weightKg: 79.5 }, relevantWeight), true);
});

if (process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080") {
  test("automatic reviews coalesce, preserve pending and targets, and retry only on changed evidence", async (t) => {
    const app = initializeApp({ projectId: "demo-somata-fitadapt" }, `auto-${Date.now()}`);
    t.after(() => deleteApp(app));
    const db = getFirestore(app);
    const uid = `auto-${crypto.randomUUID()}`;
    const userRef = db.collection("users").doc(uid);
    const jobRef = db.collection("fitadaptAutoJobs").doc(uid);
    const planRef = db.collection("fitadaptPlans").doc(uid);
    const profile = { age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
      goalInputs: { mode: "cut", proteinPriority: "standard" },
      goalResult: { weeklyPaceKg: -0.4 }, activeFitAdaptTargets: { calories: 2400, protein: 150, carbs: 280, fat: 70 } };
    await userRef.set(profile);
    const targets = profile.activeFitAdaptTargets;
    await planRef.set({ currentRecommendation: { proposalId: "accepted-before-auto", targets },
      adaptationHistory: [{ action: "activate", effective_date: "2026-09-01" }], pending: null });
    let calls = 0;
    let behavior = "insufficient_evidence";
    const readInputs = async () => ({ profile: (await userRef.get()).data(), nutrition: [], weights: [] });
    const callEngine = async (request) => {
      calls++;
      assert.equal(request.adaptation_history?.length, 1);
      if (behavior === "timeout") throw new (require("../lib/fitadapt/contract").BridgeError)("timeout", "Local timeout");
      return { policy_version: "test",
        recommendation: { status: behavior === "insufficient_evidence" ? "insufficient_data" : "hold" },
        integration_status: { more_data_needed: behavior === "insufficient_evidence" },
        proposal: behavior === "propose" ? {
        targets: { calories: 2300, protein: 145, carbs: 275, fat: 70 },
        effective_date: "2026-10-07", review_required: true,
      } : null };
    };
    const deps = { readInputs, callEngine };
    const at = Date.now();
    const cappedUid = `${uid}-cap`;
    const cappedJob = db.collection("fitadaptAutoJobs").doc(cappedUid);
    await queueAutomaticReview(db, cappedUid, at);
    await queueAutomaticReview(db, cappedUid, at + 9 * 60_000);
    await queueAutomaticReview(db, cappedUid, at + 20 * 60_000);
    assert.equal((await cappedJob.get()).data().dueAt, at + AUTO_MAX_WAIT_MS);
    await cappedJob.delete();
    await queueAutomaticReview(db, uid, at);
    await queueAutomaticReview(db, uid, at + 500);
    assert.equal((await jobRef.get()).data().dueAt, at + 500 + AUTO_DEBOUNCE_MS);
    assert.equal(await processAutomaticReview(db, uid, at + 600, deps), "not_due");
    assert.equal(await processAutomaticReview(db, uid, at + 500 + AUTO_DEBOUNCE_MS, deps), "no_proposal");
    assert.equal(calls, 1);
    assert.deepEqual((await userRef.get()).data().activeFitAdaptTargets, targets);
    assert.equal((await planRef.get()).data().currentRecommendation.proposalId, "accepted-before-auto");

    // Duplicate delivery and a mapped-equivalent edit do not call the engine twice.
    await queueAutomaticReview(db, uid, at + 200_000);
    assert.equal(await processAutomaticReview(db, uid, at + 200_000 + AUTO_DEBOUNCE_MS, deps), "unchanged");
    assert.equal(calls, 1);

    // A later eligible change can create one pending proposal; bursts coalesce.
    await userRef.update({ "steps.2026-10-05": 8000 });
    behavior = "propose";
    await queueAutomaticReview(db, uid, at + 500_000);
    await queueAutomaticReview(db, uid, at + 500_100);
    assert.equal(await processAutomaticReview(db, uid, at + 500_100 + AUTO_DEBOUNCE_MS, deps), "pending");
    assert.equal(calls, 2);
    const pendingId = (await planRef.get()).data().pending.id;
    assert.deepEqual((await userRef.get()).data().activeFitAdaptTargets, targets);
    assert.equal((await planRef.get()).data().currentRecommendation.proposalId, "accepted-before-auto");
    await userRef.update({ "steps.2026-10-06": 8200 });
    await queueAutomaticReview(db, uid, at + 800_000);
    assert.equal(await processAutomaticReview(db, uid, at + 800_000 + AUTO_DEBOUNCE_MS, deps), "pending_preserved");
    assert.equal((await planRef.get()).data().pending.id, pendingId);
    assert.equal(calls, 2);

    // A stale pending proposal is superseded only through the existing plan service.
    await userRef.update({ "goalInputs.proteinPriority": "high" });
    await queueAutomaticReview(db, uid, at + 1_100_000);
    assert.equal(await processAutomaticReview(db, uid, at + 1_100_000 + AUTO_DEBOUNCE_MS, deps), "pending");
    assert.notEqual((await planRef.get()).data().pending.id, pendingId);
    assert.equal((await planRef.collection("history").doc(pendingId).get()).data().status, "superseded");

    // Failures keep the accepted projection, retry with a bound, and new data resets it.
    await userRef.update({ "goalInputs.proteinPriority": "very_high" });
    behavior = "timeout";
    await queueAutomaticReview(db, uid, at + 1_400_000);
    const due = at + 1_400_000 + AUTO_DEBOUNCE_MS;
    assert.equal(await processAutomaticReview(db, uid, due, deps), "failed");
    assert.equal((await jobRef.get()).data().failureCount, 1);
    assert.deepEqual((await userRef.get()).data().activeFitAdaptTargets, targets);
    assert.equal((await planRef.get()).data().currentRecommendation.proposalId, "accepted-before-auto");
    assert.ok((await planRef.get()).data().pending);
    assert.equal(await processAutomaticReview(db, uid, due + 2 * 60_000, deps), "failed");
    assert.equal(await processAutomaticReview(db, uid, due + 7 * 60_000, deps), "failed");
    assert.equal((await jobRef.get()).data().dueAt, undefined);
    const callsAfterFailures = calls;
    await queueAutomaticReview(db, uid, due + 10 * 60_000);
    assert.equal(await processAutomaticReview(db, uid, due + 12 * 60_000, deps), "unchanged");
    assert.equal(calls, callsAfterFailures);
    await userRef.update({ "steps.2026-10-07": 8400 });
    behavior = "cooldown_hold";
    await queueAutomaticReview(db, uid, due + 30 * 60_000);
    assert.equal(await processAutomaticReview(db, uid, due + 32 * 60_000, deps), "no_proposal");
    assert.equal((await planRef.get()).data().pending, null);
    assert.deepEqual((await userRef.get()).data().activeFitAdaptTargets, targets);

    // Missing required fields are distinguished from recorded zero and do not touch targets.
    await userRef.update({ age: 0 });
    await queueAutomaticReview(db, uid, due + 60 * 60_000);
    assert.equal(await processAutomaticReview(db, uid, due + 62 * 60_000, deps), "insufficient_data");
    assert.deepEqual((await userRef.get()).data().activeFitAdaptTargets, targets);
  });
}
