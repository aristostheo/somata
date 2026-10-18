import { accountLocalPrefix } from "../local/accountStoreCore";
/** Exact audited account-scoped namespaces; never clear all storage or match arbitrary UID substrings. */
export function ownedDeletionKeys(keys: readonly string[], uid: string) {
  const exact = ["@acct_center_privacy_v1:", "@body_twin_v1:", "@meal_builder_presets:", "@somata:fitadapt-setup-draft:v1:",
    "@scan_unlimited_v2:", "workout:templateSeed:", "workout:draft:", "workout:referenceSeed:", "hydration:quickLogs:", "@pending_add_meal:", "@pending_add_meal_batch_v1:", "@pending_meal_builder_log_v1:", "@pending_meal_builder_additions_v1:"].map(p => p + uid);
  return keys.filter(key => key.startsWith(accountLocalPrefix(uid)) || exact.includes(key) || key.startsWith(`workout:recap:${uid}:`) || key.startsWith(`@scan_quota_v2:${uid}:`));
}
export function deletionError(error: unknown) {
  const details = (error as { details?: { code?: string; reason?: string } })?.details;
  const code = details?.code;
  if (code === "retention_review_required" && details?.reason === "legacy_ai_cache") return "Deletion is paused because older shared AI records cannot be reliably linked to an account. An operator retention review is needed. Your sign-in has not been deleted.";
  if (code === "retention_review_required" && details?.reason === "safety_report") return "Deletion is paused because a safety record requires an operator retention review. Your sign-in has not been deleted.";
  if (code === "reauthentication_required") return "Verify your sign-in again, then confirm deletion within five minutes.";
  if (code === "retention_review_required") return "Deletion is paused because legacy AI or safety records need an operator retention review. Your Auth account has not been deleted. Retry after that review is complete.";
  if (code === "storage_review_required" || code === "ownership_review") return "Deletion needs an operator ownership review. Your Auth account has not been deleted. No files with uncertain ownership will be removed.";
  if (code === "deletion_in_progress") return "Deletion is already running. Wait for it to finish; after an interrupted request, wait ten minutes before retrying.";
  return "Deletion could not be confirmed. Keep this screen open and retry. If cleanup already started, it will resume; it cannot be undone. Your Auth account is deleted only after server cleanup succeeds.";
}
