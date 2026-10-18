import type { PlanTargets } from "../fitadapt";

export const FITADAPT_HISTORY_PAGE_SIZE = 20;

export type FitAdaptHistoryEvent = {
  id: string;
  status: "accepted" | "declined" | "superseded";
  resolvedAt: number;
  createdAt: number | null;
  effectiveDate: string | null;
  targets: PlanTargets | null;
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTargets(value: unknown): PlanTargets | null {
  if (!value || typeof value !== "object") return null;
  const target = value as Partial<PlanTargets>;
  if (typeof target.calories !== "number" || !Number.isFinite(target.calories) || target.calories <= 0 ||
      ![target.protein, target.carbs, target.fat].every((part) => typeof part === "number" && Number.isFinite(part) && part >= 0)) return null;
  return { calories: target.calories, protein: target.protein as number,
    carbs: target.carbs as number, fat: target.fat as number };
}

// A whitelist projection: historical request payloads and source fingerprints
// are never passed to UI components.
export function historyEvent(id: string, raw: unknown): FitAdaptHistoryEvent | null {
  if (!raw || typeof raw !== "object" || !id) return null;
  const row = raw as Record<string, unknown>;
  if (row.status !== "accepted" && row.status !== "declined" && row.status !== "superseded") return null;
  if (typeof row.resolvedAt !== "number" || !Number.isFinite(row.resolvedAt) || row.resolvedAt <= 0) return null;
  return {
    id, status: row.status, resolvedAt: row.resolvedAt,
    createdAt: typeof row.createdAt === "number" && Number.isFinite(row.createdAt) && row.createdAt > 0 ? row.createdAt : null,
    effectiveDate: validDate(row.effectiveDate) ? row.effectiveDate : null,
    targets: validTargets(row.targets),
  };
}

export function projectHistoryPage(rows: Array<{ id: string; data: unknown }>): FitAdaptHistoryEvent[] {
  return rows.slice(0, FITADAPT_HISTORY_PAGE_SIZE)
    .map((row) => historyEvent(row.id, row.data))
    .filter((row): row is FitAdaptHistoryEvent => row !== null);
}

export function previousAcceptedTargets(events: FitAdaptHistoryEvent[], index: number): PlanTargets | null {
  if (events[index]?.status !== "accepted") return null;
  // Events are newest first. An older accepted event is a trustworthy comparison
  // only when it has actually been loaded from the persisted timeline.
  return events.slice(index + 1).find((event) => event.status === "accepted")?.targets ?? null;
}
