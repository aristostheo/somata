import { dayKey } from "@/utils/date";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import {
  fetchMyRecentFoods,
  fetchMyTopFoods,
  type RecentFood,
} from "@/services/nutritionRecents";
import { searchCatalog, type FoodCatalogItem } from "@/services/foodCatalog";
import { PENDING_MEAL_BUILDER_ADDITIONS_KEY } from "@/services/mealBuilder";
import PremiumModalSheet, {
  PremiumActionButton,
} from "@/components/ui/PremiumModalSheet";

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
  item: RecentFood | (FoodCatalogItem & { id: string });
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
  const { colors, isDark } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    returnTo?: string;
  }>();
  const inputRef = useRef<TextInput | null>(null);

  const [meal, setMeal] = useState<MealKey>(
    (params.meal as MealKey) || "snacks",
  );
  const date = (params.date as string) || dayKey(new Date());
  const returnTo = String(params.returnTo || "");

  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentFood[]>([]);
  const [topFoods, setTopFoods] = useState<RecentFood[]>([]);
  const [results, setResults] = useState<
    Array<FoodCatalogItem & { id: string }>
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
        setResults(found as Array<FoodCatalogItem & { id: string }>);
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
      raw: RecentFood | (FoodCatalogItem & { id: string }),
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
      returnTo === "meal-builder" ? { date, meal, items: [payload] } : payload;

    await AsyncStorage.setItem(targetKey, JSON.stringify(targetPayload)).catch(
      () => {},
    );
    router.back();
  }

  function resolveDefault(
    raw: RecentFood | (FoodCatalogItem & { id: string }),
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
    raw: RecentFood | (FoodCatalogItem & { id: string }),
    source: AddPayload["source"],
  ) {
    const resolved = resolveDefault(raw);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: Math.max(insets.top, 18) + 4,
            paddingBottom: Math.max(insets.bottom, 18) + 20,
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: 3 }}>
              <Text
                style={{ color: colors.muted, fontWeight: "900", fontSize: 11 }}
              >
                Lightweight logging
              </Text>
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}
              >
                Quick Add
              </Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(colors.card, 0.5),
              }}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              borderRadius: 22,
              padding: 14,
              backgroundColor: withAlpha(colors.card, isDark ? 0.58 : 0.92),
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  Single item or quick macros
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  For full meals, use Meal Builder.
                </Text>
              </View>

              <Pressable
                onPress={() => setMacroOpen(true)}
                style={{
                  height: 36,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: withAlpha(colors.primary, 0.16),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="flash-outline" size={15} color={colors.text} />
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  Macros
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {(
                [
                  ["breakfast", "Breakfast"],
                  ["lunch", "Lunch"],
                  ["dinner", "Dinner"],
                  ["snacks", "Snack"],
                ] as Array<[MealKey, string]>
              ).map(([key, label]) => {
                const active = meal === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMeal(key)}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active
                        ? withAlpha(colors.primary, 0.18)
                        : withAlpha(colors.bg, 0.48),
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 11,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: withAlpha(colors.bg, isDark ? 0.38 : 0.82),
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${mealLabel(meal).toLowerCase()} food`}
                placeholderTextColor={colors.placeholder}
                autoFocus
                returnKeyType="search"
                style={{ flex: 1, color: colors.text, fontWeight: "800" }}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {recents.length ? (
            <View style={{ gap: 8 }}>
              <RowHeader
                colors={colors}
                title="Recent"
                subtitle="Last used quantities are kept."
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {recents.slice(0, 8).map((item) => (
                  <FoodChip
                    key={`recent:${foodKey(item.name, item.unit)}`}
                    item={item}
                    colors={colors}
                    active={lastAddedKey === foodKey(item.name, item.unit)}
                    onPress={() => instantAdd(item, "recent")}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {topFoods.length ? (
            <View style={{ gap: 8 }}>
              <RowHeader
                colors={colors}
                title="Frequent"
                subtitle="Fastest way to log your usual items."
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {topFoods.slice(0, 8).map((item) => (
                  <FoodChip
                    key={`top:${foodKey(item.name, item.unit)}`}
                    item={item}
                    colors={colors}
                    active={lastAddedKey === foodKey(item.name, item.unit)}
                    onPress={() => instantAdd(item, "popular")}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <RowHeader
              colors={colors}
              title={query.trim() ? "Search results" : "Quick picks"}
              subtitle={
                query.trim()
                  ? searching
                    ? "Searching..."
                    : "Tap once to log"
                  : "One tap adds with smart defaults"
              }
            />

            {quickPicks.length ? (
              quickPicks.map((row) => {
                const recent = lastUsedMap.get(
                  foodKey(row.item.name, row.item.unit),
                );
                const active =
                  lastAddedKey === foodKey(row.item.name, row.item.unit);
                return (
                  <Pressable
                    key={`${row.sourceBucket}:${row.key}`}
                    onPress={() =>
                      instantAdd(
                        row.item,
                        row.sourceBucket === "search"
                          ? "catalog"
                          : row.sourceBucket === "frequent"
                            ? "popular"
                            : "recent",
                      )
                    }
                    style={{
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: withAlpha(colors.card, 0.48),
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
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
                        <Bucket
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
                        {Math.round(Number(row.item.calories || 0))} kcal • P{" "}
                        {Math.round(Number(row.item.protein || 0))} • C{" "}
                        {Math.round(Number(row.item.carbs || 0))} • F{" "}
                        {Math.round(Number(row.item.fat || 0))}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          fontSize: 10,
                        }}
                        numberOfLines={1}
                      >
                        Default:{" "}
                        {Math.round(Number(recent?.qty ?? row.item.qty ?? 1))}{" "}
                        {recent?.unit || row.item.unit || "serving"}
                      </Text>
                    </View>

                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active
                          ? withAlpha("#22c55e", 0.95)
                          : withAlpha(colors.primary, 0.18),
                      }}
                    >
                      <Ionicons
                        name={active ? "checkmark" : "add"}
                        size={18}
                        color={colors.text}
                      />
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View
                style={{
                  borderRadius: 18,
                  padding: 16,
                  backgroundColor: withAlpha(colors.card, 0.44),
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "800" }}>
                  {query.trim()
                    ? "No foods matched that search."
                    : "Your recent foods will show here once you start logging."}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <PremiumModalSheet
          visible={macroOpen}
          onClose={() => setMacroOpen(false)}
          title="Quick macros"
          subtitle="Log a fast single entry with no search needed."
          footer={
            <PremiumActionButton
              label={`Log to ${mealLabel(meal)}`}
              onPress={submitQuickMacros}
            />
          }
        >
          <TextInput
            value={quickDraft.name}
            onChangeText={(text) =>
              setQuickDraft((curr) => ({ ...curr, name: text }))
            }
            placeholder="Name, optional"
            placeholderTextColor={colors.placeholder}
            style={macroInput(colors)}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["calories", "protein"] as const).map((key) => (
              <TextInput
                key={key}
                value={quickDraft[key]}
                onChangeText={(text) =>
                  setQuickDraft((curr) => ({
                    ...curr,
                    [key]: text.replace(/[^0-9.]/g, ""),
                  }))
                }
                placeholder={key[0].toUpperCase() + key.slice(1)}
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[macroInput(colors), { flex: 1 }]}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["carbs", "fat"] as const).map((key) => (
              <TextInput
                key={key}
                value={quickDraft[key]}
                onChangeText={(text) =>
                  setQuickDraft((curr) => ({
                    ...curr,
                    [key]: text.replace(/[^0-9.]/g, ""),
                  }))
                }
                placeholder={key[0].toUpperCase() + key.slice(1)}
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[macroInput(colors), { flex: 1 }]}
              />
            ))}
          </View>
        </PremiumModalSheet>
      </KeyboardAvoidingView>
    </View>
  );
}

function RowHeader({
  colors,
  title,
  subtitle,
}: {
  colors: any;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function FoodChip({
  item,
  colors,
  active,
  onPress,
}: {
  item: RecentFood;
  colors: any;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 168,
        borderRadius: 18,
        padding: 12,
        backgroundColor: withAlpha(colors.card, 0.48),
        gap: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: 13,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active
              ? withAlpha("#22c55e", 0.95)
              : withAlpha(colors.primary, 0.18),
          }}
        >
          <Ionicons
            name={active ? "checkmark" : "add"}
            size={15}
            color={colors.text}
          />
        </View>
      </View>
      <Text
        style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
        numberOfLines={1}
      >
        {Math.round(Number(item.qty || 1))} {item.unit}
      </Text>
      <Text
        style={{ color: colors.muted, fontWeight: "800", fontSize: 11 }}
        numberOfLines={1}
      >
        {Math.round(Number(item.calories || 0))} kcal
      </Text>
    </Pressable>
  );
}

function Bucket({ colors, label }: { colors: any; label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: withAlpha(colors.primary, 0.12),
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 10 }}>
        {label}
      </Text>
    </View>
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
