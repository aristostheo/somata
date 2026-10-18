import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalDestination } from '../lib/canonicalDestination';
test('retired previews enter the default five tabs and preserve action parameters', () => {
  assert.equal(canonicalDestination('/dashboard-preview'), '/(tabs)');
  assert.equal(canonicalDestination('/design-preview'), '/(tabs)');
  for (const tab of ['workouts', 'nutrition', 'notifications', 'profile'])
    assert.equal(canonicalDestination(`/design-preview/${tab}?activity=1#detail`), `/(tabs)/${tab}?activity=1#detail`);
});
test('feature, auth, acceptance and current tab destinations are unchanged', () => {
  for (const path of ['/(tabs)/nutrition', '/fitadapt-setup', '/(auth)/login', '/profile/fitadapt-insights', '/workouts/session?sessionId=abc', '/(modals)/scan-meal?date=2026-10-11'])
    assert.equal(canonicalDestination(path), path);
});
