// services/scanMeal/mockScanService.ts
import type { ScanMealResult } from "@/services/scanMeal/types";
import { callOpenAIImageJson } from "@/services/openai";

/** Backend expects portion.unit in: g | oz | cups | tbsp | piece */
const VALID_PORTION_UNITS = ["g", "oz", "cups", "tbsp", "piece"] as const;
type ValidPortionUnit = (typeof VALID_PORTION_UNITS)[number];

const VALID_CONFIDENCE = ["high", "medium", "low", "manual"] as const;
type ValidConfidence = (typeof VALID_CONFIDENCE)[number];

function clampConfidence(v: any): ValidConfidence {
  const s = String(v || "").toLowerCase();
  return (VALID_CONFIDENCE as readonly string[]).includes(s)
    ? (s as any)
    : "medium";
}

function normalizePortion(p: any): {
  amount: number;
  unit: ValidPortionUnit;
  multiplier: number;
} {
  const amount = Number(p?.amount);
  const multiplier = Number(p?.multiplier);
  const unitRaw = String(p?.unit || "").toLowerCase();

  const unit: ValidPortionUnit = (
    VALID_PORTION_UNITS as readonly string[]
  ).includes(unitRaw)
    ? (unitRaw as ValidPortionUnit)
    : "piece";

  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
    unit,
    multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
  };
}

export async function mockScanMealFromImage(
  uri: string,
): Promise<ScanMealResult> {
  const parsed = await callOpenAIImageJson<any>({
    imageUri: uri,
    systemPrompt:
      "You are a nutrition analysis assistant. Identify foods from the meal image and respond with valid JSON only.",
    userPrompt: `Analyze this meal photo and return JSON only in this shape:
{
  "foods": [
    {
      "id": "stable short id",
      "name": "food name",
      "confidence": "high" | "medium" | "low" | "manual",
      "portion": { "amount": number, "unit": "g" | "oz" | "cups" | "tbsp" | "piece", "multiplier": number },
      "macros": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "fiber": number,
        "sugar": number,
        "sodiumMg": number,
        "satFat": number
      },
      "suggestions": ["optional", "short", "alternatives"]
    }
  ]
}
Use conservative nutrition estimates. Return 1-6 foods. No markdown.`,
    maxTokens: 1800,
    temperature: 0.2,
  });

  return {
    foods: (Array.isArray(parsed?.foods) ? parsed.foods : []).map(
      (f: any, idx: number) => {
        const portion = normalizePortion(f?.portion);

        return {
          id: String(f?.id ?? `food_${idx}`),
          name: String(f?.name ?? "Food"),
          confidence: clampConfidence(f?.confidence),
          portion,
          macros: {
            calories: Number(f?.calories ?? f?.macros?.calories ?? 0) || 0,
            protein: Number(f?.protein ?? f?.macros?.protein ?? 0) || 0,
            carbs: Number(f?.carbs ?? f?.macros?.carbs ?? 0) || 0,
            fat: Number(f?.fat ?? f?.macros?.fat ?? 0) || 0,
            fiber: Number(f?.fiber ?? f?.macros?.fiber ?? 0) || 0,
            sugar: Number(f?.sugar ?? f?.macros?.sugar ?? 0) || 0,
            sodiumMg: Number(f?.sodiumMg ?? f?.macros?.sodiumMg ?? 0) || 0,
            satFat: Number(f?.satFat ?? f?.macros?.satFat ?? 0) || 0,
          },
          suggestions: Array.isArray(f?.suggestions)
            ? f.suggestions.map((s: any) => String(s)).slice(0, 4)
            : [],
        };
      },
    ),
  };
}
