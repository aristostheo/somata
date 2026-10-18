import { Button, Choice, Empty, Field, Heading, IconButton, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Platform,
  StatusBar,
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
import { subscribeWorkouts, type Workout } from "@/services/workouts";

// ----------------- helpers -----------------

const withAlpha = (hex: string, a: number) => {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

function createdAtMs(x: any) {
  const t = x?.setCreatedAt ?? x?.createdAt ?? x?.sessionStartedAt;
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return Number(t) || 0;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isISO(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function endOfToday(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysAgo(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
}
function fmtTime(ms: number) {
  if (!ms) return "";
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
function fmtDateNice(iso: string) {
  if (!isISO(iso)) return iso || "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtCompact(n: number) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
  return String(Math.round(n));
}
function volumeKg(sets: number, reps: number, weightKg: number) {
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weightKg);
}

type WorkoutRow = Workout & {
  sessionId?: string;
  sessionTitle?: string;
  sessionStartedAt?: number;
};

type SessionBucket = {
  key: string;
  sessionId?: string;
  dateISO: string;
  title: string;
  startedAt?: number;
  latestAt?: number;
  rows: WorkoutRow[];
};

function dateMsFromISO(iso: string) {
  if (!iso || !isISO(iso)) return 0;
  return new Date(`${iso}T00:00:00`).getTime();
}

function buildSessionBuckets(all: WorkoutRow[]) {
  const rows = (all || []).slice();
  const gapMs = 1000 * 60 * 120;

  rows.sort((a, b) => {
    const ad = (a as any).date || "";
    const bd = (b as any).date || "";
    if (ad !== bd) return bd.localeCompare(ad);
    return createdAtMs(b) - createdAtMs(a);
  });

  const buckets = new Map<string, SessionBucket>();
  const autoBucketsByDate = new Map<string, SessionBucket[]>();

  for (const r of rows) {
    const dateISO = ((r as any).date || "").trim() || "Unknown date";
    const sid =
      typeof (r as any).sessionId === "string" && (r as any).sessionId.trim()
        ? String((r as any).sessionId)
        : "";
    const title =
      typeof (r as any).sessionTitle === "string" &&
        (r as any).sessionTitle.trim()
        ? String((r as any).sessionTitle)
        : "Workout";
    const startedAt =
      Number((r as any).sessionStartedAt || 0) ||
      createdAtMs(r) ||
      dateMsFromISO(dateISO) ||
      undefined;
    const createdMs = createdAtMs(r) || startedAt || 0;

    if (sid) {
      const key = `session:${sid}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          key,
          sessionId: sid,
          dateISO,
          title,
          startedAt,
          latestAt: createdMs,
          rows: [r],
        });
      } else {
        existing.rows.push(r);
        existing.latestAt = Math.max(existing.latestAt || 0, createdMs || 0);
        if (existing.title === "Workout" && title !== "Workout")
          existing.title = title;
        if (!existing.startedAt && startedAt) existing.startedAt = startedAt;
        if (existing.dateISO === "Unknown date" && dateISO !== "Unknown date")
          existing.dateISO = dateISO;
      }
      continue;
    }

    const autoList = autoBucketsByDate.get(dateISO) || [];
    const last = autoList[autoList.length - 1];
    if (last && last.latestAt && last.latestAt - createdMs <= gapMs) {
      last.rows.push(r);
      last.latestAt = Math.max(last.latestAt || 0, createdMs || 0);
      if (last.title === "Workout" && title !== "Workout") last.title = title;
      if (!last.startedAt && startedAt) last.startedAt = startedAt;
    } else {
      const key = `auto:${dateISO}:${autoList.length}`;
      const bucket: SessionBucket = {
        key,
        sessionId: undefined,
        dateISO,
        title,
        startedAt,
        latestAt: createdMs,
        rows: [r],
      };
      autoList.push(bucket);
      autoBucketsByDate.set(dateISO, autoList);
      buckets.set(key, bucket);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const at = a.latestAt || a.startedAt || createdAtMs(a.rows[0]) || 0;
    const bt = b.latestAt || b.startedAt || createdAtMs(b.rows[0]) || 0;
    return bt - at;
  });
}

// PR flags (range-local) – uses your old logic style (best-by-exercise across list)
function computePrFlags(all: Workout[]) {
  const list = all
    .slice()
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        ((a.createdAt as any)?.toMillis?.() ?? (a.createdAt as any) ?? 0) -
        ((b.createdAt as any)?.toMillis?.() ?? (b.createdAt as any) ?? 0)
    );

  const bestByExercise = new Map<string, { weight: number; volume: number; }>();
  const flags: Record<string, { prWeight: boolean; prVolume: boolean; }> = {};
  for (const w of list) {
    const ex = (w.exercise || "").trim().toLowerCase();
    const prev = bestByExercise.get(ex) || { weight: 0, volume: 0 };
    const isPRw = Number(w.weight || 0) > prev.weight;
    const vol =
      Number(w.sets || 0) * Number(w.reps || 0) * Number(w.weight || 0);
    const isPRv = vol > prev.volume;
    flags[w.id] = { prWeight: isPRw, prVolume: isPRv };
    bestByExercise.set(ex, {
      weight: Math.max(prev.weight, Number(w.weight || 0)),
      volume: Math.max(prev.volume, vol),
    });
  }
  return flags;
}

function usePressScale() {
  const s = useSharedValue(1);
  const onPressIn = () => {
    s.value = withSpring(0.985, { damping: 18, stiffness: 260 });
  };
  const onPressOut = () => {
    s.value = withSpring(1, { damping: 18, stiffness: 260 });
  };
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));
  return { style, onPressIn, onPressOut };
}

const HAPTIC_LIGHT = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
};
const HAPTIC_SOFT = () => {
  const anyHaptics: any = Haptics;
  const soft = anyHaptics?.ImpactFeedbackStyle?.Soft;
  Haptics.impactAsync(soft ?? Haptics.ImpactFeedbackStyle.Light).catch(
    () => { }
  );
};

// ----------------- filtering -----------------

type Preset = "today" | "week" | "month" | "90d" | "all";

function computeRangeFromPreset(p: Preset) {
  const today = endOfToday(new Date());
  if (p === "all") return { from: "", to: "" };
  if (p === "today") {
    const iso = fmtISO(today);
    return { from: iso, to: iso };
  }
  if (p === "week") {
    const s = daysAgo(today, 6);
    return { from: fmtISO(s), to: fmtISO(today) };
  }
  if (p === "month") {
    return { from: fmtISO(startOfMonth(today)), to: fmtISO(today) };
  }
  // 90d
  {
    const s = daysAgo(today, 89);
    return { from: fmtISO(s), to: fmtISO(today) };
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabel(key: string) {
  // key YYYY-MM
  const [y, m] = key.split("-").map((x) => Number(x));
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function monthRange(key: string) {
  const [y, m] = key.split("-").map((x) => Number(x));
  const start = new Date(y, (m || 1) - 1, 1);
  const end = endOfMonth(start);
  const today = endOfToday(new Date());
  const endClamped = end > today ? today : end;
  return { from: fmtISO(start), to: fmtISO(endClamped) };
}

// ----------------- Screen -----------------

export default function WorkoutHistoryScreen() {
  const { D, F } = useSomataTheme();

  const router = useRouter();
  useLocalSearchParams<{ focus?: string; }>();

  const { user } = useAuth();
  const uid = user?.uid;

  const { colors, isDark } = useTheme();

  const accent = colors.primary ?? "#68D7FF";
  const accent2 = "#8B7CFF";
  const gold = "#FFD66B";
  const hot = "#FF4FD8";

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState<string>(
    () => computeRangeFromPreset("month").from
  );
  const [to, setTo] = useState<string>(
    () => computeRangeFromPreset("month").to
  );

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const firstLoadRef = useRef(false);

  useEffect(() => {
    const r = computeRangeFromPreset(preset);
    setFrom(r.from);
    setTo(r.to);
  }, [preset]);

  useEffect(() => {
    if (from && to && from > to) setTo("");
  }, [from, to]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    return subscribeWorkouts(
      uid,
      (rows: Workout[]) => {
        setWorkouts((rows || []) as WorkoutRow[]);
        setLoading(false);
        firstLoadRef.current = true;
      },
      { from, to, max: 1500 }
    );
  }, [uid, from, to]);

  const prFlags = useMemo(() => computePrFlags(workouts), [workouts]);

  // Sessions derived from rows in performed order (latest first by buildSessionBuckets)
  const sessions = useMemo(() => {
    const list = buildSessionBuckets(workouts);

    const q = query.trim().toLowerCase();
    if (!q) return list;

    // Search by session title OR any exercise name inside rows
    return list.filter((s) => {
      const t = (s.title || "").toLowerCase();
      if (t.includes(q)) return true;
      for (const r of s.rows) {
        const ex = String((r as any).exercise || "").toLowerCase();
        if (ex.includes(q)) return true;
      }
      return false;
    });
  }, [workouts, query]);

  // Sections grouped by date
  const sections = useMemo(() => {
    const byDate = new Map<string, SessionBucket[]>();
    for (const s of sessions) {
      const d = s.dateISO || "Unknown date";
      const arr = byDate.get(d) || [];
      arr.push(s);
      byDate.set(d, arr);
    }

    const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
    return dates.map((d) => ({
      title: d,
      data: (byDate.get(d) || []).sort((a, b) => {
        const at = a.latestAt || a.startedAt || createdAtMs(a.rows[0]) || 0;
        const bt = b.latestAt || b.startedAt || createdAtMs(b.rows[0]) || 0;
        return bt - at;
      }),
    }));
  }, [sessions]);

  const totals = useMemo(() => {
    let setSum = 0;
    let vol = 0;
    const exSet = new Set<string>();
    let pr = 0;

    for (const w of workouts) {
      const s = Number((w as any).sets || 0);
      const r = Number((w as any).reps || 0);
      const wt = Number((w as any).weight || 0);
      setSum += s;
      vol += volumeKg(s, r, wt);
      const ex = String((w as any).exercise || "")
        .trim()
        .toLowerCase();
      if (ex) exSet.add(ex);

      const f = prFlags[(w as any).id];
      if (f?.prWeight || f?.prVolume) pr++;
    }

    return {
      sessions: sessions.length,
      sets: setSum,
      volume: Math.round(vol),
      exercises: exSet.size,
      prs: pr,
    };
  }, [workouts, prFlags, sessions.length]);

  // Theme tokens
  const bgGradient = isDark
    ? ["#050710", "#040513", "#02030A"]
    : [
      withAlpha(accent, 0.12),
      withAlpha("#FFFFFF", 0.92),
      withAlpha("#FFFFFF", 0.88),
    ];

  const headerBorder = withAlpha(colors.text, isDark ? 0.12 : 0.08);
  const glassBg = isDark
    ? withAlpha("#FFFFFF", 0.06)
    : withAlpha("#FFFFFF", 0.82);
  const glassBorder = isDark
    ? withAlpha("#FFFFFF", 0.14)
    : withAlpha(colors.text, 0.1);

  const cardBg = isDark
    ? withAlpha("#FFFFFF", 0.05)
    : withAlpha("#FFFFFF", 0.88);
  const cardBorder = isDark
    ? withAlpha("#FFFFFF", 0.12)
    : withAlpha(colors.text, 0.08);

  const pillBg = isDark
    ? withAlpha("#FFFFFF", 0.06)
    : withAlpha("#FFFFFF", 0.86);
  const pillBorder = isDark
    ? withAlpha("#FFFFFF", 0.14)
    : withAlpha(colors.text, 0.1);

  const textStrong = isDark ? withAlpha("#FFFFFF", 0.94) : colors.text;
  const textMuted = withAlpha(colors.text, isDark ? 0.58 : 0.62);
  const textMid = withAlpha(colors.text, isDark ? 0.7 : 0.76);

  const rangeLabel = useMemo(() => {
    if (!from && !to) return "All time";
    if (from && to && from === to) return fmtDateNice(from);
    if (from && to) return `${from} → ${to}`;
    if (from && !to) return `From ${from}`;
    if (!from && to) return `Until ${to}`;
    return "";
  }, [from, to]);

  const clearSearch = useCallback(() => {
    HAPTIC_SOFT();
    setQuery("");
    Keyboard.dismiss();
  }, []);

  const goRecap = useCallback(
    (sessionKey: string) => {
      HAPTIC_LIGHT();
      router.push({
        pathname: "/workouts/recap",
        params: { sessionKey },
      } as any);
    },
    [router]
  );

  const applyMonth = useCallback((key: string) => {
    HAPTIC_SOFT();
    const r = monthRange(key);
    setPreset("all"); // keep preset visually neutral when explicit range selected
    setFrom(r.from);
    setTo(r.to);
    setMonthPickerOpen(false);
  }, []);

  const applyCustomRange = useCallback((r: { from: string; to: string; }) => {
    HAPTIC_SOFT();
    setPreset("all");
    setFrom(r.from);
    setTo(r.to);
    setCustomOpen(false);
  }, []);

  const headerHeight = 64;

  const renderSectionHeader = useCallback(
    ({ section }: any) => (
      <View style={styles.sectionHeaderWrap}>

        <View
          style={[
            styles.sectionHeaderPill,
            { backgroundColor: pillBg, borderColor: pillBorder },
          ]}
        >

          <Ionicons
            name="calendar-outline"
            size={14}
            color={withAlpha(colors.text, isDark ? 0.8 : 0.72)}
          />

          <Text style={[styles.sectionHeaderText, { color: textStrong }]}>
            {fmtDateNice(section.title)}
          </Text>

          <Text style={[styles.sectionHeaderCount, { color: textMuted }]}>
            {section.data.length}
          </Text>

        </View>

      </View>
    ),
    [pillBg, pillBorder, colors.text, isDark, textStrong, textMuted]
  );

  const keyExtractor = useCallback((item: SessionBucket) => item.key, []);

  const renderItem = useCallback(
    ({ item, index, section }: any) => {
      // compute session highlights fast (memo-ish within render)
      const rows = (item.rows || [])
        .slice()
        .sort((a: SessionBucket, b: SessionBucket) => {
          const at = a.latestAt || a.startedAt || createdAtMs(a.rows?.[0]) || 0;
          const bt = b.latestAt || b.startedAt || createdAtMs(b.rows?.[0]) || 0;
          return bt - at;
        });
      const first = rows[0];
      const last = rows[rows.length - 1];

      const start = Number((item as any).startedAt || 0) || createdAtMs(first);
      const end = createdAtMs(last) || start;

      const durationMin =
        start && end && end >= start
          ? Math.max(1, Math.round((end - start) / 60000))
          : 0;

      const exSet = new Set<string>();
      let sets = 0;
      let vol = 0;
      let prCount = 0;

      for (const r of rows) {
        exSet.add(String((r as any).exercise || "Exercise"));
        const s = Number((r as any).sets || 0);
        const rep = Number((r as any).reps || 0);
        const wt = Number((r as any).weight || 0);
        sets += s;
        vol += volumeKg(s, rep, wt);

        const f = prFlags[(r as any).id];
        if (f?.prWeight || f?.prVolume) prCount++;
      }

      const timeLabel = start ? fmtTime(start) : "";
      const exerciseCount = exSet.size;

      return <Panel>
        <Heading title={item.title || "Workout"} detail={`${timeLabel}${durationMin ? ` · ${durationMin} min` : ''}`} action={<IconButton icon="arrow-forward" label="Open workout recap" onPress={() => goRecap(item.key)} />} />
        <Text style={F.body}>{exerciseCount} exercises · {sets} sets · {Math.round(vol).toLocaleString()} kg volume</Text>
        {prCount > 0 && <Text style={{ ...F.eyebrow, color: D.lime }}>{prCount} personal records</Text>}
      </Panel>;
    },
    [
      prFlags,
      goRecap,
      isDark,
      textStrong,
      textMuted,
      textMid,
      cardBg,
      cardBorder,
      pillBg,
      pillBorder,
      accent,
      accent2,
      gold,
      hot,
    ]
  );

  return (<><TaskPage title="Your training archive" section="Workout history" subtitle={rangeLabel} onBack={() => router.back()}>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Metric label="Sessions" value={String(totals.sessions)} />
      <Metric label="Volume · kg" value={fmtCompact(totals.volume)} />
      <Metric label="Sets" value={String(totals.sets)} />
      <Metric label="Personal records" value={String(totals.prs)} />
    </View>

    <Field label="Search workouts or exercises" value={query} onChangeText={setQuery} />
    {!!query && <Button label="Clear search" onPress={clearSearch} />}

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['today', 'week', 'month', '90d', 'all'] as Preset[]).map(k => <Choice key={k} label={k === '90d' ? '90 days' : k} selected={preset === k} onPress={() => { HAPTIC_SOFT(); setPreset(k); }} />)}
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Button label="Choose month" onPress={() => setMonthPickerOpen(true)} />
      <Button label="Custom dates" onPress={() => setCustomOpen(true)} />
    </View>

    {loading ? <Empty title="Loading training history…" /> : !sections.length ? <Empty title={query ? 'No matching sessions' : 'No sessions in this period'} detail="Adjust the search or date range to explore your training." /> : sections.map(s => <View key={s.title} style={{ gap: 10 }}>
      <Heading title={fmtDateNice(s.title)} />
      {s.data.map((item, index) => <View key={item.key}>
        {renderItem({ item, index, section: s })}
      </View>)}
    </View>)}

  </TaskPage><MonthPickerModal visible={monthPickerOpen} onClose={() => setMonthPickerOpen(false)} onPick={applyMonth} isDark={isDark} glassBg={glassBg} glassBorder={glassBorder} pillBg={pillBg} pillBorder={pillBorder} textStrong={textStrong} textMuted={textMuted} accent={accent} /><CustomRangeModal visible={customOpen} onClose={() => setCustomOpen(false)} onApply={applyCustomRange} initialFrom={from} initialTo={to} isDark={isDark} glassBg={glassBg} glassBorder={glassBorder} pillBg={pillBg} pillBorder={pillBorder} textStrong={textStrong} textMuted={textMuted} accent={accent} accent2={accent2} /></>
  );
}

// ----------------- Components -----------------

function MonthPickerModal(props: {
  visible: boolean;
  onClose: () => void;
  onPick: (monthKey: string) => void;
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  pillBg: string;
  pillBorder: string;
  textStrong: string;
  textMuted: string;
  accent: string;
}) {
  const months = useMemo(() => {
    // last 18 months (including current)
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(monthKey(d));
    }
    return out;
  }, []);

  return (<TaskSheet title="Choose a month" visible={props.visible} onClose={props.onClose}>
    {months.map(m => <Item key={m} title={monthLabel(m)} icon="calendar-outline" onPress={() => props.onPick(m)} />)}
  </TaskSheet>
  );
}

function CustomRangeModal(props: {
  visible: boolean;
  onClose: () => void;
  onApply: (r: { from: string; to: string; }) => void;
  initialFrom: string;
  initialTo: string;
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  pillBg: string;
  pillBorder: string;
  textStrong: string;
  textMuted: string;
  accent: string;
  accent2: string;
}) {
  const [from, setFrom] = useState(props.initialFrom || "");
  const [to, setTo] = useState(props.initialTo || "");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (props.visible) {
      setFrom(props.initialFrom || "");
      setTo(props.initialTo || "");
      setErr("");
    }
  }, [props.visible, props.initialFrom, props.initialTo]);

  const validate = () => {
    const f = from.trim();
    const t = to.trim();
    if (f && !isISO(f)) return "From must be YYYY-MM-DD";
    if (t && !isISO(t)) return "To must be YYYY-MM-DD";
    if (f && t && f > t) return "From must be before To";
    return "";
  };

  const quick = (key: Preset) => {
    HAPTIC_SOFT();
    const r = computeRangeFromPreset(key);
    setFrom(r.from);
    setTo(r.to);
    setErr("");
  };

  const apply = () => {
    const e = validate();
    if (e) {
      HAPTIC_LIGHT();
      setErr(e);
      return;
    }
    props.onApply({ from: from.trim(), to: to.trim() });
  };

  return (<TaskSheet title="Choose a period" visible={props.visible} onClose={props.onClose}>
    <Heading title="Date range" detail="Use YYYY-MM-DD. Leave a date blank for an open-ended range." />
    <Field label="From" value={from} onChangeText={v => { setFrom(v); setErr(''); }} placeholder="YYYY-MM-DD" />
    <Field label="To" value={to} onChangeText={v => { setTo(v); setErr(''); }} placeholder="YYYY-MM-DD" />
    {!!err && <Empty title={err} />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['today', 'week', 'month', '90d', 'all'] as Preset[]).map(k => <Button key={k} label={k} onPress={() => quick(k)} />)}
    </View>
    <Button primary label="Apply dates" onPress={apply} />
    <Button label="Cancel" onPress={props.onClose} />
  </TaskSheet>
  );
}

// ----------------- styles -----------------

const styles = StyleSheet.create({
  root: { flex: 1 },

  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
  },
  glowSm: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 220,
  },

  headerBlur: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backText: { fontWeight: "900", fontSize: 13, letterSpacing: -0.1 },

  title: { fontSize: 18, fontWeight: "950" as any, letterSpacing: -0.3 },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "750" as any },

  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  searchPill: {
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800" as any,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },

  rangeRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangePillText: {
    fontSize: 12,
    fontWeight: "950" as any,
    letterSpacing: -0.1,
  },

  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthBtnText: { fontSize: 12, fontWeight: "950" as any, letterSpacing: -0.1 },

  totalsRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniChipText: { fontSize: 12, fontWeight: "850" as any, letterSpacing: -0.1 },

  sectionHeaderWrap: { marginTop: 6, marginBottom: 10 },
  sectionHeaderPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "950" as any,
    letterSpacing: -0.1,
  },
  sectionHeaderCount: {
    marginLeft: 2,
    fontSize: 12,
    fontWeight: "900" as any,
    fontVariant: ["tabular-nums"],
  },

  sessionCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    left: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 140,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionTitle: { fontSize: 14, fontWeight: "950" as any, letterSpacing: -0.2 },
  sessionSub: { marginTop: 4, fontSize: 12, fontWeight: "750" as any },

  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  prBadgeText: {
    fontSize: 12,
    fontWeight: "950" as any,
    fontVariant: ["tabular-nums"],
  },

  cardChipsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardChipText: { fontSize: 12, fontWeight: "850" as any, letterSpacing: -0.1 },

  edgeCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  edgeTitle: { fontSize: 14, fontWeight: "950" as any, letterSpacing: -0.2 },
  edgeSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "650" as any,
    lineHeight: 16,
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
    paddingBottom: 16,
  },
  modalSheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontWeight: "950" as any, letterSpacing: -0.2 },
  modalSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700" as any,
    lineHeight: 16,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  monthGrid: { marginTop: 12, gap: 10 },
  monthCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthCellText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900" as any,
    letterSpacing: -0.2,
  },

  fieldLabel: { fontSize: 12, fontWeight: "850" as any },
  field: {
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginTop: 8,
  },
  fieldInput: {
    fontSize: 13,
    fontWeight: "900" as any,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },

  errorPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "750" as any,
    lineHeight: 16,
  },

  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickBtnText: { fontSize: 12, fontWeight: "950" as any, letterSpacing: -0.1 },

  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontSize: 13, fontWeight: "950" as any, letterSpacing: -0.2 },

  modalBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnTextPrimary: {
    fontSize: 13,
    fontWeight: "950" as any,
    letterSpacing: -0.2,
  },
});
