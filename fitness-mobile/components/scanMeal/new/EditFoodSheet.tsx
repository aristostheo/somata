import { Button, Choice, Field, Panel, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import React, { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

import type {
  DetectedFood,
  PortionUnit,
} from "@/components/scanMeal/new/types";
import { DEFAULT_UNITS, clamp, roundTo } from "@/components/scanMeal/new/types";
import { useTheme } from "@/content/ThemeProvider";

export default function EditFoodSheet({
  visible,
  food,
  onClose,
  onSave,
  onRemove,
}: {
  visible: boolean;
  food: DetectedFood | null;
  onClose: () => void;
  onSave: (f: DetectedFood) => void;
  onRemove?: () => void;
}) {
  const { D, F } = useSomataTheme();

  const { colors } = useTheme() as any;

  const [name, setName] = useState(food?.name ?? "");
  const [amt, setAmt] = useState(String(food?.portion.amount ?? 1));
  const [unit, setUnit] = useState<PortionUnit>(
    (food?.portion.unit ?? "g") as PortionUnit
  );

  const [cals, setCals] = useState(String(food?.macros.calories ?? 0));
  const [p, setP] = useState(String(food?.macros.protein ?? 0));
  const [c, setC] = useState(String(food?.macros.carbs ?? 0));
  const [f, setF] = useState(String(food?.macros.fat ?? 0));

  const lastAmtRef = useRef<number>(Number(food?.portion.amount ?? 1) || 1);

  React.useEffect(() => {
    if (!food) return;

    setName(food.name);
    setAmt(String(food.portion.amount));
    setUnit(food.portion.unit);
    setCals(String(food.macros.calories ?? 0));
    setP(String(food.macros.protein ?? 0));
    setC(String(food.macros.carbs ?? 0));
    setF(String(food.macros.fat ?? 0));
    lastAmtRef.current = Number(food.portion.amount ?? 1) || 1;
  }, [food?.id]);

  const canSave = useMemo(() => {
    if (!food) return false;
    if (!name.trim()) return false;
    const parsed = parseLooseNumber(amt);
    return parsed != null && parsed > 0;
  }, [food, name, amt]);

  const onChangeAmt = (next: string) => {
    setAmt(next);
    const nextNumRaw = parseLooseNumber(next);
    if (nextNumRaw == null || nextNumRaw <= 0) return;

    const nextNum = clamp(roundTo(nextNumRaw, 0.1), 0.1, 5000);
    const prevNum = lastAmtRef.current;
    if (!Number.isFinite(prevNum) || prevNum <= 0) {
      lastAmtRef.current = nextNum;
      return;
    }
    if (Math.abs(nextNum - prevNum) < 0.0001) return;

    const ratio = nextNum / prevNum;
    setCals((prev) => formatMaybeInt(scaleField(prev, ratio, true)));
    setP((prev) => formatMaybeFloat(scaleField(prev, ratio, false)));
    setC((prev) => formatMaybeFloat(scaleField(prev, ratio, false)));
    setF((prev) => formatMaybeFloat(scaleField(prev, ratio, false)));
    lastAmtRef.current = nextNum;
  };

  const commit = () => {
    if (!food) return;

    const amountParsed = parseLooseNumber(amt) ?? 1;
    const amount = clamp(roundTo(amountParsed, 0.1), 0.1, 5000);

    onSave({
      ...food,
      name: name.trim(),
      portion: { amount, unit, multiplier: 1 },
      macros: {
        calories: Math.max(0, Math.round(parseLooseNumber(cals) ?? 0)),
        protein: Math.max(0, parseLooseNumber(p) ?? 0),
        carbs: Math.max(0, parseLooseNumber(c) ?? 0),
        fat: Math.max(0, parseLooseNumber(f) ?? 0),
      },
    });
  };

  return (<TaskSheet visible={visible} onClose={onClose} title="Refine this food">

    <Field label="Food name" value={name} onChangeText={setName} />

    <Field label="Portion" value={amt} onChangeText={onChangeAmt} keyboardType="decimal-pad" />

    <View style={F.wrap}>
      {DEFAULT_UNITS.map(value => <Choice key={value} label={value} selected={unit === value} onPress={() => setUnit(value)} />)}
    </View>

    <Text style={F.caption}>Changing the amount scales the current nutrition values.</Text>

    <Panel>
      {[{ label: 'Calories', value: cals, set: setCals }, { label: 'Protein (g)', value: p, set: setP }, { label: 'Carbs (g)', value: c, set: setC }, { label: 'Fat (g)', value: f, set: setF }].map(field =>
        <Field key={field.label} label={field.label} value={field.value} onChangeText={field.set} keyboardType="decimal-pad" />)}
    </Panel>

    <Button label="Save changes" primary disabled={!canSave} onPress={commit} />
    {!!onRemove && <Button label="Remove item" danger icon="trash-outline" onPress={onRemove} />}
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

function parseLooseNumber(input: string): number | null {
  const t = String(input ?? "").replace(/,/g, ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function scaleField(prev: string, ratio: number, roundInt: boolean) {
  const prevNum = parseLooseNumber(prev) ?? 0;
  const next = prevNum * ratio;
  if (!Number.isFinite(next)) return 0;
  return roundInt ? Math.round(next) : roundTo(next, 0.1);
}

function formatMaybeInt(n: number) {
  return String(Math.max(0, Math.round(n)));
}

function formatMaybeFloat(n: number) {
  return String(Math.max(0, roundTo(n, 0.1)));
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
