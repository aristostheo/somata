import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Heading, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useAuth } from "@/content/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function QuickMobilityModal() {
  return <SomataTaskAppearance><QuickMobilityModalContent /></SomataTaskAppearance>;
}

function QuickMobilityModalContent() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const accent = "#7CFFB5";
  const topPad = Platform.OS === "android" ? 18 : 22;
  const [busy, setBusy] = useState(false);

  const templateSeedKey = (u: string) => `workout:templateSeed:${u}`;

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch { }
  };

  async function seedAndOpen(kind: "10" | "15") {
    if (!uid || busy) return;
    setBusy(true);
    await haptic();

    const seed = {
      title: kind === "10" ? "Mobility (10 min)" : "Mobility (15 min)",
      exercises: [
        {
          name: "Hip Opener Flow",
          sets: 1,
          reps: 1,
          weightKg: 0,
          note: "2–3 min",
        },
        { name: "Thoracic Rotation", sets: 2, reps: 8, weightKg: 0, note: "" },
        {
          name: "Hamstring Stretch",
          sets: 2,
          reps: 1,
          weightKg: 0,
          note: "45–60s hold",
        },
      ],
    };

    try {
      await AsyncStorage.setItem(templateSeedKey(uid), JSON.stringify(seed));
    } catch { }

    router.replace({
      pathname: "/workouts/session",
      params: { quick: "mobility", mins: kind },
    } as any);
    setBusy(false);
  }

  return (<TaskPage title="Quick mobility" section="Start moving" subtitle="Choose a starting point, then review and log your session." onBack={() => router.back()}>
    <WorkoutIntro label="Mobility starter" title="A little room to move." detail="Both options open the existing three-movement sequence for review and logging." icon="body-outline" />
    <Panel accent>
      <MovementHeading number={1} title="10 minutes" detail="Hip opener flow, thoracic rotation, and hamstring stretch." />
      <Button primary disabled={busy} label="Start 10-minute flow" onPress={() => seedAndOpen('10')} />
    </Panel>
    <Panel>
      <MovementHeading number={2} title="15 minutes" detail="Take a little longer with the same mobility sequence." />
      <Button disabled={busy} label="Start 15-minute flow" onPress={() => seedAndOpen('15')} />
    </Panel>
  </TaskPage>);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060C" },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 280 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  title: { color: withAlpha("#FFF", 0.95), fontSize: 20, fontWeight: "900" },
  subtitle: {
    marginTop: 2,
    color: withAlpha("#FFF", 0.62),
    fontSize: 12,
    fontWeight: "700",
  },

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

  sectionLabel: {
    color: withAlpha("#FFF", 0.65),
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  rowBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.12),
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  rowTitle: { color: withAlpha("#FFF", 0.92), fontWeight: "900", fontSize: 14 },
  rowSub: {
    marginTop: 3,
    color: withAlpha("#FFF", 0.62),
    fontWeight: "700",
    fontSize: 12,
  },

  foot: {
    marginTop: 12,
    color: withAlpha("#FFF", 0.5),
    fontSize: 12,
    fontWeight: "700",
  },
});
