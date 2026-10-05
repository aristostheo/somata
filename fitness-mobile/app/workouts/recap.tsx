import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated as RNAnimated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Body, {
  type ExtendedBodyPart,
  type Slug as BodySlug,
} from "react-native-body-highlighter/dist/index";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";
import { inferPrimaryMuscle, type PrimaryMuscleKey } from "@/services/workoutMuscles";
import { subscribeWorkouts, type Workout } from "@/services/workouts";

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

type PerformedBlock = {
  id: string;
  exercise: string;
  sets: number;
  reps: number;
  weightKg: number;
  primaryMuscle?: PrimaryMuscleKey;
  createdMs: number;
};

type ExerciseSummary = {
  name: string;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  bestWeightKg: number;
  bestRepShape: string;
};

type SessionRecapDraft = {
  fatigue?: FatigueLevel;
  note?: string;
};

type FatigueLevel = "destroyed" | "hard" | "good" | "easy" | "tooEasy";

const BODY_COLORS = ["rgba(123,111,255,0.25)", "rgba(123,111,255,0.5)", "#7B6FFF"];
const FATIGUE_OPTIONS: Array<{
  key: FatigueLevel;
  label: string;
  tint: string;
}> = [
  { key: "destroyed", label: "Destroyed", tint: "#F87171" },
  { key: "hard", label: "Hard", tint: "#F59E0B" },
  { key: "good", label: "Good", tint: "#7B6FFF" },
  { key: "easy", label: "Easy", tint: "#4ADE80" },
  { key: "tooEasy", label: "Too easy", tint: "#4ADE80" },
];

const KEY_TO_SLUG: Record<PrimaryMuscleKey, BodySlug> = {
  chest: "chest",
  shoulders: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  abs: "abs",
  traps: "trapezius",
  lats: "upper-back",
  rhomboids: "upper-back",
  lowerBack: "lower-back",
  quads: "quadriceps",
  adductors: "adductors",
  hamstrings: "hamstring",
  glutes: "gluteal",
  calves: "calves",
};

const SLUG_TO_KEYS: Partial<Record<BodySlug, PrimaryMuscleKey[]>> = {
  chest: ["chest"],
  deltoids: ["shoulders"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearm: ["forearms"],
  abs: ["abs"],
  trapezius: ["traps"],
  "upper-back": ["lats", "rhomboids"],
  "lower-back": ["lowerBack"],
  quadriceps: ["quads"],
  adductors: ["adductors"],
  hamstring: ["hamstrings"],
  gluteal: ["glutes"],
  calves: ["calves"],
};

const REGION_LABELS: Record<PrimaryMuscleKey, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  traps: "Traps",
  lats: "Lats",
  rhomboids: "Rhomboids",
  lowerBack: "Lower back",
  quads: "Quads",
  adductors: "Adductors",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

function withAlpha(hex: string, alpha: number) {
  const safe = (hex || "").replace("#", "");
  if (safe.length !== 6) return hex;
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function createdAtMs(x: any) {
  const t = x?.setCreatedAt ?? x?.createdAt ?? x?.sessionStartedAt;
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return Number(t) || 0;
}

function dateMsFromISO(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
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
      typeof (r as any).sessionTitle === "string" && (r as any).sessionTitle.trim()
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
        existing.latestAt = Math.max(existing.latestAt || 0, createdMs);
        if (existing.title === "Workout" && title !== "Workout") existing.title = title;
      }
      continue;
    }

    const autoList = autoBucketsByDate.get(dateISO) || [];
    const last = autoList[autoList.length - 1];
    if (last && last.latestAt && last.latestAt - createdMs <= gapMs) {
      last.rows.push(r);
      last.latestAt = Math.max(last.latestAt || 0, createdMs);
      if (last.title === "Workout" && title !== "Workout") last.title = title;
    } else {
      const key = `auto:${dateISO}:${autoList.length}`;
      const bucket: SessionBucket = {
        key,
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

function formatHeaderDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatVolume(n: number, unit: "kg" | "lb") {
  if (!isFinite(n) || n <= 0) return "—";
  const rounded = Math.round(n);
  return `${rounded}${unit}`;
}

function workoutScore(totalVolumeKg: number, durationMin: number, exerciseCount: number) {
  if (!totalVolumeKg || !durationMin) return 0;
  const density = totalVolumeKg / Math.max(1, durationMin);
  const complexity = exerciseCount >= 8 ? 1.15 : exerciseCount >= 5 ? 1.0 : 0.9;
  return Math.max(0, Math.min(100, Math.round(density * complexity)));
}

function recapKey(uid: string, sessionKey: string) {
  return `workout:recap:${uid}:${sessionKey}`;
}

function enterMotion(reduceMotion: boolean, delay: number, distance = 8) {
  return reduceMotion
    ? FadeIn.duration(220).delay(delay)
    : FadeInDown.duration(320).delay(delay).withInitialValues({
        opacity: 0,
        transform: [{ translateY: distance }],
      });
}

export default function WorkoutRecapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ sessionKey?: string }>();
  const sessionKey = String(params.sessionKey || "");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allRows, setAllRows] = useState<WorkoutRow[]>([]);
  const [fatigue, setFatigue] = useState<FatigueLevel | null>(null);
  const [note, setNote] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState<PrimaryMuscleKey | null>(null);
  const [sharing, setSharing] = useState(false);

  const noteDraftRef = useRef("");
  const backgroundOpacity = useRef(new RNAnimated.Value(0)).current;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const surfaces = useMemo(
    () => ({
      bg: isDark ? "#08080F" : "#F8F8FC",
      s1: isDark ? "#0F0F1A" : "#FFFFFF",
      s2: isDark ? "#141422" : "#F2F2F8",
      s3: isDark ? "#1C1C2E" : "#EAEAF2",
      border: isDark ? "#FFFFFF08" : "#00000008",
      borderElev: isDark ? "#FFFFFF12" : "#00000012",
      accent: isDark ? "#7B6FFF" : "#6355E8",
      accentDim: isDark ? "#7B6FFF12" : "#6355E820",
      accentBorder: isDark ? "#7B6FFF30" : "#6355E830",
      text: isDark ? "#F0F0FF" : "#0A0A1A",
      text2: isDark ? "#8888AA" : "#666688",
      text3: isDark ? "#444466" : "#AAAACC",
      success: "#4ADE80",
      warning: "#F59E0B",
      danger: "#F87171",
      shadow: isDark
        ? {}
        : {
            shadowColor: "#000000",
            shadowOpacity: 0.05,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 12,
            elevation: 2,
          },
    }),
    [isDark]
  );

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeWorkouts(user.uid, (rows) => setAllRows((rows || []) as WorkoutRow[]), {
      max: 800,
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (p) => setProfile(p || null));
  }, [user?.uid]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
    const sub = (AccessibilityInfo as any).addEventListener?.(
      "reduceMotionChanged",
      (v: boolean) => setReduceMotion(!!v)
    );
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    RNAnimated.timing(backgroundOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [backgroundOpacity]);

  const sessions = useMemo(() => buildSessionBuckets(allRows), [allRows]);

  const session = useMemo(() => {
    let match = sessions.find((s) => s.key === sessionKey);
    if (!match && sessionKey.startsWith("session:")) {
      const sid = sessionKey.replace("session:", "");
      match = sessions.find((s) => s.sessionId === sid);
    }
    if (!match && sessionKey.startsWith("date:")) {
      const iso = sessionKey.replace("date:", "");
      match = sessions.find((s) => s.dateISO === iso);
    }
    return match || null;
  }, [sessions, sessionKey]);

  const sessionIndex = useMemo(
    () => sessions.findIndex((x) => x.key === session?.key),
    [sessions, session?.key]
  );

  const previousSession = useMemo(() => {
    if (!session) return null;
    const sameTitle = sessions.find(
      (s, idx) => idx > sessionIndex && s.title.trim() === session.title.trim()
    );
    return sameTitle || sessions[sessionIndex + 1] || null;
  }, [session, sessionIndex, sessions]);

  const weightUnit = profile?.weightUnit === "lb" ? "lb" : "kg";
  const sex = profile?.sex === "female" ? "female" : "male";
  const toDisplayWeight = useCallback(
    (kg: number) => (weightUnit === "lb" ? kg * 2.20462 : kg),
    [weightUnit]
  );

  const rows = useMemo(
    () => (session?.rows || []).slice().sort((a, b) => createdAtMs(a) - createdAtMs(b)),
    [session]
  );

  const blocks = useMemo<PerformedBlock[]>(() => {
    return rows.map((row) => ({
      id: row.id,
      exercise: String(row.exercise || "Exercise"),
      sets: Number(row.sets || 0),
      reps: Number(row.reps || 0),
      weightKg: Number(row.weight || 0),
      primaryMuscle: inferPrimaryMuscle(row.exercise || "", row.primaryMuscle),
      createdMs: createdAtMs(row),
    }));
  }, [rows]);

  const exerciseSummaries = useMemo<ExerciseSummary[]>(() => {
    const map = new Map<string, ExerciseSummary>();
    for (const block of blocks) {
      const current = map.get(block.exercise);
      const vol = block.sets * block.reps * block.weightKg;
      if (!current) {
        map.set(block.exercise, {
          name: block.exercise,
          totalSets: block.sets,
          totalReps: block.sets * block.reps,
          totalVolumeKg: vol,
          bestWeightKg: block.weightKg,
          bestRepShape: `${block.sets}×${block.reps} @ ${Math.round(toDisplayWeight(block.weightKg))}${weightUnit}`,
        });
      } else {
        current.totalSets += block.sets;
        current.totalReps += block.sets * block.reps;
        current.totalVolumeKg += vol;
        if (block.weightKg > current.bestWeightKg) {
          current.bestWeightKg = block.weightKg;
          current.bestRepShape = `${block.sets}×${block.reps} @ ${Math.round(
            toDisplayWeight(block.weightKg)
          )}${weightUnit}`;
        }
      }
    }
    return Array.from(map.values());
  }, [blocks, toDisplayWeight, weightUnit]);

  const meta = useMemo(() => {
    const first = rows[0];
    const last = rows[rows.length - 1];
    const startMs =
      Number(session?.startedAt || 0) || (first ? createdAtMs(first) : 0) || 0;
    const endMs = last ? createdAtMs(last) || startMs : startMs;
    const durationMin =
      startMs && endMs >= startMs ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 0;
    const totalSets = blocks.reduce((sum, b) => sum + b.sets, 0);
    const totalReps = blocks.reduce((sum, b) => sum + b.sets * b.reps, 0);
    const totalVolumeKg = blocks.reduce((sum, b) => sum + b.sets * b.reps * b.weightKg, 0);
    return {
      title: session?.title || "Workout",
      dateISO: session?.dateISO || "",
      durationMin,
      totalSets,
      totalReps,
      totalVolumeKg,
      exerciseCount: exerciseSummaries.length,
      startMs,
    };
  }, [blocks, exerciseSummaries.length, rows, session]);

  const previousMeta = useMemo(() => {
    if (!previousSession) return null;
    const prevRows = previousSession.rows || [];
    const durationMin = (() => {
      const start =
        Number(previousSession.startedAt || 0) ||
        (prevRows[0] ? createdAtMs(prevRows[0]) : 0) ||
        0;
      const end = prevRows[prevRows.length - 1]
        ? createdAtMs(prevRows[prevRows.length - 1]) || start
        : start;
      return start && end >= start ? Math.max(1, Math.round((end - start) / 60000)) : 0;
    })();
    const totalVolumeKg = prevRows.reduce(
      (sum, row) => sum + Number(row.sets || 0) * Number(row.reps || 0) * Number(row.weight || 0),
      0
    );
    const exerciseCount = new Set(prevRows.map((r) => r.exercise)).size;
    return { durationMin, totalVolumeKg, exerciseCount };
  }, [previousSession]);

  const comparisonCopy = useMemo(() => {
    if (!previousMeta || !previousMeta.totalVolumeKg) return "—";
    const volDelta =
      ((meta.totalVolumeKg - previousMeta.totalVolumeKg) / previousMeta.totalVolumeKg) * 100;
    const exDelta = meta.exerciseCount - previousMeta.exerciseCount;
    const arrow = volDelta >= 0 ? "↑" : "↓";
    if (volDelta < 0) {
      return `${arrow} lighter than last session${
        exDelta ? ` · ${Math.abs(exDelta)} ${Math.abs(exDelta) === 1 ? "exercise" : "exercises"} difference` : ""
      }`;
    }
    const volText = `${arrow} +${Math.round(volDelta)}% volume`;
    const exText = exDelta
      ? ` · ${exDelta > 0 ? "+" : ""}${exDelta} ${Math.abs(exDelta) === 1 ? "exercise" : "exercises"} vs last session`
      : "";
    return `${volText}${exText}`;
  }, [meta.exerciseCount, meta.totalVolumeKg, previousMeta]);

  const prRows = useMemo(() => {
    if (!session) return [];
    const currentSessionStart =
      meta.startMs || dateMsFromISO(session.dateISO) || Number.MAX_SAFE_INTEGER;
    const olderRows = allRows.filter((row) => {
      if (!row.id || row.id === rows[0]?.id) return true;
      if (session.sessionId && row.sessionId === session.sessionId) return false;
      const rowMs = createdAtMs(row) || dateMsFromISO(row.date || "");
      return rowMs < currentSessionStart;
    });

    return exerciseSummaries
      .map((summary) => {
        const hist = olderRows.filter((row) => row.exercise === summary.name);
        const prevBestWeightKg = hist.reduce(
          (best, row) => Math.max(best, Number(row.weight || 0)),
          0
        );
        if (summary.bestWeightKg <= prevBestWeightKg || summary.bestWeightKg <= 0) return null;
        return {
          exercise: summary.name,
          repShape: summary.bestRepShape,
          prevWeightKg: prevBestWeightKg,
        };
      })
      .filter(Boolean) as Array<{
      exercise: string;
      repShape: string;
      prevWeightKg: number;
    }>;
  }, [allRows, exerciseSummaries, meta.startMs, rows, session]);

  const score = useMemo(
    () => workoutScore(meta.totalVolumeKg, meta.durationMin, meta.exerciseCount),
    [meta.durationMin, meta.exerciseCount, meta.totalVolumeKg]
  );

  const muscleSummary = useMemo(() => {
    const byKey = new Map<
      PrimaryMuscleKey,
      { sets: number; exercise: string; lastDate: string }
    >();
    for (const row of rows) {
      const key = inferPrimaryMuscle(row.exercise || "", row.primaryMuscle);
      if (!key) continue;
      const current = byKey.get(key);
      const sets = Number(row.sets || 0);
      if (!current) {
        byKey.set(key, {
          sets,
          exercise: row.exercise || "Exercise",
          lastDate: row.date || "",
        });
      } else {
        current.sets += sets;
      }
    }
    return byKey;
  }, [rows]);

  const bodyData = useMemo<ExtendedBodyPart[]>(() => {
    return Array.from(muscleSummary.entries()).map(([key, value]) => {
      const intensity = value.sets >= 5 ? 3 : value.sets >= 3 ? 2 : 1;
      return {
        slug: KEY_TO_SLUG[key],
        intensity,
        styles:
          activeMuscle === key
            ? {
                stroke: withAlpha("#FFFFFF", 0.32),
                strokeWidth: 1.25,
              }
            : undefined,
      };
    });
  }, [activeMuscle, muscleSummary]);

  const activeMuscleDetail = activeMuscle ? muscleSummary.get(activeMuscle) : null;

  const showCelebration =
    !reduceMotion && (prRows.length > 0 || score > 80 || sessions.length === 1);

  useEffect(() => {
    if (!user?.uid || !session?.key) return;
    AsyncStorage.getItem(recapKey(user.uid, session.key))
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as SessionRecapDraft;
        if (parsed.fatigue) setFatigue(parsed.fatigue);
        if (parsed.note) {
          setNote(parsed.note);
          noteDraftRef.current = parsed.note;
        }
      })
      .catch(() => {});
  }, [session?.key, user?.uid]);

  const persistDraft = useCallback(
    async (patch: Partial<SessionRecapDraft>) => {
      if (!user?.uid || !session?.key) return;
      const next: SessionRecapDraft = {
        fatigue: patch.fatigue ?? fatigue ?? undefined,
        note: patch.note ?? noteDraftRef.current,
      };
      noteDraftRef.current = next.note || "";
      await AsyncStorage.setItem(recapKey(user.uid, session.key), JSON.stringify(next)).catch(
        () => {}
      );
    },
    [fatigue, session?.key, user?.uid]
  );

  const onSelectFatigue = useCallback(
    async (value: FatigueLevel) => {
      setFatigue(value);
      await persistDraft({ fatigue: value });
      Haptics.selectionAsync().catch(() => {});
    },
    [persistDraft]
  );

  const onBlurNote = useCallback(async () => {
    await persistDraft({ note });
  }, [note, persistDraft]);

  const onDone = useCallback(() => {
    router.replace("/(tabs)/workouts");
  }, [router]);

  const shareText = useMemo(() => {
    const lines = [
      `${meta.title}`,
      `${formatHeaderDate(meta.dateISO)} · ${meta.durationMin} min`,
      `Sets ${meta.totalSets} · Reps ${meta.totalReps} · Volume ${formatVolume(
        Math.round(toDisplayWeight(meta.totalVolumeKg)),
        weightUnit
      )}`,
    ];
    if (prRows.length) {
      lines.push(
        "",
        "PRs",
        ...prRows.map(
          (row) =>
            `${row.exercise} · ${row.repShape} · prev ${Math.round(
              toDisplayWeight(row.prevWeightKg)
            )}${weightUnit}`
        )
      );
    }
    lines.push("", "Logged with Fitness Mobile");
    return lines.join("\n");
  }, [meta, prRows, toDisplayWeight, weightUnit]);

  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      await Share.share({ message: shareText });
    } catch {
      await Clipboard.setStringAsync(shareText);
      Alert.alert("Summary copied", "Copied a plain text workout summary to your clipboard.");
    } finally {
      setSharing(false);
    }
  }, [shareText]);

  const renderTile = (
    label: string,
    value: string,
    delay: number,
    inlineUnit?: string
  ) => (
    <Animated.View
      entering={enterMotion(reduceMotion, 400 + delay, 8)}
      style={[styles.tile, { backgroundColor: surfaces.s1, borderColor: surfaces.border }, surfaces.shadow]}
    >
      <Text style={[styles.tileLabel, { color: surfaces.text3 }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: surfaces.text }]}>
        {value}
        {inlineUnit ? <Text style={[styles.tileUnit, { color: surfaces.text3 }]}> {inlineUnit}</Text> : null}
      </Text>
    </Animated.View>
  );

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: surfaces.bg, paddingTop: topInset + 24 }]}>
        <Text style={[styles.heroTitle, { color: surfaces.text }]}>Workout complete</Text>
        <Text style={[styles.heroMeta, { color: surfaces.text3 }]}>
          This session could not be found.
        </Text>
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Pressable
            onPress={onDone}
            style={[styles.primaryButton, { backgroundColor: surfaces.accent }]}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: surfaces.bg }]}>
      <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: backgroundOpacity }]} />
      {showCelebration ? <CelebrationConfetti accent={surfaces.accent} gold={surfaces.warning} /> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topInset + 28,
          paddingHorizontal: 16,
          paddingBottom: 120,
          gap: 24,
        }}
      >
        <Animated.View entering={enterMotion(reduceMotion, 300, 12)} style={styles.centerBlock}>
          <Text style={[styles.heroTitle, { color: surfaces.text }]}>Workout complete</Text>
          <Text style={[styles.heroMeta, { color: surfaces.text3 }]}>{meta.title}</Text>
          <Text style={[styles.heroMeta, { color: surfaces.text3 }]}>
            {formatHeaderDate(meta.dateISO)} · {meta.durationMin} min
          </Text>
        </Animated.View>

        <View style={styles.tilesRow}>
          {renderTile("DURATION", formatDuration(meta.durationMin), 0)}
          {renderTile("SETS", meta.totalSets ? String(meta.totalSets) : "—", 100)}
          {renderTile("REPS", meta.totalReps ? String(meta.totalReps) : "—", 200)}
          {renderTile(
            "VOLUME",
            meta.totalVolumeKg ? String(Math.round(toDisplayWeight(meta.totalVolumeKg))) : "—",
            300,
            meta.totalVolumeKg ? weightUnit : undefined
          )}
        </View>

        {prRows.length ? (
          <Animated.View
            entering={enterMotion(reduceMotion, 600, -10)}
            style={[
              styles.prCard,
              {
                backgroundColor: surfaces.accentDim,
                borderColor: surfaces.accentBorder,
              },
            ]}
          >
            <View style={styles.prHeader}>
              <Ionicons name="trophy-outline" size={20} color={surfaces.warning} />
              <Text style={[styles.cardTitle, { color: surfaces.text }]}>
                {prRows.length} new {prRows.length === 1 ? "PR" : "PRs"} this session
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              {prRows.map((row) => (
                <Text key={row.exercise} style={[styles.prLine, { color: surfaces.text2 }]}>
                  {row.exercise} · {row.repShape}
                  {row.prevWeightKg ? (
                    <Text style={{ color: surfaces.text3 }}>
                      {" "}
                      · prev: {Math.round(toDisplayWeight(row.prevWeightKg))}
                      {weightUnit}
                    </Text>
                  ) : null}
                </Text>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={enterMotion(reduceMotion, 500)}
          style={[styles.compareCard, { backgroundColor: surfaces.s1, borderColor: surfaces.border }, surfaces.shadow]}
        >
          <Ionicons
            name={
              comparisonCopy === "—"
                ? "remove-outline"
                : comparisonCopy.startsWith("↑")
                ? "arrow-up-outline"
                : "arrow-down-outline"
            }
            size={16}
            color={
              comparisonCopy === "—"
                ? surfaces.text3
                : comparisonCopy.startsWith("↑")
                ? surfaces.success
                : surfaces.text2
            }
          />
          <Text style={[styles.compareText, { color: surfaces.text2 }]}>{comparisonCopy}</Text>
        </Animated.View>

        <Animated.View
          entering={enterMotion(reduceMotion, 520)}
          style={[styles.card, { backgroundColor: surfaces.s1, borderColor: surfaces.border }, surfaces.shadow]}
        >
          <Text style={[styles.cardTitle, { color: surfaces.text }]}>Muscles worked</Text>
          <View style={styles.heatmapRow}>
            <View style={styles.bodyWrap}>
              <Body
                data={bodyData}
                gender={sex}
                side="front"
                scale={0.88}
                border="none"
                defaultFill={surfaces.s3}
                colors={BODY_COLORS}
                onBodyPartPress={(part: ExtendedBodyPart) => {
                  const slug = part.slug as BodySlug | undefined;
                  if (!slug) return;
                  const key = SLUG_TO_KEYS[slug]?.[0];
                  if (key) setActiveMuscle(key);
                }}
              />
            </View>
            <View style={styles.bodyWrap}>
              <Body
                data={bodyData}
                gender={sex}
                side="back"
                scale={0.88}
                border="none"
                defaultFill={surfaces.s3}
                colors={BODY_COLORS}
                onBodyPartPress={(part: ExtendedBodyPart) => {
                  const slug = part.slug as BodySlug | undefined;
                  if (!slug) return;
                  const key = SLUG_TO_KEYS[slug]?.[0];
                  if (key) setActiveMuscle(key);
                }}
              />
            </View>
          </View>
          {activeMuscle && activeMuscleDetail ? (
            <View style={[styles.tooltip, { backgroundColor: surfaces.s2, borderColor: surfaces.borderElev }]}>
              <Text style={[styles.tooltipText, { color: surfaces.text2 }]}>
                {REGION_LABELS[activeMuscle]} · {activeMuscleDetail.exercise} · {activeMuscleDetail.sets}{" "}
                {activeMuscleDetail.sets === 1 ? "set" : "sets"}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={enterMotion(reduceMotion, 560)}
          style={[styles.card, { backgroundColor: surfaces.s1, borderColor: surfaces.border }, surfaces.shadow]}
        >
          <Text style={[styles.cardTitle, { color: surfaces.text }]}>How did that feel?</Text>
          <Text style={[styles.cardCaption, { color: surfaces.text3 }]}>
            This shapes your next recovery suggestion
          </Text>
          <View style={styles.fatigueRow}>
            {FATIGUE_OPTIONS.map((option) => {
              const selected = fatigue === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => onSelectFatigue(option.key)}
                  style={[
                    styles.fatigueChip,
                    selected
                      ? {
                          backgroundColor: withAlpha(option.tint, 0.12),
                          borderColor: option.tint,
                        }
                      : {
                          backgroundColor: surfaces.s2,
                          borderColor: surfaces.border,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.fatigueText,
                      { color: selected ? option.tint : surfaces.text2 },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={enterMotion(reduceMotion, 600)}>
          <Pressable onPress={() => setNotesExpanded((v) => !v)} style={styles.noteToggle}>
            <Ionicons name="create-outline" size={14} color={surfaces.accent} />
            <Text style={[styles.noteToggleText, { color: surfaces.accent }]}>Add a note →</Text>
          </Pressable>
          {notesExpanded ? (
            <View
              style={[
                styles.noteFieldWrap,
                { backgroundColor: surfaces.s3, borderColor: surfaces.borderElev },
              ]}
            >
              <TextInput
                multiline
                value={note}
                onChangeText={(value) => {
                  setNote(value);
                  noteDraftRef.current = value;
                }}
                onBlur={onBlurNote}
                placeholder="How did it go? Form notes, energy levels..."
                placeholderTextColor={surfaces.text3}
                style={[styles.noteField, { color: surfaces.text }]}
                textAlignVertical="top"
              />
              <Text style={[styles.noteCount, { color: surfaces.text3 }]}>{note.length}</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={enterMotion(reduceMotion, 700)}
        style={[
          styles.bottomBar,
          {
            backgroundColor: surfaces.s1,
            borderTopColor: surfaces.border,
          },
          surfaces.shadow,
        ]}
      >
        <Pressable onPress={onDone} style={[styles.primaryButton, { backgroundColor: surfaces.accent }]}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={[styles.secondaryButton, { borderColor: surfaces.borderElev, backgroundColor: "transparent" }]}
        >
          <Text style={[styles.secondaryButtonText, { color: surfaces.text2 }]}>
            {sharing ? "Sharing..." : "Share session"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function CelebrationConfetti({ accent, gold }: { accent: string; gold: string }) {
  const progress = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(progress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    color: i % 3 === 0 ? gold : accent,
    delay: (i % 6) * 40,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-20 - p.delay, 240 + p.delay],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [0, 1, 0],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${(p.id % 2 === 0 ? 1 : -1) * 120}deg`],
        });
        return (
          <RNAnimated.View
            key={p.id}
            style={[
              styles.particle,
              {
                left: p.left as any,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerBlock: { alignItems: "center" },
  heroTitle: {
    fontSize: 32,
    fontWeight: "200",
    letterSpacing: 0,
    textAlign: "center",
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "300",
    lineHeight: 18,
    textAlign: "center",
  },
  tilesRow: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
  },
  tileValue: {
    fontSize: 28,
    fontWeight: "200",
    letterSpacing: 0,
  },
  tileUnit: {
    fontSize: 11,
    fontWeight: "300",
  },
  prCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  prHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  compareCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
  },
  cardCaption: {
    marginTop: -4,
    fontSize: 12,
    fontWeight: "300",
    fontStyle: "italic",
  },
  prLine: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
  heatmapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  bodyWrap: {
    flex: 1,
    alignItems: "center",
    minHeight: 180,
    justifyContent: "center",
  },
  tooltip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
  fatigueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fatigueChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fatigueText: {
    fontSize: 12,
    fontWeight: "400",
  },
  noteToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteToggleText: {
    fontSize: 12,
    fontWeight: "300",
  },
  noteFieldWrap: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 100,
    padding: 12,
  },
  noteField: {
    minHeight: 84,
    fontSize: 13,
    fontWeight: "300",
    lineHeight: 20,
  },
  noteCount: {
    alignSelf: "flex-end",
    marginTop: 8,
    fontSize: 11,
    fontWeight: "300",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  primaryButton: {
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  secondaryButton: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "400",
  },
  particle: {
    position: "absolute",
    top: 0,
    width: 6,
    height: 10,
    borderRadius: 3,
  },
});
