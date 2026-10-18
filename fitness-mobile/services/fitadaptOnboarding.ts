import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "@somata:fitadapt-setup-pending:v1";
export const markFitAdaptSetupForEmail = (email: string) => AsyncStorage.setItem(key, `email:${email.trim().toLowerCase()}`);
export const markFitAdaptSetupForUid = (uid: string) => AsyncStorage.setItem(key, `uid:${uid}`);
export const markFitAdaptSetupForSocial = () => AsyncStorage.setItem(key, "social");
export const clearFitAdaptSetupMarker = () => AsyncStorage.removeItem(key);
export async function fitAdaptSetupPendingFor(user: { uid: string; email?: string | null }): Promise<boolean> {
  const value = await AsyncStorage.getItem(key);
  return value === `uid:${user.uid}` || value === `email:${user.email?.trim().toLowerCase()}` || value === "social";
}
