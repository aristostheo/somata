import { calculateMacros, getDefaultGoalInputs, type GoalInputs } from "./macroCalculator";
import type { Profile } from "./profile";
import type { FitAdaptEvaluationResult, FitAdaptPlanState } from "./fitadapt";

export type SetupDraft = {
  age: string; heightCm: string; heightFeet: string; heightInches: string; weight: string;
  weightUnit: "kg" | "lb"; sex: "" | "female" | "male";
  activityLevel: "" | "sedentary" | "light" | "moderate" | "active" | "very_active" | "extra_active";
  mode: "" | GoalInputs["mode"];
  pace: "" | GoalInputs["pace"];
  proteinPriority: "" | GoalInputs["proteinPriority"];
};

const levels = new Set(["sedentary", "light", "moderate", "active", "very_active", "extra_active"]);
const modes = new Set(["cut", "maintain", "lean_bulk", "bulk"]);
const priorities = new Set(["standard", "high", "very_high"]);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const validAge = (v: unknown) => Number.isInteger(v) && finite(v) && v >= 18 && v <= 80;
const validHeight = (v: unknown) => finite(v) && v >= 100 && v <= 250;
const validWeight = (v: unknown) => finite(v) && v >= 30 && v <= 300;

export function validSignedPace(mode: unknown, pace: unknown, weight: unknown): boolean {
  if (!finite(pace) || !finite(weight) || !validWeight(weight)) return false;
  if (mode === "maintain") return pace === 0;
  if (mode === "cut") return pace < 0 && -pace <= weight * 0.0075;
  if (mode === "lean_bulk" || mode === "bulk") return pace > 0 && pace <= weight * 0.005;
  return false;
}

export function missingFitAdaptInputs(profile: Profile | null): string[] {
  const missing: string[] = [];
  if (!validAge(profile?.age)) missing.push("age");
  if (!validHeight(profile?.heightCm)) missing.push("heightCm");
  if (!validWeight(profile?.weightKg)) missing.push("weightKg");
  if (profile?.sex !== "female" && profile?.sex !== "male") missing.push("sex");
  if (!levels.has(profile?.activityLevel ?? "")) missing.push("activityLevel");
  if (!modes.has(profile?.goalInputs?.mode ?? "")) missing.push("mode");
  if (!priorities.has(profile?.goalInputs?.proteinPriority ?? "")) missing.push("proteinPriority");
  if (!validSignedPace(profile?.goalInputs?.mode ?? profile?.goal, profile?.goalResult?.weeklyPaceKg, profile?.weightKg)) missing.push("pace");
  return missing;
}

export function draftFromProfile(profile: Profile | null): SetupDraft {
  const unit = profile?.weightUnit === "lb" ? "lb" : "kg";
  const height = validHeight(profile?.heightCm) ? profile!.heightCm! : 0;
  const inches = Math.round(height / 2.54);
  return {
    age: validAge(profile?.age) ? String(profile!.age) : "",
    heightCm: height ? String(height) : "",
    heightFeet: height ? String(Math.floor(inches / 12)) : "",
    heightInches: height ? String(inches % 12) : "",
    weight: validWeight(profile?.weightKg) ? String(Number((unit === "lb" ? profile!.weightKg! / 0.45359237 : profile!.weightKg!).toFixed(1))) : "",
    weightUnit: unit,
    sex: profile?.sex === "female" || profile?.sex === "male" ? profile.sex : "",
    activityLevel: levels.has(profile?.activityLevel ?? "") ? profile!.activityLevel as SetupDraft["activityLevel"] : "",
    mode: modes.has(profile?.goalInputs?.mode ?? "") ? profile!.goalInputs!.mode! :
      modes.has(profile?.goal ?? "") ? profile!.goal! : "",
    pace: profile?.goalInputs?.pace === "gentle" || profile?.goalInputs?.pace === "moderate" || profile?.goalInputs?.pace === "aggressive"
      ? profile.goalInputs.pace : validSignedPace(profile?.goalInputs?.mode ?? profile?.goal, profile?.goalResult?.weeklyPaceKg, profile?.weightKg) ? "moderate" : "",
    proteinPriority: priorities.has(profile?.goalInputs?.proteinPriority ?? "") ? profile!.goalInputs!.proteinPriority! : "",
  };
}

export function savedPaceForDraft(profile: Profile | null, draft: SetupDraft): number | undefined {
  const weight = validWeight(profile?.weightKg) ? profile!.weightKg! :
    draft.weight.trim() ? Number(draft.weight) * (draft.weightUnit === "lb" ? 0.45359237 : 1) : NaN;
  const pace = profile?.goalResult?.weeklyPaceKg;
  return validSignedPace(draft.mode, pace, weight) ? pace : undefined;
}

export function validateSetup(draft: SetupDraft, savedPace?: number, existing?: Profile | null): { values: { age: number; heightCm: number; weightKg: number;
  sex: "female" | "male"; activityLevel: Exclude<SetupDraft["activityLevel"], "">;
  mode: GoalInputs["mode"]; pace: GoalInputs["pace"]; proteinPriority: GoalInputs["proteinPriority"];
  weeklyPaceKg: number } } | { errors: string[] } {
  const errors: string[] = [];
  const age = validAge(existing?.age) ? existing!.age! : draft.age.trim() ? Number(draft.age) : NaN;
  const weightKg = validWeight(existing?.weightKg) ? existing!.weightKg! :
    draft.weight.trim() ? Number(draft.weight) * (draft.weightUnit === "lb" ? 0.45359237 : 1) : NaN;
  const feet = draft.heightFeet.trim() ? Number(draft.heightFeet) : NaN;
  const inches = draft.heightInches.trim() ? Number(draft.heightInches) : NaN;
  const heightCm = validHeight(existing?.heightCm) ? existing!.heightCm! : draft.weightUnit === "lb" ? (feet * 12 + inches) * 2.54 :
    draft.heightCm.trim() ? Number(draft.heightCm) : NaN;
  if (!validAge(age)) errors.push("Enter an age from 18 to 80.");
  if (!validHeight(heightCm) || (!validHeight(existing?.heightCm) && draft.weightUnit === "lb" && (!Number.isInteger(feet) || !Number.isInteger(inches) || inches < 0 || inches > 11)))
    errors.push("Enter a height from 100 to 250 cm (3 ft 4 in to 8 ft 2 in).");
  if (!validWeight(weightKg)) errors.push("Enter a weight from 30 to 300 kg (about 66.2 to 661.4 lb).");
  if (draft.sex !== "female" && draft.sex !== "male") errors.push("Choose the equation sex used for the energy estimate.");
  if (!levels.has(draft.activityLevel)) errors.push("Choose an activity level.");
  if (!modes.has(draft.mode)) errors.push("Choose a goal.");
  if (!priorities.has(draft.proteinPriority)) errors.push("Choose a macro strategy.");
  if (draft.mode !== "maintain" && savedPace === undefined && !["gentle", "moderate", "aggressive"].includes(draft.pace)) errors.push("Choose a weekly pace.");
  if (errors.length) return { errors };
  const mode = draft.mode as GoalInputs["mode"];
  const pace = mode === "maintain" ? "moderate" : draft.pace as GoalInputs["pace"];
  const inputs: GoalInputs = { ...getDefaultGoalInputs(), age, heightCm, currentWeight: weightKg,
    goalWeight: weightKg, sex: draft.sex as "female" | "male", activityLevel: draft.activityLevel === "moderate" ? "active" : draft.activityLevel as GoalInputs["activityLevel"],
    mode, pace, proteinPriority: draft.proteinPriority as GoalInputs["proteinPriority"] };
  const weeklyPaceKg = savedPace ?? calculateMacros(inputs).weeklyPaceKg;
  if (!validSignedPace(mode, weeklyPaceKg, weightKg)) return { errors: ["That weekly pace exceeds the FitAdapt limit for this weight. Choose a gentler pace or maintain."] };
  return { values: { age, heightCm, weightKg, sex: inputs.sex as "female" | "male",
    activityLevel: draft.activityLevel as Exclude<SetupDraft["activityLevel"], "">,
    mode, pace, proteinPriority: inputs.proteinPriority, weeklyPaceKg } };
}

export function setupProfilePatch(profile: Profile | null, draft: SetupDraft, kind: "new" | "existing"): Partial<Profile> {
  const missing = kind === "existing" ? new Set(missingFitAdaptInputs(profile)) : new Set<string>();
  if (kind === "existing" && missing.size === 0) return {};
  const savedPace = kind === "existing" ? savedPaceForDraft(profile, draft) : undefined;
  const checked = validateSetup(draft, savedPace, kind === "existing" ? profile : null);
  if ("errors" in checked) throw new Error(checked.errors.join(" "));
  const v = checked.values;
  if (kind === "new") {
    const inputs: GoalInputs = { ...getDefaultGoalInputs(), age: v.age, heightCm: v.heightCm,
      currentWeight: v.weightKg, goalWeight: v.weightKg, sex: v.sex,
      activityLevel: v.activityLevel === "moderate" ? "active" : v.activityLevel as GoalInputs["activityLevel"],
      mode: v.mode, pace: v.pace, proteinPriority: v.proteinPriority };
    const result = calculateMacros(inputs);
    return { goalInputs: { mode: v.mode, pace: v.pace, proteinPriority: v.proteinPriority },
      goalResult: { ...result, weeksToGoal: null }, goal: v.mode, goalPace: v.pace,
      dailyCaloriesTarget: result.dailyCalories, calorieGoal: result.dailyCalories,
      dailyProteinTarget: result.protein, proteinGoal: result.protein,
      carbGoal: result.carbs, fatGoal: result.fat, goalUpdatedAt: Date.now(),
      age: v.age, heightCm: v.heightCm, weightKg: v.weightKg, sex: v.sex,
      activityLevel: v.activityLevel, weightUnit: draft.weightUnit };
  }
  const patch: Partial<Profile> = {};
  if (missing.has("age")) patch.age = v.age;
  if (missing.has("heightCm")) patch.heightCm = v.heightCm;
  if (missing.has("weightKg")) { patch.weightKg = v.weightKg; patch.weightUnit = draft.weightUnit; }
  if (missing.has("sex")) patch.sex = v.sex;
  if (missing.has("activityLevel")) patch.activityLevel = v.activityLevel;
  if (missing.has("mode") || missing.has("proteinPriority")) patch.goalInputs = {
    ...profile?.goalInputs,
    ...(missing.has("mode") ? { mode: v.mode } : {}),
    ...(missing.has("proteinPriority") ? { proteinPriority: v.proteinPriority } : {}),
  };
  if (missing.has("pace") && savedPace === undefined) patch.goalResult = { ...profile?.goalResult, weeklyPaceKg: v.weeklyPaceKg };
  return patch;
}

export function createSetupRunner(deps: {
  getPlan: () => Promise<FitAdaptPlanState>;
  save: (patch: Partial<Profile>) => Promise<void>;
  evaluate: () => Promise<FitAdaptEvaluationResult>;
}) {
  let inFlight: Promise<{ kind: "active" } | { kind: "pending" } | { kind: "result"; result: FitAdaptEvaluationResult }> | null = null;
  let saved = false;
  return (profile: Profile | null, draft: SetupDraft, kind: "new" | "existing") => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const plan = await deps.getPlan();
      if (plan.currentRecommendation) return { kind: "active" as const };
      if (plan.pending) return { kind: "pending" as const };
      if (!saved) {
        const patch = setupProfilePatch(profile, draft, kind);
        if (Object.keys(patch).length) await deps.save(patch);
        saved = true;
      }
      return { kind: "result" as const, result: await deps.evaluate() };
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}
