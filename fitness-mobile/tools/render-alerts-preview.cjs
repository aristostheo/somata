// Offline actual-screen rendering. Synthetic inbox fixtures only; no Firebase/effects/storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRuntime}=require('./home-preview-runtime.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'review/branding-7');
fs.mkdirSync(out,{recursive:true});
const rows=[
 {id:'friend',type:'friend:accepted',title:'A friend accepted your request',body:'A synthetic connection update for visual review.',readAt:null},
 {id:'ping',type:'ping',title:'A friend pinged you',body:'A synthetic nudge for visual review.',data:{fromUid:'synthetic-friend'},readAt:1},
 {id:'workout',type:'info',title:'Workout recorded',body:'A synthetic workout alert. Actual messages come from your account.',readAt:null},
 {id:'nutrition',type:'info',title:'Nutrition update',body:'A synthetic nutrition alert for layout review.',readAt:1},
 {id:'streak',type:'info',title:'A recorded streak milestone',body:'A synthetic milestone for layout review, not a real achievement.',readAt:null},
 {id:'coach',type:'info',title:'Your summary is ready',body:'A synthetic summary alert for layout review.',readAt:1},
 {id:'sync',type:'info',title:'Sync failed — reconnect',body:'A synthetic connection error for visual review.',readAt:null},
].map((r,i)=>({...r,createdAtMs:Date.UTC(2026,9,18-i,15)}));
const scenarios=['All','Friends','Workouts','Nutrition','Streaks','Coach','empty','category-empty','loading','error','read','busy','large-text','long-text','signed-out'];
const pages=[];
for(const dark of [true,false])for(const scenario of scenarios){
 const category=['All','Friends','Workouts','Nutrition','Streaks','Coach'].includes(scenario)?scenario:'All';
 const width=scenario==='large-text'?320:430;
 const notifications={rows,filter:category};
 if(scenario==='empty'||scenario==='category-empty')notifications.rows=[];
 if(scenario==='category-empty')notifications.filter='Nutrition';
 if(scenario==='loading'||scenario==='signed-out')notifications.rows=null;
 if(scenario==='error'){notifications.rows=[];notifications.error=true;}
 if(scenario==='busy')notifications.busy=true;
 if(scenario==='read')notifications.rows=rows.map(r=>({...r,readAt:1}));
 if(scenario==='long-text')notifications.rows=[{...rows[0],title:'A long synthetic notification title for responsive layout review. '.repeat(3),body:'Recorded text must remain readable without truncating the message. '.repeat(5)}];
 const r=createRuntime({dark,width,fontScale:scenario==='large-text'?1.8:1,account:{uid:scenario==='signed-out'?null:'synthetic-owner'},notifications});
 const {body,styles}=r.notificationsPreview();
 const name=`alerts-${dark?'dark':'light'}-${scenario.toLowerCase()}.html`;
 const font=path.relative(out,require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
 assert(fs.statSync(path.resolve(out,font)).size>0);
 fs.writeFileSync(path.join(out,name),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alerts · synthetic ${scenario}</title>${styles}<style>@font-face{font-family:Ionicons;src:url("${font}")}html,body,#root{margin:0;min-height:100%}body{width:${width}px;max-width:100%;background:${r.tokens.surface.canvas}}#root{display:flex;flex-direction:column;width:100%}</style><div id="root">${body}</div><script>function positionFilter(){const tab=document.querySelector('[role="tab"][aria-label="${notifications.filter} alerts"]');if(!tab)return;let scroller=tab.parentElement;while(scroller&&!(scroller.scrollWidth>scroller.clientWidth&&['auto','scroll'].includes(getComputedStyle(scroller).overflowX)))scroller=scroller.parentElement;if(scroller)scroller.scrollLeft+=tab.getBoundingClientRect().left-scroller.getBoundingClientRect().left-8;window.scrollTo(0,0);}document.fonts.ready.then(positionFilter);window.addEventListener('load',positionFilter);</script></html>`);
 pages.push({name,scenario,dark,width});
}
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alerts · Checkpoint 7 review</title><style>body{padding:24px;background:#e8ebed;color:#0B0E12;font:16px/1.5 system-ui}main{display:flex;flex-wrap:wrap;gap:24px}iframe{height:1000px;border:1px solid #73808B;border-radius:20px;max-width:100%}h2{font-size:18px}</style><h1>Premium Alerts · offline review</h1><p>Actual Alerts JSX with explicitly synthetic inbox records, not real events or generated recommendations. No real users, Firebase, subscriptions, native notifications or storage. Actions are inert. Browser rendering approximates native layout and text scaling; safe insets are zero. Virtualized rows are all rendered in this offline adapter for review. The unchanged tab layout is rendered statically; its live badge is not simulated.</p><main>${pages.map(p=>`<section><h2>${p.dark?'Dark':'Light'} · ${p.scenario}</h2><a href="${p.name}">Open full page</a><p><iframe title="${p.name}" src="${p.name}" width="${p.width}"></iframe></p></section>`).join('')}</main>`);
console.log(`PASS: ${pages.length} actual-screen previews; Ionicons font resolves; decoration uses installed native SVG/gradient components with no new raster assets.`);
