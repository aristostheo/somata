import test from 'node:test';
import assert from 'node:assert/strict';
import { accountRouteRedirect } from '../lib/accountRouteAccess';
test('policy/support stays reachable before sign-in and during setup without opening private account routes', () => {
  for (const signedIn of [false, true]) for (const pendingSetup of [false, true])
    assert.equal(accountRouteRedirect({ pathname: '/account/legal', signedIn, pendingSetup, inAuth: false }), null);
  for (const pathname of ['/account', '/account/delete', '/paywall', '/account/legal/private', '/profile/fitadapt-insights']) {
    assert.equal(accountRouteRedirect({ pathname, signedIn: false, pendingSetup: false, inAuth: false }), '/(auth)/login');
    assert.equal(accountRouteRedirect({ pathname, signedIn: true, pendingSetup: true, inAuth: false }), '/fitadapt-setup');
  }
  assert.equal(accountRouteRedirect({ pathname: '/login', signedIn: false, pendingSetup: false, inAuth: true }), null);
  assert.equal(accountRouteRedirect({ pathname: '/login', signedIn: true, pendingSetup: false, inAuth: true }), '/(tabs)');
  assert.equal(accountRouteRedirect({ pathname: '/fitadapt-setup', signedIn: true, pendingSetup: true, inAuth: false }), null);
});
