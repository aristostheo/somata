import { AIError, AIInput, MAX_BODY_BYTES, parseInput } from "./contract";
export type Context = { uid?: string; contentType: string; bytes: number };
export function createAIHandler(deps: { reserve: (uid: string) => Promise<void>; generate: (input: AIInput) => Promise<unknown> }) {
  return async (data: unknown, context: Context) => {
    if (!context.uid) throw new AIError("unauthenticated");
    if (context.contentType.split(";")[0].trim().toLowerCase() !== "application/json") throw new AIError("invalid_input");
    if (context.bytes > MAX_BODY_BYTES) throw new AIError("too_large");
    const input = parseInput(data);
    await deps.reserve(context.uid); // Auth context only; no client UID/profile lookup.
    return deps.generate(input); // No meal, photo, goal or recommendation persistence.
  };
}
