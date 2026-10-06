// components/scanMeal/ScanMealHeader.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/content/ThemeProvider";

export default function ScanMealHeader({
  title,
  subtitle,
  onClose,
  onExplain,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onExplain: () => void;
}) {
  const { colors, isDark } = useTheme() as any;

  return (
    <LinearGradient
      colors={[
        "rgba(0,0,0,0.68)",
        isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.02)",
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.wrap}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
      >
        <Ionicons name="close" size={18} color={colors.text} />
      </Pressable>

      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle ? (
          <Text style={[styles.sub, { color: "rgba(255,255,255,0.68)" }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How it works"
        onPress={onExplain}
        style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={colors.text}
        />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "900" },
  sub: { marginTop: 2, fontSize: 12.5, fontWeight: "700" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
