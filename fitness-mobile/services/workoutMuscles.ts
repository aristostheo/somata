import seed from "@/assets/exercises.seed.json";

export const PRIMARY_MUSCLE_KEYS = [
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "traps",
  "lats",
  "rhomboids",
  "lowerBack",
  "quads",
  "adductors",
  "hamstrings",
  "glutes",
  "calves",
] as const;

export type PrimaryMuscleKey = (typeof PRIMARY_MUSCLE_KEYS)[number];

export const PRIMARY_MUSCLE_OPTIONS: Array<{
  key: PrimaryMuscleKey;
  label: string;
}> = [
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "lats", label: "Lats" },
  { key: "rhomboids", label: "Upper back" },
  { key: "traps", label: "Traps" },
  { key: "lowerBack", label: "Lower back" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "forearms", label: "Forearms" },
  { key: "abs", label: "Core" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes", label: "Glutes" },
  { key: "adductors", label: "Adductors" },
  { key: "calves", label: "Calves" },
];

type SeedExercise = {
  name?: string;
  primaryMuscles?: string[];
};

const EXERCISE_SEED = Array.isArray(seed)
  ? (seed as SeedExercise[])
  : [];

const seedByName = new Map(
  EXERCISE_SEED.map((x) => [
    normalizeExerciseName(x.name || ""),
    x.primaryMuscles || [],
  ])
);

function normalizeExerciseName(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function seedSlugToCanonical(slug?: string): PrimaryMuscleKey | undefined {
  switch (String(slug || "").trim().toLowerCase()) {
    case "pectoralis-major":
    case "chest":
      return "chest";
    case "anterior-deltoid":
    case "deltoid":
    case "deltoids":
    case "shoulder":
    case "shoulders":
      return "shoulders";
    case "biceps-brachii":
    case "brachialis":
    case "biceps":
      return "biceps";
    case "triceps-brachii":
    case "triceps":
      return "triceps";
    case "forearm":
    case "forearms":
      return "forearms";
    case "rectus-abdominis":
    case "obliquus-externus-abdominis":
    case "serratus-anterior":
    case "abs":
    case "core":
      return "abs";
    case "trapezius":
      return "traps";
    case "latissimus-dorsi":
      return "lats";
    case "quadriceps-femoris":
    case "quadriceps":
      return "quads";
    case "biceps-femoris":
    case "hamstring":
    case "hamstrings":
      return "hamstrings";
    case "gluteus-maximus":
    case "glutes":
    case "glute":
      return "glutes";
    case "gastrocnemius":
    case "soleus":
    case "calf":
    case "calves":
      return "calves";
    case "adductor":
    case "adductors":
      return "adductors";
    case "lower-back":
    case "lower back":
      return "lowerBack";
    case "upper-back":
    case "upper back":
    case "rhomboid":
    case "rhomboids":
      return "rhomboids";
    default:
      return undefined;
  }
}

export function normalizePrimaryMuscle(
  input?: string | null
): PrimaryMuscleKey | undefined {
  if (!input) return undefined;
  const value = String(input).trim();
  if (!value) return undefined;
  const exact = PRIMARY_MUSCLE_OPTIONS.find(
    (x) => x.key.toLowerCase() === value.toLowerCase()
  );
  if (exact) return exact.key;
  const label = PRIMARY_MUSCLE_OPTIONS.find(
    (x) => x.label.toLowerCase() === value.toLowerCase()
  );
  if (label) return label.key;
  return seedSlugToCanonical(value);
}

function inferFromSeed(exerciseName: string): PrimaryMuscleKey | undefined {
  const normalized = normalizeExerciseName(exerciseName);
  if (!normalized) return undefined;
  const direct = seedByName.get(normalized);
  if (direct?.length) {
    for (const slug of direct) {
      const mapped = seedSlugToCanonical(slug);
      if (mapped) return mapped;
    }
  }
  for (const [name, muscles] of seedByName.entries()) {
    if (
      name.includes(normalized) ||
      normalized.includes(name)
    ) {
      for (const slug of muscles) {
        const mapped = seedSlugToCanonical(slug);
        if (mapped) return mapped;
      }
    }
  }
  return undefined;
}

function inferFromName(exerciseName: string): PrimaryMuscleKey | undefined {
  const all = normalizeExerciseName(exerciseName);
  if (!all) return undefined;
  if (/bench|chest fly|pec deck|pec|press up|push up/.test(all)) return "chest";
  if (/shoulder|lateral raise|front raise|overhead press|arnold press|rear delt/.test(all)) return "shoulders";
  if (/tricep|pushdown|skull crusher|dip/.test(all)) return "triceps";
  if (/bicep|curl|hammer curl|preacher/.test(all)) return "biceps";
  if (/forearm|grip|wrist/.test(all)) return "forearms";
  if (/lat pulldown|pulldown|lat |pull up|chin up/.test(all)) return "lats";
  if (/row|seal row|cable row|machine row|rear delt row|rhomboid/.test(all)) return "rhomboids";
  if (/shrug|trap/.test(all)) return "traps";
  if (/deadlift|back extension|good morning|hyperextension|lower back/.test(all)) return "lowerBack";
  if (/squat|leg press|leg extension|quad|lunge|split squat|step up/.test(all)) return "quads";
  if (/rdl|romanian deadlift|hamstring|leg curl|nordic/.test(all)) return "hamstrings";
  if (/glute|hip thrust|kickback|glute bridge/.test(all)) return "glutes";
  if (/adductor|copenhagen|groin/.test(all)) return "adductors";
  if (/calf/.test(all)) return "calves";
  if (/ab | abs|crunch|sit up|situp|plank|hollow body|core|leg raise|oblique/.test(all)) return "abs";
  return undefined;
}

export function inferPrimaryMuscle(
  exerciseName: string,
  explicit?: string | null
): PrimaryMuscleKey | undefined {
  return (
    normalizePrimaryMuscle(explicit) ||
    inferFromSeed(exerciseName) ||
    inferFromName(exerciseName)
  );
}

export function primaryMuscleLabel(
  key?: string | null
): string | undefined {
  const normalized = normalizePrimaryMuscle(key);
  return PRIMARY_MUSCLE_OPTIONS.find((x) => x.key === normalized)?.label;
}
