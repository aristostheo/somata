import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  StatusBar,
  Pressable,
  Alert,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { db } from "@/lib/firebase";
import { withAlpha } from "@/lib/color";

import BottomTabSpacer from "@/components/ui/BottomTapSpacer";
import {
  PremiumSegmented,
  type FriendsTabKey,
} from "@/components/friends/premium/PremiumSegmented";
import {
  FriendRowPremium,
  type FriendCardChip,
} from "@/components/friends/premium/FriendRowPremium";
import { RequestRowPremium } from "@/components/friends/premium/RequestRowPremium";
import { FriendsAddSheet } from "@/components/friends/premium/FriendsAddSheet";

import { subscribeProfile, type Profile } from "@/services/profile";
import {
  friendTrendLabel,
  getFriendVisibility,
  isFriendSharingAnything,
} from "@/services/friends/visibility";
import {
  subscribeFriends,
  subscribeFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriendship,
  pingFriend,
  cancelFriendRequest,
  updateFriendNickname,
  type FriendEdge,
} from "@/services/friends/friends";
import {
  notifyFriendAccepted,
  notifyFriendRequestSafe,
  notifyPingSafe,
} from "@/services/notifications";
import { upsertBlock, createReport } from "@/services/friends/friendsSafety";
import type { FoodEntry } from "@/services/nutrition";
import type { Workout } from "@/services/workouts";
import { BADGE_BY_ID } from "@/services/badges/registry";

type UIFriend = {
  id: string;
  friendUid: string;
  name: string;
  uidLabel: string;
  subtitle?: string;
  accentColor: string;
  raw: FriendEdge;
};

type FriendSession = {
  id: string;
  title: string;
  date: string;
  lastMs: number;
  exerciseCount: number;
  durationMin: number;
  items: Workout[];
};

type ActivityFeedItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tsLabel: string;
};

type FriendIntel = {
  streakDays: number;
  workoutCountWeek: number;
  latestWorkout?: FriendSession | null;
  mealsToday: FoodEntry[];
  mealsByDate: Record<string, FoodEntry[]>;
  proteinTotalToday: number;
  caloriesToday: number;
  stepCountToday: number;
  lastActiveMs: number;
  badgeCount: number;
  topBadgeIds: string[];
  recentSessions: FriendSession[];
  activityFeed: ActivityFeedItem[];
  prLabel?: string | null;
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

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function datesBack(days: number) {
  const list: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    list.push(isoDate(d));
  }
  return list;
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

function activeLabel(ms: number) {
  if (!ms) return "Active recently";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 60) return "Active today";
  const hr = Math.floor(min / 60);
  if (hr < 24) return "Active today";
  const day = Math.floor(hr / 24);
  return day <= 1 ? "Active yesterday" : `Active ${day}d ago`;
}

function cooldownLabel(ms: number) {
  if (!ms) return "";
  const left = ms - Date.now();
  if (left <= 0) return "";
  const hours = Math.ceil(left / (60 * 60 * 1000));
  return `Ping again in ${hours}h`;
}

function computeStreak(dateKeys: string[]) {
  const set = new Set(dateKeys);
  let streak = 0;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const key = isoDate(d);
    if (set.has(key)) streak += 1;
    else break;
  }
  return streak;
}

function focusLabel(profile: Profile | null | undefined) {
  const p: any = profile || {};
  const goal = p.goal || p.macroEngineMode;
  const weight = Number(p.weightKg || 0);
  const target = Number(p.targetWeightKg || 0);
  const mode =
    goal === "cut"
      ? "Cut"
      : goal === "bulk" || goal === "lean_bulk"
      ? "Bulk"
      : "Maintain";
  if (weight && target && goal === "cut" && weight > target) {
    const lb = (weight - target) * 2.20462;
    return `${mode} · ${Math.round(lb)} lb to go`;
  }
  return mode;
}

function groupSessions(rows: Workout[]) {
  const byKey = new Map<string, Workout[]>();
  for (const row of rows) {
    const key =
      row.sessionId ||
      `${row.date}:${row.sessionTitle || row.exercise}:${row.sessionStartedAt || row.setCreatedAt || row.id}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }
  const sessions: FriendSession[] = [...byKey.entries()].map(([key, items]) => {
    const lastMs = Math.max(
      ...items.map((item) =>
        Number(item.setCreatedAt || item.sessionStartedAt || toMillis(item.createdAt) || 0)
      )
    );
    const firstMs = Math.min(
      ...items.map((item) =>
        Number(item.setCreatedAt || item.sessionStartedAt || toMillis(item.createdAt) || lastMs)
      )
    );
    const title =
      items[0]?.sessionTitle ||
      (items.length === 1 ? items[0]?.exercise : `${items[0]?.exercise} +${items.length - 1}`);
    return {
      id: key,
      title: title || "Workout",
      date: items[0]?.date || "",
      lastMs,
      durationMin: Math.max(0, Math.round((lastMs - firstMs) / 60000)) || 45,
      exerciseCount: new Set(items.map((item) => item.exercise)).size,
      items,
    };
  });
  sessions.sort((a, b) => b.lastMs - a.lastMs);
  return sessions;
}

function sharedSummary(
  intel: FriendIntel | undefined,
  profile: Profile | null | undefined
) {
  const visibility = getFriendVisibility(profile);
  if (!visibility.enabled || !isFriendSharingAnything(profile)) {
    return "Nothing shared yet";
  }
  if (visibility.progress?.consistencyStreak && (intel?.streakDays || 0) > 0) {
    return `${intel?.streakDays} day streak`;
  }
  if (
    visibility.nutrition?.macroBreakdown &&
    profile?.proteinGoal &&
    (intel?.proteinTotalToday || 0) >= Number(profile.proteinGoal || 0)
  ) {
    return "Hit protein goal today";
  }
  if (visibility.workouts?.personalRecords && intel?.prLabel) {
    return intel.prLabel;
  }
  if (visibility.workouts?.workoutsLogged && intel?.latestWorkout) {
    return `Logged a workout · ${relativeTimeFromMs(intel.latestWorkout.lastMs)}`;
  }
  if (visibility.activity?.stepCount && (intel?.stepCountToday || 0) > 0) {
    return `${Math.round(intel?.stepCountToday || 0).toLocaleString()} steps today`;
  }
  return "No activity shared";
}

function buildFriendChips(
  intel: FriendIntel | undefined,
  profile: Profile | null | undefined
) {
  const visibility = getFriendVisibility(profile);
  const chips: FriendCardChip[] = [];
  if (visibility.progress?.consistencyStreak && (intel?.streakDays || 0) > 0) {
    chips.push({
      key: "streak",
      label: `${intel?.streakDays} days`,
      tone: "amber",
    });
  }
  chips.push({
    key: "active",
    label: activeLabel(intel?.lastActiveMs || 0),
    tone: "gray",
  });
  if (
    visibility.nutrition?.macroBreakdown &&
    profile?.proteinGoal &&
    intel &&
    intel.proteinTotalToday > 0
  ) {
    chips.push({
      key: "protein",
      label:
        intel.proteinTotalToday >= Number(profile.proteinGoal || 0)
          ? "Protein goal hit"
          : `${Math.round(intel.proteinTotalToday)}g protein`,
      tone: "purple",
    });
  } else if (visibility.workouts?.workoutsLogged && intel?.latestWorkout) {
    chips.push({
      key: "workout",
      label: `${intel.latestWorkout.exerciseCount} exercises`,
      tone: "green",
    });
  } else if (visibility.progress?.badgeCollection && (intel?.badgeCount || 0) > 0) {
    chips.push({
      key: "badges",
      label: `${intel?.badgeCount} badges`,
      tone: "purple",
    });
  }
  return chips.slice(0, 3);
}

async function loadMealsRange(uid: string, fromISO: string, toISO: string) {
  const out: FoodEntry[] = [];
  for (const sub of ["nutritionEntries", "foodEntries", "meals"]) {
    try {
      const collRef = collection(db, "users", uid, sub);
      let snap;
      try {
        snap = await getDocs(
          query(
            collRef,
            where("date", ">=", fromISO),
            where("date", "<=", toISO),
            orderBy("date", "desc"),
            limit(120)
          )
        );
      } catch {
        snap = await getDocs(collRef);
      }
      snap.forEach((d) => {
        const data = d.data() as any;
        const date = String(data.date || "");
        if (!date || date < fromISO || date > toISO) return;
        out.push({
          id: d.id,
          date,
          meal: data.meal || "snacks",
          name: data.name || "",
          qty: Number(data.qty || 0),
          unit: data.unit || "serving",
          calories: Number(data.calories || 0),
          protein: Number(data.protein || 0),
          carbs: Number(data.carbs || 0),
          fat: Number(data.fat || 0),
          items: Array.isArray(data.items) ? data.items : undefined,
          createdAt: data.createdAt ?? null,
        } as any);
      });
    } catch {}
  }
  return out;
}

async function loadFriendIntel(
  uid: string,
  profile: Profile | null | undefined
): Promise<FriendIntel> {
  const visibility = getFriendVisibility(profile);
  const recentDates = datesBack(10);
  const weekStart = isoDate(startOfWeek());
  const today = recentDates[0];

  let workouts: Workout[] = [];
  if (
    visibility.enabled &&
    (visibility.workouts?.workoutsLogged ||
      visibility.workouts?.workoutDetails ||
      visibility.workouts?.personalRecords ||
      visibility.workouts?.weeklyVolume)
  ) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", uid, "workouts"),
          where("date", ">=", recentDates[recentDates.length - 1]),
          orderBy("date", "desc"),
          limit(120)
        )
      );
      workouts = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          date: x.date || "",
          exercise: x.exercise || "",
          primaryMuscle: x.primaryMuscle || "",
          sets: Number(x.sets || 0),
          reps: Number(x.reps || 0),
          weight: Number(x.weight || 0),
          notes: x.notes || "",
          createdAt: x.createdAt ?? null,
          sessionId: x.sessionId ?? null,
          sessionTitle: x.sessionTitle ?? null,
          sessionStartedAt: x.sessionStartedAt ?? null,
          setCreatedAt: x.setCreatedAt ?? null,
        } as Workout;
      });
    } catch {}
  }

  let meals: FoodEntry[] = [];
  if (
    visibility.enabled &&
    (visibility.nutrition?.mealsLoggedToday ||
      visibility.nutrition?.dailyCaloriesTotal ||
      visibility.nutrition?.macroBreakdown)
  ) {
    meals = await loadMealsRange(uid, recentDates[recentDates.length - 1], today);
  }

  let badgeIds: string[] = [];
  if (visibility.enabled && visibility.progress?.badgeCollection) {
    try {
      const snap = await getDocs(collection(db, "users", uid, "badges"));
      badgeIds = snap.docs.map((d) => d.id);
    } catch {}
  }

  const mealsByDate = meals.reduce<Record<string, FoodEntry[]>>((acc, meal) => {
    if (!acc[meal.date]) acc[meal.date] = [];
    acc[meal.date].push(meal);
    return acc;
  }, {});

  const todayMeals = mealsByDate[today] || [];
  const todayProtein = todayMeals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
  const todayCalories = todayMeals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const sessions = groupSessions(workouts);
  const sessionThisWeek = sessions.filter((session) => session.date >= weekStart);
  const lastWorkout = sessions[0] || null;
  const stepCountToday = Number((profile as any)?.steps?.[today] || 0);
  const activeDates = new Set<string>();
  for (const date of Object.keys(mealsByDate)) activeDates.add(date);
  for (const workout of workouts) if (workout.date) activeDates.add(workout.date);
  if (visibility.activity?.stepCount) {
    Object.entries((profile as any)?.steps || {}).forEach(([date, count]) => {
      if (Number(count || 0) > 0) activeDates.add(date);
    });
  }
  const streakDays = computeStreak([...activeDates]);

  let lastActiveMs = Math.max(
    Number(profile?.updatedAt || 0),
    Number((profile as any)?.healthLastUpdatedAt || 0),
    stepCountToday > 0 ? Date.now() : 0,
    lastWorkout?.lastMs || 0
  );
  for (const meal of todayMeals) {
    lastActiveMs = Math.max(lastActiveMs, toMillis((meal as any).createdAt));
  }

  let prLabel: string | null = null;
  if (visibility.workouts?.personalRecords && workouts.length) {
    const best = workouts
      .filter((row) => Number(row.weight || 0) > 0)
      .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0];
    if (best) prLabel = `New PR: ${best.exercise} · ${Math.round(best.weight || 0)}kg`;
  }

  const activityFeed: ActivityFeedItem[] = [];
  if (
    visibility.nutrition?.macroBreakdown &&
    profile?.proteinGoal &&
    todayProtein >= Number(profile.proteinGoal || 0)
  ) {
    activityFeed.push({
      key: "protein",
      icon: "checkmark-circle-outline",
      text: "Hit protein goal",
      tsLabel: "Today",
    });
  }
  if (lastWorkout && visibility.workouts?.workoutsLogged) {
    activityFeed.push({
      key: `workout-${lastWorkout.id}`,
      icon: "barbell-outline",
      text: `${lastWorkout.title} · ${lastWorkout.durationMin} min`,
      tsLabel: relativeTimeFromMs(lastWorkout.lastMs),
    });
  }
  if (streakDays >= 3 && visibility.progress?.consistencyStreak) {
    activityFeed.push({
      key: "streak",
      icon: "flame-outline",
      text: `${streakDays}-day streak milestone`,
      tsLabel: "Today",
    });
  }
  if (prLabel) {
    activityFeed.push({
      key: "pr",
      icon: "trophy-outline",
      text: prLabel.replace("New PR: ", ""),
      tsLabel: lastWorkout ? relativeTimeFromMs(lastWorkout.lastMs) : "Recently",
    });
  }

  return {
    streakDays,
    workoutCountWeek: sessionThisWeek.length,
    latestWorkout: lastWorkout,
    mealsToday: todayMeals,
    mealsByDate,
    proteinTotalToday: todayProtein,
    caloriesToday: todayCalories,
    stepCountToday,
    lastActiveMs,
    badgeCount: badgeIds.length,
    topBadgeIds: badgeIds.slice(0, 3),
    recentSessions: sessions.slice(0, 8),
    activityFeed: activityFeed.slice(0, 4),
    prLabel,
  };
}

function LockedCard({ text, action }: { text: string; action?: () => void }) {
  const { colors } = useTheme() as any;
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontWeight: "400", lineHeight: 20 }}>
        {text}
      </Text>
      {action ? (
        <Pressable
          onPress={action}
          style={{
            alignSelf: "flex-start",
            minHeight: 36,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: colors.surface2,
            borderWidth: 1,
            borderColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: "400" }}>Ping →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function FriendsPage() {
  const { colors, isDark } = useTheme() as any;
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
  const [friendProfiles, setFriendProfiles] = useState<Record<string, Profile | null>>({});
  const [friendIntel, setFriendIntel] = useState<Record<string, FriendIntel>>({});
  const [selected, setSelected] = useState<UIFriend | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<null | "profile" | "meals" | "workouts">(null);
  const [pingPickerOpen, setPingPickerOpen] = useState(false);
  const [pendingPing, setPendingPing] = useState<UIFriend | null>(null);
  const [selectedPingPreset, setSelectedPingPreset] = useState<string | null>(null);
  const [nicknameEditorOpen, setNicknameEditorOpen] = useState(false);
  const [nicknameValue, setNicknameValue] = useState("");
  const [toast, setToast] = useState("");

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  useEffect(() => {
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

  useEffect(() => {
    const acceptedUids = accepted.map((edge) => edge.friendUid).filter(Boolean);
    if (!acceptedUids.length) {
      setFriendProfiles({});
      return;
    }
    const unsubs = acceptedUids.map((uid) =>
      subscribeProfile(uid, (profile) =>
        setFriendProfiles((cur) => ({ ...cur, [uid]: profile }))
      )
    );
    return () => {
      unsubs.forEach((fn) => fn?.());
    };
  }, [accepted]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        accepted.map(async (edge) => {
          const profile = friendProfiles[edge.friendUid];
          const intel = await loadFriendIntel(edge.friendUid, profile);
          return [edge.friendUid, intel] as const;
        })
      );
      if (cancelled) return;
      setFriendIntel((cur) => {
        const next = { ...cur };
        for (const [uid, intel] of entries) next[uid] = intel;
        return next;
      });
    };
    if (accepted.length) run();
    else setFriendIntel({});
    return () => {
      cancelled = true;
    };
  }, [accepted, friendProfiles]);

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
            } catch {}
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

  const selectedProfile = selected ? friendProfiles[selected.friendUid] : null;
  const selectedIntel = selected ? friendIntel[selected.friendUid] : undefined;
  const selectedVisibility = getFriendVisibility(selectedProfile);
  const mealsVisible =
    !!selected &&
    selectedVisibility.enabled &&
    selectedVisibility.nutrition?.mealsLoggedToday;
  const workoutsVisible =
    !!selected &&
    selectedVisibility.enabled &&
    selectedVisibility.workouts?.workoutsLogged;
  const progressVisible =
    !!selected &&
    selectedVisibility.enabled &&
    (selectedVisibility.progress?.consistencyStreak ||
      selectedVisibility.progress?.badgeCollection ||
      selectedVisibility.progress?.weeklyReportCard ||
      selectedVisibility.progress?.weightTrend);

  const mealPeriodDates = useMemo(() => {
    const today = datesBack(10)[0];
    const yesterday = datesBack(10)[1];
    return {
      today: [today],
      yesterday: [yesterday],
      week: datesBack(10),
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => Haptics.selectionAsync()}
            tintColor={colors.muted}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: topInset + 18, paddingBottom: 28 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 14 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>Friends</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Calm connection. Private by default.
                </Text>
              </View>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={({ pressed }) => [
                  styles.addBtn,
                  {
                    backgroundColor: pressed ? colors.surface2 : colors.surface1,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Text style={{ color: colors.accent, fontWeight: "400" }}>+ Add</Text>
              </Pressable>
            </View>

            <PremiumSegmented
              value={tab}
              onChange={setTab}
              requestCount={requestsUI.length}
            />

            <View
              style={{
                minHeight: 46,
                borderRadius: 16,
                backgroundColor: colors.surface3,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
              }}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search friends..."
                placeholderTextColor={withAlpha(colors.muted, 0.75)}
                style={{ flex: 1, color: colors.textPrimary, fontWeight: "400", fontSize: 14 }}
              />
            </View>

            {errorMsg ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    borderColor: colors.danger,
                    backgroundColor: withAlpha(colors.danger, 0.12),
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "400" }}>{errorMsg}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          tab === "friends" ? (
            <View style={{ alignItems: "center", paddingTop: 36, gap: 14 }}>
              <View style={styles.emptyGraphic}>
                <View
                  style={[
                    styles.emptyDot,
                    { left: 18, top: 18, backgroundColor: colors.surface3, borderColor: colors.border },
                  ]}
                />
                <View
                  style={[
                    styles.emptyDot,
                    { right: 18, bottom: 18, backgroundColor: colors.surface3, borderColor: colors.border },
                  ]}
                />
                <View style={[styles.emptyLine, { backgroundColor: colors.border }]} />
              </View>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 18 }}>
                No friends yet
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                Add someone you trust with their email or UID. Everything is private by default.
              </Text>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: colors.surface1 }]}>+ Add your first friend</Text>
              </Pressable>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: "300" }}>
                  Or share your UID so they can find you
                </Text>
                <Pressable
                  onPress={() => user?.uid && handleCopyUid(user.uid)}
                  style={[styles.copyChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "400" }}>
                    Copy my UID
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : tab === "requests" ? (
            <View style={{ paddingTop: 36, alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 16 }}>
                No pending requests
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                Share your UID to connect with friends
              </Text>
            </View>
          ) : (
            <View style={{ paddingTop: 36, alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 16 }}>
                No sent requests
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                Add someone using their email or UID
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          if (tab === "friends") {
            const intel = friendIntel[item.friendUid];
            const profile = friendProfiles[item.friendUid];
            const lastPingMs = toMillis(item.raw.lastPingAt);
            const canPing =
              !lastPingMs || Date.now() - lastPingMs >= PING_COOLDOWN_MS;
            const streakTone =
              (intel?.streakDays || 0) >= 14
                ? "gold"
                : (intel?.streakDays || 0) >= 3
                ? "green"
                : "gray";
            return (
              <Animated.View entering={FadeInDown.duration(320).delay(index * 24)}>
                <FriendRowPremium
                  displayName={item.name}
                  uidLabel={item.uidLabel}
                  activitySummary={sharedSummary(intel, profile)}
                  accentColor={item.accentColor}
                  streakRingTone={streakTone}
                  nicknameMissing={!item.raw.friendDisplayName?.trim()}
                  onAddNickname={() => {
                    setSelected(item);
                    setNicknameValue(item.raw.friendDisplayName || "");
                    setNicknameEditorOpen(true);
                  }}
                  chips={buildFriendChips(intel, profile)}
                  canPing={canPing}
                  pingCooldownLabel={!canPing ? cooldownLabel(lastPingMs + PING_COOLDOWN_MS) : ""}
                  onPress={() => openDetail(item)}
                  onPing={() => openPing(item)}
                />
              </Animated.View>
            );
          }

          if (tab === "requests") {
            return (
              <Animated.View entering={FadeInDown.duration(320).delay(index * 24)}>
                <RequestRowPremium
                  name={item.name}
                  handle={item.uidLabel}
                  subtitle={item.subtitle}
                  accentSeed={item.friendUid}
                  mode="incoming"
                  onAccept={() => handleRespond(item.friendUid, true)}
                  onDecline={() => handleRespond(item.friendUid, false)}
                />
              </Animated.View>
            );
          }

          return (
            <Animated.View entering={FadeInDown.duration(320).delay(index * 24)}>
              <RequestRowPremium
                name={item.name}
                handle={item.uidLabel}
                subtitle={item.subtitle}
                accentSeed={item.friendUid}
                mode="sent"
                onCancel={() => handleCancelOutgoing(item.friendUid)}
              />
            </Animated.View>
          );
        }}
      />

      <BottomTabSpacer />

      <FriendsAddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSend={handleSend}
        sending={sending}
        disabled={!user?.uid}
        privacyNote="Requests are private. No public search directory."
        myUid={user?.uid}
      />

      {detailOpen && selected ? (
        <View style={[styles.overlay, { backgroundColor: withAlpha(colors.textPrimary, isDark ? 0.5 : 0.16) }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setDetailOpen(false);
              setActiveModal(null);
            }}
          />
          <View style={[styles.sheet, { backgroundColor: colors.surface2, borderColor: colors.borderElevated }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.surface3 }]} />
            <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 16 }}>
              {activeModal ? (
                <View style={styles.rowBetween}>
                  <Pressable
                    onPress={() => setActiveModal(null)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "400" }}>
                      {selected.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setDetailOpen(false);
                      setActiveModal(null);
                    }}
                  >
                    <Ionicons name="close" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ) : null}

              {!activeModal ? (
                <>
              <View style={{ alignItems: "center", gap: 8 }}>
                <View
                  style={[
                    styles.detailAvatarRing,
                    {
                      borderColor:
                        (selectedIntel?.streakDays || 0) >= 14
                          ? colors.warning
                          : (selectedIntel?.streakDays || 0) >= 3
                          ? colors.success
                          : withAlpha(colors.text, 0.14),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.detailAvatar,
                      {
                        backgroundColor: withAlpha(selected.accentColor, 0.18),
                        borderColor: withAlpha(selected.accentColor, 0.3),
                      },
                    ]}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 28 }}>
                      {selected.name[0]?.toUpperCase() || "F"}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 22 }}>
                  {selected.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: "300" }}>
                    {selected.uidLabel}
                  </Text>
                  <Pressable onPress={() => handleCopyUid(selected.friendUid)}>
                    <Ionicons name="copy-outline" size={16} color={colors.muted} />
                  </Pressable>
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: "300" }}>
                  {`${activeLabel(selectedIntel?.lastActiveMs || 0)} · ${
                    (selectedIntel?.streakDays || 0) > 0
                      ? `${selectedIntel?.streakDays} day streak`
                      : "No current streak"
                  }`}
                </Text>
              </View>

              <View style={styles.quickRow}>
                {[
                  { key: "ping", icon: "notifications-outline", label: "Ping", onPress: () => openPing(selected) },
                  { key: "profile", icon: "eye-outline", label: "Profile", onPress: () => setActiveModal("profile") },
                  { key: "meals", icon: "restaurant-outline", label: "Meals", onPress: () => setActiveModal("meals") },
                  { key: "workouts", icon: "barbell-outline", label: "Workouts", onPress: () => setActiveModal("workouts") },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={[styles.quickBtn, { backgroundColor: colors.surface3, borderColor: colors.border }]}
                  >
                    <Ionicons name={item.icon as any} size={18} color={colors.accent} />
                    <Text style={{ color: colors.textSecondary, fontWeight: "400", fontSize: 12 }}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>RECENT ACTIVITY</Text>
                {selectedIntel?.activityFeed?.length ? (
                  selectedIntel.activityFeed.map((row) => (
                    <View key={row.key} style={styles.feedRow}>
                      <Ionicons name={row.icon} size={16} color={colors.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "400" }}>{row.text}</Text>
                        <Text style={{ color: colors.textTertiary, fontWeight: "300", marginTop: 2 }}>
                          {row.tsLabel}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.textTertiary, lineHeight: 20 }}>
                    Your friend keeps things private. You can still ping them.
                  </Text>
                )}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>STATS SNAPSHOT</Text>
                <View style={styles.grid}>
                  {[
                    {
                      key: "streak",
                      label: "Streak",
                      value:
                        progressVisible && selectedVisibility.progress?.consistencyStreak
                          ? `${selectedIntel?.streakDays || 0} days`
                          : "Private",
                    },
                    {
                      key: "protein",
                      label: "Protein",
                      value:
                        selectedVisibility.enabled && selectedVisibility.nutrition?.macroBreakdown
                          ? selectedProfile?.proteinGoal &&
                            (selectedIntel?.proteinTotalToday || 0) >= Number(selectedProfile?.proteinGoal || 0)
                            ? "Goal hit today"
                            : `${Math.round(selectedIntel?.proteinTotalToday || 0)}g today`
                          : "Private",
                    },
                    {
                      key: "workouts",
                      label: "Workouts",
                        value:
                        workoutsVisible
                          ? `${selectedIntel?.workoutCountWeek || 0} this week`
                          : "Private",
                    },
                    {
                      key: "badges",
                      label: "Badges",
                        value:
                        selectedVisibility.enabled && selectedVisibility.progress?.badgeCollection
                          ? `${selectedIntel?.badgeCount || 0} earned`
                          : "Private",
                    },
                  ].map((tile) => (
                    <View key={tile.key} style={[styles.statTile, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                      <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 11 }}>
                        {tile.label}
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontWeight: "400", fontSize: 15, marginTop: 8 }}>
                        {tile.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.actionsCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Pressable style={styles.actionRow} onPress={() => openPing(selected)}>
                  <Text style={[styles.actionPrimary, { color: colors.accent }]}>Ping →</Text>
                </Pressable>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    setNicknameValue(selected.raw.friendDisplayName || "");
                    setNicknameEditorOpen(true);
                  }}
                >
                  <Text style={[styles.actionNeutral, { color: colors.textSecondary }]}>Edit nickname →</Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: withAlpha(colors.text, 0.08), marginVertical: 8 }} />
                <Pressable style={styles.actionRow} onPress={() => handleRemove(selected)}>
                  <Text style={[styles.actionDanger, { color: colors.danger }]}>Remove friend</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={() => handleBlock(selected)}>
                  <Text style={[styles.actionDanger, { color: colors.danger }]}>Block</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={() => handleReport(selected)}>
                  <Text style={[styles.actionNeutral, { color: colors.textSecondary }]}>Report</Text>
                </Pressable>
              </View>
                </>
              ) : null}

              {activeModal === "profile" ? (
                <>
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <View
                      style={[
                        styles.detailAvatar,
                        {
                          backgroundColor: withAlpha(selected.accentColor, 0.18),
                          borderColor: withAlpha(selected.accentColor, 0.3),
                        },
                      ]}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 24 }}>
                        {selected.name[0]?.toUpperCase() || "F"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 22 }}>
                      {selected.name}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontWeight: "300" }}>
                      Private connection
                    </Text>
                  </View>
                  <View style={styles.grid}>
                    {[
                      {
                        label: "Current focus",
                        value:
                          selectedVisibility.enabled && selectedVisibility.progress?.weightTrend
                            ? focusLabel(selectedProfile)
                            : "Private",
                      },
                      {
                        label: "Streak",
                        value:
                          selectedVisibility.enabled && selectedVisibility.progress?.consistencyStreak
                            ? `${selectedIntel?.streakDays || 0} days`
                            : "Private",
                      },
                      {
                        label: "Member since",
                        value: selectedProfile?.createdAt
                          ? new Date(selectedProfile.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              year: "numeric",
                            })
                          : "Recently",
                      },
                      {
                        label: "Trend",
                        value:
                          selectedVisibility.enabled && selectedVisibility.progress?.weightTrend
                            ? friendTrendLabel(selectedProfile) || "On track"
                            : "Private",
                      },
                    ].map((tile) => (
                      <View key={tile.label} style={[styles.statTile, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                        <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 11 }}>
                          {tile.label}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontWeight: "400", fontSize: 15, marginTop: 8 }}>
                          {tile.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>BADGE SHOWCASE</Text>
                    {selectedVisibility.enabled && selectedVisibility.progress?.badgeCollection ? (
                      selectedIntel?.topBadgeIds?.length ? (
                        <View style={{ gap: 10 }}>
                          {selectedIntel.topBadgeIds.slice(0, 3).map((id) => {
                            const badge = BADGE_BY_ID[id];
                            return (
                              <View key={id} style={styles.feedRow}>
                                <Ionicons
                                  name={(badge?.icon || "ribbon-outline") as any}
                                  size={18}
                                  color={badge?.accent || colors.accent}
                                />
                                <Text style={{ color: colors.textPrimary, fontWeight: "400" }}>
                                  {badge?.title || id}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={{ color: colors.textTertiary }}>No badges shared yet</Text>
                      )
                    ) : (
                      <LockedCard text="Private" />
                    )}
                  </View>
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => openPing(selected)}
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.surface1 }]}>Ping →</Text>
                  </Pressable>
                </>
              ) : null}

              {activeModal === "meals" ? (
                mealsVisible ? (
                  <>
                    <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 20 }}>
                      {selected.name}'s recent meals
                    </Text>
                    <View style={styles.periodTabs}>
                      {[
                        { key: "today", label: "Today" },
                        { key: "yesterday", label: "Yesterday" },
                        { key: "week", label: "This Week" },
                      ].map((period) => {
                        const dates =
                          period.key === "today"
                            ? mealPeriodDates.today
                            : period.key === "yesterday"
                            ? mealPeriodDates.yesterday
                            : mealPeriodDates.week;
                        const items = dates.flatMap(
                          (date) => selectedIntel?.mealsByDate?.[date] || []
                        );
                        const totalCalories = items.reduce(
                          (sum, item) => sum + Number(item.calories || 0),
                          0
                        );
                        return (
                          <View
                            key={period.key}
                            style={[styles.periodCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                          >
                            <Text style={{ color: colors.textPrimary, fontWeight: "400" }}>
                              {period.label}
                            </Text>
                            <Text style={{ color: colors.textTertiary, marginTop: 4 }}>
                              {items.length ? `${Math.round(totalCalories)} kcal` : "No meals"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    {["breakfast", "lunch", "dinner", "snacks"].map((meal) => {
                      const items = selectedIntel?.mealsToday?.filter(
                        (item) => String(item.meal).toLowerCase() === meal
                      ) || [];
                      const total = items.reduce(
                        (sum, item) => sum + Number(item.calories || 0),
                        0
                      );
                      return (
                        <View
                          key={meal}
                          style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
                        >
                          <View style={styles.rowBetween}>
                            <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
                              {meal[0].toUpperCase() + meal.slice(1)}
                            </Text>
                            <Text style={{ color: colors.textTertiary, fontWeight: "300" }}>
                              {total ? `${Math.round(total)} kcal` : "No entries"}
                            </Text>
                          </View>
                          {items.length ? (
                            items.map((item) => (
                              <Text key={item.id} style={{ color: colors.textSecondary, marginTop: 6 }}>
                                {item.name}
                              </Text>
                            ))
                          ) : (
                            <Text style={{ color: colors.textTertiary, marginTop: 6 }}>
                              No items logged
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <LockedCard
                    text={`${selected.name} hasn't shared recent meals. You can ping them to ask.`}
                    action={() => openPing(selected)}
                  />
                )
              ) : null}

              {activeModal === "workouts" ? (
                workoutsVisible ? (
                  <>
                    <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 20 }}>
                      {selected.name}'s workouts
                    </Text>
                    {(selectedIntel?.recentSessions || []).slice(0, 5).map((session) => (
                      <View
                        key={session.id}
                        style={[styles.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
                      >
                        <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 16 }}>
                          {session.title}
                        </Text>
                        <Text style={{ color: colors.textTertiary, marginTop: 6 }}>
                          {session.date} · {session.durationMin} min · {session.exerciseCount} exercises
                        </Text>
                        {selectedVisibility.workouts?.workoutDetails ? (
                          <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
                            {session.items
                              .slice(0, 3)
                              .map((item) => item.exercise)
                              .join(" · ")}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/friends/${encodeURIComponent(
                            selected.friendUid
                          )}/workouts?name=${encodeURIComponent(selected.name)}`
                        )
                      }
                    >
                      <Text style={{ color: colors.accent, fontWeight: "400" }}>See more →</Text>
                    </Pressable>
                  </>
                ) : (
                  <LockedCard text={`${selected.name}'s workouts are private.`} />
                )
              ) : null}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {pingPickerOpen && pendingPing ? (
        <View style={[styles.overlay, { backgroundColor: withAlpha(colors.textPrimary, isDark ? 0.5 : 0.16) }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPingPickerOpen(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.surface2, borderColor: colors.borderElevated }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 18 }}>
              Send a nudge to {pendingPing.name}
            </Text>
            <Text style={{ color: colors.textTertiary, lineHeight: 18 }}>
              They'll get a gentle notification. No pressure.
            </Text>
            <View style={styles.presetWrap}>
              {PING_PRESETS.map((preset) => {
                const active = selectedPingPreset === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => setSelectedPingPreset(preset)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: active ? colors.surface1 : colors.surface2,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.accent : colors.textSecondary,
                        fontWeight: "400",
                      }}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setSelectedPingPreset("")}>
              <Text style={{ color: colors.textTertiary, fontWeight: "300" }}>Send blank ping</Text>
            </Pressable>
            <Pressable
              disabled={selectedPingPreset === null}
              onPress={async () => {
                await sendPing(pendingPing, selectedPingPreset || "");
                setPingPickerOpen(false);
              }}
              style={[
                styles.primaryBtn,
                {
                  opacity: selectedPingPreset === null ? 0.45 : 1,
                  alignSelf: "stretch",
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.surface1 }]}>Send</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {nicknameEditorOpen && selected ? (
        <View style={[styles.overlay, { backgroundColor: withAlpha(colors.textPrimary, isDark ? 0.5 : 0.16) }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setNicknameEditorOpen(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.surface2, borderColor: colors.borderElevated }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: "500", fontSize: 18 }}>
              Edit nickname
            </Text>
            <Text style={{ color: colors.textTertiary }}>
              This name is only visible to you.
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <TextInput
                value={nicknameValue}
                onChangeText={setNicknameValue}
                placeholder="Enter a nickname"
                placeholderTextColor={withAlpha(colors.muted, 0.7)}
                style={{ color: colors.textPrimary, fontWeight: "400", fontSize: 15 }}
              />
            </View>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
              onPress={handleNicknameSave}
            >
              <Text style={[styles.primaryBtnText, { color: colors.surface1 }]}>Save nickname</Text>
            </Pressable>
          </View>
        </View>
      ) : null}


      {toast ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.toast}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>{toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  addBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  emptyGraphic: {
    width: 120,
    height: 72,
    position: "relative",
    justifyContent: "center",
  },
  emptyDot: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyLine: {
    alignSelf: "center",
    width: 54,
    height: 2,
    borderRadius: 999,
  },
  emptyBody: {
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
    fontWeight: "300",
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primaryBtnText: {
    fontWeight: "500",
    fontSize: 14,
  },
  copyChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 12,
  },
  sheet: {
    minHeight: "85%",
    maxHeight: "90%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 12,
  },
  detailAvatarRing: {
    width: 84,
    height: 84,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    width: "48.5%",
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  actionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  actionRow: {
    minHeight: 40,
    justifyContent: "center",
  },
  actionPrimary: {
    fontSize: 15,
    fontWeight: "400",
  },
  actionNeutral: {
    fontSize: 15,
    fontWeight: "400",
  },
  actionDanger: {
    fontSize: 15,
    fontWeight: "400",
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  presetChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  periodTabs: {
    flexDirection: "row",
    gap: 10,
  },
  periodCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
});
