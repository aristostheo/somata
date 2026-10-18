import { accountStorage, type AccountStore } from '@/services/local/accountStore';
// services/bodyTwin/storage.ts
import type { BodyTwinState } from "./types";

const KEY = "bodyTwin:v1";

export async function loadBodyTwinState(localStore: AccountStore = accountStorage()): Promise<BodyTwinState | null> {
  try {
    const raw = await localStore.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BodyTwinState;
  } catch {
    return null;
  }
}

export async function saveBodyTwinState(state: BodyTwinState, localStore: AccountStore = accountStorage()): Promise<void> {
  try {
    await localStore.setItem(KEY, JSON.stringify(state));
  } catch {
    // swallow to avoid breaking UI
  }
}

export async function clearBodyTwinState(localStore: AccountStore = accountStorage()): Promise<void> {
  try {
    await localStore.removeItem(KEY);
  } catch {}
}
