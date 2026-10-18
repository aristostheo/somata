export type AIOperation = "meal" | "mealFoods" | "foodMacros" | "photo" | "workout" | "mealIdeas" | "macroCompletion";
export type AIRequest = { operation: AIOperation; text: string; imageDataUrl?: string };
export type AIInvoker = (request: AIRequest) => Promise<{ data: unknown }>;
const errors: Record<string, string> = {
  unauthenticated: "Sign in again to use AI.", invalid_input: "Check the description and try again.",
  unsupported_media: "Choose a JPEG or PNG meal photo.", too_large: "Choose a smaller photo or shorten the description.",
  rate_limited: "AI usage is temporarily limited. Please try again later.", timeout: "AI timed out. Please try again.",
  invalid_response: "AI could not produce a complete estimate. Add more detail or use manual entry.",
  unavailable: "AI is unavailable. Use manual entry or try again later.",
};
/** Authenticated Firebase callable only. No model credentials or direct provider requests. */
export async function requestAIContent(request: AIRequest, invoke: AIInvoker, authenticated: boolean): Promise<string> {
  if (!authenticated) throw new Error(errors.unauthenticated);
  try {
    const result = await invoke(request);
    if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) throw new Error("invalid_response");
    return JSON.stringify(result.data);
  } catch (error) {
    const failure = error as { details?: { code?: string }; code?: string; message?: string };
    const code = failure.details?.code ?? (failure.code === "functions/unauthenticated" ? "unauthenticated" :
      failure.code === "functions/deadline-exceeded" ? "timeout" : failure.message === "invalid_response" ? "invalid_response" : "unavailable");
    throw new Error(errors[code] ?? errors.unavailable);
  }
}
