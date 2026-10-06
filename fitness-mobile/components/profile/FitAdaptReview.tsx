import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { Profile } from "@/services/profile";
import { acceptFitAdaptPlan, declineFitAdaptPlan, getFitAdaptPlan, requestFitAdaptEvaluation,
  FitAdaptBridgeError, type FitAdaptPlanState, type PlanTargets } from "@/services/fitadapt";
import { withAlpha } from "@/lib/color";
import type { VisualTokens } from "@/components/accountSettings/visualTokens";

function message(error: unknown) {
  if (!(error instanceof FitAdaptBridgeError)) return "Plan review could not be completed. Please try again.";
  if (error.code === "stale_proposal") return "Your goals changed since this review. Request a new evaluation.";
  if (error.code === "service_unavailable" || error.code === "timeout" || error.code === "service_error")
    return "FitAdapt is unavailable right now. Your current goals are unchanged.";
  if (error.code === "unauthenticated") return "Sign in to review a plan.";
  return error.message;
}

function ValueRow({ label, current, proposed, hidden, color }: { label: string; current?: number;
  proposed: number; hidden: boolean; color: string }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingVertical: 7 }}>
    <Text style={{ color, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], flexShrink: 1 }}>
      {hidden ? "•••" : `${current == null ? "" : `${Math.round(current).toLocaleString()} → `}${Math.round(proposed).toLocaleString()}${label === "Energy" ? " kcal" : " g"}`}
    </Text>
  </View>;
}

export function FitAdaptReview({ uid, profile, hidden, palette, onStateChange }: { uid?: string; profile: Profile | null;
  hidden: boolean; palette: VisualTokens; onStateChange?: (state: FitAdaptPlanState | null) => void }) {
  const router = useRouter();
  const [state, setState] = useState<FitAdaptPlanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hasLiveResult, setHasLiveResult] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!uid) { setState(null); onStateChange?.(null); return; }
    let alive = true;
    getFitAdaptPlan().then((value) => { if (alive) { setState(value); onStateChange?.(value); } })
      .catch((error) => { if (alive) setNote(message(error)); });
    return () => { alive = false; };
  }, [uid, onStateChange]));

  const run = async (action: "evaluate" | "accept" | "decline") => {
    if (busy) return;
    setBusy(true); setNote(null);
    try {
      if (action === "evaluate") {
        const result = await requestFitAdaptEvaluation();
        if (result.kind === "insufficient_data") {
          setState(result.state);
          onStateChange?.(result.state);
          setNote(`Complete your saved profile and goals first: ${result.missing.map((part) => part.split(".").slice(-1)[0]).join(", ")}.`);
        } else {
          setState(result.state);
          onStateChange?.(result.state);
          setHasLiveResult(true);
          const needsMoreData = result.evaluation.recommendation.status === "insufficient_data" ||
            result.evaluation.integration_status.more_data_needed;
          setNote(result.state.pending ? null : needsMoreData
            ? "More dated weight and nutrition records are needed before FitAdapt can suggest a change."
            : "FitAdapt found no plan change ready for review. Your current goals remain in place.");
        }
      } else if (state?.pending) {
        const next = action === "accept" ? await acceptFitAdaptPlan(state.pending.id) : await declineFitAdaptPlan(state.pending.id);
        setState(next);
        onStateChange?.(next);
        setNote(action === "accept" ? "Plan accepted. Your nutrition targets are updating." : "Proposal declined. Your goals are unchanged.");
      }
    } catch (error) { setNote(message(error)); }
    finally { setBusy(false); }
  };

  const pending = state?.pending;
  const current = state?.currentRecommendation?.targets;
  const comparison: Partial<PlanTargets> = current ?? {
    calories: profile?.goalResult?.dailyCalories ?? profile?.dailyCaloriesTarget ?? profile?.calorieGoal,
    protein: profile?.goalResult?.protein ?? profile?.dailyProteinTarget ?? profile?.proteinGoal,
    carbs: profile?.goalResult?.carbs ?? profile?.carbGoal,
    fat: profile?.goalResult?.fat ?? profile?.fatGoal,
  };
  const activeSynced = !!current && !!profile?.activeFitAdaptTargets &&
    (Object.keys(current) as (keyof PlanTargets)[]).every((key) => current[key] === profile.activeFitAdaptTargets?.[key]);

  return <View style={{ gap: 13, marginTop: 14 }}>
    {pending ? <LinearGradient colors={[withAlpha(palette.accent, palette.dark ? 0.34 : 0.16), palette.card]}
      style={{ borderRadius: 23, padding: 18, borderWidth: 1, borderColor: withAlpha(palette.accent, 0.36), gap: 11 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="sparkles-outline" color={palette.accent} size={19} />
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 19, fontWeight: "700" }}>Pending review</Text>
      </View>
      <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 19 }}>Suggested from your saved profile, dated weight entries, steps, and nutrition history. Your current targets stay in place until you accept.</Text>
      <View style={{ borderTopWidth: 1, borderColor: palette.border, paddingTop: 4 }}>
        <ValueRow label="Energy" current={comparison.calories} proposed={pending.targets.calories} hidden={hidden} color={palette.text} />
        <ValueRow label="Protein" current={comparison.protein} proposed={pending.targets.protein} hidden={hidden} color={palette.text} />
        <ValueRow label="Carbs" current={comparison.carbs} proposed={pending.targets.carbs} hidden={hidden} color={palette.text} />
        <ValueRow label="Fat" current={comparison.fat} proposed={pending.targets.fat} hidden={hidden} color={palette.text} />
      </View>
      <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run("accept")}
          style={{ minHeight: 46, justifyContent: "center", paddingHorizontal: 16, borderRadius: 14, backgroundColor: palette.primary, opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Accept plan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run("decline")}
          style={{ minHeight: 46, justifyContent: "center", paddingHorizontal: 16, borderRadius: 14, backgroundColor: palette.raised, opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: palette.text, fontWeight: "700" }}>Decline</Text>
        </Pressable>
      </View>
    </LinearGradient> : null}
    {current && !activeSynced ? <Text style={{ color: palette.secondary, fontSize: 13 }}>Accepted plan is syncing with nutrition targets.</Text> : null}
    <View style={{ borderRadius: 19, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, padding: 17, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="pulse-outline" color={palette.primary} size={18} />
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 16 }}>FitAdapt review</Text>
      </View>
      <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 19 }}>On request, Somata sends your saved age, height, weight, sex used for the energy equation, activity and goal settings, plus account-scoped dated weight, step and nutrition records. Your name, email and photo are excluded.</Text>
      {note ? <Text accessibilityRole="alert" style={{ color: palette.text, fontSize: 13, lineHeight: 19 }}>{note}</Text> : null}
      {note?.startsWith("Complete your saved") ? <Pressable accessibilityRole="button" onPress={() => router.push("/profile/goal-setup")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Complete profile and goals →</Text></Pressable> : null}
      {note?.startsWith("More dated weight") ? <Pressable accessibilityRole="button" onPress={() => router.push("/(modals)/body-metrics")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Record a weight →</Text></Pressable> : null}
      {note?.startsWith("More dated weight") ? <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/nutrition")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Log nutrition →</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={busy || !uid} onPress={() => void run("evaluate")}
        style={{ minHeight: 46, borderRadius: 14, backgroundColor: palette.primaryTint, alignItems: "center", justifyContent: "center", opacity: busy || !uid ? 0.5 : 1 }}>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>{busy ? "Working…" : pending ? "Request a fresh review" : "Review my plan"}</Text>
      </Pressable>
      {(hasLiveResult || pending || current) ? <Text style={{ color: palette.secondary, fontSize: 11 }}>Powered by FitAdapt</Text> : null}
    </View>
  </View>;
}
