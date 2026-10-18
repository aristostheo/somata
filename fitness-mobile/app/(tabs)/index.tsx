import { Action, Card, fmt, GlowPanel, LinkRow, Metric, Page, Section, SegmentedProgress } from "@/components/designPreview/UI";
import { usePreviewAccount } from "@/components/designPreview/usePreviewAccount";
import { useSomataTheme } from "@/components/somata/theme";
import { addStepsForDate, setStepsForDate } from "@/services/profile";
import { kgToLb } from "@/utils/units";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

export default function DesignHome() {
  const { D, F } = useSomataTheme();

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
      headerAction={<Pressable accessibilityRole="button" accessibilityLabel="Open alerts"
        onPress={() => router.push("/(tabs)/notifications")}
        style={{
          width: 45, height: 45, borderRadius: 23, backgroundColor: D.card,
          alignItems: "center", justifyContent: "center"
        }}>

        <Ionicons name="notifications-outline" size={20} color={D.lime} />

      </Pressable>}>

      <GlowPanel>

        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>

          <View style={{ flex: 1, gap: 4 }}>

            <Text style={{ color: D.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>{data.plan.title.toUpperCase()}</Text>

            <Text style={{ color: D.text, fontSize: 25, fontWeight: "800" }}>Today, in motion</Text>

          </View>

          <Text style={{ color: D.text, fontSize: 39, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {ratio == null ? "—" : `${Math.round(Math.min(1, ratio) * 100)}%`}
          </Text>

        </View>

        <SegmentedProgress ratio={ratio} label="Logged energy against your current daily target" />

        <Text style={{ color: D.text, fontSize: 16, fontWeight: "800" }}>
          {fmt(energy)} logged <Text style={{ color: D.muted, fontSize: 14, fontWeight: "500" }}> / {fmt(target?.calories, " kcal")} target</Text>
        </Text>

        {data.plan.kind === "active" && <Text style={{ color: D.lime, fontSize: 11, fontWeight: "700" }}>Powered by FitAdapt</Text>}

        {!!data.planState?.pending && <Action label="Pending FitAdapt review" icon="sparkles-outline"
          onPress={() => router.push("/(tabs)/profile")} />}

      </GlowPanel>

      <Section title="At a glance" caption="Only account records appear here" />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        <Metric label="Steps today" value={fmt(data.steps)} detail={data.stepGoal ? `${fmt(data.stepGoal)} goal` : "Recorded steps"} />

        <Metric label="Latest weight" value={weightText} detail="Dated measurement" tone="lime" />

      </View>

      <Card>

        <Section title="Nutrition pulse" action={<Pressable onPress={() => router.push("/(tabs)/nutrition")}
          accessibilityRole="button">
          <Text style={{ color: D.lime, fontSize: 13, fontWeight: "700" }}>Open →</Text>
        </Pressable>} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

          <Metric label="Protein" value={fmt(data.logged?.protein, " g")} tone="lime" />

          <Metric label="Carbs" value={fmt(data.logged?.carbs, " g")} tone="plain" />

          <Metric label="Fat" value={fmt(data.logged?.fat, " g")} tone="plain" />

        </View>

        <Text style={{ color: D.muted, fontSize: 11 }}>Logged amounts are not a full-day estimate.</Text>

      </Card>

      <Card accent>

        <Section title="A useful next step" caption="Based on the records available today" />

        <Text style={{ color: D.text, fontSize: 17, fontWeight: "800" }}>{nextMove.title}</Text>

        <Text style={{ color: D.muted, fontSize: 12, lineHeight: 18 }}>{nextMove.detail}</Text>

        <Action label={nextMove.label} icon="arrow-forward" onPress={() => router.push(nextMove.route as never)} />

      </Card>

      <Section title="Quick actions" />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        <Action label="Log food" icon="add" bright onPress={() => router.push(`/(modals)/add-meal?date=${data.today}` as never)} />

        <Action label="Scan food" icon="scan-outline" onPress={() => router.push(`/(modals)/scan-meal?date=${data.today}` as never)} />

        <Action label="Add steps" icon="footsteps-outline" onPress={() => openSteps("add")} />

        <Action label="Set steps" icon="create-outline" onPress={() => openSteps("set")} />

        <Action label="Start workout" icon="barbell-outline" onPress={() => router.push("/workouts/session?freshStart=1" as never)} />

        <Action label="Log activity" icon="bicycle-outline" onPress={() => router.push("/(tabs)/workouts?activity=1" as never)} />

        <Action label="Quick workout" icon="flash-outline" onPress={() => router.push("/(modals)/quick-workout")} />

        <Action label="Water log" icon="water-outline" onPress={() => router.push("/(modals)/quick-hydration")} />

      </View>

      <Card>

        <Section title="Explore" />

        <LinkRow title="Calendar" icon="calendar-outline" onPress={() => router.push("/(modals)/full-calendar")} />

        <LinkRow title="Insights & history" icon="analytics-outline" onPress={() => router.push("/profile/fitadapt-insights")} />

        <LinkRow title="Connections" icon="heart-outline" onPress={() => router.push("/profile/integrations")} />

        <LinkRow title="Badges" icon="ribbon-outline" onPress={() => router.push("/(modals)/badges")} />

      </Card>

    </Page>
    <Modal visible={stepsOpen} transparent animationType="slide" onRequestClose={() => setStepsOpen(false)}>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" }}>

        <View style={{
          backgroundColor: D.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 22, gap: 15
        }}>

          <Section title={stepsMode === "set" ? "Set today's steps" : "Add to today's steps"} />

          <Text style={{ color: D.muted, fontSize: 13 }}>Saved to your account for {data.today}.</Text>

          <TextInput keyboardType="number-pad" value={stepsText} onChangeText={setStepsText}
            placeholder="Step count" placeholderTextColor={D.dim} accessibilityLabel="Step count"
            style={{
              minHeight: 54, borderRadius: 14, backgroundColor: D.raised, paddingHorizontal: 15,
              color: D.text, fontSize: 20
            }} />

          <Action label={saving ? "Saving…" : "Save steps"} icon="checkmark" bright onPress={saveSteps} />

          <Action label="Cancel" icon="close" onPress={() => setStepsOpen(false)} />

        </View>

      </KeyboardAvoidingView>

    </Modal>
  </>;
}
