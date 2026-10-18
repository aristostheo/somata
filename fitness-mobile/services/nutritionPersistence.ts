import { collection, doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import type { FoodEntry } from "./nutrition";
/** A retried handoff neither duplicates rows nor overwrites an already saved edit. */
export async function persistFoodDelivery(db: Firestore, uid: string, deliveryId: string, entries: Omit<FoodEntry, "id">[]) {
  const refs = entries.map((_, index) => doc(collection(db, "users", uid, "nutritionEntries"), `${deliveryId}-${index}`));
  const rows = entries.map(entry => JSON.parse(JSON.stringify(entry)));
  await runTransaction(db, async transaction => {
    const existing = await Promise.all(refs.map(ref => transaction.get(ref)));
    refs.forEach((ref, index) => {
      if (!existing[index].exists()) transaction.set(ref, { ...rows[index], createdAt: serverTimestamp() });
    });
  });
}
