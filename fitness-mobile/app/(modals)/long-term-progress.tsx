import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Heading, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { Trend } from "@/components/somata/Trend";
// app/(modals)/long-term-progress.tsx
// Drop-in ✅
// Premium full-screen modal (also works as pushed page) for Long-term Progress
// Depends on: expo-router, expo-linear-gradient, expo-blur, expo-haptics, react-native-reanimated
// Uses your ThemeProvider: { colors, isDark }

import { nutritionTargets } from "@/services/nutritionTargets";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeFoodsBetween } from "@/services/nutrition";
import { subscribeProfile } from "@/services/profile";
import {
  loadBodyMetrics,
  loadBodyMetricsHistory,
} from "@/services/profile/bodyMetrics";
import {
  RANGE_OPTIONS,
  computeSignalLabel,
  filterByRange,
  type RangeKey,
  type SeriesPoint
} from "@/services/profile/longTermProgress";
import { subscribeWorkouts } from "@/services/workouts";

type MetricKey = "weight" | "bodyFat" | "waist" | "workouts" | "nutrition";

const MAX_CONSISTENCY_DAYS = 730;

function formatISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalMidnightMs(iso: string) {
  if (!iso) return NaN;
  return new Date(`${iso}T00:00:00`).getTime();
}

function normalizeSeries(points: SeriesPoint[]) {
  return points
    .filter((p) => Number.isFinite(p.date) && Number.isFinite(p.value))
    .sort((a, b) => a.date - b.date);
}

function buildConsistencySeries(dates: string[]): SeriesPoint[] {
  const cleanDates = dates.filter(
    (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
  );
  if (!cleanDates.length) return [];

  const dateSet = new Set(cleanDates);
  const sortedTs = cleanDates
    .map((d) => toLocalMidnightMs(d))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (!sortedTs.length) return [];

  const now = new Date();
  const todayIso = formatISODate(now);
  const todayTs = toLocalMidnightMs(todayIso);
  const earliestTs = sortedTs[0];
  const windowStartTs =
    todayTs - (MAX_CONSISTENCY_DAYS - 1) * 24 * 60 * 60 * 1000;
  const startTs = Math.max(earliestTs, windowStartTs);

  const days =
    Math.floor((todayTs - startTs) / (24 * 60 * 60 * 1000)) + 1;
  const points: SeriesPoint[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startTs + i * 24 * 60 * 60 * 1000);
    const iso = formatISODate(d);
    points.push({ date: d.getTime(), value: dateSet.has(iso) ? 1 : 0 });
  }

  return points;
}

function startOfWeekMonday(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0 (Sun) -> 6 (Sat)
  const diff = (day + 6) % 7; // shift so Monday=0
  out.setDate(out.getDate() - diff);
  return out;
}

function buildWeeklySetsSeries(args: {
  dates: string[];
  sets: number[];
  fromISO: string;
  toISO: string;
}): SeriesPoint[] {
  const { dates, sets, fromISO, toISO } = args;
  if (!dates.length) return [];

  const weekTotals = new Map<number, number>();

  for (let i = 0; i < dates.length; i++) {
    const iso = dates[i];
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const ts = toLocalMidnightMs(iso);
    if (!Number.isFinite(ts)) continue;
    const weekStart = startOfWeekMonday(new Date(ts)).getTime();
    const add = Number(sets[i] ?? 0);
    weekTotals.set(weekStart, (weekTotals.get(weekStart) ?? 0) + add);
  }

  const fromDate = startOfWeekMonday(new Date(`${fromISO}T00:00:00`));
  const toDate = startOfWeekMonday(new Date(`${toISO}T00:00:00`));
  const points: SeriesPoint[] = [];

  for (
    let t = fromDate.getTime();
    t <= toDate.getTime();
    t += 7 * 24 * 60 * 60 * 1000
  ) {
    points.push({ date: t, value: weekTotals.get(t) ?? 0 });
  }

  return points;
}

function adherenceScore(actual: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  if (!Number.isFinite(actual) || actual <= 0) return 0;
  const diffRatio = Math.abs(actual - goal) / goal;
  const penalty = diffRatio * (actual > goal ? 1.55 : 1.15);
  return Math.max(0, Math.min(1, 1 - penalty));
}

function buildCalorieAdherenceSeries(args: {
  totalsByDate: Map<string, number>;
  fromISO: string;
  toISO: string;
  goal: number;
}): SeriesPoint[] {
  const { totalsByDate, fromISO, toISO, goal } = args;
  if (!fromISO || !toISO) return [];

  const start = new Date(`${fromISO}T00:00:00`);
  const end = new Date(`${toISO}T00:00:00`);
  const points: SeriesPoint[] = [];

  for (
    let t = start.getTime();
    t <= end.getTime();
    t += 24 * 60 * 60 * 1000
  ) {
    const iso = formatISODate(new Date(t));
    const total = totalsByDate.get(iso);
    const score =
      total == null ? 0 : adherenceScore(Number(total || 0), goal);
    points.push({ date: t, value: score });
  }

  return points;
}

function weightToDisplay(
  weightLb: number,
  unit: string,
  precision = 1
) {
  if (!Number.isFinite(weightLb)) return NaN;
  if (unit === "kg") {
    return Number((weightLb / 2.20462).toFixed(precision));
  }
  return Number(weightLb.toFixed(precision));
}

function formatShortDate(ts: number) {
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}

function formatFullDate(ts: number) {
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

function TrendCard({
  title,
  subtitle,
  unit,
  series,
  onPressOptionalCTA,
  ctaLabel,
  infoText,
}: {
  title: string;
  subtitle: string;
  unit: string;
  series: SeriesPoint[];
  onPressOptionalCTA?: () => void;
  ctaLabel?: string;
  infoText?: string;
}) {
  const { D, F } = useSomataTheme();

  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const latest = series.length ? series[series.length - 1].value : null;
  const first = series.length ? series[0].value : null;
  const delta = latest != null && first != null ? latest - first : null;

  const signal = useMemo(() => {
    if (latest == null || first == null) return "Not enough data";
    return computeSignalLabel(first, latest);
  }, [first, latest]);

  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(press.value ? 0.985 : 1, { damping: 18 }) },
    ],
  }));

  const hasEnough = series.length >= 4;
  const recentPoints = useMemo(
    () => series.slice(-10).reverse(),
    [series]
  );
  const seriesStart = series.length ? series[0].date : null;
  const seriesEnd = series.length ? series[series.length - 1].date : null;
  const minVal = series.length
    ? Math.min(...series.map((p) => p.value))
    : null;
  const maxVal = series.length
    ? Math.max(...series.map((p) => p.value))
    : null;

  return (<><Panel>
    <Heading title={title} detail={subtitle} />
    <Text style={{ ...F.value, fontSize: 40 }}>{latest == null ? '—' : `${Math.round(latest * 10) / 10} ${unit}`}</Text>
    {hasEnough ? <Trend values={series.map(p => p.value)} labels={series.map(p => formatFullDate(p.date))} unit={unit} /> : <Text style={F.caption}>Record at least four entries to see this trend.</Text>}
    {delta != null && <Text style={F.caption}>{delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} {unit} over this period · {signal}</Text>}
    <Button label="Inspect records" onPress={() => setFocused(true)} />
  </Panel><TaskSheet title={title} visible={focused} onClose={() => setFocused(false)}>
      {infoText && <Text style={F.body}>{infoText}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Metric label="Minimum" value={minVal == null ? '—' : `${Math.round(minVal * 10) / 10} ${unit}`} />
        <Metric label="Maximum" value={maxVal == null ? '—' : `${Math.round(maxVal * 10) / 10} ${unit}`} />
        <Metric label="Records" value={String(series.length)} />
      </View>
      {recentPoints.map((p, i) => <Item key={i} title={formatFullDate(p.date)} value={`${Math.round(p.value * 10) / 10} ${unit}`} />)}
      {!recentPoints.length && <Text style={F.caption}>No recorded values in this range.</Text>}
    </TaskSheet></>
  );
}

export default function LongTermProgressModal() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Read from route params (sent from your TrendsCard press)
  // params must be strings, so series is JSON-encoded.
  const params = useLocalSearchParams<{
    unit?: string;
  }>();

  const unitFromParams = params.unit ?? "lb";

  const [range, setRange] = useState<RangeKey>("6m");
  const [weightSeriesRaw, setWeightSeriesRaw] = useState<SeriesPoint[]>([]);
  const [bfSeriesRaw, setBfSeriesRaw] = useState<SeriesPoint[]>([]);
  const [waistSeriesRaw, setWaistSeriesRaw] = useState<SeriesPoint[]>([]);
  const [workoutSeriesRaw, setWorkoutSeriesRaw] = useState<SeriesPoint[]>([]);
  const [nutritionSeriesRaw, setNutritionSeriesRaw] = useState<SeriesPoint[]>(
    []
  );
  const [calorieGoal, setCalorieGoal] = useState(2200);

  useEffect(() => {
    if (!user?.uid) {
      setCalorieGoal(2200);
      return;
    }
    const unsub = subscribeProfile(user.uid, (p) => {
      const goal = nutritionTargets(p).calories;
      setCalorieGoal(goal);
    });
    return () => {
      unsub?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;

    const loadMetrics = async () => {
      const history = await loadBodyMetricsHistory(localStore);
      const current = await loadBodyMetrics(localStore);

      const weightPoints: SeriesPoint[] = history
        .filter((p) => Number.isFinite(p.weightLb))
        .map((p) => ({
          date: p.t,
          value: weightToDisplay(p.weightLb as number, unitFromParams),
        }));

      const bfPoints: SeriesPoint[] = history
        .filter((p) => Number.isFinite(p.bodyFatPct))
        .map((p) => ({
          date: p.t,
          value: Number((p.bodyFatPct as number).toFixed(1)),
        }));

      const waistPoints: SeriesPoint[] = history
        .filter((p) => Number.isFinite(p.waistCm))
        .map((p) => ({
          date: p.t,
          value: Number((p.waistCm as number).toFixed(1)),
        }));

      if (current?.updatedAt) {
        const t = current.updatedAt;
        if (Number.isFinite(current.weightLb)) {
          weightPoints.push({
            date: t,
            value: weightToDisplay(current.weightLb as number, unitFromParams),
          });
        }
        if (Number.isFinite(current.bodyFatPct)) {
          bfPoints.push({
            date: t,
            value: Number((current.bodyFatPct as number).toFixed(1)),
          });
        }
        if (Number.isFinite(current.waistCm)) {
          waistPoints.push({
            date: t,
            value: Number((current.waistCm as number).toFixed(1)),
          });
        }
      }

      if (!mounted) return;
      setWeightSeriesRaw(normalizeSeries(weightPoints));
      setBfSeriesRaw(normalizeSeries(bfPoints));
      setWaistSeriesRaw(normalizeSeries(waistPoints));
    };

    loadMetrics().catch((e) => {
      console.warn("[long-term-progress] load metrics failed", e);
    });

    return () => {
      mounted = false;
    };
  }, [unitFromParams]);

  useEffect(() => {
    if (!user?.uid) {
      setWorkoutSeriesRaw([]);
      setNutritionSeriesRaw([]);
      return;
    }

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (MAX_CONSISTENCY_DAYS - 1));
    const fromISO = formatISODate(from);
    const toISO = formatISODate(now);

    const unsubFoods = subscribeFoodsBetween(
      user.uid,
      fromISO,
      toISO,
      (rows) => {
        const totals = new Map<string, number>();
        rows.forEach((r) => {
          const iso = r.date;
          if (!iso) return;
          const add = Number(r.calories ?? 0);
          totals.set(iso, (totals.get(iso) ?? 0) + add);
        });
        setNutritionSeriesRaw(
          buildCalorieAdherenceSeries({
            totalsByDate: totals,
            fromISO,
            toISO,
            goal: calorieGoal,
          })
        );
      }
    );

    const unsubWorkouts = subscribeWorkouts(
      user.uid,
      (rows) => {
        const dates = rows.map((r) => r.date).filter(Boolean);
        const sets = rows.map((r) => Number(r.sets ?? 0));
        setWorkoutSeriesRaw(
          buildWeeklySetsSeries({ dates, sets, fromISO, toISO })
        );
      },
      { from: fromISO, to: toISO, max: 2000 }
    );

    return () => {
      unsubFoods?.();
      unsubWorkouts?.();
    };
  }, [user?.uid, calorieGoal]);

  const weightSeries = useMemo(
    () => filterByRange(weightSeriesRaw, range),
    [weightSeriesRaw, range]
  );

  const bfSeries = useMemo(
    () => filterByRange(bfSeriesRaw, range),
    [bfSeriesRaw, range]
  );
  const waistSeries = useMemo(
    () => filterByRange(waistSeriesRaw, range),
    [waistSeriesRaw, range]
  );
  const workoutSeries = useMemo(
    () => filterByRange(workoutSeriesRaw, range),
    [workoutSeriesRaw, range]
  );
  const nutritionSeries = useMemo(
    () => filterByRange(nutritionSeriesRaw, range),
    [nutritionSeriesRaw, range]
  );

  const bgTop = isDark ? "#0B0F17" : "#0B0F17";
  const bgBottom = isDark ? "#070A10" : "#070A10";

  return (<TaskPage title="The longer view" section="Long-term progress" onBack={() => router.back()}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {RANGE_OPTIONS.map(o => <Choice key={o.key} label={o.label} selected={range === o.key} onPress={() => setRange(o.key)} />)}
    </View>
    <Text style={F.caption}>Recorded trends from the existing history sources. Nutrition consistency compares records with your current calorie goal.</Text>
    <TrendCard title="Weight" subtitle="Recorded weight over time" unit={unitFromParams} series={weightSeries} />
    <TrendCard title="Body fat" subtitle="Available measurements only" unit="%" series={bfSeries} />
    <TrendCard title="Waist" subtitle="Optional body measurements" unit="cm" series={waistSeries} />
    <TrendCard title="Training volume" subtitle="Working sets per week" unit="sets/wk" series={workoutSeries} />
    <TrendCard title="Nutrition consistency" subtitle="Daily adherence against the current calorie goal" unit="" series={nutritionSeries} />
  </TaskPage>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },

  rangeWrap: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 6,
  },
  rangePill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangeText: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: -0.1,
  },

  sectionBlur: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  sectionHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },

  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  infoRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },

  chartWrap: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: "hidden",
  },
  barsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  barSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -2,
    height: 44,
  },

  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  chipValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  footerNote: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
    lineHeight: 18,
  },

  emptyChart: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.1,
  },

  detailsWrap: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  detailsHeader: { gap: 2 },
  detailsTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  detailsSubtitle: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  pointList: {
    borderRadius: 14,
    overflow: "hidden",
  },
  pointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pointDate: { fontSize: 12.5, fontWeight: "700" },
  pointValue: { fontSize: 13.5, fontWeight: "800" },

  safetyNote: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
    lineHeight: 18,
  },
});
