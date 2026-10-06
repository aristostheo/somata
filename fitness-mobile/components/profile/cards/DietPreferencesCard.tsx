// components/profile/premium/DietPreferencesCard.tsx
// Drop-in ✅
// Premium Profile card: Diet Preferences
// Depends on: expo-haptics, @expo/vector-icons, your ThemeProvider, GlassCard, withAlpha

import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "@/components/profile/premium/GlassCard";
import { withAlpha } from "@/components/profile/premium/ui";
import {
  type DietPreferences,
  computeDietPrefsCompletion,
  summarizeDietPrefs,
} from "@/services/profile/dietPreferences";

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "muted" | "good" | "warn";
}) {
  const { colors } = useTheme();

  const bg =
    tone === "good"
      ? colors.accentDim
      : tone === "warn"
      ? withAlpha(colors.warning, 0.16)
      : withAlpha(colors.border, 0.22);

  const border =
    tone === "good"
      ? colors.accentSubtle
      : tone === "warn"
      ? withAlpha(colors.warning, 0.35)
      : withAlpha(colors.border, 0.55);

  const text =
    tone === "good"
      ? colors.accentMuted
      : tone === "warn"
      ? colors.text
      : colors.muted;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
      >
      <Text style={{ color: text, fontWeight: "500", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

export function DietPreferencesCard({
  value,
  onPress,
}: {
  value?: DietPreferences | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const completion = useMemo(() => computeDietPrefsCompletion(value), [value]);
  const summary = useMemo(() => summarizeDietPrefs(value), [value]);

  const status =
    completion.state === "empty"
      ? { label: "Set up", tone: "muted" as const }
      : completion.state === "complete"
      ? { label: "Personalized", tone: "good" as const }
      : { label: "In progress", tone: "warn" as const };

  const meterW = Math.max(0.06, Math.min(1, completion.pct || 0));

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="Edit diet preferences"
    >
      <GlassCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: colors.surface3,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="leaf-outline" size={20} color={colors.accentMuted} />
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
              >
                Diet Preferences
              </Text>
              <Pill label={status.label} tone={status.tone} />
            </View>

            <Text
              style={{ color: colors.muted, fontSize: 12.5, lineHeight: 17 }}
            >
              {summary}
            </Text>

            {/* subtle completion meter */}
            <View
              style={{
                marginTop: 6,
                height: 8,
                borderRadius: 999,
                backgroundColor: withAlpha(colors.border, 0.22),
                borderWidth: 1,
                borderColor: withAlpha(colors.border, 0.35),
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.round(meterW * 100)}%`,
                  height: "100%",
                  backgroundColor: withAlpha(colors.primary, 0.35),
                }}
              />
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>

        <Text
          style={{
            marginTop: 10,
            color: colors.muted,
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          Help us suggest meals that fit you. No “good/bad” foods — just your
          preferences.
        </Text>
      </GlassCard>
    </Pressable>
  );
}
