// src/services/nutritionRecents.ts
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { app } from "@/lib/firebase";

export type RecentFood = {
  id?: string;
  name: string;
  unit: string;
  qty: number;
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
};

function toRecentFood(d: any): RecentFood | null {
  const name = String(d?.name || "").trim();
  if (!name) return null;
  return {
    id: d?.foodRefId != null ? String(d.foodRefId) : undefined,
    name,
    unit: String(d?.unit || "serving"),
    qty: Number(d?.qty || 1),
    calories: Number(d?.calories || 0),
    protein: Number(d?.protein || 0),
    carbs: Number(d?.carbs || 0),
    fat: Number(d?.fat || 0),
    sugar: d?.sugar != null ? Number(d.sugar) : undefined,
    fiber: d?.fiber != null ? Number(d.fiber) : undefined,
    addedSugar: d?.addedSugar != null ? Number(d.addedSugar) : undefined,
    satFat: d?.satFat != null ? Number(d.satFat) : undefined,
    sodium: d?.sodium != null ? Number(d.sodium) : undefined,
    wholeFoodRatio:
      d?.wholeFoodRatio != null ? Number(d.wholeFoodRatio) : undefined,
    veggieFruitServings:
      d?.veggieFruitServings != null
        ? Number(d.veggieFruitServings)
        : undefined,
    unsatFatRatio:
      d?.unsatFatRatio != null ? Number(d.unsatFatRatio) : undefined,
    alcoholCalories:
      d?.alcoholCalories != null ? Number(d.alcoholCalories) : undefined,
    foodRefId: d?.foodRefId != null ? String(d.foodRefId) : undefined,
  };
}

function flattenRecentFoodsFromDoc(d: any): RecentFood[] {
  if (d?.entryKind === "meal" && Array.isArray(d?.items)) {
    return d.items
      .map((item: any) => toRecentFood(item))
      .filter(Boolean) as RecentFood[];
  }
  const item = toRecentFood(d);
  return item ? [item] : [];
}

export async function fetchMyRecentFoods(
  uid: string,
  take = 50
): Promise<RecentFood[]> {
  const db = getFirestore(app);

  const q = query(
    collection(db, "users", uid, "nutritionEntries"),
    orderBy("createdAt", "desc"),
    limit(300)
  );

  const snap = await getDocs(q);

  const seen = new Set<string>();
  const out: RecentFood[] = [];

  snap.forEach((docu) => {
    const d: any = docu.data() || {};
    for (const item of flattenRecentFoodsFromDoc(d)) {
      const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  });

  return out.slice(0, take);
}

export async function fetchMyTopFoods(
  uid: string,
  take = 8,
  sample = 500
): Promise<RecentFood[]> {
  const db = getFirestore(app);

  const q = query(
    collection(db, "users", uid, "nutritionEntries"),
    orderBy("createdAt", "desc"),
    limit(sample)
  );

  const snap = await getDocs(q);

  const counts = new Map<
    string,
    { item: RecentFood; count: number; order: number }
  >();
  let idx = 0;

  snap.forEach((docu) => {
    const d: any = docu.data() || {};
    for (const item of flattenRecentFoodsFromDoc(d)) {
      const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      counts.set(key, {
        item,
        count: 1,
        order: idx++,
      });
    }
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, take)
    .map((x) => x.item);
}
