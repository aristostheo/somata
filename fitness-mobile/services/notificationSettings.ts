import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  cancelAllNotifications,
  cancelNotification,
  scheduleDailyReminder,
} from "./notifications";

const KEY = "notification_settings";

export interface MealReminder {
  enabled: boolean;
  hour: number;
  minute: number;
  label: string;
}

export interface NotificationSettings {
  enabled: boolean;
  mealReminders: {
    enabled: boolean;
    breakfast: MealReminder;
    lunch: MealReminder;
    dinner: MealReminder;
    snack: MealReminder;
  };
  proteinReminder: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  streakReminder: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  friendPings: boolean;
  friendMilestones: boolean;
  goalHitAlerts: boolean;
  prAlerts: boolean;
  badgeAlerts: boolean;
  weeklyCheckinReminder: boolean;
  weeklySummary: {
    enabled: boolean;
    dayOfWeek: number;
    hour: number;
    minute: number;
  };
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  mealReminders: {
    enabled: true,
    breakfast: { enabled: true, hour: 8, minute: 0, label: "breakfast" },
    lunch: { enabled: true, hour: 12, minute: 30, label: "lunch" },
    dinner: { enabled: true, hour: 18, minute: 30, label: "dinner" },
    snack: { enabled: false, hour: 15, minute: 0, label: "snack" },
  },
  proteinReminder: { enabled: true, hour: 20, minute: 0 },
  streakReminder: { enabled: true, hour: 21, minute: 0 },
  friendPings: true,
  friendMilestones: true,
  goalHitAlerts: true,
  prAlerts: true,
  badgeAlerts: true,
  weeklyCheckinReminder: true,
  weeklySummary: { enabled: true, dayOfWeek: 0, hour: 9, minute: 0 },
};

function mergeSettings(
  base: NotificationSettings,
  raw: Partial<NotificationSettings> | null | undefined
): NotificationSettings {
  return {
    ...base,
    ...raw,
    mealReminders: {
      ...base.mealReminders,
      ...(raw?.mealReminders || {}),
      breakfast: {
        ...base.mealReminders.breakfast,
        ...(raw?.mealReminders?.breakfast || {}),
      },
      lunch: {
        ...base.mealReminders.lunch,
        ...(raw?.mealReminders?.lunch || {}),
      },
      dinner: {
        ...base.mealReminders.dinner,
        ...(raw?.mealReminders?.dinner || {}),
      },
      snack: {
        ...base.mealReminders.snack,
        ...(raw?.mealReminders?.snack || {}),
      },
    },
    proteinReminder: {
      ...base.proteinReminder,
      ...(raw?.proteinReminder || {}),
    },
    streakReminder: {
      ...base.streakReminder,
      ...(raw?.streakReminder || {}),
    },
    weeklySummary: {
      ...base.weeklySummary,
      ...(raw?.weeklySummary || {}),
    },
  };
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  await syncScheduledNotifications(settings);
}

export async function syncScheduledNotifications(
  settings: NotificationSettings
): Promise<void> {
  if (!settings.enabled) {
    await cancelAllNotifications();
    return;
  }

  const meals = settings.mealReminders;
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
  const mealMessages: Record<string, { title: string; body: string }> = {
    breakfast: {
      title: "Good morning",
      body: "Log your breakfast to start the day right.",
    },
    lunch: {
      title: "Lunch time",
      body: "Don't forget to log your lunch.",
    },
    dinner: {
      title: "Dinner reminder",
      body: "Log your dinner to stay on track.",
    },
    snack: {
      title: "Snack check",
      body: "Had a snack? Log it to keep your macros accurate.",
    },
  };

  for (const meal of mealTypes) {
    const reminder = meals[meal];
    const id = `meal_reminder_${meal}`;
    if (meals.enabled && reminder.enabled) {
      await scheduleDailyReminder({
        id,
        title: mealMessages[meal].title,
        body: mealMessages[meal].body,
        hour: reminder.hour,
        minute: reminder.minute,
        channelId: "reminders",
      });
    } else {
      await cancelNotification(id);
    }
  }

  if (settings.proteinReminder.enabled) {
    await scheduleDailyReminder({
      id: "protein_reminder",
      title: "Protein check",
      body: "Haven't hit your protein goal yet. One more high-protein meal can do it.",
      hour: settings.proteinReminder.hour,
      minute: settings.proteinReminder.minute,
      channelId: "goals",
    });
  } else {
    await cancelNotification("protein_reminder");
  }

  if (settings.streakReminder.enabled) {
    await scheduleDailyReminder({
      id: "streak_reminder",
      title: "Protect your streak",
      body: "Log one meal today to keep your streak alive.",
      hour: settings.streakReminder.hour,
      minute: settings.streakReminder.minute,
      channelId: "reminders",
    });
  } else {
    await cancelNotification("streak_reminder");
  }

  if (settings.weeklyCheckinReminder) {
    await scheduleDailyReminder({
      id: "weekly_checkin_probe",
      title: "Weekly check-in ready",
      body: "How was your week? Takes 2 minutes.",
      hour: 9,
      minute: 0,
      channelId: "reminders",
    });
  } else {
    await cancelNotification("weekly_checkin_probe");
  }
}
