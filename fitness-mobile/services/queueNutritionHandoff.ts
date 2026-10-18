import { BUILDER_ADDITIONS_KEY, queueBuilderAddition } from "./mealBuilderHandoff";
import { accountUidKeyStorage, type AccountStore } from "./local/accountStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NUTRITION_HANDOFF_KEYS } from "./nutritionDelivery";
const writing = new Set<string>();
/** Associate confirmed nutrition with its signed-in owner before leaving the editor. */
export async function queueNutritionHandoff(key: string, payload: object, localStore: AccountStore) {
  localStore.assertCurrent();
  const uid = localStore.uid;
  if (!uid) throw new Error("Sign in again before saving this meal.");
  if (key === BUILDER_ADDITIONS_KEY) {
    const deliveryId = doc(collection(db, "users", uid, "nutritionEntries")).id;
    return queueBuilderAddition(accountUidKeyStorage(localStore), localStore, payload, deliveryId);
  }
  const supported = NUTRITION_HANDOFF_KEYS as readonly string[];
  if (!supported.includes(key)) throw new Error("Unknown meal destination");
  const storageKey = `${key}:${uid}`;
  if (writing.has(storageKey)) throw new Error("This meal is already being saved.");
  writing.add(storageKey);
  try {
    if ((NUTRITION_HANDOFF_KEYS as readonly string[]).includes(key) && await AsyncStorage.getItem(storageKey))
      throw new Error("A meal is still waiting to save. Return to Nutrition and retry before adding another.");
    localStore.assertCurrent();
    const deliveryId = doc(collection(db, "users", uid, "nutritionEntries")).id;
    await AsyncStorage.setItem(storageKey, JSON.stringify({ ...payload, ownerUid: uid, deliveryId }));
  } finally { writing.delete(storageKey); }
}
