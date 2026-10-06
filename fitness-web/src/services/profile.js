// src/services/profile.js
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { withAcceptedTargets } from "./targetProjection";

// Subscribe to a user's profile
export function subscribeProfile(uid, cb) {
  let legacy;
  let mobile;
  let legacyReady = false;
  let mobileReady = false;
  const publish = () => {
    if (!legacyReady || !mobileReady) return;
    cb(withAcceptedTargets(legacy, mobile));
  };
  const unsubscribeLegacy = onSnapshot(doc(db, "profiles", uid), (snap) => {
    legacy = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    legacyReady = true;
    publish();
  });
  const unsubscribeMobile = onSnapshot(doc(db, "users", uid), (snap) => {
    mobile = snap.exists() ? snap.data() : null;
    mobileReady = true;
    publish();
  }, () => { mobile = null; mobileReady = true; publish(); });
  return () => { unsubscribeLegacy(); unsubscribeMobile(); };
}

/**
 * Ensure a profile doc exists.
 * Pass optional seed fields (e.g., { email }) from the caller.
 */
export async function ensureProfile(uid, seed = {}) {
  const ref = doc(db, "profiles", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const def = {
      email: seed.email ?? "",
      weightUnit: "kg",
      sex: "male",
      age: 25,
      heightCm: 175,
      weightKg: 75,
      activityLevel: "moderate", // sedentary|light|moderate|active|athlete
      goal: "maintain", // cut|maintain|bulk
      calorieGoal: 2200,
      proteinGoal: 135,
      carbGoal: 240,
      fatGoal: 73,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setDoc(ref, { ...def, ...seed });
  }
}

// Patch/update profile fields
export async function updateProfile(uid, patch) {
  const ref = doc(db, "profiles", uid);
  await updateDoc(ref, { ...patch, updatedAt: Date.now() });
}
