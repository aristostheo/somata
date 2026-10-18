import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  StatusBar,
  RefreshControl,
  Pressable,
  ColorValue,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAccountStorage } from "@/services/local/accountStore";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/content/AuthContext";
import { useNutritionStreams } from "@/hooks/useNutritionStreams";
import { useNutritionHistory } from "@/hooks/useNutritionHistory";
import { addFood, deleteFood, type FoodEntry } from "@/services/nutrition";

import { getNutritionTheme } from "./NutritionTheme";
import DayHeader from "./DayHeader";
import RingSummaryCard from "./RingSummaryCard";
import HydrationCard from "./HydrationCard";
import MealSection from "./MealSection";
import AddMealSheet from "./AddMealSheet";
import HistorySheet from "./HistorySheet";

import type { DayLog, MealItem, MealType } from "./NutritionTypes";
import {
  alpha,
  dateKey as localDateKey,
  addDays as addDaysKey,
  sumMacros,
} from "./utils";

// Convert your FoodEntry.createdAt -> ISO time for display + sorting
function createdAtToISO(createdAt?: any) {
  if (!createdAt) return undefined;
  // Firestore Timestamp
  if (typeof createdAt?.toDate === "function") {
    return createdAt.toDate().toISOString();
  }
  // epoch ms
  if (typeof createdAt === "number") {
    return new Date(createdAt).toISOString();
  }
  return undefined;
}

function toMealItem(entry: FoodEntry): MealItem {
  return {
    id: entry.id,
    name: String(entry.name || ""),
    amount: `${Math.round(Number(entry.qty || 1))} ${String(
      entry.unit || "serving"
    )}`,
    mealType: (entry.meal as MealType) || "breakfast",
    timeISO: createdAtToISO(entry.createdAt) ?? new Date().toISOString(),
    macros: {
      calories: Number(entry.calories || 0),
      protein: Number(entry.protein || 0),
      carbs: Number(entry.carbs || 0),
      fat: Number(entry.fat || 0),
    },
    notes: undefined,
  };
}

export default function NutritionScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const colors = useMemo(() => getNutritionTheme(isDark), [isDark]);

  const { user } = useAuth();
  const localStore = useAccountStorage();

  // dateISO is the selected day (YYYY-MM-DD)
  const [dateISO, setDateISO] = useState<string>(localDateKey(new Date()));

  // 🔥 Your backend streams (same logic as old page)
  const { foods, setFoods, mealsMap, totals } = useNutritionStreams(
    user,
    dateISO
  );

  // 🔥 Your history hook (same logic as old page)
  const [historyMode, setHistoryMode] = useState<"week" | "month">("week");
  const historyDaysCount = historyMode === "week" ? 14 : 30;
  const { days: historyDays } = useNutritionHistory(
    user?.uid,
    dateISO,
    historyDaysCount
  );

  // Hydration stays per-day local (same logic as old page)
  const [waterMl, setWaterMl] = useState(0);
  const waterGoalMl = 2400;
  const waterKey = useMemo(() => `@water:${dateISO}`, [dateISO]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await localStore.getItem(waterKey);
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
    localStore.setItem(waterKey, String(clamped)).catch(() => {});
  };

  // Sheets
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState<MealType | undefined>(
    undefined
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  // Build the DayLog the NEW UI expects, from your backend data
  const day: DayLog | null = useMemo(() => {
    if (!user?.uid) return null;

    const all: MealItem[] = [];
    const b = ((mealsMap as any)?.breakfast || []) as FoodEntry[];
    const l = ((mealsMap as any)?.lunch || []) as FoodEntry[];
    const d = ((mealsMap as any)?.dinner || []) as FoodEntry[];
    const s = ((mealsMap as any)?.snacks || []) as FoodEntry[];

    for (const it of b) all.push(toMealItem(it));
    for (const it of l) all.push(toMealItem(it));
    for (const it of d) all.push(toMealItem(it));
    for (const it of s) all.push(toMealItem(it));

    // Sort newest first using timeISO (createdAt)
    all.sort((a, b) => (a.timeISO < b.timeISO ? 1 : -1));

    // Prefer totals from hook, fallback to sum
    const computedTotals =
      totals && typeof totals === "object"
        ? {
            calories: Number((totals as any).calories || 0),
            protein: Number((totals as any).protein || 0),
            carbs: Number((totals as any).carbs || 0),
            fat: Number((totals as any).fat || 0),
          }
        : sumMacros(all);

    // Keep your current placeholder goals (swap to profile later)
    const macroGoals = { calories: 2400, protein: 170, carbs: 260, fat: 80 };

    return {
      dateKey: dateISO,
      meals: all,
      waterMl,
      waterGoalMl,
      macroGoals,
    };
  }, [user?.uid, dateISO, mealsMap, totals, waterMl]);

  const bgGradient: [ColorValue, ColorValue, ColorValue] = isDark
    ? [colors.bg, "#0A1020", colors.bg]
    : [colors.bg, "#EEF3FF", colors.bg];

  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    Haptics.selectionAsync();
    setTimeout(() => setRefreshing(false), 450);
  }

  async function handleDeleteMeal(mealId: string) {
    if (!user?.uid) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const prev = foods as FoodEntry[];
    setFoods((curr: FoodEntry[]) => curr.filter((f) => f.id !== mealId));

    try {
      await deleteFood(user.uid, mealId);
    } catch {
      setFoods(prev);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 108 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <DayHeader
          colors={colors}
          isDark={isDark}
          dateKey={dateISO}
          onPrev={() => setDateISO((k) => addDaysKey(k, -1))}
          onNext={() => setDateISO((k) => addDaysKey(k, +1))}
          onPickDate={(next) => setDateISO(next)}
        />

        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Nutrition
          </Text>
          <Text style={[styles.pageSub, { color: alpha(colors.text, 0.68) }]}>
            Calm tracking, clear progress. You’re doing better than you think.
          </Text>
        </View>

        {/* HISTORY STRIP (your backend) */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: alpha(colors.text, 0.7),
                fontWeight: "900",
                letterSpacing: 1.2,
                fontSize: 12,
              }}
            >
              HISTORY
            </Text>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setHistoryMode((m) => (m === "week" ? "month" : "week"));
              }}
              accessibilityRole="button"
              accessibilityLabel="Toggle history range"
              style={({ pressed }) => [
                {
                  height: 36,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: alpha(colors.text, 0.14),
                  backgroundColor: alpha(colors.card, isDark ? 0.1 : 0.75),
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={alpha(colors.text, 0.85)}
              />
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
              >
                {historyMode === "week" ? "Month" : "2 weeks"}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            {historyDays.map((d) => {
              const active = d.date === dateISO;
              const hot = d.calories >= 2400 * 0.9;

              return (
                <Pressable
                  key={d.date}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDateISO(d.date);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${d.date}`}
                  style={({ pressed }) => [
                    {
                      width: historyMode === "week" ? "13.3%" : "9.2%",
                      minWidth: historyMode === "week" ? 44 : 34,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: active
                        ? alpha(colors.primary, 0.45)
                        : alpha(colors.text, 0.1),
                      backgroundColor: active
                        ? alpha(colors.primary, 0.14)
                        : hot
                        ? alpha("#22c55e", 0.1)
                        : alpha(colors.card, isDark ? 0.1 : 0.75),
                      alignItems: "center",
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={{
                      color: alpha(colors.text, 0.55),
                      fontWeight: "900",
                      fontSize: 10,
                    }}
                  >
                    {new Date(d.date + "T12:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "narrow" }
                    )}
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      marginTop: 2,
                    }}
                  >
                    {Number(d.date.slice(-2))}
                  </Text>
                  <Text
                    style={{
                      color: alpha(colors.text, 0.55),
                      fontWeight: "900",
                      fontSize: 10,
                      marginTop: 2,
                    }}
                  >
                    {Math.round(d.calories)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {day ? (
          <>
            <RingSummaryCard colors={colors} isDark={isDark} day={day} />

            <HydrationCard
              colors={colors}
              isDark={isDark}
              day={day}
              onAddMl={(delta) => setWaterAndStore(waterMl + delta)}
              onClear={() => setWaterAndStore(0)}
            />

            <MealSection
              colors={colors}
              isDark={isDark}
              day={day}
              onAddPress={(type) => {
                Haptics.selectionAsync();
                setAddDefaultType(type);
                setAddOpen(true);
              }}
              onOpenHistory={() => setHistoryOpen(true)}
              onDeleteMeal={handleDeleteMeal}
            />

            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <View
                style={[
                  styles.tip,
                  {
                    borderColor: alpha(colors.text, 0.1),
                    backgroundColor: alpha(colors.card, isDark ? 0.1 : 0.75),
                  },
                ]}
              >
                <Text style={[styles.tipTitle, { color: colors.text }]}>
                  Daily micro-win
                </Text>
                <Text
                  style={[styles.tipBody, { color: alpha(colors.text, 0.7) }]}
                >
                  Aim for a “protein anchor” in each meal. It makes hunger
                  calmer and consistency easier.
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              Sign in to see your nutrition log.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ADD MEAL -> uses your addFood() */}
      <AddMealSheet
        colors={colors}
        isDark={isDark}
        visible={addOpen}
        defaultType={addDefaultType}
        onClose={() => setAddOpen(false)}
        onSave={async (payload) => {
          if (!user?.uid) return;

          const base: Omit<FoodEntry, "id"> = {
            date: dateISO as any,
            meal: (payload.mealType || "breakfast") as any,
            name: String(payload.name || "").trim(),
            unit: "serving" as any,
            qty: 1 as any,
            calories: Number(payload.macros.calories || 0) as any,
            protein: Number(payload.macros.protein || 0) as any,
            carbs: Number(payload.macros.carbs || 0) as any,
            fat: Number(payload.macros.fat || 0) as any,
            source: "manual",
            createdAt: undefined, // serverTimestamp set in service if you do that there
          };

          const tempId = `temp-${Date.now()}`;
          const tempItem: FoodEntry = { ...(base as any), id: tempId };
          setFoods((prev: FoodEntry[]) => [tempItem, ...prev]);

          try {
            const ref = await addFood(user.uid, base as any);
            setFoods((prev: FoodEntry[]) =>
              prev.map((f) => (f.id === tempId ? { ...f, id: ref.id } : f))
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            setFoods((prev: FoodEntry[]) =>
              prev.filter((f) => f.id !== tempId)
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } finally {
            setAddOpen(false);
          }
        }}
      />

      <HistorySheet
        colors={colors}
        isDark={isDark}
        visible={historyOpen}
        meals={day?.meals ?? []}
        onClose={() => setHistoryOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  pageSub: { marginTop: 4, fontSize: 13, fontWeight: "700", maxWidth: 320 },
  tip: { marginTop: 6, borderWidth: 1, borderRadius: 18, padding: 14 },
  tipTitle: { fontSize: 14, fontWeight: "900" },
  tipBody: { marginTop: 6, fontSize: 13, fontWeight: "700", lineHeight: 18 },
});
