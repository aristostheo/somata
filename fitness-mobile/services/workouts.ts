// services/workouts.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Workout = {
  id: string;
  uid?: string; // <- for security rules/reads
  date: string; // "YYYY-MM-DD"
  dateMs?: number; // <- local-midnight millis (optional but useful)
  exercise: string;
  primaryMuscle?: string;
  sets?: number;
  reps?: number;
  weight?: number; // stored as KG
  notes?: string;
  createdAt?: Timestamp | number | null;
  sessionId?: string;
  sessionTitle?: string;
  sessionStartedAt?: number;
  setCreatedAt?: number;
};

const col = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "workouts");

type RangeOpts = { from?: string; to?: string; max?: number };

export function subscribeWorkouts(
  uid: string,
  cb: (rows: Workout[]) => void,
  opts: RangeOpts = {}
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }

  let qy;
  const max = opts.max ?? 500;

  if (opts.from && opts.to) {
    // Single-field range filter keeps this index-free (uses automatic single-field index)
    qy = query(
      col(uid),
      where("date", ">=", opts.from),
      where("date", "<=", opts.to),
      orderBy("date", "desc"),
      limit(max)
    );
  } else {
    qy = query(col(uid), orderBy("date", "desc"), limit(max));
  }

  return onSnapshot(
    qy,
    (snap) => {
      const rows: Workout[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        rows.push({
          id: d.id,
          date: x.date || "",
          exercise: x.exercise || "",
          primaryMuscle: x.primaryMuscle || "",
          sets: Number(x.sets ?? 0),
          reps: Number(x.reps ?? 0),
          weight: Number(x.weight ?? 0), // kg
          notes: x.notes || "",
          createdAt: x.createdAt ?? null,
          sessionId: x.sessionId ?? null,
          sessionTitle: x.sessionTitle ?? null,
          sessionStartedAt:
            typeof x.sessionStartedAt === "number"
              ? x.sessionStartedAt
              : x.sessionStartedAt?.toMillis?.() ?? null,
          setCreatedAt:
            typeof x.setCreatedAt === "number"
              ? x.setCreatedAt
              : x.setCreatedAt?.toMillis?.() ?? null,
        });
      });

      // stable within same date by createdAt desc
      rows.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        const ta =
          (a.createdAt as Timestamp)?.toMillis?.() ??
          (a.createdAt as number) ??
          0;
        const tb =
          (b.createdAt as Timestamp)?.toMillis?.() ??
          (b.createdAt as number) ??
          0;
        return tb - ta;
      });

      cb(rows);
    },
    (err) => {
      console.warn("[subscribeWorkouts]", err);
      cb([]);
    }
  );
}

function normalizeISODateOrToday(s?: string) {
  // Accepts "YYYY-MM-DD"; otherwise uses today.
  const isISO = s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const base = isISO ? new Date(`${s}T00:00:00`) : new Date();
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  const dateMs = new Date(`${iso}T00:00:00`).getTime(); // local midnight
  return { iso, dateMs };
}

export async function addWorkout(uid: string, entry: Omit<Workout, "id">) {
  const { iso, dateMs } = normalizeISODateOrToday(entry.date);

  const ref = await addDoc(col(uid), {
    uid, // ✅ used by rules/queries
    exercise: entry.exercise ?? "",
    primaryMuscle: entry.primaryMuscle ?? "",
    sets: Number(entry.sets ?? 0),
    reps: Number(entry.reps ?? 0),
    weight: Number(entry.weight ?? 0),
    notes: entry.notes ?? "",
    date: iso, // ✅ canonical string
    dateMs, // ✅ numeric for future range queries
    sessionId: entry.sessionId ?? null,
    sessionTitle: entry.sessionTitle ?? null,
    sessionStartedAt: entry.sessionStartedAt ?? null,
    setCreatedAt: entry.setCreatedAt ?? null,
    createdAt: serverTimestamp(),
  });
  return ref;
}

export async function updateWorkout(
  uid: string,
  id: string,
  patch: Partial<Workout>
) {
  await updateDoc(doc(col(uid), id), patch as any);
}

export async function deleteWorkout(uid: string, id: string) {
  await deleteDoc(doc(col(uid), id));
}

// Optional utility for “recent” area
export async function getRecentWorkouts(uid: string, n = 50) {
  const qy = query(col(uid), orderBy("date", "desc"), limit(n));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  })) as Workout[];
}
