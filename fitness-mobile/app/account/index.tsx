import { DeskIntro, DeskSection, DeskColumns, StatusNote } from "@/components/accountSettings/PremiumUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { Button, Heading, Item, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { getAuth, reload, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Text, View } from "react-native";

import { useScreenPalette } from "@/components/accountSettings/Primitives";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";

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

function AccountScreen() {
  const { D, F } = useTaskPresentation();

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
    void reload(user).then(() => { if (active) setVerified(user.emailVerified); }).catch(() => { });
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
    {
      text: "Sign out", style: "destructive", onPress: async () => {
        try { await getAuth().signOut(); }
        catch { Alert.alert("Couldn’t sign out", "Please try again."); }
      }
    },
  ]);

  return (<TaskPage title="Account" section="Your Somata" onBack={back}>

    <Panel accent><Text style={F.eyebrow}>IDENTITY / YOUR ACCOUNT</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
      {photo ? <Image source={{ uri: photo }} accessibilityLabel="Profile photo" style={{ width: 76, height: 76, borderRadius: 38 }} /> : <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: D.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...F.value, color: D.ink }}>{initials(name)}</Text>
      </View>}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={F.heading}>{name}</Text>
        <Text selectable style={F.caption}>{email}</Text>
      </View>
    </View>

    </Panel>{user ? <><DeskSection icon="key-outline" title="Access & security" detail="Manage the sign-in methods already linked to your account.">
      <Item title="Email verification" value={verified === null ? 'Checking…' : verified ? 'Verified' : 'Not verified'} icon="mail-outline" />
      {user.email && verified === false && <Button disabled={busy} label={busy ? 'Sending…' : 'Send verification link'} onPress={verifyEmail} />}
      <Item title="Sign-in methods" detail={providers.length ? providers.map(providerName).join(' · ') : 'No linked providers reported'} icon="key-outline" />
      {providers.includes('password') && !!user.email && <Button disabled={busy} label={busy ? 'Sending…' : 'Reset password'} onPress={recoverPassword} />}
    </DeskSection><DeskSection icon="shield-checkmark-outline" title="Privacy & sharing"><Item title="Friend visibility" detail="Manage the activity visible to your circle" icon="people-outline" onPress={() => router.push('/profile/friend-visibility')} /><Item title="Privacy & support" icon="help-circle-outline" onPress={() => router.push("/account/legal")} /></DeskSection><DeskSection icon="log-out-outline" title="Account actions"><Item title="Delete account" detail="Permanently remove your account and owned server data" icon="trash-outline" onPress={() => router.push('/account/delete')} /><Button danger label="Sign out of this device" onPress={signOut} /></DeskSection></> : <Button primary label="Sign in" onPress={() => router.push('/(auth)/login')} />}
    {!user && <Item title="Privacy & support" icon="help-circle-outline" onPress={() => router.push("/account/legal")} />}
  </TaskPage>
  );
}

export default function PremiumAccountScreen() {
  return <SomataTaskAppearance><AccountScreen /></SomataTaskAppearance>;
}
