import { addDoc, doc, runTransaction, type CollectionReference, type DocumentData } from "firebase/firestore";
/** Session/set IDs survive retries in the existing local session draft. */
export async function persistWorkoutEntry(collection: CollectionReference, data: DocumentData, sessionId?: string, setId?: string) {
  if (!sessionId || !setId) return addDoc(collection, data);
  const ref = doc(collection, `${encodeURIComponent(sessionId)}__${encodeURIComponent(setId)}`);
  await runTransaction(collection.firestore, async transaction => {
    if (!(await transaction.get(ref)).exists()) transaction.set(ref, data);
  });
  return ref;
}
