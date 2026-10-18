import type { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { Firestore, FieldPath, FieldValue, DocumentSnapshot, Query } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { deletionRef } from "./guard";

type Identity = { uid: string; token: { auth_time?: unknown; firebase?: { sign_in_provider?: string } } } | undefined;
export type DeletionDependencies = {
  db: Firestore;
  getUser: (uid: string) => Promise<unknown>;
  deleteUser: (uid: string) => Promise<void>;
  auditStorage: () => Promise<void>;
  now?: () => number;
  // Injectable failure point for emulator tests; never exposed through request data.
  beforeStep?: (step: string) => Promise<void>;
};
const ROOTS = ["users", "profiles", "fitadaptPlans", "fitadaptAutoJobs", "aiUsageLimits", "aiSuggestions", "aiMacroCompletion", "aiMealV2", "overrides_scanUnlimited", "friendSummaryGrants"];
const SCANS = ["friends", "blocks", "notifications", "comments", "reactions", "routines", "viewers", "foodCatalog", "usage_scanDaily", "aiQuota", "aiRate"];
const STEPS = [...SCANS, ...ROOTS.map(root => `root:${root}`), "auth"];
const ID = /^[A-Za-z0-9_-]{1,128}$/;
function caller(auth: Identity, data: unknown): string {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in before deleting your account.");
  // Exotic imported UID schemes need an ownership audit, not an unsafe prefix guess.
  if (!ID.test(auth.uid)) throw new HttpsError("failed-precondition", "This account needs an ownership review before deletion.", { code: "ownership_review" });
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 1 ||
      (data as { confirmation?: unknown }).confirmation !== "DELETE_MY_ACCOUNT")
    throw new HttpsError("invalid-argument", "Explicit account-deletion confirmation is required.", { code: "confirmation_required" });
  return auth.uid;
}
export function requireRecentAuth(auth: Identity, now: number) {
  const time = auth?.token.auth_time;
  if (typeof time !== "number" || !Number.isFinite(time) || time * 1000 > now + 30000 || now - time * 1000 > 5 * 60000 ||
      auth?.token.firebase?.sign_in_provider === "anonymous")
    throw new HttpsError("failed-precondition", "Sign in again, then confirm deletion within five minutes.", { code: "reauthentication_required" });
}
const absentAuth = (error: unknown) => (error as { code?: string })?.code === "auth/user-not-found";
async function preflight(deps: DeletionDependencies, uid: string) {
  // Hash-keyed shared caches have no UID. Never guess which person supplied their content.
  for (const name of ["aiMealIdeas", "aiExerciseEstimates"]) {
    if (!(await deps.db.collection(name).limit(1).get()).empty)
      throw new HttpsError("failed-precondition", "Legacy shared AI data needs an operator retention review before deletion can finish.", { code: "retention_review_required", reason: "legacy_ai_cache" });
  }
  for (const field of ["reporterUid", "targetUid"]) {
    if (!(await deps.db.collection("reports").where(field, "==", uid).limit(1).get()).empty)
      throw new HttpsError("failed-precondition", "A safety record needs an operator retention review before deletion can finish.", { code: "retention_review_required", reason: "safety_report" });
  }
  await deps.auditStorage();
}
// Audited root shared assets only. There is no user Storage-upload path in current clients.
// Unknown objects or owner metadata require an inventory decision, never guessed deletion.
export async function auditStorageBucket(bucket: Pick<ReturnType<ReturnType<typeof getStorage>["bucket"]>, "getFiles">) {
  let pageToken: string | undefined;
  do {
    const [files, next] = await bucket.getFiles({ autoPaginate: false, maxResults: 100, ...(pageToken ? { pageToken } : {}) });
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const knownPublic = file.name === "public/exercises.seed.json" || /^exercises\/[^/]+\/demo\.gif$/.test(file.name);
      if (!knownPublic || Object.keys(metadata.metadata ?? {}).some(key => /uid|owner|user/i.test(key)))
        throw new HttpsError("failed-precondition", "Storage ownership needs an operator review before account deletion.", { code: "storage_review_required" });
    }
    pageToken = next?.pageToken;
  } while (pageToken);
}
function actionFor(name: string, snap: DocumentSnapshot, uid: string): "delete" | Record<string, unknown> | null {
  const d = snap.data() ?? {}, path = snap.ref.path.split("/");
  const userChild = path.length === 4 && path[0] === "users" && path[2] === name;
  if (name === "viewers") return path.length === 4 && path[0] === "friendSummaryGrants" && path[3] === uid ? "delete" : null;
  if (name === "foodCatalog") return d.submitterUid === uid ? { submitterUid: FieldValue.delete() } : null;
  // Strict suffixes avoid deleting another UID that happens to start with this UID.
  if (name === "usage_scanDaily") return snap.id.startsWith(uid + "_") && /^\d{4}-\d{2}-\d{2}$/.test(snap.id.slice(uid.length + 1)) && d.uid === uid ? "delete" : null;
  if (name === "aiQuota") return snap.id.startsWith(uid + "_") && /^\d{4}-\d{2}-\d{2}(_meals|_macro_completion|_mealv2)?$/.test(snap.id.slice(uid.length + 1)) ? "delete" : null;
  if (name === "aiRate") return snap.id === `${uid}_mealv2` || snap.id === `${uid}_scanmealv1` ? "delete" : null;
  if (!userChild) return null;
  if (path[1] === uid) return null; // Recursively delete owned data, including unknown nested subcollections, later.
  if (name === "friends") return snap.id === uid || d.friendUid === uid ? "delete" : null;
  if (name === "blocks") return snap.id === uid || d.targetUid === uid ? "delete" : null;
  if (name === "notifications") return d.data?.fromUid === uid || d.data?.friendUid === uid ? "delete" : null;
  if (name === "comments" || name === "reactions") return d.createdByUid === uid ? "delete" : null;
  if (name === "routines") return d.fromFriendUid === uid ? { fromFriendUid: FieldValue.delete() } : null;
  return null;
}
export async function deleteAccount(deps: DeletionDependencies, auth: Identity, data: unknown) {
  const uid = caller(auth, data), db = deps.db, now = deps.now ?? Date.now, ref = deletionRef(db, uid);
  let job = (await ref.get()).data();
  if (job && (job.version !== 1 || !Number.isInteger(job.phase) || job.phase < 0 || job.phase >= STEPS.length))
    throw new HttpsError("failed-precondition", "Deletion state needs an operator review before cleanup can resume.", { code: "ownership_review" });
  if (job?.status === "complete") return { status: "deleted" as const };
  // A lost response after Auth deletion can be acknowledged with the still-valid caller token.
  if (job?.phase === STEPS.length - 1) {
    try { await deps.getUser(uid); } catch (error) {
      if (!absentAuth(error)) throw error;
      await ref.set({ status: "complete", completedAt: now(), leaseUntil: 0, leaseId: FieldValue.delete(), cursor: FieldValue.delete() }, { merge: true });
      return { status: "deleted" as const };
    }
  }
  requireRecentAuth(auth, now());
  await deps.getUser(uid); // Auth existence verified; no client-supplied target or email matching.
  if (!job) await preflight(deps, uid); // Policy gaps do not freeze a previously active account.
  const leaseId = randomUUID();
  const start = now();
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if ((current?.leaseUntil ?? 0) > now()) throw new HttpsError("aborted", "Deletion is already running. Wait before retrying.", { code: "deletion_in_progress" });
    tx.set(ref, { version: 1, status: "deleting", phase: current?.phase ?? 0, startedAt: current?.startedAt ?? now(), leaseId, leaseUntil: now() + 600000 }, { merge: true });
  });
  try {
    await preflight(deps, uid); // Freeze and recheck before destructive cleanup; retries never bypass policy gates.
    job = (await ref.get()).data();
    let phase = job?.phase ?? 0, cursor = job?.cursor;
    while (phase < STEPS.length) {
      if (now() - start > 420000) throw new HttpsError("unavailable", "Deletion is not finished. Confirm again to resume.", { code: "deletion_retry_required" });
      const step = STEPS[phase];
      await deps.beforeStep?.(step);
      if (step === "auth") {
        try { await deps.deleteUser(uid); } catch (error) { if (!absentAuth(error)) throw error; }
        await ref.set({ status: "complete", completedAt: now(), leaseUntil: 0, leaseId: FieldValue.delete(), cursor: FieldValue.delete() }, { merge: true });
        return { status: "deleted" as const };
      }
      if (step.startsWith("root:")) {
        await db.recursiveDelete(db.doc(`${step.slice(5)}/${uid}`));
      } else {
        const top = ["foodCatalog", "usage_scanDaily", "aiQuota", "aiRate"].includes(step);
        let query: Query = (top ? db.collection(step) : db.collectionGroup(step)).orderBy(FieldPath.documentId()).limit(100);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        for (const doc of page.docs) {
          await db.runTransaction(async tx => {
            const fresh = await tx.get(doc.ref);
            if (!fresh.exists) return;
            const action = actionFor(step, fresh, uid);
            if (action === "delete") tx.delete(doc.ref);
            else if (action) tx.update(doc.ref, action);
          });
        }
        if (page.size === 100) {
          cursor = top ? page.docs[99].id : page.docs[99].ref.path;
          await ref.update({ cursor });
          continue;
        }
      }
      phase++; cursor = undefined;
      await ref.update({ phase, cursor: FieldValue.delete() });
    }
    throw new Error("Invalid deletion phase");
  } catch (error) {
    // Leave the freeze and phase in place. No rollback can restore already-deleted personal data.
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.leaseId === leaseId) tx.update(ref, { leaseUntil: 0, leaseId: FieldValue.delete() });
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unavailable", "Deletion is not finished. Sign in again if needed and retry to resume cleanup.", { code: "deletion_retry_required" });
  }
}
