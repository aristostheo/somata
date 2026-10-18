// The authenticated users/{uid} document is shared with the mobile app.
// profiles/{uid} is retained read-only solely for an explicit legacy import.
import { doc, getDoc, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { withoutFitAdaptState } from "./targetProjection";
import { legacyProfilePatch, matchingPatchFields } from "./legacyProfileImport";

const userRef = (uid) => doc(db, "users", uid);
const legacyRef = (uid) => doc(db, "profiles", uid);

function requireOwnAccount(uid) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Sign in to your own account before editing your profile.");
  }
}

export function subscribeProfile(uid, cb) {
  requireOwnAccount(uid);
  return onSnapshot(userRef(uid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, () => cb(null));
}

// Create the same minimal defaults as mobile, only if no canonical document exists.
// An older profiles/{uid} document is never silently copied or changed here.
export async function ensureProfile(uid) {
  requireOwnAccount(uid);
  const email = auth.currentUser.email ?? "";
  const ref = userRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      const now = Date.now();
      tx.set(ref, {
        email, weightUnit: "kg",
        calorieGoal: 2200, dailyCaloriesTarget: 2200, dailyProteinTarget: 130,
        createdAt: now, updatedAt: now,
      });
    }
  });
}

export async function updateProfile(uid, patch) {
  requireOwnAccount(uid);
  await setDoc(userRef(uid), { ...withoutFitAdaptState(patch), updatedAt: Date.now() }, { merge: true });
}

// Owner-readable legacy data is only used to prepare a reviewable import.
export async function loadLegacyProfileImport(uid) {
  requireOwnAccount(uid);
  const snap = await getDoc(legacyRef(uid));
  return snap.exists() ? legacyProfilePatch(snap.data()) : null;
}

// One user action imports only validated fields. The transaction refuses stale
// previews so an intervening mobile edit cannot be overwritten unnoticed.
export async function importLegacyProfile(uid, expectedLegacy, expectedCurrent) {
  requireOwnAccount(uid);
  return runTransaction(db, async (tx) => {
    const oldSnap = await tx.get(legacyRef(uid));
    const currentSnap = await tx.get(userRef(uid));
    if (!oldSnap.exists()) throw new Error("Earlier web profile is no longer available. Refresh and try again.");
    const candidate = legacyProfilePatch(oldSnap.data());
    if (!Object.keys(candidate).length) throw new Error("Earlier web profile has no supported fields to import.");
    if (!matchingPatchFields(candidate, expectedLegacy) || !matchingPatchFields(expectedLegacy, candidate) ||
        !matchingPatchFields(currentSnap.exists() ? currentSnap.data() : null, expectedCurrent)) {
      throw new Error("Your profile changed. Refresh the import preview before trying again.");
    }
    if (matchingPatchFields(currentSnap.exists() ? currentSnap.data() : null, candidate)) return false;
    tx.set(userRef(uid), { ...candidate, updatedAt: Date.now() }, { merge: true });
    return true;
  });
}
