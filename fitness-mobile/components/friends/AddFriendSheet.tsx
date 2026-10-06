import React, { useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import { BlurView } from "expo-blur";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/content/ThemeProvider";

export function AddFriendSheet({
  open,
  onClose,
  onSend,
  sending,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (target: string, displayName: string) => Promise<void> | void;
  sending?: boolean;
  disabled?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const [target, setTarget] = useState("");
  const [displayName, setDisplayName] = useState("");

  const canSend = target.trim().length > 0 && !sending && !disabled;

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
            <View
              style={{
                padding: 16,
                paddingBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)",
                }}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={colors.text}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 16,
                    letterSpacing: -0.2,
                  }}
                >
                  Add a friend
                </Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>
                  Use their UID or email (private & respectful)
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
              <Input
                label="Friend UID or email"
                placeholder="e.g. 8FJk... or alex@email.com"
                value={target}
                onChangeText={setTarget}
              />
              <Input
                label="Display name (optional)"
                placeholder="e.g. Alex"
                value={displayName}
                onChangeText={setDisplayName}
              />

              <Pressable
                disabled={!canSend}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await onSend(target, displayName);
                  setTarget("");
                  setDisplayName("");
                }}
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend
                    ? colors.primary
                    : "rgba(150,150,150,0.22)",
                  opacity: pressed ? 0.92 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={
                  sending ? "Sending friend request" : "Send friend request"
                }
                accessibilityState={{ disabled: !canSend }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "900",
                    letterSpacing: -0.1,
                  }}
                >
                  {sending ? "Sending..." : "Send friend request"}
                </Text>
              </Pressable>

              {disabled ? (
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Sign in to add friends.
                </Text>
              ) : null}
            </View>
          </BlurView>
        </MotiView>
      </View>
    </Modal>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 12 }}>
        {label}
      </Text>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
          backgroundColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.70)",
          paddingHorizontal: 12,
          height: 46,
          justifyContent: "center",
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"
          }
          style={{
            color: colors.text,
            fontWeight: "800",
            letterSpacing: -0.1,
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 10 : 6,
  },
});
