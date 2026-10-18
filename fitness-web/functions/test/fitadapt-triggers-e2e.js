/** Synthetic event-routing check for the local demo Firestore + Functions emulators. */
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FUNCTIONS_EMULATOR_HOST !== "127.0.0.1:5001" ||
    process.env.GCLOUD_PROJECT !== "demo-somata-fitadapt") {
  throw new Error("Run only against the local demo Firestore and Functions emulators.");
}
initializeApp({ projectId: "demo-somata-fitadapt" });
const db = getFirestore();
const uid = `auto-trigger-${crypto.randomUUID()}`;
const user = db.collection("users").doc(uid);
const job = db.collection("fitadaptAutoJobs").doc(uid);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForGeneration(expected) {
  for (let i = 0; i < 200; i++) {
    const generation = (await job.get()).data()?.generation ?? 0;
    if (generation >= expected) return generation;
    await pause(100);
  }
  throw new Error(`Timed out waiting for local queue generation ${expected}.`);
}

async function main() {
  await user.set({ age: 30, displayName: "Synthetic" });
  const first = await waitForGeneration(1);
  await user.update({ displayName: "Still synthetic" });
  await user.update({ activeFitAdaptTargets: { calories: 2300 } });
  await db.collection("fitadaptPlans").doc(uid).set({ pending: { status: "pending" },
    currentRecommendation: null, adaptationHistory: [] });
  await pause(1500);
  assert.equal((await job.get()).data().generation, first);
  const day = new Date().toISOString().slice(0, 10);
  await user.collection("nutritionEntries").doc(day).set({ date: day, calories: 0 });
  await waitForGeneration(first + 1);
  await user.collection("fitadaptWeightEntries").doc(day).set({ date: day, weightKg: 80 });
  await waitForGeneration(first + 2);
  await user.update({ "steps.2026-10-05": 8000 });
  await waitForGeneration(first + 3);
  console.log("Local trigger E2E passed: relevant profile, nutrition, weight, and steps enqueue; identity and server-owned target writes do not.");
  await Promise.all([user.collection("nutritionEntries").doc(day).delete(),
    user.collection("fitadaptWeightEntries").doc(day).delete()]);
  await waitForGeneration(first + 5);
  await job.delete();
  await db.collection("fitadaptPlans").doc(uid).delete();
  await user.delete();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
