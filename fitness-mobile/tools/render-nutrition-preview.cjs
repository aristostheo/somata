const fs = require('node:fs'), path = require('node:path');
const { createRuntime } = require('./home-preview-runtime.cjs');
const out = path.resolve(__dirname, '../review/branding-4');
fs.mkdirSync(out, { recursive: true });
const pages = [];
for (const dark of [true, false]) for (const scenario of ['populated', 'empty', 'loading', 'error', 'past', 'pending', 'large-text']) {
  const date = scenario === 'past' ? '2026-10-17' : '2026-10-18';
  const width = scenario === 'large-text' ? 320 : 430;
  const food = { id: 'synthetic-meal', date, meal: 'breakfast', name: 'Oat bowl · demo', qty: 1, unit: 'serving', calories: 620, protein: 32, carbs: 76, fat: 21 };
  const account = { uid: 'synthetic-preview-only', today: '2026-10-18', profile: {},
    plan: { kind: 'goals', title: 'Your goals', targets: { calories: 2400, protein: 150, carbs: 270, fat: 80 } },
    planState: scenario === 'pending' ? { pending: { targets: { calories: 1800 } } } : null };
  const runtime = createRuntime({ dark, width, fontScale: scenario === 'large-text' ? 1.8 : 1, account,
    nutrition: { date, foods: scenario === 'loading' ? undefined : scenario === 'error' ? null : scenario === 'empty' ? [] : [food], water: scenario === 'empty' ? null : 500 } });
  const { body, styles } = runtime.nutritionPreview();
  const name = `nutrition-${dark ? 'dark' : 'light'}-${scenario}.html`;
  const font = path.relative(out, require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
  fs.writeFileSync(path.join(out, name), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nutrition · synthetic ${scenario}</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}html,body,#root{margin:0;min-height:100%}body{width:${width}px;max-width:100%;background:${runtime.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
  pages.push({ name, dark, scenario, width });
}
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nutrition · Checkpoint 4</title><style>body{padding:24px;background:#e8ebed;color:#0B0E12;font:16px/1.5 system-ui}main{display:flex;gap:24px;flex-wrap:wrap}iframe{height:900px;border:1px solid #73808B;border-radius:20px;max-width:100%}h2{font-size:18px}</style><h1>Premium Nutrition · offline review</h1><p>Actual Nutrition JSX with synthetic fixture state. No real accounts, Firebase calls or device storage. Effects/subscriptions do not run. Browser gradients/SVG and the installed Ionicons font approximate native rendering; font scaling is simulated and safe insets are zero. The tab options use a static adapter; the edit sheet is not rendered. All actions are inert in these HTML files.</p><p>The pending fixture leaves saved targets at 2400 kcal. The past day omits today's targets. Loading, error and empty records remain distinct. Fixtures are only in tools/tests, never in the app.</p><main>${pages.map(p => `<section><h2>${p.dark ? 'Dark' : 'Light'} · ${p.scenario} · ${p.width}px</h2><a href="${p.name}">Open full page</a><br><iframe title="${p.name}" width="${p.width}" src="${p.name}"></iframe></section>`).join('')}</main>`);
console.log(`Generated ${pages.length} Nutrition previews plus index.`);
