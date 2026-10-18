import assert from "node:assert/strict";
import test from "node:test";
import { projectPendingNutrition } from "../services/previewNutritionProjection";

test("single food and batch handoffs keep their dated meal and nutrient values", () => {
  const single = projectPendingNutrition(JSON.stringify({
    date: "2026-10-09", meal: "dinner", name: "Synthetic food", qty: 2,
    unit: "serving", calories: 0, protein: 0, carbs: 12, fat: 1,
  }), "@pending_add_meal", "2026-10-10");
  assert.equal(single[0].date, "2026-10-09");
  assert.equal(single[0].meal, "dinner");
  assert.equal(single[0].calories, 0);
  assert.equal(single[0].carbs, 12);

  const batch = projectPendingNutrition(JSON.stringify({
    date: "2026-10-10", meal: "lunch",
    items: [{ name: "A", calories: 100 }, { name: "B", calories: 200 }],
  }), "@pending_add_meal_batch_v1", "2026-10-10");
  assert.equal(batch.length, 2);
  assert.equal(batch[1].meal, "lunch");
  assert.equal(batch.reduce((sum, food) => sum + food.calories, 0), 300);
});

test("meal-builder handoff saves the bundle with existing summed targets", () => {
  const items = [
    { id: "a", name: "Synthetic A", qty: 1, unit: "serving", calories: 100,
      protein: 10, carbs: 12, fat: 2, baseQty: 1, baseCalories: 100,
      baseProtein: 10, baseCarbs: 12, baseFat: 2 },
    { id: "b", name: "Synthetic B", qty: 1, unit: "serving", calories: 150,
      protein: 5, carbs: 20, fat: 5, baseQty: 1, baseCalories: 150,
      baseProtein: 5, baseCarbs: 20, baseFat: 5 },
  ];
  const [row] = projectPendingNutrition(JSON.stringify({
    date: "2026-10-10", meal: "breakfast", name: "Synthetic meal", items,
  }), "@pending_meal_builder_log_v1", "2026-10-10");
  assert.equal(row.entryKind, "meal");
  assert.equal(row.calories, 250);
  assert.equal(row.protein, 15);
  assert.equal(row.carbs, 32);
  assert.equal(row.fat, 7);
  assert.equal(row.items?.length, 2);
  assert.equal(row.meal, "breakfast");
});
