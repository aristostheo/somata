// app/(modals)/long-term-progress.tsx
// Drop-in ✅
// Premium full-screen modal (also works as pushed page) for Long-term Progress
// Depends on: expo-router, expo-linear-gradient, expo-blur, expo-haptics, react-native-reanimated
// Uses your ThemeProvider: { colors, isDark }

import React, { useEffect, useMemo, useState } from "react";
import { nutritionTargets } from "@/services/nutritionTargets";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";
import {
  loadBodyMetrics,
  loadBodyMetricsHistory,
} from "@/services/profile/bodyMetrics";
import { subscribeProfile } from "@/services/profile";
import { subscribeFoodsBetween } from "@/services/nutrition";
import { subscribeWorkouts } from "@/services/workouts";
import {
  type RangeKey,
  RANGE_OPTIONS,
  computeSignalLabel,
  emaSmooth,
  filterByRange,
  formatDelta,
  formatValue,
  normalizeBars,
  type SeriesPoint,
} from "@/services/profile/longTermProgress";

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

function HeaderButton({
  onPress,
  icon,
  accessibilityLabel,
}: {
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const p = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(p.value ? 0.96 : 1, { damping: 18 }) }],
    };
  });

  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => (p.value = 1)}
        onPressOut={() => (p.value = 0)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: withAlpha(colors.card, pressed ? 0.55 : 0.42),
            borderColor: withAlpha(colors.border, 0.35),
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.rangeWrap,
        {
          backgroundColor: withAlpha(colors.card, 0.35),
          borderColor: withAlpha(colors.border, 0.28),
        },
      ]}
    >
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={async () => {
              if (opt.key === value) return;
              try {
                await Haptics.selectionAsync();
              } catch {}
              onChange(opt.key);
            }}
            style={({ pressed }) => [
              styles.rangePill,
              {
                backgroundColor: active
                  ? withAlpha(colors.text, 0.12)
                  : "transparent",
                borderColor: active
                  ? withAlpha(colors.text, 0.16)
                  : "transparent",
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                { color: active ? colors.text : withAlpha(colors.text, 0.72) },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: withAlpha(colors.card, 0.35),
          borderColor: withAlpha(colors.border, 0.25),
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: withAlpha(colors.text, 0.7) }]}>
        {label}
      </Text>
      <Text
        style={[styles.chipValue, { color: colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function CalmBars({
  points,
  height = 118,
  barCount = 28,
}: {
  points: SeriesPoint[];
  height?: number;
  barCount?: number;
}) {
  const { colors } = useTheme();

  const values = useMemo(() => points.map((p) => p.value), [points]);
  const smoothed = useMemo(() => emaSmooth(values, 0.28), [values]);
  const bars = useMemo(
    () => normalizeBars(smoothed, barCount),
    [smoothed, barCount]
  );

  return (
    <View
      style={[
        styles.chartWrap,
        {
          height,
          backgroundColor: withAlpha(colors.card, 0.18),
          borderColor: withAlpha(colors.border, 0.22),
        },
      ]}
    >
      <View style={styles.barsRow}>
        {bars.map((b, idx) => {
          const isRecent = idx >= bars.length - 5;
          return (
            <View key={idx} style={styles.barSlot}>
              <View
                style={{
                  height: Math.max(6, b * (height - 18)),
                  width: 10,
                  borderRadius: 999,
                  backgroundColor: withAlpha(
                    colors.accent ?? "#d6b36a",
                    isRecent ? 0.8 : 0.58
                  ),
                  shadowColor: colors.accent ?? "#d6b36a",
                  shadowOpacity: isRecent ? 0.18 : 0.08,
                  shadowRadius: isRecent ? 10 : 6,
                  shadowOffset: { width: 0, height: 6 },
                }}
              />
            </View>
          );
        })}
      </View>

      {/* soft bottom fade */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          "transparent",
          withAlpha("#000000", Platform.OS === "ios" ? 0.18 : 0.26),
        ]}
        style={styles.chartFade}
      />
    </View>
  );
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

  return (
    <Animated.View style={aStyle}>
      <Pressable
        onPress={async () => {
          try {
            await Haptics.selectionAsync();
          } catch {}
          setFocused((v) => !v);
        }}
        onPressIn={() => (press.value = 1)}
        onPressOut={() => (press.value = 0)}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: withAlpha(colors.border, 0.28),
            backgroundColor: withAlpha(colors.card, pressed ? 0.42 : 0.34),
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {title}
            </Text>
            <Text
              style={[
                styles.cardSubtitle,
                { color: withAlpha(colors.text, 0.68) },
              ]}
            >
              {subtitle}
            </Text>
            {infoText ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={withAlpha(colors.text, 0.6)}
                />
                <Text
                  style={[
                    styles.infoText,
                    { color: withAlpha(colors.text, 0.66) },
                  ]}
                >
                  {infoText}
                </Text>
              </View>
            ) : null}
          </View>
          <Ionicons
            name="chevron-down"
            size={18}
            color={withAlpha(colors.text, 0.7)}
          />
        </View>

        {hasEnough ? (
          <CalmBars
            points={series}
            height={focused ? 132 : 118}
            barCount={28}
          />
        ) : (
          <View
            style={[
              styles.emptyChart,
              {
                backgroundColor: withAlpha(colors.card, 0.18),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            <Ionicons
              name="analytics-outline"
              size={18}
              color={withAlpha(colors.text, 0.6)}
            />
            <Text
              style={[styles.emptyText, { color: withAlpha(colors.text, 0.7) }]}
            >
              {series.length === 0
                ? "No entries yet."
                : "Not enough points to show a stable signal yet."}
            </Text>

            {!!onPressOptionalCTA && !!ctaLabel && (
              <Pressable
                onPress={onPressOptionalCTA}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  {
                    backgroundColor: withAlpha(
                      colors.text,
                      pressed ? 0.14 : 0.1
                    ),
                    borderColor: withAlpha(colors.text, 0.12),
                  },
                ]}
              >
                <Text style={[styles.ctaText, { color: colors.text }]}>
                  {ctaLabel}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={withAlpha(colors.text, 0.85)}
                />
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.chipsRow}>
          <MetricChip
            label="Latest"
            value={latest == null ? "—" : `${formatValue(latest)} ${unit}`}
          />
          <MetricChip
            label="Change"
            value={delta == null ? "—" : `${formatDelta(delta)} ${unit}`}
          />
          <MetricChip label="Signal" value={signal} />
        </View>

        <Text
          style={[styles.footerNote, { color: withAlpha(colors.text, 0.68) }]}
        >
          Daily swings are normal. This view is meant to be a calm signal — not
          pressure.
        </Text>

        {focused ? (
          <View
            style={[
              styles.detailsWrap,
              {
                backgroundColor: withAlpha(colors.card, 0.22),
                borderColor: withAlpha(colors.border, 0.28),
              },
            ]}
          >
            <View style={styles.detailsHeader}>
              <Text style={[styles.detailsTitle, { color: colors.text }]}>
                Details
              </Text>
              <Text
                style={[
                  styles.detailsSubtitle,
                  { color: withAlpha(colors.text, 0.7) },
                ]}
              >
                {series.length
                  ? `${series.length} entries • ${formatFullDate(
                      seriesStart as number
                    )} → ${formatFullDate(seriesEnd as number)}`
                  : "No entries yet"}
              </Text>
            </View>

            {series.length ? (
              <View style={styles.statsRow}>
                <MetricChip
                  label="Min"
                  value={
                    minVal == null
                      ? "—"
                      : `${formatValue(minVal)}${unit ? ` ${unit}` : ""}`
                  }
                />
                <MetricChip
                  label="Max"
                  value={
                    maxVal == null
                      ? "—"
                      : `${formatValue(maxVal)}${unit ? ` ${unit}` : ""}`
                  }
                />
                <MetricChip label="Days" value={`${series.length}`} />
              </View>
            ) : null}

            {recentPoints.length ? (
              <View style={styles.pointList}>
                {recentPoints.map((p, idx) => (
                  <View
                    key={`${p.date}-${idx}`}
                    style={[
                      styles.pointRow,
                      { borderColor: withAlpha(colors.border, 0.2) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pointDate,
                        { color: withAlpha(colors.text, 0.7) },
                      ]}
                    >
                      {formatShortDate(p.date)}
                    </Text>
                    <Text style={[styles.pointValue, { color: colors.text }]}>
                      {`${formatValue(p.value)}${unit ? ` ${unit}` : ""}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default function LongTermProgressModal() {
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
      const goal = nutritionTargets(p, { calories: 2200, protein: 160, carbs: 260, fat: 70 }).calories;
      setCalorieGoal(goal);
    });
    return () => {
      unsub?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;

    const loadMetrics = async () => {
      const history = await loadBodyMetricsHistory();
      const current = await loadBodyMetrics();

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

  return (
    <View style={{ flex: 1, backgroundColor: bgBottom }}>
      <LinearGradient
        colors={[withAlpha(bgTop, 1), withAlpha(bgBottom, 1)]}
        style={StyleSheet.absoluteFill}
      />

      {/* glossy aurora */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(colors.accent ?? "#d6b36a", 0.18),
          "transparent",
          withAlpha("#6aa6ff", 0.1),
          "transparent",
        ]}
        start={{ x: 0.05, y: 0.0 }}
        end={{ x: 0.95, y: 1.0 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
      />

      <Animated.View entering={FadeInDown.duration(420)} style={{ flex: 1 }}>
        <View
          style={[
            styles.topBar,
            { borderBottomColor: withAlpha(colors.border, 0.18) },
          ]}
        >
          <HeaderButton
            icon={router.canGoBack() ? "chevron-back" : "close"}
            accessibilityLabel="Close"
            onPress={() => router.back()}
          />

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.title, { color: colors.text }]}>
              Long-term progress
            </Text>
            <Text
              style={[styles.subtitle, { color: withAlpha(colors.text, 0.68) }]}
            >
              Calm signal, not pressure.
            </Text>
          </View>

          {/* spacer for symmetry */}
          <View style={{ width: 44 }} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <RangeSelector value={range} onChange={setRange} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          <BlurView intensity={22} tint="dark" style={styles.sectionBlur}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.9) },
              ]}
            >
              Trends
            </Text>
            <Text
              style={[
                styles.sectionHint,
                { color: withAlpha(colors.text, 0.68) },
              ]}
            >
              These charts smooth noise to show direction gently over time.
            </Text>
          </BlurView>

          <TrendCard
            title="Weight trend"
            subtitle="A longer lens on your pattern."
            unit={unitFromParams}
            series={weightSeries}
            onPressOptionalCTA={() => {
              // hook this to your body metrics editor route
              // e.g. router.push("/(modals)/body-metrics-editor")
              try {
                Haptics.selectionAsync();
              } catch {}
            }}
            ctaLabel="Add a check-in"
          />

          <TrendCard
            title="Body fat %"
            subtitle="Only shown when you track it."
            unit="%"
            series={bfSeries}
            onPressOptionalCTA={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
            }}
            ctaLabel="Add body fat %"
          />

          <TrendCard
            title="Waist"
            subtitle="A practical measure — optional."
            unit="cm"
            series={waistSeries}
            onPressOptionalCTA={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
            }}
            ctaLabel="Add waist"
          />

          <View style={{ height: 8 }} />

          <BlurView intensity={18} tint="dark" style={styles.sectionBlur}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.9) },
              ]}
            >
              Consistency (optional)
            </Text>
            <Text
              style={[
                styles.sectionHint,
                { color: withAlpha(colors.text, 0.68) },
              ]}
            >
              This is about rhythm, not perfection.
            </Text>
          </BlurView>

          <TrendCard
            title="Training volume"
            subtitle="How much work you put in over time."
            unit="sets/wk"
            series={workoutSeries}
            onPressOptionalCTA={() => {}}
            ctaLabel="Connect workout data"
            infoText="Each bar is total working sets per week, smoothed for clarity."
          />

          <TrendCard
            title="Nutrition consistency"
            subtitle="How close you stay to your calorie target."
            unit=""
            series={nutritionSeries}
            onPressOptionalCTA={() => {}}
            ctaLabel="Connect nutrition data"
            infoText="Daily adherence score (0–1) vs your calorie goal."
          />

          <View
            style={[
              styles.safetyNote,
              {
                backgroundColor: withAlpha(colors.card, 0.28),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            <Ionicons
              name="heart-outline"
              size={18}
              color={withAlpha(colors.text, 0.78)}
            />
            <Text
              style={[
                styles.safetyText,
                { color: withAlpha(colors.text, 0.78) },
              ]}
            >
              Trends are shown as a calm signal. No streak guilt. No shame.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
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
