import type { AccountWeightEntry } from "./accountWeightData";

export type RecordedDay = { date: string; value: number };
export type NutritionDay = { date: string; entries: number; calories: number | null };

function dateInRange(value: unknown, from: string, to: string): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < from || value > to) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function recordedWeightDays(entries: AccountWeightEntry[] | null | undefined, from: string, to: string): RecordedDay[] {
  return (entries ?? []).filter((entry) => dateInRange(entry.date, from, to) &&
    Number.isFinite(entry.weightKg) && entry.weightKg >= 30 && entry.weightKg <= 300)
    .map((entry) => ({ date: entry.date, value: entry.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function recordedStepDays(steps: Record<string, unknown> | null | undefined, from: string, to: string): RecordedDay[] {
  return Object.entries(steps ?? {}).flatMap(([date, raw]) => {
    const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    return dateInRange(date, from, to) && Number.isFinite(value) && value >= 0
      ? [{ date, value: Math.round(value) }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function recordedNutritionDays(rows: unknown[] | null | undefined, from: string, to: string): NutritionDay[] {
  const days = new Map<string, NutritionDay>();
  for (const raw of rows ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { date?: unknown; calories?: unknown };
    if (!dateInRange(row.date, from, to)) continue;
    const day = days.get(row.date) ?? { date: row.date, entries: 0, calories: 0 };
    day.entries += 1;
    if (typeof row.calories !== "number" || !Number.isFinite(row.calories) || row.calories < 0) day.calories = null;
    else if (day.calories !== null) day.calories += row.calories;
    days.set(row.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function measuredChange(days: RecordedDay[]): number | null {
  return days.length < 2 ? null : days.at(-1)!.value - days[0].value;
}

export function measuredTrendPath(days: RecordedDay[], width = 300, height = 78): string | null {
  if (days.length < 2) return null;
  const first = Date.parse(`${days[0].date}T12:00:00Z`);
  const last = Date.parse(`${days.at(-1)!.date}T12:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return null;
  const values = days.map((day) => day.value);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const low = Math.min(...values);
  const span = Math.max(Math.max(...values) - low, 1);
  const pad = 7;
  return days.map((day, index) => {
    const x = pad + ((Date.parse(`${day.date}T12:00:00Z`) - first) / (last - first)) * (width - pad * 2);
    const y = height - pad - ((day.value - low) / span) * (height - pad * 2);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
