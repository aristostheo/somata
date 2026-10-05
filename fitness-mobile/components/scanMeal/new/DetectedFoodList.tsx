// components/scanMeal/DetectedFoodList.tsx
// INSANE Apple-ish redesign ✅
// - Glossy "stacked cards" list with glass + depth
// - Confidence "aura" ring + badge
// - Micro-interactions: subtle scale on press, haptics-safe (handled by parent)
// - Quick adjust capsule (+ / −) + portion chip
// - Elegant empty state with "orb" + CTA
//
// Notes:
// - Keeps your props + wiring unchanged
// - Uses your ThemeProvider tokens: bg, surface, surface2, glass, glassBorder, border, muted, primary, accent, danger
// - No dependency on FoodRow anymore (full redesign)

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { useTheme } from "@/content/ThemeProvider";
import type { DetectedFood } from "@/components/scanMeal/new/types";

type Props = {
  foods: DetectedFood[];
  onPressItem: (f: DetectedFood) => void;
  onRemove: (id: string) => void;
  onQuickAdjust: (id: string, delta: number) => void;
  onAdd: () => void;
};

export default function DetectedFoodList({
  foods,
  onPressItem,
  onRemove,
  onQuickAdjust,
  onAdd,
}: Props) {
  const { colors, isDark } = useTheme();

  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const animateList = () => {
    if (Platform.OS === "ios") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  };

  if (!foods.length) {
    return (
      <View style={{ marginTop: 10 }}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyOrbWrap}>
            <LinearGradient
              colors={[
                `${colors.primary}55`,
                `${colors.accent}33`,
                isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
              ]}
              start={{ x: 0.15, y: 0.1 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.emptyOrb}
            />
            <View style={styles.emptyOrbInner}>
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={isDark ? "rgba(255,255,255,0.85)" : colors.text}
              />
            </View>
          </View>

          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySub}>
            Add items manually, or rescan with a clearer photo. You’ll always
            confirm before logging.
          </Text>

          <Pressable
            onPress={() => {
              animateList();
              onAdd();
            }}
            style={styles.emptyCTA}
            accessibilityRole="button"
            accessibilityLabel="Add an item"
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0.1, y: 0.2 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.emptyCTAGrad}
            />
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.emptyCTAText}>Add item</Text>
            <View style={{ flex: 1 }} />
            <Ionicons
              name="chevron-forward"
              size={16}
              color="rgba(255,255,255,0.95)"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.stack}>
        {foods.map((f, idx) => (
          <FoodCard
            key={f.id}
            food={f}
            index={idx}
            onPress={() => onPressItem(f)}
            onRemove={() => {
              animateList();
              onRemove(f.id);
            }}
            onQuickAdjust={(delta) => {
              animateList();
              onQuickAdjust(f.id, delta);
            }}
          />
        ))}
      </View>

      {/* Add inline row */}
      <Pressable
        onPress={() => {
          animateList();
          onAdd();
        }}
        style={styles.addInline}
        accessibilityRole="button"
        accessibilityLabel="Add item"
      >
        <View style={styles.addInlineIcon}>
          <Ionicons name="add" size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.addInlineTitle}>Add item</Text>
          <Text style={styles.addInlineSub}>
            Manual entry • Always editable
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function FoodCard({
  food,
  index,
  onPress,
  onRemove,
  onQuickAdjust,
}: {
  food: DetectedFood;
  index: number;
  onPress: () => void;
  onRemove: () => void;
  onQuickAdjust: (delta: number) => void;
}) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const aura = confidenceAura(food.confidence, colors);
  const badge = confidenceBadge(food.confidence);

  const kcal = Math.round(
    (food.macros?.calories ?? 0) * (food.portion?.multiplier ?? 1)
  );
  const p = round1(
    (food.macros?.protein ?? 0) * (food.portion?.multiplier ?? 1)
  );
  const c = round1((food.macros?.carbs ?? 0) * (food.portion?.multiplier ?? 1));
  const f = round1((food.macros?.fat ?? 0) * (food.portion?.multiplier ?? 1));

  const amount = food.portion?.amount ?? 1;
  const unit = food.portion?.unit ?? "g";

  // stacked depth illusion
  const depthTop = Math.min(index * 8, 16);
  const scale = 1 - Math.min(index * 0.015, 0.03);

  return (
    <View style={[s.cardOuter, { marginTop: index === 0 ? 0 : 10 }]}>
      {/* Aura glow behind card */}
      <View style={[s.aura, { backgroundColor: aura.bg }]} />
      <View style={[s.auraSoft, { backgroundColor: aura.soft }]} />

      <Pressable
        onPress={onPress}
        style={[
          s.card,
          {
            transform: [{ translateY: depthTop }, { scale }],
            borderColor: colors.glassBorder ?? colors.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${food.name}`}
      >
        {/* Glass layer */}
        <BlurView
          intensity={isDark ? 18 : 28}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, s.cardGlass]} />

        {/* Header row */}
        <View style={s.rowTop}>
          <View style={s.leftIconWrap}>
            <LinearGradient
              colors={[aura.badgeFrom, aura.badgeTo]}
              start={{ x: 0.1, y: 0.2 }}
              end={{ x: 0.9, y: 1 }}
              style={s.leftIconGrad}
            />
            <Ionicons
              name={
                food.confidence === "low"
                  ? "help-circle-outline"
                  : "sparkles-outline"
              }
              size={16}
              color="white"
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.nameRow}>
              <Text numberOfLines={1} style={s.name}>
                {food.name}
              </Text>

              <View
                style={[
                  s.badge,
                  {
                    backgroundColor: aura.badgeBg,
                    borderColor: aura.badgeBorder,
                  },
                ]}
              >
                <Text style={[s.badgeText, { color: aura.badgeText }]}>
                  {badge}
                </Text>
              </View>
            </View>

            <View style={s.metaRow}>
              <View
                style={[
                  s.chip,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="scale-outline" size={14} color={colors.muted} />
                <Text style={s.chipText}>
                  {formatAmount(amount)} {unit}
                </Text>
              </View>

              <View
                style={[
                  s.chip,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="flash-outline" size={14} color={colors.muted} />
                <Text style={s.chipText}>{kcal} kcal</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={onRemove}
            hitSlop={10}
            style={s.trash}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${food.name}`}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>

        {/* Macro strip */}
        <View style={s.macroStrip}>
          <MacroPill label="P" value={p} />
          <MacroPill label="C" value={c} />
          <MacroPill label="F" value={f} />
        </View>

        {/* Controls */}
        <View style={s.controlsRow}>
          <View style={s.adjustCapsule}>
            <Pressable
              onPress={() => onQuickAdjust(-0.5)}
              style={s.adjustBtn}
              accessibilityRole="button"
              accessibilityLabel="Decrease portion"
            >
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>

            <View style={s.adjustDivider} />

            <Pressable
              onPress={() => onQuickAdjust(+0.5)}
              style={s.adjustBtn}
              accessibilityRole="button"
              accessibilityLabel="Increase portion"
            >
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />

          <View style={s.tapHint}>
            <Ionicons name="pencil-outline" size={14} color={colors.muted} />
            <Text style={s.tapHintText}>Tap to edit</Text>
          </View>
        </View>

        {/* Subtle bottom sheen */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.10)",
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.00)",
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={s.sheen}
          pointerEvents="none"
        />
      </Pressable>
    </View>
  );
}

function MacroPill({ label, value }: { label: string; value: number }) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <View
      style={[
        s.macroPill,
        { backgroundColor: colors.surface2, borderColor: colors.border },
      ]}
    >
      <Text style={[s.macroLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[s.macroValue, { color: colors.text }]}>
        {formatMacro(value)}
      </Text>
    </View>
  );
}

function confidenceBadge(c: DetectedFood["confidence"]) {
  if (c === "high") return "High";
  if (c === "medium") return "Med";
  if (c === "low") return "Low";
  return "Manual";
}

function confidenceAura(
  c: DetectedFood["confidence"],
  colors: any
): {
  bg: string;
  soft: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeFrom: string;
  badgeTo: string;
} {
  if (c === "high") {
    return {
      bg: "rgba(34,197,94,0.20)",
      soft: "rgba(34,197,94,0.10)",
      badgeBg: "rgba(34,197,94,0.14)",
      badgeBorder: "rgba(34,197,94,0.26)",
      badgeText: colors.text,
      badgeFrom: "rgba(34,197,94,0.95)",
      badgeTo: "rgba(16,185,129,0.95)",
    };
  }
  if (c === "medium") {
    return {
      bg: "rgba(99,102,241,0.22)",
      soft: "rgba(99,102,241,0.12)",
      badgeBg: "rgba(99,102,241,0.16)",
      badgeBorder: "rgba(99,102,241,0.26)",
      badgeText: colors.text,
      badgeFrom: colors.primary,
      badgeTo: colors.accent,
    };
  }
  if (c === "low") {
    return {
      bg: "rgba(245,158,11,0.22)",
      soft: "rgba(245,158,11,0.12)",
      badgeBg: "rgba(245,158,11,0.14)",
      badgeBorder: "rgba(245,158,11,0.28)",
      badgeText: colors.text,
      badgeFrom: "rgba(245,158,11,0.95)",
      badgeTo: "rgba(217,119,6,0.95)",
    };
  }
  // manual
  return {
    bg: "rgba(148,163,184,0.20)",
    soft: "rgba(148,163,184,0.12)",
    badgeBg: "rgba(148,163,184,0.14)",
    badgeBorder: "rgba(148,163,184,0.22)",
    badgeText: colors.text,
    badgeFrom: "rgba(148,163,184,0.95)",
    badgeTo: "rgba(100,116,139,0.95)",
  };
}

function formatMacro(n: number) {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function formatAmount(n: number) {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function makeStyles(colors: any, isDark: boolean) {
  const hair = isDark ? "rgba(255,255,255,0.10)" : "rgba(11,18,32,0.10)";

  return StyleSheet.create({
    stack: { gap: 10 },

    cardOuter: {
      position: "relative",
    },
    aura: {
      position: "absolute",
      left: 10,
      right: 10,
      top: 8,
      height: 70,
      borderRadius: 22,
      opacity: 0.9,
      filter: undefined as any, // (RN no-op; keeps TS quiet in some setups)
    },
    auraSoft: {
      position: "absolute",
      left: 22,
      right: 22,
      top: 22,
      height: 90,
      borderRadius: 26,
      opacity: 0.9,
    },

    card: {
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      padding: 14,
      backgroundColor: colors.glass ?? colors.surface,
    },
    cardGlass: {
      backgroundColor: colors.glass ?? "rgba(255,255,255,0.55)",
      opacity: isDark ? 0.55 : 0.75,
    },

    rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

    leftIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    leftIconGrad: { ...StyleSheet.absoluteFill },

    nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
      flexShrink: 1,
    },

    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeText: { fontSize: 11.5, fontWeight: "900" },

    metaRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
    chip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    chipText: { fontSize: 12, fontWeight: "800", color: colors.text },

    trash: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(11,18,32,0.035)",
    },

    macroStrip: { flexDirection: "row", gap: 10, marginTop: 12 },
    macroPill: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    macroLabel: { fontSize: 12, fontWeight: "900" },
    macroValue: { fontSize: 13.5, fontWeight: "900" },

    controlsRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
    adjustCapsule: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.06)"
        : "rgba(11,18,32,0.04)",
    },
    adjustBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 46,
    },
    adjustDivider: {
      width: StyleSheet.hairlineWidth,
      height: "100%",
      backgroundColor: hair,
    },

    tapHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(11,18,32,0.035)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
    },
    tapHintText: { fontSize: 12, fontWeight: "800", color: colors.muted },

    sheen: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 34,
      opacity: isDark ? 0.55 : 0.7,
    },

    addInline: {
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    addInlineIcon: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(11,18,32,0.035)",
    },
    addInlineTitle: { fontSize: 13.5, fontWeight: "900", color: colors.text },
    addInlineSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "700",
      color: colors.muted,
    },

    emptyWrap: {
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      overflow: "hidden",
    },
    emptyOrbWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    emptyOrb: {
      width: 74,
      height: 74,
      borderRadius: 999,
      opacity: 0.95,
    },
    emptyOrbInner: {
      position: "absolute",
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hair,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(255,255,255,0.75)",
    },
    emptyTitle: {
      marginTop: 14,
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
      textAlign: "center",
    },
    emptySub: {
      marginTop: 8,
      fontSize: 12.5,
      fontWeight: "650" as any,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    emptyCTA: {
      marginTop: 14,
      borderRadius: 18,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    emptyCTAGrad: { ...StyleSheet.absoluteFill },
    emptyCTAText: {
      color: "white",
      fontSize: 13.5,
      fontWeight: "900",
      marginLeft: 8,
    },
  });
}
