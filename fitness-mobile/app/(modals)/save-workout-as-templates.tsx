import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/content/AuthContext";
import { subscribeWorkouts, type Workout } from "@/services/workouts";
import { updateWorkoutTemplate } from "@/services/templates";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

function createdAtMs(r: any) {
  const c = r?.createdAt;
  if (!c) return 0;
  if (typeof c === "number") return c;
  if (typeof c?.toMillis === "function") return c.toMillis();
  if (typeof c?.seconds === "number") return c.seconds * 1000;
  return 0;
}

function GlassCard({
  children,
  style,
  intensity = 34,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
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

export default function SaveWorkoutAsTemplateModal() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const params = useLocalSearchParams<{
    sessionKey?: string;
    defaultName?: string;
  }>();

  const sessionKey = String(params.sessionKey || "");
  const [name, setName] = useState(String(params.defaultName || "My Template"));
  const [emoji, setEmoji] = useState("⭐️");

  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    if (!uid) {
      setWorkouts([]);
      return;
    }
    return subscribeWorkouts(
      uid,
      (rows: Workout[]) => setWorkouts(rows || []),
      { max: 400 }
    );
  }, [uid]);

  const rowsInSession = useMemo(() => {
    const all = (workouts || []) as any[];
    if (!sessionKey) return [];
    // match workouts.tsx deleteRecent() sessionKey logic
    return all.filter((r) => {
      const sid = String(r.sessionId || "");
      const key = sid ? sid : `date:${String(r.date || "")}`;
      return key === sessionKey;
    });
  }, [workouts, sessionKey]);

  const ordered = useMemo(() => {
    return rowsInSession
      .slice()
      .sort((a, b) => createdAtMs(a) - createdAtMs(b));
  }, [rowsInSession]);

  const mappedItems = useMemo(() => {
    return ordered
      .map((r) => {
        const exercise = String(r.exercise || r.name || "").trim();
        if (!exercise) return null;
        return {
          exercise,
          sets: Math.max(1, Number(r.sets || 1)),
          reps: Math.max(1, Number(r.reps || 10)),
          weightKg: Number(r.weightKg ?? r.weight ?? 0),
          notes: String(r.notes || "").trim(),
        };
      })
      .filter(Boolean) as any[];
  }, [ordered]);

  const canSave = name.trim() && mappedItems.length;

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const close = () => router.back();

  const save = async () => {
    if (!uid) return;
    if (!canSave) return;

    try {
      await haptic();
      const id = `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      await updateWorkoutTemplate(uid, id, {
        id,
        name: name.trim(),
        title: name.trim(),
        emoji: (emoji || "⭐️").trim(),
        tags: ["Saved from workout"],
        items: mappedItems,
        exercises: mappedItems,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

      router.back();
    } catch (e: any) {
      console.warn(e);
      Alert.alert(
        "Could not save template",
        e?.message ||
          "Your template write method may be using updateDoc (requires existing doc). If so, change updateWorkoutTemplate to use setDoc so new templates can be created."
      );
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#070A12", "#050711", "#03040A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 12 }}>
        <BlurView intensity={28} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="bookmark-outline"
                size={18}
                color={withAlpha("#FFFFFF", 0.92)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Save as template</Text>
              <Text style={styles.sub}>
                Turn this workout into a reusable plan
              </Text>
            </View>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color={withAlpha("#FFFFFF", 0.86)}
              />
            </Pressable>
          </View>
        </BlurView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard intensity={34} style={{ borderRadius: 22 }}>
          <View style={{ gap: 12 }}>
            <View style={styles.row}>
              <View style={styles.smallIcon}>
                <Text style={{ fontSize: 16 }}>{emoji || "⭐️"}</Text>
              </View>
              <TextInput
                value={emoji}
                onChangeText={setEmoji}
                placeholder="⭐️"
                placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                style={[styles.input, { maxWidth: 70, textAlign: "center" }]}
              />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Template name"
                placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <View style={styles.summaryPill}>
              <Ionicons
                name="layers-outline"
                size={14}
                color={withAlpha("#FFFFFF", 0.82)}
              />
              <Text style={styles.summaryText}>
                {mappedItems.length} exercises will be saved
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Preview</Text>

          {mappedItems.length === 0 ? (
            <Text style={styles.helper}>
              No exercises found for this session.
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {mappedItems.map((it: any, idx: number) => (
                <GlassCard
                  key={`${it.exercise}-${idx}`}
                  intensity={28}
                  style={{ borderRadius: 18 }}
                >
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {it.exercise}
                  </Text>
                  <Text style={styles.itemSub}>
                    {it.sets}×{it.reps} • {Math.round(it.weightKg || 0)} kg
                    {it.notes ? ` • ${it.notes}` : ""}
                  </Text>
                </GlassCard>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={save}
            disabled={!canSave}
            style={({ pressed }) => {
              const base = [styles.saveBtn] as const;
              const disabledStyle = !canSave ? { opacity: 0.55 } : null;
              const pressedStyle =
                pressed && canSave ? { opacity: 0.92 } : null;
              return [...base, disabledStyle, pressedStyle];
            }}
          >
            <Ionicons
              name="save-outline"
              size={16}
              color={withAlpha("#111", 0.92)}
            />
            <Text style={styles.saveText}>Save template</Text>
          </Pressable>

          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ghostText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060C" },

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

  headerBlur: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  headerRow: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.07),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  title: { color: withAlpha("#FFFFFF", 0.94), fontSize: 16, fontWeight: "900" },
  sub: {
    marginTop: 2,
    color: withAlpha("#FFFFFF", 0.6),
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  smallIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  input: {
    color: withAlpha("#FFFFFF", 0.92),
    fontWeight: "800",
    fontSize: 14,
    paddingVertical: 0,
  },

  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha("#FFFFFF", 0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.12),
    alignSelf: "flex-start",
  },
  summaryText: {
    color: withAlpha("#FFFFFF", 0.82),
    fontWeight: "800",
    fontSize: 12,
  },

  sectionTitle: {
    color: withAlpha("#FFFFFF", 0.88),
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  helper: {
    marginTop: 8,
    color: withAlpha("#FFFFFF", 0.55),
    fontWeight: "700",
    fontSize: 12,
  },

  itemTitle: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },
  itemSub: {
    marginTop: 3,
    color: withAlpha("#FFFFFF", 0.6),
    fontWeight: "700",
    fontSize: 12,
  },

  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.92),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: withAlpha("#111", 0.92), fontWeight: "900" },

  ghostBtn: {
    width: 110,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: withAlpha("#FFFFFF", 0.88), fontWeight: "900" },
});
