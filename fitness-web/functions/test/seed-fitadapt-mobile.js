/** Local-only synthetic account for manual Expo Go FitAdapt review testing. */
const { randomUUID, randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const project = "demo-somata-fitadapt";
if (process.argv.length !== 4 || process.argv[2] !== "--project" || process.argv[3] !== project ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== project) ||
    (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== project)) {
  throw new Error("Refusing to seed: pass --project demo-somata-fitadapt with local Auth and Firestore emulator hosts (127.0.0.1:9099 and 127.0.0.1:8080).");
}

initializeApp({ projectId: project });
const db = getFirestore();

async function main() {
  const email = `fitadapt-mobile-${randomUUID()}@example.test`;
  const password = `Local-${randomBytes(18).toString("base64url")}`;
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Local Auth emulator rejected synthetic user creation (HTTP ${response.status}).`);
  const { localId: uid } = await response.json();
  if (typeof uid !== "string" || !uid) throw new Error("Local Auth emulator did not return a UID.");

  // Match the known-good backend E2E seed; use recent UTC dates so the fixture stays useful.
  const ownRef = db.collection("users").doc(uid);
  await ownRef.set({ age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
    goalInputs: { mode: "cut", proteinPriority: "standard" },
    goalResult: { weeklyPaceKg: -0.4, dailyCalories: 2319, protein: 144, carbs: 290, fat: 64 },
    dailyCaloriesTarget: 2319, dailyProteinTarget: 144, carbGoal: 290, fatGoal: 64 });
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = end - 41 * 86400000;
  const batch = db.batch();
  for (let index = 0; index < 42; index++) {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    batch.set(ownRef.collection("nutritionEntries").doc(date), { date, calories: 2400 });
    batch.set(ownRef.collection("fitadaptWeightEntries").doc(date), { date, weightKg: 80 - 0.03 * index });
  }
  await batch.commit();
  console.log(`Synthetic local account (project ${project})\nEmail: ${email}\nPassword: ${password}\nUID: ${uid}`);
  console.log("Use this account only in Expo Go emulator mode. Stop/restart emulators without import/export to clear it.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
