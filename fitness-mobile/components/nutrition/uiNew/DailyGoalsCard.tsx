import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ACircle = Animated.createAnimatedComponent(Circle);

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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

type DailyGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugarTotal?: number;
  sugarAdded?: number;
  satFat?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  waterMl?: number;
};

type DailyTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugarTotal?: number;
  sugarAdded?: number;
  satFat?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  waterMl?: number;
};

export function DailyGoalsCard({
  colors,
  goals,
  totals,
  onPressLog,
  onPressSuggest,
  forecast,
  reduceMotion = false,
}: {
  colors: any;
  isDark: boolean;
  goals: DailyGoals;
  totals: DailyTotals;
  onPressLog: () => void;
  onPressSuggest?: () => void;
  forecast?: { enabled?: boolean };
  reduceMotion?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = colors.primary;
  const kcalNow = Math.round(totals.calories || 0);
  const kcalGoal = Math.max(1, Math.round(goals.calories || 1));
  const kcalRemaining = Math.max(0, kcalGoal - kcalNow);
  const proteinLeft = Math.max(0, Math.round((goals.protein || 0) - (totals.protein || 0)));
  const pct = clamp01(kcalNow / kcalGoal);
  const projection = useMemo(() => {
    if (!forecast?.enabled) return null;
    const now = new Date();
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    if (kcalNow <= 0 || hoursElapsed <= 0 || now.getHours() < 8) return null;
    const rawProjected = Math.round((kcalNow / hoursElapsed) * 24);
    if (rawProjected < 500 || rawProjected > 6000) return null;
    const projected = rawProjected;
    const diff = Math.abs(projected - kcalGoal);
    const direction = projected > kcalGoal ? "over" : "under";
    return { projected, diff, direction };
  }, [forecast?.enabled, kcalGoal, kcalNow]);
  const ring = useSharedValue(reduceMotion ? pct : 0);

  React.useEffect(() => {
    ring.value = withTiming(pct, { duration: reduceMotion ? 1 : 600 });
  }, [pct, reduceMotion, ring]);

  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ring.value),
  }));

  const nutrients = [
    { label: "Fiber", value: totals.fiber, goal: goals.fiber, unit: "g" },
    { label: "Sugar", value: totals.sugarTotal, goal: goals.sugarTotal, unit: "g" },
    { label: "Added sugar", value: totals.sugarAdded, goal: goals.sugarAdded, unit: "g" },
    { label: "Sodium", value: totals.sodiumMg, goal: goals.sodiumMg, unit: "mg" },
    { label: "Saturated fat", value: totals.satFat, goal: goals.satFat, unit: "g" },
    { label: "Cholesterol", value: totals.cholesterolMg, goal: goals.cholesterolMg, unit: "mg" },
  ].filter((x) => typeof x.value === "number" || typeof x.goal === "number");

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "500" }}>
            Daily goals
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 12, fontWeight: "300", marginTop: 4 }}
            numberOfLines={1}
          >
            {`${kcalRemaining} kcal · ${proteinLeft}g protein left`}
          </Text>
        </View>

        <Pressable
          onPress={onPressLog}
          style={({ pressed }) => ({
            height: 32,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.82 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "500" }}>
            + Log
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.inputBg}
              strokeWidth={stroke}
              fill="transparent"
            />
            <ACircle
              animatedProps={animatedProps as any}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${circumference} ${circumference}`}
            />
          </Svg>
          <View style={{ position: "absolute", flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 36, fontWeight: "200", letterSpacing: -1.2 }}>
              {kcalNow}
            </Text>
            <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 11, fontWeight: "300", marginBottom: 8 }}>
              kcal
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: "flex-end", gap: 6 }}>
          <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 11, fontWeight: "300" }}>
            Goal {kcalGoal}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500" }}>
            {kcalRemaining} remaining
          </Text>
        </View>
      </View>

      {projection ? (
        <View style={{ borderLeftWidth: 2, borderLeftColor: accent, paddingLeft: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }} numberOfLines={1}>
            {`Projected: ${projection.projected.toLocaleString()} kcal · ~${projection.diff.toLocaleString()} ${projection.direction} goal`}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onPressSuggest || onPressLog}
        style={({ pressed }) => ({
          height: 44,
          borderRadius: 100,
          backgroundColor: accent,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>
          What should I eat?
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <MacroTile label="P" name="Protein" value={totals.protein} goal={goals.protein} color={colors.primary} colors={colors} />
        <MacroTile label="C" name="Carbs" value={totals.carbs} goal={goals.carbs} color="#06B6D4" colors={colors} />
        <MacroTile label="F" name="Fat" value={totals.fat} goal={goals.fat} color="#F59E0B" colors={colors} />
      </View>

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => ({
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="nutrition-outline" size={16} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }}>
            More nutrients
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>

      {expanded ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.card,
            overflow: "hidden",
          }}
        >
          {nutrients.map((item, index) => {
            const value = Math.round(Number(item.value || 0));
            const goal = Math.round(Number(item.goal || 0));
            const pctText = goal > 0 ? `${Math.round((value / goal) * 100)}%` : "—";
            return (
              <View
                key={item.label}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }}>
                  {item.label}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "500" }}>
                    {value}
                    {item.unit}
                  </Text>
                  <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 12, fontWeight: "300" }}>
                    {pctText}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function MacroTile({
  label,
  name,
  value,
  goal,
  color,
  colors,
}: {
  label: string;
  name: string;
  value: number;
  goal: number;
  color: string;
  colors: any;
}) {
  const safeGoal = Math.max(1, Math.round(goal || 1));
  const safeValue = Math.round(value || 0);
  const pct = clamp01(safeValue / safeGoal);
  const left = Math.max(0, safeGoal - safeValue);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "500", letterSpacing: 1 }}>
          {name.toUpperCase()}
        </Text>
      </View>
      <Text style={{ color, fontSize: 16, fontWeight: "500" }}>
        {Math.round(pct * 100)}%
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "300" }}>
        <Text style={{ color: colors.text, fontWeight: "500" }}>{safeValue}</Text>
        <Text>{`/${safeGoal}g`}</Text>
      </Text>
      <View style={{ height: 3, borderRadius: 100, backgroundColor: colors.inputBg, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: 3, backgroundColor: color, borderRadius: 100 }} />
      </View>
      <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 10, fontWeight: "300" }}>
        {left}g left
      </Text>
    </View>
  );
}
