const production = require('./firebaseProduction.cjs');
const FUNCTIONS_REGION = 'us-central1';
const STAGING_FUNCTIONS_REGION = 'northamerica-northeast2';
function fail(field) { throw new Error(`Staging configuration blocked: ${field}. No production fallback is allowed.`); }
function stagingProject(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value) ||
      value === production.projectId || value === 'eleven11-aristos' || value.startsWith('demo-') || /placeholder|replace|example/.test(value)) fail('a real separate staging Firebase project ID is required');
  return value;
}
function stagingFirebase(value, projectId) {
  stagingProject(projectId);
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SOMATA_STAGING_FIREBASE_CONFIG must contain the registered Firebase web app configuration');
  const allowed = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('SOMATA_STAGING_FIREBASE_CONFIG contains unsupported fields');
  if (value.projectId !== projectId) fail('Firebase projectId must match EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID');
  if (typeof value.apiKey !== 'string' || !/^AIza[A-Za-z0-9_-]{35}$/.test(value.apiKey) || value.apiKey === production.apiKey) fail('staging apiKey must be a distinct registered Firebase client key');
  if (value.authDomain !== `${projectId}.firebaseapp.com`) fail('authDomain must belong to the staging project');
  if (![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(value.storageBucket)) fail('storageBucket must be the staging default bucket');
  if (typeof value.messagingSenderId !== 'string' || !/^\d+$/.test(value.messagingSenderId) || value.messagingSenderId === production.messagingSenderId) fail('messagingSenderId must be the staging project number');
  if (typeof value.appId !== 'string' || !new RegExp(`^1:${value.messagingSenderId}:web:[A-Za-z0-9]+$`).test(value.appId)) fail('appId must be the registered staging web app for that project number');
  return Object.fromEntries(allowed.map(key => [key, value[key]]));
}
function resolveBackendConfig(env) {
  const mode = env.EXPO_PUBLIC_SOMATA_BACKEND_ENV || 'production';
  if (!['production', 'staging'].includes(mode)) fail('EXPO_PUBLIC_SOMATA_BACKEND_ENV must be staging or production');
  if (env.EAS_BUILD_PROFILE === 'testflight' && mode !== 'staging') fail('TestFlight requires EXPO_PUBLIC_SOMATA_BACKEND_ENV=staging');
  if (mode === 'production') return { environment: 'production', functionsRegion: FUNCTIONS_REGION };
  if (env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true') fail('staging cannot be combined with local emulators');
  if (env.SOMATA_CHECKOUT_ENABLED !== 'false') fail('staging requires SOMATA_CHECKOUT_ENABLED=false');
  const projectId = stagingProject(env.EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID);
  let config; try { config = JSON.parse(env.SOMATA_STAGING_FIREBASE_CONFIG || ''); }
  catch { fail('SOMATA_STAGING_FIREBASE_CONFIG must be valid JSON (public Firebase fields only)'); }
  return { environment: 'staging', projectId, functionsRegion: STAGING_FUNCTIONS_REGION, firebase: stagingFirebase(config, projectId) };
}
function resolveRuntimeBackend(manifest, bundledMode, bundledProjectId, emulator, nativeChannel) {
  if (bundledMode && !['staging', 'production'].includes(bundledMode)) fail('invalid bundled backend environment');
  const mode = bundledMode || 'production';
  if (['testflight', 'testflight-staging'].includes(nativeChannel) && mode !== 'staging') fail('a TestFlight binary cannot load a production-targeted update');
  if (manifest && manifest.environment !== mode) fail('bundle/manifest backend environments disagree');
  if (mode === 'staging') {
    if (emulator) fail('staging cannot use emulators');
    if (!manifest || manifest.environment !== 'staging' || manifest.projectId !== bundledProjectId || manifest.functionsRegion !== STAGING_FUNCTIONS_REGION) fail('staging manifest, bundled project, and region must agree');
    return { firebase: stagingFirebase(manifest.firebase, bundledProjectId), functionsRegion: STAGING_FUNCTIONS_REGION };
  }
  if (emulator) return { firebase: { apiKey: 'demo-somata-fitadapt-local', authDomain: `${emulator.projectId}.firebaseapp.com`, projectId: emulator.projectId,
    storageBucket: `${emulator.projectId}.appspot.com`, messagingSenderId: '0', appId: '1:0:web:demo-somata-fitadapt' }, functionsRegion: FUNCTIONS_REGION };
  return { firebase: production, functionsRegion: FUNCTIONS_REGION };
}
exports.FUNCTIONS_REGION = FUNCTIONS_REGION;
exports.STAGING_FUNCTIONS_REGION = STAGING_FUNCTIONS_REGION;
// Staging remains email/password-only even if a stale client ID or device Apple capability exists.
exports.socialProvidersAllowed = (manifestMode, bundledMode, channel) => {
  if (['testflight', 'testflight-staging'].includes(channel)) return false;
  return [manifestMode, bundledMode].every(mode => mode === undefined || mode === 'production');
};
exports.stagingProject = stagingProject;
exports.resolveBackendConfig = resolveBackendConfig;
exports.resolveRuntimeBackend = resolveRuntimeBackend;
