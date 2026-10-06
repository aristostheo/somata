// components/profile/premium/FriendsPreviewCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "./GlassCard";
import { withAlpha } from "./ui";

export function FriendsPreviewCard(props: {
  onPressAll: () => void;
  friendsCount?: number;
  streakPings?: number;
  previewFriends?: Array<{ name?: string | null; email?: string | null }>;
}) {
  const { colors, isDark } = useTheme() as any;

  const friends = props.friendsCount ?? 0;
  const pings = props.streakPings ?? 0;
  const previewFriends = props.previewFriends ?? [];
  const hues = [colors.accent, colors.info, colors.warning, colors.success, colors.danger];

  const subtitle = useMemo(() => {
    if (friends <= 0) return "Add supportive friends";
    if (pings > 0)
      return `${pings} gentle ping${pings === 1 ? "" : "s"} waiting`;
    return "Quiet support";
  }, [friends, pings]);

  return (
    <GlassCard>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
          Friends
        </Text>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            props.onPressAll();
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              marginLeft: "auto",
              backgroundColor: colors.surface3,
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open friends"
        >
          <Ionicons
            name="chevron-forward-outline"
            size={16}
            color={colors.textTertiary}
          />
        </Pressable>
      </View>

      <Text style={{ color: colors.textTertiary, marginTop: 6, fontWeight: "300" }}>{subtitle}</Text>

      <View style={{ height: 12 }} />

      <View
        style={[
          styles.preview,
          { backgroundColor: withAlpha(colors.border, isDark ? 0.12 : 0.2) },
        ]}
      >
          {friends > 0 ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {(previewFriends.length
              ? previewFriends
              : Array.from({ length: Math.min(3, friends) }).map(() => null)
            )
              .slice(0, 3)
              .map((f, idx) => {
                const seed = f?.name || f?.email || "Friend";
                const parts = seed
                  .replace(/@.*/, "")
                  .split(/\s|[._-]/)
                  .filter(Boolean);
                const initials = `${(parts[0]?.[0] || "F").toUpperCase()}${
                  (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase()
                }`;
                return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: withAlpha(
                      hues[idx % hues.length],
                      isDark ? 0.24 : 0.16
                    ),
                    borderColor: withAlpha(hues[idx % hues.length], 0.42),
                  },
                ]}
              >
                {initials.trim() ? (
                  <Text style={{ color: colors.surface1, fontWeight: "500" }}>
                    {initials}
                  </Text>
                ) : (
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={colors.text}
                  />
                )}
              </View>
                );
              })}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                props.onPressAll();
              }}
              style={({ pressed }) => ({
                minHeight: 34,
                paddingHorizontal: 10,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: colors.border,
              })}
              accessibilityRole="button"
              accessibilityLabel="Invite a friend"
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "400", fontSize: 12 }}>
                + Invite
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{ alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Ionicons name="people-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "300" }}>
              No friends yet
            </Text>
          </View>
        )}
      </View>

      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 12, fontWeight: "300" }}>
        Friends:{" "}
        <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>{friends}</Text>
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    height: 92,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
