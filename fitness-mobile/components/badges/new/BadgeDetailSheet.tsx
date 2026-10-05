// components/badges/BadgeDetailSheet.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";
import BadgeMedallion from "./BadgeMedalion";

type Props = {
  visible: boolean;
  onClose: () => void;

  title: string;
  subtitle?: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;

  unlocked?: boolean;
  unlockedAt?: number;

  rarity?: string;
  categoryLabel?: string;

  criteriaText: string[];
  canFeature?: boolean;
  isFeatured?: boolean;
  onToggleFeature?: () => void;
};

export default function BadgeDetailSheet(props: Props) {
  const { colors, isDark } = useTheme();

  const bg = useMemo(
    () => (isDark ? withAlpha("#060B14", 0.72) : withAlpha("#FFFFFF", 0.82)),
    [isDark]
  );
  const border = useMemo(
    () => withAlpha(colors.border, isDark ? 0.22 : 0.18),
    [colors.border, isDark]
  );

  const unlockedDate = props.unlockedAt ? new Date(props.unlockedAt) : null;
  const unlockedText = unlockedDate
    ? unlockedDate.toLocaleDateString()
    : undefined;

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <View />
      </Pressable>

      <View style={styles.wrap}>
        <View style={[styles.card, { borderColor: border }]}>
          <BlurView
            intensity={isDark ? 18 : 28}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />

          <View style={styles.headerRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <BadgeMedallion
                icon={props.icon}
                accent={props.accent}
                unlocked={!!props.unlocked}
                size={56}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.title, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {props.title}
                </Text>
                {!!props.subtitle && (
                  <Text
                    style={[
                      styles.sub,
                      { color: withAlpha(colors.text, isDark ? 0.7 : 0.6) },
                    ]}
                    numberOfLines={1}
                  >
                    {props.subtitle}
                  </Text>
                )}
              </View>
            </View>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                props.onClose();
              }}
              hitSlop={12}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons
                name="close"
                size={20}
                color={withAlpha(colors.text, isDark ? 0.75 : 0.6)}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingBottom: Platform.OS === "ios" ? 16 : 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.desc,
                { color: withAlpha(colors.text, isDark ? 0.8 : 0.72) },
              ]}
            >
              {props.description}
            </Text>

            <View style={styles.pillsRow}>
              {!!props.categoryLabel && (
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: withAlpha(
                        colors.card,
                        isDark ? 0.14 : 0.18
                      ),
                      borderColor: border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: withAlpha(colors.text, 0.75) },
                    ]}
                  >
                    {props.categoryLabel}
                  </Text>
                </View>
              )}
              {!!props.rarity && (
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: withAlpha(
                        colors.card,
                        isDark ? 0.14 : 0.18
                      ),
                      borderColor: border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: withAlpha(colors.text, 0.75) },
                    ]}
                  >
                    {props.rarity}
                  </Text>
                </View>
              )}
              {props.unlocked ? (
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: withAlpha(
                        props.accent || "#FFFFFF",
                        isDark ? 0.16 : 0.1
                      ),
                      borderColor: border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: withAlpha(colors.text, 0.8) },
                    ]}
                  >
                    Unlocked {unlockedText ? `• ${unlockedText}` : ""}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: withAlpha("#000", isDark ? 0.12 : 0.06),
                      borderColor: border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: withAlpha(colors.text, 0.6) },
                    ]}
                  >
                    Locked
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.section, { borderColor: border }]}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: withAlpha(colors.text, isDark ? 0.85 : 0.75) },
                ]}
              >
                How it’s earned
              </Text>
              <View style={{ marginTop: 8, gap: 8 }}>
                {props.criteriaText.map((t, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 10 }}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={withAlpha(colors.text, isDark ? 0.55 : 0.45)}
                    />
                    <Text
                      style={[
                        styles.bullet,
                        { color: withAlpha(colors.text, isDark ? 0.78 : 0.7) },
                      ]}
                    >
                      {t}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {!!props.canFeature && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  props.onToggleFeature?.();
                }}
                style={({ pressed }) => [
                  styles.featureBtn,
                  {
                    borderColor: border,
                    backgroundColor: withAlpha(
                      props.accent || colors.card,
                      isDark ? 0.16 : 0.12
                    ),
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={props.isFeatured ? "star" : "star-outline"}
                  size={18}
                  color={withAlpha(colors.text, isDark ? 0.85 : 0.75)}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: withAlpha(colors.text, isDark ? 0.88 : 0.8) },
                  ]}
                >
                  {props.isFeatured
                    ? "Featured on profile"
                    : "Feature on profile"}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  wrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    padding: 14,
    maxHeight: "82%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800" },
  sub: { marginTop: 3, fontSize: 13, fontWeight: "700" },
  desc: { fontSize: 14, fontWeight: "600", lineHeight: 20, marginBottom: 12 },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "800" },
  section: { borderWidth: 1, borderRadius: 18, padding: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "900" },
  bullet: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  featureBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  featureText: { fontSize: 13, fontWeight: "900" },
});
