import React, { useMemo } from "react";
import { View, Text, Pressable, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ACircle = Animated.createAnimatedComponent(Circle);

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export type MetricTone = "tint" | "violet" | "mint";

export function MetricRing({
  label,
  value,
  goal,
  unit,
  sublabel,
  reduceMotion,
  tokens,
  style,
  onPress,
  size = 88,
  minHeight = 160,
  valueFontSize = 24,
}: {
  tone: MetricTone;
  label: string;
  value: number;
  goal: number;
  unit?: string;
  sublabel?: string;
  reduceMotion: boolean;
  tokens: {
    card: string;
    text: string;
    muted: string;
    hairline: string;
    tint: string;
    ringA: string;
    ringB: string;
    good: string;
    warn?: string;
    bad?: string;
    ringTrack?: string;
  };
  style?: ViewStyle;
  onPress?: () => void;
  size?: number;
  minHeight?: number;
  valueFontSize?: number;
}) {
  const pct = useMemo(
    () => clamp01(goal <= 0 ? 0 : value / goal),
    [goal, value]
  );
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(reduceMotion ? pct : 0);

  React.useEffect(() => {
    progress.value = withTiming(pct, { duration: reduceMotion ? 1 : 600 });
  }, [pct, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - progress.value),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${value}${unit ? ` ${unit}` : ""}. ${Math.round(
        pct * 100
      )} percent of goal.`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={[
          {
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: tokens.hairline,
            backgroundColor: tokens.card,
            minHeight,
            justifyContent: "space-between",
          },
          style,
        ]}
      >
        <Text
          style={{
            color: tokens.muted,
            fontSize: 10,
            fontWeight: "500",
            letterSpacing: 1,
          }}
        >
          {label.toUpperCase()}
        </Text>

        <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={tokens.ringTrack ?? tokens.hairline}
              strokeWidth={stroke}
              fill="transparent"
            />
            <ACircle
              animatedProps={animatedProps as any}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={tokens.tint}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${c} ${c}`}
            />
          </Svg>

          <View style={{ position: "absolute", alignItems: "center", gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
              <Text
                style={{
                  color: tokens.text,
                  fontSize: valueFontSize,
                  fontWeight: "200",
                  letterSpacing: -0.8,
                  fontVariant: ["tabular-nums"],
                  textAlign: "center",
                }}
              >
                {Math.round(value).toLocaleString()}
              </Text>
              {unit ? (
                <Text
                  style={{
                    color: tokens.muted,
                    fontSize: 11,
                    fontWeight: "300",
                    letterSpacing: 0.3,
                    marginBottom: 5,
                  }}
                >
                  {unit}
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                color: tokens.muted,
                fontSize: 12,
                fontWeight: "300",
                letterSpacing: 0.3,
              }}
            >
              {Math.round(pct * 100)}% of goal
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: tokens.muted,
            fontSize: 11,
            fontWeight: "300",
            letterSpacing: 0.3,
            lineHeight: 15,
          }}
        >
          {sublabel || "Goal progress"}
        </Text>
      </View>
    </Pressable>
  );
}
