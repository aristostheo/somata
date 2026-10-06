// components/scanMeal/BottomActionBar.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/content/ThemeProvider";

export default function BottomActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
}: {
  primaryLabel: string;
  onPrimary?: (() => void) | undefined;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: (() => void) | undefined;
  tertiaryLabel?: string;
  onTertiary?: (() => void) | undefined;
}) {
  const { colors, isDark } = useTheme() as any;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: isDark ? "rgba(8,10,16,0.86)" : "rgba(255,255,255,0.92)" },
      ]}
    >
      <View style={styles.row}>
        {secondaryLabel && onSecondary ? (
          <Pressable
            onPress={onSecondary}
            style={({ pressed }) => [
              styles.secondary,
              {
                backgroundColor: "rgba(255,255,255,0.08)",
                opacity: pressed ? 0.82 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              {secondaryLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onPrimary}
          disabled={!onPrimary || primaryDisabled}
          style={({ pressed }) => [
            styles.primary,
            {
              opacity: !onPrimary || primaryDisabled ? 0.75 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={
              !onPrimary || primaryDisabled
                ? ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.08)"]
                : ["rgba(56,189,248,0.98)", colors.primary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryFill}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {tertiaryLabel && onTertiary ? (
        <Pressable
          onPress={onTertiary}
          style={styles.tertiary}
          accessibilityRole="button"
        >
          <Text style={[styles.tertiaryText, { color: colors.muted }]}>
            {tertiaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 22 : 14,
  },
  row: { flexDirection: "row", gap: 10 },
  secondary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 13.5, fontWeight: "900" },
  primary: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  primaryFill: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 13.5, fontWeight: "900", color: "white" },
  tertiary: { marginTop: 10, alignItems: "center" },
  tertiaryText: { fontSize: 12.5, fontWeight: "700" },
});
