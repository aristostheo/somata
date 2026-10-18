/** Isolated local test package. Same production friend handlers; no secrets or other Functions. */
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'somata-friends-emulator-'));
const source = path.resolve(__dirname,'..'), dest = path.join(root,'functions');
fs.mkdirSync(path.join(dest,'lib'),{recursive:true});
fs.cpSync(path.join(source,'lib/friends'),path.join(dest,'lib/friends'),{recursive:true});
fs.cpSync(path.join(source, 'lib/account'), path.join(dest, 'lib/account'), { recursive: true });
fs.copyFileSync(path.join(source,'package.json'),path.join(dest,'package.json'));
fs.copyFileSync(path.join(source,'lib/deployment.js'),path.join(dest,'lib/deployment.js'));
fs.symlinkSync(path.join(source,'node_modules'),path.join(dest,'node_modules'),'dir');
fs.writeFileSync(path.join(dest,'lib/index.js'),'Object.assign(exports, require("./friends/function"));\n');
fs.copyFileSync(path.join(source,'../firestore.rules'),path.join(root,'firestore.rules'));
fs.writeFileSync(path.join(root,'firebase.json'),JSON.stringify({functions:{source:'functions'},firestore:{rules:'firestore.rules'},emulators:{
  auth:{host:'127.0.0.1',port:9099},firestore:{host:'127.0.0.1',port:8080},functions:{host:'127.0.0.1',port:5001},ui:{enabled:false}}},null,2));
fs.writeFileSync(path.join(root,'LOCAL_TEST_ONLY'),'Do not deploy this synthetic test package.\n');
console.log(root);
