import { ProfileIntro, ProfileSection, ProfileRecord } from "@/components/profile/ProfileTaskUI";
import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Empty, Field, Heading, Item, Metric, Panel, TaskPage } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { Trend } from "@/components/somata/Trend";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View
} from "react-native";

import { usePremiumProfileFlowTheme as useTheme } from "@/components/accountSettings/useProfileFlowTheme";
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

function WeeklyCheckinScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

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
      getThisWeeksCheckin(localStore),
      getCheckins(localStore),
      getWeeklyConsistencyStats(user.uid, profile, weekOf, localStore),
    ]);
    setCompleted(current);
    setHistory(rows);
    setStats(nextStats);
  }, [profile, user?.uid, weekOf]);

  useEffect(() => {
    refresh().catch(() => { });
    scheduleWeeklyCheckinReminders(localStore).catch(() => { });
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
    }, localStore);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
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

  return (<TaskPage title={step === 5 ? 'Your check-in journal' : step === 4 ? 'Week recorded' : 'A moment to check in'} section="Weekly check-in" subtitle={weekLabel} onBack={close} footer={step < 4 ? <Button primary disabled={!nextEnabled} label={step === 3 ? 'Complete check-in' : 'Continue'} onPress={() => { if (step === 3) completeCheckin().catch(() => { }); else setStep(current => (current + 1) as Step); }} /> : undefined}>

    <ProfileIntro label={step < 4 ? "Weekly reflection" : "Your recorded journal"} title={step < 4 ? "A little space to reflect" : "Keep your own perspective"} detail="Your answers are personal reflections. They are separate from measured progress and FitAdapt targets." />
    {step < 4 && <><Text style={F.eyebrow}>QUESTION {step + 1} / 4</Text><View style={{ flexDirection: 'row', gap: 6 }}>
      {[0, 1, 2, 3].map(n => <View key={n} style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: n <= step ? D.teal : D.raised }} />)}
    </View></>}

    {step === 0 && <ProfileSection index="01" title="How was your energy?" detail="Consider workouts, daily life, and sleep.">{([1, 2, 3, 4, 5] as const).map(score => <Choice key={score} label={`${score} · ${['Exhausted', 'Low', 'Okay', 'Good', 'Great'][score - 1]}`} selected={energy === score} onPress={() => setEnergy(score)} />)}</ProfileSection>}

    {step === 1 && <ProfileSection index="02" title="Does the record match your week?">{stats ? <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Metric label="Meal logging" value={`${stats.mealsLoggedDays}/7 days`} />
      <Metric label="Workouts" value={String(stats.workoutSessions)} />
      <Metric label="Hydration goal" value={`${stats.hydrationDaysHit}/7 days`} />
    </View><Text style={F.body}>{stats.observation}</Text></> : <Empty title="Loading this week’s records…" />}{([['accurate', 'Yes, accurate'], ['felt-better', 'It felt better'], ['felt-harder', 'It felt harder']] as const).map(([key, label]) => <Choice key={key} label={label} selected={consistencyRating === key} onPress={() => setConsistencyRating(key)} />)}</ProfileSection>}

    {step === 2 && <ProfileSection index="03" title="What have you noticed?" detail="Choose any that fit. You can leave this blank.">{BODY_OPTIONS.map(option => <Choice key={option} label={option} selected={bodyChanges.includes(option)} onPress={() => setBodyChanges(current => current.includes(option) ? current.filter(x => x !== option) : [...current, option])} />)}<Field label="Body notes · optional" multiline value={bodyNote} onChangeText={setBodyNote} /></ProfileSection>}

    {step === 3 && <ProfileSection index="04" title="How did the week feel?">{([1, 2, 3, 4, 5] as const).map(score => <Choice key={score} label={`${score} / 5 · ${['Difficult', 'Low', 'Mixed', 'Good', 'Great'][score - 1]}`} selected={mood === score} onPress={() => setMood(score)} />)}<Field label="Mood notes · optional" multiline value={moodNote} onChangeText={setMoodNote} /></ProfileSection>}

    {step === 4 && <><Panel accent>
      <Heading title="A week worth recording" />
      <Item title="Energy" value={`${completed?.energy ?? energy}/5`} />
      <Item title="Meal logging" value={`${completed?.mealsLoggedDays ?? stats?.mealsLoggedDays ?? 0}/7 days`} />
      <Item title="Body notes" value={String(completed?.bodyChanges.length ?? bodyChanges.length)} />
      <Item title="Mood" value={`${completed?.mood ?? mood}/5`} />
      {!!completionInsight && <Text style={F.body}>{completionInsight}</Text>}
    </Panel><Button primary label="See check-in history" onPress={() => setStep(5)} /><Button label="Done" onPress={() => router.back()} /></>}

    {step === 5 && <><Button label="Back to this week" onPress={() => setStep(4)} />{trendReady ? <><Panel>
      <Heading title="Recorded energy" />
      <Trend premiumProfile values={energyTrend} unit="/5" />
    </Panel><Panel>
        <Heading title="Recorded mood" />
        <Trend premiumProfile values={moodTrend} unit="/5" />
      </Panel></> : <Empty title="Your journal is taking shape" detail="Four check-ins are needed to show energy and mood trends." />}{history.map(item => <ProfileRecord key={item.id} label={getWeekRangeLabel(item.weekOf)}>
        <Text style={F.body}>Energy {item.energy}/5 · Mood {item.mood}/5</Text>
        <Text style={F.caption}>Meals {item.mealsLoggedDays}/7 days · {item.workoutSessions} workouts · Hydration {item.hydrationDaysHit}/7 days</Text>
        <Text style={F.caption}>{item.consistencyRating}</Text>
        {item.bodyChanges.map(note => <Text key={note} style={F.body}>{note}</Text>)}
        {!!item.bodyNote && <Text style={F.body}>{item.bodyNote}</Text>}
        {!!item.moodNote && <Text style={F.body}>{item.moodNote}</Text>}
        {!!item.aiInsight && <Text style={F.caption}>{item.aiInsight}</Text>}
      </ProfileRecord>)}</>}
  </TaskPage>
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

export default function WeeklyCheckinScreen() {
  return <SomataTaskAppearance><WeeklyCheckinScreenContent /></SomataTaskAppearance>;
}
