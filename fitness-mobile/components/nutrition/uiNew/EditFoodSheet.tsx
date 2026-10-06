import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import type { FoodEntry } from "@/services/nutrition";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type EditValues = {
  qty: string;
  unit: string;
  meal: MealKey;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  _baseQty: string;
  _baseCalories: string;
  _baseProtein: string;
  _baseCarbs: string;
  _baseFat: string;
};

const UNIT_OPTIONS = ["serving", "g", "oz", "ml"] as const;
const MEAL_OPTIONS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

function numOnly(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function toNum(value: string, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function scaleText(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function sourceLabel(item: FoodEntry | null) {
  if (!item?.source) return "Logged food";
  if (item.source === "manual") return "Manual entry";
  if (item.source === "catalog") return "Food database";
  if (item.source === "recent") return "Recent food";
  return String(item.source);
}

function mealLabel(meal: MealKey) {
  if (meal === "snacks") return "Snack";
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

function mealForTime(): MealKey {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snacks";
}

export default function EditFoodSheet({
  open,
  item,
  onSave,
  onClose,
  onDelete,
  saving,
  deleting,
}: {
  open: boolean;
  item: FoodEntry | null;
  onSave: (patch: Partial<FoodEntry>) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  const { colors } = useTheme() as any;
  const [values, setValues] = useState<EditValues>({
    qty: "1",
    unit: "serving",
    meal: mealForTime(),
    calories: "0",
    protein: "0",
    carbs: "0",
    fat: "0",
    _baseQty: "1",
    _baseCalories: "0",
    _baseProtein: "0",
    _baseCarbs: "0",
    _baseFat: "0",
  });
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    const qty = String(item.qty ?? 1);
    setValues({
      qty,
      unit: String(item.unit || "serving"),
      meal: (item.meal as MealKey) || mealForTime(),
      calories: String(item.calories ?? 0),
      protein: String(item.protein ?? 0),
      carbs: String(item.carbs ?? 0),
      fat: String(item.fat ?? 0),
      _baseQty: qty,
      _baseCalories: String(item.calories ?? 0),
      _baseProtein: String(item.protein ?? 0),
      _baseCarbs: String(item.carbs ?? 0),
      _baseFat: String(item.fat ?? 0),
    });
  }, [open, item]);

  useEffect(() => {
    return () => {
      if (holdRef.current) clearInterval(holdRef.current);
    };
  }, []);

  const preview = useMemo(
    () => [
      { label: "Calories", value: `${Math.round(toNum(values.calories))}` },
      { label: "Protein", value: `${Math.round(toNum(values.protein))}g` },
      { label: "Carbs", value: `${Math.round(toNum(values.carbs))}g` },
      { label: "Fat", value: `${Math.round(toNum(values.fat))}g` },
    ],
    [values.calories, values.carbs, values.fat, values.protein],
  );

  if (!item) return null;

  function stopHold() {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }

  function applyQty(nextRaw: string) {
    setValues((prev) => {
      const clean = numOnly(nextRaw);
      const nextQty = toNum(clean, 0);
      const baseQty = toNum(prev._baseQty, 1);
      if (nextQty <= 0 || baseQty <= 0) {
        return { ...prev, qty: clean };
      }
      const ratio = nextQty / baseQty;
      return {
        ...prev,
        qty: clean,
        calories: scaleText(toNum(prev._baseCalories) * ratio),
        protein: scaleText(toNum(prev._baseProtein) * ratio),
        carbs: scaleText(toNum(prev._baseCarbs) * ratio),
        fat: scaleText(toNum(prev._baseFat) * ratio),
      };
    });
  }

  function nudgeQty(delta: number) {
    const current = toNum(values.qty || "0", 0);
    const next = Math.max(0.1, Math.round((current + delta) * 10) / 10);
    applyQty(String(next));
  }

  function startHold(delta: number) {
    stopHold();
    holdRef.current = setInterval(() => nudgeQty(delta), 120);
  }

  function submit() {
    Keyboard.dismiss();
    onSave({
      qty: Math.max(0.1, toNum(values.qty, 1)),
      unit: values.unit.trim() || "serving",
      meal: values.meal,
      calories: Math.max(0, toNum(values.calories, 0)),
      protein: Math.max(0, toNum(values.protein, 0)),
      carbs: Math.max(0, toNum(values.carbs, 0)),
      fat: Math.max(0, toNum(values.fat, 0)),
    });
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end" }}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface2,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: 8,
            maxHeight: "84%",
            ...(Platform.OS === "ios"
              ? { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } }
              : {}),
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 8 }}>
            <View
              style={{
                width: 32,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.surface,
              }}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: colors.text, fontSize: 20, fontWeight: "500", lineHeight: 26 }}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text style={{ color: colors.placeholder, fontSize: 12, fontWeight: "300", marginTop: 4 }}>
                  {sourceLabel(item)}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={16} color={colors.placeholder} />
              </Pressable>
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.placeholder,
                  fontSize: 11,
                  fontWeight: "500",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Serving Size
              </Text>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.text, fontSize: 36, fontWeight: "200" }}>
                  {scaleText(toNum(values.qty, 1))}{" "}
                  <Text style={{ color: colors.placeholder, fontSize: 12, fontWeight: "300" }}>
                    {values.unit}
                  </Text>
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
                {[-0.5, 0.5].map((delta) => {
                  const icon = delta < 0 ? "remove" : "add";
                  return (
                    <Pressable
                      key={icon}
                      onPress={() => nudgeQty(delta)}
                      onLongPress={() => startHold(delta)}
                      onPressOut={stopHold}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={icon as any} size={18} color={colors.muted} />
                    </Pressable>
                  );
                })}
                <TextInput
                  value={values.qty}
                  onChangeText={applyQty}
                  keyboardType="decimal-pad"
                  style={{
                    width: 80,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.glass,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    textAlign: "center",
                    fontSize: 24,
                    fontWeight: "200",
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {UNIT_OPTIONS.map((option) => {
                const active = option === values.unit;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setValues((prev) => ({ ...prev, unit: option }))}
                    style={{
                      minHeight: 32,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: active ? colors.chipActiveBg : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.muted,
                        fontSize: 12,
                        fontWeight: "300",
                      }}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {preview.map((metric, index) => (
                <React.Fragment key={metric.label}>
                  {index > 0 ? (
                    <View style={{ width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: 12 }} />
                  ) : null}
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                      {metric.value}
                    </Text>
                    <Text style={{ color: colors.placeholder, fontSize: 11, fontWeight: "300", marginTop: 4 }}>
                      {metric.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.placeholder,
                  fontSize: 11,
                  fontWeight: "500",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Add To
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MEAL_OPTIONS.map((meal) => {
                  const active = values.meal === meal;
                  return (
                    <Pressable
                      key={meal}
                      onPress={() => setValues((prev) => ({ ...prev, meal }))}
                      style={{
                        minHeight: 34,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: active ? "#FFFFFF" : colors.muted, fontSize: 12, fontWeight: active ? "500" : "300" }}>
                        {mealLabel(meal)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Pressable
                onPress={submit}
                disabled={!!saving || !!deleting}
                style={{
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: saving || deleting ? 0.72 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>
                    Save changes
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => item.id && onDelete?.(item.id)}
                disabled={!onDelete || !!saving || !!deleting}
                style={{
                  height: 44,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: onDelete && !saving && !deleting ? 1 : 0.56,
                }}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "400" }}>
                    Remove from log
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
