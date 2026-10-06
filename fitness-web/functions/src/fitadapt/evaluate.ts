import { BridgeError, type FitAdaptBridgeResult, type FitAdaptEvaluation } from "./contract";
import { mapSomataToFitAdapt } from "./mapping";

export type EvaluationDependencies = {
  readProfile: (uid: string) => Promise<unknown>;
  readNutrition: (uid: string) => Promise<unknown[]>;
  readWeights?: (uid: string) => Promise<unknown[]>;
  callEngine: (request: import("./contract").FitAdaptRequest) => Promise<FitAdaptEvaluation>;
};

/** Called only from a user action; the verified auth UID is the sole data selector. */
export async function evaluateForAuthenticatedUser(
  auth: { uid: string } | null | undefined,
  data: unknown,
  deps: EvaluationDependencies,
): Promise<FitAdaptBridgeResult> {
  if (!auth?.uid) throw new BridgeError("unauthenticated", "Sign in before requesting an evaluation.");
  if (data !== null && data !== undefined &&
      (typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 0)) {
    throw new BridgeError("invalid_request", "Evaluation does not accept client-provided profile data.");
  }
  const profile = await deps.readProfile(auth.uid);
  const mappedProfile = mapSomataToFitAdapt(profile, []);
  if (mappedProfile.kind === "insufficient_data") return mappedProfile;
  const nutrition = await deps.readNutrition(auth.uid);
  const weights = deps.readWeights ? await deps.readWeights(auth.uid) : [];
  const mapped = mapSomataToFitAdapt(profile, nutrition, weights);
  if (mapped.kind === "insufficient_data") return mapped;
  return { kind: "evaluation", evaluation: await deps.callEngine(mapped.request) };
}
