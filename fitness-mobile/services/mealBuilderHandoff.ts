import type { AccountStore, LocalDriver } from './local/accountStoreCore';
import type { createMealBuilderItem, MealBuilderMealType } from './mealBuilder';

export const BUILDER_ADDITIONS_KEY = '@pending_meal_builder_additions_v1';
export const BUILDER_HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;
const MAX_CHARS = 128 * 1024;
const idPattern = /^[a-zA-Z0-9_-]{10,100}$/;
type Food = Parameters<typeof createMealBuilderItem>[0] & { id: string };
export type BuilderAddition = { deliveryId: string; date: string; meal: MealBuilderMealType; items: Food[] };
export type HandoffStatus = 'missing' | 'inactive' | 'added' | 'duplicate' | 'invalid' | 'expired' | 'stale' | 'private';
type Owner = Pick<AccountStore, 'uid' | 'assertCurrent'>;
const queues = new Map<string, Promise<unknown>>();
/** Producers and consumers serialize access to the same single-slot UID queue. */
async function locked<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(action);
  queues.set(key, task);
  try { return await task; } finally { if (queues.get(key) === task) queues.delete(key); }
}
function ownerKey(owner: Owner) {
  owner.assertCurrent();
  if (!owner.uid) throw new Error('Sign in again before transferring this meal.');
  return `${BUILDER_ADDITIONS_KEY}:${owner.uid}`;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const mealType = (value: unknown) => value === 'snack' ? 'snacks' : value;
const extras = ['sugar', 'fiber', 'addedSugar', 'satFat', 'sodium', 'wholeFoodRatio', 'veggieFruitServings', 'unsatFatRatio', 'alcoholCalories'] as const;
function validate(raw: string, uid: string, sessionId: string, date: string, now: number): BuilderAddition | HandoffStatus {
  if (raw.length > MAX_CHARS) return 'invalid';
  let data: unknown; try { data = JSON.parse(raw); } catch { return 'invalid'; }
  if (!object(data)) return 'invalid';
  if (data.ownerUid !== uid) return 'private';
  if (typeof data.createdAt !== 'number' || !Number.isFinite(data.createdAt) ||
      now - data.createdAt > BUILDER_HANDOFF_MAX_AGE_MS || data.createdAt > now + 30000) return 'expired';
  if (data.version !== 1 || typeof data.deliveryId !== 'string' || !idPattern.test(data.deliveryId) ||
      typeof data.builderSessionId !== 'string' || !idPattern.test(data.builderSessionId)) return 'invalid';
  if (data.builderSessionId !== sessionId || data.date !== date) return 'stale';
  if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) return 'invalid';
  const meal = mealType(data.meal);
  if (!['breakfast', 'lunch', 'dinner', 'snacks'].includes(String(meal)) || !Array.isArray(data.items) || !data.items.length || data.items.length > 100) return 'invalid';
  const items: Food[] = [];
  for (const [index, row] of data.items.entries()) {
    if (!object(row) || !text(row.name, 200) || !text(row.unit, 80) || !numeric(row.qty) || row.qty <= 0 ||
        !['calories', 'protein', 'carbs', 'fat'].every(key => numeric(row[key])) ||
        (row.date != null && row.date !== data.date) || (row.meal != null && mealType(row.meal) !== meal)) return 'invalid';
    const food: Food = { id: `scan-${data.deliveryId}-${index}`, name: row.name.trim(), unit: row.unit.trim(), qty: row.qty,
      calories: row.calories as number, protein: row.protein as number, carbs: row.carbs as number, fat: row.fat as number };
    for (const key of extras) {
      if (row[key] == null) continue; // Missing is not zero.
      if (!numeric(row[key]) || ((key === 'wholeFoodRatio' || key === 'unsatFatRatio') && row[key] > 1)) return 'invalid';
      food[key] = row[key];
    }
    for (const key of ['source', 'foodRefId'] as const) {
      if (row[key] == null) continue;
      if (!text(row[key], 200)) return 'invalid';
      food[key] = row[key];
    }
    items.push(food);
  }
  return { deliveryId: data.deliveryId, date: data.date, meal: meal as MealBuilderMealType, items };
}

export async function queueBuilderAddition(storage: LocalDriver, owner: Owner, payload: object, deliveryId: string, now = Date.now()) {
  const key = ownerKey(owner);
  return locked(key, async () => {
    owner.assertCurrent();
    const envelope = { ...payload, version: 1, ownerUid: owner.uid, deliveryId, createdAt: now };
    const raw = JSON.stringify(envelope);
    const input = envelope as typeof envelope & { builderSessionId?: unknown; date?: unknown };
    const result = validate(raw, owner.uid!, String(input.builderSessionId ?? ''), String(input.date ?? ''), now);
    if (typeof result === 'string') throw new Error('This scan cannot be transferred. Reopen Scan from Meal Builder and review all food values.');
    const pending = await storage.getItem(key);
    owner.assertCurrent();
    if (pending !== null) throw new Error('A scanned meal is waiting in Meal Builder. Return there before adding another scan.');
    await storage.setItem(key, raw);
    owner.assertCurrent();
  });
}

/** One consumer belongs to one mounted builder. Apply is synchronous; acknowledgment follows it.
 * If cleanup fails, its receipt prevents a retry from re-adding even edited/deleted imported rows. */
export function createBuilderAdditionConsumer(storage: LocalDriver, owner: Owner, sessionId: string, now = Date.now) {
  const seen = new Set<string>();
  return async (date: string, active: () => boolean, apply: (value: BuilderAddition) => void): Promise<HandoffStatus> => {
    const key = ownerKey(owner);
    return locked(key, async () => {
      owner.assertCurrent();
      if (!active()) return 'inactive';
      const raw = await storage.getItem(key);
      owner.assertCurrent();
      if (!active()) return 'inactive';
      if (raw === null) return 'missing';
      const value = validate(raw, owner.uid!, sessionId, date, now());
      if (value === 'private') return 'private'; // Leave an explicitly different owner's payload isolated.
      let status: HandoffStatus;
      if (typeof value === 'string') status = value;
      else if (seen.has(value.deliveryId)) status = 'duplicate';
      else {
        owner.assertCurrent();
        apply(value);
        seen.add(value.deliveryId);
        status = 'added';
      }
      owner.assertCurrent();
      // Never remove a newer value written outside this process (e.g. a storage recovery tool).
      if (await storage.getItem(key) === raw) {
        owner.assertCurrent();
        if (!active()) return status;
        await storage.removeItem(key);
      }
      owner.assertCurrent();
      return status;
    });
  };
}

export function appendScannedItems<T extends { id: string }>(current: T[], additions: T[]): T[] {
  const ids = new Set(current.map(item => item.id));
  return [...current, ...additions.filter(item => !ids.has(item.id))];
}
