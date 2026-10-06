// components/settings/premium/ThemeModeSheet.tsx
// Drop-in ✅ Theme selector (Light / Dark / System) with local persistence

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withAlpha } from "@/lib/color";

export type ThemeMode = "system" | "dark" | "light";

export function ThemeModeSheet({
  value,
  onChange,
  colors,
  isDark,
}: {
  value: ThemeMode;
  onChange?: (m: ThemeMode) => void;
  colors: any;
  isDark: boolean;
}) {
  // Persistence belongs to ThemeProvider; this legacy sheet only reflects its value.
  const current = value;

  const items: Array<{
    key: ThemeMode;
    title: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      key: "system",
      title: "System",
      sub: "Matches your device",
      icon: "phone-portrait",
    },
    { key: "dark", title: "Dark", sub: "Glossy night mode", icon: "moon" },
    { key: "light", title: "Light", sub: "Bright and clean", icon: "sunny" },
  ];

  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => {
        const selected = current === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => {
              onChange?.(it.key);
            }}
            style={({ pressed }) => [
              styles.item,
              {
                borderColor: withAlpha(colors.text, isDark ? 0.12 : 0.14),
                backgroundColor: withAlpha(colors.text, selected ? 0.1 : 0.06),
                opacity: pressed ? 0.93 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.icon,
                {
                  backgroundColor: withAlpha(colors.text, isDark ? 0.08 : 0.06),
                },
              ]}
            >
              <Ionicons
                name={it.icon}
                size={18}
                color={withAlpha(colors.text, 0.9)}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14.5,
                  fontWeight: "800",
                }}
              >
                {it.title}
              </Text>
              <Text
                style={{
                  color: withAlpha(colors.text, isDark ? 0.62 : 0.7),
                  fontSize: 12.5,
                  marginTop: 2,
                }}
              >
                {it.sub}
              </Text>
            </View>

            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={
                selected
                  ? withAlpha(colors.accent ?? "#7c5cff", 0.95)
                  : withAlpha(colors.text, 0.35)
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
