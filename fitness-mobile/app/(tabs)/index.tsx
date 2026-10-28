import { Button as TaskButton, Field, Panel, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { PoweredByFitAdapt } from "@/components/brand/Brand";
import { fmt, SegmentedProgress } from "@/components/designPreview/UI";
import { Action, ActionGrid, Bell, Card, LinkRow, Macro, Metric, Page, Recommendation, Section } from "@/components/home/PremiumHomeUI";
import { usePreviewAccount } from "@/components/designPreview/usePreviewAccount";
import { SomataHomeAppearance, usePresentation } from "@/components/designPreview/Appearance";
import { addStepsForDate, setStepsForDate } from "@/services/profile";
import { kgToLb } from "@/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

export default function DesignHome() {
  return <SomataHomeAppearance><HomeContent /></SomataHomeAppearance>;
}

function HomeContent() {
  const { D, semantic: t } = usePresentation();
  const [stepFieldFocused, setStepFieldFocused] = useState(false);

  const router = useRouter();
  const data = usePreviewAccount();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [stepsMode, setStepsMode] = useState<"add" | "set">("add");
  const [stepsText, setStepsText] = useState("");
  const [saving, setSaving] = useState(false);
  const target = data.plan.targets;
  const energy = data.logged?.calories ?? null;
  const ratio = energy != null && target?.calories && target.calories > 0 ? energy / target.calories : null;
  const weight = data.weightDays.at(-1)?.value;
  const weightUnit = data.profile?.weightUnit === "lb" ? "lb" : "kg";
  const weightText = weight == null ? "—" : (weightUnit === "lb" ? kgToLb(weight) : weight).toFixed(1) + ` ${weightUnit}`;
  const nextMove = data.planState?.pending ? {
    title: "A plan is ready to review",
    detail: "Your current targets stay in place until you decide.", label: "Review proposal",
    route: "/(tabs)/profile"
  } : data.logged?.entries === 0 ? {
    title: "Begin today's food record", detail: "A meal log gives this dashboard real progress to show.",
    label: "Log food", route: `/(modals)/add-meal?date=${data.today}`,
  } : data.stepGoal && data.steps != null && data.steps < data.stepGoal ? {
    title: "See your steps in context", detail: `${fmt(data.steps)} of ${fmt(data.stepGoal)} recorded today.`,
    label: "Steps history", route: "/profile/steps-history",
  } : {
    title: "Explore your recorded progress", detail: "Trends appear when you have enough dated records.",
    label: "Open insights", route: "/profile/fitadapt-insights"
  };
  const openSteps = (mode: "add" | "set") => { setStepsMode(mode); setStepsText(""); setStepsOpen(true); };
  const saveSteps = async () => {
    const amount = Number(stepsText);
    if (!data.uid || !stepsText.trim() || !Number.isInteger(amount) || amount < 0 || amount > 200000) {
      Alert.alert("Enter a valid step count", "Use a whole number from 0 to 200,000."); return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (stepsMode === "set") await setStepsForDate(data.uid, data.today, amount);
      else await addStepsForDate(data.uid, data.today, amount);
      setStepsOpen(false);
    } catch { Alert.alert("Steps could not be saved", "Please try again."); }
    finally { setSaving(false); }
  };
  return <>
    <Page eyebrow="Today / Somata" title={`Hello, ${data.profile?.displayName?.trim()?.split(" ")[0] || data.user?.displayName?.trim()?.split(" ")[0] || "you"}`}
      subtitle="A clear view of what you recorded today."
      headerAction={<Bell onPress={() => router.push("/(tabs)/notifications")} />}>

      <Card hero>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.action.link, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 }}>{data.plan.title.toUpperCase()}</Text>
            <Text style={{ color: D.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.7 }}>Today, in motion</Text>
          </View>
          <View style={{ width: 38, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: t.selection.background }}>
            <Ionicons name="flame" size={26} color={t.action.link} />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, rowGap: 2 }}>
          <Text style={{ color: D.text, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{fmt(energy)}</Text>
          <Text style={{ color: D.muted, fontSize: 14 }}>/ {fmt(target?.calories, " kcal")} target</Text>
          {ratio != null && <Text style={{ color: D.muted, fontSize: 12 }}>
            {`${Math.round(Math.min(1, ratio) * 100)}%`}
          </Text>}
        </View>
        <SegmentedProgress compact ratio={ratio} label={ratio == null ? "Progress unavailable · Logged energy against your current daily target" : "Logged energy against your current daily target"} />

        {data.plan.kind === "active" && <PoweredByFitAdapt />}

        {!!data.planState?.pending && <Action label="Pending FitAdapt review" icon="sparkles-outline"
          onPress={() => router.push("/(tabs)/profile")} />}

      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.md }}>

        <Metric icon="footsteps-outline" label="Steps today" value={fmt(data.steps)} detail={data.stepGoal ? `${fmt(data.stepGoal)} goal` : "Recorded steps"} />

        <Metric icon="scale-outline" label="Latest weight" value={weightText} detail="Dated measurement" />

      </View>

      <Card>

        <Section title="Nutrition pulse" caption="Logged amounts are not a full-day estimate." action={<Pressable onPress={() => router.push("/(tabs)/nutrition")}
          accessibilityRole="button" accessibilityLabel="Open Nutrition" hitSlop={{ top: 8, bottom: 8 }} style={{ minHeight: 32, minWidth: t.layout.minTouchTarget, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: D.lime, fontSize: 13, fontWeight: "700" }}>Open →</Text>
        </Pressable>} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.sm }}>

          <Macro icon="barbell-outline" label="Protein" value={fmt(data.logged?.protein, " g")} series="protein" />

          <Macro icon="leaf-outline" label="Carbs" value={fmt(data.logged?.carbs, " g")} series="carbohydrate" />

          <Macro icon="water-outline" label="Fat" value={fmt(data.logged?.fat, " g")} series="fat" />

        </View>


      </Card>

      <Recommendation title={nextMove.title} detail={nextMove.detail} label={nextMove.label}
        onPress={() => router.push(nextMove.route as never)} />

      <Section title="Quick actions" />

      <ActionGrid>

        <Action label="Log food" icon="add" bright onPress={() => router.push(`/(modals)/add-meal?date=${data.today}` as never)} />

        <Action label="Scan food" icon="scan-outline" onPress={() => router.push(`/(modals)/scan-meal?date=${data.today}` as never)} />

        <Action label="Add steps" icon="footsteps-outline" onPress={() => openSteps("add")} />

        <Action label="Set steps" icon="create-outline" onPress={() => openSteps("set")} />

        <Action label="Start workout" icon="barbell-outline" onPress={() => router.push("/workouts/session?freshStart=1" as never)} />

        <Action label="Log activity" icon="bicycle-outline" onPress={() => router.push("/(tabs)/workouts?activity=1" as never)} />

        <Action label="Quick workout" icon="flash-outline" onPress={() => router.push("/(modals)/quick-workout")} />

        <Action label="Water log" icon="water-outline" onPress={() => router.push("/(modals)/quick-hydration")} />

      </ActionGrid>

      <Card>

        <Section title="Explore" />

        <ActionGrid explore>
        <LinkRow title="Calendar" icon="calendar-outline" onPress={() => router.push("/(modals)/full-calendar")} />

        <LinkRow title="Insights & history" icon="analytics-outline" onPress={() => router.push("/profile/fitadapt-insights")} />

        <LinkRow title="Connections" icon="heart-outline" onPress={() => router.push("/profile/integrations")} />

        <LinkRow title="Badges" icon="ribbon-outline" onPress={() => router.push("/(modals)/badges")} />
        </ActionGrid>

      </Card>

    </Page>
    <SomataTaskAppearance>
      <TaskSheet visible={stepsOpen} onClose={() => setStepsOpen(false)} dismissOnBackdrop={false}
        title={stepsMode === "set" ? "Set today's steps" : "Add to today's steps"}>
        <StepsContext mode={stepsMode} recorded={data.steps} date={data.today} />
        <Field label={stepsMode === "set" ? "Today's total" : "Steps to add"} accessibilityLabel="Step count"
          keyboardType="number-pad" value={stepsText} onChangeText={setStepsText} placeholder="Step count"
          onFocus={() => setStepFieldFocused(true)} onBlur={() => setStepFieldFocused(false)} />
        <TaskButton label={saving ? "Saving…" : "Save steps"} icon="checkmark" primary disabled={saving} onPress={saveSteps} />
        <TaskButton label="Cancel" icon="close" onPress={() => setStepsOpen(false)} />
      </TaskSheet>
    </SomataTaskAppearance>
  </>;
}

/** Presentation only: the existing Home controller owns validation and writes. */
function StepsContext({ mode, recorded, date }: { mode: "add" | "set"; recorded: number | null | undefined; date: string }) {
  const { F, t } = useTaskPresentation();
  return <Panel accent>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Ionicons name="footsteps-outline" color={t.action.link} size={30} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={F.eyebrow}>RECORDED TODAY</Text>
        <Text style={F.value}>{fmt(recorded)} <Text style={F.body}>steps</Text></Text>
      </View>
    </View>
    <Text style={F.body}>{mode === "set" ? "Replace today's recorded total." : "Add this amount to today's recorded total."}</Text>
    <Text style={F.caption}>Saved to your account for {date}. Use a whole number from 0 to 200,000.</Text>
  </Panel>;
}
