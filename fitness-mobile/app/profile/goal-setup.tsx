import { ProfileIntro, ProfileSection, ProfileStats, ProfileFields } from "@/components/profile/ProfileTaskUI";
import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Field, Heading, Panel, TaskPage, TaskSheet, Toggle as TaskToggle } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View
} from "react-native";

import { usePremiumProfileFlowTheme as useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import {
  buildGoalInputsFromProfile,
  buildGoalProfilePatch,
  calculateMacros,
  getGoalSetupDraft,
  setGoalSetupDraft,
  shouldRecalculate,
  type GoalInputs,
} from "@/services/macroCalculator";
import { acceptedNutritionTargets } from "@/services/nutritionTargets";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import {
  appendBodyMetricsHistory,
  loadBodyMetrics,
  saveBodyMetrics,
  type BodyMetrics,
} from "@/services/profile/bodyMetrics";

type UnitMode = "kg" | "lb";
type PaceOption = {
  value: GoalInputs["pace"];
  rate: string;
  descriptor: string;
  recommended?: boolean;
};

const paceOptionsByMode: Record<
  Exclude<GoalInputs["mode"], "maintain">,
  PaceOption[]
> = {
  cut: [
    { value: "gentle", rate: "-0.3 kg/wk", descriptor: "Sustainable" },
    {
      value: "moderate",
      rate: "-0.5 kg/wk",
      descriptor: "Recommended",
      recommended: true,
    },
    { value: "aggressive", rate: "-0.8 kg/wk", descriptor: "Advanced" },
  ],
  lean_bulk: [
    {
      value: "gentle",
      rate: "+0.15 kg/wk",
      descriptor: "Minimal fat gain",
    },
    {
      value: "moderate",
      rate: "+0.25 kg/wk",
      descriptor: "Recommended",
      recommended: true,
    },
    { value: "aggressive", rate: "+0.4 kg/wk", descriptor: "Faster gains" },
  ],
  bulk: [
    { value: "gentle", rate: "+0.3 kg/wk", descriptor: "Clean bulk" },
    {
      value: "moderate",
      rate: "+0.5 kg/wk",
      descriptor: "Recommended",
      recommended: true,
    },
    { value: "aggressive", rate: "+0.75 kg/wk", descriptor: "Dirty bulk risk" },
  ],
};

const lbToKg = (lb: number) => lb * 0.45359237;
const kgToLb = (kg: number) => kg / 0.45359237;
const cmToFeetInches = (cm: number) => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches };
};
const feetInchesToCm = (feet: number, inches: number) =>
  (feet * 12 + inches) * 2.54;
const formatDate = (timestamp?: number) =>
  timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
    : null;
const round1 = (value: number) => Math.round(value * 10) / 10;

function formulaLabel(formula: GoalInputs["bmrFormula"]) {
  if (formula === "harris_benedict") return "Revised Harris-Benedict";
  if (formula === "katch_mcardle") return "Katch-McArdle";
  return "Mifflin-St Jeor";
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function numberString(value: number) {
  return Number.isFinite(value) && value > 0
    ? String(Math.round(value * 10) / 10)
    : "";
}

function GoalSetupScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

  const { colors, isDark } = useProfileFlowTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics | null>(null);
  const [initialInputs, setInitialInputs] = useState<GoalInputs | null>(null);
  const [draft, setDraft] = useState<GoalInputs | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [confirmedWeightRecalc, setConfirmedWeightRecalc] = useState(false);
  const [ageInput, setAgeInput] = useState("");
  const [currentWeightInput, setCurrentWeightInput] = useState("");
  const [goalWeightInput, setGoalWeightInput] = useState("");
  const [heightMetricInput, setHeightMetricInput] = useState("");
  const [heightFeetInput, setHeightFeetInput] = useState("");
  const [heightInchesInput, setHeightInchesInput] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (next) => {
      setProfile(next);
      const base = buildGoalInputsFromProfile(next ?? {});
      setInitialInputs(base);
      setDraft((current) => current ?? getGoalSetupDraft() ?? base);
    });
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;
    loadBodyMetrics(localStore).then((metrics) => {
      if (mounted) setBodyMetrics(metrics);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const shared = getGoalSetupDraft();
      if (shared) setDraft(shared);
    }, [])
  );

  const unitMode: UnitMode = profile?.weightUnit === "lb" ? "lb" : "kg";
  const inputs = draft ?? initialInputs;

  useEffect(() => {
    if (!inputs) return;
    setAgeInput(inputs.age > 0 ? String(Math.round(inputs.age)) : "");
    setCurrentWeightInput(
      unitMode === "lb"
        ? numberString(kgToLb(inputs.currentWeight))
        : numberString(inputs.currentWeight)
    );
    setGoalWeightInput(
      unitMode === "lb"
        ? numberString(kgToLb(inputs.goalWeight))
        : numberString(inputs.goalWeight)
    );
    if (unitMode === "kg") {
      setHeightMetricInput(numberString(inputs.heightCm));
    } else {
      const imperial = cmToFeetInches(inputs.heightCm);
      setHeightFeetInput(imperial.feet > 0 ? String(imperial.feet) : "");
      setHeightInchesInput(String(imperial.inches));
    }
  }, [inputs, unitMode]);

  const result = useMemo(
    () => (inputs ? calculateMacros(inputs) : null),
    [inputs]
  );

  const isDirty = useMemo(() => {
    if (!initialInputs || !inputs) return false;
    return JSON.stringify(initialInputs) !== JSON.stringify(inputs);
  }, [initialInputs, inputs]);

  const ageError = useMemo(() => {
    const age = Number(ageInput);
    if (!ageInput.trim()) return "Age must be between 13 and 100";
    if (!Number.isFinite(age) || age < 13 || age > 100) {
      return "Age must be between 13 and 100";
    }
    return null;
  }, [ageInput]);

  const heightError = useMemo(() => {
    if (unitMode === "kg") {
      const cm = Number(heightMetricInput);
      if (!heightMetricInput.trim()) return "Height is required";
      if (!Number.isFinite(cm) || cm < 120 || cm > 240) return "Height looks off";
      return null;
    }
    const feet = Number(heightFeetInput);
    const inches = Number(heightInchesInput);
    if (!heightFeetInput.trim()) return "Height is required";
    if (!Number.isFinite(feet) || feet < 3 || feet > 8) return "Height looks off";
    if (!Number.isFinite(inches) || inches < 0 || inches > 11) return "Inches must be 0–11";
    return null;
  }, [heightFeetInput, heightInchesInput, heightMetricInput, unitMode]);

  const currentWeightError = useMemo(() => {
    const value = Number(currentWeightInput);
    if (!currentWeightInput.trim()) return "Current weight is required";
    if (!Number.isFinite(value) || value <= 0) return "Current weight is required";
    return null;
  }, [currentWeightInput]);

  const goalWeightError = useMemo(() => {
    if (inputs?.mode === "maintain") return null;
    const value = Number(goalWeightInput);
    if (!goalWeightInput.trim()) return "Goal weight is required";
    if (!Number.isFinite(value) || value <= 0) return "Goal weight is required";
    return null;
  }, [goalWeightInput, inputs?.mode]);

  const updateDraft = useCallback(
    (patch: Partial<GoalInputs>) => {
      setDraft((current) => {
        const next = { ...(current ?? initialInputs), ...patch } as GoalInputs;
        setGoalSetupDraft(next);
        if (
          patch.currentWeight != null &&
          initialInputs?.currentWeight != null &&
          shouldRecalculate(initialInputs.currentWeight, patch.currentWeight)
        ) {
          setConfirmedWeightRecalc(false);
        }
        return next;
      });
    },
    [initialInputs]
  );

  const smartSummary = useMemo(() => {
    if (!inputs) return "";
    const protein = labelize(inputs.proteinPriority);
    const cycling = inputs.cyclingEnabled ? "Cycling on" : "No cycling";
    return `${protein} protein · ${cycling}`;
  }, [inputs]);

  const lastUpdated = formatDate((profile as any)?.goalUpdatedAt);

  const handleSave = useCallback(async () => {
    if (!user?.uid || !inputs || !result) return;
    if (ageError || heightError || currentWeightError || goalWeightError) return;

    const previousWeightKg = Number(profile?.weightKg ?? NaN);
    const needsWeightPrompt =
      Number.isFinite(previousWeightKg) &&
      shouldRecalculate(previousWeightKg, inputs.currentWeight) &&
      !confirmedWeightRecalc;

    if (needsWeightPrompt) {
      setRecalcOpen(true);
      return;
    }

    setSaving(true);
    try {
      const patch = buildGoalProfilePatch(inputs);
      await updateProfile(user.uid, {
        ...patch,
        age: inputs.age,
        sex: inputs.sex,
        heightCm: inputs.heightCm,
        weightKg: inputs.currentWeight,
        targetWeightKg: inputs.goalWeight,
        updatedAt: Date.now(),
      } as any);

      const currentBodyMetrics = bodyMetrics ?? {};
      const nextBodyMetrics: BodyMetrics = {
        ...currentBodyMetrics,
        weightLb: kgToLb(inputs.currentWeight),
        targetWeightLb:
          inputs.mode === "maintain" ? currentBodyMetrics.targetWeightLb : kgToLb(inputs.goalWeight),
        heightCm: inputs.heightCm,
        bodyFatPct:
          currentBodyMetrics.bodyFatPct != null && currentBodyMetrics.bodyFatPct > 0
            ? currentBodyMetrics.bodyFatPct
            : undefined,
      };
      await saveBodyMetrics(nextBodyMetrics, localStore);
      await appendBodyMetricsHistory({
        t: Date.now(),
        weightLb: nextBodyMetrics.weightLb,
        bodyFatPct: nextBodyMetrics.bodyFatPct,
        waistCm: currentBodyMetrics.waistCm,
      }, localStore);
      setBodyMetrics(nextBodyMetrics);
      setInitialInputs(inputs);
      setGoalSetupDraft(inputs);
      setSavedToast(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSavedToast(false), 1400);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
  }, [
    ageError,
    bodyMetrics,
    confirmedWeightRecalc,
    currentWeightError,
    goalWeightError,
    heightError,
    inputs,
    profile?.weightKg,
    result,
    user?.uid,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!inputs || !result) return null;

  const coachTone =
    result.confidence === "low"
      ? { icon: "warning-outline" as const, color: colors.warning }
      : inputs.mode === "cut" && inputs.pace === "aggressive"
        ? { icon: "warning-outline" as const, color: colors.warning }
        : { icon: "checkmark-circle-outline" as const, color: colors.success };

  const confidenceTone =
    result.confidence === "high"
      ? colors.success
      : result.confidence === "medium"
        ? colors.warning
        : colors.danger;

  return (<><TaskPage title="Set your direction" section="Saved profile & goals" onBack={() => router.back()} footer={<><Button primary label={saving ? 'Saving…' : isDirty ? 'Save changes' : 'No changes'} disabled={!isDirty || saving || !!ageError || !!heightError || !!currentWeightError || !!goalWeightError} onPress={handleSave} />{savedToast && <Text accessibilityLiveRegion="polite" style={F.caption}>Goals updated</Text>}</>}>

    {acceptedNutritionTargets(profile) && <Panel accent>
      <Heading title="Your accepted plan stays active" detail="Saving these goals does not replace FitAdapt targets. Review and explicitly accept a new proposal on Profile to change your plan." />
    </Panel>}

    <ProfileIntro label="Saved-goal workspace" title="Build your starting point" detail="Review the calculation below, then save when your details are right. Accepted FitAdapt targets remain separate." />
    <ProfileSection index="01" title="Direction" detail="Choose the goal and pace used by the saved-goal calculator.">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['cut', 'maintain', 'lean_bulk', 'bulk'] as const).map(mode => <Choice key={mode} label={labelize(mode)} selected={inputs.mode === mode} onPress={() => updateDraft({ mode })} />)}
    </View>
    {inputs.mode !== 'maintain' && paceOptionsByMode[inputs.mode].map(o => <Choice key={o.value} label={`${labelize(o.value)} · ${o.rate} · ${o.descriptor}`} selected={inputs.pace === o.value} onPress={() => updateDraft({ pace: o.value })} />)}

    </ProfileSection><ProfileSection index="02" title="Your measurements" detail="These inputs support the calorie calculation. Review them before saving.">

    <ProfileFields>
      <Field label={`Current weight · ${unitMode}`} keyboardType="decimal-pad" value={currentWeightInput} onChangeText={value => { setCurrentWeightInput(value); const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0) return; updateDraft({ currentWeight: unitMode === 'lb' ? lbToKg(parsed) : parsed }); }} />
      {inputs.mode !== 'maintain' && <Field label={`Goal weight · ${unitMode}`} keyboardType="decimal-pad" value={goalWeightInput} onChangeText={value => { setGoalWeightInput(value); const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0) return; updateDraft({ goalWeight: unitMode === 'lb' ? lbToKg(parsed) : parsed }); }} />}
    </ProfileFields>
    {!!currentWeightError && <Text style={F.caption}>{currentWeightError}</Text>}
    {!!goalWeightError && <Text style={F.caption}>{goalWeightError}</Text>}

    <Heading title="Equation sex" detail="Used for the BMR calculation" />
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {(['male', 'female', 'other'] as const).map(sex => <Choice key={sex} label={labelize(sex)} selected={inputs.sex === sex} onPress={() => updateDraft({ sex })} />)}
    </View>

    <Field label="Age" value={ageInput} keyboardType="number-pad" onChangeText={value => { setAgeInput(value); const parsed = Number(value); if (!Number.isFinite(parsed)) return; updateDraft({ age: parsed }); }} />
    {!!ageError && <Text style={F.caption}>{ageError}</Text>}

    {unitMode === 'kg' ? <Field label="Height · cm" value={heightMetricInput} keyboardType="decimal-pad" onChangeText={value => { setHeightMetricInput(value); const parsed = Number(value); if (!Number.isFinite(parsed)) return; updateDraft({ heightCm: parsed }); }} /> : <ProfileFields>
      <Field label="Height · feet" value={heightFeetInput} keyboardType="number-pad" onChangeText={value => { setHeightFeetInput(value); const ft = Number(value), inches = Number(heightInchesInput || 0); if (!Number.isFinite(ft)) return; updateDraft({ heightCm: feetInchesToCm(ft, Number.isFinite(inches) ? inches : 0) }); }} />
      <Field label="Height · inches" value={heightInchesInput} keyboardType="number-pad" onChangeText={value => { setHeightInchesInput(value); const inches = Number(value), ft = Number(heightFeetInput || 0); if (!Number.isFinite(inches)) return; updateDraft({ heightCm: feetInchesToCm(Number.isFinite(ft) ? ft : 0, inches) }); }} />
    </ProfileFields>}
    {!!heightError && <Text style={F.caption}>{heightError}</Text>}

    </ProfileSection><ProfileSection index="03" title="Your rhythm">
    <View style={{ gap: 8 }}>
      {[['sedentary', 'Mostly sitting'], ['light', 'Light movement'], ['active', 'Active'], ['very_active', 'Very active'], ['extra_active', 'Extra active']].map(([key, label]) => <Choice key={key} label={label} selected={inputs.activityLevel === key} onPress={() => updateDraft({ activityLevel: key as GoalInputs['activityLevel'] })} />)}
    </View>
    <Heading title="Training days per week" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {Array.from({ length: 8 }, (_, i) => i).map(day => <Choice key={day} label={String(day)} selected={inputs.trainingDaysPerWeek === day} onPress={() => updateDraft({ trainingDaysPerWeek: day })} />)}
    </View>

    </ProfileSection><Button label={`Smart options · ${smartSummary}`} onPress={() => setSmartOpen(v => !v)} />
    {smartOpen && <Panel>
      <Heading title="Protein priority" />
      {(['standard', 'high', 'very_high'] as const).map(proteinPriority => <Choice key={proteinPriority} label={labelize(proteinPriority)} selected={inputs.proteinPriority === proteinPriority} onPress={() => updateDraft({ proteinPriority })} />)}
      <TaskToggle title="Training day cycling" detail="Training days +150 kcal · rest days −150 kcal" value={inputs.cyclingEnabled} onChange={cyclingEnabled => updateDraft({ cyclingEnabled })} />
      <Heading title="Weekly cardio · minutes" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[0, 60, 120, 180, 240].map(minutes => <Choice key={minutes} label={minutes === 240 ? '240+' : String(minutes)} selected={minutes === 240 ? inputs.cardioMinutesPerWeek >= 240 : inputs.cardioMinutesPerWeek === minutes} onPress={() => updateDraft({ cardioMinutesPerWeek: minutes })} />)}
      </View>
    </Panel>}

    <Button label="Advanced calculation settings" onPress={() => router.push('/profile/goal-advanced')} />

    <ProfileSection index="04" title="Calculation preview" detail="Calculated from this draft; not an accepted FitAdapt plan.">
      <Heading title="Saved-goal calculation" detail={formulaLabel(inputs.bmrFormula)} />
      <Text style={{ ...F.value, fontSize: 44 }}>{result.dailyCalories.toLocaleString()}<Text style={F.caption}> kcal</Text></Text>
      <ProfileStats values={[{label: "Protein", value: `${result.protein} g`}, {label: "Carbs", value: `${result.carbs} g`}, {label: "Fat", value: `${result.fat} g`}]} />
      <Text style={F.caption}>Calculator confidence · {labelize(result.confidence)}</Text>
      {inputs.cyclingEnabled && result.trainingDayCalories && result.restDayCalories ? <Text style={F.caption}>Training {result.trainingDayCalories} kcal · Rest {result.restDayCalories} kcal</Text> : null}
      {inputs.mode !== 'maintain' && <Text style={F.caption}>Estimated pace {result.weeklyPaceKg >= 0 ? '+' : ''}{result.weeklyPaceKg.toFixed(2)} kg/week · {result.weeksToGoal ? `About ${Math.max(1, Math.round(result.weeksToGoal))} weeks to goal` : 'Timeline unavailable'}</Text>}
      <Text style={F.body}>{result.healthNote}</Text>
      {lastUpdated && <Text style={F.caption}>Last updated {lastUpdated}</Text>}
    </ProfileSection>

  </TaskPage><TaskSheet title="Weight has changed" visible={recalcOpen} onClose={() => { setRecalcOpen(false); setConfirmedWeightRecalc(true); }}>
      <Text style={F.body}>Review the updated saved-goal calculation before applying it. An accepted FitAdapt plan remains unchanged.</Text>
      <ProfileStats values={[{label: "Previous · kg", value: Number(profile?.weightKg ?? inputs.currentWeight).toFixed(1)}, {label: "Draft · kg", value: inputs.currentWeight.toFixed(1)}]} />
      <Button primary label="Recalculate and save" onPress={() => { setRecalcOpen(false); setConfirmedWeightRecalc(true); handleSave(); }} />
      <Button label="Keep reviewing" onPress={() => { setRecalcOpen(false); setConfirmedWeightRecalc(true); }} />
    </TaskSheet></>
  );
}

export default function GoalSetupScreen() {
  return <SomataTaskAppearance><GoalSetupScreenContent /></SomataTaskAppearance>;
}
