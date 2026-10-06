// components/exercises/ExercisePreviewSheet.tsx
import React, { useEffect, useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

import type { ExerciseDoc } from "@/services/exercises/types";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

type Props = {
  visible: boolean;
  exercise: ExerciseDoc | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onUse: () => void;
};

const titleize = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ExercisePreviewSheet({
  visible,
  exercise,
  isFavorite,
  onClose,
  onToggleFavorite,
  onUse,
}: Props) {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (visible)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [visible]);

  const meta = useMemo(() => {
    if (!exercise) return "";
    const primary = exercise.primaryMuscles?.[0]
      ? titleize(exercise.primaryMuscles[0])
      : "";
    const equip = exercise.equipment?.[0]
      ? titleize(exercise.equipment[0])
      : "";
    return [primary, equip].filter(Boolean).join(" • ");
  }, [exercise]);

  if (!exercise) return null;

  const gif = exercise.images?.gif;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <MotiView
        from={{ translateY: 30, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: "timing", duration: 220 }}
        style={styles.sheetWrap}
      >
        <BlurView
          intensity={isDark ? 26 : 38}
          tint={isDark ? "dark" : "light"}
          style={[
            styles.sheet,
            {
              backgroundColor: withAlpha(colors.card, isDark ? 0.35 : 0.62),
              borderColor: withAlpha(colors.border, isDark ? 0.6 : 0.7),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>
              <Text
                style={[styles.meta, { color: withAlpha(colors.text, 0.65) }]}
                numberOfLines={1}
              >
                {meta || "Exercise"}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  borderColor: withAlpha(colors.border, 0.7),
                  backgroundColor: withAlpha(
                    colors.card,
                    pressed ? 0.22 : 0.16
                  ),
                },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color={withAlpha(colors.text, 0.8)}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 14 }}
          >
            {gif ? (
              <View
                style={[
                  styles.media,
                  {
                    borderColor: withAlpha(colors.border, 0.65),
                    backgroundColor: withAlpha(
                      colors.card,
                      isDark ? 0.25 : 0.35
                    ),
                  },
                ]}
              >
                <Image
                  source={{ uri: gif }}
                  style={styles.gif}
                  resizeMode="cover"
                  accessibilityLabel="Exercise demo"
                />
              </View>
            ) : null}

            {exercise.primaryMuscles?.length ||
            exercise.secondaryMuscles?.length ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: withAlpha(colors.text, 0.8) },
                  ]}
                >
                  Muscles
                </Text>

                <View style={styles.pills}>
                  {(exercise.primaryMuscles ?? []).slice(0, 6).map((m) => (
                    <View
                      key={`p:${m}`}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: withAlpha(colors.primary, 0.12),
                          borderColor: withAlpha(colors.primary, 0.35),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: withAlpha(colors.text, 0.85) },
                        ]}
                      >
                        {titleize(m)}
                      </Text>
                    </View>
                  ))}

                  {(exercise.secondaryMuscles ?? []).slice(0, 6).map((m) => (
                    <View
                      key={`s:${m}`}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: withAlpha(colors.card, 0.22),
                          borderColor: withAlpha(colors.border, 0.55),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: withAlpha(colors.text, 0.75) },
                        ]}
                      >
                        {titleize(m)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {exercise.instructions?.length ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: withAlpha(colors.text, 0.8) },
                  ]}
                >
                  How to do it
                </Text>
                <View style={{ gap: 8 }}>
                  {exercise.instructions.slice(0, 8).map((c, idx) => (
                    <View key={`${exercise.id}:${idx}`} style={styles.cueRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={withAlpha(colors.primary, 0.9)}
                        style={{ marginTop: Platform.OS === "ios" ? 2 : 3 }}
                      />
                      <Text
                        style={[
                          styles.cueText,
                          { color: withAlpha(colors.text, 0.78) },
                        ]}
                      >
                        {c}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {}
                  );
                  onToggleFavorite();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    borderColor: withAlpha(colors.border, 0.7),
                    backgroundColor: withAlpha(
                      colors.card,
                      pressed ? 0.24 : 0.18
                    ),
                  },
                ]}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={18}
                  color={isFavorite ? "#ff3b30" : withAlpha(colors.text, 0.85)}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: withAlpha(colors.text, 0.9) },
                  ]}
                >
                  {isFavorite ? "Favorited" : "Favorite"}
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                    () => {}
                  );
                  onUse();
                }}
                accessibilityRole="button"
                accessibilityLabel="Use exercise"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: withAlpha(
                      colors.primary,
                      pressed ? 0.85 : 0.95
                    ),
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryText}>Use Exercise</Text>
              </Pressable>
            </View>
          </ScrollView>
        </BlurView>
      </MotiView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetWrap: { position: "absolute", left: 12, right: 12, bottom: 12 },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
    overflow: "hidden",
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "900", letterSpacing: 0.2 },
  meta: { marginTop: 4, fontSize: 12.5, fontWeight: "700" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  gif: { width: "100%", height: "100%" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.25,
    marginBottom: 8,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900" },
  cueRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cueText: { fontSize: 14, fontWeight: "600", lineHeight: 20, flex: 1 },
  actions: { marginTop: 16, gap: 10 },
  actionBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionText: { fontSize: 14.5, fontWeight: "900" },
  primaryBtn: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
