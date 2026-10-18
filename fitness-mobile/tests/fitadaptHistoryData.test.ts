import assert from "node:assert/strict";
import test from "node:test";
import { FITADAPT_HISTORY_PAGE_SIZE, historyEvent, previousAcceptedTargets,
  projectHistoryPage } from "../services/profile/fitadaptHistoryData";
import { nutritionTargets } from "../services/nutritionTargets";

const targets = { calories: 2100, protein: 135, carbs: 230, fat: 62 };
const older = { calories: 2200, protein: 130, carbs: 250, fat: 65 };

test("resolved history projects only persisted, validated display fields", () => {
  const event = historyEvent("proposal-a", { status: "accepted", resolvedAt: 1_780_000_000_000,
    createdAt: 1_779_999_000_000, effectiveDate: "2026-10-01", targets,
    request: { profile: { weight_kg: 72 } }, sourceFingerprint: "private" });
  assert.deepEqual(event, { id: "proposal-a", status: "accepted", resolvedAt: 1_780_000_000_000,
    createdAt: 1_779_999_000_000, effectiveDate: "2026-10-01", targets });
  assert.equal(historyEvent("pending", { status: "pending", resolvedAt: 1, targets }), null);
  assert.equal(historyEvent("missing-date", { status: "declined", targets }), null);
  assert.deepEqual(historyEvent("incomplete", { status: "superseded", resolvedAt: 2,
    effectiveDate: "2026-02-30", targets: { calories: 0 } }),
  { id: "incomplete", status: "superseded", resolvedAt: 2, createdAt: null, effectiveDate: null, targets: null });
});

test("only an older recorded accepted event can supply a target comparison", () => {
  const accepted = historyEvent("new", { status: "accepted", resolvedAt: 3, targets });
  const declined = historyEvent("declined", { status: "declined", resolvedAt: 2, targets: { ...targets, calories: 1800 } });
  const prior = historyEvent("old", { status: "accepted", resolvedAt: 1, targets: older });
  assert.ok(accepted && declined && prior);
  assert.deepEqual(previousAcceptedTargets([accepted, declined, prior], 0), older);
  assert.equal(previousAcceptedTargets([accepted, declined], 0), null);
  assert.equal(previousAcceptedTargets([accepted, declined, prior], 1), null);
  const incomplete = historyEvent("incomplete", { status: "accepted", resolvedAt: 2, targets: null });
  assert.ok(incomplete);
  assert.equal(previousAcceptedTargets([accepted, incomplete, prior], 0), null);
});

test("history page projection is bounded and keeps newest-first query order", () => {
  const rows = Array.from({ length: FITADAPT_HISTORY_PAGE_SIZE + 3 }, (_, index) => ({
    id: `event-${index}`, data: { status: "declined", resolvedAt: 1000 - index, targets },
  }));
  const projected = projectHistoryPage(rows);
  assert.equal(projected.length, FITADAPT_HISTORY_PAGE_SIZE);
  assert.equal(projected[0].id, "event-0");
  assert.equal(projected.at(-1)?.id, `event-${FITADAPT_HISTORY_PAGE_SIZE - 1}`);
});

test("pending and declined history never change the active projection or saved fallback", () => {
  const active = { dailyCaloriesTarget: 2000, dailyProteinTarget: 120, carbGoal: 220, fatGoal: 60,
    activeFitAdaptTargets: targets };
  const pending = { targets: { ...targets, calories: 1900 } };
  const withPending = { ...active, pending };
  const withDecline = { ...active, adaptationHistory: [{ status: "declined" }] };
  const fallback = { ...active, activeFitAdaptTargets: undefined, pending };
  assert.deepEqual(nutritionTargets(withPending), targets);
  assert.deepEqual(nutritionTargets(withDecline), targets);
  assert.equal(nutritionTargets(fallback).calories, 2000);
});
