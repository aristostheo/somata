import { DeskIntro, DeskSection, DeskColumns, StatusNote } from "@/components/accountSettings/PremiumUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { SharedSummary } from "@/components/friends/SharedSummary";
import { Button, Choice, Empty, Field, IconButton, Item, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Text,
  View
} from "react-native";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";

import { FriendsAddSheet } from "@/components/friends/premium/FriendsAddSheet";
import {
  type FriendsTabKey
} from "@/components/friends/premium/PremiumSegmented";

import {
  cancelFriendRequest,
  pingFriend,
  removeFriendship,
  respondToFriendRequest,
  sendFriendRequest,
  subscribeFriendRequests,
  subscribeFriends,
  updateFriendNickname,
  type FriendEdge,
} from "@/services/friends/friends";
import { createReport, upsertBlock } from "@/services/friends/friendsSafety";
import {
  notifyFriendAccepted,
  notifyFriendRequestSafe,
  notifyPingSafe,
} from "@/services/notifications";

type UIFriend = {
  id: string;
  friendUid: string;
  name: string;
  uidLabel: string;
  subtitle?: string;
  accentColor: string;
  raw: FriendEdge;
};

const PING_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const PING_PRESETS = [
  "Keep it up!",
  "Log your meal!",
  "Protect that streak!",
  "Let's go!",
];

function truncateUid(uid: string) {
  if (!uid) return "";
  return uid.length > 8 ? `${uid.slice(0, 8)}...` : uid;
}

function displayFromEdge(e: FriendEdge, index = 0): string {
  return e.friendDisplayName?.trim() || `Friend ${index + 1}`;
}

function toMillis(t: any) {
  return t && typeof t.toMillis === "function"
    ? t.toMillis()
    : typeof t === "number"
      ? t
      : 0;
}

function accentFromSeed(seed: string, palette: string[]) {
  const hash = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const safePalette = palette.filter(Boolean);
  if (!safePalette.length) return "";
  return safePalette[Math.abs(hash) % safePalette.length];
}

function relativeTimeFromMs(ms: number) {
  if (!ms) return "Recently";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  return `${day}d ago`;
}

function FriendsPage() {
  const { F, t } = useTaskPresentation();

  const { colors } = useProfileFlowTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<FriendsTabKey>("friends");
  const [search, setSearch] = useState("");
  const [friendsEdges, setFriendsEdges] = useState<FriendEdge[]>([]);
  const [incomingEdges, setIncomingEdges] = useState<FriendEdge[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<UIFriend | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<null | "profile" | "meals" | "workouts">(null);
  const [pingPickerOpen, setPingPickerOpen] = useState(false);
  const [pendingPing, setPendingPing] = useState<UIFriend | null>(null);
  const [selectedPingPreset, setSelectedPingPreset] = useState<string | null>(null);
  const [nicknameEditorOpen, setNicknameEditorOpen] = useState(false);
  const [nicknameValue, setNicknameValue] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setFriendsEdges([]); setIncomingEdges([]); setSelected(null); setDetailOpen(false);
    if (!user?.uid) return;
    setLoadingA(true);
    setLoadingB(true);
    setErrorMsg(null);
    const unsubA = subscribeFriends(
      user.uid,
      (edges) => {
        setFriendsEdges(edges);
        setLoadingA(false);
      },
      ["accepted", "pending"]
    );
    const unsubB = subscribeFriendRequests(user.uid, (edges) => {
      setIncomingEdges(edges);
      setLoadingB(false);
    });
    return () => {
      unsubA?.();
      unsubB?.();
    };
  }, [user?.uid]);

  const pendingOutgoing = useMemo(
    () =>
      friendsEdges.filter(
        (edge) => edge.status === "pending" && edge.direction === "outgoing"
      ),
    [friendsEdges]
  );

  const accepted = useMemo(
    () => friendsEdges.filter((edge) => edge.status === "accepted"),
    [friendsEdges]
  );

  const accentPalette = useMemo(
    () =>
      [
        colors.accent,
        colors.info || colors.accent,
        colors.success || colors.accent,
        colors.warning || colors.accent,
        colors.danger || colors.accent,
      ].filter(Boolean),
    [colors.accent, colors.info, colors.success, colors.warning, colors.danger]
  );

  const friendsUI: UIFriend[] = useMemo(
    () =>
      accepted.map((edge, index) => ({
        id: edge.id,
        friendUid: edge.friendUid,
        name: displayFromEdge(edge, index),
        uidLabel: truncateUid(edge.friendUid),
        subtitle: "",
        accentColor: accentFromSeed(edge.friendUid, accentPalette),
        raw: edge,
      })),
    [accepted, accentPalette]
  );

  const requestsUI: UIFriend[] = useMemo(
    () =>
      incomingEdges.map((edge) => ({
        id: edge.id,
        friendUid: edge.friendUid,
        name: "Someone wants to connect",
        uidLabel: truncateUid(edge.friendUid),
        subtitle: edge.requestedAt
          ? `Sent ${relativeTimeFromMs(toMillis(edge.requestedAt))}`
          : "Pending request",
        accentColor: accentFromSeed(edge.friendUid, accentPalette),
        raw: edge,
      })),
    [incomingEdges, accentPalette]
  );

  const sentUI: UIFriend[] = useMemo(
    () =>
      pendingOutgoing.map((edge) => ({
        id: edge.id,
        friendUid: edge.friendUid,
        name: edge.friendEmail || truncateUid(edge.friendUid),
        uidLabel: edge.friendEmail ? truncateUid(edge.friendUid) : edge.friendEmail || "",
        subtitle: edge.requestedAt
          ? `Pending · Sent ${relativeTimeFromMs(toMillis(edge.requestedAt))}`
          : "Pending approval",
        accentColor: accentFromSeed(edge.friendUid, accentPalette),
        raw: edge,
      })),
    [pendingOutgoing, accentPalette]
  );

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friendsUI;
    return friendsUI.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.friendUid.toLowerCase().includes(q) ||
        item.raw.friendEmail?.toLowerCase().includes(q)
    );
  }, [friendsUI, search]);

  const data =
    tab === "friends" ? filteredFriends : tab === "requests" ? requestsUI : sentUI;

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
      setAddOpen(false);
      setToast("Request sent");
      setTimeout(() => setToast(""), 1600);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not send request.");
      Alert.alert("Could not send request", e?.message || "Unknown error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Couldn't update request", e?.message || "Unknown error");
    }
  }

  async function sendPing(friend: UIFriend, message: string) {
    if (!user?.uid) return;
    await pingFriend(user.uid, friend.friendUid);
    await notifyPingSafe(
      friend.friendUid,
      {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? "Friend",
      },
      { message: message || undefined }
    );
    setToast(`Ping sent to ${friend.name}`);
    setTimeout(() => setToast(""), 1600);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function openPing(friend: UIFriend) {
    const lastPingMs = toMillis(friend.raw.lastPingAt);
    const canPing = !lastPingMs || Date.now() - lastPingMs >= PING_COOLDOWN_MS;
    if (!canPing) {
      setToast("You pinged recently — give them some space");
      setTimeout(() => setToast(""), 1800);
      return;
    }
    setPendingPing(friend);
    setSelectedPingPreset(null);
    setPingPickerOpen(true);
  }

  function openDetail(friend: UIFriend) {
    setSelected(friend);
    setDetailOpen(true);
  }

  async function handleCopyUid(uid: string) {
    await Clipboard.setStringAsync(uid);
    setToast("UID copied");
    setTimeout(() => setToast(""), 1400);
    Haptics.selectionAsync();
  }

  async function handleNicknameSave() {
    if (!user?.uid || !selected) return;
    try {
      await updateFriendNickname(user.uid, selected.friendUid, nicknameValue.trim() || null);
      setNicknameEditorOpen(false);
      setToast("Nickname saved");
      setTimeout(() => setToast(""), 1400);
    } catch (e: any) {
      Alert.alert("Couldn't save nickname", e?.message || "Unknown error");
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
          await cancelFriendRequest(user.uid!, toUid);
        },
      },
    ]);
  }

  async function handleRemove(friend: UIFriend) {
    if (!user?.uid) return;
    Alert.alert(
      `Remove ${friend.name}?`,
      `Remove ${friend.name}? They won't be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFriendship(user.uid!, friend.friendUid);
            setDetailOpen(false);
          },
        },
      ]
    );
  }

  async function handleBlock(friend: UIFriend) {
    if (!user?.uid) return;
    Alert.alert(
      `Block ${friend.name}?`,
      "Block this person? You'll both disappear from each other's lists.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            await upsertBlock(user.uid!, friend.friendUid, true);
            try {
              await removeFriendship(user.uid!, friend.friendUid);
            } catch { }
            setDetailOpen(false);
          },
        },
      ]
    );
  }

  async function handleReport(friend: UIFriend) {
    if (!user?.uid) return;
    const submit = async (reason: string) => {
      await createReport(user.uid!, friend.friendUid, reason);
      setDetailOpen(false);
      setToast("Report sent");
      setTimeout(() => setToast(""), 1400);
    };
    Alert.alert("Report reason", "Choose a reason", [
      { text: "Spam", onPress: () => submit("spam") },
      { text: "Harassment", onPress: () => submit("harassment") },
      {
        text: "Inappropriate content",
        onPress: () => submit("inappropriate content"),
      },
      { text: "Other", onPress: () => submit("other") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (<><TaskPage title="Your circle" section="Friends" subtitle="Share what you choose, with people you trust." onBack={() => router.back()} action={<IconButton icon="person-add-outline" label="Add friend" onPress={() => setAddOpen(true)} />}>

    <DeskIntro icon="people-outline" label="Your connections" title="A circle, on your terms." detail="Friendship and fitness sharing are separate choices.">
      <DeskColumns><Button primary label="Add someone" icon="person-add-outline" onPress={() => setAddOpen(true)} />
      <Button label="Copy my UID" icon="copy-outline" onPress={() => { if (user?.uid) handleCopyUid(user.uid); }} /></DeskColumns>
    </DeskIntro>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['friends', 'requests', 'sent'] as FriendsTabKey[]).map(t => <Choice key={t} label={t === 'friends' ? `Friends · ${friendsUI.length}` : t === 'requests' ? `Requests · ${requestsUI.length}` : `Sent · ${sentUI.length}`} selected={tab === t} onPress={() => setTab(t)} />)}
    </View>

    <Field label="Find a friend" placeholder="Name, email or UID" value={search} onChangeText={setSearch} />
    {!!errorMsg && <Empty title="Could not load friends" detail={errorMsg} />}
    {(loadingA || loadingB) && <Text style={F.caption}>Loading connections…</Text>}

    {data.map(friend => <Panel key={friend.id}>
      <Text style={F.eyebrow}>{tab === 'friends' ? 'CONNECTED' : tab === 'requests' ? 'RECEIVED REQUEST' : 'AWAITING RESPONSE'}</Text>
      <Item icon="person-circle-outline" title={friend.name} detail={tab === 'friends' ? "Open shared activity · sharing approval required" : friend.uidLabel} onPress={tab === 'friends' ? () => openDetail(friend) : undefined} />
      {tab === 'friends' ? <Button icon="paper-plane-outline" label="Send a nudge" onPress={() => openPing(friend)} /> : tab === 'requests' ? <DeskColumns>
        <Button primary label="Accept request" onPress={() => handleRespond(friend.friendUid, true)} />
        <Button label="Decline request" onPress={() => handleRespond(friend.friendUid, false)} />
      </DeskColumns> : <Button label="Cancel request" onPress={() => handleCancelOutgoing(friend.friendUid)} />}
    </Panel>)}

    {!data.length && !loadingA && !loadingB && <Empty title={tab === 'friends' ? 'No friends to show' : tab === 'requests' ? 'No pending requests' : 'No sent requests'} detail="Connect using an email or UID, or share your own UID privately." />}


    {!!toast && <Text accessibilityLiveRegion="polite" style={F.body}>{toast}</Text>}

  </TaskPage><FriendsAddSheet open={addOpen} onClose={() => setAddOpen(false)} onSend={handleSend} sending={sending} disabled={!user?.uid} myUid={user?.uid} />
    <TaskSheet title={selected?.name || 'Friend'} visible={detailOpen && !pingPickerOpen && !nicknameEditorOpen} onClose={() => { setDetailOpen(false); setActiveModal(null); }}>

      {selected && <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([null, 'profile', 'meals', 'workouts'] as const).map(v => <Choice key={v || 'overview'} label={v || 'Overview'} selected={activeModal === v} onPress={() => setActiveModal(v)} />)}
      </View>
        <SharedSummary key={selected.friendUid} friendUid={selected.friendUid} name={selected.name} mode={activeModal || "overview"} onNavigate={() => setDetailOpen(false)} enabled={detailOpen && !pingPickerOpen && !nicknameEditorOpen} />
        {!activeModal && <><DeskSection icon="chatbubble-ellipses-outline" title="Stay connected">
          <DeskColumns><Button icon="copy-outline" label="Copy UID" onPress={() => handleCopyUid(selected.friendUid)} /><Button icon="paper-plane-outline" label="Send a nudge" onPress={() => openPing(selected)} /></DeskColumns>
          <Button icon="pencil-outline" label="Edit nickname" onPress={() => { setNicknameValue(selected.raw.friendDisplayName || ''); setNicknameEditorOpen(true); }} />
        </DeskSection><DeskSection icon="shield-outline" title="Relationship controls">
          <Button danger label="Remove friend" onPress={() => handleRemove(selected)} /><DeskColumns><Button danger label="Block" onPress={() => handleBlock(selected)} /><Button label="Report" onPress={() => handleReport(selected)} /></DeskColumns>
        </DeskSection></>}
        {activeModal === 'workouts' && <Button label="Open workouts and save a shared template" onPress={() => { setDetailOpen(false); router.push(`/friends/${encodeURIComponent(selected.friendUid)}/workouts?name=${encodeURIComponent(selected.name)}`); }} />}
        {activeModal === 'profile' && <Button label="Shared progress" onPress={() => { setDetailOpen(false); router.push(`/friends/${encodeURIComponent(selected.friendUid)}/progress?name=${encodeURIComponent(selected.name)}`); }} />}
      </>}

    </TaskSheet>
    <TaskSheet title={`Nudge ${pendingPing?.name || 'friend'}`} visible={pingPickerOpen} onClose={() => setPingPickerOpen(false)}>
      <StatusNote icon="paper-plane-outline" title="A little encouragement" detail="They’ll receive a gentle notification." />
      <DeskColumns>{PING_PRESETS.map(p => <Choice key={p} label={p} selected={selectedPingPreset === p} onPress={() => setSelectedPingPreset(p)} />)}
      <Choice label="Blank ping" selected={selectedPingPreset === ''} onPress={() => setSelectedPingPreset('')} /></DeskColumns>
      <Button primary label="Send" disabled={selectedPingPreset === null} onPress={async () => { if (!pendingPing) return; await sendPing(pendingPing, selectedPingPreset || ''); setPingPickerOpen(false); }} />
    </TaskSheet>
    <TaskSheet title="A name just for you" visible={nicknameEditorOpen} onClose={() => setNicknameEditorOpen(false)}>
      <StatusNote icon="lock-closed-outline" title="Only you see this name" detail="Changing a nickname does not change your friend’s profile." />
      <Field label="Nickname" value={nicknameValue} onChangeText={setNicknameValue} />
      <Button primary label="Save nickname" onPress={handleNicknameSave} />
    </TaskSheet></>
  );
}

export default function PremiumFriendsPage() {
  return <SomataTaskAppearance><FriendsPage /></SomataTaskAppearance>;
}
