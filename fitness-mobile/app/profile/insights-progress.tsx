import { ProfileIntro, ProfileSection, ProfileRecord } from "@/components/profile/ProfileTaskUI";
import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Empty, Heading, IconButton, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { Trend } from "@/components/somata/Trend";
import { nutritionTargets } from "@/services/nutritionTargets";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePremiumProfileFlowTheme as useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import { subscribeActivityBetween, type ActivityEntry } from "@/services/activity";
import { BADGE_BY_ID, BADGES } from "@/services/badges/registry";
import { loadUnlocksLocal } from "@/services/badges/store";
import type { UnlockMap } from "@/services/badges/types";
import {
  subscribeExerciseBetween,
  subscribeFoodsBetween,
  type ExerciseEntry,
  type FoodEntry,
} from "@/services/nutrition";
import { subscribeProfile, type Profile } from "@/services/profile";
import {
  loadBodyMetricsHistory,
  type BodyMetricPoint,
} from "@/services/profile/bodyMetrics";

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

function InsightsProgressScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

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
          const stored = await localStore.getItem(`@water:${d}`);
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
    })().catch(() => { });
    return () => {
      mounted = false;
    };
  }, [allDates, user?.uid]);

  useEffect(() => {
    loadBodyMetricsHistory(localStore).then(setBodyHistory).catch(() => setBodyHistory([]));
    loadUnlocksLocal(localStore).then((x) => setUnlocks(x || {})).catch(() => setUnlocks({}));
  }, []);

  const goals: Goals = useMemo(
    () => ({
      ...nutritionTargets(profile),
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

  return (<><TaskPage title="Read your rhythm" section="Progress insights" subtitle={rangeTitle} onBack={() => router.back()} action={<IconButton icon="share-outline" label="Open weekly share card" onPress={() => setShareOpen(true)} />}>

    <ProfileIntro label="Progress / selected period" title="Patterns from your records" detail="Explore summaries, dated records and your earned collection. These are not FitAdapt explanations." />
    <ProfileSection index="01" title="Period overview"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {RANGE_OPTIONS.map(r => <Choice key={r} label={`${r} days`} selected={range === r} onPress={() => setRange(r)} />)}
    </View>
    <Text style={F.caption}>Goal comparisons use your current targets, not historical plans. Some histories are stored on this device.</Text>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Metric label="Calorie goal days" value={caloriesTracked ? `${calorieHits}/${totalDays}` : '—'} />
      <Metric label="Protein goal days" value={proteinTracked ? `${proteinHits}/${totalDays}` : '—'} />
      <Metric label="Hydration goal days" value={hydrationTracked ? `${hydrationHits}/${totalDays}` : '—'} />
      <Metric label="Workout sessions" value={workoutsTracked ? String(workoutSessions) : '—'} />
    </View>

    </ProfileSection><Panel>
      <Heading title="Consistency calendar" detail={`Current ${heat.current} days · Best ${heat.best} days`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {allRows.map(r => <View key={r.date} accessibilityLabel={`${r.date}: ${hasLogged(r) ? `score ${Math.round(dayScore(r, goals) * 100)}%` : 'no logged data'}`} style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: hasLogged(r) ? dayScore(r, goals) >= 0.7 ? D.lime : D.teal : D.raised }} />)}
      </View>
    </Panel>

    <Heading title="Your trends" />
    {(['calories', 'protein', 'weight'] as ChartKind[]).map(kind => {
      const values = kind === 'weight' ? weights.map(w => w.value) : rows.map(r => r[kind]); return <Panel key={kind}>
        <Item title={kind === 'weight' ? 'Weight · device history' : `${kind[0].toUpperCase() + kind.slice(1)} trend`} onPress={() => setOpenRows(v => ({ ...v, [kind]: !v[kind] }))} action={<IconButton icon="expand" label={`Expand ${kind} trend`} onPress={() => setExpanded(kind)} />} />
        {openRows[kind] && <Trend premiumProfile values={values} unit={kind === 'weight' ? 'lb' : kind === 'protein' ? 'g' : 'kcal'} goal={kind === 'weight' ? undefined : goals[kind]} />}
        {kind === 'weight' && !weights.length && <Button label="Log weight" onPress={() => router.push('/(modals)/body-metrics')} />}
      </Panel>;
    })}

    <Panel>
      <Heading title="Day-of-week pattern" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['calories', 'protein'] as const).map(m => <Choice key={m} label={m} selected={dowMode === m} onPress={() => setDowMode(m)} />)}
      </View>
      {dow.map(d => <View key={d.label} style={{ gap: 7 }}>
        <Text style={F.caption}>{d.label} · {Math.round(d.value)} {dowMode === 'protein' ? 'g' : 'kcal'}</Text>
        <View style={{ height: 8, backgroundColor: D.raised, borderRadius: 4 }}>
          <View style={{ height: 8, width: `${d.pct * 100}%`, backgroundColor: D.teal, borderRadius: 4 }} />
        </View>
      </View>)}
      <Text style={F.caption}>{dowInsight}</Text>
    </Panel>

    <Panel>
      <Heading title="Average nutrition" detail="Averages include every day in the selected range." />
      <Text style={{ ...F.value, fontSize: 40 }}>{avgCalories} kcal</Text>
      {[{ label: 'Protein', value: avgProtein, goal: goals.protein }, { label: 'Carbs', value: avgCarbs, goal: goals.carbs }, { label: 'Fat', value: avgFat, goal: goals.fat }].map(m => <Item key={m.label} title={m.label} value={`${m.value} / ${m.goal} g`} />)}
    </Panel>

    <Heading title="Personal bests" />
    {pb.length ? pb.map(p => <ProfileRecord key={p.title} label={p.date}><Heading title={p.title} /><Text style={{ ...F.value, fontSize: 28 }}>{p.value}</Text></ProfileRecord>) : <Empty title="No records yet" />}

    <ProfileSection index="03" title="Your collection" detail={`${unlockedBadges.length} earned · ${lockedBadges.length} shown locked`}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[...unlockedBadges.slice(0, 9), ...lockedBadges].map(b => <Choice key={b.id} label={`${unlocks[b.id] ? '✓' : '○'} ${b.title}`} selected={!!unlocks[b.id]} onPress={() => setBadgeId(b.id)} />)}
    </View>

    </ProfileSection><Panel accent>
      <Heading title="The period in review" />
      {weeklyBullets.map(b => <Text key={b} style={F.body}>{b}</Text>)}
      <Button label="Open share card" onPress={() => setShareOpen(true)} />
    </Panel>
    <Button primary label="Explore advanced metrics" onPress={() => router.push('/profile/advanced-metrics')} />

  </TaskPage><TaskSheet title={`${expanded || ''} trend`} visible={!!expanded} onClose={() => setExpanded(null)}>
      <ProfileIntro label="Expanded record" title={`${expanded || "Recorded"} / ${range} days`} detail="Current goals are reference lines, not historical plan targets." />
      <Trend premiumProfile values={expandedValues} unit={expanded === 'weight' ? 'lb' : expanded === 'protein' ? 'g' : 'kcal'} goal={expanded === 'protein' ? goals.protein : expanded === 'calories' ? goals.calories : undefined} />
    </TaskSheet><BadgePopover id={badgeId} unlocks={unlocks} onClose={() => setBadgeId(null)} /><ShareCardModal visible={shareOpen} onClose={() => setShareOpen(false)} rangeTitle={rangeTitle} bullets={weeklyBullets} calorieHits={calorieHits} proteinHits={proteinHits} totalDays={totalDays} /></>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any; }) {
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

function BadgePopover({
  id,
  unlocks,
  onClose,
}: {
  id: string | null;
  unlocks: UnlockMap;
  onClose: () => void;
}) {
  const { D, F } = useTaskPresentation();

  const C = useC();
  if (!id) return null;
  const badge = BADGE_BY_ID[id];
  if (!badge) return null;
  const unlockedAt = unlocks[id]?.unlockedAt;
  return (<TaskSheet title={badge.title} visible onClose={onClose}>
    <Panel accent><View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}><Ionicons name={badge.icon as any} size={44} color={D.lime} /><View style={{ flex: 1, gap: 4 }}><Text style={F.eyebrow}>{unlockedAt ? "EARNED / YOUR COLLECTION" : "YOUR COLLECTION / LOCKED"}</Text><Text style={F.heading}>{badge.title}</Text></View></View></Panel>
    <Text style={F.body}>{badge.description}</Text>
    <Text style={F.caption}>{unlockedAt ? `Earned ${new Date(unlockedAt).toLocaleDateString()}` : badge.criteriaText || 'Keep logging to earn this.'}</Text>
  </TaskSheet>
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
  const { D, F } = useTaskPresentation();

  const C = useC();
  return (<TaskSheet title="Your week, ready to share" visible={visible} onClose={onClose}>
    <ProfileIntro label="Somata / weekly record" title="Your week in view" detail={rangeTitle} />
    <Panel>
      <Heading title="Somata / Weekly progress" detail={rangeTitle} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Metric label="Calorie goal days" value={`${calorieHits}/${totalDays}`} />
        <Metric label="Protein goal days" value={`${proteinHits}/${totalDays}`} />
      </View>
      {bullets.slice(0, 4).map(b => <Text key={b} style={F.body}>{b}</Text>)}
    </Panel>
    <Text style={F.caption}>Screenshot this card to share your week.</Text>
  </TaskSheet>
  );
}

export default function InsightsProgressScreen() {
  return <SomataTaskAppearance><InsightsProgressScreenContent /></SomataTaskAppearance>;
}
