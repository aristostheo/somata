import {defineString} from "firebase-functions/params";

/** Region selection only; no network, secrets or user-data access. */
export function resolveFunctionsRegion(env: Record<string, string | undefined>): "us-central1" | "northamerica-northeast2" {
  const staging = env.SOMATA_STAGING_PROJECT_ID;
  if (staging === undefined) {
    if (env.SOMATA_FUNCTIONS_REGION && env.SOMATA_FUNCTIONS_REGION !== "us-central1") {
      throw new Error("A non-default Functions region requires a verified staging project pin.");
    }
    return "us-central1";
  }
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(staging) || staging === "fitness-tracker-25254" ||
      staging === "eleven11-aristos" || staging.startsWith("demo-") || /placeholder|replace|example/.test(staging)) {
    throw new Error("Staging Functions require a separate, explicitly pinned project.");
  }
  if (env.GCLOUD_PROJECT !== staging || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== staging) ||
      env.FUNCTIONS_EMULATOR === "true") {
    throw new Error("Staging Functions project does not match the verified deployment/runtime context.");
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("Staging FIREBASE_CONFIG must be valid inline project configuration."); }
    if (config.projectId !== staging) throw new Error("Staging Admin project configuration does not match.");
  }
  if (env.SOMATA_FUNCTIONS_REGION !== "northamerica-northeast2") throw new Error("Staging Functions must use Toronto.");
  return "northamerica-northeast2";
}

// Discovery runs before Firebase loads project .env values. Keep region as a parameter
// expression so the CLI resolves it from the guarded project file instead of freezing
// the default region in the deployment manifest. Runtime checks still fail closed.
resolveFunctionsRegion(process.env);
export const functionsRegion = defineString("SOMATA_FUNCTIONS_REGION", {default: "us-central1"});
