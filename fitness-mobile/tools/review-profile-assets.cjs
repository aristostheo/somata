// Read-only source audit; writes exclusively to review/profile-assets/.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createRuntime } = require('./home-preview-runtime.cjs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'review/profile-assets');
const { codec } = JSON.parse(fs.readFileSync(path.join(root, 'assets/branding/asset-manifest.json')));
const { PNG } = require(path.join(root, '../node_modules/.pnpm', codec, 'node_modules/pngjs'));
fs.mkdirSync(out, { recursive: true });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const linear = byte => { const x = byte / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
const lum = hex => rgb(hex).map(linear).reduce((s,v,i) => s + v * [0.2126,0.7152,0.0722][i],0);
const ratio = (a,b) => (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
const modes = { dark: createRuntime({ dark: true }), light: createRuntime({ dark: false }) };
const assets = [];
for (const family of ['ambient','goals','fitadapt','progress']) for (const mode of ['dark','light']) {
  const file = `assets/branding/profile/${family}-${mode}.png`, bytes = fs.readFileSync(path.join(root,file)), png = PNG.sync.read(bytes);
  assert.equal(png.width,2400); assert.equal(png.height,1200);
  const chunks = []; for (let i=8;i<bytes.length;) { const n=bytes.readUInt32BE(i); chunks.push(bytes.toString('ascii',i+4,i+8));i+=n+12; }
  const alpha = mode==='dark' ? 41/255 : 51/255, base = rgb(mode==='dark' ? '#0B0E12' : '#F4F3EE');
  const lut = base.map(v => Array.from({length:256},(_,n)=>linear(Math.round(v*alpha+n*(1-alpha)))));
  let transparent=0,min=1,max=0;
  for(let i=0;i<png.data.length;i+=4) {
    if(png.data[i+3]!==255) transparent++;
    const l=lut[0][png.data[i]]*0.2126+lut[1][png.data[i+1]]*0.7152+lut[2][png.data[i+2]]*0.0722;
    min=Math.min(min,l); max=Math.max(max,l);
  }
  assert.equal(transparent,0,'Expected opaque decorative backgrounds');
  const contrast={};
  for(const role of ['primary','secondary']) {
    const l=lum(modes[mode].tokens.text[role]);
    contrast[role]=Number((l>=min&&l<=max?1:Math.min(ratio(l,min),ratio(l,max))).toFixed(2));
    assert(contrast[role]>=4.5,`${file}: ${role} contrast`);
  }
  assets.push({file,width:png.width,height:png.height,bytes:bytes.length,decodedRgbaBytes:png.data.length,
    bitDepth:bytes[24],colorType:bytes[25],transparentPixels:transparent,colorMetadata:chunks.filter(c=>['iCCP','sRGB','gAMA','cHRM'].includes(c)),
    minTextContrastWithOverlay:contrast,sha256:hash(bytes)});
}
assert.equal(fs.readdirSync(path.join(root,'assets/branding/profile')).filter(f=>!f.startsWith('.')).length,8,'Audit all source files');
for(const [file,expected] of [
  ['somata/symbol-color.png','3be74bd514c7450fc59adb1fa004ac42940d060103c39acb02b08dbfd6f4afb8'],
  ['fitadapt/symbol-color.png','b7e792f6c40810f695f24d5b03eebb5381299ff2605b9c0780f247ead5955a56'],
]) assert.equal(hash(fs.readFileSync(path.join(root,'assets/branding',file))),expected,'Approved master unchanged');
const audit=path.join(out,'asset-audit.json');
if(fs.existsSync(audit)) assert.deepEqual(JSON.parse(fs.readFileSync(audit)),assets,'Originals or audited treatment changed');
fs.writeFileSync(audit,JSON.stringify(assets,null,2)+'\n');
const pages=[];
for(const dark of [true,false]) for(const large of [false,true]) {
  const width=large?320:430, r=createRuntime({dark,width,fontScale:large?1.6:1});
  const {body,styles}=r.render(r.load('review/profile-assets/ProfileAssetReview.tsx').default);
  assert(!body.includes('<svg')); assert(!body.includes('Active plan'));
  assert(body.includes('No account loaded')); assert(body.includes('Two dated weights'));
  const name=`profile-${dark?'dark':'light'}${large?'-large-text':''}.html`;
  const font=path.relative(out,require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
  fs.writeFileSync(path.join(out,name),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile assets · review only</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}body{margin:0;width:${width}px;max-width:100%;background:${r.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
  pages.push({name,width});
}
const css='body{margin:0;padding:24px;background:#F4F3EE;color:#0B0E12;font:14px/1.5 system-ui}main{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:440px}figure img{width:440px;height:220px;object-fit:contain;max-width:100%;display:block}figcaption{padding:8px 0}a{color:#A33500}iframe{height:1050px;max-width:100%;border:1px solid #38434D;border-radius:16px}';
fs.writeFileSync(path.join(out,'contact-sheet.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Eight Profile originals</title><style>${css}</style><h1>Profile backgrounds · unmodified originals</h1><p>All 2400×1200, opaque; scaled uniformly for review. Waves are decoration, never measured data.</p><main>${assets.map(a=>`<figure><a href="../../${a.file}"><img src="../../${a.file}" alt="${a.file.split('/').at(-1)}"></a><figcaption>${a.file.split('/').at(-1)} · ${(a.bytes/1024).toFixed(1)} KiB</figcaption></figure>`).join('')}</main></html>`);
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile assets · approval gallery</title><style>${css}</style><h1>Profile + FitAdapt asset treatment</h1><p>Review only; not connected to an account and not installed in the app. No invented targets, measurements, trends or proposals. S3 and F3 are the existing approved PNGs. Other UI is React Native Text/View/Pressable and icon components rendered through React Native Web. Browser previews do not certify native rendering.</p><p><a href="contact-sheet.html">All eight originals</a> · <a href="../../PROFILE_ASSET_REVIEW.md">Quality report and exact mapping</a></p><main>${pages.map(p=>`<section><h2>${p.name.replace('.html','')}</h2><a href="${p.name}">Open full preview</a><p><iframe title="${p.name}" width="${p.width}" src="${p.name}"></iframe></p></section>`).join('')}</main></html>`);
console.log('PASS: 8 PNGs decoded and hashed; S3/F3 verified; text contrast >=4.5; 4 native-component review pages; no account data or charts.');
for(const a of assets) console.log(`${a.file}: ${a.width}×${a.height}, ${(a.bytes/1024).toFixed(1)} KiB, RGB type ${a.colorType}, metadata=${a.colorMetadata.join(',')||'none'}, contrast=${JSON.stringify(a.minTextContrastWithOverlay)}`);
