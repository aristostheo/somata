// components/profile/v2/ProfileHero.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
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

export function ProfileHero({
  initials,
  name,
  email,
  completionPct,
  goal,
  activity,
  stepsGoal,
  unit,
  isPro,
  onGoPro,
  onToggleUnit,
  onAccount,
}: {
  initials: string;
  name: string | null;
  email: string | null;
  completionPct: number;
  goal: string;
  activity: string;
  stepsGoal: string;
  unit: "kg" | "lb";
  isPro: boolean;
  onGoPro: () => void;
  onToggleUnit: () => void;
  onAccount: () => void;
}) {
  const { colors, isDark } = useTheme();

  const StatPill = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onPress?: () => void;
  }) => (
    <Pressable onPress={onPress} style={{ flex: 1, minWidth: 150 }}>
      {({ pressed }) => (
        <View
          style={{
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, isDark ? 0.28 : 0.22),
            backgroundColor: withAlpha(colors.primary, pressed ? 0.16 : 0.1),
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(colors.primary, 0.18),
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.26),
            }}
          >
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
            >
              {label}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontSize: 15,
              }}
              numberOfLines={1}
            >
              {value}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={withAlpha(colors.text, 0.28)}
          />
        </View>
      )}
    </Pressable>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 340 }}
    >
      <LinearGradient
        colors={[
          withAlpha(colors.primary, isDark ? 0.26 : 0.18),
          withAlpha(colors.card, 0.92),
        ]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={{ borderRadius: 26, padding: 1 }}
      >
        <GlassSurface
          intensity={20}
          rounded={24}
          style={{
            padding: 16,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, isDark ? 0.32 : 0.55),
            overflow: "hidden",
          }}
        >
          {/* glossy sheen */}
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
              { transform: [{ rotate: "18deg" }], opacity: 0.85 },
            ]}
            pointerEvents="none"
          />

          {/* top row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <LinearGradient
              colors={[
                withAlpha(colors.primary, 0.55),
                withAlpha(colors.primary, 0.18),
              ]}
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.35),
              }}
            >
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}
              >
                {initials}
              </Text>
            </LinearGradient>

            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "950" as any,
                  fontSize: 20,
                }}
                numberOfLines={1}
              >
                {name || email || "Your profile"}
              </Text>
              <Text
                style={{ color: colors.muted, fontWeight: "700" }}
                numberOfLines={1}
              >
                Personalize targets, meals, and training.
              </Text>
            </View>

            <Pressable onPress={onAccount} hitSlop={10}>
              {({ pressed }) => (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: withAlpha(colors.primary, 0.32),
                    backgroundColor: withAlpha(
                      colors.primary,
                      pressed ? 0.18 : 0.1
                    ),
                  }}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
              )}
            </Pressable>
          </View>

          {/* completion */}
          <View style={{ marginTop: 14, gap: 8 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}
              >
                Profile completion
              </Text>
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
              >
                {completionPct}%
              </Text>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: 999,
                backgroundColor: withAlpha(colors.text, 0.06),
                overflow: "hidden",
                borderWidth: 1,
                borderColor: withAlpha(colors.border, isDark ? 0.28 : 0.55),
              }}
            >
              <LinearGradient
                colors={[withAlpha(colors.primary, 0.9), colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: `${completionPct}%`,
                  height: "100%",
                  borderRadius: 999,
                }}
              />
            </View>
          </View>

          {/* pro strip */}
          {!isPro ? (
            <Pressable onPress={onGoPro} style={{ marginTop: 14 }}>
              {({ pressed }) => (
                <View
                  style={{
                    borderRadius: 18,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.primary, 0.35),
                    backgroundColor: withAlpha(
                      colors.primary,
                      pressed ? 0.18 : 0.12
                    ),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: withAlpha(colors.primary, 0.18),
                        borderWidth: 1,
                        borderColor: withAlpha(colors.primary, 0.3),
                      }}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{ color: colors.text, fontWeight: "950" as any }}
                      >
                        Unlock Pro
                      </Text>
                      <Text
                        style={{ color: colors.muted, fontWeight: "700" }}
                        numberOfLines={1}
                      >
                        AI meals, workout generator, templates & more
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={withAlpha(colors.text, 0.35)}
                  />
                </View>
              )}
            </Pressable>
          ) : (
            <View
              style={{
                marginTop: 14,
                borderRadius: 18,
                padding: 12,
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.25),
                backgroundColor: withAlpha(colors.primary, 0.1),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Pro active
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontWeight: "800" }}>✓</Text>
            </View>
          )}

          {/* stat pills */}
          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <StatPill
              icon="scale-outline"
              label="Weight unit"
              value={unit.toUpperCase()}
              onPress={onToggleUnit}
            />
            <StatPill icon="flag-outline" label="Goal" value={String(goal)} />
            <StatPill
              icon="flash-outline"
              label="Activity"
              value={String(activity)}
            />
            <StatPill
              icon="walk-outline"
              label="Steps"
              value={`${stepsGoal || "—"}`}
            />
          </View>
        </GlassSurface>
      </LinearGradient>
    </MotiView>
  );
}
