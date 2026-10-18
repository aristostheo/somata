/** Full local-only queue path. Run only in a fresh demo emulator session. */
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const project = "demo-somata-fitadapt";
const observeSchedule = process.argv.length === 3 && process.argv[2] === "--observe-schedule";
if ((process.argv.length !== 2 && !observeSchedule) ||
    process.env.GCLOUD_PROJECT !== project ||
    (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== project) ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FUNCTIONS_EMULATOR_HOST !== "127.0.0.1:5001" ||
    process.env.PUBSUB_EMULATOR_HOST !== "127.0.0.1:8085") {
  throw new Error("Local demo Auth, Firestore, Functions, and Pub/Sub emulators are required.");
}

function localValue(file, key) {
  const lines = fs.readFileSync(path.join(__dirname, "..", file), "utf8").split(/\r?\n/);
  const line = lines.find((part) => part.startsWith(`${key}=`));
  if (!line) throw new Error(`Missing ${key} in ignored local test configuration.`);
  let value = line.slice(key.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  return value;
}
const localUrl = localValue(".env.demo-somata-fitadapt", "FITADAPT_SERVICE_URL");
const localToken = localValue(".secret.local", "FITADAPT_BRIDGE_TOKEN");
if (localUrl !== "http://127.0.0.1:8765" || !localToken)
  throw new Error("Only the loopback FitAdapt URL and a temporary local bridge token are allowed.");
process.env.FITADAPT_SERVICE_URL = localUrl;
process.env.FITADAPT_BRIDGE_TOKEN = localToken;
// Load Functions/Admin only after the local-only guards above have passed.
const { initializeApp: initializeClient, deleteApp: deleteClient } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require("firebase/auth");
const { getFirestore: getClientFirestore, connectFirestoreEmulator, doc, setDoc } = require("firebase/firestore");
require("firebase-admin/app").initializeApp({ projectId: project });
const { getFirestore } = require("firebase-admin/firestore");
const { runScheduledFitAdaptReviews, queueAutomaticReview } = require("../lib/fitadapt/automatic");

const db = getFirestore();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const target = { calories: 2319, protein: 144, carbs: 290, fat: 64 };

async function waitFor(check, label, maxMs = 60000) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function call(name, token, data = {}) {
  const response = await fetch(`http://127.0.0.1:5001/${project}/us-central1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `${name} returned HTTP ${response.status}: ${body.error?.status ?? "unknown"}`);
  return body.result;
}

async function main() {
  const pubsub = await fetch(`http://127.0.0.1:8085/v1/projects/${project}/topics`);
  assert.equal(pubsub.status, 200, "The local Pub/Sub emulator must be running.");
  const topics = (await pubsub.json()).topics ?? [];
  assert.ok(topics.some((topic) => topic.name ===
    `projects/${project}/topics/firebase-schedule-processFitAdaptAutoReviews`),
  "The scheduled function's local Pub/Sub topic must be registered.");
  assert.equal((await db.collection("fitadaptAutoJobs").limit(1).get()).empty, true,
    "Use a fresh demo emulator session without queued accounts.");
  const app = initializeClient({ apiKey: "demo-key", authDomain: "localhost", projectId: project }, `auto-local-${randomUUID()}`);
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    const clientDb = getClientFirestore(app);
    connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
    const email = `fitadapt-auto-${randomUUID()}@example.test`;
    const password = `Local-${randomBytes(18).toString("base64url")}`;
    const owner = (await createUserWithEmailAndPassword(auth, email, password)).user;
    const uid = owner.uid;
    const user = db.collection("users").doc(uid);
    const job = db.collection("fitadaptAutoJobs").doc(uid);
    await user.set({ age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
      goalInputs: { mode: "cut", proteinPriority: "standard" },
      goalResult: { weeklyPaceKg: -0.4, dailyCalories: target.calories, protein: target.protein,
        carbs: target.carbs, fat: target.fat },
      dailyCaloriesTarget: target.calories, dailyProteinTarget: target.protein,
      carbGoal: target.carbs, fatGoal: target.fat });

    const today = new Date();
    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const start = end - 41 * 86400000;
    const batch = db.batch();
    for (let index = 0; index < 42; index++) {
      const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
      if (index < 41) batch.set(user.collection("nutritionEntries").doc(date), { date, calories: 2400 });
      batch.set(user.collection("fitadaptWeightEntries").doc(date), { date, weightKg: 80 - 0.03 * index });
    }
    await batch.commit();
    await waitFor(async () => (await job.get()).exists, "source-change queue");
    // Wait for the batch's trigger deliveries to settle, then isolate the final client meal write.
    let generation = -1;
    let stableSince = Date.now();
    await waitFor(async () => {
      const next = (await job.get()).data()?.generation ?? 0;
      if (next !== generation) { generation = next; stableSince = Date.now(); }
      return Date.now() - stableSince >= 3000;
    }, "batched source triggers to settle");
    const mealDate = new Date(end).toISOString().slice(0, 10);
    await setDoc(doc(clientDb, "users", uid, "nutritionEntries", mealDate),
      { date: mealDate, calories: 2400 });
    await waitFor(async () => (await job.get()).data()?.generation > generation,
      "meal write to enqueue automatic review");
    assert.equal((await db.collection("fitadaptAutoJobs").get()).size, 1,
      "The harness only drains its own synthetic account.");
    assert.equal((await user.get()).data().dailyCaloriesTarget, target.calories);
    assert.equal((await user.get()).data().activeFitAdaptTargets, undefined);

    let jobData = (await job.get()).data();
    assert.ok(jobData.dueAt > Date.now());
    assert.deepEqual(await runScheduledFitAdaptReviews(), []);
    assert.equal((await db.collection("fitadaptPlans").doc(uid).get()).exists, false);

    if (observeSchedule) {
      // The installed CLI registers a Pub/Sub subscription but no cron publisher.
      // A past-due job makes the lack of automatic invocation observable without
      // waiting for this test's two-minute debounce first.
      await job.update({ dueAt: Date.now() - 1000 });
      await pause(6 * 60_000 + 15_000);
      const observedJob = (await job.get()).data();
      assert.ok(observedJob.dueAt <= Date.now(), "The queue job must still be eligible.");
      assert.equal(observedJob.lastCompletedAt, undefined,
        "The emulator unexpectedly invoked the schedule automatically.");
      assert.equal(observedJob.lastErrorCode, undefined,
        "The emulator unexpectedly attempted the scheduled worker.");
      console.log("Observed: no automatic scheduler invocation across a full five-minute interval.");
    }

    let outcomes = [];
    for (let attempt = 0; attempt < 5 && !outcomes.length; attempt++) {
      jobData = (await job.get()).data();
      outcomes = await runScheduledFitAdaptReviews(Math.max(Date.now(), jobData.dueAt + 1));
    }
    assert.deepEqual(outcomes, ["pending"]);
    const plan = (await db.collection("fitadaptPlans").doc(uid).get()).data();
    assert.ok(plan.pending?.id);
    assert.equal(plan.currentRecommendation, null);
    assert.equal((await user.get()).data().dailyCaloriesTarget, target.calories);
    assert.equal((await user.get()).data().activeFitAdaptTargets, undefined);
    const token = await owner.getIdToken();
    const visible = await call("getFitAdaptPlan", token);
    assert.equal(visible.pending.id, plan.pending.id);
    // Firestore delivery is at-least-once: a late delivery from the fixture batch
    // can legitimately leave a job which drains as "unchanged", rather than [].
    // Assert the state invariant and then enqueue a deterministic duplicate.
    const historyBefore = await db.collection("fitadaptPlans").doc(uid).collection("history").get();
    const repeatClock = Date.now() + 60 * 60_000;
    const repeat = await runScheduledFitAdaptReviews(repeatClock);
    assert.ok(repeat.length <= 1 && repeat.every(result => result === "unchanged"),
      `Duplicate work must be absent or unchanged, got ${JSON.stringify(repeat)}`);
    await queueAutomaticReview(db, uid, repeatClock);
    const duplicateDue = (await job.get()).data().dueAt;
    assert.deepEqual(await runScheduledFitAdaptReviews(duplicateDue + 1), ["unchanged"]);
    assert.deepEqual((await db.collection("fitadaptPlans").doc(uid).get()).data(), plan);
    assert.equal((await db.collection("fitadaptPlans").doc(uid).collection("history").get()).size, historyBefore.size);
    assert.equal((await user.get()).data().activeFitAdaptTargets, undefined);
    assert.equal((await user.get()).data().dailyCaloriesTarget, target.calories);
    const accepted = await call("acceptFitAdaptPlan", token, { proposalId: plan.pending.id });
    assert.equal(accepted.pending, null);
    assert.equal(accepted.currentRecommendation.proposalId, plan.pending.id);
    assert.deepEqual((await user.get()).data().activeFitAdaptTargets, accepted.currentRecommendation.targets);
    assert.equal((await user.get()).data().dailyCaloriesTarget, target.calories);
    console.log("Local auto-review E2E passed: client meal → server queue → production queue handler → live local FitAdapt proposal → explicit callable acceptance.");
  } finally {
    await deleteClient(app);
  }
}

main().catch((error) => { console.error("Local auto-review E2E failed:", error.message); process.exitCode = 1; });
