import { Platform } from "react-native";

import { addActivity, type ActivityType } from "@/services/activity";
import { setStepsForDate, updateProfile } from "@/services/profile";
import {
  appendBodyMetricsHistory,
  loadBodyMetrics,
  saveBodyMetrics,
} from "@/services/profile/bodyMetrics";

type HealthKitModule = {
  initHealthKit: (
    permissions: {
      permissions: {
        read: string[];
        write: string[];
      };
    },
    callback: (error?: string) => void
  ) => void;
  getDailyStepCountSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: Array<{ value?: number }>) => void
  ) => void;
  getActiveEnergyBurned: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: Array<{ value?: number }>) => void
  ) => void;
  getLatestWeight: (
    options: { unit: string },
    callback: (error: string | null, result?: { value?: number }) => void
  ) => void;
  getLatestBodyFatPercentage: (
    options: { unit: string },
    callback: (error: string | null, result?: { value?: number }) => void
  ) => void;
  getAnchoredWorkouts: (
    options: { startDate: string; endDate: string; type: string },
    callback: (error: string | null, result?: { data?: any[] } | any[]) => void
  ) => void;
  getHeartRateSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getRestingHeartRateSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getHeartRateVariabilitySamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getOxygenSaturationSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getRespiratoryRateSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getBodyTemperatureSamples: (
    options: { startDate: string; endDate: string },
    callback: (error: string | null, results: any[]) => void
  ) => void;
  getSleepSamples: (
    options: { startDate: string; endDate: string; ascending?: boolean; limit?: number },
    callback: (error: string | null, results: any[]) => void
  ) => void;
};

const READ_PERMISSIONS = [
  "StepCount",
  "ActiveEnergyBurned",
  "BasalEnergyBurned",
  "Workout",
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariability",
  "OxygenSaturation",
  "RespiratoryRate",
  "BodyTemperature",
  "SleepAnalysis",
  "Weight",
  "BodyFatPercentage",
];

export type AppleHealthSyncResult = {
  ok: boolean;
  message?: string;
  stepsUpdated: number;
  activeCalories: number;
  workoutsImported: number;
  weightLb?: number;
  bodyFatPct?: number;
};

export function getNativeHealthKit(): HealthKitModule | null {
  if (Platform.OS !== "ios") return null;
  try {
    const { NativeModules } = require("react-native");
    return (NativeModules?.AppleHealthKit as HealthKitModule | undefined) ?? null;
  } catch {
    return null;
  }
}

function missingNativeModuleMessage() {
  return "Apple Health native module is unavailable in this build.";
}

function iso(d: Date) {
  return d.toISOString();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function ensureModule() {
  const HK = getNativeHealthKit();
  if (!HK || typeof HK.initHealthKit !== "function") {
    return {
      ok: false as const,
      message:
        Platform.OS === "ios"
          ? missingNativeModuleMessage()
          : "Apple Health is available on iOS only.",
      HK: null,
    };
  }
  return { ok: true as const, HK };
}

export async function requestAppleHealthPermissions() {
  const ready = ensureModule();
  if (!ready.ok) {
    return { ok: false, message: ready.message };
  }

  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    ready.HK.initHealthKit(
      {
        permissions: {
          read: READ_PERMISSIONS,
          write: [],
        },
      },
      (error?: string) => {
        if (error) resolve({ ok: false, message: error });
        else resolve({ ok: true });
      }
    );
  });
}

function getDailySteps(HK: HealthKitModule, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    HK.getDailyStepCountSamples(
      { startDate: iso(start), endDate: iso(end) },
      (error, results) => {
        if (error || !Array.isArray(results)) {
          resolve(0);
          return;
        }
        resolve(
          Math.round(results.reduce((sum, sample) => sum + Number(sample?.value || 0), 0))
        );
      }
    );
  });
}

function getActiveEnergy(HK: HealthKitModule, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return new Promise<number>((resolve) => {
    HK.getActiveEnergyBurned(
      { startDate: iso(start), endDate: iso(end) },
      (error, results) => {
        if (error || !Array.isArray(results)) {
          resolve(0);
          return;
        }
        resolve(
          Math.round(results.reduce((sum, sample) => sum + Number(sample?.value || 0), 0))
        );
      }
    );
  });
}

function getLatestWeightKg(HK: HealthKitModule) {
  return new Promise<number | null>((resolve) => {
    HK.getLatestWeight({ unit: "kg" }, (error, result) => {
      if (error || !result?.value) {
        resolve(null);
        return;
      }
      resolve(Number(result.value));
    });
  });
}

function getLatestBodyFatPct(HK: HealthKitModule) {
  return new Promise<number | null>((resolve) => {
    HK.getLatestBodyFatPercentage({ unit: "percent" }, (error, result) => {
      if (error || result?.value == null) {
        resolve(null);
        return;
      }
      const raw = Number(result.value);
      resolve(raw <= 1 ? raw * 100 : raw);
    });
  });
}

function getWorkouts(HK: HealthKitModule, startDate: Date, endDate: Date) {
  return new Promise<any[]>((resolve) => {
    HK.getAnchoredWorkouts(
      {
        startDate: iso(startDate),
        endDate: iso(endDate),
        type: "Workout",
      },
      (error, result) => {
        if (error) {
          resolve([]);
          return;
        }
        if (Array.isArray(result)) {
          resolve(result);
          return;
        }
        resolve(Array.isArray(result?.data) ? result.data : []);
      }
    );
  });
}

function mapWorkoutType(name: string): ActivityType {
  const s = String(name || "").toLowerCase();
  if (s.includes("run")) return "run";
  if (s.includes("cycl") || s.includes("bike")) return "bike";
  if (s.includes("walk")) return "walk";
  if (s.includes("swim")) return "swim";
  if (s.includes("yoga")) return "yoga";
  return "other";
}

export async function syncAppleHealthToApp(uid: string, days = 14): Promise<AppleHealthSyncResult> {
  const auth = await requestAppleHealthPermissions();
  if (!auth.ok) {
    return {
      ok: false,
      message: auth.message,
      stepsUpdated: 0,
      activeCalories: 0,
      workoutsImported: 0,
    };
  }

  const ready = ensureModule();
  if (!ready.ok) {
    return {
      ok: false,
      message: ready.message,
      stepsUpdated: 0,
      activeCalories: 0,
      workoutsImported: 0,
    };
  }

  const HK = ready.HK;
  const today = new Date();
  const start = addDays(today, -days + 1);
  let stepsUpdated = 0;
  let activeCalories = 0;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const [steps, active] = await Promise.all([getDailySteps(HK, date), getActiveEnergy(HK, date)]);

    if (steps > 0) {
      await setStepsForDate(uid, ymd(date), steps);
      stepsUpdated += 1;
    }

    activeCalories += active;
    if (active > 0) {
      await addActivity(uid, {
        id: `apple-health-active-${ymd(date)}`,
        type: "other",
        minutes: 0,
        intensity: "moderate",
        calories: active,
        note: "Synced active calories from Apple Health",
        timestamp: new Date(`${ymd(date)}T12:00:00`).getTime(),
      });
    }
  }

  const workouts = await getWorkouts(HK, start, today);
  let workoutsImported = 0;
  for (const workout of workouts) {
    const started = new Date(workout.start || workout.startDate || Date.now());
    const ended = new Date(workout.end || workout.endDate || started);
    const minutes = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
    await addActivity(uid, {
      id: `apple-health-workout-${workout.id || started.getTime()}`,
      type: mapWorkoutType(workout.activityName || workout.type),
      minutes,
      intensity: "moderate",
      // Workout calories are already included in Apple Health active energy totals above.
      calories: 0,
      note: `Synced ${workout.activityName || "workout"} from Apple Health. Calories included in daily Apple burn.`,
      timestamp: started.getTime(),
    });
    workoutsImported += 1;
  }

  const [weightKg, bodyFatPct] = await Promise.all([
    getLatestWeightKg(HK),
    getLatestBodyFatPct(HK),
  ]);

  const current = (await loadBodyMetrics()) || {};
  const patch: Record<string, number> = {};
  let weightLb: number | undefined;

  if (weightKg && weightKg > 0) {
    weightLb = weightKg * 2.20462;
    patch.weightLb = weightLb;
  }
  if (bodyFatPct && bodyFatPct > 0) {
    patch.bodyFatPct = bodyFatPct;
  }

  if (Object.keys(patch).length) {
    await saveBodyMetrics({ ...current, ...patch });
    await appendBodyMetricsHistory({
      t: Date.now(),
      weightLb: patch.weightLb ?? current.weightLb,
      bodyFatPct: patch.bodyFatPct ?? current.bodyFatPct,
    });
    await updateProfile(
      uid,
      {
        ...(weightKg ? { weightKg } : {}),
        ...(bodyFatPct ? { bodyFatPct } : {}),
        healthLastUpdatedVia: "Apple Health",
        healthLastUpdatedAt: Date.now(),
      } as any
    );
  }

  return {
    ok: true,
    stepsUpdated,
    activeCalories,
    workoutsImported,
    weightLb,
    bodyFatPct: bodyFatPct || undefined,
  };
}
