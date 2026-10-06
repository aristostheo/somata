// services/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as ExpoNotifications from "expo-notifications";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "@/lib/firebase";

export type NotificationType =
  | "friend:request"
  | "friend:accepted"
  | "ping"
  | "reminder"
  | "social:reaction"
  | "social:comment"
  | "info";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, any> | null;
  readAt?: any;
  createdAt?: any;
  createdAtMs?: number;
};

const col = (uid: string) =>
  collection(getFirestore() ?? db, "users", uid, "notifications");

const SCHEDULED_KEY = "scheduled_notification_ids_v1";

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function readScheduledMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeScheduledMap(next: Record<string, string>) {
  await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(next));
}

async function rememberScheduledId(logicalId: string, scheduledId: string) {
  const current = await readScheduledMap();
  current[logicalId] = scheduledId;
  await writeScheduledMap(current);
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await ExpoNotifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: ExpoNotifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await ExpoNotifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
    });
    await ExpoNotifications.setNotificationChannelAsync("goals", {
      name: "Goals",
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ||
    (Constants.easConfig as any)?.projectId;
  const token = await ExpoNotifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return token.data ?? null;
}

export async function scheduleDailyReminder(params: {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  channelId?: string;
}): Promise<void> {
  await cancelNotification(params.id);
  const scheduledId = await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: { id: params.id },
      ...(Platform.OS === "android" && {
        channelId: params.channelId ?? "reminders",
      }),
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DAILY,
      hour: params.hour,
      minute: params.minute,
    },
  });
  await rememberScheduledId(params.id, scheduledId);
}

export async function scheduleOneTimeNotification(params: {
  id: string;
  title: string;
  body: string;
  delaySeconds: number;
}): Promise<void> {
  await cancelNotification(params.id);
  const scheduledId = await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: { id: params.id },
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, params.delaySeconds),
    },
  });
  await rememberScheduledId(params.id, scheduledId);
}

export async function sendImmediateNotification(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await ExpoNotifications.scheduleNotificationAsync({
    content: { title: params.title, body: params.body, data: params.data },
    trigger: null,
  });
}

export async function cancelNotification(id: string): Promise<void> {
  const current = await readScheduledMap();
  const scheduledId = current[id];
  if (scheduledId) {
    await ExpoNotifications.cancelScheduledNotificationAsync(scheduledId).catch(
      () => {}
    );
    delete current[id];
    await writeScheduledMap(current);
    return;
  }
  await ExpoNotifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function cancelAllNotifications(): Promise<void> {
  await ExpoNotifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(SCHEDULED_KEY);
}

export async function getScheduledNotifications() {
  return ExpoNotifications.getAllScheduledNotificationsAsync();
}

export async function addNotification(
  uid: string,
  payload: Omit<AppNotification, "id" | "readAt" | "createdAt">
) {
  const createdAtMs = Date.now();
  const ref = await addDoc(col(uid), {
    type: payload.type,
    title: payload.title,
    body: payload.body ?? "",
    data: payload.data ?? null,
    readAt: null,
    createdAt: serverTimestamp(),
    createdAtMs,
  });
  return ref;
}

export function subscribeNotifications(
  uid: string,
  cb: (rows: AppNotification[]) => void,
  opts: { unreadOnly?: boolean; max?: number } = {}
) {
  if (!uid || uid === "__demo__") {
    cb([]);
    return () => {};
  }

  const filters: any[] = [];
  if (opts.unreadOnly) filters.push(where("readAt", "==", null));

  const qy = query(
    col(uid),
    ...filters,
    orderBy("createdAt", "desc"),
    limit(opts.max ?? 50)
  );

  return onSnapshot(
    qy,
    (snap) => {
      const rows: AppNotification[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        rows.push({
          id: d.id,
          type: x.type ?? "info",
          title: x.title ?? "",
          body: x.body ?? "",
          data: x.data ?? null,
          readAt: x.readAt ?? null,
          createdAt: x.createdAt ?? null,
          createdAtMs: x.createdAtMs ?? null,
        });
      });
      cb(rows);
    },
    (err) => {
      console.warn("[subscribeNotifications]", err);
      cb([]);
    }
  );
}

// Lightweight unread count stream for badge usage
export function subscribeUnreadCount(uid: string, cb: (count: number) => void) {
  if (!uid || uid === "__demo__") {
    cb(0);
    return () => {};
  }
  const qy = query(col(uid), where("readAt", "==", null), limit(200));
  return onSnapshot(
    qy,
    (snap) => cb(snap.size),
    (err) => {
      console.warn("[subscribeUnreadCount]", err);
      cb(0);
    }
  );
}

export async function markNotificationRead(uid: string, id: string) {
  await updateDoc(doc(col(uid), id), { readAt: serverTimestamp() });
}

export async function deleteNotification(uid: string, id: string) {
  await deleteDoc(doc(col(uid), id));
}

export async function markAllNotificationsRead(uid: string) {
  const ref = getFirestore() ?? db;
  const unread = await getDocs(
    query(col(uid), where("readAt", "==", null), limit(400))
  );
  const batch = writeBatch(ref);
  unread.forEach((d) => {
    batch.update(d.ref, { readAt: serverTimestamp() });
  });
  if (!unread.empty) {
    await batch.commit();
  }
}

// ───────────────────────── Convenience helpers ─────────────────────────

export async function notifyFriendRequest(
  toUid: string,
  from: { uid: string; email?: string | null; displayName?: string | null }
) {
  await addNotification(toUid, {
    type: "friend:request",
    title: `${from.displayName || "New friend"} request`,
    body: from.email ? `${from.email} wants to connect` : undefined,
    data: { fromUid: from.uid, email: from.email ?? null },
  });
}

export async function notifyFriendAccepted(
  toUid: string,
  friend: { uid: string; displayName?: string | null }
) {
  await addNotification(toUid, {
    type: "friend:accepted",
    title: friend.displayName
      ? `${friend.displayName} accepted your request`
      : "Friend request accepted",
    data: { friendUid: friend.uid },
  });
}

export async function notifyPing(
  toUid: string,
  from: { uid: string; displayName?: string | null },
  opts: { message?: string } = {}
) {
  await addNotification(toUid, {
    type: "ping",
    title: from.displayName
      ? `${from.displayName} pinged you`
      : "You were pinged",
    body: opts.message || "Log a meal to keep your streak alive.",
    data: { fromUid: from.uid },
  });
}

export async function notifyReaction(
  toUid: string,
  payload: {
    fromUid: string;
    fromName?: string | null;
    targetId: string;
    targetLabel?: string | null;
    kind: string;
  }
) {
  await addNotification(toUid, {
    type: "social:reaction",
    title: `${payload.fromName || "Someone"} reacted to your meal`,
    body: payload.targetLabel
      ? `${payload.kind.toUpperCase()} on “${payload.targetLabel}”`
      : `${payload.kind.toUpperCase()} reaction`,
    data: {
      fromUid: payload.fromUid,
      targetId: payload.targetId,
      targetLabel: payload.targetLabel ?? null,
      kind: payload.kind,
    },
  });
}

export async function notifyComment(
  toUid: string,
  payload: {
    fromUid: string;
    fromName?: string | null;
    targetId: string;
    targetLabel?: string | null;
    text: string;
  }
) {
  await addNotification(toUid, {
    type: "social:comment",
    title: `${payload.fromName || "Someone"} commented on your meal`,
    body: payload.targetLabel
      ? `"${payload.text.slice(0, 80)}" on “${payload.targetLabel}”`
      : payload.text.slice(0, 80),
    data: {
      fromUid: payload.fromUid,
      targetId: payload.targetId,
      targetLabel: payload.targetLabel ?? null,
      preview: payload.text.slice(0, 120),
    },
  });
}

// ───────────────────────── Premium “respectful” helpers ─────────────────────────
//
// These prevent spam by deduping recently-created notifications.
// Works without extra indexes by querying a small recent set.
//
// Default policy:
// - Ping: at most once per (fromUid -> toUid) every 6 hours
// - Friend request: at most once per (fromUid -> toUid) every 24 hours
//

async function hasRecentSimilar(
  toUid: string,
  type: NotificationType,
  predicate: (n: any) => boolean,
  windowMs: number,
  scanMax = 30
) {
  const snap = await getDocs(
    query(
      col(toUid),
      where("type", "==", type),
      orderBy("createdAt", "desc"),
      limit(scanMax)
    )
  );

  const now = Date.now();
  let found = false;

  snap.forEach((d) => {
    if (found) return;
    const x = d.data() as any;
    const createdMs =
      typeof x.createdAtMs === "number"
        ? x.createdAtMs
        : x.createdAt && typeof x.createdAt.toMillis === "function"
        ? x.createdAt.toMillis()
        : typeof x.createdAt === "number"
        ? x.createdAt
        : 0;

    if (!createdMs) return;
    if (now - createdMs > windowMs) return; // too old
    if (predicate(x)) found = true;
  });

  return found;
}

export async function notifyPingSafe(
  toUid: string,
  from: { uid: string; displayName?: string | null },
  opts: { cooldownHours?: number; message?: string } = {}
) {
  const cooldownMs = (opts.cooldownHours ?? 6) * 60 * 60 * 1000;

  let exists = false;
  try {
    exists = await hasRecentSimilar(
      toUid,
      "ping",
      (n) => n?.data?.fromUid === from.uid,
      cooldownMs
    );
  } catch {
    exists = false;
  }

  if (exists) return; // silently ignore to feel respectful

  await notifyPing(toUid, from, { message: opts.message });
}

export async function notifyFriendRequestSafe(
  toUid: string,
  from: { uid: string; email?: string | null; displayName?: string | null },
  opts: { cooldownHours?: number } = {}
) {
  const cooldownMs = (opts.cooldownHours ?? 24) * 60 * 60 * 1000;

  let exists = false;
  try {
    exists = await hasRecentSimilar(
      toUid,
      "friend:request",
      (n) => n?.data?.fromUid === from.uid,
      cooldownMs
    );
  } catch {
    exists = false;
  }

  if (exists) return;

  await notifyFriendRequest(toUid, from);
}
