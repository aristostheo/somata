// hooks/useNutritionStreams.ts
import { useEffect, useMemo, useState } from "react";
import type { FoodEntry, ExerciseEntry } from "@/services/nutrition";
import {
  subscribeFoodsByDate,
  subscribeExerciseByDate,
} from "@/services/nutrition";

export function useNutritionStreams(
  user: { uid: string } | null | undefined,
  date: string
) {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [exercise, setExercise] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    setFoods([]);
    setExercise([]);
    if (!user?.uid) return;
    let active = true;
    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeFoodsByDate(user.uid, date, (rows) => {
      if (active) setFoods(rows);
    }));
    unsubs.push(subscribeExerciseByDate(user.uid, date, (rows) => {
      if (active) setExercise(rows);
    }));
    return () => {
      active = false;
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [user?.uid, date]);

  const mealsMap = useMemo(() => {
    const m: Record<string, FoodEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    foods.forEach((f) => (m[f.meal] ||= []).push(f));
    return m;
  }, [foods]);

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
    foods.forEach((f) => {
      t.calories += f.calories || 0;
      t.protein += f.protein || 0;
      t.carbs += f.carbs || 0;
      t.fat += f.fat || 0;
      t.sugar += f.sugar || 0;
      t.fiber += f.fiber || 0;
    });
    const burned = exercise.reduce((s, e) => s + (e.calories || 0), 0);
    return { ...t, exercise: burned, net: t.calories - burned };
  }, [foods, exercise]);

  return { foods, setFoods, exercise, setExercise, mealsMap, totals };
}
