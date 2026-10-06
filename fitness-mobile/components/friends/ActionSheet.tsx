import React from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useTheme } from "@/content/ThemeProvider";

type Action = {
  key: string;
  title: string;
  subtitle?: string;
  icon?: any;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function ActionSheet({
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
  actions: Action[];
}) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <MotiView
          from={{ translateY: 30, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 160 }}
          style={{
            width: "100%",
            paddingHorizontal: 14,
            paddingBottom: Platform.OS === "ios" ? 18 : 12,
          }}
        >
          <BlurView
            intensity={isDark ? 36 : 60}
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.14)"
                : "rgba(0,0,0,0.06)",
              backgroundColor: isDark
                ? "rgba(30,30,30,0.55)"
                : "rgba(255,255,255,0.82)",
            }}
          >
            <View style={{ padding: 16, paddingBottom: 10 }}>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                  letterSpacing: -0.2,
                }}
              >
                {title}
              </Text>
              {!!subtitle && (
                <Text
                  style={{
                    color: colors.muted,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  {subtitle}
                </Text>
              )}
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.06)",
              }}
            />

            <View style={{ padding: 10, gap: 8 }}>
              {actions.map((a) => (
                <Pressable
                  key={a.key}
                  disabled={a.disabled}
                  onPress={() => {
                    onClose();
                    a.onPress?.();
                  }}
                  style={({ pressed }) => ({
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.70)",
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.06)",
                    opacity: a.disabled ? 0.55 : pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={a.title}
                  accessibilityHint={a.subtitle}
                  accessibilityState={{ disabled: !!a.disabled }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: a.destructive
                        ? "rgba(255,70,90,0.18)"
                        : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.04)",
                      borderWidth: 1,
                      borderColor: a.destructive
                        ? "rgba(255,70,90,0.22)"
                        : isDark
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <Ionicons
                      name={a.icon ?? "sparkles-outline"}
                      size={18}
                      color={a.destructive ? "rgba(255,90,110,1)" : colors.text}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: a.destructive
                          ? "rgba(255,90,110,1)"
                          : colors.text,
                        fontWeight: "900",
                        letterSpacing: -0.1,
                      }}
                    >
                      {a.title}
                    </Text>
                    {!!a.subtitle && (
                      <Text style={{ color: colors.muted, marginTop: 2 }}>
                        {a.subtitle}
                      </Text>
                    )}
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
              ))}
            </View>

            <View style={{ padding: 10, paddingTop: 2 }}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  height: 46,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.70)",
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)",
                  opacity: pressed ? 0.92 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Close
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 10 : 6,
  },
});
