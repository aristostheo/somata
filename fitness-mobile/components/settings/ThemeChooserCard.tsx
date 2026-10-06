// components/settings/premium/ThemeChooserCard.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/content/ThemeProvider";

type GradientStops = readonly [string, string, ...string[]];

function styleStops(
  style: "subtle" | "balanced" | "bold",
  primary: string,
  accent: string
): GradientStops {
  if (style === "subtle") return [primary, primary, accent] as const;
  if (style === "bold") return [primary, accent] as const;
  return [primary, accent, accent] as const;
}

export default function ThemeChooserCard({
  title = "Theme Chooser",
  subtitle = "Customize your accent palette for Light and Dark",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { colors, isDark, themeAccents } = useTheme();
  const router = useRouter();

  const light = themeAccents.light;
  const dark = themeAccents.dark;

  const preview = useMemo(() => {
    const st = (isDark ? dark : light).gradientStyle ?? "balanced";
    return {
      p: colors.primary,
      a: colors.accent,
      st,
      muted: colors.accentMuted,
      subtle: colors.accentSubtle,
      dim: colors.accentDim,
      foreground: colors.accentForeground,
    };
  }, [
    isDark,
    dark,
    light,
    colors.primary,
    colors.accent,
    colors.accentMuted,
    colors.accentSubtle,
    colors.accentDim,
    colors.accentForeground,
  ]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(modals)/theme-editor");
      }}
      style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.92 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="Open theme editor"
      accessibilityHint="Customize primary and secondary accent colors"
    >
      <BlurView
        intensity={22}
        tint={isDark ? "dark" : "light"}
        style={[styles.card, { borderColor: colors.glassBorder }]}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text
              style={[styles.sub, { color: colors.muted }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <View
            style={[
              styles.pill,
              { borderColor: colors.border, backgroundColor: colors.surface2 },
            ]}
          >
            <Ionicons name="color-palette" size={16} color={colors.muted} />
            <Text style={[styles.pillText, { color: colors.muted }]}>
              {isDark ? "Dark" : "Light"}
            </Text>
          </View>
        </View>

        {/* Preview strip */}
        <View style={[styles.previewOuter, { borderColor: colors.border }]}>
          <LinearGradient
            colors={styleStops(preview.st, preview.p, preview.a)}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.preview}
          >
            <View style={styles.previewTop}>
            <Text style={[styles.previewLabel, { color: preview.foreground }]}>Live palette preview</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={preview.foreground}
            />
          </View>

            <View style={styles.variantRow}>
              {[
                { label: "Full", color: preview.a },
                { label: "Muted", color: preview.muted },
                { label: "Subtle", color: preview.subtle },
                { label: "Dim", color: preview.dim },
              ].map((item) => (
                <View key={item.label} style={styles.variantItem}>
                  <View style={[styles.dot, { backgroundColor: item.color, borderColor: preview.foreground }]} />
                  <Text style={[styles.variantLabel, { color: preview.foreground }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Small dual-mode hint */}
        <View style={styles.footerRow}>
          <View
            style={[
              styles.modeMini,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.miniLabel, { color: colors.muted }]}>
              Light
            </Text>
            <View
              style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
            >
              <View
                style={[
                  styles.miniSwatch,
                  { backgroundColor: light.primary ?? "#6366F1" },
                ]}
              />
              <View
                style={[
                  styles.miniSwatch,
                  { backgroundColor: light.accent ?? "#8B5CF6" },
                ]}
              />
            </View>
          </View>

          <View
            style={[
              styles.modeMini,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.miniLabel, { color: colors.muted }]}>
              Dark
            </Text>
            <View
              style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
            >
              <View
                style={[
                  styles.miniSwatch,
                  { backgroundColor: dark.primary ?? "#6366F1" },
                ]}
              />
              <View
                style={[
                  styles.miniSwatch,
                  { backgroundColor: dark.accent ?? "#8B5CF6" },
                ]}
              />
            </View>
          </View>
        </View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

  previewOuter: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  preview: {
    padding: 12,
    borderRadius: 16,
    minHeight: 82,
    justifyContent: "space-between",
  },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewLabel: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "900",
    fontSize: 12,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  variantItem: { alignItems: "center", gap: 4, minWidth: 46 },
  variantLabel: { fontSize: 10, fontWeight: "400" },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
  },

  footerRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  modeMini: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniLabel: { fontSize: 12, fontWeight: "900" },
  miniSwatch: {
    width: 16,
    height: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
});
