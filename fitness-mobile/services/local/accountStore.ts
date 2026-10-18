import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { auth } from '@/lib/firebase';
import { createAccountStore, createAccountWriteFence, createUidKeyDriver, type AccountStore } from './accountStoreCore';
export type { AccountStore } from './accountStoreCore';
const writeFence = createAccountWriteFence();
let generation = 0;
let observedUid: string | null | undefined;
export function accountSessionChanged(uid: string | null) {
  if (uid !== observedUid) { observedUid = uid; generation++; }
}
function currentSession() {
  const uid = auth.currentUser?.uid ?? null;
  accountSessionChanged(uid);
  return { uid: uid && !writeFence.blocked(uid) ? uid : null, generation };
}
export function accountStorage(): AccountStore {
  const session = currentSession();
  return createAccountStore({
    getItem: key => AsyncStorage.getItem(key),
    removeItem: key => AsyncStorage.removeItem(key),
    setItem: (key, value) => writeFence.run(session.uid!, () => AsyncStorage.setItem(key, value)),
  }, session, currentSession);
}
/** Bound to this mounted account screen, including callbacks that finish after a switch. */
export function useAccountStorage() {
  return useMemo(accountStorage, []);
}

export const retireAccountLocalStorage = (uid: string) => writeFence.retire(uid);
export const accountUidKeyStorage = (owner: AccountStore) => createUidKeyDriver(AsyncStorage, owner, writeFence);
