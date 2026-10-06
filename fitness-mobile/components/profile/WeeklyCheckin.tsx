import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import type { WeeklyCheckin } from "@/services/weeklyCheckin";

function isSunday(date = new Date()) {
  return date.getDay() === 0;
}

function moodIcon(score: number) {
  if (score <= 2) return "cloudy-outline";
  if (score === 3) return "partly-sunny-outline";
  if (score === 4) return "sunny-outline";
  return "flash-outline";
}

function energyColor(score: number, colors: ReturnType<typeof useTheme>["colors"]) {
  if (score <= 1) return colors.danger;
  if (score === 2) return colors.warning;
  if (score === 3) return colors.warning;
  if (score === 4) return colors.accentMuted;
  return colors.success;
}

export default function WeeklyCheckinCard({
  checkin,
  onOpen,
}: {
  checkin: WeeklyCheckin | null;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const sunday = isSunday();
  const consistency = checkin
    ? Math.round(((checkin.mealsLoggedDays + checkin.hydrationDaysHit + Math.min(checkin.workoutSessions, 7)) / 21) * 100)
    : 0;

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Weekly Check-in</Text>
        <Text style={[styles.meta, { color: sunday ? colors.accentMuted : colors.textTertiary }]}>
          {sunday ? "Today · Sunday" : "Next Sunday"}
        </Text>
      </View>

      {checkin ? (
        <View style={{ gap: 12 }}>
          <View style={styles.summaryRow}>
            <View style={styles.inlineItem}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: energyColor(checkin.energy, colors) },
                ]}
              />
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Energy · {checkin.energy}/5
              </Text>
            </View>
            <View style={styles.inlineItem}>
              <Ionicons name={moodIcon(checkin.mood)} size={14} color={colors.textTertiary} />
              <Text style={[styles.body, { color: colors.textSecondary }]}>Mood · {checkin.mood}/5</Text>
            </View>
            <View style={styles.inlineItem}>
              <Ionicons name="bar-chart-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.body, { color: colors.textSecondary }]}>Consistency · {consistency}%</Text>
            </View>
          </View>
          <Text style={[styles.link, { color: colors.accentMuted }]}>View history →</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>This week's check-in is ready</Text>
          <Pressable
            onPress={onOpen}
            style={[
              styles.startButton,
              {
                borderColor: colors.border,
                backgroundColor: sunday ? colors.surface2 : colors.surface2,
              },
            ]}
          >
            <Text style={[styles.startText, { color: colors.accentMuted }]}>Start check-in →</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  meta: {
    fontSize: 12,
    fontWeight: "300",
  },
  summaryRow: {
    gap: 10,
  },
  inlineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  body: {
    fontSize: 12,
    fontWeight: "300",
  },
  link: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    gap: 12,
  },
  startButton: {
    alignSelf: "flex-start",
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
