// functions/src/describe.ts
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto"; // keep
import { defineSecret } from "firebase-functions/params";

// Node 18/20 has global fetch
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🔑 Declare the secret (name must match what you'll set in CLI)
const OPENAI_SECRET = defineSecret("OPENAI_API_KEY");

// Local dev fallback is okay; production will use OPENAI_SECRET
function getOpenAIKey(): string {
  const fromSecret = (OPENAI_SECRET as any)?.value?.();
  const fromEnv = process.env.OPENAI_API_KEY;
  const key = fromSecret || fromEnv || "";
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return key;
}

/* ───────────────────────────── Types ───────────────────────────── */
type PlanItem = {
  exercise: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  notes?: string;
};
type Plan = { items: PlanItem[]; rationale?: string };

type MealV2 = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
};

type MealItemV1 = {
  name: string;
  serving?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  unit?: string;
  qty?: number;
};
type MealResultV1 = { items: MealItemV1[]; rationale?: string };

type MealIdea = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  meal?: "breakfast" | "lunch" | "dinner" | "snacks";
  prep_min?: number;
  difficulty?: "easy" | "moderate" | "advanced";
  notes?: string;
};

type MealIdeasResponse = {
  meals: MealIdea[];
  rationale?: string;
};

/** Suggestion card returned to the client */
type SuggestionCard = {
  icon: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  tint: "workout" | "meal" | "recovery" | "ok";
};

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";
type GoalMacros = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};
type TotalMacros = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  burned?: number;
};

/** Cache document shapes (kept for suggest:v1) */
type SuggestionDocV1 = {
  createdAt?:
    | admin.firestore.FieldValue
    | admin.firestore.Timestamp
    | FirebaseFirestore.FieldValue
    | FirebaseFirestore.Timestamp;
  key: string;
  card: SuggestionCard;
};
type SuggestionDocV2 = {
  createdAt?:
    | admin.firestore.FieldValue
    | admin.firestore.Timestamp
    | FirebaseFirestore.FieldValue
    | FirebaseFirestore.Timestamp;
  key: string;
  cards: SuggestionCard[];
};

type ExerciseEstimate = {
  name: string;
  calories: number;
  minutes?: number;
  mets?: number;
  rationale?: string;
};

// scan meal types
type ScanConfidence = "high" | "medium" | "low" | "manual";

type ScanMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodiumMg: number;
  satFat: number;
};

type ScanPortion = {
  amount: number; // default 1
  unit: "g" | "oz" | "cups" | "tbsp" | "piece";
  multiplier: number; // usually same as amount (your UI expects this)
};

type ScanFood = {
  id: string;
  name: string;
  confidence: ScanConfidence;
  portion: ScanPortion;
  macros: ScanMacros;
  // ✅ schema requires suggestions always; keep it required in runtime too
  suggestions: string[];
};

type ScanMealResponse = {
  foods: ScanFood[];
  // ✅ schema requires rationale always; keep it required in runtime too
  rationale: string;
};

// ───────────── Macro Completion (Finish the Day) ─────────────
type MacroCompletionPrefs = {
  restrictions?: string[];
  allergies?: string[];
  dislikes?: string[];
  likes?: string[];
  moreOf?: string[];
  avoidLimit?: string[];
  notes?: string;
};

type MacroCompletionSuggestion = {
  id: string;
  label: string; // "1 meal + 1 snack"
  foods: string[]; // meal ideas only (no recipes)
  macros: { calories: number; protein: number; carbs: number; fat: number };
  tags: string[]; // "high_protein", "higher_fiber", "lower_added_sugar", ...
  notes?: string;
};

type MacroCompletionResponse = {
  v: 1;
  date: string;
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  preferencesUsed?: MacroCompletionPrefs;
  quotaUsed?: number;
  quotaLimit?: number;
  suggestions: MacroCompletionSuggestion[];
  rationale: string;
};

/* ─────────────────────────── HTTPS endpoint ─────────────────────────── */
export const describe = onRequest(
  { cors: true, secrets: [OPENAI_SECRET] },
  async (req, res): Promise<void> => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "method-not-allowed" });
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");

      // 🔒 Firebase auth (ID token required)
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }

      let uid = "";
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }

      const body = (req.body ?? {}) as {
        mode?: string;

        // workout generator fields
        today?: string;
        profile?: any;
        recent?: any[];

        // meal describe fields
        query?: string;
        rawText?: string;
        context?: any;

        // suggestion fields (compact, client-provided)
        date?: string; // YYYY-MM-DD (local to client)
        timeOfDay?: number; // 0-23
        isRestDay?: boolean;
        goals?: GoalMacros;
        totals?: TotalMacros;

        // meal_suggest:v1 additions
        meal?: MealSlot;
        notes?: string;

        system?: string;
        regenToken?: string | number;
        nonce?: string | number;

        // suggest:v1 / meal_suggest:v1 control
        count?: number; // 3..5
        seed?: string;
        forceNew?: boolean;

        // macro_completion:v1 fields
        dietPreferences?: any;
        lockedSuggestionIds?: string[];
        swapIndex?: number | null;

        // scan meal fields
        imageUrl?: string;
        imageBase64?: string; // can be "data:image/jpeg;base64,...." or raw base64
        units?: "metric" | "imperial"; // optional hint
      };

      const mode = String(body.mode || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (mode === "workout_plan:v1") {
        try {
          const prompt = buildWorkoutPrompt({
            today: body.today || "",
            profile: body.profile ?? {},
            recent: body.recent ?? [],
            system: body.system,
            regenToken: body.regenToken,
          });
          const plan = (await callOpenAIForJson(prompt, "workout")) as Plan;
          res.set("Cache-Control", "no-store");
          res.status(200).json(plan);
          return;
        } catch (e: any) {
          console.error("[workout_plan:v1] OpenAI failed", e);
          res.status(502).json({
            error: "ai-failed",
            detail: String(e?.message ?? e),
            hint: "Ensure OPENAI_API_KEY secret is set and model access is enabled.",
          });
          return;
        }
      }

      // ───────────── AI suggestion card(s) (kept for your other UI) ─────────────
      if (mode === "suggest:v1") {
        const date = (body.date || new Date().toISOString().slice(0, 10)).slice(
          0,
          10
        );
        const hour =
          typeof body.timeOfDay === "number"
            ? clampInt(body.timeOfDay, 0, 23)
            : new Date().getHours();

        const kcalGoal = num(body.goals?.calories, 2200);
        const proteinGoal = num(body.goals?.protein, 120);
        const calories = num(body.totals?.calories, 0);
        const protein = num(body.totals?.protein, 0);
        const burned = num(body.totals?.burned, 0);
        const isRestDay = !!body.isRestDay;

        const cRem = Math.max(0, Math.round(kcalGoal - calories));
        const pRem = Math.max(0, Math.round(proteinGoal - protein));
        const hasWorkout = burned > 0;

        const interesting = isRestDay || !hasWorkout || cRem > 200 || pRem > 20;

        const key = buildBucketKey({
          date,
          hour,
          isRestDay,
          hasWorkout,
          cRem,
          pRem,
        });
        const docId = `${date}_${key}`;
        const cacheRef = db
          .collection("aiSuggestions")
          .doc(uid)
          .collection("days")
          .doc(docId);

        const desiredCount = clampCount(body.count ?? 5);
        const forceNew = !!body.forceNew;
        const seed = String(body.seed || body.regenToken || "");

        if (!forceNew) {
          try {
            const snap = await cacheRef.get();
            if (snap.exists) {
              const cached = snap.data() as SuggestionDocV2 | SuggestionDocV1;
              const arr =
                (cached as SuggestionDocV2)?.cards ??
                ((cached as SuggestionDocV1)?.card
                  ? [(cached as SuggestionDocV1).card]
                  : []);
              if (Array.isArray(arr) && arr.length) {
                res.set("Cache-Control", "no-store");
                res.status(200).json(arr.slice(0, desiredCount));
                return;
              }
            }
          } catch (e: any) {
            console.warn("[suggest] cache read error", e);
          }
        }

        if (!interesting) {
          const cards = ruleBasedSuggestions({
            count: desiredCount,
            context: {
              isRestDay,
              calories,
              protein,
              burned,
              kcalGoal,
              proteinGoal,
              hour,
            },
          });
          try {
            await cacheRef.set({
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              key,
              cards,
            } as SuggestionDocV2);
          } catch (e: any) {
            console.warn("[suggest] cache write error", e);
          }
          res.set("Cache-Control", "no-store");
          res.status(200).json(cards.slice(0, desiredCount));
          return;
        }

        const listPrompt = buildSuggestionListPrompt({
          date,
          timeOfDay: hour,
          isRestDay,
          goals: { calories: kcalGoal, protein: proteinGoal },
          totals: { calories, protein, burned },
          count: desiredCount,
          system: body.system,
        });

        let cards: SuggestionCard[] = [];
        try {
          cards = await callOpenAIForSuggestionList(listPrompt, seed);
        } catch (e: any) {
          console.warn("[suggest] OpenAI failed, using rule fallback", e);
          cards = [];
        }

        if (!cards.length) {
          cards = ruleBasedSuggestions({
            count: desiredCount,
            context: {
              isRestDay,
              calories,
              protein,
              burned,
              kcalGoal,
              proteinGoal,
              hour,
            },
          });
        }

        try {
          await cacheRef.set({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            key,
            cards: cards.slice(0, 5),
          } as SuggestionDocV2);
        } catch (e: any) {
          console.warn("[suggest] cache write error", e);
        }

        res.set("Cache-Control", "no-store");
        res.status(200).json(cards.slice(0, desiredCount));
        return;
      }

      // ───────────── MEAL IDEAS ONLY (for your AI Meal Suggestions page) ─────────────
      if (mode === "meal_suggest:v1") {
        const meal = (String(
          body?.context?.meal || body?.meal || ""
        ).toLowerCase() || "") as MealIdea["meal"];
        const goals = body?.goals || {};
        const totals = body?.totals || {};
        const notes = String(body?.notes || body?.context?.notes || "").trim();
        const n = clampCount(body?.count ?? 5);
        const forceNew = body?.forceNew ?? true;
        const seed = String(body.seed || body.regenToken || Date.now());

        let profile: any = body?.profile ?? null;
        if (!profile) {
          try {
            const snap = await db.collection("users").doc(uid).get();
            if (snap.exists) profile = snap.data();
          } catch {}
        }

        const remaining = {
          k: Math.max(0, num(goals?.calories, 2200) - num(totals?.calories, 0)),
          p: Math.max(0, num(goals?.protein, 120) - num(totals?.protein, 0)),
          c: Math.max(0, num(goals?.carbs, 220) - num(totals?.carbs, 0)),
          f: Math.max(0, num(goals?.fat, 75) - num(totals?.fat, 0)),
        };
        const buckets = {
          k: bucket(remaining.k, [200, 500, 900]),
          p: bucket(remaining.p, [20, 40, 70]),
          c: bucket(remaining.c, [30, 80, 140]),
          f: bucket(remaining.f, [10, 25, 45]),
        };
        const notesHash = notes
          ? hashKey({ v: 2, n: notes.toLowerCase().slice(0, 160) })
          : "no-notes";
        const m = meal || "any";
        const key = `v2|${m}|K${buckets.k}|P${buckets.p}|C${buckets.c}|F${buckets.f}|${notesHash}|N${n}`;
        const cacheRef = db.collection("aiMealIdeas").doc(key);

        if (!forceNew) {
          try {
            const snap = await cacheRef.get();
            if (snap.exists) {
              res.set("Cache-Control", "no-store");
              res.status(200).json(snap.data());
              return;
            }
          } catch (e: any) {
            console.warn("[meal_suggest] cache read error", e);
          }
        }

        const dayId = new Date().toISOString().slice(0, 10);
        const quotaRef = db.collection("aiQuota").doc(`${uid}_${dayId}_meals`);
        let count = 0;
        try {
          const q = await quotaRef.get();
          count = (q.exists ? q.data()?.count || 0 : 0) as number;
        } catch {}

        if (count >= 12) {
          const fallback: MealIdeasResponse = {
            meals: [
              {
                name: "Greek yogurt + whey + berries",
                meal: (meal as any) || "snacks",
                calories: Math.min(remaining.k || 350, 450),
                protein: Math.min(remaining.p || 35, 45),
                carbs: 35,
                fat: 5,
                sugar: 18,
                fiber: 3,
                prep_min: 3,
                difficulty: "easy",
                notes: "High-protein snack; adjust scoop to hit protein.",
              },
              {
                name: "Chicken wrap (tortilla, 150g chicken, veg, light sauce)",
                meal: (meal as any) || "lunch",
                calories: Math.min(remaining.k || 500, 650),
                protein: Math.min(remaining.p || 40, 55),
                carbs: 45,
                fat: 15,
                sugar: 6,
                fiber: 6,
                prep_min: 10,
                difficulty: "easy",
                notes: "Balance with yogurt/fruit if carbs still low.",
              },
            ],
            rationale: "Quota fallback used; simple high-protein ideas.",
          };
          res.set("Cache-Control", "no-store");
          res.status(200).json(fallback);
          return;
        }

        const prompt = buildMealSuggestPrompt({
          meal,
          goals,
          totals,
          notes,
          n,
          profile,
          system: body.system,
        });

        try {
          const out = await callOpenAIForMealIdeas(prompt, { n, seed });

          if (!out || !Array.isArray(out.meals)) {
            console.error("[meal_suggest] bad-shape", out);
            throw new Error("bad-shape");
          }

          if (!forceNew) {
            try {
              await cacheRef.set({
                ...out,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                key,
              });
            } catch (e: any) {
              console.warn("[meal_suggest] cache write error", e);
            }
          }

          try {
            await quotaRef.set({ count: count + 1 }, { merge: true });
          } catch (e: any) {
            console.warn("[meal_suggest] quota write error", e);
          }

          res.set("Cache-Control", "no-store");
          res.status(200).json(out);
          return;
        } catch (e: any) {
          console.error("[meal_suggest] OpenAI failed => using fallback", e);

          const fallback: MealIdeasResponse = {
            meals: [
              {
                name: "Greek yogurt + whey + berries",
                meal: (meal as any) || "snacks",
                calories: Math.min(remaining.k || 350, 500),
                protein: Math.max(25, Math.min(remaining.p || 35, 50)),
                carbs: 30,
                fat: 6,
                sugar: 18,
                fiber: 3,
                prep_min: 3,
                difficulty: "easy",
                notes: "Protein-forward; scale scoop to hit target.",
              },
              {
                name: "Chicken wrap (150g chicken, tortilla, veg, light sauce)",
                meal: (meal as any) || "lunch",
                calories: Math.min(remaining.k || 550, 700),
                protein: Math.max(35, Math.min(remaining.p || 45, 55)),
                carbs: 45,
                fat: 12,
                sugar: 6,
                fiber: 6,
                prep_min: 10,
                difficulty: "easy",
                notes: "Add fruit if carbs still low.",
              },
              {
                name: "Egg white omelet + toast + low-fat cheese",
                meal: (meal as any) || "dinner",
                calories: Math.min(remaining.k || 450, 600),
                protein: Math.max(30, Math.min(remaining.p || 40, 50)),
                carbs: 35,
                fat: 10,
                sugar: 5,
                fiber: 4,
                prep_min: 12,
                difficulty: "easy",
              },
            ],
            rationale:
              "Model unavailable; served rule-based, high-protein ideas.",
          };

          if (!forceNew) {
            try {
              await cacheRef.set({
                ...fallback,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                key,
              });
            } catch (w: any) {
              console.warn("[meal_suggest] fallback cache write error", w);
            }
          }

          try {
            await quotaRef.set({ count: count + 1 }, { merge: true });
          } catch (e2: any) {
            console.warn("[meal_suggest] quota write error (fallback)", e2);
          }

          res.set("Cache-Control", "no-store");
          res.status(200).json(fallback);
          return;
        }
      }
      // ───────────── MACRO COMPLETION (Finish the Day) ─────────────
      if (mode === "macro_completion:v1") {
        const date = (body.date || new Date().toISOString().slice(0, 10)).slice(
          0,
          10
        );

        const goals = body?.goals || {};
        const totals = body?.totals || {};

        const remaining = {
          calories: Math.max(
            0,
            Math.round(num(goals?.calories, 2200) - num(totals?.calories, 0))
          ),
          protein: Math.max(
            0,
            Math.round(num(goals?.protein, 120) - num(totals?.protein, 0))
          ),
          carbs: Math.max(
            0,
            Math.round(num(goals?.carbs, 220) - num(totals?.carbs, 0))
          ),
          fat: Math.max(
            0,
            Math.round(num(goals?.fat, 75) - num(totals?.fat, 0))
          ),
        };

        const nRaw = Number(body.count ?? 3);
        const count = Math.max(
          2,
          Math.min(4, Number.isFinite(nRaw) ? nRaw : 3)
        );

        const prefs: MacroCompletionPrefs | null = body?.dietPreferences
          ? {
              restrictions: Array.isArray(body.dietPreferences?.restrictions)
                ? body.dietPreferences.restrictions
                : [],
              allergies: Array.isArray(body.dietPreferences?.allergies)
                ? body.dietPreferences.allergies
                : [],
              dislikes: Array.isArray(body.dietPreferences?.dislikes)
                ? body.dietPreferences.dislikes
                : [],
              likes: Array.isArray(body.dietPreferences?.likes)
                ? body.dietPreferences.likes
                : [],
              moreOf: Array.isArray(body.dietPreferences?.moreOf)
                ? body.dietPreferences.moreOf
                : [],
              avoidLimit: Array.isArray(body.dietPreferences?.avoidLimit)
                ? body.dietPreferences.avoidLimit
                : [],
              notes:
                typeof body.dietPreferences?.notes === "string"
                  ? body.dietPreferences.notes.slice(0, 220)
                  : "",
            }
          : null;

        const locked = Array.isArray(body.lockedSuggestionIds)
          ? body.lockedSuggestionIds
              .map((x: any) => String(x).slice(0, 32))
              .slice(0, 6)
          : [];

        const swapIndex =
          typeof body.swapIndex === "number" && Number.isFinite(body.swapIndex)
            ? Math.max(0, Math.min(3, Math.floor(body.swapIndex)))
            : null;

        const regenToken = String(
          body.nonce || body.regenToken || body.seed || ""
        ).slice(0, 64);

        // Cache key (bucket remaining + prefs hash)
        const key = hashKey({
          v: 1,
          date,
          r: {
            k: bucket(remaining.calories, [200, 500, 900]),
            p: bucket(remaining.protein, [20, 40, 70]),
            c: bucket(remaining.carbs, [30, 80, 140]),
            f: bucket(remaining.fat, [10, 25, 45]),
          },
          p: prefs
            ? hashKey({
                a: prefs.allergies,
                r: prefs.restrictions,
                l: prefs.likes,
                d: prefs.dislikes,
                m: prefs.moreOf,
                av: prefs.avoidLimit,
              })
            : "no-prefs",
          n: count,
        });

        const dayId = new Date().toISOString().slice(0, 10);
        const cacheRef = db
          .collection("aiMacroCompletion")
          .doc(uid)
          .collection("days")
          .doc(`${date}_${key}`);

        // Quota counter (per day)
        const quotaRef = db
          .collection("aiQuota")
          .doc(`${uid}_${dayId}_macro_completion`);
        let qCount = 0;
        try {
          const qSnap = await quotaRef.get();
          qCount = (qSnap.exists ? qSnap.data()?.count || 0 : 0) as number;
        } catch {}
        const qLimit = uid === "fcM9kLgkV0gDljvq74CScLLqdqO2" ? Infinity : 3;

        const forceNew = !!body.forceNew;
        if (!forceNew && swapIndex == null) {
          try {
            const snap = await cacheRef.get();
            if (snap.exists) {
              const cached = snap.data() as any;
              // remove non-schema fields we store in Firestore
              const { createdAt, key: _k, ...clean } = cached;

              res.set("Cache-Control", "no-store");
              res.status(200).json({
                ...clean,
                quotaUsed: qCount,
                quotaLimit: qLimit,
              });
              return;
            }
          } catch (e: any) {
            console.warn("[macro_completion] cache read error", e);
          }
        }

        // Quota guard (new AI calls only)
        if (qLimit !== Infinity && qCount >= qLimit) {
          res.set("Cache-Control", "no-store");
          res.status(429).json({
            error: "macro_completion_quota",
            message: "Daily macro completion limit reached.",
            limit: qLimit,
          });
          return;
        }

        try {
          const prompt = buildMacroCompletionPrompt({
            date,
            remaining,
            goals: {
              calories: num(goals?.calories, 2200),
              protein: num(goals?.protein, 120),
              carbs: num(goals?.carbs, 220),
              fat: num(goals?.fat, 75),
            },
            totals: {
              calories: num(totals?.calories, 0),
              protein: num(totals?.protein, 0),
              carbs: num(totals?.carbs, 0),
              fat: num(totals?.fat, 0),
            },
            prefs,
            count,
            lockedSuggestionIds: locked,
            swapIndex,
            regenToken,
            system: body.system,
          });

          const seed = forceNew
            ? ""
            : String(body.seed || body.regenToken || Date.now());
          const out = await callOpenAIForMacroCompletion(prompt, {
            count,
            seed: seed || undefined,
            temperature: forceNew ? 0.9 : 0.55,
          });
          console.log("[macro_completion] AI response", {
            uid,
            date,
            count,
            forceNew,
            swapIndex,
            regenToken,
          });
          (out as any).v = 1;
          (out as any).date = date;
          (out as any).remaining = remaining;
          (out as any).preferencesUsed = prefs || undefined;

          // If swapIndex is provided, merge: keep locked + swap one slot
          let finalOut = out;
          if (swapIndex != null && !forceNew) {
            try {
              const snap = await cacheRef.get();
              if (snap.exists) {
                const prevRaw = snap.data() as any;
                const { createdAt, key: _k, ...prev } = prevRaw as any;
                const prevSug = Array.isArray(prev?.suggestions)
                  ? prev.suggestions
                  : [];

                const lockedSet = new Set(locked);
                const keep = prevSug.filter((s) =>
                  lockedSet.has(String(s?.id))
                );

                const candidate =
                  (out?.suggestions || []).find(
                    (s) => !lockedSet.has(String(s?.id))
                  ) || (out?.suggestions || [])[0];

                const merged = prevSug.slice(0);
                if (candidate && merged[swapIndex])
                  merged[swapIndex] = candidate;

                // Ensure locked ones still present
                for (const kSug of keep) {
                  if (!merged.some((x) => String(x?.id) === String(kSug?.id)))
                    merged.push(kSug);
                }

                finalOut = {
                  ...prev,
                  suggestions: merged.slice(0, count),
                  rationale: out?.rationale || prev?.rationale || "",
                };
              }
            } catch {}
          }
          (finalOut as any).quotaUsed = qCount + 1;
          (finalOut as any).quotaLimit = qLimit;

          try {
            await cacheRef.set(
              {
                ...finalOut,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                key,
              },
              { merge: true }
            );
            await quotaRef.set({ count: qCount + 1 }, { merge: true });
          } catch (e: any) {
            console.warn("[macro_completion] cache/quota write error", e);
          }

          res.set("Cache-Control", "no-store");
          res.status(200).json(finalOut);
          return;
        } catch (e: any) {
          console.error("[macro_completion] OpenAI failed", e?.message || e);

          const fallback: MacroCompletionResponse = {
            v: 1,
            date,
            remaining,
            preferencesUsed: prefs || undefined,
            suggestions: [
              {
                id: "fb1",
                label: "1 meal + 1 snack",
                foods: ["Chicken wrap", "Greek yogurt + berries"],
                macros: {
                  calories: Math.min(remaining.calories || 620, 720),
                  protein: Math.min(remaining.protein || 55, 65),
                  carbs: 68,
                  fat: 14,
                },
                tags: ["high_protein", "quick"],
                notes: "Swap sauces if you’re limiting added sugar.",
              },
            ].slice(0, count),
            rationale: "Model unavailable; served safe defaults.",
          };

          try {
            await quotaRef.set({ count: qCount + 1 }, { merge: true });
          } catch {}

          res.set("Cache-Control", "no-store");
          res.status(200).json(fallback);
          return;
        }
      }

      // ───────────── v2 meal (flat totals) ─────────────
      if (mode === "meal:v2") {
        const text = pickText(body);

        if (!text) {
          res.set("Cache-Control", "no-store");
          res.status(400).json({ error: "missing-text" });
          return;
        }

        // ✅ per-user throttle (cheap + stops button spam)
        {
          const ok = await enforceMinInterval({
            uid,
            namespace: "mealv2",
            minMs: 2500,
          });
          if (!ok.allowed) {
            res.set("Cache-Control", "no-store");
            res
              .status(429)
              .json({ error: "rate-exceeded", retryAfterMs: ok.retryAfterMs });
            return;
          }
        }

        // ✅ cache key: same input -> reuse during the day (cuts OpenAI calls)
        const dayId = new Date().toISOString().slice(0, 10);
        const cacheKey = hashKey({
          v: 3,
          dayId,
          text: text.toLowerCase().slice(0, 600),
          c: stableCtx(body.context),
        });
        const cacheRef = db
          .collection("aiMealV2")
          .doc(uid)
          .collection("days")
          .doc(`${dayId}_${cacheKey}`);

        try {
          // if you pass forceNew=true, bypass cache
          const forceNew = !!body.forceNew;
          if (!forceNew) {
            const snap = await cacheRef.get();
            if (snap.exists) {
              res.set("Cache-Control", "no-store");
              res.status(200).json(snap.data());
              return;
            }
          }
        } catch (e: any) {
          console.warn("[meal:v2] cache read error", e);
        }

        // ✅ quota guard (so you don’t burn API by accident)
        const quotaRef = db.collection("aiQuota").doc(`${uid}_${dayId}_mealv2`);
        let qCount = 0;
        try {
          const qSnap = await quotaRef.get();
          qCount = (qSnap.exists ? qSnap.data()?.count || 0 : 0) as number;
        } catch {}

        // Hard cap (adjust)
        if (qCount >= 25) {
          const fallback = heuristicMealTotals(text, body.context);
          res.set("Cache-Control", "no-store");
          res.status(200).json(
            withMealV1Mirror(fallback, {
              fallback: true,
              source: "heuristic",
              fallbackReason: "quota",
            })
          );
          return;
        }

        try {
          const prompt = buildMealPromptV2Cheap({
            text,
            context: body.context ?? {},
            system: body.system,
          });

          const v2 = await callOpenAIForMealV2(prompt);
          const payload = withMealV1Mirror(v2);

          try {
            await cacheRef.set(
              {
                ...payload,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                cacheKey,
              },
              { merge: true }
            );
            await quotaRef.set({ count: qCount + 1 }, { merge: true });
          } catch (e: any) {
            console.warn("[meal:v2] cache/quota write error", e);
          }

          res.set("Cache-Control", "no-store");
          res.status(200).json(payload);
          return;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          console.error("[meal:v2] failed", msg);

          const fallback = heuristicMealTotals(text, body.context);

          try {
            await quotaRef.set({ count: qCount + 1 }, { merge: true });
          } catch {}

          res.set("Cache-Control", "no-store");
          res.status(200).json(
            withMealV1Mirror(fallback, {
              fallback: true,
              source: "heuristic",
              fallbackReason: msg.slice(0, 220),
            })
          );
          return;
        }
      }

      // ───────────── scan meal (vision) ─────────────
      if (mode === "scan_meal:v1") {
        const imageUrl = String(body.imageUrl || "").trim();
        let imageBase64 = String(body.imageBase64 || "").trim();

        if (!imageUrl && !imageBase64) {
          res.set("Cache-Control", "no-store");
          res.status(400).json({ error: "missing-image" });
          return;
        }

        // Normalize raw base64 -> data URL (OpenAI accepts data URLs)
        if (imageBase64 && !imageBase64.startsWith("data:image/")) {
          imageBase64 = `data:image/jpeg;base64,${imageBase64}`;
        }

        // light throttle (avoid spam)
        {
          const ok = await enforceMinInterval({
            uid,
            namespace: "scanmealv1",
            minMs: 2500,
          });
          if (!ok.allowed) {
            res.set("Cache-Control", "no-store");
            res
              .status(429)
              .json({ error: "rate-exceeded", retryAfterMs: ok.retryAfterMs });
            return;
          }
        }

        try {
          const prompt = buildScanMealPromptV1({
            units: body.units,
            system: body.system,
          });

          const out = await callOpenAIForScanMealV1(prompt, {
            imageUrl: imageUrl || undefined,
            imageDataUrl: imageBase64 || undefined,
          });

          res.set("Cache-Control", "no-store");
          res.status(200).json(out);
          return;
        } catch (e: any) {
          console.error("[scan_meal:v1] failed", e?.message || e);
          const fallback: ScanMealResponse = {
            foods: [],
            rationale:
              "Scan failed; please retake photo or add items manually.",
          };
          res.set("Cache-Control", "no-store");
          res.status(200).json(fallback);
          return;
        }
      }

      // ───────────── exercise describe (name + calories) ─────────────
      if (mode === "exercise:v1") {
        const text = pickText(body);
        if (!text) {
          res.set("Cache-Control", "no-store");
          res.status(400).json({ error: "missing-text" });
          return;
        }

        let profileInput = body.profile ?? null;
        if (!profileInput) {
          try {
            const snap = await db.collection("users").doc(uid).get();
            if (snap.exists) profileInput = snap.data();
          } catch (e: any) {
            console.warn("[exercise:v1] profile fetch failed", e);
          }
        }

        const p = profileEnergyShape(profileInput);

        const cachePayload = {
          v: 1,
          text: text.toLowerCase(),
          sex: p?.sex || "",
          ageB: p?.age ? Math.round(p.age / 5) * 5 : null,
          hB: p?.height_cm ? Math.round(p.height_cm / 5) * 5 : null,
          wB: p?.weight_kg ? Math.round(p.weight_kg / 2) * 2 : null,
        };
        const key = hashKey(cachePayload);
        const cacheRef = db.collection("aiExerciseEstimates").doc(key);

        try {
          const snap = await cacheRef.get();
          if (snap.exists) {
            res.set("Cache-Control", "no-store");
            res.status(200).json(snap.data());
            return;
          }
        } catch (e: any) {
          console.warn("[exercise:v1] cache read error", e);
        }

        const dayId = new Date().toISOString().slice(0, 10);
        const quotaRef = db.collection("aiQuota").doc(`${uid}_${dayId}`);
        let count = 0;
        try {
          const q = await quotaRef.get();
          count = (q.exists ? q.data()?.count || 0 : 0) as number;
        } catch {}

        if (count >= 10) {
          const h = heuristicCaloriesEstimate(text, p || undefined);
          res.set("Cache-Control", "no-store");
          res.status(200).json(h);
          return;
        }

        const prompt = buildExerciseDescribePrompt({
          text,
          profile: p,
          system: body.system,
        });

        try {
          const est = await callOpenAIForExerciseEstimate(prompt);

          const calories = Number(est?.calories);
          const finalEst =
            Number.isFinite(calories) && calories > 0
              ? est
              : heuristicCaloriesEstimate(text, p || undefined);

          try {
            await cacheRef.set({
              ...finalEst,
              cachePayload,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await quotaRef.set({ count: count + 1 }, { merge: true });
          } catch (e: any) {
            console.warn("[exercise:v1] cache/quota write error", e);
          }

          res.set("Cache-Control", "no-store");
          res.status(200).json(finalEst);
          return;
        } catch (e: any) {
          console.warn("[exercise:v1] OpenAI failed", e?.message || e);
          const h = heuristicCaloriesEstimate(text, p || undefined);
          res.set("Cache-Control", "no-store");
          res.status(200).json(h);
          return;
        }
      }

      // Old v1
      if (mode === "meal:v1") {
        const prompt = buildMealPromptV1({
          text: body.query || body.rawText || "",
          context: body.context ?? {},
          system: body.system,
        });
        const resultV1 = (await callOpenAIForJson(
          prompt,
          "meal"
        )) as MealResultV1;
        res.set("Cache-Control", "no-store");
        res.status(200).json(resultV1);
        return;
      }

      res.set("Cache-Control", "no-store");
      res.status(400).json({ error: "unknown-mode" });
    } catch (err: any) {
      console.error("describe error", err);
      res
        .status(500)
        .json({ error: "internal", detail: err?.message ?? String(err) });
    }
  }
);

/* ───────────────────── Prompt builders ───────────────────── */

function buildWorkoutPrompt(args: {
  today: string;
  profile: any;
  recent: any[];
  system?: string;
  regenToken?: string | number;
}) {
  const sys =
    args.system ||
    [
      "You are a concise strength coach.",
      "Return ONLY JSON with keys:",
      " - items: array of {exercise, sets, reps, weight_kg?, notes?}",
      " - rationale: short string (optional).",
      "Rules:",
      "• 4–7 exercises; prefer compounds first, then accessories.",
      "• Tailor to goal.",
      "• Respect equipment and injuries.",
      "• Add a brief progressive overload note.",
      "• If rest day, return recovery, not lifting.",
      "• Keep rationale one sentence.",
    ].join(" ");

  const recentCompressed = (args.recent || []).map((r) => ({
    d: r.date,
    e: r.exercise,
    s: r.sets,
    r: r.reps,
    w: r.weight_kg,
  }));

  const user = [
    `Today: ${args.today}`,
    `Profile: ${JSON.stringify(args.profile ?? {})}`,
    `Recent (last 12): ${JSON.stringify(recentCompressed)}`,
    args.regenToken ? `Regenerate token: ${args.regenToken}` : "",
    "Output JSON only.",
  ].join("\n");

  return { system: sys, user };
}

function buildMacroCompletionPrompt(args: {
  date: string;
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
  totals: { calories: number; protein: number; carbs: number; fat: number };
  prefs: MacroCompletionPrefs | null;
  count: number;
  lockedSuggestionIds: string[];
  swapIndex: number | null;
  regenToken?: string;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are a calm, precise nutrition planner.",
      "Goal: suggest 2–4 meal/snack ideas to finish TODAY based on remaining macros.",
      "IMPORTANT:",
      "• Return ONLY strict JSON matching the schema (no extra text).",
      "• Suggest foods/meal ideas, NOT recipes.",
      "• Respect dietary restrictions + allergies strictly (never include allergens).",
      "• Avoid dislikes; bias toward likes.",
      "• Align to 'moreOf' and 'avoidLimit' goals (e.g., more protein/fiber, less added sugar).",
      "• Keep tone neutral and not pushy.",
      "Output diversity: avoid repeating the same core protein/carb across suggestions.",
      "If a regenerate token is provided, change the options meaningfully.",
    ].join(" ");

  const user = [
    `Date: ${args.date}`,
    `Remaining macros (kcal/P/C/F): ${args.remaining.calories}/${args.remaining.protein}/${args.remaining.carbs}/${args.remaining.fat}`,
    `Totals so far (kcal/P/C/F): ${args.totals.calories}/${args.totals.protein}/${args.totals.carbs}/${args.totals.fat}`,
    `Daily targets (kcal/P/C/F): ${args.goals.calories}/${args.goals.protein}/${args.goals.carbs}/${args.goals.fat}`,
    `Preferences: ${JSON.stringify(args.prefs || {})}`,
    `Count: ${args.count}`,
    `Locked suggestion IDs: ${JSON.stringify(args.lockedSuggestionIds || [])}`,
    `Swap index (optional): ${
      args.swapIndex == null ? "none" : String(args.swapIndex)
    }`,
    args.regenToken ? `Regenerate token: ${args.regenToken}` : "",
    "Return JSON only.",
  ].join("\n");

  return { system: sys, user };
}

function buildScanMealPromptV1(args: {
  units?: "metric" | "imperial";
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are a nutrition analyst. Identify foods in the photo and estimate macros.",
      "Return ONLY strict JSON that matches the schema.",
      "Rules:",
      "• Detect 1–8 foods max. Use common names (e.g., 'chicken breast', 'rice').",
      "• Confidence: high/medium/low. Use low when unsure.",
      "• For each food, output macros for the estimated portion.",
      "• Portion must include amount, unit, multiplier. Use unit in [g, oz, cups, tbsp, piece].",
      "• If you cannot estimate a nutrient, output 0 (never null).",
      "• Include sauces/oils if visible as separate items (e.g., 'olive oil', 'sauce').",
      "• suggestions must ALWAYS be an array (use [] if none).",
      "• rationale must ALWAYS be a string (use '' if none).",
      "• Keep suggestions short (0–4).",
    ].join(" ");

  const user = [
    `Units preference: ${args.units || "metric"}`,
    "Return JSON only.",
  ].join("\n");

  return { system: sys, user };
}

/** Strict v1 (items[]) — preserved for legacy clients */
function buildMealPromptV1(args: {
  text: string;
  context: any;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are a nutrition assistant.",
      "Return ONLY JSON with key 'items' as an array of objects.",
      "Each item can include: name, serving, calories, protein, carbs, fat, sugar, fiber.",
      "If a value is unknown, omit that property.",
    ].join(" ");
  const user = `Meal description: ${args.text}\nContext: ${JSON.stringify(
    args.context ?? {}
  )}`;
  return { system: sys, user };
}

/** prompt for meal_suggest:v1 — ONLY MEAL IDEAS (adds n) */
function buildMealSuggestPrompt(args: {
  meal?: "breakfast" | "lunch" | "dinner" | "snacks";
  goals: { calories?: number; protein?: number; carbs?: number; fat?: number };
  totals: { calories?: number; protein?: number; carbs?: number; fat?: number };
  notes?: string;
  profile?: any;
  n: number;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are a concise nutrition planner.",
      "Generate ONLY meal ideas to hit TODAY'S REMAINING macros.",
      "Return strictly JSON: { meals: [...] } (3–5 items).",
      "Each meal: name + calories/protein/carbs/fat (+ optional sugar/fiber/notes).",
      "No generic advice, no workouts, no habits. Meals only.",
      "Names short. Numbers are numbers. No nulls.",
    ].join(" ");

  const goals = {
    k: num(args.goals?.calories, 2200),
    p: num(args.goals?.protein, 120),
    c: num(args.goals?.carbs, 220),
    f: num(args.goals?.fat, 75),
  };
  const totals = {
    k: num(args.totals?.calories, 0),
    p: num(args.totals?.protein, 0),
    c: num(args.totals?.carbs, 0),
    f: num(args.totals?.fat, 0),
  };
  const remaining = {
    k: Math.max(0, goals.k - totals.k),
    p: Math.max(0, goals.p - totals.p),
    c: Math.max(0, goals.c - totals.c),
    f: Math.max(0, goals.f - totals.f),
  };

  const user = [
    `Meal slot: ${args.meal || "any"}`,
    `Remaining (kcal/P/C/F): ${remaining.k}/${remaining.p}/${remaining.c}/${remaining.f}`,
    `Notes: ${args.notes || "(none)"}`,
    `Profile (optional): ${JSON.stringify(args.profile || {})}`,
    `n: ${args.n}`,
    "Return JSON only.",
  ].join("\n");

  return { system: sys, user };
}

/** ✅ CHEAPER v2 prompt — no few-shots, minimal text, still strict JSON */
function buildMealPromptV2Cheap(args: {
  text: string;
  context: any;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You estimate TOTAL nutrition for the whole meal.",
      "Return ONLY JSON matching schema.",
      "Be conservative; include sauces/oils/cheese.",
      "If amounts unclear, assume common single serving (quantity=1).",
    ].join(" ");

  const ctx = stableCtx(args.context);

  const user = `Meal: ${String(args.text || "").slice(
    0,
    900
  )}\nContext: ${JSON.stringify(ctx)}`;

  return { system: sys, user };
}

/** prompt for suggest:v1 — MULTI-card list (unchanged) */
function buildSuggestionListPrompt(args: {
  date: string;
  timeOfDay: number;
  isRestDay: boolean;
  goals: { calories?: number; protein?: number };
  totals: { calories?: number; protein?: number; burned?: number };
  count: number;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are a health coach who writes SHORT, actionable daily suggestions.",
      "Return ONLY JSON as an ARRAY of card objects: [{icon,title,body,ctaLabel,href,tint}, ...].",
      "Icons: Ionicons names like 'barbell-outline', 'fast-food-outline', 'leaf-outline', 'thumbs-up-outline'.",
      "href: app route string like '/(tabs)/workouts' or '/(tabs)/nutrition'.",
      "tint: 'workout' | 'meal' | 'recovery' | 'ok'.",
      "STRICT OUTPUT LENGTHS:",
      "- title: <= 40 chars.",
      "- body: <= 120 chars. No emojis. Actionable, specific.",
      "Rules:",
      "• Prioritize recovery ideas on rest days.",
      "• If no workout yet, include at least 1 training suggestion.",
      "• If calories/protein below target, include at least 1 meal suggestion.",
      "• Otherwise include positive reinforcement or habit tips.",
      "• All cards must be diverse and non-duplicative.",
    ].join(" ");

  const payload = {
    d: args.date,
    tod: clampInt(args.timeOfDay, 0, 23),
    rest: !!args.isRestDay,
    g: {
      k: num(args.goals?.calories, 2200),
      p: num(args.goals?.protein, 120),
    },
    t: {
      k: num(args.totals?.calories, 0),
      p: num(args.totals?.protein, 0),
      b: num(args.totals?.burned, 0),
    },
    n: clampCount(args.count),
  };

  const user = `Context: ${JSON.stringify(payload)}\nReturn a JSON ARRAY of ${
    payload.n
  } cards only.`;

  return { system: sys, user };
}

function buildExerciseDescribePrompt(args: {
  text: string;
  profile?: {
    sex?: string;
    age?: number;
    height_cm?: number;
    weight_kg?: number;
    fitnessLevel?: string;
  } | null;
  system?: string;
}) {
  const sys =
    args.system ||
    [
      "You are an exercise physiologist.",
      "Parse the session and estimate total calories burned.",
      "Return ONLY JSON matching the schema exactly.",
      "If duration unclear, infer conservatively.",
      "Prefer UNDER-estimating calories.",
    ].join(" ");

  const payload = {
    text: args.text,
    profile: args.profile || null,
  };

  const user = `Session: ${JSON.stringify(payload)}\nReturn JSON only.`;
  return { system: sys, user };
}

/* ───────────────────── OpenAI callers ───────────────────── */

async function callOpenAIForJson(
  prompt: { system: string; user: string },
  kind: "workout" | "meal"
): Promise<Plan | MealResultV1> {
  const key = getOpenAIKey();

  const base: any = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    temperature: 0.3,
  };

  const body =
    kind === "meal"
      ? {
          ...base,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "MealItemsV1",
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["name"],
                      properties: {
                        name: { type: "string" },
                        serving: { type: "string" },
                        calories: { type: "number" },
                        protein: { type: "number" },
                        carbs: { type: "number" },
                        fat: { type: "number" },
                        sugar: { type: "number" },
                        fiber: { type: "number" },
                      },
                    },
                  },
                  rationale: { type: "string" },
                },
              },
            },
          },
        }
      : {
          ...base,
          response_format: { type: "json_object" },
        };

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    console.error("[openai chat] http_error", {
      status: rsp.status,
      body: t.slice(0, 1000),
    });
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  try {
    return JSON.parse(typeof text === "string" ? text : String(text));
  } catch {
    return kind === "meal"
      ? ({ items: [] } as MealResultV1)
      : ({ items: [] } as any);
  }
}

function extractResponsesText(data: any): string {
  const out = Array.isArray(data?.output) ? data.output : [];
  for (const item of out) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    const textPart = content.find((c: any) => c?.type === "output_text");
    if (textPart?.text) return String(textPart.text);
    const alt = content.find((c: any) => typeof c?.text === "string");
    if (alt?.text) return String(alt.text);
  }
  if (typeof data?.output_text === "string") return data.output_text;
  return "";
}

function looksLikeGsUrl(url: string) {
  return /^gs:\/\//i.test(url);
}
function looksLikeHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
function stripDataUrl(s: string) {
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!m) return { mime: "", b64: s };
  return { mime: m[1], b64: m[2] };
}
function detectMimeFromBase64(b64: string): string {
  const head = b64.slice(0, 20);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  return "";
}
function isSupportedMime(mime: string) {
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/gif" ||
    mime === "image/webp"
  );
}

async function callOpenAIForScanMealV1(
  prompt: { system: string; user: string },
  img: { imageUrl?: string; imageDataUrl?: string }
): Promise<ScanMealResponse> {
  const key = getOpenAIKey();

  // ✅ pick + validate image input BEFORE calling OpenAI
  const rawUrl = String(img.imageUrl || "").trim();
  let rawData = String(img.imageDataUrl || "").trim();

  let image_url = "";

  if (rawUrl) {
    if (looksLikeGsUrl(rawUrl)) {
      throw new Error(
        "imageUrl is gs:// (not supported). Send a public https URL or send base64 data URL."
      );
    }
    if (!looksLikeHttpUrl(rawUrl)) {
      throw new Error("imageUrl must be http(s)://");
    }
    image_url = rawUrl;
  } else if (rawData) {
    // remove whitespace/newlines that often break base64
    rawData = rawData.replace(/\s+/g, "");

    const { mime: declaredMime, b64 } = stripDataUrl(rawData);
    const detectedMime = detectMimeFromBase64(b64);
    const mime = detectedMime || declaredMime || "image/jpeg";

    if (!isSupportedMime(mime)) {
      throw new Error(
        `Unsupported image mime '${mime}'. Use jpeg/png/gif/webp (HEIC not supported).`
      );
    }

    // verify decode works + non-trivial size
    const buf = Buffer.from(b64, "base64");
    if (!buf || buf.length < 200) {
      throw new Error("Invalid image base64 (too small or not an image).");
    }

    image_url = `data:${mime};base64,${b64}`;
  } else {
    throw new Error("Missing imageUrl/imageDataUrl.");
  }

  const rsp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_output_tokens: 650,
      instructions: prompt.system,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt.user },
            { type: "input_image", image_url }, // ✅ use validated/normalized value
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ScanMealResponse",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["foods", "rationale"],
            properties: {
              foods: {
                type: "array",
                minItems: 0,
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "id",
                    "name",
                    "confidence",
                    "portion",
                    "macros",
                    "suggestions",
                  ],
                  properties: {
                    id: { type: "string" },
                    name: { type: "string", maxLength: 80 },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low", "manual"],
                    },
                    portion: {
                      type: "object",
                      additionalProperties: false,
                      required: ["amount", "unit", "multiplier"],
                      properties: {
                        amount: { type: "number", minimum: 0.1 },
                        unit: {
                          type: "string",
                          enum: ["g", "oz", "cups", "tbsp", "piece"],
                        },
                        multiplier: { type: "number", minimum: 0.1 },
                      },
                    },
                    macros: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "calories",
                        "protein",
                        "carbs",
                        "fat",
                        "sugar",
                        "fiber",
                        "sodiumMg",
                        "satFat",
                      ],
                      properties: {
                        calories: { type: "number", minimum: 0 },
                        protein: { type: "number", minimum: 0 },
                        carbs: { type: "number", minimum: 0 },
                        fat: { type: "number", minimum: 0 },
                        sugar: { type: "number", minimum: 0 },
                        fiber: { type: "number", minimum: 0 },
                        sodiumMg: { type: "number", minimum: 0 },
                        satFat: { type: "number", minimum: 0 },
                      },
                    },
                    suggestions: {
                      type: "array",
                      minItems: 0,
                      maxItems: 4,
                      items: { type: "string", maxLength: 40 },
                    },
                  },
                },
              },
              rationale: { type: "string", maxLength: 220 },
            },
          },
        },
      },
    }),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    console.error(
      "[openai scan_meal:v1] http_error",
      rsp.status,
      t.slice(0, 600)
    );
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text = extractResponsesText(data) || "{}";

  // Defensive parse + normalization
  let parsed: any = {};
  try {
    parsed = JSON.parse(typeof text === "string" ? text : String(text));
  } catch {
    return { foods: [], rationale: "Could not parse scan response." };
  }

  const foodsRaw = Array.isArray(parsed?.foods) ? parsed.foods : [];
  const foods: ScanFood[] = foodsRaw.slice(0, 8).map((f: any, idx: number) => {
    const id = String(f?.id || `food_${idx}_${Date.now()}`);

    const unit =
      f?.portion?.unit === "g" ||
      f?.portion?.unit === "oz" ||
      f?.portion?.unit === "cups" ||
      f?.portion?.unit === "tbsp" ||
      f?.portion?.unit === "piece"
        ? f.portion.unit
        : "piece";

    const amount = num(f?.portion?.amount, 1);
    const multiplier = num(f?.portion?.multiplier, amount || 1);

    const conf =
      f?.confidence === "high" ||
      f?.confidence === "medium" ||
      f?.confidence === "low" ||
      f?.confidence === "manual"
        ? (f.confidence as ScanConfidence)
        : "medium";

    const m = f?.macros || {};
    const macros: ScanMacros = {
      calories: num(m.calories, 0),
      protein: num(m.protein, 0),
      carbs: num(m.carbs, 0),
      fat: num(m.fat, 0),
      sugar: num(m.sugar, 0),
      fiber: num(m.fiber, 0),
      sodiumMg: num(m.sodiumMg, 0),
      satFat: num(m.satFat, 0),
    };

    // ✅ suggestions MUST always be array for schema compliance
    const suggestions = Array.isArray(f?.suggestions)
      ? f.suggestions.map((s: any) => String(s).slice(0, 40)).slice(0, 4)
      : [];

    return {
      id,
      name: String(f?.name || "Food").slice(0, 80),
      confidence: conf,
      portion: {
        amount: Math.max(0.1, amount),
        unit,
        multiplier: Math.max(0.1, multiplier),
      },
      macros,
      suggestions,
    };
  });

  // ✅ rationale MUST always be string for schema compliance
  const rationale =
    typeof parsed?.rationale === "string" ? parsed.rationale : "";

  return { foods, rationale };
}

async function callOpenAIForMacroCompletion(
  prompt: { system: string; user: string },
  opts: { count: number; seed?: string; temperature?: number }
): Promise<MacroCompletionResponse> {
  const key = getOpenAIKey();
  const n = Math.max(2, Math.min(4, Number(opts.count) || 3));

  const body: any = {
    model: "gpt-4o-mini",
    temperature:
      typeof opts.temperature === "number" ? opts.temperature : 0.55,
    presence_penalty: 0.25,
    frequency_penalty: 0.15,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "MacroCompletionResponse",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["v", "date", "remaining", "suggestions", "rationale"],
          properties: {
            v: { type: "number", enum: [1] },
            date: { type: "string", maxLength: 10 },
            remaining: {
              type: "object",
              additionalProperties: false,
              required: ["calories", "protein", "carbs", "fat"],
              properties: {
                calories: { type: "number", minimum: 0 },
                protein: { type: "number", minimum: 0 },
                carbs: { type: "number", minimum: 0 },
                fat: { type: "number", minimum: 0 },
              },
            },
            preferencesUsed: {
              type: "object",
              additionalProperties: false,
              properties: {
                restrictions: {
                  type: "array",
                  items: { type: "string", maxLength: 32 },
                },
                allergies: {
                  type: "array",
                  items: { type: "string", maxLength: 32 },
                },
                dislikes: {
                  type: "array",
                  items: { type: "string", maxLength: 40 },
                },
                likes: {
                  type: "array",
                  items: { type: "string", maxLength: 40 },
                },
                moreOf: {
                  type: "array",
                  items: { type: "string", maxLength: 32 },
                },
                avoidLimit: {
                  type: "array",
                  items: { type: "string", maxLength: 32 },
                },
                notes: { type: "string", maxLength: 220 },
              },
            },
            suggestions: {
              type: "array",
              minItems: n,
              maxItems: n,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "label", "foods", "macros", "tags"],
                properties: {
                  id: { type: "string", maxLength: 32 },
                  label: { type: "string", maxLength: 28 },
                  foods: {
                    type: "array",
                    minItems: 1,
                    maxItems: 4,
                    items: { type: "string", maxLength: 60 },
                  },
                  macros: {
                    type: "object",
                    additionalProperties: false,
                    required: ["calories", "protein", "carbs", "fat"],
                    properties: {
                      calories: { type: "number", minimum: 0 },
                      protein: { type: "number", minimum: 0 },
                      carbs: { type: "number", minimum: 0 },
                      fat: { type: "number", minimum: 0 },
                    },
                  },
                  tags: {
                    type: "array",
                    minItems: 0,
                    maxItems: 6,
                    items: { type: "string", maxLength: 28 },
                  },
                  notes: { type: "string", maxLength: 160 },
                },
              },
            },
            rationale: { type: "string", maxLength: 220 },
          },
        },
      },
    },
  };

  if (opts.seed) body.seed = stringToSeed(String(opts.seed));

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    console.error(
      "[openai macro_completion] HTTP",
      rsp.status,
      t.slice(0, 600)
    );
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  return JSON.parse(typeof text === "string" ? text : String(text));
}

/** OpenAI caller for meal_suggest:v1 — exact n (3..5) + optional seed */
async function callOpenAIForMealIdeas(
  prompt: { system: string; user: string },
  opts: { n: number; seed?: string }
): Promise<MealIdeasResponse> {
  const key = getOpenAIKey();
  const n = Math.max(3, Math.min(5, Number(opts.n) || 5));

  const body: any = {
    model: "gpt-4o-mini",
    temperature: 0.7,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "MealIdeasResponse",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["meals"],
          properties: {
            meals: {
              type: "array",
              minItems: n,
              maxItems: n,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "calories", "protein", "carbs", "fat"],
                properties: {
                  name: { type: "string", maxLength: 60 },
                  meal: {
                    type: "string",
                    enum: ["breakfast", "lunch", "dinner", "snacks"],
                  },
                  calories: { type: "number", minimum: 0 },
                  protein: { type: "number", minimum: 0 },
                  carbs: { type: "number", minimum: 0 },
                  fat: { type: "number", minimum: 0 },
                  sugar: { type: "number", minimum: 0 },
                  fiber: { type: "number", minimum: 0 },
                  prep_min: { type: "number", minimum: 0 },
                  difficulty: {
                    type: "string",
                    enum: ["easy", "moderate", "advanced"],
                  },
                  notes: { type: "string", maxLength: 160 },
                },
              },
            },
          },
        },
      },
    },
  };

  if (opts.seed) body.seed = stringToSeed(String(opts.seed));

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    console.error("[openai meal_suggest] HTTP", rsp.status, t);
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  try {
    const parsed = JSON.parse(typeof text === "string" ? text : String(text));
    if (parsed && Array.isArray(parsed.meals))
      return parsed as MealIdeasResponse;
    return { meals: [] };
  } catch (e: any) {
    console.error("[openai meal_suggest] JSON parse error", e?.message || e);
    throw e;
  }
}

async function callOpenAIForMealV2(prompt: {
  system: string;
  user: string;
}): Promise<MealV2> {
  const key = getOpenAIKey();

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 220,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "MealV2Totals",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "quantity",
            "unit",
            "calories",
            "protein",
            "carbs",
            "fat",
            "sugar",
            "fiber",
          ],
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            sugar: { type: "number" },
            fiber: { type: "number" },
          },
        },
      },
    },
  };

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    console.error("[openai meal:v2] http_error", rsp.status, t.slice(0, 400));
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  const out: MealV2 = {
    name: "Meal",
    quantity: 1,
    unit: "serving",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
  };

  try {
    const parsed = JSON.parse(typeof text === "string" ? text : String(text));
    return {
      name: String(parsed?.name ?? out.name),
      quantity: num(parsed?.quantity, 1),
      unit: String(parsed?.unit ?? out.unit),
      calories: num(parsed?.calories, 0),
      protein: num(parsed?.protein, 0),
      carbs: num(parsed?.carbs, 0),
      fat: num(parsed?.fat, 0),
      sugar: num(parsed?.sugar, 0),
      fiber: num(parsed?.fiber, 0),
    };
  } catch (e: any) {
    console.error(
      "[meal:v2] parse_fail",
      e?.message || e,
      String(text).slice(0, 250)
    );
    return out;
  }
}

async function callOpenAIForSuggestionList(
  prompt: { system: string; user: string },
  seed?: string
): Promise<SuggestionCard[]> {
  const key = getOpenAIKey();

  const body: any = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 260,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "SuggestionList",
        strict: true,
        schema: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["icon", "title", "body", "ctaLabel", "href", "tint"],
            properties: {
              icon: { type: "string" },
              title: { type: "string", maxLength: 40 },
              body: { type: "string", maxLength: 120 },
              ctaLabel: { type: "string", maxLength: 30 },
              href: { type: "string" },
              tint: {
                type: "string",
                enum: ["workout", "meal", "recovery", "ok"],
              },
            },
          },
        },
      },
    },
  };
  if (seed) body.seed = stringToSeed(seed);

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "[]";

  try {
    const arr = JSON.parse(typeof text === "string" ? text : String(text));
    if (Array.isArray(arr) && arr.length) return arr as SuggestionCard[];
  } catch {}
  return [];
}

async function callOpenAIForSuggestion(prompt: {
  system: string;
  user: string;
}): Promise<SuggestionCard> {
  const key = getOpenAIKey();

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 160,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "SuggestionCard",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["icon", "title", "body", "ctaLabel", "href", "tint"],
          properties: {
            icon: { type: "string" },
            title: { type: "string", maxLength: 40 },
            body: { type: "string", maxLength: 140 },
            ctaLabel: { type: "string", maxLength: 30 },
            href: { type: "string" },
            tint: {
              type: "string",
              enum: ["workout", "meal", "recovery", "ok"],
            },
          },
        },
      },
    },
  };

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  try {
    const parsed = JSON.parse(typeof text === "string" ? text : String(text));
    if (
      parsed &&
      typeof parsed.title === "string" &&
      typeof parsed.ctaLabel === "string" &&
      typeof parsed.href === "string" &&
      typeof parsed.tint === "string"
    ) {
      return parsed as SuggestionCard;
    }
  } catch {}
  throw new Error("bad-suggestion-json");
}

async function callOpenAIForExerciseEstimate(prompt: {
  system: string;
  user: string;
}): Promise<ExerciseEstimate> {
  const key = getOpenAIKey();

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ExerciseEstimate",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "calories"],
          properties: {
            name: { type: "string", maxLength: 30 },
            calories: { type: "number", minimum: 0 },
            minutes: { type: "number", minimum: 0 },
            mets: { type: "number", minimum: 0 },
            rationale: { type: "string", maxLength: 160 },
          },
        },
      },
    },
  };

  const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!rsp.ok) {
    const t = await safeText(rsp);
    throw new Error(`OpenAI ${rsp.status}: ${t}`);
  }

  const data: any = await rsp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.message ??
    data?.choices?.[0]?.text ??
    "{}";

  let out: ExerciseEstimate = { name: "Exercise", calories: 0 };
  try {
    const parsed = JSON.parse(typeof text === "string" ? text : String(text));
    out = {
      name: String(parsed?.name ?? out.name),
      calories: num(parsed?.calories, 0),
      minutes: parsed?.minutes != null ? num(parsed?.minutes, 0) : undefined,
      mets: parsed?.mets != null ? num(parsed?.mets, 0) : undefined,
      rationale:
        typeof parsed?.rationale === "string" ? parsed.rationale : undefined,
    };
  } catch {}
  return out;
}

/* ───────────────────────── Helpers ───────────────────────── */
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clampInt(n: number, lo: number, hi: number) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
function clampCount(n: any) {
  const x = Number(n ?? 3);
  return Math.min(5, Math.max(3, Number.isFinite(x) ? x : 3));
}
function bucket(val: number, stops: number[]): string {
  let i = 0;
  while (i < stops.length && val > stops[i]) i++;
  return `b${i}`;
}
function todBucket(h: number): string {
  if (h < 11) return "morning";
  if (h < 15) return "afternoon";
  if (h < 19) return "evening";
  return "night";
}
function buildBucketKey(args: {
  date: string;
  hour: number;
  isRestDay: boolean;
  hasWorkout: boolean;
  cRem: number;
  pRem: number;
}): string {
  const t = todBucket(args.hour);
  const cB = bucket(args.cRem, [200, 500]);
  const pB = bucket(args.pRem, [20, 40]);
  const r = args.isRestDay ? "R1" : "R0";
  const w = args.hasWorkout ? "W1" : "W0";
  return `${args.date}|${t}|${r}|${w}|C${cB}|P${pB}`;
}

function pickText(body: any): string {
  return String(
    body?.query ??
      body?.rawText ??
      body?.text ??
      body?.prompt ??
      body?.input ??
      ""
  ).trim();
}

async function safeText(r: any): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

function hashKey(payload: any) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}

function stableCtx(context: any) {
  if (!context || typeof context !== "object") return {};
  const out: any = {};
  const allow = ["meal", "notes", "unit", "qty", "brand", "restaurant"];
  for (const k of allow) {
    if (context[k] == null) continue;
    const v = context[k];
    out[k] = typeof v === "string" ? v.slice(0, 120) : v;
  }
  return out;
}

async function enforceMinInterval(args: {
  uid: string;
  namespace: string;
  minMs: number;
}): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const ref = db.collection("aiRate").doc(`${args.uid}_${args.namespace}`);
  const now = Date.now();
  try {
    const snap = await ref.get();
    const last = snap.exists ? Number(snap.data()?.ts || 0) : 0;
    const delta = now - last;
    if (last && delta < args.minMs) {
      return { allowed: false, retryAfterMs: Math.max(0, args.minMs - delta) };
    }
    await ref.set({ ts: now }, { merge: true });
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

function withMealV1Mirror(v2: MealV2, meta: Record<string, any> = {}) {
  const v1Mirror: MealResultV1 = {
    items: [
      {
        name: v2.name,
        serving: v2.unit,
        unit: v2.unit,
        qty: v2.quantity,
        calories: v2.calories,
        protein: v2.protein,
        carbs: v2.carbs,
        fat: v2.fat,
        sugar: v2.sugar,
        fiber: v2.fiber,
      },
    ],
    rationale: undefined,
  };
  return { ...v2, ...v1Mirror, ...meta };
}

function heuristicMealTotals(text: string, _context?: any): MealV2 {
  const t = String(text || "").toLowerCase();

  let name = "Meal";
  let calories = 550;
  let protein = 35;
  let carbs = 55;
  let fat = 20;
  let sugar = 10;
  let fiber = 6;

  if (/\b(chicken|turkey|beef|steak|salmon|tuna|shrimp|eggs?)\b/.test(t)) {
    protein += 15;
    calories += 150;
    fat += 5;
    name = "Protein-based meal";
  }
  if (
    /\b(rice|pasta|bread|bagel|wrap|tortilla|fries|potato|sweet potato)\b/.test(
      t
    )
  ) {
    carbs += 25;
    calories += 160;
    name = name === "Meal" ? "Carb + protein meal" : name;
  }
  if (/\b(cheese|mayo|aioli|cream|butter|oil|sauce|dressing)\b/.test(t)) {
    fat += 10;
    calories += 120;
    sugar += /\b(bbq|teriyaki|sweet)\b/.test(t) ? 8 : 0;
    name = name === "Meal" ? "Meal with sauce" : name;
  }
  if (/\b(salad|veggies|vegetable|greens)\b/.test(t)) {
    fiber += 4;
    calories -= 80;
    carbs -= 10;
    name = name === "Meal" ? "Salad-style meal" : name;
  }

  const clamp0 = (n: number) => Math.max(0, Math.round(n));
  const macroCals = protein * 4 + carbs * 4 + fat * 9;
  calories = Math.round((calories + macroCals) / 2);

  return {
    name,
    quantity: 1,
    unit: "serving",
    calories: clamp0(calories),
    protein: clamp0(protein),
    carbs: clamp0(carbs),
    fat: clamp0(fat),
    sugar: clamp0(sugar),
    fiber: clamp0(fiber),
  };
}

function heuristicCaloriesEstimate(
  text: string,
  p?: { weight_kg?: number }
): { name: string; calories: number; rationale: string } {
  const t = text.toLowerCase();
  let basePer30 = 120;
  if (/\b(run|jog|sprint|treadmill)\b/.test(t)) basePer30 = 350;
  else if (/\b(hiit|interval|burpee|metcon|circuit)\b/.test(t)) basePer30 = 320;
  else if (/\b(cycle|bike|spin)\b/.test(t)) basePer30 = 280;
  else if (/\b(swim|laps)\b/.test(t)) basePer30 = 300;
  else if (/\b(walk|steps|hike)\b/.test(t)) basePer30 = 180;
  else if (/\b(row|erg)\b/.test(t)) basePer30 = 260;
  else if (/\b(yoga|pilates|mobility|stretch)\b/.test(t)) basePer30 = 140;
  else if (
    /\b(strength|weights|lifting|barbell|dumbbell|bench|squat|deadlift)\b/.test(
      t
    )
  )
    basePer30 = 220;

  const minMatch = t.match(/(\d{1,3})\s?(min|mins|minutes)/);
  const hrMatch = t.match(/(\d(?:\.\d)?)\s?(h|hr|hrs|hour|hours)/);
  let mins = 30;
  if (minMatch) mins = Math.max(5, Math.min(180, Number(minMatch[1])));
  else if (hrMatch)
    mins = Math.max(10, Math.min(180, Math.round(Number(hrMatch[1]) * 60)));

  const w = Number(p?.weight_kg || 0);
  const massScale = w ? Math.min(1.3, Math.max(0.7, w / 70)) : 1;

  const cals = Math.round((basePer30 / 30) * mins * massScale);
  return {
    name: "Exercise session",
    calories: Math.max(0, cals),
    rationale: "Heuristic fallback used (model unavailable).",
  };
}

function profileEnergyShape(src: any | null) {
  if (!src) return null;

  const toNum = (v: any) =>
    Number.isFinite(Number(v)) ? Number(v) : undefined;

  const heightCm =
    toNum(src?.heightCm) ??
    toNum(src?.height_cm) ??
    (toNum(src?.heightIn)
      ? Math.round(Number(src.heightIn) * 2.54)
      : undefined);

  const weightKg =
    toNum(src?.weightKg) ??
    toNum(src?.weight_kg) ??
    (toNum(src?.weightLb)
      ? Math.round(Number(src.weightLb) * 0.453592)
      : undefined);

  const sex =
    (src?.sex || src?.gender || "").toString().toLowerCase() || undefined;

  let age = toNum(src?.age);
  if (!age && src?.birthYear && Number.isFinite(Number(src.birthYear))) {
    const y = new Date().getFullYear() - Number(src.birthYear);
    if (y > 0 && y < 120) age = y;
  }

  const fitnessLevel = src?.fitnessLevel || src?.activityLevel || undefined;

  return { sex, age, height_cm: heightCm, weight_kg: weightKg, fitnessLevel };
}

function ruleBasedSuggestion(args: {
  isRestDay: boolean;
  calories: number;
  protein: number;
  burned: number;
  kcalGoal: number;
  proteinGoal: number;
  hour: number;
}): SuggestionCard {
  const mealSlot =
    args.hour < 11
      ? "breakfast"
      : args.hour < 15
      ? "lunch"
      : args.hour < 19
      ? "dinner"
      : "snacks";
  const cRemaining = Math.max(0, Math.round(args.kcalGoal - args.calories));
  const pRemaining = Math.max(0, Math.round(args.proteinGoal - args.protein));
  const noWorkout = args.burned <= 0;

  if (args.isRestDay) {
    return {
      icon: "leaf-outline",
      title: "Recovery day focus",
      body:
        pRemaining > 0
          ? `Keep it light; aim for ${pRemaining}g protein left. Add a 20–30 min walk and 5–10 min mobility. Hydrate!`
          : "Keep it light: whole foods, 20–30 min walk, 5–10 min mobility. Hydrate!",
      ctaLabel: "Log mobility / walk",
      href: "/(tabs)/workouts",
      tint: "recovery",
    };
  }
  if (noWorkout) {
    return {
      icon: "barbell-outline",
      title: args.hour < 15 ? "Morning boost" : "Evening boost",
      body: "Try 25–35 min full-body (3 rounds, 6–10 reps) or 20 min zone-2 cardio. Keep RPE ~6–7.",
      ctaLabel: "Start a workout",
      href: "/(tabs)/workouts",
      tint: "workout",
    };
  }
  if (cRemaining > 120 || pRemaining > 15) {
    return {
      icon: "fast-food-outline",
      title: `Dial in your ${mealSlot}`,
      body: `~${Math.min(cRemaining, 650)} kcal and ≥${Math.min(
        pRemaining || 25,
        55
      )}g protein. E.g., chicken bowl or Greek yogurt + fruit + granola.`,
      ctaLabel: "Add a meal",
      href: "/(tabs)/nutrition",
      tint: "meal",
    };
  }
  return {
    icon: "thumbs-up-outline",
    title: "Nice pace today",
    body: "On track. Keep meals balanced, hydrate, and cap the day with a short walk.",
    ctaLabel: "Review nutrition",
    href: "/(tabs)/nutrition",
    tint: "ok",
  };
}

function ruleBasedSuggestions(args: {
  count: number;
  context: {
    isRestDay: boolean;
    calories: number;
    protein: number;
    burned: number;
    kcalGoal: number;
    proteinGoal: number;
    hour: number;
  };
}): SuggestionCard[] {
  const n = clampCount(args.count);
  const first = ruleBasedSuggestion(args.context);
  const extras: SuggestionCard[] = [
    {
      icon: "water-outline",
      title: "Hydration check",
      body: "Have a glass of water now; aim for steady sips through the day.",
      ctaLabel: "Log water",
      href: "/(tabs)/nutrition",
      tint: "ok",
    },
    {
      icon: "walk-outline",
      title: "10-minute walk",
      body: "Quick post-meal walk improves glucose control and recovery.",
      ctaLabel: "Log activity",
      href: "/(tabs)/workouts",
      tint: args.context.isRestDay ? "recovery" : "ok",
    },
    {
      icon: "fast-food-outline",
      title: "Protein anchor",
      body: "Add 25–35g protein to your next meal. Yogurt, chicken, tuna, or tofu.",
      ctaLabel: "Add a meal",
      href: "/(tabs)/nutrition",
      tint: "meal",
    },
    {
      icon: "bed-outline",
      title: "Wind-down tonight",
      body: "Aim for 7–9h sleep. Dim lights 60 min before bed; phone away.",
      ctaLabel: "Plan recovery",
      href: "/(tabs)/workouts",
      tint: "recovery",
    },
  ];
  const pool = [first, ...extras];
  return pool.slice(0, n);
}

function stringToSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
