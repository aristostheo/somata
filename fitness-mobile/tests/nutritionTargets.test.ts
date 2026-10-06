import test from "node:test";
import assert from "node:assert/strict";
import { nutritionTargets } from "../services/nutritionTargets";

const defaults = { calories: 2400, protein: 160, carbs: 260, fat: 70 };

test("accepted FitAdapt targets take precedence over every legacy goal field", () => {
  const profile = {
    goalResult: { dailyCalories: 2200, protein: 130, carbs: 280, fat: 60 },
    dailyCaloriesTarget: 2100, calorieGoal: 2000, dailyProteinTarget: 120,
    proteinGoal: 110, carbGoal: 250, fatGoal: 65,
    activeFitAdaptTargets: { calories: 2319, protein: 144, carbs: 290, fat: 64 },
  };
  assert.deepEqual(nutritionTargets(profile as any, defaults), profile.activeFitAdaptTargets);
});

test("missing active plan preserves saved goals and actual zero without inventing targets", () => {
  assert.deepEqual(nutritionTargets({ dailyCaloriesTarget: 0, dailyProteinTarget: 130 } as any, defaults),
    { calories: 0, protein: 130, carbs: 260, fat: 70 });
  assert.deepEqual(nutritionTargets(null, defaults), defaults);
});
