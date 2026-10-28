import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Empty, Field, Heading, IconButton, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";

import { useAuth } from "@/content/AuthContext";
import { updateWorkoutTemplate } from "@/services/templates";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

type TemplateItem = {
  exercise: string;
  sets: number;
  reps: number;
  weightKg?: number;
  notes?: string;
};

function n(v: any, fallback: number) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export default function CreateTemplateModal() {
  return <SomataTaskAppearance><CreateTemplateModalContent /></SomataTaskAppearance>;
}

function CreateTemplateModalContent() {
  const { D, F } = useTaskPresentation();

  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐️");
  const [tagText, setTagText] = useState(""); // "Upper • Strength"

  const [items, setItems] = useState<TemplateItem[]>([]);

  // add-exercise mini modal state
  const [addOpen, setAddOpen] = useState(false);
  const [exName, setExName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = useMemo(
    () => name.trim().length > 0 && items.length > 0,
    [name, items]
  );

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch { }
  };

  const close = () => router.back();

  const openAdd = async () => {
    await haptic();
    setExName("");
    setSets("3");
    setReps("10");
    setWeightKg("");
    setNotes("");
    setAddOpen(true);
  };

  const addItem = () => {
    const e = exName.trim();
    if (!e) return;

    const next: TemplateItem = {
      exercise: e,
      sets: Math.max(1, n(sets, 3)),
      reps: Math.max(1, n(reps, 10)),
      weightKg: weightKg.trim() ? Math.max(0, n(weightKg, 0)) : undefined,
      notes: notes.trim() || undefined,
    };

    setItems((prev) => [...prev, next]);
    setAddOpen(false);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const saveTemplate = async () => {
    if (!uid) return;
    if (!canSave) return;

    try {
      await haptic();

      // Prefer creating via updateWorkoutTemplate by passing a new id.
      // If your backend uses setDoc, it will create. If it uses updateDoc and fails,
      // you’ll see the error and you can switch updateWorkoutTemplate to setDoc.
      const id = `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const tags =
        tagText
          .split("•")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4) ?? [];

      const mapped = items.map((it) => ({
        exercise: it.exercise,
        sets: Number(it.sets || 1),
        reps: Number(it.reps || 10),
        weightKg: Number(it.weightKg ?? 0),
        notes: it.notes || "",
      }));

      await updateWorkoutTemplate(uid, id, {
        id,
        name: name.trim(),
        title: name.trim(),
        emoji: (emoji || "⭐️").trim(),
        tags,
        tag: tags, // keep compatibility
        items: mapped,
        exercises: mapped,
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

  return (<><TaskPage title="Create a routine" section="New template" onBack={close} footer={<Button primary label="Save template" onPress={saveTemplate} disabled={!canSave || !uid} />}>

    <Panel accent><Heading title="Routine identity" detail="Give your plan a name, then arrange the movements." />
    <Field label="Routine name" value={name} onChangeText={setName} placeholder="My training routine" />
    <WorkoutFields>
      <Field label="Emoji" value={emoji} onChangeText={setEmoji} />
      <Field label="Tags · separate with •" value={tagText} onChangeText={setTagText} />
    </WorkoutFields></Panel>

    <Heading title="Exercise order" detail="Arrange the routine in the order you want to train." />
    {!items.length && <Empty title="Start with one movement" detail="Add exercises and their planned sets below." />}

    {items.map((it, i) => <Panel key={i}>
      <MovementHeading number={i + 1} title={it.exercise} detail={`${it.sets} × ${it.reps}${it.weightKg != null ? ` · ${it.weightKg} kg` : ''}`} />
      {!!it.notes && <Text style={F.body}>{it.notes}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <IconButton icon="arrow-up" label="Move earlier" disabled={i === 0} onPress={() => moveItem(i, -1)} />
        <IconButton icon="arrow-down" label="Move later" disabled={i === items.length - 1} onPress={() => moveItem(i, 1)} />
        <IconButton icon="trash-outline" label={`Remove ${it.exercise}`} onPress={() => removeItem(i)} />
      </View>
    </Panel>)}
    <Button label="Add exercise" icon="add" onPress={openAdd} />

  </TaskPage><TaskSheet title="Add an exercise" visible={addOpen} onClose={() => setAddOpen(false)}>
      <WorkoutIntro label="Plan a movement" title="Set the starting prescription." detail="These are planned sets, not completed work." />
      <Panel><Field label="Exercise" value={exName} onChangeText={setExName} />
      <WorkoutFields>
        <Field label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" />
        <Field label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" />
      </WorkoutFields>
      <Field label="Weight · kg · optional" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" /></Panel>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Button primary label="Add to routine" onPress={addItem} disabled={!exName.trim()} />
    </TaskSheet></>
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

  addBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 18,
    backgroundColor: withAlpha("#68D7FF", 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#68D7FF", 0.3),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBtnText: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },

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

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  iconBtnDanger: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FF5C6A", 0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FF5C6A", 0.22),
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalWrap: { padding: 14, paddingBottom: 18 },

  modalTitle: {
    color: withAlpha("#FFFFFF", 0.94),
    fontWeight: "900",
    fontSize: 16,
  },
  modalInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    color: withAlpha("#FFFFFF", 0.92),
    fontWeight: "800",
  },
  modalPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#68D7FF", 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#68D7FF", 0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },
  modalGhost: {
    width: 120,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostText: { color: withAlpha("#FFFFFF", 0.88), fontWeight: "900" },
});
