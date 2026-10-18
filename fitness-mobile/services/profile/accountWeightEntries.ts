import { collection, getFirestore, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { recordedAccountWeights, type AccountWeightEntry } from "./accountWeightData";

// These are the same account-scoped dated measurements used by the FitAdapt mapper.
export function subscribeAccountWeightEntries(uid: string, cb: (rows: AccountWeightEntry[] | null) => void) {
  const ref = collection(getFirestore() ?? db, "users", uid, "fitadaptWeightEntries");
  const recent = query(ref, orderBy("date", "desc"), limit(90));
  return onSnapshot(recent,
    (snap) => cb(recordedAccountWeights(snap.docs.map((item) => item.data()))),
    () => cb(null));
}
