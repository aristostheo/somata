import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "./GlassCard";
import { AnimatedRing } from "./AnimatedRing";

function withAlpha(color: string, alpha = 0.2) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(
    m[3],
    16
  )}, ${alpha})`;
}

export function NutritionSummaryCard({
  colors,
  isDark,
  goals,
  totals,
  onPressLog,
}: {
  colors: any;
  isDark: boolean;
  goals: { calories: number; protein: number; carbs: number; fat: number };
  totals: { calories: number; protein: number; carbs: number; fat: number };
  onPressLog: () => void;
}) {
  const remaining = Math.max(0, Math.round(goals.calories - totals.calories));

  return (
    <GlassCard colors={colors} isDark={isDark} radius={22} pad={14}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ borderRadius: 999, overflow: "hidden" }}>
            <AnimatedRing
              size={96}
              stroke={10}
              value={totals.calories}
              goal={goals.calories}
              trackColor={withAlpha(colors.border, 0.9)}
              fillColor={withAlpha(colors.primary, 0.95)}
              labelTop="Calories"
              labelBottom={`${Math.round(totals.calories)}`}
            />
          </View>

          <View style={{ gap: 8, flexShrink: 1 }}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
            >
              Daily goals
            </Text>
            <Text style={{ color: colors.muted, fontWeight: "800" }}>
              {remaining} kcal remaining
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              {[
                { k: "P", v: totals.protein, g: goals.protein },
                { k: "C", v: totals.carbs, g: goals.carbs },
                { k: "F", v: totals.fat, g: goals.fat },
              ].map((x) => (
                <View key={x.k} style={{ alignItems: "center" }}>
                  <AnimatedRing
                    size={46}
                    stroke={7}
                    value={x.v}
                    goal={x.g}
                    trackColor={withAlpha(colors.border, 0.9)}
                    fillColor={withAlpha(colors.primary, 0.85)}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "900",
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {x.k} {Math.round(x.v)}/{x.g}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log food"
          onPress={onPressLog}
          hitSlop={10}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.35),
            backgroundColor: withAlpha(colors.primary, 0.14),
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>Log</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}
