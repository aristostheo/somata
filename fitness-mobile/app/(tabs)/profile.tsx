import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

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

type Palette = {
  canvas: string;
  card: string;
  text: string;
  secondary: string;
  border: string;
  primary: string;
  accent: string;
  soft: string;
  dark: boolean;
};

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "Y").toUpperCase();
}

function SectionTitle({ title, color }: { title: string; color: string }) {
  return <Text accessibilityRole="header" style={{ color, fontSize: 20, fontWeight: "700", letterSpacing: -0.3, marginBottom: 12 }}>{title}</Text>;
}

function Card({ children, palette }: { children: React.ReactNode; palette: Palette }) {
  return (
    <View style={{ backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, borderRadius: 16, padding: 18, shadowColor: "#142033", shadowOpacity: palette.dark ? 0 : 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
      {children}
    </View>
  );
}

function Action({ label, icon, onPress, palette, filled = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; palette: Palette; filled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 15, borderRadius: 12, borderWidth: filled ? 0 : 1, borderColor: palette.border, backgroundColor: filled ? palette.primary : pressed ? palette.soft : palette.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name={icon} size={18} color={filled ? (palette.dark ? "#111419" : "#FFFFFF") : palette.primary} />
      <Text style={{ color: filled ? (palette.dark ? "#111419" : "#FFFFFF") : palette.primary, fontSize: 15, fontWeight: "600", flexShrink: 1, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, detail, icon, onPress, palette, last = false }: { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; palette: Palette; last?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}, ${detail}`} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ minHeight: 60, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.65 : 1 })}>
      <Ionicons name={icon} size={21} color={palette.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: palette.secondary, fontSize: 14, lineHeight: 19 }}>{detail}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={palette.secondary} /> : null}
    </Pressable>
  );
}

function Metric({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <View style={{ flex: 1, minWidth: 130, gap: 4 }}>
      <Text style={{ color: palette.secondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
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

  const palette: Palette = useMemo(() => ({
    canvas: isDark ? "#111419" : "#F7F8FA",
    card: isDark ? "#1B2128" : "#FFFFFF",
    text: isDark ? "#F4F6F8" : "#1B2430",
    secondary: isDark ? "#AFBAC6" : "#596575",
    border: isDark ? "#303842" : "#E4E9EF",
    primary: (isDark ? themeAccents.dark.primary : themeAccents.light.primary) ?? (isDark ? "#A9C4FF" : "#315B9A"),
    accent: (isDark ? themeAccents.dark.accent : themeAccents.light.accent) ?? (isDark ? "#79D7BF" : "#17786C"),
    soft: isDark ? "#263442" : "#EDF3F8",
    dark: isDark,
  }), [isDark, themeAccents]);

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
    <ScrollView style={{ flex: 1, backgroundColor: palette.canvas }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 24, paddingBottom: 110 + insets.bottom, gap: 24 }}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 32, fontWeight: "700", letterSpacing: -0.7 }}>Profile</Text>
        <Text style={{ color: palette.secondary, fontSize: 14 }}>Your personal record, at a glance.</Text>
      </View>

      <View>
        <SectionTitle title="Identity" color={palette.text} />
        <Card palette={palette}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: palette.soft }} accessibilityLabel="Profile photo" /> : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: palette.soft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.primary, fontSize: 20, fontWeight: "700" }}>{initials(name)}</Text></View>}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>{name}</Text>
              {!!email && <Text style={{ color: palette.secondary, fontSize: 14 }}>{email}</Text>}
              {!profileLoaded && <Text style={{ color: palette.secondary, fontSize: 13 }}>Loading profile…</Text>}
              {profileLoaded && !profile && <Text style={{ color: palette.secondary, fontSize: 13 }}>Saved profile unavailable</Text>}
            </View>
          </View>
          <View style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Action label="Account" icon="person-outline" onPress={() => open("/account")} palette={palette} /></View>
            <View style={{ flex: 1 }}><Action label="Settings" icon="settings-outline" onPress={() => open("/(modals)/settings")} palette={palette} /></View>
          </View>
        </Card>
      </View>

      <View>
        <SectionTitle title="Plan" color={palette.text} />
        <Card palette={palette}>
          <Text style={{ color: palette.primary, fontSize: 14, fontWeight: "700", marginBottom: 6 }}>Your goals</Text>
          {!profileLoaded ? <Text style={{ color: palette.secondary, fontSize: 15 }}>Loading goals…</Text> : !profile ? <Text style={{ color: palette.secondary, fontSize: 15 }}>Goals unavailable</Text> : !hasGoals ? <Text style={{ color: palette.secondary, fontSize: 15 }}>No goals set yet.</Text> : (
            <View style={{ gap: 7 }}>
              {!!goalName && <Text style={{ color: palette.text, fontSize: 18, fontWeight: "600" }}>{goalName}</Text>}
              {positive(profile.goalResult?.dailyCalories) && <Text style={{ color: palette.secondary, fontSize: 15 }}>Daily energy · {visible(`${Math.round(profile.goalResult.dailyCalories).toLocaleString()} kcal`)}</Text>}
              {positive(profile.goalResult?.protein) && <Text style={{ color: palette.secondary, fontSize: 15 }}>Protein · {visible(`${Math.round(profile.goalResult.protein)} g`)}</Text>}
              {!!targetWeight && <Text style={{ color: palette.secondary, fontSize: 15 }}>Target weight · {visible(targetWeight)}</Text>}
              {positive(profile.stepsGoal) && <Text style={{ color: palette.secondary, fontSize: 15 }}>Daily steps · {visible(profile.stepsGoal.toLocaleString())}</Text>}
            </View>
          )}
          <View style={{ marginTop: 18 }}><Action label="Edit goals" icon="create-outline" onPress={() => open("/profile/goal-setup")} palette={palette} /></View>
        </Card>
      </View>

      <View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}>Progress</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show values" : "Hide values"} onPress={() => setHidden((value) => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 5 }}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={palette.primary} />
            <Text style={{ color: palette.primary, fontSize: 14, fontWeight: "600" }}>{hidden ? "Show values" : "Hide values"}</Text>
          </Pressable>
        </View>
        <Card palette={palette}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <Metric label="Latest weight" value={recordedValue(weightText, weightKg != null)} palette={palette} />
            <Metric label="Steps today" value={stepsToday == null ? "Not recorded" : visible(stepsToday.toLocaleString())} palette={palette} />
          </View>
          <View style={{ marginTop: 18, borderTopColor: palette.border, borderTopWidth: 1, paddingTop: 16 }}>
            <Text style={{ color: palette.text, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>Recorded weight trend</Text>
            {history === undefined ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Loading weight history…</Text> : history === null ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Weight history unavailable.</Text> : !trend ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Add measurements on two different days to see a trend.</Text> : hidden ? <Text style={{ color: palette.secondary, fontSize: 14 }}>Trend hidden</Text> : <Svg width="100%" height={72} viewBox="0 0 300 72" accessibilityLabel="Weight measurements over time"><Path d={trend} stroke={palette.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          </View>
          {(!!trend || hasStepHistory) && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            {!!trend && <Action label="Insights" icon="analytics-outline" onPress={() => open("/profile/insights-progress")} palette={palette} />}
            {hasStepHistory && <Action label="Steps history" icon="footsteps-outline" onPress={() => open("/profile/steps-history")} palette={palette} />}
          </View>}
        </Card>
      </View>

      <View>
        <SectionTitle title="Body and check-in" color={palette.text} />
        <Card palette={palette}>
          <Row label="Body measurements" detail={recordedValue([positive(profile?.bodyFatPct ?? body?.bodyFatPct) ? `${(profile?.bodyFatPct ?? body?.bodyFatPct)?.toFixed(1)}% body fat` : null, positive(profile?.waistCm ?? body?.waistCm) ? `${(profile?.waistCm ?? body?.waistCm)?.toFixed(1)} cm waist` : null, positive(profile?.heightCm ?? body?.heightCm) ? `${(profile?.heightCm ?? body?.heightCm)?.toFixed(0)} cm height` : null].filter(Boolean).join(" · ") || (weightKg != null ? weightText : "No measurements recorded"), positive(profile?.bodyFatPct ?? body?.bodyFatPct) || positive(profile?.waistCm ?? body?.waistCm) || positive(profile?.heightCm ?? body?.heightCm) || weightKg != null)} icon="body-outline" onPress={() => open("/(modals)/body-metrics")} palette={palette} />
          <Row label="Weekly check-in" detail={checkin === undefined ? "Unavailable" : checkin ? `Completed this week` : "No check-in this week"} icon="calendar-outline" onPress={() => open("/(modals)/weekly-checkin")} palette={palette} last />
        </Card>
      </View>

      <View>
        <SectionTitle title="Preferences" color={palette.text} />
        <Card palette={palette}>
          <Row label="Diet choices" detail={summarizeDietPrefs(dietPrefs)} icon="restaurant-outline" onPress={() => open("/(modals)/diet-preferences")} palette={palette} />
          <Row label="Training days" detail={recordedValue(trainingDetail, positive(trainingDays))} icon="barbell-outline" onPress={() => open("/profile/goal-setup")} palette={palette} last={!savedContext} />
          {!!savedContext && <Row label="Training context" detail={savedContext} icon="fitness-outline" palette={palette} last />}
        </Card>
      </View>

      <View>
        <SectionTitle title="Collection and connections" color={palette.text} />
        <Card palette={palette}>
          <Row label="Progress photos" detail={count(photoCount, "photo", "photos")} icon="images-outline" onPress={() => open("/(modals)/progress-photos")} palette={palette} />
          <Row label="Badges" detail={count(badgeCount, "unlocked", "unlocked")} icon="ribbon-outline" onPress={() => open("/(modals)/badges")} palette={palette} />
          <Row label="Friends" detail={count(friendCount, "friend", "friends")} icon="people-outline" onPress={() => open("/friends")} palette={palette} last={Platform.OS !== "ios"} />
          {Platform.OS === "ios" && <Row label="Apple Health" detail={health?.connected ? (health.status === "warning" || health.status === "error" ? "Connected · needs attention" : "Connected") : "Not connected"} icon="heart-outline" onPress={() => open("/profile/integrations")} palette={palette} last={!ring?.connected} />}
          {Platform.OS === "ios" && ring?.connected && <Row label="RingConn" detail={ring.status === "warning" || ring.status === "error" ? "Connected · needs attention" : "Connected"} icon="watch-outline" onPress={() => open("/profile/integrations")} palette={palette} last />}
        </Card>
      </View>
    </ScrollView>
  );
}
