import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

export function DayStrip({
  colors,
  days,
  activeISO,
  goals,
  mode,
  onPressDay,
  onToggleMode,
}: {
  colors: any;
  isDark: boolean;
  days: { date: string; calories: number }[];
  activeISO: string;
  goals: { calories: number };
  mode: "week" | "month";
  onPressDay: (iso: string) => void;
  onToggleMode: () => void;
}) {
  const items = useMemo(
    () => [...days].sort((a, b) => a.date.localeCompare(b.date)),
    [days]
  );
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          onPress={onToggleMode}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, flexDirection: "row", alignItems: "center", gap: 6 })}
        >
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontSize: 12,
              fontWeight: "300",
            }}
          >
            {mode === "week" ? "Month" : "2 weeks"} →
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        {items.map((d) => {
          const active = d.date === activeISO;
          const isToday = d.date === todayIso;
          const pct = goals.calories > 0 ? (d.calories || 0) / goals.calories : 0;
          const barColor =
            d.calories <= 0
              ? colors.inputBg
              : pct >= 0.9
              ? colors.success
              : pct >= 0.6
              ? colors.warning
              : colors.danger;
          const dayObj = new Date(`${d.date}T12:00:00`);
          const barHeight = Math.max(6, Math.round(Math.min(1, pct || 0) * 28));

          return (
            <Pressable
              key={d.date}
              onPress={() => onPressDay(d.date)}
              style={({ pressed }) => ({
                width: 52,
                height: 72,
                borderRadius: 14,
                borderWidth: active || isToday ? 1.5 : 1,
                borderColor: active || isToday ? colors.primary : colors.border,
                backgroundColor: active ? withAlpha(colors.primary, 0.12) : colors.card,
                padding: 8,
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.placeholder ?? colors.muted,
                  fontSize: 10,
                  fontWeight: "500",
                  letterSpacing: 1,
                }}
              >
                {dayObj.toLocaleDateString(undefined, { weekday: "narrow" }).toUpperCase()}
              </Text>
              <Text
                style={{
                  color: isToday ? colors.primary : colors.text,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              >
                {Number(d.date.slice(-2))}
              </Text>
              <View
                style={{
                  width: 4,
                  height: 28,
                  borderRadius: 100,
                  backgroundColor: colors.inputBg,
                  justifyContent: "flex-end",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: 4,
                    height: barHeight,
                    borderRadius: 100,
                    backgroundColor: barColor,
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
