import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { type FoodEntry, getFoodsInRange } from "@/services/nutrition";
import { type Profile } from "@/services/profile";
import { nutritionTargets } from "@/services/nutritionTargets";
import {
  getIntegrationSnapshot,
  type IntegrationSnapshot,
  type SleepStageBreakdown,
} from "@/services/integrations";
import { loadBodyMetricsHistory } from "@/services/profile/bodyMetrics";
import { type Workout } from "@/services/workouts";
import { type ActivityEntry } from "@/services/activity";

export interface DayData {
  date: string;
  nutrition: {
    calories: number;
    calorieGoal: number;
    protein: number;
    carbs: number;
    fat: number;
    proteinGoal: number;
    carbsGoal: number;
    fatGoal: number;
    meals: { name: string; time: string; calories: number }[];
    logged: boolean;
  } | null;
  workout: {
    name: string;
    duration: number;
    volume: number;
    score: number;
    fatigue: string;
    exercises: number;
  } | null;
  hydration: {
    logged: number;
    goal: number;
  } | null;
  steps: {
    count: number;
    goal: number;
    source?: string;
  } | null;
  sleep: {
    duration: number;
    deep: number;
    rem: number;
    light: number;
    awake?: number;
    score: number;
  } | null;
  weight: number | null;
  prs: { exercise: string; weight: number; reps: number }[];
  overallScore: number;
}

type CacheEntry = {
  expiresAt: number;
  promise: Promise<Record<string, DayData>>;
};

type WorkoutSession = {
  key: string;
  date: string;
  title: string;
  rows: Workout[];
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYmd(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function buildDateKeys(startDate: string, endDate: string) {
  const keys: string[] = [];
  let cursor = parseYmd(startDate);
  const end = parseYmd(endDate);
  while (cursor <= end) {
    keys.push(ymd(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function num(value: any, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function createdAtMs(value: any) {
  if (typeof value === "number") return value;
  return value?.toMillis?.() ?? 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function timeLabelForFood(entry: FoodEntry) {
  const createdMs = createdAtMs(entry.createdAt);
  if (createdMs > 0) {
    return new Date(createdMs).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  switch ((entry.meal || "").toLowerCase()) {
    case "breakfast":
      return "8:00 AM";
    case "lunch":
      return "1:00 PM";
    case "dinner":
      return "7:00 PM";
    case "snacks":
      return "4:00 PM";
    default:
      return "12:00 PM";
  }
}

function bodyMetricDayKey(timestamp: number) {
  return ymd(new Date(timestamp));
}

function workoutRowMs(row: Workout) {
  return (
    num((row as any).setCreatedAt) ||
    num((row as any).sessionStartedAt) ||
    createdAtMs(row.createdAt) ||
    parseYmd(row.date || ymd(new Date())).getTime()
  );
}

function sessionTitle(row: Workout) {
  return String(row.sessionTitle || row.exercise || "Workout").trim() || "Workout";
}

function buildWorkoutSessions(rows: Workout[]) {
  const buckets = new Map<string, WorkoutSession>();
  const ordered = rows.slice().sort((a, b) => workoutRowMs(a) - workoutRowMs(b));
  for (const row of ordered) {
    const key = row.sessionId
      ? `session:${row.sessionId}`
      : `date:${row.date}:${sessionTitle(row)}`;
    const current = buckets.get(key);
    if (current) {
      current.rows.push(row);
    } else {
      buckets.set(key, {
        key,
        date: row.date,
        title: sessionTitle(row),
        rows: [row],
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => {
    return workoutRowMs(b.rows[b.rows.length - 1]) - workoutRowMs(a.rows[a.rows.length - 1]);
  });
}

function workoutScore(volumeKg: number, durationMin: number, exerciseCount: number) {
  if (!volumeKg || !durationMin) return 0;
  const density = volumeKg / Math.max(1, durationMin);
  const complexity = exerciseCount >= 8 ? 1.15 : exerciseCount >= 5 ? 1 : 0.9;
  return clamp(Math.round(density * complexity), 0, 100);
}

function summarizeWorkout(session: WorkoutSession): DayData["workout"] {
  const rows = session.rows.slice().sort((a, b) => workoutRowMs(a) - workoutRowMs(b));
  const startMs = num(rows[0]?.sessionStartedAt) || workoutRowMs(rows[0]);
  const endMs = workoutRowMs(rows[rows.length - 1]);
  const duration = startMs && endMs >= startMs ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 0;
  const volume = rows.reduce(
    (sum, row) => sum + num(row.sets) * num(row.reps) * num(row.weight),
    0
  );
  const exerciseCount = new Set(rows.map((row) => row.exercise).filter(Boolean)).size;
  return {
    name: session.title,
    duration,
    volume,
    score: workoutScore(volume, duration, exerciseCount),
    fatigue: String(rows.find((row) => row.notes)?.notes || "").trim(),
    exercises: exerciseCount,
  };
}

function summarizePrs(rows: Workout[]) {
  const byExercise = new Map<string, { exercise: string; weight: number; reps: number }>();
  const bestSeen = new Map<string, number>();
  const ordered = rows.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return workoutRowMs(a) - workoutRowMs(b);
  });
  const byDate = new Map<string, Map<string, { exercise: string; weight: number; reps: number }>>();

  for (const row of ordered) {
    const exercise = String(row.exercise || "").trim();
    if (!exercise) continue;
    const weight = num(row.weight);
    const reps = num(row.reps);
    const previous = bestSeen.get(exercise) ?? -Infinity;
    if (weight > previous) {
      bestSeen.set(exercise, weight);
      const dayMap = byDate.get(row.date) || new Map<string, { exercise: string; weight: number; reps: number }>();
      dayMap.set(exercise, { exercise, weight, reps });
      byDate.set(row.date, dayMap);
      byExercise.set(exercise, { exercise, weight, reps });
    }
  }

  const result = new Map<string, { exercise: string; weight: number; reps: number }[]>();
  byDate.forEach((value, key) => result.set(key, Array.from(value.values())));
  return result;
}

function calculateSleepScore(durationMin: number, stages?: SleepStageBreakdown) {
  const durationScore = clamp(durationMin / 480, 0, 1) * 70;
  const qualityScore = stages && durationMin > 0
    ? clamp((num(stages.deep) + num(stages.rem)) / durationMin, 0, 0.6) / 0.6 * 30
    : 0;
  return Math.round(durationScore + qualityScore);
}

function formatSleepSourceDate(snapshot: IntegrationSnapshot) {
  const latest = snapshot.connections?.ringconn?.latestValues || snapshot.connections?.apple_health?.latestValues;
  const end = latest?.sleepEndedAt;
  if (!end) return null;
  return ymd(new Date(end));
}

async function getHydrationRange(uid: string, dateKeys: string[]) {
  const entries = await Promise.all(
    dateKeys.map(async (date) => {
      const raw = await AsyncStorage.getItem(`@water:${date}`);
      return [date, num(raw)] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

async function getWorkoutRowsInRange(uid: string, startDate: string, endDate: string) {
  if (!uid || uid === "__demo__") return [] as Workout[];
  const snap = await getDocs(
    query(
      collection(getFirestore() ?? db, "users", uid, "workouts"),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc")
    )
  );
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as Workout[];
}

async function getActivityRowsInRange(uid: string, startDate: string, endDate: string) {
  if (!uid || uid === "__demo__") return [] as ActivityEntry[];
  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
  const snap = await getDocs(
    query(
      collection(getFirestore() ?? db, "users", uid, "activity"),
      where("timestamp", ">=", startMs),
      where("timestamp", "<=", endMs),
      orderBy("timestamp", "asc")
    )
  );
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as ActivityEntry[];
}

export function calculateDayScore(day: DayData): number {
  let score = 0;
  let factors = 0;
  if (day.nutrition) {
    const calPct = day.nutrition.calorieGoal > 0 ? day.nutrition.calories / day.nutrition.calorieGoal : 0;
    score += Math.min(calPct, 1.1) * 30;
    factors++;
  }
  if (day.nutrition?.proteinGoal) {
    score += Math.min(day.nutrition.protein / day.nutrition.proteinGoal, 1) * 25;
    factors++;
  }
  if (day.workout) {
    score += 25;
    factors++;
  }
  if (day.hydration?.goal) {
    score += Math.min(day.hydration.logged / day.hydration.goal, 1) * 10;
    factors++;
  }
  if (day.steps?.goal) {
    score += Math.min(day.steps.count / day.steps.goal, 1) * 10;
    factors++;
  }
  return factors > 0 ? Math.round(score) : 0;
}

export async function getCalendarRangeData(
  uid: string,
  startDate: string,
  endDate: string,
  profile: Profile | null
) {
  const stepsUpdatedAt = (profile as any)?.stepsUpdatedAt ?? 0;
  const cacheKey = [uid, startDate, endDate, stepsUpdatedAt, JSON.stringify(profile?.activeFitAdaptTargets)].join(":");
  const now = Date.now();
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = (async () => {
    const dateKeys = buildDateKeys(startDate, endDate);
    const stepsMap = (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    const effective = nutritionTargets(profile, {
      calories: num(profile?.goalResult?.dailyCalories ?? profile?.dailyCaloriesTarget ?? profile?.calorieGoal, 2400),
      protein: num(profile?.goalResult?.protein ?? profile?.dailyProteinTarget ?? profile?.proteinGoal, 150),
      carbs: num(profile?.goalResult?.carbs ?? profile?.carbGoal, 220),
      fat: num(profile?.goalResult?.fat ?? profile?.fatGoal, 70),
    });
    const { calories: calorieGoal, protein: proteinGoal, carbs: carbsGoal, fat: fatGoal } = effective;
    const hydrationGoal = num(
      (profile as any)?.waterGoalMl ?? (profile as any)?.dailyWaterTargetMl ?? (profile as any)?.hydrationGoalMl,
      2400
    );
    const stepsGoal = num(profile?.stepsGoal ?? (profile as any)?.stepsPerDay, 8000);

    const [foods, workouts, activities, hydrationByDate, bodyHistory, integrations] = await Promise.all([
      getFoodsInRange(uid, startDate, endDate),
      getWorkoutRowsInRange(uid, startDate, endDate),
      getActivityRowsInRange(uid, startDate, endDate),
      getHydrationRange(uid, dateKeys),
      loadBodyMetricsHistory(),
      getIntegrationSnapshot(),
    ]);

    const sessions = buildWorkoutSessions(workouts);
    const prsByDate = summarizePrs(workouts);
    const sleepYmd = formatSleepSourceDate(integrations);
    const latestSleep = integrations.connections?.ringconn?.latestValues || integrations.connections?.apple_health?.latestValues;

    const mealsByDate = new Map<string, FoodEntry[]>();
    for (const item of foods) {
      const key = String(item.date || "").slice(0, 10);
      if (!key) continue;
      const bucket = mealsByDate.get(key) || [];
      bucket.push(item);
      mealsByDate.set(key, bucket);
    }

    const workoutByDate = new Map<string, DayData["workout"]>();
    for (const session of sessions) {
      if (!workoutByDate.has(session.date)) {
        workoutByDate.set(session.date, summarizeWorkout(session));
      } else {
        const current = workoutByDate.get(session.date)!;
        const next = summarizeWorkout(session);
        if (!next) continue;
        workoutByDate.set(session.date, {
          name: current.name === next.name ? current.name : `${current.name} + ${next.name}`,
          duration: current.duration + next.duration,
          volume: current.volume + next.volume,
          score: clamp(Math.round((current.score + next.score) / 2), 0, 100),
          fatigue: current.fatigue || next.fatigue,
          exercises: current.exercises + next.exercises,
        });
      }
    }

    const activityByDate = new Map<string, ActivityEntry[]>();
    for (const item of activities) {
      const key = ymd(new Date(item.timestamp));
      const bucket = activityByDate.get(key) || [];
      bucket.push(item);
      activityByDate.set(key, bucket);
    }

    const bodyWeightByDate = new Map<string, number>();
    for (const point of bodyHistory) {
      const key = bodyMetricDayKey(point.t);
      if (typeof point.weightLb === "number" && point.weightLb > 0) {
        bodyWeightByDate.set(key, point.weightLb);
      }
    }

    const output: Record<string, DayData> = {};
    for (const date of dateKeys) {
      const dayFoods = (mealsByDate.get(date) || []).sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
      const nutrition = dayFoods.length
        ? {
            calories: dayFoods.reduce((sum, item) => sum + num(item.calories), 0),
            calorieGoal,
            protein: dayFoods.reduce((sum, item) => sum + num(item.protein), 0),
            carbs: dayFoods.reduce((sum, item) => sum + num(item.carbs), 0),
            fat: dayFoods.reduce((sum, item) => sum + num(item.fat), 0),
            proteinGoal,
            carbsGoal,
            fatGoal,
            meals: dayFoods.map((item) => ({
              name: String(item.name || "Food"),
              time: timeLabelForFood(item),
              calories: num(item.calories),
            })),
            logged: true,
          }
        : null;

      const activityEntries = activityByDate.get(date) || [];
      const explicitSteps = num(stepsMap[date]);
      const activitySteps = activityEntries.reduce((sum, item) => sum + num(item.steps), 0);
      const stepsCount = Math.max(explicitSteps, activitySteps);

      const sleep =
        sleepYmd === date && latestSleep?.sleepDurationMin
          ? {
              duration: num(latestSleep.sleepDurationMin),
              deep: num(latestSleep.sleepStages?.deep),
              rem: num(latestSleep.sleepStages?.rem),
              light: num(latestSleep.sleepStages?.light),
              awake: num(latestSleep.sleepStages?.awake),
              score: calculateSleepScore(num(latestSleep.sleepDurationMin), latestSleep.sleepStages),
            }
          : null;

      const day: DayData = {
        date,
        nutrition,
        workout: workoutByDate.get(date) || null,
        hydration:
          hydrationByDate[date] > 0 || hydrationGoal > 0
            ? {
                logged: num(hydrationByDate[date]),
                goal: hydrationGoal,
              }
            : null,
        steps:
          stepsCount > 0 || stepsGoal > 0
            ? {
                count: stepsCount,
                goal: stepsGoal,
                source: latestSleep?.sourceTags?.steps?.via,
              }
            : null,
        sleep,
        weight: bodyWeightByDate.get(date) ?? null,
        prs: prsByDate.get(date) || [],
        overallScore: 0,
      };
      day.overallScore = calculateDayScore(day);
      output[date] = day;
    }

    return output;
  })();

  cache.set(cacheKey, { promise, expiresAt: now + CACHE_TTL_MS });
  return promise;
}

export function clearCalendarDataCache() {
  cache.clear();
}
