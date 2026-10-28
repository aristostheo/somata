// Local synthetic review only. Start an isolated headless Chrome on port 9322.
// Uses Node 22 WebSocket; no dependency install or cloud access.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'review/branding-13');
(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9322/json')).json();const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(ok=>ws.onopen=ok);let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [resolve,reject]=pending.get(m.id)||[];pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}));});
 await call('Page.enable');const checks=[],captured=new Set();
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
 for(const e of manifest.entries.filter(e=>e.version==='after')){
  await call('Emulation.setDeviceMetricsOverride',{width:e.width,height:844,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'file://'+path.join(out,e.file)});
  await new Promise(ok=>setTimeout(ok,100));
  await call('Runtime.evaluate',{expression:'document.fonts.ready',awaitPromise:true});
  const {result}=await call('Runtime.evaluate',{returnByValue:true,expression:`JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,over:[...document.querySelectorAll('#root *')].filter(e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);let a=e.parentElement,scrolls=false;while(a&&a.id!=='root'){if(['auto','scroll'].includes(getComputedStyle(a).overflowX)){scrolls=true;break;}a=a.parentElement;}return r.width>0&&(r.right>innerWidth+2||r.left< -2)&&s.position!=='absolute'&&!scrolls&&e.textContent.trim()&&!e.closest('svg')}).slice(0,5).map(e=>({text:e.textContent.slice(0,70),width:e.getBoundingClientRect().width}))})`});
  const layout=JSON.parse(result.value);const captureKey=e.id+'-'+e.dark; const shouldCapture=!captured.has(captureKey)||e.name==='preparation-error'; let file=null; if(shouldCapture){ captured.add(captureKey); const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:e.width,height:Math.min(layout.height,32000),scale:1}});
  file=e.file.replace('.html','.png');fs.writeFileSync(path.join(out,file),Buffer.from(data,'base64')); } checks.push({...e,png:file,...layout,truncated:layout.height>32000});
 }
 fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({synthetic:true,native:false,checks},null,2));
 console.log(JSON.stringify({pages:checks.length,captures:checks.filter(x=>x.png).length,documentOverflows:checks.filter(x=>x.scroll>x.width+2).map(x=>x.file),contentOverflows:checks.filter(x=>x.over.length).map(x=>({file:x.file,over:x.over}))}));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
