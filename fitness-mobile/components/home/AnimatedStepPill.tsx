import React, { useMemo } from "react";
import { View, Text, Pressable, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";

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

export function AnimatedStepPill({
  tokens,
  steps,
  goal,
  moveMin,
  reduceMotion,
  onPress,
  style,
}: {
  tokens: {
    card: string;
    text: string;
    muted: string;
    hairline: string;
    tint: string;
    good: string;
    surface2?: string;
  };
  steps: number;
  goal: number;
  moveMin: number;
  reduceMotion: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const pct = useMemo(
    () => clamp01(goal <= 0 ? 0 : steps / goal),
    [steps, goal]
  );
  const pctLabel = steps <= 0 ? "Start moving" : `${Math.round(pct * 100)}%`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Steps ${steps} of ${goal}. ${pctLabel}. Move minutes ${moveMin}.`}
      accessibilityHint="Opens activity details"
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={[
          {
            borderRadius: 20,
            borderWidth: 1,
            borderColor: tokens.hairline,
            backgroundColor: tokens.card,
            height: 128,
            padding: 18,
            justifyContent: "space-between",
          },
          style,
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: tokens.muted,
              fontWeight: "500",
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            STEPS
          </Text>
          <Text
            style={{
              color: tokens.muted,
              fontWeight: "300",
              fontSize: 11,
              letterSpacing: 0.3,
            }}
          >
            {pctLabel}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: tokens.text,
                fontWeight: "300",
                fontSize: 34,
                letterSpacing: -1.1,
              }}
            >
              {steps.toLocaleString()}
            </Text>
            <Text
              style={{
                color: tokens.muted,
                fontWeight: "300",
                fontSize: 11,
                letterSpacing: 0.3,
                marginTop: 2,
              }}
            >
              of {goal.toLocaleString()} · {moveMin} min active
            </Text>
          </View>

          <MotiView
            from={reduceMotion ? undefined : { opacity: 0.55, scale: 1 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1.03 }}
            transition={
              reduceMotion
                ? undefined
                : { type: "timing", duration: 900, loop: true, repeatReverse: true }
            }
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.surface2 || withAlpha(tokens.tint, 0.1),
              borderWidth: 1,
              borderColor: tokens.hairline,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="walk-outline" size={18} color={tokens.tint} />
          </MotiView>
        </View>

        <View
          style={{
            height: 6,
            borderRadius: 999,
            backgroundColor: withAlpha(tokens.muted, 0.12),
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.round(pct * 100)}%`,
              height: "100%",
              backgroundColor: tokens.tint,
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}
