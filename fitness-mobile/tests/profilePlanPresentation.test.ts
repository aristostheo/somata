import assert from "node:assert/strict";
import test from "node:test";
import { profilePlanPresentation } from "../services/profile/profilePlanPresentation";
import { nutritionTargets } from "../services/nutritionTargets";
import { recordedAccountWeights } from "../services/profile/accountWeightData";
import { weightTrendPath } from "../components/profile/overviewData";
import type { Profile } from "../services/profile";
import type { FitAdaptPlanState } from "../services/fitadapt";

const saved = { dailyCaloriesTarget: 2050, dailyProteinTarget: 125, carbGoal: 230, fatGoal: 65 } as Profile;
const accepted = { calories: 2250, protein: 145, carbs: 250, fat: 70 };
const state: FitAdaptPlanState = {
  currentRecommendation: { proposalId: "accepted", acceptedAt: 1, effectiveDate: "2026-10-01", targets: accepted, policyVersion: "v1" },
  pending: null,
};

test("only a matching accepted plan is titled Active plan; numbers always match the shared helper", () => {
  const profile = { ...saved, activeFitAdaptTargets: accepted };
  const shown = profilePlanPresentation(profile, state);
  assert.equal(shown.title, "Active plan");
  assert.deepEqual(shown.targets, nutritionTargets(profile));
  assert.equal(profilePlanPresentation(saved, state).title, "Your goals");
  assert.equal(profilePlanPresentation(profile, null).title, "Your goals");
  assert.equal(profilePlanPresentation(profile, { ...state, currentRecommendation: { ...state.currentRecommendation!, targets: { ...accepted, calories: 2300 } } }).title, "Your goals");
  assert.equal(profilePlanPresentation({ ...saved, activeFitAdaptTargets: { ...accepted, calories: 0 } }, state).title, "Your goals");
});

test("pending review and decline never change displayed active targets", () => {
  const pending = { id: "next", createdAt: 2, status: "pending" as const, responseVersion: "v1",
    sourceFingerprint: "synthetic", effectiveDate: "2026-10-08", reviewRequired: true,
    targets: { calories: 1900, protein: 160, carbs: 170, fat: 55 } };
  const activeProfile = { ...saved, activeFitAdaptTargets: accepted };
  assert.deepEqual(profilePlanPresentation(activeProfile, { ...state, pending }).targets, accepted);
  assert.deepEqual(profilePlanPresentation(activeProfile, state).targets, accepted);
  assert.deepEqual(profilePlanPresentation(saved, { pending, currentRecommendation: null }).targets, nutritionTargets(saved));
  assert.equal(profilePlanPresentation(saved, { pending, currentRecommendation: null }).title, "Your goals");
});

test("missing goals use the shared defaults; actual zero and display units remain intact", () => {
  const profile = { ...saved, weightUnit: "lb" as const, dailyProteinTarget: 0 };
  assert.deepEqual(profilePlanPresentation(profile, null).targets, nutritionTargets(profile));
  assert.equal(profilePlanPresentation(profile, null).targets.protein, 0);
  assert.deepEqual(profilePlanPresentation(null, null).targets, nutritionTargets(null));
});

test("progress uses only valid dated account measurements and needs two days for a trend", () => {
  const rows = recordedAccountWeights([{ date: "2026-10-01", weightKg: 72 },
    { date: "2026-10-02", weightKg: 0 }, { date: "2026-10-02", weightKg: 71.5 },
    { date: "bad", weightKg: 73 }, { date: "2026-10-03", weightKg: "70" }]);
  assert.deepEqual(rows, [{ date: "2026-10-01", weightKg: 72 }, { date: "2026-10-02", weightKg: 71.5 }]);
  assert.equal(weightTrendPath(rows.slice(0, 1).map((row) => row.weightKg)), null);
  assert.ok(weightTrendPath(rows.map((row) => row.weightKg)));
});
