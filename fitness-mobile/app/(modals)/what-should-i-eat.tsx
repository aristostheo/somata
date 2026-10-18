import { Button, Choice, Heading, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";

type FilterKey = "all" | "high-protein" | "quick" | "low-carb" | "vegetarian";
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type Suggestion = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
};

const FILTERS: Array<{ key: FilterKey; label: string; }> = [
  { key: "all", label: "All" },
  { key: "high-protein", label: "High Protein" },
  { key: "quick", label: "Quick" },
  { key: "low-carb", label: "Low Carb" },
  { key: "vegetarian", label: "Vegetarian" },
];

const MEAL_DB: Suggestion[] = [
  { name: "Greek yogurt + berries", calories: 180, protein: 15, carbs: 20, fat: 3, tags: ["quick", "high-protein", "breakfast", "vegetarian"] },
  { name: "Chicken wrap", calories: 450, protein: 38, carbs: 42, fat: 12, tags: ["high-protein", "lunch"] },
  { name: "Cottage cheese + fruit", calories: 200, protein: 20, carbs: 18, fat: 4, tags: ["quick", "high-protein", "vegetarian"] },
  { name: "Eggs on toast", calories: 320, protein: 22, carbs: 28, fat: 14, tags: ["breakfast", "quick", "vegetarian"] },
  { name: "Tuna rice bowl", calories: 420, protein: 40, carbs: 45, fat: 6, tags: ["high-protein", "lunch", "dinner"] },
  { name: "Protein shake + banana", calories: 280, protein: 30, carbs: 32, fat: 4, tags: ["quick", "high-protein"] },
  { name: "Salmon + sweet potato", calories: 520, protein: 42, carbs: 38, fat: 16, tags: ["high-protein", "dinner"] },
  { name: "Oatmeal + protein powder", calories: 350, protein: 28, carbs: 42, fat: 6, tags: ["breakfast", "high-protein", "vegetarian"] },
  { name: "Turkey sandwich", calories: 380, protein: 32, carbs: 35, fat: 10, tags: ["lunch", "quick"] },
  { name: "Beef stir fry + rice", calories: 550, protein: 38, carbs: 52, fat: 14, tags: ["dinner", "high-protein"] },
  { name: "Protein bar", calories: 220, protein: 20, carbs: 24, fat: 8, tags: ["quick", "high-protein"] },
  { name: "Chicken breast + broccoli", calories: 380, protein: 48, carbs: 12, fat: 8, tags: ["high-protein", "dinner", "low-carb"] },
  { name: "Smoothie bowl", calories: 340, protein: 18, carbs: 48, fat: 6, tags: ["breakfast", "vegetarian"] },
  { name: "Lentil soup", calories: 280, protein: 16, carbs: 38, fat: 4, tags: ["vegetarian", "dinner", "lunch"] },
  { name: "Tofu stir fry", calories: 360, protein: 22, carbs: 32, fat: 14, tags: ["vegetarian", "dinner", "high-protein"] },
];

function parseNum(v: string | string[] | undefined) {
  return Math.max(0, Number(Array.isArray(v) ? v[0] : v || 0) || 0);
}

function timeBucket() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function mealLabel(meal: MealKey) {
  return meal === "snacks" ? "snack" : meal;
}

function generateSuggestions({
  remaining,
  meal,
  filter,
  preferences,
  seed,
}: {
  remaining: { calories: number; protein: number; carbs: number; fat: number; };
  meal: MealKey;
  filter: FilterKey;
  preferences?: Profile | null;
  seed: number;
}) {
  const restrictions = new Set(((preferences as any)?.dietPreferences?.restrictions || []) as string[]);
  const disliked = new Set((((preferences as any)?.dietPreferences?.dislikes || []) as string[]).map((item) => String(item).toLowerCase()));
  const desiredTag = meal === "snacks" ? null : meal.slice(0, -0) && meal;

  const matchesRestriction = (item: Suggestion) => {
    if (restrictions.has("vegetarian")) return item.tags.includes("vegetarian");
    if (restrictions.has("low_carb")) return item.tags.includes("low-carb");
    return true;
  };

  const filtered = MEAL_DB.filter((item) => {
    if (desiredTag && meal !== "snacks" && !item.tags.includes(meal)) return false;
    if (filter !== "all" && !item.tags.includes(filter)) return false;
    if (!matchesRestriction(item)) return false;
    if ([...disliked].some((term) => term && item.name.toLowerCase().includes(term))) return false;
    return true;
  });

  const pool = filtered.length ? filtered : MEAL_DB;
  return pool
    .map((item, index) => {
      const calorieGap = Math.abs(remaining.calories - item.calories);
      const proteinGap = Math.abs(remaining.protein - item.protein);
      const carbGap = Math.abs(remaining.carbs - item.carbs);
      const fatGap = Math.abs(remaining.fat - item.fat);
      const randomness = ((seed + index * 17) % 23) / 100;
      const score = proteinGap * 2 + calorieGap * 0.35 + carbGap * 0.2 + fatGap * 0.2 + randomness;
      return { ...item, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);
}

export default function WhatShouldIEatScreen() {
  const { D, F } = useSomataTheme();

  const { colors } = useTheme() as any;
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    meal?: MealKey;
    kcalLeft?: string;
    proteinLeft?: string;
    carbsLeft?: string;
    fatLeft?: string;
  }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  const meal = (params.meal as MealKey) || "lunch";
  const remaining = useMemo(
    () => ({
      calories: parseNum(params.kcalLeft),
      protein: parseNum(params.proteinLeft),
      carbs: parseNum(params.carbsLeft),
      fat: parseNum(params.fatLeft),
    }),
    [params.kcalLeft, params.proteinLeft, params.carbsLeft, params.fatLeft]
  );

  const suggestions = useMemo(
    () =>
      generateSuggestions({
        remaining,
        meal,
        filter,
        preferences: profile,
        seed,
      }),
    [remaining, meal, filter, profile, seed]
  );

  return (<TaskPage title="Find something that fits" section="Meal inspiration" onBack={() => router.back()}>

    <Panel accent>
      <Heading title={`Room for ${mealLabel(meal)}`} detail="Remaining targets for the selected day" />
      <Text style={{ ...F.value, color: D.lime }}>{remaining.calories} kcal</Text>
      <Text style={F.body}>Protein {remaining.protein} g · Carbs {remaining.carbs} g · Fat {remaining.fat} g</Text>
    </Panel>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {FILTERS.map(f => <Choice key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
    </View>

    <Heading title="Meal ideas" detail="Nutrition estimates from the meal library. Confirm your portion when logging." />
    {suggestions.slice(0, 6).map((item, i) => <Panel key={`${item.name}-${i}`}>
      <Text style={F.eyebrow}>{item.tags.join(' · ')}</Text>
      <Heading title={item.name} detail={`${item.calories} kcal · P ${item.protein} g · C ${item.carbs} g · F ${item.fat} g`} />
      <Text style={F.body}>{whyItFits(item, remaining)}</Text>
      <Button label="Find and log this meal" onPress={() => router.push({ pathname: '/(modals)/add-meal', params: { meal, date: String(params.date || ''), initialTab: 'search', query: item.name } })} />
    </Panel>)}
    <Button label="More ideas" onPress={() => setSeed(v => v + 1)} />
  </TaskPage>
  );
}

function whyItFits(
  item: Suggestion,
  remaining: { calories: number; protein: number; carbs: number; fat: number; }
) {
  if (remaining.protein >= 25 && item.protein >= 25) {
    return `Strong protein fit for the ${remaining.protein}g you still need.`;
  }
  if (remaining.calories <= 350 && item.calories <= 350) {
    return "Fits cleanly into the calories you have left today.";
  }
  if (remaining.carbs > remaining.fat && item.carbs >= item.fat) {
    return "Better match for the carbs you still have available.";
  }
  return "Balanced option that moves your remaining macros closer to target.";
}
