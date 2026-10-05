// app/nutrition/scan-meal.tsx
// Drop-in replacement ✅
// - Uses AsyncStorage batch handoff: @pending_add_meal_batch_v1
// - NO logMeal.ts dependency
// - Uses MealCategory selection (Breakfast/Lunch/Dinner/Snack) to set meal key
// - Stores sodium as `sodium` (matches your services/nutrition.ts schema)
// - Handles the “Back while processing” bug safely

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, FadeIn, Layout } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/content/ThemeProvider";

import ScanMealCamera from "@/components/scanMeal/old/ScanMealCamera";
import ScanMealProcessingOverlay from "@/components/scanMeal/old/ProcessingOverlay";
import DetectedFoodCard from "@/components/scanMeal/old/DetectedFoodCard";
import MacroSummaryCard from "@/components/scanMeal/old/MacroSummaryCard";
import PortionControl from "@/components/scanMeal/old/PortionControl";
import MealCategoryPills, {
  MealCategory,
} from "@/components/scanMeal/old/MealCategoryPills";

import type {
  DetectedFood,
  ScanMealResult,
  MacroTotals,
} from "@/services/scanMeal/types";
import { mockScanMealFromImage } from "@/services/scanMeal/scanMealService";

type Step = "camera" | "processing" | "review";
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type AddPayload = {
  date: string;
  meal: MealKey;
  name: string;
  unit: string;
  qty: number;

  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  sugar?: number;
  fiber?: number;

  // advanced (optional)
  addedSugar?: number;
  satFat?: number;
  sodium?: number; // ✅ match services/nutrition.ts
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;

  source: "scan";
};

const PENDING_BATCH_KEY = "@pending_add_meal_batch_v1";

function categoryToMealKey(c: MealCategory): MealKey {
  if (c === "Breakfast") return "breakfast";
  if (c === "Lunch") return "lunch";
  if (c === "Dinner") return "dinner";
  return "snacks";
}
function safeMealKey(v: any): MealKey {
  const s = String(v || "").toLowerCase();
  return s === "breakfast" || s === "lunch" || s === "dinner" || s === "snacks"
    ? (s as MealKey)
    : "breakfast";
}

export default function ScanMealScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme() as any;

  const params = useLocalSearchParams<{ meal?: string; date?: string }>();

  const dateStr =
    (params.date as string) || new Date().toISOString().slice(0, 10);

  // initial meal comes from params, but user can override via pills
  const initialMealKey = safeMealKey(params.meal);

  const [step, setStep] = useState<Step>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<ScanMealResult | null>(null);
  const [foods, setFoods] = useState<DetectedFood[]>([]);

  const [category, setCategory] = useState<MealCategory>(() => {
    // prefer param meal if present
    if (initialMealKey === "breakfast") return "Breakfast";
    if (initialMealKey === "lunch") return "Lunch";
    if (initialMealKey === "dinner") return "Dinner";
    if (initialMealKey === "snacks") return "Snack";
    return guessCategoryByTime();
  });

  const [isLogging, setIsLogging] = useState(false);

  // prevent state updates if user backs out mid-scan
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const totals: MacroTotals = useMemo(() => {
    const base = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: 0, // MacroTotals expects sodiumMg
      satFat: 0,
    };

    for (const f of foods) {
      const m = f.macros;
      const mult = Number(f.portion?.multiplier ?? 1) || 1;

      base.calories += (m.calories ?? 0) * mult;
      base.protein += (m.protein ?? 0) * mult;
      base.carbs += (m.carbs ?? 0) * mult;
      base.fat += (m.fat ?? 0) * mult;
      base.fiber += (m.fiber ?? 0) * mult;
      base.sugar += (m.sugar ?? 0) * mult;
      base.sodiumMg += (m.sodiumMg ?? 0) * mult;
      base.satFat += (m.satFat ?? 0) * mult;
    }

    return {
      calories: Math.round(base.calories),
      protein: round1(base.protein),
      carbs: round1(base.carbs),
      fat: round1(base.fat),
      fiber: round1(base.fiber),
      sugar: round1(base.sugar),
      sodiumMg: Math.round(base.sodiumMg),
      satFat: round1(base.satFat),
    };
  }, [foods]);

  const lowConfidenceCount = useMemo(
    () => foods.filter((f) => f.confidence === "low").length,
    [foods]
  );

  const onPhotoCaptured = useCallback(async (uri: string) => {
    setPhotoUri(uri);
    setStep("processing");

    try {
      const result = await mockScanMealFromImage(uri);

      if (!aliveRef.current) return;

      setScanResult(result);
      setFoods(result.foods || []);
      setStep("review");
    } catch (e: any) {
      if (!aliveRef.current) return;

      setStep("camera");
      Alert.alert(
        "Scan failed",
        e?.message ?? "Couldn’t scan this image. Try again."
      );
    }
  }, []);

  const onEditFood = useCallback((id: string, patch: Partial<DetectedFood>) => {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const onRemoveFood = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const onAddFood = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const id = `manual_${Date.now()}`;
    setFoods((prev) => [
      ...prev,
      {
        id,
        name: "New item",
        confidence: "manual",
        portion: { amount: 1, unit: "piece", multiplier: 1 },
        macros: {
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 3,
          fiber: 0,
          sugar: 0,
          sodiumMg: 0,
          satFat: 0,
        },
        suggestions: ["Chicken breast", "Rice", "Greek yogurt", "Eggs"],
      },
    ]);
  }, []);

  const onRetake = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setPhotoUri(null);
    setScanResult(null);
    setFoods([]);
    setStep("camera");
  }, []);

  const onLog = useCallback(async () => {
    if (foods.length === 0) {
      Alert.alert("Nothing to log", "Add at least one food item.");
      return;
    }

    setIsLogging(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {}
      );

      const chosenMeal = categoryToMealKey(category);

      // Convert foods → AddPayload[]
      const items: AddPayload[] = foods.map((f) => {
        const qty = Number(f.portion?.amount || 1) || 1;
        const unit = String(f.portion?.unit || "serving");

        // multiplier scales macros to “this item total”
        const mult = Number(f.portion?.multiplier ?? qty) || 1;

        const calories = Math.round((f.macros.calories ?? 0) * mult);
        const protein = round1((f.macros.protein ?? 0) * mult);
        const carbs = round1((f.macros.carbs ?? 0) * mult);
        const fat = round1((f.macros.fat ?? 0) * mult);

        const sugar =
          f.macros.sugar != null
            ? round1((f.macros.sugar ?? 0) * mult)
            : undefined;

        const fiber =
          f.macros.fiber != null
            ? round1((f.macros.fiber ?? 0) * mult)
            : undefined;

        // ✅ convert sodiumMg → sodium (schema in services/nutrition.ts)
        const sodium =
          f.macros.sodiumMg != null
            ? Math.round((f.macros.sodiumMg ?? 0) * mult)
            : undefined;

        const satFat =
          f.macros.satFat != null
            ? round1((f.macros.satFat ?? 0) * mult)
            : undefined;

        return {
          date: dateStr,
          meal: chosenMeal,
          name: (f.name || "Food").trim(),
          unit,
          qty,
          calories,
          protein,
          carbs,
          fat,
          sugar,
          fiber,
          sodium,
          satFat,
          source: "scan",
        };
      });

      // Handoff batch to nutrition screen (or whatever consumes it)
      await AsyncStorage.setItem(
        PENDING_BATCH_KEY,
        JSON.stringify({ date: dateStr, meal: chosenMeal, items })
      );

      await AsyncStorage.setItem("@badges_dirty", "1").catch(() => {});

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      router.back();
    } catch (e: any) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
      Alert.alert("Couldn’t log meal", e?.message ?? "Try again.");
    } finally {
      setIsLogging(false);
    }
  }, [foods, dateStr, category, router]);

  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.root}>
      {step === "camera" && (
        <ScanMealCamera
          onClose={() => router.back()}
          onCaptured={onPhotoCaptured}
        />
      )}

      {step !== "camera" && (
        <View style={styles.reviewRoot}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => (step === "review" ? router.back() : onRetake())}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>

            <Text style={styles.headerTitle}>Scan a Meal</Text>

            <Pressable
              onPress={onRetake}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>Retake</Text>
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeIn.duration(180)} style={styles.hero}>
              <Text style={styles.heroTitle}>Review & confirm</Text>
              <Text style={styles.heroSub}>
                Everything is editable. Macros are estimates based on your
                portions.
              </Text>

              {lowConfidenceCount > 0 && (
                <Animated.View
                  entering={FadeInDown.duration(180)}
                  style={styles.banner}
                >
                  <Text style={styles.bannerText}>
                    We’re not fully sure about {lowConfidenceCount} item
                    {lowConfidenceCount > 1 ? "s" : ""}. Please confirm.
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            {/* Foods */}
            <Animated.View layout={Layout.springify()} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Detected items</Text>
                <Pressable
                  onPress={onAddFood}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Add food item"
                  style={styles.addBtn}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>

              {foods.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No foods detected</Text>
                  <Text style={styles.emptySub}>
                    Try retaking in better lighting, or add items manually.
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                  >
                    <Pressable onPress={onRetake} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>Retake</Text>
                    </Pressable>
                    <Pressable
                      onPress={onAddFood}
                      style={styles.primaryBtnSmall}
                    >
                      <Text style={styles.primaryBtnSmallText}>Add items</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {foods.map((f) => (
                    <DetectedFoodCard
                      key={f.id}
                      food={f}
                      onChange={(patch) => onEditFood(f.id, patch)}
                      onRemove={() => onRemoveFood(f.id)}
                    >
                      <PortionControl
                        value={f.portion}
                        onChange={(portion) => onEditFood(f.id, { portion })}
                      />
                    </DetectedFoodCard>
                  ))}
                </View>
              )}
            </Animated.View>

            {/* Macros */}
            <Animated.View layout={Layout.springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Macros</Text>
              <MacroSummaryCard totals={totals} />
            </Animated.View>

            {/* Category */}
            <Animated.View layout={Layout.springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Meal type</Text>
              <MealCategoryPills value={category} onChange={setCategory} />
              <Text style={styles.hintText}>
                Suggested based on time — change anytime.
              </Text>
            </Animated.View>

            {/* Footer spacing */}
            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarGlass} />
            <Pressable
              onPress={onLog}
              disabled={isLogging}
              accessibilityRole="button"
              accessibilityLabel="Log meal"
              style={[styles.cta, isLogging && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaText}>
                {isLogging ? "Logging…" : "Log meal"}
              </Text>
              <Text style={styles.ctaSubText}>
                {totals.calories} kcal • P {totals.protein} • C {totals.carbs} •
                F {totals.fat}
              </Text>
            </Pressable>
          </View>

          {step === "processing" && (
            <ScanMealProcessingOverlay
              title="Scanning your meal…"
              subtitle="Detecting foods and estimating macros"
            />
          )}
        </View>
      )}
    </View>
  );
}

function guessCategoryByTime(): MealCategory {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 16) return "Lunch";
  if (h >= 16 && h < 22) return "Dinner";
  return "Snack";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function makeStyles(colors: any, isDark: boolean) {
  const hair = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg ?? (isDark ? "#000" : "#fff") },

    reviewRoot: { flex: 1 },
    header: {
      paddingTop: Platform.OS === "ios" ? 56 : 18,
      paddingHorizontal: 16,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: hair,
      backgroundColor: colors.bg,
    },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 10 },
    headerBtnText: {
      color: colors.primary ?? colors.text,
      fontSize: 14,
      fontWeight: "600",
    },

    scrollContent: { padding: 16, paddingTop: 14 },

    hero: {
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        colors.surface ??
        (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
      marginBottom: 14,
    },
    heroTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    heroSub: {
      marginTop: 6,
      color:
        colors.muted ??
        (isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.62)"),
      lineHeight: 18,
    },

    banner: {
      marginTop: 10,
      padding: 10,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(255,193,7,0.12)" : "rgba(255,193,7,0.18)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? "rgba(255,193,7,0.28)" : "rgba(255,193,7,0.35)",
    },
    bannerText: { color: colors.text, fontSize: 13, fontWeight: "600" },

    section: { marginTop: 14, gap: 10 },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },

    addBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
    },
    addBtnText: { color: colors.text, fontWeight: "700", fontSize: 13 },

    emptyCard: {
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        colors.surface ??
        (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    emptySub: {
      marginTop: 6,
      color:
        colors.muted ??
        (isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.62)"),
      lineHeight: 18,
    },

    primaryBtnSmall: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary ?? (isDark ? "#fff" : "#000"),
    },
    primaryBtnSmallText: {
      color: colors.primaryText ?? (isDark ? "#000" : "#fff"),
      fontWeight: "800",
    },

    secondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
    },
    secondaryBtnText: { color: colors.text, fontWeight: "800" },

    hintText: {
      marginTop: 8,
      color:
        colors.muted ??
        (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)"),
    },

    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 26 : 16,
    },
    bottomBarGlass: {
      ...StyleSheet.absoluteFill,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: hair,
      backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.85)",
    },
    cta: {
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.primary ?? (isDark ? "#fff" : "#000"),
      alignItems: "center",
    },
    ctaText: {
      color: colors.primaryText ?? (isDark ? "#000" : "#fff"),
      fontSize: 16,
      fontWeight: "900",
    },
    ctaSubText: {
      marginTop: 4,
      color: colors.primaryText ?? (isDark ? "#000" : "#fff"),
      opacity: 0.85,
      fontWeight: "700",
    },
  });
}
