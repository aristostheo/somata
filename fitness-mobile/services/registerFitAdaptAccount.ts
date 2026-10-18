/** The auth account is created at most once while setup is retried. */
export function createRegistrationRunner<User extends { uid: string; email: string | null }>(deps: {
  currentUser: () => User | null;
  createUser: (email: string, password: string) => Promise<User>;
  markEmail: (email: string) => Promise<void>;
  markUid: (uid: string) => Promise<void>;
  saveIdentity: (user: User, displayName: string) => Promise<void>;
}) {
  let inFlight: Promise<User> | null = null;
  return (input: { email: string; password: string; displayName: string }) => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const email = input.email.trim();
      await deps.markEmail(email);
      const current = deps.currentUser();
      const user = current?.email?.toLowerCase() === email.toLowerCase()
        ? current : await deps.createUser(email, input.password);
      await deps.markUid(user.uid);
      await deps.saveIdentity(user, input.displayName.trim());
      return user;
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}
