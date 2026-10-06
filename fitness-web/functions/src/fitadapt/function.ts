import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { BridgeError } from "./contract";
import { callFitAdapt } from "./client";
import { getPlanState, requestPlanEvaluation, resolveProposal } from "./planService";

if (!getApps().length) initializeApp();
const db = getFirestore();
const serviceUrl = defineString("FITADAPT_SERVICE_URL", { default: "" });
const bridgeToken = defineSecret("FITADAPT_BRIDGE_TOKEN");

function dateWindow() {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 89);
  return { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

async function readProfile(uid: string, window: { from: string; to: string }): Promise<unknown> {
  const snapshot = await db.collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  const steps = data.steps && typeof data.steps === "object" && !Array.isArray(data.steps)
    ? Object.fromEntries(Object.entries(data.steps).filter(([date]) => date >= window.from && date <= window.to))
    : undefined;
  return { ...data, steps };
}

async function readNutrition(uid: string, window: { from: string; to: string }): Promise<unknown[]> {
  const snapshot = await db.collection("users").doc(uid).collection("nutritionEntries")
    .where("date", ">=", window.from).where("date", "<=", window.to).orderBy("date").limit(2001).get();
  if (snapshot.size > 2000) throw new BridgeError("invalid_source_data", "Nutrition history is too large for one evaluation.");
  return snapshot.docs.map((doc) => doc.data());
}

async function readWeights(uid: string, window: { from: string; to: string }): Promise<unknown[]> {
  const snapshot = await db.collection("users").doc(uid).collection("fitadaptWeightEntries")
    .where("date", ">=", window.from).where("date", "<=", window.to).orderBy("date").limit(91).get();
  if (snapshot.size > 90) throw new BridgeError("invalid_source_data", "Weight history exceeds the evaluation window.");
  return snapshot.docs.map((doc) => doc.data());
}

function engine(payload: import("./contract").FitAdaptRequest) {
  let token: string;
  try { token = bridgeToken.value(); }
  catch { throw new BridgeError("service_unavailable", "FitAdapt service credential is not configured."); }
  return callFitAdapt(payload, { baseUrl: serviceUrl.value(), token });
}

function asHttpsError(error: unknown): HttpsError {
  if (error instanceof BridgeError) {
    const status = error.code === "unauthenticated" ? "unauthenticated" :
      error.code === "invalid_request" ? "invalid-argument" :
      error.code === "invalid_source_data" ? "failed-precondition" :
      error.code === "stale_proposal" ? "failed-precondition" :
      error.code === "timeout" ? "deadline-exceeded" :
      error.code === "invalid_response" ? "data-loss" : "unavailable";
    return new HttpsError(status, error.message, { code: error.code });
  }
  return new HttpsError("unavailable", "Evaluation could not be completed.", { code: "service_error" });
}

/** Firebase verifies the caller's ID token before request.auth is populated. */
export const evaluateFitAdapt = onCall(
  { secrets: [bridgeToken], timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    try {
      const window = dateWindow();
      return await requestPlanEvaluation(db, request.auth, request.data, {
        readInputs: async (uid) => ({ profile: await readProfile(uid, window),
          nutrition: await readNutrition(uid, window), weights: await readWeights(uid, window) }),
        callEngine: engine,
      });
    } catch (error) {
      throw asHttpsError(error);
    }
  },
);

export const getFitAdaptPlan = onCall(async (request) => {
  try { return await getPlanState(db, request.auth, request.data); }
  catch (error) { throw asHttpsError(error); }
});

export const acceptFitAdaptPlan = onCall({ secrets: [bridgeToken], timeoutSeconds: 30 }, async (request) => {
  try { return await resolveProposal(db, request.auth, request.data, "accept", engine); }
  catch (error) { throw asHttpsError(error); }
});

export const declineFitAdaptPlan = onCall(async (request) => {
  try { return await resolveProposal(db, request.auth, request.data, "decline"); }
  catch (error) { throw asHttpsError(error); }
});
