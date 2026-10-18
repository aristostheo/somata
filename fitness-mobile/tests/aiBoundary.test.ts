import test from "node:test";
import assert from "node:assert/strict";
import { requestAIContent } from "../services/aiTransport";
import { validateGeneratedWorkout, validateMealEstimate, validateScanResult } from "../services/aiValidation";
import { projectPendingNutrition } from "../services/previewNutritionProjection";
const macros = { calories: 180, protein: 12, carbs: 22, fat: 5 };
const request = { operation: "meal" as const, text: "Synthetic meal" };
const ai = (value: unknown) => async () => ({ data: value });

test("photo API boundary validates estimates before the confirmed meal handoff changes totals", async () => {
  const raw = await requestAIContent(request, ai({ foods: [{ name: "Synthetic toast", confidence: "medium",
    portion: { amount: 1, unit: "piece", multiplier: 1 }, macros }] }), true);
  const review = validateScanResult(JSON.parse(raw));
  assert.equal(review.foods[0].confidence, "med");
  assert.equal(review.foods[0].macros.fiber, undefined);
  // The screen's explicit confirmation supplies the dated payload; analysis itself writes nothing.
  const rows = projectPendingNutrition(JSON.stringify({ date: "2026-10-12", meal: "lunch",
    items: review.foods.map(food => ({ name: food.name, qty: 1, unit: "piece", ...food.macros })) }),
    "@pending_add_meal_batch_v1", "2026-10-12");
  assert.equal(rows.reduce((sum, row) => sum + row.calories, 0), 180);
});

test("description API boundary preserves true zero and rejects absent, negative and malformed nutrition", async () => {
  const review = JSON.parse(await requestAIContent(request, ai({ name: "Synthetic meal", qty: 1, ...macros, fat: 0 }), true));
  validateMealEstimate(review);
  assert.equal(review.fat, 0);
  for (const fat of [undefined, null, "", " ", -1, Infinity, "bad", false, [], {}]) assert.throws(() => validateMealEstimate({ ...macros, fat }));
  for (const foods of [null, [], [{}]]) assert.throws(() => validateScanResult({ foods }));
});

test("workout API boundary rejects invalid exercises before display, history or session creation", async () => {
  const workout = { name: "Synthetic session", duration: 20, estimatedCalories: 0, warmup: [], cooldown: [],
    exercises: [{ name: "Squat", sets: 3, reps: "8-10", rest: "60 sec", weight: "bodyweight", muscleGroup: "legs" }] };
  validateGeneratedWorkout(JSON.parse(await requestAIContent(request, ai(workout), true)));
  for (const exercises of [null, [], [{}], [{ ...workout.exercises[0], sets: -1 }]]) assert.throws(() => validateGeneratedWorkout({ ...workout, exercises }));
});

test("unauthenticated users cannot call AI; server failures are safe and never retried", async () => {
  let calls = 0;
  const success = async () => { calls++; return { data: { ...macros } }; };
  await assert.rejects(requestAIContent(request, success, false), /Sign in/);
  assert.equal(calls, 0);
  for (const code of ["rate_limited", "timeout", "unsupported_media", "too_large", "invalid_response", "unavailable"]) {
    calls = 0;
    await assert.rejects(requestAIContent(request, async () => { calls++; throw { details: { code }, message: "private payload" }; }, true),
      error => error instanceof Error && !error.message.includes("private"));
    assert.equal(calls, 1);
  }
  await assert.rejects(requestAIContent(request, ai(null), true), /complete estimate/);
});
