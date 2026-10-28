import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { dashboardPreviewPlan } from "../services/dashboardPreviewData";
import type { FitAdaptPlanState } from "../services/fitadapt";
import { createSemanticTokens } from "../services/theme/semanticTokens";
import { premiumHomeTheme } from "../components/home/premiumTheme";
import { contrastRatio } from "../lib/themeColor";

const require = createRequire(resolve("package.json"));
const { createRuntime } = require("./tools/home-preview-runtime.cjs");
const saved = { dailyCaloriesTarget: 2200, dailyProteinTarget: 140, carbGoal: 250, fatGoal: 70 };
function account(logged: any = null, state: FitAdaptPlanState | null = null, profile = saved) {
  return { uid: "synthetic-render-test", user: { displayName: "Test" }, profile, today: "2026-10-18",
    plan: dashboardPreviewPlan(profile, state, "ready"), planState: state,
    logged, steps: null, weightDays: [], stepGoal: 8000 };
}

test("the shared components retain legacy appearance outside the explicit Home scope", () => {
  const runtime = createRuntime();
  const { Metric } = runtime.load("components/designPreview/UI.tsx");
  const before = runtime.render(Metric, { label: "Test", value: "—" }).body;
  assert(before.includes("rgba(38,121,103,1.00)")); // existing green Metric, not a snapshot
  assert.equal(runtime.theme.colors.primary, "#86506F");
});

test("Home opts into neutral metrics and macro roles without modifying saved palette colors", () => {
  for (const dark of [true, false]) {
    const runtime = createRuntime({ dark, account: account({ entries: 1, calories: 1100, protein: 0, carbs: null, fat: 20 }) });
    const palette = JSON.stringify(runtime.theme.colors);
    const result = runtime.home().body;
    assert(!result.includes("rgba(38,121,103,1.00)"));
    assert(result.includes("50%"));
    assert(result.includes("0 g"));
    assert(result.includes("—"));
    assert.equal(JSON.stringify(runtime.theme.colors), palette);
    const { Metric } = runtime.load("components/designPreview/UI.tsx");
    assert(runtime.render(Metric, { label: "Other tab", value: "—" }).body.includes("rgba(38,121,103,1.00)"));
  }
});

test("missing energy stays unavailable; a real zero is zero progress, not complete logging", () => {
  const missing = createRuntime({ account: account() }).home().body;
  assert(missing.includes("Progress unavailable"));
  assert(!/>0%<\//.test(missing));
  const zero = createRuntime({ account: account({ entries: 1, calories: 0, protein: 0, carbs: 0, fat: 0 }) }).home().body;
  assert(!zero.includes("Progress unavailable"));
  assert(/>0%<\//.test(zero));
  assert(zero.includes("Logged amounts are not a full-day estimate."));
});

test("pending proposal cannot change Home targets or attribution; accepted matching targets can", () => {
  const targets = { calories: 1800, protein: 120, carbs: 200, fat: 60 };
  const state: FitAdaptPlanState = { currentRecommendation: null, pending: { id: "synthetic", createdAt: 1,
    status: "pending", responseVersion: "test", sourceFingerprint: "test", targets,
    effectiveDate: "2026-10-18", reviewRequired: true } };
  const pending = createRuntime({ account: account(null, state) }).home().body;
  assert(pending.includes("2,200 kcal"));
  assert(!pending.includes("1,800 kcal"));
  assert(pending.includes("Pending FitAdapt review"));
  assert(!pending.includes('alt="Powered by FitAdapt"'));
  const accepted = { ...state, currentRecommendation: { proposalId: "accepted", acceptedAt: 1,
    effectiveDate: "2026-10-18", policyVersion: "test", targets } };
  const active = createRuntime({ account: account(null, accepted, { ...saved, activeFitAdaptTargets: targets } as typeof saved) }).home().body;
  assert(active.includes("1,800 kcal"));
  assert(active.includes("ACTIVE PLAN"));
  assert(active.includes('alt="Powered by FitAdapt"'));
});

test("Home keeps all quick actions ordered and all navigation destinations", () => {
  const runtime = createRuntime({ account: account() });
  runtime.home();
  const actions = runtime.actions.filter((a: any) => a.accessibilityLabel);
  const labels = actions.map((a: any) => a.accessibilityLabel);
  const quick = ['Log food', 'Scan food', 'Add steps', 'Set steps', 'Start workout', 'Log activity', 'Quick workout', 'Water log'];
  assert.deepEqual(labels.slice(labels.indexOf('Log food'), labels.indexOf('Log food') + 8), quick);
  for (const [label, route] of Object.entries({
    'Open alerts': '/(tabs)/notifications', 'Open Nutrition': '/(tabs)/nutrition',
    'Log food': '/(modals)/add-meal?date=2026-10-18', 'Scan food': '/(modals)/scan-meal?date=2026-10-18',
    'Start workout': '/workouts/session?freshStart=1', 'Log activity': '/(tabs)/workouts?activity=1',
    'Quick workout': '/(modals)/quick-workout', 'Water log': '/(modals)/quick-hydration',
    Calendar: '/(modals)/full-calendar', 'Insights & history': '/profile/fitadapt-insights',
    Connections: '/profile/integrations', Badges: '/(modals)/badges',
  })) {
    actions.find((a: any) => a.accessibilityLabel === label).onPress();
    assert.equal(runtime.routes.at(-1), route);
  }
});

test("premium text and labeled macro inks remain readable over light and dark gradient stops", () => {
  for (const dark of [true, false]) {
    const t = createSemanticTokens(dark), p = premiumHomeTheme(t);
    for (const background of [...p.lighting, ...p.heroLighting, ...p.recommendation, ...Object.values(p.macroWash)]) {
      for (const ink of [t.text.primary, t.text.secondary]) assert(contrastRatio(ink, background) >= 4.5);
    }
    for (const series of ['protein', 'carbohydrate', 'fat'] as const) {
      assert(contrastRatio(p.macro[series], p.macroWash[series]) >= 3);
      assert(contrastRatio(p.macro[series], p.surface) >= 3);
    }
    for (const background of p.cta) assert(contrastRatio(t.text.onBrand, background) >= 4.5);
  }
});

test("narrow and large-text presentations retain every Home action and recorded value", () => {
  for (const width of [320, 390, 447]) for (const fontScale of [1, 1.8]) {
    const runtime = createRuntime({ width, fontScale, account: account({ entries: 1, calories: 1100, protein: 45, carbs: null, fat: 0 }) });
    const result = runtime.home().body;
    for (const value of ['1,100', '2,200 kcal', '45 g', '0 g', '50%']) assert(result.includes(value));
    const labels = runtime.actions.map((a: any) => a.accessibilityLabel);
    for (const label of ['Log food', 'Scan food', 'Add steps', 'Set steps', 'Start workout', 'Log activity', 'Quick workout', 'Water log',
      'Calendar', 'Insights & history', 'Connections', 'Badges', 'Open alerts', 'Open Nutrition']) assert(labels.includes(label));
  }
});
