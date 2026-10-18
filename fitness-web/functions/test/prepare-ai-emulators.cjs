/** Isolated local package: mocked provider transport, unchanged production handler and validators. Never deploy it. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'somata-ai-emulator-'));
const source = path.resolve(__dirname, '..');
const dest = path.join(root, 'functions');
fs.mkdirSync(path.join(dest, 'lib'), { recursive: true });
fs.cpSync(path.join(source, 'lib/ai'), path.join(dest, 'lib/ai'), { recursive: true });
fs.cpSync(path.join(source, 'lib/account'), path.join(dest, 'lib/account'), { recursive: true });
fs.copyFileSync(path.join(source, 'package.json'), path.join(dest, 'package.json'));
fs.copyFileSync(path.join(source,'lib/deployment.js'),path.join(dest,'lib/deployment.js'));
fs.symlinkSync(path.join(source, 'node_modules'), path.join(dest, 'node_modules'), 'dir');
fs.copyFileSync(path.join(source, '../firestore.rules'), path.join(root, 'firestore.rules'));
fs.writeFileSync(path.join(dest, 'lib/index.js'), 'exports.generateSomataAI = require("./ai/function").generateSomataAI;\n');
fs.renameSync(path.join(dest, 'lib/ai/provider.js'), path.join(dest, 'lib/ai/provider-real.js'));
fs.copyFileSync(path.join(__dirname, 'ai-provider.fixture.cjs'), path.join(dest, 'lib/ai/provider.js'));
fs.writeFileSync(path.join(dest, '.secret.local'), 'OPENAI_API_KEY=synthetic-invalid-emulator-only\n', { mode: 0o600 });
fs.writeFileSync(path.join(root, 'firebase.json'), JSON.stringify({ functions: { source: 'functions' }, firestore: { rules: 'firestore.rules' },
  emulators: { auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: '127.0.0.1', port: 8080 },
    functions: { host: '127.0.0.1', port: 5001 }, ui: { enabled: false } } }, null, 2));
fs.writeFileSync(path.join(root, 'LOCAL_TEST_ONLY'), 'Synthetic provider transport. Do not publish/deploy this directory.\n');
console.log(root);
