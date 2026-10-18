export const FITADAPT_DEMO_PROJECT_ID = "demo-somata-fitadapt";

/** Keep the opt-in and its guards independent of Firebase initialization. */
export function firebaseEmulatorMode(input: {
  flag?: string;
  development: boolean;
  projectId?: string;
  host?: string;
}): { host: string; projectId: string } | null {
  if (input.flag == null || input.flag === "false") return null;
  if (input.flag !== "true") {
    throw new Error("EXPO_PUBLIC_USE_FIREBASE_EMULATORS must be true or false.");
  }
  if (!input.development) {
    throw new Error("Firebase emulators can only be enabled in a development build (__DEV__).");
  }
  if (input.projectId !== FITADAPT_DEMO_PROJECT_ID) {
    throw new Error(`Firebase emulator mode requires EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID=${FITADAPT_DEMO_PROJECT_ID}.`);
  }
  const host = input.host?.trim();
  const octets = host?.split(".");
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
      octets?.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255) ||
      !(octets[0] === "10" || (octets[0] === "192" && octets[1] === "168") ||
        (octets[0] === "172" && Number(octets[1]) >= 16 && Number(octets[1]) <= 31))) {
    throw new Error("EXPO_PUBLIC_FIREBASE_EMULATOR_HOST must be your Mac's private LAN IPv4 address (not localhost).");
  }
  return { host, projectId: input.projectId };
}
