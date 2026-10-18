import test from 'node:test';
import assert from 'node:assert/strict';
import { publicHttpsUrl, readReleaseConfig, resolveReleaseConfig } from '../config/release.cjs';
import { requestCheckout } from '../services/checkout';
// Synthetic URLs for parsing tests only; never fetched or used as application defaults.
const links = { SOMATA_PRIVACY_POLICY_URL: 'https://policy.somata-fixture.org/privacy', SOMATA_SUPPORT_URL: 'https://help.somata-fixture.org/support' };
const enabled = () => resolveReleaseConfig({ ...links, SOMATA_CHECKOUT_ENABLED: 'true', EXPO_PUBLIC_STRIPE_PRICE_ID: 'price_synthetic' });
test('checkout is off by default and missing or malformed manifests cannot enable it', () => {
  assert.equal(resolveReleaseConfig({}).checkoutEnabled, false);
  assert.equal(resolveReleaseConfig({ EXPO_PUBLIC_STRIPE_PRICE_ID: 'price_synthetic' }).checkoutEnabled, false);
  for (const value of [undefined, null, {}, { checkoutEnabled: 'true', checkoutPriceId: 'price_synthetic' }, { checkoutEnabled: true }])
    assert.equal(readReleaseConfig(value).checkoutEnabled, false);
  assert.throws(() => resolveReleaseConfig({ SOMATA_CHECKOUT_ENABLED: 'yes' }), /must be true or false/);
  assert.throws(() => resolveReleaseConfig({ SOMATA_CHECKOUT_ENABLED: 'true' }), /EXPO_PUBLIC_STRIPE_PRICE_ID/);
});
test('TestFlight, production and explicit release exports require both real links; errors do not print values', () => {
  for (const env of [{ EAS_BUILD_PROFILE: 'testflight' }, { EAS_BUILD_PROFILE: 'production', SOMATA_RELEASE_BUILD: 'false' }, { SOMATA_RELEASE_BUILD: 'true' }]) {
    assert.throws(() => resolveReleaseConfig(env), error => error instanceof Error && /SOMATA_PRIVACY_POLICY_URL/.test(error.message) && /SOMATA_SUPPORT_URL/.test(error.message));
    assert.equal(resolveReleaseConfig({ ...env, ...links }).supportUrl, links.SOMATA_SUPPORT_URL);
    assert.throws(() => resolveReleaseConfig({ ...env, SOMATA_PRIVACY_POLICY_URL: links.SOMATA_PRIVACY_POLICY_URL }), /SOMATA_SUPPORT_URL/);
  }
  assert.throws(() => resolveReleaseConfig({ ...links, EAS_BUILD_PROFILE: 'testflight', EXPO_PUBLIC_USE_FIREBASE_EMULATORS: 'true' }), /Store builds/);
  assert.throws(() => resolveReleaseConfig({ SOMATA_SUPPORT_URL: 'https://name:private@host.org' }), e => e instanceof Error && !e.message.includes('private'));
});
test('legal/support URLs reject unsafe schemes, credentials, private hosts and placeholders', () => {
  for (const input of ['', 'http://policy.somata-fixture.org', 'javascript:alert(1)', 'file:///tmp/policy', 'https://localhost',
    'https://192.168.1.1/support', 'https://[::1]', 'https://example.com/privacy', 'https://foo.invalid', 'https://your-domain.com',
    'https://x:y@policy.somata-fixture.org', 'https://<SUPPORT_URL>', 'https://host.local/support']) assert.equal(publicHttpsUrl(input), null, input);
  assert.equal(readReleaseConfig({ privacyPolicyUrl: 'javascript:alert(1)' }).privacyPolicyUrl, null);
  assert.equal(publicHttpsUrl(links.SOMATA_PRIVACY_POLICY_URL), links.SOMATA_PRIVACY_POLICY_URL);
});
test('disabled checkout returns before auth, endpoint invocation or browser navigation', async () => {
  const never = () => { assert.fail('Disabled checkout must have no side effects'); };
  assert.equal(await requestCheckout(resolveReleaseConfig({}), { currentUid: never, createSession: never, openUrl: never }), 'disabled');
});
test('enabled checkout requires auth and sends only the configured price; success opens validated URL once', async () => {
  const calls: unknown[] = [];
  const deps = { currentUid: (): string | null => null,
    createSession: async (id: string) => { calls.push(id); return { url: 'https://checkout.stripe.com/c/pay/synthetic' }; },
    openUrl: async (url: string) => { calls.push(url); } };
  await assert.rejects(requestCheckout(enabled(), deps), /Sign in/); assert.deepEqual(calls, []);
  assert.equal(await requestCheckout(enabled(), { ...deps, currentUid: () => 'synthetic-owner' }), 'opened');
  assert.deepEqual(calls, ['price_synthetic', 'https://checkout.stripe.com/c/pay/synthetic']);
});
test('checkout failures do not retry; malformed response and account switch never open a browser', async () => {
  let calls = 0;
  const deps = { currentUid: () => 'alice', createSession: async () => { calls++; throw Error('unavailable'); },
    openUrl: async () => assert.fail('No browser navigation') };
  await assert.rejects(requestCheckout(enabled(), deps), /unavailable/); assert.equal(calls, 1);
  for (const result of [null, {}, { url: 'javascript:alert(1)' }, { url: 'http://checkout.stripe.com' }])
    await assert.rejects(requestCheckout(enabled(), { ...deps, createSession: async () => result }), /unavailable/);
  let uid = 'alice';
  await assert.rejects(requestCheckout(enabled(), { ...deps, currentUid: () => uid, createSession: async () => { uid = 'bob'; return { url: 'https://checkout.stripe.com/c/pay/synthetic' }; } }), /Account changed/);
});
