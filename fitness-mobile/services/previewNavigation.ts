import { canonicalDestination } from '../lib/canonicalDestination';
/** Compatibility for previously saved preview links; comparison mode is retired. */
export function previewDestination(path: string, _enabled: boolean) { return canonicalDestination(path); }
