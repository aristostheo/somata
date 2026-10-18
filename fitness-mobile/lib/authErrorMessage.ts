/** Keep provider internals and account existence out of sign-in errors. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  switch (code) {
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Check your email and password, then try again.";
    case "auth/email-already-in-use": return "Try signing in or resetting your password for this email.";
    case "auth/weak-password": return "Choose a password with at least 6 characters.";
    case "auth/network-request-failed": return "Check your connection and try again. Your entries are still here.";
    case "auth/too-many-requests": return "Too many attempts. Wait a little before trying again.";
    case "auth/user-disabled": return "This account is unavailable. Contact Somata support.";
    default: return fallback;
  }
}
