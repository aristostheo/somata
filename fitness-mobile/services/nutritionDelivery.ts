import { projectPendingNutrition } from "./previewNutritionProjection";
import type { FoodEntry } from "./nutrition";
export const NUTRITION_HANDOFF_KEYS = ["@pending_add_meal", "@pending_add_meal_batch_v1", "@pending_meal_builder_log_v1"] as const;
type DeliveryDependencies = {
  storage: { getItem(key: string): Promise<string | null>; removeItem(key: string): Promise<void> };
  save(uid: string, id: string, rows: Omit<FoodEntry, "id">[]): Promise<void>;
  afterSave?(uid: string, rows: Omit<FoodEntry, "id">[], key: string): Promise<void>;
};
/** Keep the confirmed payload until the atomic, idempotent write acknowledges it. */
export function createNutritionDelivery(deps: DeliveryDependencies) {
  const busy = new Set<string>();
  return async (uid: string, today: string, onDate: (date: string) => void) => {
    if (busy.has(uid)) return;
    busy.add(uid);
    try {
      for (const key of NUTRITION_HANDOFF_KEYS) {
        const storageKey = `${key}:${uid}`;
        const raw = await deps.storage.getItem(storageKey);
        if (!raw) continue;
        const payload = JSON.parse(raw);
        if (payload?.ownerUid !== uid) continue; // Never transfer another account's local draft.
        if (typeof payload.deliveryId !== "string" || !/^[a-zA-Z0-9_-]{10,100}$/.test(payload.deliveryId))
          throw new Error("This saved meal cannot be retried safely. Reopen the meal editor.");
        const rows = projectPendingNutrition(raw, key, today);
        if (!rows.length) throw new Error("This meal has no food items. Reopen the meal editor.");
        await deps.save(uid, payload.deliveryId, rows);
        if (await deps.storage.getItem(storageKey) === raw) await deps.storage.removeItem(storageKey);
        onDate(rows[0].date);
        await deps.afterSave?.(uid, rows, key);
      }
    } finally { busy.delete(uid); }
  };
}
