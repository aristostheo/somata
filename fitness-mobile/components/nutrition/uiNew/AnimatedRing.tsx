import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ACircle = Animated.createAnimatedComponent(Circle);

export function AnimatedRing({
  size = 92,
  stroke = 10,
  value,
  goal,
  trackColor,
  fillColor,
  labelTop,
  labelBottom,
  duration = 520,
}: {
  size?: number;
  stroke?: number;
  value: number;
  goal: number;
  trackColor: string;
  fillColor: string;
  labelTop?: string;
  labelBottom?: string;
  duration?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const pct = useMemo(() => {
    if (!goal || goal <= 0) return 0;
    const p = value / goal;
    return Math.max(0, Math.min(1, p));
  }, [value, goal]);

  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withTiming(pct, { duration });
  }, [pct, duration, p]);

  const animatedProps = useAnimatedProps(() => {
    const dashOffset = c * (1 - p.value);
    return {
      strokeDashoffset: dashOffset,
    } as any;
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="transparent"
        />
        <ACircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      {labelTop || labelBottom ? (
        <View style={{ position: "absolute", alignItems: "center" }}>
          {labelTop ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                opacity: 0.7,
                color: "white",
              }}
            >
              {labelTop}
            </Text>
          ) : null}
          {labelBottom ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "900",
                color: "white",
                marginTop: 2,
              }}
            >
              {labelBottom}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
