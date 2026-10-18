import assert from "node:assert/strict";
import test from "node:test";
import { measuredChange, measuredTrendPath, recordedNutritionDays, recordedStepDays,
  recordedWeightDays } from "../services/profile/fitadaptInsightData";

test("trends use only dated account measurements; missing and zero are distinct", () => {
  const from = "2026-10-01"; const to = "2026-10-09";
  const weights = recordedWeightDays([{ date: "2026-10-03", weightKg: 71 },
    { date: "2026-10-01", weightKg: 72 }, { date: "2026-09-30", weightKg: 73 },
    { date: "2026-10-04", weightKg: 0 }], from, to);
  assert.deepEqual(weights.map((row) => row.date), ["2026-10-01", "2026-10-03"]);
  assert.equal(measuredChange(weights), -1);
  assert.ok(measuredTrendPath(weights)?.startsWith("M"));
  assert.equal(measuredTrendPath(weights.slice(0, 1)), null);

  assert.deepEqual(recordedStepDays({ "2026-10-01": 0, "2026-10-02": "2400",
    "2026-10-03": null, "2026-10-04": -2, "2026-09-30": 4000 }, from, to),
  [{ date: "2026-10-01", value: 0 }, { date: "2026-10-02", value: 2400 }]);
});

test("logged nutrition omits absent days and leaves incomplete days unknown", () => {
  const days = recordedNutritionDays([
    { date: "2026-10-01", calories: 300 }, { date: "2026-10-01", calories: 0 },
    { date: "2026-10-02", calories: 500 }, { date: "2026-10-02", calories: null },
    { date: "2026-10-03", calories: -1 }, { date: "2026-09-30", calories: 900 },
  ], "2026-10-01", "2026-10-09");
  assert.deepEqual(days, [
    { date: "2026-10-01", entries: 2, calories: 300 },
    { date: "2026-10-02", entries: 2, calories: null },
    { date: "2026-10-03", entries: 1, calories: null },
  ]);
  assert.equal(days.find((row) => row.date === "2026-10-04"), undefined);
  assert.equal(measuredTrendPath(days.filter((row) => row.calories !== null)
    .map((row) => ({ date: row.date, value: row.calories! }))), null);
});
