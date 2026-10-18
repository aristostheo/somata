const test = require('node:test');
const assert = require('node:assert/strict');
const { getSummary, setSharing } = require('../lib/friends/service');
test('friend boundary validates identity and exact request fields before accessing data', async () => {
  const db = { runTransaction() { throw new Error('Must not access Firestore'); } };
  for (const operation of [getSummary, setSharing]) {
    await assert.rejects(operation(db, undefined, { friendUid: 'friend' }), e => e.code === 'unauthenticated');
    for (const body of [null, [], { friendUid: '../other' }, { friendUid: 'friend', uid: 'spoof' }, { friendUid: 'x'.repeat(129) }])
      await assert.rejects(operation(db, 'owner', body), e => e.code === 'invalid-argument');
  }
  for (const endDate of ['bad', '2000-01-01', '2026-02-30', 42])
    await assert.rejects(getSummary(db, 'owner', { friendUid: 'friend', endDate }), e => e.code === 'invalid-argument');
  for (const enabled of [null, 'true', 1]) await assert.rejects(setSharing(db, 'owner', { friendUid: 'friend', enabled }), e => e.code === 'invalid-argument');
  await assert.rejects(setSharing(db, 'owner', { friendUid: 'owner', enabled: true }), e => e.code === 'invalid-argument');
});
