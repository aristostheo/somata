import * as ImageManipulator from "expo-image-manipulator";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { requestAIContent, type AIRequest, type AIOperation } from "./aiTransport";
export interface OpenAIMessage { role: "system" | "user" | "assistant"; content: string }
type OpenAIOptions = { operation?: Exclude<AIOperation, "photo">; model?: string; maxTokens?: number; temperature?: number; retryTemperature?: number };
const invoke = (request: AIRequest) => httpsCallable<AIRequest, unknown>(functions, "generateSomataAI", { timeout: 35000 })(request);
/** Compatibility adapter for existing presentation flows; system instructions live on the server. */
export async function callOpenAI(messages: OpenAIMessage[], options?: OpenAIOptions): Promise<string> {
  return requestAIContent({ operation: options?.operation ?? "meal",
    text: messages.filter(message => message.role === "user").map(message => message.content).join("\n") }, invoke, !!auth.currentUser);
}
function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function extractJsonFromText(text: string): any | null {
  const s = String(text ?? "").trim();
  if (!s) return null;

  const direct = safeJsonParse(s);
  if (direct) return direct;

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    const parsed = safeJsonParse(s.slice(objStart, objEnd + 1));
    if (parsed) return parsed;
  }

  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    const parsed = safeJsonParse(s.slice(arrStart, arrEnd + 1));
    if (parsed) return parsed;
  }

  return null;
}


export async function callOpenAIJson<T = any>(messages: OpenAIMessage[], options?: OpenAIOptions): Promise<T> {
  // No automatic retries: one user action means at most one provider request.
  return JSON.parse(await callOpenAI(messages, options)) as T;
}
export async function callOpenAIImageJson<T = any>(args: {
  imageUri: string; systemPrompt: string; userPrompt: string; model?: string;
  maxTokens?: number; temperature?: number; retryTemperature?: number;
}): Promise<T> {
  if (!auth.currentUser) throw new Error("Sign in again to use AI.");
  const out = await ImageManipulator.manipulateAsync(args.imageUri, [{ resize: { width: 1280 } }], {
    compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  if (!out.base64) throw new Error("Could not read this photo. Choose another image.");
  if (out.base64.length > Math.ceil(1024 * 1024 / 3) * 4) throw new Error("Choose a smaller meal photo (up to 1 MiB).");
  const content = await requestAIContent({ operation: "photo", text: "Estimate the foods and portions in this meal photo.",
    imageDataUrl: `data:image/jpeg;base64,${out.base64}` }, invoke, !!auth.currentUser);
  return JSON.parse(content) as T;
}
