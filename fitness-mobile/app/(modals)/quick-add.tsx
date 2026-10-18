import { useAccountStorage } from "@/services/local/accountStore";
import { Alert } from "react-native";
import { queueNutritionHandoff } from "@/services/queueNutritionHandoff";
import { Button, Choice, Empty, Field, Heading, Item, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { dayKey } from "@/utils/date";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { searchCatalog, type FoodCatalogItem } from "@/services/foodCatalog";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";
import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";

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
  source: "catalog" | "manual" | "recent" | "popular";
};

type SearchRow = {
  key: string;
  sourceBucket: "recent" | "frequent" | "search";
  item: RecentFood | (FoodCatalogItem & { id: string; });
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

function foodKey(name: string, unit: string) {
  return `${String(name || "")
    .trim()
    .toLowerCase()}|${String(unit || "serving")
      .trim()
      .toLowerCase()}`;
}

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mealLabel(meal: MealKey) {
  return (
    {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snacks: "Snack",
    }[meal] || "Meal"
  );
}

export default function QuickAddModal() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    returnTo?: string;
    builderSessionId?: string;
  }>();
  const inputRef = useRef<TextInput | null>(null);

  const [meal, setMeal] = useState<MealKey>(
    (params.meal as MealKey) || "snacks",
  );
  const date = (params.date as string) || dayKey(new Date());
  const returnTo = String(params.returnTo || "");
  const builderSessionId = String(params.builderSessionId || "");

  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentFood[]>([]);
  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [results, setResults] = useState<
    Array<FoodCatalogItem & { id: string; }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [macroOpen, setMacroOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    fetchMyRecentFoods(user.uid, 20)
      .then(setRecents)
      .catch(() => setRecents([]));
    fetchMyTopFoods(user.uid, 12)
      .then(setTopFoods)
      .catch(() => setTopFoods([]));
  }, [user?.uid]);

  useEffect(() => {
    if (!lastAddedKey) return;
    const timer = setTimeout(() => setLastAddedKey(null), 1200);
    return () => clearTimeout(timer);
  }, [lastAddedKey]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchCatalog(query.trim(), 20);
        if (!live) return;
        setResults(found as Array<FoodCatalogItem & { id: string; }>);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 180);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const lastUsedMap = useMemo(() => {
    const map = new Map<string, RecentFood>();
    recents.forEach((food) => {
      map.set(foodKey(food.name, food.unit), food);
    });
    return map;
  }, [recents]);

  const mergedResults = useMemo(() => {
    const seen = new Set<string>();
    const out: SearchRow[] = [];
    const q = query.trim().toLowerCase();

    const push = (
      sourceBucket: SearchRow["sourceBucket"],
      raw: RecentFood | (FoodCatalogItem & { id: string; }),
    ) => {
      const name = String(raw.name || "").trim();
      if (!name) return;
      const key = foodKey(name, String(raw.unit || "serving"));
      if (seen.has(key)) return;
      if (q) {
        const hay = `${name.toLowerCase()} ${String(raw.unit || "").toLowerCase()}`;
        if (!hay.includes(q)) return;
      }
      seen.add(key);
      out.push({ key, sourceBucket, item: raw });
    };

    recents.forEach((item) => push("recent", item));
    topFoods.forEach((item) => push("frequent", item));
    results.forEach((item) => push("search", item));

    return out;
  }, [query, recents, results, topFoods]);

  const quickPicks = useMemo(() => {
    if (query.trim()) return mergedResults.slice(0, 14);
    return [
      ...recents.slice(0, 6).map((item) => ({
        key: foodKey(item.name, item.unit),
        sourceBucket: "recent" as const,
        item,
      })),
      ...topFoods
        .filter((item) => !lastUsedMap.has(foodKey(item.name, item.unit)))
        .slice(0, 6)
        .map((item) => ({
          key: foodKey(item.name, item.unit),
          sourceBucket: "frequent" as const,
          item,
        })),
    ];
  }, [mergedResults, query, recents, topFoods, lastUsedMap]);

  async function done(payload: AddPayload) {
    const targetKey =
      returnTo === "meal-builder"
        ? PENDING_MEAL_BUILDER_ADDITIONS_KEY
        : "@pending_add_meal";

    const targetPayload =
      returnTo === "meal-builder" ? { date, meal, items: [payload], builderSessionId } : payload;

    try {
      await queueNutritionHandoff(targetKey, targetPayload, localStore);
      localStore.assertCurrent();
      router.back();
    } catch (error: any) { Alert.alert("Meal not saved", error.message); }
  }

  function resolveDefault(
    raw: RecentFood | (FoodCatalogItem & { id: string; }),
  ) {
    const recent = lastUsedMap.get(foodKey(raw.name, raw.unit));
    return {
      qty: Number(recent?.qty ?? raw.qty ?? 1) || 1,
      unit: String(recent?.unit || raw.unit || "serving"),
      calories: Number(recent?.calories ?? raw.calories ?? 0),
      protein: Number(recent?.protein ?? raw.protein ?? 0),
      carbs: Number(recent?.carbs ?? raw.carbs ?? 0),
      fat: Number(recent?.fat ?? raw.fat ?? 0),
      sugar:
        recent?.sugar != null
          ? Number(recent.sugar)
          : raw.sugar != null
            ? Number(raw.sugar)
            : undefined,
      fiber:
        recent?.fiber != null
          ? Number(recent.fiber)
          : raw.fiber != null
            ? Number(raw.fiber)
            : undefined,
      addedSugar:
        recent?.addedSugar != null
          ? Number(recent.addedSugar)
          : raw.addedSugar != null
            ? Number(raw.addedSugar)
            : undefined,
      satFat:
        recent?.satFat != null
          ? Number(recent.satFat)
          : raw.satFat != null
            ? Number(raw.satFat)
            : undefined,
      sodium:
        recent?.sodium != null
          ? Number(recent.sodium)
          : raw.sodium != null
            ? Number(raw.sodium)
            : undefined,
      wholeFoodRatio:
        recent?.wholeFoodRatio != null
          ? Number(recent.wholeFoodRatio)
          : raw.wholeFoodRatio != null
            ? Number(raw.wholeFoodRatio)
            : undefined,
      veggieFruitServings:
        recent?.veggieFruitServings != null
          ? Number(recent.veggieFruitServings)
          : raw.veggieFruitServings != null
            ? Number(raw.veggieFruitServings)
            : undefined,
      unsatFatRatio:
        recent?.unsatFatRatio != null
          ? Number(recent.unsatFatRatio)
          : raw.unsatFatRatio != null
            ? Number(raw.unsatFatRatio)
            : undefined,
      alcoholCalories:
        recent?.alcoholCalories != null
          ? Number(recent.alcoholCalories)
          : raw.alcoholCalories != null
            ? Number(raw.alcoholCalories)
            : undefined,
    };
  }

  async function instantAdd(
    raw: RecentFood | (FoodCatalogItem & { id: string; }),
    source: AddPayload["source"],
  ) {
    const resolved = resolveDefault(raw);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => { },
    );
    setLastAddedKey(foodKey(raw.name, raw.unit));
    await done({
      date,
      meal,
      name: String(raw.name || "").trim(),
      qty: resolved.qty,
      unit: resolved.unit,
      calories: resolved.calories,
      protein: resolved.protein,
      carbs: resolved.carbs,
      fat: resolved.fat,
      sugar: resolved.sugar,
      fiber: resolved.fiber,
      addedSugar: resolved.addedSugar,
      satFat: resolved.satFat,
      sodium: resolved.sodium,
      wholeFoodRatio: resolved.wholeFoodRatio,
      veggieFruitServings: resolved.veggieFruitServings,
      unsatFatRatio: resolved.unsatFatRatio,
      alcoholCalories: resolved.alcoholCalories,
      source,
    });
  }

  async function submitQuickMacros() {
    if (
      !quickDraft.name.trim() &&
      !quickDraft.calories &&
      !quickDraft.protein &&
      !quickDraft.carbs &&
      !quickDraft.fat
    ) {
      return;
    }

    await done({
      date,
      meal,
      name: quickDraft.name.trim() || "Quick add",
      qty: 1,
      unit: "serving",
      calories: Math.max(0, toNum(quickDraft.calories)),
      protein: Math.max(0, toNum(quickDraft.protein)),
      carbs: Math.max(0, toNum(quickDraft.carbs)),
      fat: Math.max(0, toNum(quickDraft.fat)),
      source: "manual",
    });
  }

  return (<><TaskPage title="Food, without the fuss" section="Quick add" subtitle={date} onBack={() => router.back()}>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealKey[]).map(m => <Choice key={m} label={mealLabel(m)} selected={meal === m} onPress={() => setMeal(m)} />)}
    </View>

    <Field ref={inputRef} label="Find a food" value={query} onChangeText={setQuery} placeholder="Search your foods and the database" />

    <Button label="Enter calories and macros" icon="add" onPress={() => setMacroOpen(true)} />

    {searching && <Text accessibilityLiveRegion="polite" style={F.caption}>Searching…</Text>}

    <Heading title={query ? 'Matching foods' : 'Your quick picks'} detail="Tap a food to add the last-used portion." />
    {quickPicks.map(row => { const v = resolveDefault(row.item); return <Item key={row.key} title={row.item.name} detail={`${v.qty} ${v.unit} · ${Math.round(v.calories)} kcal · ${row.sourceBucket}${lastAddedKey === row.key ? ' · Added' : ''}`} onPress={() => instantAdd(row.item, row.sourceBucket === 'recent' ? 'recent' : row.sourceBucket === 'frequent' ? 'popular' : 'catalog')} />; })}

    {!quickPicks.length && !searching && <Empty title="No foods here yet" detail="Search for a food or enter its nutrition directly." />}

  </TaskPage><TaskSheet title="Quick nutrition entry" visible={macroOpen} onClose={() => setMacroOpen(false)}>
      <Field label="Food name" value={quickDraft.name} onChangeText={name => setQuickDraft(v => ({ ...v, name }))} />
      {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => <Field key={k} label={`${k} · ${k === 'calories' ? 'kcal' : 'g'}`} keyboardType="decimal-pad" value={quickDraft[k]} onChangeText={text => setQuickDraft(v => ({ ...v, [k]: text }))} />)}
      <Button primary label="Add to meal" onPress={submitQuickMacros} />
    </TaskSheet></>
  );
}

function macroInput(colors: any) {
  return {
    color: colors.text,
    fontWeight: "800" as const,
    fontSize: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: withAlpha(colors.bg, 0.52),
  };
}
