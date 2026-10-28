const fs=require('node:fs'),path=require('node:path'),React=require('react');
const {createRuntime}=require('./home-preview-runtime.cjs');
const root=path.resolve(__dirname,'..'), date='2026-10-19', start=Date.parse(date+'T11:30:00');
const item={id:'synthetic-set',exercise:'Dumbbell bench press',sets:1,reps:10,weightKg:20,primaryMuscle:'chest',createdAt:start,done:false};
const draft={id:'synthetic-session',title:'Synthetic upper body',dateISO:date,startedAt:start,updatedAt:start,items:[item,{...item,id:'synthetic-set-2',done:true}]};
const rows=draft.items.map((x,i)=>({...x,weight:x.weightKg,id:'synthetic-row-'+i,date,sessionId:draft.id,sessionTitle:draft.title,sessionStartedAt:start,sessionFinishedAt:start+1800000,setCreatedAt:start+i*60000}));
const template={id:'synthetic-template',name:'Synthetic upper strength',emoji:'💪',tags:['Strength'],items:[{exercise:item.exercise,sets:3,reps:10,weightKg:20}]};
const exercise={id:'synthetic-exercise',name:'Dumbbell bench press',primaryMuscles:['chest'],secondaryMuscles:['triceps'],equipment:['dumbbell'],instructions:['Lie back with your feet planted.','Press the weights upwards with control.'],images:{}};
const generated={name:'Synthetic upper body',tagline:'Offline layout fixture',duration:30,difficulty:'Moderate',estimatedCalories:150,warmup:[{exercise:'Shoulder circles',duration:'2 min'}],exercises:[{name:'Dumbbell bench press',sets:3,reps:'8-10',rest:'60 sec',weight:'Choose a comfortable load',muscleGroup:'Chest',notes:'Synthetic instruction',alternatives:['Push-up','Floor press']}],cooldown:[{exercise:'Gentle chest stretch',duration:'2 min'}],coachNote:'Synthetic provider result for layout only.'};
const activity={id:'synthetic-activity',type:'walk',minutes:20,intensity:'moderate',createdAt:start};
const noop=()=>{},mods='app/(modals)/',work='app/workouts/';
const base={draft,profile:{weightUnit:'kg'},presets:[]};
const scenarios=[
 ['W01-long-name',work+'session.tsx',{...base,draft:{...draft,title:'Synthetic strength and mobility session for a long training name',items:[{...item,exercise:'Synthetic single-arm alternating dumbbell bench press with controlled tempo'}]}}],
 ['W03-long-name',work+'templates.tsx',{templates:[{...template,name:'Synthetic strength and mobility routine with a deliberately long saved name'}]}],
 ['O15-media',mods+'browse.tsx',{items:[exercise],preview:{...exercise,images:{gif:'synthetic-media-not-loaded'}},previewOpen:true},null,true],
 ['O15-no-instructions',mods+'browse.tsx',{items:[exercise],preview:{...exercise,instructions:[]},previewOpen:true},null,true],
 ['W01-active',work+'session.tsx',base],['W01-empty',work+'session.tsx',{...base,draft:{...draft,items:[]}}],['W01-loading',work+'session.tsx',{}],['W01-finishing',work+'session.tsx',{...base,isFinishing:true}],
 ['O37-title',work+'session.tsx',{...base,titleOpen:true,titleDraft:'Synthetic upper body'},null,true],
 ['O38-set',work+'session.tsx',{...base,edit:{open:true,itemId:item.id,exercise:item.exercise,primaryMuscle:'chest',reps:'10',weight:'20',note:'Synthetic note',done:false}},null,true],
 ['W02-search',mods+'browse.tsx',{items:[exercise],query:'bench'}],['W02-empty',mods+'browse.tsx',{items:[],query:'no match'}],['W02-favorites',mods+'browse.tsx',{items:[exercise],favorites:new Set([exercise.id]),scope:'favorites'}],
 ['O15-preview',mods+'browse.tsx',{items:[exercise],preview:exercise,previewOpen:true},null,true],
 ['W03-library',work+'templates.tsx',{templates:[template,{...template,id:'synthetic-archive',name:'Synthetic archive',archived:true}]}],['W03-empty',work+'templates.tsx',{}],
 ['W04-create',mods+'create-template.tsx',{name:'Synthetic strength',items:template.items}],
 ['O17-add',mods+'create-template.tsx',{name:'Synthetic strength',items:template.items,addOpen:true,exName:'Squat'},null,true],
 ['W10-save',mods+'save-workout-as-templates.tsx',{workouts:rows}],
 ['W07-history',work+'history.tsx',{workouts:rows,loading:false}],['W07-empty',work+'history.tsx',{loading:false}],['W07-loading',work+'history.tsx',{}],
 ['O35-month',work+'history.tsx',{workouts:rows,loading:false,monthPickerOpen:true},null,true],
 ['O36-dates',work+'history.tsx',{workouts:rows,loading:false,customOpen:true},null,true],
 ['O36-invalid',work+'history.tsx',{loading:false,customOpen:true,err:'Use YYYY-MM-DD for both dates.'},null,true],
 ['W08-recap',work+'recap.tsx',{allRows:rows,notesExpanded:true,note:'Synthetic session note'}],['W08-missing',work+'recap.tsx',{}],
 ['W09-detail',work+'session-detail.tsx',{rows,profile:{weightUnit:'lb'}}],['W09-deleting',work+'session-detail.tsx',{rows,deleting:true}],
 ['W05-quick',mods+'quick-workout.tsx',{exercises:[{id:'synthetic-exercise',name:item.exercise,sets:[{id:'qset',reps:10,weight:20}],notes:'Synthetic note'}]}],['W05-empty',mods+'quick-workout.tsx',{}],
 ['O02-plan','app/(tabs)/workouts.tsx',{rows:[],templates:[],activities:[],configOpen:true,configTitle:'Synthetic plan'},null,true],
 ['O03-quick','components/activity/ActivityLogSheet.tsx',{}, {visible:true,onClose:noop,onCreate:noop,onUpdate:noop,onDelete:noop},true],
 ['O03-manual','components/activity/ActivityLogSheet.tsx',{tab:'log'},{visible:true,onClose:noop,onCreate:noop,onUpdate:noop,onDelete:noop},true],
 ['O03-edit','components/activity/ActivityLogSheet.tsx',{tab:'log',minutes:'20'},{visible:true,editing:activity,onClose:noop,onCreate:noop,onUpdate:noop,onDelete:noop},true],
 ['W06-quick',mods+'coach-spark.tsx',{}],['W06-custom',mods+'coach-spark.tsx',{mode:'custom'}],['W06-loading',mods+'coach-spark.tsx',{loading:true}],['W06-error',mods+'coach-spark.tsx',{error:'Synthetic service limit. Please try again later.'}],
 ['W06-review',mods+'coach-spark.tsx',{generated,warmupOpen:true,cooldownOpen:true}],
 ['W06-archive',mods+'coach-spark.tsx',{history:[{id:'synthetic-history',createdAt:start,workout:generated}]}],
 ['O16-swap',mods+'coach-spark.tsx',{generated,swapExercise:generated.exercises[0]},null,true],
 ['W11-cardio',mods+'quick-cardio.tsx',{}],['W12-strength',mods+'quick-strength.tsx',{}],['W13-mobility',mods+'quick-mobility.tsx',{}],
];
function renderCase(scenario,{dark=true,width=390,fontScale=1,sourceRoot,flowOverrides={}}={}){
 const [name,route,states,props,modalOnly]=scenario;
 const f={validateNativeText:true,params:{sessionKey:'session:'+draft.id,defaultName:'Synthetic upper body'},states,...flowOverrides};
 const runtime=createRuntime({dark,width,fontScale,sourceRoot,account:{uid:'synthetic-workout-10'},workoutFlow:f});
 let result=runtime.render(runtime.load(route).default,props||{});
 if(modalOnly){const modal=runtime.modals[0];if(!modal)throw Error('Missing modal: '+name);const appearance=runtime.load('components/designPreview/Appearance.tsx');const Scope=sourceRoot?appearance.SomataHomeAppearance:appearance.SomataTaskAppearance;result=runtime.render(()=>React.createElement(Scope,null,modal.children));}
 return {...result,runtime};
}
exports.scenarios=scenarios;exports.renderCase=renderCase;exports.fixtures={date,item,draft,rows,template,exercise,generated,activity};
if(require.main===module){
 const index=process.argv.indexOf('--before-root'),beforeRoot=index<0?null:process.argv[index+1];
 const out=path.join(root,'review/branding-10');fs.mkdirSync(out,{recursive:true});const entries=[];
 const narrow=['W01-long-name','W03-long-name','W01-active','O38-set','W02-search','W04-create','W07-history','W08-recap','W05-quick','O03-manual','W06-review'];
 for(const scenario of scenarios)for(const dark of [true,false])for(const fontScale of narrow.includes(scenario[0])?[1,1.8]:[1])for(const version of beforeRoot&&fontScale===1?['before','after']:['after']){
  const width=fontScale===1?390:320;const {body,styles,runtime}=renderCase(scenario,{dark,width,fontScale,sourceRoot:version==='before'?beforeRoot:undefined});
  const file=`${version}-${dark?'dark':'light'}-${scenario[0]}-${fontScale===1?'normal':'large'}.html`;
  fs.writeFileSync(path.join(out,file),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>10 · ${scenario[0]}</title>${styles}<style>@font-face{font-family:Ionicons;src:url('../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}*{box-sizing:border-box}html,body{margin:0;background:${runtime.tokens.surface.canvas}}body{width:${width}px;max-width:100%;margin:auto}#root{display:flex;flex-direction:column;min-height:100vh;width:100%}.fixture{font:11px/1.5 system-ui;padding:8px 12px;background:#F4F3EE;color:#0B0E12}</style><div class="fixture">${version.toUpperCase()} · SYNTHETIC OFFLINE · ${scenario[0]} · ${width}px / ${fontScale}× text</div><div id="root">${body}</div></html>`);
  entries.push({name:scenario[0],route:scenario[1],file,dark,width,fontScale,version});
 }
 const css='<style>body{font:16px/1.6 system-ui;margin:24px;background:#F4F3EE;color:#0B0E12}a{color:#A83800}main,.pair{display:flex;gap:20px;flex-wrap:wrap}section{padding:16px;border:1px solid #CDD3D8;border-radius:18px;background:white}iframe{width:390px;max-width:100%;height:760px;border:0}h2{font-size:18px}</style>';
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<h1>Workouts / Checkpoint 10</h1><p>Actual screen JSX with synthetic fixtures and inert actions. No Firebase or paid AI requests. Body diagrams use the installed library. Native keyboard, focus, persistence, haptics and media still require a device. Large text scales Text approximately, not native TextInput. Direct-link forms remain direct-link only.</p><p><a href="comparisons.html">Before / after</a> · <a href="IMPLEMENTATION_INDEX.md">Implementation report</a></p><main>${entries.filter(e=>e.version==='after').map(e=>`<section><h2>${e.name} · ${e.dark?'Dark':'Light'} · ${e.fontScale}×</h2><a href="${e.file}">Full page</a><br><iframe loading="lazy" title="${e.file}" src="${e.file}"></iframe></section>`).join('')}</main>`);
 fs.writeFileSync(path.join(out,'comparisons.html'),`<!doctype html><html lang="en"><meta charset="utf-8">${css}<h1>Workouts / before and after</h1><p>Synthetic browser previews, not native screenshots. <a href="index.html">All states</a></p>${entries.filter(e=>e.version==='before').map(e=>`<h2>${e.name} · ${e.dark?'Dark':'Light'}</h2><div class="pair">${['before','after'].map(v=>`<section><a href="${e.file.replace('before-',v+'-')}">${v}</a><br><iframe loading="lazy" title="${v}-${e.name}" src="${e.file.replace('before-',v+'-')}"></iframe></section>`).join('')}</div>`).join('')}`);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({synthetic:true,native:false,entries},null,2));console.log('Generated '+entries.length+' Workout state previews.');
}
