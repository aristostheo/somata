import AsyncStorage from "@react-native-async-storage/async-storage";

export type MealBuilderMealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snacks";

export type MealBuilderFoodItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;
  foodRefId?: string;
  source?: string;
  baseQty: number;
  baseCalories: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
  baseSugar?: number;
  baseFiber?: number;
  baseAddedSugar?: number;
  baseSatFat?: number;
  baseSodium?: number;
  baseWholeFoodRatio?: number;
  baseVeggieFruitServings?: number;
  baseUnsatFatRatio?: number;
  baseAlcoholCalories?: number;
};

export type MealBuilderDraft = {
  mealType: MealBuilderMealType;
  date: string;
  name: string;
  items: MealBuilderFoodItem[];
};

export type MealBuilderLoggedPayload = {
  entryKind: "meal";
  date: string;
  meal: MealBuilderMealType;
  name: string;
  items: MealBuilderFoodItem[];
  presetId?: string;
  source?: "meal-builder";
};

export type MealPreset = {
  id: string;
  name: string;
  mealType: MealBuilderMealType;
  items: MealBuilderFoodItem[];
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
};

export const PENDING_MEAL_BUILDER_LOG_KEY = "@pending_meal_builder_log_v1";
export const PENDING_MEAL_BUILDER_ADDITIONS_KEY =
  "@pending_meal_builder_additions_v1";

function storageKey(uid: string) {
  return `@meal_builder_presets:${uid}`;
}

function maybeScaled(value: number | undefined, ratio: number) {
  if (value == null || !Number.isFinite(Number(value))) return undefined;
  return round(Number(value) * ratio);
}

export function round(n: number) {
  return Math.round(n * 10) / 10;
}

export function mealItemId() {
  return `meal-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function presetId() {
  return `meal-preset-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function sumMealItems(items: MealBuilderFoodItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.calories += Number(item.calories || 0);
      acc.protein += Number(item.protein || 0);
      acc.carbs += Number(item.carbs || 0);
      acc.fat += Number(item.fat || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function applyQtyToMealItem(
  item: MealBuilderFoodItem,
  nextQtyRaw: number
): MealBuilderFoodItem {
  const nextQty = Number.isFinite(nextQtyRaw) ? Math.max(0, nextQtyRaw) : 0;
  const safeBaseQty = Number(item.baseQty || item.qty || 1) || 1;
  const ratio = nextQty / safeBaseQty;

  return {
    ...item,
    qty: round(nextQty),
    calories: round(Number(item.baseCalories || 0) * ratio),
    protein: round(Number(item.baseProtein || 0) * ratio),
    carbs: round(Number(item.baseCarbs || 0) * ratio),
    fat: round(Number(item.baseFat || 0) * ratio),
    sugar: maybeScaled(item.baseSugar, ratio),
    fiber: maybeScaled(item.baseFiber, ratio),
    addedSugar: maybeScaled(item.baseAddedSugar, ratio),
    satFat: maybeScaled(item.baseSatFat, ratio),
    sodium: maybeScaled(item.baseSodium, ratio),
    wholeFoodRatio: item.baseWholeFoodRatio,
    veggieFruitServings: maybeScaled(item.baseVeggieFruitServings, ratio),
    unsatFatRatio: item.baseUnsatFatRatio,
    alcoholCalories: maybeScaled(item.baseAlcoholCalories, ratio),
  };
}

export function createMealBuilderItem(args: {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;
  foodRefId?: string;
  source?: string;
}) {
  const qty = Number(args.qty || 1) || 1;
  return {
    id: args.id || mealItemId(),
    name: args.name,
    qty: round(qty),
    unit: args.unit || "serving",
    calories: round(Number(args.calories || 0)),
    protein: round(Number(args.protein || 0)),
    carbs: round(Number(args.carbs || 0)),
    fat: round(Number(args.fat || 0)),
    sugar: args.sugar != null ? round(Number(args.sugar)) : undefined,
    fiber: args.fiber != null ? round(Number(args.fiber)) : undefined,
    addedSugar:
      args.addedSugar != null ? round(Number(args.addedSugar)) : undefined,
    satFat: args.satFat != null ? round(Number(args.satFat)) : undefined,
    sodium: args.sodium != null ? round(Number(args.sodium)) : undefined,
    wholeFoodRatio:
      args.wholeFoodRatio != null ? Number(args.wholeFoodRatio) : undefined,
    veggieFruitServings:
      args.veggieFruitServings != null
        ? round(Number(args.veggieFruitServings))
        : undefined,
    unsatFatRatio:
      args.unsatFatRatio != null ? Number(args.unsatFatRatio) : undefined,
    alcoholCalories:
      args.alcoholCalories != null
        ? round(Number(args.alcoholCalories))
        : undefined,
    foodRefId: args.foodRefId,
    source: args.source,
    baseQty: round(qty),
    baseCalories: round(Number(args.calories || 0)),
    baseProtein: round(Number(args.protein || 0)),
    baseCarbs: round(Number(args.carbs || 0)),
    baseFat: round(Number(args.fat || 0)),
    baseSugar: args.sugar != null ? round(Number(args.sugar)) : undefined,
    baseFiber: args.fiber != null ? round(Number(args.fiber)) : undefined,
    baseAddedSugar:
      args.addedSugar != null ? round(Number(args.addedSugar)) : undefined,
    baseSatFat: args.satFat != null ? round(Number(args.satFat)) : undefined,
    baseSodium: args.sodium != null ? round(Number(args.sodium)) : undefined,
    baseWholeFoodRatio:
      args.wholeFoodRatio != null ? Number(args.wholeFoodRatio) : undefined,
    baseVeggieFruitServings:
      args.veggieFruitServings != null
        ? round(Number(args.veggieFruitServings))
        : undefined,
    baseUnsatFatRatio:
      args.unsatFatRatio != null ? Number(args.unsatFatRatio) : undefined,
    baseAlcoholCalories:
      args.alcoholCalories != null
        ? round(Number(args.alcoholCalories))
        : undefined,
  } satisfies MealBuilderFoodItem;
}

export async function writePendingMealBuilderLog(
  payload: MealBuilderLoggedPayload
) {
  await AsyncStorage.setItem(PENDING_MEAL_BUILDER_LOG_KEY, JSON.stringify(payload));
}

export async function readMealPresets(uid: string): Promise<MealPreset[]> {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as MealPreset[]) : [];
  } catch {
    return [];
  }
}

export async function saveMealPreset(
  uid: string,
  preset: Omit<MealPreset, "id" | "createdAt" | "updatedAt">
) {
  const current = await readMealPresets(uid);
  const now = Date.now();
  const nextPreset: MealPreset = {
    ...preset,
    id: presetId(),
    createdAt: now,
    updatedAt: now,
  };
  const next = [nextPreset, ...current].slice(0, 40);
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next));
  return nextPreset;
}
