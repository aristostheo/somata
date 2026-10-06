// app/_layout.tsx
import "react-native-gesture-handler";
import "react-native-reanimated";

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  LogBox,
} from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/content/AuthContext";
import { ThemeProvider, useTheme } from "@/content/ThemeProvider";
import { SettingsProvider } from "@/content/SettingsContext";
import { startIntegrationAutoSync } from "@/services/integrations";
import { SomataIcon } from "@/components/brand/SomataIcon";
import {
  registerForPushNotifications,
} from "@/services/notifications";
import {
  loadNotificationSettings,
  syncScheduledNotifications,
} from "@/services/notificationSettings";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------- Tiny glossy header that's always present ---------- */
function GlobalTopHeader() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const height = insets.top + 10; // safe-area + small buffer

  let BlurView: any = View;
  try {
    BlurView = require("expo-blur").BlurView;
  } catch {
    // if expo-blur is missing, we still render the spacer
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? "rgba(12,14,20,0.62)"
              : "rgba(245,248,255,0.58)",
          },
        ]}
      />
      {BlurView !== View && (
        <BlurView
          intensity={22}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* subtle bottom fade */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          backgroundColor: isDark
            ? "rgba(0,0,0,0.18)"
            : "rgba(255,255,255,0.18)",
        }}
      />
    </View>
  );
}

function Gate() {
  const { user, initializing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const sessionCheckedRef = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const inAuth =
    pathname?.startsWith("/(auth)") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset";

  // Apply the stored session preference once at startup, then guard every auth change.
  useEffect(() => {
    if (initializing || sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;
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
    if (initializing || !sessionReady) return;
    if (!user && !inAuth) router.replace("/(auth)/login");
    else if (user && inAuth) router.replace("/(tabs)");
  }, [user, initializing, sessionReady, inAuth, router]);

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
    const stop = startIntegrationAutoSync(() => user?.uid);
    return () => {
      stop?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    registerForPushNotifications().catch(() => {});
    loadNotificationSettings().then(syncScheduledNotifications).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data: any = response.notification.request.content.data || {};
        if (!data?.type) return;
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

  const topHeaderHeight = insets.top + 10;

  return (
    <Animated.View
      style={{ flex: 1, backgroundColor: colors.background, opacity: fade }}
    >
      {/* Translucent so our header shows behind the system area */}
      <StatusBar
        style={isDark ? "light" : "dark"}
      />

      {/* Always-present glossy header spacer */}
      <GlobalTopHeader />

      <Stack
        screenOptions={{
          headerShown: false, // we’re using the global top header now
          contentStyle: {
            backgroundColor: colors.background,
            // Push *every* screen content down so it starts below the global header
            paddingTop: topHeaderHeight,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="(modals)"
          options={{
            presentation: "fullScreenModal",
            contentStyle: {
              backgroundColor: colors.background,
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
      <SettingsProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <View style={{ flex: 1 }}>
              <AuthProvider>
                <Gate />
              </AuthProvider>
            </View>
          </SafeAreaProvider>
        </ThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
