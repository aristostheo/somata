import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/content/ThemeProvider";

function withAlpha(color: string, alpha = 0.2) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith("rgb")) {
    const body = color.replace(/^rgba?\(|\)$/g, "");
    const [r, g, b] = body.split(",").map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(
    m[3],
    16
  )}, ${alpha})`;
}

export function PremiumModalHeader({
  title,
  subtitle,
  onClose,
  right,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme() as any;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.handleWrap}>
        <View
          style={[
            styles.handle,
            { backgroundColor: withAlpha(colors.text, 0.16) },
          ]}
        />
      </View>

      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: withAlpha(colors.text, 0.62) }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}

        {onClose ? (
          <Pressable
            onPress={onClose}
            style={[
              styles.closeButton,
              { backgroundColor: withAlpha(colors.card, 0.46) },
            ]}
          >
            <Ionicons name="close" size={17} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function PremiumActionButton({
  label,
  onPress,
  secondary,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme() as any;

  if (secondary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => ({
          height: 50,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(colors.card, 0.4),
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 18,
        overflow: "hidden",
        opacity: disabled ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <LinearGradient
        colors={
          disabled
            ? [withAlpha(colors.border, 0.45), withAlpha(colors.border, 0.32)]
            : [withAlpha("#38bdf8", 0.98), withAlpha(colors.primary, 0.98)]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButtonFill}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export default function PremiumModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  detached = false,
  fullScreen = false,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  detached?: boolean;
  fullScreen?: boolean;
  scroll?: boolean;
}) {
  const { colors, isDark } = useTheme() as any;
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={fullScreen ? { flex: 1 } : undefined}
      contentContainerStyle={{
        gap: 12,
        paddingBottom: footer ? 8 : Math.max(insets.bottom, 12),
        ...(fullScreen ? { flexGrow: 1 } : null),
      }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={fullScreen ? { gap: 12, flex: 1 } : { gap: 12 }}>{children}</View>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlayWrap}>
        <BlurView
          intensity={36}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.34)" }]}
        />

        <MotiView
          from={{
            opacity: 0,
            translateY: fullScreen ? 12 : 22,
            scale: detached ? 0.98 : 1,
          }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          exit={{ opacity: 0, translateY: 12 }}
          transition={{ type: "timing", duration: 240 }}
          style={[
            fullScreen
              ? styles.fullScreenWrap
              : detached
                ? styles.detachedWrap
                : styles.sheetWrap,
            detached
              ? { paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) }
              : null,
          ]}
        >
          <Pressable
            onPress={() => {}}
            style={fullScreen ? { width: "100%", flex: 1 } : { width: "100%" }}
          >
            <View
              style={[
                fullScreen
                  ? [
                      styles.fullScreenSheet,
                      { marginTop: Math.max(insets.top, 10) },
                    ]
                  : detached
                    ? styles.detachedSheet
                    : styles.sheet,
                {
                  backgroundColor:
                    isDark ? withAlpha(colors.card, 0.94) : withAlpha(colors.card, 0.98),
                },
              ]}
            >
              <LinearGradient
                colors={[
                  withAlpha(colors.primary, isDark ? 0.16 : 0.08),
                  withAlpha("#38bdf8", isDark ? 0.08 : 0.04),
                  withAlpha(colors.card, 0.92),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View
                style={{
                  paddingTop: 10,
                  paddingHorizontal: 14,
                  paddingBottom: footer ? 10 : Math.max(insets.bottom, 12),
                  gap: 14,
                  ...(fullScreen ? { flex: 1 } : null),
                }}
              >
                <PremiumModalHeader title={title} subtitle={subtitle} onClose={onClose} />
                {body}
                {footer ? <View style={{ gap: 10 }}>{footer}</View> : null}
              </View>
            </View>
          </Pressable>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetWrap: {
    width: "100%",
  },
  detachedWrap: {
    flex: 1,
    justifyContent: "center",
  },
  fullScreenWrap: {
    flex: 1,
    width: "100%",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 16,
  },
  detachedSheet: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  fullScreenSheet: {
    flex: 1,
    width: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handleWrap: {
    alignItems: "center",
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
  },
});
