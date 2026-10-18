import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Profile } from "@/services/profile";
import { acceptedNutritionTargets, nutritionTargets } from "@/services/nutritionTargets";
import { acceptFitAdaptPlan, declineFitAdaptPlan, getFitAdaptPlan, requestFitAdaptEvaluation,
  FitAdaptBridgeError, type FitAdaptPlanState, type PlanTargets } from "@/services/fitadapt";

function message(error: unknown) {
  if (!(error instanceof FitAdaptBridgeError)) return "Plan review could not be completed. Please try again.";
  if (error.code === "stale_proposal") return "Your goals changed since this review. Request a new evaluation.";
  if (error.code === "service_unavailable" || error.code === "timeout" || error.code === "service_error")
    return "FitAdapt is unavailable right now. Your current goals are unchanged.";
  if (error.code === "unauthenticated") return "Sign in to review a plan.";
  return error.message;
}

export function useFitAdaptReviewState({ uid, profile, onStateChange, onLoadStateChange }: {
  uid?: string; profile: Profile | null;
  onStateChange?: (state: FitAdaptPlanState | null) => void;
  onLoadStateChange?: (status: "loading" | "ready" | "error") => void;
}) {
  const [state, setState] = useState<FitAdaptPlanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hasLiveResult, setHasLiveResult] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    setState(null); setNote(null); setHasLiveResult(false); setLoadFailed(false);
    onStateChange?.(null);
  }, [uid, onStateChange]);
  useFocusEffect(useCallback(() => {
    if (!uid) { setState(null); onStateChange?.(null); onLoadStateChange?.("ready"); return; }
    let alive = true;
    onLoadStateChange?.("loading");
    getFitAdaptPlan().then((value) => {
      if (alive) { setState(value); onStateChange?.(value); setLoadFailed(false); onLoadStateChange?.("ready"); }
    }).catch((error) => {
      if (alive) { setState(null); onStateChange?.(null); setLoadFailed(true); setNote(message(error)); onLoadStateChange?.("error"); }
    });
    return () => { alive = false; };
  }, [uid, onStateChange, onLoadStateChange]));

  const run = async (action: "refresh" | "evaluate" | "accept" | "decline") => {
    if (busy) return;
    setBusy(true); setNote(null);
    try {
      if (action === "refresh") {
        const next = await getFitAdaptPlan();
        setState(next); onStateChange?.(next); setLoadFailed(false); onLoadStateChange?.("ready");
      } else if (action === "evaluate") {
        const result = await requestFitAdaptEvaluation();
        setLoadFailed(false);
        setState(result.state); onStateChange?.(result.state); onLoadStateChange?.("ready");
        if (result.kind === "insufficient_data") {
          setNote(`Complete your saved profile and goals first: ${result.missing.map((part) => part.split(".").slice(-1)[0]).join(", ")}.`);
        } else {
          setHasLiveResult(true);
          const needsMoreData = result.evaluation.recommendation.status === "insufficient_data" ||
            result.evaluation.integration_status.more_data_needed;
          setNote(result.state.pending ? null : needsMoreData
            ? "More dated weight and nutrition records are needed before FitAdapt can suggest a change."
            : "FitAdapt found no plan change ready for review. Your current goals remain in place.");
        }
      } else if (state?.pending) {
        const next = action === "accept" ? await acceptFitAdaptPlan(state.pending.id) : await declineFitAdaptPlan(state.pending.id);
        setState(next); onStateChange?.(next); onLoadStateChange?.("ready");
        setNote(action === "accept" ? "Plan accepted. Your nutrition targets are updating." : "Proposal declined. Your goals are unchanged.");
      }
    } catch (error) { setNote(message(error)); }
    finally { setBusy(false); }
  };
  const pending = state?.pending;
  const current = state?.currentRecommendation?.targets;
  const projected = acceptedNutritionTargets(profile);
  const comparison: PlanTargets = nutritionTargets(profile);
  const activeSynced = !!current && !!projected &&
    (Object.keys(current) as (keyof PlanTargets)[]).every((key) => current[key] === projected[key]);
  return { state, busy, note, hasLiveResult, loadFailed, run, pending, current,
    comparison, activeSynced };
}
