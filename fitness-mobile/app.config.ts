import "dotenv/config";
import type { ExpoConfig } from "expo/config";

import { resolveReleaseConfig } from "./config/release.cjs";

import { resolveBackendConfig } from "./config/backend.cjs";

const release = resolveReleaseConfig(process.env);
const backend = resolveBackendConfig(process.env);

const config: ExpoConfig = {
  name: "Somata",
  slug: "fitness-mobile",
  scheme: "fitnessmobile",
  version: "1.0.0",
  orientation: "portrait",
  platforms: ["ios", "android"],
  icon: "./assets/branding/app/launcher-dark-1024.png",
  userInterfaceStyle: "automatic",

  plugins: [
    "expo-dev-client",
    "@react-native-community/datetimepicker",
    "expo-status-bar",
    ["expo-build-properties", { ios: { deploymentTarget: "16.4" } }],
    "expo-font",
    [
      "expo-splash-screen",
      {
        image: "./assets/branding/app/splash-symbol.png",
        resizeMode: "contain",
        backgroundColor: "#0B0E12",
      },
    ],
    "expo-apple-authentication",
    "expo-notifications",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Somata uses your photo library so you can choose progress photos and meal images.",
        cameraPermission:
          "Somata uses your camera so you can take progress photos and scan meals.",
        microphonePermission: false,
      },
    ],
    "expo-router",
    "expo-web-browser",
    [
      "react-native-health",
      {
        healthSharePermission:
          "Fitness Mobile reads Apple Health data you approve, including steps, workouts, energy, weight, body fat, heart rate, and sleep, to sync your fitness dashboard.",
        healthUpdatePermission:
          "Fitness Mobile may write workouts or body metrics only when you explicitly choose to export them.",
      },
    ],
  ],

  ios: {
    icon: "./assets/branding/app/launcher-dark-1024.png",
    bundleIdentifier: "com.aristos.fitnessmobile",
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSHealthShareUsageDescription:
        "We use Apple Health data (steps, energy, weight) to personalize goals and insights.",
      NSHealthUpdateUsageDescription:
        "We may write workouts or body metrics you choose to log to Apple Health.",
      NSCameraUsageDescription:
        "We use the camera to scan food barcodes to auto-fill nutrition.",
      NSPhotoLibraryUsageDescription:
        "We use your photo library so you can choose progress photos and meal images.",
      NSPhotoLibraryAddUsageDescription:
        "We save progress photos you choose only on your device.",
    },
  },

  android: {
    icon: "./assets/branding/app/launcher-dark-1024.png",
    adaptiveIcon: {
      foregroundImage: "./assets/branding/app/android-adaptive-foreground.png",
      monochromeImage: "./assets/branding/app/android-monochrome-foreground.png",
      backgroundColor: "#0B0E12",
    },
    predictiveBackGestureEnabled: false,
  },

  updates: {
    url: "https://u.expo.dev/32f5a4f2-1672-4b2b-87d0-c97dc293f81d",
  },

  runtimeVersion: {
    // Native SDK changes must not share OTA updates with older binaries.
    policy: "fingerprint",
  },

  extra: {
    backend,
    // Omit absent optional values rather than relying on Expo manifest null serialization.
    release: Object.fromEntries(Object.entries(release).filter(([, value]) => value !== null)),
    fdcApiKey: process.env.FDC_API_KEY,
    eas: {
      projectId: "32f5a4f2-1672-4b2b-87d0-c97dc293f81d",
    },
  },
};

export default config;
