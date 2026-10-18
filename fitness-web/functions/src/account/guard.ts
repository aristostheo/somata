import { Firestore, Transaction, DocumentReference, SetOptions } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
export const deletionRef = (db: Firestore, uid: string) => db.doc(`accountDeletions/${uid}`);
export async function isDeleting(db: Firestore, uid: string, tx?: Transaction) {
  return (await (tx ? tx.get(deletionRef(db, uid)) : deletionRef(db, uid).get())).exists;
}
export async function assertAccountActive(db: Firestore, uid: string, tx?: Transaction) {
  if (await isDeleting(db, uid, tx)) throw new HttpsError("failed-precondition", "Account deletion is in progress.", { code: "account_deleting" });
}
/** Commit-time fence for legacy AI writes that may finish after deletion begins. */
export async function setForActiveAccount(db: Firestore, uid: string, ref: DocumentReference,
  data: FirebaseFirestore.DocumentData, options?: SetOptions) {
  await db.runTransaction(async tx => {
    await assertAccountActive(db, uid, tx);
    if (options) tx.set(ref, data, options); else tx.set(ref, data);
  });
}
