import { accountPhotoFolder } from './accountStoreCore';

/** Resolve only our exact owner's filenames, never an arbitrary saved file URL. */
export function ownedPhotoRelativePath(uid: string, uri: string): string | null {
  if (!uid || typeof uri !== 'string') return null;
  const folder = accountPhotoFolder(uid);
  let relative = uri;
  if (uri.startsWith('file://')) {
    const marker = uri.lastIndexOf('/somata-account-photos/');
    if (marker < 0) return null;
    relative = uri.slice(marker + 1);
  }
  if (!relative.startsWith(folder)) return null;
  const filename = relative.slice(folder.length);
  return /^[a-zA-Z0-9_-]+\.jpg$/.test(filename) ? relative : null;
}

export function resolveOwnedPhotoUri(uid: string, uri: string, documentDirectory: string): string | null {
  const relative = ownedPhotoRelativePath(uid, uri);
  return relative ? documentDirectory + relative : null;
}
