import { accountStorage, type AccountStore } from '@/services/local/accountStore';
// services/exercises/store.ts

const KEY_FAVS = "exercises:favorites:v1";
const KEY_RECENTS = "exercises:recents:v1";

const clampList = (arr: string[], max: number) => arr.slice(0, max);

export async function loadFavorites(localStore: AccountStore = accountStorage()): Promise<Set<string>> {
  const raw = await localStore.getItem(KEY_FAVS);
  if (!raw) return new Set();
  try {
    const ids = JSON.parse(raw) as string[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function saveFavorites(ids: Set<string>, localStore: AccountStore = accountStorage()) {
  await localStore.setItem(KEY_FAVS, JSON.stringify(Array.from(ids)));
}

export async function toggleFavorite(
  exerciseId: string,
  current: Set<string>, localStore: AccountStore = accountStorage()
): Promise<Set<string>> {
  const next = new Set(current);
  if (next.has(exerciseId)) next.delete(exerciseId);
  else next.add(exerciseId);
  await saveFavorites(next, localStore);
  return next;
}

export async function loadRecents(localStore: AccountStore = accountStorage()): Promise<string[]> {
  const raw = await localStore.getItem(KEY_RECENTS);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export async function addRecent(exerciseId: string, localStore: AccountStore = accountStorage()): Promise<string[]> {
  const existing = await loadRecents(localStore);
  const next = [exerciseId, ...existing.filter((x) => x !== exerciseId)];
  const clamped = clampList(next, 25);
  await localStore.setItem(KEY_RECENTS, JSON.stringify(clamped));
  return clamped;
}

export async function clearRecents(localStore: AccountStore = accountStorage()): Promise<void> {
  await localStore.removeItem(KEY_RECENTS);
}
