// app/(tabs)/_layout.tsx
import React, { useEffect, useState } from "react";
import { Platform, View, BackHandler } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/content/AuthContext";
import { subscribeUnreadCount } from "@/services/notifications";
import { withAlpha } from "@/components/workouts/utils/withAlpha";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }
    const unsub = subscribeUnreadCount(user.uid, setUnreadCount);
    return () => unsub && unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = () => {
      if (router.canGoBack?.()) {
        return false;
      }
      BackHandler.exitApp();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [router]);

  const tabBarHeight = 58 + Math.max(0, insets.bottom - 8); // total visual height
  const tabBarPadBottom = Math.max(8, insets.bottom / 2);
  const scenePaddingBottom = tabBarPadBottom + 20; // keep content off the bar without huge whitespace

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: false,
        // ⬇️ This prevents content from being covered at the bottom
        sceneContainerStyle: {
          backgroundColor: colors.background,
          paddingBottom: scenePaddingBottom,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        tabBarLabelStyle: {
          fontWeight: "400",
          fontSize: 10,
          letterSpacing: 0.4,
          marginTop: 2,
        },

        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarPadBottom,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          ...Platform.select({ android: { elevation: 5 } }),
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size, focused }) => {
          const name =
            route.name === "home"
              ? "home-outline"
              : route.name === "workouts"
              ? "barbell-outline"
              : route.name === "nutrition"
              ? "fast-food-outline"
              : route.name === "notifications"
              ? "notifications-outline"
              : "person-outline";
          const showBadge = route.name === "notifications" && unreadCount > 0;
          return (
            <View style={{ position: "relative", alignItems: "center" }}>
              <Ionicons name={name as any} color={color} size={size} />
              <View
                style={{
                  marginTop: 6,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: focused ? colors.primary : "transparent",
                }}
              />
              {showBadge ? (
                <View
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -6,
                    minWidth: 10,
                    height: 10,
                    borderRadius: 6,
                    backgroundColor: colors.danger,
                    borderWidth: 1,
                    borderColor: colors.background,
                  }}
                />
              ) : null}
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      {/* If you want the new home later, add <Tabs.Screen name="home" ... /> back */}
      <Tabs.Screen name="workouts" options={{ title: "Workouts" }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
