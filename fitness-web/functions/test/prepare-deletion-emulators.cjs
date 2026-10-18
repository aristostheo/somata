/** Synthetic, isolated account-deletion package; never deploy this directory. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'somata-deletion-')),source=path.resolve(__dirname,'..'),dest=path.join(root,'functions');
fs.mkdirSync(path.join(dest,'lib'),{recursive:true});
for(const name of ['account','friends']) fs.cpSync(path.join(source,'lib',name),path.join(dest,'lib',name),{recursive:true});
fs.copyFileSync(path.join(source,'package.json'),path.join(dest,'package.json'));
fs.copyFileSync(path.join(source,'lib/deployment.js'),path.join(dest,'lib/deployment.js'));
fs.symlinkSync(path.join(source,'node_modules'),path.join(dest,'node_modules'),'dir');
fs.writeFileSync(path.join(dest,'lib/index.js'),'require("firebase-admin/app").initializeApp({projectId:"demo-somata-fitadapt",storageBucket:"demo-somata-fitadapt.appspot.com"});\nObject.assign(exports,require("./account/function"),require("./friends/function"));\n');
fs.copyFileSync(path.join(source,'../firestore.rules'),path.join(root,'firestore.rules'));
fs.copyFileSync(path.join(source,'../storage.rules'),path.join(root,'storage.rules'));
fs.writeFileSync(path.join(root,'firebase.json'),JSON.stringify({functions:{source:'functions'},firestore:{rules:'firestore.rules'},storage:{rules:'storage.rules'},emulators:{auth:{host:'127.0.0.1',port:9099},firestore:{host:'127.0.0.1',port:8080},functions:{host:'127.0.0.1',port:5001},storage:{host:'127.0.0.1',port:9199},ui:{enabled:false}}},null,2));
fs.writeFileSync(path.join(root,'LOCAL_TEST_ONLY'),'Do not deploy. Synthetic demo accounts only.\n');console.log(root);
