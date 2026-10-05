import React, { useMemo, useRef, useState } from "react";
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

type HydrationLog = { ts: number; ml: number };

export default function QuickHydrationModal() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const accent = "#68D7FF";
  const topPad = Platform.OS === "android" ? 18 : 22;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>("");
  const timer = useRef<any>(null);

  const sizes = useMemo(() => [250, 350, 500, 750, 1000], []);

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const key = (u: string) => `hydration:quickLogs:${u}`;

  function close() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/nutrition");
  }

  function showToast(msg: string) {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(""), 1600);
  }

  async function add(ml: number) {
    if (!uid || busy) return;
    setBusy(true);
    await haptic();

    try {
      const raw = await AsyncStorage.getItem(key(uid));
      const arr: HydrationLog[] = raw ? JSON.parse(raw) : [];
      arr.push({ ts: Date.now(), ml });
      await AsyncStorage.setItem(key(uid), JSON.stringify(arr));
    } catch {}

    showToast(`Logged ${ml} ml`);
    setBusy(false);

    // close quickly after “success”
    setTimeout(close, 420);
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
          { top: -140, left: -90, backgroundColor: withAlpha(accent, 0.16) },
        ]}
        pointerEvents="none"
      />

      <View style={{ paddingTop: topPad, paddingHorizontal: 16 }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={close}
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
            <Text style={styles.title}>Quick Hydration</Text>
            <Text style={styles.subtitle}>
              1 tap to log. Closes automatically.
            </Text>
          </View>
        </View>

        <GlassCard style={{ marginTop: 14 }} intensity={34}>
          <Text style={styles.sectionLabel}>AMOUNT</Text>

          <View style={styles.grid}>
            {sizes.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => add(ml)}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <View style={styles.tileIcon}>
                  <Ionicons
                    name="water-outline"
                    size={18}
                    color={withAlpha("#FFF", 0.9)}
                  />
                </View>
                <Text style={styles.tileText}>{ml} ml</Text>
                <Text style={styles.tileSub}>
                  {ml >= 750 ? "big drink" : "quick sip"}
                </Text>
              </Pressable>
            ))}
          </View>

          {!!toast && (
            <View style={styles.toastRow}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={withAlpha("#7CFFB5", 0.95)}
              />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          )}
        </GlassCard>

        <Text style={styles.foot}>
          (This logs locally in AsyncStorage. If you want it in your
          Nutrition/Hydration backend, tell me your current hydration storage
          pattern and I’ll wire it.)
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

  grid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.5%",
    borderRadius: 16,
    padding: 12,
    backgroundColor: withAlpha("#FFFFFF", 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.12),
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  tileText: {
    marginTop: 10,
    color: withAlpha("#FFF", 0.92),
    fontWeight: "900",
    fontSize: 14,
  },
  tileSub: {
    marginTop: 3,
    color: withAlpha("#FFF", 0.62),
    fontWeight: "700",
    fontSize: 12,
  },

  toastRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: {
    color: withAlpha("#FFF", 0.85),
    fontWeight: "800",
    fontSize: 12,
  },

  foot: {
    marginTop: 12,
    color: withAlpha("#FFF", 0.5),
    fontSize: 12,
    fontWeight: "700",
  },
});
