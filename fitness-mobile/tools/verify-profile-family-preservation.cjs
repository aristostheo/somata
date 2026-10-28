const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const mobile=path.resolve(__dirname,'..'),root=path.dirname(mobile);
const argument=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw Error('Required: '+name);return path.resolve(process.argv[i+1]);};
const before=argument('--before-root');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(fs.readFileSync(argument('--baseline')));
const changed=Object.keys(baseline).filter(file=>!fs.existsSync(root+'/'+file)||hash(fs.readFileSync(root+'/'+file))!==baseline[file]);
const allowed=["fitness-mobile/components/accountSettings/useProfileFlowTheme.ts", "fitness-mobile/app/(modals)/long-term-progress.tsx", "fitness-mobile/components/profile/premium/bodyMetrics/MetricPickerSheet.tsx", "fitness-mobile/app/profile/steps-history.tsx", "fitness-mobile/app/fitadapt-setup.tsx", "fitness-mobile/app/(modals)/body-metrics.tsx", "fitness-mobile/app/profile/advanced-metrics.tsx", "fitness-mobile/components/somata/Trend.tsx", "fitness-mobile/components/homeFlows/FitAdaptInsightsView.tsx", "fitness-mobile/app/(modals)/weekly-checkin.tsx", "fitness-mobile/tools/home-preview-runtime.cjs", "fitness-mobile/app/profile/goal-advanced.tsx", "fitness-mobile/app/(modals)/progress-photos.tsx", "fitness-mobile/app/profile/goal-setup.tsx", "fitness-mobile/app/profile/insights-progress.tsx", "fitness-mobile/app/profile/fitadapt-insights.tsx"];
assert.deepEqual(changed.sort(),allowed.sort());
const {createRuntime}=require(mobile+'/tools/home-preview-runtime.cjs');
const primary=[];
for(const dark of [true,false])for(const [tab,method,fixture] of [['Home','preview',{}],['Workouts','workoutsPreview',{workouts:{rows:[],templates:[]}}],['Nutrition','nutritionPreview',{nutrition:{date:'2026-10-19',foods:[]}}],['Alerts','notificationsPreview',{notifications:{rows:[]}}],['Profile','profilePreview',{profileReview:{}}]]){
const render=sourceRoot=>{const r=createRuntime({dark,sourceRoot,account:{uid:'synthetic-preservation',user:{displayName:'Synthetic'},profile:{},today:'2026-10-19',weightDays:[],steps:null,stepGoal:8500,logged:null,planState:null,plan:{kind:'goals',title:'Your goals',targets:{calories:2200,protein:140,carbs:250,fat:70}}},...fixture});return r[method]().body;};
const a=render(),b=render(before);assert.equal(a,b,tab);primary.push({tab,mode:dark?'dark':'light',sameMarkup:true,sha256:hash(a)});
}
const utils=require(mobile+'/tools/render-branding-8b-preview.cjs'),utility=[];
for(const dark of [true,false])for(const [name,route,fixture] of utils.fixtures.scenarios.filter(s=>s[0]!=='legacy-water-control')){
const a=utils.renderCase({dark,route,fixture}).body,b=utils.renderCase({dark,route,fixture,sourceRoot:before}).body;
assert.equal(a,b,name);utility.push({name,mode:dark?'dark':'light',sameMarkup:true,sha256:hash(a)});
}
const nutrition=require(mobile+'/tools/render-nutrition-family-preview.cjs'),nutritionChecks=[];
for(const dark of [true,false])for(const scenario of nutrition.scenarios.map(s=>s.map((v,i)=>i===4?false:v))){
const a=nutrition.renderCase(scenario,{dark}).body,b=nutrition.renderCase(scenario,{dark,sourceRoot:before}).body;
assert.equal(a,b,scenario[0]);nutritionChecks.push({name:scenario[0],dark,sameMarkup:true,sha256:hash(a)});
}
const workouts=require(mobile+'/tools/render-workout-family-preview.cjs'),workoutChecks=[];
for(const dark of [true,false])for(const scenario of workouts.scenarios.map(s=>s.map((v,i)=>i===4?false:v))){
const a=workouts.renderCase(scenario,{dark}).body,b=workouts.renderCase(scenario,{dark,sourceRoot:before}).body;
assert.equal(a,b,scenario[0]);workoutChecks.push({name:scenario[0],dark,sameMarkup:true,sha256:hash(a)});
}
const ts=require(path.join(mobile,"node_modules/typescript"));
function audit(base,file){const src=ts.createSourceFile(file,fs.readFileSync(path.join(base,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),statements={},handlers=[];function jsx(n){if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n))return true;return !!ts.forEachChild(n,jsx);}function walk(n){if(ts.isFunctionDeclaration(n)&&n.name&&n.body&&n.name.text!=='useC'){const parts=n.body.statements.filter(s=>!jsx(s)&&!s.getText(src).includes('useSomataTheme(')&&!s.getText(src).includes('useTaskPresentation('));if(parts.length)statements[n.name.text.replace(/Content$/,'')]=parts.map(s=>s.getText(src).replace(/\s+/g,' '));}if(ts.isJsxAttribute(n)&&/^on[A-Z]/.test(n.name.text))handlers.push(n.getText(src).replace(/\s+/g,' '));ts.forEachChild(n,walk);}walk(src);return{statements,handlers};}
const checks=allowed.filter(f=>f.endsWith(".tsx")&&(f.includes("/app/")||f.includes("MetricPicker")||f.includes("FitAdaptInsightsView"))).map(f=>f.replace("fitness-mobile/", "")).map(file=>{const b=audit(before,file),a=audit(mobile,file);return{file,controllerEqual:JSON.stringify(b.statements)===JSON.stringify(a.statements),missingHandlers:b.handlers.filter(h=>!a.handlers.includes(h)),addedHandlers:a.handlers.filter(h=>!b.handlers.includes(h))};});
const controller={checks};assert(checks.every(c=>c.controllerEqual&&c.missingHandlers.length===0));
const out={baselineFiles:Object.keys(baseline).length,unchangedFiles:Object.keys(baseline).length-changed.length,changedExistingFiles:changed,approvedArtworkUnchanged:Object.keys(baseline).filter(x=>x.startsWith('fitness-mobile/assets/branding/')).length,allOtherBaselineFilesUnchanged:true,primaryTabRenders:primary,homeUtilityRenders:utility,nutritionRenders:nutritionChecks,workoutRenders:workoutChecks,controllerAudit:controller.checks,controllerAuditScope:"Non-JSX statements exclude theme hooks and color mapper useC; existing inline event attributes are checked for retention. Not native verification."};
fs.writeFileSync(mobile+'/review/branding-11/preservation-checks.json',JSON.stringify(out,null,2));console.log('PASS: '+out.unchangedFiles+' baseline files unchanged; '+primary.length+' primary-tab + '+utility.length+' utility renders identical; '+controller.checks.length+' controller comparisons passed.');
