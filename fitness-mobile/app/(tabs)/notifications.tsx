import { useAccountStorage } from '@/services/local/accountStore';
import { Action, Card, Page, Section } from "@/components/designPreview/UI";
import { useSomataTheme } from "@/components/somata/theme";
import { useAuth } from "@/content/AuthContext";
import { pingFriend } from "@/services/friends/friends";
import {
  deleteNotification, markAllNotificationsRead, markNotificationRead,
  notifyPingSafe, subscribeNotifications, type AppNotification
} from "@/services/notifications";
import { notifyFriendPing } from "@/services/notificationTriggers";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

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
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const { user } = useAuth();
  const [raw, setRaw] = useState<AppNotification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [busy, setBusy] = useState(false);
  const lastPing = useRef<string | null>(null);
  useEffect(() => {
    setRaw(null);
    if (!user?.uid) return;
    return subscribeNotifications(user.uid, setRaw, { max: 120 });
  }, [user?.uid]);
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
  return <Page eyebrow="Signals / your account" title="Alerts"
    subtitle={raw === null ? "Loading your alerts…" : unread ? `${unread} unread` : "You're all caught up."}
    headerAction={unread > 0 ? <Action label="Mark all" icon="checkmark-done-outline"
      disabled={busy} onPress={markAll} /> : undefined}>

    <Card accent>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>

        <Ionicons name="notifications-outline" size={28} color={D.lime} />

        <View style={{ flex: 1, gap: 3 }}>

          <Text style={{ color: D.text, fontSize: 19, fontWeight: "800" }}>Your signal center</Text>

          <Text style={{ color: D.muted, fontSize: 12 }}>Activity from friends and the app, in one place.</Text>

        </View>

      </View>

      <Action label="Open friends" icon="people-outline" onPress={() => router.push("/friends")} />

    </Card>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>

      {FILTERS.map((option) => <Pressable key={option} accessibilityRole="button"
        accessibilityState={{ selected: filter === option }} onPress={() => setFilter(option)}
        style={{
          minHeight: 40, paddingHorizontal: 13, justifyContent: "center", borderRadius: 20,
          backgroundColor: filter === option ? D.lime : D.card
        }}>

        <Text style={{ color: filter === option ? D.ink : D.muted, fontSize: 12, fontWeight: "700" }}>{option}</Text>

      </Pressable>)}

    </ScrollView>

    <Section title="Inbox" caption={raw === null ? "Loading" : `${visible.length} shown`} />

    {raw === null ? <Card>
      <Text style={{ color: D.muted }}>Loading account alerts…</Text>
    </Card> :
      visible.length === 0 ? <Card>
        <Text style={{ color: D.muted }}>Nothing in this view yet.</Text>
      </Card> :
        visible.map((item) => <Card key={item.id} style={{ gap: 8 }}>

          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => { void onOpen(item); }}
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>

            <View style={{
              width: 37, height: 37, borderRadius: 12, backgroundColor: D.raised,
              alignItems: "center", justifyContent: "center"
            }}>

              <Ionicons name={item.type === "ping" ? "people-outline" : "notifications-outline"} size={18} color={D.teal} />

            </View>

            <View style={{ flex: 1, gap: 4 }}>

              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 7 }}>

                <Text style={{ color: D.text, fontSize: 15, fontWeight: item.readAt ? "600" : "800", flex: 1 }}>{item.title}</Text>

                {!item.readAt && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: D.lime }} />}

              </View>

              {!!item.body && <Text style={{ color: D.muted, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>}

              <Text style={{ color: D.dim, fontSize: 11 }}>{age(item)} · {category(item)}</Text>

            </View>

          </Pressable>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

            {item.type === "ping" && typeof item.data?.fromUid === "string" &&
              <Action label="Ping back" icon="paper-plane-outline" onPress={() => { void onPing(item); }} />}

            <Action label="Dismiss" icon="close-outline" onPress={() => onDismiss(item)} />

          </View>

        </Card>)}

  </Page>;
}
