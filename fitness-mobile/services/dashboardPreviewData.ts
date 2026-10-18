import type { FitAdaptPlanState } from "./fitadapt";
import type { FoodEntry } from "./nutrition";
import { acceptedNutritionTargets, nutritionTargets, savedNutritionTargets,
  type NutritionTargets } from "./nutritionTargets";
import type { Profile } from "./profile";
import { profilePlanPresentation } from "./profile/profilePlanPresentation";

export type PreviewPlan = {
  kind: "active" | "goals" | "unavailable";
  title: string;
  detail: string;
  targets: Partial<NutritionTargets> | null;
};

const targetKeys = ["calories", "protein", "carbs", "fat"] as const;

/** Only show values backed by the accepted projection or a saved goal. */
export function dashboardPreviewPlan(
  profile: Profile | null | undefined,
  state: FitAdaptPlanState | null,
  planStatus: "loading" | "ready" | "error",
): PreviewPlan {
  if (profile === undefined) return { kind: "unavailable", title: "Loading targets", detail: "Reading your saved profile.", targets: null };
  if (profile === null) return { kind: "unavailable", title: "Targets unavailable", detail: "Your saved profile could not be loaded.", targets: null };

  const accepted = acceptedNutritionTargets(profile);
  if (accepted) {
    if (profilePlanPresentation(profile, state).kind === "active") {
      return { kind: "active", title: "Active plan", detail: "Accepted FitAdapt targets · changes require your approval.", targets: nutritionTargets(profile) };
    }
    return { kind: "unavailable", title: "Plan status unavailable",
      detail: planStatus === "loading" ? "Checking the plan record. Current account targets are shown." :
        planStatus === "error" ? "The plan record could not be checked. Current account targets are shown." :
          "The plan record and target projection do not match. Current account targets are shown.",
      targets: nutritionTargets(profile) };
  }

  const saved = savedNutritionTargets(profile);
  const resolved = nutritionTargets(profile);
  const backed: Partial<NutritionTargets> = {};
  for (const key of targetKeys) if (saved[key] !== undefined) backed[key] = resolved[key];
  if (Object.keys(backed).length) return { kind: "goals", title: "Your goals",
    detail: state?.currentRecommendation ? "Accepted targets are still syncing. Saved goals are shown for now." :
      "Saved goals stay in place until you accept a FitAdapt proposal.", targets: backed };
  return { kind: "unavailable", title: "Targets unavailable", detail: "Set your goals to see daily progress against them.", targets: null };
}

export type PreviewLogged = { entries: number } & Record<keyof NutritionTargets, number | null>;

/** Missing nutrients remain unknown; a real logged zero remains zero. */
export function dashboardLoggedToday(rows: Array<Partial<FoodEntry>>, date: string): PreviewLogged {
  const today = rows.filter((row) => row.date === date);
  const result: PreviewLogged = { entries: today.length, calories: null, protein: null, carbs: null, fat: null };
  if (!today.length) return result;
  for (const key of targetKeys) {
    let sum = 0;
    let complete = true;
    for (const row of today) {
      const value = row[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) { complete = false; break; }
      sum += value;
    }
    result[key] = complete ? sum : null;
  }
  return result;
}
