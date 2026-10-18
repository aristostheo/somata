import { auth } from "@/lib/firebase";
import { sharedTemplateItems } from "@/services/friends/summaryData";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Choice, Empty, Field, Heading, Item, Panel } from "@/components/somata/TaskUI";
import { useAuth } from "@/content/AuthContext";
import { useFriendSummary } from "@/hooks/useFriendSummary";
import { getFriendSummary, friendSummaryError, setFriendSummarySharing, type FriendSummary, type Section } from "@/services/friends/summary";
import { saveWorkoutTemplate } from "@/services/templates";

export type SummaryMode = "overview" | "profile" | "meals" | "workouts" | "progress";
const value = (n: number | null, unit = "") => n === null ? "Not recorded" : `${Math.round(n)}${unit}`;
function Metric<T>({ title, section, format }: { title: string; section: Section<T>; format: (data: T) => string }) {
  return <Item title={title} value={section.status === "shared" ? format(section.data) : section.status === "private" ? "Private" : "Not available from recorded data"} />;
}
export function SharedSummary({ friendUid, name = "Friend", mode = "overview", enabled = true, onNavigate }: {
  friendUid: string; name?: string; mode?: SummaryMode; enabled?: boolean; onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading, refresh } = useFriendSummary(friendUid, enabled);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [selectedDate, setDate] = useState("");
  const [templateName, setTemplateName] = useState("");
  const own = user?.uid === friendUid;
  const day = data?.days.find(d => d.date === selectedDate) ?? data?.days[0];
  const consent = () => {
    if (!data || busy) return;
    const allow = !data.sharingWithFriend;
    Alert.alert(allow ? `Share with ${name}?` : "Stop sharing?", allow ?
      "This person can read the fields you have explicitly enabled in Friend visibility. Check their UID and your sharing choices first. They can retain information already viewed. This does not enable sharing from them to you." : "Future summary requests will no longer include your activity.", [
      { text: "Cancel", style: "cancel" }, { text: allow ? "Allow sharing" : "Stop sharing", onPress: async () => {
        if (auth.currentUser?.uid !== user?.uid) return;
        setBusy(true); setActionError("");
        try { await setFriendSummarySharing(friendUid, allow); refresh(); } catch (e) { setActionError(friendSummaryError(e)); } finally { setBusy(false); }
      } },
    ]);
  };
  const templateItems = sharedTemplateItems(day?.workouts);
  const canCopy = templateItems !== null;
  const copyTemplate = () => {
    if (!user?.uid || !day || !canCopy || busy) return;
    const title = templateName.trim() || `${name} ${day.date}`;
    Alert.alert("Save as template", `Save the shared exercises as “${title}”? Private notes are not included.`, [
      { text: "Cancel", style: "cancel" }, { text: "Save", onPress: async () => {
        if (auth.currentUser?.uid !== user?.uid) return;
        setBusy(true); setActionError("");
        try {
          const fresh = await getFriendSummary(friendUid);
          const items = sharedTemplateItems(fresh.days.find(d => d.date === day.date)?.workouts);
          if (auth.currentUser?.uid !== user.uid || !items || JSON.stringify(items) !== JSON.stringify(templateItems)) {
            refresh(); setActionError("The shared workout changed or is no longer available. Review it again before saving."); return;
          }
          await saveWorkoutTemplate(user.uid, { name: title, tags: [], items });
          Alert.alert("Saved", "Template added to your library.");
        } catch { setActionError("Could not save the template. Try again."); } finally { setBusy(false); }
      } },
    ]);
  };
  return <View style={{ gap: 16 }}>
    {loading ? <Empty title="Loading shared activity…" /> : error ? <Empty title="Shared activity unavailable" detail={error} /> : null}
    {!!actionError && <Empty title="Action could not finish" detail={actionError} />}
    {!!data && <>
      {mode === "overview" && !own && <Panel>
        <Heading title="Your sharing with this friend" detail={`UID: ${friendUid}. Approval is separate for each person; only saved, enabled fields are shared.`} />
        <Button label="Choose shared fields" onPress={() => { onNavigate?.(); router.push('/profile/friend-visibility'); }} />
        <Button label={data.sharingWithFriend ? "Stop sharing with this friend" : "Allow my selected fields for this friend"} disabled={busy} onPress={consent} />
      </Panel>}
      {own && <Empty title="Your redacted preview" detail="These are your explicitly saved sharing choices. Only accepted friends you separately approve can view them." />}
      {data.status === "private" ? <Empty title="Activity is private" detail={own ? "Enable and save fields in Friend visibility to preview them." : "Your friend must approve sharing with you and enable the relevant fields. Friendship alone does not share fitness data."} /> : <>
        {(mode === "meals" || mode === "workouts" || mode === "overview") && <>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{data.days.map(d => <Choice key={d.date} label={d.date === data.window.to ? "Today" : d.date} selected={day?.date === d.date} onPress={() => setDate(d.date)} />)}</ScrollView>
          {!!day && <>
            {(mode === "meals" || mode === "overview") && <Panel>
              <Heading title="Shared nutrition" detail={day.date} />
              <Metric title="Calories logged" section={day.calories} format={n => value(n, " kcal")} />
              <Metric title="Macros logged" section={day.macros} format={m => `Protein ${value(m.protein, " g")} · Carbs ${value(m.carbs, " g")} · Fat ${value(m.fat, " g")}`} />
              {day.meals.status === "shared" ? day.meals.data.length ? day.meals.data.map((m, i) => <Item key={i} title={m.name} value={value(m.calories, " kcal")} />) : <Empty title="No meals recorded for this date" /> : <Empty title={day.meals.status === "private" ? "Meal names are private" : "Meal summary unavailable"} />}
            </Panel>}
            {(mode === "workouts" || mode === "overview") && <Panel>
              <Heading title="Shared training" detail={day.date} />
              <Metric title="Workouts logged" section={day.workoutCount} format={n => `${n} sessions`} />
              {day.workouts.status === "shared" ? day.workouts.data.length ? day.workouts.data.map((w, i) => <View key={i}><Heading title={w.title} />{w.exercises.map((e, j) => <Item key={j} title={e.exercise} detail={`${value(e.sets)} sets · ${value(e.reps)} reps · ${value(e.weightKg, " kg")}`} />)}</View>) : <Empty title="No workouts recorded for this date" /> : <Empty title={day.workouts.status === "private" ? "Workout details are private" : "Workout details unavailable"} />}
              {mode === "workouts" && canCopy && <><Field label="Template name" value={templateName} onChangeText={setTemplateName} /><Button label="Save as template" onPress={copyTemplate} disabled={busy} /></>}
            </Panel>}
            {mode === "overview" && <Metric title="Steps" section={day.steps} format={n => value(n, " steps")} />}
          </>}
        </>}
        {(mode === "overview" || mode === "profile" || mode === "progress") && <Progress data={data} />}
      </>}
    </>}
    <Button label="Refresh shared activity" onPress={refresh} disabled={busy} />
  </View>;
}
function Progress({ data }: { data: FriendSummary }) {
  const p = data.progress;
  const streak = (s: { days: number; capped: boolean }) => `${s.days}${s.capped ? "+" : ""} days · last 10 recorded dates`;
  return <Panel><Heading title="Shared progress" detail={`${data.window.from} – ${data.window.to}. No private targets or plan information.`} />
    <Metric title="Nutrition logging streak" section={p.nutritionStreak} format={streak} />
    <Metric title="Consistency streak" section={p.consistencyStreak} format={streak} />
    <Metric title="Account-recorded badges" section={p.badgeCount} format={n => `${n} badges`} />
    <Metric title="Measured weight direction" section={p.weightTrend} format={s => s === null ? "Not enough dated measurements" : s === "steady" ? "Steady" : `Trending ${s}`} />
    <Metric title="This week’s training volume" section={p.weeklyVolume} format={n => value(n, " kg × reps")} />
    <Metric title="Personal records" section={p.personalRecords} format={() => ""} />
    <Metric title="Weekly report card" section={p.weeklyReportCard} format={() => ""} />
    <Metric title="Cardio sessions" section={p.cardio} format={() => ""} />
  </Panel>;
}
