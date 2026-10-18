import { setForActiveAccount } from "./account/guard";
// functions/src/foodHistory.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  onDocumentCreated,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export const onNutritionEntryCreated = onDocumentCreated(
  { document: "users/{uid}/nutritionEntries/{entryId}" },
  // Note the `| undefined` and explicit params type:
  async (
    event: FirestoreEvent<
      QueryDocumentSnapshot | undefined,
      { uid: string; entryId: string }
    >
  ) => {
    const snap = event.data;
    if (!snap) return;

    const { uid } = event.params;
    const entry = snap.data() as {
      name?: string;
      meal?: "breakfast" | "lunch" | "dinner" | "snacks";
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      sugar?: number;
      fiber?: number;
      date?: string;
      source?: string;
      fdcId?: string | null;
      qty?: number;
      unit?: string;
      createdAt?: number;
    };

    const name = (entry.name || "").trim();
    if (!name) return;

    const slug = slugify(name);
    const histRef = db.doc(`users/${uid}/foodHistory/${slug}`);

    await setForActiveAccount(db, uid, histRef,
      {
        name,
        slug,
        sample: {
          calories: Number(entry.calories || 0),
          protein: Number(entry.protein || 0),
          carbs: Number(entry.carbs || 0),
          fat: Number(entry.fat || 0),
          sugar: Number(entry.sugar || 0),
          fiber: Number(entry.fiber || 0),
          unit: entry.unit || "serving",
          qty: Number(entry.qty || 1),
          source: entry.source || "manual",
          fdcId: entry.fdcId || null,
        },
        lastUsedAt: FieldValue.serverTimestamp(),
        uses: FieldValue.increment(1),
      },
      { merge: true }
    );
  }
);
