import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type PlanTargets = { calories: number; protein: number; carbs: number; fat: number };
export type PendingPlan = { id: string; createdAt: number; status: "pending"; responseVersion: string;
  sourceFingerprint: string; targets: PlanTargets; effectiveDate: string; reviewRequired: boolean };
export type ActivePlan = { proposalId: string; acceptedAt: number; effectiveDate: string;
  targets: PlanTargets; policyVersion: string };
export type FitAdaptPlanState = { pending: PendingPlan | null; currentRecommendation: ActivePlan | null };
export type FitAdaptEvaluationResult =
  | { kind: "insufficient_data"; missing: string[]; state: FitAdaptPlanState }
  | { kind: "evaluation"; state: FitAdaptPlanState; evaluation: {
      policy_version: string;
      lifecycle: { requirements: string[]; calendar_history_days: number; weight_observation_count: number; intake_observation_count: number };
      recommendation: { status: string; reasons: string[] };
      integration_status: { more_data_needed: boolean; app_status: string };
    } };

export type FitAdaptBridgeErrorCode = "unauthenticated" | "invalid_request" | "invalid_source_data" |
  "service_unavailable" | "timeout" | "service_error" | "invalid_response" | "stale_proposal";
export class FitAdaptBridgeError extends Error {
  constructor(public readonly code: FitAdaptBridgeErrorCode, message: string) { super(message); this.name = "FitAdaptBridgeError"; }
}
const codes = new Set<FitAdaptBridgeErrorCode>(["unauthenticated", "invalid_request", "invalid_source_data",
  "service_unavailable", "timeout", "service_error", "invalid_response", "stale_proposal"]);

async function invoke<T>(name: string, data: Record<string, never> | { proposalId: string }): Promise<T> {
  try { return (await httpsCallable<typeof data, T>(functions, name, { timeout: 30000 })(data)).data; }
  catch (error) {
    const failure = error as { message?: unknown; details?: { code?: unknown } };
    const code = failure?.details?.code;
    throw new FitAdaptBridgeError(typeof code === "string" && codes.has(code as FitAdaptBridgeErrorCode)
      ? code as FitAdaptBridgeErrorCode : "service_error",
    typeof failure?.message === "string" ? failure.message : "FitAdapt could not complete this action.");
  }
}

export const requestFitAdaptEvaluation = () => invoke<FitAdaptEvaluationResult>("evaluateFitAdapt", {});
export const getFitAdaptPlan = () => invoke<FitAdaptPlanState>("getFitAdaptPlan", {});
export const acceptFitAdaptPlan = (proposalId: string) => invoke<FitAdaptPlanState>("acceptFitAdaptPlan", { proposalId });
export const declineFitAdaptPlan = (proposalId: string) => invoke<FitAdaptPlanState>("declineFitAdaptPlan", { proposalId });
