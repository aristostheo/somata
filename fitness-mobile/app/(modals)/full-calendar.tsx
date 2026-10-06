import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayDetailSheet from "@/components/calendar/DayDetailSheet";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { getCalendarRangeData, type DayData } from "@/services/calendarData";
import { subscribeProfile, type Profile } from "@/services/profile";

type CalendarView = "month" | "week" | "year";

const VIEW_KEY = "@calendar:view:v2";
const SCREEN_WIDTH = Dimensions.get("window").width;

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return color;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), mondayOffset);
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function addWeeks(date: Date, delta: number) {
  return addDays(date, delta * 7);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDayLetter(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "narrow" });
}

function formatShortDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatNiceDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateKeysBetween(startDate: Date, endDate: Date) {
  const out: string[] = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    out.push(ymd(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

function buildMonthGrid(cursor: Date) {
  const first = startOfMonth(cursor);
  const shift = ((first.getDay() + 6) % 7);
  const start = addDays(first, -shift);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      inMonth: date.getMonth() === cursor.getMonth(),
    };
  });
}

function buildWeekDates(cursor: Date) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function buildYearCells(year: number) {
  const first = new Date(year, 0, 1);
  const last = new Date(year, 11, 31);
  const start = startOfWeek(first);
  const end = endOfWeek(last);
  const weeks: Date[][] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function activityDotsForDay(day: DayData | null, colors: ReturnType<typeof useTheme>["colors"]) {
  if (!day) return [];
  const dots: Array<{ key: string; color: string }> = [];
  if (day.nutrition?.logged) dots.push({ key: "nutrition", color: colors.accent });
  if (day.workout) dots.push({ key: "workout", color: colors.warning });
  if (day.hydration && day.hydration.logged >= day.hydration.goal) dots.push({ key: "hydration", color: colors.info || colors.accent });
  if (day.steps && day.steps.count >= day.steps.goal) dots.push({ key: "steps", color: colors.success });
  return dots.slice(0, 3);
}

function calorieBarColor(day: DayData | null, colors: ReturnType<typeof useTheme>["colors"]) {
  const ratio = day?.nutrition && day.nutrition.calorieGoal > 0
    ? day.nutrition.calories / day.nutrition.calorieGoal
    : 0;
  if (!day?.nutrition) return colors.surface3;
  if (ratio >= 0.9) return colors.success;
  if (ratio >= 0.7) return colors.accent;
  if (ratio >= 0.5) return colors.warning;
  return colors.danger;
}

function monthMotivation(percent: number) {
  if (percent >= 90) return "Each logged day is a vote for the person you're becoming.";
  if (percent >= 60) return "Good month. Push for one more green day.";
  return "Every day is a fresh start. Today counts.";
}

function countNutritionStreak(days: Record<string, DayData>, todayKey: string) {
  let streak = 0;
  let cursor = parseYmd(todayKey);
  while (true) {
    const key = ymd(cursor);
    if (!days[key]?.nutrition?.logged) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function bestNutritionStreak(days: Record<string, DayData>) {
  const keys = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of keys) {
    if (!days[key]?.nutrition?.logged) {
      run = 0;
      previous = key;
      continue;
    }
    if (!previous) {
      run = 1;
    } else {
      const diff = Math.round((parseYmd(key).getTime() - parseYmd(previous).getTime()) / 86400000);
      run = diff === 1 && days[previous]?.nutrition?.logged ? run + 1 : 1;
    }
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

function hasAnyData(day: DayData | null) {
  return !!(
    day?.nutrition?.logged ||
    day?.workout ||
    (day?.hydration && day.hydration.logged > 0) ||
    (day?.steps && day.steps.count > 0) ||
    day?.sleep ||
    day?.prs?.length ||
    typeof day?.weight === "number"
  );
}

function dayIsPerfect(day: DayData | null) {
  if (!day?.nutrition || !day.workout) return false;
  const caloriesOk = day.nutrition.calories >= day.nutrition.calorieGoal * 0.9;
  const proteinOk = day.nutrition.protein >= day.nutrition.proteinGoal * 0.9;
  return caloriesOk && proteinOk && day.overallScore >= 90;
}

function scoreTone(score: number, colors: ReturnType<typeof useTheme>["colors"]) {
  if (score >= 90) return colors.success;
  if (score >= 75) return colors.accent;
  if (score >= 50) return colors.warning;
  return colors.danger;
}

type StatTileProps = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
  accent?: string;
  rightAdornment?: React.ReactNode;
};

function StatTile({ label, value, icon, colors, isDark, accent, rightAdornment }: StatTileProps) {
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.border,
          shadowColor: isDark ? undefined : "#000000",
          shadowOpacity: isDark ? undefined : 0.04,
          shadowRadius: isDark ? undefined : 8,
          shadowOffset: isDark ? undefined : { width: 0, height: 1 },
          elevation: isDark ? 0 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
      <View style={styles.tileValueRow}>
        {icon ? <Ionicons name={icon} size={14} color={accent || colors.textSecondary} /> : null}
        <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value}</Text>
        {rightAdornment}
      </View>
    </View>
  );
}

export default function FullCalendarScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [yearCursor, setYearCursor] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(() => ymd(new Date()));
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [tooltipDate, setTooltipDate] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [reduceMotion, setReduceMotion] = useState(false);

  const pagerRef = useRef<ScrollView | null>(null);
  const monthOpacity = useRef(new Animated.Value(1)).current;
  const weekOpacity = useRef(new Animated.Value(1)).current;
  const yearOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (next) => setProfile(next || null));
  }, [user?.uid]);

  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY).then((stored) => {
      if (stored === "month" || stored === "week" || stored === "year") {
        setView(stored);
        requestAnimationFrame(() => {
          pagerRef.current?.scrollTo({ x: ["month", "week", "year"].indexOf(stored) * SCREEN_WIDTH, animated: false });
        });
      }
    });
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = (AccessibilityInfo as any).addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const loadRange = useMemo(() => {
    const monthStart = addDays(startOfMonth(monthCursor), -42);
    const monthEnd = addDays(endOfMonth(monthCursor), 42);
    const weekStart = addDays(startOfWeek(weekCursor), -7);
    const weekEnd = addDays(endOfWeek(weekCursor), 7);
    const yearStart = new Date(yearCursor, 0, 1);
    const yearEnd = new Date(yearCursor, 11, 31);
    const start = [monthStart, weekStart, yearStart].sort((a, b) => a.getTime() - b.getTime())[0];
    const end = [monthEnd, weekEnd, yearEnd].sort((a, b) => b.getTime() - a.getTime())[0];
    return { start: ymd(start), end: ymd(end) };
  }, [monthCursor, weekCursor, yearCursor]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    getCalendarRangeData(user.uid, loadRange.start, loadRange.end, profile).then((next) => {
      if (active) setDays(next);
    });
    return () => {
      active = false;
    };
  }, [loadRange.end, loadRange.start, profile, user?.uid]);

  const selectedDay = days[selectedDate] || null;
  const todayKey = ymd(new Date());
  const todayDay = days[todayKey] || null;

  const headerTitle = useMemo(() => {
    if (view === "month") return formatMonthYear(monthCursor);
    if (view === "week") return formatMonthYear(parseYmd(selectedDate));
    return String(yearCursor);
  }, [monthCursor, selectedDate, view, yearCursor]);

  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const weekDates = useMemo(() => buildWeekDates(weekCursor), [weekCursor]);
  const yearWeeks = useMemo(() => buildYearCells(yearCursor), [yearCursor]);

  const monthStats = useMemo(() => {
    const monthKeys = dateKeysBetween(startOfMonth(monthCursor), endOfMonth(monthCursor));
    const logged = monthKeys.filter((key) => days[key]?.nutrition?.logged).length;
    const total = monthKeys.filter((key) => parseYmd(key) <= new Date() || monthCursor.getMonth() !== new Date().getMonth()).length;
    const percent = total > 0 ? Math.round((logged / total) * 100) : 0;
    const streak = countNutritionStreak(days, todayKey);
    const best = bestNutritionStreak(days);
    return { logged, total, percent, streak, best };
  }, [days, monthCursor, todayKey]);

  const weekCalorieMax = useMemo(() => {
    return Math.max(
      1,
      ...weekDates.map((date) => days[ymd(date)]?.nutrition?.calories || 0),
      ...weekDates.map((date) => days[ymd(date)]?.nutrition?.calorieGoal || 0)
    );
  }, [days, weekDates]);

  const weekProteinMax = useMemo(() => {
    return Math.max(
      1,
      ...weekDates.map((date) => days[ymd(date)]?.nutrition?.protein || 0),
      ...weekDates.map((date) => days[ymd(date)]?.nutrition?.proteinGoal || 0)
    );
  }, [days, weekDates]);

  const navigatePeriod = useCallback(
    (delta: number) => {
      const animatedValue = view === "month" ? monthOpacity : view === "week" ? weekOpacity : yearOpacity;
      const run = (update: () => void) => {
        if (reduceMotion) {
          update();
          return;
        }
        Animated.sequence([
          Animated.timing(animatedValue, { toValue: 0.3, duration: 140, useNativeDriver: true }),
          Animated.timing(animatedValue, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
        update();
      };
      run(() => {
        if (view === "month") setMonthCursor((prev) => addMonths(prev, delta));
        else if (view === "week") setWeekCursor((prev) => addWeeks(prev, delta));
        else setYearCursor((prev) => prev + delta);
      });
    },
    [monthOpacity, reduceMotion, view, weekOpacity, yearOpacity]
  );

  const jumpToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(ymd(today));
    setMonthCursor(startOfMonth(today));
    setWeekCursor(startOfWeek(today));
    setYearCursor(today.getFullYear());
  }, []);

  const switchView = useCallback((next: CalendarView, animated = true) => {
    setView(next);
    AsyncStorage.setItem(VIEW_KEY, next).catch(() => {});
    const index = next === "month" ? 0 : next === "week" ? 1 : 2;
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated });
  }, []);

  const monthPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -40) navigatePeriod(1);
          if (gesture.dx > 40) navigatePeriod(-1);
        },
      }),
    [navigatePeriod]
  );

  const weekPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -40) navigatePeriod(1);
          if (gesture.dx > 40) navigatePeriod(-1);
        },
      }),
    [navigatePeriod]
  );

  const selectDay = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setTooltipDate((current) => (current === dateKey ? null : dateKey));
  }, []);

  const openDay = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setSheetDate(dateKey);
  }, []);

  const weekSelectedDate = parseYmd(selectedDate);
  const weekAverageSteps = useMemo(() => {
    const values = weekDates.map((date) => days[ymd(date)]?.steps?.count || 0).filter((value) => value > 0);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [days, weekDates]);

  const weekActivitySummary = useMemo(() => {
    if (!selectedDay?.steps) return null;
    const delta = selectedDay.steps.count - weekAverageSteps;
    if (!weekAverageSteps) return "No step baseline yet";
    if (delta >= 0) return `↑ ${fmt(delta)} above your average`;
    return `↓ ${fmt(Math.abs(delta))} below average`;
  }, [selectedDay?.steps, weekAverageSteps]);

  function fmt(value: number) {
    return Math.round(value).toLocaleString();
  }

  function openNutritionLogForSelected() {
    router.push(`/(modals)/add-meal?date=${sheetDate || selectedDate}` as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          gap: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => router.back()} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>CALENDAR</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{headerTitle}</Text>
          </View>

          <View style={styles.headerActionRight}>
            <Pressable onPress={() => navigatePeriod(-1)} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => navigatePeriod(1)} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.todayRow}>
          <Pressable
            onPress={jumpToToday}
            style={[
              styles.todayPill,
              {
                borderColor: withAlpha(colors.accent, 0.36),
                backgroundColor: withAlpha(colors.accent, 0.08),
              },
            ]}
          >
            <Text style={[styles.todayText, { color: colors.accent }]}>Today</Text>
          </Pressable>
        </View>

        <View style={[styles.segmentWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          {(["month", "week", "year"] as CalendarView[]).map((item) => {
            const active = view === item;
            return (
              <Pressable
                key={item}
                onPress={() => switchView(item)}
                style={[
                  styles.segment,
                  active
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: "transparent", borderColor: "transparent" },
                ]}
              >
                <Text style={[styles.segmentText, { color: active ? "#FFFFFF" : colors.textSecondary }]}>
                  {item[0].toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          const next: CalendarView = index <= 0 ? "month" : index === 1 ? "week" : "year";
          if (next !== view) switchView(next, false);
        }}
      >
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 16 }}
        >
          <Animated.View style={{ opacity: monthOpacity }} {...monthPan.panHandlers}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <StatTile
                label="STREAK"
                value={`${monthStats.streak}d`}
                icon="flame-outline"
                colors={colors}
                isDark={isDark}
                accent={colors.warning}
              />
              <StatTile
                label="BEST"
                value={`${monthStats.best}d`}
                colors={colors}
                isDark={isDark}
              />
              <StatTile
                label="LOGGED"
                value={`${monthStats.logged}/${Math.max(monthStats.total, 1)}`}
                colors={colors}
                isDark={isDark}
              />
              <StatTile
                label="SCORE"
                value={`${monthStats.percent}%`}
                colors={colors}
                isDark={isDark}
                rightAdornment={<MiniArc percent={monthStats.percent} colors={colors} />}
              />
            </ScrollView>

            <Text style={[styles.motivation, { color: colors.textTertiary }]}>
              {monthMotivation(monthStats.percent)}
            </Text>

            <View style={styles.weekdayHeader}>
              {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
                <Text key={i} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {monthCells.map(({ date, inMonth }) => {
                const key = ymd(date);
                const day = days[key] || null;
                const selected = selectedDate === key;
                const isToday = key === todayKey;
                const isFuture = date > new Date();
                const perfect = dayIsPerfect(day);
                const prDay = (day?.prs?.length || 0) > 0;
                const dots = activityDotsForDay(day, colors);
                const barColor = calorieBarColor(day, colors);
                return (
                  <Pressable
                    key={key}
                    onPress={() => selectDay(key)}
                    onLongPress={() => openDay(key)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      {
                        backgroundColor: selected
                          ? withAlpha(colors.accent, 0.18)
                          : isToday
                          ? withAlpha(colors.accent, 0.12)
                          : hasAnyData(day)
                          ? colors.surface2
                          : colors.surface1,
                        borderColor: prDay
                          ? colors.warning
                          : selected
                          ? colors.accent
                          : isToday
                          ? withAlpha(colors.accent, 0.5)
                          : colors.border,
                        borderWidth: selected ? 2 : isToday ? 1.5 : 1,
                        opacity: inMonth ? 1 : 0.5,
                        shadowColor: perfect && !isDark ? colors.success : undefined,
                        shadowOpacity: perfect && !isDark ? 0.18 : 0,
                        shadowRadius: perfect && !isDark ? 8 : 0,
                        shadowOffset: perfect && !isDark ? { width: 0, height: 0 } : undefined,
                        elevation: perfect && isDark ? 2 : 0,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: isFuture
                            ? colors.textTertiary
                            : selected || isToday
                            ? colors.textPrimary
                            : inMonth
                            ? colors.textPrimary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    <View style={[styles.microBarTrack, { backgroundColor: colors.surface3 }]}>
                      <View
                        style={[
                          styles.microBarFill,
                          {
                            backgroundColor: barColor,
                            width: `${clamp(
                              day?.nutrition?.calorieGoal ? (day.nutrition.calories / day.nutrition.calorieGoal) * 100 : 0,
                              0,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.dotRow}>
                      {dots.length ? (
                        dots.map((dot) => <View key={dot.key} style={[styles.activityDot, { backgroundColor: dot.color }]} />)
                      ) : (
                        <View style={[styles.activityDot, { backgroundColor: "transparent" }]} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legendWrap}>
              <IndicatorChip label="Nutrition logged" color={colors.accent} colors={colors} />
              <IndicatorChip label="Workout logged" color={colors.warning} colors={colors} />
              <IndicatorChip label="Hydration goal hit" color={colors.info || colors.accent} colors={colors} />
              <IndicatorChip label="Steps goal hit" color={colors.success} colors={colors} />
            </View>
            <View style={styles.legendWrap}>
              <IndicatorChip label="Calorie goal hit" color={colors.success} colors={colors} line />
              <IndicatorChip label="Personal record" color={colors.warning} colors={colors} borderOnly />
              <IndicatorChip label="Perfect day" color={colors.success} colors={colors} glow />
            </View>
            <Text style={[styles.legendFootnote, { color: colors.textTertiary }]}>
              Tap any day to see your full breakdown.
            </Text>
          </Animated.View>
        </ScrollView>

        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 16 }}
        >
          <Animated.View style={{ opacity: weekOpacity }} {...weekPan.panHandlers}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {weekDates.map((date) => {
                const key = ymd(date);
                const day = days[key] || null;
                const active = selectedDate === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedDate(key)}
                    onLongPress={() => openDay(key)}
                    style={[
                      styles.weekPill,
                      {
                        backgroundColor: active ? colors.accent : colors.surface1,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.weekPillDay, { color: active ? "#FFFFFF" : colors.textTertiary }]}>
                      {formatShortDay(date)}
                    </Text>
                    <Text style={[styles.weekPillDate, { color: active ? "#FFFFFF" : colors.textPrimary }]}>
                      {date.getDate()}
                    </Text>
                    <View style={[styles.microBarTrack, { backgroundColor: active ? withAlpha("#FFFFFF", 0.24) : colors.surface3 }]}>
                      <View
                        style={[
                          styles.microBarFill,
                          {
                            backgroundColor: active ? "#FFFFFF" : calorieBarColor(day, colors),
                            width: `${clamp(
                              day?.nutrition?.calorieGoal ? (day.nutrition.calories / day.nutrition.calorieGoal) * 100 : 0,
                              0,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.panel, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {formatFullDate(weekSelectedDate)}
              </Text>

              <View style={styles.weekDetailGrid}>
                <View style={[styles.weekMiniCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textTertiary }]}>NUTRITION</Text>
                  <View style={styles.weekRingWrap}>
                    <MiniRing
                      progress={selectedDay?.nutrition?.calorieGoal ? selectedDay.nutrition.calories / selectedDay.nutrition.calorieGoal : 0}
                      value={`${Math.round(selectedDay?.nutrition?.calories || 0)}`}
                      subtitle="kcal"
                      colors={colors}
                    />
                  </View>
                  <View style={{ gap: 8 }}>
                    {[
                      { label: "P", value: selectedDay?.nutrition?.protein || 0, goal: selectedDay?.nutrition?.proteinGoal || 0, color: colors.accent },
                      { label: "C", value: selectedDay?.nutrition?.carbs || 0, goal: selectedDay?.nutrition?.carbsGoal || 0, color: colors.info || colors.accent },
                      { label: "F", value: selectedDay?.nutrition?.fat || 0, goal: selectedDay?.nutrition?.fatGoal || 0, color: colors.warning },
                    ].map((macro) => (
                      <View key={macro.label} style={{ gap: 4 }}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{macro.label}</Text>
                          <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                            {fmt(macro.value)}g / {fmt(macro.goal)}g
                          </Text>
                        </View>
                        <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                          <View
                            style={[
                              styles.inlineFill,
                              { width: `${clamp(macro.goal ? (macro.value / macro.goal) * 100 : 0, 0, 100)}%`, backgroundColor: macro.color },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                  <MealTimeline meals={selectedDay?.nutrition?.meals || []} colors={colors} />
                </View>

                <View style={[styles.weekMiniCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textTertiary }]}>WORKOUT</Text>
                  {selectedDay?.workout ? (
                    <View style={{ gap: 10 }}>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{selectedDay.workout.name}</Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {selectedDay.workout.duration} min · {fmt(selectedDay.workout.volume)} kg · {selectedDay.workout.exercises} exercises
                      </Text>
                      <MiniRing
                        progress={(selectedDay.workout.score || 0) / 100}
                        value={`${selectedDay.workout.score || 0}`}
                        subtitle="score"
                        colors={colors}
                        size={56}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>Rest day</Text>
                  )}
                </View>

                <View style={[styles.weekMiniCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textTertiary }]}>HYDRATION</Text>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {fmt(selectedDay?.hydration?.logged || 0)} / {fmt(selectedDay?.hydration?.goal || 2400)}ml
                  </Text>
                  <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                    <View
                      style={[
                        styles.inlineFill,
                        {
                          width: `${clamp(
                            selectedDay?.hydration?.goal
                              ? (selectedDay.hydration.logged / selectedDay.hydration.goal) * 100
                              : 0,
                            0,
                            100
                          )}%`,
                          backgroundColor: colors.info || colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={[styles.weekMiniCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textTertiary }]}>RECOVERY</Text>
                  {selectedDay?.sleep ? (
                    <View style={{ gap: 8 }}>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        {Math.floor(selectedDay.sleep.duration / 60)}h {selectedDay.sleep.duration % 60}m sleep
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        Score {selectedDay.sleep.score}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>No recovery data</Text>
                  )}
                </View>
              </View>

              <View style={[styles.panel, { backgroundColor: colors.surface2, borderColor: colors.border, marginTop: 12 }]}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>STEPS</Text>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {fmt(selectedDay?.steps?.count || 0)} / {fmt(selectedDay?.steps?.goal || 8000)}
                </Text>
                <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                  <View
                    style={[
                      styles.inlineFill,
                      {
                        width: `${clamp(
                          selectedDay?.steps?.goal ? (selectedDay.steps.count / selectedDay.steps.goal) * 100 : 0,
                          0,
                          100
                        )}%`,
                        backgroundColor: colors.success,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {weekActivitySummary}
                </Text>
              </View>
            </View>

            <View style={styles.sparklineRow}>
              <SmallBarChart
                title="Calories this week"
                dates={weekDates.map((date) => ymd(date))}
                values={weekDates.map((date) => days[ymd(date)]?.nutrition?.calories || 0)}
                goals={weekDates.map((date) => days[ymd(date)]?.nutrition?.calorieGoal || 0)}
                colors={colors}
                accent={colors.accent}
                maxValue={weekCalorieMax}
              />
              <SmallBarChart
                title="Protein this week"
                dates={weekDates.map((date) => ymd(date))}
                values={weekDates.map((date) => days[ymd(date)]?.nutrition?.protein || 0)}
                goals={weekDates.map((date) => days[ymd(date)]?.nutrition?.proteinGoal || 0)}
                colors={colors}
                accent={colors.info || colors.accent}
                maxValue={weekProteinMax}
              />
            </View>
          </Animated.View>
        </ScrollView>

        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 16 }}
        >
          <Animated.View style={{ opacity: yearOpacity }}>
            <View style={[styles.panel, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ gap: 10 }}>
                  <View style={styles.yearMonthLabels}>
                    {yearWeeks.map((week, index) => {
                      const first = week[0];
                      const show = first.getDate() <= 7;
                      return (
                        <View key={`m-${index}`} style={{ width: 12, marginRight: 2 }}>
                          {show ? (
                            <Text style={[styles.yearMonthText, { color: colors.textTertiary }]}>
                              {first.toLocaleDateString(undefined, { month: "short" }).slice(0, 1)}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.yearGrid}>
                    {yearWeeks.map((week, weekIndex) => (
                      <View key={`week-${weekIndex}`} style={styles.yearColumn}>
                        {week.map((date, dayIndex) => {
                          const key = ymd(date);
                          const day = days[key] || null;
                          const inYear = date.getFullYear() === yearCursor;
                          const perfect = dayIsPerfect(day);
                          const level = day?.overallScore || 0;
                          const fill = !inYear
                            ? withAlpha(colors.surface3, 0.4)
                            : level >= 100
                            ? colors.accent
                            : level >= 80
                            ? withAlpha(colors.accent, 0.85)
                            : level >= 50
                            ? withAlpha(colors.accent, 0.6)
                            : level > 0
                            ? withAlpha(colors.accent, 0.25)
                            : colors.surface3;
                          const activeTooltip = tooltipDate === key;
                          return (
                            <Pressable
                              key={`${key}-${dayIndex}`}
                              onPress={() => {
                                if (activeTooltip) openDay(key);
                                else setTooltipDate(key);
                              }}
                              style={[
                                styles.yearCell,
                                {
                                  backgroundColor: fill,
                                  borderColor: day?.prs?.length ? colors.warning : "transparent",
                                  shadowColor: perfect && !isDark ? colors.success : undefined,
                                  shadowOpacity: perfect && !isDark ? 0.18 : 0,
                                  shadowRadius: perfect && !isDark ? 4 : 0,
                                  elevation: perfect && isDark ? 1 : 0,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {tooltipDate && days[tooltipDate] ? (
                <View style={[styles.tooltip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{formatNiceDate(tooltipDate)}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    Score {days[tooltipDate].overallScore} · {days[tooltipDate].workout ? "Workout" : "No workout"}
                    {days[tooltipDate].steps?.count
                      ? ` · ${fmt(days[tooltipDate].steps!.count)} steps`
                      : ""}
                  </Text>
                </View>
              ) : null}

              <View style={styles.yearStatsRow}>
                <MetaChip label={`${Object.values(days).filter((day) => day.nutrition?.logged).length} total logged days`} colors={colors} />
                <MetaChip label={`${bestNutritionStreak(days)} day best streak`} colors={colors} />
                <MetaChip label={`${Object.values(days).filter((day) => day.workout).length} workouts`} colors={colors} />
                <MetaChip label={`${Object.values(days).filter((day) => day.overallScore >= 90).length} goals hit`} colors={colors} />
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.ScrollView>

      <DayDetailSheet
        visible={!!sheetDate}
        onClose={() => setSheetDate(null)}
        day={sheetDate ? days[sheetDate] || null : null}
        isToday={sheetDate === todayKey}
        onLogNutrition={openNutritionLogForSelected}
      />
    </View>
  );
}

function MiniArc({
  percent,
  colors,
}: {
  percent: number;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.arcTrack, { borderColor: colors.surface3 }]}>
      <View
        style={[
          styles.arcFill,
          {
            width: `${clamp(percent, 0, 100)}%`,
            backgroundColor: scoreTone(percent, colors),
          },
        ]}
      />
    </View>
  );
}

function IndicatorChip({
  label,
  color,
  colors,
  line,
  borderOnly,
  glow,
}: {
  label: string;
  color: string;
  colors: ReturnType<typeof useTheme>["colors"];
  line?: boolean;
  borderOnly?: boolean;
  glow?: boolean;
}) {
  return (
    <View style={[styles.indicatorChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      {line ? (
        <View style={[styles.lineSwatch, { backgroundColor: color }]} />
      ) : borderOnly ? (
        <View style={[styles.borderSwatch, { borderColor: color }]} />
      ) : glow ? (
        <View style={[styles.glowSwatch, { backgroundColor: color }]} />
      ) : (
        <View style={[styles.dotSwatch, { backgroundColor: color }]} />
      )}
      <Text style={[styles.indicatorText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MetaChip({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.metaChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MiniRing({
  progress,
  value,
  subtitle,
  colors,
  size = 60,
}: {
  progress: number;
  value: string;
  subtitle: string;
  colors: ReturnType<typeof useTheme>["colors"];
  size?: number;
}) {
  const safe = clamp(progress, 0, 1);
  const track = colors.surface3;
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <View
        style={[
          styles.ringTrack,
          {
            width: size,
            height: size,
            borderColor: track,
          },
        ]}
      />
      <View
        style={[
          styles.ringFill,
          {
            width: size,
            height: size,
            borderColor: colors.accent,
            opacity: safe,
          },
        ]}
      />
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.ringSub, { color: colors.textTertiary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MealTimeline({
  meals,
  colors,
}: {
  meals: { name: string; time: string; calories: number }[];
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const width = SCREEN_WIDTH - 76;
  const entries = meals.map((meal) => {
    const parsed = new Date(`1970-01-01 ${meal.time}`);
    const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours() + parsed.getMinutes() / 60;
    const clampedHour = clamp(hour, 6, 22);
    const left = ((clampedHour - 6) / 16) * width;
    const size = clamp(8 + meal.calories / 120, 8, 16);
    return { ...meal, left, size };
  });
  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <View style={[styles.timelineTrack, { backgroundColor: colors.surface3 }]} />
      <View style={styles.timelineOverlay}>
        {entries.map((meal, index) => (
          <View
            key={`${meal.name}-${index}`}
            style={[
              styles.timelineDot,
              {
                left: meal.left,
                width: meal.size,
                height: meal.size,
                backgroundColor: colors.accent,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function SmallBarChart({
  title,
  dates,
  values,
  goals,
  colors,
  accent,
  maxValue,
}: {
  title: string;
  dates: string[];
  values: number[];
  goals: number[];
  colors: ReturnType<typeof useTheme>["colors"];
  accent: string;
  maxValue: number;
}) {
  return (
    <View style={[styles.chartCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.chartBars}>
        {values.map((value, index) => {
          const goal = goals[index] || 0;
          const hit = goal > 0 && value >= goal * 0.9;
          const height = Math.max(8, Math.round((value / Math.max(1, maxValue)) * 72));
          return (
            <View key={dates[index]} style={styles.chartBarWrap}>
              <View style={[styles.goalLine, { borderColor: colors.border }]} />
              <View
                style={[
                  styles.chartBar,
                  {
                    height,
                    backgroundColor: hit ? accent : colors.surface3,
                  },
                ]}
              />
              <Text style={[styles.chartLabel, { color: colors.textTertiary }]}>
                {formatShortDay(parseYmd(dates[index]))[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerActionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "500",
  },
  todayRow: {
    alignItems: "center",
  },
  todayPill: {
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  todayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  segmentWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statTile: {
    minWidth: 92,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: "200",
  },
  motivation: {
    marginTop: 14,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "300",
    fontStyle: "italic",
    textAlign: "center",
  },
  weekdayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: (SCREEN_WIDTH - 16 * 2 - 8 * 6) / 7,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingTop: 6,
    alignItems: "center",
    gap: 8,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "500",
  },
  microBarTrack: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  microBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  indicatorChip: {
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaChip: {
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  dotSwatch: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  lineSwatch: {
    width: 16,
    height: 4,
    borderRadius: 999,
  },
  borderSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  glowSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  legendFootnote: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "300",
    fontStyle: "italic",
    textAlign: "center",
  },
  weekPill: {
    width: 48,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
    gap: 6,
  },
  weekPillDay: {
    fontSize: 10,
    fontWeight: "500",
  },
  weekPillDate: {
    fontSize: 16,
    fontWeight: "500",
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  weekDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  weekMiniCard: {
    width: "48.5%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringTrack: {
    position: "absolute",
    borderWidth: 4,
    borderRadius: 999,
  },
  ringFill: {
    position: "absolute",
    borderWidth: 4,
    borderRadius: 999,
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringValue: {
    fontSize: 16,
    fontWeight: "200",
  },
  ringSub: {
    fontSize: 10,
    fontWeight: "300",
  },
  weekRingWrap: {
    alignItems: "flex-start",
  },
  inlineTrack: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  inlineFill: {
    height: "100%",
    borderRadius: 999,
  },
  sparklineRow: {
    flexDirection: "row",
    gap: 10,
  },
  chartCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  chartBars: {
    height: 96,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  chartBarWrap: {
    width: 20,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  chartBar: {
    width: 12,
    borderRadius: 999,
  },
  goalLine: {
    ...StyleSheet.absoluteFill,
    top: 28,
    bottom: 24,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: "300",
  },
  timelineTrack: {
    height: 2,
    borderRadius: 999,
  },
  timelineOverlay: {
    marginTop: -10,
    height: 22,
    position: "relative",
  },
  timelineDot: {
    position: "absolute",
    top: 3,
    borderRadius: 999,
  },
  yearMonthLabels: {
    flexDirection: "row",
    paddingLeft: 2,
  },
  yearMonthText: {
    fontSize: 8,
    fontWeight: "500",
  },
  yearGrid: {
    flexDirection: "row",
    gap: 2,
  },
  yearColumn: {
    gap: 2,
  },
  yearCell: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
  tooltip: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  yearStatsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  arcTrack: {
    width: 22,
    height: 6,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    marginLeft: 2,
  },
  arcFill: {
    height: "100%",
    borderRadius: 999,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
});
