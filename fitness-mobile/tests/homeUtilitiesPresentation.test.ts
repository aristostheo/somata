import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const React = require('react');
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const { fixtures } = require('./tools/render-branding-8b-preview.cjs');
const calendar = 'app/(modals)/full-calendar.tsx';
function runtime(utilities: any = {}, overrides: any = {}) {
  return createRuntime({ account: fixtures.account, utilities: { today: fixtures.today, ...utilities }, ...overrides });
}
const action = (r: any, label: string) => { const a = r.actions.find((a: any) => a.accessibilityLabel === label); assert(a, label); return a; };
const render = (r: any, file: string) => r.render(r.load(file).default);

test('task appearance is explicit, does not change saved palettes, and cannot escape its scope', () => {
  for (const dark of [true, false]) {
    const r = runtime({}, { dark });
    const { Button, Panel } = r.load('components/somata/TaskUI.tsx');
    const { SomataTaskAppearance, SomataHomeAppearance } = r.load('components/designPreview/Appearance.tsx');
    const Control = () => React.createElement(Panel, null, React.createElement(Button, { label: 'Control', primary: true, onPress() {} }));
    const legacy = r.render(Control).body, saved = JSON.stringify(r.theme.colors);
    assert.equal(r.render(() => React.createElement(SomataHomeAppearance, null, React.createElement(Control))).body, legacy);
    assert.notEqual(r.render(() => React.createElement(SomataTaskAppearance, null, React.createElement(Control))).body, legacy);
    assert.equal(r.render(Control).body, legacy);
    assert.equal(JSON.stringify(r.theme.colors), saved);
  }
});

test('steps keeps invalid input validation and performs no write for unsigned accounts', async () => {
  for (const stepsText of ['', ' ', '-1', '1.5', '200001', 'abc']) {
    const r = runtime({ stepsOpen: true, stepsText }); r.home();
    await action(r, 'Save steps').onPress();
    assert.equal(r.writes.length, 0); assert.equal(r.alerts[0][0], 'Enter a valid step count');
    assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], true);
  }
  const r = runtime({ stepsOpen: true, stepsText: '10' }, { account: { ...fixtures.account, uid: null } });
  r.home(); await action(r, 'Save steps').onPress(); assert.equal(r.writes.length, 0);
});

test('steps add/set preserve zero, upper bound, exact UID/date and close only after success', async () => {
  for (const stepsMode of ['add', 'set']) for (const stepsText of ['0', '200000']) {
    const r = runtime({ stepsOpen: true, stepsMode, stepsText }); r.home();
    await action(r, 'Save steps').onPress();
    assert.deepEqual(r.writes, [[`${stepsMode}-steps`, fixtures.account.uid, fixtures.today, Number(stepsText)]]);
    assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], false);
  }
});

test('step save failure retains input for retry; duplicate submission is guarded while saving', async () => {
  const utilities: any = { today: fixtures.today, stepsOpen: true, stepsText: '520', failSteps: true };
  const r = createRuntime({ utilities, account: fixtures.account }); r.home();
  await action(r, 'Save steps').onPress();
  assert.equal(r.alerts[0][0], 'Steps could not be saved');
  assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], true);
  assert.equal(r.utilityStates['app/(tabs)/index.tsx'][3], '520');
  utilities.failSteps = false;
  let release!: () => void; utilities.stepsWait = new Promise<void>(done => { release = done; });
  r.home(); const pending = action(r, 'Save steps').onPress();
  r.home(); const busy = action(r, 'Saving…'); assert.equal(busy.disabled, true);
  await busy.onPress(); assert.equal(r.writes.length, 2); // failed attempt + one retry, no duplicate
  release(); await pending; assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], false);
});

test('step cancellation and native back close without saving or changing other Home routes', () => {
  const r = runtime({ stepsOpen: true, stepsText: '100' }); r.home();
  r.modal.onRequestClose(); assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], false);
  r.utilityStates['app/(tabs)/index.tsx'][1] = true; r.home(); action(r, 'Cancel').onPress();
  assert.equal(r.utilityStates['app/(tabs)/index.tsx'][1], false); assert.deepEqual(r.writes, []);
});

test('calendar period controls preserve dates, persisted view choice and today reset', () => {
  const r = runtime(); render(r, calendar);
  action(r, 'Previous period').onPress();
  assert.equal(r.utilityStates[calendar][2].getMonth(), 8); // September, from October
  render(r, calendar); action(r, 'Next period').onPress();
  assert.equal(r.utilityStates[calendar][2].getMonth(), 9);
  render(r, calendar); r.actions.find((a: any) => a.children?.props?.children === 'Week').onPress();
  assert.equal(r.utilityStates[calendar][1], 'week');
  assert.deepEqual(r.writes.at(-1), ['storage', '@calendar:view:v2', 'week']);
  render(r, calendar); action(r, 'Next period').onPress();
  assert.equal(r.utilityStates[calendar][3].getDate(), 26);
  render(r, calendar); action(r, 'Today').onPress();
  assert.equal(r.utilityStates[calendar][5], fixtures.today);
  assert.equal(r.utilityStates[calendar][3].getDate(), 19);
});

test('calendar date selection/long press and selected-day log callback keep their exact route', () => {
  const r = runtime({ days: fixtures.days }); render(r, calendar);
  const date = r.actions.find((a: any) => a.accessibilityLabel?.startsWith('Oct 20'));
  assert(date); date.onPress(); assert.equal(r.utilityStates[calendar][5], '2026-10-20');
  date.onLongPress(); assert.equal(r.utilityStates[calendar][6], '2026-10-20');
  const empty = runtime({ sheetDate: fixtures.today }); render(empty, calendar);
  action(empty, 'Log nutrition').onPress(); assert.equal(empty.routes.at(-1), `/(modals)/add-meal?date=${fixtures.today}`);
  empty.modal.onRequestClose(); assert.equal(empty.utilityStates[calendar][6], null);
  const past = runtime({ sheetDate: '2026-10-18' }); render(past, calendar);
  assert(!past.actions.some((a: any) => a.accessibilityLabel === 'Log nutrition'));
});

test('calendar range subscription retains authenticated owner and account store', async () => {
  const r = runtime(); render(r, calendar);
  for (const effect of r.effects) effect.effect();
  await Promise.resolve();
  const call = r.subscriptions.find((s: any) => s.kind === 'calendar');
  assert.equal(call.args[0], fixtures.account.uid);
  assert.equal(call.args[1], '2026-01-01'); assert.equal(call.args[2], '2026-12-31');
  assert.equal(call.args[4].uid, fixtures.account.uid);
});

test('day record retains optional data and a recorded zero; missing record does not become zero', () => {
  for (const dark of [true, false]) {
    const r = runtime({}, { dark });
    const { CalendarRecord } = r.load('components/somata/CalendarRecord.tsx');
    const { SomataTaskAppearance } = r.load('components/designPreview/Appearance.tsx');
    const draw = (day: any) => r.render(() => React.createElement(SomataTaskAppearance, null, React.createElement(CalendarRecord, { day }))).body;
    const missing = draw(null); assert(missing.includes('No record for this day')); assert(!missing.includes('Day score'));
    const body = draw({ ...fixtures.days['2026-10-20'], weight: 180, sleep: { duration: 420, score: 70, deep: 60, rem: 90, light: 270 }, prs: fixtures.record.prs });
    for (const text of ['0 g', 'Recorded sleep', '180 lb', 'Synthetic press record', '35 kg', 'Day score']) assert(body.includes(text), text);
  }
});

test('sync subscription/clear stay account-scoped; loading/empty have no clear action', () => {
  for (const snapshot of [null, { settings: { history: [] } }, fixtures.snapshot]) {
    const r = runtime({ snapshot }); const result = render(r, 'app/profile/sync-history.tsx');
    r.effects[0].effect(); assert.equal(r.subscriptions[0].store.uid, fixtures.account.uid);
    if (snapshot?.settings.history.length) {
      assert(result.body.includes('Some sources did not sync')); assert(result.body.includes('Successful'));
      action(r, 'Clear history').onPress(); assert.deepEqual(r.writes, [['clear-sync', fixtures.account.uid]]);
      assert.equal(r.alerts.length, 0); // existing immediate clear, no new confirmation
    } else assert(!r.actions.some((a: any) => a.accessibilityLabel === 'Clear history'));
  }
});
