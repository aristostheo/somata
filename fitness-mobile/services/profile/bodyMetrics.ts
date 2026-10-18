import { accountStorage, type AccountStore } from '@/services/local/accountStore';
// services/bodyMetrics.ts

export type BodyMetrics = {
  weightLb?: number; // store canonical in lb for simplicity
  targetWeightLb?: number;
  heightCm?: number;
  bodyFatPct?: number;
  waistCm?: number;
  updatedAt?: number; // epoch ms
};

export type BodyMetricPoint = {
  t: number; // epoch ms
  weightLb?: number;
  waistCm?: number;
  bodyFatPct?: number;
};

const KEY_METRICS = "@body_metrics:v1";
const KEY_HISTORY = "@body_metrics_history:v1";

export async function loadBodyMetrics(localStore: AccountStore = accountStorage()): Promise<BodyMetrics | null> {
  const raw = await localStore.getItem(KEY_METRICS);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveBodyMetrics(next: BodyMetrics, localStore: AccountStore = accountStorage()): Promise<void> {
  const payload: BodyMetrics = {
    ...next,
    updatedAt: Date.now(),
  };
  await localStore.setItem(KEY_METRICS, JSON.stringify(payload));
}

export async function loadBodyMetricsHistory(localStore: AccountStore = accountStorage()): Promise<BodyMetricPoint[]> {
  const raw = await localStore.getItem(KEY_HISTORY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Append a new history point.
 * - Dedupes if last point is same-day and values are identical-ish.
 */
export async function appendBodyMetricsHistory(point: BodyMetricPoint, localStore: AccountStore = accountStorage()) {
  const history = await loadBodyMetricsHistory(localStore);
  const last = history[history.length - 1];

  const sameDay = (a: number, b: number) => {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  };

  const almostEqual = (a?: number, b?: number, eps = 0.05) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(a - b) <= eps;
  };

  if (
    last &&
    sameDay(last.t, point.t) &&
    almostEqual(last.weightLb, point.weightLb, 0.2) &&
    almostEqual(last.waistCm, point.waistCm, 0.2) &&
    almostEqual(last.bodyFatPct, point.bodyFatPct, 0.2)
  ) {
    // Replace last point (same day) instead of stacking noise.
    history[history.length - 1] = point;
  } else {
    history.push(point);
  }

  // Keep last 180 points to stay light.
  const trimmed = history.slice(Math.max(0, history.length - 180));
  await localStore.setItem(KEY_HISTORY, JSON.stringify(trimmed));
}
