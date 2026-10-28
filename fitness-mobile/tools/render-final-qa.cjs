// Read-only source rendering; outputs only to the new Checkpoint 13 review folder.
// All imported adapters use synthetic data. Never initializes Firebase or providers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),out=path.join(root,'review/branding-13');
fs.mkdirSync(out,{recursive:true});const entries=[];
function save(name,id,result,dark,width,fontScale=1,extra={}){
 const file=`${dark?'dark':'light'}-${name}-${fontScale===1?'normal':'large'}.html`;
 fs.writeFileSync(path.join(out,file),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA · ${name}</title>${result.styles}<style>@font-face{font-family:Ionicons;src:url('../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}*{box-sizing:border-box}html,body{margin:0;background:${dark?'#0B0E12':'#F4F3EE'}}body{width:${width}px;max-width:100%;margin:auto}#root{display:flex;flex-direction:column;min-height:100vh;width:100%}.fixture{font:11px/1.5 system-ui;padding:8px;background:#F4F3EE;color:#0B0E12}</style><div class="fixture">CURRENT · SYNTHETIC OFFLINE · ${name} · ${width}px / ${fontScale}× text</div><div id="root">${result.body}</div></html>`);
 entries.push({name,id,file,dark,width,fontScale,version:'after',...extra});
}
for(const family of ['nutrition','workout','profile','social']){
 const {scenarios,renderCase}=require(`./render-${family}-family-preview.cjs`),seen=new Set();
 for(const s of scenarios){const id=s[0].slice(0,3),first=!seen.has(id);seen.add(id);
  for(const dark of [true,false])for(const scale of first?[1,1.8]:[1])save(s[0],id,renderCase(s,{dark,width:scale===1?390:320,fontScale:scale}),dark,scale===1?390:320,scale);
 }
 console.log('Rendered',family);
}
const utilities=require('./render-branding-8b-preview.cjs');
for(const s of utilities.fixtures.scenarios.filter(s=>s[0]!=='legacy-water-control')){
 const [name,route,fixture]=s,id=name.startsWith('sync')?'T03':name.startsWith('calendar')?'T01':name.startsWith('day')?'O18':'O01';
 for(const dark of [true,false])for(const scale of [1,1.8])save(name,id,utilities.renderCase({dark,width:scale===1?390:320,fontScale:scale,route,fixture}),dark,scale===1?390:320,scale);
}
// Run established primary-tab scripts against current JSX, intercepting all writes.
// Historical review packages are strictly read-only; their old captures are linked.
for(const [script,id,prior] of [['premium-home','H01','3c'],['nutrition','N00','4'],['workouts','W00','5b'],['profile','P00','6b'],['alerts','L00','7'],['auth','A01','2b'],['register','A02','2b'],['reset','A03','2b']]){
 const original=script==='register'||script==='reset'?'auth':script;
 const filename=path.join(__dirname,`render-${original}-preview.cjs`),req=createRequire(filename);
 let code=fs.readFileSync(filename,'utf8');
 if(original==='auth'){
  code=code.replace("'firebase/auth': {},","'firebase/auth': {}, 'firebase/firestore': {},");
  if(script!=='auth')code=code.replace('app/(auth)/login.tsx',`app/(auth)/${script}.tsx`).replace(/login-/g,`${script}-`);
 }
 const safeFs={...fs,mkdirSync:()=>{},writeFileSync:(file,contents)=>{
   if(!file.endsWith('.html')||path.basename(file)==='index.html')return;
   const name=path.basename(file),dark=name.includes('-dark-'),large=name.includes('large-text'),width=large||name.includes('-320')?320:original==='auth'||original==='premium-home'?390:430;
   fs.writeFileSync(path.join(out,name),contents);
   entries.push({name:name.replace('.html',''),id,file:name,dark,width:Number(contents.match(/body\{width:(\d+)px/)?.[1]||width),fontScale:large?1.8:1,version:'after',prior:fs.existsSync(path.join(root,'review/branding-'+prior,name))?`../branding-${prior}/${name}`:null});
 }};
 const local=name=>['fs','node:fs'].includes(name)?safeFs:req(name);local.resolve=req.resolve;
 vm.runInNewContext(code,{require:local,__dirname,console,process,Buffer,URL},{filename});
}
// Render actual startup JSX with inert hooks, not account controllers or services.
const ts=require('typescript'),React=require('react'),RN=require('react-native-web'),{renderToStaticMarkup}=require('react-dom/server');
function startup(dark,failed,preparing){
 const cache=new Map();const load=file=>{if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const req=name=>{
  if(name==='react')return React;
  if(name==='react-native')return {...RN,Image:Object.assign(p=>React.createElement('img',{src:p.source.uri,alt:p.accessibilityLabel,style:{...p.style,objectFit:'contain'}}),{resolveAssetSource:x=>x})};
  if(name==='react-native-safe-area-context')return {SafeAreaProvider:RN.View,SafeAreaView:RN.View};
  if(name==='@/content/ThemeProvider')return {useTheme:()=>{throw Error('Startup must not use ThemeProvider');}};
  if(name.endsWith('.png')){const p=path.resolve(path.dirname(file),name),b=fs.readFileSync(p);return {uri:'../../'+path.relative(root,p),width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}
  const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
  const target=['.tsx','.ts'].map(x=>base+x).find(fs.existsSync);if(!target)throw Error('Unexpected startup dependency '+name);return load(target);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:req});return exports;};
 const C=load(path.join(root,'components/somata/StartupSurface.tsx')).StartupSurface;
 RN.AppRegistry.registerComponent('StartupQA',()=>()=>React.createElement(C,{dark,preparing,failed,onRetry:()=>{}}));
 const a=RN.AppRegistry.getApplication('StartupQA');return {body:renderToStaticMarkup(a.element),styles:renderToStaticMarkup(a.getStyleElement())};
}
const {createRuntime}=require('./home-preview-runtime.cjs');
for(const dark of [true,false]){
 for(const [name,id,preparing,failed]of[['launch','G01',false,false],['preparing','G02',true,false],['preparation-error','G02',true,true]])save(name,id,startup(dark,failed,preparing),dark,390);
 for(const scale of [1,1.8]){const r=createRuntime({dark,width:scale===1?390:320,fontScale:scale});save('recovery','T10',r.render(r.load('app/+not-found.tsx').default),dark,scale===1?390:320,scale);}
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({synthetic:true,native:false,entries},null,2));
const css='<style>body{font:16px/1.5 system-ui;background:#F4F3EE;color:#0B0E12;margin:24px}a{color:#9D3500}.grid{display:flex;flex-wrap:wrap;gap:20px}iframe{width:390px;max-width:100%;height:800px;border:1px solid #73808B;border-radius:16px}article{max-width:100%}</style>';
const ids=[...new Set(entries.map(e=>e.id))].sort();
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8">${css}<h1>Somata / Final QA</h1><p>Current JSX. Synthetic offline fixtures. Browser rendering, not native/device/cloud evidence. Native sheets, media, safe areas, Dynamic Type and permissions need device checks. Actions are inert; service mocks do not prove production behavior.</p><p><a href="../../SOMATA_FINAL_QA_REPORT.md">Report</a> · <a href="comparisons.html">Approved/current comparison</a></p>${ids.map(id=>`<details><summary>${id} · ${entries.filter(e=>e.id===id).length} states</summary><div class="grid">${entries.filter(e=>e.id===id).map(e=>`<article><h3>${e.name} · ${e.dark?'Dark':'Light'} · ${e.fontScale}×</h3><a href="${e.file}">Open full page</a><br><iframe loading="lazy" title="${e.file}" src="${e.file}"></iframe></article>`).join('')}</div></details>`).join('')}`);
fs.writeFileSync(path.join(out,'comparisons.html'),`<!doctype html><html lang="en"><meta charset="utf-8">${css}<h1>Historical approved / current</h1><p>Fixture-based browser comparisons; historical captures are unchanged. Dates/runtime versions may differ. No claim of pixel-identical native rendering.</p>${entries.filter(e=>e.prior&&(/goals|populated|all|login.*390/.test(e.name))).map(e=>`<h2>${e.name}</h2><div class="grid"><article>Approved<br><iframe src="${e.prior}"></iframe></article><article>Current<br><iframe src="${e.file}"></iframe></article></div>`).join('')}`);
console.log('Final gallery',entries.length,'renders',ids.length,'unique surfaces');

// Before files are checkpoint-start captures, never synthesized from the fixed layout.
const fixes=fs.readdirSync(out).filter(f=>f.startsWith('before-fix-')&&f.endsWith('.html'));
fs.writeFileSync(path.join(out,'fixes.html'),`<!doctype html><html lang="en"><meta charset="utf-8">${css}<h1>Isolated label-wrapping fixes</h1><p>Actual before/current JSX, synthetic fixtures. No change to callbacks or labels. <a href="index.html">Final gallery</a></p>${fixes.map(f=>`<h2>${f.slice(11)}</h2><div class="grid"><article>Before<br><iframe src="${f}"></iframe></article><article>After<br><iframe src="${f.slice(11)}"></iframe></article></div>`).join('')}`);
