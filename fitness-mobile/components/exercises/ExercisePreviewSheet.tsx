import { Button, Empty, Heading, Item, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
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

export function ExercisePreviewSheet({
  visible,
  exercise,
  isFavorite,
  onClose,
  onToggleFavorite,
  onUse,
}: Props) {
  const { D, F } = useSomataTheme();

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

    <Text style={F.body}>{meta}</Text>
    {gif ? <Image source={{ uri: gif }} style={{ width: '100%', height: 230, borderRadius: 20, backgroundColor: D.card }} resizeMode="contain" accessibilityLabel={`${exercise.name} demonstration`} /> : <Empty title="No demonstration available" />}

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Button label={isFavorite ? 'Saved to favorites' : 'Save to favorites'} icon={isFavorite ? 'heart' : 'heart-outline'} onPress={onToggleFavorite} />
      <Button primary label="Use exercise" onPress={onUse} />
    </View>

    <Heading title="Technique" />
    {(exercise.instructions ?? []).map((step, i) => <Item key={i} title={`${i + 1}`} detail={step} />)}
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
