import React, { useMemo } from "react";
import { View, Text, Pressable, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
}

export type AISuggestion = {
  id: string;
  title: string;
  body: string;
  pill?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

export function AISuggestionCard({
  tokens,
  suggestion,
  style,
  priority = "normal",
}: {
  tokens: {
    card: string;
    text: string;
    muted: string;
    hairline: string;
    tint: string;
    ringB: string;
    surface2?: string;
  };
  suggestion: AISuggestion;
  reduceMotion: boolean;
  style?: ViewStyle;
  priority?: "urgent" | "normal" | "secondary";
}) {
  const icon = suggestion.icon || "sparkles-outline";
  const accent = useMemo(
    () => (priority === "urgent" ? tokens.ringB : tokens.tint),
    [priority, tokens.ringB, tokens.tint]
  );
  const isAccentCard = priority !== "secondary";

  return (
    <View
      style={[
        {
          borderRadius: isAccentCard ? 24 : 20,
          borderWidth: 1,
          borderColor: isAccentCard ? withAlpha(accent, 0.2) : tokens.hairline,
          backgroundColor: isAccentCard ? withAlpha(accent, 0.08) : tokens.card,
          padding: 18,
          gap: 12,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.surface2 || withAlpha(accent, 0.08),
              borderWidth: 1,
              borderColor: isAccentCard ? withAlpha(accent, 0.18) : tokens.hairline,
            }}
          >
            <Ionicons name={icon} size={18} color={accent} />
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: tokens.text, fontWeight: "500", fontSize: 16 }}>
              {suggestion.title}
            </Text>
            {suggestion.pill ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: withAlpha(accent, 0.24),
                }}
              >
                <Text
                  style={{
                    color: accent,
                    fontWeight: "500",
                    fontSize: 11,
                    letterSpacing: 1,
                  }}
                >
                  {suggestion.pill.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {suggestion.onAction && suggestion.actionLabel ? (
          <Pressable
            onPress={suggestion.onAction}
            accessibilityRole="button"
            accessibilityLabel={suggestion.actionLabel}
            style={({ pressed }) => ({
              opacity: pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(accent, 0.18),
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ color: accent, fontWeight: "600", fontSize: 12 }}>
                {suggestion.actionLabel}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={accent} />
            </View>
          </Pressable>
        ) : null}
      </View>

      <Text
        style={{
          color: tokens.muted,
          fontWeight: "400",
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {suggestion.body}
      </Text>
    </View>
  );
}
