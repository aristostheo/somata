import { useSomataTheme } from "@/components/somata/theme";
// app/(tabs)/_layout.tsx
import { useAuth } from "@/content/AuthContext";

import { subscribeUnreadCount } from "@/services/notifications";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
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

  const { D, semantic: t } = useSomataTheme();
  return <Tabs backBehavior="initialRoute" screenOptions={({ route }) => ({
    headerShown: false, sceneStyle: { backgroundColor: D.bg, paddingBottom: 84 + insets.bottom },
    tabBarHideOnKeyboard: true, tabBarActiveTintColor: t.navigation.active, tabBarInactiveTintColor: t.navigation.inactive,
    tabBarStyle: {
      position: 'absolute', left: 12, right: 12, bottom: Math.max(8, insets.bottom / 2),
      height: 66, paddingTop: 7, paddingBottom: 7, borderRadius: 32, borderWidth: 1, borderTopWidth: 1, borderColor: t.border.subtle, backgroundColor: t.navigation.background,
      shadowColor: t.brand.charcoal, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarIcon: ({ color }) => <View>

      <Ionicons name={route.name === 'index' ? 'home-outline' : route.name === 'workouts' ? 'barbell-outline' : route.name === 'nutrition' ? 'nutrition-outline' : route.name === 'notifications' ? 'notifications-outline' : 'person-outline'} color={color} size={24} />

      {route.name === 'notifications' && unreadCount > 0 && <View accessibilityLabel={`${unreadCount} unread alerts`} style={{ position: 'absolute', right: -5, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: t.navigation.badge }} />}

    </View>
  })}>

    <Tabs.Screen name="index" options={{ title: 'Home' }} />
    <Tabs.Screen name="workouts" options={{ title: 'Workouts' }} />

    <Tabs.Screen name="nutrition" options={{ title: 'Nutrition' }} />
    <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />

    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

  </Tabs>;
}
