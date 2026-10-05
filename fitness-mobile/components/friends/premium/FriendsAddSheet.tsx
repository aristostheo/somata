import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

export function FriendsAddSheet({
  open,
  onClose,
  onSend,
  sending,
  disabled,
  privacyNote,
  myUid,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (target: string, displayName: string) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
  privacyNote?: string;
  myUid?: string;
}) {
  const { colors, isDark } = useTheme() as any;
  const [target, setTarget] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget("");
    setDisplayName("");
    setShowQr(false);
  }, [open]);

  const canSend = useMemo(() => {
    const t = target.trim();
    if (!t || disabled) return false;
    const looksLikeEmail = /\S+@\S+\.\S+/.test(t);
    const looksLikeUid = t.length >= 6 && !t.includes(" ");
    return looksLikeEmail || looksLikeUid;
  }, [target, disabled]);

  if (!open) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={[styles.overlay, { backgroundColor: withAlpha(colors.textPrimary, isDark ? 0.5 : 0.16) }]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(220)}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.borderElevated,
                shadowColor: colors.textPrimary,
                shadowOpacity: isDark ? 0 : 0.08,
                shadowRadius: isDark ? 0 : 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: isDark ? 0 : 2,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.surface3 }]} />

            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Add friend</Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                  {privacyNote || "Requests are private. No public search directory."}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.surface3, borderColor: colors.border }]}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.utilityRow}>
              <Pressable
                onPress={async () => {
                  if (!myUid) return;
                  await Clipboard.setStringAsync(myUid);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={[styles.utilityButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              >
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.utilityText, { color: colors.textSecondary }]}>Copy my UID</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowQr((value) => !value)}
                style={[styles.utilityButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              >
                <Ionicons name="qr-code-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.utilityText, { color: colors.textSecondary }]}>Show my QR</Text>
              </Pressable>
            </View>

            {showQr && myUid ? (
              <View style={[styles.qrWrap, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <QRCode value={myUid} size={156} backgroundColor={colors.surface1} color={colors.textPrimary} />
                <Text style={[styles.qrUid, { color: colors.textTertiary }]} numberOfLines={1}>
                  {myUid}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.textTertiary }]}>EMAIL OR UID</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <TextInput
                value={target}
                onChangeText={setTarget}
                placeholder="name@email.com or user UID"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.textTertiary }]}>DISPLAY NAME</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your nickname for them (only you see this)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>

            <Pressable
              disabled={!canSend || sending}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => {});
                await onSend(target, displayName);
              }}
              style={[
                styles.sendButton,
                {
                  backgroundColor: canSend && !sending ? colors.accent : colors.surface3,
                  borderColor: canSend && !sending ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.sendText,
                  { color: canSend && !sending ? colors.surface1 : colors.textTertiary },
                ]}
              >
                {sending ? "Sending…" : "Send request"}
              </Text>
            </Pressable>

            <Text style={[styles.privacyHint, { color: colors.textTertiary }]}>
              Tip: Share your UID privately with someone you trust.
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 12,
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  handle: {
    alignSelf: "center",
    width: 32,
    height: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "500",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "300",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  utilityButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  utilityText: {
    fontSize: 12,
    fontWeight: "400",
  },
  qrWrap: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  qrUid: {
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  label: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputWrap: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  input: {
    fontSize: 14,
    fontWeight: "400",
  },
  sendButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sendText: {
    fontSize: 14,
    fontWeight: "500",
  },
  privacyHint: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "300",
    fontStyle: "italic",
  },
});
