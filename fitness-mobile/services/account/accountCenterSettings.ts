// services/account/accountCenterSettings.ts
// Drop-in ✅ simple, calm persistence for Account Center privacy/social settings
// Uses AsyncStorage. Optionally, you can mirror to Firestore later.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProfileVisibility = "private" | "friends" | "public";

export type AccountCenterPrivacySettings = {
  profileVisibility: ProfileVisibility;
  shareWorkouts: boolean;
  shareNutrition: boolean;
  shareStreaks: boolean;
};

export const DEFAULT_PRIVACY_SETTINGS: AccountCenterPrivacySettings = {
  profileVisibility: "friends",
  shareWorkouts: true,
  shareNutrition: false,
  shareStreaks: true,
};

const KEY = (uid: string) => `@acct_center_privacy_v1:${uid}`;

export async function getAccountCenterPrivacySettings(
  uid?: string
): Promise<AccountCenterPrivacySettings> {
  if (!uid) return DEFAULT_PRIVACY_SETTINGS;
  try {
    const raw = await AsyncStorage.getItem(KEY(uid));
    if (!raw) return DEFAULT_PRIVACY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...parsed,
    } as AccountCenterPrivacySettings;
  } catch {
    return DEFAULT_PRIVACY_SETTINGS;
  }
}

export async function setAccountCenterPrivacySettings(
  uid: string | undefined,
  settings: AccountCenterPrivacySettings
) {
  if (!uid) throw new Error("Sign in before saving account preferences");
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(settings));
}
