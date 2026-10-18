export function notificationBelongsToAccount(uid: string | null | undefined, data: Record<string, unknown> | null | undefined) {
  return !!uid && data?.ownerUid === uid;
}
