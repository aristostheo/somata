// Read-only verification. Does not regenerate files, access the network, or touch app data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../../..');
const m=JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json')));
const {PNG}=require(path.join(repo,'node_modules/.pnpm',m.codec,'node_modules/pngjs'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'source-checksums.json')));
for(const b of baseline)assert.equal(hash(fs.readFileSync(path.join(repo,b.path))),b.sha256,b.path);
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);
assert.deepEqual(files(path.join(root,'source')).map(f=>path.relative(repo,f)).sort(),baseline.map(b=>b.path).sort(),'Source additions/removals');
const expected=m.outputs.map(a=>a.path).sort();
const actual=['somata','fitadapt','navigation','app'].flatMap(dir=>files(path.join(root,dir)).map(f=>path.relative(root,f))).sort();
assert.deepEqual(actual,expected,'Untracked or missing prepared assets');
for(const a of m.outputs){
  const bytes=fs.readFileSync(path.join(root,a.path)),p=PNG.sync.read(bytes);
  assert.equal(hash(bytes),a.sha256,a.path);assert.equal(p.width,a.width);assert.equal(p.height,a.height);
  assert.equal(bytes[25],a.pngColorType);assert.equal(p.width*p.height*4,p.data.length);
  if(a.path.startsWith('navigation/')){assert.equal(p.width,192);assert.equal(p.height,192);}
  if(a.path.startsWith('app/')){assert.equal(p.width,1024);assert.equal(p.height,1024);}
  if(a.pngColorType===2)for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],255);
  else {assert.equal(a.nonzeroAlphaEdgePixels,0,`Transparent margin: ${a.path}`);assert(a.transparentPixels>0);}
  if(a.path.includes('android-'))for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3])assert(Math.hypot(x+.5-512,y+.5-512)<1024*33/108);
  if(a.path.includes('-mono-')||a.path.includes('monochrome')){
    const colorPath=a.path.includes('android-')?'app/android-adaptive-foreground.png':a.path.replace(/-mono-(bone|charcoal)/,a.path.includes('symbol-')?'-color':'-dark');
    const color=PNG.sync.read(fs.readFileSync(path.join(root,colorPath)));assert.equal(color.data.length,p.data.length);
    for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],color.data[i]);
  }
}
for(const group of ['somata','fitadapt','navigation','app']){
  const p=PNG.sync.read(fs.readFileSync(path.join(root,`review/contact-${group}.png`)));assert(p.width>0&&p.height>0);
}
const gallery=fs.readFileSync(path.join(root,'review/index.html'),'utf8');for(const a of m.outputs)assert(gallery.includes(a.path));
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'brand-tokens.json'))).colors,{charcoal:'#0B0E12',graphite:'#1A1F26',slate:'#38434D',bone:'#F4F3EE',somataOrange:'#FF6A00',coralRed:'#FF5A2A',energyYellow:'#FFC629'});
console.log(`PASS: ${baseline.length} original hashes and source file set; ${m.outputs.length} output hashes/dimensions/PNG decodes; alpha/background/margins; icon size; monochrome alpha; adaptive safe circle; 4 contact sheets; complete gallery; 7 exact brand colors.`);
