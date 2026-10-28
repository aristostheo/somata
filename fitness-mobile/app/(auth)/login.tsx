import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { getAdditionalUserInfo, signInWithEmailAndPassword, type UserCredential } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/authErrorMessage";
import { AuthLink, AuthMessage, AuthPage, AuthProviders } from "@/components/somata/AuthUI";
import { Button, Field, IconButton, Toggle } from "@/components/somata/AuthControls";
import { clearFitAdaptSetupMarker, markFitAdaptSetupForSocial, markFitAdaptSetupForUid } from "@/services/fitadaptOnboarding";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("@rememberMe").then(flag => { if (active && flag !== null) setRemember(flag !== "0"); }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function run(authenticate?: () => Promise<UserCredential>) {
    if (busy.current || (!authenticate && (!email.trim() || !pass))) return;
    busy.current = true; setLoading(true); setErr("");
    try {
      await AsyncStorage.setItem("@rememberMe", remember ? "1" : "0");
      if (authenticate) {
        await markFitAdaptSetupForSocial();
        const credential = await authenticate();
        if (getAdditionalUserInfo(credential)?.isNewUser) {
          await markFitAdaptSetupForUid(credential.user.uid);
          router.replace("/fitadapt-setup");
        } else {
          await clearFitAdaptSetupMarker();
          router.replace("/(tabs)");
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      if (authenticate && !auth.currentUser) await clearFitAdaptSetupMarker().catch(() => {});
      if (error?.code !== "ERR_REQUEST_CANCELED" && !/cancelled/i.test(error?.message || "")) setErr(authErrorMessage(error, "Couldn’t sign in. Please try again."));
    } finally { busy.current = false; setLoading(false); }
  }
  return <AuthPage title="Welcome back." subtitle="Your goals, your training, your next step. Pick up where you left off."
    footer={<AuthLink label="New to Somata? Create an account" disabled={loading} onPress={() => router.push('/(auth)/register')} />}>
    <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!loading} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
      <View style={{ flex: 1 }}><Field label="Password" value={pass} onChangeText={setPass} secureTextEntry={!showPass} autoComplete="current-password" autoCapitalize="none" editable={!loading} onSubmitEditing={() => void run()} returnKeyType="go" /></View>
      <IconButton label={showPass ? 'Hide password' : 'Show password'} icon={showPass ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPass(value => !value)} />
    </View>
    <Toggle title="Keep me signed in" detail="Only on a device you trust." value={remember} onChange={setRemember} disabled={loading} />
    <AuthMessage message={err} />
    <Button primary label={loading ? 'Signing in…' : 'Sign in'} disabled={loading || !email.trim() || !pass} onPress={() => void run()} />
    <AuthLink label="Forgot your password?" disabled={loading} onPress={() => router.push('/(auth)/reset')} />
    <AuthProviders busy={loading} run={run} />
    <AuthLink label="Privacy & support" disabled={loading} onPress={() => router.push("/account/legal")} />
  </AuthPage>;
}
