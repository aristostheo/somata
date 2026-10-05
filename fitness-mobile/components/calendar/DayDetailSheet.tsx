import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/content/ThemeProvider";
import type { DayData } from "@/services/calendarData";

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return color;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return clamp(value / total, 0, 1);
}

function formatLongDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtNumber(n: number) {
  return Math.round(n).toLocaleString();
}

function ringTone(score: number, colors: ReturnType<typeof useTheme>["colors"]) {
  if (score >= 85) return colors.success;
  if (score >= 60) return colors.accent;
  if (score >= 35) return colors.warning;
  return colors.danger;
}

export default function DayDetailSheet({
  visible,
  onClose,
  day,
  isToday,
  onLogNutrition,
}: {
  visible: boolean;
  onClose: () => void;
  day: DayData | null;
  isToday?: boolean;
  onLogNutrition?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(520)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateY.setValue(520);
      backdrop.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        mass: 0.9,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, translateY, visible]);

  const scoreTone = ringTone(day?.overallScore || 0, colors);
  const macroValues = useMemo(
    () => [
      {
        key: "protein",
        label: "Protein",
        value: day?.nutrition?.protein ?? 0,
        goal: day?.nutrition?.proteinGoal ?? 0,
        color: colors.accent,
      },
      {
        key: "carbs",
        label: "Carbs",
        value: day?.nutrition?.carbs ?? 0,
        goal: day?.nutrition?.carbsGoal ?? 0,
        color: colors.info || colors.accent,
      },
      {
        key: "fat",
        label: "Fat",
        value: day?.nutrition?.fat ?? 0,
        goal: day?.nutrition?.fatGoal ?? 0,
        color: colors.warning,
      },
    ],
    [colors.accent, colors.info, colors.warning, day]
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.background, isDark ? 0.7 : 0.45), opacity: backdrop },
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface2,
              borderColor: colors.borderElevated,
              paddingBottom: Math.max(insets.bottom, 18),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.surface3 }]} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {day ? formatLongDate(day.date) : "Day detail"}
              </Text>
              <Text style={[styles.scoreMeta, { color: colors.textTertiary }]}>
                How today scored
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.scoreRow}>
            <View
              style={[
                styles.scoreBadge,
                { borderColor: withAlpha(scoreTone, 0.45), backgroundColor: withAlpha(scoreTone, 0.14) },
              ]}
            >
              <Text style={[styles.scoreBadgeText, { color: scoreTone }]}>
                {day?.overallScore ?? 0}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[styles.scoreTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.scoreFill,
                    {
                      width: `${clamp(day?.overallScore ?? 0, 0, 100)}%`,
                      backgroundColor: scoreTone,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.scoreMeta, { color: colors.textSecondary }]}>
                {day?.overallScore ?? 0 >= 85
                  ? "Strong day across training and nutrition."
                  : day?.overallScore ?? 0 >= 60
                  ? "A good base with room to sharpen one area."
                  : "Partial day logged. Small wins still count."}
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingTop: 6 }}
          >
            <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Nutrition</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {day?.nutrition ? `${fmtNumber(day.nutrition.calories)} / ${fmtNumber(day.nutrition.calorieGoal)} kcal` : "Nothing logged"}
                </Text>
              </View>
              {day?.nutrition ? (
                <>
                  <View style={styles.macroList}>
                    {macroValues.map((macro) => (
                      <View key={macro.key} style={{ flex: 1, gap: 6 }}>
                        <View style={styles.macroLabelRow}>
                          <View style={[styles.dot, { backgroundColor: macro.color }]} />
                          <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{macro.label}</Text>
                        </View>
                        <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                          {fmtNumber(macro.value)}g
                        </Text>
                        <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                          <View
                            style={[
                              styles.inlineFill,
                              {
                                width: `${pct(macro.value, macro.goal) * 100}%`,
                                backgroundColor: macro.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={{ gap: 8 }}>
                    {day.nutrition.meals.map((meal, index) => (
                      <View key={`${meal.name}-${index}`} style={styles.rowBetween}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                            {meal.name}
                          </Text>
                          <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>{meal.time}</Text>
                        </View>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                          {fmtNumber(meal.calories)} kcal
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>Nothing logged.</Text>
                  {isToday && onLogNutrition ? (
                    <Pressable onPress={onLogNutrition}>
                      <Text style={[styles.link, { color: colors.accent }]}>Log now →</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Workout</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {day?.workout ? `${day.workout.duration} min` : "Rest day"}
                </Text>
              </View>
              {day?.workout ? (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{day.workout.name}</Text>
                  <View style={styles.chipRow}>
                    <MetaChip label={`${day.workout.exercises} exercises`} colors={colors} />
                    <MetaChip label={`${fmtNumber(day.workout.volume)} kg`} colors={colors} />
                    <MetaChip label={`Score ${day.workout.score}`} colors={colors} />
                  </View>
                  {day.workout.fatigue ? (
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                      {day.workout.fatigue}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>No workout logged.</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Hydration</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {day?.hydration ? `${fmtNumber(day.hydration.logged)} / ${fmtNumber(day.hydration.goal)} ml` : "No water logged"}
                </Text>
              </View>
              <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.inlineFill,
                    {
                      width: `${pct(day?.hydration?.logged ?? 0, day?.hydration?.goal ?? 0) * 100}%`,
                      backgroundColor: colors.info || colors.accent,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Steps</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {day?.steps ? `${fmtNumber(day.steps.count)} / ${fmtNumber(day.steps.goal)}` : "No steps"}
                </Text>
              </View>
              <View style={[styles.inlineTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.inlineFill,
                    {
                      width: `${pct(day?.steps?.count ?? 0, day?.steps?.goal ?? 0) * 100}%`,
                      backgroundColor: colors.success,
                    },
                  ]}
                />
              </View>
              {day?.steps?.source ? (
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>via {day.steps.source}</Text>
              ) : null}
            </View>

            {day?.sleep ? (
              <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Sleep</Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {Math.floor(day.sleep.duration / 60)}h {day.sleep.duration % 60}m
                  </Text>
                </View>
                <View style={styles.chipRow}>
                  <MetaChip label={`Deep ${day.sleep.deep}m`} colors={colors} />
                  <MetaChip label={`REM ${day.sleep.rem}m`} colors={colors} />
                  <MetaChip label={`Light ${day.sleep.light}m`} colors={colors} />
                </View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  Sleep score {day.sleep.score}
                </Text>
              </View>
            ) : null}

            {typeof day?.weight === "number" ? (
              <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Body metrics</Text>
                </View>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {fmtNumber(day.weight)} lb
                </Text>
              </View>
            ) : null}

            {day?.prs?.length ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: withAlpha(colors.warning, 0.1),
                    borderColor: withAlpha(colors.warning, 0.4),
                  },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Personal records</Text>
                </View>
                {day.prs.map((pr, index) => (
                  <Text key={`${pr.exercise}-${index}`} style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {pr.exercise} · {fmtNumber(pr.weight)} kg · {pr.reps} reps
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MetaChip({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.metaChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    flexDirection: "row",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "absolute",
    right: 16,
    top: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  scoreRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  scoreBadge: {
    minWidth: 56,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scoreTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 999,
  },
  scoreMeta: {
    fontSize: 12,
    fontWeight: "300",
    textAlign: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
  macroList: {
    flexDirection: "row",
    gap: 12,
  },
  macroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  macroValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  inlineTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  inlineFill: {
    height: "100%",
    borderRadius: 999,
  },
  divider: {
    height: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "300",
  },
  rowValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  link: {
    fontSize: 12,
    fontWeight: "500",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
