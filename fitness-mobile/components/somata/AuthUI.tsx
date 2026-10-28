import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SomataLogo } from "@/components/brand/Brand";
import * as Apple from "expo-apple-authentication";
import { type UserCredential } from "firebase/auth";
import { Button, useAuthColors } from "./AuthControls";
import { isAppleSignInAllowed, isGoogleSignInConfigured, signInWithApple, useGoogleLogin } from "@/lib/authSocial";

export function AuthPage({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  const { colors: C, isDark } = useAuthColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const padding = width < 360 ? 20 : 24;
  // The root stack already reserves the top safe area. Account for that origin
  // in keyboard avoidance without adding the same top inset a second time.
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}
    keyboardVerticalOffset={insets.top}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingLeft: Math.max(padding, insets.left),
        paddingRight: Math.max(padding, insets.right), paddingBottom: insets.bottom + 24 }}>
      <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 20 }}>
        <View style={{ alignItems: "flex-start", flexShrink: 0 }}>
          <SomataLogo size={280} background={isDark ? "dark" : "light"} />
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: C.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>YOUR EVERYDAY, IN MOTION</Text>
          <Text accessibilityRole="header" style={{ color: C.text, fontWeight: "800", fontSize: width < 360 ? 32 : 36, letterSpacing: -1 }}>{title}</Text>
          <Text style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>{subtitle}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {[C.primary, C.coral, C.border].map((color, index) => <View key={index} style={{ flex: index === 0 ? 3 : 1, height: 5, borderRadius: 3, backgroundColor: color }} />)}
          </View>
        </View>
        <View style={{ gap: 16 }}>{children}</View>
        <View style={{ paddingTop: 8, gap: 10 }}>{footer}</View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function AuthMessage({ message, success = false }: { message: string; success?: boolean }) {
  const { colors: C } = useAuthColors();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={{ fontSize: 14, lineHeight: 21, color: success ? C.accent : C.danger }}>{message}</Text> : null;
}

export function AuthLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors: C } = useAuthColors();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    style={({ pressed }) => ({ minHeight: 48, paddingVertical: 14, borderRadius: 12, backgroundColor: pressed ? C.card : "transparent" })}>
    <Text style={{ color: disabled ? C.muted : C.accent, fontSize: 15, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" }}>{label}</Text>
  </Pressable>;
}

type ProviderProps = { busy: boolean; run: (authenticate: () => Promise<UserCredential>) => Promise<void> };
function GoogleButton({ busy, run }: ProviderProps) {
  const { request, signInWithGoogle } = useGoogleLogin();
  return <Button label="Continue with Google" icon="logo-google" disabled={busy || !request} onPress={() => void run(signInWithGoogle)} />;
}

/** Never render a provider that the native runtime/configuration cannot support. */
export function AuthProviders({ busy, run }: ProviderProps) {
  const { isDark } = useAuthColors();
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
