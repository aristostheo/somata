import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { ensureProfile, subscribeProfile, type Profile } from "@/services/profile";
import {
  loadBodyMetrics,
  loadBodyMetricsHistory,
  type BodyMetrics,
  type BodyMetricPoint,
} from "@/services/profile/bodyMetrics";
import { getThisWeeksCheckin, type WeeklyCheckin } from "@/services/weeklyCheckin";
import { getPhotos } from "@/services/progressPhotos";
import { loadUnlocksLocal } from "@/services/badges/store";
import { subscribeFriends } from "@/services/friends/friends";
import { subscribeIntegrations, type IntegrationSnapshot } from "@/services/integrations";
import { summarizeDietPrefs, type DietPreferences } from "@/services/profile/dietPreferences";
import { kgToLb, lbToKg } from "@/utils/units";
import { recordedStepsForDate, recordedWeights, weightTrendPath } from "@/components/profile/overviewData";
import { withAlpha } from "@/lib/color";
import { visualTokens, type VisualTokens } from "@/components/accountSettings/visualTokens";
import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import { FitAdaptReview } from "@/components/profile/FitAdaptReview";
import type { FitAdaptPlanState } from "@/services/fitadapt";

type Palette = VisualTokens;

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "Y").toUpperCase();
}

function SectionTitle({ title, palette }: { title: string; palette: Palette }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 11, paddingLeft: 2 }}><View style={{ width: 4, height: 16, borderRadius: 3, backgroundColor: palette.coral }} /><Text accessibilityRole="header" style={{ color: palette.text, fontSize: 13, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>{title}</Text></View>;
}

function Group({ children, palette }: { children: React.ReactNode; palette: Palette }) {
  return <View style={{ backgroundColor: palette.card, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.border, shadowColor: palette.heroStart, shadowOpacity: palette.dark ? 0 : 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: palette.dark ? 0 : 2 }}>{children}</View>;
}

function Action({ label, icon, onPress, palette, bright = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; palette: Palette; bright?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: bright ? 15 : 10, borderRadius: 13, backgroundColor: bright ? "#FFFFFF" : palette.primaryTint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, opacity: pressed ? 0.72 : 1 })}>
      <Ionicons name={icon} size={17} color={bright ? "#23335E" : palette.primary} />
      <Text style={{ color: bright ? "#23335E" : palette.text, fontSize: 14, fontWeight: "700", flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, detail, icon, onPress, palette, last = false }: { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; palette: Palette; last?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}, ${detail}`} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ minHeight: 66, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.65 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: palette.accentTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={18} color={palette.accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 18 }}>{detail}</Text>
      </View>
      {onPress ? <Ionicons name="arrow-forward" size={17} color={palette.primary} /> : null}
    </Pressable>
  );
}

function Metric({ label, value, palette, tone }: { label: string; value: string; palette: Palette; tone: "primary" | "accent" }) {
  const tint = tone === "primary" ? palette.primary : palette.accent;
  return (
    <LinearGradient colors={[withAlpha(tint, palette.dark ? 0.27 : 0.14), palette.raised]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, minWidth: 130, gap: 8, borderRadius: 18, padding: 16, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", width: 66, height: 66, borderRadius: 33, right: -24, top: -26, borderWidth: 1, borderColor: withAlpha(tint, 0.3) }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tint }} /><Text style={{ color: palette.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text></View>
      <Text style={{ color: palette.text, fontSize: 25, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </LinearGradient>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return <View style={{ minWidth: "47%", flexGrow: 1, paddingTop: 11, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.19)", gap: 5 }}><Text style={{ color: "#CFD9ED", fontSize: 11, fontWeight: "700", letterSpacing: 0.65, textTransform: "uppercase" }}>{label}</Text><Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text></View>;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { isDark, themeAccents } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [body, setBody] = useState<BodyMetrics | null>(null);
  const [history, setHistory] = useState<BodyMetricPoint[] | null | undefined>(undefined);
  const [checkin, setCheckin] = useState<WeeklyCheckin | null | undefined>(undefined);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(null);
  const [hidden, setHidden] = useState(false);
  const [fitAdaptState, setFitAdaptState] = useState<FitAdaptPlanState | null>(null);

  const palette: Palette = useMemo(() => visualTokens(
    isDark,
    (isDark ? themeAccents.dark.primary : themeAccents.light.primary) ?? (isDark ? "#A9C4FF" : "#315B9A"),
    (isDark ? themeAccents.dark.accent : themeAccents.light.accent) ?? (isDark ? "#79D7BF" : "#17786C"),
  ), [isDark, themeAccents]);

  useEffect(() => {
    if (!user?.uid) { setProfile(null); setProfileLoaded(true); return; }
    // Retain the existing safety creation for new accounts; editors own subsequent writes.
    void ensureProfile(user.uid).catch(() => {});
    setProfile(null);
    setProfileLoaded(false);
    return subscribeProfile(user.uid, (next) => { setProfile(next); setProfileLoaded(true); });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) { setFriendCount(null); return; }
    return subscribeFriends(user.uid, (rows) => setFriendCount(rows.length), ["accepted"]);
  }, [user?.uid]);

  useEffect(() => subscribeIntegrations(setIntegrations), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      const results = await Promise.allSettled([
        loadBodyMetrics(), loadBodyMetricsHistory(), getThisWeeksCheckin(), getPhotos(), loadUnlocksLocal(),
      ]);
      if (!active) return;
      setBody(results[0].status === "fulfilled" ? results[0].value : null);
      setHistory(results[1].status === "fulfilled" ? results[1].value : null);
      setCheckin(results[2].status === "fulfilled" ? results[2].value : undefined);
      setPhotoCount(results[3].status === "fulfilled" ? results[3].value.length : null);
      setBadgeCount(results[4].status === "fulfilled" ? Object.values(results[4].value).filter((item) => !!item?.unlockedAt).length : null);
    };
    void load();
    return () => { active = false; };
  }, []));

  const open = (href: Href) => router.push(href);
  const savedName = profile?.displayName?.trim() || user?.displayName?.trim();
  const name = savedName || "Your profile";
  const email = profile?.email || user?.email || "";
  const photo = profile?.photoURL || user?.photoURL;
  const unit = profile?.weightUnit === "lb" ? "lb" : "kg";
  const weightKg = positive(profile?.weightKg) ? profile.weightKg : positive(body?.weightLb) ? lbToKg(body.weightLb) : null;
  const weightText = weightKg == null ? "Not recorded" : `${(unit === "lb" ? kgToLb(weightKg) : weightKg).toFixed(1)} ${unit}`;
  const stepsMap = (profile as Profile & { steps?: Record<string, unknown> } | null)?.steps;
  const stepsToday = recordedStepsForDate(stepsMap, new Date());
  const hasStepHistory = !!stepsMap && Object.values(stepsMap).some((v) => v != null && Number.isFinite(Number(v)) && Number(v) >= 0);
  const recorded = useMemo(() => recordedWeights(history ?? []), [history]);
  const trend = useMemo(() => weightTrendPath(recorded.slice(-30).map((point) => point.weightLb)), [recorded]);
  const goalName = profile?.goal === "cut" ? "Weight loss" : profile?.goal === "lean_bulk" ? "Lean gain" : profile?.goal === "bulk" ? "Gain" : profile?.goal === "maintain" ? "Maintain" : null;
  const hasGoals = !!(profile?.goalInputs || profile?.goalResult || goalName || positive(profile?.targetWeightKg) || positive(profile?.stepsGoal));
  const accepted = fitAdaptState?.currentRecommendation?.targets;
  const activeTargets = accepted && profile?.activeFitAdaptTargets &&
    (Object.keys(accepted) as (keyof typeof accepted)[]).every((key) => accepted[key] === profile.activeFitAdaptTargets?.[key])
    ? accepted : null;
  const targetWeight = positive(profile?.targetWeightKg) ? `${(unit === "lb" ? kgToLb(profile.targetWeightKg) : profile.targetWeightKg).toFixed(1)} ${unit}` : null;
  const trainingDays = profile?.goalInputs?.trainingDaysPerWeek ?? profile?.trainingDaysPerWeek;
  const dietPrefs = (profile as Profile & { dietPreferences?: DietPreferences } | null)?.dietPreferences;
  const trainingDetail = positive(trainingDays) ? `${trainingDays} days per week` : "Not set";
  const savedContext = [profile?.workoutPlace === "home" ? "Home" : profile?.workoutPlace === "gym" ? "Gym" : null, ...(profile?.equipment ?? [])].filter(Boolean).join(" · ");
  const health = integrations?.connections.apple_health;
  const ring = integrations?.connections.ringconn;
  const visible = (value: string) => hidden ? "•••" : value;
  const recordedValue = (value: string, hasRecord: boolean) => hasRecord ? visible(value) : value;
  const count = (value: number | null, singular: string, plural: string) => value == null ? "Unavailable" : visible(`${value} ${value === 1 ? singular : plural}`);

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
    <FlowAtmosphere />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 110 + insets.bottom, gap: 27 }}>
      <View pointerEvents="none" style={{ position: "absolute", width: 230, height: 230, borderRadius: 115, right: -122, top: -90, backgroundColor: palette.primaryTint }} />
      <View style={{ gap: 4, paddingTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: palette.coral }} /><Text style={{ color: palette.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 2.2 }}>SOMATA</Text></View>
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 38, fontWeight: "700", letterSpacing: -1.5 }}>Profile</Text>
        <Text style={{ color: palette.secondary, fontSize: 14 }}>Your personal record, at a glance.</Text>
      </View>

      <View>
        <SectionTitle title="Identity" palette={palette} />
        <Group palette={palette}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 17, paddingBottom: 6 }}>
            <LinearGradient colors={[palette.primary, palette.accent]} style={{ width: 66, height: 66, borderRadius: 23, alignItems: "center", justifyContent: "center" }}>
              {photo ? <Image source={{ uri: photo }} style={{ width: 59, height: 59, borderRadius: 20, backgroundColor: palette.card }} accessibilityLabel="Profile photo" /> : <View style={{ width: 59, height: 59, borderRadius: 20, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>{initials(name)}</Text></View>}
            </LinearGradient>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: palette.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 }}>{name}</Text>
              {!!email && <Text style={{ color: palette.secondary, fontSize: 13 }}>{email}</Text>}
              {!profileLoaded && <Text style={{ color: palette.secondary, fontSize: 13 }}>Loading profile…</Text>}
              {profileLoaded && !profile && <Text style={{ color: palette.secondary, fontSize: 13 }}>Saved profile unavailable</Text>}
            </View>
          </View>
          <View style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 10, paddingBottom: 16, paddingTop: 10 }}>
            <Action label="Account" icon="person-outline" onPress={() => open("/account")} palette={palette} />
            <Action label="Settings" icon="settings-outline" onPress={() => open("/(modals)/settings")} palette={palette} />
          </View>
        </Group>
      </View>

      <View>
        <SectionTitle title="Plan" palette={palette} />
        <LinearGradient colors={[palette.heroStart, palette.heroMiddle, palette.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30, padding: 23, overflow: "hidden", shadowColor: palette.heroStart, shadowOpacity: palette.dark ? 0 : 0.2, shadowRadius: 19, shadowOffset: { width: 0, height: 11 }, elevation: palette.dark ? 0 : 5 }}>
          <View pointerEvents="none" style={{ position: "absolute", width: 210, height: 210, borderRadius: 105, right: -70, top: -82, backgroundColor: withAlpha(palette.primary, 0.18) }} />
          <View pointerEvents="none" style={{ position: "absolute", width: 142, height: 142, borderRadius: 71, left: -52, bottom: -73, backgroundColor: withAlpha(palette.accent, 0.2) }} />
          <Svg pointerEvents="none" width={160} height={160} viewBox="0 0 160 160" style={{ position: "absolute", right: -31, top: -39 }}>
            <Circle cx={80} cy={80} r={68} stroke={withAlpha(palette.gold, 0.38)} strokeWidth={1} fill="none" />
            <Circle cx={80} cy={80} r={50} stroke={withAlpha("#FFFFFF", 0.22)} strokeWidth={1} fill="none" />
            <Circle cx={80} cy={80} r={30} stroke={withAlpha(palette.accent, 0.54)} strokeWidth={2} fill="none" />
            <Circle cx={126} cy={32} r={4} fill={palette.gold} />
          </Svg>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: palette.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.8 }}>01  /  CURRENT FOCUS</Text>
            <Ionicons name="sparkles-outline" size={21} color={palette.gold} />
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 13 }}>{activeTargets ? "Active plan" : "Your goals"}</Text>
          {!profileLoaded ? <Text style={{ color: "#DBE4F1", fontSize: 15, marginTop: 9 }}>Loading goals…</Text> : !profile ? <Text style={{ color: "#DBE4F1", fontSize: 15, marginTop: 9 }}>Goals unavailable</Text> : !hasGoals ? <Text style={{ color: "#DBE4F1", fontSize: 15, marginTop: 9 }}>No goals set yet.</Text> : (
            <View>
              {!!goalName && <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "600", marginTop: 4, marginBottom: 21 }}>{goalName}</Text>}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: goalName ? 0 : 20 }}>
                {positive(activeTargets?.calories ?? profile.goalResult?.dailyCalories) && <PlanStat label="Daily energy" value={visible(`${Math.round((activeTargets?.calories ?? profile.goalResult?.dailyCalories)!).toLocaleString()} kcal`)} />}
                {positive(activeTargets?.protein ?? profile.goalResult?.protein) && <PlanStat label="Protein" value={visible(`${Math.round((activeTargets?.protein ?? profile.goalResult?.protein)!)} g`)} />}
                {!!targetWeight && <PlanStat label="Target weight" value={visible(targetWeight)} />}
                {positive(profile.stepsGoal) && <PlanStat label="Daily steps" value={visible(profile.stepsGoal.toLocaleString())} />}
              </View>
            </View>
          )}
          <View style={{ flexDirection: "row", marginTop: 22 }}><Action label="Edit goals" icon="create-outline" onPress={() => open("/profile/goal-setup")} palette={palette} bright /></View>
        </LinearGradient>
        <FitAdaptReview uid={user?.uid} profile={profile} hidden={hidden} palette={palette} onStateChange={setFitAdaptState} />
      </View>

      <View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <SectionTitle title="Progress" palette={palette} />
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show values" : "Hide values"} onPress={() => setHidden((value) => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, backgroundColor: palette.accentTint, borderRadius: 12 }}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={palette.accent} />
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{hidden ? "Show values" : "Hide values"}</Text>
          </Pressable>
        </View>
        <View style={{ backgroundColor: palette.card, borderRadius: 24, borderWidth: 1, borderColor: palette.border, padding: 16, shadowColor: palette.heroStart, shadowOpacity: palette.dark ? 0 : 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: palette.dark ? 0 : 2 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Metric label="Latest weight" value={recordedValue(weightText, weightKg != null)} palette={palette} tone="primary" />
            <Metric label="Steps today" value={stepsToday == null ? "Not recorded" : visible(stepsToday.toLocaleString())} palette={palette} tone="accent" />
          </View>
          <View style={{ marginTop: 17, paddingTop: 15, borderTopColor: palette.border, borderTopWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 }}><Ionicons name="analytics-outline" size={17} color={palette.primary} /><Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>Recorded weight trend</Text></View>
            {history === undefined ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Loading weight history…</Text> : history === null ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Weight history unavailable.</Text> : !trend ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Add measurements on two different days to see a trend.</Text> : hidden ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Trend hidden</Text> : <Svg width="100%" height={84} viewBox="0 0 300 72" accessibilityLabel="Weight measurements over time"><Path d={trend} stroke={palette.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          </View>
          {(!!trend || hasStepHistory) && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 }}>
            {!!trend && <Action label="Insights" icon="analytics-outline" onPress={() => open("/profile/insights-progress")} palette={palette} />}
            {hasStepHistory && <Action label="Steps history" icon="footsteps-outline" onPress={() => open("/profile/steps-history")} palette={palette} />}
          </View>}
        </View>
      </View>

      <View>
        <SectionTitle title="Body and check-in" palette={palette} />
        <Group palette={palette}>
          <Row label="Body measurements" detail={recordedValue([positive(profile?.bodyFatPct ?? body?.bodyFatPct) ? `${(profile?.bodyFatPct ?? body?.bodyFatPct)?.toFixed(1)}% body fat` : null, positive(profile?.waistCm ?? body?.waistCm) ? `${(profile?.waistCm ?? body?.waistCm)?.toFixed(1)} cm waist` : null, positive(profile?.heightCm ?? body?.heightCm) ? `${(profile?.heightCm ?? body?.heightCm)?.toFixed(0)} cm height` : null].filter(Boolean).join(" · ") || (weightKg != null ? weightText : "No measurements recorded"), positive(profile?.bodyFatPct ?? body?.bodyFatPct) || positive(profile?.waistCm ?? body?.waistCm) || positive(profile?.heightCm ?? body?.heightCm) || weightKg != null)} icon="body-outline" onPress={() => open("/(modals)/body-metrics")} palette={palette} />
          <Row label="Weekly check-in" detail={checkin === undefined ? "Unavailable" : checkin ? `Completed this week` : "No check-in this week"} icon="calendar-outline" onPress={() => open("/(modals)/weekly-checkin")} palette={palette} last />
        </Group>
      </View>

      <View>
        <SectionTitle title="Preferences" palette={palette} />
        <Group palette={palette}>
          <Row label="Diet choices" detail={summarizeDietPrefs(dietPrefs)} icon="restaurant-outline" onPress={() => open("/(modals)/diet-preferences")} palette={palette} />
          <Row label="Training days" detail={recordedValue(trainingDetail, positive(trainingDays))} icon="barbell-outline" onPress={() => open("/profile/goal-setup")} palette={palette} last={!savedContext} />
          {!!savedContext && <Row label="Training context" detail={savedContext} icon="fitness-outline" palette={palette} last />}
        </Group>
      </View>

      <View>
        <SectionTitle title="Collection and connections" palette={palette} />
        <Group palette={palette}>
          <Row label="Progress photos" detail={count(photoCount, "photo", "photos")} icon="images-outline" onPress={() => open("/(modals)/progress-photos")} palette={palette} />
          <Row label="Badges" detail={count(badgeCount, "unlocked", "unlocked")} icon="ribbon-outline" onPress={() => open("/(modals)/badges")} palette={palette} />
          <Row label="Friends" detail={count(friendCount, "friend", "friends")} icon="people-outline" onPress={() => open("/friends")} palette={palette} last={Platform.OS !== "ios"} />
          {Platform.OS === "ios" && <Row label="Apple Health" detail={health?.connected ? (health.status === "warning" || health.status === "error" ? "Connected · needs attention" : "Connected") : "Not connected"} icon="heart-outline" onPress={() => open("/profile/integrations")} palette={palette} last={!ring?.connected} />}
          {Platform.OS === "ios" && ring?.connected && <Row label="RingConn" detail={ring.status === "warning" || ring.status === "error" ? "Connected · needs attention" : "Connected"} icon="watch-outline" onPress={() => open("/profile/integrations")} palette={palette} last />}
        </Group>
      </View>
    </ScrollView>
    </View>
  );
}
