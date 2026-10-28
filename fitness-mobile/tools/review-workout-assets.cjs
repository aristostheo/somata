// Read originals; write review artifacts only. No app or source-image mutations.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createRuntime } = require('./home-preview-runtime.cjs');
const root = path.resolve(__dirname, '..'), repo = path.dirname(root), out = path.join(root, 'review/branding-5a');
const assetRoot = path.join(root, 'assets/branding/workouts');
const { codec } = JSON.parse(fs.readFileSync(path.join(root, 'assets/branding/asset-manifest.json')));
const { PNG } = require(path.join(repo, 'node_modules/.pnpm', codec, 'node_modules/pngjs'));
fs.mkdirSync(out, { recursive: true });
const files = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(folder, d.name)) : d.name.endsWith('.png') ? [path.join(folder, d.name)] : []);
const assets = files(assetRoot).sort().map(file => {
  const bytes = fs.readFileSync(file), png = PNG.sync.read(bytes), chunks = [];
  for (let i = 8; i < bytes.length;) { const size = bytes.readUInt32BE(i); chunks.push(bytes.toString('ascii', i + 4, i + 8)); i += size + 12; }
  let transparent = 0;
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] < 255) transparent++;
  return { file: path.relative(root, file), width: png.width, height: png.height, bytes: bytes.length,
    decodedRgbaBytes: png.data.length, pngColorType: bytes[25], transparentPixels: transparent,
    colorMetadata: chunks.filter(c => ['iCCP','sRGB','gAMA','cHRM'].includes(c)),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
assert.equal(assets.length, 9, 'Review every candidate, including reserve artwork');
const manifestPath = path.join(out, 'asset-audit.json');
if (fs.existsSync(manifestPath)) {
  const prior = JSON.parse(fs.readFileSync(manifestPath));
  assert.deepEqual(assets, prior.assets, 'Original bytes or metadata changed; do not silently replace the audited originals');
}
fs.writeFileSync(manifestPath, JSON.stringify({ status: 'Review candidates only; no app integration', assets }, null, 2) + '\n');
const runtime = createRuntime();
const { AUTO_TEMPLATES } = runtime.load('services/workoutTemplateCatalog.ts');
const component = runtime.load('review/branding-5a/WorkoutImageReview.tsx');
assert.equal(AUTO_TEMPLATES.length, 6);
for (const t of AUTO_TEMPLATES) {
  assert(component.proposedTemplateArtwork(t), t.id);
  assert.equal(component.proposedTemplateArtwork({ ...t, source: 'user' }), null);
}
assert.equal(component.proposedTemplateArtwork({ id: 'unknown', source: 'auto' }), null);
assert.equal(component.proposedTemplateArtwork({ id: 'toString', source: 'auto' }), null);
const variants = [
  { dark: true, name: 'dark-candidates', width: 430 },
  { dark: false, name: 'light-candidates', width: 430 },
  { dark: true, name: 'dark-fallbacks', width: 430, safeOnly: true },
  { dark: false, name: 'light-fallbacks', width: 430, safeOnly: true },
  { dark: true, name: 'dark-large-text', width: 320, fontScale: 1.6 },
];
for (const v of variants) {
  const r = createRuntime({ dark: v.dark, width: v.width, fontScale: v.fontScale || 1 });
  const { contrastRatio } = r.load('lib/themeColor.ts');
  const blend = (base, pixel, alpha) => '#' + [1,3,5].map(i => Math.round(parseInt(base.slice(i,i+2),16)*alpha + pixel*(1-alpha)).toString(16).padStart(2,'0')).join('');
  for (const pixel of [0, 255]) {
    const bg = blend(v.dark ? '#0B0E12' : '#F4F3EE', pixel, v.dark ? 0.78 : 0.86);
    for (const ink of [r.tokens.text.primary, r.tokens.text.secondary]) assert(contrastRatio(ink, bg) >= 4.5, 'Hero overlay contrast');
    const labelBg = blend(v.dark ? '#0B0E12' : '#F4F3EE', pixel, v.dark ? 0.94 : 0.96);
    for (const ink of [r.tokens.text.primary, r.tokens.text.secondary]) assert(contrastRatio(ink, labelBg) >= 4.5, 'Template label contrast');
  }
  assert(contrastRatio(r.tokens.action.link, r.tokens.surface.canvas) >= 4.5, 'Eyebrow backing contrast');
  const { body, styles } = r.render(r.load('review/branding-5a/WorkoutImageReview.tsx').default, { safeOnly: !!v.safeOnly });
  assert(body.includes('Make room to move.')); assert(body.includes('Plan a session'));
  fs.writeFileSync(path.join(out, v.name + '.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workouts image review · ${v.name}</title>${styles}<style>body{margin:0;width:${v.width}px;max-width:100%;background:${r.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
}
const picture = a => `<figure><img src="../../${a.file}" alt="${a.file}"><figcaption>${a.file.split('workouts/')[1]}<br>${a.width} × ${a.height} · ${(a.bytes/1024).toFixed(0)} KiB · opaque RGB</figcaption></figure>`;
const css = 'body{margin:0;padding:24px;background:#F4F3EE;color:#0B0E12;font:14px/1.5 system-ui}h1{font-size:25px}main{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;width:300px}img{display:block;width:300px;height:220px;object-fit:contain;background:#1A1F26}figcaption{padding:8px 0;overflow-wrap:anywhere}iframe{border:1px solid #38434D;border-radius:20px;max-width:100%}a{color:#A33500}';
fs.writeFileSync(path.join(out, 'contact-sheet.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>All nine workout originals</title><style>${css}</style><h1>Workout candidates · unmodified originals</h1><p>Contain-scaled for review; no baked-in text, no retouching. Several template subjects do not match their names. Open an image to inspect it at native resolution.</p><main>${assets.map(picture).join('')}</main></html>`);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Somata Workouts · 5A asset review</title><style>${css}</style><h1>Workouts image treatment · approval only</h1><p>Not a new screen or full redesign. Native React Native Image/Text/Pressable compositions rendered through React Native Web. Text and disabled review controls are separate from source pixels. No account data, routes or persistence. Browser overlays approximate native rendering; 3× sharpness and OLED appearance still need phone review.</p><p><a href="contact-sheet.html">All nine originals</a> · <a href="../../WORKOUTS_IMAGE_ASSET_REVIEW.md">Quality report and approval checklist</a></p><main>${variants.map(v => `<section><h2>${v.name}</h2><a href="${v.name}.html">Open treatment</a><p><iframe title="${v.name}" width="${v.width}" height="1100" src="${v.name}.html"></iframe></p></section>`).join('')}</main></html>`);
console.log(`PASS: ${assets.length} PNGs decoded; hashes frozen; 6 catalog mappings verified; user/unknown IDs excluded; ${variants.length} native-component browser treatments generated.`);
for (const a of assets) console.log(`${a.file}: ${a.width}x${a.height}, ${(a.bytes/1024).toFixed(1)} KiB, metadata=${a.colorMetadata.join(',') || 'none'}`);
