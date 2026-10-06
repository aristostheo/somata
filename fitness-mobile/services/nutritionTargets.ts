import type { Profile } from "./profile";

export type NutritionTargets = { calories: number; protein: number; carbs: number; fat: number };
export function nutritionTargets(profile: Profile | null | undefined, defaults: NutritionTargets): NutritionTargets {
  const active = profile?.activeFitAdaptTargets;
  if (active && [active.calories, active.protein, active.carbs, active.fat]
    .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) return active;
  return {
    calories: Number(profile?.dailyCaloriesTarget ?? profile?.calorieGoal ?? defaults.calories),
    protein: Number(profile?.dailyProteinTarget ?? profile?.proteinGoal ?? defaults.protein),
    carbs: Number(profile?.carbGoal ?? defaults.carbs),
    fat: Number(profile?.fatGoal ?? defaults.fat),
  };
}
