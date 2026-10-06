import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { getAuth, reload, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";

import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";
import { Row, Screen, Section, useScreenPalette } from "@/components/accountSettings/Primitives";

function providerName(id: string) {
  if (id === "password") return "Email and password";
  if (id === "google.com") return "Google";
  if (id === "apple.com") return "Apple";
  if (id === "facebook.com") return "Facebook";
  return id;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "Y").toUpperCase();
}

export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = useScreenPalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) { setProfile(null); return; }
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);

  useFocusEffect(useCallback(() => {
    if (!user) { setVerified(null); return; }
    let active = true;
    setVerified(user.emailVerified);
    void reload(user).then(() => { if (active) setVerified(user.emailVerified); }).catch(() => {});
    return () => { active = false; };
  }, [user]));

  const providers = useMemo(() => [...new Set((user?.providerData ?? []).map((provider) => provider.providerId).filter(Boolean))], [user?.providerData]);
  const name = profile?.displayName?.trim() || user?.displayName?.trim() || "Your account";
  const email = profile?.email || user?.email || "No email address";
  const photo = profile?.photoURL || user?.photoURL;
  const back = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");

  const verifyEmail = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await sendEmailVerification(user);
      Alert.alert("Verification email sent", "Check your inbox for the verification link.");
    } catch (error: any) {
      Alert.alert("Couldn’t send verification email", error?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const recoverPassword = async () => {
    if (!user?.email || busy) return;
    setBusy(true);
    try {
      await sendPasswordResetEmail(getAuth(), user.email);
      Alert.alert("Password reset email sent", "Check your inbox for the reset link.");
    } catch (error: any) {
      Alert.alert("Couldn’t send reset email", error?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => Alert.alert("Sign out?", "You can sign back in anytime.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: async () => {
      try { await getAuth().signOut(); }
      catch { Alert.alert("Couldn’t sign out", "Please try again."); }
    } },
  ]);

  return (
    <Screen title="Account" intro="Your identity, access, and sharing." onBack={back} palette={palette}>
      <Section title="Identity" palette={palette}>
        <View style={{ minHeight: 82, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 12 }}>
          <LinearGradient colors={[palette.primary, palette.accent]} style={{ width: 64, height: 64, borderRadius: 21, alignItems: "center", justifyContent: "center" }}>
            {photo ? <Image source={{ uri: photo }} accessibilityLabel="Profile photo" style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: palette.card }} /> : <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>{initials(name)}</Text></View>}
          </LinearGradient>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>{name}</Text>
            <Text style={{ color: palette.secondary, fontSize: 14 }}>{email}</Text>
          </View>
        </View>
        {user ? <Row title="Email verification" detail={verified === null ? "Checking status" : verified ? "Verified" : "Not verified"} icon="mail-outline" palette={palette} last={verified !== false || !user.email} /> : <Row title="Sign in" detail="Access your account" icon="log-in-outline" onPress={() => router.push("/(auth)/login")} palette={palette} last />}
        {user?.email && verified === false && <Row title="Verify email" detail={busy ? "Sending…" : "Send a verification link"} icon="checkmark-circle-outline" onPress={busy ? undefined : verifyEmail} palette={palette} last />}
      </Section>

      {!!user && <Section title="Security" palette={palette}>
        <Row title="Sign-in methods" detail={providers.length ? providers.map(providerName).join(" · ") : "No linked providers reported"} icon="key-outline" palette={palette} last={!providers.includes("password") || !user.email} />
        {providers.includes("password") && !!user.email && <Row title="Reset password" detail={busy ? "Sending…" : "Send a reset link to your email"} icon="lock-closed-outline" onPress={busy ? undefined : recoverPassword} palette={palette} last />}
      </Section>}

      {!!user && <Section title="Sharing privacy" palette={palette}>
        <Row title="Friend visibility" detail="Choose what friends can see" icon="people-outline" onPress={() => router.push("/profile/friend-visibility")} palette={palette} last />
      </Section>}

      {!!user && <View style={{ marginTop: 8 }}><Section title="Session" palette={palette}>
        <Row title="Sign out" detail="Sign out on this device" icon="log-out-outline" onPress={signOut} palette={palette} danger last />
      </Section></View>}
    </Screen>
  );
}
