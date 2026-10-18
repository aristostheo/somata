import { Button, Choice } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
// components/exercises/FilterBar.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/content/ThemeProvider";
import type { ExerciseFilters } from "@/services/exercises/types";

type Chip = {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

const titleize = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type Props = {
  filters: ExerciseFilters;
  onChange: (next: ExerciseFilters) => void;
  // optional: if you later add a full advanced filters sheet
  onOpenAdvanced?: () => void;
};

export const FilterBar = memo(function FilterBar({
  filters,
  onChange,
  onOpenAdvanced,
}: Props) {
  const { D, F } = useSomataTheme();

  const { colors, isDark } = useTheme();

  const chips: Chip[] = useMemo(() => {
    const muscle = filters.muscle ?? "all";
    const equipment = filters.equipment ?? "all";
    const hasDemo = !!filters.hasDemo;

    return [
      {
        key: "muscle",
        label: muscle === "all" ? "Muscle" : titleize(muscle),
        selected: muscle !== "all",
        icon: "body-outline",
        onPress: async () => {
          Haptics.selectionAsync().catch(() => { });
          // quick-cycle list (fast); replace with sheet later if you want
          const order = [
            "all",
            "chest",
            "back",
            "legs",
            "shoulders",
            "glutes",
            "biceps",
            "triceps",
            "abs",
            "lats",
          ];
          const idx = Math.max(0, order.indexOf(muscle));
          const next = order[(idx + 1) % order.length];
          onChange({ ...filters, muscle: next as any });
        },
      },
      {
        key: "equipment",
        label: equipment === "all" ? "Equipment" : titleize(equipment),
        selected: equipment !== "all",
        icon: "barbell-outline",
        onPress: async () => {
          Haptics.selectionAsync().catch(() => { });
          const order = [
            "all",
            "barbell",
            "dumbbell",
            "kettlebell",
            "cable-machine",
            "machine",
            "bodyweight",
            "band",
          ];
          const idx = Math.max(0, order.indexOf(equipment));
          const next = order[(idx + 1) % order.length];
          onChange({ ...filters, equipment: next as any });
        },
      },
      {
        key: "demo",
        label: hasDemo ? "Demo: On" : "Demo",
        selected: hasDemo,
        icon: "film-outline",
        onPress: async () => {
          Haptics.selectionAsync().catch(() => { });
          onChange({ ...filters, hasDemo: !hasDemo });
        },
      },
    ];
  }, [filters, onChange]);

  return <View style={{ gap: 10 }}>
    <Text style={F.caption}>Tap a filter to cycle its options</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {chips.map(c => <Choice key={c.key} label={c.label} selected={c.selected} onPress={c.onPress} />)}
      {onOpenAdvanced && <Button label="More filters" onPress={onOpenAdvanced} />}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { paddingHorizontal: 0, gap: 10, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  advBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
