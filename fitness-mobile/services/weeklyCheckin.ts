import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, getFirestore, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { getFoodsInRange } from "@/services/nutrition";
import { type Profile } from "@/services/profile";

export interface WeeklyCheckin {
  id: string;
  weekOf: string;
  completedAt: string;
  energy: 1 | 2 | 3 | 4 | 5;
  consistencyRating: "accurate" | "felt-better" | "felt-harder";
  bodyChanges: string[];
  bodyNote: string | null;
  mood: 1 | 2 | 3 | 4 | 5;
  moodNote: string | null;
  mealsLoggedDays: number;
  workoutSessions: number;
  hydrationDaysHit: number;
  aiInsight: string;
}

export interface WeeklyConsistencyStats {
  mealsLoggedDays: number;
  workoutSessions: number;
  hydrationDaysHit: number;
  observation: string;
}

const KEY = "weekly_checkins_v1";
const REMINDER_KEY = "weekly_checkin_reminders_v1";

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

function makeId() {
  return `checkin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAll(): Promise<WeeklyCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeeklyCheckin[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(next: WeeklyCheckin[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return ymd(addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), mondayOffset));
}

export function getWeekRangeLabel(weekOf: string) {
  const start = parseYmd(weekOf);
  const end = addDays(start, 6);
  return `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}-${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function generateWeeklyInsight(checkin: WeeklyCheckin): string {
  const { energy, mood, mealsLoggedDays, workoutSessions } = checkin;
  if (energy >= 4 && mood >= 4 && mealsLoggedDays >= 5) {
    return "Strong week across the board. This is what momentum looks like.";
  }
  if (energy <= 2 && mealsLoggedDays >= 5) {
    return "You stayed consistent despite low energy. That's discipline — not motivation.";
  }
  if (mood >= 4 && mealsLoggedDays < 4) {
    return "Good headspace this week. Channel that positivity into more consistent logging next week.";
  }
  if (mood <= 2) {
    return "Tough week mentally. Rest is productive too. Small steps this week count.";
  }
  if (workoutSessions >= 4 && energy >= 4) {
    return "Strong training week. Make sure nutrition is keeping up with your output.";
  }
  return "Every week logged is data. Keep building the picture.";
}

export async function saveCheckin(
  checkin: Omit<WeeklyCheckin, "id" | "completedAt" | "aiInsight">
): Promise<void> {
  const rows = await readAll();
  const next: WeeklyCheckin = {
    ...checkin,
    id: makeId(),
    completedAt: new Date().toISOString(),
    aiInsight: generateWeeklyInsight({
      ...checkin,
      id: "",
      completedAt: "",
      aiInsight: "",
    } as WeeklyCheckin),
  };
  const filtered = rows.filter((item) => item.weekOf !== checkin.weekOf);
  filtered.push(next);
  filtered.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  await writeAll(filtered);
}

export async function getCheckins(): Promise<WeeklyCheckin[]> {
  const rows = await readAll();
  return rows.slice().sort((a, b) => b.weekOf.localeCompare(a.weekOf));
}

export async function getThisWeeksCheckin(): Promise<WeeklyCheckin | null> {
  const weekOf = getCurrentWeekStart();
  const rows = await readAll();
  return rows.find((item) => item.weekOf === weekOf) || null;
}

export async function hasCompletedThisWeek(): Promise<boolean> {
  return !!(await getThisWeeksCheckin());
}

export async function getWeeklyConsistencyStats(
  uid: string,
  profile: Profile | null,
  weekOf = getCurrentWeekStart()
): Promise<WeeklyConsistencyStats> {
  const start = parseYmd(weekOf);
  const dates = Array.from({ length: 7 }, (_, index) => ymd(addDays(start, index)));
  const end = dates[dates.length - 1];
  const foods = await getFoodsInRange(uid, weekOf, end);
  const mealsLoggedDays = new Set(foods.map((item) => item.date).filter(Boolean)).size;

  const workoutSnap = await getDocs(
    query(
      collection(getFirestore() ?? db, "users", uid, "workouts"),
      where("date", ">=", weekOf),
      where("date", "<=", end),
      orderBy("date", "asc")
    )
  );
  const workoutSessions = new Set(
    workoutSnap.docs.map((doc) => {
      const data = doc.data() as any;
      return data.sessionId || `${data.date}:${data.sessionTitle || data.exercise || "Workout"}`;
    })
  ).size;

  const goal = Number(
    (profile as any)?.waterGoalMl ?? (profile as any)?.dailyWaterTargetMl ?? (profile as any)?.hydrationGoalMl ?? 2400
  );
  let hydrationDaysHit = 0;
  const hydrationValues: Record<string, number> = {};
  for (const date of dates) {
    const raw = await AsyncStorage.getItem(`@water:${date}`);
    const ml = Math.max(0, Number(raw || 0) || 0);
    hydrationValues[date] = ml;
    if (ml >= goal) hydrationDaysHit += 1;
  }

  const bestDay = dates
    .map((date) => ({
      date,
      score:
        (foods.some((item) => item.date === date) ? 1 : 0) +
        (hydrationValues[date] >= goal ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const observation =
    mealsLoggedDays >= 6
      ? "Your logging stayed tight most of the week."
      : hydrationDaysHit >= 5
      ? "Hydration stayed steadier than nutrition this week."
      : workoutSessions >= 3
      ? "Training showed up more consistently than meals."
      : bestDay
      ? `Your most consistent day was ${parseYmd(bestDay.date).toLocaleDateString(undefined, {
          weekday: "long",
        })}. Weekend logging is your biggest opportunity.`
      : "A few anchor habits will make next week easier to read.";

  return {
    mealsLoggedDays,
    workoutSessions,
    hydrationDaysHit,
    observation,
  };
}

export async function scheduleWeeklyCheckinReminders() {
  try {
    const Notifications = require("expo-notifications");
    if (!Notifications?.scheduleNotificationAsync) return false;
    const state = { sundayMorning: true, sundayEvening: true };
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
