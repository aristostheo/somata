// app/(tabs)/nutrition.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  Animated,
  Alert,
  StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { useNutritionStreams } from "@/hooks/useNutritionStreams";
import {
  addFood,
  updateFood,
  deleteFood,
  type FoodEntry,
} from "@/services/nutrition";
import { bumpUse, upsertFoodToCatalog } from "@/services/foodCatalog";
import { useNutritionHistory, isoAddDays } from "@/hooks/useNutritionHistory";
import { PENDING_MEAL_BUILDER_LOG_KEY } from "@/services/mealBuilder";

import { DayStrip } from "@/components/nutrition/uiNew/DayStrip";
import { SectionHeader } from "@/components/nutrition/uiNew/SectionHeader";
import { MealCard, MealKey } from "@/components/nutrition/uiNew/MealCard";
import EditFoodSheet from "@/components/nutrition/uiNew/EditFoodSheet";

// ✅ NEW: subscribe to backend profile goals
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nutritionTargets } from "@/services/nutritionTargets";

import { reconcileBadgesFromSnapshot } from "@/services/badges/reconcile";
import { useBadgesLocal } from "@/services/badges/useBadgesLocal";
import { DailyGoalsCard } from "@/components/nutrition/uiNew/DailyGoalsCard";
import { HydrationCardPremium } from "@/components/nutrition/uiNew/HydrationCardPremium";
import { notifyGoalHit } from "@/services/notificationTriggers";
// import { MacroCompletionCard } from "@/components/nutrition/uiNew/MacroCompletionCard";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtNice(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
    16,
  )}, ${alpha})`;
}

const softShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const PENDING_BATCH_KEY = "@pending_add_meal_batch_v1";

function sumMacros(items: FoodEntry[]) {
  return items.reduce(
    (acc, x) => {
      acc.calories += Number(x.calories || 0);
      acc.protein += Number(x.protein || 0);
      acc.carbs += Number(x.carbs || 0);
      acc.fat += Number(x.fat || 0);
      acc.sugar += Number((x as any).sugar || 0);
      acc.fiber += Number((x as any).fiber || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 },
  );
}

function isMealBundle(item: FoodEntry) {
  return (
    item.entryKind === "meal" &&
    Array.isArray(item.items) &&
    item.items.length > 0
  );
}
function CalendarLaunchButton({
  colors,
  onPress,
}: {
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open calendar"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "500", fontSize: 16 }}>
          Calendar
        </Text>
        <Text style={{ color: colors.placeholder ?? colors.muted, fontWeight: "300", fontSize: 12 }}>
          See your consistency story
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.placeholder ?? colors.muted} />
    </Pressable>
  );
}

// ✅ NEW: safe number helper for profile fields
function toNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mealSuggestionsFor(
  meal: MealKey,
  totals: { protein: number; carbs: number; fat: number },
  goals: { protein: number; carbs: number; fat: number },
) {
  const proteinLeft = Math.max(0, Math.round((goals.protein || 0) - (totals.protein || 0)));
  const carbsLeft = Math.max(0, Math.round((goals.carbs || 0) - (totals.carbs || 0)));
  const fatLeft = Math.max(0, Math.round((goals.fat || 0) - (totals.fat || 0)));
  const list: string[] = [];

  if (proteinLeft >= 35) {
    list.push(`You need ${proteinLeft}g protein — try Greek yogurt, cottage cheese, chicken, tuna, tofu, or eggs.`);
  } else if (proteinLeft >= 15) {
    list.push(`${proteinLeft}g protein left — add a protein shake, skyr, turkey slices, edamame, or lentils.`);
  }

  if (carbsLeft >= 50) {
    list.push(`${carbsLeft}g carbs left — oats, rice, potatoes, whole-grain toast, fruit, or quinoa fit well.`);
  } else if (carbsLeft >= 20) {
    list.push(`${carbsLeft}g carbs left — try berries, a banana, rice cakes, or a small wrap.`);
  }

  if (fatLeft >= 20) {
    list.push(`${fatLeft}g fat left — avocado, olive oil, nuts, salmon, hummus, or chia pudding can help.`);
  }

  const defaults: Record<MealKey, string[]> = {
    breakfast: [
      "High-protein breakfast: eggs with toast, Greek yogurt with berries, or tofu scramble.",
      "Balanced option: oats with protein powder, fruit, and nut butter.",
    ],
    lunch: [
      "Lunch idea: chicken or tofu bowl with rice, vegetables, and avocado.",
      "Fast option: tuna wrap, lentil soup, or cottage cheese plate with fruit.",
    ],
    dinner: [
      "Dinner idea: salmon, chicken, tempeh, or lean beef with potatoes and vegetables.",
      "Macro-friendly plate: protein source, whole-grain carb, and a colorful vegetable side.",
    ],
    snacks: [
      "Snack idea: Greek yogurt, cottage cheese, protein smoothie, edamame, or jerky.",
      "Small add-on: fruit with nut butter, hummus with pita, or a boiled egg.",
    ],
  };

  return [...list, ...defaults[meal]].slice(0, 3);
}

export default function NutritionScreen() {
  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();

  const [dateISO, setDateISO] = useState<string>(isoToday());
  const [historyMode, setHistoryMode] = useState<"week" | "month">("week");

  const { refreshBadgesLocal } = useBadgesLocal(true);
  const [dietPreferences, setDietPreferences] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      refreshBadgesLocal();
    }, [refreshBadgesLocal]),
  );

  const [goals, setGoals] = useState(() => ({
    calories: 2400,
    protein: 170,
    carbs: 260,
    fat: 80,

    // optional secondary targets (tweak anytime)
    fiber: 30,
    sugarTotal: 60,
    sugarAdded: 30,
    satFat: 20,
    sodiumMg: 2300,
    cholesterolMg: 300,

    // hydration (optional)
    waterMl: 2400,
  }));
  // ---------- Hydration (per-day, stored locally) ----------
  const [waterMl, setWaterMl] = useState(0);
  const [hydrationStreak, setHydrationStreak] = useState(0);
  const waterGoalMl = goals.waterMl ?? 2400;
  const waterKey = useMemo(() => `@water:${dateISO}`, [dateISO]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(waterKey);
        if (!mounted) return;
        setWaterMl(raw ? Math.max(0, Number(raw) || 0) : 0);
      } catch {
        if (mounted) setWaterMl(0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [waterKey]);

  const setWaterAndStore = (next: number) => {
    const clamped = Math.max(0, Math.round(next));
    setWaterMl(clamped);
    AsyncStorage.setItem(waterKey, String(clamped)).catch(() => {});
  };

  const addWater = (ml: number) => setWaterAndStore(waterMl + ml);
  const clearWater = () => setWaterAndStore(0);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let count = 0;
        for (let i = 0; i < 30; i += 1) {
          const iso = isoAddDays(dateISO, -i);
          const raw =
            iso === dateISO ? String(waterMl) : await AsyncStorage.getItem(`@water:${iso}`);
          const value = Math.max(0, Number(raw || 0) || 0);
          if (value >= waterGoalMl) count += 1;
          else break;
        }
        if (mounted) setHydrationStreak(count);
      } catch {
        if (mounted) setHydrationStreak(waterMl >= waterGoalMl ? 1 : 0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [dateISO, waterGoalMl, waterMl]);

  // ---------- Streams ----------
  const { foods, setFoods, mealsMap, totals } = useNutritionStreams(
    user,
    dateISO,
  );

  // ---------- History ----------
  const historyDaysCount = historyMode === "week" ? 14 : 30;
  const { days: historyDays } = useNutritionHistory(
    user?.uid,
    dateISO,
    historyDaysCount,
  );

  React.useEffect(() => {
    if (!user?.uid) return;

    // your app already uses users/{uid} in other places
    const ref = doc(db as any, "users", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const p = (snap.exists() ? (snap.data() as any) : {}) || {};
        setDietPreferences(p?.dietPreferences ?? null);

        // Support multiple field names (so you don't have to refactor backend today)
        const calories =
          p.dailyCaloriesTarget ??
          p.calorieGoal ??
          p.caloriesGoal ??
          p.kcalGoal;
        const protein =
          p.dailyProteinTarget ?? p.proteinGoal ?? p.protein_target ?? p.pGoal;
        const carbs =
          p.carbGoal ?? p.carbsGoal ?? p.dailyCarbsTarget ?? p.cGoal;
        const fat = p.fatGoal ?? p.fatsGoal ?? p.dailyFatTarget ?? p.fGoal;
        const active = nutritionTargets(p, {
          calories: toNum(calories, 2400), protein: toNum(protein, 170),
          carbs: toNum(carbs, 260), fat: toNum(fat, 80),
        });

        setGoals({
          calories: active.calories,
          protein: active.protein,
          carbs: active.carbs,
          fat: active.fat,

          fiber: toNum(p.fiberGoal ?? p.dailyFiberTarget ?? p.fiber_target, 30),
          sugarTotal: toNum(
            p.sugarTotalGoal ?? p.dailySugarTarget ?? p.sugarGoal,
            60,
          ),
          sugarAdded: toNum(
            p.sugarAddedGoal ?? p.addedSugarGoal ?? p.addedSugar_target,
            30,
          ),
          satFat: toNum(
            p.satFatGoal ?? p.saturatedFatGoal ?? p.sat_fat_goal,
            20,
          ),
          sodiumMg: toNum(
            p.sodiumGoalMg ?? p.sodiumMgGoal ?? p.dailySodiumMgTarget,
            2300,
          ),
          cholesterolMg: toNum(
            p.cholesterolGoalMg ??
              p.cholesterolMgGoal ??
              p.dailyCholesterolMgTarget,
            300,
          ),

          waterMl: toNum(
            p.waterGoalMl ?? p.dailyWaterTargetMl ?? p.hydrationGoalMl,
            2400,
          ),
        });
      },
      () => {
        // if snapshot errors, keep last known goals (no UI break)
      },
    );

    return () => unsub();
  }, [user?.uid]);

  const dayTotals = useMemo(() => {
    if (totals && typeof totals === "object") {
      return {
        calories: Number((totals as any).calories || 0),
        protein: Number((totals as any).protein || 0),
        carbs: Number((totals as any).carbs || 0),
        fat: Number((totals as any).fat || 0),

        fiber: Number((totals as any).fiber || 0),

        // If you only track one sugar value today, treat it as total sugar for now.
        sugarTotal: Number(
          (totals as any).sugarTotal ?? (totals as any).sugar ?? 0,
        ),
        sugarAdded: Number((totals as any).sugarAdded ?? 0),

        satFat: Number((totals as any).satFat ?? 0),
        sodiumMg: Number(
          (totals as any).sodiumMg ?? (totals as any).sodium ?? 0,
        ),
        cholesterolMg: Number((totals as any).cholesterolMg ?? 0),

        // you already track waterMl locally
        waterMl,
      };
    }
    const all = [
      ...(mealsMap?.breakfast || []),
      ...(mealsMap?.lunch || []),
      ...(mealsMap?.dinner || []),
      ...(mealsMap?.snacks || []),
    ] as FoodEntry[];
    const base = sumMacros(all);
    return {
      ...base,
      sugarTotal: (base as any).sugar ?? 0,
      sugarAdded: 0,
      satFat: 0,
      sodiumMg: 0,
      cholesterolMg: 0,
      waterMl,
    };
  }, [totals, mealsMap, waterMl]);

  useEffect(() => {
    if (!user?.uid) return;
    if (dateISO !== isoToday()) return;
    if (goals.calories > 0 && dayTotals.calories >= goals.calories) {
      // NOTIFICATION TRIGGER
      notifyGoalHit("calories").catch(() => {});
    }
  }, [dateISO, dayTotals.calories, goals.calories, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (dateISO !== isoToday()) return;
    if (goals.protein > 0 && dayTotals.protein >= goals.protein) {
      // NOTIFICATION TRIGGER
      notifyGoalHit("protein").catch(() => {});
    }
  }, [dateISO, dayTotals.protein, goals.protein, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (dateISO !== isoToday()) return;
    if (waterGoalMl > 0 && waterMl >= waterGoalMl) {
      // NOTIFICATION TRIGGER
      notifyGoalHit("hydration").catch(() => {});
    }
  }, [dateISO, user?.uid, waterGoalMl, waterMl]);

  React.useEffect(() => {
    if (!user?.uid) return;

    const timer = setTimeout(async () => {
      try {
        await reconcileBadgesFromSnapshot({
          // ✅ use whatever your BadgeStatsSnapshot expects; these names are common
          dateISO,
          calories: dayTotals.calories,
          protein: dayTotals.protein,
          carbs: dayTotals.carbs,
          fat: dayTotals.fat,
          sugar: (dayTotals as any).sugarTotal ?? 0,
          fiber: dayTotals.fiber,
          waterMl,

          goalCalories: goals.calories,
          goalProtein: goals.protein,
          goalCarbs: goals.carbs,
          goalFat: goals.fat,

          // optional: helps badge rules like "logged X foods"
          foodsLogged: foods?.length ?? 0,
        } as any);

        // ✅ pull updated unlocks/progress into app state consumers
        refreshBadgesLocal();
      } catch {
        // non-critical
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    user?.uid,
    dateISO,
    waterMl,
    foods?.length,
    goals.calories,
    goals.protein,
    goals.carbs,
    goals.fat,
    dayTotals.calories,
    dayTotals.protein,
    dayTotals.carbs,
    dayTotals.fat,
    (dayTotals as any).sugarTotal,
    (dayTotals as any).sugarAdded,
    dayTotals.fiber,
    refreshBadgesLocal,
  ]);

  // ---------- Add-meal modal result (keeps your contract) ----------
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!user?.uid) return;

        const raw = await AsyncStorage.getItem("@pending_add_meal");
        if (!raw) return;

        await AsyncStorage.removeItem("@pending_add_meal");
        if (cancelled) return;

        try {
          const data = JSON.parse(raw);

          const base: Omit<FoodEntry, "id"> = {
            date: (data.date || dateISO) as FoodEntry["date"],
            meal: (data.meal || "breakfast") as FoodEntry["meal"],
            name: String(data.name || "").trim(),
            unit: (data.unit || "serving") as FoodEntry["unit"],
            qty: Number(data.qty || 1) as FoodEntry["qty"],
            calories: Number(data.calories || 0) as FoodEntry["calories"],
            protein: Number(data.protein || 0) as FoodEntry["protein"],
            carbs: Number(data.carbs || 0) as FoodEntry["carbs"],
            fat: Number(data.fat || 0) as FoodEntry["fat"],
            ...(data.sugar != null ? { sugar: Number(data.sugar) as any } : {}),
            ...(data.fiber != null ? { fiber: Number(data.fiber) as any } : {}),
            ...(data.addedSugar != null
              ? { addedSugar: Number(data.addedSugar) as any }
              : {}),
            ...(data.satFat != null
              ? { satFat: Number(data.satFat) as any }
              : {}),
            ...(data.sodium != null
              ? { sodium: Number(data.sodium) as any }
              : {}),
            ...(data.wholeFoodRatio != null
              ? { wholeFoodRatio: Number(data.wholeFoodRatio) as any }
              : {}),
            ...(data.veggieFruitServings != null
              ? { veggieFruitServings: Number(data.veggieFruitServings) as any }
              : {}),
            ...(data.unsatFatRatio != null
              ? { unsatFatRatio: Number(data.unsatFatRatio) as any }
              : {}),
            ...(data.alcoholCalories != null
              ? { alcoholCalories: Number(data.alcoholCalories) as any }
              : {}),
          };

          const tempId = `temp-${Date.now()}`;
          const tempItem: FoodEntry = { ...(base as any), id: tempId };
          setFoods((prev: FoodEntry[]) => [tempItem, ...prev]);

          try {
            const ref = await addFood(user.uid, { ...base });
            setFoods((prev: FoodEntry[]) =>
              prev.map((f) => (f.id === tempId ? { ...f, id: ref.id } : f)),
            );
            try {
              const catalogRef = await upsertFoodToCatalog({
                ...base,
                submitterUid: user.uid,
              });
              await bumpUse(catalogRef.id);
            } catch {}
          } catch {
            setFoods((prev: FoodEntry[]) =>
              prev.filter((f) => f.id !== tempId),
            );
          }
        } catch {}
      })();

      return () => {
        cancelled = true;
      };
    }, [user?.uid, dateISO, setFoods]),
  );

  // ---------- Scan-meal batch handoff (@pending_add_meal_batch_v1) ----------
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!user?.uid) return;

        const raw = await AsyncStorage.getItem(PENDING_BATCH_KEY);
        if (!raw) return;

        // ✅ remove first so we don't double-log if anything crashes mid-way
        await AsyncStorage.removeItem(PENDING_BATCH_KEY);
        if (cancelled) return;

        try {
          const data = JSON.parse(raw) as {
            date: string;
            meal: MealKey;
            items: any[];
          };

          const items = Array.isArray(data?.items) ? data.items : [];
          if (!items.length) return;

          // Optional: if the scan was logged for a different day, jump there so user sees it instantly
          if (data?.date && data.date !== dateISO) {
            setDateISO(data.date);
          }

          // Add each scanned food
          for (const it of items) {
            const base: Omit<FoodEntry, "id"> = {
              date: (it.date || data.date || dateISO) as FoodEntry["date"],
              meal: (it.meal || data.meal || "breakfast") as FoodEntry["meal"],
              name: String(it.name || "").trim(),
              unit: (it.unit || "serving") as FoodEntry["unit"],
              qty: Number(it.qty || 1) as FoodEntry["qty"],
              calories: Number(it.calories || 0) as FoodEntry["calories"],
              protein: Number(it.protein || 0) as FoodEntry["protein"],
              carbs: Number(it.carbs || 0) as FoodEntry["carbs"],
              fat: Number(it.fat || 0) as FoodEntry["fat"],

              // ✅ include advanced fields your app supports
              ...(it.sugar != null ? { sugar: Number(it.sugar) as any } : {}),
              ...(it.fiber != null ? { fiber: Number(it.fiber) as any } : {}),
              ...(it.sodium != null
                ? { sodium: Number(it.sodium) as any }
                : {}),
              ...(it.satFat != null
                ? { satFat: Number(it.satFat) as any }
                : {}),
              ...(it.addedSugar != null
                ? { addedSugar: Number(it.addedSugar) as any }
                : {}),
              ...(it.wholeFoodRatio != null
                ? { wholeFoodRatio: Number(it.wholeFoodRatio) as any }
                : {}),
              ...(it.veggieFruitServings != null
                ? {
                    veggieFruitServings: Number(it.veggieFruitServings) as any,
                  }
                : {}),
              ...(it.unsatFatRatio != null
                ? { unsatFatRatio: Number(it.unsatFatRatio) as any }
                : {}),
              ...(it.alcoholCalories != null
                ? { alcoholCalories: Number(it.alcoholCalories) as any }
                : {}),

              // optional meta
              ...(it.source != null
                ? { source: String(it.source) as any }
                : {}),
            };

            // optimistic UI
            const tempId = `temp-scan-${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`;
            const tempItem: FoodEntry = { ...(base as any), id: tempId };
            setFoods((prev: FoodEntry[]) => [tempItem, ...prev]);

            try {
              const ref = await addFood(user.uid, { ...base });
              setFoods((prev: FoodEntry[]) =>
                prev.map((f) => (f.id === tempId ? { ...f, id: ref.id } : f)),
              );
              try {
                const catalogRef = await upsertFoodToCatalog({
                  ...base,
                  submitterUid: user.uid,
                });
                await bumpUse(catalogRef.id);
              } catch {}
            } catch {
              // rollback optimistic insert
              setFoods((prev: FoodEntry[]) =>
                prev.filter((f) => f.id !== tempId),
              );
            }
          }
        } catch (e) {
          // if corrupted payload, don't block future logs
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user?.uid, dateISO, setFoods, setDateISO]),
  );

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!user?.uid) return;

        const raw = await AsyncStorage.getItem(PENDING_MEAL_BUILDER_LOG_KEY);
        if (!raw) return;

        await AsyncStorage.removeItem(PENDING_MEAL_BUILDER_LOG_KEY);
        if (cancelled) return;

        try {
          const data = JSON.parse(raw) as {
            date?: string;
            meal?: MealKey;
            name?: string;
            items?: any[];
            presetId?: string;
            source?: string;
          };

          const mealItems = Array.isArray(data.items) ? data.items : [];
          if (!mealItems.length) return;

          const mealDate = String(data.date || dateISO);
          if (mealDate !== dateISO) setDateISO(mealDate);

          const totals = sumMacros(mealItems as FoodEntry[]);

          const base: Omit<FoodEntry, "id"> = {
            date: mealDate,
            meal: (data.meal || "lunch") as FoodEntry["meal"],
            name: String(data.name || "Saved meal").trim(),
            qty: 1,
            unit: "meal",
            calories: Number(totals.calories || 0),
            protein: Number(totals.protein || 0),
            carbs: Number(totals.carbs || 0),
            fat: Number(totals.fat || 0),
            sugar: mealItems.reduce(
              (sum, item) => sum + Number(item?.sugar || 0),
              0,
            ),
            fiber: mealItems.reduce(
              (sum, item) => sum + Number(item?.fiber || 0),
              0,
            ),
            addedSugar: mealItems.reduce(
              (sum, item) => sum + Number(item?.addedSugar || 0),
              0,
            ),
            satFat: mealItems.reduce(
              (sum, item) => sum + Number(item?.satFat || 0),
              0,
            ),
            sodium: mealItems.reduce(
              (sum, item) => sum + Number(item?.sodium || 0),
              0,
            ),
            veggieFruitServings: mealItems.reduce(
              (sum, item) => sum + Number(item?.veggieFruitServings || 0),
              0,
            ),
            alcoholCalories: mealItems.reduce(
              (sum, item) => sum + Number(item?.alcoholCalories || 0),
              0,
            ),
            entryKind: "meal",
            items: mealItems.map((item) => ({
              id: item?.id,
              name: String(item?.name || "").trim(),
              qty: Number(item?.qty || 0),
              unit: String(item?.unit || "serving"),
              calories: Number(item?.calories || 0),
              protein: Number(item?.protein || 0),
              carbs: Number(item?.carbs || 0),
              fat: Number(item?.fat || 0),
              ...(item?.sugar != null ? { sugar: Number(item.sugar) } : {}),
              ...(item?.fiber != null ? { fiber: Number(item.fiber) } : {}),
              ...(item?.addedSugar != null
                ? { addedSugar: Number(item.addedSugar) }
                : {}),
              ...(item?.satFat != null ? { satFat: Number(item.satFat) } : {}),
              ...(item?.sodium != null ? { sodium: Number(item.sodium) } : {}),
              ...(item?.wholeFoodRatio != null
                ? { wholeFoodRatio: Number(item.wholeFoodRatio) }
                : {}),
              ...(item?.veggieFruitServings != null
                ? { veggieFruitServings: Number(item.veggieFruitServings) }
                : {}),
              ...(item?.unsatFatRatio != null
                ? { unsatFatRatio: Number(item.unsatFatRatio) }
                : {}),
              ...(item?.alcoholCalories != null
                ? { alcoholCalories: Number(item.alcoholCalories) }
                : {}),
              ...(item?.foodRefId != null
                ? { foodRefId: String(item.foodRefId) }
                : {}),
              ...(item?.source != null ? { source: String(item.source) } : {}),
            })),
            ...(data.presetId ? { presetId: String(data.presetId) } : {}),
            source: (data.source || "meal-builder") as any,
          };

          const tempId = `temp-meal-${Date.now()}`;
          const tempItem: FoodEntry = { ...(base as any), id: tempId };
          setFoods((prev: FoodEntry[]) => [tempItem, ...prev]);

          try {
            const ref = await addFood(user.uid, { ...base });
            setFoods((prev: FoodEntry[]) =>
              prev.map((f) => (f.id === tempId ? { ...f, id: ref.id } : f)),
            );
          } catch {
            setFoods((prev: FoodEntry[]) =>
              prev.filter((f) => f.id !== tempId),
            );
          }
        } catch {}
      })();

      return () => {
        cancelled = true;
      };
    }, [dateISO, setDateISO, setFoods, user?.uid]),
  );

  function openQuickAdd(meal: MealKey) {
    router.push({
      pathname: "/(modals)/quick-add",
      params: { meal, date: dateISO },
    });
  }
  function openAdd(meal: MealKey, suggestion?: string) {
    router.push({
      pathname: "/(modals)/add-meal",
      params: {
        meal,
        date: dateISO,
        ...(suggestion
          ? {
              initialTab: "search",
              query: suggestion.split("·")[0].trim(),
            }
          : {}),
      },
    });
  }

  function openWhatShouldIEat() {
    const hour = new Date().getHours();
    const mealContext: MealKey =
      hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snacks";
    router.push({
      pathname: "/(modals)/what-should-i-eat",
      params: {
        date: dateISO,
        meal: mealContext,
        kcalLeft: String(Math.max(0, Math.round(goals.calories - dayTotals.calories))),
        proteinLeft: String(Math.max(0, Math.round(goals.protein - dayTotals.protein))),
        carbsLeft: String(Math.max(0, Math.round(goals.carbs - dayTotals.carbs))),
        fatLeft: String(Math.max(0, Math.round(goals.fat - dayTotals.fat))),
      },
    });
  }

  function openMealBuilder(meal: MealKey) {
    router.push({
      pathname: "/(modals)/meal-builder",
      params: { meal, date: dateISO },
    });
  }

  // ---------- Editing (sheet) ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<FoodEntry | null>(null);

  function startEdit(item: FoodEntry) {
    setEditItem(item);
    setEditOpen(true);
  }

  async function saveEdit(patch: Partial<FoodEntry>) {
    if (!user?.uid || !editItem?.id || editItem.id.startsWith("temp-")) {
      setEditOpen(false);
      setEditItem(null);
      return;
    }

    const prev = foods;
    setFoods((curr: FoodEntry[]) =>
      curr.map((f) => (f.id === editItem.id ? ({ ...f, ...patch } as any) : f)),
    );

    try {
      await updateFood(user.uid, editItem.id, patch as any);
      setEditOpen(false);
      setEditItem(null);
    } catch {
      setFoods(prev);
      Alert.alert("Couldn’t save", "Try again.");
    }
  }

  async function removeItem(item: FoodEntry) {
    if (!user?.uid) return;

    Alert.alert("Delete item?", item.name || "This item", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const prev = foods;
          setFoods((curr: FoodEntry[]) => curr.filter((f) => f.id !== item.id));
          try {
            await deleteFood(user.uid, item.id);
          } catch {
            setFoods(prev);
          }
        },
      },
    ]);
  }

  // ---------- Scroll polish ----------
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerLift = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  const stickyBarOpacity = scrollY.interpolate({
    inputRange: [0, 60, 120],
    outputRange: [0, 0.35, 1],
    extrapolate: "clamp",
  });

  // ---------- Derived per-meal groups ----------
  const timeline = useMemo(() => {
    return MEALS.map((m) => {
      const items = ((mealsMap as any)?.[m] || []) as FoodEntry[];
      return { meal: m, items, totals: sumMacros(items) };
    });
  }, [mealsMap]);

  const caloriesRemaining = Math.max(
    0,
    Math.round((goals.calories || 0) - (dayTotals.calories || 0)),
  );
  const caloriesOver = Math.max(
    0,
    Math.round((dayTotals.calories || 0) - (goals.calories || 0)),
  );
  const proteinLeft = Math.max(
    0,
    Math.round((goals.protein || 0) - (dayTotals.protein || 0)),
  );
  const showHydrationReminder =
    dateISO === isoToday() && waterMl <= 0 && new Date().getHours() >= 11;

  const a11yDateLabel = `Selected day: ${fmtNice(dateISO)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {Platform.OS === "ios" && (
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      )}

      {/* Sticky mini date bar */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          zIndex: 20,
          opacity: stickyBarOpacity,
        }}
      >
        <View
          style={{
            paddingTop: Platform.OS === "ios" ? 54 : 16,
            paddingBottom: 10,
            paddingHorizontal: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
          accessibilityLabel={a11yDateLabel}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "500", fontSize: 20 }}>
                {fmtNice(dateISO)}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "300",
                  fontSize: 12,
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {`${caloriesOver > 0 ? caloriesOver + " kcal over" : caloriesRemaining + " kcal left"} · ${proteinLeft}g protein`}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous day"
                onPress={() => setDateISO((d) => isoAddDays(d, -1))}
                hitSlop={10}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface2,
                }}
              >
                <Ionicons name="chevron-back" size={16} color={colors.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to today"
                onPress={() => setDateISO(isoToday())}
                hitSlop={10}
                style={{
                  paddingHorizontal: 12,
                  height: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  Today
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next day"
                onPress={() => setDateISO((d) => isoAddDays(d, +1))}
                hitSlop={10}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface2,
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 140,
          paddingTop: Platform.OS === "ios" ? 12 : 8,
        }}
      >
        {/* HERO */}
        <Animated.View style={{ transform: [{ translateY: headerLift }] }}>
          <View style={{ paddingTop: Platform.OS === "ios" ? 54 : 18 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <Text
                style={{
                  color: colors.placeholder ?? colors.muted,
                  fontWeight: "500",
                  fontSize: 11,
                  letterSpacing: 1,
                }}
              >
                NUTRITION
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "500",
                  fontSize: 24,
                  marginTop: 4,
                }}
                accessibilityLabel={a11yDateLabel}
              >
                {fmtNice(dateISO)}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "300",
                  fontSize: 13,
                  marginTop: 6,
                  lineHeight: 20,
                }}
              >
                Keep it simple today. Small wins add up.
              </Text>
            </View>

            <View style={{ marginTop: 14 }}>
              <DayStrip
                colors={colors}
                isDark={isDark}
                days={historyDays}
                activeISO={dateISO}
                goals={{ calories: goals.calories }}
                mode={historyMode}
                onPressDay={(d) => setDateISO(d)}
                onToggleMode={() =>
                  setHistoryMode((m) => (m === "week" ? "month" : "week"))
                }
              />
            </View>
            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              <CalendarLaunchButton
                colors={colors}
                onPress={() => router.push("/(modals)/full-calendar")}
              />
            </View>

            <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
              {/* <NutritionSummaryCard
                colors={colors}
                isDark={isDark}
                goals={goals} // ✅ now from backend
                totals={dayTotals}
                onPressLog={() => openAdd("snacks")}
              /> */}
              <DailyGoalsCard
                colors={colors}
                isDark={isDark}
                goals={goals}
                totals={dayTotals as any}
                onPressLog={() => openAdd("snacks")}
                onPressSuggest={openWhatShouldIEat}
                forecast={{ enabled: true }}
                reduceMotion={false /* wire your setting if you have it */}
              />
            </View>
          </View>

          {/* HYDRATION */}
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <SectionHeader
              title="Hydration"
              colors={colors}
            />
            {/* <HydrationCard
              colors={colors}
              isDark={isDark}
              currentMl={waterMl}
              goalMl={waterGoalMl}
              onAdd={(ml) => addWater(ml)}
              onClear={clearWater}
              style={{ marginTop: 10, ...softShadow }}
            /> */}
            <HydrationCardPremium
              colors={colors}
              isDark={isDark}
              currentMl={waterMl}
              goalMl={waterGoalMl}
              onAdd={(ml) => addWater(ml)}
              onClear={clearWater}
              style={{ marginTop: 10, ...softShadow }}
              unit="ml" // or "oz" if you want display-only
              streakDays={hydrationStreak}
              showReminder={showHydrationReminder}
            />
          </View>
        </Animated.View>
        {/* MACRO COMPLETION ---------------------- FIX THIS*/}
        {/* <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <MacroCompletionCard
            dateISO={dateISO}
            totals={{
              calories: dayTotals.calories,
              protein: dayTotals.protein,
              carbs: dayTotals.carbs,
              fat: dayTotals.fat,
              sugarTotal: (dayTotals as any).sugarTotal,
              fiber: dayTotals.fiber,
              sodiumMg: (dayTotals as any).sodiumMg,
              satFat: (dayTotals as any).satFat,
            }}
            goals={{
              calories: goals.calories,
              protein: goals.protein,
              carbs: goals.carbs,
              fat: goals.fat,
              fiber: goals.fiber,
              sugarTotal: goals.sugarTotal,
              sodiumMg: goals.sodiumMg,
              satFat: goals.satFat,
            }}
            dietPreferences={dietPreferences}
          />
        </View> */}

        {/* MEALS */}
        <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 12 }}>
          <SectionHeader
            title="Meals"
            colors={colors}
            right={
              <View style={{ flexDirection: "row", gap: 8 }}>
                {/* regular add  meal feature */}
                {/* <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open quick add meal"
                  onPress={() => openAdd("snacks")}
                  hitSlop={10}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.border, 0.8),
                    backgroundColor: withAlpha(colors.card, 0.22),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="flash-outline"
                    size={16}
                    color={colors.text}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    LOG
                  </Text>
                </Pressable> */}
                {/*  quick add FEATURE */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open meal builder"
                  onPress={() => openQuickAdd("snacks")}
                  hitSlop={10}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="layers-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "500",
                      fontSize: 12,
                    }}
                  >
                    Quick Add
                  </Text>
                </Pressable>
                {/*  MEAL BUILDER FEATURE */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open meal builder"
                  onPress={() => openMealBuilder("snacks")}
                  hitSlop={10}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="layers-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "500",
                      fontSize: 12,
                    }}
                  >
                    Builder
                  </Text>
                </Pressable>
              </View>
            }
          />

          {timeline.map((g) => (
            <MealCard
              key={g.meal}
              meal={g.meal}
              items={g.items}
              totals={g.totals}
              colors={colors}
              isDark={isDark}
              suggestions={mealSuggestionsFor(g.meal, dayTotals, goals)}
              onPressAdd={(suggestion) => openAdd(g.meal, suggestion)}
              onPressItem={(it) => {
                if (!isMealBundle(it)) startEdit(it);
              }}
              onDeleteItem={(it) => removeItem(it)}
            />
          ))}
        </View>
      </Animated.ScrollView>

      {/* Floating action */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 18,
          alignItems: "center",
          zIndex: 30,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open meal builder"
          onPress={() => openMealBuilder("snacks")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            height: 54,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.card,
            ...softShadow,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(colors.primary, 0.1),
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.18),
            }}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.primary, fontWeight: "500" }}>
            Meal Builder
          </Text>
          <Text style={{ color: colors.muted, fontWeight: "300" }}>
            • grouped logging
          </Text>
        </Pressable>
      </View>

      {/* Edit Sheet */}
      <EditFoodSheet
        open={editOpen}
        item={editItem}
        onClose={() => {
          setEditOpen(false);
          setEditItem(null);
        }}
        onSave={(patch) => {
          void saveEdit(patch as any);
        }}
        onDelete={async (id) => {
          if (!user?.uid) return;
          setEditOpen(false);
          setEditItem(null);
          const prev = foods;
          setFoods((curr: FoodEntry[]) => curr.filter((f) => f.id !== id));
          try {
            await deleteFood(user.uid, id);
          } catch {
            setFoods(prev);
            Alert.alert("Couldn't delete", "Try again.");
          }
        }}
      />
    </View>
  );
}
