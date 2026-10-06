import { createHash, randomUUID } from "node:crypto";
import { Firestore } from "firebase-admin/firestore";
import { BridgeError, type FitAdaptAdaptationEvent, type FitAdaptEvaluation, type FitAdaptRequest, type FitAdaptTargets } from "./contract";
import { mapSomataToFitAdapt } from "./mapping";

type SavedProposal = { id: string; createdAt: number; status: "pending"; responseVersion: string;
  sourceFingerprint: string; targets: FitAdaptTargets; effectiveDate: string; reviewRequired: boolean;
  request: FitAdaptRequest };
type Accepted = { proposalId: string; acceptedAt: number; effectiveDate: string; targets: FitAdaptTargets;
  policyVersion: string; adaptationEvent: NonNullable<FitAdaptEvaluation["activation"]>["event"] };
type PlanState = { pending: SavedProposal | null; currentRecommendation: Accepted | null;
  adaptationHistory: FitAdaptAdaptationEvent[] };
type PublicPlanState = { pending: Omit<SavedProposal, "request"> | null; currentRecommendation: Accepted | null };

function publicState(value: PlanState): PublicPlanState {
  if (!value.pending) return { pending: null, currentRecommendation: value.currentRecommendation };
  const { request: _request, ...pending } = value.pending;
  void _request;
  return { pending, currentRecommendation: value.currentRecommendation };
}

export function sourceFingerprint(profileValue: unknown): string {
  const p = (profileValue ?? {}) as Record<string, unknown>;
  const relevant = { age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, sex: p.sex,
    activityLevel: p.activityLevel, goalInputs: p.goalInputs, goalResult: p.goalResult,
    targetWeightKg: p.targetWeightKg };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function requireAuth(auth: { uid: string } | null | undefined): string {
  if (!auth?.uid) throw new BridgeError("unauthenticated", "Sign in to review your plan.");
  return auth.uid;
}

function requireEmpty(data: unknown): void {
  if (data != null && (typeof data !== "object" || Array.isArray(data) || Object.keys(data).length))
    throw new BridgeError("invalid_request", "This action does not accept profile data.");
}

function state(value: FirebaseFirestore.DocumentData | undefined): PlanState {
  return { pending: value?.pending ?? null, currentRecommendation: value?.currentRecommendation ?? null,
    adaptationHistory: Array.isArray(value?.adaptationHistory) ? value.adaptationHistory : [] };
}

async function clearPending(db: Firestore, uid: string, observedId: string | undefined): Promise<PlanState> {
  const ref = db.collection("fitadaptPlans").doc(uid);
  return db.runTransaction(async (tx) => {
    const current = state((await tx.get(ref)).data());
    if (!current.pending || current.pending.id !== observedId) return current;
    tx.set(ref.collection("history").doc(current.pending.id),
      { ...current.pending, status: "superseded", resolvedAt: Date.now() });
    tx.set(ref, { pending: null }, { merge: true });
    return { ...current, pending: null };
  });
}

export async function getPlanState(db: Firestore, auth: { uid: string } | null | undefined, data: unknown): Promise<PublicPlanState> {
  const uid = requireAuth(auth);
  requireEmpty(data);
  return publicState(state((await db.collection("fitadaptPlans").doc(uid).get()).data()));
}

export async function requestPlanEvaluation(db: Firestore, auth: { uid: string } | null | undefined,
  data: unknown, deps: { readInputs: (uid: string) => Promise<{ profile: unknown; nutrition: unknown[]; weights: unknown[] }>;
    callEngine: (request: FitAdaptRequest) => Promise<FitAdaptEvaluation> }): Promise<
      { kind: "insufficient_data"; missing: string[]; state: PublicPlanState } |
      { kind: "evaluation"; evaluation: FitAdaptEvaluation; state: PublicPlanState }> {
  const uid = requireAuth(auth);
  requireEmpty(data);
  const ref = db.collection("fitadaptPlans").doc(uid);
  const existing = state((await ref.get()).data());
  const inputs = await deps.readInputs(uid);
  const mapped = mapSomataToFitAdapt(inputs.profile, inputs.nutrition, inputs.weights);
  if (mapped.kind === "insufficient_data") return { ...mapped,
    state: publicState(await clearPending(db, uid, existing.pending?.id)) };
  const request: FitAdaptRequest = { ...mapped.request,
    ...(existing.adaptationHistory.length ? { adaptation_history: existing.adaptationHistory } : {}) };
  const evaluation = await deps.callEngine(request);
  if (!evaluation.proposal) return { kind: "evaluation", evaluation,
    state: publicState(await clearPending(db, uid, existing.pending?.id)) };
  const proposed = evaluation.proposal;
  const fingerprint = sourceFingerprint(inputs.profile);
  const result = await db.runTransaction(async (tx) => {
    const [planSnap, profileSnap] = await Promise.all([tx.get(ref), tx.get(db.collection("users").doc(uid))]);
    if (sourceFingerprint(profileSnap.data()) !== fingerprint)
      throw new BridgeError("stale_proposal", "Your goals changed during evaluation. Request a new review.");
    const current = state(planSnap.data());
    if (current.currentRecommendation?.proposalId !== existing.currentRecommendation?.proposalId)
      throw new BridgeError("stale_proposal", "Your active plan changed during evaluation. Request a new review.");
    if (current.pending && current.pending.sourceFingerprint === fingerprint) return current;
    const proposal: SavedProposal = { id: randomUUID(), createdAt: Date.now(), status: "pending",
      responseVersion: evaluation.policy_version, sourceFingerprint: fingerprint,
      targets: proposed.targets, effectiveDate: proposed.effective_date,
      reviewRequired: proposed.review_required, request };
    tx.set(ref, { pending: proposal, currentRecommendation: current.currentRecommendation }, { merge: true });
    if (current.pending) tx.set(ref.collection("history").doc(current.pending.id),
      { ...current.pending, status: "superseded", resolvedAt: Date.now() });
    return { ...current, pending: proposal };
  });
  return { kind: "evaluation", evaluation, state: publicState(result) };
}

export async function resolveProposal(db: Firestore, auth: { uid: string } | null | undefined, data: unknown,
  action: "accept" | "decline", callEngine?: (request: FitAdaptRequest) => Promise<FitAdaptEvaluation>): Promise<PublicPlanState> {
  const uid = requireAuth(auth);
  const input = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  if (!input || Object.keys(input).length !== 1 || typeof input.proposalId !== "string" || !input.proposalId)
    throw new BridgeError("invalid_request", "A proposal ID is required.");
  const ref = db.collection("fitadaptPlans").doc(uid);
  const initial = state((await ref.get()).data());
  if (!initial.pending || initial.pending.id !== input.proposalId) {
    const prior = await ref.collection("history").doc(input.proposalId).get();
    if (prior.exists && prior.data()?.status === (action === "accept" ? "accepted" : "declined")) return publicState(initial);
    throw new BridgeError("stale_proposal", "This proposal is no longer pending.");
  }
  let activation: FitAdaptEvaluation["activation"] = null;
  if (action === "accept") {
    const currentProfile = (await db.collection("users").doc(uid).get()).data();
    if (sourceFingerprint(currentProfile) !== initial.pending.sourceFingerprint)
      throw new BridgeError("stale_proposal", "Your goals changed. Request a new review.");
    if (!callEngine) throw new BridgeError("service_unavailable", "FitAdapt is unavailable for acceptance.");
    const proposal = initial.pending;
    const confirmation = proposal.reviewRequired ? { review_confirmation: {
      effective_date: proposal.effectiveDate, proposed_target_kcal_per_day: proposal.targets.calories } } : {};
    const evaluation = await callEngine({ ...proposal.request, ...confirmation });
    const verifiedActivation = evaluation.activation;
    if (!verifiedActivation || verifiedActivation.event.action !== "activate" ||
        verifiedActivation.event.effective_date !== proposal.effectiveDate ||
        Math.abs(verifiedActivation.event.new_active_target_kcal_per_day - proposal.targets.calories) > 0.01 ||
        (Object.keys(proposal.targets) as (keyof FitAdaptTargets)[]).some(
          (key) => Math.abs(verifiedActivation.targets[key] - proposal.targets[key]) > 0.01))
      throw new BridgeError("stale_proposal", "FitAdapt did not confirm this exact plan. Request a new review.");
    activation = verifiedActivation;
  }
  const resolved = await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(uid);
    const [planSnap, profileSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    const current = state(planSnap.data());
    if (!current.pending || current.pending.id !== input.proposalId)
      throw new BridgeError("stale_proposal", "This proposal is no longer pending.");
    if (action === "accept" && sourceFingerprint(profileSnap.data()) !== current.pending.sourceFingerprint)
      throw new BridgeError("stale_proposal", "Your goals changed. Request a new review.");
    const now = Date.now();
    const accepted: Accepted | null = action === "accept" && activation ? {
      proposalId: current.pending.id, acceptedAt: now, effectiveDate: current.pending.effectiveDate,
      targets: activation.targets, policyVersion: current.pending.responseVersion,
      adaptationEvent: activation.event } : current.currentRecommendation;
    tx.set(ref.collection("history").doc(current.pending.id), { ...current.pending,
      status: action === "accept" ? "accepted" : "declined", resolvedAt: now });
    const adaptationHistory = action === "accept" && activation
      ? [...current.adaptationHistory, activation.event] : current.adaptationHistory;
    tx.set(ref, { pending: null, currentRecommendation: accepted, adaptationHistory }, { merge: true });
    if (action === "accept" && accepted) tx.update(userRef, { activeFitAdaptTargets: accepted.targets });
    return { pending: null, currentRecommendation: accepted, adaptationHistory };
  });
  return publicState(resolved);
}
