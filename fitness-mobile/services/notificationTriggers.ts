import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadNotificationSettings } from "./notificationSettings";
import { sendImmediateNotification } from "./notifications";

function todayKey() {
  return dayKey(new Date());
}

async function markIfFresh(key: string, cooldownMs = 18 * 60 * 60 * 1000) {
  const now = Date.now();
  const raw = await AsyncStorage.getItem(key);
  const last = Number(raw || 0);
  if (last && now - last < cooldownMs) return false;
  await AsyncStorage.setItem(key, String(now));
  return true;
}

export async function notifyFriendPing(friendName: string): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.friendPings) return;
  const fresh = await markIfFresh(`notif:friend_ping:${friendName}`, 60 * 60 * 1000);
  if (!fresh) return;
  await sendImmediateNotification({
    title: `${friendName} pinged you`,
    body: "A gentle nudge from your friend.",
    data: { type: "friend_ping", friendName },
  });
}

export async function notifyGoalHit(
  goalType: "calories" | "protein" | "steps" | "hydration"
): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.goalHitAlerts) return;
  const fresh = await markIfFresh(`notif:goal:${goalType}:${todayKey()}`, 20 * 60 * 60 * 1000);
  if (!fresh) return;
  const messages = {
    calories: {
      title: "Calorie goal hit",
      body: "You've hit your calorie target for today.",
    },
    protein: {
      title: "Protein goal hit",
      body: "Full protein goal reached. Great work.",
    },
    steps: {
      title: "Step goal hit",
      body: "You've hit your step goal for today.",
    },
    hydration: {
      title: "Hydration goal hit",
      body: "Well hydrated today. Keep it up.",
    },
  };
  await sendImmediateNotification({ ...messages[goalType], data: { type: goalType } });
}

export async function notifyNewPR(
  exercise: string,
  weight: string
): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.prAlerts) return;
  const fresh = await markIfFresh(`notif:pr:${exercise}:${weight}:${todayKey()}`, 20 * 60 * 60 * 1000);
  if (!fresh) return;
  await sendImmediateNotification({
    title: "New personal record",
    body: `${exercise} · ${weight}`,
    data: { type: "pr", exercise },
  });
}

export async function notifyBadgeEarned(badgeName: string): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.badgeAlerts) return;
  const fresh = await markIfFresh(`notif:badge:${badgeName}`, 20 * 60 * 60 * 1000);
  if (!fresh) return;
  await sendImmediateNotification({
    title: "Badge unlocked",
    body: `You earned: ${badgeName}`,
    data: { type: "badge", badgeName },
  });
}

export async function notifyWeeklyCheckin(): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.weeklyCheckinReminder) return;
  const week = new Date();
  const weekKey = `${week.getFullYear()}-${week.getMonth() + 1}-${week.getDate()}`;
  const fresh = await markIfFresh(`notif:weekly_checkin:${weekKey}`, 5 * 24 * 60 * 60 * 1000);
  if (!fresh) return;
  await sendImmediateNotification({
    title: "Weekly check-in ready",
    body: "How was your week? Takes 2 minutes.",
    data: { type: "weekly_checkin" },
  });
}
