// components/friends/premium/FriendActionsSheet.tsx
// Drop-in ✅ premium action sheet (ping, remove, view profile/meals/workouts, block, report)

import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { withAlpha } from "@/lib/color";

export type FriendAction = {
  key: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function FriendActionsSheet({
  open,
  title,
  subtitle,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions: FriendAction[];
}) {
  const { colors, isDark } = useProfileFlowTheme();

  if (!open) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={[
        styles.overlay,
        { backgroundColor: withAlpha(colors.text, isDark ? 0.45 : 0.18) },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View
        entering={FadeInDown.duration(260)}
        exiting={FadeOutDown.duration(220)}
        style={styles.sheetWrap}
      >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
              },
            ]}
          >
          <BlurView
            intensity={30}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={[
              styles.handle,
              { backgroundColor: withAlpha(colors.text, 0.18) },
            ]}
          />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
              >
                {title || "Friend"}
              </Text>
              {subtitle ? (
                <Text
                  style={[styles.subtitle, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : (
                <Text
                  style={[styles.subtitle, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  Private connection
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: withAlpha(colors.text, pressed ? 0.12 : 0.08),
                  borderColor: colors.glassBorder,
                },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ height: 10 }} />

          <ScrollView contentContainerStyle={{ paddingBottom: 6 }}>
            {actions.map((a) => (
                <Pressable
                key={a.key}
                onPress={() => {
                  if (a.disabled) return;
                  Haptics.selectionAsync();
                  a.onPress();
                }}
                style={({ pressed }) => [
                  styles.action,
                  {
                    opacity: a.disabled ? 0.45 : 1,
                    backgroundColor: withAlpha(colors.text, pressed ? 0.1 : 0.06),
                    borderColor: colors.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.icon,
                    {
                      backgroundColor: withAlpha(
                        a.destructive
                          ? colors.danger
                          : colors.primary,
                        0.18
                      ),
                      borderColor: withAlpha(
                        a.destructive
                          ? colors.danger
                          : colors.primary,
                        0.24
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name={a.icon}
                    size={18}
                    color={a.destructive ? colors.danger : a.disabled ? colors.muted : colors.text}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.actionTitle,
                      { color: a.destructive ? colors.danger : a.disabled ? colors.muted : colors.text },
                    ]}
                  >
                    {a.title}
                  </Text>
                  {a.subtitle ? (
                    <Text style={[styles.actionSub, { color: colors.muted }]}>
                      {a.subtitle}
                    </Text>
                  ) : null}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.footerHint, { color: colors.muted }]}>
            Social without pressure — you decide what’s shared.
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 12,
  },
  sheetWrap: { width: "100%" },
  sheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 14,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 99,
    marginBottom: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontSize: 12.5, fontWeight: "600" },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.2 },
  actionSub: { marginTop: 2, fontSize: 12.5, fontWeight: "600" },
  footerHint: {
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
});
