import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Heading, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

type SeedExercise = {
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  note?: string;
};

export default function QuickStrengthModal() {
  return <SomataTaskAppearance><QuickStrengthModalContent /></SomataTaskAppearance>;
}

function QuickStrengthModalContent() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;
  const { colors, isDark } = useTheme();

  const accent = colors.primary || "#68D7FF";
  const topPad = Platform.OS === "android" ? 18 : 22;

  const presets = useMemo(
    () =>
      [
        {
          label: "Bench",
          icon: "fitness-outline" as const,
          ex: { name: "Bench Press", sets: 3, reps: 8, weightKg: 0 },
        },
        {
          label: "Squat",
          icon: "walk-outline" as const,
          ex: { name: "Back Squat", sets: 3, reps: 6, weightKg: 0 },
        },
        {
          label: "Row",
          icon: "swap-horizontal-outline" as const,
          ex: { name: "Chest-Supported Row", sets: 3, reps: 10, weightKg: 0 },
        },
        {
          label: "OHP",
          icon: "arrow-up-outline" as const,
          ex: { name: "Overhead Press", sets: 3, reps: 8, weightKg: 0 },
        },
        {
          label: "Pulldown",
          icon: "arrow-down-outline" as const,
          ex: { name: "Lat Pulldown", sets: 3, reps: 10, weightKg: 0 },
        },
        {
          label: "Arms",
          icon: "sparkles-outline" as const,
          ex: { name: "DB Curl", sets: 3, reps: 12, weightKg: 0 },
        },
      ] as {
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        ex: SeedExercise;
      }[],
    []
  );

  const [busy, setBusy] = useState(false);

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch { }
  };

  const templateSeedKey = (u: string) => `workout:templateSeed:${u}`;

  async function seedAndOpen(title: string, exercises: SeedExercise[]) {
    if (!uid || busy) return;
    setBusy(true);
    await haptic();

    const seed = {
      title,
      exercises: exercises.map((e) => ({
        name: e.name,
        sets: Math.max(1, Number(e.sets || 1)),
        reps: Number(e.reps || 10),
        weightKg: Number(e.weightKg || 0),
        note: (e.note || "").trim(),
      })),
    };

    try {
      await AsyncStorage.setItem(templateSeedKey(uid), JSON.stringify(seed));
    } catch { }

    router.replace({
      pathname: "/workouts/session",
      params: { quick: "strength" },
    } as any);

    setBusy(false);
  }

  const bgGradient = isDark
    ? ["#070A12", "#050711", "#03040A"]
    : [
      withAlpha(colors.primary, 0.08),
      colors.bg,
      withAlpha(colors.card, 0.85),
    ];

  const titleColor = isDark ? withAlpha("#FFF", 0.95) : colors.text;
  const subColor = isDark
    ? withAlpha("#FFF", 0.62)
    : withAlpha(colors.text, 0.65);

  const iconBtnBg = isDark
    ? withAlpha("#FFFFFF", 0.06)
    : withAlpha("#FFFFFF", 0.75);
  const iconBtnBorder = isDark
    ? withAlpha("#FFFFFF", 0.14)
    : withAlpha(colors.text, 0.12);
  const iconColor = isDark
    ? withAlpha("#FFF", 0.9)
    : withAlpha(colors.text, 0.82);

  const tileBg = isDark
    ? withAlpha("#FFFFFF", 0.05)
    : withAlpha("#FFFFFF", 0.65);
  const tileBorder = isDark
    ? withAlpha("#FFFFFF", 0.12)
    : withAlpha(colors.text, 0.1);

  const primaryBtnBg = isDark
    ? withAlpha("#FFFFFF", 0.92)
    : withAlpha(colors.text, 0.92);
  const primaryBtnText = isDark
    ? withAlpha("#111", 0.92)
    : withAlpha(colors.bg, 0.92);

  return (<TaskPage title="Quick strength" section="Start moving" subtitle="Choose a starting point, then review and log your session." onBack={() => router.back()}>
    <WorkoutIntro label="Strength starter" title="Start with a lift." detail="Open a planned session, then record the work you actually do." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {presets.map((p, i) => <View key={p.label} style={{ flexGrow: 1, flexBasis: 230 }}><Panel>
      <MovementHeading number={i + 1} title={p.label} detail={`${p.ex.sets} × ${p.ex.reps}`} />
      <Button icon={p.icon} label="Start session" disabled={busy} onPress={() => seedAndOpen(p.ex.name, [p.ex])} />
    </Panel></View>)}
    </View>
    <Button label="Full-body session" disabled={busy} onPress={() => seedAndOpen('Quick Strength', [{ name: 'Bench Press', sets: 3, reps: 8, weightKg: 0 }, { name: 'Lat Pulldown', sets: 3, reps: 10, weightKg: 0 }, { name: 'Leg Press', sets: 3, reps: 10, weightKg: 0 }])} />
  </TaskPage>);
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  glow: { position: "absolute", width: 280, height: 280, borderRadius: 280 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "700" },

  cardWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  cardBlur: { borderRadius: 18, overflow: "hidden" },
  cardInner: { padding: 14 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  grid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.5%",
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileText: { marginTop: 10, fontWeight: "900", fontSize: 14 },
  tileSub: { marginTop: 3, fontWeight: "700", fontSize: 12 },

  primaryBtn: {
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { fontWeight: "900" },

  foot: { marginTop: 12, fontSize: 12, fontWeight: "700" },
});
