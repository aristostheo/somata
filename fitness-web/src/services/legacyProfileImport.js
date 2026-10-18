// Only fields the old web Profile/Settings editors actually stored, with
// explicit validation before any value can enter the shared users/{uid} doc.
function numberInRange(value, min, max) {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function firstNumberInRange(values, min, max) {
  for (const value of values) {
    const parsed = numberInRange(value, min, max);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function choice(value, allowed) {
  return allowed.includes(value) ? value : undefined;
}

export function legacyProfilePatch(profile) {
  if (!profile || typeof profile !== "object") return {};
  const patch = {};
  const calories = firstNumberInRange([profile.dailyCaloriesTarget, profile.calorieGoal], 0, 10000);
  const protein = firstNumberInRange([profile.dailyProteinTarget, profile.proteinGoal], 0, 1000);
  const carbs = numberInRange(profile.carbGoal, 0, 2000);
  const fat = numberInRange(profile.fatGoal, 0, 500);
  if (calories !== undefined) { patch.dailyCaloriesTarget = calories; patch.calorieGoal = calories; }
  if (protein !== undefined) { patch.dailyProteinTarget = protein; patch.proteinGoal = protein; }
  if (carbs !== undefined) patch.carbGoal = carbs;
  if (fat !== undefined) patch.fatGoal = fat;

  const sex = choice(profile.sex, ["male", "female"]);
  const age = numberInRange(profile.age, 18, 80);
  const heightCm = numberInRange(profile.heightCm, 100, 250);
  const weightKg = numberInRange(profile.weightKg, 30, 300);
  const weightUnit = choice(profile.weightUnit, ["kg", "lb"]);
  const activityLevel = choice(profile.activityLevel,
    ["sedentary", "light", "moderate", "active", "athlete", "very_active", "extra_active"]);
  const goal = choice(profile.goal, ["cut", "maintain", "lean_bulk", "bulk"]);
  if (sex) patch.sex = sex;
  if (age !== undefined && Number.isInteger(age)) patch.age = age;
  if (heightCm !== undefined) patch.heightCm = heightCm;
  if (weightKg !== undefined) patch.weightKg = weightKg; // canonical storage is kg, even when display is lb
  if (weightUnit) patch.weightUnit = weightUnit;
  if (activityLevel) patch.activityLevel = activityLevel;
  if (goal) patch.goal = goal;

  const proteinPerKg = numberInRange(profile.proteinPerKg, 0.5, 4);
  if (proteinPerKg !== undefined) patch.proteinPerKg = proteinPerKg;
  const proteinPct = numberInRange(profile.proteinPct, 0, 1);
  const carbPct = numberInRange(profile.carbPct, 0, 1);
  const fatPct = numberInRange(profile.fatPct, 0, 1);
  const validSplit = proteinPct !== undefined && carbPct !== undefined && fatPct !== undefined &&
    Math.abs(proteinPct + carbPct + fatPct - 1) <= 0.01;
  if (validSplit) {
    patch.proteinPct = proteinPct;
    patch.carbPct = carbPct;
    patch.fatPct = fatPct;
  }
  if (profile.targetMode === "percent" && validSplit) patch.targetMode = "percent";
  if (profile.targetMode === "proteinPerKg" && proteinPerKg !== undefined) patch.targetMode = "proteinPerKg";
  return patch;
}

export function matchingPatchFields(profile, patch) {
  return Object.keys(patch).every((key) => profile?.[key] === patch[key]);
}

export function selectedFields(profile, patch) {
  return Object.fromEntries(Object.keys(patch).map((key) => [key, profile?.[key]]));
}
