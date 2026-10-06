import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import { nutritionTargets } from "@/services/nutritionTargets";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useReducedMotion } from "react-native-reanimated";
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/content/AuthContext";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import {
  subscribeFoodsBetween,
  subscribeExerciseBetween,
  type ExerciseEntry,
  type FoodEntry,
} from "@/services/nutrition";
import { subscribeActivityBetween, type ActivityEntry } from "@/services/activity";
import { subscribeProfile, type Profile } from "@/services/profile";
import {
  loadBodyMetricsHistory,
  type BodyMetricPoint,
} from "@/services/profile/bodyMetrics";
import { BADGE_BY_ID, BADGES } from "@/services/badges/registry";
import { loadUnlocksLocal } from "@/services/badges/store";
import type { UnlockMap } from "@/services/badges/types";

type RangeKey = 7 | 30 | 90;
type ChartKind = "calories" | "protein" | "weight";
type DayRow = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  workouts: number;
  burn: number;
  steps: number;
};

function useC() {
  const { colors, isDark } = useProfileFlowTheme();
  return {
    bg: colors.background,
    card: colors.surface1,
    card2: colors.surface2,
    text: colors.textPrimary,
    muted: colors.textTertiary,
    hairline: colors.border,
    purple: colors.primary as string,
    blue: isDark ? "#B9A4FA" : "#7051B5",
    teal: colors.accent as string,
    green: colors.success as string,
    amber: colors.warning as string,
    red: colors.danger as string,
    gray: colors.surface3,
    whiteSoft: colors.textPrimary,
  };
}

const RANGE_OPTIONS: RangeKey[] = [7, 30, 90];
const W = 320;
const H = 156;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtShort(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function rangeLabel(days: DayRow[]) {
  if (!days.length) return "";
  return `${fmtShort(days[0].date)}-${fmtShort(days[days.length - 1].date)}`;
}

function rangeSubtitle(range: RangeKey, days: DayRow[]) {
  if (!days.length) return "";
  if (range === 7) return `Week of ${rangeLabel(days)}`;
  if (range === 30) return `Month of ${rangeLabel(days)}`;
  const start = new Date(`${days[0].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
  const end = new Date(`${days[days.length - 1].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
  return `Last 90 days · ${start}-${end}`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function withAlpha(hex: string, a: number) {
  if (!hex.startsWith("#")) return hex;
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
}

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function sum(rows: number[]) {
  return rows.reduce((s, x) => s + x, 0);
}

function avg(rows: number[]) {
  return rows.length ? sum(rows) / rows.length : 0;
}

function groupFoods(foods: FoodEntry[]) {
  const map: Record<string, DayRow> = {};
  for (const f of foods) {
    const d = String(f.date || "").slice(0, 10);
    if (!d) continue;
    map[d] ||= blankDay(d);
    map[d].calories += n(f.calories);
    map[d].protein += n(f.protein);
    map[d].carbs += n(f.carbs);
    map[d].fat += n(f.fat);
  }
  return map;
}

function blankDay(date: string): DayRow {
  return {
    date,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    waterMl: 0,
    workouts: 0,
    burn: 0,
    steps: 0,
  };
}

function dayScore(day: DayRow, goals: Goals) {
  const parts = [
    goals.calories ? day.calories / goals.calories : 0,
    goals.protein ? day.protein / goals.protein : 0,
    goals.waterMl ? day.waterMl / goals.waterMl : 0,
  ];
  if (day.workouts > 0) parts.push(1);
  return Math.max(...parts.map(clamp01));
}

function reportTone(hit: number, total: number, C: ReturnType<typeof useC>) {
  const pct = total ? hit / total : 0;
  if (pct >= 0.7) return C.green;
  if (pct >= 0.4) return C.amber;
  return C.red;
}

function hasLogged(day: DayRow) {
  return day.calories + day.protein + day.waterMl + day.workouts + day.steps > 0;
}

function priorProteinLine(current: number, prior: number, delta: number) {
  if (!Number.isFinite(prior) || prior < 10) return `Protein average ${current}g/day.`;
  if (Math.abs(delta) < 5) return `Protein held near prior period at ~${current}g avg.`;
  if (delta > 0) return `Protein improved to ${current}g/day. Up from ~${Math.round(prior)}g avg in prior period.`;
  return `Protein averaged ${current}g/day. Down from ~${Math.round(prior)}g avg in prior period.`;
}

function dayName(short: string) {
  return (
    {
      Mon: "Mondays",
      Tue: "Tuesdays",
      Wed: "Wednesdays",
      Thu: "Thursdays",
      Fri: "Fridays",
      Sat: "Saturdays",
      Sun: "Sundays",
    } as Record<string, string>
  )[short] || short;
}

function pathFor(values: number[], width: number, height: number, pad = 14) {
  if (!values.length) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(1, max - min);
  return values
    .map((v, i) => {
      const x =
        pad + (values.length === 1 ? 0 : (i / (values.length - 1)) * (width - pad * 2));
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function pointFor(values: number[], i: number, width: number, height: number, pad = 14) {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(1, max - min);
  return {
    x: pad + (values.length === 1 ? 0 : (i / (values.length - 1)) * (width - pad * 2)),
    y: height - pad - ((values[i] - min) / span) * (height - pad * 2),
  };
}

function areaFor(values: number[], width: number, height: number, pad = 14) {
  const p = pathFor(values, width, height, pad);
  if (!p) return "";
  return `${p} L${width - pad},${height - pad} L${pad},${height - pad} Z`;
}

function regression(values: number[]) {
  if (values.length < 2) return values;
  const xs = values.map((_, i) => i);
  const xAvg = avg(xs);
  const yAvg = avg(values);
  const denom = sum(xs.map((x) => Math.pow(x - xAvg, 2))) || 1;
  const slope = sum(xs.map((x, i) => (x - xAvg) * (values[i] - yAvg))) / denom;
  const intercept = yAvg - slope * xAvg;
  return xs.map((x) => intercept + slope * x);
}

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
};

export default function InsightsProgressScreen() {
  const C = useC();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [range, setRange] = useState<RangeKey>(7);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [waterByDay, setWaterByDay] = useState<Record<string, number>>({});
  const [bodyHistory, setBodyHistory] = useState<BodyMetricPoint[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockMap>({});
  const [expanded, setExpanded] = useState<ChartKind | null>(null);
  const [openRows, setOpenRows] = useState<Record<ChartKind, boolean>>({
    calories: false,
    protein: false,
    weight: false,
  });
  const [dowMode, setDowMode] = useState<"calories" | "protein">("calories");
  const [badgeId, setBadgeId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const allDates = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ymd(addDays(today, i - 89))),
    [today]
  );
  const from90 = allDates[0];
  const toToday = allDates[allDates.length - 1];

  useEffect(() => {
    if (!user?.uid) return;
    const unsubs = [
      subscribeProfile(user.uid, setProfile),
      subscribeFoodsBetween(user.uid, from90, toToday, setFoods),
      subscribeExerciseBetween(user.uid, from90, toToday, setExercises),
      subscribeActivityBetween(user.uid, from90, toToday, setActivities),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [from90, toToday, user?.uid]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await Promise.all(
        allDates.map(async (d) => {
          const stored = await AsyncStorage.getItem(`@water:${d}`);
          return [d, Math.max(0, Number(stored || 0) || 0)] as const;
        })
      );
      const quickRaw = user?.uid
        ? await AsyncStorage.getItem(`hydration:quickLogs:${user.uid}`)
        : null;
      const quickLogs = quickRaw ? JSON.parse(quickRaw) : [];
      const quickMap: Record<string, number> = {};
      if (Array.isArray(quickLogs)) {
        quickLogs.forEach((x) => {
          const d = ymd(new Date(Number(x?.ts || 0)));
          quickMap[d] = (quickMap[d] || 0) + n(x?.ml);
        });
      }
      if (mounted) {
        setWaterByDay(
          Object.fromEntries(entries.map(([d, ml]) => [d, ml + (quickMap[d] || 0)]))
        );
      }
    })().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [allDates, user?.uid]);

  useEffect(() => {
    loadBodyMetricsHistory().then(setBodyHistory).catch(() => setBodyHistory([]));
    loadUnlocksLocal().then((x) => setUnlocks(x || {})).catch(() => setUnlocks({}));
  }, []);

  const goals: Goals = useMemo(
    () => ({
      ...nutritionTargets(profile, { calories: 2400, protein: 160, carbs: 260, fat: 80 }),
      waterMl: n((profile as any)?.waterGoalMl ?? 2400),
    }),
    [profile]
  );

  const allRows = useMemo(() => {
    const foodMap = groupFoods(foods);
    const workoutMap: Record<string, number> = {};
    const burnMap: Record<string, number> = {};
    exercises.forEach((e) => {
      const d = String(e.date || "").slice(0, 10);
      if (!d) return;
      workoutMap[d] = (workoutMap[d] || 0) + 1;
      burnMap[d] = (burnMap[d] || 0) + n(e.calories);
    });
    activities.forEach((a) => {
      const d = ymd(new Date(n(a.timestamp)));
      workoutMap[d] = (workoutMap[d] || 0) + 1;
      burnMap[d] = (burnMap[d] || 0) + n(a.calories);
    });
    const steps = (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    return allDates.map((date) => ({
      ...blankDay(date),
      ...(foodMap[date] || {}),
      waterMl: waterByDay[date] || 0,
      workouts: workoutMap[date] || 0,
      burn: burnMap[date] || 0,
      steps: n(steps[date]),
    }));
  }, [activities, allDates, exercises, foods, profile, waterByDay]);

  const rows = useMemo(() => allRows.slice(-range), [allRows, range]);
  const rangeTitle = useMemo(() => rangeSubtitle(range, rows), [range, rows]);
  const totalDays = rows.length || range;
  const calorieHits = rows.filter((d) => goals.calories && d.calories >= goals.calories * 0.9).length;
  const proteinHits = rows.filter((d) => goals.protein && d.protein >= goals.protein * 0.9).length;
  const hydrationHits = rows.filter((d) => goals.waterMl && d.waterMl >= goals.waterMl).length;
  const workoutSessions = sum(rows.map((d) => d.workouts));
  const caloriesTracked = rows.some((d) => d.calories > 0);
  const proteinTracked = rows.some((d) => d.protein > 0);
  const hydrationTracked = rows.some((d) => d.waterMl > 0);
  const workoutsTracked = rows.some((d) => d.workouts > 0);

  const heat = useMemo(() => {
    let current = 0;
    let best = 0;
    allRows.forEach((d) => {
      if (dayScore(d, goals) >= 0.9) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    });
    return { current, best };
  }, [allRows, goals]);

  const weights = useMemo(() => {
    const minTs = addDays(today, -range + 1).getTime();
    return bodyHistory
      .filter((p) => p.t >= minTs && typeof p.weightLb === "number")
      .map((p) => ({ date: ymd(new Date(p.t)), value: Number(p.weightLb) }));
  }, [bodyHistory, range, today]);

  const avgCalories = Math.round(avg(rows.map((d) => d.calories)));
  const avgProtein = Math.round(avg(rows.map((d) => d.protein)));
  const avgCarbs = Math.round(avg(rows.map((d) => d.carbs)));
  const avgFat = Math.round(avg(rows.map((d) => d.fat)));

  const dow = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const vals = rows.filter((r) => new Date(`${r.date}T12:00:00`).getDay() === (i + 1) % 7);
      const value = avg(vals.map((v) => (dowMode === "calories" ? v.calories : v.protein)));
      const goal = dowMode === "calories" ? goals.calories : goals.protein;
      return {
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        value,
        pct: clamp01(goal ? value / goal : 0),
      };
    });
  }, [dowMode, goals.calories, goals.protein, rows]);

  const pb = useMemo(() => {
    const highestProtein = [...allRows].sort((a, b) => b.protein - a.protein)[0];
    const bestBurn = [...allRows].sort((a, b) => b.burn - a.burn)[0];
    const bestSteps = [...allRows].sort((a, b) => b.steps - a.steps)[0];
    return [
      {
        icon: "trophy-outline",
        title: "Highest protein",
        value: `${Math.round(highestProtein?.protein || 0)}g`,
        valueNum: highestProtein?.protein || 0,
        date: highestProtein?.date ? fmtShort(highestProtein.date) : "No data",
        color: C.purple,
      },
      {
        icon: "flame-outline",
        title: "Longest streak",
        value: `${heat.best} days`,
        valueNum: heat.best,
        date: "Best run",
        color: C.amber,
      },
      {
        icon: "flash-outline",
        title: "Most burned",
        value: `${Math.round(bestBurn?.burn || 0)} kcal`,
        valueNum: bestBurn?.burn || 0,
        date: bestBurn?.date ? fmtShort(bestBurn.date) : "No data",
        color: C.green,
      },
      {
        icon: "walk-outline",
        title: "Most steps",
        value: `${Math.round(bestSteps?.steps || 0).toLocaleString()}`,
        valueNum: bestSteps?.steps || 0,
        date: bestSteps?.date ? fmtShort(bestSteps.date) : "No data",
        color: C.teal,
      },
    ].filter((x) => x.valueNum > 0);
  }, [allRows, heat.best]);

  const dowInsight = useMemo(() => {
    const sorted = [...dow].sort((a, b) => a.pct - b.pct);
    const weakest = sorted.filter((d) => d.pct <= (sorted[0]?.pct ?? 0) + 0.05).slice(0, 2);
    const names = weakest.map((d) => dayName(d.label));
    const label = names.length > 1 ? `${names[0]} and ${names[1]}` : names[0] || "Some days";
    if (dowMode === "calories") {
      return `${label} ${names.length > 1 ? "are" : "is"} your lowest calorie days — plan one reliable default meal.`;
    }
    return `${label} ${names.length > 1 ? "are" : "is"} your lowest protein days — consider prepping an anchor snack the night before.`;
  }, [dow, dowMode]);

  const unlockedBadges = useMemo(
    () => BADGES.filter((b) => (!b.hiddenUntilUnlocked || unlocks[b.id]) && !!unlocks[b.id]),
    [unlocks]
  );
  const lockedBadges = useMemo(
    () => BADGES.filter((b) => !unlocks[b.id] && !b.hiddenUntilUnlocked).slice(0, 9),
    [unlocks]
  );

  const aiSummary = useMemo(() => {
    const weekend = rows.filter((r) => [0, 6].includes(new Date(`${r.date}T12:00:00`).getDay()));
    const weekendProtein = weekend.length ? weekend.filter((r) => r.protein >= goals.protein * 0.9).length : 0;
    if (proteinHits < Math.ceil(totalDays * 0.55)) {
      return `You hit protein ${proteinHits}/${totalDays} days. Weekends are your biggest gap - prep one high-protein option.`;
    }
    if (hydrationHits < Math.ceil(totalDays * 0.5)) {
      return `Hydration is lagging at ${hydrationHits}/${totalDays} days. A morning bottle would stabilize the week.`;
    }
    if (weekend.length && weekendProtein < weekend.length / 2) {
      return `Weekends pull protein down. Plan one easy anchor meal before Saturday.`;
    }
    return `Strong range: ${calorieHits}/${totalDays} calorie days and ${proteinHits}/${totalDays} protein days on target.`;
  }, [calorieHits, goals.protein, hydrationHits, proteinHits, rows, totalDays]);

  const weeklyBullets = useMemo(() => {
    const lastAvgProtein = avg(allRows.slice(-range * 2, -range).map((d) => d.protein));
    const proteinDelta = avgProtein - lastAvgProtein;
    const missedWater = totalDays - hydrationHits;
    const bullets = [
      `${calorieHits >= Math.ceil(totalDays * 0.7) ? "Hit" : "Missed"} calorie goal ${calorieHits}/${totalDays} days.`,
      priorProteinLine(avgProtein, lastAvgProtein, proteinDelta),
      !hydrationTracked
        ? "Hydration hasn't been logged yet — one glass a day is a strong start."
        : missedWater > 0
        ? `Hydration logged ${hydrationHits}/${totalDays} days — one glass early helps build rhythm.`
        : "Hydration hit every logged day.",
      heat.current ? `Current streak is ${heat.current} days.` : "Start a new streak with one tracked day.",
    ];
    return bullets.filter(Boolean);
  }, [allRows, avgProtein, calorieHits, heat.current, hydrationHits, hydrationTracked, range, totalDays]);

  const expandedValues =
    expanded === "protein"
      ? rows.map((d) => d.protein)
      : expanded === "weight"
      ? weights.map((d) => d.value)
      : rows.map((d) => d.calories);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlowAtmosphere />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 42,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header
          range={range}
          setRange={setRange}
          titleRange={rangeTitle}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
        />

        <AnimatedIn delay={20}>
          <InfoCard icon="sparkles" text={aiSummary} />
        </AnimatedIn>

        <Section title="Weekly Report Card">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ReportTile label="Calories" value={`${calorieHits}/${totalDays}`} sub="days on goal" color={caloriesTracked ? reportTone(calorieHits, totalDays, C) : C.muted} neutral={!caloriesTracked} />
            <ReportTile label="Protein" value={`${proteinHits}/${totalDays}`} sub="days hit" color={proteinTracked ? reportTone(proteinHits, totalDays, C) : C.muted} neutral={!proteinTracked} />
            <ReportTile label="Hydration" value={hydrationTracked ? `${hydrationHits}/${totalDays}` : "—"} sub={hydrationTracked ? "days hit" : "Not tracked"} color={hydrationTracked ? reportTone(hydrationHits, totalDays, C) : C.muted} neutral={!hydrationTracked} />
            <ReportTile label="Workouts" value={workoutsTracked ? `${workoutSessions}` : "—"} sub={workoutsTracked ? "sessions logged" : "Not tracked"} color={workoutsTracked ? (workoutSessions >= 3 ? C.green : C.amber) : C.muted} neutral={!workoutsTracked} />
          </View>
        </Section>

        <Section title="Consistency Heatmap">
          <Heatmap rows={allRows} goals={goals} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <StreakPill streak={heat.current} />
            <Pill text={`Best streak: ${heat.best} days`} color={C.purple} />
          </View>
        </Section>

        <Section title="Trend Charts">
          <ChartRow
            title="Calories trend"
            color={C.blue}
            values={rows.map((d) => d.calories)}
            goal={goals.calories}
            open={openRows.calories}
            onToggle={() => setOpenRows((p) => ({ ...p, calories: !p.calories }))}
            onExpand={() => setExpanded("calories")}
            kind="calories"
          />
          <ChartRow
            title="Protein trend"
            color={C.purple}
            values={rows.map((d) => d.protein)}
            goal={goals.protein}
            open={openRows.protein}
            onToggle={() => setOpenRows((p) => ({ ...p, protein: !p.protein }))}
            onExpand={() => setExpanded("protein")}
            kind="protein"
          />
          {weights.length ? (
            <ChartRow
              title="Weight trend"
              color={C.green}
              values={weights.map((d) => d.value)}
              open={openRows.weight}
              onToggle={() => setOpenRows((p) => ({ ...p, weight: !p.weight }))}
              onExpand={() => setExpanded("weight")}
              kind="weight"
              footer={
                <Pill
                  text={`${weights[weights.length - 1].value - weights[0].value < 0 ? "Down" : "Up"} ${Math.abs(
                    Math.round((weights[weights.length - 1].value - weights[0].value) * 10) / 10
                  )} lbs in ${range} days`}
                  color={C.green}
                />
              }
            />
          ) : (
            <EmptyCard
              title="Log your weight to see trends"
              cta="+ Log Weight"
              onPress={() => router.push("/(modals)/body-metrics")}
            />
          )}
        </Section>

        <Section title="Day-Of-Week Breakdown">
          <Segment value={dowMode} onChange={setDowMode} />
          <DowBars rows={dow} mode={dowMode} />
          <InfoLine
            text={dowInsight}
          />
        </Section>

        <Section title="Nutrition Breakdown">
          <MacroDonut
            protein={avgProtein}
            carbs={avgCarbs}
            fat={avgFat}
            calories={avgCalories}
          />
          <View style={{ gap: 8 }}>
            <MacroGoalPill label="Protein" avg={avgProtein} goal={goals.protein} color={C.purple} />
            <MacroGoalPill label="Carbs" avg={avgCarbs} goal={goals.carbs} color={C.teal} />
            <MacroGoalPill label="Fat" avg={avgFat} goal={goals.fat} color={C.amber} />
            {goals.protein && avgProtein < goals.protein * 0.9 ? (
              <Pill
                text={`⚠ Protein consistently ${Math.round((1 - avgProtein / goals.protein) * 100)}% below goal`}
                color={C.amber}
              />
            ) : null}
          </View>
        </Section>

        <Section title="Personal Bests & Badges">
          {pb.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 10 }}>
              {pb.map((x) => (
                <RecordCard key={x.title} {...x} />
              ))}
            </ScrollView>
          ) : (
            <EmptyCard title="No records yet" cta="Log data" />
          )}
          <Text style={{ color: C.muted, fontWeight: "600", marginTop: 12 }}>
            {unlockedBadges.length} earned · {lockedBadges.length} to go
          </Text>
          {unlockedBadges.length ? (
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 12, marginTop: 4 }}>Earned</Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {unlockedBadges.slice(0, 9).map((b) => (
              <BadgeCell
                key={b.id}
                badge={b}
                unlocked
                onPress={() => setBadgeId(b.id)}
              />
            ))}
          </View>
          <Text style={{ color: C.muted, fontWeight: "600", fontSize: 12, marginTop: 10 }}>Locked</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {lockedBadges.map((b) => (
              <BadgeCell
                key={b.id}
                badge={b}
                unlocked={false}
                onPress={() => setBadgeId(b.id)}
              />
            ))}
          </View>
        </Section>

        <Section title="AI Weekly Summary">
          <View
            style={{
              borderRadius: 18,
              borderWidth: 0,
              borderColor: withAlpha(C.purple, 0.6),
              backgroundColor: withAlpha(C.purple, 0.14),
              padding: 16,
              gap: 12,
            }}
          >
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 18 }}>
              ✦ Your week in review
            </Text>
            {weeklyBullets.map((b) => (
              <Text key={b} style={{ color: C.whiteSoft, fontWeight: "500", lineHeight: 19 }}>
                {b.startsWith("Hit") ? "✓ " : b.startsWith("Protein") ? "↑ " : b.startsWith("Hydration") ? "⚠ " : "→ "}
                {b}
              </Text>
            ))}
            <Pressable
              onPress={() => setShareOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Share my week"
              style={({ pressed }) => ({
                minHeight: 46,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(C.purple, pressed ? 0.36 : 0.28),
                borderWidth: 1,
                borderColor: withAlpha(C.purple, 0.48),
              })}
            >
              <Text style={{ color: C.text, fontWeight: "600" }}>Share my week</Text>
            </Pressable>
          </View>
        </Section>

        <AdvancedMetricsEntry
          onPress={() => router.push("/profile/advanced-metrics")}
        />
      </ScrollView>

      <ExpandedChart
        kind={expanded}
        values={expandedValues}
        goal={expanded === "protein" ? goals.protein : expanded === "calories" ? goals.calories : undefined}
        onClose={() => setExpanded(null)}
      />

      <BadgePopover
        id={badgeId}
        unlocks={unlocks}
        onClose={() => setBadgeId(null)}
      />
      <ShareCardModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        rangeTitle={rangeTitle}
        bullets={weeklyBullets}
        calorieHits={calorieHits}
        proteinHits={proteinHits}
        totalDays={totalDays}
      />
    </View>
  );
}

function AdvancedMetricsEntry({ onPress }: { onPress: () => void }) {
  const C = useC();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Advanced Metrics"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: withAlpha(C.purple, 0.38),
          backgroundColor: withAlpha(C.purple, 0.14),
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(C.purple, 0.2),
          }}
        >
          <Ionicons name="analytics-outline" size={22} color={C.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 17 }}>
            Advanced Metrics →
          </Text>
          <Text style={{ color: C.muted, fontWeight: "500", marginTop: 3 }}>
            Deep dive into your patterns
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Header({
  range,
  setRange,
  titleRange,
  onBack,
}: {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  titleRange: string;
  onBack: () => void;
}) {
  const C = useC();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.hairline,
            backgroundColor: C.card,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: "600" }}>
            Insights
          </Text>
          <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
            {titleRange}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: C.hairline,
            padding: 3,
            backgroundColor: C.card,
          }}
        >
          {RANGE_OPTIONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={{
                paddingHorizontal: 10,
                height: 32,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: range === r ? withAlpha(C.purple, 0.32) : "transparent",
              }}
            >
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 12 }}>
                {r}D
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function AnimatedIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 180, delay }}
    >
      {children}
    </MotiView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const C = useC();
  return (
    <AnimatedIn delay={50}>
      <View style={{ gap: 10 }}>
        <Text
          style={{
            color: C.muted,
            fontWeight: "600",
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
        {children}
      </View>
    </AnimatedIn>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const C = useC();
  return (
    <View
      style={[
        {
          borderRadius: 18,
          borderWidth: 0,
          borderColor: C.hairline,
          backgroundColor: C.card,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function InfoCard({ icon, text }: { icon: any; text: string }) {
  const C = useC();
  return (
    <Card
      style={{
        backgroundColor: withAlpha(C.purple, 0.14),
        borderColor: withAlpha(C.purple, 0.26),
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Ionicons name={icon} size={18} color={C.purple} />
        <Text style={{ color: C.text, fontWeight: "600", flex: 1, lineHeight: 19 }}>
          {text}
        </Text>
      </View>
    </Card>
  );
}

function InfoLine({ text }: { text: string }) {
  const C = useC();
  return (
    <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 18 }}>{text}</Text>
  );
}

function ReportTile({
  label,
  value,
  sub,
  color,
  neutral,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  neutral?: boolean;
}) {
  const C = useC();
  return (
    <View
      style={{
        width: "48.5%",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: neutral ? C.hairline : withAlpha(color, 0.32),
        backgroundColor: neutral ? withAlpha(C.gray, 0.72) : withAlpha(color, 0.12),
        padding: 14,
      }}
    >
      <Text style={{ color: neutral ? C.muted : color, fontWeight: "600", fontSize: 26 }}>{value}</Text>
      <Text style={{ color: C.text, fontWeight: "600", marginTop: 2 }}>{label}</Text>
      <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  const C = useC();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.28),
        backgroundColor: withAlpha(color, 0.12),
      }}
    >
      <Text style={{ color: C.text, fontWeight: "600", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function StreakPill({ streak }: { streak: number }) {
  const C = useC();
  const active = streak >= 1;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: withAlpha(active ? C.green : C.gray, active ? 0.34 : 1),
        backgroundColor: active ? withAlpha(C.green, 0.12) : withAlpha(C.gray, 0.82),
      }}
    >
      <Text style={{ color: active ? C.text : C.muted, fontWeight: "600", fontSize: 12 }}>
        {active ? `${streak} day streak 🔥` : "No streak yet"}
      </Text>
    </View>
  );
}

function Heatmap({ rows, goals }: { rows: DayRow[]; goals: Goals }) {
  const C = useC();
  const ref = useRef<ScrollView>(null);
  const [showHint, setShowHint] = useState(true);
  const byMonth: Record<string, number> = {};
  rows.forEach((r, i) => {
    const label = new Date(`${r.date}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
    });
    if (byMonth[label] == null) byMonth[label] = i;
  });
  const today = ymd(new Date());
  return (
    <Card>
      {showHint ? (
        <Text style={{ color: C.muted, fontWeight: "500", fontSize: 11, marginBottom: 8 }}>
          ← scroll for history
        </Text>
      ) : null}
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: false }))}
        onScrollBeginDrag={() => setShowHint(false)}
      >
        <View style={{ gap: 8 }}>
          <View style={{ height: 14, position: "relative", width: rows.length * 15 }}>
            {Object.entries(byMonth).map(([m, i]) => (
              <Text
                key={m}
                style={{
                  position: "absolute",
                  left: i * 15,
                  color: C.muted,
                  fontWeight: "600",
                  fontSize: 10,
                }}
              >
                {m}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {rows.map((d) => {
              const score = dayScore(d, goals);
              const logged = hasLogged(d);
              const color =
                !logged
                  ? C.gray
                  : score >= 0.9
                  ? C.green
                  : score >= 0.5
                  ? C.amber
                  : withAlpha(C.red, 0.6);
              return (
                <View
                  key={d.date}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 3,
                    backgroundColor: color,
                    borderWidth: d.date === today ? 2 : 0,
                    borderColor: C.purple,
                  }}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  return (
    <Svg width={96} height={32}>
      <Path d={pathFor(values, 96, 32, 4)} stroke={color} strokeWidth={2.5} fill="none" />
    </Svg>
  );
}

function LineChart({
  values,
  color,
  goal,
  weight,
  height = H,
}: {
  values: number[];
  color: string;
  goal?: number;
  weight?: boolean;
  height?: number;
}) {
  const C = useC();
  const clean = values.length ? values : [0, 0];
  const max = Math.max(...clean, goal || 0, 1);
  const goalY = goal ? height - 14 - (goal / max) * (height - 28) : null;
  const highIndex = clean.indexOf(Math.max(...clean));
  const high = pointFor(clean, highIndex, W, height);
  const reg = weight ? regression(clean) : [];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
      <SvgText x={8} y={16} fill={C.muted} fontSize="9" fontWeight="700">
        {Math.round(max)}
      </SvgText>
      <SvgText x={8} y={height - 7} fill={C.muted} fontSize="9" fontWeight="700">
        0
      </SvgText>
      <Path d={areaFor(clean, W, height)} fill={withAlpha(color, 0.14)} />
      {goalY != null ? (
        <>
          <Line
            x1={34}
            x2={W - 14}
            y1={goalY}
            y2={goalY}
            stroke="rgba(255,255,255,0.38)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
          <SvgText x={8} y={Math.max(12, goalY - 3)} fill={C.whiteSoft} fontSize="9" fontWeight="800">
            {Math.round(goal || 0)}
          </SvgText>
        </>
      ) : null}
      {weight ? (
        <Path d={pathFor(reg, W, height)} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
      ) : null}
      <Path d={pathFor(clean, W, height)} stroke={color} strokeWidth={3} fill="none" />
      {!weight && clean.length > 1 ? (
        <>
          <Circle cx={high.x} cy={high.y} r={4} fill={color} />
          <SvgText x={Math.min(W - 58, high.x + 6)} y={Math.max(14, high.y - 8)} fill={C.text} fontSize="10" fontWeight="700">
            high {Math.round(clean[highIndex])}
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

function ChartRow({
  title,
  values,
  color,
  goal,
  open,
  onToggle,
  onExpand,
  kind,
  footer,
}: {
  title: string;
  values: number[];
  color: string;
  goal?: number;
  open: boolean;
  onToggle: () => void;
  onExpand: () => void;
  kind: ChartKind;
  footer?: React.ReactNode;
}) {
  const C = useC();
  const hasData = values.some((v) => v > 0);
  return (
    <Card style={{ gap: 10 }}>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{title}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MiniSpark values={values} color={color} />
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
        </View>
      </Pressable>
      {open ? (
        hasData ? (
          <Pressable onPress={onExpand}>
            <LineChart values={values} color={color} goal={goal} weight={kind === "weight"} />
            {footer ? <View style={{ marginTop: 8 }}>{footer}</View> : null}
          </Pressable>
        ) : (
          <EmptyCard title={`No ${title.toLowerCase()} data yet`} cta="Log data" />
        )
      ) : null}
    </Card>
  );
}

function EmptyCard({
  title,
  cta,
  onPress,
}: {
  title: string;
  cta: string;
  onPress?: () => void;
}) {
  const C = useC();
  return (
    <Card style={{ alignItems: "center", gap: 10 }}>
      <Text style={{ color: C.text, fontWeight: "600" }}>{title}</Text>
      <Pressable
        onPress={onPress}
        style={{
          minHeight: 40,
          borderRadius: 14,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(C.purple, 0.24),
          borderWidth: 1,
          borderColor: withAlpha(C.purple, 0.36),
        }}
      >
        <Text style={{ color: C.text, fontWeight: "600" }}>{cta}</Text>
      </Pressable>
    </Card>
  );
}

function Segment({
  value,
  onChange,
}: {
  value: "calories" | "protein";
  onChange: (v: "calories" | "protein") => void;
}) {
  const C = useC();
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.card, padding: 3, borderRadius: 999, alignSelf: "flex-start" }}>
      {(["calories", "protein"] as const).map((x) => (
        <Pressable
          key={x}
          onPress={() => onChange(x)}
          style={{
            paddingHorizontal: 13,
            height: 32,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value === x ? withAlpha(C.purple, 0.3) : "transparent",
          }}
        >
          <Text style={{ color: C.text, fontWeight: "600", textTransform: "capitalize" }}>{x}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DowBars({ rows, mode }: { rows: { label: string; value: number; pct: number }[]; mode: string }) {
  const C = useC();
  return (
    <Card>
      <View style={{ height: 132, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {rows.map((r) => {
          const color = r.pct >= 0.9 ? C.green : r.pct >= 0.7 ? C.amber : C.red;
          return (
            <View key={r.label} style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <View
                style={{
                  height: Math.max(10, 96 * r.pct),
                  width: "100%",
                  borderRadius: 10,
                  backgroundColor: withAlpha(color, 0.82),
                }}
              />
              <Text style={{ color: C.muted, fontWeight: "600", fontSize: 10 }}>{r.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: C.muted, fontWeight: "500", marginTop: 8 }}>
        Average {mode} performance by weekday
      </Text>
    </Card>
  );
}

function MacroDonut({
  protein,
  carbs,
  fat,
  calories,
}: {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}) {
  const C = useC();
  const total = Math.max(1, protein * 4 + carbs * 4 + fat * 9);
  const c = 2 * Math.PI * 46;
  const pLen = (protein * 4 / total) * c;
  const cLen = (carbs * 4 / total) * c;
  const fLen = (fat * 9 / total) * c;
  return (
    <Card style={{ alignItems: "center" }}>
      <Svg width={170} height={170} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={46} stroke="rgba(255,255,255,0.08)" strokeWidth={16} fill="none" />
        <Circle cx={60} cy={60} r={46} stroke={C.purple} strokeWidth={16} fill="none" strokeDasharray={`${pLen} ${c - pLen}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
        <Circle cx={60} cy={60} r={46} stroke={C.teal} strokeWidth={16} fill="none" strokeDasharray={`${cLen} ${c - cLen}`} strokeDashoffset={-pLen} strokeLinecap="round" transform="rotate(-90 60 60)" />
        <Circle cx={60} cy={60} r={46} stroke={C.amber} strokeWidth={16} fill="none" strokeDasharray={`${fLen} ${c - fLen}`} strokeDashoffset={-(pLen + cLen)} strokeLinecap="round" transform="rotate(-90 60 60)" />
        <SvgText x={60} y={58} fill={C.text} fontSize="14" fontWeight="800" textAnchor="middle">
          Avg
        </SvgText>
        <SvgText x={60} y={76} fill={C.text} fontSize="15" fontWeight="900" textAnchor="middle">
          {Math.round(calories)} kcal
        </SvgText>
      </Svg>
    </Card>
  );
}

function MacroGoalPill({
  label,
  avg,
  goal,
  color,
}: {
  label: string;
  avg: number;
  goal: number;
  color: string;
}) {
  const C = useC();
  const pct = clamp01(goal ? avg / goal : 0);
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.34),
        backgroundColor: withAlpha(color, 0.1),
        padding: 11,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color }} />
        <Text style={{ color: C.text, fontWeight: "600", flex: 1 }}>
          {label}: avg {avg}g / goal {Math.round(goal)}g
        </Text>
        <Text style={{ color, fontWeight: "600", fontSize: 12 }}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: C.hairline }}>
        <View style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
      </View>
    </View>
  );
}

function RecordCard(props: {
  icon: string;
  title: string;
  value: string;
  valueNum?: number;
  date: string;
  color: string;
}) {
  const C = useC();
  return (
    <View
      style={{
        width: 164,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: withAlpha(props.color, 0.3),
        backgroundColor: withAlpha(props.color, 0.12),
        padding: 12,
        gap: 8,
      }}
    >
      <Ionicons name={props.icon as any} size={20} color={props.color} />
      <Text style={{ color: C.text, fontWeight: "600", fontSize: 12, lineHeight: 15 }} numberOfLines={2}>{props.title}</Text>
      <Text style={{ color: C.text, fontWeight: "600", fontSize: 20 }}>{props.value}</Text>
      <Text style={{ color: C.muted, fontWeight: "500", fontSize: 12 }}>{props.date}</Text>
    </View>
  );
}

function BadgeCell({
  badge,
  unlocked,
  onPress,
}: {
  badge: (typeof BADGES)[number];
  unlocked: boolean;
  onPress: () => void;
}) {
  const C = useC();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "31%",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: withAlpha(unlocked ? badge.accent : C.gray, 0.28),
          backgroundColor: withAlpha(unlocked ? badge.accent : C.gray, unlocked ? 0.12 : 0.08),
        }}
      >
        <Ionicons
          name={(unlocked ? badge.icon : "lock-closed") as any}
          size={22}
          color={unlocked ? badge.accent : "rgba(246,247,255,0.38)"}
        />
      </View>
      <Text
        style={{ color: unlocked ? C.text : C.muted, fontWeight: "500", fontSize: 11, textAlign: "center" }}
        numberOfLines={2}
      >
        {badge.title}
      </Text>
      {!unlocked ? (
        <Text style={{ color: C.muted, fontWeight: "700", fontSize: 9.5, textAlign: "center" }} numberOfLines={2}>
          {badge.criteriaText || "Keep logging"}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ExpandedChart({
  kind,
  values,
  goal,
  onClose,
}: {
  kind: ChartKind | null;
  values: number[];
  goal?: number;
  onClose: () => void;
}) {
  const C = useC();
  if (!kind) return null;
  const color = kind === "protein" ? C.purple : kind === "weight" ? C.green : C.blue;
  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 18, justifyContent: "center" }}>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 22, textTransform: "capitalize" }}>
              {kind} detail
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>
          <LineChart values={values} color={color} goal={goal} weight={kind === "weight"} height={260} />
        </Card>
      </View>
    </Modal>
  );
}

function BadgePopover({
  id,
  unlocks,
  onClose,
}: {
  id: string | null;
  unlocks: UnlockMap;
  onClose: () => void;
}) {
  const C = useC();
  if (!id) return null;
  const badge = BADGE_BY_ID[id];
  if (!badge) return null;
  const unlockedAt = unlocks[id]?.unlockedAt;
  return (
    <Modal visible transparent animationType="fade">
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.56)", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <Card style={{ width: "100%", gap: 10 }}>
          <Ionicons name={badge.icon as any} size={28} color={badge.accent} />
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 18 }}>{badge.title}</Text>
          <Text style={{ color: C.whiteSoft, fontWeight: "500", lineHeight: 18 }}>{badge.description}</Text>
          <Text style={{ color: C.muted, fontWeight: "500" }}>
            {unlockedAt
              ? `Earned ${new Date(unlockedAt).toLocaleDateString()}`
              : badge.criteriaText || "Keep logging to earn this."}
          </Text>
        </Card>
      </Pressable>
    </Modal>
  );
}

function ShareCardModal({
  visible,
  onClose,
  rangeTitle,
  bullets,
  calorieHits,
  proteinHits,
  totalDays,
}: {
  visible: boolean;
  onClose: () => void;
  rangeTitle: string;
  bullets: string[];
  calorieHits: number;
  proteinHits: number;
  totalDays: number;
}) {
  const C = useC();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.72)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          accessibilityRole="summary"
          style={{
            borderRadius: 18,
            borderWidth: 0,
            borderColor: withAlpha(C.purple, 0.68),
            backgroundColor: C.card,
            padding: 22,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(C.purple, 0.22),
              }}
            >
              <Ionicons name="sparkles" size={20} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 22 }}>
                Weekly progress
              </Text>
              <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
                {rangeTitle}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <InfoStat label="Calories" value={`${calorieHits}/${totalDays}`} color={reportTone(calorieHits, totalDays, C)} />
            <InfoStat label="Protein" value={`${proteinHits}/${totalDays}`} color={reportTone(proteinHits, totalDays, C)} />
          </View>

          <View style={{ gap: 10 }}>
            {bullets.slice(0, 4).map((b) => (
              <Text key={b} style={{ color: C.whiteSoft, fontWeight: "500", lineHeight: 20 }}>
                {b}
              </Text>
            ))}
          </View>

          <Text style={{ color: C.muted, fontWeight: "500", textAlign: "center" }}>
            Screenshot this card to share your week.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoStat({ label, value, color }: { label: string; value: string; color: string }) {
  const C = useC();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.32),
        backgroundColor: withAlpha(color, 0.12),
      }}
    >
      <Text style={{ color, fontWeight: "600", fontSize: 24 }}>{value}</Text>
      <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>{label}</Text>
    </View>
  );
}
