// components/profile/premium/PremiumProfileHeader.tsx
import React, { useMemo } from "react";
import { Image, View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "./GlassCard";
import { withAlpha, clamp, fmt } from "./ui";

function PressScale({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const s = useSharedValue(1);

  const a = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));

  return (
    <Animated.View style={a}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          (s.value = withSpring(0.98, { damping: 18, stiffness: 260 }))
        }
        onPressOut={() =>
          (s.value = withSpring(1, { damping: 18, stiffness: 260 }))
        }
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function PremiumProfileHeader(props: {
  initials: string;
  name: string;
  subtitle: string;
  isPro: boolean;
  weightKg: number;
  targetWeightKg: number;
  unit: "kg" | "lb";
  goalType: "cut" | "maintain" | "lean_bulk" | "bulk";
  activityLevel: string;
  onToggleUnit: () => void;
  onPressSettings: () => void;
  onPressAvatar?: () => void;
  onPressAccount?: () => void;
  onPressGoPro: () => void;
  photoURL?: string | null;
  rightSlot?: React.ReactNode;
}) {
  const { colors } = useTheme();

  const goalLabel = useMemo(() => {
    if (props.goalType === "cut") return "Cut";
    if (props.goalType === "bulk") return "Lean bulk";
    return "Maintain";
  }, [props.goalType]);

  const unitWeight = useMemo(() => {
    if (!props.weightKg) return "--";
    return props.unit === "kg"
      ? `${fmt.num1(props.weightKg)} kg`
      : `${fmt.num1(props.weightKg * 2.20462)} lb`;
  }, [props.unit, props.weightKg]);

  const progress = useMemo(() => {
    // a gentle, non-judgment progress proxy:
    // closeness to target weight, capped
    const w = props.weightKg || 0;
    const t = props.targetWeightKg || 0;
    if (!w || !t) return 0.5;
    const dist = Math.abs(w - t);
    return clamp(1 - dist / 20, 0.15, 0.95);
  }, [props.weightKg, props.targetWeightKg]);
  const progressPct = Math.round(progress * 100);
  const momentumColor =
    progressPct >= 70 ? colors.accent : progressPct >= 40 ? colors.warning : colors.danger;

  return (
    <GlassCard style={{ padding: 0 }}>
      <View style={{ padding: 20, gap: 16 }}>
        <View style={styles.row}>
          <PressScale
            onPress={() => {
              Haptics.selectionAsync();
              props.onPressAvatar?.();
            }}
            accessibilityLabel="Change profile photo"
          >
            <View style={styles.avatar}>
              {props.photoURL ? (
                <Image source={{ uri: props.photoURL }} style={styles.avatarImg} />
              ) : (
                <Text
                  style={{ color: colors.surface1, fontWeight: "500", fontSize: 22 }}
                >
                  {props.initials}
                </Text>
              )}
              <View
                style={[
                  styles.cameraBadge,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={12} color={colors.muted} />
              </View>
            </View>
          </PressScale>

          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontWeight: "500", fontSize: 26 }}
              numberOfLines={1}
            >
              {props.name}
            </Text>
            <Text
              style={{
                color: colors.placeholder,
                marginTop: 4,
                fontSize: 12,
                fontWeight: "300",
                letterSpacing: 0.3,
              }}
              numberOfLines={1}
            >
              {props.subtitle}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", gap: 8 }}>
            {props.rightSlot ?? null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* {props.onPressAccount ? (
                <PressScale
                  onPress={() => {
                    Haptics.selectionAsync();
                    props.onPressAccount?.();
                  }}
                  accessibilityLabel="Open account"
                >
                  <View
                    style={[
                      styles.iconBtn,
                      {
                        backgroundColor: withAlpha(
                          colors.card,
                          isDark ? 0.2 : 0.55
                        ),
                        borderColor: withAlpha(colors.border, 0.65),
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={16}
                      color={colors.text}
                    />
                  </View>
                </PressScale>
              ) : null} */}
              <PressScale
                onPress={() => {
                  Haptics.selectionAsync();
                  props.onPressSettings();
                }}
                accessibilityLabel="Open settings"
              >
                <View
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={16}
                    color={colors.muted}
                  />
                </View>
              </PressScale>

              {!props.isPro && (
                <PressScale
                  onPress={() => {
                    Haptics.selectionAsync();
                    props.onPressGoPro();
                  }}
                  accessibilityLabel="Upgrade to Pro"
                >
                  <View
                    style={[
                      styles.proPill,
                      {
                        borderColor: withAlpha(colors.accent, 0.3),
                        backgroundColor: withAlpha(colors.accent, 0.12),
                      },
                    ]}
                  >
                    <Ionicons
                      name="diamond-outline"
                      size={14}
                      color={colors.accent}
                    />
                    <Text
                      style={{
                        color: colors.accent,
                        fontWeight: "500",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Pro
                    </Text>
                  </View>
                </PressScale>
              )}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View
            style={[
              styles.stat,
              { borderColor: colors.border, backgroundColor: colors.surface2 },
            ]}
          >
            <Text style={styles.label}>TODAY WEIGHT</Text>
            <Text
              style={{ color: colors.text, fontWeight: "300", marginTop: 8, fontSize: 26, letterSpacing: -0.8 }}
            >
              {unitWeight}
            </Text>
          </View>

          <View
            style={[
              styles.stat,
              { borderColor: colors.border, backgroundColor: colors.surface2 },
            ]}
          >
            <Text style={styles.label}>FOCUS</Text>
            <Text
              style={{ color: colors.text, fontWeight: "500", marginTop: 8, fontSize: 16 }}
            >
              {goalLabel}
            </Text>
          </View>

          <PressScale
            onPress={() => {
              Haptics.selectionAsync();
              props.onToggleUnit();
            }}
            accessibilityLabel="Toggle weight unit"
          >
            <View
              style={[
                styles.stat,
                { borderColor: colors.border, backgroundColor: colors.surface2 },
              ]}
            >
              <Text style={styles.label}>UNIT</Text>
              <Text
                style={{ color: colors.text, fontWeight: "500", marginTop: 8, fontSize: 16 }}
              >
                {props.unit.toUpperCase()}
              </Text>
            </View>
          </PressScale>
        </View>

        {/* calm progress line */}
        <View style={{ gap: 8 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>
              Momentum · {progressPct}%
            </Text>
            <Text style={{ color: momentumColor, fontSize: 12, fontWeight: "500" }}>
              {progressPct >= 70 ? "Strong" : progressPct >= 40 ? "Building" : "Needs attention"}
            </Text>
          </View>
          <View
            style={[
              styles.track,
              {
                backgroundColor: colors.inputBg,
              },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: momentumColor,
                  borderColor: "transparent",
                },
              ]}
            />
          </View>
          <Text style={{ color: colors.textTertiary, fontSize: 11, lineHeight: 18, fontWeight: "300" }}>
            Consistency score based on your last 7 days.
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "visible",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  proPill: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderWidth: 1,
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});
