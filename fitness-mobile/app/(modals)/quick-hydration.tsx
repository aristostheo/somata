import { Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { useAuth } from "@/content/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

type HydrationLog = { ts: number; ml: number; };

export default function QuickHydrationModal() {
  const { D, F } = useSomataTheme();

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
    } catch { }
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
    } catch { }

    showToast(`Logged ${ml} ml`);
    setBusy(false);

    // close quickly after “success”
    setTimeout(close, 420);
  }

  return (<TaskPage title="A moment to hydrate." section="Quick log / water" onBack={close}
    subtitle="Choose the amount you drank. A tap saves your entry and closes this screen.">

    <Panel accent>
      <Ionicons name="water-outline" size={48} color={D.teal} />
      <Text style={F.heading}>How much did you drink?</Text>

      <Text style={F.body}>Quick water entries are saved on this device for your account.</Text>
    </Panel>

    <View style={{ gap: 10 }}>
      {sizes.map((ml, index) => <Pressable key={ml} disabled={busy || !uid}
        accessibilityRole="button" accessibilityLabel={`Log ${ml} milliliters`} accessibilityState={{ disabled: busy || !uid }} onPress={() => add(ml)}
        style={({ pressed }) => ({ ...F.row, padding: 18, minHeight: 75, borderRadius: 20, backgroundColor: D.card, opacity: pressed || busy ? 0.6 : 1 })}>

        <Text style={F.eyebrow}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={{ ...F.value, flex: 1 }}>{ml} <Text style={F.body}>ml</Text></Text>

        <Ionicons name="add-circle" color={D.lime} size={30} />
      </Pressable>)}
    </View>

    {!!toast && <Text accessibilityLiveRegion="polite" style={{ ...F.body, color: D.lime }}>{toast}</Text>}

    {!uid && <Text style={F.body}>Sign in to save a water entry.</Text>}
  </TaskPage>
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
