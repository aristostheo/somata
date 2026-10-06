import { callOpenAIJson } from "@/services/openai";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugarTotal?: number;
  fiber?: number;
  sodiumMg?: number;
  satFat?: number;
};

export type DietPreferencesShape = {
  restrictions?: string[];
  allergies?: string[];
  dislikes?: string[];
  likes?: string[];
  moreOf?: string[];
  avoidLimit?: string[];
  notes?: string;
  updatedAt?: number;
};

export type MacroCompletionSuggestion = {
  id: string;
  label: string;
  foods: string[];
  macros: { calories: number; protein: number; carbs: number; fat: number };
  tags: string[];
  notes?: string;
};

export type MacroCompletionResponse = {
  v: 1;
  date: string;
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  preferencesUsed?: DietPreferencesShape;
  quotaUsed?: number;
  quotaLimit?: number;
  suggestions: MacroCompletionSuggestion[];
  rationale: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function fetchMacroCompletion(args: {
  dateISO: string;
  totals: MacroTotals;
  goals: MacroTotals;
  dietPreferences?: DietPreferencesShape | null;
  count?: number;
  seed?: string | number;
  nonce?: string | number;
  forceNew?: boolean;
  lockedSuggestionIds?: string[];
  swapIndex?: number | null;
}): Promise<MacroCompletionResponse> {
  const remaining = {
    calories: Math.max(0, Math.round((args.goals?.calories || 0) - (args.totals?.calories || 0))),
    protein: Math.max(0, Math.round((args.goals?.protein || 0) - (args.totals?.protein || 0))),
    carbs: Math.max(0, Math.round((args.goals?.carbs || 0) - (args.totals?.carbs || 0))),
    fat: Math.max(0, Math.round((args.goals?.fat || 0) - (args.totals?.fat || 0))),
  };

  const requestedCount = clamp(Number(args.count || 3), 2, 4);
  const system = `You generate macro completion meal suggestions for a fitness app.
Respond with JSON only.
Format:
{
  "v": 1,
  "date": "YYYY-MM-DD",
  "remaining": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "suggestions": [
    {
      "id": "short-id",
      "label": "1 meal + 1 snack",
      "foods": ["food one", "food two"],
      "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
      "tags": ["high_protein"],
      "notes": "optional"
    }
  ],
  "rationale": "short explanation"
}`;

  const user = `Build ${requestedCount} macro-completion suggestions for ${args.dateISO}.
Goals: ${JSON.stringify(args.goals)}
Totals so far: ${JSON.stringify(args.totals)}
Remaining: ${JSON.stringify(remaining)}
Diet preferences: ${JSON.stringify(args.dietPreferences || null)}
Keep suggestions practical and food-based, not recipes. Prioritize protein when protein remaining is high.
Avoid markdown. JSON only.`;

  const out = await callOpenAIJson<Partial<MacroCompletionResponse>>(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      model: "gpt-4o-mini",
      maxTokens: 900,
      temperature: args.forceNew ? 0.8 : 0.45,
      retryTemperature: 0.25,
    }
  );

  const suggestions = Array.isArray(out?.suggestions)
    ? out.suggestions
        .slice(0, requestedCount)
        .map((item, index) => ({
          id: String(item?.id || `spark-${index + 1}`),
          label: String(item?.label || "Suggested meal"),
          foods: Array.isArray(item?.foods) ? item.foods.map(String) : [],
          macros: {
            calories: Math.max(0, Math.round(Number(item?.macros?.calories || 0))),
            protein: Math.max(0, Math.round(Number(item?.macros?.protein || 0))),
            carbs: Math.max(0, Math.round(Number(item?.macros?.carbs || 0))),
            fat: Math.max(0, Math.round(Number(item?.macros?.fat || 0))),
          },
          tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
          notes: item?.notes ? String(item.notes) : undefined,
        }))
    : [];

  return {
    v: 1,
    date: args.dateISO,
    remaining,
    preferencesUsed: args.dietPreferences ?? undefined,
    quotaUsed: suggestions.length,
    quotaLimit: requestedCount,
    suggestions,
    rationale: String(out?.rationale || "Suggestions tuned to your remaining targets."),
  };
}
