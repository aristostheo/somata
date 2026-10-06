import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import {
  appendBodyMetricsHistory,
  loadBodyMetrics,
  saveBodyMetrics,
  type BodyMetrics,
} from "@/services/profile/bodyMetrics";
import {
  buildGoalInputsFromProfile,
  buildGoalProfilePatch,
  calculateMacros,
  getGoalSetupDraft,
  setGoalSetupDraft,
  shouldRecalculate,
  type GoalInputs,
} from "@/services/macroCalculator";
import { withAlpha } from "@/components/profile/premium/ui";

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

export default function GoalSetupScreen() {
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
    loadBodyMetrics().then((metrics) => {
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
      await saveBodyMetrics(nextBodyMetrics);
      await appendBodyMetricsHistory({
        t: Date.now(),
        weightLb: nextBodyMetrics.weightLb,
        bodyFatPct: nextBodyMetrics.bodyFatPct,
        waistCm: currentBodyMetrics.waistCm,
      });
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlowAtmosphere />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 40,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.surface3,
              borderWidth: 0,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "700" }}>
            Goal setup
          </Text>
        </View>

        <View style={{ height: 24 }} />
        <SectionLabel colors={colors} title="Essential · Takes 30 Seconds" />
        <View style={{ height: 12 }} />

        <OptionPillRow
          colors={colors}
          values={[
            { key: "cut", label: "Cut" },
            { key: "maintain", label: "Maintain" },
            { key: "lean_bulk", label: "Lean Bulk" },
            { key: "bulk", label: "Bulk" },
          ]}
          selected={inputs.mode}
          onSelect={(mode) => updateDraft({ mode: mode as GoalInputs["mode"] })}
          filled
          height={44}
        />

        <View style={{ height: 24 }} />

        {inputs.mode !== "maintain" ? (
          <>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>How fast?</Text>
            <View style={{ height: 6 }} />
            <View style={{ gap: 8 }}>
              {paceOptionsByMode[inputs.mode].map((option) => {
                const active = inputs.pace === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => updateDraft({ pace: option.value })}
                    style={{
                      backgroundColor: active ? withAlpha(colors.accent, 0.12) : colors.surface2,
                      borderWidth: 1,
                      borderColor: active ? withAlpha(colors.accent, 0.4) : colors.border,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      height: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "500" }}>
                        {labelize(option.value)}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                        {option.rate}
                      </Text>
                    </View>
                    <PaceDescriptorChip
                      colors={colors}
                      text={option.descriptor}
                      accent={!!option.recommended}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: 24 }} />
          </>
        ) : null}

        <FieldBlock
          colors={colors}
          label="Current weight"
          subLabel="Updates your weight throughout the app"
          error={currentWeightError}
        >
          <InlineUnitInput
            colors={colors}
            value={currentWeightInput}
            unit={unitMode}
            onChangeText={(value) => {
              setCurrentWeightInput(value);
              const parsed = Number(value);
              if (!Number.isFinite(parsed) || parsed <= 0) return;
              updateDraft({
                currentWeight: unitMode === "lb" ? lbToKg(parsed) : parsed,
              });
            }}
          />
        </FieldBlock>

        <View style={{ height: 16 }} />

        {inputs.mode !== "maintain" ? (
          <>
            <FieldBlock
              colors={colors}
              label="Goal weight"
              subLabel="Used for projections and pacing"
              error={goalWeightError}
            >
              <InlineUnitInput
                colors={colors}
                value={goalWeightInput}
                unit={unitMode}
                onChangeText={(value) => {
                  setGoalWeightInput(value);
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed) || parsed <= 0) return;
                  updateDraft({
                    goalWeight: unitMode === "lb" ? lbToKg(parsed) : parsed,
                  });
                }}
              />
            </FieldBlock>
            <View style={{ height: 24 }} />
          </>
        ) : null}

        <FieldBlock
          colors={colors}
          label="Biological sex"
          subLabel="Used for BMR calculation"
        >
          <OptionPillRow
            colors={colors}
            values={[
              { key: "male", label: "Male" },
              { key: "female", label: "Female" },
              { key: "other", label: "Other" },
            ]}
            selected={inputs.sex}
            onSelect={(value) => updateDraft({ sex: value as GoalInputs["sex"] })}
            filled
            height={40}
          />
        </FieldBlock>

        <View style={{ height: 24 }} />

        <FieldBlock colors={colors} label="Age" error={ageError}>
          <SingleInput
            colors={colors}
            value={ageInput}
            keyboardType="number-pad"
            onChangeText={(value) => {
              setAgeInput(value);
              const parsed = Number(value);
              if (!Number.isFinite(parsed)) return;
              updateDraft({ age: parsed });
            }}
          />
        </FieldBlock>

        <View style={{ height: 16 }} />

        <FieldBlock colors={colors} label="Height" error={heightError}>
          {unitMode === "kg" ? (
            <SingleInput
              colors={colors}
              value={heightMetricInput}
              keyboardType="decimal-pad"
              rightLabel="cm"
              onChangeText={(value) => {
                setHeightMetricInput(value);
                const parsed = Number(value);
                if (!Number.isFinite(parsed)) return;
                updateDraft({ heightCm: parsed });
              }}
            />
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SingleInput
                colors={colors}
                value={heightFeetInput}
                keyboardType="number-pad"
                rightLabel="ft"
                containerStyle={{ flex: 1 }}
                onChangeText={(value) => {
                  setHeightFeetInput(value);
                  const ft = Number(value);
                  const inches = Number(heightInchesInput || 0);
                  if (!Number.isFinite(ft)) return;
                  updateDraft({ heightCm: feetInchesToCm(ft, Number.isFinite(inches) ? inches : 0) });
                }}
              />
              <SingleInput
                colors={colors}
                value={heightInchesInput}
                keyboardType="number-pad"
                rightLabel="in"
                containerStyle={{ flex: 1 }}
                onChangeText={(value) => {
                  setHeightInchesInput(value);
                  const inches = Number(value);
                  const ft = Number(heightFeetInput || 0);
                  if (!Number.isFinite(inches)) return;
                  updateDraft({ heightCm: feetInchesToCm(Number.isFinite(ft) ? ft : 0, inches) });
                }}
              />
            </View>
          )}
        </FieldBlock>

        <View style={{ height: 24 }} />

        <FieldBlock colors={colors} label="Activity level">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["sedentary", "Mostly sitting", "Office job, little movement"],
              ["light", "Light movement", "Walks, light activity"],
              ["active", "Active", "Regular exercise or active job"],
              ["very_active", "Very active", "Daily training, physical job"],
              ["extra_active", "Extra active", "Very intense daily training or physical labor"],
            ].map(([key, title, desc]) => {
              const active = inputs.activityLevel === key;
              return (
                <Pressable
                  key={key}
                  onPress={() =>
                    updateDraft({ activityLevel: key as GoalInputs["activityLevel"] })
                  }
                  style={{
                    width: "48.7%",
                    backgroundColor: active ? withAlpha(colors.accent, 0.12) : colors.surface2,
                    borderWidth: 1,
                    borderColor: active ? withAlpha(colors.accent, 0.4) : colors.border,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>
                    {title}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FieldBlock>

        <View style={{ height: 24 }} />

        <FieldBlock colors={colors} label="Training days per week">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {Array.from({ length: 8 }, (_, i) => i).map((day) => {
                const active = inputs.trainingDaysPerWeek === day;
                return (
                  <Pressable
                    key={day}
                    onPress={() => updateDraft({ trainingDaysPerWeek: day })}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.buttonText : colors.textSecondary,
                        fontWeight: "500",
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </FieldBlock>

        <View style={{ height: 32 }} />

        <SmartOptionsCard
          colors={colors}
          open={smartOpen}
          summary={smartSummary}
          onToggle={() => setSmartOpen((v) => !v)}
        >
          <FieldBlock
            colors={colors}
            label="Protein target"
            subLabel="Higher protein preserves muscle during cuts"
          >
            <OptionPillRow
              colors={colors}
              values={[
                { key: "standard", label: "Standard · 1.8g/kg" },
                { key: "high", label: "High · 2.2g/kg" },
                { key: "very_high", label: "Very high · 2.6g/kg" },
              ]}
              selected={inputs.proteinPriority}
              onSelect={(value) =>
                updateDraft({ proteinPriority: value as GoalInputs["proteinPriority"] })
              }
              filled
              height={40}
            />
          </FieldBlock>

          <View style={{ height: 16 }} />

          <View
            style={{
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
                  Training day cycling
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  Eat more on training days, less on rest days
                </Text>
              </View>
              <Toggle
                colors={colors}
                value={inputs.cyclingEnabled}
                onChange={(value) => updateDraft({ cyclingEnabled: value })}
              />
            </View>
            {inputs.cyclingEnabled ? (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Training days: +150 kcal
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Rest days: -150 kcal
                </Text>
              </>
            ) : null}
          </View>

          <View style={{ height: 16 }} />

          <FieldBlock
            colors={colors}
            label="Weekly cardio"
            subLabel="Adds to your calorie budget"
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 60, 120, 180, 240].map((minutes) => {
                  const active =
                    minutes === 240
                      ? inputs.cardioMinutesPerWeek >= 240
                      : inputs.cardioMinutesPerWeek === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() =>
                        updateDraft({
                          cardioMinutesPerWeek: minutes === 240 ? 240 : minutes,
                        })
                      }
                      style={{
                        paddingHorizontal: 14,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: active ? withAlpha(colors.accent, 0.12) : colors.surface2,
                        borderWidth: 1,
                        borderColor: active ? withAlpha(colors.accent, 0.4) : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 12 }}>
                        {minutes === 240 ? "240+" : `${minutes}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </FieldBlock>
        </SmartOptionsCard>

        <View style={{ height: 32 }} />

        <Pressable
          onPress={() => router.push("/profile/goal-advanced")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Advanced settings
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Manual TDEE, body fat, macro ratios
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>

        <View style={{ height: 32 }} />
        <SectionLabel colors={colors} title="Your Plan" />
        <View style={{ height: 12 }} />

        <View
          style={{
            backgroundColor: withAlpha(colors.accent, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(colors.accent, 0.3),
            borderRadius: 20,
            padding: 20,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                flex: 1,
              }}
            >
              Recommended daily calories
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(confidenceTone, 0.35),
                backgroundColor: withAlpha(confidenceTone, 0.12),
              }}
            >
              <Text style={{ color: confidenceTone, fontSize: 11 }}>
                {`${labelize(result.confidence)}${
                  result.confidence === "high" ? " ✓" : ""
                }`}
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.textPrimary, fontSize: 36, fontWeight: "200" }}>
            {result.dailyCalories.toLocaleString()}
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}> kcal</Text>
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <MacroDot colors={colors} color={colors.accent} label="Protein" value={result.protein} />
            <MacroDot colors={colors} color={colors.info} label="Carbs" value={result.carbs} />
            <MacroDot colors={colors} color={colors.warning} label="Fat" value={result.fat} />
          </View>

          {inputs.cyclingEnabled && result.trainingDayCalories && result.restDayCalories ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Training: {result.trainingDayCalories.toLocaleString()} kcal · Rest:{" "}
              {result.restDayCalories.toLocaleString()} kcal
            </Text>
          ) : null}

          {inputs.mode !== "maintain" ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              → Goal in{" "}
              {result.weeksToGoal
                ? `~${Math.max(1, Math.round(result.weeksToGoal))} weeks`
                : "—"}{" "}
              · {result.weeklyPaceKg >= 0 ? "+" : ""}
              {result.weeklyPaceKg.toFixed(2)} kg/wk
            </Text>
          ) : null}

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={coachTone.icon} size={14} color={coachTone.color} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: "italic", flex: 1 }}>
              {result.healthNote}
            </Text>
          </View>
        </View>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={handleSave}
          disabled={!isDirty || saving || !!ageError || !!heightError || !!currentWeightError || !!goalWeightError}
          style={{
            height: 44,
            borderRadius: 999,
            backgroundColor:
              isDirty && !saving && !ageError && !heightError && !currentWeightError && !goalWeightError
                ? colors.accent
                : colors.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color:
                isDirty && !saving && !ageError && !heightError && !currentWeightError && !goalWeightError
                  ? colors.buttonText
                  : colors.textTertiary,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {saving ? "Saving..." : isDirty ? "Save changes" : "No changes"}
          </Text>
        </Pressable>

        {savedToast ? (
          <Text style={{ color: colors.success, fontSize: 12, textAlign: "center", marginTop: 8 }}>
            Goals updated ✓
          </Text>
        ) : null}

        <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: "center", marginTop: 16 }}>
          Built from {formulaLabel(inputs.bmrFormula)} + activity model · mode: {labelize(inputs.mode)}
        </Text>
        {lastUpdated ? (
          <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Last updated: {lastUpdated}
          </Text>
        ) : null}
      </ScrollView>

      <RecalculateSheet
        visible={recalcOpen}
        colors={colors}
        previousWeightKg={Number(profile?.weightKg ?? inputs.currentWeight)}
        newWeightKg={inputs.currentWeight}
        unitMode={unitMode}
        onClose={() => {
          setRecalcOpen(false);
          setConfirmedWeightRecalc(true);
        }}
        onPrimary={() => {
          setRecalcOpen(false);
          setConfirmedWeightRecalc(true);
          handleSave();
        }}
      />
    </View>
  );
}

function FieldBlock({
  colors,
  label,
  subLabel,
  error,
  children,
}: {
  colors: any;
  label: string;
  subLabel?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}>
        {label}
      </Text>
      {subLabel ? (
        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>
          {subLabel}
        </Text>
      ) : null}
      <View style={{ height: 6 }} />
      {children}
      {error ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function SingleInput({
  colors,
  value,
  onChangeText,
  keyboardType,
  rightLabel,
  containerStyle,
}: {
  colors: any;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType: "default" | "number-pad" | "decimal-pad";
  rightLabel?: string;
  containerStyle?: object;
}) {
  return (
    <View
      style={[
        {
          height: 44,
          borderRadius: 12,
          backgroundColor: colors.surface3,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
        },
        containerStyle,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontSize: 16,
          paddingVertical: 0,
        }}
        placeholderTextColor={colors.textTertiary}
      />
      {rightLabel ? (
        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{rightLabel}</Text>
      ) : null}
    </View>
  );
}

function InlineUnitInput({
  colors,
  value,
  unit,
  onChangeText,
}: {
  colors: any;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View
      style={{
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontSize: 28,
          fontWeight: "200",
          paddingVertical: 0,
        }}
        placeholderTextColor={colors.textTertiary}
      />
      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{unit}</Text>
    </View>
  );
}

function SectionLabel({ colors, title }: { colors: any; title: string }) {
  return (
    <Text
      style={{
        color: colors.textTertiary,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {title}
    </Text>
  );
}

function OptionPillRow({
  colors,
  values,
  selected,
  onSelect,
  filled,
  height,
}: {
  colors: any;
  values: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
  filled?: boolean;
  height: number;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => {
        const active = selected === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={{
              paddingHorizontal: 14,
              height,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active && filled ? colors.accent : colors.surface2,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
            }}
          >
            <Text
              style={{
                color: active && filled ? colors.buttonText : colors.textSecondary,
                fontSize: 13,
                fontWeight: active ? "500" : "400",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PaceDescriptorChip({
  colors,
  text,
  accent,
}: {
  colors: any;
  text: string;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: accent ? withAlpha(colors.accent, 0.35) : colors.border,
        backgroundColor: accent ? withAlpha(colors.accent, 0.12) : colors.surface3,
      }}
    >
      <Text style={{ color: accent ? colors.accent : colors.textSecondary, fontSize: 11 }}>
        {text}
      </Text>
    </View>
  );
}

function SmartOptionsCard({
  colors,
  open,
  summary,
  onToggle,
  children,
}: {
  colors: any;
  open: boolean;
  summary: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const rotate = useRef(new Animated.Value(open ? 1 : 0)).current;
  const heightAnim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotate, {
        toValue: open ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: open ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [heightAnim, open, rotate]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface1,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1 }}>
          <SectionLabel colors={colors} title="Smart Options" />
          {!open ? (
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
        </Animated.View>
      </Pressable>
      <Animated.View
        style={{
          overflow: "hidden",
          maxHeight: heightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 480],
          }),
          opacity: heightAnim,
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>
      </Animated.View>
    </View>
  );
}

function Toggle({
  colors,
  value,
  onChange,
}: {
  colors: any;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 15,
        justifyContent: "center",
        paddingHorizontal: 3,
        backgroundColor: value ? colors.accent : colors.surface3,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.buttonText,
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}

function MacroDot({
  colors,
  color,
  label,
  value,
}: {
  colors: any;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <View>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>
          {value}g
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{label}</Text>
      </View>
    </View>
  );
}

function RecalculateSheet({
  visible,
  colors,
  previousWeightKg,
  newWeightKg,
  unitMode,
  onClose,
  onPrimary,
}: {
  visible: boolean;
  colors: any;
  previousWeightKg: number;
  newWeightKg: number;
  unitMode: UnitMode;
  onClose: () => void;
  onPrimary: () => void;
}) {
  const translateY = useRef(new Animated.Value(220)).current;
  useEffect(() => {
    if (!visible) {
      translateY.setValue(220);
      return;
    }
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  const formatWeight = (kg: number) =>
    unitMode === "lb" ? `${Math.round(kgToLb(kg))} lb` : `${round1(kg)} kg`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: withAlpha(colors.background, 0.56),
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: colors.surface2,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 20,
            minHeight: "40%",
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              alignSelf: "center",
              width: 32,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.surface3,
              marginBottom: 18,
            }}
          />
          <Ionicons
            name="scale-outline"
            size={24}
            color={colors.textTertiary}
            style={{ alignSelf: "center", marginBottom: 12 }}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            Your weight changed
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              textAlign: "center",
              lineHeight: 18,
              marginTop: 8,
              paddingHorizontal: 8,
            }}
          >
            {`You logged ${formatWeight(newWeightKg)}. Your goals were set at ${formatWeight(
              previousWeightKg
            )}. Recalculate your macros to stay on track?`}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 16,
            }}
          >
            <StatChip colors={colors} label={`${formatWeight(previousWeightKg)} · Previous`} />
            <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
            <StatChip colors={colors} label={`${formatWeight(newWeightKg)} · New`} />
          </View>

          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 12,
              textAlign: "center",
              fontStyle: "italic",
              marginTop: 12,
            }}
          >
            Your pace will be adjusted automatically to keep you on track.
          </Text>

          <View style={{ marginTop: "auto", gap: 8 }}>
            <Pressable
              onPress={onPrimary}
              style={{
                height: 44,
                borderRadius: 999,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.buttonText, fontSize: 14, fontWeight: "500" }}>
                Recalculate my goals →
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                height: 44,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Keep current goals
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function StatChip({ colors, label }: { colors: any; label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
