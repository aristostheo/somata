// components/scanMeal/PhotoCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/content/ThemeProvider";
import type { ScanState } from "@/components/scanMeal/new/types";

export default function PhotoCard({
  state,
  photoUri,
  onTakePhoto,
  onPickLibrary,
  onScan,
}: {
  state: ScanState;
  photoUri: string | null;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
  onScan: () => void;
}) {
  const { colors, isDark } = useTheme() as any;

  const helper = useMemo(() => {
    if (!photoUri) return "Take a clear photo with the full plate in frame.";
    if (state === "photo_ready")
      return "Ready to scan. You’ll review before logging.";
    if (state === "review") return "Review detected items and adjust anything.";
    return " ";
  }, [photoUri, state]);

  return (
    <View style={[styles.card, { backgroundColor: withAlpha(colors.card, 0.44) }]}>
      <LinearGradient
        colors={[
          withAlpha(colors.primary, isDark ? 0.14 : 0.08),
          withAlpha("#38bdf8", isDark ? 0.06 : 0.03),
          withAlpha(colors.card, 0.88),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.05)",
            },
          ]}
        >
          <Ionicons name="camera-outline" size={14} color={colors.muted} />
          <Text style={[styles.badgeText, { color: colors.muted }]}>Photo</Text>
        </View>
        <Text
          style={[styles.helper, { color: colors.muted }]}
          numberOfLines={2}
        >
          {helper}
        </Text>
      </View>

      <View style={[styles.preview]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="image-outline" size={28} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No photo yet
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onTakePhoto}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: withAlpha(colors.card, 0.42),
              opacity: pressed ? 0.84 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <Ionicons name="camera" size={16} color={colors.text} />
          <Text style={[styles.btnText, { color: colors.text }]}>Camera</Text>
        </Pressable>

        <Pressable
          onPress={onPickLibrary}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: withAlpha(colors.card, 0.42),
              opacity: pressed ? 0.84 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
        >
          <Ionicons name="images" size={16} color={colors.text} />
          <Text style={[styles.btnText, { color: colors.text }]}>Library</Text>
        </Pressable>

        <Pressable
          onPress={onScan}
          disabled={!photoUri || state === "analyzing" || state === "saving"}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              opacity: !photoUri ? 0.6 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan with AI"
        >
          <LinearGradient
            colors={
              photoUri
                ? ["rgba(56,189,248,0.98)", colors.primary]
                : [colors.border, colors.border]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryFill}
          >
            <Ionicons name="sparkles" size={16} color={"white"} />
            <Text style={[styles.primaryText]}>Scan</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 22,
    padding: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { marginLeft: 6, fontSize: 12, fontWeight: "700" },
  helper: {
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
    fontSize: 12.5,
    fontWeight: "600",
  },

  preview: {
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    height: 210,
  },
  image: { width: "100%", height: "100%" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { marginTop: 8, fontSize: 12.5, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { fontSize: 13, fontWeight: "800" },

  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryFill: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { fontSize: 13, fontWeight: "900", color: "white" },
});

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
