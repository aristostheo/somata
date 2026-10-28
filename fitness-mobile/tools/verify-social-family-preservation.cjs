const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),baseline=process.argv[2];
if(!baseline)throw Error('Pass the pre-checkpoint SHA-256 manifest; never infer a baseline after editing.');
const before=JSON.parse(fs.readFileSync(baseline));
const allowed=new Set([
'app/friends.tsx','app/friends/[id].tsx','app/friends/[id]/profile.tsx','app/friends/[id]/progress.tsx','app/friends/[id]/workouts.tsx','app/friends/preview.tsx','app/profile/friend-visibility.tsx','app/profile/integrations.tsx','app/(modals)/badges.tsx','app/(modals)/settings.tsx','app/(modals)/theme-editor.tsx','app/account/index.tsx','app/account/delete.tsx','app/account/legal.tsx','app/paywall.tsx','components/friends/SharedSummary.tsx','components/friends/premium/FriendsAddSheet.tsx','components/homeFlows/BadgeCollection.tsx','components/somata/ConnectionsDesk.tsx','tools/home-preview-runtime.cjs','tests/sdk58ThemeNavigation.test.ts'
].map(f=>'fitness-mobile/'+f));
const changed=[],unexpected=[],missing=[];
for(const [f,hash]of Object.entries(before)){
 const p=path.join(root,f);if(!fs.existsSync(p)){missing.push(f);continue;}
 if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==hash){changed.push(f);if(!allowed.has(f))unexpected.push(f);}
}
assert.deepEqual(missing,[],'Pre-existing files removed');assert.deepEqual(unexpected,[],'Unrelated baseline files changed');
const result={baselineFiles:Object.keys(before).length,changedExistingFiles:changed,unexpected,missing,protected:'All remaining baseline files, including source/processed artwork, five tabs, services, rules, config, prior galleries and debug logs, remain byte-identical.'};
fs.writeFileSync(path.join(root,'fitness-mobile/review/branding-12/preservation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
