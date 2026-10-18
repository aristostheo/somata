import { useAccountStorage } from '@/services/local/accountStore';
import { CalendarRecord } from "@/components/somata/CalendarRecord";
import { Button, Choice, Heading, IconButton, Metric, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
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
  const dots: Array<{ key: string; color: string; }> = [];
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

export default function FullCalendarScreen() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

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
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => { });
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
    getCalendarRangeData(user.uid, loadRange.start, loadRange.end, profile, localStore).then((next) => {
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
    AsyncStorage.setItem(VIEW_KEY, next).catch(() => { });
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

  return (<>
    <TaskPage title={headerTitle} section="Calendar / your records" onBack={() => router.back()}
      action={<Button label="Today" onPress={jumpToToday} />}>

      <View style={F.row}>
        <IconButton icon="chevron-back" label="Previous period" onPress={() => navigatePeriod(-1)} />

        <View style={{ ...F.wrap, flex: 1, justifyContent: "center" }}>
          {(["week", "month", "year"] as CalendarView[]).map(value => <Choice key={value} label={value[0].toUpperCase() + value.slice(1)} selected={view === value} onPress={() => switchView(value)} />)}
        </View>

        <IconButton icon="chevron-forward" label="Next period" onPress={() => navigatePeriod(1)} />
      </View>

      {view === 'month' && <>
        <View {...monthPan.panHandlers} style={{ gap: 8 }}>

          <View style={{ flexDirection: 'row' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={i} style={{ ...F.caption, width: '14.28%', textAlign: 'center' }}>{label}</Text>)}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {monthCells.map(({ date, inMonth }) => {
              const key = ymd(date); const day = days[key]; const active = selectedDate === key;
              return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${formatNiceDate(key)}${hasAnyData(day) ? ', has records' : ''}${day?.prs?.length ? ', personal record' : ''}`}
                accessibilityState={{ selected: active }} onPress={() => selectDay(key)} onLongPress={() => openDay(key)}
                style={{ width: '14.28%', minHeight: 61, padding: 3, opacity: inMonth ? 1 : 0.4 }}>

                <View style={{
                  flex: 1, borderRadius: 15, backgroundColor: active ? D.lime : key === todayKey ? '#24483A' : D.card, alignItems: 'center', justifyContent: 'center', gap: 6,
                  borderWidth: day?.prs?.length ? 1 : 0, borderColor: D.amber
                }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: active ? D.ink : D.text }}>{date.getDate()}</Text>

                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {activityDotsForDay(day, colors).map(dot => <View key={dot.key} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: active ? D.ink : D.teal }} />)}
                  </View>

                </View>
              </Pressable>;
            })}
          </View>

        </View>
        <Text style={F.caption}>Dots mark logged activity. Outlined dates have personal records. Hold a date for its full record.</Text>
        <View style={F.wrap}>
          <Metric label="Nutrition days" value={`${monthStats.logged}/${Math.max(monthStats.total, 1)}`} />
          <Metric label="Logging score" value={`${monthStats.percent}%`} />

          <Metric label="Current streak" value={`${monthStats.streak}d`} />
          <Metric label="Best streak" value={`${monthStats.best}d`} />
        </View>
      </>}

      {view === 'week' && <View {...weekPan.panHandlers} style={{ gap: 10 }}>
        {weekDates.map(date => {
          const key = ymd(date), day = days[key]; return <Pressable key={key}
            accessibilityRole="button" accessibilityState={{ selected: selectedDate === key }} onPress={() => setSelectedDate(key)} onLongPress={() => openDay(key)}
            style={{ padding: 17, borderRadius: 19, backgroundColor: selectedDate === key ? D.tint : D.card, gap: 10 }}>

            <Text style={F.heading}>{formatNiceDate(key)}</Text>
            <Text style={F.body}>{day?.nutrition?.logged ? `${fmt(day.nutrition.calories)} kcal · ${fmt(day.nutrition.protein)} g protein` : 'No nutrition logged'}</Text>

            {!!day?.nutrition?.logged && <View style={{ height: 7, borderRadius: 4, backgroundColor: D.raised }}>
              <View style={{ height: 7, borderRadius: 4, width: `${clamp(day.nutrition.calories / weekCalorieMax * 100, 0, 100)}%`, backgroundColor: D.teal }} />
            </View>}

            {!!day?.nutrition?.logged && <View style={{ height: 7, borderRadius: 4, backgroundColor: D.raised }}>
              <View style={{ height: 7, borderRadius: 4, width: `${clamp(day.nutrition.protein / weekProteinMax * 100, 0, 100)}%`, backgroundColor: D.lime }} />
            </View>}
            <Text style={F.caption}>{day?.steps ? `${fmt(day.steps.count)} steps` : 'No steps recorded'}{day?.workout ? ` · ${day.workout.name}` : ''}</Text>

          </Pressable>;
        })}
        <Text style={F.caption}>Teal shows energy; the second bar shows protein. Each metric shares its weekly scale. Swipe to change weeks.</Text>
      </View>}

      {view === 'year' && <>
        <Heading title="The year in records" detail="Scroll across weeks. Tap a date to inspect its record." />
        <ScrollView horizontal>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {yearWeeks.map((week, i) => <View key={i} style={{ gap: 5 }}>
              {week.map(date => {
                const key = ymd(date), day = days[key]; return <Pressable key={key}
                  accessibilityRole="button" accessibilityLabel={`${formatNiceDate(key)}${day ? `, score ${day.overallScore}` : ''}`} onPress={() => { setTooltipDate(key); setSelectedDate(key); }}
                  onLongPress={() => openDay(key)} style={{
                    width: 46, minHeight: 46, borderRadius: 13, backgroundColor: selectedDate === key ? D.lime : hasAnyData(day) ? D.tint : D.card,
                    opacity: date.getFullYear() === yearCursor ? 1 : 0.3, alignItems: 'center', justifyContent: 'center'
                  }}>

                  <Text style={{ color: selectedDate === key ? D.ink : D.text, fontSize: 12 }}>{date.getDate()}</Text>
                  <Text style={{ color: selectedDate === key ? D.ink : D.muted, fontSize: 9 }}>{date.toLocaleDateString(undefined, { month: 'short' })}</Text>

                </Pressable>;
              })}
            </View>)}
          </View>
        </ScrollView>
        <View style={F.wrap}>
          <Metric label="Logged days in loaded records" value={String(Object.values(days).filter(day => day.nutrition?.logged).length)} />

          <Metric label="Best logging streak" value={`${bestNutritionStreak(days)}d`} />
          <Metric label="Workouts in loaded records" value={String(Object.values(days).filter(day => day.workout).length)} />

          <Metric label="Scores of 90+" value={String(Object.values(days).filter(day => day.overallScore >= 90).length)} />
        </View>
      </>}

      <Heading title={formatNiceDate(selectedDate)} detail="Selected day" action={<IconButton icon="expand-outline" label="Open selected day" onPress={() => openDay(selectedDate)} />} />

      <CalendarRecord day={selectedDay} />

      {view === 'week' && !!weekActivitySummary && <Text style={F.caption}>{weekActivitySummary}</Text>}
    </TaskPage>
    <DayDetailSheet visible={!!sheetDate} onClose={() => setSheetDate(null)} day={sheetDate ? days[sheetDate] || null : null}
      isToday={sheetDate === todayKey} onLogNutrition={openNutritionLogForSelected} />
  </>
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
