// components/profile/premium/BadgesPreviewCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "./GlassCard";
import { withAlpha } from "./ui";
import { BADGES } from "@/services/badges/registry";

export function BadgesPreviewCard(props: {
  onPressAll: () => void;
  unlockedCount?: number;
  previewIds?: string[]; // optional ids
}) {
  const { colors, isDark } = useTheme() as any;

  const unlocked = props.unlockedCount ?? 0;
  const previewBadges = useMemo(
    () =>
      (props.previewIds ?? [])
        .map((id) => BADGES.find((b) => b.id === id))
        .filter(Boolean)
        .slice(0, 3),
    [props.previewIds]
  );
  const hasPreview = previewBadges.length > 0;

  const pill = useMemo(() => {
    if (unlocked <= 0) return "Start your first badge";
    if (unlocked < 10) return "Building momentum";
    return "Strong collection";
  }, [unlocked]);

  return (
    <GlassCard>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
          Badges
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
          accessibilityLabel="Open badges"
        >
          <Ionicons
            name="chevron-forward-outline"
            size={16}
            color={colors.textTertiary}
          />
        </Pressable>
      </View>

      <Text style={{ color: colors.textTertiary, marginTop: 6, fontWeight: "300" }}>{pill}</Text>

      <View style={{ height: 12 }} />

      <View
        style={[
          styles.preview,
          { backgroundColor: withAlpha(colors.border, isDark ? 0.12 : 0.2) },
        ]}
      >
        {hasPreview ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {previewBadges.map((badge, idx) => (
              <View
                key={idx}
                style={[
                  styles.badgeDot,
                  {
                    backgroundColor: withAlpha(
                      badge!.accent ?? colors.primary,
                      isDark ? 0.25 : 0.16
                    ),
                    borderColor: withAlpha(
                      badge!.accent ?? colors.primary,
                      0.35
                    ),
                  },
                ]}
              >
                <Ionicons
                  name={(badge!.icon as any) ?? "ribbon-outline"}
                  size={16}
                  color={colors.text}
                />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{ alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Ionicons name="ribbon-outline" size={18} color={colors.muted} />
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "300" }}>
              No featured badges yet
          </Text>
          </View>
        )}
      </View>

      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 12, fontWeight: "300" }}>
        Unlocked:{" "}
        <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
          {unlocked}
        </Text>
      </Text>
      {hasPreview ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "400", marginTop: 6 }} numberOfLines={1}>
          Latest: {previewBadges[0]!.title}
        </Text>
      ) : null}
      <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4, fontWeight: "300", fontStyle: "italic" }}>
        {Math.max(1, 3 - (unlocked % 3))} away from next badge
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
  badgeDot: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
