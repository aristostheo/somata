import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";
import { useRouter } from "expo-router";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import BottomTabSpacer from "@/components/ui/BottomTapSpacer";

import {
  subscribeFriends,
  subscribeFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriendship,
  pingFriend,
  cancelFriendRequest,
  type FriendEdge,
} from "@/services/friends/friends";

import {
  notifyFriendRequestSafe,
  notifyFriendAccepted,
  notifyPingSafe,
} from "@/services/notifications";

import {
  SegmentedControlPremium,
  FriendsTab,
} from "@/components/friends/SegmentedControl";
import { FriendCard } from "@/components/friends/FriendRow";
import { RequestCard } from "@/components/friends/RequestRow";
import { ActionSheet } from "@/components/friends/ActionSheet";
import { GlassPill } from "@/components/friends/GlassPill";
import { AddFriendSheet } from "@/components/friends/AddFriendSheet";

type UIFriend = {
  id: string; // edge doc id
  friendUid: string;
  name: string;
  handle?: string;
  subtitle?: string;
  accent?: "aqua" | "mint" | "violet" | "sun" | "ruby" | "slate";
  raw: FriendEdge;
};

function displayFromEdge(e: FriendEdge): string {
  return e.friendDisplayName || e.friendEmail || e.friendUid;
}

function toMillis(t: any) {
  return t && typeof t.toMillis === "function"
    ? t.toMillis()
    : typeof t === "number"
    ? t
    : 0;
}

function relativeTimeFrom(ts: any): string | null {
  const ms = toMillis(ts);
  if (!ms) return null;
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function pickAccent(seed: string): UIFriend["accent"] {
  const accents: UIFriend["accent"][] = [
    "aqua",
    "mint",
    "violet",
    "sun",
    "ruby",
    "slate",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return accents[hash % accents.length];
}

export default function FriendsPage() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<FriendsTab>("friends");
  const [friendsEdges, setFriendsEdges] = useState<FriendEdge[]>([]);
  const [incomingEdges, setIncomingEdges] = useState<FriendEdge[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [selected, setSelected] = useState<UIFriend | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubA = subscribeFriends(user.uid, setFriendsEdges, [
      "accepted",
      "pending",
    ]);
    const unsubB = subscribeFriendRequests(user.uid, setIncomingEdges);

    return () => {
      unsubA && unsubA();
      unsubB && unsubB();
    };
  }, [user?.uid]);

  const pendingOutgoing = useMemo(
    () =>
      friendsEdges.filter(
        (f) => f.status === "pending" && f.direction === "outgoing"
      ),
    [friendsEdges]
  );

  const accepted = useMemo(
    () => friendsEdges.filter((f) => f.status === "accepted"),
    [friendsEdges]
  );

  const friendsUI: UIFriend[] = useMemo(
    () =>
      accepted.map((e) => {
        const ping = relativeTimeFrom(e.lastPingAt);
        const updated = relativeTimeFrom(e.updatedAt);
        const subtitle = ping
          ? `Last ping • ${ping}`
          : updated
          ? `Updated • ${updated}`
          : "Connected";
        return {
          id: e.id,
          friendUid: e.friendUid,
          name: displayFromEdge(e),
          handle: e.friendEmail
            ? `@${(e.friendEmail.split("@")[0] || "user").toLowerCase()}`
            : undefined,
          subtitle,
          accent: pickAccent(e.friendUid),
          raw: e,
        };
      }),
    [accepted]
  );

  const requestsUI: UIFriend[] = useMemo(
    () =>
      incomingEdges.map((e) => {
        const when = relativeTimeFrom(e.requestedAt);
        return {
          id: e.id,
          friendUid: e.friendUid,
          name: displayFromEdge(e),
          handle: e.friendEmail
            ? `@${(e.friendEmail.split("@")[0] || "user").toLowerCase()}`
            : undefined,
          subtitle: when ? `Requested • ${when}` : "Incoming request",
          accent: pickAccent(e.friendUid),
          raw: e,
        };
      }),
    [incomingEdges]
  );

  const sentUI: UIFriend[] = useMemo(
    () =>
      pendingOutgoing.map((e) => {
        const when = relativeTimeFrom(e.requestedAt);
        return {
          id: e.id,
          friendUid: e.friendUid,
          name: displayFromEdge(e),
          handle: e.friendEmail
            ? `@${(e.friendEmail.split("@")[0] || "user").toLowerCase()}`
            : undefined,
          subtitle: when ? `Pending • ${when}` : "Pending approval",
          accent: pickAccent(e.friendUid),
          raw: e,
        };
      }),
    [pendingOutgoing]
  );

  const data =
    tab === "friends" ? friendsUI : tab === "requests" ? requestsUI : sentUI;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  async function handleSend(targetRaw: string, displayNameRaw: string) {
    const target = targetRaw.trim();
    const displayName = displayNameRaw.trim();
    if (!target || !user?.uid) return;

    setSending(true);
    try {
      await sendFriendRequest(
        user.uid,
        {
          friendUid: target,
          friendEmail: target.includes("@") ? target : null,
          friendDisplayName: displayName || null,
        },
        { email: user.email ?? null, displayName: user.displayName ?? null }
      );

      await notifyFriendRequestSafe(target, {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddOpen(false);
    } catch (e: any) {
      Alert.alert("Could not send request", e?.message || "Unknown error");
    } finally {
      setSending(false);
    }
  }

  async function handleRespond(friendUid: string, accept: boolean) {
    if (!user?.uid) return;
    try {
      await respondToFriendRequest(user.uid, friendUid, accept);
      if (accept) {
        await notifyFriendAccepted(friendUid, {
          uid: user.uid,
          displayName: user.displayName ?? user.email ?? "Friend",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e: any) {
      Alert.alert("Couldn't update request", e?.message || "Unknown error");
    }
  }

  async function handleRemove(friendUid: string) {
    if (!user?.uid) return;
    Alert.alert(
      "Remove friend?",
      "This will remove both sides of the friendship.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriendship(user.uid!, friendUid);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
            } catch (e: any) {
              Alert.alert("Couldn't remove", e?.message || "Unknown error");
            }
          },
        },
      ]
    );
  }

  async function handlePing(friendUid: string) {
    if (!user?.uid) return;
    try {
      await pingFriend(user.uid, friendUid);
      await notifyPingSafe(friendUid, {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? "Friend",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Couldn't ping", e?.message || "Unknown error");
    }
  }

  async function handleCancelOutgoing(toUid: string) {
    if (!user?.uid) return;
    Alert.alert("Cancel request?", "This will remove the pending request.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelFriendRequest(user.uid!, toUid);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            Alert.alert("Couldn't cancel", e?.message || "Unknown error");
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={
          isDark
            ? [
                "rgba(255,255,255,0.06)",
                "rgba(255,255,255,0.00)",
                "rgba(0,0,0,0.00)",
              ]
            : [
                "rgba(0,0,0,0.04)",
                "rgba(255,255,255,0.00)",
                "rgba(255,255,255,0.00)",
              ]
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill]}
      />

      <View style={{ paddingTop: topInset + 14, paddingHorizontal: 16 }}>
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 380 }}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                Friends
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                Your support circle — calm, private, intentional
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <GlassPill
                icon="search"
                label="Search"
                onPress={() => Haptics.selectionAsync()}
              />
              <GlassPill
                icon="person-add"
                label="Add"
                onPress={() => {
                  Haptics.selectionAsync();
                  setAddOpen(true);
                }}
              />
            </View>
          </View>
        </MotiView>

        <View style={{ height: 14 }} />
        <SegmentedControlPremium value={tab} onChange={setTab} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 28,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={{ paddingTop: 36, alignItems: "center" }}>
            <Ionicons name="people-outline" size={26} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 10 }}>
              {tab === "friends"
                ? "No friends yet"
                : tab === "requests"
                ? "No incoming requests"
                : "No pending sent requests"}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          if (tab === "friends") {
            return (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  duration: 380,
                  delay: 40 + index * 30,
                }}
              >
                <FriendCard
                  user={{
                    id: item.id,
                    name: item.name,
                    handle: item.handle,
                    subtitle: item.subtitle,
                    accent: item.accent,
                  }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(item);
                    setSheetOpen(true);
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelected(item);
                    setSheetOpen(true);
                  }}
                />
              </MotiView>
            );
          }

          return (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: "timing",
                duration: 380,
                delay: 40 + index * 30,
              }}
            >
              <RequestCard
                user={{
                  id: item.id,
                  name: item.name,
                  handle: item.handle,
                  subtitle: item.subtitle,
                  accent: item.accent,
                }}
                type={tab === "requests" ? "requests" : "sent"}
                onAccept={() => handleRespond(item.friendUid, true)}
                onDecline={() => handleRespond(item.friendUid, false)}
                onCancel={() => handleCancelOutgoing(item.friendUid)}
              />
            </MotiView>
          );
        }}
      />

      <BottomTabSpacer />

      <ActionSheet
        open={sheetOpen}
        title={selected?.name ?? ""}
        subtitle={selected?.handle ?? ""}
        onClose={() => setSheetOpen(false)}
        actions={[
          {
            key: "ping",
            title: "Ping",
            subtitle: "A gentle nudge — no pressure",
            icon: "notifications-outline",
            onPress: () =>
              selected?.friendUid && handlePing(selected.friendUid),
          },
          {
            key: "meals",
            title: "View Meals",
            subtitle: "Read-only history",
            icon: "restaurant-outline",
            onPress: () => {
              if (!selected?.friendUid) return;
              router.push(
                `/friends/${encodeURIComponent(
                  selected.friendUid
                )}?name=${encodeURIComponent(
                  selected.raw.friendDisplayName || ""
                )}`
              );
            },
          },
          {
            key: "workouts",
            title: "View Workouts",
            subtitle: "Read-only history",
            icon: "barbell-outline",
            onPress: () => {
              if (!selected?.friendUid) return;
              router.push(
                `/friends/${encodeURIComponent(
                  selected.friendUid
                )}/workouts?name=${encodeURIComponent(
                  selected.raw.friendDisplayName || ""
                )}`
              );
            },
          },
          {
            key: "remove",
            title: "Remove Friend",
            subtitle: "They won’t be notified",
            icon: "trash-outline",
            destructive: true,
            onPress: () =>
              selected?.friendUid && handleRemove(selected.friendUid),
          },
        ]}
      />

      <AddFriendSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sending={sending}
        onSend={handleSend}
        disabled={!user?.uid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
});
