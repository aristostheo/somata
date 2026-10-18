/** Existing built-in workout presets, shared by the current and preview experiences. */
export type SharedTemplateVM = {
  id: string; name: string; emoji?: string; tag?: string; tags?: string[];
  source: "user" | "auto";
  items: Array<{ exercise: string; sets: number; reps: number; weight?: number;
    weightKg?: number; notes?: string }>;
  createdAt?: any; updatedAt?: any; lastUsedAt?: any;
  pinned?: boolean; archived?: boolean;
};

export const AUTO_TEMPLATES: SharedTemplateVM[] = [
  {
    id: "auto-push",
    name: "Push (Strength)",
    emoji: "🔥",
    tag: "Upper • Strength",
    source: "auto",
    items: [
      { exercise: "Bench Press", sets: 4, reps: 6, weightKg: 0 },
      { exercise: "Incline DB Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Overhead Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Lateral Raise", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "Triceps Pushdown", sets: 3, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-pull",
    name: "Pull (Strength)",
    emoji: "🧲",
    tag: "Upper • Strength",
    source: "auto",
    items: [
      { exercise: "Lat Pulldown", sets: 4, reps: 8, weightKg: 0 },
      { exercise: "Chest-Supported Row", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Seated Cable Row", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Face Pull", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "DB Curl", sets: 3, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-legs",
    name: "Legs (Strength)",
    emoji: "🦵",
    tag: "Lower • Strength",
    source: "auto",
    items: [
      { exercise: "Squat", sets: 4, reps: 6, weightKg: 0 },
      { exercise: "RDL", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Leg Press", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Leg Curl", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "Calf Raise", sets: 4, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-upper",
    name: "Upper (Balanced)",
    emoji: "⚡️",
    tag: "Upper • Balanced",
    source: "auto",
    items: [
      { exercise: "Bench Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Lat Pulldown", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Incline DB Press", sets: 2, reps: 10, weightKg: 0 },
      { exercise: "Row (Machine)", sets: 2, reps: 10, weightKg: 0 },
      { exercise: "Lateral Raise", sets: 2, reps: 15, weightKg: 0 },
    ],
  },
  {
    id: "auto-zone2",
    name: "Zone 2 Cardio",
    emoji: "🫀",
    tag: "Cardio • Conditioning",
    source: "auto",
    items: [
      {
        exercise: "Treadmill / Run",
        sets: 1,
        reps: 1,
        notes: "20–40 min Zone 2",
      },
    ],
  },
  {
    id: "auto-mobility",
    name: "Mobility (10–15 min)",
    emoji: "🧘",
    tag: "Recovery • Mobility",
    source: "auto",
    items: [
      { exercise: "Hip Opener Flow", sets: 1, reps: 1 },
      { exercise: "Thoracic Rotation", sets: 2, reps: 8 },
      { exercise: "Hamstring Stretch", sets: 2, reps: 1, notes: "45–60s hold" },
    ],
  },
];
