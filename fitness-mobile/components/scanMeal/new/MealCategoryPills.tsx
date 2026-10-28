import { Choice } from "@/components/somata/TaskUI";
import { useTaskPresentation } from "@/components/designPreview/Appearance";
// components/scanMeal/MealCategoryPills.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/content/ThemeProvider";

export type MealCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";

const ALL: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function MealCategoryPills({
  value,
  onChange,
}: {
  value: MealCategory;
  onChange: (v: MealCategory) => void;
}) {
  const { colors } = useTheme();
  const { premium } = useTaskPresentation();
  if (premium) return <View style={styles.row}>{ALL.map(c => <Choice key={c} label={c} selected={c === value} onPress={() => onChange(c)} />)}</View>;

  return (
    <View style={styles.row}>
      {ALL.map((c) => {
        const active = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? colors.chipActiveBg : colors.surface,
                borderColor: active ? "transparent" : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: active ? colors.chipActiveText : colors.text },
              ]}
            >
              {c}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { fontSize: 13, fontWeight: "900" },
});
