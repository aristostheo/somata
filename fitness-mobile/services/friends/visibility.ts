import type { Profile } from "@/services/profile";

export type FriendVisibility = NonNullable<Profile["friendVisibility"]>;

export const DEFAULT_FRIEND_VISIBILITY: FriendVisibility = {
  enabled: true,
  nutrition: {
    mealsLoggedToday: true,
    dailyCaloriesTotal: false,
    macroBreakdown: false,
    streakStatus: true,
  },
  workouts: {
    workoutsLogged: true,
    workoutDetails: false,
    personalRecords: false,
    weeklyVolume: false,
  },
  progress: {
    consistencyStreak: true,
    badgeCollection: true,
    weeklyReportCard: false,
    weightTrend: false,
  },
  activity: {
    stepCount: false,
    cardioSessions: false,
  },
};

export function getFriendVisibility(profile: Profile | null | undefined): FriendVisibility {
  const v = profile?.friendVisibility || {};
  return {
    enabled: v.enabled ?? DEFAULT_FRIEND_VISIBILITY.enabled,
    nutrition: {
      ...DEFAULT_FRIEND_VISIBILITY.nutrition,
      ...(v.nutrition || {}),
    },
    workouts: {
      ...DEFAULT_FRIEND_VISIBILITY.workouts,
      ...(v.workouts || {}),
    },
    progress: {
      ...DEFAULT_FRIEND_VISIBILITY.progress,
      ...(v.progress || {}),
    },
    activity: {
      ...DEFAULT_FRIEND_VISIBILITY.activity,
      ...(v.activity || {}),
    },
  };
}

export function isFriendSharingAnything(profile: Profile | null | undefined) {
  const v = getFriendVisibility(profile);
  if (!v.enabled) return false;
  return Object.values({
    ...(v.nutrition || {}),
    ...(v.workouts || {}),
    ...(v.progress || {}),
    ...(v.activity || {}),
  }).some(Boolean);
}

export function friendTrendLabel(profile: Profile | null | undefined) {
  const v = getFriendVisibility(profile);
  if (!v.enabled || !v.progress?.weightTrend) return null;
  const weight = Number(profile?.weightKg || 0);
  const target = Number(profile?.targetWeightKg || 0);
  if (!weight || !target) return "On track";
  if (weight > target) return "Trending down ↓";
  if (weight < target) return "Trending up ↑";
  return "On track";
}
