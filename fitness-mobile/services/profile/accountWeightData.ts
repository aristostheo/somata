export type AccountWeightEntry = { date: string; weightKg: number };

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function recordedAccountWeights(rows: unknown[]): AccountWeightEntry[] {
  const byDate = new Map<string, AccountWeightEntry>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { date?: unknown; weightKg?: unknown };
    if (!validDate(row.date) || typeof row.weightKg !== "number" ||
      !Number.isFinite(row.weightKg) || row.weightKg < 30 || row.weightKg > 300) continue;
    byDate.set(row.date, { date: row.date, weightKg: row.weightKg });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
