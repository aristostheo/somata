import { dayKey } from "@/utils/date";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { callOpenAIJson, type OpenAIMessage } from "@/services/openai";
import { subscribeProfile, type Profile } from "@/services/profile";
import { subscribeWorkouts, type Workout } from "@/services/workouts";
import {
  getRecoveryMetrics,
  subscribeIntegrations,
  type IntegrationSnapshot,
} from "@/services/integrations";
import {
  saveWorkoutTemplate,
  subscribeWorkoutTemplates,
  type WorkoutTemplate,
} from "@/services/templates";

type GeneratorMode = "quick" | "custom";
type FocusOption =
  | "Push"
  | "Pull"
  | "Legs"
  | "Upper"
  | "Lower"
  | "Full body"
  | "Cardio"
  | "Mobility"
  | "HIIT"
  | "Surprise me";
type DurationOption = "15-30" | "30-45" | "45-60" | "60+";
type IntensityOption = "Light" | "Moderate" | "Hard";
type ExperienceOption = "Beginner" | "Intermediate" | "Advanced";
type StyleOption =
  | "Strength"
  | "Hypertrophy"
  | "Endurance"
  | "Athletic"
  | "Recovery"
  | "Power";
type EquipmentOption =
  | "Gym"
  | "Home"
  | "Dumbbells only"
  | "Barbell only"
  | "Cables only"
  | "No equipment";

type GeneratedExercise = {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  weight: string;
  muscleGroup: string;
  notes?: string;
  alternatives?: string[];
};

type GeneratedSectionItem = {
  exercise: string;
  duration: string;
  notes?: string;
};

type GeneratedWorkout = {
  name: string;
  tagline: string;
  duration: number;
  warmup: GeneratedSectionItem[];
  exercises: GeneratedExercise[];
  cooldown: GeneratedSectionItem[];
  coachNote: string;
  estimatedCalories: number;
  difficulty: IntensityOption;
};

type SparkHistoryItem = {
  id: string;
  createdAt: number;
  params: GeneratorState;
  workout: GeneratedWorkout;
};

type GeneratorState = {
  focus: FocusOption;
  duration: DurationOption;
  style: StyleOption;
  equipment: EquipmentOption[];
  intensity: IntensityOption;
  experience: ExperienceOption;
  avoidMuscles: string[];
  preferredExercises: string;
  freeText: string;
};

type WorkoutSessionMeta = {
  name: string;
  daysAgo: number;
  muscleGroups: string[];
  exerciseNames: string[];
};

const SPARK_HISTORY_KEY = "spark_history";
const focusOptionsQuick: FocusOption[] = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
  "Full body",
  "Cardio",
  "Surprise me",
];
const focusOptionsCustom: FocusOption[] = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
  "Full body",
  "Cardio",
  "Mobility",
  "HIIT",
];
const durationCards: Array<{ value: DurationOption; label: string; meta: string }> = [
  { value: "15-30", label: "Quick", meta: "15–30 min" },
  { value: "30-45", label: "Standard", meta: "30–45 min" },
  { value: "45-60", label: "Full session", meta: "45–60 min" },
  { value: "60+", label: "Extended", meta: "60+ min" },
];
const intensityCards: Array<{ value: IntensityOption; body: string }> = [
  { value: "Light", body: "Active recovery, feel-good session" },
  { value: "Moderate", body: "Solid effort, leaving some in the tank" },
  { value: "Hard", body: "Push the limits, high output" },
];
const styleDescriptors: Record<StyleOption, string> = {
  Strength: "Low reps, heavy weight",
  Hypertrophy: "8–12 reps, moderate weight",
  Endurance: "High reps, light weight",
  Athletic: "Explosive, compound movements",
  Recovery: "Light, mobility-focused",
  Power: "Fast, force-based movements",
};
const equipmentOptions: EquipmentOption[] = [
  "Gym",
  "Home",
  "Dumbbells only",
  "Barbell only",
  "Cables only",
  "No equipment",
];
const avoidMuscleOptions = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Core",
  "Calves",
];
const loadingPhrases = [
  "Analyzing your recent sessions...",
  "Selecting exercises for your goals...",
  "Structuring sets and rest times...",
  "Almost ready...",
];

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function toneAlpha(hex: string, alpha: number) {
  const safe = String(hex || "").replace("#", "");
  if (safe.length !== 6) return hex;
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseDurationMinutes(value: DurationOption) {
  if (value === "15-30") return 25;
  if (value === "30-45") return 40;
  if (value === "45-60") return 55;
  return 70;
}

function labelGoal(mode?: string) {
  if (mode === "lean_bulk") return "Lean bulk";
  if (mode === "bulk") return "Bulk";
  if (mode === "cut") return "Cut";
  return "Maintain";
}

function getDateKey(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return dayKey(d);
}

function createdAtMs(row: Workout) {
  return (
    Number(row.setCreatedAt || row.sessionStartedAt || 0) ||
    (typeof (row.createdAt as any)?.toMillis === "function"
      ? (row.createdAt as any).toMillis()
      : Number(row.createdAt || 0)) ||
    0
  );
}

function classifyGroup(title: string, exerciseNames: string[]) {
  const text = `${title} ${exerciseNames.join(" ")}`.toLowerCase();
  if (/push|bench|press|chest|tricep|shoulder/.test(text)) return "Push";
  if (/pull|row|lat|back|bicep|curl/.test(text)) return "Pull";
  if (/leg|quad|hamstring|glute|calf|squat|rdl/.test(text)) return "Legs";
  if (/cardio|run|bike|zone 2|conditioning/.test(text)) return "Cardio";
  if (/mobility|recovery|stretch/.test(text)) return "Mobility";
  return "Full body";
}

function buildRecentSessions(rows: Workout[]): WorkoutSessionMeta[] {
  const grouped = new Map<
    string,
    { title: string; latestAt: number; exerciseNames: Set<string>; muscleGroups: Set<string> }
  >();

  for (const row of rows || []) {
    const key = String(row.sessionId || `${row.date}-${row.sessionTitle || row.exercise}`);
    const existing = grouped.get(key) || {
      title: String(row.sessionTitle || row.exercise || "Workout"),
      latestAt: 0,
      exerciseNames: new Set<string>(),
      muscleGroups: new Set<string>(),
    };
    existing.latestAt = Math.max(existing.latestAt, createdAtMs(row));
    if (row.exercise) existing.exerciseNames.add(String(row.exercise));
    if (row.primaryMuscle) existing.muscleGroups.add(String(row.primaryMuscle));
    grouped.set(key, existing);
  }

  const now = Date.now();
  return [...grouped.values()]
    .sort((a, b) => b.latestAt - a.latestAt)
    .map((session) => ({
      name: session.title,
      daysAgo: Math.max(0, Math.round((now - session.latestAt) / 86400000)),
      muscleGroups: session.muscleGroups.size
        ? [...session.muscleGroups]
        : [classifyGroup(session.title, [...session.exerciseNames])],
      exerciseNames: [...session.exerciseNames],
    }));
}

function getUntrainedMusclesThisWeek(rows: Workout[]) {
  const cutoff = Date.now() - 7 * 86400000;
  const trained = new Set<string>();
  const canonical = ["Push", "Pull", "Legs", "Cardio", "Mobility"];
  for (const row of rows || []) {
    const stamp = createdAtMs(row);
    if (!stamp || stamp < cutoff) continue;
    trained.add(classifyGroup(String(row.sessionTitle || "Workout"), [String(row.exercise || "")]));
  }
  return canonical.filter((item) => !trained.has(item));
}

function getSmartDefaults(context: {
  lastWorkout: WorkoutSessionMeta | null;
  recoveryScore: number | null;
  goalMode?: string | null;
}): GeneratorState {
  let focus: FocusOption = "Full body";
  const last = context.lastWorkout;
  const trained = (last?.muscleGroups || []).map((item) => item.toLowerCase());
  if (trained.some((item) => item.includes("legs"))) focus = "Upper";
  else if (trained.some((item) => item.includes("chest") || item.includes("push"))) focus = "Pull";
  else if (trained.some((item) => item.includes("back") || item.includes("pull"))) focus = "Push";

  const hour = new Date().getHours();
  const duration: DurationOption = hour >= 18 ? "30-45" : "45-60";

  let intensity: IntensityOption = "Moderate";
  if (context.recoveryScore != null && context.recoveryScore < 40) intensity = "Light";
  if (context.recoveryScore != null && context.recoveryScore > 80) intensity = "Hard";

  let style: StyleOption = "Strength";
  if (context.goalMode === "cut") style = "Hypertrophy";
  if (context.goalMode === "bulk" || context.goalMode === "lean_bulk") style = "Hypertrophy";

  return {
    focus,
    duration,
    style,
    equipment: ["Gym"],
    intensity,
    experience: "Intermediate",
    avoidMuscles: [],
    preferredExercises: "",
    freeText: "",
  };
}

function buildContextRows(args: {
  recoveryScore: number | null;
  lastWorkout: WorkoutSessionMeta | null;
  untrainedMuscles: string[];
  currentGoal?: string | null;
}): string[] {
  const rows: string[] = [];
  if (args.recoveryScore != null) rows.push(`Recovery: ${Math.round(args.recoveryScore)}%`);
  if (args.lastWorkout)
    rows.push(`Last session: ${args.lastWorkout.name} · ${args.lastWorkout.daysAgo} days ago`);
  if (args.untrainedMuscles.length)
    rows.push(`Untrained this week: ${args.untrainedMuscles.join(", ")}`);
  if (args.currentGoal) rows.push(`Your goal: ${labelGoal(args.currentGoal)}`);
  return rows;
}

function makePrompt(params: GeneratorState & {
  recoveryScore: number | null;
  lastWorkout: WorkoutSessionMeta | null;
  untrainedMuscles: string[];
  currentGoal?: string | null;
}) {
  const systemPrompt = `You are Coach Spark, an expert personal trainer AI inside the Somata fitness app.
Generate a complete, structured workout plan based on the user's preferences.
Always respond with valid JSON only.

Response format:
{
  "name": "workout name",
  "tagline": "one sentence describing this workout",
  "duration": 45,
  "warmup": [
    { "exercise": "name", "duration": "time or reps", "notes": "optional form cue" }
  ],
  "exercises": [
    {
      "name": "exercise name",
      "sets": 3,
      "reps": "8-10",
      "rest": "75s",
      "weight": "moderate",
      "muscleGroup": "upper",
      "notes": "optional",
      "alternatives": ["alternative 1", "alternative 2"]
    }
  ],
  "cooldown": [
    { "exercise": "name", "duration": "time", "notes": "optional" }
  ],
  "coachNote": "one personalized note",
  "estimatedCalories": 320,
  "difficulty": "Light | Moderate | Hard"
}`;

  const userPrompt = `Generate a workout with these specifications:
- Focus: ${params.focus}
- Duration: ${parseDurationMinutes(params.duration)} minutes
- Style: ${params.style}
- Equipment: ${params.equipment.join(", ") || "Gym"}
- Intensity: ${params.intensity}
- Experience level: ${params.experience}
${params.avoidMuscles.length ? `- Avoid these muscles/areas: ${params.avoidMuscles.join(", ")}` : ""}
${params.preferredExercises ? `- Include if possible: ${params.preferredExercises}` : ""}
${params.freeText ? `- Additional instructions: ${params.freeText}` : ""}

Context about this user today:
${params.recoveryScore != null ? `- Recovery score: ${Math.round(params.recoveryScore)}%` : ""}
${params.lastWorkout ? `- Last workout: ${params.lastWorkout.name} (${params.lastWorkout.daysAgo} days ago, focused on ${params.lastWorkout.muscleGroups.join(", ")})` : ""}
${params.untrainedMuscles.length ? `- Muscle groups not trained this week: ${params.untrainedMuscles.join(", ")}` : ""}
${params.currentGoal ? `- User goal: ${params.currentGoal}` : ""}

Make the workout feel complete and professional. Include specific weight guidance where helpful. Respond with JSON only.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ] satisfies OpenAIMessage[];
}

async function readSparkHistory() {
  const raw = await AsyncStorage.getItem(SPARK_HISTORY_KEY);
  if (!raw) return [] as SparkHistoryItem[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SparkHistoryItem[]) : [];
  } catch {
    return [];
  }
}

async function writeSparkHistory(next: SparkHistoryItem[]) {
  await AsyncStorage.setItem(SPARK_HISTORY_KEY, JSON.stringify(next.slice(0, 20)));
}

function titleCaseFocus(value: string) {
  return value === "full body" ? "Full body" : value;
}

export default function CoachSparkModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    focus?: string;
    duration?: string;
    instant?: string;
    quickPreset?: string;
  }>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [mode, setMode] = useState<GeneratorMode>(params.mode === "custom" ? "custom" : "quick");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workoutRows, setWorkoutRows] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(null);
  const [form, setForm] = useState<GeneratorState>(() =>
    getSmartDefaults({ lastWorkout: null, recoveryScore: null, goalMode: null })
  );
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedWorkout | null>(null);
  const [history, setHistory] = useState<SparkHistoryItem[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null);
  const [swapExercise, setSwapExercise] = useState<GeneratedExercise | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const instantRan = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubProfile = subscribeProfile(user.uid, setProfile);
    const unsubWorkouts = subscribeWorkouts(user.uid, setWorkoutRows, { max: 500 });
    const unsubTemplates = subscribeWorkoutTemplates(user.uid, setTemplates);
    const unsubIntegrations = subscribeIntegrations(setIntegrations);
    readSparkHistory().then(setHistory).catch(() => {});
    return () => {
      unsubProfile?.();
      unsubWorkouts?.();
      unsubTemplates?.();
      unsubIntegrations?.();
    };
  }, [user?.uid]);

  const recentSessions = useMemo(() => buildRecentSessions(workoutRows), [workoutRows]);
  const lastWorkout = recentSessions[0] ?? null;
  const recovery = useMemo(() => getRecoveryMetrics(integrations), [integrations]);
  const untrainedMuscles = useMemo(() => getUntrainedMusclesThisWeek(workoutRows), [workoutRows]);
  const contextRows = useMemo(
    () =>
      buildContextRows({
        recoveryScore: recovery?.recoveryScore ?? null,
        lastWorkout,
        untrainedMuscles,
        currentGoal: profile?.goalInputs?.mode ?? profile?.goal ?? null,
      }),
    [lastWorkout, profile?.goal, profile?.goalInputs?.mode, recovery?.recoveryScore, untrainedMuscles]
  );

  useEffect(() => {
    const defaults = getSmartDefaults({
      lastWorkout,
      recoveryScore: recovery?.recoveryScore ?? null,
      goalMode: profile?.goalInputs?.mode ?? profile?.goal ?? null,
    });
    setForm((prev) => ({
      ...defaults,
      ...prev,
      focus:
        params.focus && focusOptionsCustom.includes(params.focus as FocusOption)
          ? (params.focus as FocusOption)
          : prev.focus || defaults.focus,
      duration:
        params.duration && durationCards.some((card) => card.value === params.duration)
          ? (params.duration as DurationOption)
          : prev.duration || defaults.duration,
    }));
  }, [lastWorkout, recovery?.recoveryScore, profile?.goal, profile?.goalInputs?.mode, params.focus, params.duration]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadingIndex((value) => (value + 1) % loadingPhrases.length);
    }, 1500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (instantRan.current) return;
    if (params.instant !== "1") return;
    if (!profile) return;
    instantRan.current = true;
    generateWorkout();
  }, [params.instant, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGenerate = !loading;
  const displayedHistory = showAllHistory ? history : history.slice(0, 3);
  const apiKeyMissing =
    !process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
    String(process.env.EXPO_PUBLIC_OPENAI_API_KEY).includes("sk-...");

  function updateForm(patch: Partial<GeneratorState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function persistHistory(item: SparkHistoryItem) {
    const next = [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, 20);
    setHistory(next);
    await writeSparkHistory(next);
  }

  async function deleteHistoryItem(id: string) {
    const next = history.filter((entry) => entry.id !== id);
    setHistory(next);
    await writeSparkHistory(next);
  }

  async function generateWorkout() {
    setError(null);
    if (apiKeyMissing) {
      setError("Coach Spark needs to be set up. Contact support.");
      return;
    }
    setLoading(true);
    try {
      const prompt = makePrompt({
        ...form,
        focus: form.focus === "Surprise me" ? getSmartDefaults({
          lastWorkout,
          recoveryScore: recovery?.recoveryScore ?? null,
          goalMode: profile?.goalInputs?.mode ?? profile?.goal ?? null,
        }).focus : form.focus,
        recoveryScore: recovery?.recoveryScore ?? null,
        lastWorkout,
        untrainedMuscles,
        currentGoal: labelGoal(profile?.goalInputs?.mode ?? profile?.goal),
      });
      const workout = await callOpenAIJson<GeneratedWorkout>(prompt, {
        model: "gpt-4o-mini",
        maxTokens: 1500,
        temperature: 0.7,
        retryTemperature: 0.3,
      });
      const normalized: GeneratedWorkout = {
        name: oneLine(workout?.name || "Coach Spark Session"),
        tagline: oneLine(workout?.tagline || "Built for today."),
        duration: Number(workout?.duration || parseDurationMinutes(form.duration)),
        warmup: Array.isArray(workout?.warmup) ? workout.warmup : [],
        exercises: Array.isArray(workout?.exercises) ? workout.exercises : [],
        cooldown: Array.isArray(workout?.cooldown) ? workout.cooldown : [],
        coachNote: oneLine(workout?.coachNote || "Train with good form and leave one rep in reserve."),
        estimatedCalories: Number(workout?.estimatedCalories || 250),
        difficulty:
          workout?.difficulty === "Light" || workout?.difficulty === "Hard"
            ? workout.difficulty
            : "Moderate",
      };
      setGenerated(normalized);
      const historyItem: SparkHistoryItem = {
        id: `${Date.now()}`,
        createdAt: Date.now(),
        params: form,
        workout: normalized,
      };
      await persistHistory(historyItem);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("OpenAI API key not configured")) {
        setError("Coach Spark needs to be set up. Contact support.");
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setError("Couldn't connect. Check your connection and try again.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function startWorkout() {
    if (!user?.uid || !generated) return;
    const seed = {
      title: generated.name,
      exercises: generated.exercises.map((exercise) => ({
        name: exercise.name,
        sets: Math.max(1, Number(exercise.sets || 1)),
        reps: Number(String(exercise.reps).split("-")[0].replace(/\D/g, "") || 10),
        weightKg: 0,
        note: exercise.notes || `${exercise.rest} rest · ${exercise.weight}`,
        primaryMuscle: exercise.muscleGroup,
      })),
    };
    await AsyncStorage.setItem(`workout:templateSeed:${user.uid}`, JSON.stringify(seed));
    router.replace({
      pathname: "/workouts/session",
      params: { templateLaunch: "1", templateName: generated.name },
    } as any);
  }

  async function saveAsTemplate() {
    if (!user?.uid || !generated || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await saveWorkoutTemplate(user.uid, {
        name: generated.name,
        title: generated.name,
        tags: [form.focus, form.style, form.intensity],
        items: generated.exercises.map((exercise) => ({
          exercise: exercise.name,
          sets: exercise.sets,
          reps: Number(String(exercise.reps).split("-")[0].replace(/\D/g, "") || 10),
          weightKg: 0,
          notes: exercise.notes || undefined,
        })),
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  const selectedIndicatorColor = colors.accentSubtle;
  const selectedFill = colors.accentDim;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="sparkles-outline" size={18} color={colors.accentMuted} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Coach Spark</Text>
          </View>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
            Your AI personal trainer
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: colors.surface3, borderColor: colors.border }]}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.segment, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        {(["quick", "custom"] as const).map((value) => {
          const active = mode === value;
          return (
            <Pressable
              key={value}
              onPress={() => setMode(value)}
              style={[
                styles.segmentPill,
                active && { backgroundColor: colors.accent, borderColor: colors.accentSubtle },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.accentForeground : colors.textSecondary },
                ]}
              >
                {value === "quick" ? "Quick" : "Custom"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!generated ? (
          <>
            <SectionLabel label={mode === "quick" ? "QUICK BUILD" : "CUSTOM BUILD"} colors={colors} />

            <BlockLabel title="What do you want to train?" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {(mode === "quick" ? focusOptionsQuick : focusOptionsCustom).map((focus) => {
                const active = form.focus === focus;
                return (
                  <Pressable
                    key={focus}
                    onPress={() => updateForm({ focus })}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: active ? colors.accentMuted : colors.surface2,
                        borderColor: active ? selectedIndicatorColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                      {focus}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <BlockLabel title="How long do you have?" colors={colors} />
            <View style={styles.durationGrid}>
              {durationCards.map((card) => {
                const active = form.duration === card.value;
                return (
                  <Pressable
                    key={card.value}
                    onPress={() => updateForm({ duration: card.value })}
                    style={[
                      styles.durationCard,
                      {
                        backgroundColor: active ? selectedFill : colors.surface1,
                        borderColor: active ? selectedIndicatorColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.durationTitle, { color: colors.textPrimary }]}>
                      {card.label}
                    </Text>
                    <Text style={[styles.durationMeta, { color: colors.textTertiary }]}>{card.meta}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === "custom" ? (
              <>
                <BlockLabel title="Training style" colors={colors} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {(Object.keys(styleDescriptors) as StyleOption[]).map((style) => {
                    const active = form.style === style;
                    return (
                      <Pressable
                        key={style}
                        onPress={() => updateForm({ style })}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? colors.accentMuted : colors.surface2,
                            borderColor: active ? selectedIndicatorColor : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                          {style}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={[styles.helpText, { color: colors.textTertiary }]}>
                  {styleDescriptors[form.style]}
                </Text>

                <BlockLabel title="Equipment" colors={colors} />
                <View style={styles.wrapRow}>
                  {equipmentOptions.map((option) => {
                    const active = form.equipment.includes(option);
                    return (
                      <Pressable
                        key={option}
                        onPress={() =>
                          updateForm({
                            equipment: active
                              ? form.equipment.filter((item) => item !== option)
                              : [...form.equipment, option],
                          })
                        }
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? colors.accentMuted : colors.surface2,
                            borderColor: active ? selectedIndicatorColor : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <BlockLabel title="Intensity" colors={colors} />
                <View style={styles.columnCards}>
                  {intensityCards.map((card) => {
                    const active = form.intensity === card.value;
                    return (
                      <Pressable
                        key={card.value}
                        onPress={() => updateForm({ intensity: card.value })}
                        style={[
                          styles.verticalCard,
                          {
                            backgroundColor: active ? selectedFill : colors.surface1,
                            borderColor: active ? selectedIndicatorColor : colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.verticalTitle, { color: colors.textPrimary }]}>{card.value}</Text>
                          <Text style={[styles.verticalMeta, { color: colors.textTertiary }]}>{card.body}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <BlockLabel title="Experience level" colors={colors} />
                <View style={styles.wrapRow}>
                  {(["Beginner", "Intermediate", "Advanced"] as ExperienceOption[]).map((option) => {
                    const active = form.experience === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => updateForm({ experience: option })}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? colors.accentMuted : colors.surface2,
                            borderColor: active ? selectedIndicatorColor : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <BlockLabel title="Sore or injured areas" colors={colors} />
                <View style={styles.wrapRow}>
                  {avoidMuscleOptions.map((option) => {
                    const active = form.avoidMuscles.includes(option);
                    return (
                      <Pressable
                        key={option}
                        onPress={() =>
                          updateForm({
                            avoidMuscles: active
                              ? form.avoidMuscles.filter((item) => item !== option)
                              : [...form.avoidMuscles, option],
                          })
                        }
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? toneAlpha(colors.danger, 0.12) : colors.surface2,
                            borderColor: active ? colors.danger : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? colors.danger : colors.textSecondary }]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <BlockLabel title="Preferred exercises" colors={colors} />
                <TextInput
                  value={form.preferredExercises}
                  onChangeText={(value) => updateForm({ preferredExercises: value })}
                  placeholder="e.g. bench press, pull-ups, Romanian deadlifts..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface3, borderColor: colors.border, color: colors.textPrimary },
                  ]}
                />
              </>
            ) : null}

            <BlockLabel title="Any notes?" colors={colors} />
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surface3, borderColor: colors.border },
              ]}
            >
              <Ionicons name="create-outline" size={16} color={colors.textTertiary} />
              <TextInput
                value={form.freeText}
                onChangeText={(value) => updateForm({ freeText: value })}
                placeholder="e.g. skip squats, focus on arms, keep it light today..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.inlineInput, { color: colors.textPrimary }]}
              />
            </View>

            {mode === "custom" && contextRows.length ? (
              <View
                style={[
                  styles.contextCard,
                  {
                    backgroundColor: colors.accentDim,
                    borderColor: colors.accentSubtle,
                  },
                ]}
              >
                <Text style={[styles.contextLabel, { color: colors.textTertiary }]}>Also factoring in:</Text>
                {contextRows.map((row) => (
                  <View key={row} style={styles.contextRow}>
                    <View
                      style={[
                        styles.contextDot,
                        { backgroundColor: colors.accentMuted },
                      ]}
                    />
                    <Text style={[styles.contextText, { color: colors.textSecondary }]}>{row}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              disabled={!canGenerate}
              onPress={generateWorkout}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: canGenerate ? colors.accent : colors.surface2,
                },
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color={colors.accentForeground} />
                  <Text style={[styles.primaryText, { color: colors.accentForeground }]}>
                    Building your workout...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={16} color={colors.accentForeground} />
                  <Text style={[styles.primaryText, { color: colors.accentForeground }]}>
                    Generate my workout
                  </Text>
                </>
              )}
            </Pressable>
            {loading ? (
              <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
                {loadingPhrases[loadingIndex]}
              </Text>
            ) : null}
            {error ? (
              <View style={[styles.errorCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                {error.includes("Couldn't connect") ? (
                  <Pressable onPress={generateWorkout}>
                    <Text style={[styles.retryText, { color: colors.accentMuted }]}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <SectionLabel label="PREVIOUSLY GENERATED" colors={colors} />
            {displayedHistory.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => setGenerated(entry.workout)}
                onLongPress={() => deleteHistoryItem(entry.id)}
                style={[styles.historyRow, { backgroundColor: colors.surface1, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: colors.textPrimary }]}>{entry.workout.name}</Text>
                  <Text style={[styles.historyMeta, { color: colors.textTertiary }]}>
                    {new Date(entry.createdAt).toLocaleDateString()} · {entry.workout.duration} min
                  </Text>
                </View>
                <View style={[styles.historyChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.historyChipText, { color: colors.textSecondary }]}>
                    {entry.workout.duration}m
                  </Text>
                </View>
              </Pressable>
            ))}
            {history.length > 3 ? (
              <Pressable onPress={() => setShowAllHistory((value) => !value)}>
                <Text style={[styles.viewAllText, { color: colors.accentMuted }]}>
                  {showAllHistory ? "Show less" : "View all →"}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Pressable onPress={() => setGenerated(null)} style={styles.backRow}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </Pressable>

            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{generated.name}</Text>
            <Text style={[styles.previewTagline, { color: colors.textSecondary }]}>{generated.tagline}</Text>
            <View style={styles.previewChipRow}>
              {[`${generated.duration} min`, generated.difficulty, `${generated.estimatedCalories} kcal`].map((label) => (
                <View
                  key={label}
                  style={[styles.historyChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                >
                  <Text style={[styles.historyChipText, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.contextCard,
                { backgroundColor: colors.accentDim, borderColor: colors.accentSubtle },
              ]}
            >
              <View style={styles.contextRow}>
                <Ionicons name="sparkles-outline" size={14} color={colors.accentMuted} />
                <Text style={[styles.contextText, { color: colors.textSecondary, fontStyle: "italic" }]}>
                  {generated.coachNote}
                </Text>
              </View>
            </View>

            {generated.exercises.map((exercise) => {
              const altOpen = expandedAlt === exercise.name;
              return (
                <Pressable
                  key={exercise.name}
                  onLongPress={() => setSwapExercise(exercise)}
                  style={[styles.exerciseCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
                >
                  <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{exercise.name}</Text>
                  <Text style={[styles.exerciseSets, { color: colors.accentMuted }]}>
                    {exercise.sets} × {exercise.reps}
                  </Text>
                  <Text style={[styles.exerciseMeta, { color: colors.textTertiary }]}>
                    Rest {exercise.rest} · {exercise.weight}
                  </Text>
                  <View
                    style={[
                      styles.muscleChip,
                      { backgroundColor: colors.surface3, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.muscleText, { color: colors.textTertiary }]}>{exercise.muscleGroup}</Text>
                  </View>
                  {exercise.notes ? (
                    <Text style={[styles.exerciseNote, { color: colors.textTertiary }]}>{exercise.notes}</Text>
                  ) : null}
                  {exercise.alternatives?.length ? (
                    <>
                      <Pressable onPress={() => setExpandedAlt(altOpen ? null : exercise.name)}>
                        <Text style={[styles.altToggle, { color: colors.accentMuted }]}>Alternatives →</Text>
                      </Pressable>
                      {altOpen ? (
                        <View style={styles.altList}>
                          {exercise.alternatives.map((alt) => (
                            <Text key={alt} style={[styles.altItem, { color: colors.textSecondary }]}>
                              {alt}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </Pressable>
              );
            })}

            <CollapseSection
              title={`Warm-up · ${generated.warmup.length} exercises`}
              open={warmupOpen}
              onToggle={() => setWarmupOpen((value) => !value)}
              colors={colors}
              items={generated.warmup}
            />
            <CollapseSection
              title={`Cool-down · ${generated.cooldown.length} exercises`}
              open={cooldownOpen}
              onToggle={() => setCooldownOpen((value) => !value)}
              colors={colors}
              items={generated.cooldown}
            />

            <Pressable onPress={startWorkout} style={[styles.primaryButton, { backgroundColor: colors.accent }]}>
              <Ionicons name="play" size={16} color={colors.accentForeground} />
              <Text style={[styles.primaryText, { color: colors.accentForeground }]}>Start this workout</Text>
            </Pressable>
            <Pressable
              onPress={generateWorkout}
              style={[styles.secondaryButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Regenerate →</Text>
            </Pressable>
            <Pressable onPress={saveAsTemplate}>
              <Text style={[styles.saveTemplateText, { color: colors.accentMuted }]}>
                {savingTemplate ? "Saving..." : "Save as template →"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {swapExercise ? (
        <View style={styles.swapScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSwapExercise(null)} />
          <View style={[styles.swapSheet, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.swapTitle, { color: colors.textPrimary }]}>Swap exercise</Text>
            {(swapExercise.alternatives || []).map((alt) => (
              <Pressable
                key={alt}
                onPress={() => {
                  if (!generated) return;
                  setGenerated({
                    ...generated,
                    exercises: generated.exercises.map((exercise) =>
                      exercise.name === swapExercise.name
                        ? { ...exercise, name: alt }
                        : exercise
                    ),
                  });
                  setSwapExercise(null);
                }}
                style={[styles.swapRow, { backgroundColor: colors.surface1, borderColor: colors.border }]}
              >
                <Text style={[styles.swapRowText, { color: colors.textSecondary }]}>{alt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{label}</Text>;
}

function BlockLabel({ title, colors }: { title: string; colors: any }) {
  return <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>{title}</Text>;
}

function CollapseSection({
  title,
  open,
  onToggle,
  colors,
  items,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  colors: any;
  items: GeneratedSectionItem[];
}) {
  return (
    <View style={[styles.collapseWrap, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Pressable onPress={onToggle} style={styles.collapseHeader}>
        <Text style={[styles.collapseTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textTertiary}
        />
      </Pressable>
      {open
        ? items.map((item) => (
            <View key={`${title}-${item.exercise}`} style={styles.collapseRow}>
              <Text style={[styles.collapseName, { color: colors.textSecondary }]}>{item.exercise}</Text>
              <Text style={[styles.collapseMeta, { color: colors.textTertiary }]}>
                {item.duration}
                {item.notes ? ` · ${item.notes}` : ""}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "500" },
  headerSub: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  segment: {
    marginHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { fontSize: 13, fontWeight: "500" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 1, marginTop: 8 },
  blockLabel: { fontSize: 15, fontWeight: "500", marginTop: 8 },
  pillRow: { gap: 8, paddingTop: 6, paddingBottom: 4 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 12, fontWeight: "400" },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  durationCard: {
    width: "48.5%",
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  durationTitle: { fontSize: 14, fontWeight: "500" },
  durationMeta: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  helpText: { marginTop: 2, fontSize: 12, fontWeight: "300" },
  columnCards: { gap: 8, marginTop: 6 },
  verticalCard: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  verticalTitle: { fontSize: 14, fontWeight: "500" },
  verticalMeta: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  inputWrap: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  inlineInput: { flex: 1, fontSize: 14 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 6,
    fontSize: 14,
  },
  contextCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  contextLabel: { fontSize: 12, fontWeight: "300" },
  contextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contextDot: { width: 6, height: 6, borderRadius: 3 },
  contextText: { flex: 1, fontSize: 12, fontWeight: "300", lineHeight: 18 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  primaryText: { fontSize: 14, fontWeight: "500" },
  loadingText: { marginTop: 8, fontSize: 12, fontWeight: "300", textAlign: "center" },
  errorCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  errorText: { fontSize: 12, fontWeight: "300", lineHeight: 18 },
  retryText: { fontSize: 12, fontWeight: "500" },
  historyRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyName: { fontSize: 14, fontWeight: "500" },
  historyMeta: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  historyChip: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  historyChipText: { fontSize: 11, fontWeight: "400" },
  viewAllText: { fontSize: 12, fontWeight: "500", textAlign: "center", marginTop: 4 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  backText: { fontSize: 13, fontWeight: "500" },
  previewTitle: { fontSize: 24, fontWeight: "500", marginTop: 8 },
  previewTagline: { marginTop: 6, fontSize: 13, fontWeight: "300", fontStyle: "italic" },
  previewChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  exerciseCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginTop: 8,
  },
  exerciseName: { fontSize: 15, fontWeight: "500" },
  exerciseSets: { fontSize: 12, fontWeight: "500" },
  exerciseMeta: { fontSize: 12, fontWeight: "300" },
  muscleChip: {
    alignSelf: "flex-start",
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  muscleText: { fontSize: 10, fontWeight: "300" },
  exerciseNote: { fontSize: 12, fontWeight: "300", fontStyle: "italic" },
  altToggle: { fontSize: 12, fontWeight: "500", marginTop: 4 },
  altList: { gap: 4, marginTop: 4 },
  altItem: { fontSize: 12, fontWeight: "300" },
  collapseWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  collapseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collapseTitle: { fontSize: 14, fontWeight: "500" },
  collapseRow: { marginTop: 8 },
  collapseName: { fontSize: 13, fontWeight: "400" },
  collapseMeta: { marginTop: 2, fontSize: 12, fontWeight: "300" },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryText: { fontSize: 13, fontWeight: "400" },
  saveTemplateText: { fontSize: 12, fontWeight: "500", textAlign: "center", marginTop: 10 },
  swapScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  swapSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  swapTitle: { fontSize: 16, fontWeight: "500" },
  swapRow: { borderRadius: 12, borderWidth: 1, padding: 12 },
  swapRowText: { fontSize: 13, fontWeight: "400" },
});
