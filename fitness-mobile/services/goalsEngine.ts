// goalsEngine.ts
export type Sex = "male" | "female";
export type GoalMode = "cut" | "maintain" | "bulk";

export type GoalsInputs = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;

  // Training / activity
  stepsPerDay?: number; // optional, used if provided
  gymSessionsPerWeek: number; // e.g. 4
  sportSessionsPerWeek?: number; // e.g. basketball 1-2
  jobActivity?: "sedentary" | "light" | "active"; // optional

  // Goal + sliders (0..1)
  mode: GoalMode;
  aggressiveness: number; // 0..1
  trainingBias: number; // 0..1 (0 = equal calories daily, 1 = strong high training / low rest split)
  proteinBias: number; // 0..1 (maps to g/lb range)
  metabolismAdaptation: number; // 0..1 (0 = ignore adaptation, 1 = strong adaptation)

  // Macro preferences
  minFatPerKg?: number; // default 0.7 (floor)
  maxFatPerKg?: number; // default 1.0 (ceiling)
};

export type GoalsOutput = {
  bmr: number;
  tdee: number;
  calorieTarget: number; // average daily calories
  trainingDayCalories: number;
  restDayCalories: number;

  proteinG: number;
  fatG: number;
  carbsG: number;

  trainingDayMacros: {
    proteinG: number;
    fatG: number;
    carbsG: number;
    calories: number;
  };
  restDayMacros: {
    proteinG: number;
    fatG: number;
    carbsG: number;
    calories: number;
  };

  debug: Record<string, any>;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x);
const lbFromKg = (kg: number) => kg * 2.2046226218;

function mifflinStJeorBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
) {
  // BMR kcal/day
  const s = sex === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

/**
 * Estimate TDEE multiplier using steps + sessions.
 * This is deliberately "smooth" and slider-friendly.
 */
function estimateActivityMultiplier(args: {
  stepsPerDay?: number;
  gymSessionsPerWeek: number;
  sportSessionsPerWeek?: number;
  jobActivity?: "sedentary" | "light" | "active";
}) {
  const steps = args.stepsPerDay ?? 7000;

  // Steps multiplier ~ 1.2 -> 1.55
  // 3k = 1.20, 8k = 1.40, 12k = 1.50, 16k+ = 1.55
  const stepsMult =
    steps <= 3000
      ? 1.2
      : steps <= 8000
      ? 1.2 + (steps - 3000) * (0.2 / 5000)
      : steps <= 12000
      ? 1.4 + (steps - 8000) * (0.1 / 4000)
      : steps <= 16000
      ? 1.5 + (steps - 12000) * (0.05 / 4000)
      : 1.55;

  // Add training load (weekly sessions -> mild bump)
  const gym = Math.max(0, args.gymSessionsPerWeek);
  const sport = Math.max(0, args.sportSessionsPerWeek ?? 0);
  const sessions = gym + sport;

  // Sessions bump up to +0.12
  const sessionsBump = Math.min(0.12, sessions * 0.02); // 5 sessions ~ +0.10

  // Job activity bump
  const jobBump =
    args.jobActivity === "active"
      ? 0.06
      : args.jobActivity === "light"
      ? 0.03
      : 0;

  return stepsMult + sessionsBump + jobBump;
}

/**
 * Map proteinBias slider -> protein g/lb
 * Cut wants higher range, bulk can be slightly lower.
 */
function proteinPerLb(mode: GoalMode, proteinBias01: number) {
  const t = clamp01(proteinBias01);

  if (mode === "cut") {
    // 0.75 -> 1.05 g/lb
    return 0.75 + t * (1.05 - 0.75);
  }
  if (mode === "bulk") {
    // 0.65 -> 0.95 g/lb
    return 0.65 + t * (0.95 - 0.65);
  }
  // maintain: 0.70 -> 1.00
  return 0.7 + t * (1.0 - 0.7);
}

/**
 * Map aggressiveness slider -> deficit/surplus %
 */
function goalDeltaPct(mode: GoalMode, aggressiveness01: number) {
  const t = clamp01(aggressiveness01);

  if (mode === "cut") {
    // 0..1 => 10% .. 30% deficit
    return -(0.1 + t * 0.2);
  }
  if (mode === "bulk") {
    // 0..1 => 5% .. 15% surplus
    return +(0.05 + t * 0.1);
  }
  return 0; // maintenance
}

/**
 * Adaptive thermogenesis: stronger as deficit grows + over time.
 * metabolismAdaptation slider controls strength.
 */
function applyMetabolicAdaptation(
  tdee: number,
  mode: GoalMode,
  aggressiveness01: number,
  adaptation01: number
) {
  const a = clamp01(adaptation01);
  if (a <= 0) return tdee;

  const delta = goalDeltaPct(mode, aggressiveness01); // negative for cut
  if (delta >= 0) return tdee; // we mainly apply to cuts; bulks can ignore or slight bump if you want

  // Typical adaptation range: ~0%..8% depending on deficit (and individual)
  const deficitSize = Math.min(0.3, Math.abs(delta)); // cap at 30%
  const adaptPct = a * (0.02 + (deficitSize / 0.3) * 0.06); // 2% -> 8%
  return tdee * (1 - adaptPct);
}

/**
 * Split calories between training/rest days using trainingBias slider.
 * trainingBias=0 => flat daily calories
 * trainingBias=1 => big split (more on training days, less on rest) but same weekly average
 */
function splitTrainingRestCalories(
  avgCals: number,
  trainingDays: number,
  bias01: number
) {
  const b = clamp01(bias01);
  if (trainingDays <= 0 || trainingDays >= 7) {
    return { train: avgCals, rest: avgCals };
  }
  if (b === 0) return { train: avgCals, rest: avgCals };

  // Max swing: +/- 12% of avg cals at bias=1
  const swing = 0.12 * b;

  // Training gets +swing, rest gets -swing, but keep weekly average same
  const train = avgCals * (1 + swing);
  const rest = avgCals * (1 - swing);

  // Re-normalize to keep weekly average exactly avgCals
  const weekly = train * trainingDays + rest * (7 - trainingDays);
  const scale = (avgCals * 7) / weekly;

  return { train: train * scale, rest: rest * scale };
}

/**
 * Compute macros given calories + protein + fat bounds.
 * Carbs fill the rest.
 */
function macrosFromCalories(args: {
  calories: number;
  weightKg: number;
  proteinG: number;
  minFatPerKg: number;
  maxFatPerKg: number;
}) {
  const { calories, weightKg, proteinG } = args;

  // Fat target: start mid-range, then clamp to bounds
  const minFat = args.minFatPerKg * weightKg;
  const maxFat = args.maxFatPerKg * weightKg;

  // heuristic fat: 25% calories => grams
  const fatFromPct = (calories * 0.25) / 9;
  const fatG = Math.max(minFat, Math.min(maxFat, fatFromPct));

  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const remaining = Math.max(0, calories - proteinCals - fatCals);

  const carbsG = remaining / 4;

  return {
    proteinG,
    fatG,
    carbsG,
    calories,
  };
}

export function calculateGoalTargets(input: GoalsInputs): GoalsOutput {
  const minFatPerKg = input.minFatPerKg ?? 0.7;
  const maxFatPerKg = input.maxFatPerKg ?? 1.0;

  const bmr = mifflinStJeorBmr(
    input.sex,
    input.weightKg,
    input.heightCm,
    input.age
  );

  const mult = estimateActivityMultiplier({
    stepsPerDay: input.stepsPerDay,
    gymSessionsPerWeek: input.gymSessionsPerWeek,
    sportSessionsPerWeek: input.sportSessionsPerWeek,
    jobActivity: input.jobActivity,
  });

  let tdee = bmr * mult;

  // Apply adaptation (mainly for cuts)
  tdee = applyMetabolicAdaptation(
    tdee,
    input.mode,
    input.aggressiveness,
    input.metabolismAdaptation
  );

  // Goal calories
  const deltaPct = goalDeltaPct(input.mode, input.aggressiveness);
  const calorieTarget = tdee * (1 + deltaPct);

  // Protein
  const lb = lbFromKg(input.weightKg);
  const pPerLb = proteinPerLb(input.mode, input.proteinBias);
  const proteinG = pPerLb * lb;

  // Training/rest split
  const trainingDays = Math.max(
    0,
    Math.min(7, input.gymSessionsPerWeek + (input.sportSessionsPerWeek ?? 0))
  );
  const split = splitTrainingRestCalories(
    calorieTarget,
    trainingDays,
    input.trainingBias
  );

  // Macros (same protein daily; you can optionally bias carbs to training days further)
  const trainingDayMacros = macrosFromCalories({
    calories: split.train,
    weightKg: input.weightKg,
    proteinG,
    minFatPerKg,
    maxFatPerKg,
  });

  const restDayMacros = macrosFromCalories({
    calories: split.rest,
    weightKg: input.weightKg,
    proteinG,
    minFatPerKg,
    maxFatPerKg,
  });

  // Average macros (useful for UI)
  const avgProtein = proteinG;
  const avgFat =
    (trainingDayMacros.fatG * trainingDays +
      restDayMacros.fatG * (7 - trainingDays)) /
    7;
  const avgCarbs =
    (trainingDayMacros.carbsG * trainingDays +
      restDayMacros.carbsG * (7 - trainingDays)) /
    7;

  return {
    bmr: round(bmr),
    tdee: round(tdee),
    calorieTarget: round(calorieTarget),
    trainingDayCalories: round(split.train),
    restDayCalories: round(split.rest),

    proteinG: round(avgProtein),
    fatG: round(avgFat),
    carbsG: round(avgCarbs),

    trainingDayMacros: {
      calories: round(trainingDayMacros.calories),
      proteinG: round(trainingDayMacros.proteinG),
      fatG: round(trainingDayMacros.fatG),
      carbsG: round(trainingDayMacros.carbsG),
    },
    restDayMacros: {
      calories: round(restDayMacros.calories),
      proteinG: round(restDayMacros.proteinG),
      fatG: round(restDayMacros.fatG),
      carbsG: round(restDayMacros.carbsG),
    },

    debug: {
      activityMultiplier: mult,
      deltaPct,
      proteinPerLb: pPerLb,
      trainingDays,
    },
  };
}

/**
 * Optional: weekly check-in adjustment.
 * Use this when user logs weigh-ins.
 *
 * If actual rate is slower than expected (plateau),
 * gently nudge estimated TDEE down (or up) — controlled by metabolismAdaptation.
 */
export function adjustTdeeFromCheckIn(args: {
  currentTdee: number;
  // average scale weight change per week (kg/week), negative for loss
  actualKgPerWeek: number;
  // desired kg/week from plan (kg/week), negative for cut
  targetKgPerWeek: number;
  metabolismAdaptation: number; // 0..1
}) {
  const a = clamp01(args.metabolismAdaptation);
  if (a <= 0) return args.currentTdee;

  // Match the common 3,500 kcal/lb guidance used in mainstream calculators.
  const kcalPerKg = 3500 / 0.45359237;

  // If losing slower than planned, we likely overestimated TDEE
  const errorKg = args.actualKgPerWeek - args.targetKgPerWeek; // e.g. -0.2 - (-0.5) = +0.3 (too slow)
  const errorKcalPerDay = (errorKg * kcalPerKg) / 7;

  // Apply only a fraction for stability
  const correction = errorKcalPerDay * 0.35 * a; // 35% of error scaled by slider
  return args.currentTdee - correction;
}
