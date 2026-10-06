/**
 * components/workouts/sessionDraft.ts
 * Lightweight persisted draft for an in-progress workout session.
 *
 * Stored in AsyncStorage under: workout:draft:${uid}
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type WorkoutSessionDraftItem = {
  exercise: string;
  sets: number;
  reps: number;
  weightKg: number;
  primaryMuscle?: string;
  notes?: string;
  createdAt: number;

  // NEW (optional): enables per-set row identity + UX
  id?: string;
  done?: boolean;
  note?: string; // short note per set (we also mirror into notes for compatibility)
};

export type WorkoutSessionDraft = {
  id: string; // sessionId
  title: string;
  dateISO: string; // YYYY-MM-DD
  startedAt: number; // ms epoch
  updatedAt: number; // ms epoch
  items: WorkoutSessionDraftItem[];
};

function storageKey(uid?: string) {
  return `workout:draft:${uid || "anon"}`;
}

export async function loadSessionDraft(
  uid?: string
): Promise<WorkoutSessionDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as WorkoutSessionDraft;
  } catch {
    return null;
  }
}

export async function saveSessionDraft(
  uid: string | undefined,
  draft: WorkoutSessionDraft
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export async function clearSessionDraft(uid?: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(uid));
  } catch {
    // ignore
  }
}

export function newSessionDraft(params: {
  dateISO: string;
  title?: string;
}): WorkoutSessionDraft {
  const now = Date.now();
  return {
    id: `sess-${now}`,
    title: params.title || "Workout",
    dateISO: params.dateISO,
    startedAt: now,
    updatedAt: now,
    items: [],
  };
}
