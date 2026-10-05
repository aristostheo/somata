import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  TextInput,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/content/AuthContext";
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

type TemplateItem = {
  exercise: string;
  sets: number;
  reps: number;
  weightKg?: number;
  notes?: string;
};

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

function n(v: any, fallback: number) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export default function CreateTemplateModal() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐️");
  const [tagText, setTagText] = useState(""); // "Upper • Strength"

  const [items, setItems] = useState<TemplateItem[]>([]);

  // add-exercise mini modal state
  const [addOpen, setAddOpen] = useState(false);
  const [exName, setExName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = useMemo(
    () => name.trim().length > 0 && items.length > 0,
    [name, items]
  );

  const haptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const close = () => router.back();

  const openAdd = async () => {
    await haptic();
    setExName("");
    setSets("3");
    setReps("10");
    setWeightKg("");
    setNotes("");
    setAddOpen(true);
  };

  const addItem = () => {
    const e = exName.trim();
    if (!e) return;

    const next: TemplateItem = {
      exercise: e,
      sets: Math.max(1, n(sets, 3)),
      reps: Math.max(1, n(reps, 10)),
      weightKg: weightKg.trim() ? Math.max(0, n(weightKg, 0)) : undefined,
      notes: notes.trim() || undefined,
    };

    setItems((prev) => [...prev, next]);
    setAddOpen(false);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const saveTemplate = async () => {
    if (!uid) return;
    if (!canSave) return;

    try {
      await haptic();

      // Prefer creating via updateWorkoutTemplate by passing a new id.
      // If your backend uses setDoc, it will create. If it uses updateDoc and fails,
      // you’ll see the error and you can switch updateWorkoutTemplate to setDoc.
      const id = `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const tags =
        tagText
          .split("•")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4) ?? [];

      const mapped = items.map((it) => ({
        exercise: it.exercise,
        sets: Number(it.sets || 1),
        reps: Number(it.reps || 10),
        weightKg: Number(it.weightKg ?? 0),
        notes: it.notes || "",
      }));

      await updateWorkoutTemplate(uid, id, {
        id,
        name: name.trim(),
        title: name.trim(),
        emoji: (emoji || "⭐️").trim(),
        tags,
        tag: tags, // keep compatibility
        items: mapped,
        exercises: mapped,
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

      {/* Header */}
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 12 }}>
        <BlurView intensity={28} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="albums-outline"
                size={18}
                color={withAlpha("#FFFFFF", 0.92)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Create template</Text>
              <Text style={styles.sub}>Build a reusable workout plan</Text>
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
                placeholder="Template name (e.g., Push Strength)"
                placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.smallIcon}>
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={withAlpha("#FFFFFF", 0.84)}
                />
              </View>
              <TextInput
                value={tagText}
                onChangeText={setTagText}
                placeholder='Tags (e.g., "Upper • Strength")'
                placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <Pressable
              onPress={openAdd}
              style={({ pressed }) => [
                styles.addBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Ionicons
                name="add"
                size={18}
                color={withAlpha("#FFFFFF", 0.92)}
              />
              <Text style={styles.addBtnText}>Add exercise</Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* Items */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Exercises</Text>

          {items.length === 0 ? (
            <Text style={styles.helper}>
              Add at least one exercise to save.
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {items.map((it, idx) => (
                <GlassCard
                  key={`${it.exercise}-${idx}`}
                  intensity={28}
                  style={{ borderRadius: 18 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {it.exercise}
                      </Text>
                      <Text style={styles.itemSub}>
                        {it.sets}×{it.reps}
                        {typeof it.weightKg === "number"
                          ? ` • ${Math.round(it.weightKg)} kg`
                          : ""}
                        {it.notes ? ` • ${it.notes}` : ""}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        style={({ pressed }) => [
                          styles.iconBtn,
                          idx === 0 && { opacity: 0.35 },
                          pressed && idx !== 0 && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={16}
                          color={withAlpha("#FFFFFF", 0.86)}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        style={({ pressed }) => [
                          styles.iconBtn,
                          idx === items.length - 1 && { opacity: 0.35 },
                          pressed &&
                            idx !== items.length - 1 && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={withAlpha("#FFFFFF", 0.86)}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => removeItem(idx)}
                        style={({ pressed }) => [
                          styles.iconBtnDanger,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={withAlpha("#FF5C6A", 0.95)}
                        />
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </View>

        {/* Save */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={saveTemplate}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              !canSave && { opacity: 0.55 },
              pressed && canSave && { opacity: 0.92 },
            ]}
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

      {/* Add exercise modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAddOpen(false)}
          />
          <View style={styles.modalWrap}>
            <GlassCard intensity={40} style={{ borderRadius: 22 }}>
              <Text style={styles.modalTitle}>Add exercise</Text>

              <View style={{ gap: 10, marginTop: 10 }}>
                <TextInput
                  value={exName}
                  onChangeText={setExName}
                  placeholder="Exercise name (e.g., Bench Press)"
                  placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                  style={styles.modalInput}
                />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TextInput
                    value={sets}
                    onChangeText={setSets}
                    placeholder="Sets"
                    placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                    keyboardType="number-pad"
                    style={[styles.modalInput, { flex: 1 }]}
                  />
                  <TextInput
                    value={reps}
                    onChangeText={setReps}
                    placeholder="Reps"
                    placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                    keyboardType="number-pad"
                    style={[styles.modalInput, { flex: 1 }]}
                  />
                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="kg"
                    placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                    keyboardType="numeric"
                    style={[styles.modalInput, { flex: 1 }]}
                  />
                </View>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes (optional)"
                  placeholderTextColor={withAlpha("#FFFFFF", 0.45)}
                  style={styles.modalInput}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={addItem}
                    disabled={!exName.trim()}
                    style={({ pressed }) => [
                      styles.modalPrimary,
                      !exName.trim() && { opacity: 0.55 },
                      pressed && exName.trim() && { opacity: 0.92 },
                    ]}
                  >
                    <Text style={styles.modalPrimaryText}>Add</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAddOpen(false)}
                    style={({ pressed }) => [
                      styles.modalGhost,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.modalGhostText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </View>
        </View>
      </Modal>
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

  addBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 18,
    backgroundColor: withAlpha("#68D7FF", 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#68D7FF", 0.3),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBtnText: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },

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

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
  },
  iconBtnDanger: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha("#FF5C6A", 0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FF5C6A", 0.22),
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalWrap: { padding: 14, paddingBottom: 18 },

  modalTitle: {
    color: withAlpha("#FFFFFF", 0.94),
    fontWeight: "900",
    fontSize: 16,
  },
  modalInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    color: withAlpha("#FFFFFF", 0.92),
    fontWeight: "800",
  },
  modalPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#68D7FF", 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#68D7FF", 0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },
  modalGhost: {
    width: 120,
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha("#FFFFFF", 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#FFFFFF", 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostText: { color: withAlpha("#FFFFFF", 0.88), fontWeight: "900" },
});
