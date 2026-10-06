import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { syncAppleHealthToApp } from "@/services/appleHealth";
import { addNotification } from "@/services/notifications";
import { setStepsForDate, updateProfile } from "@/services/profile";
import { getRingConnDataSource, type RingConnMetricSource } from "@/services/ringconn";

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "warning"
  | "error"
  | "syncing";

export type SyncFrequency =
  | "30min"
  | "1hour"
  | "2hours"
  | "4hours"
  | "manual";

export type ConflictPolicy = "highest" | "recent" | "apple" | "ask";
export type CellularPolicy = "wifi_only" | "always" | "ask";

export type IntegrationGroup = "health" | "wearable" | "scale";

export type IntegrationDef = {
  id: string;
  name: string;
  group: IntegrationGroup;
  platform?: "ios" | "android";
  icon: string;
  iconBg: string;
  description: string;
  fields: string[];
  primaryEligible?: boolean;
  warning?: string;
  badge?: string;
};

export type SleepStageBreakdown = {
  light: number;
  deep: number;
  rem: number;
  awake: number;
};

export type IntegrationLatestValues = {
  steps?: number;
  activeCalories?: number;
  recoveryScore?: number;
  hrvMs?: number;
  restingHeartRateBpm?: number;
  stressScore?: number;
  bloodOxygenPct?: number;
  skinTemperatureC?: number;
  sleepDurationMin?: number;
  sleepConsistencyScore?: number;
  recoveryText?: string;
  workoutActive?: boolean;
  sleepEndedAt?: number;
  batteryLevel?: number;
  sleepStages?: SleepStageBreakdown;
  sleepQualityPct?: number;
  sourceTags?: Partial<Record<"heartRate" | "restingHeartRate" | "hrv" | "bloodOxygen" | "steps" | "activeCalories" | "sleep" | "skinTemperature" | "respiratoryRate", RingConnMetricSource>>;
  };

export type IntegrationConnection = {
  id: string;
  status: IntegrationStatus;
  connected: boolean;
  lastSyncedAt?: number;
  lastAttemptAt?: number;
  failCount?: number;
  primary?: boolean;
  lastError?: string;
  useGlobalSync?: boolean;
  overrideFrequency?: SyncFrequency;
  batteryLevel?: number;
  latestValues?: IntegrationLatestValues;
  dataPointsReceived?: number;
  firstSyncCompletedAt?: number;
  lastSleepReadyYmd?: string;
  lastErrorNotifiedAt?: number;
  tokenHint?: string;
};

export type SyncHistoryEvent = {
  id: string;
  reason:
    | "app_open"
    | "interval"
    | "manual"
    | "connect"
    | "sleep_priority"
    | "workout_priority"
    | "bootstrap";
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  integrations: string[];
  failed: string[];
  success: boolean;
  dataPointsReceived: number;
};

const HISTORY_LIMIT = 80;

export type IntegrationSettings = {
  autoSync: boolean;
  frequency: SyncFrequency;
  conflictPolicy: ConflictPolicy;
  backgroundSync: boolean;
  activeCaloriesAdjustment: boolean;
  onboardingDone: boolean;
  lastFullSyncAt?: number;
  cellularSync: boolean;
  lowBatteryPause: boolean;
  syncOnAppOpen: boolean;
  cellularPolicy: CellularPolicy;
  history: SyncHistoryEvent[];
};

export type IntegrationSnapshot = {
  connections: Record<string, IntegrationConnection>;
  settings: IntegrationSettings;
};

type SyncReason = SyncHistoryEvent["reason"];

type SyncResult = {
  ok: boolean;
  dataPointsReceived: number;
  latestValues?: IntegrationLatestValues;
  message?: string;
};

const KEY = "integrations:v2";
const listeners = new Set<(snapshot: IntegrationSnapshot) => void>();

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "apple_health",
    name: "Apple Health",
    group: "health",
    platform: "ios",
    icon: "heart",
    iconBg: "#F44336",
    description:
      "Syncs steps, workouts, heart rate, sleep, weight, and calories burned",
    fields: [
      "Steps",
      "Active calories",
      "Resting calories",
      "Workouts",
      "Heart rate",
      "Sleep",
      "Weight",
      "Body fat %",
    ],
    primaryEligible: true,
  },
  {
    id: "google_fit",
    name: "Google Fit",
    group: "health",
    platform: "android",
    icon: "fitness",
    iconBg: "#4CAF50",
    description: "Syncs steps, workouts, heart rate, and calories",
    fields: ["Steps", "Calories burned", "Workouts", "Heart rate", "Weight"],
    primaryEligible: true,
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    group: "health",
    icon: "watch",
    iconBg: "#22D3EE",
    description:
      "Syncs detailed workout data, steps, heart rate, sleep, and stress scores",
    fields: [
      "Steps",
      "Workouts",
      "Heart rate",
      "Sleep",
      "Stress score",
      "VO2 max",
      "Body battery",
    ],
    primaryEligible: true,
  },
  {
    id: "fitbit",
    name: "Fitbit / Pixel Watch",
    group: "health",
    icon: "pulse",
    iconBg: "#00B0B9",
    description:
      "Syncs steps, sleep, heart rate zones, and active minutes",
    fields: [
      "Steps",
      "Sleep stages",
      "Heart rate zones",
      "Active minutes",
      "Calories",
    ],
  },
  {
    id: "whoop",
    name: "Whoop",
    group: "health",
    icon: "battery-charging",
    iconBg: "#6C63FF",
    description:
      "Syncs recovery score, strain, sleep performance, and HRV",
    fields: [
      "Recovery %",
      "Strain score",
      "Sleep performance",
      "HRV",
      "Resting heart rate",
    ],
  },
  {
    id: "ringconn",
    name: "RingConn",
    group: "health",
    icon: "radio-button-on",
    iconBg: "#14B8A6",
    description: "Syncs via Apple Health · No direct API needed",
    fields: [
      "Sleep stages",
      "Heart rate",
      "HRV",
      "Blood oxygen",
      "Stress score",
      "Calories burned",
      "Steps and activity",
      "Skin temperature",
      "Recovery score",
    ],
    badge: "New",
    primaryEligible: true,
  },
  {
    id: "oura",
    name: "Oura Ring",
    group: "health",
    icon: "ellipse",
    iconBg: "#8B5CF6",
    description:
      "Syncs readiness score, sleep stages, HRV, and activity",
    fields: [
      "Readiness score",
      "Sleep stages",
      "HRV",
      "Activity",
      "Body temperature",
    ],
  },
  {
    id: "strava",
    name: "Strava",
    group: "health",
    icon: "navigate",
    iconBg: "#FC4C02",
    description:
      "Syncs running, cycling, and cardio workouts with route and pace data",
    fields: [
      "Workout type",
      "Duration",
      "Distance",
      "Pace",
      "Calories burned",
      "Route map",
    ],
  },
  {
    id: "myfitnesspal",
    name: "MyFitnessPal",
    group: "health",
    icon: "restaurant",
    iconBg: "#1976D2",
    description: "Import your food log to avoid double entry",
    fields: ["Meals logged", "Calories", "Macros"],
    warning: "If both apps log food, disable one to avoid duplicates.",
  },
  {
    id: "cronometer",
    name: "Cronometer",
    group: "health",
    icon: "nutrition",
    iconBg: "#FFC107",
    description:
      "Syncs detailed micronutrient data for deeper nutrition tracking",
    fields: ["Meals", "Macros", "Vitamins", "Minerals"],
  },
  {
    id: "peloton",
    name: "Peloton",
    group: "health",
    icon: "bicycle",
    iconBg: "#E53935",
    description:
      "Syncs cycling and strength classes with output and calories",
    fields: ["Workout type", "Duration", "Output", "Calories", "Heart rate"],
  },
  {
    id: "apple_watch",
    name: "Apple Watch",
    group: "wearable",
    icon: "watch",
    iconBg: "#111827",
    description: "Direct sync for workouts, heart rate, and activity rings",
    fields: ["Workouts", "HR", "Activity rings", "Stand hours"],
  },
  {
    id: "galaxy_watch",
    name: "Samsung Galaxy Watch",
    group: "wearable",
    icon: "watch",
    iconBg: "#2563EB",
    description: "Syncs workouts, steps, sleep, and body composition",
    fields: ["Workouts", "Steps", "Sleep", "Body composition"],
  },
  {
    id: "polar",
    name: "Polar",
    group: "wearable",
    icon: "radio",
    iconBg: "#DC2626",
    description: "Syncs training load, HR zones, and recovery status",
    fields: ["Training load", "HR zones", "Recovery"],
  },
  {
    id: "suunto",
    name: "Suunto",
    group: "wearable",
    icon: "map",
    iconBg: "#0F172A",
    description: "Syncs outdoor workouts, GPS routes, and fitness estimates",
    fields: ["Workouts", "GPS", "VO2 max"],
  },
  {
    id: "withings",
    name: "Withings Body+",
    group: "scale",
    icon: "scale",
    iconBg: "#38BDF8",
    description:
      "Syncs weight, body fat %, muscle mass, and BMI automatically",
    fields: ["Weight", "Body fat %", "Muscle mass", "BMI"],
  },
  {
    id: "renpho",
    name: "Renpho",
    group: "scale",
    icon: "scale",
    iconBg: "#A855F7",
    description:
      "Syncs weight and body composition metrics via Bluetooth",
    fields: ["Weight", "Body fat %", "Body composition"],
  },
  {
    id: "garmin_index",
    name: "Garmin Index",
    group: "scale",
    icon: "scale",
    iconBg: "#06B6D4",
    description: "Syncs weight and body fat directly to your profile",
    fields: ["Weight", "Body fat %"],
  },
];

const IMPLEMENTED_INTEGRATIONS = new Set(["apple_health", "ringconn"]);

const defaultSettings: IntegrationSettings = {
  autoSync: true,
  frequency: "1hour",
  conflictPolicy: "highest",
  backgroundSync: true,
  activeCaloriesAdjustment: false,
  onboardingDone: false,
  cellularSync: false,
  lowBatteryPause: true,
  syncOnAppOpen: true,
  cellularPolicy: "wifi_only",
  history: [],
};

function emptySnapshot(): IntegrationSnapshot {
  return { connections: {}, settings: { ...defaultSettings } };
}

function now() {
  return Date.now();
}

function ymd(ts = Date.now()) {
  return dayKey(new Date(ts));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashSeed(seed: string) {
  let out = 0;
  for (let i = 0; i < seed.length; i += 1) {
    out = (out * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return out;
}

function valueFromSeed(seed: string, min: number, max: number) {
  const base = hashSeed(seed) % 1000;
  const pct = base / 1000;
  return min + Math.round((max - min) * pct);
}

function durationFromSeed(seed: string, min: number, max: number) {
  const base = hashSeed(seed) % 1000;
  const pct = base / 1000;
  return min + Math.round((max - min) * pct);
}

function getFrequencyMs(freq: SyncFrequency) {
  switch (freq) {
    case "30min":
      return 30 * 60 * 1000;
    case "1hour":
      return 60 * 60 * 1000;
    case "2hours":
      return 2 * 60 * 60 * 1000;
    case "4hours":
      return 4 * 60 * 60 * 1000;
    case "manual":
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function effectiveFrequency(
  snapshot: IntegrationSnapshot,
  conn: IntegrationConnection
): SyncFrequency {
  if (conn.useGlobalSync === false && conn.overrideFrequency) {
    return conn.overrideFrequency;
  }
  return snapshot.settings.frequency;
}

async function readSnapshot() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptySnapshot();
  try {
    const parsed = JSON.parse(raw) as Partial<IntegrationSnapshot>;
    const settings = { ...defaultSettings, ...(parsed.settings || {}) };
    settings.history = Array.isArray(settings.history) ? settings.history : [];
    const connections = parsed.connections || {};
    Object.keys(connections).forEach((id) => {
      const current = connections[id];
      connections[id] = {
        ...current,
        id,
        status: current.status || "disconnected",
        connected: !!current.connected,
        useGlobalSync: current.useGlobalSync ?? true,
      };
    });
    return { settings, connections } as IntegrationSnapshot;
  } catch {
    return emptySnapshot();
  }
}

async function writeSnapshot(snapshot: IntegrationSnapshot) {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  listeners.forEach((cb) => cb(snapshot));
}

export async function getIntegrationSnapshot() {
  return readSnapshot();
}

export function subscribeIntegrations(cb: (snapshot: IntegrationSnapshot) => void) {
  let active = true;
  readSnapshot().then((snapshot) => active && cb(snapshot));
  listeners.add(cb);
  return () => {
    active = false;
    listeners.delete(cb);
  };
}

async function appendHistory(
  snapshot: IntegrationSnapshot,
  event: SyncHistoryEvent
) {
  snapshot.settings.history = [event, ...(snapshot.settings.history || [])].slice(
    0,
    HISTORY_LIMIT
  );
}

async function syncRingConnToApp(uid: string): Promise<SyncResult> {
  const source = getRingConnDataSource();
  const date = new Date();
  const [summary, recovery] = await Promise.all([
    source.fetchDailySummary(date),
    source.fetchRecoveryScore(date),
  ]);
  if (!summary) {
    return {
      ok: false,
      dataPointsReceived: 0,
      message:
        Platform.OS === "ios"
          ? "RingConn data was not detected in Apple Health."
          : "Health Connect passthrough is not live yet on this build.",
    };
  }

  const latestValues: IntegrationLatestValues = {
    steps: summary.steps?.value,
    activeCalories: summary.activeCalories?.value,
    recoveryScore: recovery?.score,
    hrvMs: summary.hrv?.value,
    restingHeartRateBpm: summary.restingHeartRate?.value,
    bloodOxygenPct: summary.bloodOxygen?.value,
    skinTemperatureC: summary.skinTemperature?.value,
    sleepDurationMin: summary.sleep?.value.totalSleepMin,
    sleepStages: summary.sleep?.value
      ? {
          light: summary.sleep.value.light,
          deep: summary.sleep.value.deep,
          rem: summary.sleep.value.rem,
          awake: summary.sleep.value.awake,
        }
      : undefined,
    sleepQualityPct: summary.sleep?.value.totalSleepMin
      ? Math.round(
          ((summary.sleep.value.deep + summary.sleep.value.rem) /
            summary.sleep.value.totalSleepMin) *
            100
        )
      : undefined,
    recoveryText:
      recovery?.score != null
        ? `Estimated from your RingConn data`
        : undefined,
    sourceTags: {
      heartRate: summary.heartRate?.source,
      restingHeartRate: summary.restingHeartRate?.source,
      hrv: summary.hrv?.source,
      bloodOxygen: summary.bloodOxygen?.source,
      steps: summary.steps?.source,
      activeCalories: summary.activeCalories?.source,
      sleep: summary.sleep?.source,
      skinTemperature: summary.skinTemperature?.source,
      respiratoryRate: summary.respiratoryRate?.source,
    },
  };

  if (summary.steps?.value) {
    await setStepsForDate(uid, summary.date, summary.steps.value);
  }
  await updateProfile(uid, {
    ...(summary.restingHeartRate?.value
      ? { restingHeartRateBpm: summary.restingHeartRate.value }
      : {}),
    ...(summary.hrv?.value ? { hrvMs: summary.hrv.value } : {}),
    ...(recovery?.score != null ? { recoveryScore: recovery.score } : {}),
    ...(summary.bloodOxygen?.value
      ? { bloodOxygenPct: summary.bloodOxygen.value }
      : {}),
    healthLastUpdatedVia: summary.detected ? "RingConn" : "Apple Health",
    healthLastUpdatedAt: now(),
    healthMetricSources: {
      restingHeartRate: summary.restingHeartRate?.source?.via,
      hrv: summary.hrv?.source?.via,
      bloodOxygen: summary.bloodOxygen?.source?.via,
    },
  } as any);

  return {
    ok: true,
    latestValues,
    dataPointsReceived: Object.values(latestValues).filter(Boolean).length,
    message: summary.detected
      ? undefined
      : "No RingConn-written samples were found in the last 48 hours.",
  };
}

async function performIntegrationSync(
  id: string,
  uid?: string
): Promise<SyncResult> {
  if (!uid) return { ok: false, dataPointsReceived: 0, message: "No user context." };
  if (id === "apple_health") {
    const result = await syncAppleHealthToApp(uid, 14);
    return {
      ok: result.ok,
      message: result.message,
      dataPointsReceived: result.ok ? 5 : 0,
    };
  }
  if (id === "ringconn") {
    return syncRingConnToApp(uid);
  }
  return {
    ok: false,
    dataPointsReceived: 0,
    message: "This integration is not live yet.",
  };
}

async function maybeNotifySleepReady(
  conn: IntegrationConnection,
  def: IntegrationDef | undefined,
  uid?: string
) {
  if (!uid || !conn.latestValues?.sleepDurationMin || !conn.latestValues.sleepEndedAt) {
    return;
  }
  const day = ymd(conn.latestValues.sleepEndedAt);
  if (conn.lastSleepReadyYmd === day) return;
  await addNotification(uid, {
    type: "info",
    title: "🛌 Your sleep data from last night is ready",
    body: `${def?.name || "Your ring"} synced ${Math.round(
      conn.latestValues.sleepDurationMin / 60
    )}h ${conn.latestValues.sleepDurationMin % 60}m of sleep.`,
    data: { integrationId: conn.id, source: "integration:sleepReady" },
  });
}

async function maybeNotifySyncError(
  conn: IntegrationConnection,
  def: IntegrationDef | undefined,
  uid?: string
) {
  if (!uid || (conn.failCount || 0) < 3) return;
  const recent = conn.lastErrorNotifiedAt || 0;
  if (now() - recent < 8 * 60 * 60 * 1000) return;
  await addNotification(uid, {
    type: "info",
    title: `⚠ ${def?.name || "Integration"} sync is having trouble. Tap to fix.`,
    body: conn.lastError || "Reconnect this source in Integrations.",
    data: { integrationId: conn.id, source: "integration:syncError" },
  });
}

export async function setIntegrationConnected(
  id: string,
  connected: boolean,
  uid?: string,
  options?: { tokenHint?: string }
) {
  if (id === "ringconn") {
    const snapshot = await readSnapshot();
    const appleReady = !!snapshot.connections.apple_health?.connected;
    if (!appleReady) {
      snapshot.connections[id] = {
        ...(snapshot.connections[id] || {
          id,
          status: "warning",
          connected: false,
          useGlobalSync: true,
        }),
        status: "warning",
        connected: false,
        lastError:
          Platform.OS === "ios"
            ? "Requires Apple Health. Connect Apple Health first."
            : "Requires Health Connect. Connect your Android health source first.",
      };
      await writeSnapshot(snapshot);
      return { ok: false, message: snapshot.connections[id].lastError };
    }
    const result = await syncRingConnToApp(uid || "");
    snapshot.connections[id] = {
      ...(snapshot.connections[id] || {
        id,
        useGlobalSync: true,
        connected: false,
        status: "disconnected" as IntegrationStatus,
      }),
      connected: !!result.ok,
      status: result.ok ? "connected" : "warning",
      lastSyncedAt: result.ok ? now() : snapshot.connections[id]?.lastSyncedAt,
      lastError: result.message,
      latestValues: result.latestValues,
    };
    await writeSnapshot(snapshot);
    return { ok: result.ok, message: result.message };
  }
  const snapshot = await readSnapshot();
  const previous =
    snapshot.connections[id] ||
    ({
      id,
      status: "disconnected",
      connected: false,
      useGlobalSync: true,
    } as IntegrationConnection);

  if (connected && !IMPLEMENTED_INTEGRATIONS.has(id)) {
    snapshot.connections[id] = {
      ...previous,
      id,
      connected: false,
      status: "warning",
      lastError:
        "This integration is not live yet. Apple Health and RingConn are the first working sources right now.",
    };
    await writeSnapshot(snapshot);
    return { ok: false, message: snapshot.connections[id].lastError };
  }

  if (!connected) {
    snapshot.connections[id] = {
      ...previous,
      connected: false,
      status: "disconnected",
      tokenHint: undefined,
    };
    if (id === "apple_health") {
      snapshot.connections.ringconn = {
        ...(snapshot.connections.ringconn || {
          id: "ringconn",
          useGlobalSync: true,
        }),
        id: "ringconn",
        connected: false,
        status: "warning",
        lastError: "Requires Apple Health. Connect Apple Health first.",
      };
    }
    await writeSnapshot(snapshot);
    return { ok: true };
  }

  snapshot.connections[id] = {
    ...previous,
    id,
    connected: true,
    status: "syncing",
    useGlobalSync: previous.useGlobalSync ?? true,
    tokenHint: options?.tokenHint || previous.tokenHint,
    lastAttemptAt: now(),
  };
  await writeSnapshot(snapshot);

  const result = await runIntegrationSync(uid, {
    reason: "connect",
    force: true,
    ids: [id],
  });
  return { ok: result.success, message: result.failed.length ? "Sync failed." : undefined };
}

export async function markPrimaryIntegration(id: string) {
  const snapshot = await readSnapshot();
  Object.keys(snapshot.connections).forEach((key) => {
    snapshot.connections[key].primary = key === id;
  });
  await writeSnapshot(snapshot);
}

export async function updateIntegrationSettings(patch: Partial<IntegrationSettings>) {
  const snapshot = await readSnapshot();
  snapshot.settings = {
    ...snapshot.settings,
    ...patch,
    history: patch.history ?? snapshot.settings.history,
  };
  await writeSnapshot(snapshot);
}

export async function updateIntegrationConnection(
  id: string,
  patch: Partial<IntegrationConnection>
) {
  const snapshot = await readSnapshot();
  const current = snapshot.connections[id] || {
    id,
    connected: false,
    status: "disconnected" as IntegrationStatus,
    useGlobalSync: true,
  };
  snapshot.connections[id] = { ...current, ...patch, id };
  await writeSnapshot(snapshot);
}

function shouldPrioritySync(
  snapshot: IntegrationSnapshot,
  conn: IntegrationConnection
) {
  const values = conn.latestValues;
  const last = conn.lastSyncedAt || 0;
  const nowTs = now();
  if (values?.workoutActive) {
    return nowTs - last >= 5 * 60 * 1000;
  }
  if (values?.sleepEndedAt && last < values.sleepEndedAt) {
    const age = nowTs - values.sleepEndedAt;
    if (age >= 0 && age <= 6 * 60 * 60 * 1000) {
      return true;
    }
  }
  return false;
}

function shouldSyncConnection(
  snapshot: IntegrationSnapshot,
  conn: IntegrationConnection,
  force = false
) {
  if (!conn.connected) return false;
  if (force) return true;
  if (!snapshot.settings.autoSync) return false;
  if (shouldPrioritySync(snapshot, conn)) return true;
  const freq = effectiveFrequency(snapshot, conn);
  const ms = getFrequencyMs(freq);
  if (!Number.isFinite(ms)) return false;
  const last = conn.lastSyncedAt || 0;
  return now() - last >= ms;
}

export async function runIntegrationSync(
  uid?: string,
  opts: {
    reason?: SyncReason;
    force?: boolean;
    ids?: string[];
  } = {}
) {
  const reason = opts.reason || "manual";
  const startedAt = now();
  const snapshot = await readSnapshot();
  const targets = Object.values(snapshot.connections).filter((conn) => {
    if (opts.ids?.length && !opts.ids.includes(conn.id)) return false;
    return shouldSyncConnection(snapshot, conn, !!opts.force);
  });

  if (!targets.length) {
    return {
      success: true,
      failed: [] as string[],
      integrations: [] as string[],
      dataPointsReceived: 0,
    };
  }

  targets.forEach((conn) => {
    conn.status = "syncing";
    conn.lastAttemptAt = startedAt;
  });
  await writeSnapshot({ ...snapshot });

  const failed: string[] = [];
  let dataPointsReceived = 0;

  for (const conn of targets) {
    const result = await performIntegrationSync(conn.id, uid);
    const latest = await readSnapshot();
    const current = latest.connections[conn.id] || conn;
    const def = INTEGRATIONS.find((x) => x.id === conn.id);
    const isFirstSuccessfulSync = result.ok && !current.firstSyncCompletedAt;
    current.connected = result.ok ? true : current.connected;
    current.status = result.ok
      ? "connected"
      : (current.failCount || 0) + 1 >= 3
      ? "error"
      : "warning";
    current.failCount = result.ok ? 0 : (current.failCount || 0) + 1;
    current.lastError = result.ok ? undefined : result.message || "Sync failed.";
    current.lastSyncedAt = result.ok ? now() : current.lastSyncedAt;
    current.latestValues = result.latestValues || current.latestValues;
    current.dataPointsReceived = result.ok
      ? (current.dataPointsReceived || 0) + result.dataPointsReceived
      : current.dataPointsReceived || 0;
    current.batteryLevel = result.latestValues?.batteryLevel ?? current.batteryLevel;
    if (isFirstSuccessfulSync) {
      current.firstSyncCompletedAt = now();
    }
    latest.connections[conn.id] = current;
    if (result.ok) {
      dataPointsReceived += result.dataPointsReceived;
      if (isFirstSuccessfulSync) {
        await addNotification(uid!, {
          type: "info",
          title: `✓ ${def?.name || "Integration"} connected. Your data is syncing.`,
          body: "Background sync is active and your latest data is cached locally.",
          data: { integrationId: conn.id, source: "integration:firstSync" },
        });
      }
      await maybeNotifySleepReady(current, def, uid);
      current.lastSleepReadyYmd = current.latestValues?.sleepEndedAt
        ? ymd(current.latestValues.sleepEndedAt)
        : current.lastSleepReadyYmd;
      current.lastErrorNotifiedAt = undefined;
      if (conn.id === "apple_health" && Platform.OS === "ios") {
        const ringResult = await syncRingConnToApp(uid || "");
        const ringCurrent = latest.connections.ringconn || {
          id: "ringconn",
          connected: false,
          status: "disconnected" as IntegrationStatus,
          useGlobalSync: true,
        };
        ringCurrent.connected = !!ringResult.ok;
        ringCurrent.status = ringResult.ok ? "connected" : "warning";
        ringCurrent.lastSyncedAt = ringResult.ok ? now() : ringCurrent.lastSyncedAt;
        ringCurrent.lastError = ringResult.message;
        ringCurrent.latestValues = ringResult.latestValues;
        ringCurrent.dataPointsReceived = ringResult.dataPointsReceived;
        latest.connections.ringconn = ringCurrent;
      }
    } else {
      failed.push(conn.id);
      await maybeNotifySyncError(current, def, uid);
      current.lastErrorNotifiedAt =
        (current.failCount || 0) >= 3 ? now() : current.lastErrorNotifiedAt;
    }
    latest.connections[conn.id] = current;
    await writeSnapshot(latest);
  }

  const finishedAt = now();
  const finalSnapshot = await readSnapshot();
  finalSnapshot.settings.lastFullSyncAt = finishedAt;
  await appendHistory(finalSnapshot, {
    id: `${startedAt}:${Math.random().toString(36).slice(2, 8)}`,
    reason,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    integrations: targets.map((x) => x.id),
    failed,
    success: failed.length === 0,
    dataPointsReceived,
  });
  await writeSnapshot(finalSnapshot);

  return {
    success: failed.length === 0,
    failed,
    integrations: targets.map((x) => x.id),
    dataPointsReceived,
  };
}

export async function clearSyncHistory() {
  const snapshot = await readSnapshot();
  snapshot.settings.history = [];
  await writeSnapshot(snapshot);
}

export function connectedCount(snapshot: IntegrationSnapshot) {
  return Object.values(snapshot.connections).filter((c) => c.connected).length;
}

export function syncHealth(snapshot: IntegrationSnapshot) {
  const connected = Object.values(snapshot.connections).filter((c) => c.connected);
  if (connected.some((c) => c.status === "error")) return "error";
  if (connected.some((c) => c.status === "syncing")) return "syncing";
  if (connected.some((c) => c.status === "warning")) return "warning";
  return connected.length ? "ready" : "none";
}

export function formatLastSync(ts?: number) {
  if (!ts) return "Never";
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) {
    return `${Math.round(diff / 3_600_000)}h ago`;
  }
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatSyncInterval(freq: SyncFrequency) {
  switch (freq) {
    case "30min":
      return "30 min";
    case "1hour":
      return "1 hour";
    case "2hours":
      return "2 hours";
    case "4hours":
      return "4 hours";
    case "manual":
    default:
      return "Manual only";
  }
}

export function describeSyncInterval(freq: SyncFrequency) {
  switch (freq) {
    case "30min":
      return "Most up-to-date. Higher battery usage.";
    case "1hour":
      return "Balanced. Recommended for most users.";
    case "2hours":
      return "Light battery impact. Good for casual tracking.";
    case "4hours":
      return "Minimal battery impact. Data may be a few hours old.";
    case "manual":
    default:
      return "Sync only when you tap 'Sync now'. No background activity.";
  }
}

export function getGlobalSyncStatus(snapshot: IntegrationSnapshot) {
  const health = syncHealth(snapshot);
  const last = snapshot.settings.lastFullSyncAt;
  if (health === "error") {
    return {
      tone: "red" as const,
      text: "Sync error · Tap to fix",
      last,
    };
  }
  if (health === "syncing") {
    return {
      tone: "yellow" as const,
      text: "Syncing...",
      last,
    };
  }
  if (connectedCount(snapshot) > 0) {
    return {
      tone: "green" as const,
      text: `All synced · ${formatLastSync(last)}`,
      last,
    };
  }
  return {
    tone: "gray" as const,
    text: "No integrations connected",
    last,
  };
}

export function getConnectionSyncLabel(
  snapshot: IntegrationSnapshot,
  conn?: IntegrationConnection
) {
  if (!conn?.connected) return "Not connected";
  if (conn.status === "syncing") return "Syncing...";
  if (conn.status === "error") return "Error · Reconnect needed";
  if (conn.status === "warning") return "Reconnect needed";
  const freq = effectiveFrequency(snapshot, conn);
  if (freq === "manual") return "Manual sync only";
  return `Synced · ${formatLastSync(conn.lastSyncedAt)}`;
}

function getOrderedConnections(snapshot: IntegrationSnapshot) {
  return Object.values(snapshot.connections)
    .filter((c) => c.connected)
    .sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return (b.lastSyncedAt || 0) - (a.lastSyncedAt || 0);
    });
}

export function getRecoveryMetrics(snapshot: IntegrationSnapshot | null) {
  if (!snapshot) return null;
  const ordered = getOrderedConnections(snapshot);
  for (const conn of ordered) {
    const v = conn.latestValues;
    if (v?.recoveryScore != null || v?.hrvMs != null || v?.restingHeartRateBpm != null) {
      const def = INTEGRATIONS.find((x) => x.id === conn.id);
      return {
        sourceId: conn.id,
        sourceName: def?.name || conn.id,
        recoveryScore: v?.recoveryScore,
        hrvMs: v?.hrvMs,
        restingHeartRateBpm: v?.restingHeartRateBpm,
        stressScore: v?.stressScore,
        batteryLevel: v?.batteryLevel,
        bloodOxygenPct: v?.bloodOxygenPct,
        sleepDurationMin: v?.sleepDurationMin,
        sleepStages: v?.sleepStages,
      };
    }
  }
  return null;
}

export function getActivityMetrics(snapshot: IntegrationSnapshot | null) {
  if (!snapshot) return null;
  const ordered = getOrderedConnections(snapshot);
  for (const conn of ordered) {
    const v = conn.latestValues;
    if (v?.steps != null || v?.activeCalories != null) {
      const def = INTEGRATIONS.find((x) => x.id === conn.id);
      return {
        sourceId: conn.id,
        sourceName: def?.name || conn.id,
        steps: v?.steps,
        activeCalories: v?.activeCalories,
      };
    }
  }
  return null;
}

let appState: AppStateStatus = AppState.currentState;
let bootHandle: ReturnType<typeof setInterval> | null = null;
let bootTeardown: (() => void) | null = null;
let lastOpenSyncAt = 0;

async function triggerDueSync(uid?: string, reason: SyncReason = "interval") {
  if (!uid) return;
  const snapshot = await readSnapshot();
  const due = Object.values(snapshot.connections).some((conn) =>
    shouldSyncConnection(snapshot, conn, false)
  );
  if (!due) return;
  await runIntegrationSync(uid, { reason, force: false });
}

export function startIntegrationAutoSync(getUid: () => string | undefined) {
  bootTeardown?.();
  if (bootHandle) clearInterval(bootHandle);

  const onStateChange = (next: AppStateStatus) => {
    const prev = appState;
    appState = next;
    if (next === "active" && prev !== "active") {
      const uid = getUid();
      if (!uid) return;
      readSnapshot().then((snapshot) => {
        if (!snapshot.settings.syncOnAppOpen) return;
        if (Date.now() - lastOpenSyncAt < 45_000) return;
        lastOpenSyncAt = Date.now();
        runIntegrationSync(uid, { reason: "app_open", force: true }).catch(() => {});
      });
    }
  };

  const sub = AppState.addEventListener("change", onStateChange);
  bootHandle = setInterval(() => {
    if (appState !== "active") return;
    triggerDueSync(getUid(), "interval").catch(() => {});
  }, 60_000);

  const uid = getUid();
  if (uid) {
    runIntegrationSync(uid, { reason: "bootstrap", force: false }).catch(() => {});
  }

  bootTeardown = () => {
    sub.remove();
    if (bootHandle) clearInterval(bootHandle);
    bootHandle = null;
  };
  return bootTeardown;
}
