// src/hooks/useNutritionStreams.js
import { useEffect, useMemo, useState } from "react";
import {
  subscribeFoodsByDate,
  subscribeExerciseByDate,
  getRecentFoods,
} from "../services/nutrition";
import { ensureProfile, subscribeProfile } from "../services/profile";

export function useNutritionStreams(user, date) {
  const [foods, setFoods] = useState([]);
  const [exercise, setExercise] = useState([]);
  const [recent, setRecent] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setFoods([]);
    setExercise([]);
    setRecent([]);
    setProfile(null);
    if (!user) return;
    let active = true;
    const unsubs = [];
    unsubs.push(subscribeFoodsByDate(user.uid, date, setFoods));
    unsubs.push(subscribeExerciseByDate(user.uid, date, setExercise));
    getRecentFoods(user.uid, 40).then((items) => {
      if (active) setRecent(items);
    }).catch(console.error);

    (async () => {
      await ensureProfile(user.uid, { email: user.email });
      if (!active) return;
      const unsub = subscribeProfile(user.uid, setProfile);
      unsubs.push(unsub);
    })().catch(console.error);

    return () => {
      active = false;
      for (const u of unsubs) {
        try { typeof u === "function" && u(); } catch {}
      }
    };
  }, [user, date]);

  const mealsMap = useMemo(() => {
    const m = { breakfast: [], lunch: [], dinner: [], snacks: [] };
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
    const ex = exercise.reduce((s, e) => s + (e.calories || 0), 0);
    return { ...t, exercise: ex, net: t.calories - ex };
  }, [foods, exercise]);

  return { foods, setFoods, exercise, setExercise, recent, profile, mealsMap, totals };
}
