import type { FoodEntry } from "./nutrition";
import type { MealBuilderFoodItem } from "./mealBuilder";
import { sumMealItems } from "./mealTotals";

const extras = ["sugar", "fiber", "addedSugar", "satFat", "sodium", "wholeFoodRatio",
  "veggieFruitServings", "unsatFatRatio", "alcoholCalories"] as const;

function plainFood(raw: Record<string, unknown>, date: string, meal: string): Omit<FoodEntry, "id"> {
  const row: Omit<FoodEntry, "id"> = {
    date: String(raw.date || date), meal: String(raw.meal || meal),
    name: String(raw.name || "").trim(), unit: String(raw.unit || "serving"),
    qty: Number(raw.qty ?? 1), calories: Number(raw.calories || 0),
    protein: Number(raw.protein || 0), carbs: Number(raw.carbs || 0), fat: Number(raw.fat || 0),
  };
  for (const key of extras) if (raw[key] != null) (row as Record<string, unknown>)[key] = Number(raw[key]);
  if (raw.source != null) row.source = String(raw.source);
  if (!row.name || !Number.isFinite(row.qty) || row.qty <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
    [row.calories, row.protein, row.carbs, row.fat, ...extras.map(key => raw[key]).filter(value => value != null).map(Number)]
      .some(value => !Number.isFinite(value) || value < 0)) throw new Error("Invalid meal values. Reopen the meal editor.");
  return row;
}

export function projectPendingNutrition(raw: string, key: "@pending_add_meal" | "@pending_add_meal_batch_v1" | "@pending_meal_builder_log_v1", today: string) {
  const data = JSON.parse(raw) as Record<string, unknown>;
  if (!data || typeof data !== "object") return [];
  if (key === "@pending_add_meal") return [plainFood(data, today, "breakfast")];
  if (key === "@pending_add_meal_batch_v1") {
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item) => plainFood(item, String(data.date || today), String(data.meal || "breakfast")));
  }
  const items = Array.isArray(data.items) ? data.items as MealBuilderFoodItem[] : [];
  if (!items.length) return [];
  const totals = sumMealItems(items);
  const row = plainFood({ ...totals, name: data.name || "Saved meal", unit: "meal", qty: 1,
    date: data.date, meal: data.meal || "lunch", source: data.source || "meal-builder" }, today, "lunch");
  row.entryKind = "meal";
  row.items = items.map((item) => ({ ...item }));
  if (data.presetId) row.presetId = String(data.presetId);
  for (const key of extras) {
    if (key === "wholeFoodRatio" || key === "unsatFatRatio") continue;
    (row as Record<string, unknown>)[key] = items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  }
  return [row];
}

