import Constants from "expo-constants";

import { scanMealFromImage } from "@/components/scanMeal/new/services/scanMealService";
import { callOpenAIJson, extractJsonFromText } from "@/services/openai";

export type MealBuilderInputFood = {
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
};

export type BarcodeCandidate = MealBuilderInputFood & {
  brand?: string | null;
  sourceTag?: "OFF" | "FDC";
};

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function unwrapDescribePayload(anyGot: any): any {
  if (!anyGot) return null;
  if (Array.isArray(anyGot)) return anyGot[0] ?? null;
  if (anyGot.data) return unwrapDescribePayload(anyGot.data);
  if (anyGot.result) return unwrapDescribePayload(anyGot.result);
  if (anyGot.item) return unwrapDescribePayload(anyGot.item);
  if (anyGot.meal) return unwrapDescribePayload(anyGot.meal);

  const content = anyGot?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const parsed = extractJsonFromText(content);
    return parsed ?? { name: content };
  }
  if (typeof anyGot === "string") {
    const parsed = extractJsonFromText(anyGot);
    return parsed ?? { name: anyGot };
  }
  return anyGot;
}

function normalizeDescribeItem(gotRaw: any, fallbackName: string) {
  const got = unwrapDescribePayload(gotRaw) || {};
  const name = String(got.name ?? got.title ?? got.food ?? fallbackName).trim();
  const unit = String(got.unit ?? got.servingUnit ?? "serving").trim();

  const qty =
    Number(got.quantity ?? got.qty ?? got.servingQty ?? got.servings ?? 1) || 1;

  const calories = Number(got.calories ?? got.kcal ?? got.energy ?? 0) || 0;
  const protein = Number(got.protein ?? got.proteins ?? 0) || 0;
  const carbs = Number(got.carbs ?? got.carbohydrates ?? 0) || 0;
  const fat = Number(got.fat ?? got.fats ?? 0) || 0;

  const sugar =
    got.sugar != null
      ? Number(got.sugar)
      : got.sugars != null
        ? Number(got.sugars)
        : undefined;

  const fiber =
    got.fiber != null
      ? Number(got.fiber)
      : got.fibre != null
        ? Number(got.fibre)
        : undefined;

  const addedSugar =
    got.addedSugar != null
      ? Number(got.addedSugar)
      : got.addedSugarG != null
        ? Number(got.addedSugarG)
        : undefined;

  const satFat =
    got.satFat != null
      ? Number(got.satFat)
      : got.saturatedFat != null
        ? Number(got.saturatedFat)
        : got.satFatG != null
          ? Number(got.satFatG)
          : undefined;

  const sodium = got.sodium != null ? Number(got.sodium) : undefined;

  return {
    name,
    unit,
    qty,
    calories,
    protein,
    carbs,
    fat,
    sugar,
    fiber,
    addedSugar,
    satFat,
    sodium,
    wholeFoodRatio:
      got.wholeFoodRatio != null ? Number(got.wholeFoodRatio) : undefined,
    veggieFruitServings:
      got.veggieFruitServings != null
        ? Number(got.veggieFruitServings)
        : undefined,
    unsatFatRatio:
      got.unsatFatRatio != null ? Number(got.unsatFatRatio) : undefined,
    alcoholCalories:
      got.alcoholCalories != null ? Number(got.alcoholCalories) : undefined,
    source: "describe",
  } satisfies MealBuilderInputFood;
}

function pickNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function createManualFood(input: {
  name: string;
  qty?: number;
  unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
}) {
  return {
    name: input.name.trim() || "Food",
    qty: input.qty || 1,
    unit: input.unit || "serving",
    calories: pickNumber(input.calories),
    protein: pickNumber(input.protein),
    carbs: pickNumber(input.carbs),
    fat: pickNumber(input.fat),
    sugar:
      input.sugar != null && Number.isFinite(Number(input.sugar))
        ? Number(input.sugar)
        : undefined,
    fiber:
      input.fiber != null && Number.isFinite(Number(input.fiber))
        ? Number(input.fiber)
        : undefined,
    addedSugar:
      input.addedSugar != null && Number.isFinite(Number(input.addedSugar))
        ? Number(input.addedSugar)
        : undefined,
    satFat:
      input.satFat != null && Number.isFinite(Number(input.satFat))
        ? Number(input.satFat)
        : undefined,
    sodium:
      input.sodium != null && Number.isFinite(Number(input.sodium))
        ? Number(input.sodium)
        : undefined,
    source: "manual",
  } satisfies MealBuilderInputFood;
}

export async function describeMeal(args: {
  text: string;
  meal: string;
  date: string;
}): Promise<MealBuilderInputFood[]> {
  const text = args.text.trim();
  if (!text) return [];

  const parsed = await callOpenAIJson<any>(
    [
      {
        role: "system",
        content:
          "You estimate meal macros for the Somata app. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Estimate this meal description and return JSON only.
Context:
- Meal: ${args.meal}
- Date: ${args.date}
- Description: ${text}

Return either:
{ "foods": [ { "name": string, "qty": number, "unit": string, "calories": number, "protein": number, "carbs": number, "fat": number, "sugar": number | null, "fiber": number | null, "addedSugar": number | null, "satFat": number | null, "sodium": number | null, "wholeFoodRatio": number | null, "veggieFruitServings": number | null, "unsatFatRatio": number | null, "alcoholCalories": number | null } ] }
or a single food object in the same shape. Use realistic estimates.`,
      },
    ],
    { maxTokens: 1400, temperature: 0.35 }
  );
  if (!parsed) throw new Error("Describe returned invalid JSON.");
  if (parsed?.fallback) {
    throw new Error(
      parsed?.fallbackReason
        ? String(parsed.fallbackReason).slice(0, 160)
        : "AI estimate fell back to a generic result."
    );
  }

  const foods = Array.isArray(parsed?.foods)
    ? parsed.foods
    : Array.isArray(parsed)
      ? parsed
      : [parsed];

  return foods
    .map((item: any) => normalizeDescribeItem(item, text))
    .filter(
      (item: MealBuilderInputFood) =>
        !!item.name &&
        item.calories + item.protein + item.carbs + item.fat > 0
    );
}

export async function scanFood(photoUri: string): Promise<MealBuilderInputFood[]> {
  const result = await scanMealFromImage(photoUri);
  return (result.foods || [])
    .filter((food) => !!food.name?.trim())
    .map((food) => ({
      id: food.id,
      name: food.name.trim(),
      qty: Number(food.portion?.amount || 1) || 1,
      unit: String(food.portion?.unit || "piece"),
      calories: Math.max(0, Number(food.macros?.calories || 0)),
      protein: Math.max(0, Number(food.macros?.protein || 0)),
      carbs: Math.max(0, Number(food.macros?.carbs || 0)),
      fat: Math.max(0, Number(food.macros?.fat || 0)),
      sugar:
        food.macros?.sugar != null ? Math.max(0, Number(food.macros.sugar)) : undefined,
      fiber:
        food.macros?.fiber != null ? Math.max(0, Number(food.macros.fiber)) : undefined,
      sodium:
        food.macros?.sodiumMg != null
          ? Math.max(0, Number(food.macros.sodiumMg))
          : undefined,
      satFat:
        food.macros?.satFat != null ? Math.max(0, Number(food.macros.satFat)) : undefined,
      source: "scan",
    }));
}

type SourceTag = "OFF" | "FDC";
type ResolvedProduct = {
  name: string;
  brand?: string | null;
  unit: string;
  per: number;
  nutrients: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
  };
  fdcId?: string | null;
  source?: SourceTag;
};

type FdcItem = {
  fdcId: string;
  description: string;
  brandOwner?: string;
  labelNutrients?: {
    calories?: { value: number };
    protein?: { value: number };
    carbohydrates?: { value: number };
    fat?: { value: number };
    fiber?: { value: number };
    sugars?: { value: number };
  };
};

const FDC_API_KEY = Constants.expoConfig?.extra?.fdcApiKey as string | undefined;

async function searchFDC(queryStr: string): Promise<FdcItem[]> {
  if (!FDC_API_KEY || !queryStr.trim()) return [];
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      FDC_API_KEY
    )}&query=${encodeURIComponent(queryStr)}&dataType=Branded&pageSize=10`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.foods || []) as FdcItem[];
  } catch {
    return [];
  }
}

async function lookupOpenFoodFacts(
  barcode: string
): Promise<ResolvedProduct | null> {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode
      )}.json`
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.status !== 1) return null;

    const p = j.product || {};
    const nutr = p.nutriments || {};
    const hasServing =
      nutr["energy-kcal_serving"] ||
      nutr["proteins_serving"] ||
      nutr["carbohydrates_serving"] ||
      nutr["fat_serving"] ||
      nutr["sugars_serving"] ||
      nutr["fiber_serving"];

    if (hasServing) {
      return {
        name: String(p.product_name || p.generic_name || "Food"),
        brand: p.brands || null,
        unit: "serving",
        per: 1,
        nutrients: {
          calories:
            nutr["energy-kcal_serving"] ??
            (nutr["energy_serving"] ? nutr["energy_serving"] / 4.184 : undefined),
          protein: nutr["proteins_serving"],
          carbs: nutr["carbohydrates_serving"],
          fat: nutr["fat_serving"],
          sugar: nutr["sugars_serving"],
          fiber: nutr["fiber_serving"],
        },
        fdcId: null,
        source: "OFF",
      };
    }

    const baseIsMl = (p.quantity || "").toLowerCase().includes("ml");
    return {
      name: String(p.product_name || p.generic_name || "Food"),
      brand: p.brands || null,
      unit: baseIsMl ? "100 ml" : "100 g",
      per: 100,
      nutrients: {
        calories:
          nutr["energy-kcal_100g"] ??
          (nutr["energy_100g"] ? nutr["energy_100g"] / 4.184 : undefined),
        protein: nutr["proteins_100g"],
        carbs: nutr["carbohydrates_100g"],
        fat: nutr["fat_100g"],
        sugar: nutr["sugars_100g"],
        fiber: nutr["fiber_100g"],
      },
      fdcId: null,
      source: "OFF",
    };
  } catch {
    return null;
  }
}

async function lookupFDCByBarcode(
  barcode: string
): Promise<ResolvedProduct | null> {
  const items = await searchFDC(barcode);
  if (!items?.length) return null;
  const x = items[0];
  const ln = x.labelNutrients || {};
  return {
    name: x.description || "Food",
    brand: x.brandOwner || null,
    unit: "serving",
    per: 1,
    nutrients: {
      calories: ln.calories?.value,
      protein: ln.protein?.value,
      carbs: ln.carbohydrates?.value,
      fat: ln.fat?.value,
      sugar: ln.sugars?.value,
      fiber: ln.fiber?.value,
    },
    fdcId: String(x.fdcId),
    source: "FDC",
  };
}

function scoreCandidate(r: ResolvedProduct): number {
  const filled = ["calories", "protein", "carbs", "fat", "sugar", "fiber"].reduce(
    (s, k) => s + (Number.isFinite((r.nutrients as any)[k]) ? 1 : 0),
    0
  );
  const servingBonus = r.per === 1 ? 3 : 0;
  const srcBonus = r.source === "OFF" ? 1 : 0;
  return filled + servingBonus + srcBonus;
}

function variantsFor(barcode: string): string[] {
  const b = barcode.trim();
  const xs = new Set<string>([b]);
  if (b.length === 12 && b.startsWith("0")) xs.add(b.slice(1));
  if (b.length === 11) xs.add("0" + b);
  if (b.length === 13 && b.startsWith("0")) xs.add(b.slice(1));
  if (b.length === 8 && !b.startsWith("0")) xs.add("0" + b);
  return Array.from(xs);
}

export async function lookupBarcode(
  barcode: string
): Promise<BarcodeCandidate[]> {
  const tries = variantsFor(barcode);
  const seen: ResolvedProduct[] = [];

  for (const b of tries) {
    const off = await lookupOpenFoodFacts(b);
    if (off) seen.push(off);
    const fdc = await lookupFDCByBarcode(b);
    if (fdc) seen.push(fdc);
  }

  const key = (x: ResolvedProduct) =>
    [x.name, x.brand || "", x.unit, x.per, x.source || ""]
      .join("|")
      .toLowerCase();

  const uniq = Array.from(new Map(seen.map((v) => [key(v), v])).values()).sort(
    (a, b) => scoreCandidate(b) - scoreCandidate(a)
  );

  return uniq.map((item) => ({
    name: item.name,
    brand: item.brand,
    qty: item.per,
    unit: item.unit,
    calories: Number(item.nutrients.calories || 0),
    protein: Number(item.nutrients.protein || 0),
    carbs: Number(item.nutrients.carbs || 0),
    fat: Number(item.nutrients.fat || 0),
    sugar:
      item.nutrients.sugar != null ? Number(item.nutrients.sugar) : undefined,
    fiber:
      item.nutrients.fiber != null ? Number(item.nutrients.fiber) : undefined,
    foodRefId: item.fdcId || undefined,
    source: "barcode",
    sourceTag: item.source,
  }));
}
