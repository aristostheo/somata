import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint?: string;
  onPress: () => void;
  color: string;
};

export function QuickActionRow({
  tokens,
  actions,
  maxWidth,
}: {
  tokens: {
    text: string;
    muted: string;
    hairline: string;
    card: string;
    tint: string;
    surface2?: string;
  };
  actions: QuickAction[];
  reduceMotion: boolean;
  maxWidth: number;
}) {
  const gap = 8;
  const cardWidth = Math.max(96, Math.floor((maxWidth - 32 - gap * 2) / 3));
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap,
      }}
    >
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          accessibilityHint={a.hint || "Activates action"}
          hitSlop={10}
          style={({ pressed }) => ({
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              width: cardWidth,
              minHeight: 96,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: tokens.hairline,
              backgroundColor: tokens.card,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.surface2 || tokens.card,
                borderWidth: 1,
                borderColor: tokens.hairline,
              }}
            >
              <Ionicons name={a.icon} size={18} color={tokens.tint} />
            </View>

            <Text
              style={{ color: tokens.text, fontWeight: "500", fontSize: 13 }}
              numberOfLines={2}
            >
              {a.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
