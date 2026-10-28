const fs=require('node:fs'),path=require('node:path'),React=require('react');
const {createRuntime}=require('./home-preview-runtime.cjs');
const root=path.resolve(__dirname,'..'),mods='app/(modals)/',pages='app/profile/',date='2026-10-19',ts=Date.parse(date+'T12:00:00');
const goal={currentWeight:80,goalWeight:75,heightCm:180,age:30,sex:'male',mode:'cut',pace:'gentle',activityLevel:'active',trainingDaysPerWeek:3,cyclingEnabled:false,proteinPriority:'high',cardioMinutesPerWeek:60,manualTDEEOverride:null,bodyFatPercent:null,manualMacroRatios:null,bmrFormula:'mifflin'};
const targets={calories:2400,protein:175,carbs:260,fat:70};
const accepted={schemaVersion:1,proposalId:'synthetic-accepted',acceptedAt:ts-86400000,effectiveDate:date,...targets};
const profile={age:30,heightCm:180,weightKg:80,targetWeightKg:75,sex:'male',activityLevel:'active',weightUnit:'kg',goal:'cut',goalInputs:goal,goalResult:{weeklyPaceKg:-0.25},calorieGoal:2200,proteinGoal:160,carbsGoal:240,fatGoal:65,stepsGoal:8000,steps:{'2026-10-19':0,'2026-10-18':9400,'2026-10-16':6800},bodyFatPct:20};
const goalState={profile,draft:goal,initialInputs:{...goal,currentWeight:81},ageInput:'30',currentWeightInput:'80',goalWeightInput:'75',heightMetricInput:'180',heightFeetInput:'5',heightInchesInput:'11',smartOpen:true};
const setupDraft={age:'30',heightCm:'180',heightFeet:'5',heightInches:'11',weight:'80',weightUnit:'kg',sex:'male',activityLevel:'active',mode:'cut',pace:'gentle',proteinPriority:'high'};
const setupState={profile:null,draft:setupDraft,kind:'new',kindLoaded:true,loaded:true};
const bodyDraft={weightLb:176.4,targetWeightLb:165,heightCm:180,age:30,sex:'female',bodyFatPct:20,waistCm:82,neckCm:36,hipCm:96};
const history=[12,9,6,3,0].map((n,i)=>({t:ts-n*86400000,weightLb:180-i*0.9,bodyFatPct:21-i*.2,waistCm:85-i*.6}));
const bodyState={loading:false,draft:bodyDraft,original:{...bodyDraft,weightLb:177},profile,history};
const photos=[{id:'synthetic-photo-1',uri:'synthetic:photo-1',date:'2026-10-01',note:'Synthetic private journal note',weight:null},{id:'synthetic-photo-2',uri:'synthetic:photo-2',date,note:'Synthetic recent journal note',weight:null}];
const photoState={photos,baselineId:photos[0].id,selectedId:photos[1].id};
const stats={mealsLoggedDays:4,workoutSessions:2,hydrationDaysHit:3,observation:'Synthetic weekly record summary.'};
const checkins=[0,1,2,3].map((n)=>({id:'synthetic-checkin-'+n,weekOf:`2026-10-${String(19-n*5).padStart(2,'0')}`,energy:3+n%2,mood:4,consistencyRating:'accurate',bodyChanges:['About the same'],bodyNote:'Synthetic reflection',moodNote:null,mealsLoggedDays:4,workoutSessions:2,hydrationDaysHit:3}));
const checkState={profile,energy:4,mood:4,consistencyRating:'accurate',bodyChanges:['About the same'],stats,history:checkins};
const foods=[0,2,3,6].map((n,i)=>({id:'synthetic-food-'+i,date:`2026-10-${19-n}`,meal:i%2?'dinner':'breakfast',calories:650+i*90,protein:35+i*6,carbs:70,fat:22,createdAt:ts-n*86400000}));
const progress={profile,foods,exercises:[{date,calories:120}],activities:[],waterByDay:{[date]:2000,'2026-10-17':2600},bodyHistory:history,openRows:{calories:true,protein:true,weight:true}};
const longterm={weightSeriesRaw:history.map(p=>({date:p.t,value:p.weightLb})),bfSeriesRaw:history.map(p=>({date:p.t,value:p.bodyFatPct})),waistSeriesRaw:history.map(p=>({date:p.t,value:p.waistCm})),workoutSeriesRaw:[{date:ts-14*86400000,value:18},{date:ts-7*86400000,value:24},{date:ts,value:12}],nutritionSeriesRaw:[]};
const events=['accepted','declined','superseded','accepted'].map((status,i)=>({id:'synthetic-event-'+i,status,resolvedAt:ts-i*86400000,createdAt:ts-(i+1)*86400000,effectiveDate:i===2?null:date,targets:i===2?null:{...targets,calories:2400-i*50}}));
const fitState={dataUid:'synthetic-profile-11',historyUid:'synthetic-profile-11',profile,weights:history.map(p=>({id:'w'+p.t,date:new Date(p.t).toISOString().slice(0,10),weightKg:p.weightLb*.45359237})),foods,events,hasMore:true};
const scenarios=[
 ['P01-goals',pages+'goal-setup.tsx',goalState],['P01-accepted',pages+'goal-setup.tsx',{...goalState,profile:{...profile,activeFitAdaptTargets:accepted}}],['P01-invalid',pages+'goal-setup.tsx',{...goalState,ageInput:'',heightMetricInput:''}],['P01-busy',pages+'goal-setup.tsx',{...goalState,saving:true}],
 ['O29-weight-decision',pages+'goal-setup.tsx',{...goalState,recalcOpen:true},true],
 ['P02-advanced',pages+'goal-advanced.tsx',{draft:{...goal,bmrFormula:'katch_mcardle',bodyFatPercent:20,manualTDEEOverride:2600,manualMacroRatios:{protein:35,carbs:40,fat:25}},bodyFatInput:'20'}],
 ['P02-invalid',pages+'goal-advanced.tsx',{draft:{...goal,bodyFatPercent:65},bodyFatInput:'65'}],
 ['P03-details','app/fitadapt-setup.tsx',setupState],['P03-confirm','app/fitadapt-setup.tsx',{...setupState,step:'confirm'}],['P03-busy','app/fitadapt-setup.tsx',{...setupState,step:'confirm',busy:true}],['P03-invalid','app/fitadapt-setup.tsx',{...setupState,draft:{...setupDraft,age:''},notice:'Enter an age from 18 to 80.'}],
 ['P03-insufficient','app/fitadapt-setup.tsx',{...setupState,saved:true,step:'result',notice:'Your profile and goals are saved. FitAdapt still needs dated weight records. You can continue and review later.'}],['P03-failure','app/fitadapt-setup.tsx',{...setupState,saved:true,step:'result',notice:'Review unavailable. Your saved profile is intact. Retry the review or continue to the app.'}],['P03-pending','app/fitadapt-setup.tsx',{...setupState,plan:{pending:{id:'synthetic'}}}],['P03-accepted','app/fitadapt-setup.tsx',{...setupState,plan:{currentRecommendation:{id:'synthetic'}}}],['P03-loading','app/fitadapt-setup.tsx',{}],['P03-status-error','app/fitadapt-setup.tsx',{...setupState,kindError:true}],
 ['P04-records',mods+'body-metrics.tsx',bodyState],['P04-empty',mods+'body-metrics.tsx',{loading:false,draft:{},original:{}}],['P04-invalid',mods+'body-metrics.tsx',{...bodyState,draft:{...bodyDraft,bodyFatPct:60}}],['P04-loading',mods+'body-metrics.tsx',{}],
 ...['weight','target','height','age','bodyfat','waist','neck','hip'].map(sheet=>['O12-'+sheet,mods+'body-metrics.tsx',{...bodyState,sheet},true]),
 ['O13-discard',mods+'body-metrics.tsx',{...bodyState,discardOpen:true},true],['O14-recalculate',mods+'body-metrics.tsx',{...bodyState,profile:{...profile,activeFitAdaptTargets:accepted},recalcOpen:true,pendingRecalc:{previousWeightKg:82,newWeightKg:80,nextTargetKg:75}},true],
 ['P05-journal',mods+'progress-photos.tsx',photoState],['P05-empty',mods+'progress-photos.tsx',{}],['O20-photo-source',mods+'progress-photos.tsx',{...photoState,pickerOpen:true},true],['O21-photo-review',mods+'progress-photos.tsx',{...photoState,pendingUri:'synthetic:photo-review',note:'Synthetic optional note'},true],['O22-photo-privacy',mods+'progress-photos.tsx',{...photoState,privacyOpen:true},true],['O23-photo-viewer',mods+'progress-photos.tsx',{...photoState,viewerIndex:1},true],
 ...[0,1,2,3,4,5].map(step=>['P06-step-'+step,mods+'weekly-checkin.tsx',{...checkState,step}]),['P06-empty-history',mods+'weekly-checkin.tsx',{step:5}],
 ['P07-steps',pages+'steps-history.tsx',{range:7,ownedProfile:{uid:'synthetic-profile-11',value:profile}}],['P07-empty',pages+'steps-history.tsx',{ownedProfile:{uid:'synthetic-profile-11',value:{}}}],['P07-loading',pages+'steps-history.tsx',{}],['P07-unavailable',pages+'steps-history.tsx',{ownedProfile:{uid:'synthetic-profile-11',value:null}}],
 ['P08-insights',pages+'insights-progress.tsx',progress],['P08-empty',pages+'insights-progress.tsx',{}],['O26-chart',pages+'insights-progress.tsx',{...progress,expanded:'weight'},true],['O27-badge',pages+'insights-progress.tsx',{...progress,badgeId:'first_workout'},true],['O28-share',pages+'insights-progress.tsx',{...progress,shareOpen:true},true],
 ['P09-longterm',mods+'long-term-progress.tsx',longterm],['P09-empty',mods+'long-term-progress.tsx',{}],['O19-records',mods+'long-term-progress.tsx',{...longterm,focused:true},true],
 ...['calories','protein','macros','weight','performance','hydration','activity','projection'].flatMap(desk=>[['P10-'+desk,pages+'advanced-metrics.tsx',{...progress,desk}],['P10-'+desk+'-empty',pages+'advanced-metrics.tsx',{desk}]]),
 ['P11-trends',pages+'fitadapt-insights.tsx',fitState],['P11-hidden',pages+'fitadapt-insights.tsx',{...fitState,hidden:true}],['P11-history',pages+'fitadapt-insights.tsx',{...fitState,section:'decisions'}],['P11-history-error',pages+'fitadapt-insights.tsx',{...fitState,section:'decisions',historyError:true}],['P11-history-loading',pages+'fitadapt-insights.tsx',{...fitState,events:[],section:'decisions',historyBusy:true}],['P11-empty',pages+'fitadapt-insights.tsx',{...fitState,weights:[],foods:[],events:[]}],['P11-empty-history',pages+'fitadapt-insights.tsx',{...fitState,section:'decisions',events:[]}],
];
function renderCase(scenario,{dark=true,width=390,fontScale=1,sourceRoot,flowOverrides={}}={}){
 const [name,route,states,modalOnly]=scenario;
 const f={validateNativeText:true,states,...flowOverrides};
 const runtime=createRuntime({dark,width,fontScale,sourceRoot,account:{uid:'synthetic-profile-11'},profileFlow:f});
 if(name==='O27-badge') f.states={...states,badgeId:runtime.load('services/badges/registry.ts').BADGES[0].id};
 let result=runtime.render(runtime.load(route).default);
 if(modalOnly){const modal=runtime.modals[0];if(!modal)throw Error('Missing modal: '+name);const a=runtime.load('components/designPreview/Appearance.tsx');result=runtime.render(()=>React.createElement(sourceRoot?a.SomataHomeAppearance:a.SomataTaskAppearance,null,modal.children));}
 return {...result,runtime};
}
exports.scenarios=scenarios;exports.renderCase=renderCase;exports.fixtures={goal,targets,accepted,profile,goalState,setupDraft,setupState,bodyDraft,bodyState,history,photos,photoState,stats,checkState,progress,longterm,events,fitState};

if(require.main===module){
 const index=process.argv.indexOf('--before-root'),beforeRoot=index<0?null:process.argv[index+1];
 const out=path.join(root,'review/branding-11');fs.mkdirSync(out,{recursive:true});const entries=[];
 const refreshAt=process.argv.indexOf('--refresh');const refresh=refreshAt<0?null:process.argv[refreshAt+1].split(',');
 const narrow=['P01-goals','P03-confirm','P04-records','O12-height','O13-discard','P05-journal','P06-step-2','P07-steps','P08-insights','P09-longterm','P10-weight','P10-projection','P11-history'];
 for(const scenario of scenarios)for(const dark of [true,false])for(const fontScale of narrow.includes(scenario[0])?[1,1.8]:[1])for(const version of beforeRoot&&fontScale===1?['before','after']:['after']){
  if(refresh&&!refresh.includes(scenario[0]))continue;
  const width=fontScale===1?390:320;const {body,styles,runtime}=renderCase(scenario,{dark,width,fontScale,sourceRoot:version==='before'?beforeRoot:undefined});
  const file=`${version}-${dark?'dark':'light'}-${scenario[0]}-${fontScale===1?'normal':'large'}.html`;
  fs.writeFileSync(path.join(out,file),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11 · ${scenario[0]}</title>${styles}<style>@font-face{font-family:Ionicons;src:url('../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}*{box-sizing:border-box}html,body{margin:0;background:${runtime.tokens.surface.canvas}}body{width:${width}px;max-width:100%;margin:auto}#root{display:flex;flex-direction:column;min-height:100vh;width:100%}.fixture{font:11px/1.5 system-ui;padding:8px 12px;background:#F4F3EE;color:#0B0E12}</style><div class="fixture">${version.toUpperCase()} · SYNTHETIC OFFLINE · ${scenario[0]} · ${width}px / ${fontScale}× text</div><div id="root">${body}</div></html>`);
  entries.push({name:scenario[0],route:scenario[1],file,dark,width,fontScale,version});
 }
 if(refresh&&fs.existsSync(path.join(out,'manifest.json')))entries.push(...JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))).entries.filter(e=>!refresh.includes(e.name)));
 const css='<style>body{font:16px/1.6 system-ui;margin:24px;background:#F4F3EE;color:#0B0E12}a{color:#A83800}main,.pair{display:flex;gap:20px;flex-wrap:wrap}section{padding:16px;border:1px solid #CDD3D8;border-radius:18px;background:white}iframe{width:390px;max-width:100%;height:760px;border:0}h2{font-size:18px}</style>';
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<h1>Profile / Checkpoint 11</h1><p>Actual screen JSX with synthetic fixtures and inert actions. No Firebase or paid AI requests. Photo areas are neutral synthetic placeholders, not user photographs. Native keyboard, focus, persistence, haptics and media still require a device. Large text scales Text approximately, not native TextInput. Charts use synthetic dated records and the existing calculations.</p><p><a href="comparisons.html">Before / after</a> · <a href="IMPLEMENTATION_INDEX.md">Implementation report</a></p><main>${entries.filter(e=>e.version==='after').map(e=>`<section><h2>${e.name} · ${e.dark?'Dark':'Light'} · ${e.fontScale}×</h2><a href="${e.file}">Full page</a><br><iframe loading="lazy" title="${e.file}" src="${e.file}"></iframe></section>`).join('')}</main>`);
 fs.writeFileSync(path.join(out,'comparisons.html'),`<!doctype html><html lang="en"><meta charset="utf-8">${css}<h1>Profile / before and after</h1><p>Synthetic browser previews, not native screenshots. <a href="index.html">All states</a></p>${entries.filter(e=>e.version==='before').map(e=>`<h2>${e.name} · ${e.dark?'Dark':'Light'}</h2><div class="pair">${['before','after'].map(v=>`<section><a href="${e.file.replace('before-',v+'-')}">${v}</a><br><iframe loading="lazy" title="${v}-${e.name}" src="${e.file.replace('before-',v+'-')}"></iframe></section>`).join('')}</div>`).join('')}`);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({synthetic:true,native:false,entries},null,2));console.log('Generated '+entries.length+' Profile state previews.');
}
