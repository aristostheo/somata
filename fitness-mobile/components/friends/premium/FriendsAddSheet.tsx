import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { Button, Field, Heading, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";

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
  const { D, F } = useSomataTheme();

  const { colors, isDark } = useProfileFlowTheme();
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

  return (<TaskSheet title="Grow your circle" visible={open} onClose={onClose}>
    <Text style={F.body}>{privacyNote || 'Connect using an email or UID. Share your UID only with someone you trust.'}</Text>
    <Field label="Email or UID" value={target} onChangeText={setTarget} autoCapitalize="none" autoCorrect={false} />
    <Field label="Nickname · visible only to you" value={displayName} onChangeText={setDisplayName} />
    <Button primary disabled={!canSend || sending} label={sending ? 'Sending…' : 'Send request'} onPress={async () => { Haptics.selectionAsync().catch(() => { }); await onSend(target, displayName); }} />
    <Heading title="Let someone find you" />
    <Button label="Copy my UID" onPress={async () => { if (!myUid) return; await Clipboard.setStringAsync(myUid); Haptics.selectionAsync().catch(() => { }); }} />
    <Button label={showQr ? 'Hide my QR' : 'Show my QR'} onPress={() => setShowQr(v => !v)} />
    {showQr && myUid && <View style={{ alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 20 }}>
      <QRCode value={myUid} size={156} backgroundColor="#FFFFFF" color="#111111" />
      <Text selectable style={{ color: '#111111' }}>{myUid}</Text>
    </View>}
  </TaskSheet>
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
