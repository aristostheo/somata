// components/scanMeal/MacroSummaryCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/content/ThemeProvider";
import type { MacroTotals } from "@/components/scanMeal/new/types";

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(0,0,0,0.05)",
        },
      ]}
    >
      <Text style={[styles.statVal, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLab, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export default function MacroSummaryCard({ totals }: { totals: MacroTotals }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.02)" }]}>
      <LinearGradient
        colors={[
          "rgba(56,189,248,0.14)",
          "rgba(14,165,233,0.08)",
          "rgba(255,255,255,0.02)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.head}>
        <Ionicons name="bar-chart-outline" size={18} color={colors.muted} />
        <Text style={[styles.title, { color: colors.text }]}>
          Estimated macros
        </Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          Based on your edits
        </Text>
      </View>

      <View style={styles.row}>
        <Stat label="Calories" value={`${Math.round(totals.calories)}`} />
        <Stat label="Protein" value={`${totals.protein.toFixed(0)}g`} />
        <Stat label="Carbs" value={`${totals.carbs.toFixed(0)}g`} />
        <Stat label="Fat" value={`${totals.fat.toFixed(0)}g`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 12,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  title: { fontSize: 14, fontWeight: "900" },
  note: { marginLeft: "auto", fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  statVal: { fontSize: 16, fontWeight: "900" },
  statLab: { marginTop: 3, fontSize: 12, fontWeight: "700" },
});
