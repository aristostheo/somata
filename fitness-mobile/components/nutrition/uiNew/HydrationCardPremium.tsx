import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ViewStyle, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumHydrationBottle } from "./PremiumHydrationBottle";
import { withAlpha } from "@/lib/color";

type Props = {
  colors: any;
  isDark: boolean;
  currentMl: number;
  goalMl: number;
  onAdd: (ml: number) => void;
  onClear: () => void;
  style?: ViewStyle | any;
  unit?: "ml" | "oz";
  streakDays?: number;
  showReminder?: boolean;
};

function mlToOz(ml: number) {
  return ml / 29.5735295625;
}

export function HydrationCardPremium({
  colors,
  isDark,
  currentMl,
  goalMl,
  onAdd,
  onClear,
  style,
  unit = "ml",
  showReminder = false,
}: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [logTick, setLogTick] = useState(0);
  const safeGoal = Math.max(0, goalMl || 0);
  const safeNow = Math.max(0, currentMl || 0);
  const pct = safeGoal > 0 ? Math.round((safeNow / safeGoal) * 100) : 0;
  const remaining = Math.max(0, safeGoal - safeNow);
  const displayNow = unit === "oz" ? mlToOz(safeNow) : safeNow;
  const displayGoal = unit === "oz" ? mlToOz(safeGoal) : safeGoal;
  const displayRemaining = unit === "oz" ? mlToOz(remaining) : remaining;

  const bottleColors = useMemo(
    () => ({
      glass: withAlpha("#ffffff", isDark ? 0.16 : 0.12),
      glassInner: withAlpha("#ffffff", isDark ? 0.09 : 0.07),
      highlight: withAlpha("#ffffff", isDark ? 0.18 : 0.16),
      waterTop: withAlpha("#06B6D4", isDark ? 0.52 : 0.46),
      waterMid: withAlpha("#06B6D4", isDark ? 0.44 : 0.38),
      waterBottom: withAlpha("#0891B2", isDark ? 0.52 : 0.44),
      glow: withAlpha("#06B6D4", isDark ? 0.18 : 0.14),
    }),
    [isDark]
  );

  function addAmount(ml: number) {
    setLogTick((t) => t + 1);
    onAdd(ml);
  }

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 20,
          paddingHorizontal: 20,
          paddingVertical: 18,
          gap: 16,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
            Hydration
          </Text>
          <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 12, fontWeight: "300", marginTop: 4 }}>
            {`${Math.round(displayNow).toLocaleString()} / ${Math.round(displayGoal).toLocaleString()} ${unit}`}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              height: 28,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", letterSpacing: 1 }}>
              ML
            </Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert("Clear hydration?", "Reset today’s water intake?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: onClear },
              ])
            }
            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.placeholder ?? colors.muted} />
          </Pressable>
        </View>
      </View>

      {showReminder ? (
        <View
          style={{
            minHeight: 36,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#F59E0B40",
            backgroundColor: "#F59E0B15",
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="notifications-outline" size={15} color="#F59E0B" />
          <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "300" }} numberOfLines={1}>
            No water logged yet · Start with 250ml
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
        <PremiumHydrationBottle
          width={120}
          height={180}
          currentMl={safeNow}
          goalMl={safeGoal}
          logTick={logTick}
          lastDeltaMl={250}
          colors={bottleColors}
        />

        <View style={{ flex: 1, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "200", letterSpacing: -0.8 }}>
            {`${Math.round(displayNow).toLocaleString()} / ${Math.round(displayGoal).toLocaleString()} ${unit}`}
          </Text>
          <Text style={{ color: colors.placeholder ?? colors.muted, fontSize: 12, fontWeight: "300" }}>
            {`${pct}% · ${Math.round(displayRemaining).toLocaleString()} ${unit} to goal`}
          </Text>

          <View style={{ height: 4, borderRadius: 100, backgroundColor: colors.inputBg, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 4, backgroundColor: "#06B6D4", borderRadius: 100 }} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[100, 250, 500].map((ml) => (
              <Pressable
                key={ml}
                onPress={() => addAmount(ml)}
                style={({ pressed }) => ({
                  height: 44,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: pressed ? colors.primary : colors.border,
                  backgroundColor: colors.surface2,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                })}
              >
                <Ionicons name="add-circle-outline" size={14} color={colors.placeholder ?? colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500" }}>
                  +{ml} ml
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowCustom((v) => !v)}
              style={({ pressed }) => ({
                height: 44,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="create-outline" size={14} color={colors.placeholder ?? colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500" }}>
                Custom
              </Text>
            </Pressable>
          </View>

          {showCustom ? (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.surface2,
                padding: 8,
              }}
            >
              <TextInput
                value={customValue}
                onChangeText={(t) => setCustomValue(t.replace(/[^\d]/g, ""))}
                placeholder="Enter ml"
                placeholderTextColor={colors.placeholder ?? colors.muted}
                keyboardType="number-pad"
                style={{ flex: 1, color: colors.text, paddingHorizontal: 8 }}
              />
              <Pressable
                onPress={() => {
                  const ml = Number(customValue || 0);
                  if (ml > 0) addAmount(ml);
                  setCustomValue("");
                  setShowCustom(false);
                }}
                style={{
                  height: 40,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "500" }}>
                  Add
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
