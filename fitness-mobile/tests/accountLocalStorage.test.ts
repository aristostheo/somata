import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore, accountLocalKey, accountPhotoFolder, createAccountWriteFence, type AccountSession } from '../services/local/accountStoreCore';
import { migrateOwnedLocalData } from '../services/local/migrateLocalData';
import { ownedDeletionKeys } from '../services/account/deletionData';
function fixture() {
  const values = new Map<string, string>();
  let session: AccountSession = { uid: 'alice', generation: 1 };
  const driver = {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
  return { values, driver, bind: () => createAccountStore(driver, { ...session }, () => session),
    switch(uid: string | null) { session = { uid, generation: session.generation + 1 }; } };
}
const stores = ['@body_metrics:v1', '@body_metrics_history:v1', 'bodyTwin:v1', 'progress_photos',
  'weekly_checkins_v1', '@water:2026-10-14', 'badges.unlocks.v1', 'exercises:recents:v1',
  'spark_history', 'integrations:v2', 'notification_settings', 'scheduled_notification_ids_v1', 'settings:v1'];
test('two accounts on one device never read each other’s local fitness stores; returning owner retains their data', async () => {
  const f = fixture(), alice = f.bind();
  for (const key of stores) await alice.setItem(key, `alice:${key}`);
  f.switch('bob'); const bob = f.bind();
  for (const key of stores) { assert.equal(await bob.getItem(key), null); await bob.setItem(key, `bob:${key}`); }
  f.switch('alice'); const returning = f.bind();
  for (const key of stores) assert.equal(await returning.getItem(key), `alice:${key}`);
  await assert.rejects(alice.setItem('spark_history', 'stale callback')); // A → B → A still invalidates original callbacks.
});
test('sign-out refuses local reads/writes and old screens cannot save into a newly signed-in account', async () => {
  const f = fixture(), old = f.bind(); f.switch(null);
  await assert.rejects(old.getItem('progress_photos'));
  await assert.rejects(f.bind().setItem('progress_photos', 'signed out'));
  f.switch('bob'); await assert.rejects(old.setItem('progress_photos', 'alice'));
  assert.equal(await f.bind().getItem('progress_photos'), null);
});
test('a native read that finishes after an account switch is rejected before presenting its result', async () => {
  let release!: (s: string) => void; let session: AccountSession = { uid: 'alice', generation: 1 };
  const store = createAccountStore({ getItem: () => new Promise<string>(r => { release = r; }), async setItem() {}, async removeItem() {} }, { ...session }, () => session);
  const read = store.getItem('history'); session = { uid: 'bob', generation: 2 }; release('alice-private');
  await assert.rejects(read);
});
test('an in-flight native write keeps its captured UID and never redirects to the new account', async () => {
  const f = fixture(); let release!: () => void; let session: AccountSession = { uid: 'alice', generation: 1 };
  const store = createAccountStore({ ...f.driver, async setItem(key, value) { await new Promise<void>(r => { release = r; }); f.values.set(key, value); } }, { ...session }, () => session);
  const write = store.setItem('history', 'private'); session = { uid: 'bob', generation: 2 }; release();
  await assert.rejects(write); assert.equal(f.values.get(accountLocalKey('alice', 'history')), 'private');
  assert.equal(f.values.has(accountLocalKey('bob', 'history')), false);
});
test('ambiguous legacy records stay byte-for-byte preserved and invisible to every account', async () => {
  const f = fixture(); for (const key of stores) f.values.set(key, 'unattributed legacy data');
  f.values.set('@pending_add_meal', JSON.stringify({ name: 'Old meal' }));
  for (const uid of ['alice', 'bob']) {
    f.switch(uid); const store = f.bind(); await migrateOwnedLocalData(f.driver, uid, store.assertCurrent);
    for (const key of stores) assert.equal(await store.getItem(key), null);
  }
  for (const key of stores) assert.equal(f.values.get(key), 'unattributed legacy data');
  assert.ok(f.values.has('@pending_add_meal'));
});
test('legacy confirmed meals migrate only for the explicit owner and preserve their idempotent delivery ID', async () => {
  const f = fixture(), key = '@pending_add_meal';
  const raw = JSON.stringify({ ownerUid: 'alice', deliveryId: 'delivery_12345', name: 'Synthetic meal' });
  f.values.set(key, raw); f.switch('bob'); await migrateOwnedLocalData(f.driver, 'bob', f.bind().assertCurrent);
  assert.equal(f.values.get(key), raw); assert.equal(f.values.has(`${key}:bob`), false);
  f.switch('alice'); await migrateOwnedLocalData(f.driver, 'alice', f.bind().assertCurrent);
  assert.equal(f.values.get(`${key}:alice`), raw); assert.equal(f.values.has(key), false);
  await migrateOwnedLocalData(f.driver, 'alice', f.bind().assertCurrent); assert.equal(f.values.get(`${key}:alice`), raw);
});
test('migration never replaces existing owned data or accepts malformed/ambiguous ownership', async () => {
  const f = fixture(), key = '@pending_add_meal'; f.values.set(`${key}:alice`, 'already saved');
  for (const raw of ['bad JSON', 'null', JSON.stringify({ uid: 'alice', deliveryId: 'delivery_12345' }), JSON.stringify({ ownerUid: 'alice' }), JSON.stringify({ ownerUid: 'alice', deliveryId: 'delivery_12345' })]) {
    f.values.set(key, raw); await migrateOwnedLocalData(f.driver, 'alice', f.bind().assertCurrent);
    assert.equal(f.values.get(key), raw); assert.equal(f.values.get(`${key}:alice`), 'already saved');
  }
});
test('migration can resume after partial copy/removal failure without losing or duplicating the payload', async () => {
  const f = fixture(), key = '@pending_add_meal'; const raw = JSON.stringify({ ownerUid: 'alice', deliveryId: 'delivery_12345' }); f.values.set(key, raw);
  await assert.rejects(migrateOwnedLocalData({ ...f.driver, async removeItem() { throw Error('disk unavailable'); } }, 'alice', f.bind().assertCurrent));
  assert.equal(f.values.get(key), raw); assert.equal(f.values.get(`${key}:alice`), raw);
  await migrateOwnedLocalData(f.driver, 'alice', f.bind().assertCurrent); assert.equal(f.values.has(key), false);
});
test('deletion selects all new scoped records and existing UID stores but preserves other users and quarantined legacy data', async () => {
  const f = fixture();
  for (const uid of ['alice', 'alice-other', 'bob']) {
    f.switch(uid); for (const key of stores) await f.bind().setItem(key, uid);
    for (const key of ['workout:draft:', 'workout:referenceSeed:', '@body_twin_v1:', '@pending_meal_builder_additions_v1:']) f.values.set(key + uid, uid);
  }
  f.values.set('@body_metrics_history:v1', 'ambiguous'); f.values.set('@theme:mode', 'dark');
  for (const key of ownedDeletionKeys([...f.values.keys()], 'alice')) f.values.delete(key);
  assert.equal([...f.values.values()].includes('alice'), false);
  assert.ok([...f.values.values()].includes('bob')); assert.ok([...f.values.values()].includes('alice-other'));
  assert.equal(f.values.get('@body_metrics_history:v1'), 'ambiguous'); assert.equal(f.values.get('@theme:mode'), 'dark');
});
test('photo cleanup directories cannot overlap accounts or escape the app-owned photo root', () => {
  for (const uid of ['alice', 'alice-other', '..', '../bob', 'a/b', 'a%2Fb']) {
    assert.match(accountPhotoFolder(uid), /^somata-account-photos\/[0-9a-f]+\/$/);
  }
  assert.notEqual(accountPhotoFolder('a/b'), accountPhotoFolder('a%2Fb'));
  assert.equal(accountPhotoFolder('alice-other').startsWith(accountPhotoFolder('alice')), false);
});
test('deletion drains an account’s in-flight writes and refuses later callbacks without freezing another account', async () => {
  const fence = createAccountWriteFence(); let release!: () => void; let drained = false;
  const pending = fence.run('alice', () => new Promise<void>(r => { release = r; }));
  const retirement = fence.retire('alice').then(() => { drained = true; }); await Promise.resolve(); assert.equal(drained, false);
  await assert.rejects(fence.run('alice', async () => {})); await fence.run('bob', async () => {});
  release(); await pending; await retirement; assert.equal(drained, true);
});

test('migration aborts an account switch during a legacy read before copying anything', async () => {
  const f = fixture(); const owner = f.bind(); let first = true;
  const driver = { ...f.driver, async getItem(key: string) {
    if (first) { first = false; f.switch('bob'); return JSON.stringify({ ownerUid: 'alice', deliveryId: 'delivery_12345' }); }
    return f.driver.getItem(key);
  } };
  await assert.rejects(migrateOwnedLocalData(driver, 'alice', owner.assertCurrent));
  assert.equal(f.values.size, 0);
});

test('ownerless legacy notifications and another account’s notification cannot display or navigate', async () => {
  const { notificationBelongsToAccount } = await import('../services/local/notificationOwnership');
  assert.equal(notificationBelongsToAccount('alice', { ownerUid: 'alice', type: 'pr' }), true);
  assert.equal(notificationBelongsToAccount('bob', { ownerUid: 'alice', type: 'pr' }), false);
  assert.equal(notificationBelongsToAccount(null, { ownerUid: 'alice' }), false);
  assert.equal(notificationBelongsToAccount('alice', { type: 'pr' }), false);
});
