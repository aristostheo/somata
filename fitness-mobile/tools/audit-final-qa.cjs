// Source evidence and preservation gate. No cloud, user records, or configuration loading.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),repo=path.dirname(root),out=path.join(root,'review/branding-13');
const registry=fs.readFileSync(path.join(root,'SOMATA_SCREEN_REGISTRY.md'),'utf8');
const records=[];
for(const m of registry.matchAll(/^### ([A-Z]\d{2}) — (.+)\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)){
 const [_,id,title,record]=m;const sources=[...record.matchAll(/`((?:app|content|components)\/[^`]+\.tsx?)`/g)].map(x=>x[1]);
 records.push({id,title,sources:[...new Set(sources)],verification:record.match(/\*\*Verify:\*\* (.+)/)?.[1]||'V0'});
}
for(const line of registry.split('\n').filter(l=>/^\| O\d{2} —/.test(l))){const cols=line.split('|').map(x=>x.trim());const [id,title]=cols[1].split(' — ');records.push({id,title,sources:[...cols[2].matchAll(/`([^`]+)`/g)].map(x=>x[1]),verification:cols[3]});}
assert.equal(records.length,98);assert.equal(new Set(records.map(r=>r.id)).size,98);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const sourceInventory={};
for(const r of records){
 r.previews=manifest.entries.filter(e=>e.id===r.id).map(e=>e.file);assert(r.previews.length>=2,r.id+' has no both-mode preview');
 for(const f of r.sources){assert(fs.existsSync(path.join(root,f)),f);const s=fs.readFileSync(path.join(root,f),'utf8');
  sourceInventory[f]={sha256:crypto.createHash('sha256').update(s).digest('hex'),lines:s.split('\n').length,
    imports:[...s.matchAll(/from ["']([^"']+)["']/g)].map(x=>x[1]),
    handlers:[...s.matchAll(/\b(onPress|onSave|onDelete|onClose|onChangeText|onRequestClose)=\{([^\n]+)/g)].map(x=>x[0].slice(0,160)),
    stateLines:s.split('\n').flatMap((l,i)=>/loading|error|failed|busy|empty|private|unavailable/i.test(l)?[{line:i+1,text:l.trim().slice(0,160)}]:[])};
 }
}
const navigation=[];
for(const line of registry.split('\n').filter(l=>/^\| `app\//.test(l))){const file=line.match(/`([^`]+)`/)[1],source=fs.readFileSync(path.join(root,file),'utf8');navigation.push({file,expected:line.split('|')[2].trim(),source});}
assert.equal(navigation.length,30);
const audit={date:'2026-10-28',evidence:'Static source inventory + synthetic current-source render, not live/native verification',records,sourceInventory,navigation};
fs.writeFileSync(path.join(out,'source-audit.json'),JSON.stringify(audit,null,2));
// Existing effect callbacks are preserved exactly, including secure revision/retry logic.
const snapshots=process.argv[3]||'/tmp/somata-checkpoint13-before';
const effects=s=>{const a=ts.createSourceFile('file.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),v=[];function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(a)==='useEffect')v.push(n.getText(a));ts.forEachChild(n,visit);}visit(a);return v;};
for(const f of ['app/_layout.tsx','content/AuthContext.tsx'])assert.deepEqual(effects(fs.readFileSync(path.join(root,f),'utf8')),effects(fs.readFileSync(path.join(snapshots,f),'utf8')),f+' effects changed');
const baseline=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/somata-checkpoint13-baseline.json'));
const allowed=new Set(['fitness-mobile/app/_layout.tsx','fitness-mobile/content/AuthContext.tsx','fitness-mobile/app/+not-found.tsx','fitness-mobile/components/somata/TaskUI.tsx']);
const changed=[],missing=[];
for(const [f,hash]of Object.entries(baseline)){const p=path.join(repo,f);if(!fs.existsSync(p)){missing.push(f);continue;}if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==hash)changed.push(f);}
assert.deepEqual(missing,[]);assert.deepEqual(changed.filter(f=>!allowed.has(f)),[],'Unrelated existing files changed');
const preservation={baselineFiles:Object.keys(baseline).length,changedExistingFiles:changed,missing,effectCallbacksUnchanged:true,
 protected:'All other baseline files byte-identical: five tabs, auth forms, services, FitAdapt, rules, configuration, artwork, previous review packages and existing logs.'};
fs.writeFileSync(path.join(out,'preservation.json'),JSON.stringify(preservation,null,2));
console.log(JSON.stringify({surfaces:records.length,sourceFiles:Object.keys(sourceInventory).length,routingEntriesAndLayouts:navigation.length,...preservation},null,2));
