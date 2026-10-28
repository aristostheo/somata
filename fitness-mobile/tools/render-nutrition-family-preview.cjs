const fs=require('node:fs'),path=require('node:path'),React=require('react');
const {createRuntime}=require('./home-preview-runtime.cjs');
const root=path.resolve(__dirname,'..');
const date='2026-10-19';
const food={id:'synthetic-food',name:'Synthetic grain bowl',qty:1,unit:'serving',calories:520,protein:30,carbs:62,fat:16,date,meal:'lunch',source:'manual'};
const scanned={id:'synthetic-scan',name:'Synthetic grain bowl',confidence:'medium',portion:{amount:1,unit:'piece',multiplier:1},macros:{calories:520,protein:30,carbs:62,fat:16},rationale:'Synthetic fixture only'};
const edits={...food,qty:'1',calories:'520',protein:'30',carbs:'62',fat:'16',sugar:'',fiber:'',_baseQty:'1',_baseCalories:'520',_baseProtein:'30',_baseCarbs:'62',_baseFat:'16'};
const item={...food,baseQty:1,baseCalories:520,baseProtein:30,baseCarbs:62,baseFat:16};
const mods='app/(modals)/',scan='app/nutrition/',sheets='components/scanMeal/new/';
const noop=()=>{};
const scenarios=[
 ['N01-search',mods+'add-meal.tsx',{tab:'search',q:'grain',results:[food]}],
 ['N01-empty',mods+'add-meal.tsx',{tab:'recents'}],
 ['N01-loading',mods+'add-meal.tsx',{tab:'search',q:'grain',searchLoading:true}],
 ['N01-frequent',mods+'add-meal.tsx',{tab:'favorites',topFoods:[food]}],
 ['N01-describe-error',mods+'add-meal.tsx',{tab:'describe',descText:'Synthetic meal description',descError:'Synthetic provider limit: please try again later.'}],
 ['N01-barcode',mods+'add-meal.tsx',{tab:'barcode'}],
 ['N01-manual',mods+'add-meal.tsx',{tab:'manual',name:'Synthetic food'}],
 ['O05-review',mods+'add-meal.tsx',{confirmOpen:true,confirmEdits:edits},null,true],
 ['O06-matches',mods+'add-meal.tsx',{pickOpen:true,candidates:[{name:'Synthetic package',brand:'Preview',unit:'serving',nutrients:{calories:180,protein:0}}]},null,true],
 ['N02-picks',mods+'quick-add.tsx',{recents:[food]}],
 ['N02-empty',mods+'quick-add.tsx',{}],
 ['O07-macros',mods+'quick-add.tsx',{macroOpen:true,quickDraft:{name:'Synthetic entry',calories:'0',protein:'',carbs:'',fat:''}},null,true],
 ['O04-edit', 'components/nutrition/uiNew/EditFoodSheet.tsx',{values:{...edits,meal:'lunch'}},{open:true,item:food,onSave:noop,onClose:noop,onDelete:noop},true],
 ['O04-saving','components/nutrition/uiNew/EditFoodSheet.tsx',{values:{...edits,meal:'lunch'}},{open:true,item:food,onSave:noop,onClose:noop,onDelete:noop,saving:true},true],
 ['N03-capture',scan+'scan-meal.tsx',{}],
 ['N03-review',scan+'scan-meal.tsx',{state:'review',foods:[scanned],photoUri:'synthetic-photo'}],
 ['N03-processing',scan+'scan-meal.tsx',{state:'analyzing'},null,true],
 ['N03-error',scan+'scan-meal.tsx',{toast:{title:'Synthetic scan failed',subtitle:'Please try again.'}}],
 ['N04-capture',scan+'scan-meal-v2.tsx',{}],
 ['N04-review',scan+'scan-meal-v2.tsx',{state:'review',foods:[scanned],photoUri:'synthetic-photo'}],
 ['N04-processing',scan+'scan-meal-v2.tsx',{state:'analyzing'},null,true],
 ['O09-add',sheets+'AddFoodSheet.tsx',{name:'Synthetic missing food',amt:'1'},{visible:true,onClose:noop,onAdd:noop},true],
 ['O09-unknown',sheets+'AddFoodSheet.tsx',{name:'Synthetic missing food',unknownQty:true},{visible:true,onClose:noop,onAdd:noop},true],
 ['O10-edit',sheets+'EditFoodSheet.tsx',{}, {visible:true,food:scanned,onClose:noop,onSave:noop,onRemove:noop},true],
 ['O11-explain',sheets+'ExplainAIModal.tsx',{}, {visible:true,onClose:noop},true],
 ['N05-builder',mods+'meal-builder.tsx',{items:[item],mealName:'Synthetic lunch',recentFoods:[food]}],
 ['N05-empty',mods+'meal-builder.tsx',{}],
 ['N05-transfer-error',mods+'meal-builder.tsx',{handoffNotice:'Synthetic transfer could not be completed.',handoffCanRetry:true}],
 ...['scan','describe','barcode','manual'].map(activeMethod=>['O08-'+activeMethod,mods+'meal-builder.tsx',{activeMethod,describeText:activeMethod==='describe'?'Synthetic description':''},null,true]),
 ['N07-selected',mods+'diet-preferences.tsx',{hydrated:true,prefs:{restrictions:['vegetarian'],allergies:['peanuts'],moreOf:[],avoidLimit:[],likes:['Synthetic favorite'],dislikes:['Synthetic dislike'],notes:''}}],
 ['N07-empty',mods+'diet-preferences.tsx',{hydrated:true}],
 ['N06-ideas',mods+'what-should-i-eat.tsx',{}],
 ['N06-missing',mods+'what-should-i-eat.tsx',{},null,false,{params:{date,meal:'lunch'}}],
 ['N08-water',mods+'quick-hydration.tsx',{}],
 ['N08-busy',mods+'quick-hydration.tsx',{busy:true}],
 ['N08-signed-out',mods+'quick-hydration.tsx',{},null,false,{signedOut:true}],
 ['N09-empty',mods+'ai-meal-suggestions.tsx',{}],
 ['N09-loading',mods+'ai-meal-suggestions.tsx',{loading:true},null,false,{isPro:true}],
 ['N09-ideas',mods+'ai-meal-suggestions.tsx',{ideas:[{...food,difficulty:'easy',prep_min:15,notes:'Synthetic suggestion for layout only.'}]},null,false,{isPro:true}],
];
function renderCase(scenario,{dark=true,width=390,fontScale=1,sourceRoot,flowOverrides={}}={}){
 const [name,route,states,props,modalOnly,extras]=scenario;
 const f={params:{date,meal:'lunch',kcalLeft:'900',proteinLeft:'45',carbsLeft:'100',fatLeft:'30'},states,...extras,...flowOverrides};
 const runtime=createRuntime({dark,width,fontScale,sourceRoot,account:{uid:f.signedOut?null:'synthetic-nutrition-9'},nutritionFlow:f});
 let result=runtime.render(runtime.load(route).default,props||{});
 if(modalOnly){const modal=runtime.modals[0];if(!modal)throw Error('Missing modal: '+name);const appearance=runtime.load('components/designPreview/Appearance.tsx');const Scope=sourceRoot?appearance.SomataHomeAppearance:appearance.SomataTaskAppearance;result=runtime.render(()=>React.createElement(Scope,null,modal.children));}
 return {...result,runtime};
}
exports.scenarios=scenarios;exports.renderCase=renderCase;exports.fixtures={date,food,scanned,edits,item};
if(require.main===module){
 const index=process.argv.indexOf('--before-root'),beforeRoot=index<0?null:process.argv[index+1];
 const out=path.join(root,'review/branding-9');fs.mkdirSync(out,{recursive:true});const entries=[];
 const narrow=['N01-search','O05-review','O04-edit','N03-review','N04-capture','N05-builder','N07-selected','N08-water'];
 for(const scenario of scenarios)for(const dark of [true,false])for(const fontScale of narrow.includes(scenario[0])?[1,1.8]:[1])for(const version of beforeRoot&&fontScale===1?['before','after']:['after']){
  const width=fontScale===1?390:320;const {body,styles,runtime}=renderCase(scenario,{dark,width,fontScale,sourceRoot:version==='before'?beforeRoot:undefined});
  const file=`${version}-${dark?'dark':'light'}-${scenario[0]}-${fontScale===1?'normal':'large'}.html`;
  fs.writeFileSync(path.join(out,file),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>9 · ${scenario[0]}</title>${styles}<style>@font-face{font-family:Ionicons;src:url('../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}*{box-sizing:border-box}html,body{margin:0;background:${runtime.tokens.surface.canvas}}body{width:${width}px;max-width:100%;margin:auto}#root{display:flex;flex-direction:column;min-height:100vh;width:100%}.fixture{font:11px/1.5 system-ui;padding:8px 12px;background:#F4F3EE;color:#0B0E12}</style><div class="fixture">${version.toUpperCase()} · SYNTHETIC OFFLINE · ${scenario[0]} · ${width}px / ${fontScale}× text</div><div id="root">${body}</div></html>`);
  entries.push({name:scenario[0],route:scenario[1],file,dark,width,fontScale,version});
 }
 const css='<style>body{font:16px/1.6 system-ui;margin:24px;background:#F4F3EE;color:#0B0E12}a{color:#A83800}main,.pair{display:flex;gap:20px;flex-wrap:wrap}section{padding:16px;border:1px solid #CDD3D8;border-radius:18px;background:white}iframe{width:390px;max-width:100%;height:760px;border:0}h2{font-size:18px}</style>';
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<h1>Nutrition / Checkpoint 9</h1><p>Actual screen JSX, synthetic fixtures, inert actions. No paid requests or personal data. Camera/photo surfaces are labeled offline placeholders. Native permissions, focus, sheets and keyboard need a device. Missing controller states are documented in the implementation index. O08-scan is a retained internal sheet branch, injected for review only: the working Photo action navigates to scanner v2. Large text scales Text approximately, not native TextInput or accessibility layout. The 8B water control is a historical reference; quick water is intentionally updated here.</p><p><a href="comparisons.html">Before / after</a> · <a href="../branding-8b/index.html">8B regression reference</a> · <a href="../branding-3c/index.html">Home</a> · <a href="../branding-5b/index.html">Workouts</a> · <a href="../branding-4/index.html">Nutrition</a> · <a href="../branding-7/index.html">Alerts</a> · <a href="../branding-6b/index.html">Profile</a> · <a href="IMPLEMENTATION_INDEX.md">Implementation report</a></p><main>${entries.filter(e=>e.version==='after').map(e=>`<section><h2>${e.name} · ${e.dark?'Dark':'Light'} · ${e.fontScale}×</h2><a href="${e.file}">Full page</a><br><iframe loading="lazy" title="${e.file}" src="${e.file}"></iframe></section>`).join('')}</main>`);
 const pairs=entries.filter(e=>e.version==='before');
 fs.writeFileSync(path.join(out,'comparisons.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<h1>Nutrition / before and after</h1><p>Synthetic browser previews, not native screenshots. <a href="index.html">All states</a></p>${pairs.map(e=>`<h2>${e.name} · ${e.dark?'Dark':'Light'}</h2><div class="pair">${['before','after'].map(v=>`<section><a href="${e.file.replace('before-',v+'-')}">${v}</a><br><iframe loading="lazy" title="${v}-${e.name}" src="${e.file.replace('before-',v+'-')}"></iframe></section>`).join('')}</div>`).join('')}`);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({synthetic:true,native:false,entries},null,2));console.log('Generated '+entries.length+' Nutrition state previews.');
}
