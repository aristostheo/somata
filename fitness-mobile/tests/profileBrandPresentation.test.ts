import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { dashboardPreviewPlan } from '../services/dashboardPreviewData';
import { measuredTrendPath } from '../services/profile/fitadaptInsightData';
const require = createRequire(resolve('package.json'));
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const saved = { displayName: 'Synthetic owner', dailyCaloriesTarget: 2300, dailyProteinTarget: 140, carbGoal: 250, fatGoal: 65 };
const targets = { calories: 2100, protein: 150, carbs: 220, fat: 60 };
const pending = { id: 'test-pending', targets: { calories: 1900, protein: 130, carbs: 200, fat: 55 } };
const accepted = { currentRecommendation: { proposalId: 'test-accepted', acceptedAt: 1, effectiveDate: '2026-10-01', policyVersion: 'test', targets }, pending: null };
function runtime(options: any = {}) {
  const profile = Object.hasOwn(options, 'profile') ? options.profile : saved;
  const state = options.state ?? null;
  return createRuntime({ ...options, account: { uid: 'synthetic-owner', profile, user: { displayName: 'Auth fallback', email: 'synthetic@example.invalid' },
    plan: dashboardPreviewPlan(profile, state, options.planStatus || 'ready'), steps: null, weightDays: [], setPlanState: () => {}, ...options.account },
    profileReview: { pending: state?.pending || null, ...options.review } });
}
const action = (r: any, label: string) => r.actions.find((a: any) => a.accessibilityLabel === label);

test('Profile retains saved fallback, accepted projection precedence and guarded attribution', () => {
  assert(runtime().profile().body.includes('YOUR GOALS'));
  const r = runtime({ profile: { ...saved, activeFitAdaptTargets: targets }, state: accepted });
  const body = r.profile().body;
  assert(body.includes('ACTIVE PLAN')); assert(body.includes('2,100 kcal')); assert(!body.includes('2,300 kcal'));
  assert(body.includes('powered-by-f3-compact-dark.png')); assert(body.includes('fitadapt/symbol-color.png'));
  const mismatch = runtime({ profile: { ...saved, activeFitAdaptTargets: targets }, state: { ...accepted, currentRecommendation: { ...accepted.currentRecommendation, targets: { ...targets, calories: 2000 } } } }).profile().body;
  assert(!mismatch.includes('ACTIVE PLAN')); assert(!mismatch.includes('powered-by-f3-compact'));
  assert(mismatch.includes('PLAN STATUS UNAVAILABLE')); assert(mismatch.includes('2,100 kcal'));
});

test('pending proposal compares against current targets, never silently replaces them', () => {
  const r = runtime({ state: { currentRecommendation: null, pending } }); const body = r.profile().body;
  assert(body.includes('YOUR GOALS')); assert(body.includes('Pending review'));
  assert(body.includes('2,300 kcal  →  1,900 kcal'));
  assert(!body.includes('ACTIVE PLAN')); assert(!body.includes('powered-by-f3-compact'));
  assert.equal(r.reviewActions.length, 0); assert.equal(r.writes.length, 0);
  action(r, 'Decline').onPress(); assert.deepEqual(r.reviewActions, ['decline']);
  assert(r.profile().body.includes('2,300 kcal')); assert.equal(r.writes.length, 0);
  const active = runtime({ profile: { ...saved, activeFitAdaptTargets: targets }, state: { ...accepted, pending } }).profile().body;
  assert(active.includes('ACTIVE PLAN')); assert(active.includes('2,100 kcal  →  1,900 kcal'));
});

test('review actions retain evaluate/refresh/accept/decline wiring and disabled conditions', () => {
  const r = runtime({ review: { pending } }); r.profile();
  action(r, 'Accept plan').onPress(); action(r, 'Request a fresh review').onPress();
  assert.deepEqual(r.reviewActions, ['accept', 'evaluate']); assert.equal(r.writes.length, 0);
  const retry = runtime({ review: { loadFailed: true, note: 'FitAdapt is unavailable right now. Your current goals are unchanged.' } });
  assert(retry.profile().body.includes('FitAdapt is unavailable right now.'));
  action(retry, 'Retry plan status').onPress(); assert.deepEqual(retry.reviewActions, ['refresh']);
  const busy = runtime({ review: { pending, busy: true } }); busy.profile();
  assert(busy.actions.filter((a: any) => a.accessibilityLabel === 'Working…').every((a: any) => a.disabled));
  assert(action(busy, 'Decline').disabled);
  const noProfile = runtime({ profile: null, review: { pending } }); noProfile.profile(); assert(action(noProfile, 'Accept plan').disabled);
  const noUid = runtime({ account: { uid: undefined } }); noUid.profile(); assert(action(noUid, 'Review my plan').disabled);
});

test('all profile destinations remain available, including conditional completion paths', () => {
  const r = runtime(); r.profile();
  for (const [label,route] of [
    ['Open Account','/account'], ['Edit saved profile & goals','/profile/goal-setup'], ['FitAdapt insights & history','/profile/fitadapt-insights'],
    ['Insights','/profile/insights-progress'], ['Steps history','/profile/steps-history'], ['Calendar','/(modals)/full-calendar'],
    ['Body measurements','/(modals)/body-metrics'], ['Long-term progress','/(modals)/long-term-progress'], ['Advanced metrics','/profile/advanced-metrics'],
    ['Weekly check-in','/(modals)/weekly-checkin'], ['Account','/account'], ['Settings','/(modals)/settings'], ['Theme picker','/(modals)/theme-editor'],
    ['Diet choices','/(modals)/diet-preferences'], ['Training days & goals','/profile/goal-setup'], ['Progress photos','/(modals)/progress-photos'],
    ['Badges','/(modals)/badges'], ['Friends','/friends'], ['Apple Health & connections','/profile/integrations'],
  ]) { assert(action(r,label),label); action(r,label).onPress(); assert.equal(r.routes.at(-1),route); }
  const incomplete = runtime({ review: { note: 'Complete your saved profile and goals first: age.' } }); incomplete.profile();
  action(incomplete,'Complete required inputs').onPress(); assert.equal(incomplete.routes.at(-1),'/fitadapt-setup');
  const evidence = runtime({ review: { note: 'More dated weight and nutrition records are needed before FitAdapt can suggest a change.' } }); evidence.profile();
  action(evidence,'Record a weight').onPress(); assert.equal(evidence.routes.at(-1),'/(modals)/body-metrics');
  action(evidence,'Log nutrition').onPress(); assert.equal(evidence.routes.at(-1),'/(tabs)/nutrition');
});

test('missing/zero values and kg/lb measurements retain their meaning; charts require dated evidence', () => {
  const empty = runtime({ profile: {} }).profile().body;
  assert(empty.includes('TARGETS UNAVAILABLE')); assert(empty.includes('Two dated weights are needed')); assert(!empty.includes('<path'));
  const loading = runtime({ profile: undefined }).profile().body; assert(loading.includes('LOADING TARGETS'));
  const zero = runtime({ profile: { ...saved, dailyProteinTarget: 0 }, account: { steps: 0 } }).profile().body; assert(zero.includes('0 g'));
  const one = [{ date: '2026-10-01', value: 80 }];
  const kg = runtime({ account: { weightDays: one } }).profile().body; assert(kg.includes('80.0 kg')); assert(!kg.includes('<path'));
  const lb = runtime({ profile: { ...saved, weightUnit: 'lb' }, account: { weightDays: one } }).profile().body; assert(lb.includes('176.4 lb'));
  const days = [...one, { date: '2026-10-08', value: 79 }];
  const measured = runtime({ account: { weightDays: days } }).profile().body;
  assert(measured.includes(`d="${measuredTrendPath(days,300,74)}"`));
});

test('Hide/Show masks current and proposed values and removes the measured path', () => {
  const r = runtime({ state: { currentRecommendation: null, pending }, account: { steps: 4532,
    weightDays: [{ date: '2026-10-01', value: 80 }, { date: '2026-10-08', value: 79 }] } });
  r.profile(); action(r,'Hide values').onPress(); const hidden = r.profile().body;
  for (const value of ['2,300 kcal','1,900 kcal','79.0 kg','4,532']) assert(!hidden.includes(value));
  assert(hidden.includes('Trend hidden')); assert(!hidden.includes('<path')); assert(hidden.includes('•••'));
  action(r,'Show values').onPress(); const shown = r.profile().body;
  assert(shown.includes('2,300 kcal')); assert(shown.includes('79.0 kg')); assert(shown.includes('<path'));
});

test('status notes/sync and both-mode large text preserve identity and all controls', () => {
  for(const dark of [true,false]) {
    const r = runtime({ dark, width: 320, fontScale: 1.8, profile: { ...saved, displayName: 'A long synthetic account name for layout review' },
      review: { current: targets, activeSynced: false, note: 'Your goals changed since this review. Request a new evaluation.' } });
    const body = r.profile().body;
    assert(body.includes('A long synthetic account name')); assert(body.includes('synthetic@example.invalid'));
    assert(body.includes('Accepted plan is syncing with nutrition targets.')); assert(body.includes('Your goals changed since this review.'));
    assert(action(r,'Hide values')); assert(action(r,'Apple Health & connections')); assert(action(r,'Review my plan'));
    assert(body.includes('fitadapt/symbol-color.png'));
  }
});
