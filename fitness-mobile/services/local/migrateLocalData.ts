import type { LocalDriver } from './accountStoreCore';
const HANDOFFS = ['@pending_add_meal', '@pending_add_meal_batch_v1', '@pending_meal_builder_log_v1', '@pending_meal_builder_additions_v1'];
/** The old handoff envelope is the only audited unscoped format with an explicit Firebase owner
 * AND an idempotent delivery ID. No inference from current login, dates, email or body values. */
export async function migrateOwnedLocalData(storage: LocalDriver, uid: string, assertCurrent: () => void) {
  for (const key of HANDOFFS) {
    assertCurrent();
    const raw = await storage.getItem(key);
    assertCurrent();
    if (!raw) continue;
    let record: { ownerUid?: unknown; deliveryId?: unknown };
    try { record = JSON.parse(raw); } catch { continue; }
    if (!record || record.ownerUid !== uid || typeof record.deliveryId !== 'string' ||
      !/^[a-zA-Z0-9_-]{10,100}$/.test(record.deliveryId)) continue;
    const target = `${key}:${uid}`;
    const existing = await storage.getItem(target);
    assertCurrent();
    if (existing !== null && existing !== raw) continue; // Do not replace another confirmed meal.
    if (existing === null) await storage.setItem(target, raw);
    assertCurrent();
    // Copy first; a failed removal is safely repeatable because deliveryId is retained.
    if (await storage.getItem(key) === raw) {
      assertCurrent();
      await storage.removeItem(key);
    }
  }
}
