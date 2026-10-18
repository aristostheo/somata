/** OAuth client IDs are public configuration, never provider secrets. */
export function googleClientId(platform: string, ids: { ios?: string; android?: string; web?: string }): string | null {
  const value = (platform === "ios" ? ids.ios : platform === "android" ? ids.android : ids.web)?.trim();
  return value && !value.includes("YOUR_") && /^[\w-]+\.apps\.googleusercontent\.com$/.test(value) ? value : null;
}
