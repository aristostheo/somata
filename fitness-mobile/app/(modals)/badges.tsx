import { useAccountStorage } from '@/services/local/accountStore';
import { nutritionTargets } from "@/services/nutritionTargets";
// app/badges/index.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/content/AuthContext";
import { BadgeCollection, BadgeCollectionDetail } from "@/components/homeFlows/BadgeCollection";

import { BADGES } from "@/services/badges/registry";
import {
  loadUnlocksLocal,
  loadFeaturedLocal,
  saveFeaturedLocal,
} from "@/services/badges/store";
import type {
  BadgeUnlockState,
  BadgeStatsSnapshot,
} from "@/services/badges/types";
import { reconcileBadgesFromSnapshot } from "@/services/badges/reconcile";

import { subscribeProfile, type Profile } from "@/services/profile";
import {
  subscribeFoodsBetween,
  subscribeExerciseBetween,
  type FoodEntry,
  type ExerciseEntry,
} from "@/services/nutrition";
import { useFocusEffect } from "expo-router";

/* ───────────────── helpers ───────────────── */
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (date: Date, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

// ISO week key: YYYY-Www
function getISOWeekKey(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    consistency: "Consistency",
    strength: "Strength",
    nutrition: "Nutrition",
    recovery: "Recovery",
    habits: "Habits",
    milestones: "Milestones",
    premium: "Premium",
  };
  return map[c] || c;
}

/* ───────────────── screen ───────────────── */
export default function BadgesScreen() {
  const localStore = useAccountStorage();
  const router = useRouter();
  const { user } = useAuth() as any;

  const [unlocks, setUnlocks] = useState<Record<string, BadgeUnlockState>>({});
  const [localLoaded, setLocalLoaded] = useState(false);
  const [featured, setFeatured] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // data needed to build snapshot
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foodsWeek, setFoodsWeek] = useState<FoodEntry[]>([]);
  const [foodsAll, setFoodsAll] = useState<FoodEntry[]>([]);
  const [workoutsWeek, setWorkoutsWeek] = useState<ExerciseEntry[]>([]);
  const [workoutsAll, setWorkoutsAll] = useState<ExerciseEntry[]>([]);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => ymd(today), [today]);
  const weekKey = useMemo(() => getISOWeekKey(today), [today]);
  const weekStartStr = useMemo(() => ymd(addDays(today, -6)), [today]);

  // Load local badge state (fast UI)
  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await loadUnlocksLocal(localStore);
      const f = await loadFeaturedLocal(localStore);
      if (!alive) return;
      setUnlocks(u || {});
      setFeatured(f || []);
      setLocalLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshLocal = React.useCallback(() => {
    let alive = true;
    (async () => {
      const u = await loadUnlocksLocal(localStore);
      const f = await loadFeaturedLocal(localStore);
      if (!alive) return;
      setUnlocks(u || {});
      setFeatured(f || []);
      setLocalLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const cleanup = refreshLocal();
      return cleanup;
    }, [refreshLocal])
  );

  // Subscribe to user data (for retroactive awarding)
  useEffect(() => {
    if (!user?.uid) return;

    let unsubProfile: undefined | (() => void);
    let unsubFoodsWeek: undefined | (() => void);
    let unsubFoodsAll: undefined | (() => void);
    let unsubWorkoutsWeek: undefined | (() => void);
    let unsubWorkoutsAll: undefined | (() => void);

    unsubProfile = subscribeProfile(user.uid, setProfile);

    unsubFoodsWeek = subscribeFoodsBetween(
      user.uid,
      weekStartStr,
      todayStr,
      (arr) => setFoodsWeek(arr || [])
    );
    unsubWorkoutsWeek = subscribeExerciseBetween(
      user.uid,
      weekStartStr,
      todayStr,
      (arr) => setWorkoutsWeek(arr || [])
    );

    // “All time” (pragmatic). If this becomes heavy later, replace with counters doc.
    unsubFoodsAll = subscribeFoodsBetween(
      user.uid,
      "2000-01-01",
      todayStr,
      (arr) => setFoodsAll(arr || [])
    );
    unsubWorkoutsAll = subscribeExerciseBetween(
      user.uid,
      "2000-01-01",
      todayStr,
      (arr) => setWorkoutsAll(arr || [])
    );

    return () => {
      try {
        unsubProfile?.();
        unsubFoodsWeek?.();
        unsubFoodsAll?.();
        unsubWorkoutsWeek?.();
        unsubWorkoutsAll?.();
      } catch {}
    };
  }, [user?.uid, todayStr, weekStartStr]);

  // Build snapshot used by the badge engine
  const statsSnapshot: BadgeStatsSnapshot | null = useMemo(() => {
    if (!user?.uid) return null;

    const stepsGoal = Number((profile as any)?.stepsGoal ?? 8000);
    const stepsMap =
      (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    const stepsToday = Number(stepsMap?.[todayStr] ?? 0);

    const workoutsThisWeek = workoutsWeek.length;

    // Workout streak: consecutive days ending today with >=1 workout.
    // Assumes ExerciseEntry has `date` (string YYYY-MM-DD)
    const workoutDates = new Set(
      (workoutsAll || [])
        .map((w: any) => String(w?.date || "").slice(0, 10))
        .filter((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s))
    );

    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = ymd(addDays(today, -i));
      if (workoutDates.has(d)) streak++;
      else break;
    }

    // nutrition: protein/fiber days this week
    const proteinGoal = nutritionTargets(profile).protein;
    const fiberMin = Number((profile as any)?.fiberGoal ?? 25);

    const proteinByDay: Record<string, number> = {};
    const fiberByDay: Record<string, number> = {};

    for (const f of foodsWeek || []) {
      const dateKey = String((f as any)?.date || "").slice(0, 10);
      if (!dateKey) continue;
      proteinByDay[dateKey] =
        (proteinByDay[dateKey] || 0) + Number((f as any)?.protein || 0);
      fiberByDay[dateKey] =
        (fiberByDay[dateKey] || 0) + Number((f as any)?.fiber || 0);
    }

    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(today, -i)));

    const proteinDaysThisWeek = days.filter(
      (d) => (proteinByDay[d] || 0) >= proteinGoal * 0.8
    ).length;

    const fiberDaysThisWeek = days.filter(
      (d) => (fiberByDay[d] || 0) >= fiberMin
    ).length;

    const stepsDays10kThisWeek = days.filter(
      (d) => Number(stepsMap?.[d] || 0) >= 10000
    ).length;

    return {
      // weekly
      workoutsThisWeek,
      mealsLoggedThisWeek: foodsWeek.length,
      proteinDaysThisWeek,
      fiberDaysThisWeek,
      stepsDays10kThisWeek,

      // streaks / today
      workoutsStreakDays: streak,
      stepsToday,
      stepsGoal,

      // totals
      totalWorkoutsAllTime: workoutsAll.length,
      totalMealsAllTime: foodsAll.length,

      // optional PRs
      bestBenchKg: undefined,
      bestSquatKg: undefined,
      bestDeadliftKg: undefined,

      todayKey: todayStr,
      weekKey,
    } as BadgeStatsSnapshot;
  }, [
    user?.uid,
    profile,
    foodsWeek,
    foodsAll,
    workoutsWeek,
    workoutsAll,
    todayStr,
    weekKey,
    today,
  ]);

  const statsSnapshotReady = !!statsSnapshot;

  // Avoid reconcile spam
  const lastReconcileKeyRef = useRef<string>("");

  // Retroactive reconcile (award what they already earned)
  useEffect(() => {
    if (!user?.uid) return;
    if (!statsSnapshotReady || !statsSnapshot) return;

    const key = [
      statsSnapshot.todayKey,
      statsSnapshot.weekKey,
      statsSnapshot.totalWorkoutsAllTime,
      statsSnapshot.totalMealsAllTime,
      statsSnapshot.workoutsStreakDays,
      statsSnapshot.workoutsThisWeek,
      statsSnapshot.proteinDaysThisWeek,
      statsSnapshot.fiberDaysThisWeek,
      statsSnapshot.stepsToday,
      statsSnapshot.stepsDays10kThisWeek,
    ].join("|");

    if (lastReconcileKeyRef.current === key) return;
    lastReconcileKeyRef.current = key;

    let cancelled = false;

    (async () => {
      try {
        await reconcileBadgesFromSnapshot(statsSnapshot, localStore);

        const u = await loadUnlocksLocal(localStore);
        const f = await loadFeaturedLocal(localStore);

        if (!cancelled) {
          setUnlocks(u || {});
          setFeatured(f || []);
          setLocalLoaded(true);
        }
      } catch {
        // badges are non-critical
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, statsSnapshotReady, statsSnapshot]);

  const groups = useMemo(() => {
    const g: Record<string, typeof BADGES> = {};
    for (const b of BADGES) {
      g[b.category] = g[b.category] || [];
      g[b.category].push(b);
    }
    const order = [
      "consistency",
      "strength",
      "nutrition",
      "recovery",
      "habits",
      "milestones",
      "premium",
    ];
    return order
      .filter((k) => g[k]?.length)
      .map((k) => ({ key: k, label: categoryLabel(k), items: g[k] }));
  }, []);

  const unlockedCount = useMemo(() => Object.keys(unlocks).length, [unlocks]);

  const selected = selectedId ? BADGES.find((b) => b.id === selectedId) : null;
  const selectedUnlock = selected ? unlocks[selected.id] : null;

  return <>
    <BadgeCollection loaded={localLoaded} groups={groups} unlocks={unlocks} featured={featured} unlockedCount={unlockedCount}
      onSelect={setSelectedId} onBack={() => router.back()} />
    {!!selected && <BadgeCollectionDetail badge={selected} unlocked={selectedUnlock || undefined}
      category={categoryLabel(selected.category)} isFeatured={featured.includes(selected.id)}
      onClose={() => setSelectedId(null)} onToggleFeature={async () => {
        if (!selected.canFeature) return;
        const next = featured.includes(selected.id)
          ? featured.filter((x) => x !== selected.id)
          : [selected.id, ...featured].slice(0, 3);
        setFeatured(next);
        await saveFeaturedLocal(next, localStore);
      }} />}
  </>;
}
