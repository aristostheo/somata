import { useAccountStorage } from "@/services/local/accountStore";
import { queueNutritionHandoff } from "@/services/queueNutritionHandoff";
import { ScanItems } from "@/components/somata/ScanItems";
import { Button, Choice, Heading, IconButton, Panel, TaskPage } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert,
  Image,
  LayoutAnimation, Modal, StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddFoodSheet from "@/components/scanMeal/new/AddFoodSheet";
import EditFoodSheet from "@/components/scanMeal/new/EditFoodSheet";
import ExplainAIModal from "@/components/scanMeal/new/ExplainAIModal";
import { computeTotals } from "@/components/scanMeal/new/services/macroMath";
import { scanMealFromImage } from "@/components/scanMeal/new/services/scanMealService";
import {
  type DetectedFood,
  type MacroTotals,
  type ScanMealResult,
  type ScanState,
  clamp,
  roundTo,
} from "@/components/scanMeal/new/types";
import { useTheme } from "@/content/ThemeProvider";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";
import { callOpenAIJson } from "@/services/openai";
import {
  getScanQuotaStatus,
  refundScanToken,
  reserveScanToken,
} from "@/services/scanMeal/scanQuota";

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
    { operation: "foodMacros", maxTokens: 700, temperature: 0.3 }
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
  return <SomataTaskAppearance><ScanMealV2ScreenContent /></SomataTaskAppearance>;
}

function ScanMealV2ScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme() as any;
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    returnTo?: string;
    builderSessionId?: string;
  }>();

  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  const dateStr =
    (params.date as string) || dayKey(new Date());
  const initialMealKey = safeMealKey(params.meal);
  const returnTo = String(params.returnTo || "");
  const builderSessionId = String(params.builderSessionId || "");

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
  const confirmInFlight = useRef(false);
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
    refreshQuota().catch(() => { });
  }, [refreshQuota]);

  useEffect(() => {
    if (cameraPermission?.granted != null) return;
    requestCameraPermission().catch(() => { });
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
        ).catch(() => { });
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
        ).catch(() => { });
      } catch (e: any) {
        if (!aliveRef.current) return;
        await refundScanToken({ limit: DAILY_SCAN_LIMIT }).catch(() => { });
        await refreshQuota().catch(() => { });
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
      await Haptics.selectionAsync().catch(() => { });
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
    await Haptics.selectionAsync().catch(() => { });
    await analyzePhoto(uri);
  }, [analyzePhoto, requestLibraryPerms]);

  const onReset = useCallback(async () => {
    await Haptics.selectionAsync().catch(() => { });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setState("idle");
    setPhotoUri(null);
    setFoods([]);
  }, []);

  const onOpenEdit = useCallback(async (food: DetectedFood) => {
    await Haptics.selectionAsync().catch(() => { });
    setEditFood(food);
  }, []);

  const onRemove = useCallback(async (id: string) => {
    await Haptics.selectionAsync().catch(() => { });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const onQuickAdjustPortion = useCallback(async (id: string, delta: number) => {
    await Haptics.selectionAsync().catch(() => { });
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
      await Haptics.selectionAsync().catch(() => { });
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
    await Haptics.selectionAsync().catch(() => { });
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

    if (confirmInFlight.current) return;
    confirmInFlight.current = true;
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

      await queueNutritionHandoff(targetKey, { date: dateStr, meal: chosenMeal, items, ...(returnTo === "meal-builder" ? { builderSessionId } : {}) }, localStore);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => { });
      localStore.assertCurrent();
      router.back();
    } catch (e: any) {
      confirmInFlight.current = false;
      Alert.alert("Couldn’t add scanned meal", e?.message ?? "Try again.");
    } finally {
      setIsLogging(false);
    }
  }, [category, dateStr, foods, hasFoods, returnTo, builderSessionId, localStore, router]);

  const showResultsSheet = state === "review";
  const showProcessing = state === "analyzing" || isLogging || isReanalyzing;

  return (<>
    <TaskPage title={showResultsSheet ? 'Meal review' : 'Capture a meal'} section="Nutrition / live capture" onBack={() => router.back()}
      action={<IconButton label="How scanning works" icon="information-circle-outline" onPress={() => setShowExplain(true)} />}
      footer={showResultsSheet ? <Button label={isLogging ? 'Logging…' : 'Add to meal'} primary disabled={showProcessing || !hasFoods} onPress={onConfirm} /> :
        <View style={F.wrap}>
          <View style={{ flex: 1 }}>
            <Button label="Library" icon="images-outline" disabled={showProcessing} onPress={onPickLibrary} />
          </View>

          <View style={{ flex: 1 }}>
            <Button label="Capture" icon="camera-outline" primary disabled={showProcessing} onPress={onCapture} />
          </View>
        </View>}>

      <Panel accent><View style={{ ...F.row, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 8 }}><Text style={F.eyebrow}>{showResultsSheet ? '02 / REVIEW & CONFIRM' : '01 / CAPTURE'}</Text>
          <Text style={F.heading}>{showResultsSheet ? 'Your review comes first' : 'One photo. Your food record.'}</Text></View>
        <Ionicons name="scan-outline" size={30} color={D.teal} />
      </View><Text style={F.caption}>{quota.unlimited ? 'Unlimited scans enabled' : `${Math.max(0, quota.remaining)} scans left today`}</Text><Text style={F.body}>Foods and portions are estimates. Check each item before confirming.</Text></Panel>

      <View style={{ minHeight: 250, height: cameraPermission?.granted || photoUri ? (showResultsSheet ? 160 : 300) : undefined, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: D.line, backgroundColor: D.card }}>

        {photoUri ? <Image source={{ uri: photoUri }} style={{ flex: 1 }} /> : cameraPermission?.granted ? <CameraView ref={cameraRef} facing="back" enableTorch={torch} style={{ flex: 1 }} /> :
          <View style={{ padding: 22, gap: 18 }}>
            <Text style={F.body}>Allow camera access to capture a meal.</Text>
            <Button label="Enable camera" onPress={() => requestCameraPermission()} />
          </View>}

      </View>

      <View style={F.wrap}>
        {!photoUri && <Choice label={torch ? 'Flash on' : 'Flash off'} selected={torch} onPress={() => setTorch(value => !value)} />}

        {!!photoUri && <Button label="Start over" disabled={showProcessing} onPress={onReset} />}
      </View>

      {showProcessing && <Panel>
        <Heading title={isLogging ? 'Logging meal' : isReanalyzing ? 'Updating food' : 'Scanning photo'} detail="Please wait for this operation to finish." />
      </Panel>}

      {showResultsSheet && <><Panel><Heading title="Meal destination" /><View style={F.wrap}>
        {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as MealCategory[]).map(value => <Choice key={value} label={value} selected={category === value} onPress={() => setCategory(value)} />)}
      </View></Panel>
        {lowConfidenceCount > 0 && <Text style={{ ...F.body, color: D.amber }}>Check the {lowConfidenceCount} low-confidence items before logging.</Text>}
        <ScanItems step={0.5} foods={foods} totals={totals} onEdit={onOpenEdit} onRemove={onRemove} onAdjust={onQuickAdjustPortion} onAdd={() => setShowAdd(true)} /></>}
    </TaskPage>
    <Modal visible={showProcessing} transparent>
      <View style={{ flex: 1, justifyContent: 'center', padding: 25, backgroundColor: '#000000B3' }}>
        <Panel>
          <ActivityIndicator color={D.teal} />
          <Heading title={isLogging ? 'Logging meal' : isReanalyzing ? 'Updating food' : 'Scanning photo'} detail="Please wait for this operation to finish." />
        </Panel>
      </View>
    </Modal>
    <ExplainAIModal visible={showExplain} onClose={() => setShowExplain(false)} />
    <EditFoodSheet visible={!!editFood} food={editFood} onClose={() => setEditFood(null)} onSave={onUpdateFood} onRemove={editFood ? () => onRemove(editFood.id) : undefined} />
    <AddFoodSheet visible={showAdd} onClose={() => setShowAdd(false)} onAdd={onAddFood} />
  </>
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
