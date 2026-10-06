import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, LayoutAnimation, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { FoodEntry } from "@/services/nutrition";
import { computeMealHealthScore } from "@/lib/mealHealthScore";

export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

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

const MEAL_META: Record<MealKey, { icon: any; label: string }> = {
  breakfast: { icon: "sunny-outline", label: "Breakfast" },
  lunch: { icon: "restaurant-outline", label: "Lunch" },
  dinner: { icon: "moon-outline", label: "Dinner" },
  snacks: { icon: "ice-cream-outline", label: "Snacks" },
};

export function MealCard({
  meal,
  items,
  totals,
  colors,
  isDark,
  onPressAdd,
  onPressItem,
  onDeleteItem,
  suggestions = [],
}: {
  meal: MealKey;
  items: FoodEntry[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  colors: any;
  isDark: boolean;
  onPressAdd: (suggestion?: string) => void;
  onPressItem: (it: FoodEntry) => void;
  onDeleteItem: (it: FoodEntry) => void;
  suggestions?: string[];
}) {
  const meta = MEAL_META[meal];
  const [scoreHintOpen, setScoreHintOpen] = useState(false);
  const hintTimeout = useRef<any>(null);
  const mealHealth = useMemo(
    () =>
      computeMealHealthScore({
        calories: Number(totals.calories || 0),
        proteinG: Number(totals.protein || 0),
        carbsG: Number(totals.carbs || 0),
        fatG: Number(totals.fat || 0),
      }),
    [totals.calories, totals.protein, totals.carbs, totals.fat]
  );
  const scoreColor =
    mealHealth.score > 75 ? colors.success : mealHealth.score >= 50 ? colors.warning : colors.danger;

  useEffect(() => () => hintTimeout.current && clearTimeout(hintTimeout.current), []);

  const subtitle = items.length
    ? `${items.length} items · ${Math.round(totals.calories)} kcal`
    : "0 items · 0 kcal";

  function showHint() {
    setScoreHintOpen(true);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    hintTimeout.current = setTimeout(() => setScoreHintOpen(false), 3000);
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={meta.icon} size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
              {meta.label}
            </Text>
            <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 12, fontWeight: "300", marginTop: 4 }}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {items.length > 0 ? (
            <Pressable
              onPress={showHint}
              style={{
                minHeight: 28,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(scoreColor, 0.5),
                backgroundColor: withAlpha(scoreColor, 0.1),
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ color: scoreColor, fontSize: 12, fontWeight: "500" }}>
                {mealHealth.score}
              </Text>
              <Ionicons name="information-circle-outline" size={13} color={scoreColor} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onPressAdd()}
            style={({ pressed }) => ({
              minHeight: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.84 : 1,
            })}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "500" }}>
              + Add
            </Text>
          </Pressable>
        </View>
      </View>

      {scoreHintOpen ? (
        <View
          style={{
            backgroundColor: colors.surface2,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300", lineHeight: 18 }}>
            {`Score ${mealHealth.score} · ${mealHealth.score < 50 ? "Low protein. Add 30g+ to raise it." : mealHealth.score < 75 ? "Decent balance. A little more protein would help." : "Balanced meal. Keep this pattern."}`}
          </Text>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {suggestions.slice(0, 2).map((s) => (
            <Pressable
              key={s}
              onPress={() => onPressAdd(s)}
              style={{
                minHeight: 36,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {items.slice(0, 12).map((it) => (
            <Swipeable
              key={it.id}
              overshootRight={false}
              renderRightActions={() => (
                <Pressable
                  onPress={() => onDeleteItem(it)}
                  style={{
                    width: 72,
                    borderRadius: 12,
                    backgroundColor: withAlpha(colors.danger, 0.12),
                    borderWidth: 1,
                    borderColor: withAlpha(colors.danger, 0.2),
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: 8,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => onPressItem(it)}
                style={({ pressed }) => ({
                  backgroundColor: colors.surface2,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: pressed ? 0.9 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.text, fontSize: 14, fontWeight: "400", lineHeight: 20 }}
                    numberOfLines={2}
                  >
                    {it.name}
                  </Text>
                  <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 12, fontWeight: "300", marginTop: 4 }}>
                    {`${Math.round(Number(it.qty || 1))} ${it.unit || "serving"} · ${Math.round(Number(it.calories || 0))} kcal`}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "400" }}>
                  P {Math.round(Number(it.protein || 0))}g
                </Text>
              </Pressable>
            </Swipeable>
          ))}
        </View>
      )}
    </View>
  );
}
