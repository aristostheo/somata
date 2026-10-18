import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { FriendSummary } from "../../../fitness-web/functions/src/friends/contract";
export type { FriendSummary, Section, WorkoutSummary } from "../../../fitness-web/functions/src/friends/contract";
export function summaryDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export async function getFriendSummary(friendUid: string): Promise<FriendSummary> {
  const result = await httpsCallable<{ friendUid: string; endDate: string }, FriendSummary>(functions, "getFriendSummary", { timeout: 30000 })({ friendUid, endDate: summaryDate() });
  return result.data;
}
export async function setFriendSummarySharing(friendUid: string, enabled: boolean) {
  await httpsCallable(functions, "setFriendSummarySharing", { timeout: 30000 })({ friendUid, enabled });
}
export function friendSummaryError(error: unknown): string {
  const code = String((error as { code?: string })?.code || "");
  if (code.endsWith("unauthenticated")) return "Sign in to view shared activity.";
  if (code.endsWith("permission-denied")) return "Shared activity is unavailable. You must still be accepted friends and neither person can be blocked.";
  return "Shared activity is unavailable right now. Try again. Your private records have not been opened.";
}
