// Matches the mobile fallback when users/{uid} has no saved value.
export const DEFAULT_NUTRITION_TARGETS = { calories: 2200, protein: 130, carbs: 260, fat: 70 };

function savedNumber(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

export function acceptedNutritionTargets(profile) {
  const active = profile?.activeFitAdaptTargets;
  if (!active || typeof active.calories !== "number" || !Number.isFinite(active.calories) || active.calories <= 0 ||
      ![active.protein, active.carbs, active.fat].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) return null;
  return { calories: active.calories, protein: active.protein, carbs: active.carbs, fat: active.fat };
}

const serverOwnedFields = ["activeFitAdaptTargets", "currentRecommendation", "pending", "adaptationHistory"];

export function withoutFitAdaptState(profile) {
  if (!profile || !serverOwnedFields.some((field) => Object.prototype.hasOwnProperty.call(profile, field))) return profile;
  const saved = { ...profile };
  for (const field of serverOwnedFields) delete saved[field];
  return saved;
}

export function savedNutritionTargets(profile) {
  return {
    calories: savedNumber(profile?.dailyCaloriesTarget, profile?.calorieGoal, profile?.caloriesGoal,
      profile?.kcalGoal, profile?.goalResult?.dailyCalories),
    protein: savedNumber(profile?.dailyProteinTarget, profile?.proteinGoal, profile?.protein_target,
      profile?.pGoal, profile?.goalResult?.protein),
    carbs: savedNumber(profile?.carbGoal, profile?.carbsGoal, profile?.dailyCarbsTarget,
      profile?.cGoal, profile?.goalResult?.carbs),
    fat: savedNumber(profile?.fatGoal, profile?.fatsGoal, profile?.dailyFatTarget,
      profile?.fGoal, profile?.goalResult?.fat),
  };
}

export function nutritionTargets(profile, defaults = DEFAULT_NUTRITION_TARGETS) {
  const active = acceptedNutritionTargets(profile);
  if (active) return active;
  const saved = savedNutritionTargets(profile);
  return {
    calories: saved.calories ?? defaults.calories,
    protein: saved.protein ?? defaults.protein,
    carbs: saved.carbs ?? defaults.carbs,
    fat: saved.fat ?? defaults.fat,
  };
}
