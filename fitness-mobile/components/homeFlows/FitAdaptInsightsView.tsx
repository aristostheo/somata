import { Button as Action, Panel } from "@/components/somata/TaskUI";
import { ProfileIntro, ProfileRecord } from "@/components/profile/ProfileTaskUI";
import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { previousAcceptedTargets, type FitAdaptHistoryEvent } from "@/services/profile/fitadaptHistoryData";
import { measuredChange, measuredTrendPath, type RecordedDay } from "@/services/profile/fitadaptInsightData";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { ChoiceRail, FlowNotice, FlowPage, SmallStat } from "./FlowUI";

export type InsightMetric = {
  id: string; title: string; icon: keyof typeof Ionicons.glyphMap; days: RecordedDay[];
  display: (value: number) => string; loading: boolean; error: boolean; context: string;
};
function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendDetail({ metric, hidden }: { metric: InsightMetric; hidden: boolean; }) {
  const { D, F } = useTaskPresentation();

  const { days, display } = metric;
  const first = days[0];
  const latest = days.at(-1);
  const path = measuredTrendPath(days, 320, 150);
  const change = measuredChange(days);
  if (metric.loading) return <FlowNotice title="Loading recorded data…" detail={metric.title} />;
  if (metric.error) return <FlowNotice title="Records unavailable" detail="Your recorded data could not be loaded right now." error />;
  if (!latest) return <FlowNotice title="A little history starts here" detail={`No ${metric.title.toLowerCase()} records in this period. Only saved measurements appear.`} />;
  return <View style={{ gap: 16 }}>

    <Panel accent>

      <Text style={{ ...F.eyebrow, color: D.lime }}>LATEST RECORDED · {dayLabel(latest.date).toUpperCase()}</Text>

      <Text style={{ ...F.value, fontSize: 38 }}>{hidden ? "•••" : display(latest.value)}</Text>

      {path && !hidden ? <Svg width="100%" height={150} viewBox="0 0 320 150"
        accessibilityLabel={`${metric.title}, recorded trend from ${dayLabel(first.date)} to ${dayLabel(latest.date)}`}>

        {[35, 75, 115].map((y) => <Line key={y} x1={7} y1={y} x2={313} y2={y} stroke={D.line} strokeDasharray="3 7" />)}

        <Path d={path} stroke={D.lime} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      </Svg> : <View style={{ minHeight: 90, justifyContent: "center" }}>

        <Text style={{ ...F.body, color: D.muted }}>{hidden ? "Trend hidden" : "Two recorded days are needed to draw a trend."}</Text>

      </View>}

      <View style={F.row}>

        <Text style={{ ...F.caption, color: D.muted }}>{dayLabel(first.date)}</Text>

        <Text style={{ ...F.caption, color: D.muted }}>{dayLabel(latest.date)}</Text>

      </View>

    </Panel>

    <View style={F.wrap}>

      <SmallStat label="Recorded days" value={hidden ? "•••" : String(days.length)} />

      <SmallStat label="First → latest" value={hidden ? "•••" : change == null ? "—" : `${change >= 0 ? "+" : ""}${display(change)}`}
        detail="Change across recorded days" />

    </View>

  </View>;
}

function Decision({ event, prior, hidden }: {
  event: FitAdaptHistoryEvent;
  prior: FitAdaptHistoryEvent["targets"]; hidden: boolean
}) {
  const { D, F } = useTaskPresentation();

  const accepted = event.status === "accepted";
  const label = accepted ? "Accepted" : event.status === "declined" ? "Declined" : "Superseded";
  const date = new Date(event.resolvedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return <View style={{ flexDirection: "row", gap: 13 }}>

    <View style={{ alignItems: "center", width: 24 }}>

      <View style={{ height: 28, justifyContent: "center" }}>

        <Ionicons name={accepted ? "checkmark-circle" : "ellipse-outline"} size={22} color={accepted ? D.lime : D.teal} />

      </View>

      <View style={{ flex: 1, width: 1, backgroundColor: D.line, marginTop: 8 }} />

    </View>

    <View style={{ flex: 1, gap: 12, paddingBottom: 20 }}><ProfileRecord label={date}>

      <Text style={F.eyebrow}>RESOLVED PROPOSAL</Text>

      <Text accessibilityRole="header" style={F.heading}>{label}</Text>

      {event.effectiveDate && <Text style={F.caption}>
        {accepted ? "Plan effective" : "Proposed effective"} · {dayLabel(event.effectiveDate)}
      </Text>}

      <View style={{ ...F.panel, padding: 15, gap: 13 }}>

        {!event.targets ? <Text style={F.body}>Target details were not saved in a valid form for this event.</Text> : <>
          <Text style={F.caption}>{accepted ? prior ? "Previous accepted → accepted" : "Accepted targets" : "Proposed targets · not applied"}</Text>
          {([["Energy", "calories", "kcal"], ["Protein", "protein", "g"],
          ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]] as const).map(([name, key, unit]) =>
            <View key={key} style={{ ...F.row, flexWrap: "wrap", gap: 4 }}>

              <Text style={F.caption}>{name}</Text>

              <Text style={{ color: accepted ? D.lime : D.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {hidden ? "•••" : `${prior ? `${Math.round(prior[key]).toLocaleString()} → ` : ""}${Math.round(event.targets![key]).toLocaleString()} ${unit}`}
              </Text>

            </View>)}
        </>}

      </View>

      {!accepted && <Text style={F.caption}>This proposal did not change active targets.</Text>}

    </ProfileRecord></View>

  </View>;
}

export function FitAdaptInsightsView({ onBack, range, setRange, hidden, setHidden, metrics,
  events, busy, error, hasMore, loadHistory }: {
    onBack: () => void; range: 30 | 90; setRange: (value: 30 | 90) => void;
    hidden: boolean; setHidden: (value: boolean) => void; metrics: InsightMetric[];
    events: FitAdaptHistoryEvent[]; busy: boolean; error: boolean; hasMore: boolean;
    loadHistory: (more: boolean) => void;
  }) {
  const { D, F } = useTaskPresentation();

  const [section, setSection] = useState<"trends" | "decisions">("trends");
  const [metricId, setMetricId] = useState("weight");
  const metric = metrics.find((item) => item.id === metricId) || metrics[0];
  return <FlowPage title="Your progress, recorded." eyebrow="Insights & history" onBack={onBack}
    action={<Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show values" : "Hide values"}
      onPress={() => setHidden(!hidden)} style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: D.card, alignItems: "center", justifyContent: "center"
      }}>

      <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={21} color={D.lime} />

    </Pressable>}>

    <ProfileIntro fitadapt label="FitAdapt / insights & history" title={section === "trends" ? "Measured, not predicted" : "Your plan decision trail"} detail={section === "trends" ? "Explore real account records. FitAdapt decision history is kept separately." : "A factual record of resolved proposals. Pending reviews stay on Profile."} />
    <ChoiceRail label="Insights view" value={section} onChange={setSection}
      choices={[{ value: "trends", label: "Measured trends" }, { value: "decisions", label: "Plan decisions" }]} />

    {section === "trends" ? <>
      <Panel><ChoiceRail label="Trend period" value={range} onChange={setRange}
        choices={[{ value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} />
      <View style={F.wrap}>

        {metrics.map((item) => <Pressable key={item.id} accessibilityRole="button"
          accessibilityLabel={`Show ${item.title}`} accessibilityState={{ selected: item.id === metricId }}
          onPress={() => setMetricId(item.id)} style={{
            flex: 1, minWidth: 85, borderRadius: 18,
            padding: 14, gap: 10, backgroundColor: item.id === metricId ? D.lime : D.card
          }}>

          <Ionicons name={item.icon} size={22} color={item.id === metricId ? D.ink : D.teal} />

          <Text style={{ color: item.id === metricId ? D.ink : D.text, fontSize: 13, fontWeight: "800" }}>{item.title}</Text>

        </Pressable>)}

      </View>
      </Panel><TrendDetail metric={metric} hidden={hidden} />
      <Text style={F.body}>{metric.context}</Text>
      <Text style={F.caption}>Only recorded days appear. Missing days are omitted. These trends are not comparisons with historical plan targets.</Text>
    </> : <>
      <View style={{ gap: 8 }}>

        <Text style={F.eyebrow}>FITADAPT / PLAN LOG</Text>

        <Text style={F.body}>Your most recent decisions first. Pending review stays on Profile until you decide.</Text>

      </View>
      {busy && !events.length && <FlowNotice title="Loading plan history…" />}
      {error && <View style={{ gap: 12 }}>

        <FlowNotice title="History is unavailable right now" detail="Your active targets are unchanged." error />

        <Action label="Retry history" icon="refresh-outline" disabled={busy} onPress={() => loadHistory(false)} />

      </View>}
      {!busy && !error && !events.length && <FlowNotice title="Your decisions will appear here"
        detail="No resolved proposals are available for this account yet." />}
      <View>
        {events.map((event, index) => <Decision key={event.id} event={event}
          prior={previousAcceptedTargets(events, index)} hidden={hidden} />)}
      </View>
      {hasMore && <Action label={busy ? "Loading…" : "Load older decisions"} icon="arrow-down-outline"
        disabled={busy} onPress={() => loadHistory(true)} />}
    </>}

  </FlowPage>;
}
