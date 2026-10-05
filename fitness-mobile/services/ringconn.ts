import { dayKey } from "@/utils/date";
import { Platform } from "react-native";

import {
  getNativeHealthKit,
  requestAppleHealthPermissions,
} from "@/services/appleHealth";

export type RingConnMetricSource = {
  sourceName?: string;
  sourceId?: string;
  via: "RingConn" | "Apple Watch" | "iPhone sensors" | "Manual entry" | "Other";
};

export type RingConnSleepBreakdown = {
  light: number;
  deep: number;
  rem: number;
  awake: number;
  totalSleepMin: number;
};

export type RingConnDailySummary = {
  date: string;
  detected: boolean;
  heartRate?: { value: number; source: RingConnMetricSource };
  restingHeartRate?: { value: number; source: RingConnMetricSource };
  hrv?: { value: number; source: RingConnMetricSource };
  bloodOxygen?: { value: number; source: RingConnMetricSource };
  respiratoryRate?: { value: number; source: RingConnMetricSource };
  skinTemperature?: { value: number; source: RingConnMetricSource };
  steps?: { value: number; source: RingConnMetricSource };
  activeCalories?: { value: number; source: RingConnMetricSource };
  sleep?: { value: RingConnSleepBreakdown; source: RingConnMetricSource };
};

export type RingConnRecoveryEstimate = {
  score: number;
  hrvComponent: number;
  restingHeartComponent: number;
  sleepDurationComponent: number;
  sleepQualityComponent: number;
  baseline: {
    hrv?: number;
    restingHeartRate?: number;
    sleepDurationMin?: number;
    sleepQualityPct?: number;
  };
};

export interface RingConnDataSource {
  fetchDailySummary(date: Date): Promise<RingConnDailySummary | null>;
  fetchSleepData(date: Date): Promise<RingConnDailySummary["sleep"] | null>;
  fetchHeartRateHistory(from: Date, to: Date): Promise<Array<{ date: string; value: number; source: RingConnMetricSource }>>;
  fetchRecoveryScore(date: Date): Promise<RingConnRecoveryEstimate | null>;
}

type HealthSample = {
  value?: number | string;
  startDate?: string;
  endDate?: string;
  sourceName?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

function iso(d: Date) {
  return d.toISOString();
}

function addDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function ymd(d: Date) {
  return dayKey(d);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function avg(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sourceLabel(sourceName?: string, sourceId?: string): RingConnMetricSource["via"] {
  const text = `${sourceName || ""} ${sourceId || ""}`.toLowerCase();
  if (text.includes("ringconn")) return "RingConn";
  if (text.includes("watch")) return "Apple Watch";
  if (text.includes("iphone")) return "iPhone sensors";
  if (text.includes("manual") || text.includes("health")) return "Manual entry";
  return "Other";
}

function toSource(sample?: HealthSample): RingConnMetricSource {
  return {
    sourceName: sample?.sourceName,
    sourceId: sample?.sourceId,
    via: sourceLabel(sample?.sourceName, sample?.sourceId),
  };
}

function sourcePriority(source: RingConnMetricSource) {
  switch (source.via) {
    case "RingConn":
      return 4;
    case "Apple Watch":
      return 3;
    case "iPhone sensors":
      return 2;
    case "Manual entry":
      return 1;
    default:
      return 0;
  }
}

function pickPreferred(samples: HealthSample[]) {
  return [...samples]
    .filter((sample) => Number(sample?.value ?? 0) > 0)
    .sort((a, b) => {
      const sourceDiff = sourcePriority(toSource(b)) - sourcePriority(toSource(a));
      if (sourceDiff !== 0) return sourceDiff;
      return new Date(b.endDate || b.startDate || 0).getTime() - new Date(a.endDate || a.startDate || 0).getTime();
    })[0];
}

function querySamples<T = HealthSample[]>(
  method: keyof NonNullable<ReturnType<typeof getNativeHealthKit>>,
  options: Record<string, unknown>
): Promise<T> {
  const HK = getNativeHealthKit();
  if (!HK || typeof HK[method] !== "function") {
    return Promise.resolve([] as unknown as T);
  }
  return new Promise((resolve) => {
    (HK[method] as any)(options, (_error: string | null, results: T) => {
      resolve(results || ([] as unknown as T));
    });
  });
}

function normalizeSleep(samples: HealthSample[]): RingConnSleepBreakdown {
  let light = 0;
  let deep = 0;
  let rem = 0;
  let awake = 0;
  samples.forEach((sample) => {
    const start = new Date(sample.startDate || 0).getTime();
    const end = new Date(sample.endDate || 0).getTime();
    const minutes = Math.max(0, Math.round((end - start) / 60000));
    const value = String(sample.value || "").toUpperCase();
    if (value.includes("DEEP")) deep += minutes;
    else if (value.includes("REM")) rem += minutes;
    else if (value.includes("CORE") || value.includes("ASLEEP")) light += minutes;
    else if (value.includes("AWAKE")) awake += minutes;
  });
  return {
    light,
    deep,
    rem,
    awake,
    totalSleepMin: light + deep + rem,
  };
}

export class HealthKitRingConnDataSource implements RingConnDataSource {
  async fetchDailySummary(date: Date): Promise<RingConnDailySummary | null> {
    if (Platform.OS !== "ios") return null;
    const auth = await requestAppleHealthPermissions();
    if (!auth.ok) return null;

    const start = startOfDay(date);
    const end = endOfDay(date);
    const startDate = iso(start);
    const endDate = iso(end);
    const ringDetectionStartDate = iso(addDays(start, -2));

    const [
      heartRate,
      restingHeartRate,
      hrv,
      oxygen,
      respiratory,
      skinTemp,
      sleep,
      recentHeartRate,
      recentRestingHeartRate,
      recentHrv,
      recentOxygen,
    ] = await Promise.all([
      querySamples<HealthSample[]>("getHeartRateSamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getRestingHeartRateSamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getHeartRateVariabilitySamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getOxygenSaturationSamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getRespiratoryRateSamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getBodyTemperatureSamples", { startDate, endDate }),
      querySamples<HealthSample[]>("getSleepSamples", {
        startDate: iso(addDays(start, -1)),
        endDate,
        ascending: false,
      }),
      querySamples<HealthSample[]>("getHeartRateSamples", {
        startDate: ringDetectionStartDate,
        endDate,
      }),
      querySamples<HealthSample[]>("getRestingHeartRateSamples", {
        startDate: ringDetectionStartDate,
        endDate,
      }),
      querySamples<HealthSample[]>("getHeartRateVariabilitySamples", {
        startDate: ringDetectionStartDate,
        endDate,
      }),
      querySamples<HealthSample[]>("getOxygenSaturationSamples", {
        startDate: ringDetectionStartDate,
        endDate,
      }),
    ]);

    const hr = pickPreferred(heartRate);
    const rhr = pickPreferred(restingHeartRate);
    const hrvSample = pickPreferred(hrv);
    const spo2 = pickPreferred(oxygen);
    const resp = pickPreferred(respiratory);
    const temp = pickPreferred(skinTemp);
    const sleepBreakdown = normalizeSleep(sleep);
    const sleepSource = pickPreferred(sleep);
    const detected = [sleepSource, ...recentHeartRate, ...recentRestingHeartRate, ...recentHrv, ...recentOxygen].some((sample) =>
      String(sample?.sourceName || sample?.sourceId || "").toLowerCase().includes("ringconn")
    );

    return {
      date: ymd(date),
      detected,
      heartRate: hr ? { value: Number(hr.value || 0), source: toSource(hr) } : undefined,
      restingHeartRate: rhr
        ? { value: Number(rhr.value || 0), source: toSource(rhr) }
        : undefined,
      hrv: hrvSample
        ? { value: Number(hrvSample.value || 0), source: toSource(hrvSample) }
        : undefined,
      bloodOxygen: spo2
        ? {
            value:
              Number(spo2.value || 0) <= 1
                ? Math.round(Number(spo2.value || 0) * 100)
                : Number(spo2.value || 0),
            source: toSource(spo2),
          }
        : undefined,
      respiratoryRate: resp
        ? { value: Number(resp.value || 0), source: toSource(resp) }
        : undefined,
      skinTemperature: temp
        ? { value: Number(temp.value || 0), source: toSource(temp) }
        : undefined,
      sleep:
        sleepBreakdown.totalSleepMin > 0
          ? { value: sleepBreakdown, source: toSource(sleepSource) }
          : undefined,
    };
  }

  async fetchSleepData(date: Date) {
    const summary = await this.fetchDailySummary(date);
    return summary?.sleep || null;
  }

  async fetchHeartRateHistory(from: Date, to: Date) {
    if (Platform.OS !== "ios") return [];
    const auth = await requestAppleHealthPermissions();
    if (!auth.ok) return [];
    const results = await querySamples<HealthSample[]>("getHeartRateSamples", {
      startDate: iso(from),
      endDate: iso(to),
      ascending: true,
    });
    return results
      .filter((sample) => Number(sample.value || 0) > 0)
      .map((sample) => ({
        date: ymd(new Date(sample.startDate || sample.endDate || Date.now())),
        value: Number(sample.value || 0),
        source: toSource(sample),
      }));
  }

  async fetchRecoveryScore(date: Date): Promise<RingConnRecoveryEstimate | null> {
    if (Platform.OS !== "ios") return null;
    const current = await this.fetchDailySummary(date);
    if (!current) return null;

    const past = await Promise.all(
      Array.from({ length: 30 }, (_, i) => this.fetchDailySummary(addDays(date, -i)))
    );
    const valid = past.filter(Boolean) as RingConnDailySummary[];

    const hrvBaseline = avg(valid.map((d) => d.hrv?.value || 0).filter(Boolean));
    const rhrBaseline = avg(
      valid.map((d) => d.restingHeartRate?.value || 0).filter(Boolean)
    );
    const sleepBaseline = avg(
      valid.map((d) => d.sleep?.value.totalSleepMin || 0).filter(Boolean)
    );
    const sleepQualityBaseline = avg(
      valid
        .map((d) => {
          const sleep = d.sleep?.value;
          if (!sleep || !sleep.totalSleepMin) return 0;
          return ((sleep.deep + sleep.rem) / sleep.totalSleepMin) * 100;
        })
        .filter(Boolean)
    );

    const currentHrv = current.hrv?.value || 0;
    const currentRhr = current.restingHeartRate?.value || 0;
    const currentSleep = current.sleep?.value.totalSleepMin || 0;
    const currentSleepQuality = current.sleep?.value.totalSleepMin
      ? ((current.sleep.value.deep + current.sleep.value.rem) /
          current.sleep.value.totalSleepMin) *
        100
      : 0;

    const hrvComponent = clamp(
      hrvBaseline ? (currentHrv / hrvBaseline) * 100 : 50,
      0,
      100
    );
    const restingHeartComponent = clamp(
      rhrBaseline ? (rhrBaseline / Math.max(1, currentRhr)) * 100 : 50,
      0,
      100
    );
    const sleepDurationComponent = clamp((currentSleep / 480) * 100, 0, 100);
    const sleepQualityTarget = sleepQualityBaseline || 42;
    const sleepQualityComponent = clamp(
      currentSleepQuality ? (currentSleepQuality / sleepQualityTarget) * 100 : 40,
      0,
      100
    );

    const score = clamp(
      hrvComponent * 0.4 +
        restingHeartComponent * 0.3 +
        sleepDurationComponent * 0.2 +
        sleepQualityComponent * 0.1,
      0,
      100
    );

    return {
      score: Math.round(score),
      hrvComponent: Math.round(hrvComponent),
      restingHeartComponent: Math.round(restingHeartComponent),
      sleepDurationComponent: Math.round(sleepDurationComponent),
      sleepQualityComponent: Math.round(sleepQualityComponent),
      baseline: {
        hrv: hrvBaseline ? Math.round(hrvBaseline) : undefined,
        restingHeartRate: rhrBaseline ? Math.round(rhrBaseline) : undefined,
        sleepDurationMin: sleepBaseline ? Math.round(sleepBaseline) : undefined,
        sleepQualityPct: sleepQualityBaseline
          ? Math.round(sleepQualityBaseline)
          : undefined,
      },
    };
  }
}

export class HealthConnectRingConnDataSource implements RingConnDataSource {
  async fetchDailySummary(): Promise<RingConnDailySummary | null> {
    return null;
  }
  async fetchSleepData() {
    return null;
  }
  async fetchHeartRateHistory() {
    return [];
  }
  async fetchRecoveryScore() {
    return null;
  }
}

// TODO: Replace HealthKitRingConnDataSource with OfficialRingConnAPIDataSource when RingConn releases their public API.
export function getRingConnDataSource(): RingConnDataSource {
  if (Platform.OS === "ios") return new HealthKitRingConnDataSource();
  return new HealthConnectRingConnDataSource();
}
