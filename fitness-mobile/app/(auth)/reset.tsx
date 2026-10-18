import React, { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/authErrorMessage";
import { AuthLink, AuthMessage, AuthPage } from "@/components/somata/AuthUI";
import { Button, Field } from "@/components/somata/TaskUI";

export default function Reset() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  async function onReset() {
    if (busy.current || !email.trim()) return;
    busy.current = true; setLoading(true); setErr(""); setOk("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setOk("If this email has an account, check its inbox for a reset link.");
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") setOk("If this email has an account, check its inbox for a reset link.");
      else setErr(authErrorMessage(error, "Couldn’t send the reset link. Please try again."));
    }
    finally { busy.current = false; setLoading(false); }
  }
  return <AuthPage title="A fresh start." subtitle="Enter the email you use for Somata. We’ll help you get back to your account."
    footer={<><AuthLink label="Back to sign in" disabled={loading} onPress={() => router.replace('/(auth)/login')} /><AuthLink label="Create an account" disabled={loading} onPress={() => router.replace('/(auth)/register')} /></>}>
    <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!loading} returnKeyType="send" onSubmitEditing={() => void onReset()} />
    <AuthMessage message={err} /><AuthMessage message={ok} success />
    <Button primary label={loading ? 'Sending…' : 'Send reset link'} disabled={loading || !email.trim()} onPress={() => void onReset()} />
  </AuthPage>;
}
