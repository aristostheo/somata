import { BridgeError, type FitAdaptObservation, type FitAdaptRequest } from "./contract";

type Document = Record<string, unknown>;

const record = (value: unknown): Document | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Document : null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const activity: Record<string, FitAdaptRequest["profile"]["activity_level"]> = {
  sedentary: "sedentary",
  light: "lightly_active",
  moderate: "moderately_active",
  active: "moderately_active", // Somata's saved 1.55 activity category.
  very_active: "very_active",
  extra_active: "extra_active",
};

/** No UI defaults are used here: every required input must be saved for this account. */
export function mapSomataToFitAdapt(profileValue: unknown, nutritionValues: unknown[], weightValues: unknown[] = []):
  { kind: "insufficient_data"; missing: string[] } | { kind: "ready"; request: FitAdaptRequest } {
  const profile = record(profileValue);
  const goalInputs = record(profile?.goalInputs);
  const goalResult = record(profile?.goalResult);
  const missing: string[] = [];
  const age = profile?.age;
  const height = profile?.heightCm;
  const weight = profile?.weightKg;
  const sex = profile?.sex;
  const level = profile?.activityLevel;
  const mode = goalInputs?.mode;
  const pace = goalResult?.weeklyPaceKg;
  const priority = goalInputs?.proteinPriority;

  if (!Number.isInteger(age) || !finite(age) || age < 18 || age > 80) missing.push("profile.age");
  if (!finite(height) || height < 100 || height > 250) missing.push("profile.heightCm");
  if (!finite(weight) || weight < 30 || weight > 300) missing.push("profile.weightKg");
  if (sex !== "female" && sex !== "male") missing.push("profile.sex_for_mifflin_equation");
  if (typeof level !== "string" || !activity[level]) missing.push("profile.activityLevel");
  if (mode !== "cut" && mode !== "maintain" && mode !== "lean_bulk" && mode !== "bulk") missing.push("profile.goalInputs.mode");
  if (!finite(pace) || (mode === "maintain" ? pace !== 0 : mode === "cut" ? pace >= 0 : pace <= 0) ||
      (finite(weight) && finite(pace) && (mode === "cut" ? -pace > weight * 0.0075 : mode === "maintain" ? false : pace > weight * 0.005))) {
    missing.push("profile.goalResult.weeklyPaceKg");
  }
  if (priority !== "standard" && priority !== "high" && priority !== "very_high") missing.push("profile.goalInputs.proteinPriority");
  if (missing.length) return { kind: "insufficient_data", missing };

  // The checks above establish the narrowed contract; these casts retain that invariant.
  const goal = mode === "cut" ? "cut" : mode === "maintain" ? "maintain" : "gain";
  const observations = mapAccountObservations(nutritionValues, profile?.steps, weightValues);
  return {
    kind: "ready",
    request: {
      profile: {
        age_years: age as number,
        height_cm: height as number,
        weight_kg: weight as number,
        sex_for_mifflin_equation: sex as "female" | "male",
        activity_level: activity[level as string],
        goal,
        requested_weekly_change_kg: pace as number,
      },
      observations,
      nutrition_preferences: { macro_strategy: priority === "standard" ? "balanced" : "higher_protein" },
    },
  };
}

/** Food entries are account-scoped. A missing calorie on any entry makes that day's intake unknown. */
export function mapAccountObservations(nutritionValues: unknown[], stepsValue: unknown, weightValues: unknown[] = []): FitAdaptObservation[] {
  const days = new Map<string, { calories: number; complete: boolean; seen: boolean; steps?: number; weight?: number }>();
  for (const raw of nutritionValues) {
    const food = record(raw);
    if (!food || !isoDate(food.date)) throw new BridgeError("invalid_source_data", "A nutrition entry has no valid date.");
    const day = days.get(food.date) ?? { calories: 0, complete: true, seen: false };
    day.seen = true;
    if (food.calories === undefined || food.calories === null) day.complete = false;
    else if (!finite(food.calories) || food.calories < 0) throw new BridgeError("invalid_source_data", "A nutrition entry has invalid energy data.");
    else {
      day.calories += food.calories;
      if (day.calories > 10000) throw new BridgeError("invalid_source_data", "A nutrition day's energy exceeds the FitAdapt range.");
    }
    days.set(food.date, day);
  }
  const steps = record(stepsValue);
  for (const [date, value] of Object.entries(steps ?? {})) {
    if (!isoDate(date) || !Number.isInteger(value) || !finite(value) || value < 0) continue;
    const day = days.get(date) ?? { calories: 0, complete: true, seen: false };
    day.steps = value;
    days.set(date, day);
  }
  for (const raw of weightValues) {
    const entry = record(raw);
    if (!entry || !isoDate(entry.date) || !finite(entry.weightKg) || entry.weightKg < 30 || entry.weightKg > 300)
      throw new BridgeError("invalid_source_data", "A saved account weight entry is invalid.");
    const day = days.get(entry.date) ?? { calories: 0, complete: true, seen: false };
    day.weight = entry.weightKg;
    days.set(entry.date, day);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([observed_on, day]) => {
    const observation: FitAdaptObservation = { observed_on };
    if (day.seen) observation.energy_intake_kcal = day.complete ? day.calories : null;
    if (day.steps !== undefined) observation.steps = day.steps;
    if (day.weight !== undefined) observation.body_weight_kg = day.weight;
    return observation;
  }).filter((row) => row.energy_intake_kcal != null || row.steps !== undefined || row.body_weight_kg !== undefined);
}
