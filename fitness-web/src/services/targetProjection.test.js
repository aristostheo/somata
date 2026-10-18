import { acceptedNutritionTargets, nutritionTargets, savedNutritionTargets, withoutFitAdaptState } from "./targetProjection";

test("canonical users/{uid} goals match mobile fallback precedence and units", () => {
  const profile = { weightUnit: "lb", dailyCaloriesTarget: "", calorieGoal: "2000",
    dailyProteinTarget: 0, carbGoal: -5, dailyCarbsTarget: "225", fatGoal: undefined,
    goalResult: { fat: 55 } };
  expect(savedNutritionTargets(profile)).toEqual({ calories: 2000, protein: 0, carbs: 225, fat: 55 });
  expect(nutritionTargets(profile)).toEqual({ calories: 2000, protein: 0, carbs: 225, fat: 55 });
  expect(nutritionTargets({ ...profile, weightUnit: "kg" })).toEqual(nutritionTargets(profile));
  expect(savedNutritionTargets({}).calories).toBeUndefined();
  expect(nutritionTargets(null)).toEqual({ calories: 2200, protein: 130, carbs: 260, fat: 70 });
});

test("accepted target wins; pending-only, invalid projection and decline retain saved goals", () => {
  const legacy = { dailyCaloriesTarget: 2100, dailyProteinTarget: 120, carbGoal: 230, fatGoal: 60 };
  const proposal = { calories: 2300, protein: 140, carbs: 250, fat: 70 };
  expect(nutritionTargets({ ...legacy, pending: { targets: proposal } })).toEqual({
    calories: 2100, protein: 120, carbs: 230, fat: 60,
  });
  expect(nutritionTargets(legacy)).toEqual(nutritionTargets({ ...legacy, pending: null }));
  expect(nutritionTargets({ ...legacy, activeFitAdaptTargets: proposal })).toEqual(proposal);
  expect(nutritionTargets({ ...legacy, dailyCaloriesTarget: 1800, activeFitAdaptTargets: proposal })).toEqual(proposal);
  expect(nutritionTargets({ ...legacy, activeFitAdaptTargets: { ...proposal, calories: 0 } })).toEqual(nutritionTargets(legacy));
  expect(acceptedNutritionTargets({ activeFitAdaptTargets: { ...proposal, fat: null } })).toBeNull();
});

test("client write sanitization removes every FitAdapt-owned field", () => {
  const fields = { activeFitAdaptTargets: { calories: 9999 }, currentRecommendation: {}, pending: {},
    adaptationHistory: [], calorieGoal: 2050 };
  expect(withoutFitAdaptState(fields)).toEqual({ calorieGoal: 2050 });
});
