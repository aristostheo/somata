// Offline actual-screen review. Synthetic fixtures only; no services/effects run.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createRuntime } = require('./home-preview-runtime.cjs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'review/branding-5b');
fs.mkdirSync(out, { recursive: true });
const { codec } = JSON.parse(fs.readFileSync(path.join(root, 'assets/branding/asset-manifest.json')));
const { PNG } = require(path.join(root, '../node_modules/.pnpm', codec, 'node_modules/pngjs'));
const assets = [];
for (const folder of ['hero', 'templates']) for (const file of fs.readdirSync(path.join(root, 'assets/branding/workouts', folder)).filter(f => f.endsWith('.png'))) {
  const relative = `assets/branding/workouts/${folder}/${file}`, bytes = fs.readFileSync(path.join(root, relative));
  const decoded = PNG.sync.read(bytes);
  assets.push({ file: relative, width: decoded.width, height: decoded.height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
const audit = path.join(out, 'asset-audit.json');
if (fs.existsSync(audit)) assert.deepEqual(JSON.parse(fs.readFileSync(audit)), assets, 'Preserve checkpoint originals');
fs.writeFileSync(audit, JSON.stringify(assets, null, 2) + '\n');
const pages = [], now = new Date();
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = dayKey(now);
const rows = [0, 2, 4, 6].map((offset, i) => { const d = new Date(now); d.setDate(d.getDate()-offset); return {
  id: `synthetic-${i}`, date: dayKey(d), exercise: ['Squat','Bench press','Row','Lunge'][i], sessionTitle: 'Strength session · demo', sets: [4, 3, 5, 2][i],
}; });
const items = [{ exercise: 'Squat', sets: 3, reps: 8, weightKg: 20 }];
const templates = [{ id: 'synthetic-custom', name: 'Weekend full body', items },
  { id: 'synthetic-long', name: 'A longer custom strength session with controlled tempo', items },
  { id: 'synthetic-archive', name: 'Archived session', items, archived: true }];
for (const dark of [true, false]) for (const scenario of ['populated', 'empty', 'loading', 'large-text', 'plan-sheet']) {
  const width = scenario === 'large-text' ? 320 : 430;
  const r = createRuntime({ dark, width, fontScale: scenario === 'large-text' ? 1.8 : 1,
    account: { uid: 'synthetic-review-only' }, workouts: {
      rows: scenario === 'loading' ? null : scenario === 'empty' ? [] : rows,
      templates: scenario === 'loading' ? null : scenario === 'empty' ? [] : templates,
      configOpen: scenario === 'plan-sheet', activities: scenario === 'empty' || scenario === 'loading' ? [] : [{ id: 'synthetic-walk', type: 'walk', minutes: 20 }],
    } });
  const { body, styles } = r.workoutsPreview();
  const name = `workouts-${dark ? 'dark' : 'light'}-${scenario}.html`;
  const font = path.relative(out, require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
  fs.writeFileSync(path.join(out, name), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workouts · synthetic ${scenario}</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}html,body,#root{margin:0;min-height:100%}body{width:${width}px;max-width:100%;background:${r.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
  pages.push({ name, dark, scenario, width });
}
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workouts · 5B</title><style>body{padding:24px;background:#e8ebed;color:#0B0E12;font:16px/1.5 system-ui}main{display:flex;gap:24px;flex-wrap:wrap}iframe{height:1100px;border:1px solid #73808B;border-radius:20px;max-width:100%}h2{font-size:18px}</style><h1>Premium Workouts · offline review</h1><p>Actual screen JSX with explicitly synthetic fixture state. No Firebase, device storage, subscriptions or real accounts. Browser gradients/images and the installed icon font approximate native rendering. Text scaling is simulated; safe insets are zero. The static tab adapter highlights Workouts. Actions are inert. The plan sheet is rendered inline to inspect its controls, not to claim native modal/keyboard validation.</p><main>${pages.map(p => `<section><h2>${p.dark ? 'Dark' : 'Light'} · ${p.scenario}</h2><a href="${p.name}">Open full page</a><br><iframe title="${p.name}" width="${p.width}" src="${p.name}"></iframe></section>`).join('')}</main>`);
console.log(`PASS: ${assets.length} original PNGs decoded; ${pages.length} screen previews generated.`);
for (const a of assets) console.log(`${a.file}: ${a.width}×${a.height}`);
