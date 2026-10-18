import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import type { Href } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";

import type { PreviewLogged, PreviewPlan } from "@/services/dashboardPreviewData";
import { measuredTrendPath, type RecordedDay } from "@/services/profile/fitadaptInsightData";
import { kgToLb } from "@/utils/units";

const C = {
  bg: "#080909", card: "#1B1D1D", cardHigh: "#222525", cardLow: "#111313",
  text: "#F7F8F5", muted: "#A7AEAA", dim: "#737B76", track: "#303332",
  teal: "#48BDAA", lime: "#D5EF75", ink: "#0A1411", edge: "#333836",
};
type Screen = "home" | "overview" | "goals";
type Icon = keyof typeof Ionicons.glyphMap;

export type PreviewVisualData = {
  name: string;
  photo?: string | null;
  dateLabel: string;
  plan: PreviewPlan;
  pending: boolean;
  logged: PreviewLogged | null;
  nutritionState: "loading" | "error" | "ready";
  steps: number | null;
  stepGoal?: number;
  stepsWeek: RecordedDay[];
  profileState: "loading" | "unavailable" | "ready";
  weightDays: RecordedDay[];
  weightState: "loading" | "unavailable" | "ready";
  weightUnit: "kg" | "lb";
  compact: boolean;
  fontScale: number;
  bottomInset: number;
  open: (href: Href) => void;
  exit: () => void;
};

function number(value: number) { return Math.round(value).toLocaleString(); }
function progress(value: number | null | undefined, target: number | null | undefined) {
  return value != null && target != null && target > 0 ? Math.min(1, Math.max(0, value / target)) : null;
}
function blend(left: string, right: string, part: number) {
  const l = left.slice(1).match(/../g)!.map((value) => parseInt(value, 16));
  const r = right.slice(1).match(/../g)!.map((value) => parseInt(value, 16));
  return "#" + l.map((value, index) => Math.round(value + (r[index] - value) * part)
    .toString(16).padStart(2, "0")).join("");
}
function card(children: React.ReactNode, extra?: object) {
  return <View style={{ backgroundColor: C.card, borderRadius: 17, padding: 17, gap: 12, ...extra }}>{children}</View>;
}
function SmallLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: C.muted, fontSize: 12, fontWeight: "600" }}>{children}</Text>;
}
function Segments({ value, tall = false }: { value: number | null; tall?: boolean }) {
  const count = 25;
  const filled = value == null ? 0 : Math.round(value * count);
  return <View accessibilityElementsHidden style={{ flexDirection: "row", gap: tall ? 3 : 2,
    height: tall ? 51 : 33, overflow: "hidden", borderRadius: 10 }}>
    {Array.from({ length: count }, (_, index) => <View key={index}
      style={{ flex: 1, height: "100%", borderRadius: 2, transform: [{ skewX: "-11deg" }],
        backgroundColor: index < filled ? blend(C.teal, C.lime, index / (count - 1)) : C.track }} />)}
  </View>;
}
function MiniRing({ value, color = C.lime }: { value: number | null; color?: string }) {
  const circumference = 2 * Math.PI * 21;
  return <Svg width={56} height={56} viewBox="0 0 56 56" accessibilityElementsHidden>
    <Circle cx={28} cy={28} r={21} fill="none" stroke={C.track} strokeWidth={5} />
    {value != null && <Circle cx={28} cy={28} r={21} fill="none" stroke={color} strokeWidth={5}
      strokeLinecap="round" strokeDasharray={String(value * circumference) + " " + String(circumference)}
      transform="rotate(-90 28 28)" />}
  </Svg>;
}
function ArcGauge({ value }: { value: number | null }) {
  const total = 21;
  const lit = value == null ? 0 : Math.round(value * total);
  return <View style={{ height: 145, alignItems: "center", justifyContent: "flex-end" }}>
    <Svg width="100%" height={138} viewBox="0 0 300 138" accessibilityElementsHidden>
      {Array.from({ length: total }, (_, index) => {
        const angle = Math.PI - (index / (total - 1)) * Math.PI;
        const x1 = 150 + 83 * Math.cos(angle);
        const y1 = 125 - 83 * Math.sin(angle);
        const x2 = 150 + 111 * Math.cos(angle);
        const y2 = 125 - 111 * Math.sin(angle);
        const stroke = index < lit ? blend(C.teal, C.lime, index / (total - 1)) : C.track;
        return <Path key={index}
          d={"M " + x1.toFixed(1) + " " + y1.toFixed(1) + " L " + x2.toFixed(1) + " " + y2.toFixed(1)}
          stroke={stroke} strokeWidth={10} strokeLinecap="round" />;
      })}
    </Svg>
    <View style={{ position: "absolute", bottom: 3, alignItems: "center", gap: 1 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>Energy logged</Text>
      <Text style={{ color: C.text, fontSize: 33, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {value == null ? "—" : String(Math.round(value * 100)) + "%"}
      </Text>
    </View>
  </View>;
}
function StepBars({ rows, light = false }: { rows: RecordedDay[]; light?: boolean }) {
  if (!rows.length) return <Text style={{ color: light ? C.ink : C.muted,
    fontSize: 12, fontWeight: "600" }}>No dated steps yet</Text>;
  const recent = rows.slice(-7);
  const ceiling = Math.max(...recent.map((row) => row.value), 1);
  return <View accessibilityLabel={"Recorded steps on " + recent.length + " days"}
    style={{ height: 52, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
    {recent.map((row, index) => <View key={row.date} style={{ flex: 1, height: Math.max(4, row.value / ceiling * 50),
      borderRadius: 3, backgroundColor: index === recent.length - 1 ? C.lime :
        light ? "#B8F5DB" : C.teal }} />)}
  </View>;
}
function WeightLine({ rows, height = 48 }: { rows: RecordedDay[]; height?: number }) {
  const path = measuredTrendPath(rows, 300, 70);
  return path ? <Svg width="100%" height={height} viewBox="0 0 300 70"
    accessibilityLabel={"Measured weight trend across " + rows.length + " recorded days"}>
    <Path d={path} fill="none" stroke={C.lime} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg> : <SmallLabel>Two dated weights needed for a trend</SmallLabel>;
}
function PressLink({ title, icon, onPress }: { title: string; icon: Icon; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 46, borderRadius: 14, paddingHorizontal: 14,
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.cardHigh,
      opacity: pressed ? 0.65 : 1 })}>
    <Ionicons name={icon} size={18} color={C.lime} />
    <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{title}</Text>
  </Pressable>;
}
function SectionHead({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
    <Text accessibilityRole="header" style={{ color: C.text, fontSize: 22, fontWeight: "700" }}>{title}</Text>
    {action && onPress && <Pressable accessibilityRole="button" onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: C.teal,
        fontSize: 13, fontWeight: "700" }}>{action}</Text></Pressable>}
  </View>;
}

export function ReferenceDashboard(props: PreviewVisualData) {
  const [screen, setScreen] = useState<Screen>("home");
  const target = props.plan.targets;
  const energy = props.logged?.calories ?? null;
  const energyPct = progress(energy, target?.calories);
  const stepsPct = progress(props.steps, props.stepGoal);
  const latestWeight = props.weightDays.at(-1);
  const weightValue = (kg: number) => props.weightUnit === "lb" ? kgToLb(kg) : kg;
  const weightText = latestWeight == null ? "—" :
    weightValue(latestWeight.value).toFixed(1) + " " + props.weightUnit;
  const energyText = props.nutritionState === "loading" ? "Loading…" :
    props.nutritionState === "error" ? "Unavailable" : energy == null ? "No complete log" :
      number(energy) + (target?.calories === undefined ? "" : "/" + number(target.calories));
  const pctText = energyPct == null ? "—" : String(Math.round(energyPct * 100)) + "%";
  const hasMeals = (props.logged?.entries ?? 0) > 0;
  const macro = (key: "protein" | "carbs" | "fat") => {
    const logged = props.logged?.[key] ?? null;
    const goal = target?.[key];
    return logged == null ? "—" : number(logged) + (goal === undefined ? " g" : "/" + number(goal) + " g");
  };
  const status = (logged: number | null | undefined, goal: number | undefined) => {
    if (logged == null) return "No record";
    if (goal === undefined || goal <= 0) return "Logged";
    return logged >= goal ? "Target met" : "In progress";
  };
  const choose = (next: Screen) => setScreen(next);
  const back = () => screen === "home" ? props.exit() : choose("home");

  const header = screen === "home" ? <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open current Profile"
        onPress={() => props.open("/(tabs)/profile")} style={{ minHeight: 46, justifyContent: "center" }}>
        {props.photo ? <Image source={{ uri: props.photo }} style={{ width: 45, height: 45, borderRadius: 23 }} /> :
          <View style={{ width: 45, height: 45, borderRadius: 23, backgroundColor: C.teal,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.ink, fontSize: 20, fontWeight: "800" }}>{props.name.charAt(0).toUpperCase()}</Text>
          </View>}
      </Pressable>
      <View style={{ flexDirection: "row", gap: 9 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="FitAdapt insights and history"
          onPress={() => props.open("/profile/fitadapt-insights")} style={{ width: 45, height: 45,
            borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="sparkles" size={21} color={C.lime} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications"
          onPress={() => props.open("/(tabs)/notifications")} style={{ width: 45, height: 45,
            borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="notifications-outline" size={20} color={C.text} />
        </Pressable>
      </View>
    </View>
    <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1.7 }}>DESIGN PREVIEW  ·  {props.dateLabel.toUpperCase()}</Text>
  </View> : <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to preview dashboard" onPress={back}
      style={{ width: 45, height: 45, borderRadius: 23, backgroundColor: C.card,
        alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="chevron-back" size={22} color={C.text} />
    </Pressable>
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: 21, fontWeight: "700" }}>
        {screen === "overview" ? "Overview" : "Goal Tracker"}
      </Text>
      <Text style={{ color: C.dim, fontSize: 10, letterSpacing: 1.5 }}>DESIGN PREVIEW</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Calendar"
      onPress={() => props.open("/(modals)/full-calendar")} style={{ width: 45, height: 45,
        borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="calendar-outline" size={20} color={C.text} />
    </Pressable>
  </View>;

  const home = <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: C.muted, fontSize: 17 }}>Your plan is</Text>
        <Text accessibilityRole="header" style={{ color: C.text, fontSize: props.fontScale >= 1.5 ? 25 : 29,
          fontWeight: "700" }}>{props.plan.kind === "active" ? "in motion" : props.plan.kind === "goals" ?
          "ready to track" : "coming into focus"}</Text>
      </View>
      <Text style={{ color: C.text, fontSize: props.fontScale >= 1.5 ? 37 : 48,
        fontWeight: "800", fontVariant: ["tabular-nums"] }}>{pctText}</Text>
    </View>
    <Segments value={energyPct} tall />
    <Text style={{ color: C.muted, fontSize: 12, lineHeight: 17 }}>
      {energyPct == null ? "Log energy and set a target to see today's progress." :
        "Today's logged energy against " + props.plan.title.toLowerCase() + "."}
    </Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Nutrition"
      onPress={() => props.open("/(tabs)/nutrition")} style={{ marginTop: 6 }}>
      {card(<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ gap: 5, flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{energyText}</Text>
          <SmallLabel>Calories logged today{target?.calories === undefined ? "" : " / current target"}</SmallLabel>
        </View>
        <MiniRing value={energyPct} />
      </View>)}
    </Pressable>
    <View style={{ flexDirection: props.compact ? "column" : "row", gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open steps history" onPress={() => props.open("/profile/steps-history")}
        style={{ flex: 1 }}>
        <LinearGradient colors={[C.teal, "#258E80"]} style={{ minHeight: 165, borderRadius: 17,
          padding: 16, justifyContent: "space-between" }}>
          <Text style={{ color: C.ink, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {props.profileState === "loading" ? "Loading…" : props.steps == null ? "—" : number(props.steps)}
          </Text>
          <Text style={{ color: "#D7FBF1", fontSize: 13 }}>Steps today{props.stepGoal ? " / " + number(props.stepGoal) : ""}</Text>
          <StepBars rows={props.stepsWeek} light />
        </LinearGradient>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open body measurements"
        onPress={() => props.open("/(modals)/body-metrics")} style={{ flex: 1 }}>
        {card(<>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>{props.weightState === "loading" ? "Loading…" : weightText}</Text>
          <SmallLabel>Latest dated weight · 30 days</SmallLabel>
          <WeightLine rows={props.weightDays} />
        </>, { minHeight: 165, justifyContent: "space-between" })}
      </Pressable>
    </View>
    {card(<>
      <SectionHead title="Nutrition today" action="View" onPress={() => choose("overview")} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        {(["protein", "carbs", "fat"] as const).map((key, index) =>
          <View key={key} style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
            <Text style={{ color: [C.teal, C.lime, C.text][index], fontSize: 16, fontWeight: "800",
              fontVariant: ["tabular-nums"] }}>{macro(key)}</Text>
          </View>)}
      </View>
      <SmallLabel>{hasMeals ? "Logged amounts, not a verified full-day intake." : "No meals logged today yet."}</SmallLabel>
    </>)}
    {props.pending && <PressLink title="Pending FitAdapt review" icon="sparkles-outline"
      onPress={() => props.open("/(tabs)/profile")} />}
  </View>;

  const overviewCard = (title: string, value: string, detail: string, visual: React.ReactNode) =>
    card(<><Text style={{ color: C.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <SmallLabel>{title}</SmallLabel><View style={{ flex: 1, justifyContent: "flex-end" }}>{visual}</View>
      <Text style={{ color: C.dim, fontSize: 10 }}>{detail}</Text></>,
    { flex: 1, minHeight: 160 });
  const overview = <View style={{ gap: 12 }}>
    <View style={{ flexDirection: props.compact ? "column" : "row", gap: 10 }}>
      {overviewCard("Steps today", props.steps == null ? "—" : number(props.steps),
        props.stepGoal ? "Saved goal " + number(props.stepGoal) : "No saved step goal",
        <StepBars rows={props.stepsWeek} />)}
      {overviewCard("Energy logged", energy == null ? "—" : number(energy) + " kcal",
        target?.calories === undefined ? "No saved energy target" : number(target.calories) + " kcal current target",
        <Segments value={energyPct} />)}
    </View>
    <View style={{ flexDirection: props.compact ? "column" : "row", gap: 10 }}>
      {overviewCard("Dated weight", weightText, "Recorded measurements only",
        <WeightLine rows={props.weightDays} />)}
      {overviewCard("Protein logged", props.logged?.protein == null ? "—" : number(props.logged.protein) + " g",
        target?.protein === undefined ? "No saved protein target" : number(target.protein) + " g current target",
        <Segments value={progress(props.logged?.protein, target?.protein)} />)}
    </View>
    {card(<>
      <SectionHead title="Nutrition Overview" action="Nutrition" onPress={() => props.open("/(tabs)/nutrition")} />
      <ArcGauge value={energyPct} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        {(["carbs", "calories", "protein"] as const).map((key) => <View key={key} style={{ flex: 1, gap: 4 }}>
          <SmallLabel>{key === "carbs" ? "Carbs" : key === "calories" ? "Energy" : "Protein"}</SmallLabel>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {props.logged?.[key] == null ? "—" : number(props.logged[key])}
            <Text style={{ color: C.muted, fontSize: 10 }}>{key === "calories" ? " kcal" : " g"}</Text>
          </Text>
        </View>)}
      </View>
      <SmallLabel>Only logged food appears; missing values stay unknown.</SmallLabel>
    </>)}
    <PressLink title="FitAdapt insights & history" icon="analytics-outline"
      onPress={() => props.open("/profile/fitadapt-insights")} />
  </View>;

  const goalRow = (label: string, logged: number | null | undefined, goal: number | undefined, unit: string) => {
    const state = status(logged, goal);
    const tone = state === "Target met" ? C.lime : state === "In progress" ? C.teal : C.muted;
    return <View key={label} style={{ backgroundColor: C.cardLow, borderRadius: 14, padding: 14,
      flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 7 }}>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: "700", minWidth: 65 }}>{label}</Text>
      <Text style={{ color: C.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
        {logged == null ? "—" : number(logged)} / {goal === undefined ? "—" : number(goal)} {unit}
      </Text>
      <View style={{ backgroundColor: C.cardHigh, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>{state}</Text>
      </View>
    </View>;
  };
  const goals = <View style={{ gap: 13 }}>
    <View style={{ paddingTop: 13, gap: 11 }}>
      <Text style={{ color: C.muted, fontSize: 13 }}>Today's logged energy against your current target</Text>
      <Segments value={energyPct} tall />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <SmallLabel>0%</SmallLabel>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: "800" }}>{pctText} logged</Text>
        <SmallLabel>100%</SmallLabel>
      </View>
    </View>
    <View style={{ flexDirection: props.compact ? "column" : "row", gap: 10, marginTop: 12 }}>
      {card(<><Text style={{ color: C.text, fontSize: 25, fontWeight: "800" }}>{energy == null ? "—" : number(energy)}</Text>
        <SmallLabel>kcal logged today</SmallLabel><MiniRing value={energyPct} /></>, { flex: 1, minHeight: 134 })}
      {card(<><Text style={{ color: C.text, fontSize: 25, fontWeight: "800" }}>{props.steps == null ? "—" : number(props.steps)}</Text>
        <SmallLabel>steps recorded today</SmallLabel><Segments value={stepsPct} /></>, { flex: 1, minHeight: 134 })}
    </View>
    {card(<>
      <SectionHead title="Goals Overview" action="Edit goals" onPress={() => props.open("/profile/goal-setup")} />
      <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18 }}>
        Daily logs are compared with {props.plan.kind === "active" ? "your accepted FitAdapt plan" :
          props.plan.kind === "goals" ? "your saved goals" : "available account targets"}.
      </Text>
      {goalRow("Energy", energy, target?.calories, "kcal")}
      {goalRow("Protein", props.logged?.protein, target?.protein, "g")}
      {goalRow("Carbs", props.logged?.carbs, target?.carbs, "g")}
      {goalRow("Fat", props.logged?.fat, target?.fat, "g")}
      {goalRow("Steps", props.steps, props.stepGoal, "steps")}
    </>)}
    {card(<>
      <Text style={{ color: C.text, fontSize: 17, fontWeight: "700" }}>{props.plan.title}</Text>
      <SmallLabel>{props.plan.detail}</SmallLabel>
      {props.pending && <Text style={{ color: C.lime, fontSize: 13, fontWeight: "700" }}>
        Pending review · current targets have not changed
      </Text>}
      <PressLink title={props.pending ? "Review proposal in Profile" : "Open Profile & plan"}
        icon="arrow-forward" onPress={() => props.open("/(tabs)/profile")} />
    </>)}
  </View>;

  const navigation: Array<{ key: Screen | "exit"; label: string; icon: Icon }> = [
    { key: "home", label: "Home", icon: "home" },
    { key: "overview", label: "Overview", icon: "grid-outline" },
    { key: "goals", label: "Goals", icon: "flag-outline" },
    { key: "exit", label: "Current app", icon: "exit-outline" },
  ];
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <StatusBar style="light" />
    <ScrollView key={screen} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 15,
        paddingBottom: 112 + props.bottomInset, gap: 22 }}>
      {header}
      {screen === "home" ? home : screen === "overview" ? overview : goals}
      <Text style={{ color: C.dim, fontSize: 11, lineHeight: 17, textAlign: "center" }}>
        Design preview · Recorded account data only · Current app remains unchanged
      </Text>
    </ScrollView>
    <View style={{ position: "absolute", left: 17, right: 17, bottom: Math.max(10, props.bottomInset),
      backgroundColor: "#111313", borderRadius: 28, borderWidth: 1, borderColor: C.edge,
      paddingHorizontal: 5, paddingVertical: 7, flexDirection: "row" }}>
      {navigation.map((item) => <Pressable key={item.key} accessibilityRole="button"
        accessibilityLabel={item.key === "exit" ? "Return to current app" : "Preview " + item.label}
        accessibilityState={{ selected: screen === item.key }}
        onPress={() => item.key === "exit" ? props.exit() : choose(item.key)}
        style={{ flex: 1, minHeight: 51, alignItems: "center", justifyContent: "center", gap: 3,
          borderRadius: 20, backgroundColor: screen === item.key ? C.cardHigh : "transparent" }}>
        <Ionicons name={item.icon} size={19} color={screen === item.key ? C.lime : C.muted} />
        <Text style={{ color: screen === item.key ? C.text : C.muted,
          fontSize: props.fontScale >= 1.5 ? 9 : 10, fontWeight: "700" }}>{item.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
