import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Empty, Field, Heading, Item, Panel, TaskPage } from "@/components/somata/TaskUI";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet
} from "react-native";

import { useAuth } from "@/content/AuthContext";
import { updateWorkoutTemplate } from "@/services/templates";
import { subscribeWorkouts, type Workout } from "@/services/workouts";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

function createdAtMs(r: any) {
  const c = r?.createdAt;
  if (!c) return 0;
  if (typeof c === "number") return c;
  if (typeof c?.toMillis === "function") return c.toMillis();
  if (typeof c?.seconds === "number") return c.seconds * 1000;
  return 0;
}

export default function SaveWorkoutAsTemplateModal() {
  return <SomataTaskAppearance><SaveWorkoutAsTemplateModalContent /></SomataTaskAppearance>;
}

function SaveWorkoutAsTemplateModalContent() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const params = useLocalSearchParams<{
    sessionKey?: string;
    defaultName?: string;
  }>();

  const sessionKey = String(params.sessionKey || "");
  const [name, setName] = useState(String(params.defaultName || "My Template"));
  const [emoji, setEmoji] = useState("⭐️");

  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    if (!uid) {
      setWorkouts([]);
      return;
    }
    return subscribeWorkouts(
      uid,
      (rows: Workout[]) => setWorkouts(rows || []),
      { max: 400 }
    );
  }, [uid]);

  const rowsInSession = useMemo(() => {
    const all = (workouts || []) as any[];
    if (!sessionKey) return [];
    // match workouts.tsx deleteRecent() sessionKey logic
    return all.filter((r) => {
      const sid = String(r.sessionId || "");
      const key = sid ? sid : `date:${String(r.date || "")}`;
      return key === sessionKey;
    });
  }, [workouts, sessionKey]);

  const ordered = useMemo(() => {
    return rowsInSession
      .slice()
      .sort((a, b) => createdAtMs(a) - createdAtMs(b));
  }, [rowsInSession]);

  const mappedItems = useMemo(() => {
    return ordered
      .map((r) => {
        const exercise = String(r.exercise || r.name || "").trim();
        if (!exercise) return null;
        return {
          exercise,
          sets: Math.max(1, Number(r.sets || 1)),
          reps: Math.max(1, Number(r.reps || 10)),
          weightKg: Number(r.weightKg ?? r.weight ?? 0),
          notes: String(r.notes || "").trim(),
        };
      })
      .filter(Boolean) as any[];
  }, [ordered]);

  const canSave = name.trim() && mappedItems.length;

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch { }
  };

  const close = () => router.back();

  const save = async () => {
    if (!uid) return;
    if (!canSave) return;

    try {
      await haptic();
      const id = `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      await updateWorkoutTemplate(uid, id, {
        id,
        name: name.trim(),
        title: name.trim(),
        emoji: (emoji || "⭐️").trim(),
        tags: ["Saved from workout"],
        items: mappedItems,
        exercises: mappedItems,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

      router.back();
    } catch (e: any) {
      console.warn(e);
      Alert.alert(
        "Could not save template",
        e?.message ||
        "Your template write method may be using updateDoc (requires existing doc). If so, change updateWorkoutTemplate to use setDoc so new templates can be created."
      );
    }
  };

  return (<TaskPage title="Make it repeatable" section="Save workout template" onBack={close} footer={<Button primary label="Save template" onPress={save} disabled={!canSave || !uid} />}>

    <WorkoutIntro label="From your history" title="Keep the structure. Start fresh." detail="Save a reusable routine from this session without changing the recorded workout." icon="copy-outline" />
    <Panel><Heading title="Name your routine" />
    <Field label="Template name" value={name} onChangeText={setName} />
    <Field label="Emoji" value={emoji} onChangeText={setEmoji} /></Panel>
    <Heading title={`${mappedItems.length} exercises`} detail="Review the workout that will become your template." />

    {!mappedItems.length && <Empty title="No matching workout records" detail="Return to the workout and check that the session is available." />}
    {mappedItems.map((it, i) => <Panel key={i}><MovementHeading number={i + 1} title={it.exercise} detail={`${it.sets} × ${it.reps} · ${it.weightKg} kg${it.notes ? ` · ${it.notes}` : ''}`} /></Panel>)}
  </TaskPage>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060C" },

  cardWrap: { borderRadius: 18, overflow: "hidden" },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    zIndex: 2,
  },
  cardBlur: { borderRadius: 18, overflow: "hidden" },
  cardInner: { padding: 14 },

  headerBlur: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  headerRow: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.07),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  title: { color: withAlpha("#FFFFFF", 0.94), fontSize: 16, fontWeight: "900" },
  sub: {
    marginTop: 2,
    color: withAlpha("#FFFFFF", 0.6),
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  smallIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  input: {
    color: withAlpha("#FFFFFF", 0.92),
    fontWeight: "800",
    fontSize: 14,
    paddingVertical: 0,
  },

  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha("#FFFFFF", 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.12),
    alignSelf: "flex-start",
  },
  summaryText: {
    color: withAlpha("#FFFFFF", 0.82),
    fontWeight: "800",
    fontSize: 12,
  },

  sectionTitle: {
    color: withAlpha("#FFFFFF", 0.88),
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  helper: {
    marginTop: 8,
    color: withAlpha("#FFFFFF", 0.55),
    fontWeight: "700",
    fontSize: 12,
  },

  itemTitle: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },
  itemSub: {
    marginTop: 3,
    color: withAlpha("#FFFFFF", 0.6),
    fontWeight: "700",
    fontSize: 12,
  },

  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.92),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: withAlpha("#111", 0.92), fontWeight: "900" },

  ghostBtn: {
    width: 110,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: withAlpha("#FFFFFF", 0.88), fontWeight: "900" },
});
