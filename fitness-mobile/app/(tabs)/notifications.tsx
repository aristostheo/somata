import { useAccountStorage } from '@/services/local/accountStore';
import { Filters, Header, Hero, InboxHeading, InboxState, NotificationCard } from "@/components/alerts/PremiumAlertsUI";
import { SomataHomeAppearance } from "@/components/designPreview/Appearance";
import { useHomeVisuals } from "@/components/home/PremiumHomeUI";
import { useAuth } from "@/content/AuthContext";
import { pingFriend } from "@/services/friends/friends";
import {
  deleteNotification, markAllNotificationsRead, markNotificationRead,
  notifyPingSafe, subscribeNotifications, type AppNotification
} from "@/services/notifications";
import { notifyFriendPing } from "@/services/notificationTriggers";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, View } from "react-native";

type Filter = "All" | "Friends" | "Workouts" | "Nutrition" | "Streaks" | "Coach";
const FILTERS: Filter[] = ["All", "Friends", "Workouts", "Nutrition", "Streaks", "Coach"];
function category(item: AppNotification): Filter {
  const text = `${item.title} ${item.body || ""}`.toLowerCase();
  if (item.type === "ping" || item.type.startsWith("friend") || text.includes("friend")) return "Friends";
  if (text.includes("streak")) return "Streaks";
  if (text.includes("workout") || text.includes("personal record")) return "Workouts";
  if (text.includes("meal") || text.includes("protein") || text.includes("nutrition")) return "Nutrition";
  if (text.includes("coach") || text.includes("recovery") || text.includes("summary")) return "Coach";
  return "All";
}
function destination(item: AppNotification) {
  const text = `${item.title} ${item.body || ""}`.toLowerCase();
  if (text.includes("sync failed") || text.includes("reconnect")) return "/profile/integrations";
  if (text.includes("week in review") || text.includes("summary is ready")) return "/profile/insights-progress";
  if (text.includes("streak") && text.includes("meal")) return "/(tabs)/nutrition";
  const kind = category(item);
  if (kind === "Friends") return "/friends";
  if (kind === "Workouts") return "/(tabs)/workouts";
  if (kind === "Nutrition") return "/(tabs)/nutrition";
  if (kind === "Streaks") return "/(tabs)";
  if (kind === "Coach") return "/profile/insights-progress";
  return "/(tabs)/profile";
}
function age(item: AppNotification) {
  const value = item.createdAtMs || item.createdAt?.toMillis?.();
  return typeof value === "number" && value > 0 ?
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recorded alert";
}

export default function DesignAlerts() {
  const { user } = useAuth();
  return <SomataHomeAppearance><AlertsContent key={user?.uid || "signed-out"} /></SomataHomeAppearance>;
}

function AlertsContent() {
  const localStore = useAccountStorage();
  const { t } = useHomeVisuals();

  const router = useRouter();
  const { user } = useAuth();
  const [raw, setRaw] = useState<AppNotification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastPing = useRef<string | null>(null);
  useEffect(() => {
    setRaw(null);
    setLoadError(false);
    if (!user?.uid) return;
    let active = true;
    const stop = subscribeNotifications(user.uid, rows => { if (active) setRaw(rows); }, {
      max: 120, onError: () => { if (active) setLoadError(true); },
    });
    return () => { active = false; stop(); };
  }, [user?.uid, attempt]);
  useEffect(() => {
    const ping = raw?.find((item) => item.type === "ping" && !item.readAt);
    if (!ping || lastPing.current === ping.id) return;
    lastPing.current = ping.id;
    void notifyFriendPing(String(ping.data?.fromName || ping.data?.displayName || "Friend"), localStore).catch(() => { });
  }, [raw]);
  const visible = useMemo(() => (raw ?? []).filter((item) => filter === "All" || category(item) === filter), [raw, filter]);
  const unread = (raw ?? []).filter((item) => !item.readAt).length;
  const onOpen = async (item: AppNotification) => {
    if (!user?.uid) return;
    if (!item.readAt) await markNotificationRead(user.uid, item.id).catch(() => { });
    router.push(destination(item) as never);
  };
  const onDismiss = (item: AppNotification) => {
    if (!user?.uid) return;
    Alert.alert("Dismiss alert?", item.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Dismiss", style: "destructive", onPress: () => {
          void deleteNotification(user.uid!, item.id).catch(() => Alert.alert("Could not dismiss", "Please try again."));
        }
      },
    ]);
  };
  const onPing = async (item: AppNotification) => {
    const other = item.data?.fromUid;
    if (!user?.uid || typeof other !== "string") return;
    try {
      await pingFriend(user.uid, other);
      await notifyPingSafe(other, { uid: user.uid, displayName: user.displayName || user.email || "Friend" });
    } catch { Alert.alert("Ping failed", "Please try again."); }
  };
  const markAll = async () => {
    if (!user?.uid || busy) return;
    setBusy(true);
    try { await markAllNotificationsRead(user.uid); }
    catch { Alert.alert("Could not mark alerts", "Please try again."); }
    finally { setBusy(false); }
  };
  return <FlatList style={{ flex: 1, backgroundColor: t.surface.canvas }}
    contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
    data={loadError ? [] : visible} keyExtractor={item => item.id}
    initialNumToRender={8} maxToRenderPerBatch={6} windowSize={7}
    showsVerticalScrollIndicator={false}
    ListHeaderComponent={<View style={{ gap: 18, marginBottom: 14 }}>
      <Header filter={filter} unread={unread} busy={busy} onMarkAll={markAll}
        subtitle={!user?.uid ? "Your account alerts" : loadError ? "Alerts unavailable" : raw === null ? "Loading your alerts…" : unread ? `${unread} unread` : "You're all caught up."} />
      <Hero filter={filter} onPress={route => router.push(route as never)} />
      <Filters options={FILTERS} selected={filter} onSelect={setFilter} />
      <InboxHeading caption={loadError ? "Unavailable" : raw === null ? "Loading" : `${visible.length} shown`} />
    </View>}
    ListEmptyComponent={<InboxState loading={raw === null} error={loadError} signedOut={!user?.uid} filter={filter} retry={() => setAttempt(value => value + 1)} />}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => <NotificationCard item={item} category={category(item)} date={age(item)}
      onOpen={() => { void onOpen(item); }} onDismiss={() => onDismiss(item)}
      onPing={item.type === "ping" && typeof item.data?.fromUid === "string" ? () => { void onPing(item); } : undefined} />}
  />;
}
