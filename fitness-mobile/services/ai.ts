import { callOpenAIJson } from "./openai";
export type AiMealResponse = {
  suggestedName: string | null;
  qty: number | null;
  unit: string | null; // "serving" | "g" | "ml" | etc
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
    fiber: number;
  };
};


export async function parseMealRemote(text: string, opts?: { qty?: number | null; unit?: string | null }): Promise<AiMealResponse> {
  const meal = await callOpenAIJson<any>([{ role: "user", content: `${text}\nQuantity: ${opts?.qty ?? "as described"}; unit: ${opts?.unit ?? "as described"}` }]);
  return { suggestedName: meal.name, qty: meal.qty, unit: meal.unit, totals: meal };
}
