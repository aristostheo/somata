const fs = require('node:fs'), path = require('node:path');
const { createRuntime } = require('./home-preview-runtime.cjs');
const out = path.resolve(__dirname, '../review/branding-3c');
fs.mkdirSync(out, { recursive: true });
const pages = [];
// Synthetic, offline visual fixtures only. Never imported by the application.
for (const dark of [true, false]) for (const scenario of ['goals', 'pending', 'empty', 'reference', 'large-text']) {
  const width = scenario === 'large-text' ? 320 : scenario === 'reference' ? 447 : 390;
  const account = { uid: 'synthetic-preview-only', user: { displayName: 'Preview' },
    profile: { weightUnit: 'kg' }, today: '2026-10-18', stepGoal: 8000,
    steps: ['empty', 'reference'].includes(scenario) ? null : 3200,
    weightDays: ['empty', 'reference'].includes(scenario) ? [] : [{ date: '2026-10-17', value: 72.4 }],
    logged: scenario === 'reference' ? { entries: 0, calories: null, protein: null, carbs: null, fat: null } : scenario === 'empty' ? null : { entries: 2, calories: 960, protein: 54, carbs: 110, fat: 34 },
    plan: { kind: 'goals', title: 'Your goals', targets: { calories: 2200, protein: 140, carbs: 250, fat: 70 } },
    planState: { pending: scenario === 'pending' ? { targets: { calories: 1800 } } : null },
  };
  const runtime = createRuntime({ dark, width, fontScale: scenario === 'large-text' ? 1.8 : 1, account });
  const { body, styles } = runtime.preview();
  const font = path.relative(out, require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
  const name = `home-${dark ? 'dark' : 'light'}-${scenario}.html`;
  fs.writeFileSync(path.join(out, name), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home · offline synthetic ${scenario} preview</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}html,body,#root{margin:0;min-height:100%;}body{width:${width}px;max-width:100%;background:${runtime.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
  pages.push({ name, dark, scenario, width });
}
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Somata Home · Checkpoint 3C</title><style>body{padding:24px;background:#e8ebed;color:#0B0E12;font:16px/1.5 system-ui}main{display:flex;gap:24px;flex-wrap:wrap}iframe{height:900px;border:1px solid #73808B;border-radius:20px;max-width:100%}h2{font-size:18px}</style><h1>Home · Checkpoint 3C review</h1><p>Actual Home presentation rendered through React Native Web with clearly synthetic, offline fixtures. These values are never used by the app. Browser previews are not native screenshots. Ionicons use the installed font; gradients have a CSS rendering adapter. The tab bar uses actual screen options in a static navigation adapter, not a running navigator. The step modal is omitted, safe insets are zero, and large text is simulated. No network, authentication or account writes occur.</p><p>Pending preview deliberately proposes 1800 kcal while the active saved goal remains 2200 kcal. The empty state has no logged records. The 447px reference composition uses synthetic empty records, never personal account data. All existing actions are visible but inert in these static pages.</p><main>${pages.map(p => `<section><h2>${p.dark ? 'Dark' : 'Light'} · ${p.scenario} · ${p.width}px</h2><p><a href="${p.name}">Open full page</a></p><iframe title="${p.name}" width="${p.width}" src="${p.name}"></iframe></section>`).join('')}</main>`);
console.log(`Generated ${pages.length} Home browser previews plus index.`);
