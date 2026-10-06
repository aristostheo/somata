import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type WorkoutTemplateItem = {
  exercise: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightKg?: number;
  notes?: string;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  title?: string;
  emoji?: string;
  tags?: string[];
  tag?: string[] | string;
  items: WorkoutTemplateItem[];
  exercises?: WorkoutTemplateItem[];
  createdAt?: any;
  updatedAt?: any;
  lastUsedAt?: any;
  pinned?: boolean;
  archived?: boolean;
};

export type MealTemplateItem = {
  name: string;
  unit: string;
  qty: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  meal?: string;
};

export type MealTemplate = {
  id: string;
  name: string;
  tags?: string[];
  items: MealTemplateItem[];
  createdAt?: any;
  updatedAt?: any;
};

export type Routine = {
  id: string;
  dayOfWeek: number; // 0-6
  workoutTemplateId?: string | null;
  mealTemplateId?: string | null;
  fromFriendUid?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

const workoutsCol = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "workoutTemplates");
const mealsCol = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "mealTemplates");
const routinesCol = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "routines");

/* ───────────── Workouts ───────────── */
export function subscribeWorkoutTemplates(
  uid: string,
  cb: (rows: WorkoutTemplate[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(workoutsCol(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(
    qy,
    (snap) => {
      const rows: WorkoutTemplate[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;

        rows.push({
          id: d.id,
          name: x.name ?? x.title ?? "Template",
          title: x.title ?? x.name ?? "Template",
          emoji: x.emoji ?? null,
          tags: x.tags ?? x.tag ?? [],
          tag: x.tag ?? x.tags ?? [],
          items: x.items ?? x.exercises ?? [],
          exercises: x.exercises ?? x.items ?? [],
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
          lastUsedAt: x.lastUsedAt ?? null,
          pinned: !!x.pinned,
          archived: !!x.archived,
        });
      });
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeWorkoutTemplates]", err);
      cb([]);
    }
  );
}

export async function saveWorkoutTemplate(
  uid: string,
  payload: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt">
) {
  if (!uid || uid === "__demo__") return null;
  const ref = await addDoc(workoutsCol(uid), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref;
}

export async function deleteWorkoutTemplate(uid: string, id: string) {
  if (!uid || !id) return;
  await deleteDoc(doc(workoutsCol(uid), id));
}

export async function updateWorkoutTemplate(
  uid: string,
  id: string,
  payload: Partial<Omit<WorkoutTemplate, "id">>
) {
  if (!uid || !id) return;
  await setDoc(
    doc(workoutsCol(uid), id),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ───────────── Meals ───────────── */
export function subscribeMealTemplates(
  uid: string,
  cb: (rows: MealTemplate[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(mealsCol(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(
    qy,
    (snap) => {
      const rows: MealTemplate[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        rows.push({
          id: d.id,
          name: x.name,
          tags: x.tags || [],
          items: x.items || [],
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
        });
      });
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeMealTemplates]", err);
      cb([]);
    }
  );
}

export async function saveMealTemplate(
  uid: string,
  payload: Omit<MealTemplate, "id" | "createdAt" | "updatedAt">
) {
  if (!uid || uid === "__demo__") return null;
  const ref = await addDoc(mealsCol(uid), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref;
}

export async function deleteMealTemplate(uid: string, id: string) {
  if (!uid || !id) return;
  await deleteDoc(doc(mealsCol(uid), id));
}

export async function updateMealTemplate(
  uid: string,
  id: string,
  payload: Partial<Omit<MealTemplate, "id">>
) {
  if (!uid || !id) return;
  await setDoc(
    doc(mealsCol(uid), id),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ───────────── Routines (weekly) ───────────── */
export function subscribeRoutines(uid: string, cb: (rows: Routine[]) => void) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(routinesCol(uid), orderBy("dayOfWeek", "asc"));
  return onSnapshot(
    qy,
    (snap) => {
      const rows: Routine[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        rows.push({
          id: d.id,
          dayOfWeek: x.dayOfWeek,
          workoutTemplateId: x.workoutTemplateId ?? null,
          mealTemplateId: x.mealTemplateId ?? null,
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
        });
      });
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeRoutines]", err);
      cb([]);
    }
  );
}

export async function saveRoutine(
  uid: string,
  payload: Omit<Routine, "id" | "createdAt" | "updatedAt">
) {
  if (!uid || uid === "__demo__") return null;
  const ref = await addDoc(routinesCol(uid), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref;
}

export async function deleteRoutine(uid: string, id: string) {
  if (!uid || !id) return;
  await deleteDoc(doc(routinesCol(uid), id));
}
