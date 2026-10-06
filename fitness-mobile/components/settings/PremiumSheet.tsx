// components/settings/premium/PremiumSheet.tsx
// Drop-in ✅ Premium bottom sheet (calm, blurred, not a cluttered wall)

import React, { ReactNode, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { withAlpha } from "@/lib/color";

export function PremiumSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  colors,
  isDark,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  colors: any;
  isDark: boolean;
}) {
  const y = useSharedValue(28);
  const o = useSharedValue(0);

  useEffect(() => {
    if (open) {
      y.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      o.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      });
    } else {
      y.value = withTiming(28, {
        duration: 180,
        easing: Easing.in(Easing.quad),
      });
      o.value = withTiming(0, {
        duration: 160,
        easing: Easing.in(Easing.quad),
      });
    }
  }, [open, o, y]);

  const backdropA = useAnimatedStyle(() => ({ opacity: o.value }));
  const sheetA = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  const border = withAlpha(colors.text, isDark ? 0.12 : 0.14);
  const bg = withAlpha(colors.card, isDark ? 0.78 : 0.88);
  const sub = withAlpha(colors.text, isDark ? 0.62 : 0.7);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropA]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, sheetA]}>
          <BlurView
            intensity={24}
            tint={isDark ? "dark" : "light"}
            style={[styles.card, { borderColor: border }]}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 10,
              }}
            >
              <View style={styles.grabber} />
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>
              {!!subtitle && (
                <Text style={[styles.sub, { color: sub }]}>{subtitle}</Text>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: 14,
                paddingBottom: Platform.OS === "ios" ? 18 : 16,
              }}
            >
              {children}
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { padding: 12 },
  card: { borderRadius: 22, overflow: "hidden", borderWidth: 1 },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 99,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  sub: { fontSize: 12.5, marginTop: 4, lineHeight: 16 },
});
