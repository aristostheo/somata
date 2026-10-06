// app/(tabs)/home.tsx
// Premium Home page (Apple-inspired, calm + rewarding)
// Requires: expo-router, expo-blur, expo-linear-gradient, moti, react-native-reanimated, @expo/vector-icons
// Uses your ThemeProvider: import { useTheme } from "@/content/ThemeProvider";
// app/(tabs)/home.tsx
// Premium Home page (Apple-inspired) wired to your OLD backend logic.
// Requires: expo-router, expo-blur, expo-linear-gradient, moti, react-native-reanimated, @expo/vector-icons
// Uses: ThemeProvider + AuthContext + services from your repo

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
  AccessibilityInfo,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { nutritionTargets } from "@/services/nutritionTargets";
import { BlurView } from "expo-blur";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";

import {
  subscribeActivityBetween,
  addActivity,
  updateActivity,
  deleteActivity,
  type ActivityEntry as CardioEntry,
} from "@/services/activity";

import {
  subscribeFoodsByDate,
  subscribeFoodsBetween,
  subscribeExerciseBetween,
  type FoodEntry,
  type ExerciseEntry,
} from "@/services/nutrition";

import {
  ensureProfile,
  subscribeProfile,
  type Profile,
} from "@/services/profile";

// New components you added earlier
import { MetricRing } from "@/components/home/MetricRing";
import {
  QuickActionRow,
  type QuickAction,
} from "@/components/home/QuickActionRow";
import {
  AISuggestionCard,
  type AISuggestion,
} from "@/components/home/AISuggestionCard";
import { AnimatedStepPill } from "@/components/home/AnimatedStepPill";

import { TextInput, KeyboardAvoidingView } from "react-native";
import * as Haptics from "expo-haptics"; // optional
import { setStepsForDate, addStepsForDate } from "@/services/profile";
import ActivityLogSheet from "@/components/activity/ActivityLogSheet";
import {
  connectedCount,
  formatLastSync,
  getActivityMetrics,
  getRecoveryMetrics,
  INTEGRATIONS,
  subscribeIntegrations,
  syncHealth,
  type IntegrationSnapshot,
} from "@/services/integrations";
import { notifyGoalHit } from "@/services/notificationTriggers";

import { useFocusEffect } from "expo-router";
import { useBadgesLocal } from "@/services/badges/useBadgesLocal";

type IoniconName = keyof typeof Ionicons.glyphMap;

function toIoniconName(icon: any): IoniconName {
  const key = String(icon || "");
  return (key in Ionicons.glyphMap ? key : "ribbon") as IoniconName;
}

/* ───────────────── helpers (from your old page) ───────────────── */
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date: Date, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
}
function formatDateLong(d: Date) {
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d.toDateString();
  }
}
function getGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** expo-linear-gradient v15 typing: colors must be a tuple with >=2 items */
type LGColors = readonly [string, string, ...string[]];
const lg = (...c: [string, string, ...string[]]) => c as LGColors;

/* ───────────────── tokens (same aesthetic as your new page) ───────────────── */
type HomeTokens = {
  bg0: string;
  bg1: string;
  card: string;
  card2: string;
  text: string;
  muted: string;
  hairline: string;
  shadow: string;
  tint: string;
  ringA: string;
  ringB: string;
  good: string;
  warn: string;
  bad: string;
};

function makeTokens(isDark: boolean): HomeTokens {
  const tint = isDark ? "#7B6FFF" : "#6355E8";
  return isDark
    ? {
        bg0: "#08080F",
        bg1: "#08080F",
        card: "#0F0F1A",
        card2: "#141422",
        text: "#F0F0FF",
        muted: "#8888AA",
        hairline: "#FFFFFF08",
        shadow: "rgba(0,0,0,0.26)",
        tint,
        ringA: tint,
        ringB: tint,
        good: "#4ADE80",
        warn: "#F59E0B",
        bad: "#F87171",
      }
    : {
        bg0: "#F8F8FC",
        bg1: "#F8F8FC",
        card: "#FFFFFF",
        card2: "#F2F2F8",
        text: "#0A0A1A",
        muted: "#666688",
        hairline: "#00000008",
        shadow: "rgba(11,16,32,0.06)",
        tint,
        ringA: tint,
        ringB: tint,
        good: "#22C55E",
        warn: "#D97706",
        bad: "#E65C5C",
      };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { isDark } = useTheme() as any;
  const { user } = useAuth() as any;

  const t = useMemo(() => makeTokens(!!isDark), [isDark]);

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  // Date key is exactly like old page (string YYYY-MM-DD)
  const [todayStr] = useState(ymd(new Date()));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const today = useMemo(() => {
    // keep “today” consistent with todayStr
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [todayStr]);

  /* ───────────────── OLD backend state ───────────────── */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foodsToday, setFoodsToday] = useState<FoodEntry[]>([]);
  const [exerciseToday, setExerciseToday] = useState<ExerciseEntry[]>([]);
  const [foodsRange, setFoodsRange] = useState<FoodEntry[]>([]);
  const [activityEntries, setActivityEntries] = useState<CardioEntry[]>([]);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CardioEntry | null>(
    null
  );
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(null);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const { badgeUnlocks, refreshBadgesLocal } = useBadgesLocal(true);

  const unlockedBadgeCount = useMemo(
    () => Object.keys(badgeUnlocks || {}).length,
    [badgeUnlocks]
  );

  const unseenBadgeCount = useMemo(() => {
    return Object.values(badgeUnlocks || {}).filter(
      (s) => s && s.seen === false
    ).length;
  }, [badgeUnlocks]);

  useEffect(() => {
    if (!user?.uid) return;

    let unsubProfile: undefined | (() => void);
    let unsubFoods: undefined | (() => void);
    let unsubEx: undefined | (() => void);
    let unsubRange: undefined | (() => void);
    let unsubActivity: undefined | (() => void);

    (async () => {
      await ensureProfile(user.uid, user.email ? { email: user.email } : {});
      unsubProfile = subscribeProfile(user.uid, setProfile);

      unsubFoods = subscribeFoodsByDate(user.uid, todayStr, setFoodsToday);

      unsubEx = subscribeExerciseBetween(user.uid, todayStr, todayStr, (arr) =>
        setExerciseToday(arr || [])
      );

      const start = ymd(addDays(new Date(), -6));
      unsubRange = subscribeFoodsBetween(
        user.uid,
        start,
        todayStr,
        setFoodsRange
      );
      const startAct = ymd(addDays(new Date(), -14));
      unsubActivity = subscribeActivityBetween(
        user.uid,
        startAct,
        todayStr,
        (arr) => setActivityEntries(arr || [])
      );
    })();

    return () => {
      try {
        unsubProfile && unsubProfile();
        unsubFoods && unsubFoods();
        unsubEx && unsubEx();
        unsubRange && unsubRange();
        unsubActivity && unsubActivity();
      } catch {}
    };
  }, [user?.uid, user?.email, todayStr]);

  useEffect(() => subscribeIntegrations(setIntegrations), []);

  useFocusEffect(
    React.useCallback(() => {
      refreshBadgesLocal();
    }, [refreshBadgesLocal])
  );

  /* ───────────────── Derivations (copied from old logic) ───────────────── */
  const targetValues = nutritionTargets(profile, { calories: 2400, protein: 160, carbs: 260, fat: 70 });
  const kcalGoal = targetValues.calories;
  const proteinGoal = targetValues.protein;
  const carbGoal = targetValues.carbs;
  const fatGoal = targetValues.fat;

  const totals = useMemo(() => {
    return foodsToday.reduce(
      (a, f) => ({
        calories: a.calories + (f.calories || 0),
        protein: a.protein + (f.protein || 0),
        carbs: a.carbs + (f.carbs || 0),
        fat: a.fat + (f.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [foodsToday]);

  const caloriesRemaining = Math.max(0, Math.round(kcalGoal - totals.calories));
  const caloriesOver = Math.max(0, Math.round(totals.calories - kcalGoal));
  const proteinRemaining = Math.max(
    0,
    Math.round(proteinGoal - totals.protein)
  );
  const carbsRemaining = Math.max(0, Math.round(carbGoal - totals.carbs));
  const fatRemaining = Math.max(0, Math.round(fatGoal - totals.fat));

  const caloriesPct = kcalGoal ? totals.calories / kcalGoal : 0;
  const fatPct = fatGoal ? totals.fat / fatGoal : 0;

  const stepsGoal = Number((profile as any)?.stepsGoal ?? 8000);
  const stepsToday = useMemo(() => {
    const map =
      (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    return Number(map?.[todayStr] ?? 0);
  }, [profile, todayStr]);

  useEffect(() => {
    if (!user?.uid) return;
    if (stepsGoal > 0 && stepsToday >= stepsGoal) {
      // NOTIFICATION TRIGGER
      notifyGoalHit("steps").catch(() => {});
    }
  }, [stepsGoal, stepsToday, user?.uid]);

  const goalModeRaw =
    (profile as any)?.macroEngineMode ?? profile?.goal ?? "maintain";
  const goalMode = goalModeRaw === "lean_bulk" ? "bulk" : goalModeRaw;
  const goalLabel =
    goalMode === "cut"
      ? "fat loss"
      : goalMode === "bulk"
      ? "muscle gain"
      : "maintenance";
  const weightUnit = profile?.weightUnit ?? "kg";
  const weightKg = Number(profile?.weightKg ?? 0);
  const targetWeightKg = Number(profile?.targetWeightKg ?? 0);
  const hasWeightGoal =
    weightKg > 0 &&
    targetWeightKg > 0 &&
    Math.abs(targetWeightKg - weightKg) >= 0.1;
  const weightDeltaKg = targetWeightKg - weightKg;
  const weightDeltaAbs = Math.abs(weightDeltaKg);
  const targetDate = (profile as any)?.targetDate as string | undefined;
  const daysToTarget = targetDate
    ? Math.ceil(
        (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const toWeightUnit = (kg: number) =>
    weightUnit === "lb" ? kg * 2.20462 : kg;
  const weightUnitLabel = weightUnit === "lb" ? "lb" : "kg";
  const formatWeight = (kg: number, digits = 1) => {
    const factor = digits === 0 ? 1 : 10;
    const value = Math.round(toWeightUnit(kg) * factor) / factor;
    return `${value} ${weightUnitLabel}`;
  };
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);
  const [stepsMode, setStepsMode] = useState<"add" | "set">("add");
  const [stepsInput, setStepsInput] = useState("");

  const canEditSteps = !!user?.uid;

  function openStepsSheet(mode: "add" | "set") {
    setStepsMode(mode);
    setStepsInput("");
    setStepsSheetOpen(true);
    try {
      Haptics.selectionAsync();
    } catch {}
  }

  async function saveSteps() {
    if (!user?.uid) return;

    const n = Math.max(
      0,
      Math.floor(Number(stepsInput.replace(/[^\d]/g, "")) || 0)
    );

    if (stepsMode === "add" && n <= 0) {
      setStepsSheetOpen(false);
      return;
    }
    if (stepsMode === "set" && stepsInput.trim() === "") {
      setStepsSheetOpen(false);
      return;
    }

    try {
      if (stepsMode === "set") {
        await setStepsForDate(user.uid, todayStr, n);
      } else {
        await addStepsForDate(user.uid, todayStr, n);
      }

      setStepsSheetOpen(false);

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (e: any) {
      console.log("saveSteps error:", e);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      alert(e?.message ?? "Failed to save steps.");
    }
  }

  async function handleCreateActivity(e: CardioEntry) {
    if (!user?.uid) return;
    try {
      await addActivity(user.uid, e);
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (err) {
      console.log("addActivity error:", err);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  }

  async function handleUpdateActivity(e: CardioEntry) {
    if (!user?.uid) return;
    try {
      await updateActivity(user.uid, e);
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (err) {
      console.log("updateActivity error:", err);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  }

  async function handleDeleteActivity(id: string) {
    if (!user?.uid) return;
    try {
      await deleteActivity(user.uid, id);
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (err) {
      console.log("deleteActivity error:", err);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  }

  const recoveryMetrics = useMemo(
    () => getRecoveryMetrics(integrations),
    [integrations]
  );
  const integrationActivity = useMemo(
    () => getActivityMetrics(integrations),
    [integrations]
  );

  const burnToday = useMemo(() => {
    const workoutsBurn = exerciseToday.reduce(
      (sum, ex) => sum + Number(ex.calories || 0),
      0
    );

    const activityBurn = activityEntries.reduce(
      (sum, a) => sum + Number(a.calories || 0),
      0
    );

    const nativeBurn = integrationActivity?.activeCalories || 0;
    return Math.max(workoutsBurn + activityBurn, nativeBurn);
  }, [exerciseToday, activityEntries, integrationActivity?.activeCalories]);

  const weeklyProteinHits = useMemo(() => {
    if (!proteinGoal) return 0;
    const start = ymd(addDays(new Date(), -6));
    const days = Array.from({ length: 7 }, (_, i) =>
      ymd(addDays(new Date(start), i))
    );
    const proteinByDate: Record<string, number> = {};
    foodsRange.forEach((f) => {
      proteinByDate[f.date] = (proteinByDate[f.date] || 0) + (f.protein || 0);
    });
    return days.filter((d) => (proteinByDate[d] || 0) >= proteinGoal * 0.8)
      .length;
  }, [foodsRange, proteinGoal]);

  const streakDays = useMemo(() => {
    const d = new Set(
      foodsRange.map((f) => f.date?.slice(0, 10)).filter(Boolean) as string[]
    );
    return d.size;
  }, [foodsRange]);

  const stepsAvg = useMemo(() => {
    const map =
      (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    const days = Array.from({ length: 7 }, (_, i) =>
      ymd(addDays(new Date(), -i))
    );
    const sum = days.reduce((s, d) => s + Number(map[d] || 0), 0);
    return Math.round(sum / days.length);
  }, [profile]);

  const topMacroDeficit = useMemo(() => {
    const gaps = [
      { key: "protein", label: "protein", value: proteinRemaining, color: t.ringB },
      { key: "carbs", label: "carbs", value: carbsRemaining, color: t.tint },
      { key: "fat", label: "fat", value: fatRemaining, color: t.warn },
    ]
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    return gaps[0] ?? { key: "done", label: "macros", value: 0, color: t.good };
  }, [proteinRemaining, carbsRemaining, fatRemaining, t.ringB, t.tint, t.warn, t.good]);

  const weekBars = useMemo(() => {
    const start = addDays(today, -6);
    const caloriesByDate: Record<string, number> = {};
    const proteinByDate: Record<string, number> = {};
    foodsRange.forEach((f) => {
      const d = f.date?.slice(0, 10);
      if (!d) return;
      caloriesByDate[d] = (caloriesByDate[d] || 0) + Number(f.calories || 0);
      proteinByDate[d] = (proteinByDate[d] || 0) + Number(f.protein || 0);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const date = ymd(addDays(start, i));
      const calories = caloriesByDate[date] || 0;
      const protein = proteinByDate[date] || 0;
      const hit =
        calories >= kcalGoal * 0.8 ||
        protein >= proteinGoal * 0.8 ||
        (date === todayStr && foodsToday.length > 0);
      return {
        date,
        calories,
        protein,
        hit,
        pct: clamp01(kcalGoal ? calories / kcalGoal : 0),
      };
    });
  }, [foodsRange, today, kcalGoal, proteinGoal, todayStr, foodsToday.length]);

  /* ───────────────── UI data mapping ───────────────── */
  const ringData = useMemo(
    () =>
      ([
        recoveryMetrics?.recoveryScore != null
          ? {
              label: "Recovery",
              value: recoveryMetrics.recoveryScore,
              goal: 100,
              unit: "%",
              tone:
                recoveryMetrics.recoveryScore >= 80
                  ? ("mint" as const)
                  : recoveryMetrics.recoveryScore >= 50
                  ? ("tint" as const)
                  : ("violet" as const),
              sublabel:
                recoveryMetrics.sourceName === "RingConn"
                  ? "Estimated from your RingConn data"
                  : recoveryMetrics.hrvMs != null
                  ? `HRV ${Math.round(recoveryMetrics.hrvMs)}ms`
                  : "Daily readiness",
              onPress: () => router.push("/profile/integrations"),
            }
          : null,
        {
          label: "Calories",
          value: totals.calories,
          goal: kcalGoal,
          unit: "kcal",
          tone: "tint" as const,
          sublabel: `${caloriesRemaining.toLocaleString()} left`,
          onPress: () => router.push("/(tabs)/nutrition"),
        },
        {
          label: "Protein",
          value: totals.protein,
          goal: proteinGoal,
          unit: "g",
          tone: "violet" as const,
          sublabel: `${proteinRemaining}g to goal`,
          onPress: () => router.push("/(tabs)/nutrition"),
        },
        {
          label: "Steps",
          value: stepsToday,
          goal: stepsGoal,
          unit: "",
          tone: "mint" as const,
          sublabel: `${Math.max(
            0,
            stepsGoal - stepsToday
          ).toLocaleString()} to go`,
          onPress: () => router.push("/(tabs)/workouts"),
        },
      ].filter(Boolean) as Array<{
        label: string;
        value: number;
        goal: number;
        unit: string;
        tone: "mint" | "tint" | "violet";
        sublabel: string;
        onPress: () => void;
      }>),
    [
      recoveryMetrics?.recoveryScore,
      recoveryMetrics?.hrvMs,
      totals.calories,
      totals.protein,
      kcalGoal,
      proteinGoal,
      caloriesRemaining,
      proteinRemaining,
      stepsToday,
      stepsGoal,
      router,
    ]
  );

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        key: "log-meal",
        label: "Log Meal",
        icon: toIoniconName("restaurant"),
        hint: "Open meal logging",
        onPress: () =>
          router.push(`/(modals)/add-meal?date=${todayStr}` as any),
        color: t.tint,
      },
      {
        key: "scan",
        label: "Scan",
        icon: toIoniconName("scan"),
        hint: "Scan a barcode",
        onPress: () =>
          router.push(`/(modals)/add-meal?date=${todayStr}&tab=scan` as any),
        color: "#FFD37C",
      },
      {
        key: "steps",
        label: "Add Steps",
        icon: toIoniconName("walk"),
        hint: "Manually add today’s steps",
        onPress: () => openStepsSheet("add"),
        color: t.good,
      },
      {
        key: "water",
        label: "Log Water",
        icon: toIoniconName("water"),
        hint: "Log hydration",
        onPress: () => router.push("/(modals)/quick-hydration" as any),
        color: "#4FD1FF",
      },
      {
        key: "workout",
        label: "Log Workout",
        icon: toIoniconName("barbell"),
        hint: "Log a workout",
        onPress: () => router.push("/(modals)/quick-workout" as any),
        color: "#A78BFA",
      },
      {
        key: "ai",
        label: "AI Coach",
        icon: toIoniconName("sparkles"),
        hint: "Get smart suggestions",
        onPress: () => router.push("/(tabs)/nutrition"),
        color: "#FF7CEB",
      },
    ],
    [router, todayStr, t.tint, t.good]
  );

  const aiSuggestions: AISuggestion[] = useMemo(() => {
    const mealCount = foodsToday.length;
    const hasWorkout = exerciseToday.length > 0 || activityEntries.length > 0;
    const stepsPct = stepsGoal ? stepsToday / stepsGoal : 0;
    const loggingDays = new Set(
      foodsRange.map((f) => f.date?.slice(0, 10)).filter(Boolean) as string[]
    ).size;

    const pool: Array<{ score: number; suggestion: AISuggestion }> = [];
    const addSuggestion = (score: number, suggestion: AISuggestion) => {
      if (!suggestion?.id) return;
      pool.push({ score, suggestion });
    };

    if (proteinRemaining >= 40) {
      addSuggestion(95, {
        id: "ai-protein-gap",
        title: "Protein priority",
        body: `You are ${proteinRemaining}g short. Anchor the next meal with 30-40g (shake, Greek yogurt, chicken wrap).`,
        pill: `${proteinRemaining}g to goal`,
        icon: toIoniconName("flash"),
        actionLabel: "Suggest meals",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (proteinRemaining >= 15 && proteinRemaining < 40) {
      addSuggestion(70, {
        id: "ai-protein-topup",
        title: "Protein top-up",
        body: `You are ${proteinRemaining}g away. A lean snack closes the gap without overshooting calories.`,
        pill: `${proteinRemaining}g to goal`,
        icon: toIoniconName("nutrition"),
        actionLabel: "Pick a snack",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (proteinRemaining <= 5 && totals.protein > 0) {
      addSuggestion(35, {
        id: "ai-protein-secure",
        title: "Protein secured",
        body: "Protein looks solid. Focus on fiber, veggies, and hydration to finish strong.",
        pill: "Goal reached",
        icon: toIoniconName("checkmark-circle"),
        actionLabel: "Balance the day",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }

    if (
      (recoveryMetrics?.recoveryScore || 0) > 0 &&
      (recoveryMetrics?.recoveryScore || 0) < 50
    ) {
      addSuggestion(99, {
        id: "ai-recovery-low",
        title: "Recovery is low today",
        body: `${recoveryMetrics?.sourceName || "Your wearable"} shows ${Math.round(
          recoveryMetrics?.recoveryScore || 0
        )}% recovery. Consider lighter movement and a strong protein-first day.`,
        pill: `${Math.round(recoveryMetrics?.recoveryScore || 0)}% recovery`,
        icon: toIoniconName("moon"),
        actionLabel: "View workout plan",
        onAction: () => router.push("/(tabs)/workouts"),
      });
    }

    if (caloriesPct < 0.55 && caloriesRemaining > 350) {
      addSuggestion(88, {
        id: "ai-calories-low",
        title: "Fuel up for your goal",
        body: `You are under target by ~${caloriesRemaining} kcal. Add a balanced meal to stay on track for ${goalLabel}.`,
        pill: `~${caloriesRemaining} kcal left`,
        icon: toIoniconName("flame"),
        actionLabel: "See ideas",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (caloriesRemaining > 0 && caloriesRemaining <= 350) {
      addSuggestion(65, {
        id: "ai-calories-tight",
        title: "Land the day",
        body: `You have about ${caloriesRemaining} kcal left. Keep it protein-forward with high volume.`,
        pill: `~${caloriesRemaining} kcal left`,
        icon: toIoniconName("leaf"),
        actionLabel: "Get options",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (caloriesOver >= 150) {
      addSuggestion(75, {
        id: "ai-calories-over",
        title: "Course-correct calories",
        body: `You are over by ~${caloriesOver} kcal. A 15-25 min walk or lighter dinner helps reset the trend.`,
        pill: `+${caloriesOver} kcal`,
        icon: toIoniconName("trending-down"),
        actionLabel: "Open activity",
        onAction: () => router.push("/(tabs)/workouts"),
      });
    }

    if (stepsPct < 0.5) {
      addSuggestion(80, {
        id: "ai-steps-low",
        title: "Steps sprint",
        body: `You are at ${Math.round(
          stepsPct * 100
        )}% of your step goal. A 10-15 min walk moves the needle fast.`,
        pill: `${Math.max(0, stepsGoal - stepsToday).toLocaleString()} to go`,
        icon: toIoniconName("walk"),
        actionLabel: "Add steps",
        onAction: () => openStepsSheet("add"),
      });
    }
    if (stepsGoal - stepsToday > 0 && stepsGoal - stepsToday <= 1500) {
      addSuggestion(60, {
        id: "ai-steps-close",
        title: "Close the steps loop",
        body: `Only ${Math.max(
          0,
          stepsGoal - stepsToday
        ).toLocaleString()} steps left. A quick loop finishes it.`,
        pill: "Almost there",
        icon: toIoniconName("walk"),
        actionLabel: "Log steps",
        onAction: () => openStepsSheet("add"),
      });
    }

    if (!hasWorkout) {
      addSuggestion(70, {
        id: "ai-workout-none",
        title: "Add a movement win",
        body: "No workout logged yet. A 20-30 min session or mobility block keeps momentum.",
        pill: "No workout yet",
        icon: toIoniconName("barbell"),
        actionLabel: "Start workout",
        onAction: () => router.push("/(modals)/quick-workout" as any),
      });
    } else {
      addSuggestion(40, {
        id: "ai-workout-done",
        title: "Recovery focus",
        body: `Logged activity today. Add protein + carbs and a short walk to support recovery.`,
        pill: "Workout logged",
        icon: toIoniconName("pulse"),
        actionLabel: "View activity",
        onAction: () => router.push("/(tabs)/workouts"),
      });
    }

    if (goalMode === "cut" && carbsRemaining >= 60) {
      addSuggestion(55, {
        id: "ai-carb-cut",
        title: "Carb timing",
        body: `You still have about ${carbsRemaining}g carbs. Use them around activity for better energy.`,
        pill: `${carbsRemaining}g carbs left`,
        icon: toIoniconName("timer"),
        actionLabel: "Plan meal",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (goalMode === "bulk" && carbsRemaining >= 60) {
      addSuggestion(60, {
        id: "ai-carb-bulk",
        title: "Carb-forward meal",
        body: `You are ${carbsRemaining}g shy on carbs. Add rice, oats, or fruit to support training.`,
        pill: `${carbsRemaining}g carbs left`,
        icon: toIoniconName("fitness"),
        actionLabel: "Build a meal",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }
    if (fatRemaining >= 20 && fatPct < 0.6) {
      addSuggestion(45, {
        id: "ai-fat-balance",
        title: "Balance fats",
        body: `You have about ${fatRemaining}g fats left. Add avocado, olive oil, or nuts.`,
        pill: `${fatRemaining}g fats left`,
        icon: toIoniconName("leaf"),
        actionLabel: "See ideas",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }

    if (hasWeightGoal) {
      const direction = weightDeltaKg < 0 ? "down" : "up";
      addSuggestion(85, {
        id: "ai-weight-target",
        title: "Target runway",
        body: `You are ${formatWeight(
          weightDeltaAbs
        )} ${direction} from your target. Keep your weekly habits aligned with ${goalLabel}.`,
        pill: `${formatWeight(weightDeltaAbs, 0)} to go`,
        icon: toIoniconName("trending-up"),
        actionLabel: "Review goals",
        onAction: () => router.push("/(tabs)/profile"),
      });
    }

    if (hasWeightGoal && daysToTarget && daysToTarget > 0) {
      const paceKg = weightDeltaAbs / (daysToTarget / 7);
      if (Number.isFinite(paceKg) && paceKg > 0) {
        addSuggestion(paceKg > 1.2 ? 90 : 50, {
          id: "ai-pace-check",
          title: "Pace check",
          body: `To hit your date, you need about ${formatWeight(
            paceKg
          )} per week. Adjust calories or activity if that feels steep.`,
          pill: `${daysToTarget} days left`,
          icon: toIoniconName("calendar"),
          actionLabel: "Tune plan",
          onAction: () => router.push("/(tabs)/profile"),
        });
      }
    }

    if (weeklyProteinHits <= 3 && proteinGoal > 0) {
      addSuggestion(50, {
        id: "ai-weekly-protein",
        title: "Weekly protein rhythm",
        body: `You are hitting protein ${weeklyProteinHits}/7 days. Aim for 5+ to keep progress steady.`,
        pill: `${weeklyProteinHits}/7 days`,
        icon: toIoniconName("calendar"),
        actionLabel: "View history",
        onAction: () => router.push("/(tabs)/nutrition"),
      });
    }

    if (streakDays >= 5) {
      addSuggestion(40, {
        id: "ai-streak",
        title: "Protect the streak",
        body: `You are on a ${streakDays}-day logging streak. One meal entry today keeps it alive.`,
        pill: `${streakDays} day streak`,
        icon: toIoniconName("trophy"),
        actionLabel: "Log meal",
        onAction: () =>
          router.push(`/(modals)/add-meal?date=${todayStr}` as any),
      });
    }

    addSuggestion(20, {
      id: "ai-consistency",
      title: "Consistency snapshot",
      body: `Protein hit rate: ${weeklyProteinHits}/7. Steps avg: ${stepsAvg.toLocaleString()}/day. Logs: ${mealCount} today.`,
      pill: `${loggingDays} days logged`,
      icon: toIoniconName("sparkles"),
      actionLabel: "View history",
      onAction: () => router.push("/(tabs)/nutrition"),
    });

    const ranked = pool.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.min(6, ranked.length));
    const rotation =
      top.length > 0 ? Number(todayStr.slice(-2)) % top.length : 0;
    const rotated = top.slice(rotation).concat(top.slice(0, rotation));
    return rotated.slice(0, 3).map((item) => item.suggestion);
  }, [
    proteinRemaining,
    caloriesRemaining,
    caloriesOver,
    carbsRemaining,
    fatRemaining,
    caloriesPct,
    fatPct,
    goalMode,
    goalLabel,
    recoveryMetrics?.recoveryScore,
    recoveryMetrics?.sourceName,
    weightKg,
    targetWeightKg,
    weightDeltaAbs,
    targetDate,
    daysToTarget,
    weightUnit,
    foodsToday.length,
    exerciseToday.length,
    activityEntries.length,
    burnToday,
    weeklyProteinHits,
    stepsAvg,
    streakDays,
    totals.protein,
    totals.calories,
    totals.carbs,
    totals.fat,
    stepsGoal,
    stepsToday,
    carbGoal,
    fatGoal,
    router,
    todayStr,
    foodsRange,
  ]);

  const todayFocus = useMemo(() => {
    if (proteinRemaining >= 15) {
      return `Priority today: hit protein goal (${proteinRemaining}g left)`;
    }
    if (stepsToday <= 0) return "Priority today: start moving with a 10 min walk";
    if (caloriesRemaining > 350) {
      return `Priority today: fuel the day (${caloriesRemaining} kcal left)`;
    }
    return aiSuggestions[0]?.title
      ? `Priority today: ${aiSuggestions[0].title.toLowerCase()}`
      : "Priority today: keep the streak alive";
  }, [aiSuggestions, proteinRemaining, stepsToday, caloriesRemaining]);

  const softShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: t.shadow,
          shadowOpacity: 1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 10 },
        default: {},
      }),
    [t.shadow]
  );

  const topPad = Math.max(12, insets.top - 6);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg0 }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* background wash */}
      <LinearGradient
        colors={lg(t.bg0, t.bg1)}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: Platform.OS === "ios" ? topPad + 44 : topPad + 26,
          paddingBottom: 44 + Math.max(insets.bottom, 16),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.card,
              padding: 20,
              gap: 16,
              ...softShadow,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: t.muted,
                    fontSize: 11,
                    fontWeight: "300",
                    letterSpacing: 0.6,
                  }}
                >
                  {formatDateLong(today).toUpperCase()}
                </Text>

                <Text
                  style={{
                    color: t.text,
                    fontSize: 36,
                    fontWeight: "200",
                    marginTop: 4,
                    letterSpacing: -1,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.88}
                  accessibilityRole="header"
                >
                  {getGreeting(now)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SyncIndicator
                  snapshot={integrations}
                  tokens={t}
                  onPress={() => setSyncSheetOpen(true)}
                />
                <Pressable
                  onPress={() => router.push("/(tabs)/profile")}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  hitSlop={12}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: t.card2,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="person-outline" size={20} color={t.muted} />
                  </View>
                </Pressable>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: withAlpha(t.tint, 0.3),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Ionicons name="flame-outline" size={14} color={t.tint} />
                <Text
                  style={{
                    color: t.tint,
                    fontWeight: "500",
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  {`${streakDays} DAY STREAK`}
                </Text>
              </View>

              <Text
                style={{
                  color: t.muted,
                  fontSize: 12,
                  fontWeight: "300",
                  flex: 1,
                  letterSpacing: 0.3,
                }}
              >
                Calm progress. One log at a time.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(modals)/badges",
                  params: { source: "home" },
                } as any)
              }
              accessibilityRole="button"
              accessibilityLabel="Open badges"
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.995 : 1 }],
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: t.tint,
                    fontWeight: "400",
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {unseenBadgeCount > 0
                    ? `${unseenBadgeCount} badges ready`
                    : `${unlockedBadgeCount} badges unlocked`}
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={withAlpha(t.tint, 0.8)}
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Today's focus */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <View
            style={{
              minHeight: 28,
              paddingHorizontal: 2,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="sparkles-outline" size={14} color={t.ringB} />
            <Text
              style={{
                color: t.ringB,
                fontWeight: "400",
                fontSize: 12,
                flex: 1,
                letterSpacing: 0.3,
              }}
              numberOfLines={1}
            >
              {todayFocus}
            </Text>
          </View>
        </View>

        {/* Rings */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: 16,
            marginTop: 14,
            justifyContent: "space-between",
          }}
        >
          {ringData.map((r) => (
            <View
              key={r.label}
              style={{ width: "48%", minWidth: 160 }}
            >
              <MetricRing
                tone={r.tone}
                label={r.label}
                value={r.value}
                goal={r.goal}
                unit={r.unit}
                sublabel={r.sublabel}
                reduceMotion={reduceMotion}
                tokens={t}
                style={softShadow as any}
                onPress={r.onPress}
                size={88}
                minHeight={160}
                valueFontSize={24}
              />
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
          <Text
            style={{
              color: t.muted,
              fontWeight: "500",
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            QUICK ACTIONS
          </Text>

          <QuickActionRow
            tokens={t as any}
            reduceMotion={reduceMotion}
            actions={quickActions}
            maxWidth={width}
          />
        </View>

        {/* Nutrition summary */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text
            style={{
              color: t.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            NUTRITION
          </Text>

          <LinearGradient
            colors={lg(withAlpha(t.card, 1), withAlpha(t.card2, 1))}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: t.hairline,
              ...softShadow,
            }}
          >
            <BlurView
              intensity={isDark ? 16 : 26}
              tint={isDark ? "dark" : "light"}
            >
              <View style={{ padding: 14, gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 14,
                        backgroundColor: withAlpha(
                          t.ringB,
                          isDark ? 0.18 : 0.14
                        ),
                        borderWidth: 1,
                        borderColor: withAlpha(t.ringB, isDark ? 0.3 : 0.22),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="nutrition" size={18} color={t.ringB} />
                    </View>

                    <View>
                      <Text
                        style={{
                          color: t.text,
                          fontWeight: "900",
                          fontSize: 16,
                          letterSpacing: -0.2,
                        }}
                      >
                        Today’s macros
                      </Text>
                      <Text
                        style={{
                          color: t.muted,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Real-time from your logged meals.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push("/(tabs)/nutrition")}
                    accessibilityRole="button"
                    accessibilityLabel="Open nutrition details"
                    hitSlop={10}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: withAlpha(t.tint, isDark ? 0.14 : 0.1),
                        borderWidth: 1,
                        borderColor: withAlpha(t.tint, isDark ? 0.22 : 0.16),
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: t.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        Details
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={t.text}
                      />
                    </View>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => router.push("/(tabs)/nutrition")}
                  accessibilityRole="button"
                  accessibilityLabel="Open nutrition fuel bar"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.995 : 1 }],
                  })}
                >
                  <View
                    style={{
                      borderRadius: 18,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: withAlpha(t.ringB, isDark ? 0.28 : 0.2),
                      backgroundColor: withAlpha(t.ringB, isDark ? 0.1 : 0.07),
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{ color: t.text, fontWeight: "900", fontSize: 18 }}
                      >
                        {Math.round(totals.calories).toLocaleString()} /{" "}
                        {Math.round(kcalGoal).toLocaleString()} kcal
                      </Text>
                      <Text
                        style={{
                          color: topMacroDeficit.color,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {topMacroDeficit.value > 0
                          ? `${topMacroDeficit.value}g ${topMacroDeficit.label} gap`
                          : "Macros on track"}
                      </Text>
                    </View>

                    <View
                      style={{
                        height: 12,
                        borderRadius: 999,
                        backgroundColor: withAlpha(t.muted, 0.14),
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: withAlpha(t.muted, 0.12),
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round(clamp01(caloriesPct) * 100)}%`,
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor: withAlpha(t.ringB, 0.9),
                        }}
                      />
                    </View>

                    <Text
                      style={{
                        color: t.muted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {caloriesOver > 0
                        ? `${caloriesOver.toLocaleString()} kcal over target`
                        : `${caloriesRemaining.toLocaleString()} kcal left today`}
                    </Text>
                  </View>
                </Pressable>

                <View style={{ alignItems: "flex-end" }}>
                  <Pressable
                    onPress={() =>
                      router.push(`/(modals)/add-meal?date=${todayStr}` as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Log meal"
                    hitSlop={10}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 16,
                        backgroundColor: withAlpha(
                          t.good,
                          isDark ? 0.16 : 0.12
                        ),
                        borderWidth: 1,
                        borderColor: withAlpha(t.good, isDark ? 0.24 : 0.18),
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons name="add" size={18} color={t.good} />
                      <Text
                        style={{
                          color: t.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        Meal
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </View>

        {/* Activity + Steps */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text
            style={{
              color: t.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            ACTIVITY
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1.25 }}>
              <AnimatedStepPill
                tokens={t as any}
                reduceMotion={reduceMotion}
                steps={stepsToday}
                goal={stepsGoal}
                moveMin={
                  exerciseToday.length
                    ? Math.min(180, 20 + exerciseToday.length * 10)
                    : 0
                } // simple proxy (you can wire real minutes if you store it)
                onPress={() => openStepsSheet("add")}
                style={softShadow as any}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Pressable
                onPress={() => {
                  setEditingActivity(null);
                  setActivitySheetOpen(true);
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }}
                accessibilityRole="button"
                accessibilityLabel="Open activity details"
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <LinearGradient
                  colors={lg(withAlpha(t.card, 1), withAlpha(t.card2, 1))}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: t.hairline,
                    height: 128,
                    ...softShadow,
                  }}
                >
                  <BlurView
                    intensity={isDark ? 16 : 26}
                    tint={isDark ? "dark" : "light"}
                  >
                    <View
                      style={{
                        padding: 14,
                        height: 128,
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={{
                            color: t.text,
                            fontWeight: "900",
                            fontSize: 14,
                          }}
                        >
                          Burn
                        </Text>
                        <Ionicons name="flame" size={16} color={t.warn} />
                      </View>

                      <View>
                        <Text
                          style={{
                            color: t.text,
                            fontWeight: "900",
                            fontSize: 24,
                            letterSpacing: -0.4,
                          }}
                        >
                          {Math.round(burnToday)} kcal
                        </Text>
                        <Text
                          style={{
                            color: t.muted,
                            fontWeight: "700",
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          {exerciseToday.length} workouts today
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: t.muted,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        Tap for activities →
                      </Text>
                    </View>
                  </BlurView>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
          {/* Cardio / Activity Logging Card
          <View style={{ marginTop: 12 }}>
            <ActivityCard
              entries={activityEntries}
              goal={{
                minutesPerDay: Number(
                  (profile as any)?.activityMinutesGoal ?? 30
                ),
              }}
              onCreate={handleCreateActivity}
              onUpdate={handleUpdateActivity}
              onDelete={handleDeleteActivity}
              title="Movement"
              subtitle="Optional • small adds count"
              presets={[
                {
                  type: "walk",
                  minutes: 10,
                  intensity: "easy",
                  label: "Walk 10",
                },
                {
                  type: "run",
                  minutes: 20,
                  intensity: "moderate",
                  label: "Run 20",
                },
                {
                  type: "bike",
                  minutes: 20,
                  intensity: "moderate",
                  label: "Bike 20",
                },
                {
                  type: "stretch",
                  minutes: 10,
                  intensity: "easy",
                  label: "Stretch 10",
                },
              ]}
            />
          </View> */}
        </View>

        {/* AI Coach */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text
            style={{
              color: t.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            AI COACH
          </Text>

          <View style={{ gap: 12 }}>
            {aiSuggestions.slice(0, 3).map((s, i) => (
              <MotiView
                key={s.id}
                from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
                animate={
                  reduceMotion ? undefined : { opacity: 1, translateY: 0 }
                }
                transition={{
                  type: "timing",
                  duration: 420,
                  delay: 70 + i * 60,
                }}
              >
	                <AISuggestionCard
	                  tokens={t as any}
	                  reduceMotion={reduceMotion}
	                  suggestion={s}
	                  priority={i === 0 ? "urgent" : "secondary"}
	                  style={softShadow as any}
	                />
              </MotiView>
            ))}
          </View>
        </View>

        {/* This week mini */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text
            style={{
              color: t.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            THIS WEEK
          </Text>

          <LinearGradient
            colors={lg(withAlpha(t.card, 1), withAlpha(t.card2, 1))}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: t.hairline,
              ...softShadow,
            }}
          >
            <BlurView
              intensity={isDark ? 16 : 26}
              tint={isDark ? "dark" : "light"}
            >
              <View style={{ padding: 14, gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: t.text, fontWeight: "900", fontSize: 16 }}
                  >
                    Consistency snapshot
                  </Text>
                  <Ionicons name="stats-chart" size={18} color={t.muted} />
                </View>

	                <View
	                  style={{
	                    borderRadius: 18,
	                    borderWidth: 1,
	                    borderColor: t.hairline,
	                    backgroundColor: withAlpha(isDark ? "#FFFFFF" : "#0B1020", isDark ? 0.05 : 0.035),
	                    padding: 12,
	                    gap: 10,
	                  }}
	                >
	                  <View
	                    style={{
	                      height: 74,
	                      flexDirection: "row",
	                      alignItems: "flex-end",
	                      justifyContent: "space-between",
	                      gap: 8,
	                    }}
	                  >
	                    {weekBars.map((d) => {
	                      const day = new Date(d.date + "T12:00:00");
	                      const todayHit = d.date === todayStr;
	                      return (
	                        <View
	                          key={d.date}
	                          style={{
	                            flex: 1,
	                            alignItems: "center",
	                            gap: 6,
	                          }}
	                        >
	                          <View
	                            style={{
	                              width: "100%",
	                              height: 48,
	                              borderRadius: 10,
	                              justifyContent: "flex-end",
	                              backgroundColor: withAlpha(t.muted, 0.1),
	                              overflow: "hidden",
	                              borderWidth: todayHit ? 1 : 0,
	                              borderColor: withAlpha(t.ringB, 0.55),
	                            }}
	                          >
	                            <View
	                              style={{
	                                height: `${Math.max(10, Math.round(d.pct * 100))}%`,
	                                borderRadius: 9,
	                                backgroundColor: todayHit
	                                  ? withAlpha(t.ringB, 0.95)
	                                  : d.hit
	                                  ? withAlpha(t.good, 0.9)
	                                  : withAlpha(t.bad, 0.82),
	                              }}
	                            />
	                          </View>
	                          <Text
	                            style={{
	                              color: todayHit ? t.text : t.muted,
	                              fontWeight: "900",
	                              fontSize: 10,
	                            }}
	                          >
	                            {day.toLocaleDateString(undefined, { weekday: "narrow" })}
	                          </Text>
	                        </View>
	                      );
	                    })}
	                  </View>
	                  <View
	                    style={{
	                      flexDirection: "row",
	                      justifyContent: "space-between",
	                      gap: 10,
	                    }}
	                  >
	                    <Text style={{ color: t.muted, fontWeight: "800", fontSize: 12 }}>
	                      Green = goals hit • Red = missed
	                    </Text>
	                    <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>
	                      {weeklyProteinHits}/7 protein
	                    </Text>
	                  </View>
	                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
      <ActivityLogSheet
        visible={activitySheetOpen}
        onClose={() => {
          setActivitySheetOpen(false);
          setEditingActivity(null);
        }}
        editing={editingActivity}
        onCreate={handleCreateActivity}
        onUpdate={handleUpdateActivity}
        onDelete={handleDeleteActivity}
        goal={{
          minutesPerDay: Number((profile as any)?.activityMinutesGoal ?? 30),
        }}
        presets={[
          { type: "walk", minutes: 10, intensity: "easy", label: "Walk 10" },
          { type: "run", minutes: 20, intensity: "moderate", label: "Run 20" },
          {
            type: "bike",
            minutes: 20,
            intensity: "moderate",
            label: "Bike 20",
          },
          {
            type: "stretch",
            minutes: 10,
            intensity: "easy",
            label: "Stretch 10",
          },
        ]}
      />

      <SyncStatusSheet
        visible={syncSheetOpen}
        snapshot={integrations}
        tokens={t}
        onClose={() => setSyncSheetOpen(false)}
      />

      {/* Steps bottom sheet */}
      {stepsSheetOpen ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 50,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => setStepsSheetOpen(false)}
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <LinearGradient
              colors={lg(withAlpha(t.card, 1), withAlpha(t.card2, 1))}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderWidth: 1,
                borderColor: t.hairline,
                overflow: "hidden",
                paddingBottom: Math.max(insets.bottom, 12),
              }}
            >
              <BlurView
                intensity={isDark ? 18 : 28}
                tint={isDark ? "dark" : "light"}
              >
                <View style={{ padding: 16, gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 14,
                          backgroundColor: withAlpha(
                            t.good,
                            isDark ? 0.16 : 0.12
                          ),
                          borderWidth: 1,
                          borderColor: withAlpha(t.good, isDark ? 0.24 : 0.18),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="walk" size={18} color={t.good} />
                      </View>
                      <View>
                        <Text
                          style={{
                            color: t.text,
                            fontWeight: "900",
                            fontSize: 16,
                          }}
                        >
                          {stepsMode === "add" ? "Add steps" : "Set steps"}
                        </Text>
                        <Text
                          style={{
                            color: t.muted,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          Today: {stepsToday.toLocaleString()} /{" "}
                          {stepsGoal.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => setStepsSheetOpen(false)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Close steps editor"
                    >
                      <Ionicons name="close" size={22} color={t.muted} />
                    </Pressable>
                  </View>

                  {/* mode toggle */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setStepsMode("add")}
                      accessibilityRole="button"
                      accessibilityLabel="Add mode"
                      style={({ pressed }) => ({
                        flex: 1,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View
                        style={{
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor:
                            stepsMode === "add"
                              ? withAlpha(t.good, 0.35)
                              : t.hairline,
                          backgroundColor:
                            stepsMode === "add"
                              ? withAlpha(t.good, isDark ? 0.14 : 0.1)
                              : withAlpha(t.card, 0.6),
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: t.text, fontWeight: "900" }}>
                          Add
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => setStepsMode("set")}
                      accessibilityRole="button"
                      accessibilityLabel="Set mode"
                      style={({ pressed }) => ({
                        flex: 1,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View
                        style={{
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor:
                            stepsMode === "set"
                              ? withAlpha(t.tint, 0.35)
                              : t.hairline,
                          backgroundColor:
                            stepsMode === "set"
                              ? withAlpha(t.tint, isDark ? 0.14 : 0.1)
                              : withAlpha(t.card, 0.6),
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: t.text, fontWeight: "900" }}>
                          Set
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* input */}
                  <View
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      backgroundColor: withAlpha(t.card, 0.75),
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: t.muted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {stepsMode === "add"
                        ? "How many steps to add?"
                        : "Set today’s steps to:"}
                    </Text>

                    <TextInput
                      value={stepsInput}
                      onChangeText={setStepsInput}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={withAlpha(t.muted, 0.65)}
                      style={{
                        color: t.text,
                        fontWeight: "900",
                        fontSize: 28,
                        marginTop: 6,
                      }}
                      accessibilityLabel="Steps input"
                      accessibilityHint="Enter a number of steps"
                    />
                  </View>

                  {/* quick chips */}
                  <View
                    style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}
                  >
                    {[500, 1000, 2000, 3000].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setStepsInput(String(n))}
                        accessibilityRole="button"
                        accessibilityLabel={`Set steps input to ${n}`}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: withAlpha(
                              t.good,
                              isDark ? 0.22 : 0.18
                            ),
                            backgroundColor: withAlpha(
                              t.good,
                              isDark ? 0.12 : 0.1
                            ),
                          }}
                        >
                          <Text style={{ color: t.text, fontWeight: "900" }}>
                            +{n.toLocaleString()}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {/* save */}
                  <Pressable
                    onPress={saveSteps}
                    disabled={!canEditSteps}
                    accessibilityRole="button"
                    accessibilityLabel="Save steps"
                    accessibilityHint="Saves your step entry"
                    style={({ pressed }) => ({
                      opacity: !canEditSteps ? 0.5 : pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        marginTop: 2,
                        paddingVertical: 14,
                        borderRadius: 16,
                        alignItems: "center",
                        backgroundColor: withAlpha(
                          t.good,
                          isDark ? 0.22 : 0.18
                        ),
                        borderWidth: 1,
                        borderColor: withAlpha(t.good, isDark ? 0.35 : 0.25),
                      }}
                    >
                      <Text
                        style={{
                          color: t.text,
                          fontWeight: "900",
                          fontSize: 14,
                        }}
                      >
                        Save
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </BlurView>
            </LinearGradient>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}

function SyncIndicator({
  snapshot,
  tokens,
  onPress,
}: {
  snapshot: IntegrationSnapshot | null;
  tokens: HomeTokens;
  onPress: () => void;
}) {
  const health = snapshot ? syncHealth(snapshot) : "none";
  if (health !== "error") return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open sync status"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: withAlpha("#FFFFFF", 0.08),
          borderWidth: 1,
          borderColor: tokens.hairline,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="sync-outline" size={20} color={tokens.text} />
        <MotiView
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 200 }}
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: tokens.bad,
          }}
        />
      </View>
    </Pressable>
  );
}

function SyncStatusSheet({
  visible,
  snapshot,
  tokens,
  onClose,
}: {
  visible: boolean;
  snapshot: IntegrationSnapshot | null;
  tokens: HomeTokens;
  onClose: () => void;
}) {
  const connected = snapshot
    ? Object.values(snapshot.connections).filter((c) => c.connected)
    : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: withAlpha("#10131F", 0.98),
            borderWidth: 1,
            borderColor: tokens.hairline,
            padding: 18,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: tokens.text, fontWeight: "900", fontSize: 20, flex: 1 }}>
              Sync status
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={tokens.text} />
            </Pressable>
          </View>
          {connected.length ? (
            connected.map((c) => {
              const def = INTEGRATIONS.find((x) => x.id === c.id);
              const color = c.status === "error" ? tokens.bad : c.status === "syncing" ? tokens.good : tokens.muted;
              return (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
                  <Text style={{ color: tokens.text, fontWeight: "900", flex: 1 }}>
                    {def?.name || c.id}
                  </Text>
                  <Text style={{ color: tokens.muted, fontWeight: "800" }}>
                    {formatLastSync(c.lastSyncedAt)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={{ color: tokens.muted, fontWeight: "800", lineHeight: 18 }}>
              No integrations connected. Open Profile → Integrations to connect a health app.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
