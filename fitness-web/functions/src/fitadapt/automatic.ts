import { functionsRegion } from "../deployment";
import { isDeleting } from "../account/guard";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { BridgeError } from "./contract";
import { db, bridgeToken, engine, readEvaluationInputs } from "./function";
import { mapSomataToFitAdapt } from "./mapping";
import { requestPlanEvaluation, sourceFingerprint } from "./planService";

// A short delay combines writes from a form save or logging session. A cap ensures
// continuous logging cannot postpone evaluation forever.
export const AUTO_DEBOUNCE_MS = 2 * 60_000;
export const AUTO_MAX_WAIT_MS = 10 * 60_000;
const LEASE_MS = 2 * 60_000;
const MAX_FAILURES_PER_SOURCE = 3;
const RETRY_MS = [2 * 60_000, 5 * 60_000, 15 * 60_000];

type Data = Record<string, unknown> | undefined;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function relevantProfile(value: Data) {
  const p = object(value);
  const goals = object(p.goalInputs);
  const result = object(p.goalResult);
  return { age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, sex: p.sex,
    activityLevel: p.activityLevel, mode: goals.mode, proteinPriority: goals.proteinPriority,
    weeklyPaceKg: result.weeklyPaceKg, steps: p.steps };
}

export function relevantNutrition(value: Data) {
  const entry = object(value);
  return { date: entry.date, calories: entry.calories };
}

export function relevantWeight(value: Data) {
  const entry = object(value);
  return { date: entry.date, weightKg: entry.weightKg };
}

export function sourceChanged(before: Data, after: Data,
  project: (value: Data) => Record<string, unknown>): boolean {
  return !isDeepStrictEqual(project(before), project(after));
}

/** Only Admin code writes this queue. The UID always comes from the Firestore path. */
export async function queueAutomaticReview(store: Firestore, uid: string, now = Date.now()): Promise<void> {
  const ref = store.collection("fitadaptAutoJobs").doc(uid);
  await store.runTransaction(async (tx) => {
    if (await isDeleting(store, ref.id, tx)) return null;
    const old = (await tx.get(ref)).data() ?? {};
    const firstQueuedAt = typeof old.dueAt === "number" && typeof old.firstQueuedAt === "number"
      ? old.firstQueuedAt : now;
    tx.set(ref, { firstQueuedAt, dueAt: Math.min(now + AUTO_DEBOUNCE_MS, firstQueuedAt + AUTO_MAX_WAIT_MS),
      generation: (typeof old.generation === "number" ? old.generation : 0) + 1 }, { merge: true });
  });
}

type Inputs = Awaited<ReturnType<typeof readEvaluationInputs>>;
/** Include plan-staleness inputs and mapped observations, never identity or food names. */
export function evaluationSourceHash(inputs: Inputs): string {
  const raw = { profile: relevantProfile(object(inputs.profile)),
    nutrition: inputs.nutrition.map((entry) => relevantNutrition(object(entry))),
    weights: inputs.weights.map((entry) => relevantWeight(object(entry))),
  };
  let source: unknown = raw;
  try {
    const mapped = mapSomataToFitAdapt(inputs.profile, inputs.nutrition, inputs.weights);
    const { steps: _steps, ...profileWithoutSteps } = raw.profile;
    void _steps;
    source = mapped.kind === "ready" ? { request: mapped.request, profile: profileWithoutSteps } :
      { ...raw, missing: mapped.missing };
  } catch (error) {
    if (!(error instanceof BridgeError) || error.code !== "invalid_source_data") throw error;
    // Invalid data is still hashable, so duplicate events do not retry it forever.
  }
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

type AutoDependencies = {
  readInputs: (uid: string) => Promise<Inputs>;
  callEngine: typeof engine;
};

/** Claim one due job. Generation and lease prevent concurrent scheduler runs from duplicating calls. */
export async function processAutomaticReview(store: Firestore, uid: string, now = Date.now(),
  deps: AutoDependencies = { readInputs: readEvaluationInputs, callEngine: engine }): Promise<string> {
  const ref = store.collection("fitadaptAutoJobs").doc(uid);
  const generation = await store.runTransaction(async (tx) => {
    if (await isDeleting(store, ref.id, tx)) return null;
    const value = (await tx.get(ref)).data();
    if (!value || typeof value.dueAt !== "number" || value.dueAt > now ||
        (typeof value.leaseUntil === "number" && value.leaseUntil > now)) return null;
    tx.update(ref, { leaseUntil: now + LEASE_MS });
    return value.generation as number;
  });
  if (generation == null) return "not_due";

  let hash: string | undefined;
  try {
    const inputs = await deps.readInputs(uid);
    hash = evaluationSourceHash(inputs);
    const [job, plan] = await Promise.all([ref.get(), store.collection("fitadaptPlans").doc(uid).get()]);
    if (job.data()?.lastHandledHash === hash ||
        (job.data()?.lastFailedHash === hash && job.data()?.failureCount >= MAX_FAILURES_PER_SOURCE)) {
      await finishJob(store, ref, generation, { lastHandledHash: hash }, now);
      return "unchanged";
    }
    const pending = plan.data()?.pending;
    if (pending && pending.sourceFingerprint === sourceFingerprint(inputs.profile)) {
      await finishJob(store, ref, generation, { lastHandledHash: hash }, now);
      return "pending_preserved";
    }
    const result = await requestPlanEvaluation(store, { uid }, {}, {
      readInputs: async () => inputs, callEngine: deps.callEngine,
    });
    await finishJob(store, ref, generation, { lastHandledHash: hash,
      lastFailedHash: FieldValue.delete(), failureCount: 0 }, now);
    return result.kind === "insufficient_data" ? "insufficient_data" :
      result.state.pending ? "pending" : "no_proposal";
  } catch (error) {
    // No active target is changed on failure. Retry a bounded number of times;
    // a later source change gets a fresh attempt budget.
    const code = error instanceof BridgeError ? error.code : "service_error";
    await store.runTransaction(async (tx) => {
    if (await isDeleting(store, ref.id, tx)) return null;
      const value = (await tx.get(ref)).data();
      if (!value || value.generation !== generation) {
        if (value) tx.update(ref, { leaseUntil: 0 });
        return;
      }
      const failureKey = hash ?? "read_failed";
      const count = value.lastFailedHash === failureKey ? (value.failureCount ?? 0) + 1 : 1;
      const retryable = code === "timeout" || code === "service_error" || code === "service_unavailable" || code === "stale_proposal";
      tx.update(ref, { leaseUntil: 0, lastFailedHash: failureKey,
        failureCount: retryable ? count : MAX_FAILURES_PER_SOURCE,
        lastErrorCode: code,
        dueAt: retryable && count < MAX_FAILURES_PER_SOURCE ? now + RETRY_MS[count - 1] : FieldValue.delete() });
    });
    return "failed";
  }
}

async function finishJob(store: Firestore, ref: FirebaseFirestore.DocumentReference, generation: number,
  fields: Record<string, unknown>, now: number) {
  await store.runTransaction(async (tx) => {
    if (await isDeleting(store, ref.id, tx)) return null;
    const value = (await tx.get(ref)).data();
    if (!value) return;
    if (value.generation === generation) tx.update(ref, {
      ...fields, dueAt: FieldValue.delete(), leaseUntil: 0, lastCompletedAt: now,
    });
    else tx.update(ref, { leaseUntil: 0 });
  });
}

export async function drainAutomaticReviews(store: Firestore, now = Date.now(),
  deps: AutoDependencies = { readInputs: readEvaluationInputs, callEngine: engine }): Promise<string[]> {
  const due = await store.collection("fitadaptAutoJobs").where("dueAt", "<=", now).limit(50).get();
  const results: string[] = [];
  for (const doc of due.docs) {
    if (results.length >= 10) break;
    const result = await processAutomaticReview(store, doc.id, now, deps);
    if (result !== "not_due") results.push(result);
  }
  return results;
}

/** Shared entry point for Cloud Scheduler and the guarded local emulator harness. */
export async function runScheduledFitAdaptReviews(now = Date.now()): Promise<string[]> {
  return drainAutomaticReviews(db, now);
}

const triggerOptions = { region: functionsRegion, maxInstances: 5 } as const;
export const onFitAdaptProfileChanged = onDocumentWritten(
  { ...triggerOptions, document: "users/{uid}" }, async (event) => {
    if (sourceChanged(event.data?.before.data(), event.data?.after.data(), relevantProfile) && event.data?.after.exists)
      await queueAutomaticReview(db, event.params.uid);
  });
export const onFitAdaptNutritionChanged = onDocumentWritten(
  { ...triggerOptions, document: "users/{uid}/nutritionEntries/{entryId}" }, async (event) => {
    if (sourceChanged(event.data?.before.data(), event.data?.after.data(), relevantNutrition))
      await queueAutomaticReview(db, event.params.uid);
  });
export const onFitAdaptWeightChanged = onDocumentWritten(
  { ...triggerOptions, document: "users/{uid}/fitadaptWeightEntries/{entryId}" }, async (event) => {
    if (sourceChanged(event.data?.before.data(), event.data?.after.data(), relevantWeight))
      await queueAutomaticReview(db, event.params.uid);
  });
export const processFitAdaptAutoReviews = onSchedule(
  { schedule: "every 5 minutes", region: functionsRegion, secrets: [bridgeToken],
    timeoutSeconds: 540, maxInstances: 1 },
  async () => { await runScheduledFitAdaptReviews(); },
);
