import { Button, Heading, Item, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { releaseConfig } from "@/lib/releaseConfig";
import { requestCheckout } from "@/services/checkout";
import { useEntitlements } from "@/content/useEntitlements";
import { auth, functions } from "@/lib/firebase";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { httpsCallable } from "firebase/functions";
import { useRef, useState } from "react";
import { Alert, Text } from "react-native";


export default function PaywallScreen() {
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const { isPro, loading } = useEntitlements();
  const [working, setWorking] = useState(false);
  const checkoutLock = useRef(false);

  const benefits = [
    "AI meal description & calorie estimates",
    "AI meal generator",
    "Coach Spark workout generator",
    "Workout templates & apply",
    "AI exercise calorie estimates",
    "AI suggestions on Home",
  ];

  async function startCheckout() {
    if (!releaseConfig.checkoutEnabled || checkoutLock.current || loading || isPro) return;
    checkoutLock.current = true;
    setWorking(true);
    try {
      await requestCheckout(releaseConfig, {
        currentUid: () => auth.currentUser?.uid ?? null,
        createSession: async priceId => {
          const result = await httpsCallable(functions, "createCheckoutSession", { timeout: 30000 })({ priceId });
          return result.data;
        },
        openUrl: url => WebBrowser.openBrowserAsync(url),
      });
    } catch {
      Alert.alert("Checkout unavailable", "Check that you are signed in and try again later.");
    } finally {
      checkoutLock.current = false;
      setWorking(false);
    }
  }

  return (<TaskPage title="More room to explore" section="Somata Pro" subtitle="AI-assisted tools for your food and training routines." onBack={() => router.back()}>
    <Panel accent>
      <Text style={F.eyebrow}>YOUR ACCESS</Text>
      <Text style={F.value}>{loading ? 'Checking…' : isPro ? 'Pro' : 'Standard'}</Text>
      <Text style={F.body}>{releaseConfig.checkoutEnabled ? "Review the price and subscription terms at checkout before confirming." : "Purchases are unavailable in this build. Your existing access is unchanged."}</Text>
      {releaseConfig.checkoutEnabled && <Button label={isPro ? 'Pro is active' : working ? 'Opening checkout…' : 'View checkout'} primary disabled={working || loading || isPro} onPress={startCheckout} />}
    </Panel>
    <Heading title="Included tools" />
    {benefits.map((b, i) => <Item key={b} icon={i < 2 ? 'nutrition-outline' : 'sparkles-outline'} title={b} />)}
    <Button label="Refresh access" icon="refresh" onPress={async () => { try { await auth.currentUser?.getIdToken(true); Alert.alert('Refreshed', 'Your account access has been refreshed.'); } catch (e: any) { Alert.alert('Could not refresh', e?.message || ''); } }} />
  </TaskPage>
  );
}
