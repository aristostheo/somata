import assert from "node:assert/strict";
import { test } from "node:test";
import { createRegistrationRunner } from "../services/registerFitAdaptAccount";
import { createSetupRunner, draftFromProfile, missingFitAdaptInputs, savedPaceForDraft, setupProfilePatch,
  validateSetup, validSignedPace, type SetupDraft } from "../services/fitadaptSetup";
import type { Profile } from "../services/profile";
import type { FitAdaptEvaluationResult, FitAdaptPlanState } from "../services/fitadapt";

const complete: Profile = { age: 30, heightCm: 180, weightKg: 80, sex: "male", activityLevel: "active",
  goalInputs: { mode: "cut", proteinPriority: "standard" }, goalResult: { weeklyPaceKg: -0.4 },
  dailyCaloriesTarget: 2319, dailyProteinTarget: 144, carbGoal: 290, fatGoal: 64 };
const emptyState: FitAdaptPlanState = { pending: null, currentRecommendation: null };
const insufficient: FitAdaptEvaluationResult = { kind: "insufficient_data", missing: ["profile.weightKg"], state: emptyState };
const draft: SetupDraft = { age: "30", heightCm: "180", heightFeet: "5", heightInches: "11", weight: "80",
  weightUnit: "kg", sex: "male", activityLevel: "active", mode: "cut", pace: "moderate", proteinPriority: "standard" };

test("new setup validates required fields, signed pace, missing versus zero, and units", () => {
  assert.deepEqual(missingFitAdaptInputs(complete), []);
  assert.equal(validSignedPace("maintain", 0, 80), true);
  assert.equal(validSignedPace("cut", 0, 80), false);
  assert.equal(validSignedPace("cut", -0.7, 80), false);
  assert.equal(validSignedPace("bulk", 0.4, 80), true);
  assert.ok("errors" in validateSetup({ ...draft, age: "" }));
  assert.ok("errors" in validateSetup({ ...draft, sex: "" }));
  assert.ok("errors" in validateSetup({ ...draft, weight: "0" }));
  assert.ok("errors" in validateSetup({ ...draft, mode: "cut", pace: "aggressive", weight: "50" }));
  const imperial = validateSetup({ ...draft, weightUnit: "lb", weight: "176.37", heightFeet: "5", heightInches: "11" });
  assert.ok("values" in imperial);
  if ("values" in imperial) {
    assert.ok(Math.abs(imperial.values.weightKg - 80) < 0.01);
    assert.ok(Math.abs(imperial.values.heightCm - 180.34) < 0.01);
  }
  const maintain = validateSetup({ ...draft, mode: "maintain", pace: "" });
  assert.ok("values" in maintain && maintain.values.weeklyPaceKg === 0);
});

test("new setup saves only real inputs and calculated legacy goals, without accepted targets or invented goal weight", () => {
  const patch = setupProfilePatch(null, draft, "new");
  assert.equal(patch.age, 30);
  assert.equal(patch.weightKg, 80);
  assert.equal(patch.goalInputs?.mode, "cut");
  assert.ok((patch.goalResult?.weeklyPaceKg ?? 0) < 0);
  assert.equal(patch.dailyCaloriesTarget, patch.goalResult?.dailyCalories);
  assert.equal(patch.targetWeightKg, undefined);
  assert.equal(patch.goalInputs?.goalWeight, undefined);
  assert.equal(patch.activeFitAdaptTargets, undefined);
});

test("existing completion fills only missing fields and preserves saved goals and targets", () => {
  const incomplete: Profile = { ...complete, age: undefined, activeFitAdaptTargets: { calories: 2300, protein: 150, carbs: 270, fat: 65 } };
  assert.deepEqual(missingFitAdaptInputs(incomplete), ["age"]);
  const patch = setupProfilePatch(incomplete, { ...draftFromProfile(incomplete), age: "30" }, "existing");
  assert.deepEqual(patch, { age: 30 });
  const noPace: Profile = { ...complete, goalResult: undefined };
  const pacePatch = setupProfilePatch(noPace, { ...draftFromProfile(noPace), pace: "gentle" }, "existing");
  assert.ok((pacePatch.goalResult?.weeklyPaceKg ?? 0) < 0);
  assert.equal(pacePatch.dailyCaloriesTarget, undefined);
  assert.equal(pacePatch.goalInputs, undefined);
  const noWeight: Profile = { ...complete, weightKg: undefined };
  const filledWeight = { ...draftFromProfile(noWeight), weight: "80" };
  assert.equal(savedPaceForDraft(noWeight, filledWeight), -0.4);
  assert.deepEqual(setupProfilePatch(noWeight, filledWeight, "existing"), { weightKg: 80, weightUnit: "kg" });
  const boundary: Profile = { ...complete, weightKg: 300, weightUnit: "lb", age: undefined };
  const boundaryDraft = { ...draftFromProfile(boundary), age: "30" };
  assert.deepEqual(setupProfilePatch(boundary, boundaryDraft, "existing"), { age: 30 });
  assert.deepEqual(setupProfilePatch(complete, draftFromProfile(complete), "existing"), {});
});

test("saved profile precedes callable; insufficiency keeps it; duplicate submission shares one call", async () => {
  const order: string[] = [];
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => { release = resolve; });
  const run = createSetupRunner({
    getPlan: async () => { order.push("plan"); return emptyState; },
    save: async () => { order.push("save"); await blocker; },
    evaluate: async () => { order.push("evaluate"); return insufficient; },
  });
  const first = run(null, draft, "new");
  const second = run(null, draft, "new");
  assert.equal(first, second);
  release();
  assert.deepEqual(await first, { kind: "result", result: insufficient });
  assert.deepEqual(order, ["plan", "save", "evaluate"]);
});

test("accepted plan and pending proposal never trigger setup writes or another evaluation", async () => {
  let writes = 0; let calls = 0;
  let state: FitAdaptPlanState = { ...emptyState, currentRecommendation: { proposalId: "accepted", acceptedAt: 1,
    effectiveDate: "2026-10-01", policyVersion: "v1", targets: { calories: 2200, protein: 150, carbs: 250, fat: 60 } } };
  const run = createSetupRunner({ getPlan: async () => state, save: async () => { writes++; },
    evaluate: async () => { calls++; return insufficient; } });
  assert.deepEqual(await run(complete, draftFromProfile(complete), "existing"), { kind: "active" });
  state = { ...emptyState, pending: { id: "pending", createdAt: 1, status: "pending", responseVersion: "v1",
    sourceFingerprint: "test", effectiveDate: "2026-10-01", reviewRequired: true,
    targets: { calories: 2200, protein: 150, carbs: 250, fat: 60 } } };
  assert.deepEqual(await run(complete, draftFromProfile(complete), "existing"), { kind: "pending" });
  assert.equal(writes, 0); assert.equal(calls, 0);
});

test("complete legacy profile requests review without changing targets; callable failure can retry without a second save", async () => {
  let saves = 0; let calls = 0;
  const run = createSetupRunner({ getPlan: async () => emptyState, save: async () => { saves++; },
    evaluate: async () => { calls++; if (calls === 1) throw new Error("offline"); return insufficient; } });
  await assert.rejects(run(complete, draftFromProfile(complete), "existing"), /offline/);
  assert.deepEqual(await run(complete, draftFromProfile(complete), "existing"), { kind: "result", result: insufficient });
  assert.equal(saves, 0); assert.equal(calls, 2);
  const newRun = createSetupRunner({ getPlan: async () => emptyState, save: async () => { saves++; },
    evaluate: async () => { calls++; if (calls === 3) throw new Error("offline"); return insufficient; } });
  await assert.rejects(newRun(null, draft, "new"), /offline/);
  await newRun(null, draft, "new");
  assert.equal(saves, 1);
});

test("registration retries use the created account and concurrent taps create only one", async () => {
  const account = { uid: "synthetic", email: "new@example.test" };
  let current: typeof account | null = null;
  let creates = 0; let saves = 0;
  const register = createRegistrationRunner({ currentUser: () => current,
    createUser: async () => { creates++; current = account; return account; },
    markEmail: async () => {}, markUid: async () => {},
    saveIdentity: async () => { saves++; if (saves === 1) throw new Error("offline"); },
  });
  const input = { email: account.email, password: "synthetic-password", displayName: "Test" };
  const first = register(input);
  assert.equal(register(input), first);
  await assert.rejects(first, /offline/);
  assert.deepEqual(await register(input), account);
  assert.equal(creates, 1);
  assert.equal(saves, 2);
});
