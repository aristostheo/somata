export type ReleaseConfig = {
  checkoutEnabled: boolean;
  checkoutPriceId: string | null;
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
};
export function publicHttpsUrl(value: unknown): string | null;
export function resolveReleaseConfig(env: Record<string, string | undefined>): ReleaseConfig;
export function readReleaseConfig(value: unknown): ReleaseConfig;
