// components/account/ThemePickerSheet.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/content/ThemeProvider";

type ThemeMode = "system" | "light" | "dark";

type Props = {
  visible: boolean;
  value: ThemeMode;
  onClose: () => void;
  onChange: (v: ThemeMode) => void;
};

export function ThemePickerSheet({ visible, value, onClose, onChange }: Props) {
  const { isDark, colors } = useTheme();

  const Card: any = Platform.OS === "ios" ? BlurView : View;
  const cardProps =
    Platform.OS === "ios"
      ? { intensity: isDark ? 28 : 18, tint: isDark ? "dark" : "light" }
      : {};

  const Option = ({ id, label }: { id: ThemeMode; label: string }) => {
    const selected = value === id;
    return (
      <Pressable
        onPress={() => onChange(id)}
        accessibilityRole="button"
        accessibilityLabel={`Theme: ${label}`}
        style={({ pressed }) => [
          styles.option,
          { borderBottomColor: colors.border },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.optLabel, { color: colors.text }]}>{label}</Text>
        {selected ? (
          <Ionicons name="checkmark" size={18} color={colors.primary} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close theme picker"
      />

      <View style={styles.sheetWrap} pointerEvents="box-none">
        <Card
          {...cardProps}
          style={[styles.sheet, { borderColor: colors.glassBorder }]}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Appearance
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Choose how the app looks.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(11,18,32,0.06)",
                },
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <Option id="system" label="System" />
            <Option id="light" label="Light" />
            <Option id="dark" label="Dark" />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  sheet: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
});
