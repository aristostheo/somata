import { BridgeError, type FitAdaptEvaluation, type FitAdaptRequest, type FitAdaptTargets, type FitAdaptAdaptationEvent } from "./contract";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nonnegativeInteger = (value: unknown): value is number => number(value) && Number.isInteger(value) && value >= 0;
const string = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const nullableNumber = (value: unknown): value is number | null => value === null || number(value);
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === "string" && options.includes(value as T);
const exactKeys = (value: ObjectValue, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const isoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function validateFitAdaptRequest(value: FitAdaptRequest): void {
  const root = object(value);
  const p = object(root?.profile);
  const n = object(root?.nutrition_preferences);
  if (!root || !p || !n || !exactKeys(p, ["age_years", "height_cm", "weight_kg", "sex_for_mifflin_equation", "activity_level", "goal", "requested_weekly_change_kg"]) ||
      !exactKeys(n, ["macro_strategy"]) || !exactKeys(root, ["profile", "observations", "nutrition_preferences", "review_confirmation", "adaptation_history"]) ||
      !Number.isInteger(p.age_years) || !number(p.age_years) || p.age_years < 18 || p.age_years > 80 ||
      !number(p.height_cm) || p.height_cm < 100 || p.height_cm > 250 || !number(p.weight_kg) || p.weight_kg < 30 || p.weight_kg > 300 ||
      !oneOf(p.sex_for_mifflin_equation, ["female", "male"]) ||
      !oneOf(p.activity_level, ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"]) ||
      !oneOf(p.goal, ["cut", "maintain", "gain"]) || !number(p.requested_weekly_change_kg) ||
      !oneOf(n.macro_strategy, ["balanced", "higher_protein"]) || !Array.isArray(value.observations) || value.observations.length > 1095) {
    throw new BridgeError("invalid_request", "FitAdapt request is outside the verified contract.");
  }
  const rate = p.requested_weekly_change_kg;
  if (p.goal === "maintain" ? rate !== 0 : p.goal === "cut" ? rate >= 0 || -rate > p.weight_kg * 0.0075 : rate <= 0 || rate > p.weight_kg * 0.005) {
    throw new BridgeError("invalid_request", "Saved goal pace is outside the FitAdapt contract.");
  }
  const seen = new Set<string>();
  for (const row of value.observations) {
    const o = object(row);
    if (!o || !exactKeys(o, ["observed_on", "body_weight_kg", "energy_intake_kcal", "steps"]) || !isoDate(o.observed_on) || seen.has(o.observed_on) ||
        (o.energy_intake_kcal == null && o.steps == null && o.body_weight_kg == null) ||
        (o.body_weight_kg != null && (!number(o.body_weight_kg) || o.body_weight_kg < 30 || o.body_weight_kg > 300)) ||
        (o.energy_intake_kcal != null && (!number(o.energy_intake_kcal) || o.energy_intake_kcal < 0 || o.energy_intake_kcal > 10000)) ||
        (o.steps != null && (!nonnegativeInteger(o.steps)))) {
      throw new BridgeError("invalid_request", "FitAdapt observation is outside the verified contract.");
    }
    seen.add(o.observed_on);
  }
  if (value.review_confirmation && (!isoDate(value.review_confirmation.effective_date) || !number(value.review_confirmation.proposed_target_kcal_per_day)))
    throw new BridgeError("invalid_request", "Proposal confirmation is invalid.");
  if (value.adaptation_history && !Array.isArray(value.adaptation_history))
    throw new BridgeError("invalid_request", "Adaptation history is invalid.");
}

function targets(value: unknown): FitAdaptTargets | null {
  const plan = object(value);
  if (!plan || !number(plan.calorie_target_kcal_per_day) || plan.calorie_target_kcal_per_day <= 0 ||
      !number(plan.protein_g_per_day) || plan.protein_g_per_day < 0 ||
      !number(plan.carbohydrate_g_per_day) || plan.carbohydrate_g_per_day < 0 ||
      !number(plan.fat_g_per_day) || plan.fat_g_per_day < 0) return null;
  return { calories: plan.calorie_target_kcal_per_day, protein: plan.protein_g_per_day,
    carbs: plan.carbohydrate_g_per_day, fat: plan.fat_g_per_day };
}

function adaptationEvent(value: unknown): FitAdaptAdaptationEvent | null {
  const event = object(value);
  if (!event || !isoDate(event.effective_date) || !number(event.previous_active_target_kcal_per_day) ||
      !number(event.new_active_target_kcal_per_day) || !number(event.calorie_delta_kcal_per_day) ||
      !oneOf(event.recommendation_decision, ["increase", "decrease", "hold", "defer"]) ||
      !string(event.action) || !string(event.source) || !strings(event.reason_codes) ||
      (event.evidence_as_of_date !== null && !isoDate(event.evidence_as_of_date)) ||
      !nonnegativeInteger(event.new_observation_count) || !nonnegativeInteger(event.new_weight_contributor_count) ||
      !nonnegativeInteger(event.new_intake_contributor_count) || !string(event.policy_version) ||
      !number(event.proposed_delta_kcal_per_day)) return null;
  return event as FitAdaptAdaptationEvent;
}

/** Validate every field we return; all other FitAdapt sections remain server-private. */
export function projectFitAdaptResponse(value: unknown): FitAdaptEvaluation {
  const root = object(value);
  const baseline = object(root?.baseline);
  const lifecycle = object(root?.lifecycle);
  const recommendation = object(root?.recommendation);
  const decision = object(root?.recommendation_decision);
  const status = object(root?.integration_status);
  const adaptation = object(root?.plan_adaptation);
  if (!root || !string(root.policy_version) || !baseline || !number(baseline.target_calories_kcal_per_day) || baseline.target_calories_kcal_per_day <= 0 ||
      !lifecycle || !oneOf(lifecycle.stage, ["baseline", "calibrating", "early_personalized", "personalized"]) ||
      !strings(lifecycle.requirements) || !nonnegativeInteger(lifecycle.calendar_history_days) ||
      !nonnegativeInteger(lifecycle.weight_observation_count) || !nonnegativeInteger(lifecycle.intake_observation_count) ||
      !recommendation || !oneOf(recommendation.status, ["insufficient_data", "hold", "increase_calories", "decrease_calories"]) ||
      !strings(recommendation.reasons) || !nullableNumber(recommendation.recommended_adjustment_kcal_per_day) ||
      !nullableNumber(recommendation.proposed_intake_target_kcal_per_day) ||
      !decision || !oneOf(decision.decision, ["hold", "increase", "decrease", "defer"]) ||
      typeof decision.numerical_change_proposed !== "boolean" || !number(decision.proposed_calorie_target_kcal_per_day) ||
      !oneOf(decision.activation_readiness, ["not_ready", "review_required", "ready"]) ||
      !status || !string(status.app_status) || typeof status.more_data_needed !== "boolean" ||
      typeof status.proposal_available !== "boolean" || typeof status.proposal_requires_review !== "boolean" ||
      !adaptation || typeof adaptation.activation_ready !== "boolean" || !string(adaptation.action) ||
      (adaptation.effective_date !== null && !isoDate(adaptation.effective_date)) ||
      !Array.isArray(adaptation.adaptation_history)) {
    throw new BridgeError("invalid_response", "FitAdapt returned an invalid evaluation contract.");
  }
  const proposed = root.proposed_macro_plan == null ? null : targets(root.proposed_macro_plan);
  if (root.proposed_macro_plan != null && !proposed) throw new BridgeError("invalid_response", "FitAdapt returned invalid proposal targets.");
  const next = targets(adaptation.next_active_macro_plan);
  const lastEvent = adaptation.adaptation_history.length ? adaptationEvent(adaptation.adaptation_history[adaptation.adaptation_history.length - 1]) : null;
  if (adaptation.activation_ready && (!next || !lastEvent)) throw new BridgeError("invalid_response", "FitAdapt returned incomplete activation data.");
  const reviewable = recommendation.status !== "insufficient_data" && decision.numerical_change_proposed &&
    status.proposal_available && proposed && isoDate(adaptation.effective_date) &&
    Math.abs(proposed.calories - decision.proposed_calorie_target_kcal_per_day) < 0.01;
  if (decision.numerical_change_proposed && !reviewable && recommendation.status !== "insufficient_data")
    throw new BridgeError("invalid_response", "FitAdapt proposal fields disagree.");
  return {
    policy_version: root.policy_version,
    baseline: { target_calories_kcal_per_day: baseline.target_calories_kcal_per_day },
    lifecycle: {
      stage: lifecycle.stage,
      requirements: lifecycle.requirements,
      calendar_history_days: lifecycle.calendar_history_days,
      weight_observation_count: lifecycle.weight_observation_count,
      intake_observation_count: lifecycle.intake_observation_count,
    },
    recommendation: {
      status: recommendation.status,
      reasons: recommendation.reasons,
      recommended_adjustment_kcal_per_day: recommendation.recommended_adjustment_kcal_per_day,
      proposed_intake_target_kcal_per_day: recommendation.proposed_intake_target_kcal_per_day,
    },
    decision: {
      decision: decision.decision,
      numerical_change_proposed: decision.numerical_change_proposed,
      proposed_calorie_target_kcal_per_day: decision.proposed_calorie_target_kcal_per_day,
      activation_readiness: decision.activation_readiness,
    },
    integration_status: {
      app_status: status.app_status,
      more_data_needed: status.more_data_needed,
      proposal_available: status.proposal_available,
      proposal_requires_review: status.proposal_requires_review,
    },
    proposal: reviewable ? { targets: proposed, effective_date: adaptation.effective_date as string,
      review_required: status.proposal_requires_review } : null,
    activation: adaptation.activation_ready && next && lastEvent ? { targets: next, event: lastEvent } : null,
  };
}

export async function callFitAdapt(
  request: FitAdaptRequest,
  config: { baseUrl: string; token: string; timeoutMs?: number; fetcher?: typeof fetch },
): Promise<FitAdaptEvaluation> {
  validateFitAdaptRequest(request);
  let url: URL;
  try { url = new URL(config.baseUrl); }
  catch { throw new BridgeError("service_unavailable", "FitAdapt service URL is not configured."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!config.token || (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new BridgeError("service_unavailable", "FitAdapt service configuration is incomplete.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 10000);
  try {
    const response = await (config.fetcher ?? fetch)(new URL("/v1/integrations/somata/profile-intelligence", url), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 422) throw new BridgeError("invalid_request", "FitAdapt rejected the mapped request.");
      if (response.status === 401 || response.status === 403 || response.status === 503) throw new BridgeError("service_unavailable", "FitAdapt bridge authentication or configuration is unavailable.");
      throw new BridgeError("service_error", "FitAdapt could not complete the evaluation.");
    }
    let json: unknown;
    try { json = await response.json(); }
    catch { throw new BridgeError("invalid_response", "FitAdapt returned invalid JSON."); }
    return projectFitAdaptResponse(json);
  } catch (error) {
    if (controller.signal.aborted) throw new BridgeError("timeout", "FitAdapt evaluation timed out.");
    if (error instanceof BridgeError) throw error;
    throw new BridgeError("service_error", "FitAdapt could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
