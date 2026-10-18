import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FRIEND_VISIBILITY, getFriendVisibility, isFriendSharingAnything, friendTrendLabel } from "../services/friends/visibility";

test("unavailable or denied friend profile fails closed instead of enabling sharing defaults", () => {
  for (const profile of [null, undefined]) {
    const visibility = getFriendVisibility(profile);
    assert.equal(visibility.enabled, false);
    for (const section of [visibility.nutrition, visibility.workouts, visibility.progress, visibility.activity]) {
      assert.ok(Object.values(section!).every(value => value === false));
    }
    assert.equal(isFriendSharingAnything(profile), false);
    assert.equal(friendTrendLabel(profile), null);
  }
});

test("loaded owner profile retains saved choices and existing default preferences", () => {
  assert.deepEqual(getFriendVisibility({}), DEFAULT_FRIEND_VISIBILITY);
  const profile = { friendVisibility: { enabled: false, nutrition: { macroBreakdown: true } } };
  assert.equal(getFriendVisibility(profile).nutrition?.macroBreakdown, true);
  assert.equal(isFriendSharingAnything(profile), false);
});

import { getSavedFriendVisibility } from "../services/friends/visibility";
test("summary consent uses only explicitly saved true choices, never suggested defaults", () => {
  assert.deepEqual(getSavedFriendVisibility({}), getFriendVisibility(null));
  assert.deepEqual(getSavedFriendVisibility(undefined), getFriendVisibility(null));
  const saved = getSavedFriendVisibility({ friendVisibility: { enabled: true, nutrition: { macroBreakdown: true, mealsLoggedToday: false } } });
  assert.equal(saved.enabled, true);
  assert.equal(saved.nutrition?.macroBreakdown, true);
  assert.equal(saved.nutrition?.mealsLoggedToday, false);
  assert.equal(saved.progress?.badgeCollection, false);
});
