// Offline only: no Firebase/Admin/network clients, deployment or secret access.
const fs = require('node:fs');
const path = require('node:path');
const { resolveBackendConfig, stagingProject, STAGING_FUNCTIONS_REGION } = require('../../fitness-mobile/config/backend.cjs');
const { resolveReleaseConfig } = require('../../fitness-mobile/config/release.cjs');
const fields = ['firebaseProjectId','firebaseProjectNumber','firestoreLocation','storageBucket','functionsRegion',
  'runProjectId','runRegion','runService','runServiceAccount','imageDigest','bridgeSecretVersion','serviceUrl'];
function validateStaging(plan, env, requireServiceUrl = false) {
  const errors = [];
  const invalid = key => errors.push(`Missing or invalid staging setting: ${key}`);
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw Error('Staging plan must be a JSON object');
  if (Object.keys(plan).some(key => !fields.includes(key))) errors.push('Staging plan has unsupported fields; never include secret values');
  for (const key of fields.filter(k => k !== 'serviceUrl')) if (typeof plan[key] !== 'string' || !plan[key].trim()) invalid(key);
  try { stagingProject(plan.firebaseProjectId); } catch { invalid('firebaseProjectId'); }
  if (plan.runProjectId !== plan.firebaseProjectId) invalid('runProjectId (this package requires the same isolated staging project)');
  if (!/^\d+$/.test(plan.firebaseProjectNumber || '')) invalid('firebaseProjectNumber');
  if (plan.functionsRegion !== STAGING_FUNCTIONS_REGION) invalid('functionsRegion (staging requires northamerica-northeast2)');
  if (!/^[a-z][a-z0-9-]+\d$/.test(plan.firestoreLocation || '')) invalid('firestoreLocation');
  if (!/^[a-z]+-[a-z]+\d+$/.test(plan.runRegion || '')) invalid('runRegion');
  if (!/^[a-z][a-z0-9-]{0,48}$/.test(plan.runService || '')) invalid('runService');
  const identity = /^([a-z][a-z0-9-]{4,28}[a-z0-9])@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/.exec(plan.runServiceAccount || '');
  if (!identity || identity[2] !== plan.firebaseProjectId) invalid('runServiceAccount');
  const image = /^[a-z]+-[a-z]+\d+-docker\.pkg\.dev\/([a-z0-9-]+)\/[a-z0-9_-]+\/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$/.exec(plan.imageDigest || '');
  if (!image || image[1] !== plan.firebaseProjectId) invalid('imageDigest (staging Artifact Registry digest, not a tag)');
  if (!/^[1-9]\d*$/.test(plan.bridgeSecretVersion || '')) invalid('bridgeSecretVersion (pinned version identifier only)');
  if (requireServiceUrl || plan.serviceUrl) {
    try {
      const url = new URL(plan.serviceUrl);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.run.app') || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) invalid('serviceUrl (verified staging Cloud Run HTTPS root)');
    } catch { invalid('serviceUrl'); }
  }
  let backend;
  try { backend = resolveBackendConfig(env); } catch (error) { errors.push(error.message); }
  try { resolveReleaseConfig({ ...env, SOMATA_RELEASE_BUILD: 'true' }); } catch (error) { errors.push(error.message); }
  if (backend?.environment !== 'staging') invalid('EXPO_PUBLIC_SOMATA_BACKEND_ENV (staging required)');
  if (backend?.firebase?.projectId !== plan.firebaseProjectId) invalid('mobile/backend Firebase project agreement');
  if (backend?.firebase?.messagingSenderId !== plan.firebaseProjectNumber) invalid('mobile/backend Firebase project number agreement');
  if (backend?.firebase?.storageBucket !== plan.storageBucket) invalid('mobile/backend default Storage bucket agreement');
  if (env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== 'false') invalid('EXPO_PUBLIC_USE_FIREBASE_EMULATORS (explicit false required)');
  if (env.SOMATA_CHECKOUT_ENABLED !== 'false') invalid('SOMATA_CHECKOUT_ENABLED (explicit false required)');
  if (errors.length) throw Error(errors.join('\n'));
  return { projectId: plan.firebaseProjectId, functionsRegion: plan.functionsRegion, serviceUrlReady: !!plan.serviceUrl };
}
function loadPlan(filename) {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch { throw Error('Cannot read staging plan JSON. Start from staging.example.json; never include secrets.'); }
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (!args[0] || args.slice(1).some(arg => arg !== '--require-service-url')) throw Error('Usage: node scripts/validate-staging.cjs <staging-plan.json> [--require-service-url]');
    validateStaging(loadPlan(path.resolve(args[0])), process.env, args.includes('--require-service-url'));
    console.log('PASS: offline staging configuration checks. No cloud resources, secrets, URLs or records were accessed.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
exports.validateStaging = validateStaging;
exports.loadPlan = loadPlan;
