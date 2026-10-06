import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/content/AuthContext";
import { nutritionTargets } from "@/services/nutritionTargets";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeFoodsBetween, type FoodEntry } from "@/services/nutrition";
import { subscribeWorkouts, type Workout } from "@/services/workouts";
import {
  subscribeProfile,
  ensureProfile,
  type Profile,
} from "@/services/profile";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date: Date, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export function useInsights() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const uid = user?.uid;

  const [foods7, setFoods7] = useState<FoodEntry[]>([]);
  const [workouts30, setWorkouts30] = useState<Workout[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // load 7d foods + 30d workouts + profile
  useEffect(() => {
    if (!uid) return;
    const unsubs: Array<() => void> = [];

    const today = new Date();
    const from7 = ymd(addDays(today, -6)),
      to7 = ymd(today);
    unsubs.push(subscribeFoodsBetween(uid, from7, to7, setFoods7));

    unsubs.push(
      subscribeWorkouts(uid, (all: Workout[]) => {
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - 29);
        const start = `${from.getFullYear()}-${String(
          from.getMonth() + 1
        ).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
        const end = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        setWorkouts30(
          all.filter((w) => (w.date || "") >= start && (w.date || "") <= end)
        );
      })
    );

    (async () => {
      await ensureProfile(uid, {});
      unsubs.push(subscribeProfile(uid, setProfile));
    })();

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [uid]);

  /* Average Protein (7d) */
  const avgProtein7d = useMemo(() => {
    const byDay: Record<string, number> = {};
    foods7.forEach((f) => {
      byDay[f.date] = (byDay[f.date] || 0) + (f.protein || 0);
    });
    const days = Object.keys(byDay);
    const total = days.reduce((s, d) => s + byDay[d], 0);
    const avg = days.length ? total / days.length : 0;
    const target = nutritionTargets(profile, { calories: 2400, protein: 130, carbs: 260, fat: 70 }).protein;
    const tip =
      avg >= target
        ? "Nice! You’re meeting your protein goal."
        : "Try adding a protein-dense snack.";
    return { grams: Math.round(avg), target, tip };
  }, [foods7, profile]);

  /* Bench 1RM (best of 30d) using Epley */
  const bench1RM = useMemo(() => {
    const benchLike = workouts30.filter((w) =>
      (w.exercise || "").toLowerCase().includes("bench")
    );
    let best = 0;
    let note = "";
    const unit = "kg"; // stored in KG
    for (const w of benchLike) {
      const wkg = Number(w.weight || 0);
      const reps = Number(w.reps || 0);
      if (wkg <= 0 || reps <= 0) continue;
      const est = Math.round(wkg * (1 + reps / 30));
      if (est > best) {
        best = est;
        note = `${wkg}×${reps} on ${w.date}`;
      }
    }
    return { value: best, unit, source: note };
  }, [workouts30]);

  /* Calories/Weight arrays for 7d spark */
  const calories7d = useMemo(() => {
    const today = new Date();
    const start = addDays(today, -6);
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i)));
    const sums: Record<string, number> = Object.fromEntries(
      days.map((d) => [d, 0])
    );
    foods7.forEach((f) => {
      sums[f.date] = (sums[f.date] || 0) + (f.calories || 0);
    });
    return days.map((d) => ({
      date: d.slice(5),
      value: Math.round(sums[d] || 0),
    }));
  }, [foods7]);

  const weightHistory = (profile as any)?.weightHistory as
    | Array<{ date: string; value: number }>
    | undefined;
  const weight7d = useMemo(() => {
    if (!weightHistory?.length) return [];
    const today = new Date();
    const start = addDays(today, -6);
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i)));
    const map: Record<string, number | undefined> = {};
    for (const entry of weightHistory) map[entry.date] = entry.value;
    return days
      .map((d) =>
        map[d] != null ? { date: d.slice(5), value: map[d]! } : undefined
      )
      .filter(Boolean) as { date: string; value: number }[];
  }, [weightHistory]);

  const hasWeightData = !!weight7d.length;

  return {
    avgProtein7d,
    bench1RM,
    calories7d,
    weight7d,
    hasWeightData,
    colors,
  };
}
