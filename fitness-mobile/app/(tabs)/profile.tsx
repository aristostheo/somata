import { FitAdaptSymbol, PoweredByFitAdapt } from "@/components/brand/Brand";
import { fmt } from "@/components/designPreview/UI";
import { Action, Card, Grid, Identity, LinkRow, Metric, Note, Page, Section, VisibilityButton } from "@/components/profile/PremiumProfileUI";
import { SomataHomeAppearance as ProfileAppearance, usePresentation } from "@/components/designPreview/Appearance";
import { useHomeVisuals } from "@/components/home/PremiumHomeUI";
import { usePreviewAccount } from "@/components/designPreview/usePreviewAccount";
import { useFitAdaptReviewState } from "@/hooks/useFitAdaptReviewState";
import { measuredTrendPath } from "@/services/profile/fitadaptInsightData";
import { kgToLb } from "@/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export default function DesignProfile() {
  return <ProfileAppearance><ProfileContent /></ProfileAppearance>;
}

function ProfileContent() {
  const { D } = usePresentation();
  const { t } = useHomeVisuals();

  const router = useRouter();
  const account = usePreviewAccount();
  const [hidden, setHidden] = useState(false);
  const review = useFitAdaptReviewState({
    uid: account.uid, profile: account.profile ?? null,
    onStateChange: account.setPlanState
  });
  const target = account.plan.targets;
  const masked = (value: number | null | undefined, unit = "") => hidden ? "•••" : fmt(value, unit);
  const latestWeight = account.weightDays.at(-1)?.value;
  const weightUnit = account.profile?.weightUnit === "lb" ? "lb" : "kg";
  const weight = latestWeight == null ? null : weightUnit === "lb" ? kgToLb(latestWeight) : latestWeight;
  const trend = measuredTrendPath(account.weightDays, 300, 74);
  const name = account.profile?.displayName?.trim() || account.user?.displayName?.trim() || "Your profile";
  const photo = account.profile?.photoURL || account.user?.photoURL;
  const proposed = review.pending?.targets;
  const pendingValue = (current: number | undefined, next: number | undefined, unit: string) =>
    hidden ? "•••" : `${fmt(current, unit)}  →  ${fmt(next, unit)}`;

  return <Page eyebrow="Your space / plan" title="Profile"
    subtitle="Your plan, measured progress, and account in one place."
    headerAction={<VisibilityButton hidden={hidden} onPress={() => setHidden((value) => !value)} />}>

    <Identity name={name} email={account.user?.email || "Your account"} photo={photo}
      onPress={() => router.push("/account")} />

    <Card kind="goals">

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: t.action.link, backgroundColor: t.surface.canvas, alignSelf: "flex-start", padding: 3,
            fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>{account.plan.title.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={{ color: D.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.6 }}>Your current focus</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface.inset, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="locate-outline" size={29} color={t.action.link} />
        </View>
      </View>

      <Text style={{ color: D.muted, fontSize: 12, lineHeight: 18 }}>{account.plan.detail}</Text>

      <Grid>
        <Metric icon="flame" label="Energy" value={masked(target?.calories, " kcal")} tone="energy" />

        <Metric icon="barbell-outline" label="Protein" value={masked(target?.protein, " g")} tone="plain" />

        <Metric icon="leaf-outline" label="Carbs" value={masked(target?.carbs, " g")} tone="plain" />

        <Metric icon="water-outline" label="Fat" value={masked(target?.fat, " g")} tone="plain" />

      </Grid>

      {account.plan.kind === "active" && <PoweredByFitAdapt />}

      <Note>Editing saved goals does not replace accepted targets. A proposal changes them only after you accept it.</Note>

      <Action label="Edit saved profile & goals" icon="create-outline" onPress={() => router.push("/profile/goal-setup")} />

    </Card>

    {!!proposed && <Card accent opaque>

      <Section title="Pending review" caption="Your current targets remain in place" />

      <Text style={{ color: D.muted, fontSize: 12, lineHeight: 18 }}>
        FitAdapt suggested a change from your saved profile and account-scoped dated records.
      </Text>

      {(["calories", "protein", "carbs", "fat"] as const).map((key) => <View key={key}
        style={{
          flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
          paddingVertical: 7, borderTopWidth: 1, borderColor: D.line
        }}>

        <Text style={{ color: D.muted, fontSize: 13, textTransform: "capitalize" }}>{key === "calories" ? "Energy" : key}</Text>

        <Text style={{ color: D.text, fontSize: 13, fontWeight: "800" }}>
          {pendingValue(target?.[key], proposed[key], key === "calories" ? " kcal" : " g")}
        </Text>

      </View>)}

      <Grid>
        <Action navigation={false} label={review.busy ? "Working…" : "Accept plan"} icon="checkmark" bright
          disabled={review.busy || !account.profile}
          onPress={() => { void review.run("accept"); }} />

        <Action navigation={false} label="Decline" icon="close" disabled={review.busy}
          onPress={() => { void review.run("decline"); }} />

      </Grid>

    </Card>}

    <Card kind="fitadapt">

      <Section title="FitAdapt review" caption="Requested by you; acceptance is always explicit"
        action={<FitAdaptSymbol size={40} />} />

      <Text style={{ color: D.muted, fontSize: 12, lineHeight: 18 }}>
        A review uses required profile fields and account-scoped dated records. Your name, email, and photo are excluded.
      </Text>

      {!!review.note && <Note alert>{review.note}</Note>}

      {review.note?.startsWith("Complete your saved") && <Action label="Complete required inputs" icon="create-outline"
        onPress={() => router.push("/fitadapt-setup")} />}

      {review.note?.startsWith("More dated weight") && <Action label="Record a weight" icon="body-outline"
        onPress={() => router.push("/(modals)/body-metrics")} />}

      {review.note?.startsWith("More dated weight") && <Action label="Log nutrition" icon="nutrition-outline"
        onPress={() => router.push("/(tabs)/nutrition")} />}

      <Action label={review.busy ? "Working…" : review.loadFailed ? "Retry plan status" :
        proposed ? "Request a fresh review" : "Review my plan"} icon="sparkles-outline"
        disabled={review.busy || !account.uid}
        onPress={() => { void review.run(review.loadFailed ? "refresh" : "evaluate"); }} />

      {review.current && !review.activeSynced && <Text style={{ color: D.muted, fontSize: 12 }}>
        Accepted plan is syncing with nutrition targets.
      </Text>}

    </Card>

    <Card kind="progress">
    <Section title="Measured progress" caption="Recorded account values, with no generated trend" />

    <Grid>

      <Metric icon="footsteps-outline" tone="steps" label="Steps today" value={masked(account.steps)} detail="Account record" />

      <Metric icon="scale-outline" label="Latest weight" value={weight == null ? "—" : hidden ? "•••" : `${weight.toFixed(1)} ${weightUnit}`}
        detail="Dated measurement" tone="weight" />

    </Grid>

    <Card opaque>

      <Section title="Weight trace" caption="Recent dated measurements" />

      {hidden ? <Text style={{ color: D.muted }}>Trend hidden</Text> : trend ?
        <Svg width="100%" height={78} viewBox="0 0 300 74" accessibilityLabel="Recorded weight trend">

          <Path d={trend} fill="none" stroke={D.lime} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />

        </Svg> : <Text style={{ color: D.muted, fontSize: 12 }}>Two dated weights are needed for a trend.</Text>}

      <Action label="FitAdapt insights & history" icon="analytics-outline"
        onPress={() => router.push("/profile/fitadapt-insights")} />

    </Card>
    </Card>

    <Card>
      <Section title="Records & reflection" />

      <LinkRow title="Insights" icon="stats-chart-outline" onPress={() => router.push("/profile/insights-progress")} />

      <LinkRow title="Steps history" icon="footsteps-outline" onPress={() => router.push("/profile/steps-history")} />

      <LinkRow title="Calendar" icon="calendar-outline" onPress={() => router.push("/(modals)/full-calendar")} />

      <LinkRow title="Body measurements" icon="body-outline" onPress={() => router.push("/(modals)/body-metrics")} />

      <LinkRow title="Long-term progress" icon="trending-up-outline" onPress={() => router.push("/(modals)/long-term-progress")} />
      <LinkRow title="Advanced metrics" icon="pulse-outline" onPress={() => router.push("/profile/advanced-metrics")} />

      <LinkRow title="Weekly check-in" icon="checkbox-outline" onPress={() => router.push("/(modals)/weekly-checkin")} />

    </Card>

    <Card>
      <Section title="Your settings" />

      <LinkRow title="Account" icon="person-outline" onPress={() => router.push("/account")} />

      <LinkRow title="Settings" icon="settings-outline" onPress={() => router.push("/(modals)/settings")} />

      <LinkRow title="Theme picker" icon="color-palette-outline" onPress={() => router.push("/(modals)/theme-editor")} />

      <LinkRow title="Diet choices" icon="restaurant-outline" onPress={() => router.push("/(modals)/diet-preferences")} />

      <LinkRow title="Training days & goals" icon="barbell-outline" onPress={() => router.push("/profile/goal-setup")} />

    </Card>

    <Card>
      <Section title="Collection & connections" />
      <Grid>

      <LinkRow title="Progress photos" icon="images-outline" onPress={() => router.push("/(modals)/progress-photos")} />

      <LinkRow title="Badges" icon="ribbon-outline" onPress={() => router.push("/(modals)/badges")} />

      <LinkRow title="Friends" icon="people-outline" onPress={() => router.push("/friends")} />

      <LinkRow title="Apple Health & connections" icon="heart-outline" onPress={() => router.push("/profile/integrations")} />
      </Grid>

    </Card>

  </Page>;
}
