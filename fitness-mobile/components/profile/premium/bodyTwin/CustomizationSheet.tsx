// components/bodyTwin/CustomizationSheet.tsx
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";
import type { BodyTwinStyle } from "@/services/profile/bodyTwin/new/types";

const Row = ({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) => {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {right}
      <Ionicons
        name="chevron-forward"
        size={18}
        color="rgba(255,255,255,0.55)"
      />
    </Pressable>
  );
};

const ChoiceChips = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange: (k: string) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.key);
            }}
            style={[
              styles.chip,
              {
                borderColor: withAlpha(colors.text, active ? 0.22 : 0.1),
                backgroundColor: active
                  ? withAlpha(colors.text, 0.08)
                  : withAlpha(colors.card, 0.08),
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: withAlpha(colors.text, active ? 0.92 : 0.72) },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export function CustomizationSheet({
  visible,
  onClose,
  style,
  onChangeStyle,
}: {
  visible: boolean;
  onClose: () => void;
  style: BodyTwinStyle;
  onChangeStyle: (patch: Partial<BodyTwinStyle>) => void;
}) {
  const { colors, isDark } = useTheme();

  const skinOptions = useMemo(
    () => [
      { key: "porcelain", label: "Porcelain" },
      { key: "light", label: "Light" },
      { key: "medium", label: "Medium" },
      { key: "tan", label: "Tan" },
      { key: "deep", label: "Deep" },
    ],
    []
  );

  const hairOptions = useMemo(
    () => [
      { key: "buzz", label: "Buzz" },
      { key: "short", label: "Short" },
      { key: "medium", label: "Medium" },
      { key: "long", label: "Long" },
      { key: "curly", label: "Curly" },
    ],
    []
  );

  const outfitOptions = useMemo(
    () => [
      { key: "tee", label: "Tee" },
      { key: "hoodie", label: "Hoodie" },
      { key: "tank", label: "Tank" },
      { key: "athleisure", label: "Athleisure" },
    ],
    []
  );

  const vibeOptions = useMemo(
    () => [
      { key: "calm", label: "Calm" },
      { key: "sport", label: "Sport" },
      { key: "sleek", label: "Sleek" },
    ],
    []
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(180)}
        style={styles.sheetWrap}
      >
        <BlurView
          intensity={26}
          tint={isDark ? "dark" : "light"}
          style={[styles.sheet, { borderColor: withAlpha(colors.text, 0.1) }]}
        >
          <View style={styles.header}>
            <View>
              <Text
                style={[styles.title, { color: withAlpha(colors.text, 0.96) }]}
              >
                Customize
              </Text>
              <Text
                style={[styles.sub, { color: withAlpha(colors.text, 0.68) }]}
              >
                Personalization only — not perfection.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={[
                styles.closeBtn,
                { backgroundColor: withAlpha(colors.card, 0.16) },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color={withAlpha(colors.text, 0.85)}
              />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.86) },
              ]}
            >
              Skin tone
            </Text>
            <ChoiceChips
              value={style.skinTone}
              options={skinOptions}
              onChange={(k) => onChangeStyle({ skinTone: k as any })}
            />
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.86) },
              ]}
            >
              Hair
            </Text>
            <ChoiceChips
              value={style.hair}
              options={hairOptions}
              onChange={(k) => onChangeStyle({ hair: k as any })}
            />
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.86) },
              ]}
            >
              Outfit
            </Text>
            <ChoiceChips
              value={style.outfit}
              options={outfitOptions}
              onChange={(k) => onChangeStyle({ outfit: k as any })}
            />
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: withAlpha(colors.text, 0.86) },
              ]}
            >
              Vibe
            </Text>
            <ChoiceChips
              value={style.vibe}
              options={vibeOptions}
              onChange={(k) => onChangeStyle({ vibe: k as any })}
            />
          </View>

          <View style={styles.footerNote}>
            <Ionicons
              name="heart"
              size={14}
              color={withAlpha(colors.text, 0.62)}
            />
            <Text
              style={[styles.note, { color: withAlpha(colors.text, 0.64) }]}
            >
              Body Twin is designed to feel supportive. If it ever feels like
              pressure, you can pause it anytime in Settings.
            </Text>
          </View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  sheet: {
    borderRadius: 26,
    padding: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: 0.2 },
  sub: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { paddingTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowTitle: { color: "white", fontSize: 15, fontWeight: "800" },
  rowSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
  },
  footerNote: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    alignItems: "flex-start",
  },
  note: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
