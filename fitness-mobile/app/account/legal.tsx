import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, Empty, TaskPage } from '@/components/somata/TaskUI';
import { releaseConfig } from '@/lib/releaseConfig';

/** Operator-owned destinations only. This screen does not supply legal wording. */
export default function PrivacySupportScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function open(url: string | null) {
    if (!url || busy) return;
    setBusy(true);
    try { await WebBrowser.openBrowserAsync(url); }
    catch { Alert.alert('Could not open this page', 'Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <TaskPage title="Privacy & support" section="Somata" onBack={() => router.canGoBack() ? router.back() : router.replace('/account')}>
    {releaseConfig.privacyPolicyUrl
      ? <Button label="Privacy policy" disabled={busy} onPress={() => void open(releaseConfig.privacyPolicyUrl)} />
      : <Empty title="Privacy policy unavailable" detail="A privacy policy has not been configured for this build." />}
    {releaseConfig.supportUrl
      ? <Button label="Contact support" disabled={busy} onPress={() => void open(releaseConfig.supportUrl)} />
      : <Empty title="Support unavailable" detail="A support destination has not been configured for this build." />}
  </TaskPage>;
}
