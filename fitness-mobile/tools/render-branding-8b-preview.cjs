/* Offline actual-JSX gallery. Synthetic fixtures only; no Firebase/native I/O. */
const fs = require('node:fs'), path = require('node:path');
const React = require('react');
const { createRuntime } = require('./home-preview-runtime.cjs');
const root = path.resolve(__dirname, '..');
const today = '2026-10-19';
const record = {
  date: today, overallScore: 78,
  nutrition: { calories: 1520, calorieGoal: 2200, protein: 98, proteinGoal: 140, carbs: 175, carbsGoal: 250,
    fat: 48, fatGoal: 70, logged: true, meals: [{ name: 'Synthetic lunch record', time: '12:30', calories: 520 }, { name: 'Synthetic dinner record', time: '18:10', calories: 1000 }] },
  workout: { name: 'Synthetic strength session', duration: 40, exercises: 5, volume: 1250, score: 75, fatigue: 'Moderate' },
  steps: { count: 6400, goal: 8500 }, hydration: { logged: 1000, goal: 2400 }, sleep: null, weight: null,
  prs: [{ exercise: 'Synthetic press record', weight: 35, reps: 8 }],
};
const account = { uid: 'synthetic-ui-8b', user: { displayName: 'Review' }, profile: { displayName: 'Review' }, today,
  plan: { kind: 'goals', title: 'Your goals', targets: { calories: 2200, protein: 140, carbs: 250, fat: 70 } },
  planState: null, logged: null, steps: 6400, stepGoal: 8500, weightDays: [] };
const snapshot = { settings: { history: [
  { id: 'fixture-1', finishedAt: Date.parse(`${today}T12:00:00`), reason: 'manual_sync', integrations: ['appleHealth'], failed: [], durationMs: 2100, dataPointsReceived: 3 },
  { id: 'fixture-2', finishedAt: Date.parse('2026-10-18T12:00:00'), reason: 'app_open', integrations: ['appleHealth', 'healthConnect'], failed: ['healthConnect'], durationMs: 4000, dataPointsReceived: 0 },
] } };
const days = { [today]: record, '2026-10-20': { ...record, date: '2026-10-20', nutrition: { ...record.nutrition, calories: 0, protein: 0, carbs: 0, fat: 0 }, steps: { count: 0, goal: 8500 }, workout: null, prs: [] } };
const scenarios = [
  ['sync-records', 'app/profile/sync-history.tsx', { snapshot }],
  ['sync-empty', 'app/profile/sync-history.tsx', { snapshot: { settings: { history: [] } } }],
  ['sync-loading', 'app/profile/sync-history.tsx', {}],
  ['calendar-month', 'app/(modals)/full-calendar.tsx', { days }],
  ['calendar-week', 'app/(modals)/full-calendar.tsx', { days, view: 'week' }],
  ['calendar-year', 'app/(modals)/full-calendar.tsx', { days, view: 'year' }],
  ['calendar-empty', 'app/(modals)/full-calendar.tsx', {}],
  ['day-record', 'app/(modals)/full-calendar.tsx', { days, sheetDate: today, modalOnly: true }],
  ['day-empty', 'app/(modals)/full-calendar.tsx', { sheetDate: today, modalOnly: true }],
  ['steps-add', 'app/(tabs)/index.tsx', { stepsOpen: true, stepsText: '1200', modalOnly: true }],
  ['steps-set', 'app/(tabs)/index.tsx', { stepsOpen: true, stepsMode: 'set', stepsText: '0', modalOnly: true }],
  ['steps-saving', 'app/(tabs)/index.tsx', { stepsOpen: true, stepsText: '1200', saving: true, modalOnly: true }],
  ['legacy-water-control', 'app/(modals)/quick-hydration.tsx', {}],
];
function renderCase({ dark, width = 390, fontScale = 1, sourceRoot, route, fixture }) {
  const runtime = createRuntime({ dark, width, fontScale, sourceRoot, account, utilities: { today, ...fixture } });
  let result = runtime.render(runtime.load(route).default);
  if (fixture.modalOnly) {
    const modal = runtime.modal;
    if (!modal) throw Error('Expected a visible modal');
    const appearance = runtime.load('components/designPreview/Appearance.tsx');
    const Scope = appearance.SomataTaskAppearance || appearance.SomataHomeAppearance;
    result = runtime.render(() => React.createElement(Scope, null, modal.children));
  }
  return { ...result, runtime };
}
exports.fixtures = { today, record, days, account, snapshot, scenarios };
exports.renderCase = renderCase;
if (require.main === module) {
  const beforeIndex = process.argv.indexOf('--before-root');
  const beforeRoot = beforeIndex >= 0 ? process.argv[beforeIndex + 1] : null;
  if (beforeRoot && !fs.existsSync(beforeRoot)) throw Error('Missing original-source directory');
  const out = path.join(root, 'review/branding-8b'); fs.mkdirSync(out, { recursive: true });
  const font = '../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';
  const entries = [];
  for (const dark of [true, false]) for (const [name, route, fixture] of scenarios) {
    const variants = [{ label: 'normal', width: 390, fontScale: 1 }];
    if (['sync-records','calendar-month','calendar-week','day-record','steps-add','steps-set','legacy-water-control'].includes(name)) variants.push({ label: 'narrow-large', width: 320, fontScale: 1.8 });
    for (const variant of variants) for (const version of beforeRoot ? ['before','after'] : ['after']) {
      const { body, styles, runtime } = renderCase({ dark, ...variant, sourceRoot: version === 'before' ? beforeRoot : undefined, route, fixture });
      const file = `${version}-${dark ? 'dark' : 'light'}-${name}-${variant.label}.html`;
      fs.writeFileSync(path.join(out, file), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>8B · ${name} · ${version}</title>${styles}<style>@font-face{font-family:Ionicons;src:url('${font}')}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:${runtime.tokens.surface.canvas}}body{width:${variant.width}px;max-width:100%;margin:auto}#root{display:flex;flex-direction:column;min-height:100vh;width:100%}.fixture{font:11px/1.5 system-ui;padding:8px 12px;background:#F4F3EE;color:#0B0E12}</style><div class="fixture">${version.toUpperCase()} · SYNTHETIC OFFLINE PREVIEW · ${name} · ${variant.width}px / ${variant.fontScale}× text</div><div id="root">${body}</div></html>`);
      entries.push({ name, route, dark, version, file, ...variant });
    }
  }
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Somata · 8B review</title><style>body{font:16px/1.6 system-ui;margin:32px;background:#F4F3EE;color:#0B0E12}h1{font-size:32px}h2{font-size:20px}a{color:#A83800}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}section{background:white;border:1px solid #CDD3D8;border-radius:18px;padding:16px;overflow:hidden}iframe{width:100%;height:740px;border:1px solid #CDD3D8;border-radius:14px}</style><h1>Somata / Foundation + Home utilities</h1><p>Actual React Native JSX rendered offline through React Native Web. Synthetic records, inert service fixtures, no Firebase or personal data. Browser previews are not native screenshots: safe areas, keyboard, permissions, gestures and VoiceOver require a device. Native validation/save failures still use system alerts; no new Calendar loading/error state has been invented.</p><p>Before captures use the original source snapshot; after captures use current source. Legacy water is the unchanged control. Narrow/large-text pages approximate 1.8× font scaling.</p><main>${entries.filter(e => e.version === 'after').map(e => { const before = entries.find(x => x.version === 'before' && x.name === e.name && x.dark === e.dark && x.label === e.label); return `<section><h2>${e.name} · ${e.dark ? 'Dark' : 'Light'} · ${e.label}</h2><p>${before ? `<a href="${before.file}">Before</a> · ` : ''}<a href="${e.file}">After / full page</a></p><iframe loading="lazy" title="${e.file}" src="${e.file}"></iframe></section>`; }).join('')}</main>`);
  fs.writeFileSync(path.join(out, 'capture-manifest.json'), JSON.stringify({ synthetic: true, native: false, entries }, null, 2));
  const comparisons = entries.filter(e => e.version === 'after' && e.label === 'normal' &&
    ['sync-records', 'calendar-month', 'day-record', 'steps-add', 'steps-set', 'legacy-water-control'].includes(e.name));
  if (beforeRoot) fs.writeFileSync(path.join(out, 'comparisons.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>8B · Before and after</title><style>body{font:16px/1.5 system-ui;margin:24px;background:#F4F3EE;color:#0B0E12}section{padding:20px 0;border-bottom:1px solid #BBC4CC}.pair{display:flex;gap:20px;flex-wrap:wrap}iframe{width:390px;max-width:100%;height:800px;border:1px solid #BBC4CC;border-radius:16px}a{color:#A83800}</style><h1>Checkpoint 8B · before / after</h1><p>Synthetic offline fixtures, actual screen JSX. These browser previews do not verify native behavior. <a href="index.html">All states</a></p>${comparisons.map(e => {
    const before = entries.find(b => b.version === 'before' && b.name === e.name && b.dark === e.dark && b.label === e.label);
    return `<section><h2>${e.name} · ${e.dark ? 'Dark' : 'Light'}</h2><div class="pair">${[before, e].map(x => `<div><p><a href="${x.file}">${x.version.toUpperCase()} · full page</a>${fs.existsSync(path.join(out, x.file.replace('.html', '.png'))) ? ` · <a href="${x.file.replace('.html', '.png')}">Browser capture</a>` : ''}</p><iframe loading="lazy" title="${x.file}" src="${x.file}"></iframe></div>`).join('')}</div></section>`;
  }).join('')}</html>`);
  console.log(`Wrote ${entries.length} actual-JSX state previews and index to review/branding-8b`);
}
