import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/content/AuthContext";
import { dayKey } from "@/utils/date";
import { kgToLb } from "@/utils/units";
import { subscribeProfile, type Profile } from "@/services/profile";
import { subscribeFoodsBetween, type FoodEntry } from "@/services/nutrition";
import { subscribeAccountWeightEntries } from "@/services/profile/accountWeightEntries";
import type { AccountWeightEntry } from "@/services/profile/accountWeightData";
import { loadFitAdaptHistoryPage, type FitAdaptHistoryCursor } from "@/services/profile/fitadaptHistory";
import type { FitAdaptHistoryEvent } from "@/services/profile/fitadaptHistoryData";
import { recordedNutritionDays, recordedStepDays, recordedWeightDays } from "@/services/profile/fitadaptInsightData";
import { FitAdaptInsightsView } from "@/components/homeFlows/FitAdaptInsightsView";

type Range = 30 | 90;

export default function FitAdaptInsightsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<Range>(30);
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [hidden, setHidden] = useState(false);
  const [dataUid, setDataUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [weights, setWeights] = useState<AccountWeightEntry[] | null | undefined>(undefined);
  const [foods, setFoods] = useState<FoodEntry[] | null | undefined>(undefined);
  const [events, setEvents] = useState<FitAdaptHistoryEvent[]>([]);
  const [historyUid, setHistoryUid] = useState<string | null>(null);
  const [cursor, setCursor] = useState<FitAdaptHistoryCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historyLock = useRef(false);
  const historyGeneration = useRef(0);

  const from = useMemo(() => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - range + 1);
    return dayKey(date);
  }, [today, range]);

  useFocusEffect(useCallback(() => { setToday(dayKey(new Date())); }, []));
  useEffect(() => {
    setDataUid(user?.uid ?? null);
    if (!user?.uid) { setProfile(null); setWeights(null); setFoods(null); return; }
    let active = true;
    setProfile(undefined); setWeights(undefined); setFoods(undefined);
    const unsubscribe = [
      subscribeProfile(user.uid, (next) => { if (active) setProfile(next); }),
      subscribeAccountWeightEntries(user.uid, (next) => { if (active) setWeights(next); }),
      subscribeFoodsBetween(user.uid, from, today,
        (next) => { if (active) setFoods(next); }, () => { if (active) setFoods(null); }),
    ];
    return () => { active = false; unsubscribe.forEach((stop) => stop()); };
  }, [user?.uid, from, today]);

  const loadHistory = useCallback(async (more: boolean) => {
    if (!user?.uid || historyLock.current || (more && !cursor)) return;
    const owner = user.uid;
    const generation = historyGeneration.current;
    historyLock.current = true; setHistoryBusy(true); setHistoryError(false);
    try {
      const page = await loadFitAdaptHistoryPage(owner, more ? cursor! : undefined);
      if (generation !== historyGeneration.current) return;
      setHistoryUid(owner);
      setEvents((previous) => more ? [...previous, ...page.events] : page.events);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch { if (generation === historyGeneration.current) setHistoryError(true); }
    finally { if (generation === historyGeneration.current) { historyLock.current = false; setHistoryBusy(false); } }
  }, [user?.uid, cursor]);

  useEffect(() => {
    historyGeneration.current += 1;
    historyLock.current = false;
    setHistoryUid(user?.uid ?? null);
    setEvents([]); setCursor(null); setHasMore(false);
    setHistoryBusy(false); setHistoryError(false);
    void loadHistory(false);
  // The initial page is keyed by account; cursor changes should not reset it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const currentProfile = dataUid === user?.uid ? profile : undefined;
  const currentWeights = dataUid === user?.uid ? weights : undefined;
  const currentFoods = dataUid === user?.uid ? foods : undefined;
  const currentEvents = historyUid === user?.uid ? events : [];
  const weightDays = recordedWeightDays(currentWeights, from, today);
  const steps = (currentProfile as (Profile & { steps?: Record<string, unknown> }) | null | undefined)?.steps;
  const stepDays = recordedStepDays(steps, from, today);
  const nutritionDays = recordedNutritionDays(currentFoods, from, today);
  const energyDays = nutritionDays.filter((day): day is typeof day & { calories: number } => day.calories !== null)
    .map((day) => ({ date: day.date, value: day.calories }));
  const unit = currentProfile?.weightUnit === "lb" ? "lb" : "kg";
  const weightValue = (value: number) => `${(unit === "lb" ? kgToLb(value) : value).toFixed(1)} ${unit}`;

  return <FitAdaptInsightsView
    onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
    range={range} setRange={setRange} hidden={hidden} setHidden={setHidden}
    metrics={[
      { id: "weight", title: "Weight", icon: "scale-outline", days: weightDays,
        display: weightValue, loading: currentWeights === undefined, error: currentWeights === null,
        context: "Dated weight entries saved to your account. Device-only body history is excluded." },
      { id: "energy", title: "Energy", icon: "restaurant-outline", days: energyDays,
        display: (value) => `${Math.round(value).toLocaleString()} kcal`,
        loading: currentFoods === undefined, error: currentFoods === null,
        context: hidden ? "Logging counts hidden. Logged food may not represent a full day's intake." :
          `${nutritionDays.length} days have nutrition entries; ${nutritionDays.length - energyDays.length} have incomplete energy values. Logged food may not represent a full day's intake.` },
      { id: "steps", title: "Steps", icon: "footsteps-outline", days: stepDays,
        display: (value) => `${Math.round(value).toLocaleString()} steps`,
        loading: currentProfile === undefined, error: currentProfile === null,
        context: "Dated steps saved on this account. A recorded zero stays distinct from a missing day." },
    ]}
    events={currentEvents} busy={historyBusy} error={historyError}
    hasMore={historyUid === user?.uid && hasMore} loadHistory={(more) => { void loadHistory(more); }} />;
}
