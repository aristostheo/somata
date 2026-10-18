import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Apple from "expo-apple-authentication";
import { type UserCredential } from "firebase/auth";
import { Button } from "./TaskUI";
import { useSomataTheme } from "./theme";
import { isAppleSignInAllowed, isGoogleSignInConfigured, signInWithApple, useGoogleLogin } from "@/lib/authSocial";

export function AuthPage({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  const { D, F } = useSomataTheme();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: D.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", gap: 26 }}>
        <View style={{ ...F.row, justifyContent: "flex-start", paddingTop: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: D.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="pulse" size={28} color={D.onPrimary} />
          </View>
          <Text style={{ ...F.heading, letterSpacing: 2 }}>SOMATA</Text>
        </View>
        <View style={{ gap: 12, paddingTop: 18 }}>
          <Text style={F.eyebrow}>YOUR EVERYDAY, IN MOTION</Text>
          <Text accessibilityRole="header" style={{ ...F.title, fontSize: 40 }}>{title}</Text>
          <Text style={F.body}>{subtitle}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {[D.teal, D.lime, D.raised].map((color, index) => <View key={index} style={{ flex: index === 0 ? 3 : 1, height: 5, borderRadius: 3, backgroundColor: color }} />)}
          </View>
        </View>
        <View style={{ gap: 18 }}>{children}</View>
        <View style={{ marginTop: "auto", paddingTop: 12, gap: 10 }}>{footer}</View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function AuthMessage({ message, success = false }: { message: string; success?: boolean }) {
  const { D, F } = useSomataTheme();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ ...F.body, color: success ? D.teal : D.danger }}>{message}</Text> : null;
}

export function AuthLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { D } = useSomataTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    style={({ pressed }) => ({ minHeight: 48, paddingVertical: 14, opacity: disabled || pressed ? 0.5 : 1 })}>
    <Text style={{ color: D.teal, fontSize: 15, fontWeight: "700", textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

type ProviderProps = { busy: boolean; run: (authenticate: () => Promise<UserCredential>) => Promise<void> };
function GoogleButton({ busy, run }: ProviderProps) {
  const { request, signInWithGoogle } = useGoogleLogin();
  return <Button label="Continue with Google" icon="logo-google" disabled={busy || !request} onPress={() => void run(signInWithGoogle)} />;
}

/** Never render a provider that the native runtime/configuration cannot support. */
export function AuthProviders({ busy, run }: ProviderProps) {
  const { isDark } = useSomataTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === "ios" && isAppleSignInAllowed()) void Apple.isAvailableAsync().then(value => { if (mounted) setAppleAvailable(value); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return <View style={{ gap: 12 }}>
    {isGoogleSignInConfigured() && <GoogleButton busy={busy} run={run} />}
    {appleAvailable && isAppleSignInAllowed() && <View accessibilityState={{ disabled: busy }} pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy ? 0.5 : 1 }}>
      <Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={isDark ? Apple.AppleAuthenticationButtonStyle.WHITE : Apple.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16} style={{ height: 52, width: "100%" }} onPress={() => { if (!busy) void run(signInWithApple); }} />
    </View>}
  </View>;
}
