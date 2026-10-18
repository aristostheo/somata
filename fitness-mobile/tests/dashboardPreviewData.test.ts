import assert from "node:assert/strict";
import test from "node:test";
import { dashboardLoggedToday, dashboardPreviewPlan } from "../services/dashboardPreviewData";
import type { Profile } from "../services/profile";
import type { FitAdaptPlanState } from "../services/fitadapt";

const accepted = { calories: 2050, protein: 150, carbs: 220, fat: 65 };
const saved: Profile = { dailyCaloriesTarget: 2300, dailyProteinTarget: 130, carbGoal: 280, fatGoal: 72 };
const plan: FitAdaptPlanState = { currentRecommendation: { proposalId: "accepted", acceptedAt: 1,
  effectiveDate: "2026-10-10", targets: accepted, policyVersion: "test" }, pending: null };

test("preview uses the accepted projection only when the trusted plan matches", () => {
  const profile = { ...saved, activeFitAdaptTargets: accepted };
  assert.deepEqual(dashboardPreviewPlan(profile, plan, "ready"), {
    kind: "active", title: "Active plan", detail: "Accepted FitAdapt targets · changes require your approval.", targets: accepted,
  });
  const mismatched = dashboardPreviewPlan(profile, { ...plan, currentRecommendation: { ...plan.currentRecommendation!,
    targets: { ...accepted, calories: 2100 } } }, "ready");
  assert.equal(mismatched.kind, "unavailable");
  assert.deepEqual(mismatched.targets, accepted);
  assert.equal(dashboardPreviewPlan(profile, null, "error").kind, "unavailable");
});

test("pending review does not change saved goals or become an active plan", () => {
  const pending: FitAdaptPlanState = { currentRecommendation: null, pending: { id: "proposal", createdAt: 1,
    status: "pending", responseVersion: "test", sourceFingerprint: "test", targets: accepted,
    effectiveDate: "2026-10-10", reviewRequired: true } };
  const view = dashboardPreviewPlan(saved, pending, "ready");
  assert.equal(view.kind, "goals");
  assert.equal(view.targets?.calories, 2300);
  assert.equal(view.targets?.protein, 130);
  assert.equal(dashboardPreviewPlan({ dailyCaloriesTarget: 0 }, null, "ready").targets?.calories, 0);
  assert.deepEqual(dashboardPreviewPlan({}, null, "ready").targets, null);
  assert.deepEqual(dashboardPreviewPlan({ proteinGoal: 95 }, null, "ready").targets, { protein: 95 });
});

test("daily progress requires dated records and preserves missing versus zero", () => {
  assert.deepEqual(dashboardLoggedToday([], "2026-10-10"),
    { entries: 0, calories: null, protein: null, carbs: null, fat: null });
  const rows = [
    { date: "2026-10-10", calories: 400, protein: 0, carbs: 35, fat: 10 },
    { date: "2026-10-10", calories: 300, carbs: 20, fat: 8 },
    { date: "2026-10-09", calories: 999, protein: 99, carbs: 99, fat: 99 },
  ];
  assert.deepEqual(dashboardLoggedToday(rows, "2026-10-10"),
    { entries: 2, calories: 700, protein: null, carbs: 55, fat: 18 });
  assert.equal(dashboardLoggedToday([{ date: "2026-10-10", calories: 0 }], "2026-10-10").calories, 0);
});
