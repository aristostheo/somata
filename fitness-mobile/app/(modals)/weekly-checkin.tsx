import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfileFlowTheme as useTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";
import {
  getCheckins,
  getCurrentWeekStart,
  getThisWeeksCheckin,
  getWeekRangeLabel,
  getWeeklyConsistencyStats,
  saveCheckin,
  scheduleWeeklyCheckinReminders,
  type WeeklyCheckin,
  type WeeklyConsistencyStats,
} from "@/services/weeklyCheckin";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const BODY_OPTIONS = [
  "Feeling leaner",
  "Clothes fitting better",
  "More muscle definition",
  "About the same",
  "Feeling bloated/heavier",
  "Hard to tell",
];

function moodIcon(score: number) {
  if (score === 1) return "thunderstorm-outline";
  if (score === 2) return "cloudy-outline";
  if (score === 3) return "partly-sunny-outline";
  if (score === 4) return "sunny-outline";
  return "flash-outline";
}

function scoreColor(score: number, colors: ReturnType<typeof useTheme>["colors"]) {
  if (score <= 1) return colors.danger;
  if (score === 2) return colors.warning;
  if (score === 3) return colors.warning;
  if (score === 4) return colors.accent;
  return colors.success;
}

export default function WeeklyCheckinScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [consistencyRating, setConsistencyRating] = useState<"accurate" | "felt-better" | "felt-harder" | null>(null);
  const [bodyChanges, setBodyChanges] = useState<string[]>([]);
  const [bodyNote, setBodyNote] = useState("");
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [moodNote, setMoodNote] = useState("");
  const [stats, setStats] = useState<WeeklyConsistencyStats | null>(null);
  const [history, setHistory] = useState<WeeklyCheckin[]>([]);
  const [completed, setCompleted] = useState<WeeklyCheckin | null>(null);

  const weekOf = getCurrentWeekStart();

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (next) => setProfile(next || null));
  }, [user?.uid]);

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    const [current, rows, nextStats] = await Promise.all([
      getThisWeeksCheckin(),
      getCheckins(),
      getWeeklyConsistencyStats(user.uid, profile, weekOf),
    ]);
    setCompleted(current);
    setHistory(rows);
    setStats(nextStats);
  }, [profile, user?.uid, weekOf]);

  useEffect(() => {
    refresh().catch(() => {});
    scheduleWeeklyCheckinReminders().catch(() => {});
  }, [refresh]);

  const close = useCallback(() => {
    if (step > 0 && step < 5 && !completed) {
      Alert.alert("Save progress and exit?", "", [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "default", onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [completed, router, step]);

  async function completeCheckin() {
    if (!user?.uid || !energy || !consistencyRating || !mood || !stats) return;
    await saveCheckin({
      weekOf,
      energy,
      consistencyRating,
      bodyChanges,
      bodyNote: bodyNote.trim() || null,
      mood,
      moodNote: moodNote.trim() || null,
      mealsLoggedDays: stats.mealsLoggedDays,
      workoutSessions: stats.workoutSessions,
      hydrationDaysHit: stats.hydrationDaysHit,
    });
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    await refresh();
    setStep(4);
  }

  const completionInsight = completed?.aiInsight;
  const weekLabel = getWeekRangeLabel(weekOf);

  const trendReady = history.length >= 4;
  const energyTrend = history.slice(0, 8).reverse().map((item) => item.energy);
  const moodTrend = history.slice(0, 8).reverse().map((item) => item.mood);

  const nextEnabled =
    (step === 0 && energy != null) ||
    (step === 1 && consistencyRating != null) ||
    step === 2 ||
    (step === 3 && mood != null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlowAtmosphere />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ width: 40 }} />
        <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Weekly Check-in</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{weekLabel}</Text>
        </View>
        <Pressable onPress={close} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.progressDots}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              {
                backgroundColor: step >= index && step < 4 ? colors.accent : colors.surface3,
                opacity: step === 4 ? 0.6 : 1,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        {step === 0 ? (
          <View style={{ gap: 12 }}>
            <QuestionBlock
              title="How was your energy this week?"
              subtitle="Consider your workouts, daily life, and sleep"
              colors={colors}
            />
            {[1, 2, 3, 4, 5].map((score) => (
              <Pressable
                key={score}
                onPress={() => setEnergy(score as 1 | 2 | 3 | 4 | 5)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: energy === score ? withAlpha(colors.accent, 0.12) : colors.surface1,
                    borderColor: energy === score ? colors.accent : colors.border,
                    borderLeftColor: energy === score ? scoreColor(score, colors) : colors.border,
                    borderLeftWidth: energy === score ? 3 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                  {score} — {["Exhausted", "Low", "Okay", "Good", "Great"][score - 1]}
                </Text>
                <Text style={[styles.optionSub, { color: colors.textTertiary }]}>
                  {[
                    "Running on empty",
                    "Tired more often than not",
                    "Some good days, some rough",
                    "Mostly energized",
                    "Felt strong all week",
                  ][score - 1]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: 16 }}>
            <QuestionBlock title="Here's how consistent you were" subtitle="" colors={colors} />
            <View style={styles.statGrid}>
              <StatCard
                label="Meals logged"
                value={`${stats?.mealsLoggedDays ?? 0}/7 days`}
                colors={colors}
              />
              <StatCard
                label="Workouts"
                value={`${stats?.workoutSessions ?? 0} sessions`}
                colors={colors}
              />
              <StatCard
                label="Hydration goal"
                value={`${stats?.hydrationDaysHit ?? 0}/7 days hit`}
                colors={colors}
              />
            </View>
            <Text style={[styles.observation, { color: colors.textSecondary }]}>{stats?.observation}</Text>
            <Text style={[styles.optionSub, { color: colors.textTertiary }]}>Does this match how the week felt?</Text>
            <View style={styles.pillWrap}>
              {[
                ["accurate", "Yes, accurate"],
                ["felt-better", "Felt better than this"],
                ["felt-harder", "Felt harder than this"],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setConsistencyRating(key as any)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: consistencyRating === key ? withAlpha(colors.accent, 0.12) : colors.surface2,
                      borderColor: consistencyRating === key ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: consistencyRating === key ? colors.accent : colors.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <QuestionBlock
              title="Any changes in how you look or feel physically?"
              subtitle="This is just for you. No judgment here."
              colors={colors}
            />
            <View style={styles.pillWrap}>
              {BODY_OPTIONS.map((option) => {
                const selected = bodyChanges.includes(option);
                return (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setBodyChanges((current) =>
                        selected ? current.filter((item) => item !== option) : [...current, option]
                      )
                    }
                    style={[
                      styles.pill,
                      {
                        backgroundColor: selected ? withAlpha(colors.accent, 0.12) : colors.surface2,
                        borderColor: selected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: selected ? colors.accent : colors.textSecondary }]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={bodyNote}
              onChangeText={setBodyNote}
              placeholder="Anything specific you noticed this week..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.noteInput,
                { backgroundColor: colors.surface3, borderColor: colors.border, color: colors.textPrimary },
              ]}
              multiline
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 12 }}>
            <QuestionBlock
              title="How was your headspace this week?"
              subtitle=""
              colors={colors}
            />
            {[1, 2, 3, 4, 5].map((score) => (
              <Pressable
                key={score}
                onPress={() => setMood(score as 1 | 2 | 3 | 4 | 5)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: mood === score ? withAlpha(colors.accent, 0.12) : colors.surface1,
                    borderColor: mood === score ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name={moodIcon(score)} size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      {["Stressed", "Neutral", "Steady", "Positive", "On fire"][score - 1]}
                    </Text>
                    <Text style={[styles.optionSub, { color: colors.textTertiary }]}>
                      {[
                        "Hard to stay consistent",
                        "Going through the motions",
                        "Feeling grounded",
                        "Motivated and focused",
                        "Best mental week in a while",
                      ][score - 1]}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
            <TextInput
              value={moodNote}
              onChangeText={setMoodNote}
              placeholder="What made this week feel this way?"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.noteInput,
                { backgroundColor: colors.surface3, borderColor: colors.border, color: colors.textPrimary },
              ]}
              multiline
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 16, alignItems: "center" }}>
            <Text style={[styles.completionTitle, { color: colors.textPrimary }]}>Week logged ✦</Text>
            <View style={styles.completionGrid}>
              <CompletionTile label="Energy" value={`${completed?.energy ?? energy}/5`} colors={colors} />
              <CompletionTile label="Consistency" value={`${completed?.mealsLoggedDays ?? stats?.mealsLoggedDays ?? 0}/7`} colors={colors} />
              <CompletionTile label="Body" value={`${completed?.bodyChanges.length ?? bodyChanges.length} notes`} colors={colors} />
              <CompletionTile label="Mood" value={`${completed?.mood ?? mood}/5`} colors={colors} />
            </View>
            <Text style={[styles.observation, { color: colors.textSecondary, textAlign: "center" }]}>
              {completionInsight}
            </Text>
            <Pressable
              onPress={() => setStep(5)}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.primaryButtonText}>See my history →</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[styles.secondaryButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 16 }}>
            <View style={styles.historyHeader}>
              <Pressable onPress={() => setStep(4)} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.title, { color: colors.textPrimary, fontSize: 20 }]}>Check-in History</Text>
              <View style={{ width: 40 }} />
            </View>

            {trendReady ? (
              <View style={styles.trendRow}>
                <TrendCard title="Energy trend" values={energyTrend} colors={colors} />
                <TrendCard title="Mood trend" values={moodTrend} colors={colors} />
              </View>
            ) : null}
            {trendReady ? (
              <Text style={[styles.historyAccent, { color: colors.accent }]}>
                Your energy has been improving over the last 4 weeks
              </Text>
            ) : null}

            {history.map((item) => (
              <HistoryCard key={item.id} item={item} colors={colors} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {step < 4 ? (
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable
            disabled={!nextEnabled}
            onPress={() => {
              if (step === 3) completeCheckin().catch(() => {});
              else setStep((current) => (current + 1) as Step);
            }}
            style={[
              styles.primaryButton,
              {
                backgroundColor: nextEnabled ? colors.accent : colors.surface2,
              },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: nextEnabled ? "#FFFFFF" : colors.textTertiary }]}>
              {step === 3 ? "Complete check-in →" : "Next →"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

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

function QuestionBlock({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.questionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function CompletionTile({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface1, borderColor: colors.border, flex: 1 }]}>
      <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function TrendCard({
  title,
  values,
  colors,
}: {
  title: string;
  values: number[];
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={[styles.trendCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{title}</Text>
      <View style={styles.sparkline}>
        {values.map((value, index) => (
          <View
            key={`${title}-${index}`}
            style={[
              styles.sparkBar,
              {
                height: Math.max(8, (value / max) * 40),
                backgroundColor: colors.accent,
                opacity: index === values.length - 1 ? 1 : 0.6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function HistoryCard({
  item,
  colors,
}: {
  item: WeeklyCheckin;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((current) => !current)}
      style={[styles.historyCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
    >
      <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{getWeekRangeLabel(item.weekOf)}</Text>
      <View style={styles.historyDots}>
        {[item.energy, item.mealsLoggedDays >= 5 ? 5 : 3, item.bodyChanges.length ? 4 : 2, item.mood].map((score, index) => (
          <View key={`${item.id}-${index}`} style={[styles.historyDot, { backgroundColor: scoreColor(score, colors) }]} />
        ))}
      </View>
      <Text style={[styles.bodySummary, { color: colors.textSecondary }]}>{item.aiInsight}</Text>
      {open ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Energy {item.energy}/5 · Mood {item.mood}/5</Text>
          <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
            Meals {item.mealsLoggedDays}/7 · Workouts {item.workoutSessions} · Hydration {item.hydrationDaysHit}/7
          </Text>
          {item.bodyChanges.length ? (
            <Text style={[styles.optionSub, { color: colors.textSecondary }]}>{item.bodyChanges.join(" · ")}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "300",
    textAlign: "center",
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingTop: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  questionTitle: {
    fontSize: 22,
    fontWeight: "500",
    textAlign: "center",
  },
  optionCard: {
    borderWidth: 0,
    borderRadius: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    gap: 4,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  optionSub: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noteInput: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    textAlignVertical: "top",
  },
  statGrid: {
    gap: 10,
  },
  statCard: {
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  observation: {
    fontSize: 12,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  primaryButton: {
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  secondaryButton: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: "200",
    textAlign: "center",
  },
  completionGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trendRow: {
    flexDirection: "row",
    gap: 10,
  },
  trendCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0,
    padding: 14,
    gap: 12,
  },
  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 44,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 999,
  },
  historyAccent: {
    fontSize: 12,
    fontWeight: "300",
  },
  historyCard: {
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  historyDots: {
    flexDirection: "row",
    gap: 6,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  bodySummary: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
});
