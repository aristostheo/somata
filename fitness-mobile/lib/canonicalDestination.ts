const retiredTabs: Record<string, string> = {
  '/design-preview': '/(tabs)', '/design-preview/index': '/(tabs)', '/dashboard-preview': '/(tabs)',
  '/design-preview/workouts': '/(tabs)/workouts', '/design-preview/nutrition': '/(tabs)/nutrition',
  '/design-preview/notifications': '/(tabs)/notifications', '/design-preview/profile': '/(tabs)/profile',
};
/** Keep query strings and fragments intact when opening a retired visual-preview deep link. */
export function canonicalDestination(path: string) {
  const boundary = path.search(/[?#]/);
  const pathname = boundary < 0 ? path : path.slice(0, boundary);
  return (retiredTabs[pathname] ?? pathname) + (boundary < 0 ? '' : path.slice(boundary));
}
