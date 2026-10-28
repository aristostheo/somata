import { ProfileIntro, ProfileSection } from "@/components/profile/ProfileTaskUI";
import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Empty, Heading, IconButton, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { Trend } from "@/components/somata/Trend";
import { Alert } from "react-native";
// app/(modals)/body-metrics.tsx — Premium health dashboard redesign
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePremiumProfileFlowTheme as useTheme } from "@/components/accountSettings/useProfileFlowTheme";
import MetricPickerSheet from "@/components/profile/premium/bodyMetrics/MetricPickerSheet";
import { useAuth } from "@/content/AuthContext";
import {
  buildGoalInputsFromProfile,
  buildGoalProfilePatch,
  shouldRecalculate,
} from "@/services/macroCalculator";
import { acceptedNutritionTargets } from "@/services/nutritionTargets";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
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
  hipCm?: number
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
  targetLb: number
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

function BodyMetricsEditorScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

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
          loadBodyMetrics(localStore),
          loadBodyMetricsHistory(localStore), localStore.getItem(UNIT_KEY),
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
    }, localStore).catch(() => { });
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
    await localStore.setItem(UNIT_KEY, u).catch(() => { });
  }, []);

  const confirmBack = () => {
    if (!dirty) return router.back();
    setDiscardOpen(true);
  };

  const onSave = async () => {
    if (!user?.uid || bodyFatError) return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }

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
    }, localStore);

    await appendBodyMetricsHistory({
      t: Date.now(),
      weightLb: draft.weightLb,
      waistCm: draft.waistCm,
      bodyFatPct: draft.bodyFatPct != null && draft.bodyFatPct > 0 ? draft.bodyFatPct : undefined,
    }, localStore);

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

  if (loading) return <TaskPage title="Body measurements" section="Profile" onBack={() => router.back()}><Empty title="Loading your measurements…" /></TaskPage>;

  return (<><TaskPage title="A record of you" section="Body measurements" onBack={confirmBack} footer={<><Button primary label="Save measurements" disabled={!dirty || !!bodyFatError} onPress={onSave} />{savedToast && <Text accessibilityLiveRegion="polite" style={F.body}>Saved</Text>}</>}>

    <ProfileIntro label="Measurement workspace" title="Record, then reflect" detail="Review your draft before saving. Calculated estimates and dated measurements are shown separately." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['imperial', 'metric'] as UnitMode[]).map(u => <Choice key={u} label={u === 'imperial' ? 'lb / in' : 'kg / cm'} selected={unitMode === u} onPress={() => setUnit(u)} />)}
    </View>

    <Panel accent>
      <Text style={F.eyebrow}>WEIGHT / EDITABLE DRAFT</Text>
      <Text style={{ ...F.value, fontSize: 48 }}>{draft.weightLb == null ? 'Not set' : fmtWeight(draft.weightLb, unitMode)}</Text>
      <Button label="Update weight" onPress={() => setSheet('weight')} />
    </Panel>

    <ProfileSection index="01" title="Your measurement desk" detail="Tap a value to edit the draft.">
    {([{ key: 'target', title: 'Goal weight', value: draft.targetWeightLb == null ? 'Not set' : fmtWeight(draft.targetWeightLb, unitMode) }, { key: 'height', title: 'Height', value: draft.heightCm == null ? 'Not set' : fmtHeight(draft.heightCm, unitMode) }, { key: 'age', title: 'Age', value: draft.age == null ? 'Not set' : String(draft.age) }, { key: 'bodyfat', title: 'Body fat', value: draft.bodyFatPct == null ? 'Not set' : `${draft.bodyFatPct}%` }, { key: 'waist', title: 'Waist', value: draft.waistCm == null ? 'Not set' : `${round1(unitMode === 'imperial' ? draft.waistCm * 0.393701 : draft.waistCm)} ${unitMode === 'imperial' ? 'in' : 'cm'}` }, { key: 'neck', title: 'Neck', value: draft.neckCm == null ? 'Not set' : `${round1(unitMode === 'imperial' ? draft.neckCm * 0.393701 : draft.neckCm)} ${unitMode === 'imperial' ? 'in' : 'cm'}` }]).map(m => <Item key={m.key} title={m.title} value={m.value} onPress={() => setSheet(m.key as SheetKey)} />)}

    <Heading title="Equation sex" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['male', 'female', 'other'] as SexType[]).map(sex => <Choice key={sex} label={sex} selected={draft.sex === sex} onPress={() => setDraft(d => ({ ...d, sex }))} />)}
    </View>
    {(draft.sex === 'female' || draft.sex === 'other') && <Item title="Hip circumference" value={draft.hipCm == null ? 'Not set' : `${round1(unitMode === 'imperial' ? draft.hipCm * 0.393701 : draft.hipCm)} ${unitMode === 'imperial' ? 'in' : 'cm'}`} onPress={() => setSheet('hip')} />}
    </ProfileSection>
    <ProfileSection index="02" title="Calculated context" detail="Estimates from your inputs, not new measurements.">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Metric label="BMI · calculated" value={bmi == null ? '—' : bmi.toFixed(1)} detail={bmi == null ? undefined : bmiDescriptor(bmi)} />
      <Metric label="Lean mass · calculated" value={leanMass == null ? '—' : fmtWeight(leanMass.lb, unitMode)} />
    </View>

    {bodyFatError && <Text style={F.caption}>{bodyFatError}</Text>}
    {navyEst != null && <Text style={F.caption}>Navy body-fat estimate · {navyEst.toFixed(1)}%</Text>}
    {weeksToGoal != null && <Text style={F.caption}>Saved-goal estimate · {weeksToGoal} weeks</Text>}
    <Text style={F.body}>{coachNote}</Text>

    </ProfileSection><ProfileSection index="03" title="Connected vitals" detail="Only available connected records are shown.">
    {profile?.restingHeartRateBpm ? <Item title="Resting heart rate" value={`${Math.round(profile.restingHeartRateBpm)} bpm`} detail={profile.healthLastUpdatedVia} /> : null}
    {profile?.hrvMs ? <Item title="HRV" value={`${Math.round(profile.hrvMs)} ms`} detail={profile.healthLastUpdatedVia} /> : null}
    {profile?.bloodOxygenPct ? <Item title="Blood oxygen" value={`${Math.round(profile.bloodOxygenPct)}%`} detail={profile.healthLastUpdatedVia} /> : null}
    </ProfileSection><ProfileSection index="04" title="Measured history" detail="Dated records stored on this device">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['30D', '90D', 'all'] as HistoryRange[]).map(r => <Choice key={r} label={r} selected={historyRange === r} onPress={() => setHistoryRange(r)} />)}
    </View>
    <WeightTrendChart history={history} range={historyRange} unit={unitMode} goalLb={draft.targetWeightLb} colors={colors} isDark={isDark} />

    {visibleHistory.map((point, i) => <Item key={`${point.t}-${i}`} title={fmtDate(point.t)} value={point.weightLb == null ? 'Not recorded' : fmtWeight(point.weightLb, unitMode)} detail={[point.bodyFatPct == null ? '' : `${point.bodyFatPct}% body fat`, point.waistCm == null ? '' : `${point.waistCm} cm waist`].filter(Boolean).join(' · ')} action={<IconButton icon="trash-outline" label="Remove check-in" onPress={() => Alert.alert('Delete check-in?', 'This removes the entry from this history view.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteCheckIn(filteredHistory.indexOf(point)) }])} />} />)}
    {!visibleHistory.length && <Empty title="No measurements recorded yet" />}
    <Button label={showAllHistory ? 'Show recent records' : 'Show all history'} onPress={() => setShowAllHistory(v => !v)} />
    </ProfileSection><Button label="Health connections" onPress={() => router.push('/profile/integrations')} />

  </TaskPage>
    <MetricPickerSheet
      open={sheet === "weight"}
      title="Current weight"
      subtitle="Edit the measurement draft. Saving does not replace an accepted FitAdapt plan."
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
    <TaskSheet title="Discard changes?" visible={discardOpen} onClose={() => setDiscardOpen(false)}>
      <ProfileIntro label="Unsaved draft" title="Keep this edit?" detail="Your saved measurements stay unchanged if you discard these edits." />
      <Button danger label="Discard" onPress={() => { setDiscardOpen(false); router.back(); }} />
      <Button label="Keep editing" onPress={() => setDiscardOpen(false)} />
    </TaskSheet>
    <TaskSheet title="Weight changed" visible={recalcOpen} onClose={handleKeepGoals}>
      <ProfileIntro label="Saved-goal decision" title="Choose what follows" detail="Your measurement has been saved. This choice concerns the saved-goal calculation." />
      <Text style={F.body}>{pendingRecalc ? `You logged ${fmtWeight(kgToLb(pendingRecalc.newWeightKg), unitMode)}. Recalculate saved goals?` : ''}{acceptedNutritionTargets(profile) ? ' Your accepted FitAdapt targets stay active until you accept a new proposal on Profile.' : ''}</Text>
      <Button primary label="Recalculate saved goals" onPress={handleRecalculate} />
      <Button label="Keep current goals" onPress={handleKeepGoals} />
    </TaskSheet></>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
  const localStore = useAccountStorage();
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

  if (points.length < 2) return <Empty title="More measurements needed" detail="Record at least two weights to see a measured trend." />;

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
  const xLabels: { t: number; x: number; label: string; }[] = [];
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

  return (<Panel>
    <Heading title="Weight / seven-day average" detail="Orange · recorded weight. Blue · rolling average." />
    <Trend premiumProfile values={points.map(p => p.w)} second={rollingAvg.map(p => p.avg)} labels={points.map(p => fmtDate(p.t))} goal={goalLb == null ? undefined : unit === 'imperial' ? goalLb : lbToKg(goalLb)} unit={unit === 'imperial' ? 'lb' : 'kg'} />
  </Panel>
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

export default function BodyMetricsEditorScreen() {
  return <SomataTaskAppearance><BodyMetricsEditorScreenContent /></SomataTaskAppearance>;
}
