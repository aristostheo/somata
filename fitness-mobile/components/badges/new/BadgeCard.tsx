// components/badges/BadgeCard.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { withAlpha } from "@/lib/color";

type Props = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  unlocked?: boolean;
  accent?: string;
  rightMeta?: string; // e.g. "Rare"
  onPress?: () => void;
};

export default function BadgeCard({
  title,
  subtitle,
  icon,
  unlocked = false,
  accent,
  rightMeta,
  onPress,
}: Props) {
  const { colors, isDark } = useProfileFlowTheme();
  const tone = accent || colors.primary;
  const titleColor = unlocked
    ? colors.text
    : withAlpha(colors.text, isDark ? 0.7 : 0.6);
  const subColor = unlocked
    ? withAlpha(colors.text, isDark ? 0.72 : 0.62)
    : withAlpha(colors.text, isDark ? 0.52 : 0.48);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, rightMeta].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        styles.press,
        pressed && { opacity: 0.65 },
      ]}
    >
      <View style={[styles.card, { borderBottomColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: unlocked ? withAlpha(tone, 0.12) : colors.surface2 }]}>
            <Ionicons name={icon} size={21} color={unlocked ? tone : colors.textTertiary} />
          </View>

          <View style={styles.textCol}>
            <Text
              style={[styles.title, { color: titleColor }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={styles.right}>
            {!!rightMeta && (
              <Text
                style={[
                  styles.meta,
                  { color: withAlpha(colors.text, isDark ? 0.6 : 0.55) },
                ]}
              >
                {rightMeta}
              </Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={withAlpha(colors.text, isDark ? 0.45 : 0.35)}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {},
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
    paddingHorizontal: 2,
    paddingVertical: 10,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600" },
  sub: { marginTop: 2, fontSize: 13, fontWeight: "400" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  meta: { fontSize: 12, fontWeight: "500" },
});
