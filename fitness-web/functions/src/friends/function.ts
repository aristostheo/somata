import { functionsRegion } from "../deployment";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getSummary, setSharing } from "./service";
if (!getApps().length) initializeApp();
const options = { region: functionsRegion, timeoutSeconds: 30, maxInstances: 5 };
async function safe<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) {
    if (error instanceof HttpsError) throw error;
    // Never log identifiers, private records or request payloads.
    throw new HttpsError("unavailable", "Shared activity could not be loaded. Try again.");
  }
}
export const getFriendSummary = onCall(options, request => safe(() => getSummary(getFirestore(), request.auth?.uid, request.data)));
export const setFriendSummarySharing = onCall(options, request => safe(() => setSharing(getFirestore(), request.auth?.uid, request.data)));
