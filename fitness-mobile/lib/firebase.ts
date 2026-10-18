// @/lib/firebase.ts
import { Platform } from "react-native";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  setPersistence,
  connectAuthEmulator,
  // NOTE: DO NOT import getReactNativePersistence here; we resolve it dynamically below
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { resolveRuntimeBackend } from "../config/backend.cjs";
import { firebaseEmulatorMode } from "./firebaseEmulatorMode";
const emulator = firebaseEmulatorMode({
  flag: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS,
  development: __DEV__,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID,
  host: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
});
const backend = resolveRuntimeBackend(
  Constants.expoConfig?.extra?.backend,
  process.env.EXPO_PUBLIC_SOMATA_BACKEND_ENV,
  process.env.EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID,
  emulator,
  Updates.channel,
);
const selectedConfig = backend.firebase;
export const app = getApps().length ? getApps()[0] : initializeApp(selectedConfig);
if (Object.entries(selectedConfig).some(([key, value]) => app.options[key as keyof typeof app.options] !== value)) {
  throw new Error("Firebase configuration changed during hot reload. Fully restart the app before switching backends.");
}

/**
 * Try to load getReactNativePersistence regardless of where your firebase version exports it.
 * - First try 'firebase/auth/react-native'
 * - Then try 'firebase/auth'
 * - If not found, return undefined (we'll fall back to inMemory)
 */
function resolveGetRNPersistence():
  | ((storage: typeof AsyncStorage) => any)
  | undefined {
  try {
    // Some versions export from the RN subpath
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("firebase/auth/react-native");
    if (mod?.getReactNativePersistence) return mod.getReactNativePersistence;
  } catch {}
  try {
    // Newer versions may re-export from the main entry
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("firebase/auth");
    if (mod?.getReactNativePersistence) return mod.getReactNativePersistence;
  } catch {}
  return undefined;
}

let auth =
  Platform.OS === "web"
    ? getAuth(app)
    : (() => {
        // Native: initialize once with RN persistence if available
        const getRNPersist = resolveGetRNPersistence();
        try {
          if (getRNPersist) {
            return initializeAuth(app, {
              persistence: getRNPersist(AsyncStorage),
            });
          } else {
            console.warn(
              "[firebase] getReactNativePersistence not found; falling back to in-memory persistence."
            );
            // Fall back (session won't survive app restarts)
            return initializeAuth(app, {});
          }
        } catch {
          // Hot-reload or already initialized
          return getAuth(app);
        }
      })();

// Web: durable session
if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, backend.functionsRegion);

if (emulator) {
  const state = globalThis as typeof globalThis & {
    __somataFirebaseEmulators?: { app: typeof app; host: string };
  };
  const previous = state.__somataFirebaseEmulators;
  if (previous && (previous.app !== app || previous.host !== emulator.host)) {
    throw new Error("Firebase emulator host changed during hot reload. Fully restart Expo Go.");
  }
  if (!previous) {
    connectAuthEmulator(auth, `http://${emulator.host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator.host, 8080);
    connectFunctionsEmulator(functions, emulator.host, 5001);
    state.__somataFirebaseEmulators = { app, host: emulator.host };
  }
}
