import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/content/ThemeProvider";

type QuickPreset = "push" | "quick" | "surprise";

export function CoachSparkCardPremium({
  contextLine,
  onOpen,
  onQuickPick,
}: {
  contextLine: string;
  onOpen: () => void;
  onQuickPick: (preset: QuickPreset) => void;
}) {
  const { colors } = useTheme();

  const chips: Array<{ key: QuickPreset; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: "push", label: "Push", icon: "barbell-outline" },
    { key: "quick", label: "Quick 20m", icon: "time-outline" },
    { key: "surprise", label: "Surprise me", icon: "shuffle-outline" },
  ];

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.accentSubtle,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={[colors.accentDim, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={16} color={colors.accentMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>AI Coach</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Ready to build your workout
          </Text>
        </View>
        <View
          style={[
            styles.generatePill,
            { borderColor: colors.accentSubtle, backgroundColor: colors.surface2 },
          ]}
        >
          <Text style={[styles.generateText, { color: colors.accentMuted }]}>Generate →</Text>
        </View>
      </View>

      <Text style={[styles.context, { color: colors.textTertiary }]}>{contextLine}</Text>

      <View style={styles.quickRow}>
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={(e) => {
              e.stopPropagation();
              onQuickPick(chip.key);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: pressed ? colors.accentDim : colors.surface2,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name={chip.icon} size={14} color={colors.textTertiary} />
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    gap: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "500" },
  subtitle: { fontSize: 12, fontWeight: "300", marginTop: 2 },
  generatePill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  generateText: { fontSize: 12, fontWeight: "500" },
  context: { fontSize: 12, fontWeight: "300", lineHeight: 18 },
  quickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: "400" },
});
