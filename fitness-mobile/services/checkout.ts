import { readReleaseConfig, publicHttpsUrl, type ReleaseConfig } from '../config/release.cjs';
/** Defense at the action boundary: even a direct paywall link cannot bypass the build gate. */
export async function requestCheckout(config: ReleaseConfig, deps: {
  currentUid(): string | null;
  createSession(priceId: string): Promise<unknown>;
  openUrl(url: string): Promise<unknown>;
}) {
  const enabled = readReleaseConfig(config);
  if (!enabled.checkoutEnabled || !enabled.checkoutPriceId) return 'disabled' as const;
  const uid = deps.currentUid();
  if (!uid) throw new Error('Sign in before opening checkout.');
  const result = await deps.createSession(enabled.checkoutPriceId);
  if (deps.currentUid() !== uid) throw new Error('Account changed. Open checkout again from your account.');
  const url = publicHttpsUrl((result as { url?: unknown } | null)?.url);
  if (!url) throw new Error('Checkout is unavailable. Please try again later.');
  await deps.openUrl(url);
  return 'opened' as const;
}
