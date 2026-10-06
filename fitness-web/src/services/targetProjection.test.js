import { withAcceptedTargets } from "./targetProjection";

test("web nutrition target readers receive accepted values over legacy profile goals", () => {
  const legacy = { calorieGoal: 2100, proteinGoal: 130, carbGoal: 250, fatGoal: 60 };
  const active = { calories: 2319, protein: 144, carbs: 290, fat: 64 };
  expect(withAcceptedTargets(legacy, { activeFitAdaptTargets: active })).toEqual({
    ...legacy, activeFitAdaptTargets: active,
    calorieGoal: 2319, dailyCaloriesTarget: 2319,
    proteinGoal: 144, dailyProteinTarget: 144, carbGoal: 290, fatGoal: 64,
  });
  expect(withAcceptedTargets(legacy, null)).toBe(legacy);
});
