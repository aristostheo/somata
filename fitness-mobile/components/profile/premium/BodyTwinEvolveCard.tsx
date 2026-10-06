// components/profile/premium/BodyTwinEvolveCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "./GlassCard";
import { withAlpha, clamp, fmt } from "./ui";

/**
 * Premium “Body Twin” preview (no dependency on your old UI).
 * This is intentionally calm + abstract:
 * - a silhouette core
 * - 3 rings that “evolve” based on metrics & goal direction
 *
 * Later, if you want, you can swap the center for your real BodyTwinAvatar renderer.
 */
export function BodyTwinEvolveCard(props: {
  isDark: boolean;
  weightKg: number;
  targetWeightKg: number;
  unit: "kg" | "lb";
  heightCm: number;
  goalType: "cut" | "maintain" | "lean_bulk" | "bulk";
  trendHint: number; // negative means trending down
  onPressCustomize: () => void;
}) {
  const { colors, isDark } = useTheme() as any;

  const energy = useMemo(() => {
    // a stable, not-too-reactive evolution scalar
    const h = props.heightCm || 175;
    const w = props.weightKg || 75;
    const bmi = w / Math.pow(h / 100, 2);
    const norm = clamp((bmi - 18) / 14, 0, 1);
    const goalBias =
      props.goalType === "cut" ? 0.15 : props.goalType === "bulk" ? 0.25 : 0.2;
    const trendBias = clamp(Math.abs(props.trendHint) / 2.5, 0, 0.18);
    return clamp(norm * 0.65 + goalBias + trendBias, 0.12, 0.92);
  }, [props.heightCm, props.weightKg, props.goalType, props.trendHint]);

  const mood = useMemo(() => {
    if (props.goalType === "cut") return "Leaner form";
    if (props.goalType === "bulk") return "Stronger form";
    return "Balanced form";
  }, [props.goalType]);
  const progressPct = Math.round(energy * 100);
  const goalLabel = useMemo(() => {
    if (!props.targetWeightKg) return "Not set";
    return props.unit === "kg"
      ? `${fmt.num1(props.targetWeightKg)} kg`
      : `${fmt.num1(props.targetWeightKg * 2.20462)} lb`;
  }, [props.targetWeightKg, props.unit]);
  const ringSize = 118;
  const ringStroke = 4;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;

  return (
    <GlassCard>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
          Body Twin
        </Text>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            props.onPressCustomize();
          }}
          style={({ pressed }) => [
            styles.btn,
            {
              marginLeft: "auto",
              backgroundColor: colors.surface3,
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Customize Body Twin"
        >
          <Ionicons name="options-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      <Text style={{ color: colors.textTertiary, marginTop: 6, fontWeight: "300" }}>{mood}</Text>
      <Text style={{ color: colors.textTertiary, marginTop: 6, fontSize: 12, fontWeight: "300", fontStyle: "italic" }}>
        Updates as you log — not a daily critic.
      </Text>

      <View style={{ height: 12 }} />

      <View
        style={[
          styles.stage,
          { backgroundColor: withAlpha(colors.border, isDark ? 0.12 : 0.2) },
        ]}
      >
        <View style={styles.ringOuter}>
          <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={withAlpha(colors.accent, isDark ? 0.2 : 0.14)}
              strokeWidth={ringStroke}
              fill="transparent"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={colors.accent}
              strokeWidth={ringStroke}
              fill="transparent"
              strokeDasharray={`${ringCirc} ${ringCirc}`}
              strokeDashoffset={ringCirc * (1 - energy)}
              strokeLinecap="round"
              rotation="-90"
              originX={ringSize / 2}
              originY={ringSize / 2}
            />
          </Svg>
          <View
            style={[
              styles.ringMid,
              { borderColor: withAlpha(colors.accent, isDark ? 0.28 : 0.18) },
            ]}
          >
            <View
              style={[
                styles.ringInner,
                {
                  borderColor: withAlpha(colors.accent, isDark ? 0.22 : 0.14),
                },
              ]}
            >
              <View
                style={[
                  styles.core,
                  {
                    width: 62 + energy * 16,
                    height: 62 + energy * 16,
                    borderRadius: 22 + energy * 6,
                    backgroundColor: colors.surface3,
                    borderColor: withAlpha(colors.border, 0.7),
                  },
                ]}
              >
                <Ionicons name="person-outline" size={22} color={colors.textPrimary} />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 12 }} />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip
          label="Progress"
          value={`${progressPct}%`}
          subLabel="How close to your goal physique"
        />
        <Chip label="Goal" value={`Goal · ${goalLabel}`} />
      </View>
    </GlassCard>
  );
}

function Chip({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  const { colors } = useTheme() as any;
  return (
    <View style={styles.chip}>
      <Text style={{ color: colors.textTertiary, fontSize: 9, fontWeight: "400" }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 3 }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {subLabel ? (
        <Text style={{ color: colors.textTertiary, fontSize: 9, marginTop: 3, lineHeight: 12, fontWeight: "300" }} numberOfLines={2}>
          {subLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    height: 128,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ringOuter: {
    width: 118,
    height: 118,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ringMid: {
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 74,
    height: 74,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  core: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    padding: 8,
  },
});
