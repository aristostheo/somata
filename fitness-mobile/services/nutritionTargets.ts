import type { Profile } from "./profile";

export type NutritionTargets = { calories: number; protein: number; carbs: number; fat: number };

// Used only when a saved goal is absent. Targets are always kcal and grams;
// weight-unit preferences do not change them.
export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2200, protein: 130, carbs: 260, fat: 70,
};

function savedNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

export function acceptedNutritionTargets(profile: Profile | null | undefined): NutritionTargets | null {
  const active = profile?.activeFitAdaptTargets;
  if (!active || typeof active.calories !== "number" || !Number.isFinite(active.calories) || active.calories <= 0 ||
      ![active.protein, active.carbs, active.fat].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) return null;
  return { calories: active.calories, protein: active.protein, carbs: active.carbs, fat: active.fat };
}

export function savedNutritionTargets(profile: Profile | null | undefined): Partial<NutritionTargets> {
  const p = profile as (Profile & Record<string, unknown>) | null | undefined;
  return {
    calories: savedNumber(p?.dailyCaloriesTarget, p?.calorieGoal, p?.caloriesGoal, p?.kcalGoal, p?.goalResult?.dailyCalories),
    protein: savedNumber(p?.dailyProteinTarget, p?.proteinGoal, p?.protein_target, p?.pGoal, p?.goalResult?.protein),
    carbs: savedNumber(p?.carbGoal, p?.carbsGoal, p?.dailyCarbsTarget, p?.cGoal, p?.goalResult?.carbs),
    fat: savedNumber(p?.fatGoal, p?.fatsGoal, p?.dailyFatTarget, p?.fGoal, p?.goalResult?.fat),
  };
}

export function nutritionTargets(profile: Profile | null | undefined, defaults: NutritionTargets = DEFAULT_NUTRITION_TARGETS): NutritionTargets {
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

export function remainingNutritionTargets(targets: NutritionTargets, consumed: NutritionTargets): NutritionTargets {
  return {
    calories: Math.max(0, Math.round(targets.calories - consumed.calories)),
    protein: Math.max(0, Math.round(targets.protein - consumed.protein)),
    carbs: Math.max(0, Math.round(targets.carbs - consumed.carbs)),
    fat: Math.max(0, Math.round(targets.fat - consumed.fat)),
  };
}
