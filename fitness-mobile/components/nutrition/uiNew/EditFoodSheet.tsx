import { Button, Choice, Field, Heading, Panel, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  Text,
  View
} from "react-native";

import { useTheme } from "@/content/ThemeProvider";
import type { FoodEntry } from "@/services/nutrition";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type EditValues = {
  qty: string;
  unit: string;
  meal: MealKey;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  _baseQty: string;
  _baseCalories: string;
  _baseProtein: string;
  _baseCarbs: string;
  _baseFat: string;
};

const UNIT_OPTIONS = ["serving", "g", "oz", "ml"] as const;
const MEAL_OPTIONS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

function numOnly(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function toNum(value: string, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function scaleText(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function sourceLabel(item: FoodEntry | null) {
  if (!item?.source) return "Logged food";
  if (item.source === "manual") return "Manual entry";
  if (item.source === "catalog") return "Food database";
  if (item.source === "recent") return "Recent food";
  return String(item.source);
}

function mealLabel(meal: MealKey) {
  if (meal === "snacks") return "Snack";
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

function mealForTime(): MealKey {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snacks";
}

export default function EditFoodSheet({
  open,
  item,
  onSave,
  onClose,
  onDelete,
  saving,
  deleting,
}: {
  open: boolean;
  item: FoodEntry | null;
  onSave: (patch: Partial<FoodEntry>) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  const { D, F } = useSomataTheme();

  const { colors } = useTheme() as any;
  const [values, setValues] = useState<EditValues>({
    qty: "1",
    unit: "serving",
    meal: mealForTime(),
    calories: "0",
    protein: "0",
    carbs: "0",
    fat: "0",
    _baseQty: "1",
    _baseCalories: "0",
    _baseProtein: "0",
    _baseCarbs: "0",
    _baseFat: "0",
  });
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    const qty = String(item.qty ?? 1);
    setValues({
      qty,
      unit: String(item.unit || "serving"),
      meal: (item.meal as MealKey) || mealForTime(),
      calories: String(item.calories ?? 0),
      protein: String(item.protein ?? 0),
      carbs: String(item.carbs ?? 0),
      fat: String(item.fat ?? 0),
      _baseQty: qty,
      _baseCalories: String(item.calories ?? 0),
      _baseProtein: String(item.protein ?? 0),
      _baseCarbs: String(item.carbs ?? 0),
      _baseFat: String(item.fat ?? 0),
    });
  }, [open, item]);

  useEffect(() => {
    return () => {
      if (holdRef.current) clearInterval(holdRef.current);
    };
  }, []);

  const preview = useMemo(
    () => [
      { label: "Calories", value: `${Math.round(toNum(values.calories))}` },
      { label: "Protein", value: `${Math.round(toNum(values.protein))}g` },
      { label: "Carbs", value: `${Math.round(toNum(values.carbs))}g` },
      { label: "Fat", value: `${Math.round(toNum(values.fat))}g` },
    ],
    [values.calories, values.carbs, values.fat, values.protein],
  );

  if (!item) return null;

  function stopHold() {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }

  function applyQty(nextRaw: string) {
    setValues((prev) => {
      const clean = numOnly(nextRaw);
      const nextQty = toNum(clean, 0);
      const baseQty = toNum(prev._baseQty, 1);
      if (nextQty <= 0 || baseQty <= 0) {
        return { ...prev, qty: clean };
      }
      const ratio = nextQty / baseQty;
      return {
        ...prev,
        qty: clean,
        calories: scaleText(toNum(prev._baseCalories) * ratio),
        protein: scaleText(toNum(prev._baseProtein) * ratio),
        carbs: scaleText(toNum(prev._baseCarbs) * ratio),
        fat: scaleText(toNum(prev._baseFat) * ratio),
      };
    });
  }

  function nudgeQty(delta: number) {
    const current = toNum(values.qty || "0", 0);
    const next = Math.max(0.1, Math.round((current + delta) * 10) / 10);
    applyQty(String(next));
  }

  function startHold(delta: number) {
    stopHold();
    holdRef.current = setInterval(() => nudgeQty(delta), 120);
  }

  function submit() {
    Keyboard.dismiss();
    onSave({
      qty: Math.max(0.1, toNum(values.qty, 1)),
      unit: values.unit.trim() || "serving",
      meal: values.meal,
      calories: Math.max(0, toNum(values.calories, 0)),
      protein: Math.max(0, toNum(values.protein, 0)),
      carbs: Math.max(0, toNum(values.carbs, 0)),
      fat: Math.max(0, toNum(values.fat, 0)),
    });
  }

  return (<TaskSheet title={item.name} visible={open} onClose={() => { Keyboard.dismiss(); onClose(); }}>

    <Text style={F.caption}>{sourceLabel(item)}</Text>
    <Heading title="Portion" detail="Changing quantity scales calories and macros from the original portion." />

    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
      {[-0.1, 0.1].slice(0, 1).map(d => <Pressable key={d} accessibilityRole="button" accessibilityLabel="Decrease portion" onPress={() => nudgeQty(d)} onLongPress={() => startHold(d)} onPressOut={stopHold} style={{ padding: 16, backgroundColor: D.raised, borderRadius: 16 }}>
        <Text style={F.heading}>−</Text>
      </Pressable>)}
      <Field label="Quantity" keyboardType="decimal-pad" value={values.qty} onChangeText={applyQty} />
      <Pressable accessibilityRole="button" accessibilityLabel="Increase portion" onPress={() => nudgeQty(0.1)} onLongPress={() => startHold(0.1)} onPressOut={stopHold} style={{ padding: 16, backgroundColor: D.raised, borderRadius: 16 }}>
        <Text style={F.heading}>+</Text>
      </Pressable>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {UNIT_OPTIONS.map(unit => <Choice key={unit} label={unit} selected={values.unit === unit} onPress={() => setValues(v => ({ ...v, unit }))} />)}
    </View>
    <Field label="Unit" value={values.unit} onChangeText={unit => setValues(v => ({ ...v, unit }))} />

    <Heading title="Meal" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {MEAL_OPTIONS.map(meal => <Choice key={meal} label={mealLabel(meal)} selected={values.meal === meal} onPress={() => setValues(v => ({ ...v, meal }))} />)}
    </View>

    <Panel>
      <Heading title="Nutrition" />
      {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => <Field key={k} label={`${k} · ${k === 'calories' ? 'kcal' : 'g'}`} keyboardType="decimal-pad" value={values[k]} onChangeText={s => setValues(v => ({ ...v, [k]: numOnly(s) }))} />)}
    </Panel>
    <Button primary disabled={saving || deleting} label={saving ? 'Saving…' : 'Save changes'} onPress={submit} />
    {onDelete && <Button danger disabled={saving || deleting} label={deleting ? 'Deleting…' : 'Delete food'} onPress={() => onDelete(item.id)} />}
  </TaskSheet>
  );
}
