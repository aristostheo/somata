import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";

export function RequestRowPremium({
  name,
  handle,
  subtitle,
  accentSeed,
  mode,
  onAccept,
  onDecline,
  onCancel,
  onOpenActions,
}: {
  name: string;
  handle?: string;
  subtitle?: string;
  accentSeed: string;
  mode: "incoming" | "sent";
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onOpenActions?: () => void;
}) {
  const { colors } = useProfileFlowTheme();
  const hue = Math.abs(
    accentSeed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  const avatarPalette = [
    colors.accent,
    colors.info || colors.accent,
    colors.success || colors.accent,
    colors.warning || colors.accent,
    colors.danger || colors.accent,
  ].filter(Boolean);
  const avatar = avatarPalette[hue % avatarPalette.length] || colors.accent;

  return (
    <Pressable onPress={onOpenActions}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: avatar }]}>
            <Text style={[styles.avatarText, { color: colors.surface1 }]}>
              {(name || "?")[0]?.toUpperCase() || "?"}
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            {handle ? (
              <Text style={[styles.handle, { color: colors.textTertiary }]} numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          {mode === "incoming" ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onAccept?.();
                }}
                style={[
                  styles.pillButton,
                  { borderColor: colors.success, backgroundColor: colors.surface2 },
                ]}
              >
                <Text style={[styles.pillText, { color: colors.success }]}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onDecline?.();
                }}
                style={[
                  styles.pillButton,
                  { borderColor: colors.danger, backgroundColor: colors.surface2 },
                ]}
              >
                <Text style={[styles.pillText, { color: colors.danger }]}>Decline</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCancel?.();
              }}
              style={styles.cancelWrap}
            >
              <Text style={[styles.cancelText, { color: colors.danger }]}>Cancel →</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
  },
  handle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "300",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  pillButton: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  cancelWrap: {
    justifyContent: "center",
    minHeight: 32,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "400",
  },
});
