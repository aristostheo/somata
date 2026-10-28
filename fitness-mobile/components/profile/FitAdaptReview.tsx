import React from "react";
import { Pressable, Text, View } from "react-native";
import { FitAdaptSymbol, PoweredByFitAdapt } from "@/components/brand/Brand";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { Profile } from "@/services/profile";
import type { FitAdaptPlanState } from "@/services/fitadapt";
import { useFitAdaptReviewState } from "@/hooks/useFitAdaptReviewState";
import { withAlpha } from "@/lib/color";
import type { VisualTokens } from "@/components/accountSettings/visualTokens";

function ValueRow({ label, current, proposed, hidden, color }: { label: string; current?: number;
  proposed: number; hidden: boolean; color: string }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingVertical: 7 }}>
    <Text style={{ color, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], flexShrink: 1 }}>
      {hidden ? "•••" : `${current == null ? "" : `${Math.round(current).toLocaleString()} → `}${Math.round(proposed).toLocaleString()}${label === "Energy" ? " kcal" : " g"}`}
    </Text>
  </View>;
}

export function FitAdaptReview({ uid, profile, hidden, palette, onStateChange, onLoadStateChange }: { uid?: string; profile: Profile | null;
  hidden: boolean; palette: VisualTokens; onStateChange?: (state: FitAdaptPlanState | null) => void;
  onLoadStateChange?: (status: "loading" | "ready" | "error") => void }) {
  const router = useRouter();
  const { busy, note, hasLiveResult, loadFailed, run, pending, current, comparison, activeSynced } =
    useFitAdaptReviewState({ uid, profile, onStateChange, onLoadStateChange });

  return <View style={{ gap: 13, marginTop: 14 }}>
    {pending ? <LinearGradient colors={[withAlpha(palette.accent, palette.dark ? 0.34 : 0.16), palette.card]}
      style={{ borderRadius: 23, padding: 18, borderWidth: 1, borderColor: withAlpha(palette.accent, 0.36), gap: 11 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <FitAdaptSymbol size="small" />
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 19, fontWeight: "700" }}>Pending review</Text>
      </View>
      <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 19 }}>Suggested from your saved profile and any available account-scoped dated records. Your current targets stay in place until you accept.</Text>
      {profile ? <View style={{ borderTopWidth: 1, borderColor: palette.border, paddingTop: 4 }}>
        <ValueRow label="Energy" current={comparison.calories} proposed={pending.targets.calories} hidden={hidden} color={palette.text} />
        <ValueRow label="Protein" current={comparison.protein} proposed={pending.targets.protein} hidden={hidden} color={palette.text} />
        <ValueRow label="Carbs" current={comparison.carbs} proposed={pending.targets.carbs} hidden={hidden} color={palette.text} />
        <ValueRow label="Fat" current={comparison.fat} proposed={pending.targets.fat} hidden={hidden} color={palette.text} />
      </View> : <Text style={{ color: palette.secondary, fontSize: 13 }}>Current goals are unavailable. The comparison and acceptance will be available when your profile loads.</Text>}
      <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
        <Pressable accessibilityRole="button" disabled={busy || !profile} onPress={() => void run("accept")}
          style={{ minHeight: 46, justifyContent: "center", paddingHorizontal: 16, borderRadius: 14, backgroundColor: palette.primary, opacity: busy || !profile ? 0.5 : 1 }}>
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
        <FitAdaptSymbol size="small" />
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 16 }}>FitAdapt review</Text>
      </View>
      <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 19 }}>When you request a review or your saved fitness data changes, Somata uses your age, height, weight, sex used for the energy equation, activity and goal settings, plus account-scoped dated weight, step and nutrition records. Your name, email and photo are excluded. Your current targets stay active until you accept a proposal.</Text>
      {note ? <Text accessibilityRole="alert" style={{ color: palette.text, fontSize: 13, lineHeight: 19 }}>{note}</Text> : null}
      {note?.startsWith("Complete your saved") ? <Pressable accessibilityRole="button" onPress={() => router.push("/fitadapt-setup")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Complete FitAdapt inputs →</Text></Pressable> : null}
      {note?.startsWith("More dated weight") ? <Pressable accessibilityRole="button" onPress={() => router.push("/(modals)/body-metrics")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Record a weight →</Text></Pressable> : null}
      {note?.startsWith("More dated weight") ? <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/nutrition")}
        style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: palette.primary, fontWeight: "700" }}>Log nutrition →</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={busy || !uid} onPress={() => void run(loadFailed ? "refresh" : "evaluate")}
        style={{ minHeight: 46, borderRadius: 14, backgroundColor: palette.primaryTint, alignItems: "center", justifyContent: "center", opacity: busy || !uid ? 0.5 : 1 }}>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>{busy ? "Working…" : loadFailed ? "Retry plan status" : pending ? "Request a fresh review" : "Review my plan"}</Text>
      </Pressable>
      {(hasLiveResult || pending || current) ? <PoweredByFitAdapt background={palette.dark ? "dark" : "light"} /> : null}
    </View>
  </View>;
}
