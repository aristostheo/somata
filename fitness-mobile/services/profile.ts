// services/profile.ts
import type { GoalInputs, MacroResult } from "./macroCalculator";
import {
  doc,
  deleteField,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Profile = {
  email?: string;
  displayName?: string | null;
  photoURL?: string | null;

  weightUnit?: "kg" | "lb";
  calorieGoal?: number;

  // used on Home
  dailyCaloriesTarget?: number;
  dailyProteinTarget?: number;

  // profile fields
  sex?: "male" | "female" | "other";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "athlete"
    | "very_active"
    | "extra_active";
  goal?: "cut" | "maintain" | "lean_bulk" | "bulk";

  // targets
  targetMode?: "proteinPerKg" | "percent";
  proteinPerKg?: number;
  proteinPct?: number;
  carbPct?: number;
  fatPct?: number;

  // computed targets (optional)
  proteinGoal?: number;
  carbGoal?: number;
  fatGoal?: number;

  updatedAt?: number;
  createdAt?: number;

  targetWeightKg?: number;
  targetDate?: string;
  trainingDaysPerWeek?: number;
  stepsGoal?: number;

  macroMethod?: "proteinPerKg" | "percent" | "cycling";
  cycling?: {
    trainingCarbPct?: number;
    restCarbPct?: number;
    // optional, stored for reference
    trainingFatPct?: number;
    restFatPct?: number;
  };

  diet?: {
    type?:
      | "balanced"
      | "mediterranean"
      | "high-protein"
      | "vegetarian"
      | "vegan"
      | "keto";
    allergies?: string[];
    dislikes?: string[];
  };
  meals?: {
    schedule?: Array<{
      label: "breakfast" | "lunch" | "dinner" | "snacks";
      time?: string;
    }>;
  };
  cooking?: {
    minutes?: number;
    skill?: "beginner" | "intermediate" | "advanced";
    budgetPerMealUSD?: number;
  };

  equipment?: string[];
  workoutPlace?: "home" | "gym";
  injuries?: string[];

  // macro goals engine inputs (persisted)
  goalIntensity?: number;
  performanceFocus?: number;
  proteinFocus?: number;
  trackingAccurate?: boolean;
  bodyFatPct?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  recoveryScore?: number;
  bloodOxygenPct?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
  healthLastUpdatedVia?: string;
  healthLastUpdatedAt?: number;
  macroEngineMode?: "cut" | "maintain" | "lean_bulk" | "bulk";
  macroEngineSimple?: boolean;

  stepsPerDay?: number;
  gymSessionsPerWeek?: number;
  sportSessionsPerWeek?: number;
  jobActivity?: "sedentary" | "light" | "active";
  friendVisibility?: {
    enabled?: boolean;
    nutrition?: {
      mealsLoggedToday?: boolean;
      dailyCaloriesTotal?: boolean;
      macroBreakdown?: boolean;
      streakStatus?: boolean;
    };
    workouts?: {
      workoutsLogged?: boolean;
      workoutDetails?: boolean;
      personalRecords?: boolean;
      weeklyVolume?: boolean;
    };
    progress?: {
      consistencyStreak?: boolean;
      badgeCollection?: boolean;
      weeklyReportCard?: boolean;
      weightTrend?: boolean;
    };
    activity?: {
      stepCount?: boolean;
      cardioSessions?: boolean;
    };
  };
  goalInputs?: GoalInputs;
  goalResult?: MacroResult;
  /** Backend-derived projection; authoritative record lives in fitadaptPlans/{uid}. */
  activeFitAdaptTargets?: { calories: number; protein: number; carbs: number; fat: number };
  goalUpdatedAt?: number;
  goalPace?: GoalInputs["pace"];
  proteinPriority?: GoalInputs["proteinPriority"];
  cardioMinutesPerWeek?: number;
  cyclingEnabled?: boolean;
  manualTDEEOverride?: number | null;
  manualMacroRatios?: GoalInputs["manualMacroRatios"];
  bmrFormula?: GoalInputs["bmrFormula"];
};

const ref = (uid: string) => doc(getFirestore() ?? db, "users", uid);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeNested(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    const sanitized = sanitizeNested(inner);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  return next;
}

function sanitizeProfilePatch(patch: Partial<Profile>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      next[key] = deleteField();
      continue;
    }
    next[key] = sanitizeNested(value);
  }
  next.updatedAt = Date.now();
  return next;
}

/**
 * Create the user doc if missing (with sensible defaults) and optionally
 * merge any seed values (email, displayName, etc.). If the doc exists,
 * we still merge the provided seed.
 */
export async function ensureProfile(uid: string, seed: Partial<Profile> = {}) {
  const r = ref(uid);
  const snap = await getDoc(r);

  const baseDefaults: Partial<Profile> = {
    weightUnit: "kg",
    calorieGoal: 2200,
    dailyCaloriesTarget: 2200,
    dailyProteinTarget: 130,
  };

  if (!snap.exists()) {
    await setDoc(
      r,
      {
        ...baseDefaults,
        ...seed,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } else if (Object.keys(seed).length) {
    // Merge any new info (e.g., email/displayName) if passed
    await setDoc(
      r,
      {
        ...seed,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }
}

export function subscribeProfile(uid: string, cb: (p: Profile | null) => void) {
  return onSnapshot(
    ref(uid),
    (snap) => {
      cb(snap.exists() ? (snap.data() as Profile) : null);
    },
    (err) => {
      console.warn("[subscribeProfile]", err);
      cb(null);
    }
  );
}

export async function updateProfile(uid: string, patch: Partial<Profile>) {
  const weight = patch.weightKg;
  if (typeof weight === "number" && Number.isFinite(weight) && weight >= 30 && weight <= 300) {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const batch = writeBatch(getFirestore() ?? db);
    batch.update(ref(uid), sanitizeProfilePatch(patch) as any);
    batch.set(doc(getFirestore() ?? db, "users", uid, "fitadaptWeightEntries", date), { date, weightKg: weight });
    await batch.commit();
    return;
  }
  await updateDoc(ref(uid), sanitizeProfilePatch(patch) as any);
}
export async function setStepsForDate(
  uid: string,
  ymdDate: string,
  steps: number
) {
  const safe = Math.max(0, Math.floor(Number(steps) || 0));
  const r = ref(uid); // ✅ users/{uid}

  // Ensure doc exists + merge steps map
  await setDoc(
    r,
    {
      steps: { [ymdDate]: safe },
      stepsUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    } as any,
    { merge: true }
  );

  // Dot-path write (keeps one canonical field)
  await updateDoc(r, {
    [`steps.${ymdDate}`]: safe,
    stepsUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  } as any);
}

export async function addStepsForDate(
  uid: string,
  ymdDate: string,
  delta: number
) {
  const add = Math.max(0, Math.floor(Number(delta) || 0));
  if (!add) return;

  const r = ref(uid); // ✅ users/{uid}

  // Ensure doc exists (important for updateDoc)
  await setDoc(r, { updatedAt: Date.now() } as any, { merge: true });

  // ✅ Atomic increment (no stale reads)
  await updateDoc(r, {
    [`steps.${ymdDate}`]: increment(add),
    stepsUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  } as any);
}
