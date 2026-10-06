import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import type { GoalInputs, MacroResult } from "@/services/macroCalculator";

function formatMode(mode?: GoalInputs["mode"]) {
  if (mode === "lean_bulk") return "Lean bulk";
  if (!mode) return "Maintain";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatPace(pace?: GoalInputs["pace"]) {
  if (!pace) return "Moderate";
  return pace.charAt(0).toUpperCase() + pace.slice(1).replace("_", " ");
}

export default function MacroGoalsCard({
  inputs,
  result,
  onPress,
}: {
  inputs?: GoalInputs | null;
  result?: MacroResult | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const modeLabel = formatMode(inputs?.mode);
  const paceLabel = formatPace(inputs?.pace);
  const calories = result?.dailyCalories ? `${Math.round(result.dailyCalories).toLocaleString()} kcal/day` : "Set up your targets";

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Open macro goals setup"
      style={({ pressed }) => ({
        opacity: pressed ? 0.94 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <View
        style={{
          backgroundColor: colors.surface1,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surface3,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="barbell-outline" size={18} color={colors.accentMuted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
            Macro goals
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {`${modeLabel} · ${paceLabel} · ${calories}`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}
