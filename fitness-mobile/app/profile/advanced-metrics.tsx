import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Empty } from "@/components/somata/TaskUI";
import { Button, Choice, Heading, Item, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { nutritionTargets } from "@/services/nutritionTargets";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import { subscribeActivityBetween, type ActivityEntry } from "@/services/activity";
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
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
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
type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  workoutsPerWeek: number;
};

function useC() {
  const { colors, isDark } = useProfileFlowTheme();
  return {
    bg: colors.background as string,
    card: colors.surface1 as string,
    card2: colors.surface2 as string,
    text: colors.textPrimary as string,
    muted: colors.textTertiary as string,
    hairline: colors.border as string,
    purple: colors.primary as string,
    blue: isDark ? "#B9A4FA" : "#7051B5",
    teal: colors.accent as string,
    green: colors.success as string,
    amber: colors.warning as string,
    red: colors.danger as string,
    gray: colors.surface3 as string,
  };
}
const RANGE_OPTIONS: RangeKey[] = [7, 30, 90];
const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const W = 320;
const H = 150;

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
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}
function avg(xs: number[]) {
  return xs.length ? sum(xs) / xs.length : 0;
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}
function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${clamp01(a)})`;
}
function fmtRange(range: RangeKey, rows: DayRow[]) {
  if (!rows.length) return "";
  const first = new Date(`${rows[0].date}T12:00:00`);
  const last = new Date(`${rows[rows.length - 1].date}T12:00:00`);
  const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (range === 7) return `Week of ${short(first)}-${short(last)}`;
  if (range === 30) return `Month of ${short(first)}-${short(last)}`;
  return `Last 90 days · ${first.toLocaleDateString(undefined, { month: "short" })}-${last.toLocaleDateString(undefined, { month: "short" })}`;
}
function pathFor(values: number[], width = W, height = H, padPx = 14) {
  if (!values.length) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(1, max - min);
  return values
    .map((v, i) => {
      const x = padPx + (values.length === 1 ? 0 : (i / (values.length - 1)) * (width - padPx * 2));
      const y = height - padPx - ((v - min) / span) * (height - padPx * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
function regression(values: number[]) {
  if (values.length < 2) return values;
  const xs = values.map((_, i) => i);
  const xa = avg(xs);
  const ya = avg(values);
  const denom = sum(xs.map((x) => (x - xa) ** 2)) || 1;
  const slope = sum(xs.map((x, i) => (x - xa) * (values[i] - ya))) / denom;
  return xs.map((x) => ya + slope * (x - xa));
}
function createdHour(f: FoodEntry) {
  const raw: any = f.createdAt;
  const ts = raw?.toMillis?.() ?? raw ?? 0;
  const d = Number(ts) ? new Date(Number(ts)) : new Date(`${f.date}T12:00:00`);
  return d.getHours() + d.getMinutes() / 60;
}
function mealKey(meal: string): MealKey {
  const m = String(meal || "").toLowerCase();
  return (MEALS.includes(m as MealKey) ? m : "snacks") as MealKey;
}
function dayScore(d: DayRow, goals: Goals) {
  return avg([
    clamp01(goals.calories ? d.calories / goals.calories : 0),
    clamp01(goals.protein ? d.protein / goals.protein : 0),
    clamp01(goals.waterMl ? d.waterMl / goals.waterMl : 0),
    clamp01(d.steps / 8000),
    d.workouts ? 1 : 0,
  ]);
}

export default function AdvancedMetricsScreen() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const C = useC();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>(30);
  const [desk, setDesk] = useState("calories");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [waterByDay, setWaterByDay] = useState<Record<string, number>>({});
  const [bodyHistory, setBodyHistory] = useState<BodyMetricPoint[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({
    calories: true,
    protein: true,
    macros: true,
    weight: true,
    performance: true,
    hydration: true,
    activity: true,
    projection: true,
  });

  const today = useMemo(() => new Date(), []);
  const dates90 = useMemo(() => Array.from({ length: 90 }, (_, i) => ymd(addDays(today, i - 89))), [today]);
  const from90 = dates90[0];
  const toToday = dates90[dates90.length - 1];

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
        dates90.map(async (d) => [d, n(await localStore.getItem(`@water:${d}`))] as const)
      );
      const quickRaw = user?.uid ? await AsyncStorage.getItem(`hydration:quickLogs:${user.uid}`) : null;
      const quick = quickRaw ? JSON.parse(quickRaw) : [];
      const q: Record<string, number> = {};
      if (Array.isArray(quick)) {
        quick.forEach((x) => {
          const d = ymd(new Date(n(x?.ts)));
          q[d] = (q[d] || 0) + n(x?.ml);
        });
      }
      if (mounted) setWaterByDay(Object.fromEntries(entries.map(([d, ml]) => [d, ml + (q[d] || 0)])));
    })().catch(() => { });
    loadBodyMetricsHistory(localStore).then(setBodyHistory).catch(() => setBodyHistory([]));
    return () => {
      mounted = false;
    };
  }, [dates90, user?.uid]);

  const goals: Goals = useMemo(
    () => ({
      ...nutritionTargets(profile),
      waterMl: n((profile as any)?.waterGoalMl ?? 2400),
      workoutsPerWeek: n((profile as any)?.gymSessionsPerWeek ?? (profile as any)?.trainingDaysPerWeek ?? 4),
    }),
    [profile]
  );

  const rows90 = useMemo(() => {
    const foodByDay: Record<string, DayRow> = {};
    foods.forEach((f) => {
      const d = String(f.date || "").slice(0, 10);
      if (!d) return;
      foodByDay[d] ||= blank(d);
      foodByDay[d].calories += n(f.calories);
      foodByDay[d].protein += n(f.protein);
      foodByDay[d].carbs += n(f.carbs);
      foodByDay[d].fat += n(f.fat);
    });
    const workoutMap: Record<string, number> = {};
    const burnMap: Record<string, number> = {};
    exercises.forEach((e) => {
      const d = String(e.date || "").slice(0, 10);
      workoutMap[d] = (workoutMap[d] || 0) + 1;
      burnMap[d] = (burnMap[d] || 0) + n(e.calories);
    });
    activities.forEach((a) => {
      const d = ymd(new Date(n(a.timestamp)));
      workoutMap[d] = (workoutMap[d] || 0) + 1;
      burnMap[d] = (burnMap[d] || 0) + n(a.calories);
    });
    const steps = (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    return dates90.map((date) => ({
      ...blank(date),
      ...(foodByDay[date] || {}),
      waterMl: waterByDay[date] || 0,
      workouts: workoutMap[date] || 0,
      burn: burnMap[date] || 0,
      steps: n(steps[date]),
    }));
  }, [activities, dates90, exercises, foods, profile, waterByDay]);

  const rows = useMemo(() => rows90.slice(-range), [range, rows90]);
  const foodsInRange = useMemo(() => {
    const allowed = new Set(rows.map((r) => r.date));
    return foods.filter((f) => allowed.has(String(f.date).slice(0, 10)));
  }, [foods, rows]);
  const weights = useMemo(() => {
    const min = addDays(today, -range + 1).getTime();
    return bodyHistory.filter((p) => p.t >= min && typeof p.weightLb === "number").map((p) => ({ date: ymd(new Date(p.t)), value: Number(p.weightLb) }));
  }, [bodyHistory, range, today]);

  const mealStats = useMemo(() => buildMealStats(foodsInRange), [foodsInRange]);
  const proteinDays = rows.filter((r) => r.protein >= goals.protein * 0.9).length;
  const calHits = rows.filter((r) => Math.abs(r.calories - goals.calories) <= goals.calories * 0.1 && r.calories > 0).length;
  const waterHits = rows.filter((r) => r.waterMl >= goals.waterMl).length;
  const avgDeficit = Math.round(avg(rows.map((r) => r.calories - goals.calories)));
  const projectedLb = Number(((-avgDeficit * 7) / 3500).toFixed(1));
  const efficiency = avg(rows.filter((r) => r.protein > 0).map((r) => r.calories / Math.max(1, r.protein)));
  const activeDays = rows.filter((r) => r.workouts > 0).length;
  const bestDow = bestWorstDow(rows, goals);
  const hydrated = rows.filter((r) => r.waterMl >= goals.waterMl * 0.8);
  const dry = rows.filter((r) => r.waterMl > 0 && r.waterMl < goals.waterMl * 0.5);
  const bodyFat = n((profile as any)?.bodyFatPct);
  const aiLine = useMemo(() => {
    if (proteinDays >= Math.ceil(rows.length * 0.6)) return "Your best performance days correlate with higher protein. Here's the full picture.";
    if (waterHits === 0) return "Hydration is the clearest unlock in this range. Start small and make it visible.";
    return `${bestDow.best} is your strongest day. The charts below show what is driving it.`;
  }, [bestDow.best, proteinDays, rows.length, waterHits]);

  return (<TaskPage title="Behind the numbers" section="Advanced metrics" subtitle={fmtRange(range, rows)} onBack={() => router.replace('/profile/insights-progress')}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {([7, 30, 90] as RangeKey[]).map(r => <Choice key={r} label={r + ' days'} selected={range === r} onPress={() => setRange(r)} />)}
    </View>
    <Text style={F.caption}>Comparisons use current saved goals. Estimates are calculator outputs, not FitAdapt forecasts. Device history may contribute to these views.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {[{ "id": "calories", "title": "Calorie Breakdown Deep Dive" }, { "id": "protein", "title": "Protein Analytics" }, { "id": "macros", "title": "Macro Balance Analytics" }, { "id": "weight", "title": "Weight & Body Composition Trends" }, { "id": "performance", "title": "Performance Correlations" }, { "id": "hydration", "title": "Hydration Analytics" }, { "id": "activity", "title": "Workout & Activity Analytics" }, { "id": "projection", "title": "Goal Projection Engine" }].map(t => <Choice key={t.id} label={t.title} selected={desk === t.id} onPress={() => setDesk(t.id)} />)}
    </ScrollView>
    {desk === "calories" && !(foodsInRange.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "calories" && (foodsInRange.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Calorie Breakdown Deep Dive" />

      <ChartCard title="Calorie surplus / deficit" onExpand={() => setExpanded("Calorie surplus / deficit")}>

        <DeltaBars values={rows.map((r) => r.calories - goals.calories)} />

        <Insight text={`Avg ${avgDeficit <= 0 ? "deficit" : "surplus"} this range: ${avgDeficit} kcal/day`} />

        <Insight text={`Calculator energy-equivalent estimate: ${projectedLb >= 0 ? "-" : "+"}${Math.abs(projectedLb)} lb/week`} />

      </ChartCard>

      <ChartCard title="Calorie distribution heatmap" onExpand={() => setExpanded("Calorie distribution heatmap")}>

        <MealHeatmap stats={mealStats.caloriesByDowMeal} />

        <Insight text={`You eat ${Math.round(mealStats.dinnerCalorieShare * 100)}% of calories at dinner on average.`} />

      </ChartCard>

      <ChartCard title="Meal timing chart" onExpand={() => setExpanded("Meal timing chart")}>

        <MealTimeline foods={foodsInRange} rows={rows} />

        <Insight text={`Your eating window is ~${mealStats.eatingWindow} hours. ${mealStats.eatingWindow > 10 ? "Narrowing slightly may support fat loss." : "That is already a tight window."}`} />

      </ChartCard>

    </View>}
    {desk === "protein" && !(foodsInRange.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "protein" && (foodsInRange.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Protein Analytics" />

      <ChartCard title="Protein distribution" onExpand={() => setExpanded("Protein distribution")}>

        <StackedMealBars rows={rows} foods={foodsInRange} goal={goals.protein} nutrient="protein" colors={[C.purple, alpha(C.purple, 0.75), alpha(C.purple, 0.5), alpha(C.purple, 0.25)]} />

        <Insight text={`You hit protein goal ${proteinDays}/${rows.length} days. Dinner contributes ${Math.round(mealStats.dinnerProteinShare * 100)}% of daily protein.`} />

      </ChartCard>

      <ChartCard title="Protein per meal average" onExpand={() => setExpanded("Protein per meal average")}>

        <HorizontalMealBars values={mealStats.proteinByMeal} />

        <Insight text={proteinMealInsight(mealStats.proteinByMeal)} />

      </ChartCard>

      <ChartCard title="Protein efficiency score" onExpand={() => setExpanded("Protein efficiency score")}>

        <Gauge value={efficiency || 0} max={20} label={`${Math.round(efficiency || 0)} kcal/g`} lowerBetter />

        <Insight text={`Elite: <6 · Good: 6-9 · Average: 10-14 · Low: 15+ · ${efficiency <= 9 ? "improving quality" : "choose leaner protein anchors"}`} />

      </ChartCard>

    </View>}
    {desk === "macros" && !(foodsInRange.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "macros" && (foodsInRange.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Macro Balance Analytics" />

      <ChartCard title="Macro ratio trend" onExpand={() => setExpanded("Macro ratio trend")}>

        <MacroBands rows={rows} />

        <Insight text={macroShiftInsight(rows)} />

      </ChartCard>

      <ChartCard title="Micro vs macro goal compliance" onExpand={() => setExpanded("Goal compliance radar")}>

        <Radar values={[avg(rows.map((r) => r.calories / goals.calories)), avg(rows.map((r) => r.protein / goals.protein)), avg(rows.map((r) => r.carbs / goals.carbs)), avg(rows.map((r) => r.fat / goals.fat)), avg(rows.map((r) => r.waterMl / goals.waterMl))]} />

        <Insight text={complianceInsight(rows, goals)} />

      </ChartCard>

      <ChartCard title="Macro consistency score" onExpand={() => setExpanded("Macro consistency score")}>

        <ScoreRing score={macroConsistency(rows)} />

        <Insight text={macroVarianceInsight(rows)} />

      </ChartCard>

    </View>}
    {desk === "weight" && !(weights.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "weight" && (weights.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Weight & Body Composition Trends" />

      {weights.length >= 2 ? (
        <>
          <ChartCard title="Weight trend with noise filter" onExpand={() => setExpanded("Weight trend with noise filter")}>

            <WeightNoise values={weights.map((w) => w.value)} />

            <Insight text={weightTrendInsight(weights)} />

          </ChartCard>
          <ChartCard title="Weight velocity" onExpand={() => setExpanded("Weight velocity")}>

            <LineChart values={velocity(weights)} color={C.green} />

            <Insight text={velocityInsight(velocity(weights))} />

          </ChartCard>
        </>
      ) : (
        <EmptyState text="Log weight check-ins to unlock filtered trends." />
      )}

      {bodyFat > 0 && weights.length ? (
        <ChartCard title="Body composition estimator" onExpand={() => setExpanded("Body composition estimator")}>

          <CompositionBars weight={weights[weights.length - 1]?.value || 0} bodyFat={bodyFat} target={n((profile as any)?.targetWeightKg) * 2.20462} />

        </ChartCard>
      ) : (
        <EmptyState text="Add body fat % in Profile to unlock this chart." />
      )}

      <ChartCard title="Check-in consistency" onExpand={() => setExpanded("Check-in consistency")}>

        <DotCalendar dates={rows.map((r) => r.date)} hits={new Set(weights.map((w) => w.date))} />

        <Insight text={`${weights.length} check-ins this range. Log at least 3x/week for reliable trends.`} />

      </ChartCard>

    </View>}
    {desk === "performance" && !(foodsInRange.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "performance" && (foodsInRange.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Performance Correlations" />

      <ChartCard title="Protein vs goal hit rate" onExpand={() => setExpanded("Protein vs goal hit rate")}>

        <Scatter rows={rows} goals={goals} />

        <Insight text={proteinCorrelationInsight(rows, goals)} />

      </ChartCard>

      <ChartCard title="Steps vs calorie burn" onExpand={() => setExpanded("Steps vs calorie burn")}>

        <DualLine a={rows.map((r) => r.steps)} b={rows.map((r) => r.burn)} />

        <Insight text="Your steps and burn move together when both are logged — walking is your primary calorie lever." />

      </ChartCard>

      <ChartCard title="Best performance days" onExpand={() => setExpanded("Best performance days")}>

        <DowScore rows={rows} goals={goals} />

        <Insight text={`${bestDow.best} is your strongest day. ${bestDow.worst} is your weakest — consider a light prep session the night before.`} />

      </ChartCard>

      <ChartCard title="Streak impact analysis" onExpand={() => setExpanded("Streak impact analysis")}>

        <BeforeAfter rows={rows} goals={goals} />

        <Insight text={streakImpact(rows, goals)} />

      </ChartCard>

    </View>}
    {desk === "hydration" && !(rows.some(r => r.waterMl > 0)) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "hydration" && (rows.some(r => r.waterMl > 0)) && <View style={{ gap: 20 }}>
      <Heading title="Hydration Analytics" />

      <ChartCard title="Hydration trend" onExpand={() => setExpanded("Hydration trend")}>

        <LineChart values={rows.map((r) => r.waterMl)} color={C.blue} goal={goals.waterMl} />

        <Insight text={`You've hit hydration goal ${waterHits}/${rows.length} days this range.`} />

      </ChartCard>

      <ChartCard title="Hydration vs performance" onExpand={() => setExpanded("Hydration vs performance")}>

        <CompareColumns hydrated={hydrated} dry={dry} goals={goals} />

        <Insight text={hydrationPerformanceInsight(hydrated, dry, goals)} />

      </ChartCard>

      <ChartCard title="Hydration streak" onExpand={() => setExpanded("Hydration streak")}>

        <HydrationStreak rows={rows} goal={goals.waterMl} />

      </ChartCard>

    </View>}
    {desk === "activity" && !(rows.some(r => r.workouts > 0)) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "activity" && (rows.some(r => r.workouts > 0)) && <View style={{ gap: 20 }}>
      <Heading title="Workout & Activity Analytics" />

      <ChartCard title="Weekly volume" onExpand={() => setExpanded("Weekly volume")}>

        <WeeklyVolume rows={rows} goal={goals.workoutsPerWeek} />

        <Insight text={`You averaged ${(rows.length ? (sum(rows.map((r) => r.workouts)) / Math.max(1, rows.length / 7)) : 0).toFixed(1)} sessions/week. Goal: ${goals.workoutsPerWeek}.`} />

      </ChartCard>

      <ChartCard title="Calorie burn trend" onExpand={() => setExpanded("Calorie burn trend")}>

        <DualLine a={rows.map((r) => Math.round(r.steps * 0.04))} b={rows.map((r) => r.burn)} />

        <Insight text={`Workout burn accounts for ${Math.round((sum(rows.map((r) => r.burn)) / Math.max(1, sum(rows.map((r) => r.burn + r.steps * 0.04)))) * 100)}% of activity calories.`} />

      </ChartCard>

      <ChartCard title="Rest vs active split" onExpand={() => setExpanded("Rest vs active split")}>

        <ActivityDonut active={activeDays} total={rows.length} />

        <Insight text={`${activeDays} active days out of last ${rows.length}. Ideal for a cut: 4-5 active days/week.`} />

      </ChartCard>

      <ChartCard title="Workout consistency heatmap" onExpand={() => setExpanded("Workout consistency heatmap")}>

        <WorkoutHeatmap rows={rows} />

        <Insight text={`Most consistent workout day: ${bestDow.workoutBest}. Least consistent: ${bestDow.workoutWorst}.`} />

      </ChartCard>

    </View>}
    {desk === "projection" && !(foodsInRange.length > 0) && <Empty title="No records in this range" detail="Record data or choose a wider period to explore this metric." />}
    {desk === "projection" && (foodsInRange.length > 0) && <View style={{ gap: 20 }}>
      <Heading title="Goal Projection Engine" />

      <ProjectionCard rows={rows} profile={profile} onAdjust={() => router.replace("/(tabs)/profile")} />

    </View>}
    <Text style={F.caption}>{aiLine}</Text>
  </TaskPage>);
}

function blank(date: string): DayRow {
  return { date, calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, workouts: 0, burn: 0, steps: 0 };
}

function buildMealStats(foods: FoodEntry[]) {
  const proteinByMeal = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<MealKey, number>;
  const caloriesByMeal = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<MealKey, number>;
  const caloriesByDowMeal = Array.from({ length: 7 }, () => Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<MealKey, number>);
  const hours = foods.map(createdHour).sort((a, b) => a - b);
  foods.forEach((f) => {
    const m = mealKey(f.meal);
    proteinByMeal[m] += n(f.protein);
    caloriesByMeal[m] += n(f.calories);
    const dow = (new Date(`${String(f.date).slice(0, 10)}T12:00:00`).getDay() + 6) % 7;
    caloriesByDowMeal[dow][m] += n(f.calories);
  });
  const days = new Set(foods.map((f) => String(f.date).slice(0, 10))).size || 1;
  MEALS.forEach((m) => {
    proteinByMeal[m] = Math.round(proteinByMeal[m] / days);
    caloriesByMeal[m] = Math.round(caloriesByMeal[m] / days);
  });
  const totalCal = sum(Object.values(caloriesByMeal));
  const totalProtein = sum(Object.values(proteinByMeal));
  return {
    proteinByMeal,
    caloriesByMeal,
    caloriesByDowMeal,
    dinnerCalorieShare: totalCal ? caloriesByMeal.dinner / totalCal : 0,
    dinnerProteinShare: totalProtein ? proteinByMeal.dinner / totalProtein : 0,
    eatingWindow: hours.length >= 2 ? Math.round((hours[hours.length - 1] - hours[0]) * 10) / 10 : 0,
  };
}

function Card({ children, style }: { children: React.ReactNode; style?: any; }) {
  const C = useC();
  return <View style={[{ borderRadius: 18, borderWidth: 0, borderColor: C.hairline, backgroundColor: C.card, padding: 14 }, style]}>
    {children}
  </View>;
}

function ChartCard({ title, children, onExpand }: { title: string; children: React.ReactNode; onExpand: () => void; }) {
  const C = useC();
  return (<Panel>
    <Heading title={title} />
    {children}
  </Panel>
  );
}

function EmptyState({ text }: { text: string; }) {
  const C = useC();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>

      <Ionicons name="analytics-outline" size={18} color={C.muted} />

      <Text style={{ color: C.muted, fontWeight: "500", flex: 1 }}>{text}</Text>

    </Card>
  );
}

function Insight({ text }: { text: string; }) {
  const C = useC();
  return <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 18 }}>{text}</Text>;
}

function DeltaBars({ values }: { values: number[]; }) {
  const C = useC();
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <Svg width="100%" height={150} viewBox={`0 0 ${W} 150`}>

      <Line x1={12} x2={W - 12} y1={75} y2={75} stroke={C.text} strokeOpacity={0.5} strokeWidth={2} />

      {values.map((v, i) => {
        const h = Math.max(2, (Math.abs(v) / max) * 60);
        const x = 16 + (i / Math.max(1, values.length)) * (W - 32);
        return <Rect key={i} x={x} y={v >= 0 ? 75 - h : 75} width={Math.max(3, (W - 42) / Math.max(7, values.length))} height={h} rx={3} fill={v >= 0 ? C.amber : C.purple} />;
      })}

    </Svg>
  );
}

function MealHeatmap({ stats }: { stats: Record<MealKey, number>[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const max = Math.max(...stats.flatMap((d) => MEALS.map((m) => d[m])), 1);
  return (
    <View style={{ gap: 7 }}>

      {MEALS.map((m) => (
        <View key={m} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>

          <Text style={{ color: C.muted, width: 62, fontSize: 10, fontWeight: "500", textTransform: "capitalize" }}>{m}</Text>

          {stats.map((d, i) => <View key={i} style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: alpha(C.purple, 0.08 + 0.62 * (d[m] / max)) }} />)}

        </View>
      ))}

    </View>
  );
}

function MealTimeline({ foods, rows }: { foods: FoodEntry[]; rows: DayRow[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const byDay = rows.map((r) => foods.filter((f) => String(f.date).slice(0, 10) === r.date));
  return (
    <View style={{ gap: 8 }}>

      {byDay.slice(-Math.min(7, rows.length)).map((fs, i) => (
        <View key={i} style={{ height: 24, borderRadius: 12, backgroundColor: C.card2, overflow: "hidden" }}>

          {fs.map((f) => (
            <View key={f.id} style={{ position: "absolute", left: `${(createdHour(f) / 24) * 100}%`, top: 4, width: Math.max(7, Math.min(20, n(f.calories) / 35)), height: Math.max(7, Math.min(20, n(f.calories) / 35)), borderRadius: 999, backgroundColor: alpha(C.teal, 0.82) }} />
          ))}

        </View>
      ))}

    </View>
  );
}

function StackedMealBars({ rows, foods, goal, nutrient, colors }: { rows: DayRow[]; foods: FoodEntry[]; goal: number; nutrient: "protein"; colors: string[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const max = Math.max(goal, ...rows.map((r) => r.protein), 1);
  return (
    <Svg width="100%" height={150} viewBox={`0 0 ${W} 150`}>

      <Line x1={12} x2={W - 12} y1={150 - (goal / max) * 128 - 12} y2={150 - (goal / max) * 128 - 12} stroke={C.text} strokeOpacity={0.45} strokeDasharray="5 5" />

      {rows.map((r, i) => {
        const dayFoods = foods.filter((f) => String(f.date).slice(0, 10) === r.date);
        let y = 138;
        const x = 16 + (i / Math.max(1, rows.length)) * (W - 32);
        return MEALS.map((m, mi) => {
          const val = sum(dayFoods.filter((f) => mealKey(f.meal) === m).map((f) => n(f[nutrient])));
          const h = (val / max) * 120;
          y -= h;
          return <Rect key={`${r.date}-${m}`} x={x} y={y} width={Math.max(3, (W - 42) / Math.max(7, rows.length))} height={Math.max(0, h)} rx={2} fill={colors[mi]} />;
        });
      })}

    </Svg>
  );
}

function HorizontalMealBars({ values }: { values: Record<MealKey, number>; }) {
  const C = useC();
  const max = Math.max(...Object.values(values), 30, 1);
  return <View style={{ gap: 9 }}>
    {MEALS.map((m) => {
      const v = values[m];
      const color = v >= 30 ? C.green : v >= 15 ? C.amber : C.red;
      return <View key={m} style={{ gap: 4 }}>
        <View style={{ flexDirection: "row" }}>
          <Text style={{ color: C.text, fontWeight: "600", textTransform: "capitalize", flex: 1 }}>{m}</Text>
          <Text style={{ color, fontWeight: "600" }}>{Math.round(v)}g</Text>
        </View>
        <View style={{ height: 8, borderRadius: 999, backgroundColor: C.gray }}>
          <View style={{ width: `${Math.min(100, (v / max) * 100)}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
        </View>
      </View>;
    })}
  </View>;
}

function Gauge({ value, max, label }: { value: number; max: number; label: string; lowerBetter?: boolean; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const pct = clamp01(value / max);
  const c = 2 * Math.PI * 44;
  return <View style={{ alignItems: "center" }}>
    <Svg width={140} height={140} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={44} stroke={C.gray} strokeWidth={12} fill="none" />
      <Circle cx={60} cy={60} r={44} stroke={value <= 9 ? C.green : value <= 14 ? C.amber : C.red} strokeWidth={12} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <SvgText x={60} y={64} fill={C.text} fontSize="17" fontWeight="900" textAnchor="middle">{label}</SvgText>
    </Svg>
  </View>;
}

function MacroBands({ rows }: { rows: DayRow[]; }) {
  const C = useC();
  return <View style={{ gap: 5 }}>
    {rows.map((r) => {
      const total = Math.max(1, r.protein * 4 + r.carbs * 4 + r.fat * 9);
      return <View key={r.date} style={{ height: 11, borderRadius: 999, overflow: "hidden", flexDirection: "row", backgroundColor: C.gray }}>
        <View style={{ flex: (r.protein * 4) / total, backgroundColor: C.purple }} />
        <View style={{ flex: (r.carbs * 4) / total, backgroundColor: C.teal }} />
        <View style={{ flex: (r.fat * 9) / total, backgroundColor: C.amber }} />
      </View>;
    })}
  </View>;
}

function Radar({ values }: { values: number[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const center = 80;
  const r = 58;
  const pts = values.map((v, i) => {
    const a = -Math.PI / 2 + (i / values.length) * Math.PI * 2;
    return `${center + Math.cos(a) * r * clamp01(v)},${center + Math.sin(a) * r * clamp01(v)}`;
  }).join(" ");
  const outer = values.map((_, i) => {
    const a = -Math.PI / 2 + (i / values.length) * Math.PI * 2;
    return `${center + Math.cos(a) * r},${center + Math.sin(a) * r}`;
  }).join(" ");
  return <Svg width="100%" height={170} viewBox="0 0 160 160">
    <Polygon points={outer} fill="none" stroke={alpha(C.text, 0.28)} strokeWidth={1.5} />
    <Polygon points={pts} fill={alpha(C.purple, 0.32)} stroke={C.purple} strokeWidth={2} />
  </Svg>;
}

function ScoreRing({ score }: { score: number; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const c = 2 * Math.PI * 42;
  return <View style={{ alignItems: "center" }}>
    <Svg width={132} height={132} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={42} stroke={C.gray} strokeWidth={12} fill="none" />
      <Circle cx={60} cy={60} r={42} stroke={C.purple} strokeWidth={12} fill="none" strokeDasharray={`${c * clamp01(score / 100)} ${c}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <SvgText x={60} y={66} fill={C.text} fontSize="28" fontWeight="900" textAnchor="middle">{score}</SvgText>
    </Svg>
    <Text style={{ color: C.muted, fontWeight: "500" }}>Higher = more consistent eating patterns</Text>
  </View>;
}

function WeightNoise({ values }: { values: number[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const smooth = values.map((_, i) => avg(values.slice(Math.max(0, i - 6), i + 1)));
  return <Svg width="100%" height={160} viewBox={`0 0 ${W} 160`}>
    {values.map((v, i) => { const p = point(values, i, 160); return <Circle key={i} cx={p.x} cy={p.y} r={3} fill={alpha(C.text, 0.28)} />; })}
    <Path d={pathFor(smooth, W, 160, undefined)} stroke={C.purple} strokeWidth={3} fill="none" />
    <Path d={pathFor(regression(values), W, 160, undefined)} stroke={alpha(C.text, 0.75)} strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
  </Svg>;
}
function point(values: number[], i: number, height = H) {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  return { x: 14 + (i / Math.max(1, values.length - 1)) * (W - 28), y: height - 14 - ((values[i] - min) / Math.max(1, max - min)) * (height - 28) };
}

function LineChart({ values, color, goal }: { values: number[]; color: string; goal?: number; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const max = Math.max(...values, goal || 0, 1);
  const gy = goal ? H - 14 - (goal / max) * (H - 28) : null;
  return <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
    {gy != null ? <Line x1={14} x2={W - 14} y1={gy} y2={gy} stroke={alpha(C.text, 0.4)} strokeDasharray="5 5" /> : null}
    <Path d={pathFor(values, W, H, undefined)} stroke={color} strokeWidth={3} fill="none" />
  </Svg>;
}

function CompositionBars({ weight, bodyFat, target }: { weight: number; bodyFat: number; target: number; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const lean = weight * (1 - bodyFat / 100);
  const fat = weight - lean;
  const goalFat = Math.max(0, target - lean);
  return <View style={{ flexDirection: "row", gap: 16, height: 150, alignItems: "flex-end", justifyContent: "center" }}>
    {[{ label: "Current", lean, fat }, { label: "Goal", lean, fat: goalFat }].map((x) => <View key={x.label} style={{ alignItems: "center", gap: 6 }}>
      <View style={{ width: 56, height: 120, borderRadius: 12, overflow: "hidden", justifyContent: "flex-end", backgroundColor: C.gray }}>
        <View style={{ height: `${(x.fat / Math.max(1, x.lean + x.fat)) * 100}%`, backgroundColor: alpha(C.text, 0.28) }} />
        <View style={{ height: `${(x.lean / Math.max(1, x.lean + x.fat)) * 100}%`, backgroundColor: C.blue }} />
      </View>
      <Text style={{ color: C.muted, fontWeight: "500" }}>{x.label}</Text>
    </View>)}
  </View>;
}

function DotCalendar({ dates, hits }: { dates: string[]; hits: Set<string>; }) {
  const C = useC();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
    {dates.map((d) => <View key={d} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: hits.has(d) ? C.purple : C.gray }} />)}
  </View>;
}

function Scatter({ rows, goals }: { rows: DayRow[]; goals: Goals; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const maxP = Math.max(...rows.map((r) => r.protein), goals.protein, 1);
  return <Svg width="100%" height={150} viewBox={`0 0 ${W} 150`}>
    {rows.map((r) => <Circle key={r.date} cx={18 + (r.protein / maxP) * (W - 36)} cy={Math.abs(r.calories - goals.calories) <= goals.calories * 0.1 ? 42 : 108} r={4} fill={r.protein >= goals.protein ? C.green : C.purple} opacity={0.8} />)}
    <Line x1={18} x2={W - 18} y1={112} y2={42} stroke={alpha(C.text, 0.42)} strokeDasharray="5 5" />
  </Svg>;
}

function DualLine({ a, b }: { a: number[]; b: number[]; }) {
  const localStore = useAccountStorage();
  const C = useC();
  return <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
    <Path d={pathFor(a, W, H, undefined)} stroke={C.teal} strokeWidth={2.6} fill="none" />
    <Path d={pathFor(b, W, H, undefined)} stroke={C.amber} strokeWidth={2.6} fill="none" />
  </Svg>;
}

function DowScore({ rows, goals }: { rows: DayRow[]; goals: Goals; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const vals = Array.from({ length: 7 }, (_, i) => {
    const ds = rows.filter((r) => new Date(`${r.date}T12:00:00`).getDay() === (i + 1) % 7);
    return avg(ds.map((d) => dayScore(d, goals)));
  });
  return <BarSimple values={vals} labels={["M", "T", "W", "T", "F", "S", "S"]} color={C.purple} />;
}

function BeforeAfter({ rows, goals }: { rows: DayRow[]; goals: Goals; }) {
  const localStore = useAccountStorage();
  const streak = rows.filter((r) => dayScore(r, goals) >= 0.7);
  const other = rows.filter((r) => dayScore(r, goals) < 0.7);
  return <CompareBars left={Math.round(avg(streak.map((r) => r.protein)))} right={Math.round(avg(other.map((r) => r.protein)))} leftLabel="Streak" rightLabel="Non-streak" />;
}

function CompareColumns({ hydrated, dry, goals }: { hydrated: DayRow[]; dry: DayRow[]; goals: Goals; }) {
  const C = useC();
  return <View style={{ flexDirection: "row", gap: 12 }}>
    <StatCol title="Hydrated days" rows={hydrated} goals={goals} />
    <View style={{ width: 1, backgroundColor: C.hairline }} />
    <StatCol title="Dry days" rows={dry} goals={goals} />
  </View>;
}
function StatCol({ title, rows, goals }: { title: string; rows: DayRow[]; goals: Goals; }) {
  const localStore = useAccountStorage();
  const C = useC();
  return <View style={{ flex: 1, gap: 6 }}>
    <Text style={{ color: C.text, fontWeight: "600" }}>{title}</Text>
    <Text style={{ color: C.muted, fontWeight: "500" }}>Protein {Math.round(avg(rows.map((r) => (r.protein / goals.protein) * 100)) || 0)}%</Text>
    <Text style={{ color: C.muted, fontWeight: "500" }}>Calories {Math.round(avg(rows.map((r) => (r.calories / goals.calories) * 100)) || 0)}%</Text>
    <Text style={{ color: C.muted, fontWeight: "500" }}>Steps {Math.round(avg(rows.map((r) => r.steps)) || 0).toLocaleString()}</Text>
  </View>;
}

function HydrationStreak({ rows, goal }: { rows: DayRow[]; goal: number; }) {
  const C = useC();
  let cur = 0, best = 0;
  rows.forEach((r) => { if (r.waterMl >= goal) { cur += 1; best = Math.max(best, cur); } else cur = 0; });
  return <View style={{ gap: 12 }}>
    <Text style={{ color: C.text, fontWeight: "600", fontSize: 28 }}>{cur} days</Text>
    <Text style={{ color: C.muted, fontWeight: "500" }}>Best hydration streak: {best} days</Text>
    <DotCalendar dates={rows.slice(-14).map((r) => r.date)} hits={new Set(rows.filter((r) => r.waterMl >= goal).map((r) => r.date))} />
  </View>;
}

function WeeklyVolume({ rows, goal }: { rows: DayRow[]; goal: number; }) {
  const localStore = useAccountStorage();
  const C = useC();
  const weeks: number[] = [];
  for (let i = 0; i < rows.length; i += 7) weeks.push(sum(rows.slice(i, i + 7).map((r) => r.workouts)));
  return <BarSimple values={weeks} labels={weeks.map((_, i) => `W${i + 1}`)} color={C.green} goal={goal} />;
}
function WorkoutHeatmap({ rows }: { rows: DayRow[]; }) {
  const C = useC();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
    {rows.map((r) => <View key={r.date} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: r.workouts ? C.teal : C.gray }} />)}
  </View>;
}

function ActivityDonut({ active, total }: { active: number; total: number; }) {
  const C = useC();
  const c = 2 * Math.PI * 42;
  const pct = total ? active / total : 0;
  return <View style={{ alignItems: "center" }}>
    <Svg width={132} height={132} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={42} stroke={C.gray} strokeWidth={14} fill="none" />
      <Circle cx={60} cy={60} r={42} stroke={C.teal} strokeWidth={14} fill="none" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 60 60)" />
      <SvgText x={60} y={65} fill={C.text} fontSize="22" fontWeight="900" textAnchor="middle">{active}/{total}</SvgText>
    </Svg>
  </View>;
}

function BarSimple({ values, labels, color, goal }: { values: number[]; labels: string[]; color: string; goal?: number; }) {
  const C = useC();
  const max = Math.max(...values, goal || 0, 1);
  return <View style={{ height: 142, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
    {values.map((v, i) => <View key={i} style={{ flex: 1, alignItems: "center", gap: 5 }}>
      <View style={{ width: "100%", height: Math.max(6, (v / max) * 108), borderRadius: 9, backgroundColor: color }} />
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: "600" }}>{labels[i]}</Text>
    </View>)}
  </View>;
}
function CompareBars({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel: string; rightLabel: string; }) {
  const C = useC();
  const max = Math.max(left, right, 1);
  return <View style={{ gap: 10 }}>
    <BarLine label={leftLabel} value={left} max={max} color={C.green} />
    <BarLine label={rightLabel} value={right} max={max} color={C.amber} />
  </View>;
}
function BarLine({ label, value, max, color }: { label: string; value: number; max: number; color: string; }) {
  const C = useC();
  return <View style={{ gap: 5 }}>
    <View style={{ flexDirection: "row" }}>
      <Text style={{ color: C.text, fontWeight: "600", flex: 1 }}>{label}</Text>
      <Text style={{ color, fontWeight: "600" }}>{value}g</Text>
    </View>
    <View style={{ height: 9, borderRadius: 999, backgroundColor: C.gray }}>
      <View style={{ width: `${(value / max) * 100}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
    </View>
  </View>;
}

function ProjectionCard({ rows, profile, onAdjust }: { rows: DayRow[]; profile: Profile | null; onAdjust: () => void; }) {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const C = useC();
  const current = Math.round((avg(rows.map((r) => r.calories)) - nutritionTargets(profile).calories) / 500 * 10) / 10;
  const targetDate = (weeks: number) => new Date(Date.now() + weeks * 7 * 86400000).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const scenarios = [
    { tone: C.red, name: "Current pace", pace: `${current.toFixed(1)} lb/wk`, eta: targetDate(36), detail: "Keep current logging and nutrition averages." },
    { tone: C.amber, name: "+1 protein day/wk", pace: `${(current - 0.2).toFixed(1)} lb/wk`, eta: targetDate(24), detail: "Add one extra protein-goal day each week." },
    { tone: C.green, name: "Full goal hit", pace: `${(current - 0.5).toFixed(1)} lb/wk`, eta: targetDate(16), detail: "Hit calories, protein, hydration, and workout targets consistently." },
  ];
  const [expanded, setExpanded] = useState<string | null>(null);
  return (<Panel>
    <Heading title="Calculator scenarios" detail="Illustrative assumptions, not measured weight forecasts or FitAdapt advice." />
    <Text style={F.body}>This legacy calculator uses the selected nutrition average against your current target. The scenario offsets and 36, 24 and 16 week horizons are fixed assumptions; they do not predict when you will reach a goal.</Text>
    {scenarios.map((s, i) => <Item key={s.name} title={s.name} value={`${s.pace} · hypothetical ${[36, 24, 16][i]}-week horizon`} detail={expanded === s.name ? `${s.detail} Illustration ends ${s.eta}.` : undefined} onPress={() => setExpanded(expanded === s.name ? null : s.name)} />)}
    <Button label="Edit saved goals" onPress={onAdjust} />
  </Panel>
  );
}

function iconBtn(C: ReturnType<typeof useC>) {
  return { width: 44, height: 44, borderRadius: 14, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 0, borderColor: C.hairline, backgroundColor: C.card };
}

function proteinMealInsight(v: Record<MealKey, number>) {
  const weakest = MEALS.map((m) => ({ m, v: v[m] })).sort((a, b) => a.v - b.v)[0];
  return `${weakest.m[0].toUpperCase()}${weakest.m.slice(1)} averages only ${Math.round(weakest.v)}g — add one simple protein anchor.`;
}
function macroShiftInsight(rows: DayRow[]) {
  const first = rows.slice(0, Math.ceil(rows.length / 2));
  const last = rows.slice(Math.floor(rows.length / 2));
  const carbPct = (rs: DayRow[]) => avg(rs.map((r) => (r.carbs * 4) / Math.max(1, r.protein * 4 + r.carbs * 4 + r.fat * 9)));
  const delta = Math.round((carbPct(last) - carbPct(first)) * 100);
  return `Your carb ratio has ${delta >= 0 ? "increased" : "decreased"} by ${Math.abs(delta)}% over this range.`;
}
function complianceInsight(rows: DayRow[], goals: Goals) {
  const vals: Array<{ label: string; value: number; }> = [
    { label: "Calories", value: avg(rows.map((r) => r.calories / goals.calories)) },
    { label: "Protein", value: avg(rows.map((r) => r.protein / goals.protein)) },
    { label: "Carbs", value: avg(rows.map((r) => r.carbs / goals.carbs)) },
    { label: "Fat", value: avg(rows.map((r) => r.fat / goals.fat)) },
    { label: "Hydration", value: avg(rows.map((r) => r.waterMl / goals.waterMl)) },
  ].sort((a, b) => b.value - a.value);
  return `Strongest compliance is ${vals[0].label} (${Math.round(vals[0].value * 100)}%). Weakest: ${vals[vals.length - 1].label} (${Math.round(vals[vals.length - 1].value * 100)}%).`;
}
function macroConsistency(rows: DayRow[]) {
  const ratios = rows.filter((r) => r.calories > 0).map((r) => [(r.protein * 4) / Math.max(1, r.calories), (r.carbs * 4) / Math.max(1, r.calories), (r.fat * 9) / Math.max(1, r.calories)]);
  const variance = avg([0, 1, 2].map((i) => avg(ratios.map((r) => Math.abs(r[i] - avg(ratios.map((x) => x[i])))))));
  return Math.max(0, Math.min(100, Math.round(100 - variance * 220)));
}
function macroVarianceInsight(rows: DayRow[]) {
  const vars = [
    ["Protein", rows.map((r) => r.protein)],
    ["Carbs", rows.map((r) => r.carbs)],
    ["Fat", rows.map((r) => r.fat)],
  ].map(([name, vals]: any) => ({ name, v: avg(vals.map((x: number) => Math.abs(x - avg(vals)))) })).sort((a, b) => b.v - a.v);
  return `${vars[0]?.name || "Macro"} variance is your biggest inconsistency factor.`;
}
function velocity(weights: { value: number; }[]) {
  return weights.map((w, i) => (i ? (w.value - weights[Math.max(0, i - 1)].value) * 7 : 0));
}
function weightTrendInsight(weights: { value: number; }[]) {
  const delta = weights.length > 1 ? weights[weights.length - 1].value - weights[0].value : 0;
  const weekly = (delta / Math.max(1, weights.length / 7)).toFixed(1);
  return `True trend: ${weekly} lb/week · rolling average separates water weight from signal.`;
}
function velocityInsight(v: number[]) {
  const cur = v[v.length - 1] || 0;
  if (cur < -1.5) return "Rate is fast. Consider protecting protein and recovery.";
  if (cur < -0.2) return "You're losing at a healthy pace. Stay the course.";
  return "Velocity is slow. Tighten the smallest repeatable habit first.";
}
function proteinCorrelationInsight(rows: DayRow[], goals: Goals) {
  const high = rows.filter((r) => r.protein >= goals.protein * 0.9);
  const hit = high.filter((r) => Math.abs(r.calories - goals.calories) <= goals.calories * 0.1).length;
  return `On days you hit ${Math.round(goals.protein * 0.9)}g+ protein, you hit calorie goal ${Math.round((hit / Math.max(1, high.length)) * 100)}% of the time.`;
}
function bestWorstDow(rows: DayRow[], goals: Goals) {
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const vals = labels.map((label, i) => ({ label, score: avg(rows.filter((r) => new Date(`${r.date}T12:00:00`).getDay() === (i + 1) % 7).map((r) => dayScore(r, goals))), workouts: sum(rows.filter((r) => new Date(`${r.date}T12:00:00`).getDay() === (i + 1) % 7).map((r) => r.workouts)) }));
  return { best: [...vals].sort((a, b) => b.score - a.score)[0]?.label || "Tuesday", worst: [...vals].sort((a, b) => a.score - b.score)[0]?.label || "Sunday", workoutBest: [...vals].sort((a, b) => b.workouts - a.workouts)[0]?.label || "Tuesday", workoutWorst: [...vals].sort((a, b) => a.workouts - b.workouts)[0]?.label || "Weekend" };
}
function streakImpact(rows: DayRow[], goals: Goals) {
  const streak = rows.filter((r) => dayScore(r, goals) >= 0.7);
  const other = rows.filter((r) => dayScore(r, goals) < 0.7);
  const diff = Math.round(avg(streak.map((r) => r.protein)) - avg(other.map((r) => r.protein)));
  return `During streak-quality days, protein avg is ${diff >= 0 ? diff : 0}g higher per day.`;
}
function hydrationPerformanceInsight(h: DayRow[], d: DayRow[], goals: Goals) {
  const diff = Math.round(avg(h.map((r) => (r.protein / goals.protein) * 100)) - avg(d.map((r) => (r.protein / goals.protein) * 100)));
  return `On well-hydrated days, protein compliance is ${Math.max(0, diff)}% higher.`;
}
