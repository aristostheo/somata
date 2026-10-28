import { accountPhotoFolder } from "./accountStoreCore";
import * as FileSystem from 'expo-file-system/legacy';
import { resolveOwnedPhotoUri } from './photoPaths';
/** Only app-created files in this exact UID directory are eligible for cleanup. */
export function accountPhotoDirectory(uid: string) {
  if (!uid || !FileSystem.documentDirectory) throw new Error('Private photo storage is unavailable.');
  return `${FileSystem.documentDirectory}${accountPhotoFolder(uid)}`;
}
export async function deleteAccountPhotoFiles(uid: string) {
  await FileSystem.deleteAsync(accountPhotoDirectory(uid), { idempotent: true });
}
export async function deleteOwnedPhoto(uid: string, uri: string) {
  accountPhotoDirectory(uid); // Require an available document directory.
  const currentUri = resolveOwnedPhotoUri(uid, uri, FileSystem.documentDirectory!);
  if (!currentUri) throw new Error('Photo ownership could not be verified.');
  await FileSystem.deleteAsync(currentUri, { idempotent: true });
}
