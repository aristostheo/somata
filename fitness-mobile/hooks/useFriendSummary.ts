import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { useAuth } from "@/content/AuthContext";
import { getFriendSummary, friendSummaryError, type FriendSummary } from "@/services/friends/summary";

/** Memory only. Clear on blur/background/account change; refetch privacy every 30s while visible. */
export function useFriendSummary(friendUid: string, enabled = true) {
  const { user } = useAuth();
  const [state, setState] = useState<{ key: string; data?: FriendSummary; error?: string }>({ key: "" });
  const [attempt, setAttempt] = useState(0);
  const key = `${user?.uid || ""}:${friendUid}:${enabled}`;
  useFocusEffect(useCallback(() => {
    let alive = true, generation = 0, inFlight = false;
    const clear = () => { generation++; inFlight = false; setState({ key }); };
    const load = async () => {
      if (!enabled || !user?.uid || !friendUid || AppState.currentState === "background" || inFlight) return;
      const token = ++generation; inFlight = true;
      try {
        const data = await getFriendSummary(friendUid);
        if (alive && token === generation) setState({ key, data });
      } catch (error) {
        if (alive && token === generation) setState({ key, error: friendSummaryError(error) });
      } finally { if (token === generation) inFlight = false; }
    };
    clear(); void load();
    const timer = setInterval(() => { void load(); }, 30000);
    const subscription = AppState.addEventListener("change", next => { clear(); if (next === "active") void load(); });
    return () => { alive = false; generation++; clearInterval(timer); subscription.remove(); setState({ key: "" }); };
  }, [user?.uid, friendUid, enabled, attempt, key]));
  const current = !user?.uid ? { key, error: "Sign in to view shared activity." } : !friendUid ? { key, error: "Choose a friend to view shared activity." } : state.key === key ? state : { key };
  return { ...current, loading: !current.data && !current.error, refresh: () => setAttempt(n => n + 1) };
}
