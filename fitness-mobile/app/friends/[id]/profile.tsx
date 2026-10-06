import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";
import { friendTrendLabel, getFriendVisibility, isFriendSharingAnything } from "@/services/friends/visibility";
import { withAlpha } from "@/lib/color";

export default function FriendProfilePage() {
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
  const sharing = isFriendSharingAnything(profile);
  const rows = useMemo(() => {
    if (!visibility.enabled) return [];
    return [
      visibility.progress?.consistencyStreak ? "Consistency streak visible" : null,
      visibility.progress?.badgeCollection ? "Badge count visible" : null,
      visibility.nutrition?.mealsLoggedToday ? "Recent meals visible" : null,
      visibility.workouts?.workoutsLogged ? "Workout activity visible" : null,
      visibility.activity?.stepCount ? "Step activity visible" : null,
      visibility.progress?.weightTrend ? friendTrendLabel(profile) : null,
    ].filter(Boolean) as string[];
  }, [profile, visibility]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, gap: 14 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: "800" }}>Back</Text>
        </Pressable>
        <View style={{ borderRadius: 22, borderWidth: 1, borderColor: withAlpha(colors.text, 0.08), backgroundColor: colors.surface1, padding: 16, gap: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.18), alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{name[0]?.toUpperCase() || "F"}</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>{name}</Text>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>Private connection</Text>
        </View>
        <View style={{ borderRadius: 22, borderWidth: 1, borderColor: withAlpha(colors.text, 0.08), backgroundColor: colors.surface1, padding: 16, gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Shared with you
          </Text>
          {!sharing ? (
            <Text style={{ color: colors.muted, lineHeight: 18 }}>No activity shared</Text>
          ) : (
            rows.map((row) => (
              <Text key={row} style={{ color: colors.text, fontWeight: "800" }}>
                {row}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
