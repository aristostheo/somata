import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/content/AuthContext";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

function GlassCard({ children, intensity = 32, style }: any) {
  return (
    <View style={[styles.cardWrap, style]}>
      <View style={styles.cardBorder} pointerEvents="none" />
      <BlurView intensity={intensity} tint="dark" style={styles.cardBlur}>
        <LinearGradient
          colors={[
            withAlpha("#FFFFFF", 0.1),
            withAlpha("#FFFFFF", 0.06),
            withAlpha("#000000", 0.06),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardInner}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

export default function QuickMobilityModal() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const accent = "#7CFFB5";
  const topPad = Platform.OS === "android" ? 18 : 22;
  const [busy, setBusy] = useState(false);

  const templateSeedKey = (u: string) => `workout:templateSeed:${u}`;

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  async function seedAndOpen(kind: "10" | "15") {
    if (!uid || busy) return;
    setBusy(true);
    await haptic();

    const seed = {
      title: kind === "10" ? "Mobility (10 min)" : "Mobility (15 min)",
      exercises: [
        {
          name: "Hip Opener Flow",
          sets: 1,
          reps: 1,
          weightKg: 0,
          note: "2–3 min",
        },
        { name: "Thoracic Rotation", sets: 2, reps: 8, weightKg: 0, note: "" },
        {
          name: "Hamstring Stretch",
          sets: 2,
          reps: 1,
          weightKg: 0,
          note: "45–60s hold",
        },
      ],
    };

    try {
      await AsyncStorage.setItem(templateSeedKey(uid), JSON.stringify(seed));
    } catch {}

    router.replace({
      pathname: "/workouts/session",
      params: { quick: "mobility", mins: kind },
    } as any);
    setBusy(false);
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#070A12", "#050711", "#03040A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.glow,
          { top: -140, left: -90, backgroundColor: withAlpha(accent, 0.14) },
        ]}
        pointerEvents="none"
      />

      <View style={{ paddingTop: topPad, paddingHorizontal: 16 }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={withAlpha("#FFF", 0.9)}
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Quick Mobility</Text>
            <Text style={styles.subtitle}>
              2 taps: choose duration → session opens.
            </Text>
          </View>
        </View>

        <GlassCard style={{ marginTop: 14 }} intensity={34}>
          <Text style={styles.sectionLabel}>DURATION</Text>

          <Pressable
            onPress={() => seedAndOpen("10")}
            style={({ pressed }) => [
              styles.rowBtn,
              pressed && { opacity: 0.88 },
            ]}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name="time-outline"
                size={18}
                color={withAlpha("#FFF", 0.9)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>10 min reset</Text>
              <Text style={styles.rowSub}>hips • t-spine • hamstrings</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={withAlpha("#FFF", 0.55)}
            />
          </Pressable>

          <Pressable
            onPress={() => seedAndOpen("15")}
            style={({ pressed }) => [
              styles.rowBtn,
              pressed && { opacity: 0.88 },
            ]}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={withAlpha("#FFF", 0.9)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>15 min loosen up</Text>
              <Text style={styles.rowSub}>same flow • slower pace</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={withAlpha("#FFF", 0.55)}
            />
          </Pressable>
        </GlassCard>

        <Text style={styles.foot}>
          You can add/remove drills in session — this is your fast default.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060C" },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 280 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  title: { color: withAlpha("#FFF", 0.95), fontSize: 20, fontWeight: "900" },
  subtitle: {
    marginTop: 2,
    color: withAlpha("#FFF", 0.62),
    fontSize: 12,
    fontWeight: "700",
  },

  cardWrap: { borderRadius: 18, overflow: "hidden" },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    zIndex: 2,
  },
  cardBlur: { borderRadius: 18, overflow: "hidden" },
  cardInner: { padding: 14 },

  sectionLabel: {
    color: withAlpha("#FFF", 0.65),
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  rowBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.12),
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  rowTitle: { color: withAlpha("#FFF", 0.92), fontWeight: "900", fontSize: 14 },
  rowSub: {
    marginTop: 3,
    color: withAlpha("#FFF", 0.62),
    fontWeight: "700",
    fontSize: 12,
  },

  foot: {
    marginTop: 12,
    color: withAlpha("#FFF", 0.5),
    fontSize: 12,
    fontWeight: "700",
  },
});
