import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert as RNAlert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { useTheme } from "@/content/ThemeProvider";

export type WorkoutEntrySummary = {
  id: string;
  sessionKey: string;
  title: string;
  dateISO: string;
  timeLabel?: string;
  durationMin: number;
  exercisesCount: number;
  sets: number;
  volumeKg: number;
  highlight?: {
    label: "Best set" | "PR moment";
    text: string;
    isPR?: boolean;
  };
  prCount?: number;
};

type Props = {
  summary: WorkoutEntrySummary;
  onPress?: () => void;
  onDuplicate?: () => void;
  onSaveTemplate?: () => void;
  onDelete?: () => void | Promise<void>;
  onMore?: () => void;
  index?: number;
};

const withAlpha = (hex: string, a: number) => {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
};

function formatDateShort(iso: string, timeLabel?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return timeLabel || iso || "";
  const d = new Date(`${iso}T00:00:00`);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return timeLabel ? `${date} · ${timeLabel}` : date;
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function computeIntensity(volumeKg: number, durationMin: number, sets: number) {
  const dur = Math.max(1, durationMin || 0);
  const density = volumeKg / dur;
  const setRate = sets / dur;
  const densityN = Math.max(0, Math.min(1, density / 420));
  const setRateN = Math.max(0, Math.min(1, setRate / 0.55));
  return Math.max(0, Math.min(1, Math.pow(0.58 * densityN + 0.42 * setRateN, 0.92)));
}

function scoreDescriptor(scorePct: number) {
  if (scorePct <= 30) return "Low";
  if (scorePct <= 60) return "Fair";
  if (scorePct <= 85) return "Good";
  return "Elite";
}

function descriptorColor(scorePct: number, colors: any) {
  if (scorePct <= 30) return colors.danger;
  if (scorePct <= 60) return colors.warning;
  if (scorePct <= 85) return colors.primary;
  return colors.success;
}

function fatigueLabel(scorePct: number) {
  if (scorePct <= 25) return "Clean";
  if (scorePct <= 55) return "Good";
  if (scorePct <= 80) return "Hard";
  return "Destroyed";
}

function fatigueColor(label: string, colors: any) {
  switch (label) {
    case "Destroyed":
      return colors.danger;
    case "Hard":
      return colors.warning;
    case "Good":
      return colors.primary;
    default:
      return colors.success;
  }
}

function formatBestSet(text?: string) {
  if (!text) return "—";
  const parts = text.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return text;
  const suffix = parts.slice(1).join(" · ");
  const name = parts[0];
  const maxName = 14;
  const clipped = name.length > maxName ? `${name.slice(0, maxName - 3)}...` : name;
  return `${clipped} · ${suffix}`;
}

function Ring({
  score,
  accent,
  track,
  textPrimary,
  textTertiary,
  descriptorTint,
}: {
  score: number;
  accent: string;
  track: string;
  textPrimary: string;
  textTertiary: string;
  descriptorTint: string;
}) {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const descriptor = scoreDescriptor(score);

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: track,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            transform: [{ rotate: "-90deg" }],
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: stroke / 2,
              top: stroke / 2,
              width: size - stroke,
              height: size - stroke,
              borderRadius: (size - stroke) / 2,
              borderWidth: stroke,
              borderColor: accent,
              borderRightColor: "transparent",
              borderBottomColor: "transparent",
              transform: [{ rotate: `${(score / 100) * 360}deg` }],
              opacity: score > 0 ? 1 : 0,
            }}
          />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "200", color: textPrimary }}>{score}</Text>
      </View>
      <Text
        style={{
          marginTop: 4,
          fontSize: 9,
          fontWeight: "500",
          letterSpacing: 1,
          color: textTertiary,
          textTransform: "uppercase",
        }}
      >
        Score
      </Text>
      <Text style={{ marginTop: 2, fontSize: 9, fontWeight: "500", color: descriptorTint }}>
        {descriptor}
      </Text>
    </View>
  );
}

export function WorkoutEntryCardPremium({
  summary,
  onPress,
  onDuplicate,
  onSaveTemplate,
  onDelete,
  onMore,
  index = 0,
}: Props) {
  const { colors, isDark } = useTheme();

  const token = useMemo(
    () => ({
      background: colors.surface1,
      surface2: colors.surface2,
      surface3: colors.surface3,
      border: colors.border,
      borderElevated: colors.borderElevated,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textTertiary: colors.textTertiary,
      accent: colors.primary,
      warning: colors.warning,
      danger: colors.danger,
      success: colors.success,
      shadowStyle: isDark
        ? null
        : {
            shadowColor: "#000000",
            shadowOpacity: 0.06,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 16,
            elevation: 2,
          },
    }),
    [colors, isDark]
  );

  const intensity = useMemo(
    () => computeIntensity(summary.volumeKg, summary.durationMin, summary.sets),
    [summary.durationMin, summary.sets, summary.volumeKg]
  );
  const scorePct = Math.round(intensity * 100);
  const fatigue = fatigueLabel(scorePct);
  const fatigueTint = fatigueColor(fatigue, token);
  const descriptorTint = descriptorColor(scorePct, token);
  const activeDots = Math.max(1, Math.min(5, Math.round(intensity * 5)));

  const requestDelete = () => {
    RNAlert.alert("Delete workout?", "This removes the workout from recents and history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
    ]);
  };

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18).stiffness(220)}
      style={{ marginBottom: 12 }}
    >
      <Animated.View entering={FadeInDown.duration(320).delay(Math.min(140, index * 18))}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPress?.();
          }}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: token.background,
              borderColor: token.border,
            },
            token.shadowStyle,
            pressed && { transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.title, { color: token.textPrimary }]} numberOfLines={1}>
                {summary.title || "Workout"}
              </Text>
              <Text style={[styles.meta, { color: token.textTertiary }]} numberOfLines={1}>
                {formatDateShort(summary.dateISO, summary.timeLabel)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onMore?.();
              }}
              style={[styles.moreButton, { backgroundColor: token.surface3 }]}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={token.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.middleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.chipsRow}>
                <StatChip icon="barbell-outline" label={`${summary.exercisesCount} ex`} token={token} />
                <StatChip icon="layers-outline" label={`${summary.sets} sets`} token={token} />
                <StatChip icon="pulse-outline" label={`${Math.round(summary.volumeKg)} kg`} token={token} />
                <StatChip icon="time-outline" label={formatDuration(summary.durationMin)} token={token} />
              </View>

              <View style={styles.intensityRow}>
                <Text style={[styles.intensityLabel, { color: token.textTertiary }]}>Intensity</Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View
                      key={`${summary.id}-dot-${i}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: i < activeDots ? token.accent : token.surface3,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            <Ring
              score={scorePct}
              accent={token.accent}
              track={colors.ringTrack || token.surface3}
              textPrimary={token.textPrimary}
              textTertiary={token.textTertiary}
              descriptorTint={descriptorTint}
            />
          </View>

          <View style={styles.bottomCluster}>
            <View style={styles.bestSetRow}>
              <View
                style={[
                  styles.bestSetChip,
                  { backgroundColor: token.surface2, borderColor: token.border },
                ]}
              >
                <Ionicons name="sparkles-outline" size={14} color={token.textTertiary} />
                <Text style={[styles.bestSetLabel, { color: token.textTertiary }]}>Best set</Text>
                <Text style={[styles.bestSetText, { color: token.textPrimary }]} numberOfLines={1}>
                  {formatBestSet(summary.highlight?.text)}
                </Text>
              </View>
              <View
                style={[
                  styles.fatigueBadge,
                  {
                    backgroundColor: withAlpha(fatigueTint, 0.18),
                    borderColor: fatigueTint,
                  },
                ]}
              >
                <Text style={[styles.fatigueText, { color: fatigueTint }]}>{fatigue}</Text>
              </View>
            </View>

            <Pressable
              onPress={onDuplicate}
              style={[
                styles.duplicateButton,
                { backgroundColor: token.surface2, borderColor: token.border },
              ]}
            >
              <Ionicons name="copy-outline" size={12} color={token.textTertiary} />
              <Text style={[styles.duplicateText, { color: token.textSecondary }]}>Duplicate</Text>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function StatChip({
  icon,
  label,
  token,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  token: any;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: token.surface2, borderColor: token.border }]}>
      <Ionicons name={icon} size={14} color={token.textTertiary} />
      <Text style={[styles.statChipText, { color: token.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default WorkoutEntryCardPremium;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "300",
  },
  moreButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  middleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statChip: {
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  intensityRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  intensityLabel: {
    fontSize: 11,
    fontWeight: "300",
  },
  dotsRow: {
    marginLeft: "auto",
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  bottomCluster: {
    marginTop: 12,
    gap: 8,
  },
  bestSetRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  bestSetChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bestSetLabel: {
    fontSize: 11,
    fontWeight: "300",
  },
  bestSetText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  fatigueBadge: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fatigueText: {
    fontSize: 11,
    fontWeight: "500",
  },
  duplicateButton: {
    alignSelf: "flex-start",
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  duplicateText: {
    fontSize: 11,
    fontWeight: "400",
  },
});
