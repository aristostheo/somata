import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { withAlpha } from "@/lib/color";

export type FriendCardChip = {
  key: string;
  label: string;
  tone?: "amber" | "green" | "purple" | "gray";
};

export function FriendRowPremium({
  displayName,
  uidLabel,
  activitySummary,
  accentColor,
  streakRingTone,
  nicknameMissing = false,
  onAddNickname,
  chips,
  canPing,
  pingCooldownLabel,
  onPress,
  onPing,
}: {
  displayName: string;
  uidLabel: string;
  activitySummary: string;
  accentColor: string;
  streakRingTone: "gray" | "green" | "gold";
  nicknameMissing?: boolean;
  onAddNickname?: () => void;
  chips: FriendCardChip[];
  canPing: boolean;
  pingCooldownLabel?: string;
  onPress: () => void;
  onPing: () => void;
}) {
  const { colors } = useProfileFlowTheme();

  const ringColor =
    streakRingTone === "gold"
      ? colors.warning
      : streakRingTone === "green"
      ? colors.success
      : "transparent";

  const chipsToRender = chips.slice(0, 3);

  return (
    <Pressable onPress={onPress}>
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
          <View
            style={[
              styles.avatarRing,
              { borderColor: ringColor, borderWidth: ringColor === "transparent" ? 0 : 2 },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: accentColor }]}>
              <Text style={[styles.avatarText, { color: colors.surface1 }]}>
                {(displayName || "F")[0]?.toUpperCase() || "F"}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {nicknameMissing ? (
                <Pressable onPress={onAddNickname}>
                  <Text style={[styles.nicknamePrompt, { color: colors.accent }]}>
                    Add nickname →
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.uid, { color: colors.textTertiary }]} numberOfLines={1}>
              {uidLabel}
            </Text>

            <View style={styles.summaryRow}>
              <Ionicons
                name="ellipse-outline"
                size={12}
                color={colors.textTertiary}
                style={{ marginTop: 1 }}
              />
              <Text
                style={[styles.summary, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {activitySummary}
              </Text>
            </View>

            <View style={[styles.rule, { backgroundColor: colors.border }]} />

            <View style={styles.chipsRow}>
              {chipsToRender.map((chip) => (
                <View
                  key={chip.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={onPing}
            hitSlop={10}
            style={[
              styles.pingButton,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={18}
              color={canPing ? colors.textSecondary : withAlpha(colors.textTertiary, 0.5)}
            />
            {pingCooldownLabel ? (
              <Text style={[styles.cooldown, { color: colors.textTertiary }]}>
                {pingCooldownLabel}
              </Text>
            ) : null}
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 0,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    flexShrink: 1,
  },
  nicknamePrompt: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  uid: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  summaryRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summary: {
    fontSize: 12,
    fontWeight: "300",
    flex: 1,
  },
  rule: {
    marginTop: 10,
    height: 1,
  },
  chipsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "400",
  },
  pingButton: {
    width: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 2,
  },
  cooldown: {
    fontSize: 9,
    fontWeight: "300",
    textAlign: "center",
  },
});
