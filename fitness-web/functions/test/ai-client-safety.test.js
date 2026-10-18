const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
function files(directory, bundles = false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.expo', 'build', 'dist'].includes(entry.name) && !bundles) return [];
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(full, bundles);
    return /\.(?:tsx?|jsx?|cjs|mjs|hbc|map|json)$/.test(entry.name) ? [full] : [];
  });
}
function inspect(paths) {
  const violations = [];
  for (const file of paths) {
    let source;
    if (file.endsWith('.hbc')) {
      assert.ok(process.env.SOMATA_HERMESC_PATH, 'Set SOMATA_HERMESC_PATH to decode Hermes string boundaries');
      try { source = execFileSync(process.env.SOMATA_HERMESC_PATH, ['-dump-bytecode', file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); }
      catch { throw new Error('Unable to decode Hermes artifact for credential inspection'); }
    } else source = fs.readFileSync(file).toString('utf8');
    if (/api\.openai\.com|api\.anthropic\.com|(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(source) ||
      /process\.env\.(?:EXPO_PUBLIC_|REACT_APP_)?(?:OPENAI|ANTHROPIC)_API_KEY/.test(source)) violations.push(path.relative(root, file));
  }
  // Report filenames only, never a matching credential or source excerpt.
  assert.deepEqual(violations, []);
}
test('mobile/web source and local client env files contain no AI provider credentials or direct provider URLs', () => {
  inspect([...files(path.join(root, 'fitness-mobile')), ...files(path.join(root, 'fitness-web/src'))]);
  for (const directory of ['fitness-mobile', 'fitness-web']) {
    for (const name of fs.readdirSync(path.join(root, directory)).filter(name => name.startsWith('.env'))) {
      const source = fs.readFileSync(path.join(root, directory, name), 'utf8');
      assert.equal(/^\s*(?:EXPO_PUBLIC_|REACT_APP_)?(?:OPENAI|ANTHROPIC)_API_KEY\s*=/m.test(source), false,
        `${directory}/${name} must not configure an AI provider credential`);
    }
  }
});
if (process.env.SOMATA_AI_BUNDLE_DIRS) test('generated mobile and web artifacts contain no AI provider credential or provider URL', () => {
  for (const directory of process.env.SOMATA_AI_BUNDLE_DIRS.split(path.delimiter)) {
    const artifacts = files(directory, true); assert.ok(artifacts.length, 'Expected build artifacts'); inspect(artifacts);
  }
});
