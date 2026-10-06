import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import PremiumModalSheet from "@/components/ui/PremiumModalSheet";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";
import { searchCatalog, type FoodCatalogItem } from "@/services/foodCatalog";
import {
  applyQtyToMealItem,
  createMealBuilderItem,
  readMealPresets,
  saveMealPreset,
  sumMealItems,
  writePendingMealBuilderLog,
  type MealBuilderFoodItem,
  type MealBuilderMealType,
  type MealPreset,
} from "@/services/mealBuilder";
import {
  createManualFood,
  describeMeal,
  lookupBarcode,
  scanFood,
  type BarcodeCandidate,
  type MealBuilderInputFood,
} from "@/services/mealBuilderInputs";

type SearchRow = {
  key: string;
  sourceBucket: "recent" | "frequent" | "search";
  rank: number;
  item: RecentFood | (FoodCatalogItem & { id: string });
};

const MEAL_TYPES: Array<{ key: MealBuilderMealType; label: string; icon: any }> =
  [
    { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
    { key: "lunch", label: "Lunch", icon: "restaurant-outline" },
    { key: "dinner", label: "Dinner", icon: "moon-outline" },
    { key: "snacks", label: "Snack", icon: "ice-cream-outline" },
  ];

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function foodKey(name: string, unit: string) {
  return `${String(name || "").trim().toLowerCase()}|${String(unit || "serving")
    .trim()
    .toLowerCase()}`;
}

function fmtMacroRow(item: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  return `${Math.round(item.calories || 0)} kcal • P ${Math.round(
    item.protein || 0
  )} • C ${Math.round(item.carbs || 0)} • F ${Math.round(item.fat || 0)}`;
}

function quantityStep(item: MealBuilderFoodItem) {
  const unit = String(item.unit || "").toLowerCase();
  if (unit.includes("g") || unit.includes("ml")) return 25;
  if (item.qty >= 3) return 1;
  return 0.5;
}

const softShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
};

const mealTargets: Record<
  MealBuilderMealType,
  { calories: number; protein: number; carbs: number; fat: number }
> = {
  breakfast: { calories: 550, protein: 30, carbs: 50, fat: 18 },
  lunch: { calories: 700, protein: 40, carbs: 70, fat: 24 },
  dinner: { calories: 750, protein: 42, carbs: 72, fat: 26 },
  snacks: { calories: 320, protein: 16, carbs: 24, fat: 12 },
};

export default function MealBuilderScreen() {
  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const [mealType, setMealType] = useState<MealBuilderMealType>(
    (params.meal as MealBuilderMealType) || "lunch"
  );
  const [mealName, setMealName] = useState("");
  const [items, setItems] = useState<MealBuilderFoodItem[]>([]);
  const [query, setQuery] = useState("");
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [searchResults, setSearchResults] = useState<
    Array<FoodCatalogItem & { id: string }>
  >([]);
  const [presets, setPresets] = useState<MealPreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetJustSaved, setPresetJustSaved] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [inputSheetOpen, setInputSheetOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<
    null | "scan" | "describe" | "barcode" | "manual"
  >(null);
  const [methodBusy, setMethodBusy] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [describeText, setDescribeText] = useState("");
  const [describeResults, setDescribeResults] = useState<MealBuilderInputFood[]>([]);
  const [manualDraft, setManualDraft] = useState({
    name: "",
    qty: "1",
    unit: "serving",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeCandidates, setBarcodeCandidates] = useState<BarcodeCandidate[]>([]);
  const [scanPhotoUri, setScanPhotoUri] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<MealBuilderInputFood[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  const dateISO = typeof params.date === "string" ? params.date : isoToday();

  useEffect(() => {
    if (!user?.uid) return;
    fetchMyRecentFoods(user.uid, 20)
      .then(setRecentFoods)
      .catch(() => setRecentFoods([]));
    fetchMyTopFoods(user.uid, 12)
      .then(setTopFoods)
      .catch(() => setTopFoods([]));
    readMealPresets(user.uid)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [user?.uid]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    let live = true;
    const timer = setTimeout(async () => {
      if (!live) return;
      try {
        const res = await searchCatalog(query.trim(), 24);
        if (!live) return;
        setSearchResults(res as Array<FoodCatalogItem & { id: string }>);
      } catch {
        if (live) setSearchResults([]);
      }
    }, 180);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const totals = useMemo(() => sumMealItems(items), [items]);
  const macroTargets = mealTargets[mealType];
  const macroStats = useMemo(
    () => [
      {
        key: "calories",
        label: "Calories",
        short: "Cal",
        value: totals.calories,
        target: macroTargets.calories,
        suffix: "",
        glow: "#38bdf8",
      },
      {
        key: "protein",
        label: "Protein",
        short: "P",
        value: totals.protein,
        target: macroTargets.protein,
        suffix: "g",
        glow: "#22c55e",
      },
      {
        key: "carbs",
        label: "Carbs",
        short: "C",
        value: totals.carbs,
        target: macroTargets.carbs,
        suffix: "g",
        glow: "#f59e0b",
      },
      {
        key: "fat",
        label: "Fat",
        short: "F",
        value: totals.fat,
        target: macroTargets.fat,
        suffix: "g",
        glow: "#f97316",
      },
    ],
    [macroTargets, totals.calories, totals.carbs, totals.fat, totals.protein]
  );

  const mergedResults = useMemo(() => {
    const dedupe = new Set<string>();
    const out: SearchRow[] = [];
    const q = query.trim().toLowerCase();

    const pushItem = (
      sourceBucket: SearchRow["sourceBucket"],
      rank: number,
      raw: RecentFood | (FoodCatalogItem & { id: string })
    ) => {
      const name = String(raw.name || "").trim();
      if (!name) return;
      const key = foodKey(name, String(raw.unit || "serving"));
      if (dedupe.has(key)) return;
      if (q) {
        const hay = `${name.toLowerCase()} ${String(raw.unit || "").toLowerCase()}`;
        if (!hay.includes(q)) return;
      }
      dedupe.add(key);
      out.push({ key, sourceBucket, rank, item: raw });
    };

    recentFoods.forEach((item, idx) => pushItem("recent", idx, item));
    topFoods.forEach((item, idx) => pushItem("frequent", idx, item));
    searchResults.forEach((item, idx) => pushItem("search", idx, item));

    return out.sort((a, b) => {
      const bucketOrder = { recent: 0, frequent: 1, search: 2 };
      return (
        bucketOrder[a.sourceBucket] - bucketOrder[b.sourceBucket] || a.rank - b.rank
      );
    });
  }, [query, recentFoods, searchResults, topFoods]);

  const suggestedResults = useMemo(() => mergedResults.slice(0, 14), [mergedResults]);
  const presetPreview = useMemo(() => presets.slice(0, 8), [presets]);
  const recentQuickAdds = useMemo(() => recentFoods.slice(0, 5), [recentFoods]);
  const footerHeight = 116 + Math.max(insets.bottom, 12);
  const lastUsedByFoodKey = useMemo(() => {
    const map = new Map<string, RecentFood>();
    recentFoods.forEach((food) => {
      map.set(foodKey(food.name, food.unit), food);
    });
    return map;
  }, [recentFoods]);

  useEffect(() => {
    if (!lastAddedKey) return;
    const timer = setTimeout(() => setLastAddedKey(null), 1400);
    return () => clearTimeout(timer);
  }, [lastAddedKey]);

  useEffect(() => {
    if (!presetJustSaved) return;
    const timer = setTimeout(() => setPresetJustSaved(false), 1600);
    return () => clearTimeout(timer);
  }, [presetJustSaved]);

  useEffect(() => {
    if (activeMethod === "barcode" && !cameraPermission?.granted) {
      requestCameraPermission().catch(() => {});
    }
  }, [activeMethod, cameraPermission?.granted, requestCameraPermission]);

  function appendFoods(raws: MealBuilderInputFood[], feedbackKey?: string | null) {
    if (!raws.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItems((current) => {
      const clone = [...current];
      for (const raw of raws) {
        const next = createMealBuilderItem({
          name: raw.name,
          qty: Number(raw.qty || 1) || 1,
          unit: String(raw.unit || "serving"),
          calories: Number(raw.calories || 0),
          protein: Number(raw.protein || 0),
          carbs: Number(raw.carbs || 0),
          fat: Number(raw.fat || 0),
          sugar: raw.sugar,
          fiber: raw.fiber,
          addedSugar: raw.addedSugar,
          satFat: raw.satFat,
          sodium: raw.sodium,
          wholeFoodRatio: raw.wholeFoodRatio,
          veggieFruitServings: raw.veggieFruitServings,
          unsatFatRatio: raw.unsatFatRatio,
          alcoholCalories: raw.alcoholCalories,
          foodRefId: raw.foodRefId,
          source: raw.source,
        });
        const existing = clone.findIndex(
          (item) => foodKey(item.name, item.unit) === foodKey(next.name, next.unit)
        );
        if (existing === -1) {
          clone.unshift(next);
          continue;
        }
        clone[existing] = applyQtyToMealItem(
          clone[existing],
          clone[existing].qty + next.qty
        );
      }
      return clone;
    });
    setLastAddedKey(feedbackKey ?? foodKey(raws[raws.length - 1].name, raws[raws.length - 1].unit));
    setQuery("");
  }

  function addFood(raw: RecentFood | (FoodCatalogItem & { id: string })) {
    appendFoods(
      [
        {
          name: raw.name,
          qty: Number(raw.qty || 1) || 1,
          unit: String(raw.unit || "serving"),
          calories: Number(raw.calories || 0),
          protein: Number(raw.protein || 0),
          carbs: Number(raw.carbs || 0),
          fat: Number(raw.fat || 0),
          sugar: raw.sugar,
          fiber: raw.fiber,
          addedSugar: raw.addedSugar,
          satFat: raw.satFat,
          sodium: raw.sodium,
          wholeFoodRatio: raw.wholeFoodRatio,
          veggieFruitServings: raw.veggieFruitServings,
          unsatFatRatio: raw.unsatFatRatio,
          alcoholCalories: raw.alcoholCalories,
          foodRefId: "id" in raw && raw.id ? String(raw.id) : undefined,
          source: "id" in raw && raw.id ? "catalog" : "recent",
        },
      ],
      foodKey(raw.name, raw.unit)
    );
  }

  function updateQty(itemId: string, nextQty: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? applyQtyToMealItem(item, nextQty) : item
      )
    );
  }

  function updateUnit(itemId: string, unit: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, unit: unit || "serving" } : item
      )
    );
  }

  function removeItem(itemId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function moveItem(itemId: string, direction: "up" | "down") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync().catch(() => {});
    setItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      if (index === -1) return current;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function resetMethodState() {
    setMethodBusy(false);
    setMethodError(null);
    setDescribeText("");
    setDescribeResults([]);
    setManualDraft({
      name: "",
      qty: "1",
      unit: "serving",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
    setBarcodeInput("");
    setBarcodeCandidates([]);
    setScanPhotoUri(null);
    setScanResults([]);
    setLastScannedBarcode(null);
  }

  function openMethod(method: "scan" | "describe" | "barcode" | "manual") {
    setInputSheetOpen(false);

    if (method === "scan") {
      router.push({
        pathname: "/(modals)/scan-meal-v2",
        params: {
          meal: mealType,
          date: dateISO,
          returnTo: "meal-builder",
        },
      });
      return;
    }

    resetMethodState();
    setActiveMethod(method);
  }

  function resetMeal() {
    Alert.alert("Start a fresh meal?", "This clears the current builder.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setMealName("");
          setItems([]);
          setQuery("");
        },
      },
    ]);
  }

  function applyPreset(preset: MealPreset) {
    setMealName(preset.name);
    setMealType(preset.mealType);
    setItems(
      preset.items.map((item) =>
        createMealBuilderItem({
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          sugar: item.sugar,
          fiber: item.fiber,
          addedSugar: item.addedSugar,
          satFat: item.satFat,
          sodium: item.sodium,
          wholeFoodRatio: item.wholeFoodRatio,
          veggieFruitServings: item.veggieFruitServings,
          unsatFatRatio: item.unsatFatRatio,
          alcoholCalories: item.alcoholCalories,
          foodRefId: item.foodRefId,
          source: item.source || "preset",
        })
      )
    );
    setShowPresets(false);
  }

  function closeMethod() {
    setActiveMethod(null);
    resetMethodState();
  }

  async function runDescribe() {
    if (!describeText.trim()) return;
    setMethodBusy(true);
    setMethodError(null);
    try {
      const foods = await describeMeal({
        text: describeText,
        meal: mealType,
        date: dateISO,
      });
      if (!foods.length) {
        setMethodError("No foods were detected. Try adding quantities.");
      }
      setDescribeResults(foods);
    } catch (e: any) {
      setMethodError(e?.message || "Describe failed.");
      setDescribeResults([]);
    } finally {
      setMethodBusy(false);
    }
  }

  function submitDescribeFoods() {
    if (!describeResults.length) return;
    appendFoods(describeResults, null);
    closeMethod();
  }

  function submitManualFood() {
    if (!manualDraft.name.trim()) {
      setMethodError("Enter a food name.");
      return;
    }
    const food = createManualFood({
      name: manualDraft.name,
      qty: Number(manualDraft.qty || 1) || 1,
      unit: manualDraft.unit,
      calories: Number(manualDraft.calories || 0),
      protein: Number(manualDraft.protein || 0),
      carbs: Number(manualDraft.carbs || 0),
      fat: Number(manualDraft.fat || 0),
    });
    appendFoods([food], null);
    closeMethod();
  }

  async function runBarcodeLookup(codeRaw?: string) {
    const code = (codeRaw ?? barcodeInput).trim();
    if (!code || methodBusy) return;
    setMethodBusy(true);
    setMethodError(null);
    setBarcodeInput(code);
    try {
      const matches = await lookupBarcode(code);
      if (!matches.length) {
        setMethodError("No nutrition match found for this barcode.");
        setBarcodeCandidates([]);
      } else {
        setBarcodeCandidates(matches);
      }
    } catch (e: any) {
      setMethodError(e?.message || "Barcode lookup failed.");
      setBarcodeCandidates([]);
    } finally {
      setMethodBusy(false);
    }
  }

  async function ensureCameraAccess() {
    const granted = cameraPermission?.granted
      ? true
      : (await requestCameraPermission())?.granted;
    if (!granted) {
      setMethodError("Camera access is required for this method.");
      return false;
    }
    return true;
  }

  async function pickScanPhoto(source: "camera" | "library") {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (camera.status !== "granted" || media.status !== "granted") {
      setMethodError("Allow camera and photo library access to scan food.");
      return;
    }

    const picker =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.9,
            allowsEditing: true,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9,
            allowsEditing: true,
            aspect: [4, 3],
          });

    if (picker.canceled) return;
    const uri = picker.assets?.[0]?.uri;
    if (!uri) return;

    setScanPhotoUri(uri);
    setScanResults([]);
    setMethodError(null);
    setMethodBusy(true);
    try {
      const foods = await scanFood(uri);
      if (!foods.length) {
        setMethodError("No foods were detected. Try another photo.");
      }
      setScanResults(foods);
    } catch (e: any) {
      setMethodError(e?.message || "Scan failed.");
      setScanResults([]);
    } finally {
      setMethodBusy(false);
    }
  }

  function onInlineBarcodeScanned(data?: string) {
    const code = String(data || "").trim();
    if (!code || code === lastScannedBarcode || methodBusy) return;
    setLastScannedBarcode(code);
    runBarcodeLookup(code);
  }

  async function onSavePreset() {
    if (!user?.uid) {
      Alert.alert("Sign in required", "You need an account to save presets.");
      return;
    }
    if (!items.length) {
      Alert.alert("Add foods first", "Build the meal before saving a preset.");
      return;
    }
    if (!mealName.trim()) {
      Alert.alert(
        "Name this meal",
        "Preset meals need a name so you can reuse them later."
      );
      return;
    }

    setPresetBusy(true);
    try {
      const preset = await saveMealPreset(user.uid, {
        name: mealName.trim(),
        mealType,
        items,
        favorite: true,
      });
      setPresets((prev) => [preset, ...prev].slice(0, 40));
      setPresetJustSaved(true);
      setShowPresets(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    } catch {
      Alert.alert("Couldn’t save preset", "Try again.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function onLogMeal() {
    if (!user?.uid) {
      Alert.alert("Sign in required", "You need an account to log meals.");
      return;
    }
    if (!items.length) {
      Alert.alert("Add foods first", "Build the meal before logging it.");
      return;
    }

    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );

      await writePendingMealBuilderLog({
        entryKind: "meal",
        date: dateISO,
        meal: mealType,
        name: mealName.trim() || `${labelForMealType(mealType)} meal`,
        items,
        source: "meal-builder",
      });

      router.back();
    } catch {
      Alert.alert("Couldn’t log meal", "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: Math.max(insets.top, 16) + 4,
            paddingBottom: footerHeight + 28,
          }}
        >
          <View style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable onPress={() => router.back()} style={topIconButton(colors)}>
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>

              <View style={{ alignItems: "center", gap: 2 }}>
                <Text
                  style={{ color: withAlpha(colors.text, 0.58), fontWeight: "900", fontSize: 11 }}
                >
                  Flagship nutrition flow
                </Text>
                <Text
                  style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}
                >
                  Meal Builder
                </Text>
              </View>

              <Pressable onPress={resetMeal} style={topIconButton(colors)}>
                <Ionicons name="refresh-outline" size={18} color={colors.text} />
              </Pressable>
            </View>

            <View
              style={{
                borderRadius: 24,
                overflow: "hidden",
                ...softShadow,
              }}
            >
              <LinearGradient
                colors={[
                  withAlpha(colors.primary, isDark ? 0.22 : 0.12),
                  withAlpha("#38bdf8", isDark ? 0.14 : 0.08),
                  withAlpha(colors.card, 0.86),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 14, gap: 12 }}
              >
                <View style={{ gap: 4 }}>
                  <Text
                    style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}
                  >
                    Build one meal, log once
                  </Text>
                  <Text
                    style={{
                      color: withAlpha(colors.text, 0.7),
                      fontWeight: "700",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    Faster for repeat meals, with one grouped entry in the day log.
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {MEAL_TYPES.map((option) => {
                    const active = option.key === mealType;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setMealType(option.key)}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 999,
                          backgroundColor: active
                            ? withAlpha(colors.text, 0.14)
                            : withAlpha(colors.bg, isDark ? 0.32 : 0.76),
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <Ionicons
                          name={option.icon}
                          size={15}
                          color={colors.text}
                        />
                        <Text
                          style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <TextInput
                  value={mealName}
                  onChangeText={setMealName}
                  placeholder="Meal name, optional"
                  placeholderTextColor={withAlpha(colors.text, 0.38)}
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 18,
                    backgroundColor: withAlpha(colors.bg, isDark ? 0.34 : 0.82),
                  }}
                />

                <View
                  style={{
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: withAlpha(colors.bg, isDark ? 0.26 : 0.55),
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ color: withAlpha(colors.text, 0.62), fontWeight: "900", fontSize: 11 }}
                    >
                      Live engine
                    </Text>
                    <Text
                      style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
                    >
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <View style={{ gap: 8 }}>
                    {macroStats.map((metric) => {
                      const ratio = Math.max(
                        0.04,
                        Math.min(1, metric.value / Math.max(metric.target, 1))
                      );
                      const nearTarget = ratio >= 0.82 && ratio <= 1.08;
                      return (
                        <View key={metric.key} style={{ gap: 6 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text
                              style={{
                                color: withAlpha(colors.text, 0.7),
                                fontWeight: "900",
                                fontSize: 11,
                              }}
                            >
                              {metric.label}
                            </Text>
                            <Text
                              style={{
                                color: colors.text,
                                fontWeight: "900",
                                fontSize: 12,
                              }}
                            >
                              {Math.round(metric.value)}
                              {metric.suffix}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 9,
                              borderRadius: 999,
                              overflow: "hidden",
                              backgroundColor: withAlpha(colors.text, 0.08),
                            }}
                          >
                            <MotiView
                              animate={{
                                width: `${ratio * 100}%`,
                                opacity: nearTarget ? 1 : 0.92,
                              }}
                              transition={{ type: "timing", duration: 320 }}
                              style={{
                                height: "100%",
                                borderRadius: 999,
                                shadowColor: metric.glow,
                                shadowOpacity: nearTarget ? 0.45 : 0.18,
                                shadowRadius: nearTarget ? 10 : 4,
                                shadowOffset: { width: 0, height: 0 },
                              }}
                            >
                              <LinearGradient
                                colors={[
                                  withAlpha(metric.glow, nearTarget ? 0.95 : 0.78),
                                  withAlpha(colors.primary, 0.92),
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ flex: 1 }}
                              />
                            </MotiView>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </LinearGradient>
            </View>

            {presetPreview.length ? (
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
                  >
                    Presets
                  </Text>
                  <Pressable
                    onPress={() => setShowPresets((v) => !v)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: withAlpha(colors.card, 0.42),
                    }}
                  >
                    <Text
                      style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
                    >
                      {showPresets ? "Hide" : "Browse"}
                    </Text>
                    <Ionicons
                      name={showPresets ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {presetPreview.map((preset) => (
                    <Pressable
                      key={preset.id}
                      onPress={() => applyPreset(preset)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 18,
                        backgroundColor: withAlpha(colors.card, 0.42),
                        minWidth: 120,
                        maxWidth: 170,
                        gap: 2,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <Text
                        style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}
                        numberOfLines={1}
                      >
                        {preset.name}
                      </Text>
                      <Text
                        style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                        numberOfLines={1}
                      >
                        {preset.items.length} foods • {labelForMealType(preset.mealType)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {showPresets ? (
                  <View
                    style={{
                      borderRadius: 18,
                      padding: 10,
                      backgroundColor: withAlpha(colors.card, 0.4),
                      gap: 8,
                    }}
                  >
                    {presets.map((preset) => (
                      <Pressable
                        key={`full:${preset.id}`}
                        onPress={() => applyPreset(preset)}
                        style={{
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: withAlpha(colors.bg, 0.44),
                          gap: 4,
                        }}
                      >
                        <Text
                          style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}
                          numberOfLines={1}
                        >
                          {preset.name}
                        </Text>
                        <Text
                          style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                          numberOfLines={1}
                        >
                          {preset.items.map((item) => item.name).join(", ")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Panel colors={colors}>
              <SectionHeader
                colors={colors}
                title="Current meal"
                subtitle={
                  items.length
                    ? "Edit portions inline. Your totals update instantly."
                    : "Start by adding foods below or tap a preset above."
                }
              />

              {items.length ? (
                <View style={{ gap: 10 }}>
                  {items.map((item, visibleIndex) => {
                    const step = quantityStep(item);
                    const itemIndex = items.findIndex((candidate) => candidate.id === item.id);
                    return (
                      <MotiView
                        key={item.id}
                        from={{ opacity: 0, translateY: 10, scale: 0.98 }}
                        animate={{ opacity: 1, translateY: 0, scale: 1 }}
                        transition={{ type: "timing", duration: 220, delay: visibleIndex * 18 }}
                        style={{
                          borderRadius: 22,
                          padding: 12,
                          backgroundColor: withAlpha(colors.card, isDark ? 0.5 : 0.82),
                          ...softShadow,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                            <Text
                              style={{
                                color: colors.text,
                                fontWeight: "900",
                                fontSize: 15,
                              }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                fontWeight: "800",
                                fontSize: 11,
                              }}
                              numberOfLines={1}
                            >
                              {fmtMacroRow(item)}
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <View
                              style={{
                                width: 34,
                                borderRadius: 12,
                                overflow: "hidden",
                                backgroundColor: withAlpha(colors.card, 0.44),
                              }}
                            >
                              <Pressable
                                disabled={itemIndex === 0}
                                onPress={() => moveItem(item.id, "up")}
                                style={{
                                  height: 22,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: itemIndex === 0 ? 0.35 : 1,
                                }}
                              >
                                <Ionicons
                                  name="chevron-up"
                                  size={15}
                                  color={colors.text}
                                />
                              </Pressable>
                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: withAlpha(colors.border, 0.25),
                                }}
                              />
                              <Pressable
                                disabled={itemIndex === items.length - 1}
                                onPress={() => moveItem(item.id, "down")}
                                style={{
                                  height: 22,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: itemIndex === items.length - 1 ? 0.35 : 1,
                                }}
                              >
                                <Ionicons
                                  name="chevron-down"
                                  size={15}
                                  color={colors.text}
                                />
                              </Pressable>
                            </View>

                            <Pressable
                              onPress={() => removeItem(item.id)}
                              style={({ pressed }) => ({
                                ...miniIconButton(colors),
                                transform: [{ scale: pressed ? 0.95 : 1 }],
                              })}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={15}
                                color={colors.text}
                              />
                            </Pressable>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <View
                            style={{
                              flex: 1.2,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Pressable
                              onPress={() =>
                                updateQty(item.id, Math.max(0, item.qty - step))
                              }
                              style={({ pressed }) => ({
                                ...miniIconButton(colors),
                                transform: [{ scale: pressed ? 0.95 : 1 }],
                              })}
                            >
                              <Ionicons
                                name="remove"
                                size={16}
                                color={colors.text}
                              />
                            </Pressable>

                            <TextInput
                              value={String(item.qty)}
                              onChangeText={(text) =>
                                updateQty(
                                  item.id,
                                  Number(text.replace(/[^0-9.]/g, "")) || 0
                                )
                              }
                              keyboardType="decimal-pad"
                              style={{
                                flex: 1,
                                color: colors.text,
                                fontWeight: "900",
                                fontSize: 15,
                                textAlign: "center",
                                borderRadius: 16,
                                paddingVertical: 10,
                                backgroundColor: withAlpha(colors.bg, 0.4),
                              }}
                            />

                            <Pressable
                              onPress={() => updateQty(item.id, item.qty + step)}
                              style={({ pressed }) => ({
                                ...miniIconButton(colors),
                                transform: [{ scale: pressed ? 0.95 : 1 }],
                              })}
                            >
                              <Ionicons name="add" size={16} color={colors.text} />
                            </Pressable>
                          </View>

                          <TextInput
                            value={item.unit}
                            onChangeText={(text) => updateUnit(item.id, text)}
                            style={{
                              flex: 0.8,
                              color: colors.text,
                              fontWeight: "800",
                              fontSize: 13,
                              textAlign: "center",
                              borderRadius: 16,
                              paddingVertical: 10,
                              backgroundColor: withAlpha(colors.bg, 0.4),
                            }}
                          />
                        </View>
                      </MotiView>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    borderRadius: 22,
                    padding: 16,
                    backgroundColor: withAlpha(colors.primary, 0.08),
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(colors.primary, 0.18),
                    }}
                  >
                    <Ionicons name="sparkles-outline" size={18} color={colors.text} />
                  </View>
                  <Text
                    style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}
                  >
                    Build your meal here
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      lineHeight: 18,
                    }}
                  >
                    Add a recent food, search for something new, or load a saved
                    preset to start fast.
                  </Text>
                </View>
              )}
            </Panel>

            <Panel colors={colors}>
              <SectionHeader
                colors={colors}
                title="Add foods"
                subtitle="Recent first, frequent next, then search."
              />

              {recentQuickAdds.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
                >
                  {recentQuickAdds.map((food) => (
                    <Pressable
                      key={`recent:${foodKey(food.name, food.unit)}`}
                      onPress={() => addFood(food)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: withAlpha(colors.primary, 0.12),
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <Ionicons name="time-outline" size={14} color={colors.text} />
                      <Text
                        style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {food.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor: withAlpha(colors.bg, isDark ? 0.42 : 0.78),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons name="search-outline" size={18} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search chicken, rice, yogurt..."
                  placeholderTextColor={colors.placeholder}
                  style={{ flex: 1, color: colors.text, fontWeight: "800" }}
                />
                <Pressable
                  onPress={() => setInputSheetOpen(true)}
                  style={{
                    height: 34,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: withAlpha(colors.primary, 0.16),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                  <Text
                    style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>

              <View style={{ gap: 8 }}>
                {suggestedResults.length ? (
                  suggestedResults.map((row) => (
                    (() => {
                      const rowFoodKey = foodKey(row.item.name, row.item.unit);
                      const lastUsed = lastUsedByFoodKey.get(rowFoodKey);
                      const wasJustAdded = lastAddedKey === rowFoodKey;
                      return (
                        <Pressable
                          key={`${row.sourceBucket}:${row.key}`}
                          onPress={() => addFood(row.item)}
                          style={({ pressed }) => ({
                            borderRadius: 16,
                            paddingHorizontal: 12,
                            paddingVertical: 11,
                            backgroundColor: withAlpha(
                              colors.bg,
                              isDark ? 0.35 : 0.72
                            ),
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            transform: [{ scale: pressed ? 0.985 : 1 }],
                          })}
                        >
                          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.text,
                                  fontWeight: "900",
                                  fontSize: 14,
                                  flexShrink: 1,
                                }}
                                numberOfLines={1}
                              >
                                {row.item.name}
                              </Text>
                              <BucketPill
                                colors={colors}
                                label={
                                  row.sourceBucket === "recent"
                                    ? "Recent"
                                    : row.sourceBucket === "frequent"
                                    ? "Frequent"
                                    : "Search"
                                }
                              />
                            </View>
                            <Text
                              style={{
                                color: colors.muted,
                                fontWeight: "800",
                                fontSize: 11,
                              }}
                              numberOfLines={1}
                            >
                              {Math.round(Number(row.item.qty || 1))} {row.item.unit} •{" "}
                              {fmtMacroRow(row.item)}
                            </Text>
                            {lastUsed ? (
                              <Text
                                style={{
                                  color: colors.muted,
                                  fontWeight: "800",
                                  fontSize: 10,
                                }}
                                numberOfLines={1}
                              >
                                Last used: {lastUsed.qty} {lastUsed.unit}
                              </Text>
                            ) : null}
                          </View>

                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: wasJustAdded
                                ? withAlpha("#22c55e", 0.95)
                                : withAlpha(colors.primary, 0.22),
                              shadowColor: wasJustAdded ? "#22c55e" : colors.primary,
                              shadowOpacity: wasJustAdded ? 0.35 : 0.12,
                              shadowRadius: wasJustAdded ? 12 : 4,
                              shadowOffset: { width: 0, height: 0 },
                            }}
                          >
                            <Ionicons
                              name={wasJustAdded ? "checkmark" : "add"}
                              size={18}
                              color={colors.text}
                            />
                          </View>
                        </Pressable>
                      );
                    })()
                  ))
                ) : (
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    {query.trim()
                      ? "No matches yet."
                      : "Recent and frequent foods will appear here for quick add."}
                  </Text>
                )}
              </View>
            </Panel>
          </View>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 10,
            backgroundColor: withAlpha(colors.bg, isDark ? 0.9 : 0.96),
          }}
        >
          <View
            style={{
              borderRadius: 24,
              padding: 12,
              backgroundColor:
                Platform.OS === "ios"
                  ? withAlpha(colors.card, 0.78)
                  : withAlpha(colors.card, 0.98),
              gap: 10,
              ...softShadow,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Pressable
                onPress={onSavePreset}
                disabled={presetBusy}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: presetBusy ? 0.65 : 1,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(colors.primary, 0.14),
                  }}
                >
                  <Ionicons
                    name={presetJustSaved ? "checkmark" : "bookmark-outline"}
                    size={17}
                    color={colors.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {presetBusy
                      ? "Saving preset..."
                      : presetJustSaved
                        ? "Preset saved"
                        : "Save as preset"}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                  >
                    {presetJustSaved
                      ? "Ready in your presets list"
                      : "Reuse this full meal later"}
                  </Text>
                </View>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(
                      presetJustSaved ? colors.primary : colors.border,
                      presetJustSaved ? 0.28 : 0.14
                    ),
                  }}
                >
                  <Ionicons
                    name={presetJustSaved ? "checkmark" : "chevron-forward"}
                    size={16}
                    color={colors.text}
                  />
                </View>
              </Pressable>
            </View>

            <Pressable
              disabled={!items.length || busy}
              onPress={onLogMeal}
              style={({ pressed }) => ({
                height: 56,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
                overflow: "hidden",
              })}
            >
              <LinearGradient
                colors={
                  items.length
                    ? [withAlpha("#38bdf8", 0.98), withAlpha(colors.primary, 0.98)]
                    : [withAlpha(colors.border, 0.45), withAlpha(colors.border, 0.34)]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignSelf: "stretch",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOpacity: items.length ? 0.32 : 0,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 6 },
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                  {busy ? "Logging..." : "Log Meal"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <PremiumModalSheet
          visible={inputSheetOpen}
          onClose={() => setInputSheetOpen(false)}
          title="More ways to add"
          subtitle="Search stays fastest. Use these when you need another input method."
        >
          {[
            {
              key: "scan",
              title: "Scan food",
              subtitle: "Camera flow for one or more foods",
              icon: "camera-outline",
              onPress: () => openMethod("scan"),
            },
            {
              key: "describe",
              title: "Describe meal",
              subtitle: "AI estimate from text",
              icon: "sparkles-outline",
              onPress: () => openMethod("describe"),
            },
            {
              key: "barcode",
              title: "Barcode scan",
              subtitle: "Find packaged foods quickly",
              icon: "barcode-outline",
              onPress: () => openMethod("barcode"),
            },
            {
              key: "manual",
              title: "Manual entry",
              subtitle: "Enter macros or food details",
              icon: "create-outline",
              onPress: () => openMethod("manual"),
            },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={option.onPress}
              style={{
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 13,
                backgroundColor: withAlpha(colors.bg, isDark ? 0.34 : 0.72),
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(colors.primary, 0.14),
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={18}
                  color={colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
                >
                  {option.title}
                </Text>
                <Text
                  style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                >
                  {option.subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </PremiumModalSheet>

        <PremiumModalSheet
          visible={!!activeMethod}
          onClose={closeMethod}
          title={
            activeMethod === "scan"
              ? "Scan food"
              : activeMethod === "describe"
                ? "Describe meal"
                : activeMethod === "barcode"
                  ? "Barcode scan"
                  : "Manual entry"
          }
          subtitle="Meal Builder"
          fullScreen
          scroll={false}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom, 16) + 18,
                gap: 14,
              }}
            >
                {methodError ? (
                  <View
                    style={{
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: withAlpha("#ef4444", 0.14),
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {methodError}
                    </Text>
                  </View>
                ) : null}

                {activeMethod === "scan" ? (
                  <Panel colors={colors}>
                    <SectionHeader
                      colors={colors}
                      title="Photo scan"
                      subtitle="Capture or pick a meal photo, then add the detected foods."
                    />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable
                        onPress={() => pickScanPhoto("camera")}
                        style={methodActionButton(colors, true)}
                      >
                        <Ionicons name="camera-outline" size={18} color={colors.text} />
                        <Text style={methodActionText(colors)}>Take photo</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => pickScanPhoto("library")}
                        style={methodActionButton(colors, false)}
                      >
                        <Ionicons name="images-outline" size={18} color={colors.text} />
                        <Text style={methodActionText(colors)}>Choose photo</Text>
                      </Pressable>
                    </View>

                    {scanPhotoUri ? (
                      <Text
                        style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}
                      >
                        Photo ready. {methodBusy ? "Scanning..." : "Review and add."}
                      </Text>
                    ) : null}

                    {scanResults.length ? (
                      <View style={{ gap: 8 }}>
                        {scanResults.map((food, idx) => (
                          <View
                            key={`${food.name}:${idx}`}
                            style={{
                              borderRadius: 16,
                              padding: 12,
                              backgroundColor: withAlpha(colors.bg, isDark ? 0.35 : 0.72),
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
                            >
                              {food.name}
                            </Text>
                            <Text
                              style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                            >
                              {Math.round(food.qty)} {food.unit} • {fmtMacroRow(food)}
                            </Text>
                          </View>
                        ))}
                        <Pressable
                          onPress={() => {
                            appendFoods(scanResults, null);
                            closeMethod();
                          }}
                          style={primaryMethodButton(colors, scanResults.length > 0)}
                        >
                          <Text style={primaryMethodText(colors)}>
                            Add {scanResults.length} food
                            {scanResults.length === 1 ? "" : "s"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Panel>
                ) : null}

                {activeMethod === "describe" ? (
                  <Panel colors={colors}>
                    <SectionHeader
                      colors={colors}
                      title="Describe the meal"
                      subtitle="Type what’s in the meal and return the detected foods."
                    />
                    <TextInput
                      value={describeText}
                      onChangeText={setDescribeText}
                      placeholder="2 eggs, toast with butter, and orange juice"
                      placeholderTextColor={colors.placeholder}
                      multiline
                      style={{
                        minHeight: 110,
                        textAlignVertical: "top",
                        borderRadius: 16,
                        padding: 14,
                        color: colors.text,
                        fontWeight: "800",
                        backgroundColor: withAlpha(colors.bg, isDark ? 0.35 : 0.72),
                      }}
                    />
                    <Pressable
                      onPress={runDescribe}
                      disabled={!describeText.trim() || methodBusy}
                      style={primaryMethodButton(colors, !!describeText.trim() && !methodBusy)}
                    >
                      <Text style={primaryMethodText(colors)}>
                        {methodBusy ? "Analyzing..." : "Analyze"}
                      </Text>
                    </Pressable>
                    {describeResults.length ? (
                      <View style={{ gap: 8 }}>
                        {describeResults.map((food, idx) => (
                          <View
                            key={`${food.name}:${idx}`}
                            style={{
                              borderRadius: 16,
                              padding: 12,
                              backgroundColor: withAlpha(colors.bg, isDark ? 0.35 : 0.72),
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
                            >
                              {food.name}
                            </Text>
                            <Text
                              style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                            >
                              {Math.round(food.qty)} {food.unit} • {fmtMacroRow(food)}
                            </Text>
                          </View>
                        ))}
                        <Pressable
                          onPress={submitDescribeFoods}
                          style={primaryMethodButton(colors, true)}
                        >
                          <Text style={primaryMethodText(colors)}>
                            Add to current meal
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Panel>
                ) : null}

                {activeMethod === "barcode" ? (
                  <Panel colors={colors}>
                    <SectionHeader
                      colors={colors}
                      title="Barcode scan"
                      subtitle="Scan a packaged food or enter the code manually."
                    />

                    <View
                      style={{
                        borderRadius: 18,
                        overflow: "hidden",
                        backgroundColor: withAlpha(colors.bg, 0.5),
                        height: 210,
                      }}
                    >
                      {cameraPermission?.granted ? (
                        <CameraView
                          style={{ flex: 1 }}
                          facing="back"
                          onBarcodeScanned={({ data }) => onInlineBarcodeScanned(data)}
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
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 18,
                            gap: 10,
                          }}
                        >
                          <Text
                            style={{ color: colors.muted, fontWeight: "800", textAlign: "center" }}
                          >
                            Camera access is needed for live barcode scanning.
                          </Text>
                          <Pressable
                            onPress={ensureCameraAccess}
                            style={primaryMethodButton(colors, true)}
                          >
                            <Text style={primaryMethodText(colors)}>Enable camera</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <TextInput
                        value={barcodeInput}
                        onChangeText={setBarcodeInput}
                        placeholder="Enter barcode"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          color: colors.text,
                          fontWeight: "800",
                          borderRadius: 16,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: withAlpha(colors.bg, isDark ? 0.35 : 0.72),
                        }}
                      />
                      <Pressable
                        onPress={() => runBarcodeLookup()}
                        disabled={!barcodeInput.trim() || methodBusy}
                        style={primaryMethodButton(colors, !!barcodeInput.trim() && !methodBusy, {
                          width: 104,
                        })}
                      >
                        <Text style={primaryMethodText(colors)}>
                          {methodBusy ? "Looking..." : "Lookup"}
                        </Text>
                      </Pressable>
                    </View>

                    {barcodeCandidates.length ? (
                      <View style={{ gap: 8 }}>
                        {barcodeCandidates.map((candidate, idx) => (
                          <Pressable
                            key={`${candidate.name}:${candidate.brand || ""}:${idx}`}
                            onPress={() => {
                              appendFoods([candidate], null);
                              closeMethod();
                            }}
                            style={{
                              borderRadius: 16,
                              padding: 12,
                              backgroundColor: withAlpha(colors.bg, isDark ? 0.35 : 0.72),
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
                              numberOfLines={1}
                            >
                              {candidate.name}
                            </Text>
                            <Text
                              style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
                              numberOfLines={1}
                            >
                              {candidate.brand ? `${candidate.brand} • ` : ""}
                              {Math.round(candidate.qty)} {candidate.unit} •{" "}
                              {fmtMacroRow(candidate)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </Panel>
                ) : null}

                {activeMethod === "manual" ? (
                  <Panel colors={colors}>
                    <SectionHeader
                      colors={colors}
                      title="Manual entry"
                      subtitle="Enter the food and macros, then append it to the meal."
                    />

                    <TextInput
                      value={manualDraft.name}
                      onChangeText={(text) =>
                        setManualDraft((curr) => ({ ...curr, name: text }))
                      }
                      placeholder="Food name"
                      placeholderTextColor={colors.placeholder}
                      style={methodInput(colors)}
                    />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TextInput
                        value={manualDraft.qty}
                        onChangeText={(text) =>
                          setManualDraft((curr) => ({
                            ...curr,
                            qty: text.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        placeholder="Qty"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="decimal-pad"
                        style={[methodInput(colors), { flex: 1 }]}
                      />
                      <TextInput
                        value={manualDraft.unit}
                        onChangeText={(text) =>
                          setManualDraft((curr) => ({ ...curr, unit: text }))
                        }
                        placeholder="Unit"
                        placeholderTextColor={colors.placeholder}
                        style={[methodInput(colors), { flex: 1 }]}
                      />
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                        <TextInput
                          key={key}
                          value={manualDraft[key]}
                          onChangeText={(text) =>
                            setManualDraft((curr) => ({
                              ...curr,
                              [key]: text.replace(/[^0-9.]/g, ""),
                            }))
                          }
                          placeholder={key[0].toUpperCase() + key.slice(1)}
                          placeholderTextColor={colors.placeholder}
                          keyboardType="decimal-pad"
                          style={[methodInput(colors), { flex: 1, fontSize: 12 }]}
                        />
                      ))}
                    </View>

                    <Pressable
                      onPress={submitManualFood}
                      style={primaryMethodButton(colors, true)}
                    >
                      <Text style={primaryMethodText(colors)}>Add to current meal</Text>
                    </Pressable>
                  </Panel>
                ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </PremiumModalSheet>
      </KeyboardAvoidingView>
    </View>
  );
}

function Panel({
  colors,
  children,
}: {
  colors: any;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        padding: 12,
        backgroundColor: withAlpha(colors.card, 0.42),
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionHeader({
  colors,
  title,
  subtitle,
}: {
  colors: any;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
        {title}
      </Text>
      <Text
        style={{
          color: withAlpha(colors.text, 0.62),
          fontWeight: "800",
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function BucketPill({ colors, label }: { colors: any; label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: withAlpha(colors.primary, 0.14),
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

function topIconButton(colors: any) {
  return {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: withAlpha(colors.card, 0.4),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  };
}

function miniIconButton(colors: any) {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: withAlpha(colors.card, 0.42),
  };
}

function methodActionButton(colors: any, primary: boolean) {
  return {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    backgroundColor: primary
      ? withAlpha(colors.primary, 0.16)
      : withAlpha(colors.bg, 0.42),
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  };
}

function methodActionText(colors: any) {
  return {
    color: colors.text,
    fontWeight: "900" as const,
    fontSize: 13,
  };
}

function primaryMethodButton(
  colors: any,
  enabled: boolean,
  extra?: Record<string, any>
) {
  return {
    height: 48,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: enabled
      ? withAlpha(colors.primary, 0.96)
      : withAlpha(colors.border, 0.35),
    opacity: enabled ? 1 : 0.7,
    shadowColor: colors.primary,
    shadowOpacity: enabled ? 0.2 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    ...(extra || {}),
  };
}

function primaryMethodText(colors: any) {
  return {
    color: colors.text,
    fontWeight: "900" as const,
    fontSize: 14,
  };
}

function methodInput(colors: any) {
  return {
    color: colors.text,
    fontWeight: "800" as const,
    fontSize: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: withAlpha(colors.bg, 0.42),
  };
}

function labelForMealType(mealType: MealBuilderMealType) {
  return MEAL_TYPES.find((option) => option.key === mealType)?.label || "Meal";
}
