import React, { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import * as ExpoNotifications from "expo-notifications";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";
import { subscribeIntegrations, type IntegrationSnapshot } from "@/services/integrations";
import { loadNotificationSettings, saveNotificationSettings, type NotificationSettings } from "@/services/notificationSettings";
import { Row, Screen, Section, ToggleRow, useScreenPalette } from "@/components/accountSettings/Primitives";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
type TimeKey = MealKey | "protein" | "streak";
type TimeDraft = { key: TimeKey; value: Date };
const meals: MealKey[] = ["breakfast", "lunch", "dinner", "snack"];

function timeDate(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function timeLabel(hour: number, minute: number) {
  return timeDate(hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function timeFor(settings: NotificationSettings, key: TimeKey) {
  if (key === "protein") return settings.proteinReminder;
  if (key === "streak") return settings.streakReminder;
  return settings.mealReminders[key];
}

function withTime(settings: NotificationSettings, key: TimeKey, date: Date): NotificationSettings {
  const patch = { hour: date.getHours(), minute: date.getMinutes() };
  if (key === "protein") return { ...settings, proteinReminder: { ...settings.proteinReminder, ...patch } };
  if (key === "streak") return { ...settings, streakReminder: { ...settings.streakReminder, ...patch } };
  return { ...settings, mealReminders: { ...settings.mealReminders, [key]: { ...settings.mealReminders[key], ...patch } } };
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { modeSetting } = useTheme();
  const palette = useScreenPalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<{ status: string; canAskAgain: boolean } | null>(null);
  const [motionReduced, setMotionReduced] = useState<boolean | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(null);
  const [timeDraft, setTimeDraft] = useState<TimeDraft | null>(null);

  useEffect(() => {
    if (!user?.uid) { setProfile(null); return; }
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);
  useEffect(() => subscribeIntegrations(setIntegrations), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadNotificationSettings().then((next) => { if (active) setNotifications(next); });
    void ExpoNotifications.getPermissionsAsync().then((result) => {
      if (active) setPermission({ status: result.status, canAskAgain: result.canAskAgain });
    }).catch(() => { if (active) setPermission(null); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setMotionReduced(value); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const back = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");
  const save = async (next: NotificationSettings) => {
    if (saving) return;
    setSaving(true);
    setNotifications(next);
    try {
      await saveNotificationSettings(next);
    } catch {
      setNotifications(await loadNotificationSettings());
      Alert.alert("Couldn’t update reminders", "Your notification schedule may not have changed. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const patch = (change: Partial<NotificationSettings>) => {
    if (notifications) void save({ ...notifications, ...change });
  };
  const setUnit = async (unit: "kg" | "lb") => {
    if (!user?.uid || profile?.weightUnit === unit) return;
    try { await updateProfile(user.uid, { weightUnit: unit }); }
    catch { Alert.alert("Couldn’t save units", "Please try again."); }
  };
  const chooseUnit = () => Alert.alert("Weight display", "Choose the unit used by profile-based weight displays.", [
    { text: "kg", onPress: () => { void setUnit("kg"); } },
    { text: "lb", onPress: () => { void setUnit("lb"); } },
    { text: "Cancel", style: "cancel" },
  ]);

  const requestPermission = async () => {
    try {
      const result = await ExpoNotifications.requestPermissionsAsync();
      setPermission({ status: result.status, canAskAgain: result.canAskAgain });
    } catch { Alert.alert("Permission unavailable", "Check notification access in your device settings."); }
  };
  const openTime = (key: TimeKey) => {
    if (!notifications || saving) return;
    const current = timeFor(notifications, key);
    setTimeDraft({ key, value: timeDate(current.hour, current.minute) });
  };
  const commitTime = (draft: TimeDraft) => {
    setTimeDraft(null);
    if (notifications) void save(withTime(notifications, draft.key, draft.value));
  };

  const masterOff = !notifications?.enabled;
  const health = integrations?.connections.apple_health;
  const ring = integrations?.connections.ringconn;
  const permissionLabel = permission === null ? "Unavailable" : permission.status === "granted" ? "Allowed" : permission.status === "undetermined" ? "Not requested" : "Not allowed";

  return (
    <Screen title="Settings" intro="Choose how Somata looks and keeps you informed." onBack={back} palette={palette}>
      <Section title="Appearance" palette={palette}>
        <Row title="Theme picker" detail="Appearance mode and light or dark palettes" value={modeSetting[0].toUpperCase() + modeSetting.slice(1)} icon="color-palette-outline" onPress={() => router.push("/(modals)/theme-editor")} palette={palette} last />
      </Section>

      <Section title="Notifications" palette={palette}>
        <Row title="Device permission" detail={permission?.status === "granted" ? "Notifications can appear on this device" : "Reminders need device permission to appear"} value={permissionLabel} icon="notifications-outline" palette={palette} last={permission?.status === "granted"} />
        {permission !== null && permission.status !== "granted" && <Row title={permission.canAskAgain ? "Allow notifications" : "Open device settings"} icon="open-outline" onPress={permission.canAskAgain ? requestPermission : () => { void Linking.openSettings(); }} palette={palette} last={!notifications} />}
        {!notifications ? <Row title="Reminder preferences" detail="Loading…" icon="time-outline" palette={palette} last /> : <>
          <ToggleRow title="Reminders and alerts" detail="Master switch for scheduled and in-app alerts" icon="notifications-circle-outline" value={notifications.enabled} onChange={(enabled) => patch({ enabled })} disabled={saving} palette={palette} />
          <ToggleRow title="Meal reminders" detail="Daily reminders at your saved times" icon="restaurant-outline" value={notifications.mealReminders.enabled} onChange={(enabled) => patch({ mealReminders: { ...notifications.mealReminders, enabled } })} disabled={saving || masterOff} palette={palette} />
          {meals.map((meal) => <React.Fragment key={meal}>
            <ToggleRow title={`${meal[0].toUpperCase()}${meal.slice(1)}`} detail={`Daily · ${timeLabel(notifications.mealReminders[meal].hour, notifications.mealReminders[meal].minute)}`} icon="time-outline" value={notifications.mealReminders[meal].enabled} onChange={(enabled) => patch({ mealReminders: { ...notifications.mealReminders, [meal]: { ...notifications.mealReminders[meal], enabled } } })} disabled={saving || masterOff || !notifications.mealReminders.enabled} palette={palette} />
            {notifications.mealReminders.enabled && notifications.mealReminders[meal].enabled && <Row title={`Change ${meal} time`} value={timeLabel(notifications.mealReminders[meal].hour, notifications.mealReminders[meal].minute)} icon="alarm-outline" onPress={masterOff || saving ? undefined : () => openTime(meal)} palette={palette} />}
          </React.Fragment>)}
          <ToggleRow title="Protein reminder" detail={`Daily · ${timeLabel(notifications.proteinReminder.hour, notifications.proteinReminder.minute)}`} icon="nutrition-outline" value={notifications.proteinReminder.enabled} onChange={(enabled) => patch({ proteinReminder: { ...notifications.proteinReminder, enabled } })} disabled={saving || masterOff} palette={palette} />
          {notifications.proteinReminder.enabled && <Row title="Change protein reminder time" value={timeLabel(notifications.proteinReminder.hour, notifications.proteinReminder.minute)} icon="alarm-outline" onPress={masterOff || saving ? undefined : () => openTime("protein")} palette={palette} />}
          <ToggleRow title="Streak reminder" detail={`Daily · ${timeLabel(notifications.streakReminder.hour, notifications.streakReminder.minute)}`} icon="flame-outline" value={notifications.streakReminder.enabled} onChange={(enabled) => patch({ streakReminder: { ...notifications.streakReminder, enabled } })} disabled={saving || masterOff} palette={palette} />
          {notifications.streakReminder.enabled && <Row title="Change streak reminder time" value={timeLabel(notifications.streakReminder.hour, notifications.streakReminder.minute)} icon="alarm-outline" onPress={masterOff || saving ? undefined : () => openTime("streak")} palette={palette} />}
          <ToggleRow title="Goal alerts" detail="When a tracked goal is reached" icon="flag-outline" value={notifications.goalHitAlerts} onChange={(goalHitAlerts) => patch({ goalHitAlerts })} disabled={saving || masterOff} palette={palette} />
          <ToggleRow title="Personal record alerts" detail="When a workout records a new best" icon="trophy-outline" value={notifications.prAlerts} onChange={(prAlerts) => patch({ prAlerts })} disabled={saving || masterOff} palette={palette} />
          <ToggleRow title="Badge alerts" detail="When a badge is earned" icon="ribbon-outline" value={notifications.badgeAlerts} onChange={(badgeAlerts) => patch({ badgeAlerts })} disabled={saving || masterOff} palette={palette} />
          <ToggleRow title="Friend pings" detail="When a friend sends a ping" icon="people-outline" value={notifications.friendPings} onChange={(friendPings) => patch({ friendPings })} disabled={saving || masterOff} palette={palette} />
          <ToggleRow title="Check-in prompt" detail="Daily 9 AM reminder" icon="calendar-outline" value={notifications.weeklyCheckinReminder} onChange={(weeklyCheckinReminder) => patch({ weeklyCheckinReminder })} disabled={saving || masterOff} palette={palette} last />
        </>}
      </Section>

      <Section title="Units" palette={palette}>
        <Row title="Weight display" detail="Used where screens read your saved profile unit" value={profile ? (profile.weightUnit === "lb" ? "lb" : "kg") : "Unavailable"} icon="scale-outline" onPress={profile && user ? chooseUnit : undefined} palette={palette} last />
      </Section>

      <Section title="Accessibility" palette={palette}>
        <Row title="Text size" detail="These screens follow your device text size" icon="text-outline" palette={palette} />
        <Row title="Reduced motion" detail="These screens avoid decorative animation; other screens may still animate" value={motionReduced === null ? "Unknown" : motionReduced ? "On" : "Off"} icon="accessibility-outline" palette={palette} last />
      </Section>

      <Section title="Health and device privacy" palette={palette}>
        {Platform.OS === "ios" ? <>
          <Row title="Apple Health" detail="Manage sources and sync; Health permissions are managed by iOS" value={health?.connected ? (health.status === "warning" || health.status === "error" ? "Needs attention" : "Connected in Somata") : "Not connected"} icon="heart-outline" onPress={() => router.push("/profile/integrations")} palette={palette} last={!ring?.connected} />
          {!!ring?.connected && <Row title="RingConn" detail="Manage connection and sync" value={ring.status === "warning" || ring.status === "error" ? "Needs attention" : "Connected"} icon="watch-outline" onPress={() => router.push("/profile/integrations")} palette={palette} last />}
        </> : <Row title="Health sources" detail="No supported health source is available here yet" icon="heart-outline" palette={palette} last />}
      </Section>

      {!!timeDraft && (Platform.OS === "ios" ? <Modal transparent animationType="none" visible onRequestClose={() => setTimeDraft(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0008" }}>
          <View style={{ backgroundColor: palette.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>Reminder time</Text>
            <DateTimePicker value={timeDraft.value} mode="time" display="spinner" onChange={(_, date) => { if (date) setTimeDraft({ ...timeDraft, value: date }); }} />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable accessibilityRole="button" onPress={() => setTimeDraft(null)} style={{ minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.secondary, fontSize: 16 }}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => commitTime(timeDraft)} style={{ minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: palette.primary, fontSize: 16, fontWeight: "700" }}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal> : <DateTimePicker value={timeDraft.value} mode="time" display="default" onChange={(event, date) => { if (event.type === "set" && date) commitTime({ ...timeDraft, value: date }); else setTimeDraft(null); }} />)}
    </Screen>
  );
}
