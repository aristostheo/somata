// Actual Profile JSX, offline fixtures only. Never initializes Firebase or runs effects.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRuntime } = require('./home-preview-runtime.cjs');
const root = path.resolve(__dirname,'..'), out = path.join(root,'review/branding-6b');
fs.mkdirSync(out,{recursive:true});
const {codec}=JSON.parse(fs.readFileSync(path.join(root,'assets/branding/asset-manifest.json')));
const {PNG}=require(path.join(root,'../node_modules/.pnpm',codec,'node_modules/pngjs'));
const audit = JSON.parse(fs.readFileSync(path.join(root,'review/profile-assets/asset-audit.json')));
for(const a of audit) {
  const bytes=fs.readFileSync(path.join(root,a.file)),decoded=PNG.sync.read(bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);
  assert.equal(decoded.width,a.width); assert.equal(decoded.height,a.height);
}
for(const [file,hash] of [
  ['somata/symbol-color.png','3be74bd514c7450fc59adb1fa004ac42940d060103c39acb02b08dbfd6f4afb8'],
  ['fitadapt/symbol-color.png','b7e792f6c40810f695f24d5b03eebb5381299ff2605b9c0780f247ead5955a56'],
]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/branding',file))).digest('hex'),hash);
const pages=[];
const targets={calories:2100,protein:150,carbs:220,fat:60};
const currentRecommendation={proposalId:'preview-accepted',acceptedAt:1,effectiveDate:'2026-10-01',policyVersion:'preview-only',targets};
const pending={id:'preview-pending',status:'pending',createdAt:1,targets:{calories:1900,protein:130,carbs:200,fat:55},effectiveDate:'2026-10-18',responseVersion:'preview',sourceFingerprint:'preview',reviewRequired:true};
const scenarios=['goals','active','pending','active-pending','busy','unavailable','incomplete','insufficient','loading','empty','syncing','stale','hidden','large-text'];
for(const dark of [true,false]) for(const scenario of scenarios) {
  const width=scenario==='large-text'?320:430;
  let profile={displayName:'Preview account',dailyCaloriesTarget:2300,dailyProteinTarget:140,carbGoal:250,fatGoal:65};
  let state={currentRecommendation:null,pending:null},review={};
  if(['active','active-pending','syncing'].includes(scenario)) profile.activeFitAdaptTargets=targets;
  if(['active','active-pending'].includes(scenario)) {state.currentRecommendation=currentRecommendation;review={current:targets,activeSynced:true};}
  if(['pending','active-pending','busy','hidden','stale'].includes(scenario)) state.pending=pending;
  if(scenario==='busy') review.busy=true;
  if(scenario==='unavailable') review={loadFailed:true,note:'FitAdapt is unavailable right now. Your current goals are unchanged.'};
  if(scenario==='incomplete') review.note='Complete your saved profile and goals first: age, heightCm.';
  if(scenario==='insufficient') review.note='More dated weight and nutrition records are needed before FitAdapt can suggest a change.';
  if(scenario==='loading') profile=undefined;
  if(scenario==='empty') profile={displayName:'Preview account'};
  if(scenario==='syncing') review={current:targets,activeSynced:false};
  if(scenario==='stale') review.note='Your goals changed since this review. Request a new evaluation.';
  const r=createRuntime({dark,width,fontScale:scenario==='large-text'?1.8:1,profileReview:{...review,pending:state.pending}});
  // Resolve fixture targets through the same pure plan helper used by the app.
  const account={uid:'synthetic-preview-only',profile,user:{displayName:'Preview account',email:'preview@example.invalid'},
    plan:r.load('services/dashboardPreviewData.ts').dashboardPreviewPlan(profile,state,scenario==='loading'?'loading':scenario==='unavailable'?'error':'ready'),
    steps:null,weightDays:[],setPlanState:()=>{}};
  const runtime=createRuntime({dark,width,fontScale:scenario==='large-text'?1.8:1,account,profileReview:{...review,pending:state.pending}});
  if(scenario==='hidden') runtime.profileState[0]=true;
  const {body,styles}=runtime.profilePreview();
  const name=`profile-${dark?'dark':'light'}-${scenario}.html`;
  const font=path.relative(out,require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
  fs.writeFileSync(path.join(out,name),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile · synthetic ${scenario}</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}html,body,#root{margin:0;min-height:100%}body{width:${width}px;max-width:100%;background:${runtime.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div></html>`);
  pages.push({name,width,dark,scenario});
}
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile · 6B review</title><style>body{padding:24px;background:#e8ebed;color:#0B0E12;font:16px/1.5 system-ui}main{display:flex;gap:24px;flex-wrap:wrap}iframe{height:1050px;border:1px solid #73808B;border-radius:20px;max-width:100%}h2{font-size:18px}</style><h1>Premium Profile · offline state review</h1><p>Actual Profile JSX with synthetic targets and plan-state fixtures. No real accounts, measurements, Firebase calls, subscriptions, device storage or live FitAdapt results. No measurement series is fabricated in these screenshots. Targets are fixture values, not recommendations. Actions are inert. Browser gradients and font scaling approximate native behavior; safe insets are zero. The static tab adapter highlights Profile.</p><main>${pages.map(p=>`<section><h2>${p.dark?'Dark':'Light'} · ${p.scenario}</h2><a href="${p.name}">Open full page</a><p><iframe title="${p.name}" width="${p.width}" src="${p.name}"></iframe></p></section>`).join('')}</main>`);
console.log(`PASS: eight background originals decoded/hash-verified; approved S3/F3 unchanged; ${pages.length} actual-screen state previews generated.`);
