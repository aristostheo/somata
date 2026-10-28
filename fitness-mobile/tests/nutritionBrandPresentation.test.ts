import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { dashboardPreviewPlan } from '../services/dashboardPreviewData';
const require = createRequire(resolve('package.json'));
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const date = '2026-10-18';
const food = { id: 'synthetic-food', date, meal: 'breakfast', name: 'Test oats', qty: 1, unit: 'serving', calories: 600, protein: 30, carbs: 70, fat: 20 };
const profile = { dailyCaloriesTarget: 2400, dailyProteinTarget: 150, carbGoal: 270, fatGoal: 80 };
function runtime(foods: any = [food], options: any = {}) {
  return createRuntime({ ...options, account: { uid: 'synthetic-owner', today: date, profile,
    plan: dashboardPreviewPlan(profile, null, 'ready'), ...options.account },
    nutrition: { date, foods, water: 500, ...options.nutrition } });
}
const action = (r: any, label: string) => r.actions.find((a: any) => a.accessibilityLabel === label);
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Nutrition retains active targets under a pending proposal and uses accepted projections', () => {
  const pending = runtime([food], { account: { planState: { pending: { targets: { calories: 1800 } } } } });
  const html = pending.nutrition().body;
  assert(html.includes('2,400 kcal')); assert(!html.includes('1,800 kcal')); assert(html.includes('25%'));
  assert(html.includes('Pending review is separate'));
  const targets = { calories: 2000, protein: 130, carbs: 220, fat: 65 };
  const accepted = { currentRecommendation: { proposalId: 'test', acceptedAt: 1, effectiveDate: date, policyVersion: 'test', targets }, pending: null };
  const r = runtime([food], { account: { plan: dashboardPreviewPlan({ ...profile, activeFitAdaptTargets: targets }, accepted, 'ready') } });
  const active = r.nutrition().body;
  assert(active.includes('Active plan')); assert(active.includes('2,000 kcal')); assert(active.includes('30%'));
});

test('Nutrition keeps unknown, zero, empty, loading, error and historical-target states distinct', () => {
  const zero = runtime([{ ...food, calories: 0, protein: 0 }]).nutrition().body;
  assert(zero.includes('0 kcal')); assert(zero.includes('0%'));
  const unknown = runtime([{ ...food, calories: null, protein: null }]).nutrition().body;
  assert(!/>0%<\//.test(unknown)); assert(unknown.includes('—')); assert(!unknown.includes('What should I eat?'));
  assert(runtime([], { nutrition: { foods: undefined } }).nutrition().body.includes('Loading entries…'));
  assert(runtime(null).nutrition().body.includes('Entries unavailable. Try again later.'));
  assert(runtime([]).nutrition().body.includes('Nothing logged here.'));
  const past = runtime([{ ...food, date: '2026-10-17' }], { nutrition: { date: '2026-10-17' } }).nutrition().body;
  assert(past.includes('no historical target comparison')); assert(!past.includes('Goal tracker'));
  assert(!past.includes('2,400 kcal')); assert(!past.includes('What should I eat?'));
});

test('Nutrition date and food/tool actions retain exact destinations and remaining-target parameters', () => {
  const r = runtime(); r.nutrition();
  action(r, 'Previous day').onPress(); assert.equal(r.nutritionState[0], '2026-10-17');
  r.nutrition(); action(r, 'Next day').onPress(); assert.equal(r.nutritionState[0], date);
  r.nutrition();
  for (const [label, route] of [['Add food', '/(modals)/add-meal'], ['Quick add', '/(modals)/quick-add'], ['Meal builder', '/(modals)/meal-builder']]) {
    action(r, label).onPress(); assert.equal(r.routes.at(-1).pathname, route);
    assert.equal(r.routes.at(-1).params.date, date); assert.equal(r.routes.at(-1).params.meal, 'snacks');
  }
  action(r, 'Scan').onPress(); assert.equal(r.routes.at(-1), `/(modals)/scan-meal?date=${date}`);
  for (const [label, route] of [['Open full calendar', '/(modals)/full-calendar'], ['Calendar', '/(modals)/full-calendar'], ['Diet choices', '/(modals)/diet-preferences'], ['Quick water log', '/(modals)/quick-hydration']]) {
    action(r, label).onPress(); assert.equal(r.routes.at(-1), route);
  }
  action(r, 'What should I eat?').onPress();
  assert.equal(JSON.stringify(r.routes.at(-1)), JSON.stringify({ pathname: '/(modals)/what-should-i-eat', params: {
    date, meal: 'snacks', kcalLeft: '1800', proteinLeft: '120', carbsLeft: '200', fatLeft: '60' } }));
  const adds = r.actions.filter((a: any) => a.accessibilityLabel === 'Add');
  for (const [i, meal] of ['breakfast', 'lunch', 'dinner', 'snacks'].entries()) {
    adds[i].onPress(); assert.equal(r.routes.at(-1).params.meal, meal);
  }
});

test('meal tap/edit/save and long-press deletion keep account-owned callbacks and confirmation', async () => {
  const r = runtime(); r.nutrition();
  action(r, 'Open Test oats').onPress(); r.nutrition();
  assert.equal(r.editor.item.id, food.id); assert.equal(r.editor.open, true);
  r.editor.onSave({ qty: 2 }); await settle();
  assert.equal(JSON.stringify(r.writes[0]), JSON.stringify(['update', 'synthetic-owner', food.id, { qty: 2 }]));
  r.nutrition(); action(r, 'Open Test oats').onLongPress();
  assert.equal(r.writes.length, 1);
  r.alerts.at(-1)[2].find((a: any) => a.text === 'Delete').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes[1]), JSON.stringify(['delete', 'synthetic-owner', food.id]));
  const bundle = runtime([{ ...food, entryKind: 'meal' }]); bundle.nutrition();
  action(bundle, 'Open Test oats').onPress(); assert.equal(bundle.alerts[0][0], 'Delete this entry?');
});

test('local hydration operations remain separate from quick water navigation, including unknown guard', async () => {
  const r = runtime(); r.nutrition(); action(r, 'Add 250 ml').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes[0]), JSON.stringify(['water', `@water:${date}`, '750']));
  r.nutrition(); action(r, 'Clear day').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes[1]), JSON.stringify(['water', `@water:${date}`, '0']));
  const unknown = runtime([], { nutrition: { water: null } }); unknown.nutrition();
  action(unknown, 'Add 250 ml').onPress(); action(unknown, 'Clear day').onPress(); await settle();
  assert.equal(unknown.writes.length, 0);
});

test('large-text and narrow layouts retain logged values and meal actions in both themes', () => {
  for (const dark of [true, false]) {
    const r = runtime([food], { dark, width: 320, fontScale: 1.8 }); const html = r.nutrition().body;
    for (const value of ['600 kcal', '30 g', '70 g', '20 g', 'Test oats']) assert(html.includes(value));
    assert.equal(r.actions.filter((a: any) => a.accessibilityLabel === 'Add').length, 4);
    assert(action(r, 'Meal builder')); assert(action(r, 'Quick water log'));
  }
});
