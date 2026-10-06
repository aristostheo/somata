import type { BodyMetricPoint } from "@/services/profile/bodyMetrics";
import { dayKey } from "@/utils/date";

export type RecordedWeight = { time: number; weightLb: number };

/** Keep the latest real measurement for each local day, in date order. */
export function recordedWeights(history: BodyMetricPoint[]): RecordedWeight[] {
  const byDay = new Map<string, RecordedWeight>();
  for (const point of [...history].sort((a, b) => a.t - b.t)) {
    if (
      !Number.isFinite(point.t) ||
      !Number.isFinite(point.weightLb) ||
      (point.weightLb ?? 0) <= 0
    ) continue;
    byDay.set(dayKey(new Date(point.t)), {
      time: point.t,
      weightLb: point.weightLb as number,
    });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

export function weightTrendPath(
  values: number[],
  width = 300,
  height = 72
): string | null {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, 1);
  const inset = 6;
  return values
    .map((value, index) => {
      const x = inset + (index / (values.length - 1)) * (width - inset * 2);
      const y = height - inset - ((value - low) / span) * (height - inset * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function recordedStepsForDate(
  steps: Record<string, unknown> | null | undefined,
  date: Date
): number | null {
  const value = steps?.[dayKey(date)];
  const number = typeof value === "number" ? value : Number(value);
  return value != null && Number.isFinite(number) && number >= 0
    ? Math.round(number)
    : null;
}
