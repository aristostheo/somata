import { functionsRegion } from "../deployment";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { auditStorageBucket, deleteAccount } from "./deletion";
if (!getApps().length) initializeApp();
export const deleteSomataAccount = onCall({ region: functionsRegion, timeoutSeconds: 540, maxInstances: 3 }, async request => {
  try {
    return await deleteAccount({ db: getFirestore(),
      getUser: uid => getAuth().getUser(uid), deleteUser: uid => getAuth().deleteUser(uid),
      auditStorage: () => auditStorageBucket(getStorage().bucket()),
    }, request.auth, request.data);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    // No raw identifiers, credentials, file names, records or exception payloads in logs.
    throw new HttpsError("unavailable", "Account cleanup could not complete. Please retry.", { code: "deletion_retry_required" });
  }
});
