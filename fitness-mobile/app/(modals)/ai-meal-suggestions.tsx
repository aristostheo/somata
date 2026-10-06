// app/(modals)/ai-meal-suggestions.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";
import { useEntitlements } from "@/content/useEntitlements";
import { callOpenAIJson } from "@/services/openai";

// ---- Types ----
type MealIdea = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  meal?: "breakfast" | "lunch" | "dinner" | "snacks";
  prep_min?: number;
  difficulty?: "easy" | "moderate" | "advanced";
  notes?: string;
};
type MealIdeasResponse = { meals: MealIdea[]; rationale?: string };

export default function AiMealSuggestions() {
  const { colors, isDark } = useTheme() as any;
  const router = useRouter();
  const { isPro } = useEntitlements();
  const [showingLock, setShowingLock] = useState(false);

  const ensurePro = () => {
    if (isPro) return true;
    if (showingLock) return false;
    setShowingLock(true);
    Alert.alert(
      "Pro required",
      "AI meal ideas are part of Pro. Unlock to continue.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => setShowingLock(false),
        },
        {
          text: "See Pro",
          onPress: () => {
            setShowingLock(false);
            router.replace("/paywall");
          },
        },
      ],
    );
    return false;
  };

  // Expect these from the nutrition tab when navigating here.
  // If you can pass them, send JSON.stringified objects for goals & totals.
  const {
    date,
    meal,
    focus,
    goals: goalsStr,
    totals: totalsStr,
  } = useLocalSearchParams<{
    date?: string;
    meal?: string;
    focus?: string;
    goals?: string; // JSON string e.g. {"calories":2400,"protein":180,"carbs":260,"fat":70}
    totals?: string; // JSON string e.g. {"calories":1200,"protein":78,"carbs":105,"fat":55}
  }>();

  const goals = useMemo(() => {
    try {
      return goalsStr ? JSON.parse(goalsStr) : undefined;
    } catch {
      return undefined;
    }
  }, [goalsStr]);

  const totals = useMemo(() => {
    try {
      return totalsStr ? JSON.parse(totalsStr) : undefined;
    } catch {
      return undefined;
    }
  }, [totalsStr]);

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<MealIdea[]>([]);

  const headerGrad = useMemo<readonly [string, string]>(
    () => (isDark ? ["#3b82f6", "#60a5fa"] : ["#22c55e", "#16a34a"]),
    [isDark],
  );

  async function fetchIdeas(opts: { forceNew?: boolean }) {
    if (!ensurePro()) return;
    // sensible fallbacks if the screen was opened without params
    const safeGoals =
      goals && typeof goals === "object"
        ? goals
        : { calories: 2400, protein: 160, carbs: 240, fat: 70 };

    const safeTotals =
      totals && typeof totals === "object"
        ? totals
        : { calories: 0, protein: 0, carbs: 0, fat: 0 };

    try {
      setLoading(true);

      const data: MealIdeasResponse = await callOpenAIJson<MealIdeasResponse>(
        [
          {
            role: "system",
            content:
              "You generate Somata meal ideas. Return valid JSON only and keep suggestions practical.",
          },
          {
            role: "user",
            content: `Generate 5 meal ideas as JSON only.
Meal target: ${(meal as any) || "any"}
Goals: ${JSON.stringify(safeGoals)}
Totals so far: ${JSON.stringify(safeTotals)}
Notes: ${(notes || "").trim().slice(0, 200) || "none"}

Return:
{
  "meals": [
    {
      "name": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number | null,
      "fiber": number | null,
      "meal": "breakfast" | "lunch" | "dinner" | "snacks",
      "prep_min": number | null,
      "difficulty": "easy" | "moderate" | "advanced",
      "notes": string | null
    }
  ],
  "rationale": string
}`,
          },
        ],
        { maxTokens: 1400, temperature: 0.55 }
      );

      const meals = Array.isArray((data as any)?.meals)
        ? (data as any).meals
        : [];
      setIdeas(meals.slice(0, 5));
    } catch (e: any) {
      Alert.alert("AI error", e?.message ?? "Something went wrong");
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }

  function onGenerate() {
    fetchIdeas({ forceNew: true });
  }
  function onRegenerate() {
    fetchIdeas({ forceNew: true });
  }

  function addToMeal(option: MealIdea) {
    router.push({
      pathname: "/(modals)/add-meal",
      params: {
        date,
        meal,
        // Optional prefill keys if your /add-meal modal accepts them:
        name: option.name,
        calories: String(Math.round(option.calories)),
        protein: String(Math.round(option.protein)),
        carbs: String(Math.round(option.carbs)),
        fat: String(Math.round(option.fat)),
        sugar:
          option.sugar != null ? String(Math.round(option.sugar)) : undefined,
        fiber:
          option.fiber != null ? String(Math.round(option.fiber)) : undefined,
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header with back button */}
      <LinearGradient
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={headerGrad}
        style={{
          padding: 16,
          paddingTop: Platform.OS === "android" ? 24 : 12,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
            }}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
              AI meal ideas
            </Text>
            <Text style={{ color: "#ffffffcc", fontWeight: "600" }}>
              {meal ? `Targeting ${meal}` : "Target remaining macros only"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
      >
        {/* Notes box */}
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.03)"
              : "rgba(0,0,0,0.02)",
            padding: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>
            Notes (optional)
          </Text>
          <TextInput
            autoFocus={focus === "notes"}
            placeholder='e.g., "chicken, 30 mins", "microwave only", "Greek"'
            placeholderTextColor={colors.muted}
            multiline
            value={notes}
            onChangeText={setNotes}
            style={{
              color: colors.text,
              minHeight: 90,
              textAlignVertical: "top",
              fontSize: 14,
            }}
          />

          <Pressable
            onPress={onGenerate}
            disabled={loading}
            style={{
              borderRadius: 14,
              overflow: "hidden",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            <LinearGradient
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              colors={
                isDark
                  ? (["#a78bfa", "#8b5cf6"] as const)
                  : (["#22c55e", "#16a34a"] as const)
              }
              style={{
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={20} color="#fff" />
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "900",
                      letterSpacing: 0.3,
                    }}
                  >
                    Generate meal ideas
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Skeleton while loading */}
        {loading && (
          <View style={{ gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.03)",
                  padding: 12,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    height: 16,
                    backgroundColor: colors.border,
                    borderRadius: 6,
                    width: "60%",
                  }}
                />
                <View
                  style={{
                    height: 12,
                    backgroundColor: colors.border,
                    borderRadius: 6,
                    width: "80%",
                  }}
                />
                <View
                  style={{
                    height: 12,
                    backgroundColor: colors.border,
                    borderRadius: 6,
                    width: "40%",
                  }}
                />
                <View
                  style={{
                    height: 36,
                    backgroundColor: colors.border,
                    borderRadius: 8,
                    width: 160,
                  }}
                />
              </View>
            ))}
          </View>
        )}

        {/* Results */}
        {!loading && ideas.length > 0 && (
          <View style={{ gap: 12 }}>
            {ideas.map((it, idx) => (
              <View
                key={idx}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  padding: 12,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontWeight: "900",
                    color: colors.text,
                    fontSize: 16,
                  }}
                >
                  {it.name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {Math.round(it.calories)} kcal • P {Math.round(it.protein)}g •
                  C {Math.round(it.carbs)}g • F {Math.round(it.fat)}g
                  {it.sugar != null ? ` • Sug ${Math.round(it.sugar)}g` : ""}
                  {it.fiber != null ? ` • Fib ${Math.round(it.fiber)}g` : ""}
                  {it.prep_min != null
                    ? ` • ~${Math.round(it.prep_min)} min`
                    : ""}
                </Text>
                {!!it.notes && (
                  <Text style={{ color: colors.muted }}>{it.notes}</Text>
                )}

                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={() => addToMeal(it)}
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Add to {meal ?? "meal"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={onRegenerate}
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Regenerate
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && ideas.length === 0 && (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.02)"
                : "rgba(0,0,0,0.02)",
            }}
          >
            <Text style={{ color: colors.muted }}>
              No ideas yet. Add a note and tap{" "}
              <Text style={{ fontWeight: "800", color: colors.text }}>
                Generate meal ideas
              </Text>
              .
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
