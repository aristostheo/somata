import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";
import { getFriendVisibility, friendTrendLabel } from "@/services/friends/visibility";
import { withAlpha } from "@/lib/color";

export default function FriendProgressPage() {
  const { colors } = useTheme() as any;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; uid?: string; name?: string }>();
  const uid = String(params.id ?? params.uid ?? "");
  const name = String(params.name || "Friend");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeProfile(uid, setProfile);
  }, [uid]);

  const visibility = getFriendVisibility(profile);
  const enabled =
    visibility.enabled &&
    (visibility.progress?.consistencyStreak ||
      visibility.progress?.badgeCollection ||
      visibility.progress?.weeklyReportCard ||
      visibility.progress?.weightTrend);

  const trend = friendTrendLabel(profile);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, gap: 14 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: "800" }}>Back</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>Progress</Text>
        {!enabled ? (
          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: withAlpha(colors.text, 0.08), backgroundColor: colors.surface1, padding: 18, alignItems: "center", gap: 8 }}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>{name} hasn't shared progress</Text>
            <Text style={{ color: colors.muted, textAlign: "center", lineHeight: 18 }}>
              Progress sharing is private and controlled by your friend.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ borderRadius: 22, borderWidth: 1, borderColor: withAlpha(colors.text, 0.08), backgroundColor: colors.surface1, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Overview</Text>
              {visibility.progress?.consistencyStreak ? <Text style={{ color: colors.text, fontWeight: "800" }}>Consistency streak visible</Text> : null}
              {visibility.progress?.badgeCollection ? <Text style={{ color: colors.text, fontWeight: "800" }}>Badge collection visible</Text> : null}
              {visibility.progress?.weeklyReportCard ? <Text style={{ color: colors.text, fontWeight: "800" }}>Weekly report card visible</Text> : null}
              {visibility.progress?.weightTrend ? <Text style={{ color: colors.text, fontWeight: "800" }}>{trend || "On track"}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
