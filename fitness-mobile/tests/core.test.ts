import assert from "node:assert/strict";
import test from "node:test";
import { dayKey, startOfWeek, endOfToday, labelDay } from "../utils/date";
import { kgToLb, lbToKg } from "../utils/units";
import { scaleNutrients, unscaleFromTotals } from "../utils/nutritionMath";
import { calculateGoalTargets, adjustTdeeFromCheckIn, type GoalsInputs } from "../services/goalsEngine";
import { getBadgeRules } from "../services/badges/rules";
import type { BadgeStatsSnapshot } from "../services/badges/types";

test("logging dates stay on the local day across UTC midnight and DST changes", () => {
  for (const [timestamp, expected] of [
    ["2026-10-05T02:30:00Z", "2026-10-04"],
    ["2026-03-08T04:30:00Z", "2026-03-07"],
    ["2026-11-01T05:30:00Z", "2026-11-01"],
    ["2026-11-01T06:30:00Z", "2026-11-01"],
  ]) assert.equal(dayKey(new Date(timestamp)), expected);
});

test("week ranges start Monday and include all of Sunday", () => {
  const sunday = new Date("2026-10-04T21:30:00-04:00");
  assert.equal(dayKey(startOfWeek(sunday)), "2026-09-28");
  const end = endOfToday(sunday);
  assert.equal(dayKey(end), "2026-10-04");
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMilliseconds(), 999);
  assert.equal(labelDay("2026-10-04"), "Sun");
});

test("changing display units preserves the stored workout weight", () => {
  for (const kg of [0, 2.5, 20, 100]) {
    assert.ok(Math.abs(lbToKg(kgToLb(kg)) - kg) < 1e-9);
  }
});

test("food amounts scale per 100 grams and per serving", () => {
  const base = { calories: 200, protein: 20, carbs: 24, fat: 4, sugar: 6, fiber: 2 };
  const half = scaleNutrients(base, 50, "g");
  assert.deepEqual(half, { calories: 100, protein: 10, carbs: 12, fat: 2, sugar: 3, fiber: 1 });
  assert.deepEqual(unscaleFromTotals(half, 50, "g"), base);
  assert.equal(scaleNutrients(base, 2, "serving").calories, 400);
  assert.equal(scaleNutrients(base, 0, "g").calories, 0);
});

const input: GoalsInputs = {
  sex: "male", age: 30, heightCm: 180, weightKg: 80,
  stepsPerDay: 8000, gymSessionsPerWeek: 4, mode: "maintain",
  aggressiveness: 0.5, trainingBias: 0.8, proteinBias: 0.5, metabolismAdaptation: 0,
};

test("goal modes put cut and bulk targets on the correct side of maintenance", () => {
  const maintain = calculateGoalTargets(input);
  assert.ok(calculateGoalTargets({ ...input, mode: "cut" }).calorieTarget < maintain.calorieTarget);
  assert.ok(calculateGoalTargets({ ...input, mode: "bulk" }).calorieTarget > maintain.calorieTarget);
});

test("training and rest day splits preserve the weekly calorie target", () => {
  for (const gymSessionsPerWeek of [0, 1, 4, 6, 7]) {
    const result = calculateGoalTargets({ ...input, gymSessionsPerWeek });
    const average = (result.trainingDayCalories * gymSessionsPerWeek + result.restDayCalories * (7 - gymSessionsPerWeek)) / 7;
    assert.ok(Math.abs(average - result.calorieTarget) <= 1);
    for (const macros of [result.trainingDayMacros, result.restDayMacros]) {
      assert.ok(Math.abs(macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9 - macros.calories) <= 9);
    }
  }
});

test("weekly check-ins leave TDEE unchanged when adaptation is disabled or progress matches", () => {
  const checkin = { currentTdee: 2500, actualKgPerWeek: -0.2, targetKgPerWeek: -0.5, metabolismAdaptation: 0 };
  assert.equal(adjustTdeeFromCheckIn(checkin), 2500);
  assert.equal(adjustTdeeFromCheckIn({ ...checkin, actualKgPerWeek: -0.5, metabolismAdaptation: 1 }), 2500);
  assert.ok(adjustTdeeFromCheckIn({ ...checkin, metabolismAdaptation: 1 }) < 2500);
});

test("streak and workout badges unlock only when their milestones are reached", () => {
  const stats: BadgeStatsSnapshot = {
    todayKey: "2026-10-04", weekKey: "2026-09-28", totalWorkoutsAllTime: 0,
    workoutsThisWeek: 0, workoutsStreakDays: 0, totalMealsAllTime: 0,
    mealsLoggedThisWeek: 0, proteinDaysThisWeek: 0, fiberDaysThisWeek: 0,
    stepsToday: 0, stepsDays10kThisWeek: 0,
  };
  const event = { type: "SNAPSHOT" as const, timestamp: 0, payload: {} };
  for (const [id, field, threshold] of [
    ["streak_3", "workoutsStreakDays", 3],
    ["streak_7", "workoutsStreakDays", 7],
    ["workout_10", "totalWorkoutsAllTime", 10],
  ] as const) {
    const rule = getBadgeRules().find((rule) => rule.id === id)!;
    assert.equal(rule.when({ event, stats: { ...stats, [field]: threshold - 1 }, unlocks: {} }), false);
    assert.equal(rule.when({ event, stats: { ...stats, [field]: threshold }, unlocks: {} }), true);
  }
});
