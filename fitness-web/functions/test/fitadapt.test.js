const test = require("node:test");
const assert = require("node:assert/strict");
const { mapSomataToFitAdapt, mapAccountObservations } = require("../lib/fitadapt/mapping");
const { callFitAdapt, projectFitAdaptResponse } = require("../lib/fitadapt/client");
const { evaluateForAuthenticatedUser } = require("../lib/fitadapt/evaluate");

const profile = () => ({
  age: 30, heightCm: 180, weightKg: 80, weightUnit: "lb", sex: "male",
  activityLevel: "active", goalInputs: { mode: "cut", proteinPriority: "high" },
  goalResult: { weeklyPaceKg: -0.4 },
});
const engineResponse = () => ({
  policy_version: "test-policy",
  baseline: { target_calories_kcal_per_day: 2200 },
  lifecycle: { stage: "baseline", requirements: ["log_body_weight"], calendar_history_days: 1,
    weight_observation_count: 0, intake_observation_count: 1 },
  recommendation: { status: "insufficient_data", reasons: ["missing_weight_trend"],
    recommended_adjustment_kcal_per_day: null, proposed_intake_target_kcal_per_day: null },
  recommendation_decision: { decision: "defer", numerical_change_proposed: false,
    proposed_calorie_target_kcal_per_day: 2200, activation_readiness: "not_ready" },
  integration_status: { app_status: "more_data_needed", more_data_needed: true,
    proposal_available: false, proposal_requires_review: false },
  plan_adaptation: { action: "hold", activation_ready: false, effective_date: null,
    adaptation_history: [], next_active_macro_plan: null },
});
const nutrition = () => [{ date: "2026-10-01", calories: 0 }];

test("verified auth UID exclusively selects account data and evaluation never writes", async () => {
  const reads = [];
  const stored = profile();
  const before = JSON.stringify(stored);
  const deps = {
    readProfile: async (uid) => { reads.push(["profile", uid]); return stored; },
    readNutrition: async (uid) => { reads.push(["nutrition", uid]); return nutrition(); },
    callEngine: async () => projectFitAdaptResponse(engineResponse()),
  };
  await assert.rejects(evaluateForAuthenticatedUser(null, {}, deps), { code: "unauthenticated" });
  await assert.rejects(evaluateForAuthenticatedUser({ uid: "owner" }, { uid: "attacker" }, deps), { code: "invalid_request" });
  const result = await evaluateForAuthenticatedUser({ uid: "owner" }, {}, deps);
  assert.equal(result.kind, "evaluation");
  assert.deepEqual(reads, [["profile", "owner"], ["nutrition", "owner"]]);
  assert.equal(JSON.stringify(stored), before);
  assert.equal("current_recommendation" in result.evaluation, false);
});

test("saved Somata fields map to the verified schema without identity or local history", () => {
  const source = { ...profile(), email: "private@example.test", displayName: "Private", photoURL: "photo",
    unscopedLocalHistory: [{ t: 1, weightLb: 200 }] };
  const mapped = mapSomataToFitAdapt(source, nutrition());
  assert.equal(mapped.kind, "ready");
  assert.deepEqual(mapped.request.profile, {
    age_years: 30, height_cm: 180, weight_kg: 80,
    sex_for_mifflin_equation: "male", activity_level: "moderately_active",
    goal: "cut", requested_weekly_change_kg: -0.4,
  });
  assert.deepEqual(mapped.request.nutrition_preferences, { macro_strategy: "higher_protein" });
  assert.equal(JSON.stringify(mapped.request).includes("private@example.test"), false);
  assert.equal(JSON.stringify(mapped.request).includes("weightLb"), false);
  assert.equal(mapped.request.observations[0].body_weight_kg, undefined);
});

test("canonical kg stays kg even for lb display, missing differs from recorded zero", () => {
  const mapped = mapSomataToFitAdapt(profile(), [
    { date: "2026-10-01", calories: 0 },
    { date: "2026-10-02" },
    { date: "2026-10-03", calories: 120 },
    { date: "2026-10-03" },
  ]);
  assert.equal(mapped.kind, "ready");
  assert.equal(mapped.request.profile.weight_kg, 80);
  assert.deepEqual(mapped.request.observations, [{ observed_on: "2026-10-01", energy_intake_kcal: 0 }]);
  assert.deepEqual(mapAccountObservations([{ date: "2026-10-02" }], { "2026-10-02": 0 }),
    [{ observed_on: "2026-10-02", energy_intake_kcal: null, steps: 0 }]);
});

test("only account-scoped dated weight entries map to observations", () => {
  const mapped = mapSomataToFitAdapt(profile(), nutrition(), [
    { date: "2026-10-01", weightKg: 79.4 },
    { date: "2026-10-02", weightKg: 79.2 },
  ]);
  assert.equal(mapped.kind, "ready");
  assert.deepEqual(mapped.request.observations[0],
    { observed_on: "2026-10-01", energy_intake_kcal: 0, body_weight_kg: 79.4 });
  assert.equal(mapped.request.observations[1].body_weight_kg, 79.2);
});

test("missing or unsupported saved profile fields return typed insufficiency before calling engine", async () => {
  let called = false;
  const result = await evaluateForAuthenticatedUser({ uid: "owner" }, {}, {
    readProfile: async () => ({ ...profile(), sex: "other", goalResult: undefined }),
    readNutrition: async () => { called = true; return []; },
    callEngine: async () => { called = true; return projectFitAdaptResponse(engineResponse()); },
  });
  assert.equal(result.kind, "insufficient_data");
  assert.deepEqual(result.missing, ["profile.sex_for_mifflin_equation", "profile.goalResult.weeklyPaceKg"]);
  assert.equal(called, false);
});

test("response projection rejects malformed FitAdapt results", () => {
  assert.throws(() => projectFitAdaptResponse({ ...engineResponse(), recommendation: { status: "surprise" } }),
    { code: "invalid_response" });
  assert.deepEqual(projectFitAdaptResponse(engineResponse()).recommendation.reasons, ["missing_weight_trend"]);
  const invalidProposal = engineResponse();
  invalidProposal.recommendation.status = "decrease_calories";
  invalidProposal.recommendation_decision.numerical_change_proposed = true;
  invalidProposal.integration_status.proposal_available = true;
  assert.throws(() => projectFitAdaptResponse(invalidProposal), { code: "invalid_response" });
});

test("client handles timeout, service errors and invalid responses without retries", async () => {
  const request = mapSomataToFitAdapt(profile(), nutrition()).request;
  let attempts = 0;
  const base = { baseUrl: "http://127.0.0.1:8000/", token: "test-only-token" };
  await assert.rejects(callFitAdapt(request, { ...base, timeoutMs: 5, fetcher: (_url, options) => {
    attempts++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  } }), { code: "timeout" });
  assert.equal(attempts, 1);
  await assert.rejects(callFitAdapt(request, { ...base, fetcher: async () => { attempts++; return { ok: false, status: 500 }; } }),
    { code: "service_error" });
  assert.equal(attempts, 2);
  await assert.rejects(callFitAdapt(request, { ...base, fetcher: async () => ({ ok: false, status: 503 }) }),
    { code: "service_unavailable" });
  await assert.rejects(callFitAdapt(request, { ...base, fetcher: async () => ({ ok: true, json: async () => ({}) }) }),
    { code: "invalid_response" });
  await assert.rejects(callFitAdapt(request, { baseUrl: "https://fitadapt.invalid/", token: "", fetcher: async () => { throw Error("unused"); } }),
    { code: "service_unavailable" });
  await assert.rejects(callFitAdapt({ ...request, observations: [{ observed_on: "2026-02-30", energy_intake_kcal: 0 }] }, {
    ...base, fetcher: async () => { throw Error("request should be rejected before fetch"); },
  }), { code: "invalid_request" });
});

test("invalid source nutrition is reported instead of being coerced to zero", () => {
  assert.throws(() => mapSomataToFitAdapt(profile(), [{ date: "2026-10-01", calories: "0" }]),
    { code: "invalid_source_data" });
});
