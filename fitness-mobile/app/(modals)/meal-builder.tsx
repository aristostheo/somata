import { NutritionContext, NutritionValues, NutritionFields, FoodSourceTile } from "@/components/nutrition/NutritionTaskUI";
import { appendScannedItems, createBuilderAdditionConsumer } from "@/services/mealBuilderHandoff";
import { accountUidKeyStorage, useAccountStorage } from "@/services/local/accountStore";
import { Button, Choice, Empty, Field, Heading, IconButton, Item, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Text,
  UIManager,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { searchCatalog, type FoodCatalogItem } from "@/services/foodCatalog";
import {
  applyQtyToMealItem,
  createMealBuilderItem,
  mealItemId,
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
import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";

type SearchRow = {
  key: string;
  sourceBucket: "recent" | "frequent" | "search";
  rank: number;
  item: RecentFood | (FoodCatalogItem & { id: string; });
};

const MEAL_TYPES: Array<{ key: MealBuilderMealType; label: string; icon: any; }> =
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
  { calories: number; protein: number; carbs: number; fat: number; }
> = {
  breakfast: { calories: 550, protein: 30, carbs: 50, fat: 18 },
  lunch: { calories: 700, protein: 40, carbs: 70, fat: 24 },
  dinner: { calories: 750, protein: 42, carbs: 72, fat: 26 },
  snacks: { calories: 320, protein: 16, carbs: 24, fat: 12 },
};

export default function MealBuilderScreen() {
  return <SomataTaskAppearance><MealBuilderScreenContent /></SomataTaskAppearance>;
}

function MealBuilderScreenContent() {
  const localStore = useAccountStorage();
  const { D, F } = useTaskPresentation();

  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meal?: string; date?: string; }>();

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const [mealType, setMealType] = useState<MealBuilderMealType>(
    (params.meal as MealBuilderMealType) || "lunch"
  );
  const [mealName, setMealName] = useState("");
  const [builderSessionId] = useState(mealItemId);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [handoffCanRetry, setHandoffCanRetry] = useState(false);
  const [handoffRetry, setHandoffRetry] = useState(0);
  const [consumeScan] = useState(() => createBuilderAdditionConsumer(accountUidKeyStorage(localStore), localStore, builderSessionId));
  const [items, setItems] = useState<MealBuilderFoodItem[]>([]);
  const [query, setQuery] = useState("");
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [searchResults, setSearchResults] = useState<
    Array<FoodCatalogItem & { id: string; }>
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

  useFocusEffect(useCallback(() => {
    let active = true;
    void consumeScan(dateISO, () => active, addition => {
      localStore.assertCurrent();
      const imported = addition.items.map(food => createMealBuilderItem(food));
      setItems(current => appendScannedItems(current, imported));
      setMealType(addition.meal);
    }).then(status => {
      if (!active) return;
      setHandoffCanRetry(false);
      if (status === 'added') setHandoffNotice('Scanned foods added. Review the meal before logging.');
      else if (['expired', 'stale', 'invalid'].includes(status)) setHandoffNotice('An old or invalid scan was cleared. Scan again from this meal to add foods.');
      else if (status === 'private') setHandoffNotice('This saved scan is unavailable for this account. Your meal has not changed.');
      else if (status === 'duplicate') setHandoffNotice('Scanned foods were already added; duplicate transfer cleared.');
    }).catch(() => {
      if (active) {
        setHandoffCanRetry(true);
        setHandoffNotice('The scan transfer could not finish. Retry safely; foods already added will not be added twice.');
      }
    });
    return () => { active = false; };
  }, [consumeScan, dateISO, handoffRetry, localStore]));

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
        setSearchResults(res as Array<FoodCatalogItem & { id: string; }>);
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
      raw: RecentFood | (FoodCatalogItem & { id: string; })
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
      requestCameraPermission().catch(() => { });
    }
  }, [activeMethod, cameraPermission?.granted, requestCameraPermission]);

  function appendFoods(raws: MealBuilderInputFood[], feedbackKey?: string | null) {
    if (!raws.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
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

  function addFood(raw: RecentFood | (FoodCatalogItem & { id: string; })) {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function moveItem(itemId: string, direction: "up" | "down") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync().catch(() => { });
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
          builderSessionId,
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
        () => { }
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
        () => { }
      );

      await writePendingMealBuilderLog({
        entryKind: "meal",
        date: dateISO,
        meal: mealType,
        name: mealName.trim() || `${labelForMealType(mealType)} meal`,
        items,
        source: "meal-builder",
      }, localStore);

      router.back();
    } catch {
      Alert.alert("Couldn’t log meal", "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (<><TaskPage title="Meal Builder" section="Meal workspace" subtitle={dateISO} onBack={() => router.back()} action={<IconButton icon="refresh-outline" label="Reset meal" onPress={resetMeal} />} footer={<Button primary label={busy ? 'Logging…' : 'Log meal'} disabled={busy || !items.length} onPress={onLogMeal} />}>

    <Panel accent><Heading title="Your meal workspace" detail="Build ingredients first. Review the complete meal before logging." />
    <Field label="Meal name · optional" value={mealName} onChangeText={setMealName} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {MEAL_TYPES.map(m => <Choice key={m.key} label={m.label} selected={mealType === m.key} onPress={() => setMealType(m.key)} />)}
    </View>

    </Panel>
    <Heading title="Add an ingredient" detail="Choose a source or search your foods." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['scan', 'describe', 'barcode', 'manual'] as const).map(m => <FoodSourceTile key={m} icon={m === 'scan' ? 'camera-outline' : m === 'describe' ? 'chatbubble-outline' : m === 'barcode' ? 'barcode-outline' : 'create-outline'} label={m === 'scan' ? 'Photo' : m === 'describe' ? 'Describe' : m === 'barcode' ? 'Barcode' : 'Manual'} onPress={() => openMethod(m)} />)}
    </View>

    <Panel>
    <Field label="Search foods" value={query} onChangeText={setQuery} placeholder="Find an ingredient" />
    {suggestedResults.map(row => <Item key={row.key} title={row.item.name} detail={`${fmtMacroRow(row.item)}${lastAddedKey === row.key ? ' · Added' : ''}`} onPress={() => addFood(row.item)} />)}

    {!suggestedResults.length && <Empty title="No matching foods" detail="Try another search or enter food manually." />}

    </Panel>
    <Heading title="Ingredients" detail="Adjust portions and arrange foods before logging." />
    {handoffNotice && <Panel><Text accessibilityLiveRegion="polite" style={F.body}>{handoffNotice}</Text><Button label={handoffCanRetry ? "Retry scan transfer" : "Dismiss"} onPress={() => handoffCanRetry ? setHandoffRetry(n => n + 1) : setHandoffNotice(null)} /></Panel>}
    {!items.length && <Empty title="Your meal starts here" detail="Add a food below or use a capture method above." />}

    {items.map((item, i) => <Panel key={item.id}>
      <Text style={F.eyebrow}>INGREDIENT {String(i + 1).padStart(2, "0")}</Text><Heading title={item.name} detail={fmtMacroRow(item)} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <IconButton icon="remove" label={`Reduce ${item.name}`} onPress={() => updateQty(item.id, Math.max(0, item.qty - quantityStep(item)))} />
        <View style={{ flex: 1, minWidth: 0 }}><Field label="Quantity" keyboardType="decimal-pad" value={String(item.qty)} onChangeText={text => updateQty(item.id, Number(text.replace(/[^0-9.]/g, '')) || 0)} /></View>
        <IconButton icon="add" label={`Increase ${item.name}`} onPress={() => updateQty(item.id, item.qty + quantityStep(item))} />
      </View>
      <Field label="Unit" value={item.unit} onChangeText={text => updateUnit(item.id, text)} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton icon="arrow-up" label="Move earlier" disabled={i === 0} onPress={() => moveItem(item.id, 'up')} />
        <IconButton icon="arrow-down" label="Move later" disabled={i === items.length - 1} onPress={() => moveItem(item.id, 'down')} />
        <IconButton icon="trash-outline" label={`Remove ${item.name}`} onPress={() => removeItem(item.id)} />
      </View>
    </Panel>)}

    <Panel accent>
      <Heading title="Final meal review" detail="Review all ingredients before logging this meal." />
      <NutritionValues values={[{ label: 'Energy', value: `${Math.round(totals.calories)} kcal` }, { label: 'Protein', value: `${Math.round(totals.protein)} g` }, { label: 'Carbs', value: `${Math.round(totals.carbs)} g` }, { label: 'Fat', value: `${Math.round(totals.fat)} g` }]} />
      <Text style={F.caption}>Meal guide: {macroTargets.calories} kcal · P {macroTargets.protein} g · C {macroTargets.carbs} g · F {macroTargets.fat} g. These are meal-builder guides, not your active daily targets.</Text>
    </Panel>

    <Panel><Heading title="Meal presets" detail="Save this combination or reuse one from your library." />
    <Button label={presetBusy ? 'Saving…' : presetJustSaved ? 'Preset saved' : 'Save as a meal preset'} disabled={presetBusy} onPress={onSavePreset} />
    <Button label={showPresets ? 'Hide meal presets' : 'Browse meal presets'} onPress={() => setShowPresets(v => !v)} />
    {(showPresets ? presets : presetPreview).map(p => <Item key={p.id} title={p.name} detail={`${p.items.length} foods`} onPress={() => applyPreset(p)} />)}

    </Panel>
  </TaskPage><TaskSheet title={activeMethod === 'scan' ? 'Capture food' : activeMethod === 'describe' ? 'Describe your meal' : activeMethod === 'barcode' ? 'Scan a barcode' : 'Manual food'} visible={!!activeMethod} onClose={closeMethod}>

      <NutritionContext label="Ingredient input" title={activeMethod === 'manual' ? 'From the food label' : activeMethod === 'barcode' ? 'Match the package' : activeMethod === 'scan' ? 'Capture, then check' : 'Describe, then check'} detail="Added foods return to your workspace. Log meal remains the final action." icon={activeMethod === 'barcode' ? 'barcode-outline' : 'restaurant-outline'} />
      {!!methodError && <Empty title="Could not add food" detail={methodError} />}
      {methodBusy && <Text accessibilityLiveRegion="polite" style={F.body}>Working…</Text>}

      {activeMethod === 'scan' && <><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button label="Take photo" disabled={methodBusy} onPress={() => pickScanPhoto('camera')} />
        <Button label="Choose photo" disabled={methodBusy} onPress={() => pickScanPhoto('library')} />
      </View>{scanResults.map((food, i) => <Item key={i} title={food.name} detail={`${food.qty} ${food.unit} · ${fmtMacroRow(food)}`} />)}{!!scanResults.length && <Button primary label="Add detected foods" onPress={() => { appendFoods(scanResults, null); closeMethod(); }} />}</>}

      {activeMethod === 'describe' && <><Field label="What did you eat?" multiline style={{ minHeight: 120, textAlignVertical: "top" }} value={describeText} onChangeText={setDescribeText} /><Button label="Calculate nutrition" disabled={methodBusy || !describeText.trim()} onPress={runDescribe} />{describeResults.map((food, i) => <Item key={i} title={food.name} detail={`${food.qty} ${food.unit} · ${fmtMacroRow(food)}`} />)}{!!describeResults.length && <Button primary label="Add foods" onPress={submitDescribeFoods} />}</>}

      {activeMethod === 'barcode' && <>{cameraPermission?.granted ? <CameraView style={{ height: 220, borderRadius: 18 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }} onBarcodeScanned={({ data }) => onInlineBarcodeScanned(data)} /> : <Button label="Enable camera" onPress={ensureCameraAccess} />}<Field label="Barcode" value={barcodeInput} onChangeText={setBarcodeInput} keyboardType="number-pad" /><Button label="Look up barcode" disabled={methodBusy || !barcodeInput.trim()} onPress={() => runBarcodeLookup()} />{barcodeCandidates.map((food, i) => <Item key={i} title={food.name} detail={fmtMacroRow(food)} onPress={() => { appendFoods([food], null); closeMethod(); }} />)}</>}

      {activeMethod === 'manual' && <><NutritionFields>{(['name', 'qty', 'unit', 'calories', 'protein', 'carbs', 'fat'] as const).map(k => <Field key={k} label={k} value={manualDraft[k]} keyboardType={k === 'name' || k === 'unit' ? 'default' : 'decimal-pad'} onChangeText={text => setManualDraft(v => ({ ...v, [k]: text }))} />)}</NutritionFields><Button primary label="Add food" onPress={submitManualFood} /></>}
    </TaskSheet></>
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
