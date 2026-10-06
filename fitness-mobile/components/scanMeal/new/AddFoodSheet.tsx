import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import type { DetectedFood } from "@/components/scanMeal/new/types";
import { clamp, roundTo } from "@/components/scanMeal/new/types";
import PremiumModalSheet, {
  PremiumActionButton,
} from "@/components/ui/PremiumModalSheet";

export default function AddFoodSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (food: DetectedFood) => void;
}) {
  const { colors } = useTheme() as any;

  const [name, setName] = useState("");
  const [amt, setAmt] = useState("1");
  const [unknownQty, setUnknownQty] = useState(false);

  const canAdd = useMemo(() => {
    if (!name.trim()) return false;
    if (unknownQty) return true;
    const amount = Number(amt);
    return Number.isFinite(amount) && amount > 0;
  }, [name, amt, unknownQty]);

  const commit = () => {
    const amount = unknownQty ? 1 : clamp(roundTo(Number(amt), 0.1), 0.1, 5000);
    const newFood: DetectedFood = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      confidence: "manual",
      portion: { amount, unit: "piece", multiplier: 1 },
      macros: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      rationale: unknownQty ? "Added manually (qty unknown)" : "Added manually",
    };
    onAdd(newFood);
    setName("");
    setAmt("1");
    setUnknownQty(false);
  };

  return (
    <PremiumModalSheet
      visible={visible}
      onClose={onClose}
      title="Add item"
      subtitle="Manually add anything the scan missed."
      footer={
        <PremiumActionButton label="Add item" onPress={commit} disabled={!canAdd} />
      }
    >
      <FieldLabel label="Name" colors={colors} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="E.g., sweet potato"
        placeholderTextColor={colors.muted}
        style={inputStyle(colors)}
      />

      <FieldLabel label="Quantity" colors={colors} />
      <TextInput
        value={amt}
        onChangeText={setAmt}
        keyboardType="decimal-pad"
        editable={!unknownQty}
        style={[inputStyle(colors), { opacity: unknownQty ? 0.55 : 1 }]}
      />

      <Pressable
        onPress={() => setUnknownQty((v) => !v)}
        style={{
          borderRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: withAlpha(colors.card, 0.4),
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: unknownQty ? colors.primary : withAlpha(colors.text, 0.08),
          }}
        >
          {unknownQty ? (
            <Ionicons name="checkmark" size={14} color="white" />
          ) : null}
        </View>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
          Quantity unknown
        </Text>
      </Pressable>
    </PremiumModalSheet>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
      {label}
    </Text>
  );
}

function inputStyle(colors: any) {
  return {
    color: colors.text,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700" as const,
    backgroundColor: withAlpha(colors.bg, 0.42),
  };
}

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
