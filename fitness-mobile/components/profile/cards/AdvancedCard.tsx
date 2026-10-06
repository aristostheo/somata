// components/profile/cards/AdvancedCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";

// ✅ NEW: engine
// Adjust the path to wherever you placed goalsEngine.ts
import { calculateGoalTargets } from "@/services/goalsEngine";

type GoalType = "cut" | "maintain" | "bulk";

export type Targets = {
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
};

type JobActivity = "sedentary" | "light" | "active";

type Props = {
  currentWeightKg: number;

  targetWeightKg: number;
  targetWeightInput: string;
  onChangeTargetWeight: (v: string) => void;
  weightUnit: "kg" | "lb";

  maintenanceTargets: Targets;

  sex?: "male" | "female";
  age?: number;
  heightCm?: number;

  defaultStepsPerDay?: number;
  defaultGymSessionsPerWeek?: number;
  defaultSportSessionsPerWeek?: number;
  defaultJobActivity?: JobActivity;

  savedTargets?: Targets;
  onPreview?: (t: Targets, meta?: { userInitiated?: boolean }) => void;
};

const onlyNum = (t: string) => t.replace(/[^0-9.]/g, "");

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function riskFromDeltaPct(deltaPct: number) {
  const d = Math.abs(deltaPct); // 0.10 => 10%
  if (d >= 0.25) return "High";
  if (d >= 0.16) return "Moderate";
  return "Low";
}

export default function AdvancedGoalsEngineCard({
  currentWeightKg,
  targetWeightKg,
  targetWeightInput,
  onChangeTargetWeight,
  weightUnit,
  maintenanceTargets,
  sex = "male",
  age = 25,
  heightCm = 175,
  defaultStepsPerDay,
  defaultGymSessionsPerWeek,
  defaultSportSessionsPerWeek,
  defaultJobActivity,
  savedTargets,
  onPreview,
}: Props) {
  const { colors, isDark } = useTheme();

  const [goalType, setGoalType] = useState<GoalType>("cut");

  // 0–1 sliders (engine inputs)
  const [aggression, setAggression] = useState(0.5);
  const [trainingBias, setTrainingBias] = useState(0.5);
  const [neatAdaptation, setNeatAdaptation] = useState(0.3);
  const [proteinBias, setProteinBias] = useState(0.6);

  // ✅ NEW: activity inputs used by engine
  const [stepsPerDay, setStepsPerDay] = useState(
    String(defaultStepsPerDay ?? 7000)
  );
  const [gymSessions, setGymSessions] = useState(
    String(defaultGymSessionsPerWeek ?? 4)
  );
  const [sportSessions, setSportSessions] = useState(
    String(defaultSportSessionsPerWeek ?? 0)
  );
  const [jobActivity, setJobActivity] = useState<JobActivity>(
    defaultJobActivity ?? "light"
  );
  const userTouchedRef = useRef(false);

  const markTouched = () => {
    userTouchedRef.current = true;
  };
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (!savedTargets?.calorieGoal) return;

    // ✅ seed goalType based on saved calories vs maintenance
    const maint = maintenanceTargets?.calorieGoal ?? 2200;
    const saved = savedTargets.calorieGoal;

    if (saved < maint - 50) setGoalType("cut");
    else if (saved > maint + 50) setGoalType("bulk");
    else setGoalType("maintain");

    seededRef.current = true;
  }, [savedTargets?.calorieGoal, maintenanceTargets?.calorieGoal]);

  /* ───────────── engine output ───────────── */

  const output = useMemo(() => {
    // If height/age/sex are not truly known yet, still run with defaults,
    // but we also keep a “fallback TDEE” based on maintenanceTargets.
    const safeSex = sex ?? "male";
    const safeAge = Number.isFinite(age) ? age : 25;
    const safeHeight = Number.isFinite(heightCm) ? heightCm : 175;

    const parsedStepsRaw = Number(stepsPerDay);
    const parsedSteps = Number.isFinite(parsedStepsRaw)
      ? Math.max(0, parsedStepsRaw)
      : 7000;
    const parsedGym = Math.max(0, Number(gymSessions || 0) || 0);
    const parsedSport = Math.max(0, Number(sportSessions || 0) || 0);

    const out = calculateGoalTargets({
      sex: safeSex,
      age: safeAge,
      heightCm: safeHeight,
      weightKg: Math.max(30, currentWeightKg || 0),

      stepsPerDay: parsedSteps,
      gymSessionsPerWeek: parsedGym,
      sportSessionsPerWeek: parsedSport,
      jobActivity,

      mode: goalType,
      aggressiveness: clamp01(aggression),
      trainingBias: clamp01(trainingBias),
      proteinBias: clamp01(proteinBias),
      metabolismAdaptation: clamp01(neatAdaptation),

      // fat bounds (good defaults)
      minFatPerKg: 0.7,
      maxFatPerKg: 1.0,
    });

    return out;
  }, [
    sex,
    age,
    heightCm,
    currentWeightKg,
    stepsPerDay,
    gymSessions,
    sportSessions,
    jobActivity,
    goalType,
    aggression,
    trainingBias,
    proteinBias,
    neatAdaptation,
  ]);

  // If you want the preview to be “average daily targets”:
  const targets: Targets = useMemo(() => {
    return {
      calorieGoal: output.calorieTarget || maintenanceTargets.calorieGoal,
      proteinGoal: output.proteinG || maintenanceTargets.proteinGoal,
      carbGoal: output.carbsG || maintenanceTargets.carbGoal,
      fatGoal: output.fatG || maintenanceTargets.fatGoal,
    };
  }, [
    output.calorieTarget,
    output.proteinG,
    output.carbsG,
    output.fatG,
    maintenanceTargets.calorieGoal,
    maintenanceTargets.proteinGoal,
    maintenanceTargets.carbGoal,
    maintenanceTargets.fatGoal,
  ]);

  // weeks-to-goal: derive from planned avg deficit/surplus vs TDEE
  const weeksToGoal = useMemo(() => {
    const remainingKg =
      goalType === "cut"
        ? currentWeightKg - targetWeightKg
        : targetWeightKg - currentWeightKg;

    const dailyDelta =
      targets.calorieGoal - (output.tdee || targets.calorieGoal);
    const weeklyKg = (dailyDelta * 7) / (3500 / 0.45359237);

    if (!Number.isFinite(weeklyKg) || weeklyKg === 0) return Infinity;
    return Math.ceil(Math.abs(remainingKg / weeklyKg));
  }, [
    goalType,
    currentWeightKg,
    targetWeightKg,
    targets.calorieGoal,
    output.tdee,
  ]);

  const deltaPct: number =
    typeof output?.debug?.deltaPct === "number" ? output.debug.deltaPct : 0;

  const risk = useMemo(() => riskFromDeltaPct(deltaPct), [deltaPct]);

  /* ───────────── push preview to parent (no infinite loop) ───────────── */

  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    if (!onPreview) return;

    // ✅ don’t push preview until user interacts
    if (!userTouchedRef.current) return;

    const key = `${targets.calorieGoal}|${targets.proteinGoal}|${targets.carbGoal}|${targets.fatGoal}`;
    if (key === prevKeyRef.current) return;

    prevKeyRef.current = key;
    onPreview(targets, { userInitiated: true });
  }, [
    onPreview,
    targets.calorieGoal,
    targets.proteinGoal,
    targets.carbGoal,
    targets.fatGoal,
  ]);

  /* ───────────── UI ───────────── */

  return (
    <View
      style={{
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 16,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
          Goal Engine
        </Text>
        <Ionicons name="pulse-outline" size={20} color={colors.primary} />
      </View>

      {/* Goal Type */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["cut", "maintain", "bulk"] as GoalType[]).map((g) => (
          <Pressable
            key={g}
            onPress={() => {
              markTouched();
              setGoalType(g);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: goalType === g ? colors.primary : "transparent",
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: goalType === g ? "white" : colors.text,
                fontWeight: "800",
              }}
            >
              {g.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Goal Weight */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          Goal weight
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === "ios" ? 12 : 10,
            borderRadius: 14,
          }}
        >
          <TextInput
            value={targetWeightInput}
            onChangeText={(t) => {
              markTouched();
              onChangeTargetWeight(onlyNum(t));
            }}
            keyboardType="decimal-pad"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 16,
              fontWeight: "800",
            }}
            placeholder="e.g. 70"
            placeholderTextColor={colors.muted}
          />
          <Text style={{ color: colors.muted, fontWeight: "900" }}>
            {weightUnit.toUpperCase()}
          </Text>
        </View>

        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Used for time-to-goal + projections.
        </Text>
      </View>

      {/* Activity inputs (engine uses these) */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          Activity inputs
        </Text>

        <TwoColRow
          left={
            <LabeledInput
              label="Steps/day"
              value={stepsPerDay}
              onChangeText={(t) => {
                markTouched();
                setStepsPerDay(onlyNum(t));
              }}
              placeholder="7000"
              colors={colors}
            />
          }
          right={
            <LabeledInput
              label="Gym/wk"
              value={gymSessions}
              onChangeText={(t) => {
                markTouched();
                setGymSessions(onlyNum(t));
              }}
              placeholder="4"
              colors={colors}
            />
          }
        />

        <TwoColRow
          left={
            <LabeledInput
              label="Sport/wk"
              value={sportSessions}
              onChangeText={(t) => {
                markTouched();
                setSportSessions(onlyNum(t));
              }}
              placeholder="0"
              colors={colors}
            />
          }
          right={
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}
              >
                Job activity
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["sedentary", "light", "active"] as JobActivity[]).map(
                  (j) => {
                    const active = jobActivity === j;
                    return (
                      <Pressable
                        key={j}
                        onPress={() => {
                          markTouched();
                          setJobActivity(j);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: active
                            ? colors.primary
                            : "transparent",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? "white" : colors.text,
                            fontWeight: "900",
                            fontSize: 12,
                          }}
                        >
                          {j.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            </View>
          }
        />
      </View>

      {/* Sliders */}
      <SliderBlock
        label="Aggressiveness"
        value={aggression}
        onChange={setAggression}
        hint="Deficit/surplus % (engine-based)"
        onTouch={markTouched}
      />

      <SliderBlock
        label="Training Bias"
        value={trainingBias}
        onChange={setTrainingBias}
        hint="Higher = more calories on training days"
        onTouch={markTouched}
      />
      <SliderBlock
        label="Protein Bias"
        value={proteinBias}
        onChange={setProteinBias}
        hint="Maps to g/lb range (engine-based)"
        onTouch={markTouched}
      />
      <SliderBlock
        label="Metabolic Adaptation"
        value={neatAdaptation}
        onChange={setNeatAdaptation}
        hint="Accounts for adaptive thermogenesis (cuts)"
        onTouch={markTouched}
      />

      {/* Results */}
      <View
        style={{
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          Projection
        </Text>

        <Text style={{ color: colors.muted }}>
          BMR: <Text style={{ color: colors.text }}>{output.bmr} kcal</Text> ·
          TDEE: <Text style={{ color: colors.text }}>{output.tdee} kcal</Text>
        </Text>

        <Text style={{ color: colors.muted }}>
          Avg calories:{" "}
          <Text style={{ color: colors.text }}>{targets.calorieGoal} kcal</Text>
        </Text>

        <Text style={{ color: colors.muted }}>
          Train / Rest:{" "}
          <Text style={{ color: colors.text }}>
            {output.trainingDayCalories} / {output.restDayCalories} kcal
          </Text>
        </Text>

        <Text style={{ color: colors.muted }}>
          Time to goal:{" "}
          <Text style={{ color: colors.text }}>
            {weeksToGoal === Infinity ? "—" : `~${weeksToGoal} weeks`}
          </Text>
        </Text>

        <Text style={{ color: colors.muted }}>
          Risk level:{" "}
          <Text
            style={{
              color:
                risk === "High"
                  ? colors.danger
                  : risk === "Moderate"
                  ? colors.warning
                  : colors.success,
              fontWeight: "900",
            }}
          >
            {risk}
          </Text>
        </Text>

        {/* Macro targets (what your Daily Targets card should show) */}
        <View style={{ marginTop: 10, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            Targets (avg)
          </Text>
          <Text style={{ color: colors.muted }}>
            Protein:{" "}
            <Text style={{ color: colors.text }}>{targets.proteinGoal}g</Text> ·
            Carbs:{" "}
            <Text style={{ color: colors.text }}>{targets.carbGoal}g</Text> ·
            Fat: <Text style={{ color: colors.text }}>{targets.fatGoal}g</Text>
          </Text>

          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
            Debug: Δ% {(deltaPct * 100).toFixed(1)} · Training days{" "}
            {output?.debug?.trainingDays ?? "—"} · Protein/lb{" "}
            {typeof output?.debug?.proteinPerLb === "number"
              ? output.debug.proteinPerLb.toFixed(2)
              : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ───────────── UI helpers ───────────── */

function SliderBlock({
  label,
  value,
  onChange,
  hint,
  onTouch,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
  onTouch?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
      <Slider
        value={value}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        onValueChange={(v: number) => {
          onTouch?.();
          onChange(v);
        }}
      />
      <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text>
    </View>
  );
}

function TwoColRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {left}
      {right}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: any;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === "ios" ? 12 : 10,
          borderRadius: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
        />
      </View>
    </View>
  );
}
