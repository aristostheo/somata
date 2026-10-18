import type { FitAdaptPlanState, PlanTargets } from "@/services/fitadapt";
import { acceptedNutritionTargets, nutritionTargets, type NutritionTargets } from "@/services/nutritionTargets";
import type { Profile } from "@/services/profile";

export type ProfilePlanPresentation = {
  kind: "active" | "goals";
  title: "Active plan" | "Your goals";
  targets: NutritionTargets;
};

function matchesAcceptedPlan(plan: PlanTargets | undefined, active: NutritionTargets | null): boolean {
  return !!plan && !!active &&
    plan.calories === active.calories && plan.protein === active.protein &&
    plan.carbs === active.carbs && plan.fat === active.fat;
}

// The projection supplies every visible number; the trusted plan record only
// confirms whether those numbers can be described as an accepted FitAdapt plan.
export function profilePlanPresentation(profile: Profile | null, state: FitAdaptPlanState | null): ProfilePlanPresentation {
  const targets = nutritionTargets(profile);
  const active = acceptedNutritionTargets(profile);
  const kind = matchesAcceptedPlan(state?.currentRecommendation?.targets, active) ? "active" : "goals";
  return { kind, title: kind === "active" ? "Active plan" : "Your goals", targets };
}
