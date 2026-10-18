import { useRef, useState } from "react";
import { Alert, Text } from "react-native";
import { useRouter } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Button, Empty, Field, Heading, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { useAuth } from "@/content/AuthContext";
import { auth } from "@/lib/firebase";
import { isAppleSignInAllowed, isGoogleSignInConfigured, signInWithApple, useGoogleLogin } from "@/lib/authSocial";
import { clearDeletedAccountDeviceData, deleteCurrentAccount } from "@/services/account/deletion";
import { deletionError } from "@/services/account/deletionData";

function GoogleVerify({ onVerified, onError, disabled }: { onVerified: () => void; onError: () => void; disabled: boolean }) {
  const { reauthenticateGoogle } = useGoogleLogin();
  return <Button label="Verify with Google" disabled={disabled} onPress={() => { void reauthenticateGoogle().then(onVerified).catch(onError); }} />;
}
export default function DeleteAccountScreen() {
  const { user } = useAuth(); const router = useRouter(); const { F } = useSomataTheme();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [verifiedUid, setVerifiedUid] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [deletedUid, setDeletedUid] = useState("");
  const lock = useRef(false);
  const providers = user?.providerData.map(p => p.providerId) ?? [];
  const verified = () => { setVerifiedUid(auth.currentUser?.uid || ""); setError(""); };
  const verifyError = () => setError("Sign-in verification failed or was cancelled. Your account has not been deleted.");
  async function verifyPassword() {
    if (!user?.email || busy) return;
    setBusy(true);
    try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password)); setPassword(""); verified(); }
    catch { verifyError(); } finally { setBusy(false); }
  }
  async function finishLocal(uid: string) {
    try { await clearDeletedAccountDeviceData(uid); if (auth.currentUser?.uid === uid) await auth.signOut(); router.replace('/(auth)/login'); }
    catch { setError("The server account was deleted, but this device's account-scoped cache cleanup or sign-out failed. Retry device cleanup below."); }
  }
  function confirmDelete() {
    if (!user || verifiedUid !== user.uid || confirmation !== "DELETE" || lock.current) return;
    const uid = user.uid;
    Alert.alert("Permanently delete this account?", "This removes your account-owned server data and sign-in. Cleanup cannot be undone once it starts. Partial cleanup may require a retry.", [
      { text: "Cancel", style: "cancel" }, { text: "Delete my account", style: "destructive", onPress: async () => {
        if (lock.current || auth.currentUser?.uid !== uid) return;
        lock.current = true; setBusy(true); setError("");
        try { await deleteCurrentAccount(uid); setDeletedUid(uid); await finishLocal(uid); }
        catch (e) { setError(deletionError(e)); }
        finally { lock.current = false; setBusy(false); }
      } },
    ]);
  }
  return <TaskPage title="Delete account" section="Account security" onBack={() => { if (!busy) router.back(); }}>
    <Panel><Heading title="What is removed" detail="Your saved profile, fitness logs, plans, proposal history, account-scoped server records and app-created connection references. Your Firebase sign-in is removed last." />
      <Text style={F.body}>Shared AI caches, safety records or files with uncertain ownership can pause deletion for an operator review. No other account’s fitness records are deleted.</Text>
      <Text style={F.body}>New account-scoped device records and progress-photo files are cleared on this device after server deletion. Older records without verified account ownership remain isolated and hidden; they cannot safely be assigned or erased as yours. Copies saved by other people and data in Apple Health or other providers are not recalled.</Text>
      <Text style={F.body}>A minimal account-deletion marker remains to prevent delayed writes. This action does not revoke Apple or Google authorization or remove provider backups and logs.</Text>
    </Panel>
    <Button label="Privacy & support" disabled={busy} onPress={() => router.push('/account/legal')} />
    {!!error && <Empty title={deletedUid ? "Device cleanup needs a retry" : "Deletion has not completed"} detail={error} />}
    {deletedUid ? <Button label="Retry device cleanup and sign out" onPress={() => { void finishLocal(deletedUid); }} /> : user ? <>
      <Heading title="1. Verify your sign-in" detail="Verification must be within five minutes of deletion. Your password is sent only to Firebase Auth." />
      {providers.includes("password") && <><Field label="Current password" secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" /><Button disabled={busy || !password} label="Verify password" onPress={() => { void verifyPassword(); }} /></>}
      {providers.includes("google.com") && isGoogleSignInConfigured() && <GoogleVerify disabled={busy} onVerified={verified} onError={verifyError} />}
      {providers.includes("apple.com") && isAppleSignInAllowed() && <Button disabled={busy} label="Verify with Apple" onPress={() => { void signInWithApple(true).then(verified).catch(verifyError); }} />}
      {!providers.includes("password") && !(providers.includes("apple.com") && isAppleSignInAllowed()) && !(providers.includes("google.com") && isGoogleSignInConfigured()) && <Empty title="Sign-in verification is unavailable on this build" detail="Use a build configured for your linked sign-in provider. No deletion will run without verification." />}
      {verifiedUid === user.uid && <Text accessibilityLiveRegion="polite" style={F.body}>Sign-in verified.</Text>}
      <Heading title="2. Confirm permanent deletion" detail="Type DELETE. You will also confirm in a final dialog." />
      <Field label="Type DELETE" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!busy} />
      <Button danger label={busy ? "Cleaning up account…" : "Delete my account / resume cleanup"} disabled={busy || verifiedUid !== user.uid || confirmation !== "DELETE"} onPress={confirmDelete} />
    </> : <Empty title="Sign in to delete your own account" />}
  </TaskPage>;
}
