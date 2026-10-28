import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { dayKey } from '../utils/date';
const require = createRequire(resolve('package.json'));
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const today = dayKey(new Date());
const saved = { id: 'synthetic-template', name: 'My long custom strength session', items: [{ exercise: 'Squat', sets: 3, reps: 8, weightKg: 20 }], lastUsedAt: 1 };
const row = { id: 'synthetic-row', date: today, exercise: 'Squat', sessionTitle: 'Recorded session', sets: 3 };
function runtime(options: any = {}) {
  return createRuntime({ ...options, account: { uid: 'synthetic-owner', ...options.account },
    workouts: { rows: [row], templates: [saved], activities: [{ id: 'synthetic-activity', type: 'walk', minutes: 20 }], ...options.workouts } });
}
const action = (r: any, label: string) => r.actions.find((a: any) => a.accessibilityLabel === label);
const settle = () => new Promise(resolve => setImmediate(resolve));

test('built-in artwork maps all six exact IDs, never saved names/copied IDs or unknown keys', () => {
  const r = runtime();
  const { builtInArtwork } = r.load('components/workouts/PremiumWorkoutsUI.tsx');
  const { AUTO_TEMPLATES } = r.load('services/workoutTemplateCatalog.ts');
  const names = ['push', 'pull', 'legs', 'upper', 'cardio', 'mobility'];
  AUTO_TEMPLATES.forEach((t: any, i: number) => {
    assert(builtInArtwork(t).uri.endsWith(`/templates/${names[i]}.png`));
    assert.equal(builtInArtwork({ ...t, source: 'user' }), null);
  });
  assert.equal(builtInArtwork({ source: 'auto', id: 'auto-cardio' }), null);
  assert.equal(builtInArtwork({ source: 'auto', id: 'toString' }), null);
  assert.equal(builtInArtwork({ source: 'user', id: 'auto-push', name: 'Push (Strength)' }), null);
});

test('Workouts renders recorded, zero, empty and loading states without sample metrics', () => {
  const r = runtime(); const body = r.workouts().body;
  assert(body.includes('Recorded session')); assert(body.includes('1 records'));
  assert(body.includes(`${today}: 3 recorded sets`));
  const zero = runtime({ workouts: { rows: [{ ...row, sets: 0 }] } }).workouts().body;
  assert(zero.includes(`${today}: 0 recorded sets`));
  const empty = runtime({ workouts: { rows: [], templates: [], activities: [] } }).workouts().body;
  for (const text of ['No workout recorded', 'No dated workout records yet.', 'No saved templates yet.', 'No activity recorded today.']) assert(empty.includes(text));
  const loading = runtime({ workouts: { rows: null, templates: null } }).workouts().body;
  assert(loading.includes('Loading workouts…')); assert(loading.includes('Loading templates…'));
  assert(loading.includes(`${today}: loading`));
});

test('session, history and all training-tool destinations remain wired', () => {
  const r = runtime(); r.workouts();
  for (const [label, route] of [
    ['Start new', '/workouts/session?freshStart=1'], ['Open session', '/workouts/session'],
    ['History', '/workouts/history'], ['Template library', '/workouts/templates'],
    ['Create a template', '/(modals)/create-template'], ['Session history', '/workouts/history'],
    ['Quick workout', '/(modals)/quick-workout'], ['Connections', '/profile/integrations'], ['Coach', '/(modals)/coach-spark'],
  ]) { action(r, label).onPress(); assert.equal(r.routes.at(-1), route); }
  action(r, 'Coach quick pick').onPress();
  assert.equal(JSON.stringify(r.routes.at(-1)), JSON.stringify({ pathname: '/(modals)/coach-spark', params: { instant: '1', quickPreset: 'surprise' } }));
  action(r, 'Plan a session').onPress(); r.workouts();
  action(r, 'Cancel').onPress(); assert.equal(r.workoutState[2], false);
  r.workoutState[3] = '  Test plan  '; r.workoutState[4] = 'chest'; r.workoutState[5] = '60';
  r.workoutState[2] = true; r.workouts(); action(r, 'Start configured workout').onPress();
  assert.equal(JSON.stringify(r.routes.at(-1)), JSON.stringify({ pathname: '/workouts/session', params: { freshStart: '1', configTitle: 'Test plan', configMuscle: 'chest', configDuration: '60' } }));
});

test('built-in and saved launches preserve owner-scoped seed, movements and usage update', async () => {
  const r = runtime(); r.workouts(); action(r, 'Start Push (Strength)').onPress(); await settle();
  assert.equal(r.writes[0][1], 'workout:templateSeed:synthetic-owner');
  assert.equal(JSON.parse(r.writes[0][2]).exercises.length, 5);
  assert.equal(r.routes.at(-1).params.templateId, 'auto-push');
  assert.equal(r.writes.length, 1);
  action(r, 'Use').onPress(); await settle();
  assert.equal(JSON.parse(r.writes[1][2]).exercises[0].weightKg, 20);
  assert.equal(r.writes[2][0], 'template-update'); assert.equal(r.writes[2][1], 'synthetic-owner');
  assert.equal(r.routes.at(-1).params.templateId, saved.id);
  const signedOut = runtime({ account: { uid: null } }); signedOut.workouts();
  action(signedOut, 'Start Push (Strength)').onPress(); await settle();
  assert.equal(signedOut.writes.length, 0); assert.equal(signedOut.routes.length, 0);
});

test('saved desk preserves keep, archive, restore, confirmation and busy guards', async () => {
  const r = runtime({ workouts: { templates: [saved, { ...saved, id: 'archived', archived: true }],
    storage: { 'workouts:template-keep-until': JSON.stringify({ existing: 123 }) } } });
  r.workouts(); action(r, 'Keep 30 days').onPress(); await settle();
  assert.equal(r.writes[0][1], 'workouts:template-keep-until');
  const keep = JSON.parse(r.writes[0][2]); assert.equal(keep.existing, 123);
  assert(Math.abs(keep[saved.id] - (Date.now() + 30 * 86400000)) < 3000);
  r.workouts(); action(r, 'Archive').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes.at(-1)), JSON.stringify(['template-update', 'synthetic-owner', saved.id, { archived: true }]));
  r.workouts(); action(r, 'Restore').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes.at(-1)), JSON.stringify(['template-update', 'synthetic-owner', 'archived', { archived: false }]));
  r.workouts(); const count = r.writes.length; action(r, 'Delete').onPress();
  assert.equal(r.writes.length, count);
  r.alerts.at(-1)[2].find((a: any) => a.text === 'Delete').onPress(); await settle();
  assert.equal(JSON.stringify(r.writes.at(-1)), JSON.stringify(['template-delete', 'synthetic-owner', saved.id]));
  r.workoutState[9] = saved.id; r.workouts(); assert(action(r, 'Archive').disabled);
});

test('surprise retains saved-only selection and activity edit/log callbacks retain UID', async () => {
  const r = runtime(); r.workouts(); action(r, 'Surprise from saved templates').onPress(); await settle();
  assert.equal(r.routes.at(-1).params.templateId, saved.id);
  action(r, 'Edit walk activity').onPress(); r.workouts();
  assert.equal(r.activitySheet.editing.id, 'synthetic-activity');
  r.activitySheet.onUpdate({ id: 'synthetic-activity', minutes: 25 }); await settle();
  assert.equal(r.writes.at(-1)[0], 'activity-update'); assert.equal(r.writes.at(-1)[1], 'synthetic-owner');
  action(r, 'Log').onPress(); r.workouts(); assert.equal(r.activitySheet.editing, null);
  r.activitySheet.onCreate({ type: 'walk', minutes: 10 }); await settle();
  assert.equal(r.writes.at(-1)[0], 'activity-add');
  const empty = runtime({ workouts: { templates: [] } }); empty.workouts();
  action(empty, 'Surprise from saved templates').onPress();
  assert.equal(empty.alerts[0][0], 'No saved templates yet'); assert.equal(empty.routes.length, 0);
});

test('both modes retain all template controls and long custom names at large text', () => {
  for (const dark of [true, false]) {
    const r = runtime({ dark, width: 320, fontScale: 1.8 }); const body = r.workouts().body;
    assert(body.includes(saved.name)); assert.equal((body.match(/<img[^>]*templates\/push.png/g) || []).length, 1);
    for (const label of ['Use', 'Keep 30 days', 'Archive', 'Delete', 'Log', 'Coach quick pick', 'Start Mobility (10–15 min)']) assert(action(r, label));
  }
});
