import { dayKey } from "@/utils/date";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/content/ThemeProvider";
import { callOpenAIJson } from "@/services/openai";
import PremiumModalSheet, {
  PremiumActionButton,
} from "@/components/ui/PremiumModalSheet";
import ExplainAIModal from "@/components/scanMeal/new/ExplainAIModal";
import EditFoodSheet from "@/components/scanMeal/new/EditFoodSheet";
import AddFoodSheet from "@/components/scanMeal/new/AddFoodSheet";
import {
  type DetectedFood,
  type MacroTotals,
  type ScanMealResult,
  type ScanState,
  clamp,
  roundTo,
} from "@/components/scanMeal/new/types";
import { scanMealFromImage } from "@/components/scanMeal/new/services/scanMealService";
import { computeTotals } from "@/components/scanMeal/new/services/macroMath";
import {
  getScanQuotaStatus,
  refundScanToken,
  reserveScanToken,
} from "@/services/scanMeal/scanQuota";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";

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
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;
  source: "scan";
};

type MealCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";

const PENDING_BATCH_KEY = "@pending_add_meal_batch_v1";
const DAILY_SCAN_LIMIT = 2;
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function safeMealKey(v: any): MealKey {
  const s = String(v || "").toLowerCase();
  return s === "breakfast" || s === "lunch" || s === "dinner" || s === "snacks"
    ? (s as MealKey)
    : "breakfast";
}

function guessCategoryByTime(): MealCategory {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 16) return "Lunch";
  if (h >= 16 && h < 22) return "Dinner";
  return "Snack";
}

function categoryToMealKey(c: MealCategory): MealKey {
  if (c === "Breakfast") return "breakfast";
  if (c === "Lunch") return "lunch";
  if (c === "Dinner") return "dinner";
  return "snacks";
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonFromText(text: string): any | null {
  const s = String(text ?? "").trim();
  if (!s) return null;

  const direct = safeJsonParse(s);
  if (direct) return direct;

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const parsed = safeJsonParse(s.slice(first, last + 1));
    if (parsed) return parsed;
  }

  const firstArr = s.indexOf("[");
  const lastArr = s.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) {
    const parsed = safeJsonParse(s.slice(firstArr, lastArr + 1));
    if (parsed) return parsed;
  }

  return null;
}

function unwrapDescribePayload(anyGot: any): any {
  if (!anyGot) return null;
  if (Array.isArray(anyGot)) return anyGot[0] ?? null;
  if (anyGot.data) return unwrapDescribePayload(anyGot.data);
  if (anyGot.result) return unwrapDescribePayload(anyGot.result);
  if (anyGot.item) return unwrapDescribePayload(anyGot.item);
  if (anyGot.meal) return unwrapDescribePayload(anyGot.meal);

  const content = anyGot?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const parsed = extractJsonFromText(content);
    return parsed ?? { name: content };
  }

  if (typeof anyGot === "string") {
    const parsed = extractJsonFromText(anyGot);
    return parsed ?? { name: anyGot };
  }

  return anyGot;
}

function normalizeDescribeMacros(gotRaw: any) {
  const got = unwrapDescribePayload(gotRaw) || {};
  const src = got.macros ?? got;

  return {
    calories: Number(src.calories ?? src.kcal ?? src.energy ?? 0) || 0,
    protein: Number(src.protein ?? src.proteins ?? 0) || 0,
    carbs: Number(src.carbs ?? src.carbohydrates ?? 0) || 0,
    fat: Number(src.fat ?? src.fats ?? 0) || 0,
    fiber:
      src.fiber != null
        ? Number(src.fiber)
        : src.fibre != null
          ? Number(src.fibre)
          : undefined,
    sugar:
      src.sugar != null
        ? Number(src.sugar)
        : src.sugars != null
          ? Number(src.sugars)
          : undefined,
    sodiumMg:
      src.sodiumMg != null
        ? Number(src.sodiumMg)
        : src.sodium != null
          ? Number(src.sodium)
          : undefined,
    satFat:
      src.satFat != null
        ? Number(src.satFat)
        : src.saturatedFat != null
          ? Number(src.saturatedFat)
          : undefined,
  };
}

async function reanalyzeFoodMacros(food: DetectedFood) {
  const amount = Number(food.portion?.amount ?? 1) || 1;
  const unit = String(food.portion?.unit ?? "serving");
  const query = `${amount} ${unit} ${food.name}`.trim();

  const parsed = await callOpenAIJson<any>(
    [
      {
        role: "system",
        content:
          "You estimate meal macros for the Somata app. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Estimate macros for this single food. Return JSON only:
${query}

{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number | null,
  "sugar": number | null,
  "sodiumMg": number | null,
  "satFat": number | null
}`,
      },
    ],
    { maxTokens: 700, temperature: 0.3 }
  );
  if (!parsed) return null;
  const macros = normalizeDescribeMacros(parsed);
  const hasAny =
    (macros.calories || 0) +
      (macros.protein || 0) +
      (macros.carbs || 0) +
      (macros.fat || 0) >
    0;
  return hasAny ? macros : null;
}

function normalizeScanFoods(result: ScanMealResult) {
  return (result.foods || [])
    .filter((f) => !!f.name?.trim())
    .map((f) => {
      const amt = clamp(Number(f.portion?.amount ?? 1), 0.1, 5000);
      const unit = (f.portion?.unit ?? "g") as any;

      return {
        ...f,
        id: f.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        confidence: f.confidence ?? "medium",
        portion: { amount: amt, unit, multiplier: 1 },
        macros: {
          calories: Math.max(0, Number(f.macros?.calories ?? 0)),
          protein: Math.max(0, Number(f.macros?.protein ?? 0)),
          carbs: Math.max(0, Number(f.macros?.carbs ?? 0)),
          fat: Math.max(0, Number(f.macros?.fat ?? 0)),
          fiber:
            f.macros?.fiber != null
              ? Math.max(0, Number(f.macros.fiber))
              : undefined,
          sugar:
            f.macros?.sugar != null
              ? Math.max(0, Number(f.macros.sugar))
              : undefined,
          sodiumMg:
            f.macros?.sodiumMg != null
              ? Math.max(0, Number(f.macros.sodiumMg))
              : undefined,
          satFat:
            f.macros?.satFat != null
              ? Math.max(0, Number(f.macros.satFat))
              : undefined,
        },
      } as DetectedFood;
    });
}

export default function ScanMealV2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme() as any;
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    returnTo?: string;
  }>();

  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  const dateStr =
    (params.date as string) || dayKey(new Date());
  const initialMealKey = safeMealKey(params.meal);
  const returnTo = String(params.returnTo || "");

  const [state, setState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [foods, setFoods] = useState<DetectedFood[]>([]);
  const [category, setCategory] = useState<MealCategory>(() => {
    if (initialMealKey === "breakfast") return "Breakfast";
    if (initialMealKey === "lunch") return "Lunch";
    if (initialMealKey === "dinner") return "Dinner";
    if (initialMealKey === "snacks") return "Snack";
    return guessCategoryByTime();
  });
  const [isLogging, setIsLogging] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [editFood, setEditFood] = useState<DetectedFood | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [quota, setQuota] = useState({
    remaining: DAILY_SCAN_LIMIT,
    used: 0,
    limit: DAILY_SCAN_LIMIT,
    unlimited: false,
  });

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refreshQuota = useCallback(async () => {
    const q = await getScanQuotaStatus({ limit: DAILY_SCAN_LIMIT });
    setQuota({
      remaining: q.unlimited ? 999999 : q.remaining,
      used: q.used,
      limit: q.limit,
      unlimited: q.unlimited,
    });
  }, []);

  useEffect(() => {
    refreshQuota().catch(() => {});
  }, [refreshQuota]);

  useEffect(() => {
    if (cameraPermission?.granted != null) return;
    requestCameraPermission().catch(() => {});
  }, [cameraPermission?.granted, requestCameraPermission]);

  const totals: MacroTotals = useMemo(() => computeTotals(foods), [foods]);
  const hasFoods = foods.length > 0;
  const lowConfidenceCount = useMemo(
    () => foods.filter((f) => f.confidence === "low").length,
    [foods],
  );

  const requestLibraryPerms = useCallback(async () => {
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (media.status !== "granted") {
      Alert.alert(
        "Photos permission needed",
        "Allow photo library access to scan a saved meal photo.",
      );
      return false;
    }
    return true;
  }, []);

  const analyzePhoto = useCallback(
    async (uri: string) => {
      const reservation = await reserveScanToken({ limit: DAILY_SCAN_LIMIT });

      if (!reservation.allowed) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
        setQuota({
          remaining: reservation.unlimited ? 999999 : reservation.remaining,
          used: reservation.used,
          limit: reservation.limit,
          unlimited: reservation.unlimited,
        });
        Alert.alert(
          "Daily scan limit reached",
          `You’ve used ${reservation.limit} scans today.\n\nTry again tomorrow, or log manually.`,
        );
        return;
      }

      setQuota({
        remaining: reservation.unlimited ? 999999 : reservation.remaining,
        used: reservation.used,
        limit: reservation.limit,
        unlimited: reservation.unlimited,
      });

      setPhotoUri(uri);
      setFoods([]);
      setState("analyzing");

      try {
        const result = await scanMealFromImage(uri);
        if (!aliveRef.current) return;

        const cleaned = normalizeScanFoods(result);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFoods(cleaned);
        setState("review");
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } catch (e: any) {
        if (!aliveRef.current) return;
        await refundScanToken({ limit: DAILY_SCAN_LIMIT }).catch(() => {});
        await refreshQuota().catch(() => {});
        setState("idle");
        setPhotoUri(null);
        Alert.alert(
          "Couldn’t scan that meal",
          "Try a clearer photo with the full plate in frame, or pick a different angle.",
        );
      }
    },
    [refreshQuota],
  );

  const onCapture = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) return;
    }
    if (!cameraRef.current || state === "analyzing") return;

    try {
      await Haptics.selectionAsync().catch(() => {});
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      const uri = shot?.uri;
      if (!uri) return;
      await analyzePhoto(uri);
    } catch {
      Alert.alert("Camera error", "Couldn’t capture a photo right now.");
    }
  }, [analyzePhoto, cameraPermission?.granted, requestCameraPermission, state]);

  const onPickLibrary = useCallback(async () => {
    const ok = await requestLibraryPerms();
    if (!ok) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    await Haptics.selectionAsync().catch(() => {});
    await analyzePhoto(uri);
  }, [analyzePhoto, requestLibraryPerms]);

  const onReset = useCallback(async () => {
    await Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setState("idle");
    setPhotoUri(null);
    setFoods([]);
  }, []);

  const onOpenEdit = useCallback(async (food: DetectedFood) => {
    await Haptics.selectionAsync().catch(() => {});
    setEditFood(food);
  }, []);

  const onRemove = useCallback(async (id: string) => {
    await Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const onQuickAdjustPortion = useCallback(async (id: string, delta: number) => {
    await Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoods((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const oldAmt = Number(f.portion?.amount ?? 1) || 1;
        const nextAmt = clamp(roundTo(oldAmt + delta, 0.1), 0.1, 5000);
        const ratio = nextAmt / oldAmt;
        const scale = (v?: number) =>
          v == null ? undefined : Math.max(0, Number(v) * ratio);

        return {
          ...f,
          portion: { ...f.portion, amount: nextAmt, multiplier: 1 },
          macros: {
            calories: Math.round((f.macros?.calories ?? 0) * ratio),
            protein: scale(f.macros?.protein) ?? 0,
            carbs: scale(f.macros?.carbs) ?? 0,
            fat: scale(f.macros?.fat) ?? 0,
            fiber: scale(f.macros?.fiber),
            sugar: scale(f.macros?.sugar),
            sodiumMg: scale(f.macros?.sodiumMg),
            satFat: scale(f.macros?.satFat),
          },
        };
      }),
    );
  }, []);

  const onUpdateFood = useCallback(
    async (next: DetectedFood) => {
      await Haptics.selectionAsync().catch(() => {});
      const originalName = editFood?.name?.trim() ?? "";
      const nextName = next.name.trim();
      const didRename =
        originalName.length > 0 &&
        nextName.length > 0 &&
        originalName !== nextName;

      setFoods((prev) => prev.map((f) => (f.id === next.id ? next : f)));
      setEditFood(null);
      if (!didRename) return;

      try {
        setIsReanalyzing(true);
        const macros = await reanalyzeFoodMacros(next);
        if (!macros) return;
        setFoods((prev) =>
          prev.map((f) =>
            f.id !== next.id
              ? f
              : {
                  ...f,
                  macros: {
                    calories: macros.calories ?? f.macros.calories,
                    protein: macros.protein ?? f.macros.protein,
                    carbs: macros.carbs ?? f.macros.carbs,
                    fat: macros.fat ?? f.macros.fat,
                    fiber: macros.fiber ?? f.macros.fiber,
                    sugar: macros.sugar ?? f.macros.sugar,
                    sodiumMg: macros.sodiumMg ?? f.macros.sodiumMg,
                    satFat: macros.satFat ?? f.macros.satFat,
                  },
                },
          ),
        );
      } catch (e) {
        console.warn("[scan-meal-v2] reanalyze failed", e);
      } finally {
        setIsReanalyzing(false);
      }
    },
    [editFood?.name],
  );

  const onAddFood = useCallback(async (food: DetectedFood) => {
    await Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoods((prev) => [food, ...prev]);
    setShowAdd(false);
    setState("review");
  }, []);

  const onConfirm = useCallback(async () => {
    if (!hasFoods) {
      Alert.alert("Nothing to add", "Scan or add at least one food item.");
      return;
    }

    setIsLogging(true);
    try {
      const chosenMeal = categoryToMealKey(category);
      const items: AddPayload[] = foods.map((f) => ({
        date: dateStr,
        meal: chosenMeal,
        name: (f.name || "Food").trim(),
        unit: String(f.portion?.unit || "serving"),
        qty: Number(f.portion?.amount || 1) || 1,
        calories: Math.round(f.macros.calories ?? 0),
        protein: round1(f.macros.protein ?? 0),
        carbs: round1(f.macros.carbs ?? 0),
        fat: round1(f.macros.fat ?? 0),
        sugar: f.macros.sugar != null ? round1(f.macros.sugar) : undefined,
        fiber: f.macros.fiber != null ? round1(f.macros.fiber) : undefined,
        sodium:
          f.macros.sodiumMg != null ? Math.round(f.macros.sodiumMg) : undefined,
        satFat: f.macros.satFat != null ? round1(f.macros.satFat) : undefined,
        source: "scan",
      }));

      const targetKey =
        returnTo === "meal-builder"
          ? PENDING_MEAL_BUILDER_ADDITIONS_KEY
          : PENDING_BATCH_KEY;

      await AsyncStorage.setItem(
        targetKey,
        JSON.stringify({ date: dateStr, meal: chosenMeal, items }),
      );
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn’t add scanned meal", e?.message ?? "Try again.");
    } finally {
      setIsLogging(false);
    }
  }, [category, dateStr, foods, hasFoods, returnTo, router]);

  const showResultsSheet = state === "review";
  const showProcessing = state === "analyzing" || isLogging || isReanalyzing;

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: "#05070c" }}
    >
      <View style={{ flex: 1, backgroundColor: "#05070c" }}>
        <View style={StyleSheet.absoluteFill}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.cameraFill} />
          ) : cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.cameraFill}
              facing="back"
              enableTorch={torch}
            />
          ) : (
            <LinearGradient
              colors={["#05070c", "#0b1220", "#12172a"]}
              style={StyleSheet.absoluteFill}
            />
          )}

          <LinearGradient
            colors={["rgba(3,6,12,0.92)", "rgba(3,6,12,0.28)", "rgba(3,6,12,0.78)"]}
            locations={[0, 0.28, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View
          style={{
            flex: 1,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 18),
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <CircleIconButton
              colors={colors}
              icon="close"
              onPress={() => router.back()}
            />

            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ color: withAlpha("#ffffff", 0.56), fontSize: 11, fontWeight: "800" }}>
                Scan Meal v2
              </Text>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
                Scan Meal
              </Text>
            </View>

            <CircleIconButton
              colors={colors}
              icon={torch ? "flash" : "flash-off"}
              onPress={() => setTorch((v) => !v)}
            />
          </View>

          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                  {quota.unlimited
                    ? "Unlimited scans"
                    : `${Math.max(0, quota.remaining)} scans left today`}
                </Text>
              </View>

              <Text
                style={{
                  marginTop: 18,
                  color: "#fff",
                  fontSize: 28,
                  lineHeight: 32,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              >
                {showResultsSheet
                  ? "Review the scan"
                  : photoUri && showProcessing
                    ? "Analyzing your meal"
                    : "Point camera at your meal"}
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  color: withAlpha("#ffffff", 0.66),
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: "700",
                  maxWidth: 260,
                }}
              >
                {showResultsSheet
                  ? "Edit anything before it gets added back into your meal."
                  : photoUri && showProcessing
                    ? "Hold tight while we detect foods and estimate macros."
                    : "Keep the whole plate in frame for the cleanest detection."}
              </Text>
            </View>

            {!showResultsSheet ? (
              <View style={{ paddingHorizontal: 22, gap: 16 }}>
                <View
                  style={{
                    alignSelf: "center",
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: "rgba(255,255,255,0.07)",
                  }}
                >
                  <Text style={{ color: withAlpha("#ffffff", 0.78), fontSize: 12, fontWeight: "800" }}>
                    {showProcessing ? "Analyzing..." : "Tap to capture"}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Pressable
                    onPress={onPickLibrary}
                    disabled={showProcessing}
                    style={({ pressed }) => ({
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.09)",
                      opacity: showProcessing ? 0.45 : pressed ? 0.84 : 1,
                    })}
                  >
                    <Ionicons name="images-outline" size={22} color="#fff" />
                  </Pressable>

                  <Pressable
                    onPress={onCapture}
                    disabled={showProcessing}
                    style={({ pressed }) => ({
                      width: 88,
                      height: 88,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                      opacity: showProcessing ? 0.55 : 1,
                    })}
                  >
                    <LinearGradient
                      colors={["rgba(56,189,248,0.96)", colors.primary, "#4f46e5"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#38bdf8",
                        shadowOpacity: 0.45,
                        shadowRadius: 20,
                        shadowOffset: { width: 0, height: 10 },
                      }}
                    >
                      <View
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 999,
                          backgroundColor: "rgba(255,255,255,0.16)",
                          borderWidth: 2,
                          borderColor: "rgba(255,255,255,0.78)",
                        }}
                      />
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowExplain(true)}
                    style={({ pressed }) => ({
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.09)",
                      opacity: pressed ? 0.84 : 1,
                    })}
                  >
                    <Ionicons name="sparkles-outline" size={22} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {showProcessing ? (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.processingWrap}>
              <LinearGradient
                colors={["rgba(9,14,25,0.86)", "rgba(18,24,38,0.82)"]}
                style={styles.processingCard}
              >
                <Text style={{ color: "#fff", fontSize: 19, fontWeight: "900" }}>
                  {state === "analyzing"
                    ? "Analyzing your meal..."
                    : isLogging
                      ? "Adding to Meal Builder..."
                      : "Refreshing macros..."}
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    color: withAlpha("#ffffff", 0.64),
                    fontSize: 13,
                    lineHeight: 18,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {state === "analyzing"
                    ? "Detecting foods and estimating calories, protein, carbs, and fat."
                    : isLogging
                      ? "Your scanned foods will be appended into the current meal."
                      : "Updating the item after your edits."}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                  {[0, 1, 2].map((idx) => (
                    <MotiView
                      key={idx}
                      from={{ opacity: 0.35, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1.14 }}
                      transition={{
                        loop: true,
                        type: "timing",
                        duration: 620,
                        delay: idx * 120,
                      }}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: idx === 1 ? "#38bdf8" : "#7c83ff",
                      }}
                    />
                  ))}
                </View>
              </LinearGradient>
            </View>
          </View>
        ) : null}

        <MotiView
          animate={{
            translateY: showResultsSheet ? 0 : 420,
            opacity: showResultsSheet ? 1 : 0,
          }}
          transition={{ type: "timing", duration: 320 }}
          pointerEvents={showResultsSheet ? "auto" : "none"}
          style={[
            styles.resultsSheetWrap,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <LinearGradient
            colors={[
              withAlpha(colors.primary, 0.18),
              withAlpha("#38bdf8", 0.08),
              withAlpha(colors.card, 0.94),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.handle} />

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
                Scan results
              </Text>
              <Text
                style={{
                  color: withAlpha("#ffffff", 0.62),
                  fontSize: 12.5,
                  lineHeight: 18,
                  fontWeight: "700",
                }}
              >
                {foods.length} item{foods.length === 1 ? "" : "s"} detected. Edit,
                remove, or add anything missing before confirming.
              </Text>
            </View>

            <Pressable onPress={onReset} style={styles.subtlePill}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                Rescan
              </Text>
            </Pressable>
          </View>

          <View style={styles.macroHero}>
            <MacroStat label="Calories" value={`${Math.round(totals.calories || 0)}`} />
            <MacroStat label="Protein" value={`${Math.round(totals.protein || 0)}g`} />
            <MacroStat label="Carbs" value={`${Math.round(totals.carbs || 0)}g`} />
            <MacroStat label="Fat" value={`${Math.round(totals.fat || 0)}g`} />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["Breakfast", "Lunch", "Dinner", "Snack"] as MealCategory[]).map(
              (option) => (
                <Pressable
                  key={option}
                  onPress={() => setCategory(option)}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor:
                        option === category
                          ? withAlpha(colors.primary, 0.24)
                          : "rgba(255,255,255,0.06)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          {lowConfidenceCount ? (
            <View
              style={{
                borderRadius: 18,
                padding: 12,
                backgroundColor: "rgba(245,158,11,0.14)",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
              <Text style={{ color: "#fff", flex: 1, fontWeight: "700", fontSize: 12.5 }}>
                {lowConfidenceCount} low-confidence item{lowConfidenceCount > 1 ? "s" : ""}
                . Review before confirming.
              </Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          >
            {foods.map((food) => (
              <Pressable
                key={food.id}
                onPress={() => onOpenEdit(food)}
                style={styles.foodCard}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: confidenceTint(food.confidence),
                    }}
                  >
                    <Ionicons
                      name={
                        food.confidence === "low"
                          ? "help-circle-outline"
                          : "sparkles-outline"
                      }
                      size={18}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}
                      numberOfLines={1}
                    >
                      {food.name}
                    </Text>
                    <Text
                      style={{
                        color: withAlpha("#ffffff", 0.58),
                        fontSize: 11.5,
                        fontWeight: "700",
                      }}
                      numberOfLines={1}
                    >
                      {Math.round(food.portion.amount * 10) / 10} {food.portion.unit} •{" "}
                      {Math.round(food.macros.calories || 0)} kcal • P{" "}
                      {Math.round(food.macros.protein || 0)} • C{" "}
                      {Math.round(food.macros.carbs || 0)} • F{" "}
                      {Math.round(food.macros.fat || 0)}
                    </Text>
                  </View>
                  <Pressable onPress={() => onRemove(food.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={withAlpha("#ffffff", 0.7)} />
                  </Pressable>
                </View>

                <View
                  style={{
                    marginTop: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <QtyButton label="−" onPress={() => onQuickAdjustPortion(food.id, -0.5)} />
                    <View style={styles.qtyReadout}>
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                        {Math.round(food.portion.amount * 10) / 10} {food.portion.unit}
                      </Text>
                    </View>
                    <QtyButton label="+" onPress={() => onQuickAdjustPortion(food.id, 0.5)} />
                  </View>

                  <Text style={{ color: withAlpha("#ffffff", 0.52), fontWeight: "800", fontSize: 11 }}>
                    Tap row to edit
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ gap: 10 }}>
            <PremiumActionButton label="Add missing item" onPress={() => setShowAdd(true)} secondary />
            <PremiumActionButton label="Add to Meal" onPress={onConfirm} disabled={isLogging || !hasFoods} />
          </View>
        </MotiView>

        <ExplainAIModal visible={showExplain} onClose={() => setShowExplain(false)} />
        <EditFoodSheet
          visible={!!editFood}
          food={editFood}
          onClose={() => setEditFood(null)}
          onSave={onUpdateFood}
          onRemove={editFood ? () => onRemove(editFood.id) : undefined}
        />
        <AddFoodSheet visible={showAdd} onClose={() => setShowAdd(false)} onAdd={onAddFood} />

        {!cameraPermission?.granted ? (
          <PremiumModalSheet
            visible
            onClose={() => router.back()}
            title="Camera access needed"
            subtitle="Scan Meal v2 uses a live camera preview for capture."
            detached
            footer={
              <PremiumActionButton label="Enable camera" onPress={() => requestCameraPermission()} />
            }
          >
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>
              Allow camera access to use the immersive capture experience, or close
              and use the original scan flow instead.
            </Text>
          </PremiumModalSheet>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function CircleIconButton({
  colors,
  icon,
  onPress,
}: {
  colors: any;
  icon: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function MacroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: withAlpha("#ffffff", 0.52), fontSize: 10.5, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function QtyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function confidenceTint(confidence: DetectedFood["confidence"]) {
  if (confidence === "high") return "rgba(34,197,94,0.72)";
  if (confidence === "low") return "rgba(245,158,11,0.72)";
  if (confidence === "manual") return "rgba(168,85,247,0.72)";
  return "rgba(56,189,248,0.72)";
}

const styles = StyleSheet.create({
  cameraFill: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  processingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  processingCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  resultsSheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "34%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: "rgba(10,14,24,0.92)",
    gap: 14,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  subtlePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  macroHero: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  categoryPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 10,
  },
  foodCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  qtyReadout: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
