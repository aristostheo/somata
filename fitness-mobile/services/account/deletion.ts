import { retireAccountLocalStorage } from "../local/accountStore";
import { deleteAccountPhotoFiles } from "../local/accountFiles";
import { clearAccountNotificationDelivery } from "../notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { ownedDeletionKeys } from "./deletionData";
export async function deleteCurrentAccount(expectedUid: string) {
  if (auth.currentUser?.uid !== expectedUid) throw new Error("Account changed. Verify your sign-in again.");
  const result = await httpsCallable<{ confirmation: string }, { status: "deleted" }>(functions, "deleteSomataAccount", { timeout: 540000 })({ confirmation: "DELETE_MY_ACCOUNT" });
  if (result.data?.status !== "deleted") throw new Error("Deletion was not confirmed.");
  return result.data;
}
export async function clearDeletedAccountDeviceData(uid: string) {
  await retireAccountLocalStorage(uid);
  await deleteAccountPhotoFiles(uid);
  if (auth.currentUser?.uid === uid) await clearAccountNotificationDelivery();
  await AsyncStorage.multiRemove(ownedDeletionKeys(await AsyncStorage.getAllKeys(), uid));
  const marker = "@somata:fitadapt-setup-pending:v1";
  if (await AsyncStorage.getItem(marker) === `uid:${uid}`) await AsyncStorage.removeItem(marker);
}
