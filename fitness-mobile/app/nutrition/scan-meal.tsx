import { dayKey } from "@/utils/date";
// app/scan-meal.tsx
// Premium Scan Meal UI ✅ wired to your existing backend logic:
// - Uses AsyncStorage batch handoff: @pending_add_meal_batch_v1
// - Uses params: ?date=YYYY-MM-DD&meal=breakfast|lunch|dinner|snacks
// - MealCategory pills to override
// - Guard against “back while processing” with aliveRef
// - Converts sodiumMg -> sodium in payload
// - No logMeal.ts dependency

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";
import { BlurView } from "expo-blur";
import { useRouter, useLocalSearchParams } from "expo-router";

import { useTheme } from "@/content/ThemeProvider";
import { callOpenAIJson } from "@/services/openai";

import {
  type DetectedFood,
  type MacroTotals,
  type ScanMealResult,
  type ScanState,
  clamp,
  roundTo,
} from "@/components/scanMeal/new/types";

import ScanMealHeader from "@/components/scanMeal/new/ScanMealHeader";
import PhotoCard from "@/components/scanMeal/new/PhotoCard";
import ConfidenceLegend from "@/components/scanMeal/new/ConfidenceLegend";
import DetectedFoodList from "@/components/scanMeal/new/DetectedFoodList";
import MacroSummaryCard from "@/components/scanMeal/new/MacroSummaryCard";
import BottomActionBar from "@/components/scanMeal/new/BottomActionBar";
import ExplainAIButton from "@/components/scanMeal/new/ExplainAIButton";
import ExplainAIModal from "@/components/scanMeal/new/ExplainAIModal";
import EditFoodSheet from "@/components/scanMeal/new/EditFoodSheet";
import AddFoodSheet from "@/components/scanMeal/new/AddFoodSheet";
import Toast from "@/components/scanMeal/new/Toast";
import MealCategoryPills, {
  type MealCategory,
} from "@/components/scanMeal/new/MealCategoryPills";
import {
  getScanQuotaStatus,
  reserveScanToken,
  refundScanToken,
} from "@/services/scanMeal/scanQuota";

import { scanMealFromImage } from "@/components/scanMeal/new/services/scanMealService";
import { computeTotals } from "@/components/scanMeal/new/services/macroMath";

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
  sodium?: number; // ✅ schema expects sodium (mg)
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
    const sub = s.slice(first, last + 1);
    const parsed = safeJsonParse(sub);
    if (parsed) return parsed;
  }

  const firstArr = s.indexOf("[");
  const lastArr = s.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) {
    const sub = s.slice(firstArr, lastArr + 1);
    const parsed = safeJsonParse(sub);
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

  const calories = Number(src.calories ?? src.kcal ?? src.energy ?? 0) || 0;
  const protein = Number(src.protein ?? src.proteins ?? 0) || 0;
  const carbs = Number(src.carbs ?? src.carbohydrates ?? 0) || 0;
  const fat = Number(src.fat ?? src.fats ?? 0) || 0;

  const fiber =
    src.fiber != null
      ? Number(src.fiber)
      : src.fibre != null
        ? Number(src.fibre)
        : undefined;

  const sugar =
    src.sugar != null
      ? Number(src.sugar)
      : src.sugars != null
        ? Number(src.sugars)
        : undefined;

  const sodiumMg =
    src.sodiumMg != null
      ? Number(src.sodiumMg)
      : src.sodium != null
        ? Number(src.sodium)
        : undefined;

  const satFat =
    src.satFat != null
      ? Number(src.satFat)
      : src.saturatedFat != null
        ? Number(src.saturatedFat)
        : undefined;

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodiumMg,
    satFat,
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

export default function ScanMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    returnTo?: string;
  }>();
  const { colors, isDark } = useTheme();

  const dateStr =
    (params.date as string) || dayKey(new Date());
  const initialMealKey = safeMealKey(params.meal);
  const returnTo = String(params.returnTo || "");

  const [state, setState] = useState<ScanState>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [foods, setFoods] = useState<DetectedFood[]>([]);
  const [notes, setNotes] = useState("");

  const [category, setCategory] = useState<MealCategory>(() => {
    if (initialMealKey === "breakfast") return "Breakfast";
    if (initialMealKey === "lunch") return "Lunch";
    if (initialMealKey === "dinner") return "Dinner";
    if (initialMealKey === "snacks") return "Snack";
    return guessCategoryByTime();
  });

  const [isLogging, setIsLogging] = useState(false);

  const [showExplain, setShowExplain] = useState(false);
  const [editFood, setEditFood] = useState<DetectedFood | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const [toast, setToast] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  // ✅ daily scan quota
  const DAILY_SCAN_LIMIT = 2; // change anytime (or pull from Remote Config later)
  const [quota, setQuota] = useState<{
    remaining: number;
    used: number;
    limit: number;
    unlimited: boolean;
  }>({
    remaining: DAILY_SCAN_LIMIT,
    used: 0,
    limit: DAILY_SCAN_LIMIT,
    unlimited: false,
  });

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

  // ✅ prevent state updates if user backs out mid-scan
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const showToast = useCallback((t: { title: string; subtitle?: string }) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const totals: MacroTotals = useMemo(() => computeTotals(foods), [foods]);
  const hasFoods = foods.length > 0;

  const lowConfidenceCount = useMemo(
    () => foods.filter((f) => f.confidence === "low").length,
    [foods],
  );

  const requestImagePerms = useCallback(async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (camera.status !== "granted" || media.status !== "granted") {
      Alert.alert(
        "Permissions needed",
        "Please allow camera and photo library access to scan meals.",
      );
      return false;
    }
    return true;
  }, []);

  const onReset = useCallback(async () => {
    await Haptics.selectionAsync().catch(() => {});
    setState("idle");
    setPhotoUri(null);
    setFoods([]);
    setNotes("");
    setIsLogging(false);
  }, []);

  const pickFromCamera = useCallback(async () => {
    const ok = await requestImagePerms();
    if (!ok) return;

    await Haptics.selectionAsync().catch(() => {});
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;

    setPhotoUri(uri);
    setFoods([]);
    setNotes("");
    setState("photo_ready");
    showToast({ title: "Photo captured", subtitle: "Ready to scan." });
  }, [requestImagePerms, showToast]);

  const pickFromLibrary = useCallback(async () => {
    const ok = await requestImagePerms();
    if (!ok) return;

    await Haptics.selectionAsync().catch(() => {});
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;

    setPhotoUri(uri);
    setFoods([]);
    setNotes("");
    setState("photo_ready");
    showToast({ title: "Photo selected", subtitle: "Ready to scan." });
  }, [requestImagePerms, showToast]);

  const onAnalyze = useCallback(async () => {
    if (!photoUri) return;

    // ✅ Reserve quota token BEFORE AI call (saves cost)
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
        [{ text: "OK" }],
      );
      return;
    }

    // Update UI counts immediately
    setQuota({
      remaining: reservation.unlimited ? 999999 : reservation.remaining,
      used: reservation.used,
      limit: reservation.limit,
      unlimited: reservation.unlimited,
    });

    try {
      await Haptics.selectionAsync().catch(() => {});
      setState("analyzing");

      const result: ScanMealResult = await scanMealFromImage(photoUri);

      if (!aliveRef.current) return;

      // ... keep your existing normalization logic exactly as-is ...
      const cleaned: DetectedFood[] = (result.foods || [])
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
                  ? Math.max(0, Number(f.macros?.satFat))
                  : undefined,
            },
          } as DetectedFood;
        });

      setFoods(cleaned);
      setState("review");
      showToast({
        title: "Scan complete",
        subtitle: cleaned.length
          ? `Found ${cleaned.length} item${cleaned.length === 1 ? "" : "s"}`
          : "No items detected — you can add manually.",
      });
    } catch (e: any) {
      if (!aliveRef.current) return;

      // ✅ optional refund if scan failed (keeps UX fair)
      await refundScanToken({ limit: DAILY_SCAN_LIMIT }).catch(() => {});
      await refreshQuota().catch(() => {});

      console.warn(e);
      setState("photo_ready");
      Alert.alert(
        "Couldn’t scan that photo",
        "Try a clearer photo with the full plate in frame, or add items manually.",
      );
    }
  }, [photoUri, showToast, refreshQuota]);

  const onOpenEdit = useCallback(async (food: DetectedFood) => {
    await Haptics.selectionAsync().catch(() => {});
    setEditFood(food);
  }, []);

  const onRemove = useCallback(
    async (id: string) => {
      await Haptics.selectionAsync().catch(() => {});
      setFoods((prev) => prev.filter((f) => f.id !== id));
      showToast({ title: "Removed item" });
    },
    [showToast],
  );

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
      showToast({ title: "Updated" });

      if (!didRename) return;

      try {
        setIsReanalyzing(true);
        const macros = await reanalyzeFoodMacros(next);
        if (!macros) return;

        setFoods((prev) =>
          prev.map((f) => {
            if (f.id !== next.id) return f;
            return {
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
            };
          }),
        );
      } catch (e) {
        console.warn("[scan-meal] reanalyze failed", e);
      } finally {
        setIsReanalyzing(false);
      }
    },
    [editFood?.name, showToast],
  );

  const onAddFood = useCallback(
    async (food: DetectedFood) => {
      await Haptics.selectionAsync().catch(() => {});
      setFoods((prev) => [food, ...prev]);
      setShowAdd(false);
      setState("review");
      showToast({ title: "Added item" });

      try {
        setIsReanalyzing(true);
        const macros = await reanalyzeFoodMacros(food);
        if (!macros) return;

        setFoods((prev) =>
          prev.map((f) => {
            if (f.id !== food.id) return f;
            return {
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
            };
          }),
        );
      } catch (e) {
        console.warn("[scan-meal] add reanalyze failed", e);
      } finally {
        setIsReanalyzing(false);
      }
    },
    [showToast],
  );

  // Portion +/- scales item totals by ratio (macros here are already totals for the current portion)
  const onQuickAdjustPortion = useCallback(
    async (id: string, delta: number) => {
      await Haptics.selectionAsync().catch(() => {});

      setFoods((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;

          const oldAmt = Number(f.portion?.amount ?? 1) || 1;
          const nextAmt = clamp(roundTo(oldAmt + delta, 0.1), 0.1, 5000);

          // ✅ scale totals by ratio (macros are already totals for the current portion)
          const ratio = nextAmt / oldAmt;

          const scale = (v?: number) =>
            v == null ? undefined : Math.max(0, Number(v) * ratio);

          return {
            ...f,
            portion: {
              ...f.portion,
              amount: nextAmt,
              multiplier: 1, // ✅ keep multiplier neutral to avoid huge explosions
            },
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
    },
    [],
  );

  const onConfirmAndLog = useCallback(async () => {
    if (!hasFoods) {
      Alert.alert("Nothing to log", "Add at least one food item.");
      return;
    }

    setIsLogging(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {},
      );

      const chosenMeal = categoryToMealKey(category);

      const items: AddPayload[] = foods.map((f) => {
        const qty = Number(f.portion?.amount || 1) || 1;
        const unit = String(f.portion?.unit || "serving");

        const calories = Math.round(f.macros.calories ?? 0);
        const protein = round1(f.macros.protein ?? 0);
        const carbs = round1(f.macros.carbs ?? 0);
        const fat = round1(f.macros.fat ?? 0);

        const sugar =
          f.macros.sugar != null ? round1(f.macros.sugar ?? 0) : undefined;
        const fiber =
          f.macros.fiber != null ? round1(f.macros.fiber ?? 0) : undefined;

        // ✅ sodiumMg -> sodium (no scaling)
        const sodium =
          f.macros.sodiumMg != null
            ? Math.round(f.macros.sodiumMg ?? 0)
            : undefined;

        const satFat =
          f.macros.satFat != null ? round1(f.macros.satFat ?? 0) : undefined;

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
          sodium, // ✅ sodiumMg -> sodium
          satFat,
          source: "scan",
        };
      });

      const targetKey =
        returnTo === "meal-builder"
          ? PENDING_MEAL_BUILDER_ADDITIONS_KEY
          : PENDING_BATCH_KEY;

      await AsyncStorage.setItem(
        targetKey,
        JSON.stringify({ date: dateStr, meal: chosenMeal, items }),
      );

      await AsyncStorage.setItem("@badges_dirty", "1").catch(() => {});

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});

      router.back();
    } catch (e: any) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      Alert.alert("Couldn’t log meal", e?.message ?? "Try again.");
      setState("review");
    } finally {
      setIsLogging(false);
    }
  }, [hasFoods, foods, dateStr, category, router]);

  const primaryLabel = useMemo(() => {
    if (state === "idle") return "Take a photo";
    if (state === "photo_ready") return "Scan with AI";
    if (state === "review") return isLogging ? "Logging…" : "Confirm & log";
    if (state === "analyzing") return "Scanning…";
    return "Continue";
  }, [state, isLogging]);

  const primaryAction = useMemo(() => {
    if (state === "idle") return pickFromCamera;
    if (state === "photo_ready") return onAnalyze;
    if (state === "review") return onConfirmAndLog;
    return undefined;
  }, [state, pickFromCamera, onAnalyze, onConfirmAndLog]);

  const secondaryLabel = useMemo(() => {
    if (state === "idle") return "Choose from library";
    if (state === "photo_ready") return "Retake / change";
    if (state === "review") return "Add item";
    return undefined;
  }, [state]);

  const secondaryAction = useMemo(() => {
    if (state === "idle") return pickFromLibrary;
    if (state === "photo_ready") return () => setState("idle");
    if (state === "review") return () => setShowAdd(true);
    return undefined;
  }, [state, pickFromLibrary]);

  const tertiaryLabel = useMemo(() => {
    if (state === "photo_ready" || state === "review") return "Start over";
    return undefined;
  }, [state]);

  const tertiaryAction = useMemo(() => {
    if (state === "photo_ready" || state === "review") return onReset;
    return undefined;
  }, [state, onReset]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScanMealHeader
          title="Scan a Meal"
          subtitle="Photo → Review → Log"
          onClose={() => router.back()}
          onExplain={() => setShowExplain(true)}
        />
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          <Text
            style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}
          >
            {quota.unlimited
              ? "Unlimited scans enabled"
              : `Scans left today: ${Math.max(0, quota.remaining)} / ${
                  quota.limit
                }`}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PhotoCard
            state={state}
            photoUri={photoUri}
            onTakePhoto={pickFromCamera}
            onPickLibrary={pickFromLibrary}
            onScan={onAnalyze}
          />

          {state === "review" ? (
            <View
              style={[
                styles.hero,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                Review & confirm
              </Text>
              <Text style={[styles.heroSub, { color: colors.muted }]}>
                Everything is editable. Macros are estimates based on your
                portions.
              </Text>

              {lowConfidenceCount > 0 ? (
                <View
                  style={[
                    styles.banner,
                    {
                      backgroundColor: isDark
                        ? "rgba(245,158,11,0.14)"
                        : "rgba(217,119,6,0.16)",
                      borderColor: isDark
                        ? "rgba(245,158,11,0.28)"
                        : "rgba(217,119,6,0.26)",
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={colors.warning}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={[styles.bannerText, { color: colors.text }]}>
                    We’re not fully sure about {lowConfidenceCount} item
                    {lowConfidenceCount > 1 ? "s" : ""}. Please confirm.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Detected items
            </Text>
            <ExplainAIButton onPress={() => setShowExplain(true)} />
          </View>

          {state === "review" ? <ConfidenceLegend /> : null}

          {state === "review" ? (
            <DetectedFoodList
              foods={foods}
              onPressItem={onOpenEdit}
              onRemove={onRemove}
              onQuickAdjust={onQuickAdjustPortion}
              onAdd={() => setShowAdd(true)}
            />
          ) : (
            <View
              style={[
                styles.placeholderCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.muted}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.placeholderTitle, { color: colors.text }]}>
                  Transparent AI, every time
                </Text>
                <Text style={[styles.placeholderSub, { color: colors.muted }]}>
                  We’ll show detected items, confidence, and let you edit
                  anything before logging.
                </Text>
              </View>
            </View>
          )}

          {state === "review" ? (
            <>
              <View style={{ height: 10 }} />
              <MacroSummaryCard totals={totals} />

              <View style={{ height: 12 }} />
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Meal type
                </Text>
                <Text style={[styles.sectionHint, { color: colors.muted }]}>
                  Can change anytime
                </Text>
              </View>
              <MealCategoryPills value={category} onChange={setCategory} />

              <View
                style={[
                  styles.notesCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.notesHeader}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={colors.muted}
                  />
                  <Text style={[styles.notesTitle, { color: colors.text }]}>
                    Notes
                  </Text>
                  <Text style={[styles.notesHint, { color: colors.muted }]}>
                    Optional
                  </Text>
                </View>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="E.g., extra sauce on the side…"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.notesInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                  multiline
                />
              </View>

              <View style={{ height: 18 }} />
            </>
          ) : null}

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Processing overlay */}
        <Modal
          transparent
          visible={state === "analyzing" || isLogging || isReanalyzing}
        >
          <View style={styles.overlayWrap}>
            <BlurView
              intensity={35}
              tint={isDark ? "dark" : "light"}
              style={styles.overlayBlur}
            />
            <View
              style={[
                styles.overlayCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.overlayRow}>
                <ActivityIndicator />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.overlayTitle, { color: colors.text }]}>
                    {state === "analyzing"
                      ? "Scanning meal"
                      : isLogging
                        ? "Logging meal"
                        : "Reanalyzing item"}
                  </Text>
                  <Text style={[styles.overlaySub, { color: colors.muted }]}>
                    {state === "analyzing"
                      ? "Detecting foods and estimating macros."
                      : isLogging
                        ? "Saving to your diary…"
                        : "Updating calories and macros for your edits."}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.overlayDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <Text style={[styles.overlayFoot, { color: colors.muted }]}>
                You’ll review everything before it’s final.
              </Text>
            </View>
          </View>
        </Modal>

        <BottomActionBar
          primaryLabel={primaryLabel}
          primaryDisabled={!primaryAction || state === "analyzing" || isLogging}
          onPrimary={primaryAction}
          secondaryLabel={secondaryLabel}
          onSecondary={secondaryAction}
          tertiaryLabel={tertiaryLabel}
          onTertiary={tertiaryAction}
        />

        <ExplainAIModal
          visible={showExplain}
          onClose={() => setShowExplain(false)}
        />

        <EditFoodSheet
          visible={!!editFood}
          food={editFood}
          onClose={() => setEditFood(null)}
          onSave={onUpdateFood}
          onRemove={editFood ? () => onRemove(editFood.id) : undefined}
        />

        <AddFoodSheet
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onAdd={onAddFood}
        />

        <Toast
          visible={!!toast}
          title={toast?.title ?? ""}
          subtitle={toast?.subtitle}
          onHide={() => setToast(null)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 18 },

  hero: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
  },
  heroTitle: { fontSize: 16.5, fontWeight: "900" },
  heroSub: { marginTop: 6, fontSize: 12.5, fontWeight: "600", lineHeight: 17 },

  banner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  bannerText: { fontSize: 12.5, fontWeight: "700", flex: 1, lineHeight: 17 },

  sectionRow: {
    marginTop: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionHint: { fontSize: 12, fontWeight: "700" },

  placeholderCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  placeholderTitle: { fontSize: 14, fontWeight: "800" },
  placeholderSub: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
    fontWeight: "600",
  },

  notesCard: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  notesHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  notesTitle: { fontSize: 14, fontWeight: "800", marginLeft: 8 },
  notesHint: { marginLeft: 8, fontSize: 12, fontWeight: "700" },
  notesInput: {
    minHeight: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  overlayWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlayBlur: { ...StyleSheet.absoluteFill },
  overlayCard: {
    width: "86%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  overlayRow: { flexDirection: "row", alignItems: "center" },
  overlayTitle: { fontSize: 14.5, fontWeight: "900" },
  overlaySub: { fontSize: 12.5, marginTop: 2, fontWeight: "600" },
  overlayDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  overlayFoot: { fontSize: 12.25, lineHeight: 16, fontWeight: "600" },
});
