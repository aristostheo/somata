export interface GoalInputs {
  currentWeight: number;
  goalWeight: number;
  heightCm: number;
  age: number;
  sex: "male" | "female" | "other";
  mode: "cut" | "maintain" | "lean_bulk" | "bulk";
  pace: "gentle" | "moderate" | "aggressive";
  activityLevel:
    | "sedentary"
    | "light"
    | "active"
    | "very_active"
    | "extra_active";
  trainingDaysPerWeek: number;
  cyclingEnabled: boolean;
  proteinPriority: "standard" | "high" | "very_high";
  cardioMinutesPerWeek: number;
  manualTDEEOverride: number | null;
  bodyFatPercent: number | null;
  manualMacroRatios: { protein: number; carbs: number; fat: number } | null;
  bmrFormula: "mifflin" | "harris_benedict" | "katch_mcardle";
}

export interface MacroResult {
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  weeklyPaceKg: number;
  weeksToGoal: number | null;
  tdee: number;
  confidence: "high" | "medium" | "low";
  healthNote: string;
  trainingDayCalories: number | null;
  restDayCalories: number | null;
}

const ACTIVITY_MULTIPLIERS: Record<GoalInputs["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const PACE_ADJUSTMENTS: Record<
  GoalInputs["mode"],
  Record<GoalInputs["pace"], number>
> = {
  cut: {
    gentle: -250,
    moderate: -400,
    aggressive: -600,
  },
  maintain: {
    gentle: 0,
    moderate: 0,
    aggressive: 0,
  },
  lean_bulk: {
    gentle: 150,
    moderate: 250,
    aggressive: 400,
  },
  bulk: {
    gentle: 300,
    moderate: 500,
    aggressive: 750,
  },
};

const PROTEIN_MULTIPLIERS: Record<GoalInputs["proteinPriority"], number> = {
  standard: 1.8,
  high: 2.2,
  very_high: 2.6,
};

const KG_PER_LB = 0.45359237;
const KCAL_PER_LB = 3500;
const KCAL_PER_KG = KCAL_PER_LB / KG_PER_LB;

const DEFAULT_GOAL_INPUTS: GoalInputs = {
  currentWeight: 75,
  goalWeight: 75,
  heightCm: 0,
  age: 0,
  sex: "other",
  mode: "maintain",
  pace: "moderate",
  activityLevel: "active",
  trainingDaysPerWeek: 3,
  cyclingEnabled: false,
  proteinPriority: "high",
  cardioMinutesPerWeek: 0,
  manualTDEEOverride: null,
  bodyFatPercent: null,
  manualMacroRatios: null,
  bmrFormula: "mifflin",
};

let draftGoalInputs: GoalInputs | null = null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value);

export function getDefaultGoalInputs(): GoalInputs {
  return { ...DEFAULT_GOAL_INPUTS, manualMacroRatios: null };
}

export function getGoalSetupDraft(): GoalInputs | null {
  return draftGoalInputs ? { ...draftGoalInputs } : null;
}

export function setGoalSetupDraft(next: GoalInputs | null) {
  draftGoalInputs = next
    ? {
        ...next,
        manualMacroRatios: next.manualMacroRatios
          ? { ...next.manualMacroRatios }
          : null,
      }
    : null;
}

export function normalizeGoalInputs(
  raw: Partial<GoalInputs> | null | undefined
): GoalInputs {
  const base = getDefaultGoalInputs();
  return {
    ...base,
    ...raw,
    currentWeight: Number(raw?.currentWeight ?? base.currentWeight),
    goalWeight: Number(raw?.goalWeight ?? base.goalWeight),
    heightCm: Number(raw?.heightCm ?? base.heightCm),
    age: Number(raw?.age ?? base.age),
    trainingDaysPerWeek: clamp(
      Number(raw?.trainingDaysPerWeek ?? base.trainingDaysPerWeek),
      0,
      7
    ),
    cardioMinutesPerWeek: Math.max(
      0,
      Number(raw?.cardioMinutesPerWeek ?? base.cardioMinutesPerWeek)
    ),
    manualTDEEOverride:
      raw?.manualTDEEOverride == null
        ? null
        : Number(raw.manualTDEEOverride),
    bodyFatPercent:
      raw?.bodyFatPercent == null ? null : Number(raw.bodyFatPercent),
    manualMacroRatios: raw?.manualMacroRatios
      ? {
          protein: Number(raw.manualMacroRatios.protein),
          carbs: Number(raw.manualMacroRatios.carbs),
          fat: Number(raw.manualMacroRatios.fat),
        }
      : null,
    bmrFormula:
      raw?.bmrFormula === "harris_benedict" || raw?.bmrFormula === "katch_mcardle"
        ? raw.bmrFormula
        : "mifflin",
  };
}

export function buildGoalInputsFromProfile(profile: {
  weightKg?: number;
  targetWeightKg?: number;
  heightCm?: number;
  age?: number;
  sex?: GoalInputs["sex"];
  goalInputs?: Partial<GoalInputs> | null;
  goal?: GoalInputs["mode"];
  activityLevel?: string;
  trainingDaysPerWeek?: number;
  bodyFatPct?: number | null;
  bmrFormula?: GoalInputs["bmrFormula"];
}) {
  const existing = profile.goalInputs ?? {};
  const activityLevel =
    existing.activityLevel ??
    (profile.activityLevel === "sedentary" ||
    profile.activityLevel === "light" ||
    profile.activityLevel === "active" ||
    profile.activityLevel === "very_active" ||
    profile.activityLevel === "extra_active"
      ? profile.activityLevel
      : profile.activityLevel === "moderate" || profile.activityLevel === "athlete"
      ? "very_active"
      : "active");

  return normalizeGoalInputs({
    ...existing,
    currentWeight: Number(profile.weightKg ?? existing.currentWeight ?? DEFAULT_GOAL_INPUTS.currentWeight),
    goalWeight: Number(
      profile.targetWeightKg ??
        existing.goalWeight ??
        profile.weightKg ??
        DEFAULT_GOAL_INPUTS.goalWeight
    ),
    heightCm: Number(profile.heightCm ?? existing.heightCm ?? DEFAULT_GOAL_INPUTS.heightCm),
    age: Number(profile.age ?? existing.age ?? DEFAULT_GOAL_INPUTS.age),
    sex: (profile.sex ?? existing.sex ?? DEFAULT_GOAL_INPUTS.sex) as GoalInputs["sex"],
    mode: (existing.mode ?? profile.goal ?? DEFAULT_GOAL_INPUTS.mode) as GoalInputs["mode"],
    activityLevel,
    trainingDaysPerWeek: Number(
      profile.trainingDaysPerWeek ??
        existing.trainingDaysPerWeek ??
        DEFAULT_GOAL_INPUTS.trainingDaysPerWeek
    ),
    bodyFatPercent:
      profile.bodyFatPct != null ? Number(profile.bodyFatPct) : existing.bodyFatPercent ?? null,
    bmrFormula:
      existing.bmrFormula ?? profile.bmrFormula ?? DEFAULT_GOAL_INPUTS.bmrFormula,
  });
}

export function buildGoalProfilePatch(inputsRaw: GoalInputs) {
  const inputs = normalizeGoalInputs(inputsRaw);
  const result = calculateMacros(inputs);
  return {
    goalInputs: inputs,
    goalResult: result,
    goal: inputs.mode,
    goalPace: inputs.pace,
    activityLevel: inputs.activityLevel,
    trainingDaysPerWeek: inputs.trainingDaysPerWeek,
    targetWeightKg: inputs.goalWeight,
    dailyCaloriesTarget: result.dailyCalories,
    calorieGoal: result.dailyCalories,
    dailyProteinTarget: result.protein,
    proteinGoal: result.protein,
    carbGoal: result.carbs,
    fatGoal: result.fat,
    cyclingEnabled: inputs.cyclingEnabled,
    proteinPriority: inputs.proteinPriority,
    cardioMinutesPerWeek: inputs.cardioMinutesPerWeek,
    manualTDEEOverride: inputs.manualTDEEOverride,
    manualMacroRatios: inputs.manualMacroRatios,
    bmrFormula: inputs.bmrFormula,
    bodyFatPct:
      inputs.bodyFatPercent != null ? Number(inputs.bodyFatPercent) : null,
    goalUpdatedAt: Date.now(),
  };
}

function calculateBmr(inputs: GoalInputs) {
  if (
    !Number.isFinite(inputs.heightCm) ||
    inputs.heightCm <= 0 ||
    !Number.isFinite(inputs.age) ||
    inputs.age <= 0
  ) {
    return 10 * inputs.currentWeight;
  }
  if (inputs.bmrFormula === "katch_mcardle") {
    if (
      inputs.bodyFatPercent != null &&
      Number.isFinite(inputs.bodyFatPercent) &&
      inputs.bodyFatPercent >= 3 &&
      inputs.bodyFatPercent <= 50
    ) {
      const leanMassKg = getLeanMassKg(inputs);
      return 370 + 21.6 * leanMassKg;
    }
  }

  if (inputs.bmrFormula === "harris_benedict") {
    if (inputs.sex === "male") {
      return (
        13.397 * inputs.currentWeight +
        4.799 * inputs.heightCm -
        5.677 * inputs.age +
        88.362
      );
    }
    if (inputs.sex === "female") {
      return (
        9.247 * inputs.currentWeight +
        3.098 * inputs.heightCm -
        4.33 * inputs.age +
        447.593
      );
    }
    const male =
      13.397 * inputs.currentWeight +
      4.799 * inputs.heightCm -
      5.677 * inputs.age +
      88.362;
    const female =
      9.247 * inputs.currentWeight +
      3.098 * inputs.heightCm -
      4.33 * inputs.age +
      447.593;
    return (male + female) / 2;
  }

  const common =
    10 * inputs.currentWeight + 6.25 * inputs.heightCm - 5 * inputs.age;
  if (inputs.sex === "male") return common + 5;
  if (inputs.sex === "female") return common - 161;
  return common - 78;
}

function getLeanMassKg(inputs: GoalInputs) {
  if (
    inputs.bodyFatPercent == null ||
    !Number.isFinite(inputs.bodyFatPercent) ||
    inputs.bodyFatPercent <= 0 ||
    inputs.bodyFatPercent >= 100
  ) {
    return inputs.currentWeight;
  }
  return inputs.currentWeight * (1 - inputs.bodyFatPercent / 100);
}

function getConfidence(inputs: GoalInputs): MacroResult["confidence"] {
  const hasAge = Number.isFinite(inputs.age) && inputs.age > 0;
  const hasHeight = Number.isFinite(inputs.heightCm) && inputs.heightCm > 0;
  const hasSpecificSex = inputs.sex === "male" || inputs.sex === "female";
  const hasBodyFat =
    inputs.bodyFatPercent != null &&
    Number.isFinite(inputs.bodyFatPercent) &&
    inputs.bodyFatPercent >= 3 &&
    inputs.bodyFatPercent <= 50;

  if (hasAge && hasHeight && hasSpecificSex && hasBodyFat) return "high";
  if (hasAge && hasHeight && hasSpecificSex) return "medium";
  if (hasBodyFat && (hasAge || hasHeight || hasSpecificSex)) return "medium";
  return "low";
}

function generateHealthNote(
  inputs: GoalInputs,
  result: Omit<MacroResult, "healthNote">
) {
  const missingCore =
    !Number.isFinite(inputs.age) ||
    inputs.age <= 0 ||
    !Number.isFinite(inputs.heightCm) ||
    inputs.heightCm <= 0 ||
    inputs.sex === "other";
  if (missingCore) {
    return "Add height, age, and sex for a more accurate estimate.";
  }
  if (inputs.mode === "cut" && inputs.pace === "aggressive") {
    return "Aggressive cut. Keep protein high to protect lean mass.";
  }
  if (inputs.mode === "cut" && inputs.pace === "gentle") {
    return "Sustainable pace. Good for preserving muscle during your cut.";
  }
  if (inputs.mode === "maintain") {
    return "Steady maintenance. A good baseline if you want performance without scale pressure.";
  }
  if (inputs.mode === "lean_bulk" && inputs.pace === "gentle") {
    return "Lean gain pace. Good for nudging progress without overshooting.";
  }
  if (Math.abs(result.weeklyPaceKg) > 0 && result.weeksToGoal) {
    return `You're on track to reach your goal in about ${Math.max(
      1,
      round(result.weeksToGoal)
    )} weeks.`;
  }
  return "Balanced setup. Adjust only if recovery, hunger, or progress says you should.";
}

export function calculateMacros(inputsRaw: GoalInputs): MacroResult {
  const inputs = normalizeGoalInputs(inputsRaw);
  const bmr = calculateBmr(inputs);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[inputs.activityLevel];
  const cardioDailyKcal = (inputs.cardioMinutesPerWeek * 5) / 7;
  const estimatedTdee = bmr * activityMultiplier + cardioDailyKcal;
  const tdee =
    inputs.manualTDEEOverride && inputs.manualTDEEOverride > 0
      ? inputs.manualTDEEOverride
      : estimatedTdee;

  const calorieAdjustment = PACE_ADJUSTMENTS[inputs.mode][inputs.pace];
  const dailyCalories = Math.max(1200, round(tdee + calorieAdjustment));

  const proteinBaseKg = getLeanMassKg(inputs);
  let protein = Math.max(
    150,
    round(proteinBaseKg * PROTEIN_MULTIPLIERS[inputs.proteinPriority])
  );

  let fat = Math.max(50, round((0.25 * dailyCalories) / 9));
  let carbs = round((dailyCalories - protein * 4 - fat * 9) / 4);

  if (inputs.manualMacroRatios) {
    const ratios = inputs.manualMacroRatios;
    protein = Math.max(150, round((dailyCalories * (ratios.protein / 100)) / 4));
    fat = Math.max(30, round((dailyCalories * (ratios.fat / 100)) / 9));
    carbs = round((dailyCalories - protein * 4 - fat * 9) / 4);
  }

  if (carbs < 0) {
    const caloriesNeeded = Math.abs(carbs) * 4;
    const reducedFat = Math.max(30, fat - Math.ceil(caloriesNeeded / 9));
    fat = reducedFat;
    carbs = round((dailyCalories - protein * 4 - fat * 9) / 4);
  }

  carbs = Math.max(0, carbs);
  fat = Math.max(30, fat);

  const weeklyPaceKg =
    calorieAdjustment === 0
      ? 0
      : Number(((calorieAdjustment * 7) / KCAL_PER_KG).toFixed(2));
  const deltaWeight = Math.abs(inputs.currentWeight - inputs.goalWeight);
  const weeksToGoal =
    deltaWeight > 0 && Math.abs(weeklyPaceKg) > 0
      ? Number((deltaWeight / Math.abs(weeklyPaceKg)).toFixed(1))
      : null;

  const trainingDayCalories = inputs.cyclingEnabled ? dailyCalories + 150 : null;
  const restDayCalories = inputs.cyclingEnabled ? Math.max(1200, dailyCalories - 150) : null;

  const confidence = getConfidence(inputs);

  const resultBase = {
    dailyCalories,
    protein,
    carbs,
    fat,
    weeklyPaceKg,
    weeksToGoal,
    tdee: round(tdee),
    confidence,
    trainingDayCalories,
    restDayCalories,
  };

  return {
    ...resultBase,
    healthNote: generateHealthNote(inputs, resultBase),
  };
}

export function shouldRecalculate(
  previousWeight: number,
  newWeight: number,
  threshold: number = 0.5
) {
  return Math.abs(previousWeight - newWeight) >= threshold;
}
