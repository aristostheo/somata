import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendConfig, resolveRuntimeBackend, socialProvidersAllowed } from '../config/backend.cjs';
import production from '../config/firebaseProduction.cjs';
const projectId = 'somata-staging-fixture';
const firebase = { apiKey: 'AIza' + '0'.repeat(35), projectId, authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.firebasestorage.app`, messagingSenderId: '123456789012', appId: '1:123456789012:web:synthetic' };
const env = () => ({ EAS_BUILD_PROFILE: 'testflight', EXPO_PUBLIC_SOMATA_BACKEND_ENV: 'staging', EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID: projectId,
  SOMATA_STAGING_FIREBASE_CONFIG: JSON.stringify(firebase), SOMATA_CHECKOUT_ENABLED: 'false', EXPO_PUBLIC_USE_FIREBASE_EMULATORS: 'false' });
test('TestFlight has no missing or production Firebase fallback', () => {
  assert.throws(() => resolveBackendConfig({ EAS_BUILD_PROFILE: 'testflight' }), /TestFlight requires/);
  assert.throws(() => resolveBackendConfig({ EAS_BUILD_PROFILE: 'testflight', EXPO_PUBLIC_SOMATA_BACKEND_ENV: 'production' }), /TestFlight requires/);
  for (const key of ['EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID', 'SOMATA_STAGING_FIREBASE_CONFIG']) {
    const input: Record<string, string> = env(); delete input[key]; assert.throws(() => resolveBackendConfig(input), /Staging configuration blocked/);
  }
  assert.throws(() => resolveBackendConfig({ ...env(), EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID: production.projectId }), /separate staging/);
  assert.throws(() => resolveBackendConfig({ ...env(), EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID: 'demo-somata-fitadapt' }), /separate staging/);
});
test('staging verifies every account/project boundary and rejects secrets/unknown fields without printing values', () => {
  for (const patch of [{ projectId: production.projectId }, { apiKey: production.apiKey }, { authDomain: production.authDomain },
    { storageBucket: production.storageBucket }, { messagingSenderId: production.messagingSenderId }, { appId: production.appId }, { OPENAI_API_KEY: 'must-not-be-printed' }]) {
    assert.throws(() => resolveBackendConfig({ ...env(), SOMATA_STAGING_FIREBASE_CONFIG: JSON.stringify({ ...firebase, ...patch }) }), e => e instanceof Error && /Staging configuration blocked/.test(e.message) && !e.message.includes('must-not-be-printed') && !e.message.includes(production.apiKey));
  }
  assert.throws(() => resolveBackendConfig({ ...env(), SOMATA_CHECKOUT_ENABLED: 'true' }), /CHECKOUT/);
  assert.throws(() => resolveBackendConfig({ ...env(), EXPO_PUBLIC_USE_FIREBASE_EMULATORS: 'true' }), /emulators/);
});
test('staging manifest/bundle pin selects the same Auth/Firestore/Storage/Functions project', () => {
  const manifest = resolveBackendConfig(env());
  const selected = resolveRuntimeBackend(manifest, 'staging', projectId, null, 'testflight-staging');
  assert.deepEqual(selected.firebase, firebase); assert.equal(selected.functionsRegion, 'northamerica-northeast2');
  for (const bad of [undefined, {}, { ...manifest, environment: 'production' }, { ...manifest, functionsRegion: 'europe-west1' }, { ...manifest, firebase: production }])
    assert.throws(() => resolveRuntimeBackend(bad, 'staging', projectId, null), /Staging configuration blocked/);
  assert.throws(() => resolveRuntimeBackend(manifest, 'staging', 'other-project', null));
  assert.throws(() => resolveRuntimeBackend(manifest, 'staging', projectId, { projectId: 'demo-somata-fitadapt' }));
});
test('native TestFlight channels reject production OTA bundles; ordinary production/demo paths stay unchanged', () => {
  const manifest = resolveBackendConfig({});
  for (const channel of ['testflight', 'testflight-staging'])
    assert.throws(() => resolveRuntimeBackend(manifest, undefined, undefined, null, channel), /production-targeted update/);
  assert.deepEqual(resolveRuntimeBackend(manifest, undefined, undefined, null).firebase, production);
  const local = resolveRuntimeBackend(manifest, undefined, undefined, { projectId: 'demo-somata-fitadapt' });
  assert.equal(local.firebase.projectId, 'demo-somata-fitadapt'); assert.equal(local.firebase.messagingSenderId, '0');
  assert.throws(() => resolveRuntimeBackend(resolveBackendConfig(env()), 'production', undefined, null), /disagree/);
});

test('staging and TestFlight allow only email/password; ordinary sign-in availability stays unchanged', () => {
  for (const mode of ['staging', 'unknown', null]) {
    assert.equal(socialProvidersAllowed(mode, undefined, null), false);
    assert.equal(socialProvidersAllowed(undefined, mode, null), false);
  }
  for (const channel of ['testflight', 'testflight-staging']) assert.equal(socialProvidersAllowed('production', 'production', channel), false);
  assert.equal(socialProvidersAllowed(undefined, undefined, null), true);
  assert.equal(socialProvidersAllowed('production', 'production', null), true);
  assert.equal(resolveBackendConfig({}).functionsRegion, 'us-central1');
  assert.throws(() => resolveBackendConfig({ ...env(), EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID: 'eleven11-aristos' }), /separate staging/);
});
