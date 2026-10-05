// app/(modals)/add-meal.tsx
// Drop-in ✅
// Premium Add Meal front page (Apple-inspired, glossy dark, calm gradients)
// Keeps your existing backend wiring: recents/search/describe/barcode -> confirm sheet -> done()
// Depends on: expo-router, expo-blur, expo-linear-gradient, expo-camera, expo-haptics, moti, @react-native-async-storage/async-storage

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
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { getAuth } from "firebase/auth";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";

import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";
import { searchCatalog } from "@/services/foodCatalog";

// Optional (you already import this in your file)
import MealHealthScoreIndicator from "@/components/nutrition/uiNew/MealHealthScoreIndicator";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
type TabKey = "recents" | "search" | "describe" | "barcode" | "manual";

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
    calories?: { value: number };
    protein?: { value: number };
    carbohydrates?: { value: number };
    fat?: { value: number };
    fiber?: { value: number };
    sugars?: { value: number };
  };
};

const FDC_API_KEY = process.env.FDC_API_KEY as string | undefined;

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
  barcode: string,
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

/* ───────────── UI atoms ───────────── */
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
              withAlpha(colors.primary, 0.2),
              withAlpha(colors.card, 0.16),
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

function SegmentedMeal({
  value,
  onChange,
  colors,
}: {
  value: MealKey;
  onChange: (m: MealKey) => void;
  colors: any;
}) {
  const items: {
    key: MealKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
    { key: "lunch", label: "Lunch", icon: "restaurant-outline" },
    { key: "dinner", label: "Dinner", icon: "moon-outline" },
    { key: "snacks", label: "Snack", icon: "sparkles-outline" },
  ];

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: withAlpha(colors.card, 0.35),
        padding: 6,
        flexDirection: "row",
        gap: 6,
      }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(it.key);
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active
                ? withAlpha(colors.primary, 0.35)
                : "transparent",
              overflow: "hidden",
              backgroundColor: active
                ? withAlpha(colors.primary, 0.14)
                : "transparent",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <Ionicons name={it.icon} size={14} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontWeight: active ? "900" : "800",
                fontSize: 12,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabPills({
  tab,
  setTab,
  colors,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  colors: any;
}) {
  const items: {
    key: TabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "recents", label: "Recents", icon: "time-outline" },
    { key: "search", label: "Search", icon: "search-outline" },
    { key: "describe", label: "Describe", icon: "sparkles-outline" },
    { key: "barcode", label: "Barcode", icon: "barcode-outline" },
    { key: "manual", label: "Manual", icon: "create-outline" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10 }}
    >
      {items.map((it) => {
        const active = it.key === tab;
        return (
          <Pressable
            key={it.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setTab(it.key);
              Keyboard.dismiss();
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active
                ? withAlpha(colors.primary, 0.35)
                : colors.border,
              backgroundColor: active
                ? withAlpha(colors.primary, 0.14)
                : withAlpha(colors.card, 0.3),
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name={it.icon} size={14} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontWeight: active ? "900" : "800",
                fontSize: 13,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  colors,
  placeholder,
  multiline,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  keyboardType?: any;
  colors: any;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
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
          minHeight: multiline ? (minHeight ?? 110) : undefined,
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

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          Review & confirm
        </Text>
        <Pressable
          onPress={onCancel}
          hitSlop={10}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: withAlpha(colors.card, 0.35),
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
            Close
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 18,
          gap: 12,
        }}
      >
        <View style={{ gap: 10 }}>
          <Field
            label="Name"
            value={edits.name}
            onChange={(t) => setEdits((p: any) => ({ ...p, name: t }))}
            colors={colors}
            placeholder="Food name"
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Qty"
                value={edits.qty}
                onChange={(t) =>
                  setEdits((p: any) => scaleQtyMacros(p, numOnly(t)))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder="1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Unit"
                value={edits.unit}
                onChange={(t) => setEdits((p: any) => ({ ...p, unit: t }))}
                colors={colors}
                placeholder="serving"
              />
            </View>
          </View>

          <Text
            style={{
              color: colors.muted,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.6,
            }}
          >
            TOTAL MACROS
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Calories"
                value={edits.calories}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, calories: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Protein (g)"
                value={edits.protein}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, protein: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder="0"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Carbs (g)"
                value={edits.carbs}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, carbs: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Fat (g)"
                value={edits.fat}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, fat: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder="0"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Sugar (g)"
                value={edits.sugar}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, sugar: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder=""
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Fiber (g)"
                value={edits.fiber}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, fiber: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder=""
              />
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setAdvancedOpen((v) => !v);
            }}
            style={{
              marginTop: 4,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.card, 0.28),
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              Advanced (optional)
            </Text>
            <Ionicons
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text}
            />
          </Pressable>

          {advancedOpen ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Added sugar (g)"
                    value={edits.addedSugar}
                    onChange={(t) =>
                      setEdits((p: any) => ({ ...p, addedSugar: numOnly(t) }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Sat fat (g)"
                    value={edits.satFat}
                    onChange={(t) =>
                      setEdits((p: any) => ({ ...p, satFat: numOnly(t) }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Sodium (mg)"
                    value={edits.sodium}
                    onChange={(t) =>
                      setEdits((p: any) => ({ ...p, sodium: numOnly(t) }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Alcohol kcal"
                    value={edits.alcoholCalories}
                    onChange={(t) =>
                      setEdits((p: any) => ({
                        ...p,
                        alcoholCalories: numOnly(t),
                      }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Whole food ratio (0..1)"
                    value={edits.wholeFoodRatio}
                    onChange={(t) =>
                      setEdits((p: any) => ({
                        ...p,
                        wholeFoodRatio: numOnly(t),
                      }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Veg/Fruit servings"
                    value={edits.veggieFruitServings}
                    onChange={(t) =>
                      setEdits((p: any) => ({
                        ...p,
                        veggieFruitServings: numOnly(t),
                      }))
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    placeholder=""
                  />
                </View>
              </View>

              <Field
                label="Unsat fat ratio (0..1)"
                value={edits.unsatFatRatio}
                onChange={(t) =>
                  setEdits((p: any) => ({ ...p, unsatFatRatio: numOnly(t) }))
                }
                keyboardType="decimal-pad"
                colors={colors}
                placeholder=""
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              onConfirm();
            }}
            style={{
              marginTop: 8,
              height: 54,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.38),
              backgroundColor: withAlpha(colors.primary, 0.16),
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              ...softShadow,
            }}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.text}
            />
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
            >
              Add to log
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────────── Main ───────────── */
export default function AddMealModal() {
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
  }>();
  const [meal, setMeal] = useState<MealKey>(
    (params.meal as MealKey) || "breakfast",
  );
  const date = (params.date as string) || new Date().toISOString().slice(0, 10);

  const initialTab = (params.initialTab as TabKey) || "recents";
  const returnTo = String(params.returnTo || "");
  const [tab, setTab] = useState<TabKey>(
    ["recents", "search", "describe", "barcode", "manual"].includes(initialTab)
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
  const [q, setQ] = useState("");
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
    if (!permission?.granted) requestPermission().catch(() => {});
  }, [tab, permission?.granted, requestPermission]);

  // Keep your "pending batch" guard (no UI change)
  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PENDING_BATCH_KEY);
          if (!alive || !raw) return;
          // Intentionally no forced nav here (matches your previous file behavior)
        } catch {}
      })();
      return () => {
        alive = false;
      };
    }, [date, meal]),
  );

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
          }
        : payload;

    AsyncStorage.setItem(targetKey, JSON.stringify(targetPayload))
      .catch(() => {})
      .finally(() => router.back());
  }

  function openPhotoScan() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: "/(modals)/scan-meal",
      params: {
        meal,
        date,
        ...(returnTo ? { returnTo } : {}),
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
      }).catch(() => {});
    }

    closeConfirm();
    AsyncStorage.setItem("@badges_dirty", "1").catch(() => {});
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
      topFoods.map((item: any) => ({
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
    [topFoods],
  );

  /* ───────────── Describe ───────────── */
  const AI_URL = "https://api.openai.com/v1/chat/completions";

  async function calculateFromDescription() {
    const text = descText.trim();
    if (!text) return;

    setDescLoading(true);
    setDescError(null);

    try {
      const token = await getAuth().currentUser?.getIdToken(true);

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

      const raw = await res.text();
      if (!res.ok) {
        const snippet = raw?.trim()?.slice(0, 160);
        setDescError(
          `Describe failed (${res.status}). ${
            snippet ? `Server says: ${snippet}` : "No response body."
          }`,
        );
        return;
      }

      const parsed = safeJsonParse(raw) ?? extractJsonFromText(raw);
      if (!parsed) {
        const snippet = raw?.trim()?.slice(0, 160);
        setDescError(
          `Describe returned non-JSON. ${
            snippet ? `Response: ${snippet}` : "Empty response."
          }`,
        );
        return;
      }

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
        () => {},
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
      const list = await resolveBarcodeCandidates(barcode);
      if (!list.length) {
        setScanError("No nutrition match found for this barcode.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        return;
      }
      if (list.length === 1) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        await startEditFromBarcodeResolved(list[0]);
        return;
      }
      // multiple candidates → picker
      setCandidates(list);
      setPickOpen(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      setScanError("Barcode lookup failed. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        title="Add Meal"
        subtitle={date}
        onClose={() => router.back()}
        colors={colors}
        isDark={!!isDark}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
        >
          {/* Meal type picker */}
          <SegmentedMeal value={meal} onChange={setMeal} colors={colors} />

          {/* Hero actions */}
          <Pressable
            onPress={openPhotoScan}
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
                withAlpha(colors.card, 0.1),
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
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    flex: 1,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.25),
                      backgroundColor: withAlpha(colors.primary, 0.12),
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
                      Scan a Meal
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontWeight: "800",
                        marginTop: 2,
                      }}
                    >
                      Photo → candidates → you confirm.
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.muted}
                />
              </View>

              <View
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.border, 0.9),
                  backgroundColor: withAlpha(colors.card, 0.26),
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

          {/* Quick Add card */}
          {/* <View
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.card, 0.25),
            }}
          >
            <LinearGradient
              colors={[
                withAlpha(colors.primary, 0.16),
                withAlpha(colors.card, 0.08),
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
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  Quick Add
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MealHealthScoreIndicator
                    input={{
                      calories: toNum(qaCalories),
                      proteinG: toNum(qaProtein),
                      carbsG: toNum(qaCarbs),
                      fatG: toNum(qaFat),
                    }}
                    compact
                  />
                </View>
              </View>
              <Text
                style={{ color: colors.muted, fontWeight: "800", marginTop: 4 }}
              >
                Fast macros → review → add.
              </Text>

              <View style={{ marginTop: 12, gap: 10 }}>
                <Field
                  label="Name (optional)"
                  value={qaName}
                  onChange={setQaName}
                  colors={colors}
                  placeholder="e.g. protein shake"
                />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Calories"
                      value={qaCalories}
                      onChange={(t) => setQaCalories(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      colors={colors}
                      placeholder="0"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Protein"
                      value={qaProtein}
                      onChange={(t) => setQaProtein(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      colors={colors}
                      placeholder="0"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Carbs"
                      value={qaCarbs}
                      onChange={(t) => setQaCarbs(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      colors={colors}
                      placeholder="0"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Fat"
                      value={qaFat}
                      onChange={(t) => setQaFat(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      colors={colors}
                      placeholder="0"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setQaName("");
                      setQaCalories("");
                      setQaProtein("");
                      setQaCarbs("");
                      setQaFat("");
                    }}
                    style={{
                      flex: 1,
                      height: 50,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.card, 0.22),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Clear
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={openQuickAddConfirm}
                    disabled={!anyQuickMacro}
                    style={{
                      flex: 1,
                      height: 50,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: withAlpha(colors.primary, 0.36),
                      backgroundColor: withAlpha(colors.primary, 0.16),
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: anyQuickMacro ? 1 : 0.55,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Review
                    </Text>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          </View> */}

          {/* Tabs */}
          <TabPills tab={tab} setTab={setTab} colors={colors} />

          {/* Tab content */}
          {tab === "recents" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.18),
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.18),
                    withAlpha(colors.card, 0.1),
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
                    Top quick adds
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    Tap once → confirm → add.
                  </Text>

                  <View
                    style={{
                      marginTop: 12,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 10,
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
                          backgroundColor: withAlpha(colors.card, 0.28),
                          width: "100%",
                        }}
                      >
                        <Text
                          style={{ color: colors.muted, fontWeight: "800" }}
                        >
                          Log a few meals to see your top quick adds here.
                        </Text>
                      </View>
                    ) : (
                      quickTiles.slice(0, 6).map((t) => (
                        <Pressable
                          key={t.name}
                          onPress={() => pick(t, "recent")}
                          style={{
                            width: "48%",
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.border, 0.9),
                            backgroundColor: withAlpha(colors.card, 0.26),
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
                    backgroundColor: withAlpha(colors.card, 0.25),
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    No recents yet. Add a few meals and they’ll appear here.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {myRecents
                    .slice(0, recentVisible)
                    .map((r: any, idx: number) => (
                      <Pressable
                        key={`${r?.id || r?.name || "recent"}-${idx}`}
                        onPress={() => pick(r, "recent")}
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: withAlpha(colors.card, 0.22),
                          padding: 12,
                        }}
                      >
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
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          {Math.round(Number(r.calories || 0))} kcal • P{" "}
                          {Math.round(Number(r.protein || 0))}g
                        </Text>
                      </Pressable>
                    ))}

                  {myRecents.length > recentVisible ? (
                    <Pressable
                      onPress={() =>
                        setRecentVisible((v) =>
                          Math.min(v + 15, 50, myRecents.length),
                        )
                      }
                      style={{
                        alignSelf: "flex-start",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.22),
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
                  ) : null}
                </View>
              )}
            </View>
          )}

          {tab === "search" && (
            <View style={{ gap: 12 }}>
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.22),
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
                    placeholder="Search foods"
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
                    backgroundColor: withAlpha(colors.card, 0.22),
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
                    backgroundColor: withAlpha(colors.card, 0.22),
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
                        backgroundColor: withAlpha(colors.card, 0.22),
                        padding: 12,
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontWeight: "900" }}
                        numberOfLines={1}
                      >
                        {r.name || r.title || "Food"}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        {Math.round(Number(r.calories || 0))} kcal • P{" "}
                        {Math.round(Number(r.protein || 0))}g
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {tab === "describe" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.18),
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.16),
                    withAlpha(colors.card, 0.1),
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
                      placeholder="e.g. chicken bowl with rice, beans, cheese, salsa"
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
                          ? withAlpha(colors.card, 0.22)
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
                        backgroundColor: withAlpha(colors.card, 0.22),
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

          {tab === "barcode" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.18),
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.14),
                    withAlpha(colors.card, 0.1),
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
                    Scan barcode
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    Scan to find nutrition, then confirm.
                  </Text>

                  <View style={{ marginTop: 12, gap: 10 }}>
                    {!permission?.granted ? (
                      <View
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 14,
                          backgroundColor: withAlpha(colors.card, 0.22),
                          gap: 10,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          Camera permission needed
                        </Text>
                        <Text
                          style={{ color: colors.muted, fontWeight: "800" }}
                        >
                          Enable camera access to scan barcodes.
                        </Text>
                        <Pressable
                          onPress={() => requestPermission().catch(() => {})}
                          style={{
                            height: 46,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.primary, 0.35),
                            backgroundColor: withAlpha(colors.primary, 0.16),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                          >
                            Enable camera
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        style={{
                          borderRadius: 18,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: withAlpha(colors.border, 0.9),
                          backgroundColor: withAlpha(colors.card, 0.18),
                          height: 240,
                        }}
                      >
                        <CameraView
                          style={{ flex: 1 }}
                          barcodeScannerSettings={{
                            barcodeTypes: [
                              "ean13",
                              "ean8",
                              "upc_a",
                              "upc_e",
                              "code128",
                              "code39",
                            ],
                          }}
                          onBarcodeScanned={onBarcodeScanned}
                        />
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: 10,
                            backgroundColor: "rgba(0,0,0,0.35)",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            Aim at the barcode • auto-detect
                          </Text>
                        </View>
                      </View>
                    )}

                    <View
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: withAlpha(colors.card, 0.22),
                        padding: 12,
                        gap: 10,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        Or enter barcode
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <TextInput
                          value={manualBarcode}
                          onChangeText={(t) =>
                            setManualBarcode(t.replace(/[^0-9]/g, ""))
                          }
                          placeholder="UPC / EAN"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="number-pad"
                          style={{
                            flex: 1,
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
                          onPress={() => {
                            const code = manualBarcode.trim();
                            if (!code) return;
                            Keyboard.dismiss();
                            setScannedBarcode(code);
                            resolveAndMaybePick(code);
                          }}
                          disabled={
                            candidatePending || manualBarcode.trim().length < 6
                          }
                          style={{
                            height: 46,
                            paddingHorizontal: 14,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: withAlpha(colors.primary, 0.35),
                            backgroundColor: withAlpha(colors.primary, 0.16),
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: manualBarcode.trim().length < 6 ? 0.55 : 1,
                          }}
                        >
                          {candidatePending ? (
                            <ActivityIndicator />
                          ) : (
                            <Text
                              style={{ color: colors.text, fontWeight: "900" }}
                            >
                              Lookup
                            </Text>
                          )}
                        </Pressable>
                      </View>

                      {scanError ? (
                        <Text
                          style={{
                            color: withAlpha("#EF4444", 0.95),
                            fontWeight: "800",
                          }}
                        >
                          {scanError}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}

          {tab === "manual" && (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: withAlpha(colors.card, 0.18),
                }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(colors.primary, 0.16),
                    withAlpha(colors.card, 0.1),
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
                    />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Qty"
                          value={qty}
                          onChange={(t) => setQty(t.replace(/[^0-9.]/g, ""))}
                          keyboardType="decimal-pad"
                          colors={colors}
                          placeholder="1"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Unit"
                          value={unit}
                          onChange={setUnit}
                          colors={colors}
                          placeholder="serving"
                        />
                      </View>
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
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Calories"
                          value={calories}
                          onChange={(t) =>
                            setCalories(t.replace(/[^0-9.]/g, ""))
                          }
                          keyboardType="decimal-pad"
                          colors={colors}
                          placeholder="0"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Protein (g)"
                          value={protein}
                          onChange={(t) =>
                            setProtein(t.replace(/[^0-9.]/g, ""))
                          }
                          keyboardType="decimal-pad"
                          colors={colors}
                          placeholder="0"
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Carbs (g)"
                          value={carbs}
                          onChange={(t) => setCarbs(t.replace(/[^0-9.]/g, ""))}
                          keyboardType="decimal-pad"
                          colors={colors}
                          placeholder="0"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Fat (g)"
                          value={fat}
                          onChange={(t) => setFat(t.replace(/[^0-9.]/g, ""))}
                          keyboardType="decimal-pad"
                          colors={colors}
                          placeholder="0"
                        />
                      </View>
                    </View>

                    <Pressable
                      onPress={commitManual}
                      disabled={!name.trim()}
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
                        opacity: name.trim() ? 1 : 0.55,
                      }}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={18}
                        color={colors.text}
                      />
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        Review & confirm
                      </Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}
        </ScrollView>

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
            <Pressable
              onPress={closeConfirm}
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(0,0,0,0.35)",
                  zIndex: 0,
                  elevation: 0,
                },
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
                        withAlpha(colors.card, 0.2),
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", inset: 0 }}
                    />
                    <ConfirmSheetContent
                      colors={colors}
                      isDark={!!isDark}
                      edits={confirmEdits}
                      setEdits={setConfirmEdits}
                      onCancel={closeConfirm}
                      onConfirm={confirmAndAdd}
                    />
                  </BlurView>
                ) : (
                  <ConfirmSheetContent
                    colors={colors}
                    isDark={!!isDark}
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

        {/* ✅ Candidate picker (barcode) */}
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
                    isDark
                      ? "systemThinMaterialDark"
                      : "systemThinMaterialLight"
                  }
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(colors.primary, 0.16),
                      withAlpha(colors.card, 0.22),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: "absolute", inset: 0 }}
                  />

                  <View style={{ padding: 16, gap: 10 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                    >
                      Choose a match
                    </Text>
                    <Text style={{ color: colors.muted, fontWeight: "800" }}>
                      Multiple nutrition sources found. Pick the best one.
                    </Text>

                    <ScrollView
                      contentContainerStyle={{ gap: 10, paddingBottom: 18 }}
                    >
                      {candidates.map((c, idx) => (
                        <Pressable
                          key={`${c.name}-${idx}`}
                          onPress={async () => {
                            setPickOpen(false);
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            ).catch(() => {});
                            await startEditFromBarcodeResolved(c);
                          }}
                          style={{
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.card, 0.22),
                            padding: 12,
                          }}
                        >
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                            numberOfLines={1}
                          >
                            {c.name}
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "800",
                              marginTop: 4,
                              fontSize: 12,
                            }}
                          >
                            {c.brand ? `${c.brand} • ` : ""}
                            {c.unit} •{" "}
                            {Math.round(Number(c.nutrients.calories || 0))} kcal
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </BlurView>
              ) : (
                <View style={{ padding: 16, gap: 10 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    Choose a match
                  </Text>
                  <ScrollView
                    contentContainerStyle={{ gap: 10, paddingBottom: 18 }}
                  >
                    {candidates.map((c, idx) => (
                      <Pressable
                        key={`${c.name}-${idx}`}
                        onPress={async () => {
                          setPickOpen(false);
                          await startEditFromBarcodeResolved(c);
                        }}
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: withAlpha(colors.card, 0.22),
                          padding: 12,
                        }}
                      >
                        <Text
                          style={{ color: colors.text, fontWeight: "900" }}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontWeight: "800",
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          {c.brand ? `${c.brand} • ` : ""}
                          {c.unit} •{" "}
                          {Math.round(Number(c.nutrients.calories || 0))} kcal
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}
