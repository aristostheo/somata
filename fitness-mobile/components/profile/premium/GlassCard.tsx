// components/profile/premium/GlassCard.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/content/ThemeProvider";

export function GlassCard({
  children,
  style,
  intensity = 18,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <BlurView
        intensity={intensity}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: "hidden" },
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
});
