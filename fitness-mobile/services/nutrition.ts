// services/nutrition.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  updateDoc,
  limit,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type FoodEntry = {
  id: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snacks" | string;
  name: string;
  qty: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;

  // ✅ ADD THESE:
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number; // 0..1
  veggieFruitServings?: number; // 0..6+
  unsatFatRatio?: number; // 0..1
  alcoholCalories?: number;

  entryKind?: "food" | "meal";
  items?: Array<{
    id?: string;
    name: string;
    qty: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    fiber?: number;
    addedSugar?: number;
    satFat?: number;
    sodium?: number;
    wholeFoodRatio?: number;
    veggieFruitServings?: number;
    unsatFatRatio?: number;
    alcoholCalories?: number;
    foodRefId?: string;
    source?: string;
  }>;
  presetId?: string;

  source?: "manual" | "mock-ai" | string;
  createdAt?: Timestamp | number | null;
};

export type FoodPatch = Partial<
  Omit<FoodEntry, "id" | "date" | "meal" | "createdAt">
> & {
  qty?: number;
  unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;

  // ✅ ADD THESE:
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;
};

export type ExerciseEntry = {
  id: string;
  date: string;
  name: string;
  calories: number; // burned
  createdAt?: Timestamp | number | null;
};

const foodsCol = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "nutritionEntries");
const exerciseCol = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "exerciseEntries");

/* ---------- Foods ---------- */
export function subscribeFoodsByDate(
  uid: string,
  dateISO: string,
  cb: (rows: FoodEntry[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(foodsCol(uid), where("date", "==", dateISO));
  return onSnapshot(
    qy,
    (snap) => {
      const rows: FoodEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          date: data.date,
          meal: data.meal,
          name: data.name,
          qty: Number(data.qty || 0),
          unit: data.unit || "serving",
          calories: Number(data.calories || 0),
          protein: Number(data.protein || 0),
          carbs: Number(data.carbs || 0),
          fat: Number(data.fat || 0),
          sugar: data.sugar != null ? Number(data.sugar) : undefined,
          fiber: data.fiber != null ? Number(data.fiber) : undefined,

          // ✅ ADD THESE:
          addedSugar:
            data.addedSugar != null ? Number(data.addedSugar) : undefined,
          satFat: data.satFat != null ? Number(data.satFat) : undefined,
          sodium:
            data.sodium != null
              ? Number(data.sodium)
              : data.sodiumMg != null
              ? Number(data.sodiumMg)
              : undefined,
          wholeFoodRatio:
            data.wholeFoodRatio != null
              ? Number(data.wholeFoodRatio)
              : undefined,
          veggieFruitServings:
            data.veggieFruitServings != null
              ? Number(data.veggieFruitServings)
              : undefined,
          unsatFatRatio:
            data.unsatFatRatio != null ? Number(data.unsatFatRatio) : undefined,
          alcoholCalories:
            data.alcoholCalories != null
              ? Number(data.alcoholCalories)
              : undefined,
          entryKind: data.entryKind === "meal" ? "meal" : "food",
          items: Array.isArray(data.items)
            ? data.items.map((item: any) => ({
                id: item?.id,
                name: String(item?.name || "").trim(),
                qty: Number(item?.qty || 0),
                unit: String(item?.unit || "serving"),
                calories: Number(item?.calories || 0),
                protein: Number(item?.protein || 0),
                carbs: Number(item?.carbs || 0),
                fat: Number(item?.fat || 0),
                sugar:
                  item?.sugar != null ? Number(item.sugar) : undefined,
                fiber:
                  item?.fiber != null ? Number(item.fiber) : undefined,
                addedSugar:
                  item?.addedSugar != null
                    ? Number(item.addedSugar)
                    : undefined,
                satFat:
                  item?.satFat != null ? Number(item.satFat) : undefined,
                sodium:
                  item?.sodium != null ? Number(item.sodium) : undefined,
                wholeFoodRatio:
                  item?.wholeFoodRatio != null
                    ? Number(item.wholeFoodRatio)
                    : undefined,
                veggieFruitServings:
                  item?.veggieFruitServings != null
                    ? Number(item.veggieFruitServings)
                    : undefined,
                unsatFatRatio:
                  item?.unsatFatRatio != null
                    ? Number(item.unsatFatRatio)
                    : undefined,
                alcoholCalories:
                  item?.alcoholCalories != null
                    ? Number(item.alcoholCalories)
                    : undefined,
                foodRefId: item?.foodRefId,
                source: item?.source,
              }))
            : undefined,
          presetId:
            data.presetId != null ? String(data.presetId) : undefined,

          source: data.source,
          createdAt: data.createdAt ?? null,
        });
      });
      // sort newest first locally
      rows.sort((a, b) => {
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
      console.warn("[subscribeFoodsByDate]", err);
      cb([]);
    }
  );
}

export async function addFood(uid: string, entry: Omit<FoodEntry, "id">) {
  const ref = await addDoc(foodsCol(uid), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref;
}

export async function updateFood(uid: string, id: string, patch: FoodPatch) {
  await updateDoc(doc(foodsCol(uid), id), patch as any);
}

export async function deleteFood(uid: string, id: string) {
  await deleteDoc(doc(foodsCol(uid), id));
}

export async function getRecentFoods(uid: string, n = 20) {
  // optional utility for quick-adds, sorted by createdAt desc
  const qy = query(foodsCol(uid), orderBy("createdAt", "desc"), limit(n));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  })) as FoodEntry[];
}
export async function getFoodsInRange(
  uid: string,
  fromISO: string,
  toISO: string
): Promise<FoodEntry[]> {
  if (!uid || uid === "__demo__") return [];
  const qy = query(
    foodsCol(uid),
    where("date", ">=", fromISO),
    where("date", "<=", toISO)
  );
  const snap = await getDocs(qy);
  const rows: FoodEntry[] = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
  return rows;
}
/* ---------- Exercise ---------- */
export function subscribeExerciseByDate(
  uid: string,
  dateISO: string,
  cb: (rows: ExerciseEntry[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(exerciseCol(uid), where("date", "==", dateISO));
  return onSnapshot(
    qy,
    (snap) => {
      const rows: ExerciseEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          date: data.date,
          name: data.name,
          calories: Number(data.calories || 0),
          createdAt: data.createdAt ?? null,
        });
      });
      rows.sort((a, b) => {
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
      console.warn("[subscribeExerciseByDate]", err);
      cb([]);
    }
  );
}

export async function addExercise(
  uid: string,
  entry: Omit<ExerciseEntry, "id">
) {
  const ref = await addDoc(exerciseCol(uid), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref;
}

export async function deleteExercise(uid: string, id: string) {
  await deleteDoc(doc(exerciseCol(uid), id));
}
export function subscribeFoodsBetween(
  uid: string,
  fromISO: string,
  toISO: string,
  cb: (rows: FoodEntry[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(
    collection(getFirestore() ?? db, "users", uid, "nutritionEntries"),
    where("date", ">=", fromISO),
    where("date", "<=", toISO)
  );
  return onSnapshot(
    qy,
    (snap) => {
      const rows: FoodEntry[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeFoodsBetween]", err);
      cb([]);
    }
  );
}

export function subscribeExerciseBetween(
  uid: string,
  fromISO: string,
  toISO: string,
  cb: (rows: ExerciseEntry[]) => void
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }
  const qy = query(
    collection(getFirestore() ?? db, "users", uid, "exerciseEntries"),
    where("date", ">=", fromISO),
    where("date", "<=", toISO)
  );
  return onSnapshot(
    qy,
    (snap) => {
      const rows: ExerciseEntry[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeExerciseBetween]", err);
      cb([]);
    }
  );
}
export async function getExerciseInRange(
  uid: string,
  fromISO: string,
  toISO: string
): Promise<ExerciseEntry[]> {
  if (!uid || uid === "__demo__") return [];
  const qy = query(
    exerciseCol(uid),
    where("date", ">=", fromISO),
    where("date", "<=", toISO)
  );
  const snap = await getDocs(qy);
  const rows: ExerciseEntry[] = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
  return rows;
}
