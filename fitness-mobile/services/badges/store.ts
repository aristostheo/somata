import { accountStorage, type AccountStore } from '@/services/local/accountStore';
// services/badges/store.ts
import type { UnlockMap, ProgressMap } from "./types";

const KEYS = {
  unlocks: "badges.unlocks.v1",
  progress: "badges.progress.v1",
  featured: "badges.featured.v1",
};

async function safeGet<T>(key: string, fallback: T, localStore: AccountStore = accountStorage()): Promise<T> {
  try {
    const raw = await localStore.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function safeSet<T>(key: string, value: T, localStore: AccountStore = accountStorage()): Promise<void> {
  try {
    await localStore.setItem(key, JSON.stringify(value));
  } catch {
    // non-critical
  }
}

export async function loadUnlocksLocal(localStore: AccountStore = accountStorage()): Promise<UnlockMap> {
  return safeGet(KEYS.unlocks, {}, localStore);
}
export async function saveUnlocksLocal(unlocks: UnlockMap, localStore: AccountStore = accountStorage()) {
  return safeSet(KEYS.unlocks, unlocks || {}, localStore);
}

export async function loadProgressLocal(localStore: AccountStore = accountStorage()): Promise<ProgressMap> {
  return safeGet(KEYS.progress, {}, localStore);
}
export async function saveProgressLocal(progress: ProgressMap, localStore: AccountStore = accountStorage()) {
  return safeSet(KEYS.progress, progress || {}, localStore);
}

export async function loadFeaturedLocal(localStore: AccountStore = accountStorage()): Promise<string[]> {
  return safeGet(KEYS.featured, [], localStore);
}
export async function saveFeaturedLocal(featured: string[], localStore: AccountStore = accountStorage()) {
  const next = Array.isArray(featured) ? featured.slice(0, 3) : [];
  return safeSet(KEYS.featured, next, localStore);
}
