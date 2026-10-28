import React, { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, getAdditionalUserInfo, updateProfile, type UserCredential } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/authErrorMessage";
import { AuthLink, AuthMessage, AuthPage, AuthProviders } from "@/components/somata/AuthUI";
import { Button, Field } from "@/components/somata/AuthControls";
import { clearFitAdaptSetupMarker, markFitAdaptSetupForEmail, markFitAdaptSetupForSocial, markFitAdaptSetupForUid } from "@/services/fitadaptOnboarding";
import { createRegistrationRunner } from "@/services/registerFitAdaptAccount";

export default function Register() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);
  const registerOnce = useRef(createRegistrationRunner({
    currentUser: () => auth.currentUser,
    createUser: async (accountEmail, password) => (await createUserWithEmailAndPassword(auth, accountEmail, password)).user,
    markEmail: markFitAdaptSetupForEmail,
    markUid: markFitAdaptSetupForUid,
    saveIdentity: async (account, name) => {
      if (name) await updateProfile(account, { displayName: name });
      const userRef = doc(db, "users", account.uid);
      const existing = await getDoc(userRef);
      if (!existing.exists()) {
        await setDoc(userRef, { email: account.email, displayName: name || null,
          createdAt: serverTimestamp() }, { merge: true });
      } else if (name && !existing.data()?.displayName) {
        await setDoc(userRef, { displayName: name }, { merge: true });
      }
    },
  }));

  async function onRegister() {
    if (busyRef.current) return;
    setErr("");
    if (!email.trim() || pass.length < 6) {
      setErr("Enter a valid email and a password (min 6 chars).");
      return;
    }
    busyRef.current = true;
    setLoading(true);
    try {
      await registerOnce.current({ email, password: pass, displayName });
      router.replace("/fitadapt-setup");
    } catch (e: any) {
      if (!auth.currentUser) await clearFitAdaptSetupMarker().catch(() => {});
      setErr(authErrorMessage(e, "Couldn’t finish account setup. Your entries are still here. Try again."));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  async function socialSignIn(authenticate: () => Promise<UserCredential>) {
    if (busyRef.current) return;
    busyRef.current = true; setLoading(true); setErr("");
    try {
      await markFitAdaptSetupForSocial();
      const credential = await authenticate();
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        await markFitAdaptSetupForUid(credential.user.uid);
        router.replace("/fitadapt-setup");
      } else {
        await clearFitAdaptSetupMarker();
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      if (!auth.currentUser) await clearFitAdaptSetupMarker().catch(() => {});
      if (error?.code !== "ERR_REQUEST_CANCELED" && !/cancelled/i.test(error?.message || "")) setErr(authErrorMessage(error, "Couldn’t sign in. Please try again."));
    } finally { busyRef.current = false; setLoading(false); }
  }
  return <AuthPage title="Make it yours." subtitle="Create your account, set your goals, then review your plan. You choose what to accept."
    footer={<AuthLink label="Already have an account? Sign in" disabled={loading} onPress={() => router.replace('/(auth)/login')} />}>
    <Field label="Name (optional)" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" autoComplete="name" editable={!loading} />
    <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!loading} />
    <Field label="Password · at least 6 characters" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!loading} returnKeyType="go" onSubmitEditing={() => void onRegister()} />
    <AuthMessage message={err} />
    <Button primary label={loading ? 'Creating your account…' : 'Create account'} disabled={loading || !email.trim() || pass.length < 6} onPress={() => void onRegister()} />
    <AuthProviders busy={loading} run={socialSignIn} />
    <AuthLink label="Forgot your password?" disabled={loading} onPress={() => router.push('/(auth)/reset')} />
    <AuthLink label="Privacy & support" disabled={loading} onPress={() => router.push("/account/legal")} />
  </AuthPage>;
}
