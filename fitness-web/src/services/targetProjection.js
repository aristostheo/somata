export function withAcceptedTargets(legacy, mobile) {
  if (!legacy) return null;
  const active = mobile?.activeFitAdaptTargets;
  const valid = active && [active.calories, active.protein, active.carbs, active.fat]
    .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return valid ? { ...legacy, activeFitAdaptTargets: active,
    calorieGoal: active.calories, dailyCaloriesTarget: active.calories,
    proteinGoal: active.protein, dailyProteinTarget: active.protein,
    carbGoal: active.carbs, fatGoal: active.fat } : legacy;
}
