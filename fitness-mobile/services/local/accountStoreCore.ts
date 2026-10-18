/** No Firebase/native imports: the account boundary is exercised with an in-memory driver. */
export type LocalDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type AccountSession = { uid: string | null; generation: number };
export const accountLocalPrefix = (uid: string) => `@somata:account-local:v1:${encodeURIComponent(uid)}:`;
export const accountLocalKey = (uid: string, key: string) => accountLocalPrefix(uid) + encodeURIComponent(key);
export function createAccountStore(driver: LocalDriver, session: AccountSession, current: () => AccountSession) {
  const assertCurrent = () => {
    const actual = current();
    if (!session.uid || actual.uid !== session.uid || actual.generation !== session.generation)
      throw new Error('Account changed. Reopen this screen before continuing.');
  };
  return {
    uid: session.uid,
    assertCurrent,
    async getItem(key: string) {
      assertCurrent();
      const value = await driver.getItem(accountLocalKey(session.uid!, key));
      assertCurrent();
      return value;
    },
    async setItem(key: string, value: string) {
      assertCurrent();
      // Key is captured before awaiting, so an in-flight native write can only finish for its original owner.
      await driver.setItem(accountLocalKey(session.uid!, key), value);
      assertCurrent();
    },
    async removeItem(key: string) {
      assertCurrent();
      await driver.removeItem(accountLocalKey(session.uid!, key));
      assertCurrent();
    },
  };
}
export type AccountStore = ReturnType<typeof createAccountStore>;

/** Retain an established UID-suffixed key while sharing the account deletion write fence. */
export function createUidKeyDriver(driver: LocalDriver, owner: Pick<AccountStore, 'uid' | 'assertCurrent'>,
  fence: ReturnType<typeof createAccountWriteFence>): LocalDriver {
  const check = (key: string) => {
    owner.assertCurrent();
    if (!owner.uid || !key.endsWith(`:${owner.uid}`)) throw new Error('Account storage key does not match its owner.');
  };
  return {
    async getItem(key) { check(key); const value = await driver.getItem(key); check(key); return value; },
    async setItem(key, value) { check(key); await fence.run(owner.uid!, () => driver.setItem(key, value)); check(key); },
    async removeItem(key) { check(key); await driver.removeItem(key); check(key); },
  };
}

export function accountPhotoFolder(uid: string) {
  if (!uid) throw new Error('An account is required.');
  // Encode every UTF-16 code unit: even imported UIDs such as '..' cannot traverse a directory.
  return `somata-account-photos/${Array.from({ length: uid.length }, (_, i) => uid.charCodeAt(i).toString(16).padStart(4, '0')).join('')}/`;
}

/** Drain in-flight native writes before account cleanup; reject late callbacks thereafter. */
export function createAccountWriteFence() {
  const blocked = new Set<string>();
  const pending = new Map<string, Set<Promise<void>>>();
  return {
    blocked: (uid: string) => blocked.has(uid),
    run(uid: string, write: () => Promise<void>) {
      if (blocked.has(uid)) return Promise.reject(new Error('Account data cleanup has started.'));
      const promise = write();
      const entries = pending.get(uid) ?? new Set<Promise<void>>();
      pending.set(uid, entries); entries.add(promise);
      const finish = () => { entries.delete(promise); if (!entries.size) pending.delete(uid); };
      void promise.then(finish, finish);
      return promise;
    },
    async retire(uid: string) {
      blocked.add(uid);
      await Promise.allSettled(pending.get(uid) ?? []);
    },
  };
}
