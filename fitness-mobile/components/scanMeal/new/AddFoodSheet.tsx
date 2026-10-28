import { NutritionContext } from "@/components/nutrition/NutritionTaskUI";
import { Button, Choice, Field, Heading, Panel, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import type { DetectedFood } from "@/components/scanMeal/new/types";
import { clamp, roundTo } from "@/components/scanMeal/new/types";
import { useTheme } from "@/content/ThemeProvider";

export default function AddFoodSheet(props: Parameters<typeof AddFoodSheetContent>[0]) {
  return <SomataTaskAppearance><AddFoodSheetContent {...props} /></SomataTaskAppearance>;
}

function AddFoodSheetContent({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (food: DetectedFood) => void;
}) {
  const { D, F } = useTaskPresentation();

  const { colors } = useTheme() as any;

  const [name, setName] = useState("");
  const [amt, setAmt] = useState("1");
  const [unknownQty, setUnknownQty] = useState(false);

  const canAdd = useMemo(() => {
    if (!name.trim()) return false;
    if (unknownQty) return true;
    const amount = Number(amt);
    return Number.isFinite(amount) && amount > 0;
  }, [name, amt, unknownQty]);

  const commit = () => {
    const amount = unknownQty ? 1 : clamp(roundTo(Number(amt), 0.1), 0.1, 5000);
    const newFood: DetectedFood = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      confidence: "manual",
      portion: { amount, unit: "piece", multiplier: 1 },
      macros: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      rationale: unknownQty ? "Added manually (qty unknown)" : "Added manually",
    };
    onAdd(newFood);
    setName("");
    setAmt("1");
    setUnknownQty(false);
  };

  return (<TaskSheet visible={visible} onClose={onClose} title="Add a missing item">

    <NutritionContext label="Complete your scan" title="Fill in what was missed" detail="Add the food to your review. You can refine its nutrition before final logging." icon="add-circle-outline" />
    <Panel><Heading title="Food details" />

    <Field label="Food name" value={name} onChangeText={setName} placeholder="What was missed?" />

    </Panel><Panel><Heading title="Portion information" />
    <View style={F.wrap}>
      <Choice label="I know the quantity" selected={!unknownQty} onPress={() => setUnknownQty(false)} />
      <Choice label="Quantity unknown" selected={unknownQty} onPress={() => setUnknownQty(true)} />
    </View>

    {!unknownQty && <Field label="Quantity" value={amt} onChangeText={setAmt} keyboardType="decimal-pad" />}

    </Panel>
    <Button label="Add item" primary disabled={!canAdd} onPress={commit} />
  </TaskSheet>
  );
}

function inputStyle(colors: any) {
  return {
    color: colors.text,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700" as const,
    backgroundColor: withAlpha(colors.bg, 0.42),
  };
}

function withAlpha(color: string, alpha = 0.2) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(
    m[3],
    16
  )}, ${alpha})`;
}
