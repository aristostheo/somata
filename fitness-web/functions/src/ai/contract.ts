export type Operation = "meal" | "mealFoods" | "foodMacros" | "photo" | "workout" | "mealIdeas" | "macroCompletion";
export type AIInput = { operation: Operation; text: string; imageDataUrl?: string };
export const MAX_BODY_BYTES = 1500 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export type FailureCode = "unauthenticated" | "invalid_input" | "unsupported_media" | "too_large" | "rate_limited" | "timeout" | "unavailable" | "invalid_response";
const messages: Record<FailureCode, string> = {
  unauthenticated: "Sign in again to use AI.", invalid_input: "Check the description and try again.",
  unsupported_media: "Choose a JPEG or PNG meal photo.", too_large: "This photo or description is too large. Choose a smaller image or shorten the text.",
  rate_limited: "AI usage is temporarily limited. Please try again later.", timeout: "AI timed out. Please try again.",
  unavailable: "AI is unavailable. Use manual entry or try again later.", invalid_response: "AI could not produce a complete estimate. Add more detail or use manual entry.",
};
export class AIError extends Error {
  constructor(public code: FailureCode) { super(messages[code]); }
}
export function parseInput(value: unknown): AIInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIError("invalid_input");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["operation", "text", "imageDataUrl"].includes(key))) throw new AIError("invalid_input");
  if (!["meal", "mealFoods", "foodMacros", "photo", "workout", "mealIdeas", "macroCompletion"].includes(String(data.operation))) throw new AIError("invalid_input");
  if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 12000) throw new AIError("invalid_input");
  if (data.operation === "photo") {
    if (typeof data.imageDataUrl !== "string") throw new AIError("unsupported_media");
    if (data.imageDataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) throw new AIError("too_large");
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.imageDataUrl);
    if (!match || match[2].length % 4 !== 0) throw new AIError("unsupported_media");
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_IMAGE_BYTES) throw new AIError("too_large");
    if (bytes.toString("base64") !== match[2]) throw new AIError("unsupported_media");
    const valid = match[1] === "jpeg" ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!valid) throw new AIError("unsupported_media");
  } else if (data.imageDataUrl !== undefined) throw new AIError("invalid_input");
  return { operation: data.operation as Operation, text: data.text.trim(), ...(data.imageDataUrl ? { imageDataUrl: data.imageDataUrl as string } : {}) };
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIError("invalid_response");
  return value as ObjectValue;
}
function text(value: unknown, max = 1500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AIError("invalid_response");
  return value.trim();
}
function number(value: unknown, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (positive && value === 0)) throw new AIError("invalid_response");
  return value;
}
function list(value: unknown, max = 12, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || value.length > max || (!allowEmpty && !value.length)) throw new AIError("invalid_response");
  return value;
}
function strings(value: unknown, max = 12) { return list(value, max, true).map(item => text(item, 300)); }
function optionalText(value: unknown) { return value == null || value === "" ? undefined : text(value); }
function nutrients(value: unknown) {
  const item = object(value); const result: ObjectValue = {};
  for (const key of ["calories", "protein", "carbs", "fat"]) result[key] = number(item[key]);
  for (const key of ["fiber", "sugar", "sodium", "sodiumMg", "satFat", "addedSugar", "wholeFoodRatio", "veggieFruitServings", "unsatFatRatio", "alcoholCalories"])
    if (item[key] != null) result[key] = number(item[key]);
  return result;
}
function food(value: unknown) { const item = object(value); return { name: text(item.name, 200), qty: number(item.qty, true), unit: text(item.unit, 30), ...nutrients(item) }; }
/** Return only validated fields; never expose the provider envelope or diagnostic payload. */
export function projectResponse(operation: Operation, value: unknown): ObjectValue {
  const data = object(value);
  if (operation === "meal") return food(data);
  if (operation === "foodMacros") return nutrients(data);
  if (operation === "mealFoods") return { foods: list(data.foods).map(food) };
  if (operation === "photo") return { foods: list(data.foods, 6).map((value, index) => {
    const item = object(value); const portion = object(item.portion);
    if (!["g", "oz", "cups", "tbsp", "piece"].includes(String(portion.unit)) ||
      !["high", "medium", "med", "low", "manual"].includes(String(item.confidence))) throw new AIError("invalid_response");
    return { id: `food_${index}`, name: text(item.name, 200), confidence: item.confidence,
      portion: { amount: number(portion.amount, true), unit: portion.unit, multiplier: number(portion.multiplier, true) },
      macros: nutrients(item.macros), suggestions: item.suggestions == null ? [] : strings(item.suggestions, 4) };
  }) };
  if (operation === "mealIdeas") return { meals: list(data.meals, 5).map(value => {
    const item = object(value);
    if (!["breakfast", "lunch", "dinner", "snacks"].includes(String(item.meal))) throw new AIError("invalid_response");
    return { name: text(item.name, 200), ...nutrients(item), meal: item.meal, ingredients: strings(item.ingredients), notes: optionalText(item.notes) };
  }), rationale: text(data.rationale) };
  if (operation === "macroCompletion") return { suggestions: list(data.suggestions, 4).map(value => {
    const item = object(value);
    return { id: text(item.id, 100), label: text(item.label, 200), foods: strings(item.foods), macros: nutrients(item.macros), tags: strings(item.tags), notes: optionalText(item.notes) };
  }), rationale: text(data.rationale) };
  const section = (value: unknown) => list(value, 12, true).map(value => {
    const item = object(value); return { exercise: text(item.exercise, 200), duration: text(item.duration, 100), notes: optionalText(item.notes) };
  });
  if (!["Light", "Moderate", "Hard"].includes(String(data.difficulty))) throw new AIError("invalid_response");
  return { name: text(data.name, 200), tagline: text(data.tagline), duration: number(data.duration, true),
    estimatedCalories: number(data.estimatedCalories), coachNote: text(data.coachNote), difficulty: data.difficulty,
    warmup: section(data.warmup), cooldown: section(data.cooldown), exercises: list(data.exercises, 30).map(value => {
      const item = object(value); const sets = number(item.sets, true);
      if (!Number.isInteger(sets)) throw new AIError("invalid_response");
      return { name: text(item.name, 200), sets, reps: text(item.reps, 100), rest: text(item.rest, 100), weight: text(item.weight, 100),
        muscleGroup: text(item.muscleGroup, 100), notes: optionalText(item.notes), alternatives: item.alternatives == null ? [] : strings(item.alternatives, 6) };
    }) };
}
