import test from 'node:test';
import assert from 'node:assert/strict';
import { appendScannedItems, BUILDER_ADDITIONS_KEY as KEY, BUILDER_HANDOFF_MAX_AGE_MS as TTL,
  createBuilderAdditionConsumer, queueBuilderAddition, type BuilderAddition } from '../services/mealBuilderHandoff';
import { createAccountStore, createAccountWriteFence, createUidKeyDriver, type AccountSession } from '../services/local/accountStoreCore';
import { ownedDeletionKeys } from '../services/account/deletionData';
import { migrateOwnedLocalData } from '../services/local/migrateLocalData';
const date = '2026-10-14', sessionId = 'builder-session-one', now = Date.parse(`${date}T12:00:00Z`);
const row = { name: 'Rice bowl', qty: 2, unit: 'serving', calories: 500, protein: 20, carbs: 80, fat: 10, sodium: 320, sugar: 0, source: 'scan' };
const payload = () => ({ date, meal: 'lunch', builderSessionId: sessionId, items: [{ ...row, date, meal: 'lunch' }] });
const key = `${KEY}:alice`;
function fixture() {
  const values = new Map<string, string>();
  let session: AccountSession = { uid: 'alice', generation: 1 };
  const storage = {
    async getItem(k: string) { return values.get(k) ?? null; },
    async setItem(k: string, value: string) { values.set(k, value); },
    async removeItem(k: string) { values.delete(k); },
  };
  const bind = () => createAccountStore(storage, { ...session }, () => session);
  const owner = bind();
  const consume = createBuilderAdditionConsumer(storage, owner, sessionId, () => now);
  return { values, storage, owner, bind, consume,
    queue: (input: object = payload(), id = 'delivery-synthetic-one', at = now) => queueBuilderAddition(storage, owner, input, id, at),
    switch(uid: string | null) { session = { uid, generation: session.generation + 1 }; } };
}
const active = () => true;
const never = () => assert.fail('No foods should be applied');
function mutate(f: ReturnType<typeof fixture>, update: (data: any) => void) {
  const data = JSON.parse(f.values.get(key)!); update(data); f.values.set(key, JSON.stringify(data));
}
test('scan imports reviewed totals without scaling, preserves distinct foods, and acknowledges only its owned queue', async () => {
  const f = fixture(); const input = payload(); input.items.push({ ...input.items[0], calories: 700, sodium: 410 });
  await f.queue(input); f.values.set(`${KEY}:bob`, 'bob'); let result!: BuilderAddition;
  assert.equal(await f.consume(date, active, data => { result = data; }), 'added');
  assert.equal(result.meal, 'lunch'); assert.equal(result.date, date);
  assert.deepEqual(result.items.map(({ id, ...food }) => food), [row, { ...row, calories: 700, sodium: 410 }]);
  assert.equal('fiber' in result.items[0], false);
  const existing = { ...result.items[0], id: 'existing-food', calories: 100 };
  const items = appendScannedItems([existing], result.items);
  assert.equal(items.length, 3); assert.equal(new Set(items.map(item => item.id)).size, 3);
  assert.deepEqual(appendScannedItems(items, result.items), items);
  assert.equal(f.values.has(key), false); assert.equal(f.values.get(`${KEY}:bob`), 'bob');
});
test('missing and blurred destinations stay silent; refocus receives a queued scan', async () => {
  const f = fixture(); assert.equal(await f.consume(date, active, never), 'missing'); await f.queue();
  assert.equal(await f.consume(date, () => false, never), 'inactive'); assert.ok(f.values.has(key));
  assert.equal(await f.consume(date, active, () => {}), 'added');
});
test('malformed and incomplete rows are discarded without partial import; real zero remains valid', async () => {
  const updates = [
    (d: any) => { delete d.items[0].protein; }, (d: any) => { d.items.push({}); },
    (d: any) => { d.items[0].qty = 0; }, (d: any) => { d.items[0].fat = -1; },
    (d: any) => { d.items[0].carbs = '20'; }, (d: any) => { d.items[0].calories = null; },
    (d: any) => { d.items[0].sodium = -2; }, (d: any) => { d.items[0].unit = ''; },
    (d: any) => { d.items[0].meal = 'dinner'; }, (d: any) => { d.items[0].date = '2026-10-13'; },
    (d: any) => { d.items = Array(101).fill(d.items[0]); }, (d: any) => { d.items[0].wholeFoodRatio = 2; },
  ];
  for (const update of updates) {
    const f = fixture(); await f.queue(); mutate(f, update);
    assert.equal(await f.consume(date, active, never), 'invalid'); assert.equal(f.values.has(key), false);
  }
  for (const raw of ['{broken json', 'null', '[]', 'x'.repeat(128 * 1024 + 1)]) {
    const f = fixture(); f.values.set(key, raw);
    assert.equal(await f.consume(date, active, never), 'invalid'); assert.equal(f.values.has(key), false);
  }
  const f = fixture(); const input = payload(); Object.assign(input.items[0], { calories: 0, protein: 0, carbs: 0, fat: 0 });
  await f.queue(input); await f.consume(date, active, d => assert.equal(d.items[0].calories, 0));
});
test('producer validates destination, date and content; concurrent confirms cannot replace pending food', async () => {
  const f = fixture();
  for (const input of [{ ...payload(), builderSessionId: '' }, { ...payload(), date: '2026-02-30' },
    { ...payload(), items: [{ ...row, qty: Infinity }] }]) await assert.rejects(f.queue(input), /cannot be transferred/);
  assert.equal(f.values.size, 0);
  const attempts = await Promise.allSettled([f.queue(), f.queue(payload(), 'delivery-synthetic-two')]);
  assert.deepEqual(attempts.map(x => x.status), ['fulfilled', 'rejected']);
  assert.equal(JSON.parse(f.values.get(key)!).deliveryId, 'delivery-synthetic-one');
});
test('expired, future-dated and legacy unstamped payloads are not imported', async () => {
  for (const timestamp of [now - TTL - 1, now + 30001, undefined]) {
    const f = fixture(); await f.queue(); mutate(f, d => { d.createdAt = timestamp; });
    assert.equal(await f.consume(date, active, never), 'expired'); assert.equal(f.values.has(key), false);
  }
});
test('a different meal date or remounted builder cannot consume an abandoned scan', async () => {
  const f = fixture(); await f.queue(); assert.equal(await f.consume('2026-10-15', active, never), 'stale');
  await f.queue(); const remounted = createBuilderAdditionConsumer(f.storage, f.owner, 'builder-session-two', () => now);
  assert.equal(await remounted(date, active, never), 'stale'); assert.equal(f.values.size, 0);
});
test('duplicate focus and replay after editing/deleting imported items cannot re-add foods', async () => {
  const f = fixture(); await f.queue(); const raw = f.values.get(key)!; let calls = 0;
  assert.deepEqual(await Promise.all([f.consume(date, active, () => calls++), f.consume(date, active, () => calls++)]), ['added', 'missing']);
  f.values.set(key, raw);
  assert.equal(await f.consume(date, active, never), 'duplicate'); assert.equal(calls, 1); assert.equal(f.values.size, 0);
});
test('failed cleanup retries without duplicating an already applied scan', async () => {
  const f = fixture(); await f.queue(); const remove = f.storage.removeItem;
  f.storage.removeItem = async () => { throw new Error('disk unavailable'); };
  let calls = 0; await assert.rejects(f.consume(date, active, () => calls++), /disk unavailable/);
  assert.ok(f.values.has(key)); f.storage.removeItem = remove;
  assert.equal(await f.consume(date, active, never), 'duplicate'); assert.equal(calls, 1); assert.equal(f.values.size, 0);
});
test('apply or storage failure preserves confirmation for retry', async () => {
  const f = fixture(); const set = f.storage.setItem;
  f.storage.setItem = async () => { throw new Error('disk unavailable'); };
  await assert.rejects(f.queue(), /disk unavailable/); assert.equal(f.values.size, 0);
  f.storage.setItem = set; await f.queue();
  await assert.rejects(f.consume(date, active, () => { throw new Error('apply failed'); }), /apply failed/);
  assert.ok(f.values.has(key)); assert.equal(await f.consume(date, active, () => {}), 'added');
});
test('sign-out and A→B→A invalidate old callbacks; B never reads A’s queue', async () => {
  const f = fixture(); await f.queue(); f.switch(null);
  await assert.rejects(f.consume(date, active, never), /Account changed/);
  await assert.rejects(queueBuilderAddition(f.storage, f.bind(), payload(), 'signed-out-delivery', now), /Account changed/);
  f.switch('bob'); const bob = createBuilderAdditionConsumer(f.storage, f.bind(), sessionId, () => now);
  assert.equal(await bob(date, active, never), 'missing'); await assert.rejects(f.queue(), /Account changed/);
  f.switch('alice'); await assert.rejects(f.consume(date, active, never), /Account changed/);
  const remounted = createBuilderAdditionConsumer(f.storage, f.bind(), 'new-alice-builder', () => now);
  assert.equal(await remounted(date, active, never), 'stale');
});
test('a read completing after sign-out, switch or blur cannot publish or delete data', async () => {
  for (const change of ['signout', 'switch', 'blur']) {
    const f = fixture(); await f.queue(); const get = f.storage.getItem; let visible = true;
    f.storage.getItem = async k => { const raw = await get(k); if (change === 'blur') visible = false; else f.switch(change === 'signout' ? null : 'bob'); return raw; };
    const result = f.consume(date, () => visible, never);
    if (change === 'blur') assert.equal(await result, 'inactive'); else await assert.rejects(result, /Account changed/);
    assert.ok(f.values.has(key));
  }
});
test('account switch during cleanup retains the original queue and leaves the new account untouched', async () => {
  const f = fixture(); await f.queue(); f.values.set(`${KEY}:bob`, 'bob private'); const get = f.storage.getItem; let reads = 0;
  f.storage.getItem = async k => { const value = await get(k); if (++reads === 2) f.switch('bob'); return value; };
  await assert.rejects(f.consume(date, active, () => {}), /Account changed/);
  assert.ok(f.values.has(key)); assert.equal(f.values.get(`${KEY}:bob`), 'bob private');
});
test('wrong-owner and unscoped payloads stay isolated; cleanup never removes a replacement', async () => {
  const f = fixture(); await f.queue(); const raw = f.values.get(key)!;
  f.values.set(KEY, raw); mutate(f, d => { d.ownerUid = 'bob'; }); const mismatched = f.values.get(key);
  assert.equal(await f.consume(date, active, never), 'private'); assert.equal(f.values.get(key), mismatched);
  f.values.set(key, raw);
  assert.equal(await f.consume(date, active, () => { f.values.set(key, 'newer value'); }), 'added');
  assert.equal(f.values.get(key), 'newer value'); assert.equal(f.values.get(KEY), raw);
});
test('legacy migration never fabricates a timestamp or fresh builder session', async () => {
  const f = fixture(); f.values.set(KEY, JSON.stringify({ ...payload(), ownerUid: 'alice', deliveryId: 'legacy-delivery' }));
  await migrateOwnedLocalData(f.storage, 'alice', f.owner.assertCurrent);
  assert.equal(f.values.has(KEY), false); assert.ok(f.values.has(key));
  assert.equal(await f.consume(date, active, never), 'expired');
});
test('deletion drains in-flight handoff writes and selects only this account’s queue', async () => {
  const f = fixture(); const fence = createAccountWriteFence(); let release!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { release = r; }), began = new Promise<void>(r => { started = r; });
  const driver = createUidKeyDriver({ ...f.storage, async setItem(k, value) { started(); await gate; await f.storage.setItem(k, value); } }, f.owner, fence);
  const write = queueBuilderAddition(driver, f.owner, payload(), 'pending-delivery', now); await began;
  let retired = false; const retiring = fence.retire('alice').then(() => { retired = true; });
  await Promise.resolve(); assert.equal(retired, false); release(); await write; await retiring;
  f.values.set(`${KEY}:bob`, 'bob'); f.values.set(KEY, 'legacy');
  for (const k of ownedDeletionKeys([...f.values.keys()], 'alice')) await f.storage.removeItem(k);
  assert.deepEqual([...f.values.keys()].sort(), [KEY, `${KEY}:bob`].sort());
  await assert.rejects(queueBuilderAddition(driver, f.owner, payload(), 'late-delivery', now), /cleanup has started/);
  await assert.rejects(driver.setItem(`${KEY}:bob`, 'bad'), /does not match/);
});
