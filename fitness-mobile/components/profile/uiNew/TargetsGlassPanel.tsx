// components/profile/v2/TargetsGlassPanel.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/content/ThemeProvider";
import { GlassSurface } from "./GlassSurface";

const withAlpha = (hex: string, a = 0.18) => {
  const m = hex?.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16),
    g = parseInt(m[2], 16),
    b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

function formatVal(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Math.round(v).toLocaleString();
  return String(v);
}

export function TargetsGlassPanel({
  preview,
  fallback,
}: {
  preview:
    | null
    | {
        calorieGoal?: number;
        proteinGoal?: number;
        carbGoal?: number;
        fatGoal?: number;
      }
    | {
        training: {
          calorieGoal: number;
          proteinGoal: number;
          carbGoal: number;
          fatGoal: number;
        };
        rest: {
          calorieGoal: number;
          proteinGoal: number;
          carbGoal: number;
          fatGoal: number;
        };
      };
  fallback: {
    calories?: number | null | undefined;
    protein?: number | null | undefined;
    carbs?: number | null | undefined;
    fat?: number | null | undefined;
  };
}) {
  const { colors, isDark } = useTheme();

  const simple =
    preview && "calorieGoal" in (preview as any) ? (preview as any) : null;
  const training =
    preview && "training" in (preview as any)
      ? (preview as any).training
      : null;
  const rest =
    preview && "rest" in (preview as any) ? (preview as any).rest : null;

  const base = simple || training || rest || null;

  const Tile = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: any;
    unit: string;
  }) => (
    <View style={{ flex: 1, minWidth: 120 }}>
      <View
        style={{
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: withAlpha(colors.border, isDark ? 0.28 : 0.6),
          backgroundColor: withAlpha(colors.text, isDark ? 0.06 : 0.04),
        }}
      >
        <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}>
          {label}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 6,
            marginTop: 6,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontWeight: "950" as any,
              fontSize: 22,
            }}
          >
            {formatVal(value)}
          </Text>
          <Text
            style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}
          >
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={[
        withAlpha(colors.primary, isDark ? 0.22 : 0.16),
        withAlpha(colors.card, 0.92),
      ]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={{ borderRadius: 22, padding: 1 }}
    >
      <GlassSurface
        intensity={18}
        rounded={20}
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: withAlpha(colors.border, isDark ? 0.32 : 0.55),
        }}
      >
        {/* glossy highlight */}
        <LinearGradient
          colors={[
            "transparent",
            colors.surface2,
            "transparent",
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: "20deg" }], opacity: 0.85 },
          ]}
          pointerEvents="none"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontWeight: "950" as any,
              fontSize: 16,
            }}
          >
            Daily targets
          </Text>
          <Text
            style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}
          >
            Preview updates as you edit
          </Text>
        </View>

        {!base ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
            }}
          >
            <Tile label="Calories" value={fallback.calories || 0} unit="kcal" />
            <Tile label="Protein" value={fallback.protein || 0} unit="g" />
            <Tile label="Carbs" value={fallback.carbs || 0} unit="g" />
            <Tile label="Fat" value={fallback.fat || 0} unit="g" />
          </View>
        ) : training && rest ? (
          <>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: 12,
                marginTop: 12,
              }}
            >
              Training day
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 10,
              }}
            >
              <Tile label="Calories" value={training.calorieGoal} unit="kcal" />
              <Tile label="Protein" value={training.proteinGoal} unit="g" />
              <Tile label="Carbs" value={training.carbGoal} unit="g" />
              <Tile label="Fat" value={training.fatGoal} unit="g" />
            </View>

            <Text
              style={{
                color: colors.muted,
                fontWeight: "900",
                fontSize: 12,
                marginTop: 12,
              }}
            >
              Rest day
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 10,
              }}
            >
              <Tile label="Calories" value={rest.calorieGoal} unit="kcal" />
              <Tile label="Protein" value={rest.proteinGoal} unit="g" />
              <Tile label="Carbs" value={rest.carbGoal} unit="g" />
              <Tile label="Fat" value={rest.fatGoal} unit="g" />
            </View>
          </>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
            }}
          >
            <Tile
              label="Calories"
              value={(base as any).calorieGoal}
              unit="kcal"
            />
            <Tile label="Protein" value={(base as any).proteinGoal} unit="g" />
            <Tile label="Carbs" value={(base as any).carbGoal} unit="g" />
            <Tile label="Fat" value={(base as any).fatGoal} unit="g" />
          </View>
        )}
      </GlassSurface>
    </LinearGradient>
  );
}
