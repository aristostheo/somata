import Constants from "expo-constants";
import { dayKey } from "@/utils/date";
// app/(modals)/add-meal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Alert,
  findNodeHandle,
} from "react-native";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MotiView } from "moti";
import { getAuth } from "firebase/auth";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";

import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";
import { searchCatalog } from "@/services/foodCatalog"; // your existing export

// ✅ Scan dependencies
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeType,
} from "expo-camera";
// ✅ Meal health indicator
import MealHealthScoreIndicator from "@/components/nutrition/uiNew/MealHealthScoreIndicator";

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

  // ✅ Advanced macros (optional)
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

  // ✅ Advanced macros (optional)
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
    16
  )}, ${alpha})`;
}

const softShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.16,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function TopBar({
  title,
  subtitle,
  onClose,
  colors,
  isDark,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  const inner = (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: 3 }}>
          <Text
            style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}
          >
            {subtitle}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: withAlpha(colors.card, 0.55),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === "ios") {
    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          overflow: "hidden",
        }}
      >
        <BlurView
          intensity={22}
          tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
        >
          <LinearGradient
            colors={[
              withAlpha(colors.primary, 0.22),
              withAlpha(colors.card, 0.2),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", inset: 0 }}
          />
          {inner}
        </BlurView>
      </View>
    );
  }

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      {inner}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? withAlpha(colors.primary, 0.35) : colors.border,
        backgroundColor: active
          ? withAlpha(colors.primary, 0.14)
          : withAlpha(colors.card, 0.35),
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontWeight: active ? "900" : "800",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  colors,
  placeholder,
  flex,
  multiline,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  keyboardType?: any;
  colors: any;
  placeholder?: string;
  flex?: number;
  multiline?: boolean;
  minHeight?: number;
}) {
  return (
    <View style={{ flex: flex ?? 1, gap: 6 }}>
      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        style={{
          height: multiline ? undefined : 46,
          minHeight: multiline ? minHeight ?? 100 : undefined,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBg,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 12 : 0,
          fontWeight: "900",
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function clamp0(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

/* ───────────── Barcode resolvers + cache (ported from old file) ───────────── */
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
    calories?: { value: number };
    protein?: { value: number };
    carbohydrates?: { value: number };
    fat?: { value: number };
    fiber?: { value: number };
    sugars?: { value: number };
  };
};

const FDC_API_KEY = Constants.expoConfig?.extra?.fdcApiKey as string;

async function searchFDC(queryStr: string): Promise<FdcItem[]> {
  if (!FDC_API_KEY || !queryStr.trim()) return [];
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      FDC_API_KEY
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
  barcode: string
): Promise<ResolvedProduct | null> {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode
      )}.json`
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
  barcode: string
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

async function getCache(): Promise<Record<string, ResolvedProduct>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function setCache(map: Record<string, ResolvedProduct>) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {}
}
async function cacheSave(barcode: string, item: ResolvedProduct) {
  const map = await getCache();
  map[barcode] = item;
  await setCache(map);
}
async function cacheLoad(barcode: string): Promise<ResolvedProduct | null> {
  const map = await getCache();
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
  barcode: string
): Promise<ResolvedProduct[]> {
  const cached = await cacheLoad(barcode);
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

/* ───────────── Small UI helpers (scan tab) ───────────── */
function Pill({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  colors: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.9),
        backgroundColor: withAlpha(colors.card, 0.32),
      }}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
        {text}
      </Text>
    </View>
  );
}
function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonFromText(text: string): any | null {
  // Try to locate a JSON object/array inside a string
  const s = text.trim();

  // direct parse
  const direct = safeJsonParse(s);
  if (direct) return direct;

  // try object substring
  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    const sub = s.slice(objStart, objEnd + 1);
    const parsed = safeJsonParse(sub);
    if (parsed) return parsed;
  }

  // try array substring
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

  // If it’s an array, take first item
  if (Array.isArray(anyGot)) return anyGot[0] ?? null;

  // Common wrappers
  if (anyGot.data) return unwrapDescribePayload(anyGot.data);
  if (anyGot.result) return unwrapDescribePayload(anyGot.result);
  if (anyGot.item) return unwrapDescribePayload(anyGot.item);
  if (anyGot.meal) return unwrapDescribePayload(anyGot.meal);

  // OpenAI-style
  const content = anyGot?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const parsed = extractJsonFromText(content);
    return parsed ?? { name: content };
  }

  // If backend returns a JSON string (ugh)
  if (typeof anyGot === "string") {
    const parsed = extractJsonFromText(anyGot);
    return parsed ?? { name: anyGot };
  }

  return anyGot;
}

function normalizeDescribeItem(gotRaw: any, fallbackName: string) {
  const got = unwrapDescribePayload(gotRaw) || {};

  // support alternate field names
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

  // ✅ optional advanced fields (if describe ever returns them)
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

  const sodium =
    got.sodium != null
      ? Number(got.sodium)
      : got.sodium != null
      ? Number(got.sodium)
      : undefined;

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

export default function AddMealModal() {
  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const [meal, setMeal] = useState<MealKey>(
    (params.meal as MealKey) || "breakfast"
  );
  const date = (params.date as string) || dayKey(new Date());

  const [tab, setTab] = useState<
    "recents" | "search" | "scan" | "describe" | "manual"
  >("recents");

  // My recents (Firestore)
  const [myRecents, setMyRecents] = useState<RecentFood[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [recentVisible, setRecentVisible] = useState(15);
  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [topFoodsLoading, setTopFoodsLoading] = useState(false);

  // search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounce = useRef<any>(null);

  // manual
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // describe
  const [descText, setDescText] = useState("");
  const [descLoading, setDescLoading] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  // ✅ Confirm sheet state
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

    // ✅ Advanced macros edits (strings for inputs)
    addedSugar: "",
    satFat: "",
    sodium: "",
    wholeFoodRatio: "",
    veggieFruitServings: "",
    unsatFatRatio: "",
    alcoholCalories: "",

    // base values for qty scaling
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

  // ✅ Scan tab state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanBusy, setScanBusy] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  // Candidate picker for multiple matches (scan)
  const [pickOpen, setPickOpen] = useState(false);
  const [candidates, setCandidates] = useState<ResolvedProduct[]>([]);
  const [candidatePending, setCandidatePending] = useState(false);

  // Ask for permission when entering scan tab
  useEffect(() => {
    if (tab !== "scan") return;
    if (!permission?.granted) {
      requestPermission().catch(() => {});
    }
  }, [tab, permission?.granted, requestPermission]);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;

      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PENDING_BATCH_KEY);
          if (!alive || !raw) return;

          const parsed = JSON.parse(raw);
          const same =
            parsed?.date === date &&
            parsed?.meal === meal &&
            Array.isArray(parsed?.items) &&
            parsed.items.length > 0;

          // if (same) router.back();
        } catch {}
      })();

      return () => {
        alive = false;
      };
    }, [router, date, meal])
  );

  function done(payload: AddPayload) {
    AsyncStorage.setItem("@pending_add_meal", JSON.stringify(payload))
      .catch(() => {})
      .finally(() => router.back());
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

      // ✅ Advanced
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
    requestAnimationFrame(() => setConfirmOpen(true));
  }
  function openPhotoScan() {
    // Pass context so Scan page can default category + date/meal
    router.push({
      pathname: "/(modals)/scan-meal",
      params: { meal, date },
    });
  }

  function closeConfirm() {
    Keyboard.dismiss();
    setConfirmOpen(false);
    setConfirmDraft(null);
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

      // ✅ Advanced macros (optional)
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

    // ✅ optional: if this confirm came from barcode scan, remember any edits
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
      }).catch(() => {});
    }

    closeConfirm();
    // ✅ tell the app to reconcile badges after the meal is actually saved
    AsyncStorage.setItem("@badges_dirty", "1").catch(() => {});

    done(payload);
  }

  // ✅ Now EVERY source goes through confirm (so every press can edit macros)
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

      // ✅ Advanced (if present from any source)
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

  // ✅ Scan handlers (wired to confirm flow)
  async function startEditFromBarcodeResolved(r: ResolvedProduct) {
    const draft: DraftItem = {
      name: String(r.name || "Food").trim(),
      unit: String(r.unit || "serving"), // "serving" or "100 g" / "100 ml"
      qty: 1, // ✅ always 1 “unit”
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

  async function onBarcodeScanned(res: BarcodeScanningResult) {
    if (confirmOpen || pickOpen) return;

    if (scanBusy) return;
    const code = res?.data?.trim();
    if (!code) return;
    if (code === lastCode) return;

    setScanBusy(true);
    setLastCode(code);
    setScannedBarcode(code);
    setScanError(null);

    try {
      const list = await resolveBarcodeCandidates(code);
      if (!list.length) {
        setScanError("No nutrition match found for this barcode.");
        return;
      }
      if (list.length === 1) {
        await startEditFromBarcodeResolved(list[0]);
      } else {
        setCandidates(list);
        setPickOpen(true);
      }
    } catch {
      setScanError("Scan lookup failed. Please try again.");
    } finally {
      setScanBusy(false);
    }
  }

  async function onManualBarcodeLookup() {
    const code = manualBarcode.trim();
    if (!code) {
      setScanError("Enter the digits under the barcode first.");
      return;
    }
    if (scanBusy) return;

    setScanBusy(true);
    setScanError(null);
    setScannedBarcode(code);
    setLastCode(null);

    try {
      const list = await resolveBarcodeCandidates(code);
      if (!list.length) {
        setScanError(
          "We couldn’t find this barcode. Double-check the digits, or add it manually."
        );
        return;
      }
      if (list.length === 1) {
        await startEditFromBarcodeResolved(list[0]);
        setManualBarcode("");
      } else {
        setCandidates(list);
        setPickOpen(true);
      }
    } catch {
      setScanError(
        "Barcode lookup failed. Check your connection and try again."
      );
    } finally {
      setScanBusy(false);
    }
  }

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
          "0"
        )}T00:00:00`
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
      topFoods.map((item) => ({
        name: item.name,
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
      })),
    [topFoods]
  );

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
      "manual"
    );
  }

  const AI_URL = "https://api.openai.com/v1/chat/completions";

  async function calculateFromDescription() {
    const text = descText.trim();
    if (!text) return;

    setDescLoading(true);
    setDescError(null);

    try {
      const token = await getAuth().currentUser?.getIdToken(true);

      // Try your current mode first
      const payload = {
        mode: "meal:v2",
        query: text,
        rawText: text,
        context: { meal, date },
      };

      const res = await fetch(AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setDescError("Please sign in to use Describe.");
        return;
      }

      const raw = await res.text(); // ✅ never throws
      if (!res.ok) {
        // Show status + a tiny snippet to help debug quickly
        const snippet = raw?.trim()?.slice(0, 160);
        setDescError(
          `Describe failed (${res.status}). ${
            snippet ? `Server says: ${snippet}` : "No response body."
          }`
        );
        return;
      }

      // Try parse raw JSON; if not JSON, attempt extraction
      const parsed = safeJsonParse(raw) ?? extractJsonFromText(raw);
      if (!parsed) {
        const snippet = raw?.trim()?.slice(0, 160);
        setDescError(
          `Describe returned non-JSON. ${
            snippet ? `Response: ${snippet}` : "Empty response."
          }`
        );
        return;
      }

      const item = normalizeDescribeItem(parsed, text);

      // If the model gave basically nothing, call it out
      const hasAnyMacros =
        (item.calories || 0) +
          (item.protein || 0) +
          (item.carbs || 0) +
          (item.fat || 0) >
        0;

      if (!hasAnyMacros) {
        setDescError(
          "Describe returned an unexpected format (no macros found)."
        );
        return;
      }

      requestAnimationFrame(() => pick(item, "describe"));
    } catch (e: any) {
      setDescError(
        e?.message || "Describe service unavailable. Please try again."
      );
    } finally {
      setDescLoading(false);
    }
  }

  const scanTypes = useMemo(
    () =>
      [
        "ean13",
        "ean8",
        "upc_a",
        "upc_e",
        "code128",
        "code39",
        "qr",
      ] as BarcodeType[],
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        title="Add food"
        subtitle={`${meal.toUpperCase()} • ${date}`}
        onClose={() => router.back()}
        colors={colors}
        isDark={isDark}
      />

      {/* Meal picker */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
        <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}>
          Logging for
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 8,
          }}
        >
          {(
            [
              ["breakfast", "🍳"],
              ["lunch", "🥗"],
              ["dinner", "🍽️"],
              ["snacks", "🍌"],
            ] as [MealKey, string][]
          ).map(([key, emoji]) => {
            const active = meal === key;
            return (
              <Pressable
                key={key}
                onPress={() => setMeal(key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active
                    ? withAlpha(colors.primary, 0.65)
                    : colors.border,
                  backgroundColor: active
                    ? withAlpha(colors.primary, 0.16)
                    : withAlpha(colors.card, 0.7),
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    textTransform: "capitalize",
                  }}
                >
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ✅ Confirm sheet */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeConfirm}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Backdrop */}
          <Pressable
            onPress={closeConfirm}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.35)", zIndex: 0, elevation: 0 },
            ]}
          />

          {/* Sheet */}
          <View
            style={{
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: withAlpha(colors.border, 0.95),
              backgroundColor: withAlpha(colors.card, 0.98),
              height: "78%",
              maxHeight: "90%",
              zIndex: 2,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
              style={{ flex: 1 }}
            >
              {Platform.OS === "ios" ? (
                <BlurView
                  intensity={28}
                  tint={
                    isDark
                      ? "systemThinMaterialDark"
                      : "systemThinMaterialLight"
                  }
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(colors.primary, 0.18),
                      withAlpha(colors.card, 0.24),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: "absolute", inset: 0 }}
                  />

                  <ConfirmSheetContent
                    colors={colors}
                    isDark={isDark}
                    edits={confirmEdits}
                    setEdits={setConfirmEdits}
                    onCancel={closeConfirm}
                    onConfirm={confirmAndAdd}
                  />
                </BlurView>
              ) : (
                <ConfirmSheetContent
                  colors={colors}
                  isDark={isDark}
                  edits={confirmEdits}
                  setEdits={setConfirmEdits}
                  onCancel={closeConfirm}
                  onConfirm={confirmAndAdd}
                />
              )}
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* ✅ Candidate picker for scan matches */}
      <Modal
        visible={pickOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setPickOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            onPress={() => setPickOpen(false)}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.35)" },
            ]}
          />

          <View
            style={{
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: withAlpha(colors.border, 0.95),
              backgroundColor: withAlpha(colors.card, 0.98),
              maxHeight: "70%",
              zIndex: 2,
              elevation: 20,
            }}
          >
            {Platform.OS === "ios" ? (
              <BlurView
                intensity={28}
                tint={
                  isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"
                }
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.14),
                    withAlpha(colors.card, 0.22),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: "absolute", inset: 0 }}
                />
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 16,
                        }}
                      >
                        Select a match
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Pick the closest label. You’ll confirm next.
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setPickOpen(false)}
                      hitSlop={10}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.35),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.text} />
                    </Pressable>
                  </View>

                  <View style={{ gap: 8 }}>
                    {candidates.map((c, i) => (
                      <Pressable
                        key={`${c.name}-${c.brand || ""}-${c.unit}-${i}`}
                        onPress={async () => {
                          setPickOpen(false);
                          await startEditFromBarcodeResolved(c);
                        }}
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: withAlpha(colors.card, 0.35),
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                            numberOfLines={1}
                          >
                            {c.name}
                            {c.brand ? ` • ${c.brand}` : ""}
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "800",
                              fontSize: 12,
                              marginTop: 2,
                            }}
                            numberOfLines={1}
                          >
                            {c.source} • per {c.per} {c.unit}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.text}
                        />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </BlurView>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Select a match
                </Text>
                <View style={{ height: 10 }} />
                <View style={{ gap: 8 }}>
                  {candidates.map((c, i) => (
                    <Pressable
                      key={`${c.name}-${c.brand || ""}-${c.unit}-${i}`}
                      onPress={async () => {
                        setPickOpen(false);
                        await startEditFromBarcodeResolved(c);
                      }}
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.35),
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {c.name}
                        {c.brand ? ` • ${c.brand}` : ""}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        {c.source} • per {c.per} {c.unit}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ⭐ Scan a Meal (photo) — PRIMARY entry */}
          <View
            style={{
              paddingHorizontal: -6,
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            <Pressable
              onPress={openPhotoScan}
              style={({ pressed }) => ({
                borderRadius: 22,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.35),
                opacity: pressed ? 0.92 : 1,
                ...softShadow,
              })}
            >
              <LinearGradient
                colors={[
                  withAlpha(colors.primary, isDark ? 0.22 : 0.18),
                  withAlpha(colors.card, 0.12),
                  withAlpha(colors.card, 0.06),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 14 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.3),
                      backgroundColor: withAlpha(colors.primary, 0.14),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={20}
                      color={colors.text}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                    >
                      Scan a meal
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontWeight: "800",
                        marginTop: 2,
                      }}
                    >
                      Photo → detect foods → confirm → log
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        marginTop: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Pill
                        icon="sparkles-outline"
                        text="AI detection"
                        colors={colors}
                      />
                      <Pill
                        icon="calculator-outline"
                        text="Macros"
                        colors={colors}
                      />
                      <Pill
                        icon="checkmark-circle-outline"
                        text="Editable"
                        colors={colors}
                      />
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.text}
                  />
                </View>

                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.border, 0.9),
                    backgroundColor: withAlpha(colors.card, 0.28),
                    padding: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    Tip: best results with good lighting and the full plate in
                    frame.
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <Chip
              label="Recents"
              active={tab === "recents"}
              onPress={() => setTab("recents")}
              colors={colors}
            />
            <Chip
              label="Search"
              active={tab === "search"}
              onPress={() => setTab("search")}
              colors={colors}
            />
            <Chip
              label="Barcode"
              active={tab === "scan"}
              onPress={() => setTab("scan")}
              colors={colors}
            />
            <Chip
              label="Describe"
              active={tab === "describe"}
              onPress={() => setTab("describe")}
              colors={colors}
            />
            <Chip
              label="Manual"
              active={tab === "manual"}
              onPress={() => setTab("manual")}
              colors={colors}
            />
          </View>

          {/* SCAN (NEW, matches vibe) */}
          {tab === "scan" && (
            <View style={{ gap: 14 }}>
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 320 }}
              >
                <View
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...softShadow,
                  }}
                >
                  <LinearGradient
                    colors={[
                      withAlpha("#22c55e", isDark ? 0.12 : 0.16),
                      withAlpha(colors.primary, 0.12),
                      withAlpha(colors.card, 0.12),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 14 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.primary, 0.25),
                            backgroundColor: withAlpha(colors.primary, 0.12),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="barcode-outline"
                            size={18}
                            color={colors.text}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "900",
                              fontSize: 16,
                            }}
                          >
                            Scan barcode
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "800",
                              marginTop: 2,
                            }}
                          >
                            We’ll find a match — then you confirm macros.
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pill
                          icon="shield-checkmark-outline"
                          text="Private"
                          colors={colors}
                        />
                      </View>
                    </View>

                    {/* Permission / Camera */}
                    {!permission ? (
                      <View
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: withAlpha(colors.card, 0.35),
                          padding: 14,
                        }}
                      >
                        <Text
                          style={{ color: colors.muted, fontWeight: "800" }}
                        >
                          Checking camera permission…
                        </Text>
                      </View>
                    ) : !permission.granted ? (
                      <View style={{ gap: 10 }}>
                        <View
                          style={{
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.card, 0.35),
                            padding: 14,
                          }}
                        >
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                          >
                            Camera access needed
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "800",
                              marginTop: 4,
                            }}
                          >
                            Enable camera to scan barcodes. You can also type
                            the digits below.
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => requestPermission().catch(() => {})}
                          style={{
                            height: 52,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.primary, 0.35),
                            backgroundColor: withAlpha(colors.primary, 0.16),
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 10,
                          }}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={18}
                            color={colors.text}
                          />
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                          >
                            Grant camera access
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        style={{
                          borderRadius: 18,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: withAlpha(colors.border, 0.95),
                          backgroundColor: withAlpha(colors.card, 0.35),
                        }}
                      >
                        <View style={{ aspectRatio: 3 / 4 }}>
                          <CameraView
                            style={{ width: "100%", height: "100%" }}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: scanTypes }}
                            onBarcodeScanned={onBarcodeScanned}
                          />

                          {/* Premium overlay */}
                          <View
                            pointerEvents="none"
                            style={{ position: "absolute", inset: 0 }}
                          >
                            {/* top hint bar */}
                            <View
                              style={{
                                position: "absolute",
                                left: 10,
                                right: 10,
                                top: 10,
                                borderRadius: 999,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "#ffffff33",
                              }}
                            >
                              <LinearGradient
                                colors={["#00000066", "#00000033"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                }}
                              >
                                <Ionicons
                                  name="scan-outline"
                                  size={16}
                                  color={"white"}
                                />
                                <Text
                                  style={{
                                    color: "white",
                                    fontWeight: "900",
                                    fontSize: 12,
                                  }}
                                >
                                  Hold steady • Avoid glare • Fill the frame
                                </Text>
                              </LinearGradient>
                            </View>

                            {/* scanning frame */}
                            <View
                              style={{
                                position: "absolute",
                                left: "10%",
                                right: "10%",
                                top: "30%",
                                bottom: "30%",
                                borderRadius: 16,
                                borderWidth: 2,
                                borderColor: "#ffffff88",
                                backgroundColor: "transparent",
                              }}
                            />

                            {/* corner accents */}
                            <View
                              style={{
                                position: "absolute",
                                left: "10%",
                                top: "30%",
                                width: 22,
                                height: 22,
                                borderLeftWidth: 3,
                                borderTopWidth: 3,
                                borderColor: "#ffffffcc",
                                borderTopLeftRadius: 14,
                              }}
                            />
                            <View
                              style={{
                                position: "absolute",
                                right: "10%",
                                top: "30%",
                                width: 22,
                                height: 22,
                                borderRightWidth: 3,
                                borderTopWidth: 3,
                                borderColor: "#ffffffcc",
                                borderTopRightRadius: 14,
                              }}
                            />
                            <View
                              style={{
                                position: "absolute",
                                left: "10%",
                                bottom: "30%",
                                width: 22,
                                height: 22,
                                borderLeftWidth: 3,
                                borderBottomWidth: 3,
                                borderColor: "#ffffffcc",
                                borderBottomLeftRadius: 14,
                              }}
                            />
                            <View
                              style={{
                                position: "absolute",
                                right: "10%",
                                bottom: "30%",
                                width: 22,
                                height: 22,
                                borderRightWidth: 3,
                                borderBottomWidth: 3,
                                borderColor: "#ffffffcc",
                                borderBottomRightRadius: 14,
                              }}
                            />

                            {/* busy pill */}
                            {scanBusy && (
                              <View
                                style={{
                                  position: "absolute",
                                  left: 12,
                                  right: 12,
                                  bottom: 12,
                                  borderRadius: 999,
                                  overflow: "hidden",
                                  borderWidth: 1,
                                  borderColor: "#ffffff33",
                                }}
                              >
                                <LinearGradient
                                  colors={["#00000066", "#00000033"]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={{
                                    height: 44,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexDirection: "row",
                                    gap: 10,
                                  }}
                                >
                                  <ActivityIndicator color="#fff" />
                                  <Text
                                    style={{
                                      color: "white",
                                      fontWeight: "900",
                                      fontSize: 12,
                                    }}
                                  >
                                    Looking up nutrition…
                                  </Text>
                                </LinearGradient>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Error */}
                    {scanError ? (
                      <View
                        style={{
                          marginTop: 10,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: withAlpha("#EF4444", 0.35),
                          backgroundColor: withAlpha("#EF4444", 0.12),
                          padding: 12,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          Couldn’t find a match
                        </Text>
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "800",
                            marginTop: 4,
                            opacity: 0.9,
                          }}
                        >
                          {scanError}
                        </Text>
                      </View>
                    ) : null}

                    {/* Manual fallback digits */}
                    <View style={{ marginTop: 12, gap: 10 }}>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "900",
                          fontSize: 12,
                          letterSpacing: 0.5,
                        }}
                      >
                        FALLBACK
                      </Text>

                      <View
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: withAlpha(colors.card, 0.32),
                          padding: 12,
                        }}
                      >
                        <Text
                          style={{ color: colors.muted, fontWeight: "800" }}
                        >
                          Having trouble scanning? Type the digits under the
                          barcode.
                        </Text>

                        <View style={{ height: 10 }} />

                        <TextInput
                          value={manualBarcode}
                          onChangeText={(t) =>
                            setManualBarcode(t.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                          placeholder="e.g. 060383123456"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            height: 46,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.inputBorder,
                            backgroundColor: colors.inputBg,
                            color: colors.text,
                            paddingHorizontal: 12,
                            fontWeight: "900",
                          }}
                        />

                        <Pressable
                          onPress={onManualBarcodeLookup}
                          disabled={scanBusy || manualBarcode.trim().length < 8}
                          style={{
                            marginTop: 10,
                            height: 52,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.primary, 0.35),
                            backgroundColor: scanBusy
                              ? withAlpha(colors.card, 0.35)
                              : withAlpha(colors.primary, 0.16),
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 10,
                            opacity:
                              scanBusy || manualBarcode.trim().length < 8
                                ? 0.6
                                : 1,
                          }}
                        >
                          {scanBusy ? (
                            <ActivityIndicator />
                          ) : (
                            <Ionicons
                              name="search-outline"
                              size={18}
                              color={colors.text}
                            />
                          )}
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                          >
                            {scanBusy ? "Looking up…" : "Look up barcode"}
                          </Text>
                        </Pressable>

                        <Text
                          style={{
                            color: colors.muted,
                            fontWeight: "800",
                            fontSize: 12,
                            marginTop: 8,
                          }}
                        >
                          Data sources: Open Food Facts (primary), USDA FDC
                          (fallback).
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </MotiView>
            </View>
          )}

          {/* RECENTS */}
          {tab === "recents" && (
            <View style={{ gap: 14 }}>
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 320 }}
              >
                <View
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...softShadow,
                  }}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(colors.primary, 0.2),
                      withAlpha(colors.card, 0.14),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 14 }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                    >
                      Quick add
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontWeight: "800",
                        marginTop: 4,
                      }}
                    >
                      Tap once → confirm macros → add.
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      {topFoodsLoading ? (
                        <View style={{ paddingVertical: 10 }}>
                          <ActivityIndicator />
                        </View>
                      ) : quickTiles.length === 0 ? (
                        <View
                          style={{
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 14,
                            backgroundColor: withAlpha(colors.card, 0.35),
                          }}
                        >
                          <Text
                            style={{ color: colors.muted, fontWeight: "800" }}
                          >
                            Log a few meals to see your top quick adds here.
                          </Text>
                        </View>
                      ) : (
                        quickTiles.map((t) => (
                          <Pressable
                            key={t.name}
                            onPress={() => pick(t, "recent")}
                            style={{
                              width: "48%",
                              borderRadius: 18,
                              borderWidth: 1,
                              borderColor: withAlpha(colors.border, 0.9),
                              backgroundColor: withAlpha(colors.card, 0.35),
                              padding: 12,
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontWeight: "900" }}
                              numberOfLines={1}
                            >
                              {t.name}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                fontWeight: "800",
                                marginTop: 4,
                                fontSize: 12,
                              }}
                            >
                              {Math.round(t.calories)} kcal • P{" "}
                              {Math.round(t.protein)}g
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  </LinearGradient>
                </View>
              </MotiView>

              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "900",
                  fontSize: 12,
                  letterSpacing: 0.6,
                }}
              >
                MY RECENTS (confirm before add)
              </Text>

              {recentsLoading ? (
                <View style={{ paddingVertical: 10 }}>
                  <ActivityIndicator />
                </View>
              ) : myRecents.length === 0 ? (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    backgroundColor: withAlpha(colors.card, 0.35),
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    Your recent foods (from Firestore) show here after you log
                    some.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {myRecents.slice(0, recentVisible).map((r, i) => (
                    <Pressable
                      key={`${r.name}-${i}`}
                      onPress={() => pick(r, "recent")}
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.35),
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text
                          style={{ color: colors.text, fontWeight: "900" }}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontWeight: "800",
                            fontSize: 12,
                          }}
                        >
                          {Math.round(r.qty)} {r.unit} •{" "}
                          {Math.round(r.calories)} kcal
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-up"
                        size={18}
                        color={colors.text}
                      />
                    </Pressable>
                  ))}
                  {myRecents.length > recentVisible && (
                    <Pressable
                      onPress={() =>
                        setRecentVisible((v) =>
                          Math.min(v + 15, 50, myRecents.length)
                        )
                      }
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: withAlpha(colors.card, 0.35),
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        See more
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}

          {/* SEARCH */}
          {tab === "search" && (
            <View style={{ gap: 12 }}>
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.35),
                  padding: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.25),
                      backgroundColor: withAlpha(colors.primary, 0.12),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color={colors.text}
                    />
                  </View>

                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search community foods"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      flex: 1,
                      height: 44,
                      color: colors.text,
                      fontWeight: "900",
                    }}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />

                  {q.length > 0 ? (
                    <Pressable onPress={() => setQ("")} hitSlop={10}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.muted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {searchLoading ? (
                <View style={{ paddingVertical: 10 }}>
                  <ActivityIndicator />
                </View>
              ) : q.trim().length === 0 ? (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    backgroundColor: withAlpha(colors.card, 0.35),
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    Start typing. Example: “quest”, “chicken”, “rice”.
                  </Text>
                </View>
              ) : results.length === 0 ? (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    backgroundColor: withAlpha(colors.card, 0.35),
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    No results. Try a simpler term.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {results.slice(0, 20).map((r: any, idx: number) => (
                    <Pressable
                      key={`${r?.id || r?.name || "r"}-${idx}`}
                      onPress={() => pick(r, "catalog")}
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.35),
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text
                          style={{ color: colors.text, fontWeight: "900" }}
                          numberOfLines={1}
                        >
                          {String(r?.name || r?.title || "Food")}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontWeight: "800",
                            fontSize: 12,
                          }}
                        >
                          {Math.round(
                            Number(r?.calories ?? r?.nutrients?.calories ?? 0)
                          )}{" "}
                          kcal • P{" "}
                          {Math.round(
                            Number(r?.protein ?? r?.nutrients?.protein ?? 0)
                          )}
                          g
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-up"
                        size={18}
                        color={colors.text}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* DESCRIBE */}
          {tab === "describe" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...softShadow,
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.accent ?? colors.primary, 0.18),
                    withAlpha(colors.card, 0.12),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 14 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: withAlpha(colors.primary, 0.25),
                        backgroundColor: withAlpha(colors.primary, 0.12),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color={colors.text}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 16,
                        }}
                      >
                        Describe your meal
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          marginTop: 2,
                        }}
                      >
                        We’ll estimate macros, then you confirm.
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 12, gap: 10 }}>
                    <Field
                      label="Description"
                      value={descText}
                      onChange={setDescText}
                      colors={colors}
                      placeholder="e.g. chicken burrito bowl with rice, beans, cheese, salsa"
                      multiline
                      minHeight={110}
                    />

                    {descError ? (
                      <Text
                        style={{
                          color: withAlpha("#EF4444", 0.95),
                          fontWeight: "800",
                        }}
                      >
                        {descError}
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={calculateFromDescription}
                      disabled={descLoading || !descText.trim()}
                      style={{
                        marginTop: 2,
                        height: 52,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: withAlpha(colors.primary, 0.35),
                        backgroundColor: descLoading
                          ? withAlpha(colors.card, 0.35)
                          : withAlpha(colors.primary, 0.16),
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 10,
                        opacity: !descText.trim() ? 0.55 : 1,
                      }}
                    >
                      {descLoading ? (
                        <ActivityIndicator />
                      ) : (
                        <Ionicons
                          name="calculator-outline"
                          size={18}
                          color={colors.text}
                        />
                      )}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {descLoading ? "Estimating…" : "Estimate macros"}
                      </Text>
                    </Pressable>

                    <View
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: withAlpha(colors.border, 0.9),
                        backgroundColor: withAlpha(colors.card, 0.28),
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Tip: include quantities (e.g. “2 eggs”, “1 cup rice”).
                        You’ll edit before confirming.
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}

          {/* MANUAL */}
          {tab === "manual" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...softShadow,
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.18),
                    withAlpha(colors.card, 0.12),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 14 }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    Manual entry
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    You’ll confirm before adding.
                  </Text>

                  <View style={{ marginTop: 12, gap: 10 }}>
                    <Field
                      label="Name"
                      value={name}
                      onChange={setName}
                      colors={colors}
                      placeholder="e.g. Chicken burrito bowl"
                      flex={1}
                    />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Field
                        label="Qty"
                        value={qty}
                        onChange={(t) => setQty(t.replace(/[^0-9.]/g, ""))}
                        colors={colors}
                        keyboardType="decimal-pad"
                        placeholder="1"
                        flex={1}
                      />
                      <Field
                        label="Unit"
                        value={unit}
                        onChange={setUnit}
                        colors={colors}
                        placeholder="serving"
                        flex={1}
                      />
                    </View>

                    <Text
                      style={{
                        color: colors.muted,
                        fontWeight: "900",
                        fontSize: 12,
                        letterSpacing: 0.5,
                      }}
                    >
                      TOTAL MACROS
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Field
                        label="Calories"
                        value={calories}
                        onChange={(t) => setCalories(t.replace(/[^0-9.]/g, ""))}
                        colors={colors}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        flex={1}
                      />
                      <Field
                        label="Protein (g)"
                        value={protein}
                        onChange={(t) => setProtein(t.replace(/[^0-9.]/g, ""))}
                        colors={colors}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        flex={1}
                      />
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Field
                        label="Carbs (g)"
                        value={carbs}
                        onChange={(t) => setCarbs(t.replace(/[^0-9.]/g, ""))}
                        colors={colors}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        flex={1}
                      />
                      <Field
                        label="Fat (g)"
                        value={fat}
                        onChange={(t) => setFat(t.replace(/[^0-9.]/g, ""))}
                        colors={colors}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        flex={1}
                      />
                    </View>
                  </View>

                  <Pressable
                    onPress={commitManual}
                    style={{
                      marginTop: 14,
                      height: 52,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.35),
                      backgroundColor: withAlpha(colors.primary, 0.16),
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 10,
                    }}
                  >
                    <Ionicons name="chevron-up" size={18} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Review & confirm
                    </Text>
                  </Pressable>
                </LinearGradient>
              </View>
            </View>
          )}
        </ScrollView>

        {(tab === "recents" || tab === "search") && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 16,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                borderRadius: 999,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.35),
                backgroundColor:
                  Platform.OS === "ios"
                    ? withAlpha(colors.card, 0.45)
                    : withAlpha(colors.card, 0.9),
                ...softShadow,
              }}
            >
              <Pressable
                onPress={() => {
                  setTab("manual");
                  setName("");
                  setQty("1");
                  setUnit("serving");
                  setCalories("");
                  setProtein("");
                  setCarbs("");
                  setFat("");
                  Keyboard.dismiss();
                }}
                style={{
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <Ionicons name="create-outline" size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Manual entry
                </Text>
                <Text style={{ color: colors.muted, fontWeight: "800" }}>
                  • confirm before add
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

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
  const scrollRef = React.useRef<ScrollView>(null);
  const nameRef = React.useRef<TextInput | null>(null);
  const qtyRef = React.useRef<TextInput | null>(null);
  const unitRef = React.useRef<TextInput | null>(null);

  const caloriesRef = React.useRef<TextInput | null>(null);
  const proteinRef = React.useRef<TextInput | null>(null);
  const carbsRef = React.useRef<TextInput | null>(null);
  const fatRef = React.useRef<TextInput | null>(null);

  const sugarRef = React.useRef<TextInput | null>(null);
  const fiberRef = React.useRef<TextInput | null>(null);

  // Advanced (optional)
  const addedSugarRef = React.useRef<TextInput | null>(null);
  const satFatRef = React.useRef<TextInput | null>(null);
  const sodiumRef = React.useRef<TextInput | null>(null);
  const alcoholRef = React.useRef<TextInput | null>(null);
  const wholeFoodRef = React.useRef<TextInput | null>(null);
  const unsatRef = React.useRef<TextInput | null>(null);
  const vegRef = React.useRef<TextInput | null>(null);

  // ✅ Advanced toggle
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const scrollToInput = React.useCallback(
    (ref?: React.RefObject<TextInput | null>) => {
      const node = ref?.current ? findNodeHandle(ref.current) : null;
      if (!node) return;

      // @ts-ignore
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        node,
        140,
        true
      );
    },
    []
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
    if (baseQty <= 0 || nextQty <= 0) {
      return { ...prev, qty: nextQtyRaw };
    }
    const ratio = nextQty / baseQty;
    const scaleField = (baseKey: string) => {
      const raw = String(prev[baseKey] ?? "");
      if (!raw.trim().length) return raw;
      const val = Number(raw);
      if (!Number.isFinite(val)) return raw;
      return formatScaled(val * ratio);
    };
    return {
      ...prev,
      qty: nextQtyRaw,
      calories: scaleField("_baseCalories"),
      protein: scaleField("_baseProtein"),
      carbs: scaleField("_baseCarbs"),
      fat: scaleField("_baseFat"),
      sugar: scaleField("_baseSugar"),
      fiber: scaleField("_baseFiber"),
      addedSugar: scaleField("_baseAddedSugar"),
      satFat: scaleField("_baseSatFat"),
      sodium: scaleField("_baseSodium"),
      alcoholCalories: scaleField("_baseAlcoholCalories"),
      veggieFruitServings: scaleField("_baseVeggieFruitServings"),
    };
  }, []);

  const RowField = React.useCallback(
    ({
      label,
      value,
      keyName,
      placeholder,
      keyboardType,
      inputRef,
    }: {
      label: string;
      value: string;
      keyName: string;
      placeholder?: string;
      keyboardType?: any;
      inputRef?: React.RefObject<TextInput | null>;
    }) => (
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}>
          {label}
        </Text>
        <TextInput
          ref={inputRef ?? undefined}
          value={value}
          onFocus={() => scrollToInput(inputRef)}
          onChangeText={(t) =>
            setEdits((p: any) => ({ ...p, [keyName]: numOnly(t) }))
          }
          keyboardType={keyboardType ?? "decimal-pad"}
          placeholder={placeholder ?? "0"}
          placeholderTextColor={colors.placeholder}
          style={{
            height: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBg,
            color: colors.text,
            paddingHorizontal: 12,
            fontWeight: "900",
          }}
        />
      </View>
    ),
    [colors, setEdits, scrollToInput]
  );

  const scoreInput = useMemo(() => {
    const sugar = edits?.sugar?.trim?.().length
      ? Number(edits.sugar)
      : undefined;
    const fiber = edits?.fiber?.trim?.().length
      ? Number(edits.fiber)
      : undefined;

    const addedSugar = edits?.addedSugar?.trim?.().length
      ? Number(edits.addedSugar)
      : undefined;

    const satFatG = edits?.satFat?.trim?.().length
      ? Number(edits.satFat)
      : undefined;

    const sodium = edits?.sodium?.trim?.().length
      ? Number(edits.sodium)
      : undefined;

    const wholeFoodRatio = edits?.wholeFoodRatio?.trim?.().length
      ? Number(edits.wholeFoodRatio)
      : undefined;

    const veggieFruitServings = edits?.veggieFruitServings?.trim?.().length
      ? Number(edits.veggieFruitServings)
      : undefined;

    const unsatFatRatio = edits?.unsatFatRatio?.trim?.().length
      ? Number(edits.unsatFatRatio)
      : undefined;

    const alcoholCalories = edits?.alcoholCalories?.trim?.().length
      ? Number(edits.alcoholCalories)
      : undefined;

    return {
      calories: Number(edits?.calories || 0) || 0,
      proteinG: Number(edits?.protein || 0) || 0,
      carbsG: Number(edits?.carbs || 0) || 0,
      fatG: Number(edits?.fat || 0) || 0,
      sugarG: sugar,
      fiberG: fiber,

      // ✅ Advanced signals
      addedSugarG: addedSugar,
      satFatG,
      sodium,
      wholeFoodRatio,
      veggieFruitServings,
      unsatFatRatio,
      alcoholCalories,
    };
  }, [edits]);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: 220 }}
    >
      <View style={{ gap: 12 }}>
        {/* grabber */}
        <View style={{ alignItems: "center", marginTop: 2 }}>
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              backgroundColor: withAlpha(colors.text, isDark ? 0.18 : 0.12),
            }}
          />
        </View>

        {/* header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 2 }}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
            >
              Confirm macros
            </Text>
            <Text
              style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}
            >
              Edit anything — then confirm.
            </Text>
          </View>

          <Pressable
            onPress={onCancel}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.card, 0.35),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <MealHealthScoreIndicator
          input={scoreInput}
          variant="pill+ring"
          compact
          style={{ marginTop: 2 }}
        />

        <View style={{ gap: 10 }}>
          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text
              style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
            >
              Name
            </Text>
            <TextInput
              ref={nameRef}
              value={edits.name}
              onFocus={() => scrollToInput(nameRef)}
              onChangeText={(t) => setEdits((p: any) => ({ ...p, name: t }))}
              placeholder="Food name"
              placeholderTextColor={colors.placeholder}
              style={{
                height: 46,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                color: colors.text,
                paddingHorizontal: 12,
                fontWeight: "900",
              }}
            />
          </View>

          {/* Qty + Unit */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                Qty
              </Text>
              <TextInput
                ref={qtyRef}
                value={edits.qty}
                onFocus={() => scrollToInput(qtyRef)}
                onChangeText={(t) =>
                  setEdits((p: any) => scaleQtyMacros(p, numOnly(t)))
                }
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.placeholder}
                style={{
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  paddingHorizontal: 12,
                  fontWeight: "900",
                }}
              />
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                Unit
              </Text>
              <TextInput
                ref={unitRef}
                value={edits.unit}
                onFocus={() => scrollToInput(unitRef)}
                onChangeText={(t) => setEdits((p: any) => ({ ...p, unit: t }))}
                placeholder="serving"
                placeholderTextColor={colors.placeholder}
                style={{
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  paddingHorizontal: 12,
                  fontWeight: "900",
                }}
              />
            </View>
          </View>

          <Text
            style={{
              color: colors.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.5,
              marginTop: 2,
            }}
          >
            MACROS
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <RowField
              label="Calories"
              value={edits.calories}
              keyName="calories"
              inputRef={caloriesRef}
            />
            <RowField
              label="Protein (g)"
              value={edits.protein}
              keyName="protein"
              inputRef={proteinRef}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <RowField
              label="Carbs (g)"
              value={edits.carbs}
              keyName="carbs"
              inputRef={carbsRef}
            />
            <RowField
              label="Fat (g)"
              value={edits.fat}
              keyName="fat"
              inputRef={fatRef}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                Sugar (optional)
              </Text>
              <TextInput
                ref={sugarRef}
                value={edits.sugar}
                onFocus={() => scrollToInput(sugarRef)}
                onChangeText={(t) =>
                  setEdits((p: any) => ({ ...p, sugar: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.placeholder}
                style={{
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  paddingHorizontal: 12,
                  fontWeight: "900",
                }}
              />
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                Fiber (optional)
              </Text>
              <TextInput
                ref={fiberRef}
                value={edits.fiber}
                onFocus={() => scrollToInput(fiberRef)}
                onChangeText={(t) =>
                  setEdits((p: any) => ({ ...p, fiber: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.placeholder}
                style={{
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  paddingHorizontal: 12,
                  fontWeight: "900",
                }}
              />
            </View>
          </View>

          {/* ✅ Advanced macros toggle */}
          <Pressable
            onPress={() => setAdvancedOpen((v) => !v)}
            style={{
              marginTop: 4,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.card, 0.32),
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.25),
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={colors.text}
                />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Advanced macros
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  Optional fields → more accurate health score
                </Text>
              </View>
            </View>
            <Ionicons
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text}
            />
          </Pressable>

          {advancedOpen && (
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontWeight: "900",
                  fontSize: 12,
                  letterSpacing: 0.5,
                  marginTop: 2,
                }}
              >
                ADVANCED
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <RowField
                  label="Added sugar (g)"
                  value={edits.addedSugar}
                  keyName="addedSugar"
                  placeholder="—"
                  inputRef={addedSugarRef}
                />

                <RowField
                  label="Sat fat (g)"
                  value={edits.satFat}
                  keyName="satFat"
                  placeholder="—"
                  inputRef={satFatRef}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <RowField
                  label="Sodium (mg)"
                  value={edits.sodium}
                  keyName="sodium"
                  placeholder="—"
                  keyboardType="numeric"
                  inputRef={sodiumRef}
                />

                <RowField
                  label="Alcohol (kcal)"
                  value={edits.alcoholCalories}
                  keyName="alcoholCalories"
                  placeholder="—"
                  inputRef={alcoholRef}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <RowField
                  label="Whole food ratio (0–1)"
                  value={edits.wholeFoodRatio}
                  keyName="wholeFoodRatio"
                  placeholder="0.0–1.0"
                  inputRef={wholeFoodRef}
                />

                <RowField
                  label="Unsat fat ratio (0–1)"
                  value={edits.unsatFatRatio}
                  keyName="unsatFatRatio"
                  placeholder="0.0–1.0"
                  inputRef={unsatRef}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <RowField
                  label="Veg/Fruit servings"
                  value={edits.veggieFruitServings}
                  keyName="veggieFruitServings"
                  placeholder="—"
                  inputRef={vegRef}
                />
                <View style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>

        {/* actions */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.card, 0.35),
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              Cancel
            </Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            style={{
              flex: 1.2,
              height: 52,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.35),
              backgroundColor: withAlpha(colors.primary, 0.18),
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={colors.text}
            />
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              Confirm & add
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
