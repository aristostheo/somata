import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { useAuth } from "@/content/AuthContext";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { subscribeProfile, type Profile } from "@/services/profile";

type RangeKey = 7 | 30 | 90;

function useC() {
  const { colors, isDark } = useProfileFlowTheme();
  return {
    bg: colors.background,
    card: colors.surface1,
    card2: colors.surface2,
    text: colors.textPrimary,
    muted: colors.textTertiary,
    hairline: colors.border,
    purple: colors.primary as string,
    blue: isDark ? "#B9A4FA" : "#7051B5",
    teal: colors.accent as string,
    green: colors.success as string,
    amber: colors.warning as string,
    red: colors.danger as string,
  };
}

const RANGE_OPTIONS: RangeKey[] = [7, 30, 90];
const CHART_W = 340;
const CHART_H = 164;

function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(
    h.slice(4, 6),
    16
  )},${Math.max(0, Math.min(1, a))})`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtWeekday(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function rangeSubtitle(range: RangeKey, dates: string[]) {
  if (!dates.length) return "";
  const first = fmtDayLabel(dates[0]);
  const last = fmtDayLabel(dates[dates.length - 1]);
  if (range === 7) return `Week of ${first}-${last}`;
  if (range === 30) return `Month of ${first}-${last}`;
  const startMonth = new Date(`${dates[0]}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
  });
  const endMonth = new Date(`${dates[dates.length - 1]}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "short" }
  );
  return `Last 90 days · ${startMonth}-${endMonth}`;
}

export default function StepsHistoryScreen() {
  const C = useC();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [range, setRange] = useState<RangeKey>(30);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  const stepsMap = (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
  const stepsGoal = Number((profile as any)?.stepsGoal ?? (profile as any)?.stepsPerDay ?? 8000);
  const today = new Date();
  const dates = useMemo(
    () => Array.from({ length: range }, (_, i) => ymd(addDays(today, -(range - 1) + i))),
    [range]
  );
  const rows = useMemo(
    () =>
      dates.map((date) => ({
        date,
        steps: Number(stepsMap[date] || 0),
      })),
    [dates, stepsMap]
  );

  const total = rows.reduce((sum, row) => sum + row.steps, 0);
  const avg = rows.length ? Math.round(total / rows.length) : 0;
  const best = rows.reduce((max, row) => (row.steps > max.steps ? row : max), {
    date: dates[0] || ymd(today),
    steps: 0,
  });
  const goalHits = rows.filter((row) => row.steps >= stepsGoal).length;
  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].steps <= 0) break;
      streak += 1;
    }
    return streak;
  }, [rows]);

  const chartMax = Math.max(stepsGoal, best.steps, 1000);
  const chartBars = rows.map((row, idx) => {
    const available = CHART_H - 42;
    const h = row.steps > 0 ? Math.max(8, Math.round((row.steps / chartMax) * available)) : 6;
    const x = 18 + idx * ((CHART_W - 36) / Math.max(1, rows.length));
    const w = Math.max(4, Math.min(10, (CHART_W - 48) / Math.max(1, rows.length)));
    const y = CHART_H - 28 - h;
    const color =
      row.steps >= stepsGoal ? C.green : row.steps >= stepsGoal * 0.65 ? C.teal : C.purple;
    return { ...row, x, y, w, h, color };
  });

  const summary = useMemo(() => {
    if (!rows.some((row) => row.steps > 0)) {
      return "No step history yet. Connect Apple Health or log steps to start building your timeline.";
    }
    if (goalHits >= Math.ceil(range * 0.7)) {
      return `You are consistently hitting your pace. ${goalHits}/${range} days cleared your goal.`;
    }
    if (avg < stepsGoal * 0.6) {
      return `Your recent average is ${avg.toLocaleString()} steps. A short daily walk would move this trend quickly.`;
    }
    return `You are building a steady base. ${goalHits}/${range} days hit goal with a best day of ${best.steps.toLocaleString()}.`;
  }, [avg, best.steps, goalHits, range, rows, stepsGoal]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlowAtmosphere />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: insets.bottom + 44,
          paddingHorizontal: 20,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={iconButton(C)}
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 30 }}>Steps</Text>
            <Text style={{ color: C.muted, fontWeight: "400", marginTop: 3 }}>
              {rangeSubtitle(range, dates)}
            </Text>
          </View>
          <RangePill value={range} onChange={setRange} />
        </View>

        <View style={{ borderRadius: 24 }}>
          <View
            style={{
              borderRadius: 18,
              backgroundColor: C.card,
              borderWidth: 0,
              borderColor: alpha(C.teal, 0.14),
              padding: 16,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: alpha(C.teal, 0.14),
                }}
              >
                <Ionicons name="footsteps-outline" size={19} color={C.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 18 }}>
                  Walking rhythm
                </Text>
                <Text style={{ color: C.muted, fontWeight: "400", marginTop: 2, lineHeight: 18 }}>
                  {summary}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Average" value={avg.toLocaleString()} accent={C.teal} />
              <StatCard label="Best day" value={best.steps.toLocaleString()} accent={C.green} />
              <StatCard label="Goal hits" value={`${goalHits}/${range}`} accent={C.purple} />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="Current streak"
                value={currentStreak ? `${currentStreak}d` : "None"}
                accent={currentStreak ? C.amber : C.muted}
              />
              <StatCard
                label="Goal"
                value={stepsGoal.toLocaleString()}
                accent={C.blue}
              />
            </View>
          </View>
        </View>

        <SectionLabel title="Trend" />
        <View
          style={{
            borderRadius: 18,
            backgroundColor: C.card,
            borderWidth: 0,
            borderColor: C.hairline,
            padding: 14,
            gap: 12,
          }}
        >
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
            <Line x1="14" y1={CHART_H - 28} x2={CHART_W - 14} y2={CHART_H - 28} stroke={alpha(C.hairline, 0.14)} strokeWidth="1" />
            <Line
              x1="14"
              y1={CHART_H - 28 - ((stepsGoal / chartMax) * (CHART_H - 42))}
              x2={CHART_W - 14}
              y2={CHART_H - 28 - ((stepsGoal / chartMax) * (CHART_H - 42))}
              stroke={alpha(C.teal, 0.6)}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <SvgText x="16" y="16" fill={C.muted} fontSize="11" fontWeight="800">
              {chartMax.toLocaleString()}
            </SvgText>
            <SvgText
              x="16"
              y={CHART_H - 28 - ((stepsGoal / chartMax) * (CHART_H - 42)) - 6}
              fill={C.teal}
              fontSize="11"
              fontWeight="800"
            >
              Goal {stepsGoal.toLocaleString()}
            </SvgText>
            <SvgText x="16" y={CHART_H - 10} fill={C.muted} fontSize="11" fontWeight="800">
              0
            </SvgText>
            {chartBars.map((bar, idx) => (
              <Rect
                key={`${bar.date}-${idx}`}
                x={bar.x}
                y={bar.y}
                rx="4"
                width={bar.w}
                height={bar.h}
                fill={bar.color}
              />
            ))}
          </Svg>

          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: C.muted, fontWeight: "500", fontSize: 12 }}>
              {fmtWeekday(dates[0])}
            </Text>
            <Text style={{ color: C.muted, fontWeight: "500", fontSize: 12 }}>
              {fmtWeekday(dates[Math.floor((dates.length - 1) / 2)])}
            </Text>
            <Text style={{ color: C.muted, fontWeight: "500", fontSize: 12 }}>
              {fmtWeekday(dates[dates.length - 1])}
            </Text>
          </View>
        </View>

        <SectionLabel title="Recent Days" />
        <View
          style={{
            borderRadius: 18,
            backgroundColor: C.card,
            borderWidth: 0,
            borderColor: C.hairline,
            overflow: "hidden",
          }}
        >
          {rows
            .slice()
            .reverse()
            .slice(0, 20)
            .map((row, idx) => {
              const pct = stepsGoal > 0 ? row.steps / stepsGoal : 0;
              const accent =
                row.steps >= stepsGoal ? C.green : pct >= 0.65 ? C.teal : pct > 0 ? C.purple : C.card2;
              return (
                <View
                  key={row.date}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: C.hairline,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: accent,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>
                      {new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text style={{ color: C.muted, fontWeight: "500", marginTop: 3 }}>
                      {row.steps >= stepsGoal
                        ? "Goal hit"
                        : row.steps > 0
                        ? `${Math.max(0, stepsGoal - row.steps).toLocaleString()} to goal`
                        : "No steps logged"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", minWidth: 74 }}>
                    <Text style={{ color: C.text, fontWeight: "600", fontSize: 16 }}>
                      {row.steps.toLocaleString()}
                    </Text>
                    <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
                      steps
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>
      </ScrollView>
    </View>
  );
}

function RangePill({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  const C = useC();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 999,
        padding: 3,
        backgroundColor: C.card2,
        borderWidth: 0,
        borderColor: C.hairline,
      }}
    >
      {RANGE_OPTIONS.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              paddingHorizontal: 11,
              minHeight: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? alpha(C.purple, 0.26) : "transparent",
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 12 }}>
              {option === 7 ? "7D" : option === 30 ? "30D" : "90D"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const C = useC();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        padding: 12,
        backgroundColor: C.card2,
        borderWidth: 0,
        borderColor: alpha(accent, 0.22),
        gap: 4,
      }}
    >
      <Text style={{ color: C.muted, fontWeight: "500", fontSize: 11 }}>{label}</Text>
      <Text style={{ color: C.text, fontWeight: "600", fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const C = useC();
  return (
    <Text
      style={{
        color: C.muted,
        fontWeight: "600",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {title}
    </Text>
  );
}

function iconButton(C: ReturnType<typeof useC>) {
  return {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 0,
    borderColor: C.hairline,
    backgroundColor: C.card2,
  };
}
