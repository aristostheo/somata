import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Choice, Field, Heading, Item, Panel, TaskSheet } from "@/components/somata/TaskUI";
// components/activity/ActivityLogSheet.tsx

import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Platform,
  View
} from "react-native";

import type {
  ActivityEntry,
  ActivityGoal,
  ActivityIntensity,
  ActivityType,
} from "./activityTypes";
import {
  clamp,
  uid
} from "./activityUtils";

// If you already have these in your app, keep them.
// Otherwise this file still works with simple inline styles.
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

type Props = {
  visible: boolean;
  onClose: () => void;

  goal?: ActivityGoal;

  // If provided -> edit mode
  editing?: ActivityEntry | null;

  onCreate: (entry: ActivityEntry) => void;
  onUpdate: (entry: ActivityEntry) => void;
  onDelete: (id: string) => void;

  // Optional presets to match your brand (can omit)
  presets?: Array<{
    type: ActivityType;
    minutes: number;
    intensity: ActivityIntensity;
    label?: string;
  }>;
};

type Tab = "quick" | "log";

export default function ActivityLogSheet(props: Props) {
  return <SomataTaskAppearance><ActivityLogSheetContent {...props} /></SomataTaskAppearance>;
}

function ActivityLogSheetContent({
  visible,
  onClose,
  editing,
  onCreate,
  onUpdate,
  onDelete,
  presets,
}: Props) {
  const { colors, isDark } = useTheme();

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => { });
  }, []);

  const defaultPresets =
    presets ??
    ([
      { type: "walk", minutes: 10, intensity: "easy", label: "Walk 10" },
      { type: "run", minutes: 20, intensity: "moderate", label: "Run 20" },
      { type: "bike", minutes: 20, intensity: "moderate", label: "Bike 20" },
      { type: "stretch", minutes: 10, intensity: "easy", label: "Stretch 10" },
    ] as const);

  const [tab, setTab] = useState<Tab>("quick");

  // form state
  const [type, setType] = useState<ActivityType>("walk");
  const [minutes, setMinutes] = useState<string>("20");
  const [intensity, setIntensity] = useState<ActivityIntensity>("moderate");
  const [calories, setCalories] = useState<string>("");
  const [steps, setSteps] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTab("log");
      setType(editing.type);
      setMinutes(String(editing.minutes ?? 0));
      setIntensity(editing.intensity ?? "moderate");
      setCalories(editing.calories != null ? String(editing.calories) : "");
      setSteps(editing.steps != null ? String(editing.steps) : "");
      setNote(editing.note ?? "");
    } else {
      setTab("quick");
      setType("walk");
      setMinutes("20");
      setIntensity("moderate");
      setCalories("");
      setSteps("");
      setNote("");
    }
  }, [visible, editing]);

  const softCard = useMemo(
    () => ({
      backgroundColor: isDark
        ? withAlpha("#0b1220", 0.72)
        : withAlpha("#ffffff", 0.82),
      borderColor: withAlpha(colors.border, isDark ? 0.25 : 0.6),
      borderWidth: 1,
      borderRadius: 22,
    }),
    [colors.border, isDark]
  );

  const hairline = useMemo(
    () => ({
      height: 1,
      backgroundColor: withAlpha(colors.border, isDark ? 0.22 : 0.6),
    }),
    [colors.border, isDark]
  );

  function hapticLight() {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => { });
  }
  function hapticSuccess() {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => { }
      );
  }

  function parseNum(v: string) {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function saveFromForm() {
    const m = clamp(Math.round(parseNum(minutes)), 1, 600);
    const c = calories.trim()
      ? clamp(Math.round(parseNum(calories)), 0, 5000)
      : undefined;
    const s = steps.trim()
      ? clamp(Math.round(parseNum(steps)), 0, 200000)
      : undefined;

    const entry: ActivityEntry = {
      id: editing?.id ?? uid(),
      type,
      minutes: m,
      intensity,
      calories: c,
      steps: s,
      note: note.trim() ? note.trim() : undefined,
      timestamp: editing?.timestamp ?? Date.now(),
    };

    if (editing) onUpdate(entry);
    else onCreate(entry);

    hapticSuccess();
    onClose();
  }

  function quickAdd(p: {
    type: ActivityType;
    minutes: number;
    intensity: ActivityIntensity;
  }) {
    hapticLight();
    const entry: ActivityEntry = {
      id: uid(),
      type: p.type,
      minutes: p.minutes,
      intensity: p.intensity,
      timestamp: Date.now(),
    };
    onCreate(entry);
    hapticSuccess();
    onClose();
  }

  function confirmDelete() {
    if (!editing) return;
    hapticLight();
    Alert.alert("Delete activity?", "This removes it from your log.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(editing.id);
          onClose();
        },
      },
    ]);
  }

  const types: ActivityType[] = [
    "walk",
    "run",
    "bike",
    "stairs",
    "sport",
    "yoga",
    "stretch",
    "other",
  ];
  const intensities: ActivityIntensity[] = ["easy", "moderate", "hard"];

  return (<TaskSheet title={editing ? 'Edit activity' : 'Move your way'} visible={visible} onClose={onClose}>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['quick', 'log'] as const).map(t => <Choice key={t} label={t === 'quick' ? 'Quick log' : 'Custom activity'} selected={tab === t} onPress={() => { hapticLight(); setTab(t); }} />)}
    </View>

    {tab === 'quick' && !editing ? <><WorkoutIntro label="Quick activity" title="A short session still counts." detail="Selecting a preset logs it immediately. Use Custom activity to enter your own details." icon="walk-outline" /><Heading title="A little movement counts" detail="Choose a preset to add it to your activity log." />{defaultPresets.map((p, i) => <Panel key={i}><Item title={p.label || p.type} detail={`${p.minutes} minutes · ${p.intensity}`} icon="walk-outline" onPress={() => quickAdd(p)} /></Panel>)}<Button label="More options" onPress={() => { hapticLight(); setTab('log'); }} /></> : <>
      <Panel accent><Heading title="Activity & effort" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {types.map(t => <Choice key={t} label={t} selected={type === t} onPress={() => { hapticLight(); setType(t); }} />)}
      </View>
      <Field label="Duration · minutes" value={minutes} keyboardType="number-pad" onChangeText={v => setMinutes(v.replace(/[^\d]/g, ''))} /><Heading title="Intensity" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {intensities.map(i => <Choice key={i} label={i} selected={intensity === i} onPress={() => { hapticLight(); setIntensity(i); }} />)}
      </View>
      </Panel><Panel>
        <Heading title="Optional details" detail="Leave values blank when they are not recorded." />
        <WorkoutFields><Field label="Calories" keyboardType="number-pad" value={calories} onChangeText={v => setCalories(v.replace(/[^\d]/g, ''))} />
        <Field label="Steps" keyboardType="number-pad" value={steps} onChangeText={v => setSteps(v.replace(/[^\d]/g, ''))} /></WorkoutFields>
        <Field label="Note" multiline value={note} onChangeText={setNote} />
      </Panel><Button primary label={editing ? 'Save changes' : 'Log activity'} onPress={saveFromForm} />{!!editing && <Button danger label="Delete activity" onPress={confirmDelete} />}</>}
  </TaskSheet>
  );
}
