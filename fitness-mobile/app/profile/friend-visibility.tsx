import { Button, Heading, Panel, TaskPage, Toggle } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Text,
  View
} from "react-native";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import {
  DEFAULT_FRIEND_VISIBILITY,
  getSavedFriendVisibility,
} from "@/services/friends/visibility";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";

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
  rows: Array<{ path: TogglePath; label: string; detail: string; sensitive?: boolean; }>;
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
        { path: "workouts.personalRecords", label: "Personal records (PRs)", detail: "Unavailable in summaries until verified personal records are stored" },
        { path: "workouts.weeklyVolume", label: "Weekly volume", detail: "Friends see your weekly training volume trend" },
      ],
    },
    {
      title: "Progress",
      rows: [
        { path: "progress.consistencyStreak", label: "Consistency streak", detail: "Friends see your consistency streak" },
        { path: "progress.badgeCollection", label: "Badge collection", detail: "Friends see the account-recorded badge count; device-only badges are not shared" },
        { path: "progress.weeklyReportCard", label: "Weekly report card", detail: "Unavailable in summaries until a verified report is stored" },
        { path: "progress.weightTrend", label: "Weight / body metrics", detail: "Friends only see a directional trend like Trending down ↓", sensitive: true },
      ],
    },
    {
      title: "Activity",
      rows: [
        { path: "activity.stepCount", label: "Step count", detail: "Friends see daily steps and step trends" },
        { path: "activity.cardioSessions", label: "Cardio sessions", detail: "Unavailable in summaries until account timezone and a safe cardio summary are supported" },
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
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useProfileFlowTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState("");

  useEffect(() => {
    setProfile(null);
    if (!user?.uid) return;
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  const visibility = useMemo(() => getSavedFriendVisibility(profile), [profile]);

  const savePatch = async (patch: any) => {
    if (!user?.uid) return;
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile(user.uid, patch);
      setSavedToast("Saved");
      setTimeout(() => setSavedToast(""), 1200);
      Haptics.selectionAsync().catch(() => {});
    } catch { Alert.alert("Could not save sharing choices", "Your previous choices remain in effect. Try again."); }
    finally { setSaving(false); }
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

  return (<TaskPage title="Share on your terms" section="Friend visibility" subtitle="Only saved, enabled fields can be shared. In Friends, separately approve each person who may see them. Changes save immediately." onBack={() => router.back()}>

    <Panel accent>
      <Toggle title="Share activity with friends" detail={visibility.enabled ? 'Choose the details below.' : 'Friends see nothing while sharing is off.'} disabled={saving || !profile} value={!!visibility.enabled} onChange={toggleMaster} />
    </Panel>
    {!!savedToast && <Text accessibilityLiveRegion="polite" style={F.body}>{savedToast}</Text>}

    {GROUPS.map(g => <View key={g.title} style={{ gap: 12 }}>
      <Heading title={g.title} />
      {g.rows.map(row => {
        const [a, b] = row.path.split('.'); return <View key={row.path}>
          <Toggle title={row.label} detail={row.detail} value={!!(visibility as any)?.[a]?.[b]} disabled={!visibility.enabled || saving || !profile} onChange={next => toggleRow(row.path, next, row.sensitive)} />
          <Button label={`Preview ${row.label.toLowerCase()}`} onPress={() => Alert.alert('Friend preview', row.detail)} />
        </View>;
      })}
    </View>)}

    <Button primary label="Preview my shared profile" onPress={() => router.push('/friends/preview')} />
    <Button danger label="Reset sharing to defaults" disabled={saving || !profile} onPress={() => savePatch({ friendVisibility: DEFAULT_FRIEND_VISIBILITY })} />
  </TaskPage>
  );
}
