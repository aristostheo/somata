import assert from "node:assert/strict";
import test from "node:test";

import {
  recordedStepsForDate,
  recordedWeights,
  weightTrendPath,
} from "../components/profile/overviewData";

test("weight trend uses only valid recorded measurements on distinct local days", () => {
  const day1 = new Date(2026, 9, 1, 8).getTime();
  const day1Later = new Date(2026, 9, 1, 20).getTime();
  const day2 = new Date(2026, 9, 2, 8).getTime();
  const points = recordedWeights([
    { t: day2, weightLb: 175 },
    { t: day1, weightLb: 180 },
    { t: day1Later, weightLb: 178 },
    { t: day2 + 1000, weightLb: 0 },
    { t: Number.NaN, weightLb: 140 },
  ]);
  assert.deepEqual(points.map((point) => point.weightLb), [178, 175]);
  assert.equal(weightTrendPath(points.map((point) => point.weightLb))?.startsWith("M"), true);
});

test("a generated trend is never drawn with fewer than two real points", () => {
  assert.equal(weightTrendPath([]), null);
  assert.equal(weightTrendPath([175]), null);
  assert.equal(weightTrendPath([175, Number.NaN]), null);
});

test("today's missing steps differ from a recorded zero", () => {
  const today = new Date(2026, 9, 5, 12);
  assert.equal(recordedStepsForDate({}, today), null);
  assert.equal(recordedStepsForDate({ "2026-10-05": 0 }, today), 0);
  assert.equal(recordedStepsForDate({ "2026-10-05": 4321 }, today), 4321);
  assert.equal(recordedStepsForDate({ "2026-10-05": -3 }, today), null);
});
