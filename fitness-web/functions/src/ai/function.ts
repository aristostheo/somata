import { functionsRegion } from "../deployment";
import { assertAccountActive } from "../account/guard";
import { onRequest, HttpsError, FunctionsErrorCode } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { AIError, FailureCode } from "./contract";
import { generate } from "./provider";
import { createAIHandler } from "./handler";
if (!getApps().length) initializeApp();
const secret = defineSecret("OPENAI_API_KEY");
/** Only operational counters persist; never prompts, image bytes or provider responses. */
export async function reserveAIRequest(uid: string, now = Date.now()) {
  const db = getFirestore(); const ref = db.collection("aiUsageLimits").doc(uid);
  await db.runTransaction(async tx => {
    await assertAccountActive(db, uid, tx);
    const data = (await tx.get(ref)).data();
    const minute = Math.floor(now / 60000); const day = Math.floor(now / 86400000);
    const minuteCount = data?.minute === minute ? Number(data.minuteCount) : 0;
    const dayCount = data?.day === day ? Number(data.dayCount) : 0;
    if (minuteCount >= 5 || dayCount >= 60) throw new AIError("rate_limited");
    tx.set(ref, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
  });
}
const codes: Record<FailureCode, FunctionsErrorCode> = {
  unauthenticated: "unauthenticated", invalid_input: "invalid-argument", unsupported_media: "invalid-argument",
  too_large: "resource-exhausted", rate_limited: "resource-exhausted", timeout: "deadline-exceeded",
  unavailable: "unavailable", invalid_response: "data-loss",
};
/** Callable-compatible HTTPS endpoint. Custom envelope checks avoid SDK logging malformed request bodies. */
export const generateSomataAI = onRequest({ region: functionsRegion, secrets: [secret], timeoutSeconds: 40,
  memory: "512MiB", maxInstances: 2, concurrency: 10, cors: true }, async (request, response) => {
  response.set("Cache-Control", "no-store");
  try {
    if (request.method !== "POST") throw new AIError("invalid_input");
    const token = /^Bearer ([^\s]+)$/.exec(request.get("authorization") || "")?.[1];
    if (!token) throw new AIError("unauthenticated");
    let uid: string;
    try { uid = (await getAuth().verifyIdToken(token)).uid; }
    catch { throw new AIError("unauthenticated"); }
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body) ||
      Object.keys(request.body).length !== 1 || !("data" in request.body)) throw new AIError("invalid_input");
    const result = await createAIHandler({ reserve: reserveAIRequest, generate: input => generate(input, secret.value()) })(request.body.data, {
      uid, contentType: request.get("content-type") || "",
      bytes: request.rawBody?.length ?? Buffer.byteLength(JSON.stringify(request.body)),
    });
    response.json({ result });
  } catch (error) {
    const failure = error instanceof AIError ? error : new AIError("unavailable");
    const safe = new HttpsError(codes[failure.code], failure.message, { code: failure.code });
    response.status(safe.httpErrorCode.status).json({ error: safe.toJSON() });
  }
});
