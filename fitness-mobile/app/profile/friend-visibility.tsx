import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/content/AuthContext";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import {
  DEFAULT_FRIEND_VISIBILITY,
  getFriendVisibility,
} from "@/services/friends/visibility";
import { withAlpha } from "@/lib/color";

type TogglePath =
  | "nutrition.mealsLoggedToday"
  | "nutrition.dailyCaloriesTotal"
  | "nutrition.macroBreakdown"
  | "nutrition.streakStatus"
  | "workouts.workoutsLogged"
  | "workouts.workoutDetails"
  | "workouts.personalRecords"
  | "workouts.weeklyVolume"
  | "progress.consistencyStreak"
  | "progress.badgeCollection"
  | "progress.weeklyReportCard"
  | "progress.weightTrend"
  | "activity.stepCount"
  | "activity.cardioSessions";

const GROUPS: Array<{
  title: string;
  rows: Array<{ path: TogglePath; label: string; detail: string; sensitive?: boolean }>;
}> = [
  {
    title: "Nutrition",
    rows: [
      { path: "nutrition.mealsLoggedToday", label: "Recent meals", detail: "Friends can browse your last 10 days of meal names and calorie totals, not ingredients" },
      { path: "nutrition.dailyCaloriesTotal", label: "Daily calorie total", detail: "Friends see your daily calorie total only" },
      { path: "nutrition.macroBreakdown", label: "Macro breakdown", detail: "Friends see protein, carbs, and fat totals" },
      { path: "nutrition.streakStatus", label: "Streak status", detail: "Friends see whether you're on a streak" },
    ],
  },
  {
    title: "Workouts",
    rows: [
      { path: "workouts.workoutsLogged", label: "Workouts logged", detail: "Friends see when you logged a workout" },
      { path: "workouts.workoutDetails", label: "Workout names and details", detail: "Friends see workout titles and exercise details" },
      { path: "workouts.personalRecords", label: "Personal records (PRs)", detail: "Friends see PR moments and record badges" },
      { path: "workouts.weeklyVolume", label: "Weekly volume", detail: "Friends see your weekly training volume trend" },
    ],
  },
  {
    title: "Progress",
    rows: [
      { path: "progress.consistencyStreak", label: "Consistency streak", detail: "Friends see your consistency streak" },
      { path: "progress.badgeCollection", label: "Badge collection", detail: "Friends see earned badges and badge count" },
      { path: "progress.weeklyReportCard", label: "Weekly report card", detail: "Friends see your weekly report summary" },
      { path: "progress.weightTrend", label: "Weight / body metrics", detail: "Friends only see a directional trend like Trending down ↓", sensitive: true },
    ],
  },
  {
    title: "Activity",
    rows: [
      { path: "activity.stepCount", label: "Step count", detail: "Friends see daily steps and step trends" },
      { path: "activity.cardioSessions", label: "Cardio sessions", detail: "Friends see cardio session logs" },
    ],
  },
];

function setNested(obj: any, path: string, value: boolean) {
  const [group, key] = path.split(".");
  return {
    ...obj,
    [group]: {
      ...(obj[group] || {}),
      [key]: value,
    },
  };
}

export default function FriendVisibilityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useProfileFlowTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedToast, setSavedToast] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  const visibility = useMemo(() => getFriendVisibility(profile), [profile]);

  const savePatch = async (patch: any) => {
    if (!user?.uid) return;
    await updateProfile(user.uid, patch);
    setSavedToast("Saved");
    setTimeout(() => setSavedToast(""), 1200);
    Haptics.selectionAsync().catch(() => {});
  };

  const toggleMaster = async (value: boolean) => {
    await savePatch({
      friendVisibility: {
        ...visibility,
        enabled: value,
      },
    });
  };

  const toggleRow = async (path: TogglePath, value: boolean, sensitive?: boolean) => {
    if (sensitive && value) {
      Alert.alert(
        "Share weight trend?",
        "This will share a directional trend with friends. Raw weight numbers are never shown.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Share", onPress: () => savePatch({ friendVisibility: setNested(visibility, path, value) }) },
        ]
      );
      return;
    }
    await savePatch({ friendVisibility: setNested(visibility, path, value) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlowAtmosphere />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 18, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: "600" }}>Back</Text>
        </Pressable>

        <View>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 30 }}>Friend Visibility</Text>
          <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>
            Control what your friends can see. Changes apply immediately.
          </Text>
        </View>

        {savedToast ? (
          <View style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.18), borderWidth: 1, borderColor: withAlpha(colors.primary, 0.32), paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{savedToast}</Text>
          </View>
        ) : null}

        <View style={{ borderRadius: 18, backgroundColor: colors.surface1, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>Share activity with friends</Text>
              <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>
                When off, friends see nothing while this is off.
              </Text>
            </View>
            <Switch value={!!visibility.enabled} onValueChange={toggleMaster} />
          </View>
          {!visibility.enabled ? (
            <View style={{ borderRadius: 16, padding: 12, backgroundColor: withAlpha(colors.text, 0.05), borderWidth: 1, borderColor: withAlpha(colors.text, 0.08) }}>
              <Text style={{ color: colors.muted, fontWeight: "800" }}>
                Friends see nothing while this is off.
              </Text>
            </View>
          ) : null}
        </View>

        {GROUPS.map((group) => (
          <View key={group.title} style={{ paddingVertical: 8, gap: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" }}>
              {group.title}
            </Text>
            {group.rows.map((row) => {
              const [a, b] = row.path.split(".");
              const value = !!(visibility as any)?.[a]?.[b];
              return (
                <View key={row.path} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: visibility.enabled ? 1 : 0.45, minHeight: 56, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.text, 0.07) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14.5 }}>{row.label}</Text>
                    <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>{row.detail}</Text>
                  </View>
                  <Pressable
                    onPress={() => Alert.alert("Friend preview", row.detail)}
                    style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.muted} />
                  </Pressable>
                  <Switch disabled={!visibility.enabled} value={value} onValueChange={(next) => toggleRow(row.path, next, row.sensitive)} />
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push("/friends/preview" as any)}
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: withAlpha(colors.primary, pressed ? 0.16 : 0.1),
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Preview my profile as a friend →</Text>
          </Pressable>
          <Pressable
            onPress={() => savePatch({ friendVisibility: DEFAULT_FRIEND_VISIBILITY })}
            style={{ alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 }}
          >
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Reset to defaults →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
