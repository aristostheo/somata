import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { withAlpha } from "@/lib/color";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type AppNotification,
} from "@/services/notifications";
import { notifyPingSafe } from "@/services/notifications";
import { notifyFriendPing } from "@/services/notificationTriggers";
import { pingFriend } from "@/services/friends/friends";

type AlertCategory =
  | "all"
  | "friends"
  | "streaks"
  | "coach"
  | "workouts"
  | "nutrition";

type AlertCardType =
  | "friendPing"
  | "streak"
  | "coach"
  | "pr"
  | "goalHit"
  | "friendMilestone"
  | "syncError"
  | "weeklySummary"
  | "generic";

type GroupedAlert = {
  id: string;
  category: AlertCategory;
  cardType: AlertCardType;
  title: string;
  body: string;
  count: number;
  unread: number;
  sourceName?: string;
  actorUid?: string;
  createdAtMs: number;
  items: AppNotification[];
  cta?: string;
  route?: string;
};

const FILTERS: Array<{ key: AlertCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "friends", label: "Friends" },
  { key: "streaks", label: "Streaks" },
  { key: "coach", label: "AI Coach" },
  { key: "workouts", label: "Workouts" },
  { key: "nutrition", label: "Nutrition" },
];

function toMs(n: AppNotification) {
  if (typeof n.createdAtMs === "number") return n.createdAtMs;
  const raw: any = n.createdAt;
  if (typeof raw?.toMillis === "function") return raw.toMillis();
  if (typeof raw === "number") return raw;
  return 0;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function relativeTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ts);
  const y = new Date(now - 86400000);
  if (startOfDay(ts) === startOfDay(y.getTime())) {
    return `Yesterday at ${d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sectionLabel(ts: number) {
  const now = new Date();
  const today = startOfDay(now.getTime());
  const yesterday = today - 86400000;
  if (startOfDay(ts) === today) return "Today";
  if (startOfDay(ts) === yesterday) return "Yesterday";
  if (ts >= today - 6 * 86400000) return "Earlier this week";
  return "Older";
}

function parseSourceName(n: AppNotification) {
  const fromData = String(n.data?.fromName || n.data?.displayName || "").trim();
  if (fromData) return fromData;
  const title = String(n.title || "");
  const match = title.match(/^([^·]+?)\s(?:pinged|hit|accepted|commented|reacted)/i);
  return match?.[1]?.trim() || undefined;
}

function classify(n: AppNotification): {
  category: AlertCategory;
  cardType: AlertCardType;
  body: string;
  cta?: string;
  route?: string;
} {
  const title = String(n.title || "");
  const body = String(n.body || "");
  const type = String(n.type || "");
  const text = `${title} ${body}`.toLowerCase();

  if (type === "ping") {
    return {
      category: "friends",
      cardType: "friendPing",
      body: body || `${parseSourceName(n) || "Friend"} pinged you`,
      cta: "Ping back →",
      route: "/friends",
    };
  }
  if (text.includes("streak")) {
    return {
      category: "streaks",
      cardType: text.includes("hit") && !text.includes("ends")
        ? "friendMilestone"
        : "streak",
      body: body || title,
      cta: text.includes("ends tonight") ? "Log meal →" : "Send ping →",
      route: text.includes("meal") ? "/nutrition" : "/friends",
    };
  }
  if (text.includes("pr") || text.includes("personal record")) {
    return {
      category: "workouts",
      cardType: "pr",
      body: body || title,
      cta: "View workout →",
      route: "/workouts",
    };
  }
  if (text.includes("protein goal") || text.includes("goal today")) {
    return {
      category: "nutrition",
      cardType: "goalHit",
      body: body || title,
      route: "/nutrition",
    };
  }
  if (text.includes("sync failed") || text.includes("reconnect")) {
    return {
      category: "all",
      cardType: "syncError",
      body: body || title,
      cta: "Fix →",
      route: "/profile/integrations",
    };
  }
  if (text.includes("week in review") || text.includes("summary is ready")) {
    return {
      category: "coach",
      cardType: "weeklySummary",
      body: body || title,
      cta: "View insights →",
      route: "/profile/insights-progress",
    };
  }
  if (type === "friend:request" || type === "friend:accepted") {
    return {
      category: "friends",
      cardType: "friendMilestone",
      body: body || title,
      cta: "View →",
      route: "/friends",
    };
  }
  if (text.includes("coach") || text.includes("spark") || text.includes("recovery")) {
    return {
      category: "coach",
      cardType: "coach",
      body: body || title,
      cta: "View →",
      route: "/profile/insights-progress",
    };
  }
  return {
    category: "all",
    cardType: "generic",
    body: body || title,
    cta: "View →",
    route: "/profile",
  };
}

function groupNotifications(raw: AppNotification[]): GroupedAlert[] {
  const map = new Map<string, GroupedAlert>();
  const sorted = raw.slice().sort((a, b) => toMs(b) - toMs(a));
  for (const n of sorted) {
    const sourceName = parseSourceName(n);
    const meta = classify(n);
    const key = [
      meta.cardType,
      meta.category,
      sourceName || "",
      String(n.data?.fromUid || ""),
      startOfDay(toMs(n)),
      String(n.title || "").toLowerCase(),
    ].join("|");
    const existing = map.get(key);
    if (existing) {
      existing.items.push(n);
      existing.count += 1;
      existing.unread += n.readAt ? 0 : 1;
    } else {
      map.set(key, {
        id: key,
        category: meta.category,
        cardType: meta.cardType,
        title: n.title || "Alert",
        body: meta.body,
        count: 1,
        unread: n.readAt ? 0 : 1,
        sourceName,
        actorUid: String(n.data?.fromUid || ""),
        createdAtMs: toMs(n),
        items: [n],
        cta: meta.cta,
        route: meta.route,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function cardMeta(type: AlertCardType, colors: any) {
  switch (type) {
    case "friendPing":
      return { icon: "notifications-outline" as const, tint: colors.accentMuted };
    case "streak":
      return { icon: "flame-outline" as const, tint: colors.warning };
    case "coach":
      return { icon: "sparkles-outline" as const, tint: colors.accentMuted };
    case "pr":
      return { icon: "trophy-outline" as const, tint: colors.warning };
    case "goalHit":
      return { icon: "checkmark-circle-outline" as const, tint: colors.success };
    case "friendMilestone":
      return { icon: "person-outline" as const, tint: colors.accentMuted };
    case "syncError":
      return { icon: "warning-outline" as const, tint: colors.danger };
    case "weeklySummary":
      return { icon: "stats-chart-outline" as const, tint: colors.accentMuted };
    default:
      return { icon: "notifications-outline" as const, tint: colors.accentMuted };
  }
}

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme() as any;
  const [refreshing, setRefreshing] = useState(false);
  const [raw, setRaw] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<AlertCategory>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lastLocalPingId = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeNotifications(user.uid, setRaw, { max: 120 });
    return () => unsub && unsub();
  }, [user?.uid]);

  useEffect(() => {
    const latestPing = raw.find((item) => item.type === "ping" && !item.readAt);
    if (!latestPing) return;
    if (lastLocalPingId.current === latestPing.id) return;
    lastLocalPingId.current = latestPing.id;
    // NOTIFICATION TRIGGER
    notifyFriendPing(parseSourceName(latestPing) || "Friend").catch(() => {});
  }, [raw]);

  const grouped = useMemo(() => groupNotifications(raw), [raw]);
  const unreadCount = useMemo(
    () => raw.reduce((sum, n) => sum + (n.readAt ? 0 : 1), 0),
    [raw]
  );
  const filtered = useMemo(
    () => grouped.filter((g) => filter === "all" || g.category === filter),
    [grouped, filter]
  );

  const sections = useMemo(() => {
    const map = new Map<string, GroupedAlert[]>();
    for (const item of filtered) {
      const key = sectionLabel(item.createdAtMs);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return ["Today", "Yesterday", "Earlier this week", "Older"]
      .filter((k) => map.has(k))
      .map((k) => ({ title: k, items: map.get(k)! }));
  }, [filtered]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 350));
    setRefreshing(false);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.uid || unreadCount === 0) return;
    await markAllNotificationsRead(user.uid);
    Haptics.selectionAsync().catch(() => {});
  }, [user?.uid, unreadCount]);

  const dismissGroup = useCallback(
    async (item: GroupedAlert) => {
      if (!user?.uid) return;
      await Promise.all(item.items.map((n) => deleteNotification(user.uid!, n.id)));
    },
    [user?.uid]
  );

  const pingBack = useCallback(
    async (item: GroupedAlert) => {
      if (!user?.uid || !item.actorUid) return;
      await pingFriend(user.uid, item.actorUid);
      await notifyPingSafe(item.actorUid, {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? "Friend",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [user?.uid, user?.displayName, user?.email]
  );

  const openGroup = useCallback(
    async (item: GroupedAlert) => {
      if (!user?.uid) return;
      await Promise.all(
        item.items.filter((n) => !n.readAt).map((n) => markNotificationRead(user.uid!, n.id))
      );
      if (item.count > 1) {
        setExpandedId((cur) => (cur === item.id ? null : item.id));
        return;
      }
      if (item.route) router.push(item.route as any);
    },
    [router, user?.uid]
  );

  const rowData = useMemo(() => {
    const out: Array<{ type: "section"; title: string } | { type: "item"; item: GroupedAlert }> = [];
    for (const section of sections) {
      out.push({ type: "section", title: section.title });
      for (const item of section.items) out.push({ type: "item", item });
    }
    return out;
  }, [sections]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rowData}
        keyExtractor={(row, index) =>
          row.type === "section" ? `section-${row.title}` : `${row.item.id}-${index}`
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
        }
        contentContainerStyle={{ paddingTop: 22, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, gap: 14, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "500", letterSpacing: 0 }}>
                  Alerts
                </Text>
                <Text
                  style={{
                    color: unreadCount === 0 ? colors.textTertiary : colors.accentMuted,
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: "300",
                    fontStyle: unreadCount === 0 ? "italic" : "normal",
                  }}
                >
                  {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => router.push("/friends" as any)}
                  style={({ pressed }) => ({
                    minHeight: 32,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.accentSubtle,
                    backgroundColor: pressed ? colors.surface2 : colors.surface1,
                  })}
                >
                  <Text style={{ color: colors.accentMuted, fontWeight: "400", fontSize: 12 }}>
                    Friends →
                  </Text>
                </Pressable>
                {unreadCount > 0 ? (
                  <Pressable onPress={markAllRead} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="checkmark-outline" size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontWeight: "400", fontSize: 12 }}>
                      Mark all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    style={({ pressed }) => ({
                      minHeight: 32,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.accentSubtle : colors.border,
                      backgroundColor: active
                        ? colors.accentDim
                        : pressed
                        ? colors.surface3
                        : colors.surface2,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ color: active ? colors.accentMuted : colors.textSecondary, fontWeight: "400", fontSize: 12 }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 24, paddingTop: 42, alignItems: "center" }}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, fontWeight: "400", fontSize: 16, marginTop: 16 }}>
              Nothing here yet
            </Text>
            <Text style={{ color: colors.textTertiary, marginTop: 6, textAlign: "center", lineHeight: 18, fontWeight: "300" }}>
              Friend activity and app updates will appear here
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === "section") {
            return (
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "500", letterSpacing: 1, textTransform: "uppercase" }}>
                  {item.title}
                </Text>
              </View>
            );
          }
          const meta = cardMeta(item.item.cardType, colors);
          const expanded = expandedId === item.item.id;
          const subtitle =
            item.item.count > 1 && item.item.sourceName
              ? `${item.item.sourceName} · ${item.item.count} times today`
              : item.item.body;
          return (
            <Swipeable
              renderLeftActions={() =>
                item.item.cardType === "friendPing" ? (
                  <View style={{ justifyContent: "center", paddingLeft: 16 }}>
                    <Pressable
                      onPress={() => pingBack(item.item)}
                      style={{
                        width: 96,
                        height: 82,
                        borderRadius: 14,
                        backgroundColor: colors.surface2,
                        borderWidth: 1,
                        borderColor: colors.accentSubtle,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="notifications-outline" size={18} color={colors.accentMuted} />
                      <Text style={{ color: colors.accentMuted, fontWeight: "400", marginTop: 6, fontSize: 12 }}>Ping back</Text>
                    </Pressable>
                  </View>
                ) : null
              }
              renderRightActions={() => (
                <View style={{ justifyContent: "center", paddingRight: 16 }}>
                  <Pressable
                    onPress={() => dismissGroup(item.item)}
                    style={{
                      width: 92,
                      height: 82,
                      borderRadius: 14,
                      backgroundColor: colors.surface2,
                      borderWidth: 1,
                      borderColor: colors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close-outline" size={20} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontWeight: "400", marginTop: 6, fontSize: 12 }}>Dismiss</Text>
                  </Pressable>
                </View>
              )}
            >
              <Pressable
                onPress={() => openGroup(item.item)}
                style={({ pressed }) => ({
                  marginHorizontal: 16,
                  marginBottom: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderLeftWidth: item.item.unread > 0 ? 2 : 1,
                  borderLeftColor: item.item.unread > 0 ? colors.accentSubtle : colors.border,
                  backgroundColor: pressed
                    ? colors.surface2
                    : item.item.unread > 0
                    ? withAlpha(colors.surface1, 1)
                    : colors.surface1,
                  padding: 14,
                  shadowColor: isDark ? colors.textPrimary : colors.textPrimary,
                  shadowOpacity: isDark ? 0 : 0.04,
                  shadowRadius: isDark ? 0 : 8,
                  shadowOffset: { width: 0, height: 2 },
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: colors.surface3,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.item.cardType === "friendPing" && item.item.sourceName ? (
                      <Text style={{ color: meta.tint, fontWeight: "500", fontSize: 15 }}>
                        {item.item.sourceName[0]?.toUpperCase() || "F"}
                      </Text>
                    ) : (
                      <Ionicons name={meta.icon} size={20} color={meta.tint} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 14.5, flex: 1 }}>
                        {item.item.cardType === "friendPing" && item.item.count > 1 && item.item.sourceName
                          ? `${item.item.sourceName} pinged you`
                          : item.item.title}
                      </Text>
                      {item.item.count > 1 ? (
                        <View
                          style={{
                            minWidth: 24,
                            height: 24,
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: colors.accentSubtle,
                            backgroundColor: colors.accentDim,
                          }}
                        >
                          <Text style={{ color: colors.accentMuted, fontWeight: "400", fontSize: 11 }}>
                            {item.item.count}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.textSecondary, fontWeight: "300", lineHeight: 18 }}>
                      {subtitle}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "300" }}>
                        {relativeTime(item.item.createdAtMs)}
                      </Text>
                      {item.item.cta ? (
                        <Text style={{ color: meta.tint, fontSize: 12, fontWeight: "400" }}>
                          {item.item.cta}
                        </Text>
                      ) : null}
                    </View>
                    {expanded ? (
                      <View
                        style={{
                          marginTop: 4,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                          paddingTop: 8,
                          gap: 6,
                        }}
                      >
                        {item.item.items.map((n) => (
                          <Text key={n.id} style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "300" }}>
                            {relativeTime(toMs(n))}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Swipeable>
          );
        }}
      />
    </View>
  );
}
