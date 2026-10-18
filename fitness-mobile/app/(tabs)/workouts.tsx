import ActivityLogSheet from "@/components/activity/ActivityLogSheet";
import { Action, Card, GlowPanel, LinkRow, Metric, Page, Section } from "@/components/designPreview/UI";
import { useSomataTheme } from "@/components/somata/theme";
import { useAuth } from "@/content/AuthContext";
import {
  addActivity, deleteActivity, subscribeActivityBetween, updateActivity,
  type ActivityEntry
} from "@/services/activity";
import {
  deleteWorkoutTemplate, subscribeWorkoutTemplates, updateWorkoutTemplate,
  type WorkoutTemplate
} from "@/services/templates";
import { PRIMARY_MUSCLE_OPTIONS } from "@/services/workoutMuscles";
import { subscribeWorkouts, type Workout } from "@/services/workouts";
import { AUTO_TEMPLATES, type SharedTemplateVM } from "@/services/workoutTemplateCatalog";
import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";

export default function DesignWorkouts() {
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const params = useLocalSearchParams<{ activity?: string; }>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Workout[] | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTitle, setConfigTitle] = useState("");
  const [configMuscle, setConfigMuscle] = useState("");
  const [configDuration, setConfigDuration] = useState("45");
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityEntry | null>(null);
  const [templateBusy, setTemplateBusy] = useState<string | null>(null);
  useEffect(() => {
    setRows(null); setTemplates(null);
    if (!user?.uid) return;
    const stopWorkouts = subscribeWorkouts(user.uid, setRows, { max: 90 });
    const stopTemplates = subscribeWorkoutTemplates(user.uid, setTemplates);
    return () => { stopWorkouts(); stopTemplates(); };
  }, [user?.uid]);
  const today = dayKey(new Date());
  useEffect(() => {
    if (params.activity === "1") setActivityOpen(true);
  }, [params.activity]);
  useEffect(() => {
    setActivities([]);
    if (!user?.uid) return;
    return subscribeActivityBetween(user.uid, today, today, setActivities);
  }, [user?.uid, today]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (6 - i));
    const key = dayKey(date);
    return {
      date: key, label: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      sets: (rows ?? []).filter((row) => row.date === key).reduce((sum, row) => sum + (Number(row.sets) || 0), 0)
    };
  }), [rows, today]);
  const recorded = rows?.filter((row) => row.date === today) ?? [];
  const visibleTemplates = templates?.filter((item) => !item.archived) ?? [];
  const archivedTemplates = templates?.filter((item) => item.archived) ?? [];
  const latest = rows?.[0];
  const max = Math.max(1, ...week.map((day) => day.sets));
  const launchTemplate = async (template: SharedTemplateVM) => {
    if (!user?.uid) return;
    try {
      await AsyncStorage.setItem(`workout:templateSeed:${user.uid}`, JSON.stringify({
        title: template.name,
        exercises: template.items.map((item) => ({
          name: item.exercise,
          sets: Math.max(1, Number(item.sets || 1)), reps: Number(item.reps || 10),
          weightKg: Number(item.weightKg ?? item.weight ?? 0), note: item.notes || ""
        })),
      }));
      if (template.source === "user") {
        void updateWorkoutTemplate(user.uid, template.id, { lastUsedAt: Date.now() }).catch(() => { });
      }
      router.push({
        pathname: "/workouts/session", params: {
          templateId: template.id, templateName: template.name, templateLaunch: "1",
        }
      });
    } catch { Alert.alert("Template could not open", "Please try again."); }
  };
  const pickSaved = () => {
    const choices = visibleTemplates.filter((item) => item.items.length);
    if (!choices.length) { Alert.alert("No saved templates yet", "Create a template to use a saved surprise pick."); return; }
    const lastUsed = (item: WorkoutTemplate) => item.lastUsedAt?.toMillis?.() ||
      Number(item.lastUsedAt || item.updatedAt?.toMillis?.() || 0);
    const selected = choices.slice().sort((a, b) => lastUsed(a) - lastUsed(b))[0];
    void launchTemplate({
      id: selected.id, name: selected.name, source: "user", items: selected.items.map((item) => ({
        exercise: item.exercise, sets: item.sets || 1, reps: item.reps || 10,
        weight: item.weight, weightKg: item.weightKg, notes: item.notes,
      }))
    });
  };
  const startConfigured = () => {
    setConfigOpen(false);
    router.push({
      pathname: "/workouts/session", params: {
        freshStart: "1", configTitle: configTitle.trim() || "Workout",
        configMuscle, configDuration,
      }
    });
  };
  const manageTemplate = async (template: WorkoutTemplate, action: "keep" | "archive" | "restore" | "delete") => {
    if (!user?.uid || templateBusy) return;
    setTemplateBusy(template.id);
    try {
      if (action === "keep") {
        const key = "workouts:template-keep-until";
        const raw = await AsyncStorage.getItem(key);
        const current = raw ? JSON.parse(raw) as Record<string, number> : {};
        await AsyncStorage.setItem(key, JSON.stringify({
          ...current,
          [template.id]: Date.now() + 30 * 86400000
        }));
      } else if (action === "delete") await deleteWorkoutTemplate(user.uid, template.id);
      else await updateWorkoutTemplate(user.uid, template.id, { archived: action === "archive" });
    } catch { Alert.alert("Template could not be updated", "Please try again."); }
    finally { setTemplateBusy(null); }
  };
  const confirmDelete = (template: WorkoutTemplate) => Alert.alert("Delete template?", template.name, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => { void manageTemplate(template, "delete"); } },
  ]);
  return <>
    <Page eyebrow="Movement / recorded work" title="Workouts"
      subtitle="Train, resume, and revisit what you logged.">

      <GlowPanel>

        <Text style={{ color: D.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>YOUR NEXT SESSION</Text>

        <Text style={{ color: D.text, fontSize: 28, fontWeight: "800" }}>Make room to move.</Text>

        <Text style={{ color: D.muted, fontSize: 13, lineHeight: 19 }}>Your session workspace keeps the same logging and editing tools.</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

          <Action label="Start new" icon="add" bright onPress={() => router.push("/workouts/session?freshStart=1" as never)} />

          <Action label="Open session" icon="play-outline" onPress={() => router.push("/workouts/session")} />

          <Action label="Plan a session" icon="options-outline" onPress={() => setConfigOpen(true)} />

        </View>

      </GlowPanel>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        <Metric label="Sets today" value={rows == null ? "Loading…" : recorded.length ?
          String(recorded.reduce((sum, row) => sum + (Number(row.sets) || 0), 0)) : "—"}
          detail={recorded.length ? `${recorded.length} records` : "No workout recorded"} />

        <Metric label="Saved templates" value={templates == null ? "Loading…" : String(visibleTemplates.length)}
          detail="Your account library" tone="lime" />

      </View>

      <Card>

        <Section title="Last seven days" caption="Recorded sets by date" />

        <View accessibilityLabel="Recorded workout sets over the past seven days"
          style={{ height: 103, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>

          {week.map((day, index) => <View key={day.date} style={{ flex: 1, alignItems: "center", gap: 7 }}>

            <View style={{ width: "100%", height: 77, justifyContent: "flex-end", backgroundColor: D.low, borderRadius: 7 }}>

              <View style={{
                height: day.sets ? Math.max(7, day.sets / max * 77) : 0,
                borderRadius: 7, backgroundColor: index === 6 ? D.lime : D.teal
              }} />

            </View>

            <Text style={{ color: D.dim, fontSize: 11 }}>{day.label}</Text>

          </View>)}

        </View>

        {rows?.length === 0 && <Text style={{ color: D.muted, fontSize: 12 }}>No dated workout records yet.</Text>}

      </Card>

      <Section title="Start with a template" caption="Built-in sessions and your saved library" />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        {AUTO_TEMPLATES.map((template) => <Pressable key={template.id} accessibilityRole="button"
          accessibilityLabel={`Start ${template.name}`} onPress={() => { void launchTemplate(template); }}
          style={({ pressed }) => ({
            width: "48%", minHeight: 111, borderRadius: 17,
            backgroundColor: D.card, borderColor: D.line, borderWidth: 1,
            padding: 13, justifyContent: "space-between", opacity: pressed ? 0.7 : 1
          })}>

          <Text style={{ fontSize: 22 }}>{template.emoji}</Text>

          <Text style={{ color: D.text, fontSize: 14, fontWeight: "800" }}>{template.name}</Text>

          <Text style={{ color: D.dim, fontSize: 11 }}>{template.items.length} movements</Text>

        </Pressable>)}

      </View>

      <Action label="Surprise from saved templates" icon="shuffle-outline" onPress={pickSaved} />

      <Card>

        <Section title="Saved template desk" caption="Launch and manage your own sessions" />

        {templates === null ? <Text style={{ color: D.muted }}>Loading templates…</Text> :
          visibleTemplates.length === 0 ? <Text style={{ color: D.muted, fontSize: 12 }}>No saved templates yet.</Text> :
            visibleTemplates.map((template) => <View key={template.id} style={{
              gap: 8, borderTopWidth: 1,
              borderColor: D.line, paddingTop: 12
            }}>

              <Text style={{ color: D.text, fontSize: 15, fontWeight: "800" }}>{template.name}</Text>

              <Text style={{ color: D.dim, fontSize: 11 }}>{template.items.length} movements</Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>

                <Action label="Use" icon="play-outline" disabled={templateBusy === template.id}
                  onPress={() => {
                    void launchTemplate({
                      id: template.id, name: template.name,
                      source: "user", items: template.items.map((item) => ({
                        exercise: item.exercise,
                        sets: item.sets || 1, reps: item.reps || 10, weight: item.weight,
                        weightKg: item.weightKg, notes: item.notes
                      }))
                    });
                  }} />

                <Action label="Keep 30 days" icon="time-outline" disabled={templateBusy === template.id}
                  onPress={() => { void manageTemplate(template, "keep"); }} />

                <Action label="Archive" icon="archive-outline" disabled={templateBusy === template.id}
                  onPress={() => { void manageTemplate(template, "archive"); }} />

                <Action label="Delete" icon="trash-outline" disabled={templateBusy === template.id}
                  onPress={() => confirmDelete(template)} />

              </View>

            </View>)}

        {archivedTemplates.map((template) => <View key={template.id} style={{
          borderTopWidth: 1,
          borderColor: D.line, paddingTop: 10, flexDirection: "row", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 8
        }}>

          <Text style={{ color: D.muted, fontSize: 13 }}>{template.name} · archived</Text>

          <Action label="Restore" icon="refresh-outline" disabled={templateBusy === template.id}
            onPress={() => { void manageTemplate(template, "restore"); }} />

        </View>)}

      </Card>

      <Card>

        <Section title="Recent work" action={<Action label="History" icon="time-outline"
          onPress={() => router.push("/workouts/history")} />} />

        {rows === null ? <Text style={{ color: D.muted }}>Loading workouts…</Text> :
          latest ? <View style={{ gap: 5 }}>

            <Text style={{ color: D.text, fontSize: 17, fontWeight: "700" }}>{latest.sessionTitle || latest.exercise}</Text>

            <Text style={{ color: D.muted, fontSize: 12 }}>{latest.date} · {latest.exercise} · {latest.sets ?? 0} sets</Text>

          </View> : <Text style={{ color: D.muted }}>Your first logged session will appear here.</Text>}

      </Card>

      <Card>

        <Section title="Activity today" caption="Account-scoped movement outside sessions"
          action={<Action label="Log" icon="add" onPress={() => { setEditingActivity(null); setActivityOpen(true); }} />} />

        {activities.length ? activities.map((entry) => <Pressable key={entry.id} accessibilityRole="button"
          accessibilityLabel={`Edit ${entry.type} activity`} onPress={() => { setEditingActivity(entry); setActivityOpen(true); }}
          style={{
            borderTopWidth: 1, borderColor: D.line, paddingVertical: 10, flexDirection: "row",
            justifyContent: "space-between", gap: 8
          }}>

          <Text style={{ color: D.text, fontWeight: "700", textTransform: "capitalize" }}>{entry.type}</Text>

          <Text style={{ color: D.muted }}>{entry.minutes} min · Edit</Text>

        </Pressable>) : <Text style={{ color: D.muted, fontSize: 12 }}>No activity recorded today.</Text>}

      </Card>

      <Card>

        <Section title="Your training tools" />

        <LinkRow title="Template library" detail="Find and launch saved training templates" icon="albums-outline"
          onPress={() => router.push("/workouts/templates")} />

        <LinkRow title="Create a template" detail="Build a repeatable session" icon="create-outline"
          onPress={() => router.push("/(modals)/create-template")} />

        <LinkRow title="Session history" detail="Open logged sessions and recaps" icon="time-outline"
          onPress={() => router.push("/workouts/history")} />

        <LinkRow title="Quick workout" detail="Log exercises without a full session" icon="barbell-outline"
          onPress={() => router.push("/(modals)/quick-workout")} />

        <LinkRow title="Connections" detail="Health and wearable integrations" icon="heart-outline"
          onPress={() => router.push("/profile/integrations")} />

        <LinkRow title="Coach" detail="Open your existing coaching tools" icon="sparkles-outline"
          onPress={() => router.push("/(modals)/coach-spark")} />

        <LinkRow title="Coach quick pick" detail="Use the existing instant workout flow" icon="flash-outline"
          onPress={() => router.push({ pathname: "/(modals)/coach-spark", params: { instant: "1", quickPreset: "surprise" } })} />

      </Card>

    </Page>
    <Modal visible={configOpen} transparent animationType="slide" onRequestClose={() => setConfigOpen(false)}>

      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" }}>

        <View style={{
          padding: 20, paddingBottom: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          backgroundColor: D.card, gap: 13
        }}>

          <Section title="Plan a session" caption="Choose a focus, then open the existing workout workspace" />

          <TextInput value={configTitle} onChangeText={setConfigTitle} placeholder="Session name (optional)"
            placeholderTextColor={D.dim} style={{
              padding: 13, borderRadius: 13, backgroundColor: D.raised,
              color: D.text, minHeight: 48
            }} />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>

            {[{ key: "", label: "Any focus" }, ...PRIMARY_MUSCLE_OPTIONS.slice(0, 6)].map((part) =>
              <Pressable key={part.key} onPress={() => setConfigMuscle(part.key)} accessibilityRole="button"
                accessibilityState={{ selected: configMuscle === part.key }} style={{
                  padding: 10, borderRadius: 12,
                  backgroundColor: configMuscle === part.key ? D.lime : D.raised
                }}>

                <Text style={{ color: configMuscle === part.key ? D.ink : D.text, fontWeight: "700" }}>{part.label}</Text>

              </Pressable>)}

          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>

            {["30", "45", "60", "75"].map((duration) => <Pressable key={duration} onPress={() => setConfigDuration(duration)}
              accessibilityRole="button" accessibilityState={{ selected: configDuration === duration }}
              style={{ padding: 10, borderRadius: 12, backgroundColor: configDuration === duration ? D.lime : D.raised }}>

              <Text style={{ color: configDuration === duration ? D.ink : D.text, fontWeight: "700" }}>{duration} min</Text>

            </Pressable>)}

          </View>

          <Action label="Start configured workout" icon="arrow-forward" bright onPress={startConfigured} />

          <Action label="Cancel" icon="close" onPress={() => setConfigOpen(false)} />

        </View>

      </View>

    </Modal>
    <ActivityLogSheet visible={activityOpen} editing={editingActivity}
      onClose={() => { setActivityOpen(false); setEditingActivity(null); }}
      onCreate={(entry) => { if (user?.uid) void addActivity(user.uid, entry).catch(() => Alert.alert("Could not log activity")); }}
      onUpdate={(entry) => { if (user?.uid) void updateActivity(user.uid, entry).catch(() => Alert.alert("Could not update activity")); }}
      onDelete={(id) => { if (user?.uid) void deleteActivity(user.uid, id).catch(() => Alert.alert("Could not delete activity")); }} />
  </>;
}
