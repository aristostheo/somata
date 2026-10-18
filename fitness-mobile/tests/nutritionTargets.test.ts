import test from "node:test";
import assert from "node:assert/strict";
import { acceptedNutritionTargets, nutritionTargets, remainingNutritionTargets, savedNutritionTargets } from "../services/nutritionTargets";

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

test("pending-only and invalid projections never replace legacy goals", () => {
  const saved = { dailyCaloriesTarget: 2100, dailyProteinTarget: 120, carbGoal: 230, fatGoal: 60 };
  const proposal = { calories: 2400, protein: 160, carbs: 270, fat: 75 };
  assert.deepEqual(nutritionTargets({ ...saved, pending: { targets: proposal } } as any),
    { calories: 2100, protein: 120, carbs: 230, fat: 60 });
  assert.deepEqual(nutritionTargets({ ...saved, activeFitAdaptTargets: { ...proposal, fat: NaN } } as any),
    { calories: 2100, protein: 120, carbs: 230, fat: 60 });
  assert.equal(acceptedNutritionTargets({ ...saved, activeFitAdaptTargets: { ...proposal, calories: 0 } } as any), null);
});

test("missing, invalid, and zero legacy fields remain distinct across aliases and units", () => {
  const profile = { weightUnit: "lb", dailyCaloriesTarget: "", calorieGoal: "2000", dailyProteinTarget: 0,
    carbGoal: -5, dailyCarbsTarget: "225", fatGoal: undefined, goalResult: { fat: 55 } };
  assert.deepEqual(savedNutritionTargets(profile as any), { calories: 2000, protein: 0, carbs: 225, fat: 55 });
  assert.deepEqual(nutritionTargets(profile as any), { calories: 2000, protein: 0, carbs: 225, fat: 55 });
  assert.equal(savedNutritionTargets({} as any).calories, undefined);
  assert.equal(nutritionTargets({ ...profile, weightUnit: "kg" } as any).calories, 2000);
});

test("accept changes remaining targets; decline and saved-goal edits leave an accepted plan active", () => {
  const logged = { calories: 900, protein: 40, carbs: 90, fat: 20 };
  const legacy = { dailyCaloriesTarget: 2000, dailyProteinTarget: 100, carbGoal: 220, fatGoal: 60 };
  const proposal = { calories: 2300, protein: 140, carbs: 260, fat: 70 };
  const before = nutritionTargets({ ...legacy, pending: { targets: proposal } } as any);
  assert.deepEqual(remainingNutritionTargets(before, logged), { calories: 1100, protein: 60, carbs: 130, fat: 40 });
  assert.deepEqual(nutritionTargets(legacy as any), before); // decline removes pending only
  const accepted = { ...legacy, activeFitAdaptTargets: proposal };
  assert.deepEqual(remainingNutritionTargets(nutritionTargets(accepted as any), logged),
    { calories: 1400, protein: 100, carbs: 170, fat: 50 });
  assert.deepEqual(nutritionTargets({ ...accepted, dailyCaloriesTarget: 1800 } as any), proposal);
});
