import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";
import { deleteWorkout, subscribeWorkouts, type Workout } from "@/services/workouts";
import { inferPrimaryMuscle } from "@/services/workoutMuscles";

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

type ReferenceGroup = {
  exercise: string;
  primaryMuscle?: string;
  sets: Array<{ reps: number; weightKg: number; note?: string }>;
};

const withAlpha = (hex: string, alpha: number) => {
  const safe = (hex || "").replace("#", "");
  if (safe.length !== 6) return hex;
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

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

function formatShortDate(iso: string, timeLabel?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return timeLabel || iso || "";
  const d = new Date(`${iso}T00:00:00`);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return timeLabel ? `${date} · ${timeLabel}` : date;
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

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function volumeKg(sets: number, reps: number, weightKg: number) {
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weightKg);
}

function workoutScore(totalVolumeKg: number, durationMin: number, exerciseCount: number) {
  if (!totalVolumeKg || !durationMin) return 0;
  const density = totalVolumeKg / Math.max(1, durationMin);
  const complexity = exerciseCount >= 8 ? 1.15 : exerciseCount >= 5 ? 1 : 0.9;
  return Math.max(0, Math.min(100, Math.round(density * complexity)));
}

function scoreDescriptor(scorePct: number) {
  if (scorePct <= 30) return "Low";
  if (scorePct <= 60) return "Fair";
  if (scorePct <= 85) return "Good";
  return "Elite";
}

function descriptorTint(scorePct: number, colors: any) {
  if (scorePct <= 30) return colors.danger;
  if (scorePct <= 60) return colors.warning;
  if (scorePct <= 85) return colors.accent;
  return colors.success;
}

function StatTile({
  label,
  value,
  hint,
  colors,
}: {
  label: string;
  value: string;
  hint?: string;
  colors: any;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value}</Text>
      {hint ? <Text style={[styles.tileHint, { color: colors.textTertiary }]}>{hint}</Text> : null}
    </View>
  );
}

export default function WorkoutSessionDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme() as any;
  const { sessionKey = "", focus = "" } = useLocalSearchParams<{
    sessionKey?: string;
    focus?: string;
  }>();

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [rows, setRows] = React.useState<WorkoutRow[]>([]);
  const [deleting, setDeleting] = React.useState(false);
  const actionsRef = useRef<View | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeWorkouts(user.uid, (next) => setRows((next || []) as WorkoutRow[]), {
      max: 800,
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (next) => setProfile(next || null));
  }, [user?.uid]);

  const sessions = useMemo(() => buildSessionBuckets(rows), [rows]);

  const session = useMemo(() => {
    let match = sessions.find((s) => s.key === String(sessionKey));
    const key = String(sessionKey || "");
    if (!match && key.startsWith("session:")) {
      const sid = key.replace("session:", "");
      match = sessions.find((s) => s.sessionId === sid);
    }
    if (!match && key.startsWith("auto:")) {
      match = sessions.find((s) => s.key === key);
    }
    return match || null;
  }, [sessionKey, sessions]);

  const weightUnit = profile?.weightUnit === "lb" ? "lb" : "kg";
  const toDisplayWeight = useCallback(
    (kg: number) => (weightUnit === "lb" ? kg * 2.20462 : kg),
    [weightUnit]
  );

  const orderedRows = useMemo(
    () => (session?.rows || []).slice().sort((a, b) => createdAtMs(a) - createdAtMs(b)),
    [session]
  );

  const summary = useMemo(() => {
    const first = orderedRows[0];
    const last = orderedRows[orderedRows.length - 1];
    const startMs = Number(session?.startedAt || 0) || (first ? createdAtMs(first) : 0) || 0;
    const endMs = last ? createdAtMs(last) || startMs : startMs;
    const durationMin =
      startMs && endMs >= startMs ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 0;
    const totalSets = orderedRows.reduce((sum, row) => sum + Number(row.sets || 0), 0);
    const totalReps = orderedRows.reduce(
      (sum, row) => sum + Number(row.sets || 0) * Number(row.reps || 0),
      0
    );
    const totalVolumeKg = orderedRows.reduce(
      (sum, row) =>
        sum + volumeKg(Number(row.sets || 0), Number(row.reps || 0), Number(row.weight || 0)),
      0
    );
    const exerciseCount = new Set(
      orderedRows.map((row) => String(row.exercise || "").trim().toLowerCase()).filter(Boolean)
    ).size;
    return {
      title: (session?.title || "Workout").trim() || "Workout",
      dateLabel: formatShortDate(session?.dateISO || "", startMs ? fmtTime(startMs) : ""),
      durationMin,
      totalSets,
      totalReps,
      totalVolumeKg,
      exerciseCount,
      score: workoutScore(totalVolumeKg, durationMin, exerciseCount),
      notes: orderedRows
        .map((row) => String((row as any).notes || "").trim())
        .filter(Boolean),
    };
  }, [orderedRows, session, toDisplayWeight]);

  const exerciseSummaries = useMemo(() => {
    const map = new Map<
      string,
      { exercise: string; sets: number; reps: number; volumeKg: number; bestLine: string }
    >();

    for (const row of orderedRows) {
      const exercise = String(row.exercise || "").trim() || "Exercise";
      const current =
        map.get(exercise) || {
          exercise,
          sets: 0,
          reps: 0,
          volumeKg: 0,
          bestLine: "",
        };
      const sets = Number(row.sets || 0);
      const reps = Number(row.reps || 0);
      const weightKg = Number(row.weight || 0);
      current.sets += sets;
      current.reps += sets * reps;
      current.volumeKg += volumeKg(sets, reps, weightKg);
      const candidate = `${sets}×${reps} @ ${Math.round(toDisplayWeight(weightKg))}${weightUnit}`;
      if (!current.bestLine || weightKg > Number(current.bestLine.match(/@ (\d+)/)?.[1] || 0)) {
        current.bestLine = candidate;
      }
      map.set(exercise, current);
    }

    return Array.from(map.values()).sort((a, b) => b.volumeKg - a.volumeKg);
  }, [orderedRows, toDisplayWeight, weightUnit]);

  const bestSet = useMemo(() => {
    let best: { exercise: string; line: string; volume: number } | null = null;
    for (const row of orderedRows) {
      const sets = Number(row.sets || 0);
      const reps = Number(row.reps || 0);
      const weightKg = Number(row.weight || 0);
      const vol = volumeKg(sets, reps, weightKg);
      if (!best || vol > best.volume) {
        best = {
          exercise: String(row.exercise || "Exercise"),
          line: `${sets}×${reps} @ ${Math.round(toDisplayWeight(weightKg))}${weightUnit}`,
          volume: vol,
        };
      }
    }
    return best;
  }, [orderedRows, toDisplayWeight, weightUnit]);

  const muscles = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of orderedRows) {
      const key = inferPrimaryMuscle(row.exercise || "", row.primaryMuscle) || "other";
      map.set(key, (map.get(key) || 0) + Number(row.sets || 0));
    }
    return Array.from(map.entries())
      .filter(([key]) => key !== "other")
      .sort((a, b) => b[1] - a[1]);
  }, [orderedRows]);

  const previousSession = useMemo(() => {
    if (!session) return null;
    const index = sessions.findIndex((entry) => entry.key === session.key);
    const sameTitle = sessions.find(
      (entry, i) => i > index && entry.title.trim() === session.title.trim()
    );
    return sameTitle || sessions[index + 1] || null;
  }, [session, sessions]);

  const comparison = useMemo(() => {
    if (!previousSession) return "No previous session to compare yet";
    const prevVolume = previousSession.rows.reduce(
      (sum, row) =>
        sum + volumeKg(Number(row.sets || 0), Number(row.reps || 0), Number(row.weight || 0)),
      0
    );
    const prevExercises = new Set(previousSession.rows.map((row) => row.exercise)).size;
    if (!prevVolume) return "No previous session to compare yet";
    const delta = ((summary.totalVolumeKg - prevVolume) / prevVolume) * 100;
    const exDelta = summary.exerciseCount - prevExercises;
    if (delta < 0) {
      return `Lighter than last time${exDelta ? ` · ${Math.abs(exDelta)} exercise difference` : ""}`;
    }
    return `+${Math.round(delta)}% volume${exDelta ? ` · ${exDelta > 0 ? "+" : ""}${exDelta} exercises` : ""}`;
  }, [previousSession, summary.exerciseCount, summary.totalVolumeKg]);

  const repeatWorkout = useCallback(async () => {
    if (!user?.uid || !session) return;
    const grouped = new Map<string, ReferenceGroup>();
    for (const row of session.rows) {
      const exercise = String(row.exercise || "").trim();
      if (!exercise) continue;
      const key = exercise.toLowerCase();
      const current =
        grouped.get(key) || {
          exercise,
          primaryMuscle: inferPrimaryMuscle(exercise, String(row.primaryMuscle || "")) || "",
          sets: [],
        };
      current.sets.push({
        reps: Number(row.reps || 0),
        weightKg: Number(row.weight || 0),
        note: String((row as any).notes || "").trim() || undefined,
      });
      grouped.set(key, current);
    }
    await AsyncStorage.setItem(
      `workout:referenceSeed:${user.uid}`,
      JSON.stringify({
        title: (session.title || "Workout").trim() || "Workout",
        groups: [...grouped.values()],
      })
    );
    await Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: "/workouts/session",
      params: {
        freshStart: "1",
        configTitle: (session.title || "Workout").trim() || "Workout",
        resumeReference: "1",
      },
    } as any);
  }, [router, session, user?.uid]);

  const saveAsTemplate = useCallback(() => {
    if (!session) return;
    router.push({
      pathname: "/(modals)/save-workout-as-templates",
      params: { sessionKey: session.key, defaultName: session.title },
    } as any);
  }, [router, session]);

  const deleteSession = useCallback(() => {
    if (!user?.uid || !session) return;
    Alert.alert("Delete workout?", "This removes the workout from recents and history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await Promise.all(session.rows.map((row) => deleteWorkout(user.uid, row.id)));
            router.replace("/(tabs)/workouts");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }, [router, session, user?.uid]);

  useEffect(() => {
    if (focus !== "actions") return;
    const t = setTimeout(() => {
      actionsRef.current?.measure?.((_x, _y, _w, _h, _px, py) => {
        // no-op measure warmup for native layout stabilization
      });
    }, 120);
    return () => clearTimeout(t);
  }, [focus]);

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Workout not found</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            This workout may have been deleted or grouped differently.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {summary.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{summary.dateLabel}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SESSION OVERVIEW</Text>
              <Text style={[styles.heroMetric, { color: colors.textPrimary }]}>
                {Math.round(toDisplayWeight(summary.totalVolumeKg)).toLocaleString()}
                <Text style={[styles.heroUnit, { color: colors.textTertiary }]}> {weightUnit}</Text>
              </Text>
              <Text style={[styles.heroHint, { color: colors.textSecondary }]}>Total training volume</Text>
            </View>
            <View style={styles.scoreWrap}>
              <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{summary.score}</Text>
              <Text style={[styles.scoreLabel, { color: descriptorTint(summary.score, colors) }]}>
                {scoreDescriptor(summary.score)}
              </Text>
            </View>
          </View>

          <View style={styles.tilesGrid}>
            <StatTile
              label="Duration"
              value={formatDuration(summary.durationMin)}
              colors={colors}
            />
            <StatTile label="Exercises" value={String(summary.exerciseCount)} colors={colors} />
            <StatTile label="Sets" value={String(summary.totalSets)} colors={colors} />
            <StatTile label="Reps" value={String(summary.totalReps)} colors={colors} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>What stood out</Text>
          {bestSet ? (
            <View style={[styles.insightRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.textTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>
                  Best set · {bestSet.exercise}
                </Text>
                <Text style={[styles.insightBody, { color: colors.textSecondary }]}>{bestSet.line}</Text>
              </View>
            </View>
          ) : null}
          <View style={[styles.insightRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Ionicons name="trending-up-outline" size={16} color={colors.textTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>Compared with last time</Text>
              <Text style={[styles.insightBody, { color: colors.textSecondary }]}>{comparison}</Text>
            </View>
          </View>
          {muscles.length ? (
            <View style={styles.chipsWrap}>
              {muscles.slice(0, 5).map(([muscle, sets]) => (
                <View
                  key={muscle}
                  style={[styles.muscleChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                >
                  <Text style={[styles.muscleChipText, { color: colors.textSecondary }]}>
                    {muscle.replace(/([A-Z])/g, " $1").replace(/^./, (m) => m.toUpperCase())} · {sets} sets
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Exercises</Text>
          <View style={{ gap: 10 }}>
            {exerciseSummaries.slice(0, 6).map((exercise) => (
              <View
                key={exercise.exercise}
                style={[styles.exerciseRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.exerciseName, { color: colors.textPrimary }]} numberOfLines={2}>
                    {exercise.exercise}
                  </Text>
                  <Text style={[styles.exerciseMeta, { color: colors.textTertiary }]}>
                    {exercise.sets} sets · {exercise.reps} reps · {Math.round(toDisplayWeight(exercise.volumeKg)).toLocaleString()}
                    {weightUnit}
                  </Text>
                </View>
                <Text style={[styles.exerciseBest, { color: colors.textSecondary }]}>{exercise.bestLine}</Text>
              </View>
            ))}
          </View>
        </View>

        {summary.notes.length ? (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Session notes</Text>
            {summary.notes.slice(0, 4).map((entry, index) => (
              <Text key={`${entry}-${index}`} style={[styles.noteText, { color: colors.textSecondary }]}>
                {entry}
              </Text>
            ))}
          </View>
        ) : null}

        <View
          ref={actionsRef}
          style={[
            styles.card,
            focus === "actions"
              ? {
                  backgroundColor: withAlpha(colors.accent, 0.08),
                  borderColor: withAlpha(colors.accent, 0.35),
                }
              : {
                  backgroundColor: colors.surface1,
                  borderColor: colors.border,
                },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Next actions</Text>
          <Text style={[styles.cardCaption, { color: colors.textTertiary }]}>
            Repeat this session, turn it into a template, or remove it from history.
          </Text>

          <Pressable
            onPress={repeatWorkout}
            style={[styles.primaryButton, { backgroundColor: colors.accent, marginTop: 14 }]}
          >
            <Text style={styles.primaryButtonText}>Repeat workout</Text>
          </Pressable>

          <Pressable
            onPress={saveAsTemplate}
            style={[styles.secondaryButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          >
            <Ionicons name="bookmark-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              Save as template
            </Text>
          </Pressable>

          <Pressable
            disabled={deleting}
            onPress={deleteSession}
            style={[styles.tertiaryButton, { borderColor: withAlpha(colors.danger, 0.32) }]}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={[styles.tertiaryButtonText, { color: colors.danger }]}>
              {deleting ? "Deleting..." : "Delete workout"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 24, fontWeight: "500" },
  emptyBody: { fontSize: 14, fontWeight: "300", textAlign: "center", lineHeight: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "500" },
  subtitle: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroMetric: { marginTop: 10, fontSize: 32, fontWeight: "200" },
  heroUnit: { fontSize: 12, fontWeight: "300" },
  heroHint: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  scoreWrap: {
    width: 76,
    height: 76,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: 24, fontWeight: "200" },
  scoreLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tilesGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    width: "48.5%",
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
  },
  tileLabel: { fontSize: 10, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.8 },
  tileValue: { fontSize: 22, fontWeight: "200" },
  tileHint: { fontSize: 11, fontWeight: "300" },
  cardTitle: { fontSize: 16, fontWeight: "500" },
  cardCaption: { marginTop: 6, fontSize: 12, fontWeight: "300" },
  insightRow: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  insightTitle: { fontSize: 13, fontWeight: "500" },
  insightBody: { marginTop: 4, fontSize: 12, fontWeight: "300", lineHeight: 18 },
  chipsWrap: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleChip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  muscleChipText: { fontSize: 11, fontWeight: "400" },
  exerciseRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  exerciseName: { fontSize: 14, fontWeight: "500" },
  exerciseMeta: { fontSize: 12, fontWeight: "300", marginTop: 4 },
  exerciseBest: { fontSize: 12, fontWeight: "400" },
  noteText: { fontSize: 12, fontWeight: "300", lineHeight: 18, marginTop: 8 },
  primaryButton: {
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  secondaryButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "400" },
  tertiaryButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tertiaryButtonText: { fontSize: 13, fontWeight: "400" },
});
