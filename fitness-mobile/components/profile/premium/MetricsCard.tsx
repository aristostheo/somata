// components/profile/premium/MetricsCard.tsx
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/content/ThemeProvider";
import { GlassCard } from "./GlassCard";

function bmiDescriptor(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MetricsCard(props: {
  unit: "kg" | "lb";
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  bodyFatPct?: number;
  lastUpdatedVia?: string;
  lastUpdatedAt?: number;
  onPressAdd: () => void;
}) {
  const { colors } = useTheme();

  const bmi = useMemo(() => {
    if (!props.weightKg || !props.heightCm) return null;
    const h = props.heightCm / 100;
    return Math.round((props.weightKg / (h * h)) * 10) / 10;
  }, [props.weightKg, props.heightCm]);

  const weightLabel = useMemo(() => {
    if (!props.weightKg) return "—";
    return props.unit === "kg"
      ? `${Math.round(props.weightKg * 10) / 10} kg`
      : `${Math.round(props.weightKg * 2.20462)} lb`;
  }, [props.unit, props.weightKg]);

  const targetLabel = useMemo(() => {
    if (!props.targetWeightKg) return "—";
    return props.unit === "kg"
      ? `${Math.round(props.targetWeightKg * 10) / 10} kg`
      : `${Math.round(props.targetWeightKg * 2.20462)} lb`;
  }, [props.unit, props.targetWeightKg]);

  const heightLabel = useMemo(() => {
    if (!props.heightCm) return "—";
    if (props.unit === "lb") {
      const totalIn = Math.round(props.heightCm * 0.393701);
      return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
    }
    return `${Math.round(props.heightCm)} cm`;
  }, [props.unit, props.heightCm]);

  const bodyFatLabel = useMemo(() => {
    const v = props.bodyFatPct;
    if (v == null || v <= 0) return null;
    return `${Math.round(v * 10) / 10}%`;
  }, [props.bodyFatPct]);

  return (
    <GlassCard>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Body metrics
        </Text>
      </View>

      <View style={styles.rows}>
        <MetricRow label="Weight" value={weightLabel} colors={colors} />
        <MetricRow label="Target" value={targetLabel} colors={colors} />
        <MetricRow label="Height" value={heightLabel} colors={colors} />
        <View>
          <MetricRow
            label="BMI"
            value={bmi != null ? `${bmi}` : "—"}
            colors={colors}
          />
          {bmi != null && (
            <Text style={[styles.bmiNote, { color: colors.textTertiary }]}>
              {bmiDescriptor(bmi)} · not a verdict
            </Text>
          )}
        </View>
        <MetricRow
          label="Body fat"
          value={bodyFatLabel ?? "—"}
          subValue={bodyFatLabel == null ? "Not set" : undefined}
          colors={colors}
        />
      </View>

      <Pressable
        onPress={() => { Haptics.selectionAsync(); props.onPressAdd(); }}
        style={styles.editLink}
        accessibilityRole="button"
        accessibilityLabel="Edit metrics"
      >
        <Text style={[styles.editText, { color: colors.accent }]}>
          Edit metrics →
        </Text>
      </Pressable>

      {props.lastUpdatedVia && props.lastUpdatedAt ? (
        <Text style={[styles.sourceNote, { color: colors.textTertiary }]} numberOfLines={2}>
          via {props.lastUpdatedVia} · {fmtTime(props.lastUpdatedAt)}
        </Text>
      ) : null}
    </GlassCard>
  );
}

function MetricRow({
  label,
  value,
  subValue,
  colors,
}: {
  label: string;
  value: string;
  subValue?: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textTertiary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.textPrimary }]} numberOfLines={1}>
          {value}
        </Text>
        {subValue ? (
          <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: "600" },
  rows: { gap: 7 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { fontSize: 11, fontWeight: "400", flexShrink: 1, marginRight: 6 },
  rowRight: { alignItems: "flex-end", flexShrink: 0 },
  rowValue: { fontSize: 12, fontWeight: "600" },
  rowSub: { fontSize: 10, fontWeight: "300", marginTop: 1 },
  bmiNote: {
    fontSize: 9,
    fontWeight: "300",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 1,
    marginBottom: 2,
  },
  editLink: { marginTop: 12, alignSelf: "flex-start" },
  editText: { fontSize: 11, fontWeight: "500" },
  sourceNote: {
    fontSize: 9,
    fontWeight: "300",
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 13,
  },
});
