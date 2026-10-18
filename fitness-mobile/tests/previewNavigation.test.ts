import assert from 'node:assert/strict';
import test from 'node:test';
import { previewDestination } from '../services/previewNavigation';
test('the former preview helper cannot route a current tab back to a comparison layout', () => {
  for (const enabled of [false, true]) {
    for (const tab of ['index', 'workouts', 'nutrition', 'notifications', 'profile']) {
      const path = `/(tabs)/${tab}`; assert.equal(previewDestination(path, enabled), path);
    }
    assert.equal(previewDestination('/design-preview/profile', enabled), '/(tabs)/profile');
    assert.equal(previewDestination('/friends', enabled), '/friends');
  }
});
