import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { WorkoutIntro, WorkoutStats, WorkoutFields, MovementHeading } from "@/components/workouts/WorkoutTaskUI";
import { Button, Empty, Heading, Item, Panel, TaskSheet } from "@/components/somata/TaskUI";
// components/exercises/ExercisePreviewSheet.tsx
import * as Haptics from "expo-haptics";
import { useEffect, useMemo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View
} from "react-native";

import { useTheme } from "@/content/ThemeProvider";
import type { ExerciseDoc } from "@/services/exercises/types";

type Props = {
  visible: boolean;
  exercise: ExerciseDoc | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onUse: () => void;
};

const titleize = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ExercisePreviewSheet(props: Props) {
  return <SomataTaskAppearance><ExercisePreviewSheetContent {...props} /></SomataTaskAppearance>;
}

function ExercisePreviewSheetContent({
  visible,
  exercise,
  isFavorite,
  onClose,
  onToggleFavorite,
  onUse,
}: Props) {
  const { D, F } = useTaskPresentation();

  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (visible)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }, [visible]);

  const meta = useMemo(() => {
    if (!exercise) return "";
    const primary = exercise.primaryMuscles?.[0]
      ? titleize(exercise.primaryMuscles[0])
      : "";
    const equip = exercise.equipment?.[0]
      ? titleize(exercise.equipment[0])
      : "";
    return [primary, equip].filter(Boolean).join(" • ");
  }, [exercise]);

  if (!exercise) return null;

  const gif = exercise.images?.gif;

  return (<TaskSheet title={exercise.name} visible={visible} onClose={onClose}>

    <Panel accent><Text style={F.eyebrow}>MOVEMENT GUIDE</Text><Text style={F.heading}>{meta}</Text></Panel>
    {gif ? <Image source={{ uri: gif }} style={{ width: '100%', height: 230, borderRadius: 20, backgroundColor: D.card }} resizeMode="contain" accessibilityLabel={`${exercise.name} demonstration`} /> : <Empty title="No demonstration available" />}

    <Heading title="Technique" />
    <Panel>{(exercise.instructions ?? []).map((step, i) => <MovementHeading key={i} number={i + 1} title={`Step ${i + 1}`} detail={step} />)}
      {!exercise.instructions?.length && <Text style={F.caption}>No instructions are available for this exercise.</Text>}
    </Panel>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Button label={isFavorite ? 'Saved to favorites' : 'Save to favorites'} icon={isFavorite ? 'heart' : 'heart-outline'} onPress={onToggleFavorite} />
      <Button primary label="Use exercise" onPress={onUse} />
    </View>

  </TaskSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetWrap: { position: "absolute", left: 12, right: 12, bottom: 12 },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
    overflow: "hidden",
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "900", letterSpacing: 0.2 },
  meta: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  gif: { width: "100%", height: "100%" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.25,
    marginBottom: 8,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },
  cueRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cueText: { fontSize: 14, fontWeight: "600", lineHeight: 20, flex: 1 },
  actions: { marginTop: 16, gap: 10 },
  actionBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionText: { fontSize: 14.5, fontWeight: "900" },
  primaryBtn: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
