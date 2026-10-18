import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Empty, Heading, Item, Panel, TaskPage, TaskSheet, Toggle } from "@/components/somata/TaskUI";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ExpoNotifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Linking, Platform, View } from "react-native";

import { useScreenPalette } from "@/components/accountSettings/Primitives";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeIntegrations, type IntegrationSnapshot } from "@/services/integrations";
import { loadNotificationSettings, saveNotificationSettings, type NotificationSettings } from "@/services/notificationSettings";
import { subscribeProfile, updateProfile, type Profile } from "@/services/profile";

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
type TimeKey = MealKey | "protein" | "streak";
type TimeDraft = { key: TimeKey; value: Date; };
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
  const localStore = useAccountStorage();
  const router = useRouter();
  const { user } = useAuth();
  const { modeSetting, isDark } = useTheme();
  const palette = useScreenPalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<{ status: string; canAskAgain: boolean; } | null>(null);
  const [motionReduced, setMotionReduced] = useState<boolean | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(null);
  const [timeDraft, setTimeDraft] = useState<TimeDraft | null>(null);

  useEffect(() => {
    if (!user?.uid) { setProfile(null); return; }
    return subscribeProfile(user.uid, setProfile);
  }, [user?.uid]);
  useEffect(() => subscribeIntegrations(setIntegrations, localStore), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadNotificationSettings(localStore).then((next) => { if (active) setNotifications(next); });
    void ExpoNotifications.getPermissionsAsync().then((result) => {
      if (active) setPermission({ status: result.status, canAskAgain: result.canAskAgain });
    }).catch(() => { if (active) setPermission(null); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setMotionReduced(value); }).catch(() => { });
    return () => { active = false; };
  }, []));

  const back = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");
  const save = async (next: NotificationSettings) => {
    if (saving) return;
    setSaving(true);
    setNotifications(next);
    try {
      await saveNotificationSettings(next, localStore);
    } catch {
      setNotifications(await loadNotificationSettings(localStore));
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

  return (<><TaskPage title="Make it yours" section="Settings" onBack={back}>

    <Panel accent>
      <Heading title="Appearance" detail={`Current mode · ${modeSetting}`} />
      <Button label="Choose your theme" icon="color-palette-outline" onPress={() => router.push('/(modals)/theme-editor')} />
    </Panel>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Button label={`Weight · ${profile ? (profile.weightUnit === 'lb' ? 'lb' : 'kg') : 'Unavailable'}`} disabled={!profile || !user} onPress={chooseUnit} />
      <Button label="Health connections" onPress={() => router.push('/profile/integrations')} />
    </View>

    <Heading title="Reminders & alerts" detail={`Device permission · ${permissionLabel}`} />
    {permission !== null && permission.status !== 'granted' && <Button label={permission.canAskAgain ? 'Allow notifications' : 'Open device settings'} onPress={permission.canAskAgain ? requestPermission : () => { void Linking.openSettings(); }} />}

    {!notifications ? <Empty title="Loading reminder preferences…" /> : <><Panel>
      <Toggle title="Reminders and alerts" detail="Scheduled and in-app alerts" value={notifications.enabled} onChange={enabled => patch({ enabled })} disabled={saving} />
      <Toggle title="Meal reminders" value={notifications.mealReminders.enabled} onChange={enabled => patch({ mealReminders: { ...notifications.mealReminders, enabled } })} disabled={saving || masterOff} />

      {meals.map(meal => <View key={meal}>
        <Toggle title={meal[0].toUpperCase() + meal.slice(1)} detail={timeLabel(notifications.mealReminders[meal].hour, notifications.mealReminders[meal].minute)} value={notifications.mealReminders[meal].enabled} onChange={enabled => patch({ mealReminders: { ...notifications.mealReminders, [meal]: { ...notifications.mealReminders[meal], enabled } } })} disabled={saving || masterOff || !notifications.mealReminders.enabled} />
        {notifications.mealReminders.enabled && notifications.mealReminders[meal].enabled && <Button label={`Change ${meal} time`} disabled={masterOff || saving} onPress={() => openTime(meal)} />}
      </View>)}
    </Panel>
      <Panel>
        <Heading title="Daily nudges" />
        {(['protein', 'streak'] as const).map(key => {
          const item = key === 'protein' ? notifications.proteinReminder : notifications.streakReminder; return <View key={key}>
            <Toggle title={`${key[0].toUpperCase() + key.slice(1)} reminder`} detail={timeLabel(item.hour, item.minute)} value={item.enabled} onChange={enabled => patch(key === 'protein' ? { proteinReminder: { ...item, enabled } } : { streakReminder: { ...item, enabled } })} disabled={saving || masterOff} />
            {item.enabled && <Button label="Change time" disabled={masterOff || saving} onPress={() => openTime(key)} />}
          </View>;
        })}
        <Toggle title="Check-in prompt" detail="Daily at 9 AM" value={notifications.weeklyCheckinReminder} onChange={weeklyCheckinReminder => patch({ weeklyCheckinReminder })} disabled={saving || masterOff} />
      </Panel>
      <Panel>
        <Heading title="Milestones & people" />
        <Toggle title="Personal records" value={notifications.prAlerts} onChange={prAlerts => patch({ prAlerts })} disabled={saving || masterOff} />
        <Toggle title="Earned badges" value={notifications.badgeAlerts} onChange={badgeAlerts => patch({ badgeAlerts })} disabled={saving || masterOff} />
        <Toggle title="Friend pings" value={notifications.friendPings} onChange={friendPings => patch({ friendPings })} disabled={saving || masterOff} />
      </Panel></>}

    <Heading title="Accessibility" />
    <Item title="Text size" detail="Follows your device text size" icon="text-outline" />
    <Item title="Reduced motion" value={motionReduced === null ? 'Unknown' : motionReduced ? 'On' : 'Off'} detail="Uses your device preference" icon="accessibility-outline" />

    <Heading title="Health & device privacy" />
    {Platform.OS === 'ios' ? <><Item title="Apple Health" detail="Manage sources and sync; permissions are managed by iOS" value={health?.connected ? health.status === 'warning' || health.status === 'error' ? 'Needs attention' : 'Connected in Somata' : 'Not connected'} onPress={() => router.push('/profile/integrations')} />{ring?.connected && <Item title="RingConn" value={ring.status === 'warning' || ring.status === 'error' ? 'Needs attention' : 'Connected'} onPress={() => router.push('/profile/integrations')} />}</> : <Item title="Health sources" detail="No supported health source is available here yet" />}

  </TaskPage>{!!timeDraft && (Platform.OS === 'ios' ? <TaskSheet title="Reminder time" visible onClose={() => setTimeDraft(null)}>
    <DateTimePicker value={timeDraft.value} mode="time" display="spinner" themeVariant={isDark ? "dark" : "light"} onChange={(_, date) => { if (date) setTimeDraft({ ...timeDraft, value: date }); }} />
    <Button primary label="Save time" onPress={() => commitTime(timeDraft)} />
    <Button label="Cancel" onPress={() => setTimeDraft(null)} />
  </TaskSheet> : <DateTimePicker value={timeDraft.value} mode="time" display="default" onChange={(event, date) => { if (event.type === 'set' && date) commitTime({ ...timeDraft, value: date }); else setTimeDraft(null); }} />)}</>
  );
}
