// components/bodyTwin/AvatarStage.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";
import { SKIN_TONE_COLORS } from "@/lib/skinTones";
import type {
  ShapeParams,
  BodyTwinStyle,
} from "@/services/profile/bodyTwin/new/types";

function toneColor(tone: BodyTwinStyle["skinTone"]) {
  // Subtle tints; no "beauty" implication-just personalization.
  return SKIN_TONE_COLORS[tone as string] ?? SKIN_TONE_COLORS.default;
}

export function AvatarStage({
  shape,
  style,
  futureShape,
  modeLabel,
}: {
  shape: ShapeParams;
  style: BodyTwinStyle;
  futureShape?: ShapeParams; // if provided, show "ghost outline"
  modeLabel?: string; // "Now", "Then", "Future"
}) {
  const { colors, isDark } = useTheme();

  // breathing glow
  const breath = useSharedValue(0);
  React.useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.22 + 0.18 * breath.value,
      transform: [{ scale: 1 + 0.02 * breath.value }],
    };
  });

  const avatar = useMemo(() => {
    // Visual mapping (non-judgmental)
    const size = 160 + shape.mass * 70;
    const waist = 0.85 - shape.waist * 0.25; // smaller waist => more taper
    const shoulder = 0.9 + shape.shoulders * 0.25;

    return { size, waist, shoulder };
  }, [shape]);

  const future = useMemo(() => {
    if (!futureShape) return null;
    const size = 160 + futureShape.mass * 70;
    const waist = 0.85 - futureShape.waist * 0.25;
    const shoulder = 0.9 + futureShape.shoulders * 0.25;
    return { size, waist, shoulder };
  }, [futureShape]);

  const accent = colors.accent;
  const cardBg = withAlpha(
    colors.card,
    isDark ? 0.25 : 0.65
  );

  return (
    <View style={styles.wrap}>
      <BlurView
        intensity={22}
        tint={isDark ? "dark" : "light"}
        style={[styles.card, { backgroundColor: cardBg }]}
      >
        {/* top label */}
        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Ionicons
              name="sparkles"
              size={14}
              color={withAlpha(colors.text, 0.9)}
            />
            <Text
              style={[styles.pillText, { color: withAlpha(colors.text, 0.92) }]}
            >
              {modeLabel ?? "Body Twin"}
            </Text>
          </View>

          <View style={[styles.pill, { opacity: 0.9 }]}>
            <Ionicons
              name="shield-checkmark"
              size={14}
              color={withAlpha(colors.text, 0.85)}
            />
            <Text
              style={[styles.pillText, { color: withAlpha(colors.text, 0.86) }]}
            >
              Companion mode
            </Text>
          </View>
        </View>

        {/* stage */}
        <View style={styles.stage}>
          <Animated.View style={[styles.glowRing, glowStyle]}>
            <LinearGradient
              colors={[
                withAlpha(accent, 0.0),
                withAlpha(accent, 0.24),
                withAlpha(accent, 0.0),
              ]}
              start={{ x: 0.2, y: 0.2 }}
              end={{ x: 0.8, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* concentric rings */}
          <View
            style={[styles.ring, { borderColor: withAlpha(accent, 0.2) }]}
          />
          <View
            style={[styles.ring2, { borderColor: withAlpha(accent, 0.14) }]}
          />
          <View
            style={[styles.ring3, { borderColor: withAlpha(accent, 0.1) }]}
          />

          {/* future outline */}
          {future && (
            <View
              style={[
                styles.avatarShell,
                {
                  width: future.size,
                  height: future.size,
                  borderRadius: future.size / 2,
                  borderColor: withAlpha(accent, 0.28),
                  borderStyle: "dashed",
                  opacity: 0.65,
                },
              ]}
            />
          )}

          {/* avatar body */}
          <View
            style={[
              styles.avatarShell,
              {
                width: avatar.size,
                height: avatar.size,
                borderRadius: avatar.size / 2,
                borderColor: withAlpha(colors.text, isDark ? 0.12 : 0.1),
                backgroundColor: withAlpha(colors.card, isDark ? 0.14 : 0.35),
              },
            ]}
          >
            {/* "person" (simple iconic silhouette) */}
            <View style={styles.silhouetteWrap}>
              <View
                style={[
                  styles.head,
                  {
                    backgroundColor: withAlpha(toneColor(style.skinTone), 0.95),
                    borderColor: withAlpha(colors.text, isDark ? 0.1 : 0.12),
                  },
                ]}
              />
              <View
                style={[
                  styles.torso,
                  {
                    backgroundColor: isDark ? "rgba(11,14,20,0.2)" : "rgba(11,14,20,0.1)",
                    borderColor: withAlpha(colors.text, isDark ? 0.08 : 0.1),
                    transform: [
                      { scaleX: avatar.shoulder },
                      { scaleY: avatar.waist },
                    ],
                  },
                ]}
              />
              <Text
                style={[styles.hint, { color: withAlpha(colors.text, 0.62) }]}
              >
                updates gently
              </Text>
            </View>
          </View>

          {/* bottom soft gradient */}
          <LinearGradient
            colors={[
              "transparent",
              isDark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.1)",
            ]}
            style={[styles.fadeBottom]}
          />
        </View>

        {/* emotionally safe microcopy */}
        <Text
          style={[styles.safeCopy, { color: withAlpha(colors.text, 0.74) }]}
        >
          A visual companion - not a critic. It changes slowly so you don't feel
          watched.
        </Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  card: {
    borderRadius: 26,
    overflow: "hidden",
    padding: 14,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pillText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  stage: {
    height: 260,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  ring: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
  },
  ring2: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
  },
  ring3: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 2,
  },
  avatarShell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  silhouetteWrap: { alignItems: "center", justifyContent: "center" },
  head: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    marginBottom: 10,
  },
  torso: {
    width: 90,
    height: 92,
    borderRadius: 28,
    borderWidth: 1,
  },
  hint: { marginTop: 10, fontSize: 12, fontWeight: "600" },
  fadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  safeCopy: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 2,
    fontWeight: "600",
  },
});
