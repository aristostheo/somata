// app/(auth)/login.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  Text,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTheme } from "@/content/ThemeProvider";
import { useGoogleLogin, signInWithApple } from "@/lib/authSocial";
import { withAlpha } from "@/components/workouts/utils/withAlpha";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW: remember me toggle (default ON; load last choice)
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    (async () => {
      const flag = await AsyncStorage.getItem("@rememberMe");
      if (flag === "0") setRemember(false);
      if (flag === "1") setRemember(true);
    })();
  }, []);
  const persistRemember = async (v: boolean) =>
    AsyncStorage.setItem("@rememberMe", v ? "1" : "0");

  async function onLogin() {
    setErr("");
    setLoading(true);
    try {
      await persistRemember(remember); // save the choice for Gate()
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const disabled = !email.trim() || !pass;

  const { request, signInWithGoogle } = useGoogleLogin();

  return (
    <LinearGradient
      colors={
        isDark
          ? (["#080B12", "#0F1324", "#0C111C"] as const)
          : (["#F6FAFF", "#EEF3FF", "#F6FAFF"] as const)
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* ambient blobs */}
      <LinearGradient
        colors={
          isDark
            ? (["#2563EB22", "#22C55E22"] as const)
            : (["#2563EB33", "#22C55E33"] as const)
        }
        style={{
          position: "absolute",
          top: -60,
          right: -50,
          width: 240,
          height: 240,
          borderRadius: 999,
          transform: [{ rotate: "25deg" }],
        }}
      />
      <LinearGradient
        colors={
          isDark
            ? (["#A855F722", "#F59E0B22"] as const)
            : (["#A855F733", "#F59E0B33"] as const)
        }
        style={{
          position: "absolute",
          bottom: -70,
          left: -60,
          width: 280,
          height: 280,
          borderRadius: 999,
          transform: [{ rotate: "-15deg" }],
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}
      >
        {/* Brand / headline */}
        <View style={{ alignItems: "center", marginBottom: 22 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: isDark ? "#111827" : "#ffffff",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="flash-outline" size={16} color={colors.primary} />
            <Text
              style={{
                fontWeight: "700",
                color: colors.text,
                letterSpacing: 0.3,
              }}
            >
              MacroTrack
            </Text>
            <Text style={{ color: colors.muted }}>beta</Text>
          </View>

          <Text
            style={{
              marginTop: 14,
              fontSize: 30,
              fontWeight: "800",
              color: colors.text,
            }}
          >
            Welcome back
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>
            Sign in to continue your streaks
          </Text>
        </View>

        {/* Glass card */}
        <BlurView
          intensity={isDark ? 30 : 20}
          tint={isDark ? "dark" : "light"}
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: 460,
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              padding: 16,
              backgroundColor: isDark
                ? "rgba(0,0,0,0.35)"
                : "rgba(255,255,255,0.65)",
            }}
          >
            {/* Inputs */}
            <Field
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Password"
              value={pass}
              onChangeText={setPass}
              secureTextEntry={!showPass}
              trailingIcon={showPass ? "eye-off-outline" : "eye-outline"}
              onPressTrailing={() => setShowPass((s) => !s)}
            />

            {/* NEW: Remember me row */}
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons
                  name="lock-open-outline"
                  size={16}
                  color={colors.muted}
                />
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Remember me on this device
                </Text>
              </View>
              <Switch
                value={remember}
                onValueChange={(v) => {
                  setRemember(v);
                  persistRemember(v); // write immediately
                }}
              />
            </View>

            {!!err && (
              <Text
                style={{
                  color: withAlpha(colors.text, 0.9),
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                {err}
              </Text>
            )}

            {/* CTA */}
            <Pressable
              onPress={onLogin}
              disabled={loading || disabled}
              style={({ pressed }) => [
                {
                  marginTop: 12,
                  height: 48,
                  borderRadius: 14,
                  overflow: "hidden",
                  opacity: pressed || loading ? 0.9 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={
                  disabled
                    ? (["#9CA3AF", "#9CA3AF"] as const)
                    : ([colors.primary, "#16a34a"] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "800",
                      letterSpacing: 0.3,
                    }}
                  >
                    Sign in
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginVertical: 14,
              }}
            >
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.border }}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>or</Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.border }}
              />
            </View>

            {/* Social buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SocialButton
                label="Google"
                icon="logo-google"
                onPress={async () => {
                  setErr("");
                  try {
                    if (!request) throw new Error("Google auth not ready");
                    setLoading(true);
                    await persistRemember(remember); // save choice
                    await signInWithGoogle();
                  } catch (e: any) {
                    setErr(e?.message ?? "Google sign-in failed");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
              <SocialButton
                label="Apple"
                icon="logo-apple"
                onPress={async () => {
                  setErr("");
                  try {
                    setLoading(true);
                    await persistRemember(remember); // save choice
                    await signInWithApple();
                  } catch (e: any) {
                    setErr(e?.message ?? "Apple sign-in failed");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </View>

            {/* Footer links */}
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Link href="/register" asChild>
                <Pressable>
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>
                    Create account
                  </Text>
                </Pressable>
              </Link>

              <Link href="/reset" asChild>
                <Pressable>
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>
                    Forgot password?
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** --- Tiny components --- */

function Field({
  icon,
  trailingIcon,
  onPressTrailing,
  ...props
}: {
  icon: keyof typeof Ionicons.glyphMap;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onPressTrailing?: () => void;
} & React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.inputBg,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        marginTop: 10,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.muted} />
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={{
          flex: 1,
          marginLeft: 8,
          color: colors.text,
          fontSize: 16,
        }}
        {...props}
      />
      {trailingIcon ? (
        <Pressable
          hitSlop={12}
          onPress={onPressTrailing}
          style={{ padding: 4, marginLeft: 6 }}
        >
          <Ionicons name={trailingIcon} size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SocialButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          height: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
