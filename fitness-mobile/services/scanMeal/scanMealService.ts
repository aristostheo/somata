// services/scanMeal/mockScanService.ts
import type { ScanMealResult } from "@/services/scanMeal/types";
import { callOpenAIImageJson } from "@/services/openai";

import { validateScanResult } from "../aiValidation";

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

  return validateScanResult(parsed);
}
