import { legacyProfilePatch, matchingPatchFields, selectedFields } from "./legacyProfileImport";

test("only known valid web fields are selected, preserving zero and canonical kg", () => {
  const patch = legacyProfilePatch({ dailyCaloriesTarget: "", calorieGoal: "2050", proteinGoal: 0,
    carbGoal: 235, fatGoal: 60, weightKg: 72, weightUnit: "lb", age: 30,
    sex: "female", activityLevel: "moderate", goal: "cut", proteinPerKg: 1.8,
    targetMode: "proteinPerKg", email: "private@example.test", photoURL: "private",
    activeFitAdaptTargets: { calories: 9999 }, currentRecommendation: { targets: {} } });
  expect(patch).toEqual({ dailyCaloriesTarget: 2050, calorieGoal: 2050,
    dailyProteinTarget: 0, proteinGoal: 0, carbGoal: 235, fatGoal: 60,
    sex: "female", age: 30, weightKg: 72, weightUnit: "lb", activityLevel: "moderate",
    goal: "cut", proteinPerKg: 1.8, targetMode: "proteinPerKg" });
  expect(patch.weightKg).toBe(72);
  expect(patch).not.toHaveProperty("email");
  expect(patch).not.toHaveProperty("activeFitAdaptTargets");
});

test("invalid measurements, target values and incomplete percentage splits are not imported", () => {
  expect(legacyProfilePatch({ calorieGoal: Infinity, proteinGoal: -1, carbGoal: null,
    fatGoal: "", age: 15, heightCm: 20, weightKg: 500, sex: "other", weightUnit: "stone",
    targetMode: "percent", proteinPct: 0.3, carbPct: 0.4, fatPct: 0.2 })).toEqual({});
  expect(legacyProfilePatch({ targetMode: "percent", proteinPct: 0.3, carbPct: 0.4, fatPct: 0.3 }))
    .toEqual({ proteinPct: 0.3, carbPct: 0.4, fatPct: 0.3, targetMode: "percent" });
});

test("candidate comparison detects stale mobile edits without treating missing as zero", () => {
  const patch = { calorieGoal: 0, proteinGoal: 120 };
  expect(selectedFields({ proteinGoal: 120 }, patch)).toEqual({ calorieGoal: undefined, proteinGoal: 120 });
  expect(matchingPatchFields({ calorieGoal: 0, proteinGoal: 120 }, patch)).toBe(true);
  expect(matchingPatchFields({ proteinGoal: 120 }, patch)).toBe(false);
});
