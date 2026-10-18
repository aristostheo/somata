import { accountRouteRedirect } from "@/lib/accountRouteAccess";
import { notificationBelongsToAccount } from "@/services/local/notificationOwnership";
import { useAccountStorage } from '@/services/local/accountStore';
import { useSomataTheme } from "@/components/somata/theme";
// app/_layout.tsx
import "react-native-gesture-handler";
import "react-native-reanimated";

import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LogBox,
  Text,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SomataIcon } from "@/components/brand/SomataIcon";
import { AuthProvider, useAuth } from "@/content/AuthContext";
import { SettingsProvider } from "@/content/SettingsContext";
import { ThemeProvider, useTheme } from "@/content/ThemeProvider";
import { startIntegrationAutoSync } from "@/services/integrations";
import {
  registerForPushNotifications,
} from "@/services/notifications";
import {
  loadNotificationSettings,
  syncScheduledNotifications,
} from "@/services/notificationSettings";

import { auth, db } from "@/lib/firebase";
import { fitAdaptSetupPendingFor } from "@/services/fitadaptOnboarding";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

let startupSessionChecked = false;

function Gate() {
  const localStore = useAccountStorage();
  const { D } = useSomataTheme();
  const { user, initializing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const sessionCheckedRef = useRef(startupSessionChecked);
  const [sessionReady, setSessionReady] = useState(startupSessionChecked);
  const fade = useRef(new Animated.Value(1)).current;

  const [entryReady, setEntryReady] = useState(false);
  // Reset route parameters/history at the keyed account boundary before revealing private screens.
  useEffect(() => {
    if (entryReady || !sessionReady) return;
    const expected = user ? "/" : "/login";
    if (pathname === expected) setEntryReady(true);
    else router.replace(user ? "/(tabs)" : "/(auth)/login");
  }, [entryReady, sessionReady, user, pathname, router]);

  const inAuth =
    pathname?.startsWith("/(auth)") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset";

  // Apply the stored session preference once at startup, then guard every auth change.
  useEffect(() => {
    if (initializing || sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;
    startupSessionChecked = true;
    const startupUid = user?.uid;
    (async () => {
      try {
        const remember = await AsyncStorage.getItem("@rememberMe");
        if (remember === "0" && startupUid && auth.currentUser?.uid === startupUid) {
          await signOut(auth);
        }
      } catch (error) {
        console.warn("[auth] session preference check failed", error);
      } finally {
        setSessionReady(true);
      }
    })();
  }, [user, initializing]);

  useEffect(() => {
    if (initializing || !sessionReady || !entryReady) return;
    let active = true;
    if (!user) {
      const destination = accountRouteRedirect({ pathname, signedIn: false, inAuth, pendingSetup: false });
      if (destination) router.replace(destination);
    } else {
      void fitAdaptSetupPendingFor(user).then((pending) => {
        if (!active) return;
        const destination = accountRouteRedirect({ pathname, signedIn: true, inAuth, pendingSetup: pending });
        if (destination) router.replace(destination);
      }).catch(() => { if (active && inAuth) router.replace("/(tabs)"); });
    }
    return () => { active = false; };
  }, [user, initializing, sessionReady, entryReady, inAuth, pathname, router]);

  // ensure user doc
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            email: u.email ?? null,
            displayName: u.displayName ?? null,
            photoURL: u.photoURL ?? null,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.warn("[auth] user document check failed", error);
      }
    });
    return unsub;
  }, []);

  // subtle fade on route transitions to avoid hard flashes between auth/app
  useEffect(() => {
    fade.setValue(0.9);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pathname, user]);

  useEffect(() => {
    if (!user) return;
    const stop = startIntegrationAutoSync(() => user?.uid, localStore);
    return () => {
      stop?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch(() => { });
    loadNotificationSettings(localStore).then(settings => syncScheduledNotifications(settings, localStore)).catch(() => { });

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data: any = response.notification.request.content.data || {};
        if (!data?.type || !notificationBelongsToAccount(auth.currentUser?.uid, data)) return;
        switch (data.type) {
          case "friend_ping":
            router.push("/(tabs)/notifications");
            break;
          case "pr":
            router.push("/(tabs)/workouts");
            break;
          case "badge":
            router.push("/(tabs)/profile");
            break;
          case "weekly_checkin":
            router.push("/(modals)/weekly-checkin");
            break;
          default:
            break;
        }
      }
    );

    return () => sub.remove();
  }, [router]);

  if (initializing || !sessionReady) {
    return (
      <LinearGradient
        colors={
          isDark ? ["#0d111a", "#0a0d14"] : ["#f7f9ff", "#e9eefb"] // soft branded fade
        }
        style={{ flex: 1 }}
      >

        <StatusBar style={isDark ? "light" : "dark"} />

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >

          <SomataIcon size={120} />

          <View style={{ alignItems: "center", gap: 4 }}>

            <ActivityIndicator color={colors.primary} />

            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Loading Somata…
            </Text>

          </View>

        </View>

      </LinearGradient>
    );
  }

  const topHeaderHeight = insets.top;

  return (
    <Animated.View
      pointerEvents={entryReady ? "auto" : "none"}
      accessibilityElementsHidden={!entryReady}
      importantForAccessibility={entryReady ? "auto" : "no-hide-descendants"}
      style={{ flex: 1, backgroundColor: D.bg, opacity: entryReady ? fade : 0 }}
    >

      {/* Translucent so our header shows behind the system area */}

      <StatusBar
        style={isDark ? "light" : "dark"}
      />

      {/* Safe-area canvas shared with the current theme */}

      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: topHeaderHeight, backgroundColor: D.bg, zIndex: 1000 }} />

      <Stack
        screenOptions={{
          headerShown: false, // Each destination owns its task header
          contentStyle: {
            backgroundColor: D.bg,
            // Reserve the system safe area once for every route
            paddingTop: topHeaderHeight,
          },
        }}
      >

        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="(auth)" />

        <Stack.Screen name="design-preview" options={{
          contentStyle: {
            backgroundColor: D.bg, paddingTop: topHeaderHeight,
          }
        }} />

        <Stack.Screen name="dashboard-preview" options={{
          contentStyle: {
            backgroundColor: D.bg, paddingTop: topHeaderHeight,
          }
        }} />

        <Stack.Screen
          name="(modals)"
          options={{
            presentation: "fullScreenModal",
            contentStyle: {
              backgroundColor: D.bg,
              paddingTop: topHeaderHeight,
            },
            headerShown: false,
          }}
        />

        <Stack.Screen name="+not-found" />

      </Stack>

    </Animated.View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    LogBox.ignoreLogs([
      "SafeAreaView has been deprecated and will be removed in a future release.",
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>

      <AuthProvider>
      <SettingsProvider>

        <ThemeProvider>

          <SafeAreaProvider>

            <View style={{ flex: 1 }}>

              <Gate />

            </View>

          </SafeAreaProvider>

        </ThemeProvider>

      </SettingsProvider>
      </AuthProvider>

    </GestureHandlerRootView>
  );
}
