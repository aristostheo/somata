import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebaseConfig";
const invoke = (body) => httpsCallable(getFunctions(auth.app, "us-central1"), "generateSomataAI", { timeout: 35000 })(body);
const messages = {
  unauthenticated: "Sign in again to use meal AI.", invalid_input: "Check the description and quantities.",
  too_large: "Shorten the description and try again.", rate_limited: "AI usage is temporarily limited. Please try again later.",
  timeout: "Meal AI timed out. Please try again.", invalid_response: "AI returned an incomplete estimate. Use manual entry or add more detail.",
  unavailable: "Meal AI is unavailable. Use manual entry or try again later.",
};
/** No write: the returned estimate still needs the existing user review/confirmation. */
export async function requestMealEstimate(body, call = invoke, authenticated = !!auth.currentUser) {
  if (!authenticated) throw new Error(messages.unauthenticated);
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 10000 ||
    (body.qty != null && (typeof body.qty !== "number" || !Number.isFinite(body.qty) || body.qty <= 0)) ||
    (body.unit != null && (typeof body.unit !== "string" || body.unit.length > 30))) throw new Error(messages.invalid_input);
  try {
    const { data } = await call({ operation: "meal", text: `${body.text}\nQuantity: ${body.qty ?? "as described"}; unit: ${body.unit ?? "as described"}` });
    for (const key of ["calories", "protein", "carbs", "fat"]) {
      if (typeof data?.[key] !== "number" || !Number.isFinite(data[key]) || data[key] < 0) throw new Error("invalid_response");
    }
    return { suggestedName: data.name, qty: data.qty, unit: data.unit, totals: data };
  } catch (error) {
    const code = error?.details?.code ?? (error?.code === "functions/unauthenticated" ? "unauthenticated" :
      error?.code === "functions/deadline-exceeded" ? "timeout" : error?.message === "invalid_response" ? "invalid_response" : "unavailable");
    throw new Error(messages[code] ?? messages.unavailable);
  }
}
