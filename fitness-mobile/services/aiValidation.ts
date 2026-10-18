import type { ScanMealResult, Portion, Confidence } from "./scanMeal/types";
const invalid = () => new Error("AI returned incomplete or invalid estimates. Please try again with more detail.");
export function validNutrient(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) throw invalid();
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw invalid();
  return number;
}
export function validateMealEstimate(item: Record<string, unknown>) {
  for (const key of ["calories", "protein", "carbs", "fat"] as const) validNutrient(item?.[key]);
  for (const key of ["sugar", "fiber", "satFat", "sodium", "sodiumMg", "addedSugar"])
    if (item?.[key] != null) validNutrient(item[key]);
}
export function validateScanResult(value: any): ScanMealResult {
  if (!Array.isArray(value?.foods) || !value.foods.length || value.foods.length > 6) throw invalid();
  return { foods: value.foods.map((food: any, index: number) => {
    if (typeof food?.name !== "string" || !food.name.trim()) throw invalid();
    const macros = food.macros ?? food;
    validateMealEstimate(macros);
    const portion = food.portion;
    if (!portion || validNutrient(portion.amount) <= 0 || validNutrient(portion.multiplier) <= 0 ||
      !["g", "oz", "cups", "tbsp", "piece"].includes(portion.unit)) throw invalid();
    const confidence = food.confidence === "medium" ? "med" : food.confidence;
    if (!["high", "med", "low", "manual"].includes(confidence)) throw invalid();
    return { id: `food_${index}`, name: food.name.trim(), confidence: confidence as Confidence,
      portion: { amount: Number(portion.amount), multiplier: Number(portion.multiplier), unit: portion.unit } as Portion,
      macros: Object.fromEntries(["calories", "protein", "carbs", "fat", "fiber", "sugar", "sodiumMg", "satFat"]
        .filter(key => macros[key] != null).map(key => [key, validNutrient(macros[key])])),
      suggestions: Array.isArray(food.suggestions) ? food.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 4) : [],
    };
  }) };
}
export function validateGeneratedWorkout(value: any): void {
  if (!value || typeof value.name !== "string" || !value.name.trim() ||
    !Number.isFinite(value.duration) || value.duration <= 0 ||
    !Number.isFinite(value.estimatedCalories) || value.estimatedCalories < 0 ||
    !Array.isArray(value.exercises) || !value.exercises.length) throw invalid();
  for (const exercise of value.exercises) {
    if (!exercise || !Number.isInteger(exercise.sets) || exercise.sets <= 0) throw invalid();
    if (exercise.alternatives != null && (!Array.isArray(exercise.alternatives) ||
      exercise.alternatives.some((item: unknown) => typeof item !== "string"))) throw invalid();
    for (const key of ["name", "reps", "rest", "weight", "muscleGroup"])
      if (typeof exercise[key] !== "string" || !exercise[key].trim()) throw invalid();
  }
  for (const key of ["warmup", "cooldown"]) {
    if (!Array.isArray(value[key])) throw invalid();
    for (const item of value[key]) if (typeof item?.exercise !== "string" || typeof item?.duration !== "string") throw invalid();
  }
}
