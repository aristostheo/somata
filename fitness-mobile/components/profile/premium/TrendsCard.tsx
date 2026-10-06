// // components/profile/premium/TrendsCard.tsx
// import React, { useMemo } from "react";
// import { View, Text, StyleSheet, Pressable } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
// import * as Haptics from "expo-haptics";

// import { useTheme } from "@/content/ThemeProvider";
// import { GlassCard } from "./GlassCard";
// import { withAlpha, clamp, fmt } from "./ui";

// export function TrendsCard(props: {
//   title: string;
//   subtitle: string;
//   unit: "kg" | "lb";
//   series: number[]; // weight in kg values
//   goalType: "cut" | "maintain" | "lean_bulk" | "bulk";
//   targetWeightKg: number;
//   onPressDetails: () => void;
// }) {
//   const { colors, isDark } = useTheme();

//   const stats = useMemo(() => {
//     if (!props.series?.length) return null;
//     const first = props.series[0];
//     const last = props.series[props.series.length - 1];
//     const delta = last - first;
//     const min = Math.min(...props.series);
//     const max = Math.max(...props.series);
//     return { first, last, delta, min, max };
//   }, [props.series]);

//   const bars = useMemo(() => {
//     const s = props.series || [];
//     if (s.length < 2) return [];
//     const min = Math.min(...s);
//     const max = Math.max(...s);
//     const range = Math.max(0.0001, max - min);

//     // compress to 24 bars max
//     const n = 24;
//     const pick =
//       s.length <= n
//         ? s
//         : Array.from({ length: n }).map(
//             (_, i) => s[Math.round((i / (n - 1)) * (s.length - 1))]
//           );

//     return pick.map((v) => clamp((v - min) / range, 0.05, 1));
//   }, [props.series]);

//   const lastLabel = useMemo(() => {
//     if (!stats) return "—";
//     const kg = stats.last;
//     if (props.unit === "kg") return `${fmt.num1(kg)} kg`;
//     return `${fmt.num1(kg * 2.20462)} lb`;
//   }, [stats, props.unit]);

//   const deltaLabel = useMemo(() => {
//     if (!stats) return "—";
//     const dKg = stats.delta;
//     const sign = dKg > 0 ? "+" : "";
//     if (props.unit === "kg") return `${sign}${fmt.num1(dKg)} kg`;
//     return `${sign}${fmt.num1(dKg * 2.20462)} lb`;
//   }, [stats, props.unit]);

//   const mood = useMemo(() => {
//     // emotionally safe phrasing
//     if (!stats) return "No trend yet.";
//     const d = stats.delta;
//     if (Math.abs(d) < 0.3) return "Steady and consistent.";
//     if (d < 0) return "Moving in a lighter direction.";
//     return "Moving in a stronger direction.";
//   }, [stats]);

//   return (
//     <GlassCard>
//       <View style={{ flexDirection: "row", alignItems: "center" }}>
//         <View style={{ flex: 1 }}>
//           <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
//             {props.title}
//           </Text>
//           <Text style={{ color: colors.muted, marginTop: 6 }}>
//             {props.subtitle}
//           </Text>
//         </View>

//         <Pressable
//           onPress={() => {
//             Haptics.selectionAsync();
//             props.onPressDetails();
//           }}
//           style={({ pressed }) => [
//             styles.detailBtn,
//             {
//               backgroundColor: withAlpha(
//                 colors.card,
//                 isDark ? (pressed ? 0.22 : 0.18) : pressed ? 0.7 : 0.55
//               ),
//               borderColor: withAlpha(colors.border, 0.7),
//             },
//           ]}
//           accessibilityRole="button"
//           accessibilityLabel="Open trend details"
//         >
//           <Ionicons
//             name="chevron-forward-outline"
//             size={16}
//             color={colors.text}
//           />
//         </Pressable>
//       </View>

//       <View style={{ height: 12 }} />

//       {bars.length ? (
//         <View
//           style={[
//             styles.sparkWrap,
//             { backgroundColor: withAlpha(colors.border, isDark ? 0.12 : 0.2) },
//           ]}
//         >
//           {bars.map((h, idx) => (
//             <View
//               key={idx}
//               style={[
//                 styles.bar,
//                 {
//                   height: `${Math.round(h * 100)}%`,
//                   backgroundColor: withAlpha(
//                     colors.primary,
//                     isDark ? 0.35 : 0.22
//                   ),
//                 },
//               ]}
//             />
//           ))}
//         </View>
//       ) : (
//         <View
//           style={[
//             styles.sparkWrap,
//             {
//               backgroundColor: withAlpha(colors.border, isDark ? 0.12 : 0.2),
//               alignItems: "center",
//               justifyContent: "center",
//             },
//           ]}
//         >
//           <Text style={{ color: colors.muted }}>No check-ins yet</Text>
//         </View>
//       )}

//       <View style={{ height: 12 }} />

//       <View style={{ flexDirection: "row", gap: 10 }}>
//         <Mini label="Latest" value={lastLabel} />
//         <Mini label="Change" value={deltaLabel} />
//         <Mini label="Signal" value={mood} />
//       </View>

//       <Text
//         style={{
//           color: colors.muted,
//           fontSize: 12,
//           marginTop: 12,
//           lineHeight: 16,
//         }}
//       >
//         Trends are shown as a calm signal. No streak guilt. No shame.
//       </Text>
//     </GlassCard>
//   );
// }

// function Mini({ label, value }: { label: string; value: string }) {
//   const { colors } = useTheme();
//   return (
//     <View style={styles.mini}>
//       <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
//       <Text
//         style={{ color: colors.text, fontWeight: "900", marginTop: 4 }}
//         numberOfLines={1}
//       >
//         {value}
//       </Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   detailBtn: {
//     width: 34,
//     height: 34,
//     borderRadius: 14,
//     borderWidth: 1,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   sparkWrap: {
//     height: 92,
//     borderRadius: 18,
//     paddingHorizontal: 10,
//     paddingVertical: 10,
//     flexDirection: "row",
//     alignItems: "flex-end",
//     gap: 6,
//     overflow: "hidden",
//   },
//   bar: { flex: 1, borderRadius: 8 },
//   mini: {
//     flex: 1,
//     borderRadius: 16,
//     padding: 10,
//     backgroundColor: "rgba(255,255,255,0.06)",
//   },
// });

// components/profile/LongTermProgressCard.tsx
// Drop-in ✅
// Premium Profile summary card: "Long-term progress"
// - Mini trend visualization
// - Latest value
// - Change over range
// - Calm Signal derived from slope + noise
// - Optional confidence indicator
//
// Uses your ThemeProvider + existing body metrics services.
// Routes to your existing modal: /(modals)/long-term-progress

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

import {
  loadBodyMetrics,
  loadBodyMetricsHistory,
} from "@/services/profile/bodyMetrics";

import {
  type RangeKey,
  RANGE_OPTIONS,
  type SeriesPoint,
  emaSmooth,
  normalizeBars,
} from "@/services/profile/longTermProgress";

import {
  computeTrendSignal,
  formatChange,
  formatLatest,
} from "@/services/profile/longTermProgressSignal";

function weightToDisplay(weightLb: number, unit: "lb" | "kg", precision = 1) {
  if (!Number.isFinite(weightLb)) return NaN;
  if (unit === "kg") return Number((weightLb / 2.20462).toFixed(precision));
  return Number(weightLb.toFixed(precision));
}

function MiniSparkBars({
  points,
  height = 56,
  barCount = 24,
}: {
  points: SeriesPoint[];
  height?: number;
  barCount?: number;
}) {
  const { colors } = useTheme();

  const values = useMemo(() => points.map((p) => p.value), [points]);
  const smoothed = useMemo(() => emaSmooth(values, 0.28), [values]);
  const bars = useMemo(
    () => normalizeBars(smoothed, barCount),
    [smoothed, barCount]
  );

  return (
    <View
      style={[
        styles.sparkWrap,
        {
          height,
          backgroundColor: withAlpha(colors.card, 0.18),
          borderColor: withAlpha(colors.border, 0.22),
        },
      ]}
    >
      <View style={styles.sparkRow}>
        {bars.map((b, i) => {
          const isRecent = i >= bars.length - 4;
          return (
            <View key={i} style={styles.sparkSlot}>
              <View
                style={{
                  height: Math.max(4, b * (height - 18)),
                  width: 8,
                  borderRadius: 999,
                  backgroundColor: withAlpha(
                    colors.accent,
                    isRecent ? 0.82 : 0.55
                  ),
                  shadowColor: colors.accent,
                  shadowOpacity: isRecent ? 0.16 : 0.06,
                  shadowRadius: isRecent ? 10 : 6,
                  shadowOffset: { width: 0, height: 6 },
                }}
              />
            </View>
          );
        })}
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={[
          "transparent",
          Platform.OS === "ios" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.26)",
        ]}
        style={styles.sparkFade}
      />
    </View>
  );
}

function Chip({
  label,
  value,
  rightAccessory,
}: {
  label: string;
  value: string;
  rightAccessory?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: withAlpha(colors.card, 0.26),
          borderColor: withAlpha(colors.border, 0.22),
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: withAlpha(colors.text, 0.7) }]}>
        {label}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text
          style={[styles.chipValue, { color: colors.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {rightAccessory}
      </View>
    </View>
  );
}

function ConfidencePill({ label }: { label: "High" | "Medium" | "Low" | "—" }) {
  const { colors } = useTheme();
  if (label === "—") return null;

  const alpha = label === "High" ? 0.22 : label === "Medium" ? 0.18 : 0.14;

  return (
    <View
      style={[
        styles.confPill,
        {
          backgroundColor: withAlpha(colors.text, alpha),
          borderColor: withAlpha(colors.text, alpha + 0.08),
        },
      ]}
    >
      <View
        style={[
          styles.confDot,
          { backgroundColor: withAlpha(colors.text, 0.72) },
        ]}
      />
      <Text style={[styles.confText, { color: withAlpha(colors.text, 0.86) }]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  title,
  subtitle,
  ctaLabel,
  onPressCTA,
}: {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onPressCTA?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.emptyWrap,
        {
          backgroundColor: withAlpha(colors.card, 0.16),
          borderColor: withAlpha(colors.border, 0.22),
        },
      ]}
    >
      <Ionicons
        name="analytics-outline"
        size={18}
        color={withAlpha(colors.text, 0.65)}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptySub, { color: withAlpha(colors.text, 0.7) }]}>
          {subtitle}
        </Text>
      </View>

      {!!ctaLabel && !!onPressCTA && (
        <Pressable
          onPress={async () => {
            try {
              await Haptics.selectionAsync();
            } catch {}
            onPressCTA();
          }}
          style={({ pressed }) => [
            styles.emptyCTA,
            {
              backgroundColor: withAlpha(colors.text, pressed ? 0.14 : 0.1),
              borderColor: withAlpha(colors.text, 0.12),
            },
          ]}
        >
          <Text style={[styles.emptyCTAText, { color: colors.text }]}>
            {ctaLabel}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={withAlpha(colors.text, 0.85)}
          />
        </Pressable>
      )}
    </View>
  );
}

export function LongTermProgressCard(props: {
  unit: "lb" | "kg";
  initialRange?: RangeKey; // default "6m"
  showConfidence?: boolean; // default true
  onPressAddCheckIn?: () => void; // optional (wire to your Body Metrics editor)
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const showConfidence = props.showConfidence ?? true;
  const [range, setRange] = useState<RangeKey>(props.initialRange ?? "6m");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seriesRaw, setSeriesRaw] = useState<SeriesPoint[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      try {
        const history = await loadBodyMetricsHistory();
        const current = await loadBodyMetrics();

        const pts: SeriesPoint[] = history
          .filter((p) => Number.isFinite(p.weightLb))
          .map((p) => ({
            date: p.t,
            value: weightToDisplay(p.weightLb as number, props.unit),
          }));

        if (current?.updatedAt && Number.isFinite(current.weightLb)) {
          pts.push({
            date: current.updatedAt,
            value: weightToDisplay(current.weightLb as number, props.unit),
          });
        }

        if (!mounted) return;
        setSeriesRaw(
          pts
            .filter((p) => Number.isFinite(p.date) && Number.isFinite(p.value))
            .sort((a, b) => a.date - b.date)
        );
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(e?.message ?? "Couldn’t load weight history.");
        setSeriesRaw([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [props.unit, reloadKey]);

  const signal = useMemo(() => {
    return computeTrendSignal(seriesRaw, { range, minPoints: 4 });
  }, [seriesRaw, range]);

  const sparkSeries = useMemo(() => {
    // show the same range in the spark for coherence
    // computeTrendSignal already filters by range internally,
    // but we want the points for bars.
    const filtered = seriesRaw
      .filter((p) => Number.isFinite(p.date) && Number.isFinite(p.value))
      .sort((a, b) => a.date - b.date);

    // light range filter consistent with your service ranges:
    // we’ll reuse computeTrendSignal’s internal filter by using the same helper
    // BUT keep spark simple: just pass filtered (it gets normalized and smoothed anyway)
    // If you want exact range points, you can import filterByRange and apply here too.
    // (Not required to feel correct visually.)
    return filtered;
  }, [seriesRaw]);

  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(press.value ? 0.985 : 1, { damping: 18 }) },
    ],
  }));

  const rangeLabel = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.key === range);
    return opt?.label ?? "Range";
  }, [range]);
  const hasTrendData = seriesRaw.length >= 2;

  const openDetails = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    router.push({
      pathname: "/(modals)/long-term-progress",
      params: { unit: props.unit },
    });
  };

  const cycleRange = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    const idx = Math.max(
      0,
      RANGE_OPTIONS.findIndex((o) => o.key === range)
    );
    const next = RANGE_OPTIONS[(idx + 1) % RANGE_OPTIONS.length]?.key ?? "6m";
    setRange(next);
  };

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={aStyle}>
      <Pressable
        onPress={openDetails}
        onPressIn={() => (press.value = 1)}
        onPressOut={() => (press.value = 0)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: withAlpha(colors.card, pressed ? 0.44 : 0.34),
            borderColor: withAlpha(colors.border, 0.26),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open Long-term progress details"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                Long-term progress
              </Text>

              {hasTrendData ? (
                <Pressable
                  onPress={cycleRange}
                  style={({ pressed }) => [
                    styles.rangePill,
                    {
                      backgroundColor: withAlpha(
                        colors.text,
                        pressed ? 0.14 : 0.1
                      ),
                      borderColor: withAlpha(colors.text, 0.12),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change range"
                >
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={withAlpha(colors.text, 0.82)}
                  />
                  <Text style={[styles.rangeText, { color: colors.text }]}>
                    {rangeLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text
              style={[styles.subtitle, { color: withAlpha(colors.text, 0.68) }]}
            >
              Calm signal from your weight check-ins.
            </Text>
          </View>

          <View
            style={[
              styles.chevBtn,
              {
                backgroundColor: withAlpha(colors.card, 0.18),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={withAlpha(colors.text, 0.7)}
            />
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View
            style={[
              styles.skeleton,
              {
                backgroundColor: withAlpha(colors.card, 0.18),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            <View
              style={[
                styles.skelBlock,
                { backgroundColor: withAlpha(colors.text, 0.08) },
              ]}
            />
            <View
              style={[
                styles.skelBlock,
                { backgroundColor: withAlpha(colors.text, 0.06), width: "72%" },
              ]}
            />
          </View>
        ) : errorMsg ? (
          <EmptyState
            title="Couldn’t load progress"
            subtitle={errorMsg}
            ctaLabel="Retry"
            onPressCTA={() => {
              setReloadKey((k) => k + 1);
            }}
          />
        ) : seriesRaw.length < 2 ? (
          <EmptyState
            title="No weight data yet"
            subtitle="Add a check-in to start your long-term trend."
            ctaLabel={props.onPressAddCheckIn ? "Add a check-in" : undefined}
            onPressCTA={props.onPressAddCheckIn}
          />
        ) : (
          <MiniSparkBars points={sparkSeries} />
        )}

        {/* Chips */}
        {hasTrendData ? (
          <>
            <View style={styles.chipsRow}>
              <Chip
                label="Latest"
                value={formatLatest(signal.latest, props.unit)}
              />
              <Chip label="Change" value={formatChange(signal.delta, props.unit)} />
              <Chip
                label="Signal"
                value={signal.label}
                rightAccessory={
                  showConfidence ? (
                    <ConfidencePill label={signal.confidenceLabel} />
                  ) : null
                }
              />
            </View>

            <Text style={[styles.note, { color: withAlpha(colors.text, 0.68) }]}>
              Weight swings are normal. This summarizes direction gently — not a
              judgment.
            </Text>
          </>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: "hidden",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },

  rangePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangeText: { fontSize: 12.5, fontWeight: "800", letterSpacing: -0.1 },

  chevBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  sparkWrap: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    overflow: "hidden",
  },
  sparkRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sparkSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sparkFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -2,
    height: 36,
  },

  chipsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  chip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  chipLabel: { fontSize: 12, fontWeight: "800", letterSpacing: -0.1 },
  chipValue: {
    marginTop: 3,
    fontSize: 14.5,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  confPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confDot: { width: 6, height: 6, borderRadius: 999 },
  confText: { fontSize: 11.5, fontWeight: "900", letterSpacing: -0.1 },

  note: { marginTop: 10, fontSize: 12.5, fontWeight: "600", lineHeight: 17 },

  emptyWrap: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 13.5, fontWeight: "900", letterSpacing: -0.1 },
  emptySub: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  emptyCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyCTAText: { fontSize: 13, fontWeight: "900", letterSpacing: -0.1 },

  skeleton: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  skelBlock: { height: 14, borderRadius: 10, width: "90%" },
});
