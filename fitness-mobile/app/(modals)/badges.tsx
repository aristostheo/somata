import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import { nutritionTargets } from "@/services/nutritionTargets";
// app/badges/index.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import { withAlpha } from "@/lib/color";

import BadgeCard from "@/components/badges/new/BadgeCard";
import BadgeDetailSheet from "@/components/badges/new/BadgeDetailSheet";

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

// ✅ the exact union type BadgeCard expects
type IoniconName = keyof typeof Ionicons.glyphMap;

function toIoniconName(icon: any): IoniconName {
  // If registry already stores a valid Ionicons key, great.
  // If not, fall back to a safe default.
  const key = String(icon || "");
  return (key in Ionicons.glyphMap ? key : "ribbon") as IoniconName;
}

function toCriteriaLines(criteriaText: any): string[] {
  if (!criteriaText) return [];
  if (Array.isArray(criteriaText)) return criteriaText.map(String);
  // allow string -> single bullet
  return [String(criteriaText)];
}

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

function rarityLabel(r: string) {
  if (r === "common") return "Common";
  if (r === "rare") return "Rare";
  return "Epic";
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
  const router = useRouter();
  const { colors, isDark } = useProfileFlowTheme();
  const { user } = useAuth() as any;

  const [unlocks, setUnlocks] = useState<Record<string, BadgeUnlockState>>({});
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
      const u = await loadUnlocksLocal();
      const f = await loadFeaturedLocal();
      if (!alive) return;
      setUnlocks(u || {});
      setFeatured(f || []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshLocal = React.useCallback(() => {
    let alive = true;
    (async () => {
      const u = await loadUnlocksLocal();
      const f = await loadFeaturedLocal();
      if (!alive) return;
      setUnlocks(u || {});
      setFeatured(f || []);
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
    const proteinGoal = nutritionTargets(profile, { calories: 2400, protein: 160, carbs: 260, fat: 70 }).protein;
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
        await reconcileBadgesFromSnapshot(statsSnapshot);

        const u = await loadUnlocksLocal();
        const f = await loadFeaturedLocal();

        if (!cancelled) {
          setUnlocks(u || {});
          setFeatured(f || []);
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

  const headerBg = colors.surface1;

  const topBarBg = colors.background;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlowAtmosphere />
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Top header with back */}
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 10,
          backgroundColor: topBarBg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: withAlpha(colors.border, isDark ? 0.18 : 0.12),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text
                style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}
              >
                Back
              </Text>
            </View>
          </Pressable>

          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 20 }}>
            Badges
          </Text>

          {/* spacer keeps title centered */}
          <View style={{ width: 64 }} />
        </View>

        <Text
          style={{
            marginTop: 8,
            color: withAlpha(colors.text, isDark ? 0.7 : 0.6),
            fontWeight: "700",
            fontSize: 12,
          }}
          numberOfLines={1}
        >
          Quiet recognition — thoughtful, meaningful, earned.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: headerBg,
              borderColor: withAlpha(colors.border, isDark ? 0.22 : 0.18),
            },
          ]}
        >
          <Text style={[styles.hTitle, { color: colors.text }]}>Library</Text>
          <Text
            style={[
              styles.hSub,
              { color: withAlpha(colors.text, isDark ? 0.72 : 0.62) },
            ]}
          >
            {unlockedCount} unlocked • Quiet recognition, earned.
          </Text>
        </View>

        {groups.map((group) => {
          const unlockedInGroup = group.items.filter(
            (b) => !!unlocks[b.id]
          ).length;
          return (
            <View key={group.key} style={{ marginTop: 14 }}>
              <View style={styles.groupHeader}>
                <Text
                  style={[
                    styles.groupTitle,
                    { color: withAlpha(colors.text, isDark ? 0.85 : 0.75) },
                  ]}
                >
                  {group.label}
                </Text>
                <Text
                  style={[
                    styles.groupMeta,
                    { color: withAlpha(colors.text, isDark ? 0.62 : 0.55) },
                  ]}
                >
                  {unlockedInGroup}/{group.items.length}
                </Text>
              </View>

              <View style={{ marginTop: 10 }}>
                {group.items.map((b) => {
                  const unlocked = !!unlocks[b.id];
                  return (
                    <BadgeCard
                      key={b.id}
                      title={b.title}
                      subtitle={b.subtitle}
                      icon={toIoniconName(b.icon)}
                      accent={b.accent}
                      unlocked={unlocked}
                      rightMeta={rarityLabel(b.rarity)}
                      onPress={() => setSelectedId(b.id)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {!!selected && (
        <BadgeDetailSheet
          visible={!!selectedId}
          onClose={() => setSelectedId(null)}
          title={selected.title}
          subtitle={selected.subtitle}
          description={selected.description}
          icon={toIoniconName(selected.icon)}
          criteriaText={toCriteriaLines(selected.criteriaText)}
          accent={selected.accent}
          unlocked={!!selectedUnlock}
          unlockedAt={selectedUnlock?.unlockedAt}
          rarity={rarityLabel(selected.rarity)}
          categoryLabel={categoryLabel(selected.category)}
          canFeature={!!selected.canFeature}
          isFeatured={featured.includes(selected.id)}
          onToggleFeature={async () => {
            if (!selected.canFeature) return;
            const next = featured.includes(selected.id)
              ? featured.filter((x) => x !== selected.id)
              : [selected.id, ...featured].slice(0, 3);
            setFeatured(next);
            await saveFeaturedLocal(next);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 28 },
  header: {
    borderWidth: 0,
    borderRadius: 18,
    padding: 16,
  },
  hTitle: { fontSize: 22, fontWeight: "700" },
  hSub: { marginTop: 6, fontSize: 13, fontWeight: "400" },
  groupHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  groupTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  groupMeta: { fontSize: 12, fontWeight: "500" },
});
