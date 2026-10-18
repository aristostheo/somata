import test from "node:test";
import assert from "node:assert/strict";
import { createNutritionDelivery, NUTRITION_HANDOFF_KEYS } from "../services/nutritionDelivery";
import { projectPendingNutrition } from "../services/previewNutritionProjection";
const key = NUTRITION_HANDOFF_KEYS[0];
const storageKey = `${key}:synthetic-owner`;
const payload = JSON.stringify({ ownerUid: "synthetic-owner", deliveryId: "synthetic-delivery", name: "Toast", qty: 1,
  calories: 100, protein: 4, carbs: 15, fat: 2, date: "2026-10-12" });
function fixture() {
  const values = new Map([[storageKey, payload]]);
  const storage = { getItem: async (key: string) => values.get(key) ?? null, removeItem: async (key: string) => { values.delete(key); } };
  return { values, storage };
}
test("failed meal saves retain confirmation; retry uses the same ID and clears only after acknowledgement", async () => {
  const { values, storage } = fixture(); let calls = 0; const ids: string[] = [];
  const consume = createNutritionDelivery({ storage, save: async (_uid, id) => {
    ids.push(id); if (++calls === 1) throw new Error("offline");
  } });
  await assert.rejects(consume("synthetic-owner", "2026-10-12", () => {}), /offline/);
  assert.equal(values.get(storageKey), payload);
  await consume("synthetic-owner", "2026-10-12", () => {});
  assert.deepEqual(ids, ["synthetic-delivery", "synthetic-delivery"]);
  assert.equal(values.has(storageKey), false);
});
test("duplicate delivery is coalesced, unrelated accounts are excluded, and a newer queued meal survives", async () => {
  const { values, storage } = fixture(); let calls = 0;
  let finish!: () => void; const gate = new Promise<void>(resolve => { finish = resolve; });
  const consume = createNutritionDelivery({ storage, save: async () => { calls++; await gate; } });
  await consume("other-owner", "2026-10-12", () => {}); assert.equal(calls, 0);
  const first = consume("synthetic-owner", "2026-10-12", () => {});
  await consume("synthetic-owner", "2026-10-12", () => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  values.set(storageKey, "newer payload"); finish(); await first;
  assert.equal(calls, 1); assert.equal(values.get(storageKey), "newer payload");
});
test("unscoped historical handoffs are retained and never attributed to a signed-in account", async () => {
  const { values, storage } = fixture(); values.set(storageKey, JSON.stringify({ name: "Unscoped" }));
  await createNutritionDelivery({ storage, save: async () => { assert.fail("Must not write"); } })("synthetic-owner", "2026-10-12", () => {});
  assert.ok(values.has(storageKey));
});
test("invalid food values are rejected before persistence, bundled meals omit absent preset IDs", () => {
  for (const qty of [0, -1, "bad"]) assert.throws(() => projectPendingNutrition(JSON.stringify({ ...JSON.parse(payload), qty }), key, "2026-10-12"));
  const [row] = projectPendingNutrition(JSON.stringify({ name: "Bundle", items: [JSON.parse(payload)] }), "@pending_meal_builder_log_v1", "2026-10-12");
  assert.equal(Object.hasOwn(row, "presetId"), false);
});
test("an old account's pending meal does not block a new account's independent delivery", async () => {
  const { values, storage } = fixture();
  values.set(`${key}:second-owner`, JSON.stringify({ ...JSON.parse(payload), ownerUid: "second-owner", deliveryId: "second-delivery" }));
  let finish!: () => void; let started!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const began = new Promise<void>(resolve => { started = resolve; });
  const writes: string[] = [];
  const consume = createNutritionDelivery({ storage, save: async uid => {
    writes.push(uid); if (uid === "synthetic-owner") { started(); await gate; }
  } });
  const old = consume("synthetic-owner", "2026-10-12", () => {}); await began;
  await consume("second-owner", "2026-10-12", () => {});
  assert.deepEqual(writes, ["synthetic-owner", "second-owner"]);
  assert.ok(values.has(storageKey)); assert.equal(values.has(`${key}:second-owner`), false);
  finish(); await old;
});
