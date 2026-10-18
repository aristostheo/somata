import { accountStorage, type AccountStore } from "@/services/local/accountStore";
import { DayLog, MealItem, MealType, Macros } from "./NutritionTypes";
import { dateKey } from "./utils";

const KEY_PREFIX = "nutrition:day:";

function defaultDay(dateKeyStr: string): DayLog {
  return {
    dateKey: dateKeyStr,
    meals: [],
    waterMl: 0,
    waterGoalMl: 2500,
    macroGoals: { calories: 2400, protein: 170, carbs: 260, fat: 70 },
  };
}

export async function loadDay(dateKeyStr?: string, localStore: AccountStore = accountStorage()): Promise<DayLog> {
  const key = KEY_PREFIX + (dateKeyStr || dateKey(new Date()));
  const raw = await localStore.getItem(key);
  if (!raw) return defaultDay(key.replace(KEY_PREFIX, ""));
  try {
    const parsed = JSON.parse(raw) as DayLog;
    return {
      ...defaultDay(parsed.dateKey),
      ...parsed,
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
    };
  } catch {
    return defaultDay(key.replace(KEY_PREFIX, ""));
  }
}

export async function saveDay(day: DayLog, localStore: AccountStore = accountStorage()) {
  const key = KEY_PREFIX + day.dateKey;
  await localStore.setItem(key, JSON.stringify(day));
}

export function createMeal(params: {
  name: string;
  brand?: string;
  amount?: string;
  mealType: MealType;
  macros: Macros;
  notes?: string;
  at?: Date;
}): MealItem {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const timeISO = (params.at ?? new Date()).toISOString();
  return {
    id,
    name: params.name.trim(),
    brand: params.brand?.trim() || undefined,
    amount: params.amount?.trim() || undefined,
    mealType: params.mealType,
    timeISO,
    macros: {
      calories: Number(params.macros.calories) || 0,
      protein: Number(params.macros.protein) || 0,
      carbs: Number(params.macros.carbs) || 0,
      fat: Number(params.macros.fat) || 0,
    },
    notes: params.notes?.trim() || undefined,
  };
}

export async function addMeal(dateKeyStr: string, meal: MealItem, localStore: AccountStore = accountStorage()) {
  const day = await loadDay(dateKeyStr, localStore);
  day.meals = [meal, ...day.meals].sort((a, b) =>
    a.timeISO < b.timeISO ? 1 : -1
  );
  await saveDay(day, localStore);
  return day;
}

export async function deleteMeal(dateKeyStr: string, mealId: string, localStore: AccountStore = accountStorage()) {
  const day = await loadDay(dateKeyStr, localStore);
  day.meals = day.meals.filter((m) => m.id !== mealId);
  await saveDay(day, localStore);
  return day;
}

export async function setWater(dateKeyStr: string, waterMl: number, localStore: AccountStore = accountStorage()) {
  const day = await loadDay(dateKeyStr, localStore);
  day.waterMl = Math.max(0, Math.round(waterMl));
  await saveDay(day, localStore);
  return day;
}

export async function setGoals(
  dateKeyStr: string,
  macroGoals?: Macros,
  waterGoalMl?: number, localStore: AccountStore = accountStorage()
) {
  const day = await loadDay(dateKeyStr, localStore);
  if (macroGoals) day.macroGoals = macroGoals;
  if (typeof waterGoalMl === "number")
    day.waterGoalMl = Math.max(500, Math.round(waterGoalMl));
  await saveDay(day, localStore);
  return day;
}
