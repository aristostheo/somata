// Shared by Expo's Node config loader and the client. Contains public configuration only.
function publicHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[<>\s]/.test(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') ||
        /[:\[\]]/.test(host) || /^[\d.]+$/.test(host) ||
        /(^|\.)(localhost|local|test|invalid|example|example\.com|example\.org|example\.net)$/.test(host) ||
        /your[-_.]?domain|placeholder|change[-_]?me/i.test(host)) return null;
    return url.href;
  } catch { return null; }
}
function priceId(value) {
  return typeof value === 'string' && /^price_[A-Za-z0-9]+$/.test(value) ? value : null;
}
function resolveReleaseConfig(env) {
  const errors = [];
  const store = ['testflight', 'production'].includes(env.EAS_BUILD_PROFILE) || env.SOMATA_RELEASE_BUILD === 'true';
  for (const key of ['SOMATA_RELEASE_BUILD', 'SOMATA_CHECKOUT_ENABLED']) {
    if (env[key] !== undefined && env[key] !== '' && !['true', 'false'].includes(env[key])) errors.push(`${key} must be true or false`);
  }
  const privacyPolicyUrl = publicHttpsUrl(env.SOMATA_PRIVACY_POLICY_URL);
  const supportUrl = publicHttpsUrl(env.SOMATA_SUPPORT_URL);
  for (const [key, url] of [['SOMATA_PRIVACY_POLICY_URL', privacyPolicyUrl], ['SOMATA_SUPPORT_URL', supportUrl]]) {
    if ((store || env[key]) && !url) errors.push(`${key} must be an operator-provided public HTTPS URL (no placeholders)`);
  }
  const checkoutEnabled = env.SOMATA_CHECKOUT_ENABLED === 'true';
  const checkoutPriceId = priceId(env.EXPO_PUBLIC_STRIPE_PRICE_ID);
  if (checkoutEnabled && !checkoutPriceId) errors.push('EXPO_PUBLIC_STRIPE_PRICE_ID is required when SOMATA_CHECKOUT_ENABLED=true');
  if (store && env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true') errors.push('Store builds require EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false');
  if (errors.length) throw new Error(`Release configuration blocked:\n- ${errors.join('\n- ')}`);
  return { checkoutEnabled, checkoutPriceId: checkoutEnabled ? checkoutPriceId : null, privacyPolicyUrl, supportUrl };
}
// A missing/old/malformed manifest must never enable purchasing or expose an unsafe link.
function readReleaseConfig(value) {
  const input = value && typeof value === 'object' ? value : {};
  const id = priceId(input.checkoutPriceId);
  return { checkoutEnabled: input.checkoutEnabled === true && !!id,
    checkoutPriceId: input.checkoutEnabled === true ? id : null,
    privacyPolicyUrl: publicHttpsUrl(input.privacyPolicyUrl), supportUrl: publicHttpsUrl(input.supportUrl) };
}
exports.publicHttpsUrl = publicHttpsUrl;
exports.resolveReleaseConfig = resolveReleaseConfig;
exports.readReleaseConfig = readReleaseConfig;
