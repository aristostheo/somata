// app/workouts/session.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Alert as RNAlert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { fmt } from "@/utils/date";
import { lbToKg, kgToLb } from "@/utils/units";
import { withAlpha } from "@/components/workouts/utils/withAlpha";

import ExerciseSearchSheet from "@/components/workouts/ExerciseSearchSheet";
import WeightPlateStacker from "@/components/workouts/WeightPlateStacker";

import { addWorkout, type Workout } from "@/services/workouts";
import {
  subscribeWorkoutPresets,
  addWorkoutPreset,
  updateWorkoutPreset,
  deleteWorkoutPreset,
  type WorkoutPreset,
} from "@/services/presets";
import {
  ensureProfile,
  subscribeProfile,
  type Profile,
} from "@/services/profile";

import {
  loadSessionDraft,
  saveSessionDraft,
  clearSessionDraft,
  newSessionDraft,
  type WorkoutSessionDraft,
  type WorkoutSessionDraftItem,
} from "../../components/workouts/sessionDraft";
import { useLocalSearchParams } from "expo-router";

/**
 * IMPORTANT:
 * We keep your draft storage + services.
 * To support set-by-set logging, each set row is stored as ONE draft item with sets=1.
 *
 * If your WorkoutSessionDraftItem type doesn't include these optional fields, this local alias
 * lets us safely use them without changing your service types.
 */
type SetDraftItem = WorkoutSessionDraftItem & {
  // internal: per-set row identity
  id?: string;
  done?: boolean;
  // optional per-set note
  note?: string;
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${m}:${pad2(sec)}`;
}

function fmtCompact(n: number) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
  return String(Math.round(n));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const todayISO = useMemo(() => fmt(new Date()), []);
  const [nowTick, setNowTick] = useState(Date.now());

  // ---- persisted in-progress draft ----
  const [draft, setDraft] = useState<WorkoutSessionDraft | null>(null);

  // ---- profile + unit ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const unit: "kg" | "lb" = profile?.weightUnit === "lb" ? "lb" : "kg";

  // ---- presets ----
  const [presets, setPresets] = useState<WorkoutPreset[]>([]);
  const safePresets = useMemo(
    () =>
      (presets || [])
        .filter((p) => p?.name)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sets: p.sets,
          reps: p.reps,
          weight: p.weight, // kg in your service
          notes: p.notes,
          exercise: (p as any).exercise, // your service stores exercise too
        })),
    [presets]
  );

  const [lastAddedTs, setLastAddedTs] = useState<number | null>(null);
  const [savedToast, setSavedToast] = useState("");

  const params = useLocalSearchParams<any>();
  const pickedConsumed = useRef<string | null>(null);

  useEffect(() => {
    const picked = (params?.pickedExercise || "").toString().trim();
    if (!picked || !draft) return;
    if (pickedConsumed.current === picked) return;

    // if it came from a preset, we can also prefill N sets at once
    const from = String(params?.pickedFrom || "");
    const run = async () => {
      pickedConsumed.current = picked;
      if (from === "preset") {
        const sets = Math.max(1, Number(params?.presetSets || 1) || 1);
        const reps = Number(params?.presetReps || 10) || 10;
        const weightKg = Number(params?.presetWeightKg || 0) || 0;
        for (let i = 0; i < sets; i++) {
          await addExerciseFirstSet(picked, { reps, weightKg });
        }
      } else {
        await addExerciseFirstSet(picked);
      }
      setSavedToast("Added ✓");
      setTimeout(() => setSavedToast(""), 1200);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.pickedExercise, draft?.id]);

  // ---- title edit modal ----
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // ---- sheets ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  // ---- expanded exercises ----
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ---- rest timer ----
  const [rest, setRest] = useState<null | {
    running: boolean;
    startedAt: number;
    durationSec: number;
  }>(null);

  // ---- persist: debounce so we never drop the last update ----
  const savingRef = useRef(false);
  const saveTimerRef = useRef<any>(null);
  const pendingRef = useRef<WorkoutSessionDraft | null>(null);

  // ---------- tick for timer/rest ----------
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---------- subscribe: profile ----------
  useEffect(() => {
    if (!user?.uid) return;
    ensureProfile(user.uid).catch(() => {});
    const unsub = subscribeProfile(user.uid, (p) => setProfile(p || null));
    return () => unsub?.();
  }, [user?.uid]);

  // ---------- subscribe: presets ----------
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeWorkoutPresets(user.uid, (rows) =>
      setPresets(rows || [])
    );
    return () => unsub?.();
  }, [user?.uid]);

  // ---------- load or create draft ----------
  useEffect(() => {
    if (!user?.uid) {
      setDraft(null);
      return;
    }
    (async () => {
      const existing = await loadSessionDraft(user.uid);
      if (existing) {
        setDraft(existing);
        setTitleDraft(existing.title || "Workout");
        return;
      }
      const fresh = newSessionDraft({ dateISO: todayISO, title: "Workout" });
      setDraft(fresh);
      setTitleDraft(fresh.title);
      await saveSessionDraft(user.uid, fresh);
    })();
  }, [user?.uid, todayISO]);

  async function flushSave() {
    if (!user?.uid) return;
    if (savingRef.current) return;
    const next = pendingRef.current;
    if (!next) return;

    savingRef.current = true;
    try {
      await saveSessionDraft(user.uid, next);
    } finally {
      savingRef.current = false;
      if (
        pendingRef.current &&
        pendingRef.current.updatedAt !== next.updatedAt
      ) {
        flushSave();
      }
    }
  }

  function persist(next: WorkoutSessionDraft) {
    setDraft(next);
    pendingRef.current = next;
    if (!user?.uid) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 220);
  }

  // ---------- derived stats (live) ----------
  const stats = useMemo(() => {
    const items = (draft?.items || []) as SetDraftItem[];

    // each item is one set row (sets=1), but keep it robust
    const totalSets = items.reduce((a, it) => a + Number(it.sets || 0), 0);
    const totalReps = items.reduce(
      (a, it) => a + Number(it.reps || 0) * Number(it.sets || 0),
      0
    );
    const totalVolumeKg = items.reduce(
      (a, it) =>
        a +
        Number(it.weightKg || 0) * Number(it.reps || 0) * Number(it.sets || 0),
      0
    );

    const startedAt = draft?.startedAt || Date.now();
    const durationMs = Math.max(0, nowTick - startedAt);

    // exercise count: unique exercise names
    const exCount = new Set(
      items.map((x) => (x.exercise || "").trim()).filter(Boolean)
    ).size;

    return {
      exCount,
      totalSets,
      totalReps,
      totalVolumeKg,
      startedAt,
      durationMs,
    };
  }, [draft, nowTick]);

  const elapsedLabel = useMemo(() => {
    if (!draft?.startedAt) return "0:00";
    return formatDuration(nowTick - draft.startedAt);
  }, [draft?.startedAt, draft?.updatedAt, nowTick]);

  const volumeDisplay = useMemo(() => {
    const v = unit === "lb" ? kgToLb(stats.totalVolumeKg) : stats.totalVolumeKg;
    return fmtCompact(Math.round(v));
  }, [stats.totalVolumeKg, unit]);

  // ---------- group into exercise blocks (timeline of sets) ----------
  const groups = useMemo(() => {
    const items = ((draft?.items || []) as SetDraftItem[]).slice();

    // group by exercise name
    const map = new Map<
      string,
      { name: string; items: SetDraftItem[]; lastAt: number }
    >();
    for (const it of items) {
      const key = (it.exercise || "").trim() || "Exercise";
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { name: key, items: [it], lastAt: it.createdAt });
      } else {
        prev.items.push(it);
        prev.lastAt = Math.max(prev.lastAt, it.createdAt);
      }
    }

    // newest exercise activity first
    return [...map.values()]
      .map((g) => ({
        ...g,
        items: g.items.sort((a, b) => b.createdAt - a.createdAt), // newest sets on top (thumb-friendly)
      }))
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [draft?.items]);

  // ---------- helpers: find last used values for an exercise ----------
  function lastUsedFor(exerciseName: string) {
    const items = (draft?.items || []) as SetDraftItem[];
    const found = items.find(
      (it) =>
        (it.exercise || "").trim().toLowerCase() ===
        exerciseName.trim().toLowerCase()
    );
    if (!found) return { reps: 10, weightKg: 0 };
    return {
      reps: Number(found.reps || 10),
      weightKg: Number(found.weightKg || 0),
    };
  }

  // ---------- UI steps/values ----------
  const weightStep = unit === "lb" ? 5 : 2.5;
  const weightBigStep = unit === "lb" ? 10 : 5;
  const repsStep = 1;
  const repsBigStep = 5;

  // ---------- rest timer ----------
  const restRemaining = useMemo(() => {
    if (!rest?.running) return 0;
    const elapsed = Math.floor((nowTick - rest.startedAt) / 1000);
    return Math.max(0, rest.durationSec - elapsed);
  }, [rest, nowTick]);

  useEffect(() => {
    if (!rest?.running) return;
    if (restRemaining === 0) {
      setRest((r) => (r ? { ...r, running: false } : r));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [restRemaining, rest?.running]);

  // ────────────────────────────────────────────────────────────────────────────
  // Actions

  function toggleExpanded(exName: string, defaultOpen: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((cur) => ({ ...cur, [exName]: !(cur[exName] ?? defaultOpen) }));
  }

  async function addExerciseFirstSet(
    exerciseName: string,
    opts?: { weightKg?: number; reps?: number }
  ) {
    if (!draft) return;

    if (!user?.uid) {
      RNAlert.alert("Sign in required", "Please sign in to start a workout.");
      return;
    }
    const ex = (exerciseName || "").trim();
    if (!ex) return;

    const last = lastUsedFor(ex);
    const reps = Number(opts?.reps ?? last.reps ?? 10) || 10;
    const weightKg = Number(opts?.weightKg ?? last.weightKg ?? 0) || 0;

    const item: SetDraftItem = {
      id: uid(),
      exercise: ex,
      sets: 1,
      reps,
      weightKg,
      notes: "", // keep for compatibility
      createdAt: Date.now(),
      done: false,
    };

    const next: WorkoutSessionDraft = {
      ...draft,
      updatedAt: Date.now(),
      items: [item as any, ...(draft.items as any)],
    };

    persist(next);

    // auto-open the exercise block (rewarding “it landed”)
    setExpanded((cur) => ({ ...cur, [ex]: true }));

    try {
      await Haptics.selectionAsync();
    } catch {}
    setLastAddedTs(item.createdAt);
  }

  async function addSetDuplicate(exerciseName: string) {
    if (!draft) return;
    const ex = exerciseName.trim();
    const block = groups.find((g) => g.name === ex);
    const top = block?.items?.[0];

    const reps = Number(top?.reps ?? 10) || 10;
    const weightKg = Number(top?.weightKg ?? 0) || 0;

    const item: SetDraftItem = {
      id: uid(),
      exercise: ex,
      sets: 1,
      reps,
      weightKg,
      notes: "",
      createdAt: Date.now(),
      done: false,
    };

    persist({
      ...draft,
      updatedAt: Date.now(),
      items: [item as any, ...(draft.items as any)],
    });

    try {
      await Haptics.selectionAsync();
    } catch {}
  }

  function patchSet(
    createdAt: number,
    patch: Partial<Pick<SetDraftItem, "reps" | "weightKg" | "done">>
  ) {
    if (!draft) return;

    const nextItems = ((draft.items || []) as SetDraftItem[]).map((it) => {
      if (it.createdAt !== createdAt) return it;
      return { ...it, ...patch };
    });

    persist({ ...draft, updatedAt: Date.now(), items: nextItems as any });
  }

  function removeSet(createdAt: number) {
    if (!draft) return;
    persist({
      ...draft,
      updatedAt: Date.now(),
      items: (draft.items || []).filter(
        (it: any) => it.createdAt !== createdAt
      ),
    });
  }

  async function onSavePreset(payload: {
    name: string;
    exercise: string;
    sets: number;
    reps: number;
    weight: number; // in CURRENT unit in UI, but we will convert to kg
    notes: string;
  }) {
    if (!user?.uid) return;
    if (!payload?.name?.trim() || !payload?.exercise?.trim()) return;

    const weightKg =
      unit === "lb"
        ? lbToKg(Number(payload.weight || 0))
        : Number(payload.weight || 0);

    await addWorkoutPreset(user.uid, {
      name: payload.name.trim(),
      exercise: payload.exercise.trim(),
      sets: Number(payload.sets || 0),
      reps: Number(payload.reps || 0),
      weight: Number(isFinite(weightKg as number) ? weightKg : 0),
      notes: (payload.notes || "").trim(),
    } as any);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }

  async function onUpdatePreset(id: string) {
    if (!user?.uid) return;
    const found = presets.find((p) => p.id === id);
    if (!found) return;
    await updateWorkoutPreset(user.uid, id, found as any);
  }

  async function onDeletePreset(id: string) {
    if (!user?.uid) return;
    RNAlert.alert("Delete preset?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteWorkoutPreset(user.uid, id);
        },
      },
    ]);
  }

  function saveTitle() {
    if (!draft) return;
    persist({
      ...draft,
      title: (titleDraft || "Workout").trim() || "Workout",
      updatedAt: Date.now(),
    });
    setTitleOpen(false);
  }

  async function finishWorkout() {
    if (!user?.uid || !draft) return;

    if (!(draft.items || []).length) {
      RNAlert.alert("Nothing logged", "Add at least one exercise first.");
      return;
    }

    RNAlert.alert(
      "Finish workout?",
      "This will save it to your workout history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            // Save each SET as a workout entry (sets: 1) — uses same addWorkout() service as before
            const items = ([...(draft.items as any[])] as SetDraftItem[])
              .slice()
              .reverse();

            for (const it of items) {
              const entry: Partial<Workout> & any = {
                date: draft.dateISO,
                exercise: it.exercise,
                sets: Number(it.sets || 1), // should be 1 per set row
                reps: Number(it.reps || 0),
                weight: Number(it.weightKg || 0), // ALWAYS kg in backend (matches your old code)
                notes: (it as any).note || it.notes || "",
                sessionId: draft.id,
                sessionTitle: draft.title,
                sessionStartedAt: draft.startedAt,
              };

              await addWorkout(user.uid, {
                ...entry,
                createdAt: undefined,
              } as any);
            }

            await clearSessionDraft(user.uid);

            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}

            const vol =
              unit === "lb" ? kgToLb(stats.totalVolumeKg) : stats.totalVolumeKg;
            RNAlert.alert(
              "Nice work",
              `You logged ${fmtCompact(stats.totalSets)} sets • ${fmtCompact(
                stats.totalReps
              )} reps • ${fmtCompact(Math.round(vol))} ${unit} volume`
            );
            router.back();
          },
        },
      ]
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UI

  const softShadow = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.22 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  };

  if (!draft) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const restLabel = rest
    ? rest.running
      ? `Rest ${Math.floor(restRemaining / 60)}:${pad2(restRemaining % 60)}`
      : "Rest done"
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 130, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        {/* Sticky-ish header card */}
        <GlassCard>
          <Row between>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                ...softShadow,
              }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>

            <Pressable
              onPress={() => {
                setTitleDraft(draft.title || "Workout");
                setTitleOpen(true);
              }}
              style={{ alignItems: "center", gap: 4, flex: 1 }}
            >
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                IN PROGRESS
              </Text>

              <Row gap={8}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "1000" as any,
                    fontSize: 16,
                  }}
                >
                  {draft.title || "Workout"}
                </Text>
                <Ionicons name="pencil" size={14} color={colors.muted} />
              </Row>

              <Row
                gap={8}
                style={{
                  marginTop: 2,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <Chip
                  label={`${stats.exCount} exercise${
                    stats.exCount === 1 ? "" : "s"
                  }`}
                  icon="barbell"
                />
                <Chip label={elapsedLabel} icon="time" />
                <Chip
                  label={`${fmtCompact(stats.totalSets)} sets`}
                  icon="layers"
                />
              </Row>
            </Pressable>

            <Pressable
              onPress={finishWorkout}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.6),
                ...softShadow,
              }}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </Pressable>
          </Row>

          {/* Session stats */}
          <View style={{ marginTop: 14 }}>
            <Row gap={10}>
              <StatTile label="Sets" value={String(stats.totalSets)} />
              <StatTile label="Reps" value={String(stats.totalReps)} />
              <StatTile label={`Vol (${unit})`} value={volumeDisplay} />
            </Row>

            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
              A workout is a timeline of sets — log between sets with one hand.
            </Text>
          </View>
        </GlassCard>

        {/* Quick Add (exercise + presets) */}
        <GlassCard>
          <Row between>
            <Row gap={10}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(colors.primary, 0.14),
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.25),
                }}
              >
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "1000" as any,
                    fontSize: 14,
                  }}
                >
                  Quick add
                </Text>
                <Text
                  style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}
                >
                  Search an exercise or insert a preset.
                </Text>
              </View>
            </Row>

            <Row gap={10}>
              <Pressable
                onPress={() => setPresetsOpen(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.35),
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Row gap={8}>
                  <Ionicons
                    name="bookmark-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    Presets
                  </Text>
                </Row>
              </Pressable>

              <Pressable
                onPress={() => setSearchOpen(true)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.text, 0.06),
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Ionicons name="search-outline" size={18} color={colors.text} />
              </Pressable>
            </Row>
          </Row>

          <Pressable
            onPress={() => router.push("/(modals)/add-exercise")}
            style={({ pressed }) => ({
              marginTop: 12,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.25),
              backgroundColor: withAlpha(colors.text, 0.06),
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Row between>
              <Row gap={10}>
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={colors.muted}
                />
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Add exercise…
                </Text>
              </Row>
              <Ionicons
                name="arrow-forward-outline"
                size={18}
                color={colors.muted}
              />
            </Row>
          </Pressable>
        </GlassCard>

        {/* Timeline */}
        {groups.length === 0 ? (
          <GlassCard>
            <Text
              style={{
                color: colors.text,
                fontWeight: "1000" as any,
                fontSize: 14,
              }}
            >
              Your workout is empty
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 18 }}>
              Add an exercise above. Each set becomes a row — tap ✓ to complete
              and start rest.
            </Text>
          </GlassCard>
        ) : (
          <View style={{ gap: 12 }}>
            {groups.map((g) => (
              <ExerciseTimelineCard
                key={g.name}
                exercise={g.name}
                items={g.items}
                unit={unit}
                expanded={expanded[g.name] ?? true}
                onToggle={() => toggleExpanded(g.name, true)}
                onAddSet={() => addSetDuplicate(g.name)}
                onRemove={(createdAt) => removeSet(createdAt)}
                onPatch={(createdAt, patch) => patchSet(createdAt, patch)}
                weightStep={weightStep}
                weightBigStep={weightBigStep}
                repsStep={repsStep}
                repsBigStep={repsBigStep}
                lastAddedTs={lastAddedTs}
                onCompleteSet={async (createdAt) => {
                  patchSet(createdAt, { done: true });
                  setRest({
                    running: true,
                    startedAt: Date.now(),
                    durationSec: 90,
                  });
                  try {
                    await Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                  } catch {}
                }}
                onSavePresetFromBlock={async () => {
                  // auto-suggest preset from this block:
                  // use most recent set values + number of sets in block
                  const top = g.items[0];
                  const setCount = g.items.length;
                  const reps = Number(top?.reps || 0);
                  const weightKg = Number(top?.weightKg || 0);

                  const weightUnitVal =
                    unit === "lb" ? kgToLb(weightKg) : weightKg;
                  const suggestedName = `${g.name} – ${setCount}×${reps}`;

                  await onSavePreset({
                    name: suggestedName,
                    exercise: g.name,
                    sets: setCount,
                    reps,
                    weight: Math.round(weightUnitVal * 100) / 100, // pass in current unit; onSavePreset converts
                    notes: "",
                  });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Rest timer overlay (subtle) */}
      {restLabel ? (
        <View
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 86,
            zIndex: 6,
          }}
        >
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.28),
              backgroundColor: withAlpha(colors.card, isDark ? 0.92 : 0.98),
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[
                withAlpha(colors.primary, isDark ? 0.16 : 0.12),
                withAlpha(colors.text, 0.03),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <BlurView
              tint={isDark ? "dark" : "light"}
              intensity={isDark ? 16 : 12}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ padding: 12 }}>
              <Row between>
                <Row gap={10}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(colors.primary, 0.14),
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.25),
                    }}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View>
                    <Text
                      style={{ color: colors.text, fontWeight: "1000" as any }}
                    >
                      {restLabel}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      Auto-started after ✓ • tap to adjust
                    </Text>
                  </View>
                </Row>

                <Row gap={10}>
                  <Pressable
                    onPress={() =>
                      setRest({
                        running: true,
                        startedAt: Date.now(),
                        durationSec: 60,
                      })
                    }
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.text, 0.06),
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      1:00
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setRest({
                        running: true,
                        startedAt: Date.now(),
                        durationSec: 90,
                      })
                    }
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.35),
                      backgroundColor: withAlpha(colors.primary, 0.12),
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      1:30
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRest(null)}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.text, 0.06),
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Ionicons
                      name="close-outline"
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </Row>
              </Row>
            </View>
          </View>
        </View>
      ) : null}

      {/* Sticky footer: Finish */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 14,
          paddingBottom: 14,
          paddingTop: 10,
          backgroundColor: isDark
            ? "rgba(0,0,0,0.35)"
            : "rgba(255,255,255,0.55)",
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={finishWorkout}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.65),
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Row gap={10}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              Finish workout
            </Text>
          </Row>
        </Pressable>
      </View>

      {/* Search sheet */}
      <ExerciseSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        suggested={safePresets.map((p) => p.name)}
        onPick={(name) => {
          setSearchOpen(false);
          addExerciseFirstSet(name);
        }}
      />

      {/* Presets sheet (simple modal) */}
      <Modal visible={presetsOpen} transparent animationType="fade">
        <Pressable
          onPress={() => setPresetsOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            padding: 18,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "1000" as any,
                fontSize: 16,
              }}
            >
              Presets
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Tap to insert • long-press delete
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {safePresets.map((p) => {
                const displayWeight =
                  unit === "lb"
                    ? kgToLb(Number(p.weight || 0))
                    : Number(p.weight || 0);
                const w = Math.round(displayWeight * 100) / 100;

                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setPresetsOpen(false);

                      // Insert preset as multiple set rows (sets=1 each)
                      const ex = (p.exercise || p.name || "").trim();
                      const reps = Number(p.reps || 10) || 10;
                      const weightKg = Number(p.weight || 0) || 0;
                      const count = Math.max(1, Number(p.sets || 1) || 1);

                      // add N rows
                      (async () => {
                        for (let i = 0; i < count; i++) {
                          await addExerciseFirstSet(ex, { reps, weightKg });
                        }
                        // collapse the N “exercise blocks” duplication issue:
                        // addExerciseFirstSet always adds a new set row, but groups are by exercise,
                        // so it becomes one block with many rows (perfect).
                      })();
                    }}
                    onLongPress={() => onDeletePreset(p.id)}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.22),
                      backgroundColor: withAlpha(
                        colors.text,
                        isDark ? 0.08 : 0.06
                      ),
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Row between>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          {p.name}
                        </Text>
                        <Text style={{ color: colors.muted, marginTop: 4 }}>
                          {p.sets}×{p.reps} • {w} {unit}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => onUpdatePreset(p.id)}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: withAlpha(colors.text, 0.06),
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={18}
                          color={colors.muted}
                        />
                      </Pressable>
                    </Row>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setPresetsOpen(false)}
              style={({ pressed }) => ({
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                backgroundColor: withAlpha(colors.text, 0.05),
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Title modal */}
      <Modal visible={titleOpen} animationType="fade" transparent>
        <Pressable
          onPress={() => setTitleOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            padding: 18,
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "1000" as any,
                fontSize: 16,
              }}
            >
              Workout title
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              This becomes the headline on your Workouts page.
            </Text>

            <TextInput
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="e.g., Push Day, Legs, Upper Body"
              placeholderTextColor={colors.muted}
              style={{
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.03)",
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveTitle}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 14,
              }}
            >
              <Pressable
                onPress={() => setTitleOpen(false)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={saveTitle}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ───────────────────────── Components ───────────────────────── */

function Row({
  children,
  gap = 0,
  between = false,
  style,
}: React.PropsWithChildren<{ gap?: number; between?: boolean; style?: any }>) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap },
        between && { justifyContent: "space-between" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function GlassCard({ children }: React.PropsWithChildren) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.9),
        backgroundColor: colors.card,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0.18 : 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <LinearGradient
        colors={[
          withAlpha(colors.primary, isDark ? 0.14 : 0.1),
          withAlpha(colors.text, 0.02),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView
        tint={isDark ? "dark" : "light"}
        intensity={isDark ? 22 : 16}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ padding: 14 }}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  icon,
}: {
  label: string;
  icon: "time" | "layers" | "barbell";
}) {
  const { colors, isDark } = useTheme();
  const iconName =
    icon === "time"
      ? "time-outline"
      : icon === "layers"
      ? "layers-outline"
      : "barbell-outline";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      }}
    >
      <Ionicons name={iconName as any} size={14} color={colors.muted} />
      <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
      }}
    >
      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontWeight: "1000" as any,
          fontSize: 18,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ExerciseTimelineCard({
  exercise,
  items,
  unit,
  expanded,
  onToggle,
  onAddSet,
  onRemove,
  onPatch,
  weightStep,
  weightBigStep,
  repsStep,
  repsBigStep,
  onCompleteSet,
  onSavePresetFromBlock,
  lastAddedTs,
}: {
  exercise: string;
  items: SetDraftItem[];
  unit: "kg" | "lb";
  expanded: boolean;
  onToggle: () => void;
  onAddSet: () => void;
  onRemove: (createdAt: number) => void;
  onPatch: (
    createdAt: number,
    patch: Partial<Pick<SetDraftItem, "reps" | "weightKg" | "done">>
  ) => void;
  weightStep: number;
  weightBigStep: number;
  repsStep: number;
  repsBigStep: number;
  onCompleteSet: (createdAt: number) => void;
  onSavePresetFromBlock: () => void;
  lastAddedTs: number | null;
}) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;

  // block totals
  const totalSets = items.reduce((a, it) => a + Number(it.sets || 0), 0);
  const totalVolKg = items.reduce(
    (a, it) =>
      a +
      Number(it.weightKg || 0) * Number(it.reps || 0) * Number(it.sets || 0),
    0
  );
  const volDisp = unit === "lb" ? kgToLb(totalVolKg) : totalVolKg;

  const last = items[0];
  const lastWeightDisp =
    unit === "lb"
      ? kgToLb(Number(last?.weightKg || 0))
      : Number(last?.weightKg || 0);
  const lastWeightRounded = Math.round(lastWeightDisp * 100) / 100;

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, 0.22),
        backgroundColor: withAlpha(colors.card, isDark ? 0.9 : 0.98),
        overflow: "hidden",
        shadowColor: colors.primary,
        shadowOpacity: isDark ? 0.12 : 0.14,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <LinearGradient
        colors={[
          withAlpha(colors.primary, isDark ? 0.16 : 0.12),
          withAlpha(colors.text, 0.03),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView
        tint={isDark ? "dark" : "light"}
        intensity={isDark ? 16 : 12}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.92 : 1,
          backgroundColor: withAlpha(colors.card, isDark ? 0.76 : 0.92),
        })}
      >
        <Row between>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text
              style={{
                color: colors.text,
                fontWeight: "1000" as any,
                fontSize: 15,
              }}
              numberOfLines={2}
            >
              {exercise}
            </Text>
            <Text
              style={{ color: colors.muted, fontWeight: "800", marginTop: 6 }}
            >
              {totalSets} sets • last {lastWeightRounded} {unit} •{" "}
              {fmtCompact(Math.round(volDisp))} {unit} vol
            </Text>

            <Row gap={8} style={{ marginTop: 10, flexWrap: "wrap" }}>
              <Pressable
                onPress={onAddSet}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.35),
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Row gap={8}>
                  <Ionicons
                    name="duplicate-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    + Set
                  </Text>
                </Row>
              </Pressable>

              <Pressable
                onPress={onSavePresetFromBlock}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.text, 0.06),
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Row gap={8}>
                  <Ionicons
                    name="bookmark-outline"
                    size={14}
                    color={colors.muted}
                  />
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    Save preset
                  </Text>
                </Row>
              </Pressable>
            </Row>
          </View>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.muted}
          />
        </Row>
      </Pressable>

      {/* Set rows */}
      {expanded && (
        <View style={{ padding: 12, paddingTop: 8, gap: 10 }}>
          {items.map((it, idx) => {
            const done = !!(it as any).done;
            const wDisp =
              unit === "lb"
                ? kgToLb(Number(it.weightKg || 0))
                : Number(it.weightKg || 0);
            const wRounded = Math.round(wDisp * 100) / 100;

            return (
              <View
                key={it.createdAt}
                style={{
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.22),
                  backgroundColor: withAlpha(colors.text, isDark ? 0.08 : 0.06),
                  opacity: done ? 0.75 : 1,
                }}
              >
                <View
                  style={{
                    flexDirection: isCompact ? "column" : "row",
                    alignItems: isCompact ? "stretch" : "center",
                    gap: isCompact ? 12 : 10,
                  }}
                >
                  <WeightPlateStacker
                    value={wRounded}
                    unit={unit}
                    step={weightStep}
                    appearance={isDark ? "dark" : "light"}
                    style={{
                      width: isCompact ? "100%" : 180,
                      alignSelf: "stretch",
                    }}
                    scale={isCompact ? 0.94 : 1}
                    onChange={(nextVal) => {
                      const nextKg = unit === "lb" ? lbToKg(nextVal) : nextVal;
                      onPatch(it.createdAt, { weightKg: nextKg });
                    }}
                  />

                  <View style={{ flex: 1, gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        flexWrap: isCompact ? "wrap" : "nowrap",
                      }}
                    >
                      <View style={{ flex: 1, minWidth: isCompact ? 0 : 120 }}>
                        <ValuePill
                          label={`Weight (${unit})`}
                          value={String(wRounded)}
                          onDec={() => {
                            const nextDisp = Math.max(0, wDisp - weightStep);
                            const nextKg =
                              unit === "lb" ? lbToKg(nextDisp) : nextDisp;
                            onPatch(it.createdAt, { weightKg: nextKg });
                          }}
                          onInc={() => {
                            const nextDisp = wDisp + weightStep;
                            const nextKg =
                              unit === "lb" ? lbToKg(nextDisp) : nextDisp;
                            onPatch(it.createdAt, { weightKg: nextKg });
                          }}
                          onDecBig={() => {
                            const nextDisp = Math.max(0, wDisp - weightBigStep);
                            const nextKg =
                              unit === "lb" ? lbToKg(nextDisp) : nextDisp;
                            onPatch(it.createdAt, { weightKg: nextKg });
                          }}
                          onIncBig={() => {
                            const nextDisp = wDisp + weightBigStep;
                            const nextKg =
                              unit === "lb" ? lbToKg(nextDisp) : nextDisp;
                            onPatch(it.createdAt, { weightKg: nextKg });
                          }}
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: isCompact ? 0 : 120 }}>
                        <ValuePill
                          label="Reps"
                          value={String(Number(it.reps || 0))}
                          onDec={() =>
                            onPatch(it.createdAt, {
                              reps: Math.max(
                                0,
                                Number(it.reps || 0) - repsStep
                              ),
                            })
                          }
                          onInc={() =>
                            onPatch(it.createdAt, {
                              reps: Number(it.reps || 0) + repsStep,
                            })
                          }
                          onDecBig={() =>
                            onPatch(it.createdAt, {
                              reps: Math.max(
                                0,
                                Number(it.reps || 0) - repsBigStep
                              ),
                            })
                          }
                          onIncBig={() =>
                            onPatch(it.createdAt, {
                              reps: Number(it.reps || 0) + repsBigStep,
                            })
                          }
                        />
                      </View>
                    </View>

                    <Row
                      gap={10}
                      style={{
                        justifyContent: isCompact ? "flex-start" : "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          if (!done) onCompleteSet(it.createdAt);
                          else onPatch(it.createdAt, { done: false });
                        }}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 40,
                          height: 40,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: done
                            ? withAlpha(colors.primary, 0.45)
                            : colors.border,
                          backgroundColor: done
                            ? withAlpha(colors.primary, 0.16)
                            : withAlpha(colors.text, 0.06),
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Ionicons
                          name={
                            done
                              ? "checkmark-circle"
                              : "checkmark-circle-outline"
                          }
                          size={20}
                          color={done ? colors.primary : colors.muted}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => onRemove(it.createdAt)}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 40,
                          height: 40,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: withAlpha(colors.text, 0.06),
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.muted}
                        />
                      </Pressable>
                    </Row>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ValuePill({
  label,
  value,
  onDec,
  onInc,
  onDecBig,
  onIncBig,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  onDecBig: () => void;
  onIncBig: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.muted,
          fontWeight: "900",
          fontSize: 10,
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </Text>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.03)",
          padding: 8,
        }}
      >
        <Row between>
          <Pressable
            onPress={onDec}
            onLongPress={onDecBig}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 28,
              height: 28,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.text, 0.05),
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="remove-outline" size={16} color={colors.text} />
          </Pressable>

          <Text
            style={{
              color: colors.text,
              fontWeight: "1000" as any,
              fontSize: 14,
            }}
          >
            {value}
          </Text>

          <Pressable
            onPress={onInc}
            onLongPress={onIncBig}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 28,
              height: 28,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.text, 0.05),
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="add-outline" size={16} color={colors.text} />
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
