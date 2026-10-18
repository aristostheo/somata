import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { validateGeneratedWorkout } from "@/services/aiValidation";
import { Button, Choice, Empty, Field, Heading, IconButton, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View
} from "react-native";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import {
  getRecoveryMetrics,
  subscribeIntegrations,
  type IntegrationSnapshot,
} from "@/services/integrations";
import { callOpenAIJson, type OpenAIMessage } from "@/services/openai";
import { subscribeProfile, type Profile } from "@/services/profile";
import {
  saveWorkoutTemplate,
  subscribeWorkoutTemplates,
  type WorkoutTemplate,
} from "@/services/templates";
import { subscribeWorkouts, type Workout } from "@/services/workouts";

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
const durationCards: Array<{ value: DurationOption; label: string; meta: string; }> = [
  { value: "15-30", label: "Quick", meta: "15–30 min" },
  { value: "30-45", label: "Standard", meta: "30–45 min" },
  { value: "45-60", label: "Full session", meta: "45–60 min" },
  { value: "60+", label: "Extended", meta: "60+ min" },
];
const intensityCards: Array<{ value: IntensityOption; body: string; }> = [
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
    { title: string; latestAt: number; exerciseNames: Set<string>; muscleGroups: Set<string>; }
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

async function readSparkHistory(localStore: AccountStore = accountStorage()) {
  const raw = await localStore.getItem(SPARK_HISTORY_KEY);
  if (!raw) return [] as SparkHistoryItem[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SparkHistoryItem[]) : [];
  } catch {
    return [];
  }
}

async function writeSparkHistory(next: SparkHistoryItem[], localStore: AccountStore = accountStorage()) {
  await localStore.setItem(SPARK_HISTORY_KEY, JSON.stringify(next.slice(0, 20)));
}

function titleCaseFocus(value: string) {
  return value === "full body" ? "Full body" : value;
}

export default function CoachSparkModal() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

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
    const unsubIntegrations = subscribeIntegrations(setIntegrations, localStore);
    readSparkHistory(localStore).then(setHistory).catch(() => { });
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


  function updateForm(patch: Partial<GeneratorState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function persistHistory(item: SparkHistoryItem) {
    const next = [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, 20);
    setHistory(next);
    await writeSparkHistory(next, localStore);
  }

  async function deleteHistoryItem(id: string) {
    const next = history.filter((entry) => entry.id !== id);
    setHistory(next);
    await writeSparkHistory(next, localStore);
  }

  async function generateWorkout() {
    setError(null);
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
        operation: "workout",
        model: "gpt-4o-mini",
        maxTokens: 1500,
        temperature: 0.7,
        retryTemperature: 0.3,
      });
      validateGeneratedWorkout(workout);
      const normalized: GeneratedWorkout = {
        name: oneLine(workout?.name || "Coach Spark Session"),
        tagline: oneLine(workout?.tagline || "Built for today."),
        duration: Number(workout?.duration || parseDurationMinutes(form.duration)),
        warmup: Array.isArray(workout?.warmup) ? workout.warmup : [],
        exercises: Array.isArray(workout?.exercises) ? workout.exercises : [],
        cooldown: Array.isArray(workout?.cooldown) ? workout.cooldown : [],
        coachNote: oneLine(workout?.coachNote || "Train with good form and leave one rep in reserve."),
        estimatedCalories: Number(workout.estimatedCalories),
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
      if (msg.includes("Sign in again")) {
        setError("Sign in again to use Coach Spark.");
      } else if (msg.startsWith("AI ")) {
        setError(msg);
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

  return (<><TaskPage title={generated ? generated.name : 'Build a training session'} section="Coach Spark" onBack={() => router.back()}>

    {!generated ? <><View style={{ flexDirection: 'row', gap: 8 }}>
      {(['quick', 'custom'] as const).map(m => <Choice key={m} label={m === 'quick' ? 'Quick build' : 'Custom build'} selected={mode === m} onPress={() => setMode(m)} />)}
    </View>
      <Heading title="Focus" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(mode === 'quick' ? focusOptionsQuick : focusOptionsCustom).map(focus => <Choice key={focus} label={focus} selected={form.focus === focus} onPress={() => updateForm({ focus })} />)}
      </View>
      <Heading title="Time available" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {durationCards.map(c => <Choice key={c.value} label={`${c.label} · ${c.meta}`} selected={form.duration === c.value} onPress={() => updateForm({ duration: c.value })} />)}
      </View>
      {mode === 'custom' && <><Heading title="Training style" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(styleDescriptors) as StyleOption[]).map(style => <Choice key={style} label={style} selected={form.style === style} onPress={() => updateForm({ style })} />)}
      </View><Text style={F.caption}>{styleDescriptors[form.style]}</Text>
        <Heading title="Equipment" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {equipmentOptions.map(e => <Choice key={e} label={e} selected={form.equipment.includes(e)} onPress={() => updateForm({ equipment: form.equipment.includes(e) ? form.equipment.filter(v => v !== e) : [...form.equipment, e] })} />)}
        </View>
        <Heading title="Effort" />{intensityCards.map(c => <Choice key={c.value} label={`${c.value} · ${c.body}`} selected={form.intensity === c.value} onPress={() => updateForm({ intensity: c.value })} />)}
        <Heading title="Experience" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['Beginner', 'Intermediate', 'Advanced'] as ExperienceOption[]).map(experience => <Choice key={experience} label={experience} selected={form.experience === experience} onPress={() => updateForm({ experience })} />)}
        </View>
        <Heading title="Muscles to avoid" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {avoidMuscleOptions.map(m => <Choice key={m} label={m} selected={form.avoidMuscles.includes(m)} onPress={() => updateForm({ avoidMuscles: form.avoidMuscles.includes(m) ? form.avoidMuscles.filter(v => v !== m) : [...form.avoidMuscles, m] })} />)}
        </View><Field label="Preferred exercises" value={form.preferredExercises} onChangeText={preferredExercises => updateForm({ preferredExercises })} /></>}
      <Field label="Anything else to consider?" multiline value={form.freeText} onChangeText={freeText => updateForm({ freeText })} />
      <Panel>
        <Heading title="Your training context" />
        {contextRows.map((r, i) => <Text key={i} style={F.body}>{r}</Text>)}
      </Panel>
      <Button primary disabled={!canGenerate} label={loading ? loadingPhrases[loadingIndex] : 'Generate workout'} onPress={generateWorkout} />
      <Heading title="Recent suggestions" />{displayedHistory.map(e => <Item key={e.id} title={e.workout.name} detail={new Date(e.createdAt).toLocaleDateString()} onPress={() => setGenerated(e.workout)} action={<IconButton icon="trash-outline" label="Delete suggestion" onPress={() => deleteHistoryItem(e.id)} />} />)}{!!history.length && <Button label={showAllHistory ? 'Show fewer' : 'Show all suggestions'} onPress={() => setShowAllHistory(v => !v)} />}</> :
      <><Text style={F.body}>{generated.tagline}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Metric label="Planned time" value={`${generated.duration} min`} />
        <Metric label="Difficulty" value={generated.difficulty} />
        <Metric label="Estimated energy" value={`${generated.estimatedCalories} kcal`} />
      </View><Panel accent>
          <Text style={F.body}>{generated.coachNote}</Text>
        </Panel>
        {generated.exercises.map((e, i) => <Panel key={`${e.name}-${i}`}>
          <Text style={F.eyebrow}>MOVEMENT {i + 1} · {e.muscleGroup}</Text>
          <Heading title={e.name} detail={`${e.sets} × ${e.reps} · ${e.rest} rest · ${e.weight}`} />
          {!!e.notes && <Text style={F.body}>{e.notes}</Text>}
          {!!e.alternatives?.length && <><Button label="Alternatives" onPress={() => setExpandedAlt(expandedAlt === e.name ? null : e.name)} />{expandedAlt === e.name && e.alternatives.map(a => <Text key={a} style={F.caption}>{a}</Text>)}<Button label="Swap exercise" onPress={() => setSwapExercise(e)} /></>}
        </Panel>)}
        <Button label={`Warm-up · ${generated.warmup.length} exercises`} onPress={() => setWarmupOpen(v => !v)} />{warmupOpen && generated.warmup.map((x, i) => <Item key={i} title={x.exercise} detail={`${x.duration}${x.notes ? ` · ${x.notes}` : ''}`} />)}<Button label={`Cool-down · ${generated.cooldown.length} exercises`} onPress={() => setCooldownOpen(v => !v)} />{cooldownOpen && generated.cooldown.map((x, i) => <Item key={i} title={x.exercise} detail={`${x.duration}${x.notes ? ` · ${x.notes}` : ''}`} />)}
        <Button primary label="Start this workout" onPress={startWorkout} /><Button label={savingTemplate ? 'Saving…' : 'Save as template'} disabled={savingTemplate} onPress={saveAsTemplate} /><Button label={loading ? 'Generating…' : 'Regenerate'} disabled={loading} onPress={generateWorkout} /><Button label="Edit preferences" onPress={() => setGenerated(null)} /></>}

    {!!error && <Empty title="Unable to generate workout" detail={error} />}

  </TaskPage><TaskSheet title="Swap exercise" visible={!!swapExercise} onClose={() => setSwapExercise(null)}>
      {(swapExercise?.alternatives || []).map(alt => <Item key={alt} title={alt} onPress={() => { if (!generated || !swapExercise) return; setGenerated({ ...generated, exercises: generated.exercises.map(e => e.name === swapExercise.name ? { ...e, name: alt } : e) }); setSwapExercise(null); }} />)}
    </TaskSheet></>
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
