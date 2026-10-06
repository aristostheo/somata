import * as ImageManipulator from "expo-image-manipulator";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type OpenAIOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

function getApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API key not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file."
    );
  }
  return OPENAI_API_KEY;
}

export async function callOpenAI(
  messages: OpenAIMessage[],
  options?: OpenAIOptions
): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: options?.model ?? "gpt-4o-mini",
      max_tokens: options?.maxTokens ?? 1500,
      temperature: options?.temperature ?? 0.7,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? `OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
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

export async function callOpenAIJson<T = any>(
  messages: OpenAIMessage[],
  options?: OpenAIOptions & { retryTemperature?: number }
): Promise<T> {
  const raw = await callOpenAI(messages, options);
  const parsed = extractJsonFromText(raw);
  if (parsed) return parsed as T;

  const retryRaw = await callOpenAI(messages, {
    ...options,
    temperature: options?.retryTemperature ?? 0.3,
  });
  const retryParsed = extractJsonFromText(retryRaw);
  if (retryParsed) return retryParsed as T;

  throw new Error("OpenAI returned invalid JSON.");
}

async function imageUriToDataUrl(uri: string) {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  if (!out.base64) throw new Error("Failed to convert image to base64");
  return `data:image/jpeg;base64,${out.base64}`;
}

export async function callOpenAIImageJson<T = any>(args: {
  imageUri: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  retryTemperature?: number;
}): Promise<T> {
  const imageUrl = await imageUriToDataUrl(args.imageUri);
  const body = {
    model: args.model ?? "gpt-4o-mini",
    max_tokens: args.maxTokens ?? 1500,
    temperature: args.temperature ?? 0.4,
    messages: [
      { role: "system", content: args.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: args.userPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  const request = async (temperature: number) => {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({ ...body, temperature }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error?.message ?? `OpenAI error: ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  };

  const first = await request(args.temperature ?? 0.4);
  const parsed = extractJsonFromText(first);
  if (parsed) return parsed as T;

  const second = await request(args.retryTemperature ?? 0.2);
  const retryParsed = extractJsonFromText(second);
  if (retryParsed) return retryParsed as T;

  throw new Error("OpenAI returned invalid JSON.");
}
