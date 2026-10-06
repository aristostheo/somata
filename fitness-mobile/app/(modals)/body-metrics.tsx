import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
// app/(modals)/body-metrics.tsx — Premium health dashboard redesign
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import {
  buildGoalInputsFromProfile,
  buildGoalProfilePatch,
  shouldRecalculate,
} from "@/services/macroCalculator";
import { useProfileFlowTheme as useTheme } from "@/components/accountSettings/useProfileFlowTheme";
import MetricPickerSheet from "@/components/profile/premium/bodyMetrics/MetricPickerSheet";
import { withAlpha } from "@/components/profile/premium/ui";
import {
  appendBodyMetricsHistory,
  loadBodyMetrics,
  loadBodyMetricsHistory,
  saveBodyMetrics,
  type BodyMetricPoint,
} from "@/services/profile/bodyMetrics";

// ─── utilities ───────────────────────────────────────────────────────────────

const UNIT_KEY = "@body_metrics:unit:v2";

function lbToKg(lb: number) { return lb * 0.45359237; }
function kgToLb(kg: number) { return kg / 0.45359237; }
function round1(x: number) { return Math.round(x * 10) / 10; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function computeBMI(weightLb: number | undefined, heightCm: number | undefined) {
  if (!weightLb || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return lbToKg(weightLb) / (m * m);
}

function bmiDescriptor(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function bmiColor(bmi: number, colors: ReturnType<typeof useTheme>["colors"]): string {
  if (bmi < 18.5 || bmi >= 30) return colors.danger;
  if (bmi < 25) return colors.success;
  return colors.warning;
}

function navyBodyFat(
  sex: "male" | "female" | "other",
  waistCm: number,
  neckCm: number,
  heightCm: number,
  hipCm?: number,
): number | null {
  if (waistCm <= neckCm || heightCm <= 0) return null;
  if (sex === "female" || sex === "other") {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    const bf = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.22100 * Math.log10(heightCm)) - 450;
    return clamp(round1(bf), 3, 60);
  }
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  return clamp(round1(bf), 3, 60);
}

function fmtWeight(lb: number, unit: "imperial" | "metric"): string {
  return unit === "imperial" ? `${Math.round(lb)} lb` : `${round1(lbToKg(lb))} kg`;
}

function fmtHeight(cm: number, unit: "imperial" | "metric"): string {
  if (unit === "imperial") {
    const totalIn = Math.round(cm * 0.393701);
    return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
  }
  return `${Math.round(cm)} cm`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function weeksToGoalCalc(
  history: BodyMetricPoint[],
  currentLb: number,
  targetLb: number,
): number | null {
  const recent = history
    .filter((p) => p.weightLb && p.t > Date.now() - 60 * 86400000)
    .sort((a, b) => a.t - b.t);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const deltaLb = (last.weightLb ?? 0) - (first.weightLb ?? 0);
  const deltaMs = last.t - first.t;
  if (deltaMs < 7 * 86400000) return null;
  const pacePerWeek = deltaLb / (deltaMs / (7 * 86400000));
  if (Math.abs(pacePerWeek) < 0.1) return null;
  const diff = targetLb - currentLb;
  if ((diff > 0 && pacePerWeek <= 0) || (diff < 0 && pacePerWeek >= 0)) return null;
  const weeks = Math.abs(diff / pacePerWeek);
  if (weeks > 200 || weeks < 1) return null;
  return Math.round(weeks);
}

// ─── types ───────────────────────────────────────────────────────────────────

type UnitMode = "imperial" | "metric";
type SexType = "male" | "female" | "other";
type SheetKey = "weight" | "target" | "height" | "age" | "bodyfat" | "waist" | "neck" | "hip";
type HistoryRange = "30D" | "90D" | "all";

type Draft = {
  weightLb?: number;
  targetWeightLb?: number;
  heightCm?: number;
  bodyFatPct?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
  age?: number;
  sex?: SexType;
};

function draftFromProfile(profile: Profile | null): Draft {
  if (!profile) return {};
  return {
    weightLb:
      profile.weightKg != null && Number.isFinite(profile.weightKg)
        ? kgToLb(profile.weightKg)
        : undefined,
    targetWeightLb:
      profile.targetWeightKg != null && Number.isFinite(profile.targetWeightKg)
        ? kgToLb(profile.targetWeightKg)
        : undefined,
    heightCm:
      profile.heightCm != null && Number.isFinite(profile.heightCm)
        ? profile.heightCm
        : undefined,
    bodyFatPct:
      profile.bodyFatPct != null &&
      Number.isFinite(profile.bodyFatPct) &&
      profile.bodyFatPct > 0
        ? profile.bodyFatPct
        : undefined,
    waistCm:
      profile.waistCm != null && Number.isFinite(profile.waistCm)
        ? profile.waistCm
        : undefined,
    neckCm:
      profile.neckCm != null && Number.isFinite(profile.neckCm)
        ? profile.neckCm
        : undefined,
    hipCm:
      profile.hipCm != null && Number.isFinite(profile.hipCm)
        ? profile.hipCm
        : undefined,
    age:
      profile.age != null && Number.isFinite(profile.age) ? profile.age : undefined,
    sex: profile.sex ? (profile.sex as SexType) : undefined,
  };
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function BodyMetricsEditorScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [unitMode, setUnitMode] = useState<UnitMode>("imperial");
  const [draft, setDraft] = useState<Draft>({ weightLb: 216, targetWeightLb: 210, heightCm: 183 });
  const [original, setOriginal] = useState<Draft | null>(null);
  const [history, setHistory] = useState<BodyMetricPoint[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("30D");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [pendingRecalc, setPendingRecalc] = useState<{
    previousWeightKg: number;
    newWeightKg: number;
    nextTargetKg?: number;
  } | null>(null);

  const params = useLocalSearchParams<{
    unit?: string;
    weightKg?: string;
    targetWeightKg?: string;
    heightCm?: string;
    bodyFatPct?: string;
    waistCm?: string;
  }>();

  const hasParams =
    params.weightKg != null ||
    params.targetWeightKg != null ||
    params.heightCm != null;

  // ── load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [m, h, savedUnit] = await Promise.all([
          loadBodyMetrics(),
          loadBodyMetricsHistory(),
          AsyncStorage.getItem(UNIT_KEY),
        ]);
        if (!mounted) return;

        if (savedUnit === "imperial" || savedUnit === "metric") {
          setUnitMode(savedUnit);
        } else if (params.unit === "kg") {
          setUnitMode("metric");
        }

        if (m && !hasParams) {
          const base: Draft = {
            weightLb: m.weightLb,
            targetWeightLb: m.targetWeightLb,
            heightCm: m.heightCm,
            bodyFatPct: m.bodyFatPct,
            waistCm: m.waistCm,
          };
          setDraft(base);
          setOriginal(base);
        } else if (hasParams) {
          const wKg = Number(params.weightKg ?? NaN);
          const tKg = Number(params.targetWeightKg ?? NaN);
          const hCm = Number(params.heightCm ?? NaN);
          const bf = Number(params.bodyFatPct ?? NaN);
          const waist = Number(params.waistCm ?? NaN);
          const base: Draft = {
            weightLb: Number.isFinite(wKg) ? kgToLb(wKg) : undefined,
            targetWeightLb: Number.isFinite(tKg) ? kgToLb(tKg) : undefined,
            heightCm: Number.isFinite(hCm) ? hCm : undefined,
            bodyFatPct: Number.isFinite(bf) && bf > 0 ? bf : undefined,
            waistCm: Number.isFinite(waist) ? waist : undefined,
          };
          setDraft(base);
          setOriginal(base);
        } else {
          setOriginal(draft);
        }

        setHistory(h);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── computed ──────────────────────────────────────────────────────────────

  const dirty = useMemo(() => {
    if (!original) return false;
    const keys: (keyof Draft)[] = [
      "weightLb", "targetWeightLb", "heightCm", "bodyFatPct",
      "waistCm", "neckCm", "hipCm", "age", "sex",
    ];
    return keys.some((k) => (original[k] ?? null) !== (draft[k] ?? null));
  }, [original, draft]);

  // Sync canonical values from the remote profile once it arrives, but never
  // overwrite local edits already in progress.
  useEffect(() => {
    if (!profile || dirty) return;
    const next = draftFromProfile(profile);
    const hasRemoteValues = Object.values(next).some((value) => value != null);
    if (!hasRemoteValues) return;

    setDraft((current) => {
      const merged = { ...current, ...next };
      return JSON.stringify(merged) === JSON.stringify(current) ? current : merged;
    });
    setOriginal((current) => {
      const base = current ?? {};
      const merged = { ...base, ...next };
      return JSON.stringify(merged) === JSON.stringify(base) ? current : merged;
    });

    void saveBodyMetrics({
      weightLb: next.weightLb,
      targetWeightLb: next.targetWeightLb,
      heightCm: next.heightCm,
      bodyFatPct: next.bodyFatPct,
      waistCm: next.waistCm,
    }).catch(() => {});
  }, [profile, dirty]);

  const bmi = useMemo(() => computeBMI(draft.weightLb, draft.heightCm), [draft.weightLb, draft.heightCm]);

  const navyEst = useMemo(() => {
    if (!draft.waistCm || !draft.neckCm || !draft.heightCm) return null;
    return navyBodyFat(draft.sex ?? "male", draft.waistCm, draft.neckCm, draft.heightCm, draft.hipCm);
  }, [draft.waistCm, draft.neckCm, draft.heightCm, draft.hipCm, draft.sex]);

  const leanMass = useMemo(() => {
    if (!draft.weightLb || !draft.bodyFatPct || draft.bodyFatPct <= 0) return null;
    const weightKg = lbToKg(draft.weightLb);
    const leanKg = weightKg * (1 - draft.bodyFatPct / 100);
    return { kg: round1(leanKg), lb: Math.round(kgToLb(leanKg)) };
  }, [draft.weightLb, draft.bodyFatPct]);

  const bodyFatError = useMemo(() => {
    const v = draft.bodyFatPct;
    if (v == null || v <= 0) return null;
    if (v < 3 || v > 50) return "Body fat must be between 3% and 50%";
    return null;
  }, [draft.bodyFatPct]);

  const weeksToGoal = useMemo(() => {
    if (!draft.weightLb || !draft.targetWeightLb) return null;
    return weeksToGoalCalc(history, draft.weightLb, draft.targetWeightLb);
  }, [draft.weightLb, draft.targetWeightLb, history]);

  const coachNote = useMemo(() => {
    if (!draft.weightLb || !draft.heightCm) return "Add height and weight for personalized insights.";
    if (bmi == null) return "Add height and weight for personalized insights.";
    if (bmi >= 25 && (profile?.goal === "cut" || profile?.macroEngineMode === "cut")) {
      return "You're close to a healthy BMI. Your cut is working.";
    }
    return "Your metrics look solid. Keep logging to track trends.";
  }, [bmi, draft.weightLb, draft.heightCm, profile?.goal, profile?.macroEngineMode]);

  // ── ring progress values ──────────────────────────────────────────────────

  const ring1 = useMemo(() => {
    if (!draft.weightLb || !draft.targetWeightLb) return 0;
    const diff = Math.abs(draft.weightLb - draft.targetWeightLb);
    const scale = Math.max(draft.weightLb * 0.12, 6);
    return clamp(1 - diff / scale, 0, 1);
  }, [draft.weightLb, draft.targetWeightLb]);

  const ring2 = useMemo(() => {
    if (bmi == null) return 0;
    if (bmi >= 18.5 && bmi <= 24.9) return 1;
    if (bmi >= 17 && bmi <= 27.4) return 0.55;
    return 0.25;
  }, [bmi]);

  const ring3 = useMemo(() => {
    const bf = draft.bodyFatPct;
    if (!bf || bf <= 0) return 0;
    const idealMin = draft.sex === "female" ? 20 : draft.sex === "other" ? 17 : 13;
    const idealMax = draft.sex === "female" ? 28 : draft.sex === "other" ? 24 : 20;
    if (bf >= idealMin && bf <= idealMax) return 1;
    return clamp(1 - Math.abs(bf - (idealMin + idealMax) / 2) / 15, 0.1, 0.9);
  }, [draft.bodyFatPct, draft.sex]);

  const ring2Color = useMemo(() => bmi != null ? bmiColor(bmi, colors) : colors.border, [bmi, colors]);
  const ring3Color = useMemo(() => {
    const bf = draft.bodyFatPct;
    if (!bf || bf <= 0) return colors.border;
    const idealMin = draft.sex === "female" ? 20 : 13;
    const idealMax = draft.sex === "female" ? 28 : 20;
    return bf >= idealMin && bf <= idealMax ? colors.success : colors.warning;
  }, [draft.bodyFatPct, draft.sex, colors]);

  // ── picker value arrays ───────────────────────────────────────────────────

  const weightValuesLb = useMemo(() => Array.from({ length: 321 }, (_, i) => 80 + i), []);
  const weightValuesKg = useMemo(() => {
    const arr: number[] = [];
    for (let kg = 36; kg <= 181; kg += 0.5) arr.push(round1(kgToLb(kg)));
    return Array.from(new Set(arr.map((x) => Math.round(x * 10) / 10)));
  }, []);
  const heightValues = useMemo(() => Array.from({ length: 101 }, (_, i) => 120 + i), []);
  const ageValues = useMemo(() => Array.from({ length: 88 }, (_, i) => 13 + i), []);
  const bodyFatValues = useMemo(() => {
    const arr: number[] = [];
    for (let p = 3; p <= 50; p += 0.5) arr.push(round1(p));
    return arr;
  }, []);
  const waistNeckHipValues = useMemo(() => {
    const arr: number[] = [];
    for (let cm = 20; cm <= 160; cm += 0.5) arr.push(round1(cm));
    return arr;
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────

  const setUnit = useCallback(async (u: UnitMode) => {
    setUnitMode(u);
    await AsyncStorage.setItem(UNIT_KEY, u).catch(() => {});
  }, []);

  const confirmBack = () => {
    if (!dirty) return router.back();
    setDiscardOpen(true);
  };

  const onSave = async () => {
    if (!user?.uid || bodyFatError) return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

    const nextWeightKg = draft.weightLb != null ? round1(lbToKg(draft.weightLb)) : undefined;
    const nextTargetKg = draft.targetWeightLb != null ? round1(lbToKg(draft.targetWeightLb)) : undefined;

    const patch: Partial<Profile> = {
      weightKg: nextWeightKg,
      targetWeightKg: nextTargetKg,
      heightCm: draft.heightCm ?? undefined,
      bodyFatPct: draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : (null as any),
      waistCm: draft.waistCm ?? undefined,
      neckCm: draft.neckCm ?? undefined,
      hipCm: draft.hipCm ?? undefined,
      age: draft.age ?? undefined,
      sex: draft.sex ?? undefined,
      weightUnit: unitMode === "imperial" ? "lb" : "kg",
    };

    const previousWeightKg = Number(profile?.weightKg ?? NaN);
    const shouldPrompt =
      Number.isFinite(previousWeightKg) &&
      nextWeightKg != null &&
      profile?.goalInputs &&
      shouldRecalculate(previousWeightKg, nextWeightKg);

    await updateProfile(user.uid, patch as any);

    await saveBodyMetrics({
      weightLb: draft.weightLb,
      targetWeightLb: draft.targetWeightLb,
      heightCm: draft.heightCm,
      bodyFatPct:
        draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : undefined,
      waistCm: draft.waistCm,
    });

    await appendBodyMetricsHistory({
      t: Date.now(),
      weightLb: draft.weightLb,
      waistCm: draft.waistCm,
      bodyFatPct: draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : undefined,
    });

    setHistory((h) => {
      const point: BodyMetricPoint = {
        t: Date.now(),
        weightLb: draft.weightLb,
        waistCm: draft.waistCm,
        bodyFatPct: draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : undefined,
      };
      return [...h, point];
    });

    setProfile((current) => (current ? { ...current, ...patch } : current));
    setOriginal({ ...draft });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);

    if (shouldPrompt) {
      setPendingRecalc({ previousWeightKg, newWeightKg: nextWeightKg!, nextTargetKg });
      setRecalcOpen(true);
    }
  };

  const handleKeepGoals = () => { setRecalcOpen(false); setPendingRecalc(null); };

  const handleRecalculate = async () => {
    if (!user?.uid || !pendingRecalc) return;
    const nextInputs = buildGoalInputsFromProfile({
      ...(profile ?? {}),
      weightKg: pendingRecalc.newWeightKg,
      targetWeightKg: pendingRecalc.nextTargetKg ?? profile?.targetWeightKg,
      heightCm: draft.heightCm ?? profile?.heightCm,
      bodyFatPct: draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : profile?.bodyFatPct,
    });
    await updateProfile(user.uid, buildGoalProfilePatch(nextInputs) as any);
    setRecalcOpen(false);
    setPendingRecalc(null);
  };

  const deleteCheckIn = useCallback((idx: number) => {
    setHistory((h) => h.filter((_, i) => i !== idx));
  }, []);

  // ── render helpers ────────────────────────────────────────────────────────

  const weightValues = unitMode === "imperial" ? weightValuesLb : weightValuesKg;

  const weightPickerValue = draft.weightLb == null ? null :
    unitMode === "imperial" ? Math.round(draft.weightLb) : round1(lbToKg(draft.weightLb));

  const targetPickerValue = draft.targetWeightLb == null ? null :
    unitMode === "imperial" ? Math.round(draft.targetWeightLb) : round1(lbToKg(draft.targetWeightLb));

  const formatWeightPicker = (v: number) =>
    unitMode === "imperial" ? `${Math.round(v)}` : `${round1(v)}`;

  const formatWeightPickerWithUnit = (lb: number) => fmtWeight(lb, unitMode);

  const filteredHistory = useMemo(() => {
    const sorted = [...history].filter((p) => p.weightLb).sort((a, b) => b.t - a.t);
    return sorted;
  }, [history]);

  const visibleHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 10);

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlowAtmosphere />
        {/* ── Top bar ── */}
        <View style={[styles.topBar, {
          paddingTop: 12,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }]}>
          <Pressable onPress={confirmBack} style={[styles.iconBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </Pressable>

          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Body Metrics</Text>

          <Pressable
            disabled={!dirty || !!bodyFatError}
            onPress={onSave}
            style={[
              styles.saveBtn,
              { backgroundColor: dirty && !bodyFatError ? colors.accent : colors.surface2 },
            ]}
          >
            <Text style={[styles.saveText, { color: dirty && !bodyFatError ? (colors as any).buttonText ?? "#fff" : colors.textTertiary }]}>
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 20 }}
        >
          {/* ── Hero ── */}
          <HeroCard
            bmi={bmi}
            ring1={ring1}
            ring2={ring2}
            ring3={ring3}
            ring2Color={ring2Color}
            ring3Color={ring3Color}
            coachNote={coachNote}
            colors={colors}
            isDark={isDark}
          />

          {/* ── Unit toggle ── */}
          <UnitToggle unit={unitMode} onToggle={setUnit} colors={colors} />

          {/* ── SECTION 1: Primary Metrics ── */}
          <SectionLabel title="PRIMARY METRICS" colors={colors} />

          <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <MetricRowTappable
              label="Current weight"
              context="Updates your calorie targets"
              value={draft.weightLb ? fmtWeight(draft.weightLb, unitMode) : "Not set"}
              source={profile?.healthLastUpdatedVia ? `via ${profile.healthLastUpdatedVia}` : undefined}
              onPress={() => setSheet("weight")}
              colors={colors}
            />
            <Divider colors={colors} />
            <MetricRowTappable
              label="Goal weight"
              context="Used for progress projections"
              value={draft.targetWeightLb ? fmtWeight(draft.targetWeightLb, unitMode) : "Not set"}
              hint={weeksToGoal ? `~${weeksToGoal} weeks at current pace` : undefined}
              onPress={() => setSheet("target")}
              colors={colors}
            />
            <Divider colors={colors} />
            <MetricRowTappable
              label="Height"
              context="Used for BMI and calorie calculations"
              value={draft.heightCm ? fmtHeight(draft.heightCm, unitMode) : "Not set"}
              onPress={() => setSheet("height")}
              colors={colors}
            />
            <Divider colors={colors} />
            <MetricRowTappable
              label="Age"
              context="Improves calorie calculation accuracy"
              value={draft.age ? `${draft.age}` : "Not set"}
              onPress={() => setSheet("age")}
              colors={colors}
            />
            <Divider colors={colors} />
            <SexSelector
              value={draft.sex}
              onChange={(s) => setDraft((d) => ({ ...d, sex: s }))}
              colors={colors}
              isDark={isDark}
            />
          </View>

          {/* ── SECTION 2: Body Composition ── */}
          <SectionLabel title="BODY COMPOSITION" colors={colors} />
          <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>
            Optional. More data = more accurate insights.
          </Text>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <MetricRowTappable
              label="Body fat %"
              context="Enables lean mass-based protein targets"
              value={draft.bodyFatPct != null && draft.bodyFatPct > 0 ? `${round1(draft.bodyFatPct)}%` : "—"}
              hint={leanMass ? `Lean mass: ~${leanMass.kg} kg / ${leanMass.lb} lb` : undefined}
              hintColor={colors.accent}
              onPress={() => setSheet("bodyfat")}
              colors={colors}
            />
            {bodyFatError ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>{bodyFatError}</Text>
            ) : null}
            <Divider colors={colors} />
            <MetricRowTappable
              label="Waist"
              context="Useful for tracking body recomposition"
              value={draft.waistCm ? `${unitMode === "metric" ? round1(draft.waistCm) + " cm" : Math.round(draft.waistCm * 0.393701) + " in"}` : "—"}
              onPress={() => setSheet("waist")}
              colors={colors}
            />
            <Divider colors={colors} />
            <MetricRowTappable
              label="Neck"
              context="Optional. Used for Navy body fat estimate"
              value={draft.neckCm ? `${unitMode === "metric" ? round1(draft.neckCm) + " cm" : Math.round(draft.neckCm * 0.393701) + " in"}` : "—"}
              onPress={() => setSheet("neck")}
              colors={colors}
            />
            {(draft.sex === "female" || draft.sex === "other") && (
              <>
                <Divider colors={colors} />
                <MetricRowTappable
                  label="Hip"
                  context="Used in body fat estimation"
                  value={draft.hipCm ? `${unitMode === "metric" ? round1(draft.hipCm) + " cm" : Math.round(draft.hipCm * 0.393701) + " in"}` : "—"}
                  onPress={() => setSheet("hip")}
                  colors={colors}
                />
              </>
            )}
            {navyEst != null && (
              <Text style={[styles.navyNote, { color: colors.textTertiary }]}>
                Navy body fat estimate: ~{navyEst}%
              </Text>
            )}
          </View>

          {/* ── SECTION 3: Vitals ── */}
          <SectionLabel title="VITALS" colors={colors} />
          <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>
            Auto-updated from Apple Health / RingConn
          </Text>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            {profile?.restingHeartRateBpm || profile?.hrvMs || profile?.bloodOxygenPct ? (
              <>
                {profile.restingHeartRateBpm ? (
                  <VitalRow
                    icon="heart-outline"
                    label="Resting heart rate"
                    value={`${Math.round(profile.restingHeartRateBpm)} bpm`}
                    source={profile.healthLastUpdatedVia}
                    colors={colors}
                  />
                ) : null}
                {profile.hrvMs ? (
                  <>
                    <Divider colors={colors} />
                    <VitalRow
                      icon="pulse-outline"
                      label="HRV"
                      value={`${Math.round(profile.hrvMs)} ms`}
                      source={profile.healthLastUpdatedVia}
                      colors={colors}
                    />
                  </>
                ) : null}
                {profile.bloodOxygenPct ? (
                  <>
                    <Divider colors={colors} />
                    <VitalRow
                      icon="water-outline"
                      label="Blood oxygen"
                      value={`${Math.round(profile.bloodOxygenPct)}%`}
                      source={profile.healthLastUpdatedVia}
                      colors={colors}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={() => router.push("/(modals)/integrations" as any)}
                style={styles.connectRow}
              >
                <Ionicons name="link-outline" size={16} color={colors.accent} />
                <Text style={[styles.connectText, { color: colors.accent }]}>
                  Connect Apple Health to auto-fill vitals →
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── SECTION 4: Weight Trend ── */}
          <SectionLabel title="WEIGHT TREND" colors={colors} />

          <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <View style={styles.trendHeader}>
              <Text style={[styles.trendTitle, { color: colors.textPrimary }]}>Weight over time</Text>
              <HistoryRangeToggle range={historyRange} onChange={setHistoryRange} colors={colors} />
            </View>

            <WeightTrendChart
              history={history}
              goalLb={draft.targetWeightLb}
              unit={unitMode}
              range={historyRange}
              colors={colors}
              isDark={isDark}
            />

            {filteredHistory.length > 0 && (
              <Text style={[styles.lastCheckin, { color: colors.textTertiary }]}>
                Last check-in: {fmtDate(filteredHistory[0].t)} · {fmtWeight(filteredHistory[0].weightLb!, unitMode)}
              </Text>
            )}
          </View>

          {/* ── SECTION 5: Check-in History ── */}
          <SectionLabel title="CHECK-IN HISTORY" colors={colors} />

          <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            {visibleHistory.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No weight history yet.</Text>
            ) : (
              <>
                {visibleHistory.map((point, i) => {
                  const prev = filteredHistory[i + 1];
                  const delta = prev?.weightLb ? (point.weightLb! - prev.weightLb) : null;
                  return (
                    <React.Fragment key={`ci-${point.t}-${i}`}>
                      {i > 0 && <Divider colors={colors} />}
                      <SwipeableRow
                        onDelete={() => deleteCheckIn(filteredHistory.indexOf(point))}
                        colors={colors}
                      >
                        <View style={styles.checkInRow}>
                          <Text style={[styles.checkInDate, { color: colors.textTertiary }]}>
                            {fmtDate(point.t)}
                          </Text>
                          <Text style={[styles.checkInWeight, { color: colors.textPrimary }]}>
                            {fmtWeight(point.weightLb!, unitMode)}
                          </Text>
                          {delta != null && (
                            <Text style={[styles.checkInDelta, {
                              color: delta < -0.1 ? colors.success : delta > 0.1 ? colors.danger : colors.textTertiary,
                            }]}>
                              {delta < -0.1 ? "↓ " : delta > 0.1 ? "↑ " : "· "}
                              {fmtWeight(Math.abs(delta), unitMode)}
                            </Text>
                          )}
                        </View>
                      </SwipeableRow>
                    </React.Fragment>
                  );
                })}
                {filteredHistory.length > 10 && !showAllHistory && (
                  <Pressable onPress={() => setShowAllHistory(true)} style={styles.seeAllBtn}>
                    <Text style={[styles.seeAllText, { color: colors.accent }]}>
                      See all {filteredHistory.length} entries →
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* ── Privacy note ── */}
          <View style={[styles.privacyCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Ionicons name="heart-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.privacyText, { color: colors.textTertiary }]}>
              You can clear any metric anytime. Missing data is fine — this app never judges you for it.
            </Text>
          </View>
        </ScrollView>

        {/* ── Pickers ── */}
        <MetricPickerSheet
          open={sheet === "weight"}
          title="Current weight"
          subtitle="Updates your calorie targets"
          unitLabel={unitMode === "imperial" ? "lb" : "kg"}
          values={weightValues}
          value={weightPickerValue}
          formatValue={formatWeightPicker}
          allowNull
          nullLabel="Not set"
          step={unitMode === "imperial" ? 1 : 0.5}
          onChange={(v) => setDraft((d) => ({
            ...d,
            weightLb: v == null ? undefined : unitMode === "imperial" ? v : round1(kgToLb(v)),
          }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "target"}
          title="Goal weight"
          subtitle="Used for progress projections"
          unitLabel={unitMode === "imperial" ? "lb" : "kg"}
          values={weightValues}
          value={targetPickerValue}
          formatValue={formatWeightPicker}
          allowNull
          nullLabel="Not set"
          step={unitMode === "imperial" ? 1 : 0.5}
          onChange={(v) => setDraft((d) => ({
            ...d,
            targetWeightLb: v == null ? undefined : unitMode === "imperial" ? v : round1(kgToLb(v)),
          }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "height"}
          title="Height"
          subtitle="Used for BMI and calorie calculations"
          unitLabel={unitMode === "imperial" ? "" : "cm"}
          values={heightValues}
          value={draft.heightCm == null ? null : Math.round(draft.heightCm)}
          formatValue={(v) => fmtHeight(v, unitMode)}
          allowNull
          nullLabel="Not set"
          step={1}
          min={120}
          max={220}
          onChange={(v) => setDraft((d) => ({ ...d, heightCm: v ?? undefined }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "age"}
          title="Age"
          subtitle="Improves calorie calculation accuracy"
          unitLabel="yrs"
          values={ageValues}
          value={draft.age ?? null}
          formatValue={(v) => `${v}`}
          allowNull
          nullLabel="Not set"
          step={1}
          min={13}
          max={100}
          onChange={(v) => setDraft((d) => ({ ...d, age: v ?? undefined }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "bodyfat"}
          title="Body fat %"
          subtitle="Optional. Estimates are totally fine."
          unitLabel="%"
          values={bodyFatValues}
          value={draft.bodyFatPct != null && draft.bodyFatPct > 0 ? round1(draft.bodyFatPct) : null}
          formatValue={(v) => `${round1(v)}`}
          allowNull
          nullLabel="Not set"
          step={0.5}
          min={3}
          max={50}
          onChange={(v) => setDraft((d) => ({ ...d, bodyFatPct: v == null || v <= 0 ? undefined : v }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "waist"}
          title="Waist"
          subtitle="Useful for tracking body recomposition"
          unitLabel={unitMode === "imperial" ? "in" : "cm"}
          values={waistNeckHipValues}
          value={draft.waistCm == null ? null : round1(unitMode === "imperial" ? draft.waistCm * 0.393701 : draft.waistCm)}
          formatValue={(v) => `${round1(v)}`}
          allowNull
          nullLabel="Not set"
          step={0.5}
          onChange={(v) => setDraft((d) => ({
            ...d,
            waistCm: v == null ? undefined : unitMode === "imperial" ? round1(v / 0.393701) : v,
          }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "neck"}
          title="Neck circumference"
          subtitle="Used for Navy body fat estimate"
          unitLabel={unitMode === "imperial" ? "in" : "cm"}
          values={waistNeckHipValues}
          value={draft.neckCm == null ? null : round1(unitMode === "imperial" ? draft.neckCm * 0.393701 : draft.neckCm)}
          formatValue={(v) => `${round1(v)}`}
          allowNull
          nullLabel="Not set"
          step={0.5}
          onChange={(v) => setDraft((d) => ({
            ...d,
            neckCm: v == null ? undefined : unitMode === "imperial" ? round1(v / 0.393701) : v,
          }))}
          onClose={() => setSheet(null)}
        />

        <MetricPickerSheet
          open={sheet === "hip"}
          title="Hip circumference"
          subtitle="Used in body fat estimation"
          unitLabel={unitMode === "imperial" ? "in" : "cm"}
          values={waistNeckHipValues}
          value={draft.hipCm == null ? null : round1(unitMode === "imperial" ? draft.hipCm * 0.393701 : draft.hipCm)}
          formatValue={(v) => `${round1(v)}`}
          allowNull
          nullLabel="Not set"
          step={0.5}
          onChange={(v) => setDraft((d) => ({
            ...d,
            hipCm: v == null ? undefined : unitMode === "imperial" ? round1(v / 0.393701) : v,
          }))}
          onClose={() => setSheet(null)}
        />

        {/* ── Dialogs ── */}
        <LuxuryDialog
          visible={discardOpen}
          title="Discard changes?"
          body="You have unsaved changes in this screen."
          icon="close-circle-outline"
          primaryLabel="Discard"
          primaryDanger
          secondaryLabel="Keep editing"
          onPrimary={() => { setDiscardOpen(false); router.back(); }}
          onSecondary={() => setDiscardOpen(false)}
          onClose={() => setDiscardOpen(false)}
          colors={colors}
        />

        <LuxuryDialog
          visible={recalcOpen}
          title="Weight changed"
          body={
            pendingRecalc
              ? `You logged ${fmtWeight(kgToLb(pendingRecalc.newWeightKg), unitMode)}. Recalculate macros to stay on track?`
              : ""
          }
          icon="scale-outline"
          primaryLabel="Recalculate goals →"
          secondaryLabel="Keep current goals"
          onPrimary={handleRecalculate}
          onSecondary={handleKeepGoals}
          onClose={handleKeepGoals}
          colors={colors}
        />

        {/* ── Saved toast ── */}
        {savedToast && (
          <View pointerEvents="none" style={styles.toastWrap}>
            <View style={[styles.toast, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={[styles.toastText, { color: colors.textPrimary }]}>Saved ✓</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function HeroCard({
  bmi, ring1, ring2, ring3, ring2Color, ring3Color, coachNote, colors, isDark,
}: {
  bmi: number | null;
  ring1: number;
  ring2: number;
  ring3: number;
  ring2Color: string;
  ring3Color: string;
  coachNote: string;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
}) {
  const ringSize = 110;
  const cx = ringSize / 2;
  const r1 = 46, r2 = 34, r3 = 22;
  const sw = 4;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const c3 = 2 * Math.PI * r3;

  return (
    <View style={[styles.heroCard, {
      backgroundColor: withAlpha(colors.accent, isDark ? 0.08 : 0.05),
      borderColor: withAlpha(colors.accent, isDark ? 0.22 : 0.15),
    }]}>
      <View style={styles.heroInner}>
        {/* Left: BMI info */}
        <View style={styles.heroLeft}>
          <Text style={[styles.heroBmiNum, { color: colors.textPrimary }]}>
            {bmi != null ? bmi.toFixed(1) : "—"}
          </Text>
          <Text style={[styles.heroBmiLabel, { color: colors.textTertiary }]}>BMI</Text>
          {bmi != null && (
            <View style={[styles.heroBadge, { backgroundColor: withAlpha(bmiColor(bmi, colors), 0.14) }]}>
              <Text style={[styles.heroBadgeText, { color: bmiColor(bmi, colors) }]}>
                {bmiDescriptor(bmi)}
              </Text>
            </View>
          )}
        </View>

        {/* Right: 3-ring SVG */}
        <Svg width={ringSize} height={ringSize}>
          {/* Ring 1 (weight vs target) — accent */}
          <Circle cx={cx} cy={cx} r={r1} stroke={withAlpha(colors.accent, 0.18)} strokeWidth={sw} fill="none" />
          <Circle cx={cx} cy={cx} r={r1} stroke={colors.accent} strokeWidth={sw} fill="none"
            strokeDasharray={`${c1} ${c1}`}
            strokeDashoffset={c1 * (1 - ring1)}
            strokeLinecap="round" rotation="-90" originX={cx} originY={cx} />

          {/* Ring 2 (BMI) — dynamic color */}
          <Circle cx={cx} cy={cx} r={r2} stroke={withAlpha(ring2Color, 0.18)} strokeWidth={sw} fill="none" />
          <Circle cx={cx} cy={cx} r={r2} stroke={ring2Color} strokeWidth={sw} fill="none"
            strokeDasharray={`${c2} ${c2}`}
            strokeDashoffset={c2 * (1 - ring2)}
            strokeLinecap="round" rotation="-90" originX={cx} originY={cx} />

          {/* Ring 3 (body fat) — dynamic color */}
          <Circle cx={cx} cy={cx} r={r3} stroke={withAlpha(ring3Color, 0.18)} strokeWidth={sw} fill="none" />
          <Circle cx={cx} cy={cx} r={r3} stroke={ring3Color} strokeWidth={sw} fill="none"
            strokeDasharray={`${c3} ${c3}`}
            strokeDashoffset={c3 * (1 - ring3)}
            strokeLinecap="round" rotation="-90" originX={cx} originY={cx} />
        </Svg>
      </View>

      <Text style={[styles.coachNote, { color: colors.textSecondary }]}>{coachNote}</Text>
    </View>
  );
}

function UnitToggle({
  unit,
  onToggle,
  colors,
}: {
  unit: UnitMode;
  onToggle: (u: UnitMode) => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.segWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      {(["imperial", "metric"] as UnitMode[]).map((u) => (
        <Pressable
          key={u}
          onPress={() => { Haptics.selectionAsync(); onToggle(u); }}
          style={[
            styles.segBtn,
            u === unit
              ? { backgroundColor: colors.accent }
              : { backgroundColor: "transparent" },
          ]}
        >
          <Text style={[styles.segText, { color: u === unit ? "#FFFFFF" : colors.textSecondary }]}>
            {u === "imperial" ? "Imperial (lb / ft)" : "Metric (kg / cm)"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionLabel({ title, colors }: { title: string; colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{title}</Text>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function MetricRowTappable({
  label, context, value, source, hint, hintColor, onPress, colors,
}: {
  label: string;
  context: string;
  value: string;
  source?: string;
  hint?: string;
  hintColor?: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={async () => { try { await Haptics.selectionAsync(); } catch {} onPress(); }}
      style={({ pressed }) => [styles.metricRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.metricRowLeft}>
        <Text style={[styles.metricLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.metricContext, { color: colors.textTertiary }]}>{context}</Text>
        {source && (
          <Text style={[styles.metricSource, { color: colors.textTertiary }]}>{source}</Text>
        )}
        {hint && (
          <Text style={[styles.metricHint, { color: hintColor ?? colors.accent }]}>{hint}</Text>
        )}
      </View>
      <View style={styles.metricRowRight}>
        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function SexSelector({
  value, onChange, colors, isDark,
}: {
  value?: SexType;
  onChange: (s: SexType) => void;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
}) {
  const options: { key: SexType; label: string }[] = [
    { key: "male", label: "Male" },
    { key: "female", label: "Female" },
    { key: "other", label: "Other" },
  ];
  return (
    <View style={styles.sexRow}>
      <View style={styles.sexLeft}>
        <Text style={[styles.metricLabel, { color: colors.textPrimary }]}>Biological sex</Text>
        <Text style={[styles.metricContext, { color: colors.textTertiary }]}>Used for BMR calculation</Text>
        <Text style={[styles.metricSource, { color: colors.textTertiary }]}>Used only for calorie math. Never shared.</Text>
      </View>
      <View style={styles.sexBtns}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => { Haptics.selectionAsync(); onChange(o.key); }}
            style={[
              styles.sexBtn,
              {
                backgroundColor: value === o.key ? withAlpha(colors.accent, 0.18) : colors.surface2,
                borderColor: value === o.key ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.sexBtnText, { color: value === o.key ? colors.accent : colors.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function VitalRow({
  icon, label, value, source, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  source?: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.vitalRow}>
      <Ionicons name={icon} size={16} color={colors.textTertiary} />
      <View style={styles.vitalLeft}>
        <Text style={[styles.vitalLabel, { color: colors.textPrimary }]}>{label}</Text>
        {source && <Text style={[styles.metricSource, { color: colors.textTertiary }]}>via {source}</Text>}
      </View>
      <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function HistoryRangeToggle({
  range, onChange, colors,
}: {
  range: HistoryRange;
  onChange: (r: HistoryRange) => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.rangeRow}>
      {(["30D", "90D", "all"] as HistoryRange[]).map((r) => (
        <Pressable
          key={r}
          onPress={() => onChange(r)}
          style={[styles.rangeBtn, { backgroundColor: range === r ? colors.accent : "transparent" }]}
        >
          <Text style={[styles.rangeBtnText, { color: range === r ? "#FFFFFF" : colors.textSecondary }]}>
            {r}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function WeightTrendChart({
  history, goalLb, unit, range, colors, isDark,
}: {
  history: BodyMetricPoint[];
  goalLb: number | undefined;
  unit: UnitMode;
  range: HistoryRange;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
}) {
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const chartW = screenW - 32 - 32; // account for outer padding + card padding
  const chartH = 160;
  const PAD = { l: 42, r: 12, t: 12, b: 28 };
  const W = chartW - PAD.l - PAD.r;
  const H = chartH - PAD.t - PAD.b;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start();
  }, [fadeAnim, reduceMotion]);

  const points = useMemo(() => {
    const now = Date.now();
    const cutoff = range === "30D" ? 30 : range === "90D" ? 90 : 3650;
    return history
      .filter((p) => p.weightLb && p.t >= now - cutoff * 86400000)
      .sort((a, b) => a.t - b.t)
      .map((p) => ({
        t: p.t,
        w: unit === "imperial" ? p.weightLb! : lbToKg(p.weightLb!),
      }));
  }, [history, range, unit]);

  const rollingAvg = useMemo(() => {
    const windowMs = 7 * 86400000;
    return points.map((p) => {
      const win = points.filter((q) => q.t >= p.t - windowMs && q.t <= p.t);
      return { t: p.t, avg: win.reduce((s, q) => s + q.w, 0) / win.length };
    });
  }, [points]);

  if (points.length < 2) {
    return (
      <View style={[styles.chartEmpty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          Log your weight a few times to see your trend.
        </Text>
        <Pressable onPress={() => { /* scroll to save */ }}>
          <Text style={[styles.seeAllText, { color: colors.accent, marginTop: 6 }]}>Log now →</Text>
        </Pressable>
      </View>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const allWeights = points.map((p) => p.w);
  if (goalLb != null) {
    const goalW = unit === "imperial" ? goalLb : lbToKg(goalLb);
    allWeights.push(goalW);
  }
  const minW = Math.min(...allWeights) - 1;
  const maxW = Math.max(...allWeights) + 1;
  const rangeW = maxW - minW || 1;

  const toX = (t: number) => PAD.l + ((t - minT) / Math.max(maxT - minT, 1)) * W;
  const toY = (w: number) => PAD.t + (1 - (w - minW) / rangeW) * H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(p.w).toFixed(1)}`)
    .join(" ");

  const avgPath = rollingAvg
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(p.avg).toFixed(1)}`)
    .join(" ");

  // 4 evenly-spaced x-axis labels
  const xLabels: { t: number; x: number; label: string }[] = [];
  if (points.length >= 2) {
    for (let k = 0; k < 4; k++) {
      const t = minT + (k / 3) * (maxT - minT);
      xLabels.push({ t, x: toX(t), label: fmtDate(t) });
    }
  }

  // Y-axis: 3 values
  const yLabels = [
    { w: minW + 1, y: toY(minW + 1) },
    { w: (minW + maxW) / 2, y: toY((minW + maxW) / 2) },
    { w: maxW - 1, y: toY(maxW - 1) },
  ];

  const goalY = goalLb != null ? toY(unit === "imperial" ? goalLb : lbToKg(goalLb)) : null;

  const fmtY = (w: number) => unit === "imperial" ? `${Math.round(w)}` : `${round1(w)}`;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Svg width={chartW} height={chartH}>
        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <Line
            key={`yl-${i}`}
            x1={PAD.l} y1={yl.y} x2={chartW - PAD.r} y2={yl.y}
            stroke={withAlpha(colors.border, 0.5)} strokeWidth={0.5}
          />
        ))}

        {/* Goal dashed line */}
        {goalY != null && goalY >= PAD.t && goalY <= chartH - PAD.b && (
          <Line
            x1={PAD.l} y1={goalY} x2={chartW - PAD.r} y2={goalY}
            stroke={colors.accent} strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.55}
          />
        )}

        {/* Rolling average line (subtle) */}
        {rollingAvg.length >= 2 && (
          <Path d={avgPath} stroke={withAlpha(colors.accent, 0.35)} strokeWidth={1.5} fill="none" />
        )}

        {/* Main line */}
        <Path d={linePath} stroke={colors.accent} strokeWidth={2} fill="none" />

        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={`dot-${i}`} cx={toX(p.t)} cy={toY(p.w)} r={3} fill={colors.accent} />
        ))}

        {/* Y-axis tick marks */}
        {yLabels.map((yl, i) => (
          <Line
            key={`ylabel-${i}`}
            x1={PAD.l - 4} y1={yl.y} x2={PAD.l} y2={yl.y}
            stroke={colors.textTertiary} strokeWidth={1}
          />
        ))}

        {/* X-axis labels (rendered as separate text) */}
      </Svg>

      {/* Y labels (outside SVG for font rendering) */}
      <View style={[styles.yAxisWrap, { height: chartH, width: PAD.l }]}>
        {yLabels.map((yl, i) => (
          <Text
            key={`yt-${i}`}
            style={[styles.axisLabel, { color: colors.textTertiary, top: yl.y - 6 }]}
          >
            {fmtY(yl.w)}
          </Text>
        ))}
      </View>

      {/* X labels */}
      <View style={[styles.xAxisWrap, { paddingLeft: PAD.l, paddingRight: PAD.r }]}>
        {xLabels.map((xl, i) => (
          <Text key={`xt-${i}`} style={[styles.axisLabel, { color: colors.textTertiary }]}>
            {xl.label}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

function SwipeableRow({
  onDelete, children, colors,
}: {
  onDelete: () => void;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const DELETE_WIDTH = 72;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -DELETE_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -DELETE_WIDTH * 0.5) {
          Animated.spring(translateX, { toValue: -DELETE_WIDTH, useNativeDriver: true, tension: 80, friction: 10 }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, { toValue: -300, duration: 200, useNativeDriver: true }).start(() => onDelete());
  };

  return (
    <View style={{ overflow: "hidden" }}>
      {/* Delete button behind */}
      <View style={[styles.deleteBtn, { backgroundColor: colors.danger, width: DELETE_WIDTH }]}>
        <Pressable onPress={handleDelete} style={styles.deleteBtnInner}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function LuxuryDialog({
  visible, title, body, icon, primaryLabel, secondaryLabel,
  onPrimary, onSecondary, onClose, colors, primaryDanger,
}: {
  visible: boolean;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  primaryDanger?: boolean;
}) {
  const translateY = useRef(new Animated.Value(300)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) { translateY.setValue(300); return; }
    if (reduceMotion) { translateY.setValue(0); return; }
    Animated.spring(translateY, { toValue: 0, damping: 18, mass: 0.9, stiffness: 180, useNativeDriver: true }).start();
  }, [visible, translateY, reduceMotion]);

  if (!visible) return null;

  return (
    <Modal transparent animationType={reduceMotion ? "none" : "fade"} visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: withAlpha(colors.background, 0.6) }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.dialogSheet, {
          backgroundColor: colors.surface2,
          borderColor: colors.borderElevated,
          transform: [{ translateY }],
        }]}>
          <View style={[styles.dialogHandle, { backgroundColor: colors.surface3 }]} />
          <Ionicons name={icon} size={24} color={colors.textTertiary} style={{ alignSelf: "center", marginBottom: 10 }} />
          <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.dialogBody, { color: colors.textSecondary }]}>{body}</Text>
          <View style={styles.dialogBtns}>
            <Pressable
              onPress={onPrimary}
              style={[styles.dialogPrimary, { backgroundColor: primaryDanger ? colors.danger : colors.accent }]}
            >
              <Text style={[styles.dialogPrimaryText, { color: "#FFFFFF" }]}>{primaryLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onSecondary}
              style={[styles.dialogSecondary, { borderColor: colors.border }]}
            >
              <Text style={[styles.dialogSecondaryText, { color: colors.textSecondary }]}>{secondaryLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600" },
  saveBtn: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999 },
  saveText: { fontSize: 13, fontWeight: "600" },

  // Hero
  heroCard: {
    borderRadius: 18,
    borderWidth: 0,
    padding: 16,
    gap: 12,
  },
  heroInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLeft: { flex: 1, gap: 4, paddingRight: 12 },
  heroBmiNum: { fontSize: 42, fontWeight: "200", lineHeight: 46 },
  heroBmiLabel: { fontSize: 11, fontWeight: "400", letterSpacing: 0.5 },
  heroBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  heroBadgeText: { fontSize: 11, fontWeight: "600" },
  coachNote: { fontSize: 13, fontWeight: "300", lineHeight: 18, fontStyle: "italic" },

  // Unit toggle
  segWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segText: { fontSize: 12, fontWeight: "500" },

  // Sections
  sectionLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginBottom: -6 },
  sectionSub: { fontSize: 12, fontWeight: "300", marginTop: -12, marginBottom: -4 },
  sectionCard: { borderRadius: 16, borderWidth: 0, overflow: "hidden" },
  fieldError: { fontSize: 12, paddingHorizontal: 14, paddingBottom: 8, marginTop: -4 },
  navyNote: { fontSize: 11, fontStyle: "italic", paddingHorizontal: 14, paddingBottom: 12, marginTop: 2 },

  // Metric row
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  metricRowLeft: { flex: 1, gap: 2 },
  metricRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricLabel: { fontSize: 14, fontWeight: "500" },
  metricContext: { fontSize: 11, fontWeight: "300" },
  metricSource: { fontSize: 10, fontWeight: "300", fontStyle: "italic" },
  metricHint: { fontSize: 11, fontWeight: "400", marginTop: 2 },
  metricValue: { fontSize: 15, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  // Sex selector
  sexRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  sexLeft: { gap: 2 },
  sexBtns: { flexDirection: "row", gap: 8, marginTop: 6 },
  sexBtn: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sexBtnText: { fontSize: 12, fontWeight: "500" },

  // Vitals
  vitalRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  vitalLeft: { flex: 1, gap: 2 },
  vitalLabel: { fontSize: 14, fontWeight: "500" },
  vitalValue: { fontSize: 15, fontWeight: "600" },
  connectRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 16, gap: 8 },
  connectText: { fontSize: 13, fontWeight: "500" },

  // Trend chart
  trendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, marginBottom: 8 },
  trendTitle: { fontSize: 13, fontWeight: "500" },
  rangeRow: { flexDirection: "row", gap: 4 },
  rangeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rangeBtnText: { fontSize: 11, fontWeight: "500" },
  chartEmpty: {
    margin: 14,
    marginTop: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  lastCheckin: { fontSize: 11, fontWeight: "300", paddingHorizontal: 14, paddingBottom: 14, marginTop: 4 },
  yAxisWrap: { position: "absolute", top: 0, left: 0 },
  xAxisWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, paddingBottom: 8, paddingHorizontal: 14 },
  axisLabel: { fontSize: 9, fontWeight: "300" },

  // Check-in history
  checkInRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 8 },
  checkInDate: { flex: 1, fontSize: 12, fontWeight: "300" },
  checkInWeight: { fontSize: 14, fontWeight: "500" },
  checkInDelta: { fontSize: 12, fontWeight: "400", minWidth: 60, textAlign: "right" },
  deleteBtn: { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  deleteBtnInner: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  seeAllBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  seeAllText: { fontSize: 12, fontWeight: "500" },
  emptyText: { fontSize: 12, fontWeight: "300", textAlign: "center", paddingVertical: 16, paddingHorizontal: 14 },

  // Privacy
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  privacyText: { flex: 1, fontSize: 12, fontWeight: "300", lineHeight: 18, fontStyle: "italic" },

  // Dialog
  dialogSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 28,
    gap: 8,
  },
  dialogHandle: { width: 32, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 10 },
  dialogTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  dialogBody: { fontSize: 13, fontWeight: "300", textAlign: "center", lineHeight: 18 },
  dialogBtns: { marginTop: 12, gap: 8 },
  dialogPrimary: { height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dialogPrimaryText: { fontSize: 14, fontWeight: "600" },
  dialogSecondary: { height: 44, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dialogSecondaryText: { fontSize: 14 },

  // Toast
  toastWrap: { position: "absolute", left: 16, right: 16, bottom: 32, alignItems: "center" },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1,
  },
  toastText: { fontSize: 13, fontWeight: "500" },
});
