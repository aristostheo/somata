import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Alert } from "react-native";
import { queueNutritionHandoff } from "@/services/queueNutritionHandoff";
import { validateMealEstimate } from "@/services/aiValidation";
import { Button, Choice, Empty, Field as FormField, Heading, IconButton, Item, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { dayKey } from "@/utils/date";
import Constants from "expo-constants";
// app/(modals)/add-meal.tsx
// Drop-in ✅
// Premium Add Meal front page (Apple-inspired, glossy dark, calm gradients)
// Keeps your existing backend wiring: recents/search/describe/barcode -> confirm sheet -> done()
// Depends on: expo-router, expo-blur, expo-linear-gradient, expo-camera, expo-haptics, moti, @react-native-async-storage/async-storage

import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  findNodeHandle,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";

import { searchCatalog } from "@/services/foodCatalog";
import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";
import { callOpenAIJson } from "@/services/openai";

// Optional (you already import this in your file)
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
type TabKey =
  | "recents"
  | "search"
  | "describe"
  | "barcode"
  | "manual"
  | "favorites";

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

  // Advanced macros (optional)
  addedSugar?: number; // g
  satFat?: number; // g
  sodium?: number; // mg
  wholeFoodRatio?: number; // 0..1
  veggieFruitServings?: number; // 0..6+
  unsatFatRatio?: number; // 0..1
  alcoholCalories?: number; // kcal

  source: "catalog" | "manual" | "recent" | "popular" | "describe" | "barcode";
};

type DraftItem = {
  name: string;
  unit: string;
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;

  // Advanced
  addedSugar?: number;
  satFat?: number;
  sodium?: number;
  wholeFoodRatio?: number;
  veggieFruitServings?: number;
  unsatFatRatio?: number;
  alcoholCalories?: number;

  source: AddPayload["source"];
};

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
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
};

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function clamp0(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function formatSheetDate(dateISO: string) {
  const date = new Date(`${dateISO}T12:00:00`);
  const today = new Date();
  const sameDay =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate();
  if (sameDay) return "Today";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function defaultMealForTime(): MealKey {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snacks";
}

function titleCaseFoodName(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/* ───────────── Describe helpers ───────────── */
function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function extractJsonFromText(text: string): any | null {
  const s = text.trim();
  const direct = safeJsonParse(s);
  if (direct) return direct;

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    const sub = s.slice(objStart, objEnd + 1);
    const parsed = safeJsonParse(sub);
    if (parsed) return parsed;
  }

  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    const sub = s.slice(arrStart, arrEnd + 1);
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
function normalizeDescribeItem(gotRaw: any, fallbackName: string) {
  const got = unwrapDescribePayload(gotRaw) || {};
  validateMealEstimate({ ...got, calories: got.calories ?? got.kcal ?? got.energy,
    protein: got.protein ?? got.proteins, carbs: got.carbs ?? got.carbohydrates, fat: got.fat ?? got.fats });
  const name = String(got.name ?? got.title ?? got.food ?? fallbackName).trim();
  const unit = String(got.unit ?? got.servingUnit ?? "serving").trim();

  const qty =
    Number(got.quantity ?? got.qty ?? got.servingQty ?? got.servings ?? 1) || 1;

  const calories = Number(got.calories ?? got.kcal ?? got.energy ?? 0) || 0;
  const protein = Number(got.protein ?? got.proteins ?? 0) || 0;
  const carbs = Number(got.carbs ?? got.carbohydrates ?? 0) || 0;
  const fat = Number(got.fat ?? got.fats ?? 0) || 0;

  const sugar =
    got.sugar != null
      ? Number(got.sugar)
      : got.sugars != null
        ? Number(got.sugars)
        : undefined;

  const fiber =
    got.fiber != null
      ? Number(got.fiber)
      : got.fibre != null
        ? Number(got.fibre)
        : undefined;

  // Optional advanced fields
  const addedSugar =
    got.addedSugar != null
      ? Number(got.addedSugar)
      : got.addedSugarG != null
        ? Number(got.addedSugarG)
        : undefined;

  const satFat =
    got.satFat != null
      ? Number(got.satFat)
      : got.saturatedFat != null
        ? Number(got.saturatedFat)
        : got.satFatG != null
          ? Number(got.satFatG)
          : undefined;

  const sodium = got.sodium != null ? Number(got.sodium) : undefined;

  const wholeFoodRatio =
    got.wholeFoodRatio != null ? Number(got.wholeFoodRatio) : undefined;
  const veggieFruitServings =
    got.veggieFruitServings != null
      ? Number(got.veggieFruitServings)
      : undefined;
  const unsatFatRatio =
    got.unsatFatRatio != null ? Number(got.unsatFatRatio) : undefined;
  const alcoholCalories =
    got.alcoholCalories != null ? Number(got.alcoholCalories) : undefined;

  return {
    name,
    unit,
    qty,
    calories,
    protein,
    carbs,
    fat,
    sugar,
    fiber,
    addedSugar,
    satFat,
    sodium,
    wholeFoodRatio,
    veggieFruitServings,
    unsatFatRatio,
    alcoholCalories,
  };
}

/* ───────────── Barcode resolve + cache ───────────── */
type SourceTag = "OFF" | "FDC";
type ResolvedProduct = {
  name: string;
  brand?: string | null;
  unit: string; // "serving" | "100 g" | "100 ml"
  per: number; // 1 or 100
  nutrients: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
  };
  fdcId?: string | null;
  source?: SourceTag;
};

type FdcItem = {
  fdcId: string;
  description: string;
  brandOwner?: string;
  labelNutrients?: {
    calories?: { value: number; };
    protein?: { value: number; };
    carbohydrates?: { value: number; };
    fat?: { value: number; };
    fiber?: { value: number; };
    sugars?: { value: number; };
  };
};

const FDC_API_KEY = Constants.expoConfig?.extra?.fdcApiKey as string | undefined;

async function searchFDC(queryStr: string): Promise<FdcItem[]> {
  if (!FDC_API_KEY || !queryStr.trim()) return [];
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      FDC_API_KEY,
    )}&query=${encodeURIComponent(queryStr)}&dataType=Branded&pageSize=10`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.foods || []) as FdcItem[];
  } catch {
    return [];
  }
}

async function lookupOpenFoodFacts(
  barcode: string,
): Promise<ResolvedProduct | null> {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode,
      )}.json`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.status !== 1) return null;

    const p = j.product || {};
    const nutr = p.nutriments || {};

    const hasServing =
      nutr["energy-kcal_serving"] ||
      nutr["proteins_serving"] ||
      nutr["carbohydrates_serving"] ||
      nutr["fat_serving"] ||
      nutr["sugars_serving"] ||
      nutr["fiber_serving"];

    if (hasServing) {
      return {
        name: String(p.product_name || p.generic_name || "Food"),
        brand: p.brands || null,
        unit: "serving",
        per: 1,
        nutrients: {
          calories:
            nutr["energy-kcal_serving"] ??
            (nutr["energy_serving"]
              ? nutr["energy_serving"] / 4.184
              : undefined),
          protein: nutr["proteins_serving"],
          carbs: nutr["carbohydrates_serving"],
          fat: nutr["fat_serving"],
          sugar: nutr["sugars_serving"],
          fiber: nutr["fiber_serving"],
        },
        fdcId: null,
        source: "OFF",
      };
    }

    const baseIsMl = (p.quantity || "").toLowerCase().includes("ml");
    return {
      name: String(p.product_name || p.generic_name || "Food"),
      brand: p.brands || null,
      unit: baseIsMl ? "100 ml" : "100 g",
      per: 100,
      nutrients: {
        calories:
          nutr["energy-kcal_100g"] ??
          (nutr["energy_100g"] ? nutr["energy_100g"] / 4.184 : undefined),
        protein: nutr["proteins_100g"],
        carbs: nutr["carbohydrates_100g"],
        fat: nutr["fat_100g"],
        sugar: nutr["sugars_100g"],
        fiber: nutr["fiber_100g"],
      },
      fdcId: null,
      source: "OFF",
    };
  } catch {
    return null;
  }
}

async function lookupFDCByBarcode(
  barcode: string,
): Promise<ResolvedProduct | null> {
  const items = await searchFDC(barcode);
  if (!items?.length) return null;
  const x = items[0];
  const ln = x.labelNutrients || {};
  return {
    name: x.description || "Food",
    brand: x.brandOwner || null,
    unit: "serving",
    per: 1,
    nutrients: {
      calories: ln.calories?.value,
      protein: ln.protein?.value,
      carbs: ln.carbohydrates?.value,
      fat: ln.fat?.value,
      sugar: ln.sugars?.value,
      fiber: ln.fiber?.value,
    },
    fdcId: String(x.fdcId),
    source: "FDC",
  };
}

const CACHE_KEY = "@barcode_cache_v1";
const PENDING_BATCH_KEY = "@pending_add_meal_batch_v1";

function variantsFor(barcode: string): string[] {
  const b = barcode.trim();
  const xs = new Set<string>([b]);
  if (b.length === 12 && b.startsWith("0")) xs.add(b.slice(1));
  if (b.length === 11) xs.add("0" + b);
  if (b.length === 13 && b.startsWith("0")) xs.add(b.slice(1));
  if (b.length === 8 && !b.startsWith("0")) xs.add("0" + b);
  return Array.from(xs);
}

async function getCache(localStore: AccountStore = accountStorage()): Promise<Record<string, ResolvedProduct>> {
  try {
    const raw = await localStore.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function setCache(map: Record<string, ResolvedProduct>, localStore: AccountStore = accountStorage()) {
  try {
    await localStore.setItem(CACHE_KEY, JSON.stringify(map));
  } catch { }
}
async function cacheSave(barcode: string, item: ResolvedProduct, localStore: AccountStore = accountStorage()) {
  const map = await getCache(localStore);
  map[barcode] = item;
  await setCache(map, localStore);
}
async function cacheLoad(barcode: string, localStore: AccountStore = accountStorage()): Promise<ResolvedProduct | null> {
  const map = await getCache(localStore);
  return map[barcode] ?? null;
}

function scoreCandidate(r: ResolvedProduct): number {
  const filled = [
    "calories",
    "protein",
    "carbs",
    "fat",
    "sugar",
    "fiber",
  ].reduce((s, k) => s + (Number.isFinite((r.nutrients as any)[k]) ? 1 : 0), 0);
  const servingBonus = r.per === 1 ? 3 : 0;
  const srcBonus = r.source === "OFF" ? 1 : 0;
  return filled + servingBonus + srcBonus;
}

async function resolveBarcodeCandidates(
  barcode: string, localStore: AccountStore = accountStorage()
): Promise<ResolvedProduct[]> {
  const cached = await cacheLoad(barcode, localStore);
  if (cached) return [cached];

  const tries = variantsFor(barcode);
  const seen: ResolvedProduct[] = [];

  for (const b of tries) {
    const off = await lookupOpenFoodFacts(b);
    if (off) seen.push(off);
    const fdc = await lookupFDCByBarcode(b);
    if (fdc) seen.push(fdc);
  }

  const key = (x: ResolvedProduct) =>
    [x.name, x.brand || "", x.unit, x.per, x.source || ""]
      .join("|")
      .toLowerCase();

  const uniq = Array.from(new Map(seen.map((v) => [key(v), v])).values());
  return uniq.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
}

/* ───────────── UI atoms ───────────── */

/* ───────────── Confirm sheet content (keeps your advanced toggle + qty scaling) ───────────── */
function ConfirmSheetContent({
  colors,
  isDark,
  edits,
  setEdits,
  onCancel,
  onConfirm,
}: {
  colors: any;
  isDark: boolean;
  edits: any;
  setEdits: (fn: any) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { D, F } = useSomataTheme();

  const scrollRef = React.useRef<ScrollView>(null);

  const qtyRef = React.useRef<TextInput | null>(null);

  const scrollToInput = React.useCallback(
    (ref?: React.RefObject<TextInput | null>) => {
      const node = ref?.current ? findNodeHandle(ref.current) : null;
      if (!node) return;
      // @ts-ignore
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        node,
        140,
        true,
      );
    },
    [],
  );

  const numOnly = (t: string) => t.replace(/[^0-9.]/g, "");
  const toNumOr = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const formatScaled = (n: number) => {
    if (!Number.isFinite(n)) return "";
    const rounded = Math.round(n * 10) / 10;
    return String(rounded);
  };

  const scaleQtyMacros = React.useCallback((prev: any, nextQtyRaw: string) => {
    const nextQty = toNumOr(nextQtyRaw, 0);
    const baseQty = toNumOr(prev._baseQty, toNumOr(prev.qty, 0));
    if (baseQty <= 0 || nextQty <= 0) return { ...prev, qty: nextQtyRaw };

    const ratio = nextQty / baseQty;
    const scaleField = (baseKey: string) => {
      const raw = String(prev[baseKey] ?? "");
      const base = toNumOr(raw, 0);
      const scaled = base * ratio;
      return formatScaled(scaled);
    };

    return {
      ...prev,
      qty: nextQtyRaw,
      calories: scaleField("_baseCalories"),
      protein: scaleField("_baseProtein"),
      carbs: scaleField("_baseCarbs"),
      fat: scaleField("_baseFat"),
      sugar: prev._baseSugar ? scaleField("_baseSugar") : prev.sugar,
      fiber: prev._baseFiber ? scaleField("_baseFiber") : prev.fiber,
      addedSugar: prev._baseAddedSugar
        ? scaleField("_baseAddedSugar")
        : prev.addedSugar,
      satFat: prev._baseSatFat ? scaleField("_baseSatFat") : prev.satFat,
      sodium: prev._baseSodium ? scaleField("_baseSodium") : prev.sodium,
      alcoholCalories: prev._baseAlcoholCalories
        ? scaleField("_baseAlcoholCalories")
        : prev.alcoholCalories,
      veggieFruitServings: prev._baseVeggieFruitServings
        ? scaleField("_baseVeggieFruitServings")
        : prev.veggieFruitServings,
    };
  }, []);

  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  return (<View style={{ gap: 21 }}>

    <View style={{ gap: 6 }}>
      <Text style={F.eyebrow}>PORTION & NUTRITION</Text>
      <Text style={F.heading}>{edits.name || 'Food'}</Text>
    </View>

    <FormField label="Food name" value={edits.name} onChangeText={text => setEdits((prev: any) => ({ ...prev, name: text }))} />

    <View style={F.wrap}>
      <FormField ref={qtyRef} label="Quantity" value={edits.qty} keyboardType="decimal-pad"
        onChangeText={text => setEdits((prev: any) => scaleQtyMacros(prev, numOnly(text)))} />

      <FormField label="Unit" value={edits.unit} onChangeText={text => setEdits((prev: any) => ({ ...prev, unit: text }))} />
    </View>

    <Text style={F.caption}>Quantity changes scale the original nutrition values. You can edit totals below.</Text>

    <View style={F.wrap}>
      {[['calories', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'], ['sugar', 'Sugar (g)'], ['fiber', 'Fiber (g)']].map(([key, label]) =>
        <View key={key} style={{ flex: 1, minWidth: 130 }}>
          <FormField label={label} value={edits[key]} keyboardType="decimal-pad" onChangeText={text => setEdits((prev: any) => ({ ...prev, [key]: numOnly(text) }))} />
        </View>)}
    </View>

    <Button label={advancedOpen ? 'Hide additional nutrients' : 'Additional nutrients & food details'} icon={advancedOpen ? 'remove' : 'add'} onPress={() => { Haptics.selectionAsync().catch(() => { }); setAdvancedOpen(value => !value); }} />

    {advancedOpen && <View style={{ gap: 13 }}>
      {[['addedSugar', 'Added sugar (g)'], ['satFat', 'Saturated fat (g)'], ['sodium', 'Sodium (mg)'], ['alcoholCalories', 'Alcohol kcal'],
      ['wholeFoodRatio', 'Whole food ratio (0..1)'], ['veggieFruitServings', 'Vegetable / fruit servings'], ['unsatFatRatio', 'Unsaturated fat ratio (0..1)']].map(([key, label]) =>
        <FormField key={key} label={label} value={edits[key]} keyboardType="decimal-pad" onChangeText={text => setEdits((prev: any) => ({ ...prev, [key]: numOnly(text) }))} />)}
    </View>}

    <Button label="Add to log" primary icon="checkmark" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); onConfirm(); }} />

    <Button label="Cancel" onPress={onCancel} />
  </View>
  );
}

/* ───────────── Main ───────────── */
export default function AddMealModal() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    initialTab?: string;
    returnTo?: string;
    builderSessionId?: string;
    query?: string;
  }>();
  const [meal, setMeal] = useState<MealKey>(
    (params.meal as MealKey) || defaultMealForTime(),
  );
  const date = (params.date as string) || dayKey(new Date());

  const initialTab = (params.initialTab as TabKey) || "recents";
  const returnTo = String(params.returnTo || "");
  const builderSessionId = String(params.builderSessionId || "");
  const [tab, setTab] = useState<TabKey>(
    [
      "recents",
      "search",
      "describe",
      "barcode",
      "manual",
      "favorites",
    ].includes(initialTab)
      ? initialTab
      : "recents",
  );

  // Recents
  const [myRecents, setMyRecents] = useState<RecentFood[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [recentVisible, setRecentVisible] = useState(15);

  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [topFoodsLoading, setTopFoodsLoading] = useState(false);

  // Search
  const [q, setQ] = useState(String(params.query || ""));
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounce = useRef<any>(null);

  // Describe
  const [descText, setDescText] = useState("");
  const [descLoading, setDescLoading] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  // Manual
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Quick Add (fast macro entry)
  const [qaName, setQaName] = useState("");
  const [qaCalories, setQaCalories] = useState("");
  const [qaProtein, setQaProtein] = useState("");
  const [qaCarbs, setQaCarbs] = useState("");
  const [qaFat, setQaFat] = useState("");

  // Confirm sheet
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<DraftItem | null>(null);
  const [confirmEdits, setConfirmEdits] = useState({
    name: "",
    qty: "1",
    unit: "serving",
    calories: "0",
    protein: "0",
    carbs: "0",
    fat: "0",
    sugar: "",
    fiber: "",

    addedSugar: "",
    satFat: "",
    sodium: "",
    wholeFoodRatio: "",
    veggieFruitServings: "",
    unsatFatRatio: "",
    alcoholCalories: "",

    _baseQty: "1",
    _baseCalories: "0",
    _baseProtein: "0",
    _baseCarbs: "0",
    _baseFat: "0",
    _baseSugar: "",
    _baseFiber: "",
    _baseAddedSugar: "",
    _baseSatFat: "",
    _baseSodium: "",
    _baseAlcoholCalories: "",
    _baseVeggieFruitServings: "",
  });

  // Barcode tab
  const [permission, requestPermission] = useCameraPermissions();
  const [scanBusy, setScanBusy] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const [pickOpen, setPickOpen] = useState(false);
  const [candidates, setCandidates] = useState<ResolvedProduct[]>([]);
  const [candidatePending, setCandidatePending] = useState(false);

  // Permission on entering barcode tab
  useEffect(() => {
    if (tab !== "barcode") return;
    if (!permission?.granted) requestPermission().catch(() => { });
  }, [tab, permission?.granted, requestPermission]);

  function done(payload: AddPayload) {
    const targetKey =
      returnTo === "meal-builder"
        ? PENDING_MEAL_BUILDER_ADDITIONS_KEY
        : "@pending_add_meal";

    const targetPayload =
      returnTo === "meal-builder"
        ? {
          date,
          meal,
          items: [payload],
          builderSessionId,
        }
        : payload;

    queueNutritionHandoff(targetKey, targetPayload, localStore)
      .then(() => { localStore.assertCurrent(); router.back(); })
      .catch((error) => Alert.alert("Meal not saved", error.message));
  }

  function openPhotoScan() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    router.push({
      pathname: "/(modals)/scan-meal",
      params: {
        meal,
        date,
        ...(returnTo ? { returnTo, builderSessionId } : {}),
      },
    });
  }

  function closeConfirm() {
    Keyboard.dismiss();
    setConfirmOpen(false);
    setConfirmDraft(null);
  }

  function openConfirm(item: DraftItem) {
    const baseQty = String(item.qty ?? 1);
    const baseCalories = String(item.calories ?? 0);
    const baseProtein = String(item.protein ?? 0);
    const baseCarbs = String(item.carbs ?? 0);
    const baseFat = String(item.fat ?? 0);
    const baseSugar = item.sugar != null ? String(item.sugar) : "";
    const baseFiber = item.fiber != null ? String(item.fiber) : "";
    const baseAddedSugar =
      item.addedSugar != null ? String(item.addedSugar) : "";
    const baseSatFat = item.satFat != null ? String(item.satFat) : "";
    const baseSodium = item.sodium != null ? String(item.sodium) : "";
    const baseAlcoholCalories =
      item.alcoholCalories != null ? String(item.alcoholCalories) : "";
    const baseVeggieFruitServings =
      item.veggieFruitServings != null ? String(item.veggieFruitServings) : "";

    setConfirmDraft(item);
    setConfirmEdits({
      name: item.name ?? "",
      qty: baseQty,
      unit: item.unit ?? "serving",
      calories: baseCalories,
      protein: baseProtein,
      carbs: baseCarbs,
      fat: baseFat,
      sugar: baseSugar,
      fiber: baseFiber,

      addedSugar: baseAddedSugar,
      satFat: baseSatFat,
      sodium: baseSodium,
      wholeFoodRatio:
        item.wholeFoodRatio != null ? String(item.wholeFoodRatio) : "",
      veggieFruitServings: baseVeggieFruitServings,
      unsatFatRatio:
        item.unsatFatRatio != null ? String(item.unsatFatRatio) : "",
      alcoholCalories: baseAlcoholCalories,

      _baseQty: baseQty,
      _baseCalories: baseCalories,
      _baseProtein: baseProtein,
      _baseCarbs: baseCarbs,
      _baseFat: baseFat,
      _baseSugar: baseSugar,
      _baseFiber: baseFiber,
      _baseAddedSugar: baseAddedSugar,
      _baseSatFat: baseSatFat,
      _baseSodium: baseSodium,
      _baseAlcoholCalories: baseAlcoholCalories,
      _baseVeggieFruitServings: baseVeggieFruitServings,
    });

    requestAnimationFrame(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      setConfirmOpen(true);
    });
  }

  function confirmAndAdd() {
    if (!confirmDraft) return;

    const payload: AddPayload = {
      date,
      meal,
      name: (confirmEdits.name || confirmDraft.name || "Food").trim(),
      unit: (confirmEdits.unit || confirmDraft.unit || "serving").trim(),
      qty: clamp0(toNum(confirmEdits.qty)) || 1,
      calories: clamp0(toNum(confirmEdits.calories)),
      protein: clamp0(toNum(confirmEdits.protein)),
      carbs: clamp0(toNum(confirmEdits.carbs)),
      fat: clamp0(toNum(confirmEdits.fat)),
      sugar:
        confirmEdits.sugar.trim().length > 0
          ? clamp0(toNum(confirmEdits.sugar))
          : confirmDraft.sugar,
      fiber:
        confirmEdits.fiber.trim().length > 0
          ? clamp0(toNum(confirmEdits.fiber))
          : confirmDraft.fiber,

      addedSugar:
        confirmEdits.addedSugar.trim().length > 0
          ? clamp0(toNum(confirmEdits.addedSugar))
          : confirmDraft.addedSugar,
      satFat:
        confirmEdits.satFat.trim().length > 0
          ? clamp0(toNum(confirmEdits.satFat))
          : confirmDraft.satFat,
      sodium:
        confirmEdits.sodium.trim().length > 0
          ? clamp0(toNum(confirmEdits.sodium))
          : confirmDraft.sodium,
      wholeFoodRatio:
        confirmEdits.wholeFoodRatio.trim().length > 0
          ? Math.max(0, Math.min(1, toNum(confirmEdits.wholeFoodRatio)))
          : confirmDraft.wholeFoodRatio,
      veggieFruitServings:
        confirmEdits.veggieFruitServings.trim().length > 0
          ? clamp0(toNum(confirmEdits.veggieFruitServings))
          : confirmDraft.veggieFruitServings,
      unsatFatRatio:
        confirmEdits.unsatFatRatio.trim().length > 0
          ? Math.max(0, Math.min(1, toNum(confirmEdits.unsatFatRatio)))
          : confirmDraft.unsatFatRatio,
      alcoholCalories:
        confirmEdits.alcoholCalories.trim().length > 0
          ? clamp0(toNum(confirmEdits.alcoholCalories))
          : confirmDraft.alcoholCalories,

      source: confirmDraft.source,
    };

    // Optional cache writeback for barcode edits
    if (confirmDraft.source === "barcode" && scannedBarcode) {
      const per = payload.unit.includes("100") ? 100 : 1;
      cacheSave(scannedBarcode, {
        name: payload.name,
        unit: payload.unit,
        per,
        nutrients: {
          calories: payload.calories,
          protein: payload.protein,
          carbs: payload.carbs,
          fat: payload.fat,
          sugar: payload.sugar,
          fiber: payload.fiber,
        },
        fdcId: null,
        source: "OFF",
      }, localStore).catch(() => { });
    }

    closeConfirm(); localStore.setItem("@badges_dirty", "1").catch(() => { });
    done(payload);
  }

  // One unified entry: everything goes through confirm
  function pick(item: any, source: AddPayload["source"]) {
    const draft: DraftItem = {
      name: String(item.name || item.title || "Food").trim(),
      unit: String(item.unit || "serving"),
      qty: item.qty != null ? Number(item.qty) : 1,
      calories: Number(item.calories ?? item?.nutrients?.calories ?? 0),
      protein: Number(item.protein ?? item?.nutrients?.protein ?? 0),
      carbs: Number(item.carbs ?? item?.nutrients?.carbs ?? 0),
      fat: Number(item.fat ?? item?.nutrients?.fat ?? 0),
      sugar:
        item.sugar != null
          ? Number(item.sugar)
          : item?.nutrients?.sugar != null
            ? Number(item.nutrients.sugar)
            : undefined,
      fiber:
        item.fiber != null
          ? Number(item.fiber)
          : item?.nutrients?.fiber != null
            ? Number(item.nutrients.fiber)
            : undefined,

      addedSugar:
        item.addedSugar != null
          ? Number(item.addedSugar)
          : item.addedSugarG != null
            ? Number(item.addedSugarG)
            : undefined,
      satFat:
        item.satFat != null
          ? Number(item.satFat)
          : item.saturatedFat != null
            ? Number(item.saturatedFat)
            : item.satFatG != null
              ? Number(item.satFatG)
              : undefined,
      sodium:
        item.sodium != null
          ? Number(item.sodium)
          : item.sodiumMg != null
            ? Number(item.sodiumMg)
            : undefined,
      wholeFoodRatio:
        item.wholeFoodRatio != null ? Number(item.wholeFoodRatio) : undefined,
      veggieFruitServings:
        item.veggieFruitServings != null
          ? Number(item.veggieFruitServings)
          : undefined,
      unsatFatRatio:
        item.unsatFatRatio != null ? Number(item.unsatFatRatio) : undefined,
      alcoholCalories:
        item.alcoholCalories != null ? Number(item.alcoholCalories) : undefined,

      source,
    };
    openConfirm(draft);
  }

  /* ───────────── Data fetching ───────────── */
  useEffect(() => {
    if (!user?.uid) return;
    setRecentsLoading(true);
    fetchMyRecentFoods(user.uid, 50)
      .then(setMyRecents)
      .finally(() => setRecentsLoading(false));
  }, [user?.uid]);

  useEffect(() => {
    setRecentVisible(15);
  }, [user?.uid, myRecents.length]);

  useEffect(() => {
    if (!user?.uid) return;
    setTopFoodsLoading(true);
    fetchMyTopFoods(user.uid, 8)
      .then(setTopFoods)
      .finally(() => setTopFoodsLoading(false));
  }, [user?.uid]);

  useEffect(() => {
    if (tab !== "search") return;
    if (debounce.current) clearTimeout(debounce.current);

    debounce.current = setTimeout(async () => {
      const qq = q.trim();
      if (!qq) {
        setResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res: any = await searchCatalog(qq, 60);
        const items = Array.isArray(res)
          ? res
          : res?.items || res?.top || res?.results || res?.data || [];
        setResults(filterCatalogResults(items || [], qq));
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 260);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, tab]);

  function normalizeQueryText(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9/\\ -]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseDateFromQuery(text: string) {
    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (slash) {
      const year =
        slash[3] && slash[3].length === 2
          ? `20${slash[3]}`
          : slash[3] || String(new Date().getFullYear());
      const d = new Date(
        `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(
          2,
          "0",
        )}T00:00:00`,
      );
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function sameDay(a: number, b: number) {
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  function filterCatalogResults(items: any[], rawQuery: string) {
    const normalized = normalizeQueryText(rawQuery);
    const date = parseDateFromQuery(normalized);
    const terms = normalized
      .split(" ")
      .filter((t) => !!t && !t.includes("/") && !t.includes("-"));

    return items.filter((it) => {
      const name = String(it?.name || it?.title || "").toLowerCase();
      const unit = String(it?.unit || "serving").toLowerCase();
      const hay = `${name} ${unit}`;
      const matchesTerms = terms.every((t) => hay.includes(t));
      if (!matchesTerms) return false;
      if (!date) return true;
      const stamp = Number(it?.createdAt || it?.updatedAt || 0);
      if (!stamp) return false;
      return sameDay(stamp, date.getTime());
    });
  }

  const quickTiles = useMemo(
    () =>
      Array.from(
        new Map(
          topFoods.map((item: any) => {
            const normalizedName = titleCaseFoodName(String(item.name || "Food"));
            return [
              normalizedName.toLowerCase(),
              {
                name: normalizedName,
                unit: item.unit || "serving",
                qty: Number(item.qty || 1),
                calories: Number(item.calories || 0),
                protein: Number(item.protein || 0),
                carbs: Number(item.carbs || 0),
                fat: Number(item.fat || 0),
                sugar: item.sugar,
                fiber: item.fiber,
                addedSugar: item.addedSugar,
                satFat: item.satFat,
                sodium: item.sodium,
                wholeFoodRatio: item.wholeFoodRatio,
                veggieFruitServings: item.veggieFruitServings,
                unsatFatRatio: item.unsatFatRatio,
                alcoholCalories: item.alcoholCalories,
              },
            ];
          }),
        ).values(),
      ),
    [topFoods],
  );

  /* ───────────── Describe ───────────── */
  async function calculateFromDescription() {
    const text = descText.trim();
    if (!text) return;

    setDescLoading(true);
    setDescError(null);

    try {
      const parsed = await callOpenAIJson<any>(
        [
          {
            role: "system",
            content:
              "You estimate nutrition from a short meal description. Respond with JSON only. Output an object with name, unit, qty, calories, protein, carbs, fat, optional sugar and fiber.",
          },
          {
            role: "user",
            content: `Estimate nutrition for this ${meal} entry on ${date}: ${text}`,
          },
        ],
        {
          model: "gpt-4o-mini",
          maxTokens: 500,
          temperature: 0.4,
          retryTemperature: 0.25,
        },
      );

      const item = normalizeDescribeItem(parsed, text);
      if (parsed?.fallback) {
        setDescError(
          parsed?.fallbackReason
            ? `AI estimate failed: ${String(parsed.fallbackReason).slice(0, 160)}`
            : "AI estimate is falling back to a generic rule estimate.",
        );
        return;
      }
      const hasAnyMacros =
        (item.calories || 0) +
        (item.protein || 0) +
        (item.carbs || 0) +
        (item.fat || 0) >
        0;

      if (!hasAnyMacros) {
        setDescError(
          "Couldn’t estimate macros. Try adding quantities (e.g. “2 eggs”, “1 cup rice”).",
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => { },
      );
      pick({ ...item }, "describe");
    } catch (e: any) {
      setDescError(e?.message || "Describe failed. Try again.");
    } finally {
      setDescLoading(false);
    }
  }

  /* ───────────── Barcode ───────────── */
  async function startEditFromBarcodeResolved(r: ResolvedProduct) {
    const draft: DraftItem = {
      name: String(r.name || "Food").trim(),
      unit: String(r.unit || "serving"),
      qty: 1,
      calories: Number(r.nutrients.calories || 0),
      protein: Number(r.nutrients.protein || 0),
      carbs: Number(r.nutrients.carbs || 0),
      fat: Number(r.nutrients.fat || 0),
      sugar: r.nutrients.sugar != null ? Number(r.nutrients.sugar) : undefined,
      fiber: r.nutrients.fiber != null ? Number(r.nutrients.fiber) : undefined,
      source: "barcode",
    };
    openConfirm(draft);
  }

  async function resolveAndMaybePick(barcode: string) {
    setCandidatePending(true);
    setScanError(null);
    try {
      const list = await resolveBarcodeCandidates(barcode, localStore);
      if (!list.length) {
        setScanError("No nutrition match found for this barcode.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => { },
        );
        return;
      }
      if (list.length === 1) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => { });
        await startEditFromBarcodeResolved(list[0]);
        return;
      }
      // multiple candidates → picker
      setCandidates(list);
      setPickOpen(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    } catch {
      setScanError("Barcode lookup failed. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => { },
      );
    } finally {
      setCandidatePending(false);
    }
  }

  async function onBarcodeScanned(res: BarcodeScanningResult) {
    if (confirmOpen || pickOpen) return;
    if (scanBusy) return;
    const code = res?.data?.trim();
    if (!code) return;
    if (code === lastCode) return;

    setScanBusy(true);
    setLastCode(code);
    setScannedBarcode(code);

    try {
      await resolveAndMaybePick(code);
    } finally {
      // small cooldown
      setTimeout(() => setScanBusy(false), 800);
    }
  }

  /* ───────────── Manual entry handler ───────────── */
  function commitManual() {
    if (!name.trim()) return;
    pick(
      {
        name: name.trim(),
        unit: unit || "serving",
        qty: toNum(qty) || 1,
        calories: toNum(calories),
        protein: toNum(protein),
        carbs: toNum(carbs),
        fat: toNum(fat),
      },
      "manual",
    );
  }

  /* ───────────── Hero cards ───────────── */
  const anyQuickMacro =
    toNum(qaCalories) + toNum(qaProtein) + toNum(qaCarbs) + toNum(qaFat) > 0;

  function openQuickAddConfirm() {
    if (!anyQuickMacro) return;
    pick(
      {
        name: (qaName.trim() || "Quick add").trim(),
        unit: "serving",
        qty: 1,
        calories: toNum(qaCalories),
        protein: toNum(qaProtein),
        carbs: toNum(qaCarbs),
        fat: toNum(qaFat),
      },
      "manual",
    );
  }

  return (<>
    <TaskPage title="Build your food record." section={`Nutrition / ${formatSheetDate(date)}`} onBack={() => router.back()}
      action={<IconButton label="Scan a meal photo" icon="camera-outline" onPress={openPhotoScan} />}>

      <View style={F.wrap}>
        {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealKey[]).map(value => <Choice key={value} label={value[0].toUpperCase() + value.slice(1)} selected={meal === value} onPress={() => setMeal(value)} />)}
      </View>

      <View style={{ gap: 12 }}>
        <Heading title="How would you like to log?" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {([
            ['search', 'Search'], ['recents', 'Recent'], ['favorites', 'Frequent'], ['describe', 'Describe'], ['barcode', 'Barcode'], ['manual', 'Manual']
          ] as [TabKey, string][]).map(([value, label]) => <Choice key={value} label={label} selected={tab === value} onPress={() => setTab(value)} />)}
        </ScrollView>
      </View>

      {tab === 'recents' && <>
        <Heading title="Your frequent foods" detail="Quick picks from your own food record" />
        {topFoodsLoading ? <Empty title="Loading frequent foods…" /> : !quickTiles.length ? <Text style={F.body}>Foods you log regularly will appear here.</Text> :
          <View style={F.wrap}>
            {quickTiles.slice(0, 6).map((food, i) => <Pressable key={i} accessibilityRole="button" onPress={() => pick(food, 'recent')}
              style={{ flex: 1, minWidth: 140, padding: 18, borderRadius: 20, backgroundColor: '#1D3B31', gap: 8 }}>
              <Text style={F.heading}>{food.name}</Text>
              <Text style={{ ...F.body, color: D.lime }}>{Math.round(food.calories)} kcal</Text>
              <Text style={F.caption}>Review portion →</Text>
            </Pressable>)}
          </View>}
        <Heading title="Recently logged" />{recentsLoading ? <Empty title="Loading recent foods…" /> : !myRecents.length ? <Empty title="Your first food record starts here" detail="Search, describe, scan or enter a food to get started." /> :
          <View>
            {myRecents.slice(0, recentVisible).map((food, i) => <Item key={i} title={food.name} detail={`${food.qty} ${food.unit}`} value={`${Math.round(Number(food.calories || 0))} kcal`} onPress={() => pick(food, 'recent')} />)}
          </View>}
        {myRecents.length > recentVisible && <Button label="Show more recent foods" onPress={() => setRecentVisible(v => Math.min(v + 15, 50, myRecents.length))} />}
      </>}

      {tab === 'search' && <><FormField label="Search foods" value={q} onChangeText={setQ} placeholder="Food, brand or a recent date" autoFocus />
        {searchLoading ? <Empty title="Searching foods…" /> : !q.trim() ? <Empty title="Find a food" detail="Search by name, such as chicken, rice or a brand." /> : !results.length ? <Empty title="No matching foods" detail="Try a simpler search term." /> :
          <View>
            {results.slice(0, 20).map((food: any, i: number) => <Item key={`${food.id || food.name}-${i}`} title={titleCaseFoodName(String(food.name || 'Food'))}
              detail={`${food.brand ? `${food.brand} · ` : ''}${food.unit || 'serving'}`} value={`${Math.round(Number(food.calories || 0))} kcal`} onPress={() => pick(food, 'catalog')} />)}
          </View>}</>}

      {tab === 'favorites' && <><Heading title="Your frequent choices" />{!quickTiles.length ? <Empty title="No frequent foods yet" detail="Your commonly logged foods appear here." /> :
        <View>
          {quickTiles.map((food, i) => <Item key={i} title={food.name} detail={`${food.qty} ${food.unit}`} value={`${Math.round(food.calories)} kcal`} onPress={() => pick(food, 'popular')} />)}
        </View>}</>}

      {tab === 'describe' && <><Panel accent>
        <Heading title="Tell us what you ate" detail="Include amounts when you can. Review the estimate before adding it." />

        <FormField label="Meal description" value={descText} onChangeText={setDescText} multiline style={{ minHeight: 145, textAlignVertical: 'top' }} placeholder="Describe the food and portions" />

        <Button label={descLoading ? 'Calculating…' : 'Calculate nutrition'} primary disabled={descLoading || !descText.trim()} onPress={calculateFromDescription} />
      </Panel>
        {!!descError && <Text accessibilityRole="alert" style={{ ...F.body, color: D.amber }}>{descError}</Text>}</>}

      {tab === 'barcode' && <>
        <Heading title="Scan the package" detail="Review the matching product and portion before saving." />
        {!permission?.granted ? <Panel>
          <Text style={F.body}>Camera access is needed to scan a barcode.</Text>
          <Button label="Enable camera" onPress={() => requestPermission().catch(() => { })} />
        </Panel> :
          <View style={{ height: 260, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: D.teal }}>
            <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }} onBarcodeScanned={onBarcodeScanned} />
          </View>}
        {scanBusy && <Text accessibilityLiveRegion="polite" style={F.body}>Looking up this barcode…</Text>}
        {!!scanError && <Text accessibilityRole="alert" style={{ ...F.body, color: D.amber }}>{scanError}</Text>}
        <FormField label="Or type the barcode" value={manualBarcode} onChangeText={text => setManualBarcode(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="UPC / EAN" />
        <Button label={candidatePending ? 'Looking up…' : 'Find product'} primary disabled={candidatePending || manualBarcode.trim().length < 6} onPress={() => { const code = manualBarcode.trim(); if (!code) return; Keyboard.dismiss(); setScannedBarcode(code); void resolveAndMaybePick(code); }} />
      </>}

      {tab === 'manual' && <><Heading title="Enter the label values" detail="These values apply to the quantity you enter." />
        <FormField label="Food name" value={name} onChangeText={setName} /><View style={F.wrap}>

          <FormField label="Quantity" value={qty} onChangeText={t => setQty(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />

          <FormField label="Unit" value={unit} onChangeText={setUnit} />
        </View>
        <Panel>
          {[{ label: 'Calories', value: calories, set: setCalories }, { label: 'Protein (g)', value: protein, set: setProtein },
          { label: 'Carbs (g)', value: carbs, set: setCarbs }, { label: 'Fat (g)', value: fat, set: setFat }].map(field => <FormField key={field.label} label={field.label} value={field.value}
            onChangeText={t => field.set(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />)}
        </Panel>
        <Button label="Review & confirm" primary disabled={!name.trim()} onPress={commitManual} /></>}

      <Button label="Scan a meal photo" icon="camera-outline" onPress={openPhotoScan} />
    </TaskPage>
    <TaskSheet title="Review food" visible={confirmOpen} onClose={closeConfirm}>

      <ConfirmSheetContent colors={colors} isDark={!!isDark} edits={confirmEdits} setEdits={setConfirmEdits} onCancel={closeConfirm} onConfirm={confirmAndAdd} />
    </TaskSheet>
    <TaskSheet title="Choose a product match" visible={pickOpen} onClose={() => setPickOpen(false)}>

      <Text style={F.body}>Choose the matching product. You can edit the portion and nutrition next.</Text>

      {candidates.map((candidate, i) => <Item key={i} title={candidate.name} detail={`${candidate.brand ? `${candidate.brand} · ` : ''}${candidate.unit}`}
        value={`${Math.round(Number(candidate.nutrients.calories || 0))} kcal`} onPress={async () => { setPickOpen(false); if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); await startEditFromBarcodeResolved(candidate); }} />)}
    </TaskSheet>
  </>
  );
}
