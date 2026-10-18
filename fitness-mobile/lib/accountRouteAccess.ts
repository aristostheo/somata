/** Only this information page is public; account/deletion/fitness routes retain their auth guard. */
export function accountRouteRedirect(input: { pathname: string; signedIn: boolean; inAuth: boolean; pendingSetup: boolean }) {
  if (input.pathname === '/account/legal') return null;
  if (!input.signedIn) return input.inAuth ? null : '/(auth)/login';
  if (input.pendingSetup) return input.pathname === '/fitadapt-setup' ? null : '/fitadapt-setup';
  return input.inAuth ? '/(tabs)' : null;
}
