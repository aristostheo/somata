/** Explicit invocation only; never included in offline unit tests. Synthetic demo accounts only. */
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, serverTimestamp, terminate } from "firebase/firestore";
import { persistFoodDelivery } from "../services/nutritionPersistence";
import { persistWorkoutEntry } from "../services/workoutPersistence";
import { projectPendingNutrition } from "../services/previewNutritionProjection";
if (process.env.GCLOUD_PROJECT !== "demo-somata-fitadapt" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") throw new Error("Only explicitly configured local demo emulators are allowed.");
async function client() {
  const app = initializeApp({ apiKey: "demo-key", projectId: "demo-somata-fitadapt" }, crypto.randomUUID());
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const email = `synthetic-${crypto.randomUUID()}@example.test`; const password = "local-only-password";
  const uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid;
  return { app, auth, db, uid, email, password };
}
async function main() {
  const owner = await client(); const other = await client();
  try {
    const user = doc(owner.db, "users", owner.uid);
    await setDoc(user, { displayName: "Synthetic audit account", dailyCaloriesTarget: 2200 });
    await signOut(owner.auth);
    await assert.rejects(getDoc(user));
    await signInWithEmailAndPassword(owner.auth, owner.email, owner.password);
    assert.equal((await getDoc(user)).data()?.dailyCaloriesTarget, 2200);
    const describe = "http://127.0.0.1:5001/demo-somata-fitadapt/us-central1/describe";
    assert.equal((await fetch(describe)).status, 405);
    assert.equal((await fetch(describe, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    assert.equal((await fetch(describe, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer invalid-synthetic" }, body: "{}" })).status, 401);
    const token = await owner.auth.currentUser!.getIdToken();
    assert.equal((await fetch(describe, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "meal:v2" }) })).status, 400);
    console.log("PASS: describe HTTP method/authentication/empty-input rejection; no AI request made");
    const rows = projectPendingNutrition(JSON.stringify({ name: "Synthetic meal", items: [
      { id: "one", name: "Toast", qty: 1, unit: "piece", calories: 180, protein: 10, carbs: 24, fat: 5 }],
      date: "2026-10-12", meal: "lunch" }), "@pending_meal_builder_log_v1", "2026-10-12");
    await persistFoodDelivery(owner.db, owner.uid, "synthetic-delivery", rows);
    const food = doc(owner.db, "users", owner.uid, "nutritionEntries", "synthetic-delivery-0");
    await updateDoc(food, { calories: 190 });
    await persistFoodDelivery(owner.db, owner.uid, "synthetic-delivery", rows);
    const foods = await getDocs(collection(owner.db, "users", owner.uid, "nutritionEntries"));
    assert.equal(foods.size, 1); assert.equal(foods.docs.reduce((sum, item) => sum + item.data().calories, 0), 190);
    await assert.rejects(persistFoodDelivery(other.db, owner.uid, "forbidden-delivery", rows));
    await deleteDoc(food); assert.equal((await getDoc(food)).exists(), false);
    console.log("PASS: real client Auth sign-out/sign-in; nutrition bundle save/edit/total/delete; retry idempotence; cross-UID writes denied");

    const workouts = collection(owner.db, "users", owner.uid, "workouts");
    const entry = { uid: owner.uid, date: "2026-10-12", exercise: "Squat", sets: 1, reps: 8, weight: 0,
      sessionId: "synthetic-session", sessionTitle: "Synthetic workout", createdAt: serverTimestamp() };
    const first = await persistWorkoutEntry(workouts, entry, "synthetic-session", "one");
    await updateDoc(first, { reps: 10 });
    // Simulates retry after the first set was saved and a later request failed.
    await persistWorkoutEntry(workouts, entry, "synthetic-session", "one");
    await persistWorkoutEntry(workouts, entry, "synthetic-session", "two");
    assert.equal((await getDocs(workouts)).size, 2); assert.equal((await getDoc(first)).data()?.reps, 10);
    await deleteDoc(first); assert.equal((await getDocs(workouts)).size, 1);
    console.log("PASS: workout set persistence, partial-finish retry without duplicates, history read/edit/delete");

    const request = writeBatch(owner.db);
    request.set(doc(owner.db, "users", owner.uid, "friends", other.uid), { friendUid: other.uid, status: "pending", direction: "outgoing" });
    request.set(doc(owner.db, "users", other.uid, "friends", owner.uid), { friendUid: owner.uid, status: "pending", direction: "incoming" });
    await request.commit();
    const reply = writeBatch(other.db);
    reply.update(doc(other.db, "users", owner.uid, "friends", other.uid), { status: "accepted" });
    reply.update(doc(other.db, "users", other.uid, "friends", owner.uid), { status: "accepted" });
    await reply.commit();
    assert.equal((await getDoc(doc(owner.db, "users", owner.uid, "friends", other.uid))).data()?.status, "accepted");
    const alert = doc(owner.db, "users", owner.uid, "notifications", "synthetic-alert");
    await setDoc(alert, { type: "friend_request", title: "Synthetic request", body: "Local test", createdAt: serverTimestamp(), readAt: null });
    await updateDoc(alert, { readAt: serverTimestamp() }); assert.ok((await getDoc(alert)).data()?.readAt);
    await deleteDoc(alert); assert.equal((await getDoc(alert)).exists(), false);
    console.log("PASS: synthetic friend request/accept; in-app alert read/dismiss (no push notifications sent)");
  } finally {
    await Promise.all([terminate(owner.db), terminate(other.db)]);
    await Promise.all([deleteApp(owner.app), deleteApp(other.app)]);
  }
}
main().catch(() => { console.error("Core emulator flow failed; inspect the failing assertion locally."); process.exitCode = 1; });
