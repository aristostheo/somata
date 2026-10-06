/** The verified FitAdapt /v1/profile-intelligence transport fields Somata sends. */
export type FitAdaptProfile = {
  age_years: number;
  height_cm: number;
  weight_kg: number;
  sex_for_mifflin_equation: "female" | "male";
  activity_level: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active";
  goal: "cut" | "maintain" | "gain";
  requested_weekly_change_kg: number;
};

export type FitAdaptObservation = {
  observed_on: string;
  body_weight_kg?: number | null;
  energy_intake_kcal?: number | null;
  steps?: number | null;
};

export type FitAdaptRequest = {
  profile: FitAdaptProfile;
  observations: FitAdaptObservation[];
  nutrition_preferences: { macro_strategy: "balanced" | "higher_protein" };
  review_confirmation?: { effective_date: string; proposed_target_kcal_per_day: number };
  adaptation_history?: FitAdaptAdaptationEvent[];
};

export type FitAdaptTargets = { calories: number; protein: number; carbs: number; fat: number };
export type FitAdaptAdaptationEvent = {
  effective_date: string; previous_active_target_kcal_per_day: number;
  new_active_target_kcal_per_day: number; calorie_delta_kcal_per_day: number;
  recommendation_decision: "increase" | "decrease" | "hold" | "defer";
  action: string; source: string; reason_codes: string[];
  evidence_as_of_date: string | null; new_observation_count: number;
  new_weight_contributor_count: number; new_intake_contributor_count: number;
  policy_version: string; proposed_delta_kcal_per_day: number;
};

/** A validated, deliberately small projection of ProfileIntelligenceResponse. */
export type FitAdaptEvaluation = {
  policy_version: string;
  baseline: { target_calories_kcal_per_day: number };
  lifecycle: {
    stage: "baseline" | "calibrating" | "early_personalized" | "personalized";
    requirements: string[];
    calendar_history_days: number;
    weight_observation_count: number;
    intake_observation_count: number;
  };
  recommendation: {
    status: "insufficient_data" | "hold" | "increase_calories" | "decrease_calories";
    reasons: string[];
    recommended_adjustment_kcal_per_day: number | null;
    proposed_intake_target_kcal_per_day: number | null;
  };
  decision: {
    decision: "hold" | "increase" | "decrease" | "defer";
    numerical_change_proposed: boolean;
    proposed_calorie_target_kcal_per_day: number;
    activation_readiness: "not_ready" | "review_required" | "ready";
  };
  integration_status: {
    app_status: string;
    more_data_needed: boolean;
    proposal_available: boolean;
    proposal_requires_review: boolean;
  };
  proposal: null | { targets: FitAdaptTargets; effective_date: string; review_required: boolean };
  activation: null | { targets: FitAdaptTargets; event: FitAdaptAdaptationEvent };
};

export type FitAdaptBridgeResult =
  | { kind: "insufficient_data"; missing: string[] }
  | { kind: "evaluation"; evaluation: FitAdaptEvaluation };

export type BridgeErrorCode =
  | "unauthenticated"
  | "invalid_request"
  | "invalid_source_data"
  | "service_unavailable"
  | "timeout"
  | "service_error"
  | "invalid_response"
  | "stale_proposal";

export class BridgeError extends Error {
  constructor(public readonly code: BridgeErrorCode, message: string) {
    super(message);
    this.name = "BridgeError";
  }
}
