import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";
import { subscribeFoodsByDate, type FoodEntry } from "@/services/nutrition";
import { subscribeAccountWeightEntries } from "@/services/profile/accountWeightEntries";
import type { AccountWeightEntry } from "@/services/profile/accountWeightData";
import { getFitAdaptPlan, type FitAdaptPlanState } from "@/services/fitadapt";
import { dashboardLoggedToday, dashboardPreviewPlan } from "@/services/dashboardPreviewData";
import { recordedStepsForDate } from "@/components/profile/overviewData";
import { recordedStepDays, recordedWeightDays } from "@/services/profile/fitadaptInsightData";
import { dayKey } from "@/utils/date";

type Owned<T> = { uid: string; value: T };
function startDay(today: string, back: number) {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - back);
  return dayKey(date);
}

export function usePreviewAccount() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [ownedProfile, setOwnedProfile] = useState<Owned<Profile | null> | null>(null);
  const [ownedFoods, setOwnedFoods] = useState<Owned<FoodEntry[] | null> & { date: string } | null>(null);
  const [ownedWeight, setOwnedWeight] = useState<Owned<AccountWeightEntry[] | null> | null>(null);
  const [ownedPlan, setOwnedPlan] = useState<Owned<FitAdaptPlanState | null> | null>(null);
  const [planStatus, setPlanStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const timer = setInterval(() => setToday(dayKey(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setOwnedProfile(null);
    if (!uid) return;
    return subscribeProfile(uid, (value) => setOwnedProfile({ uid, value }));
  }, [uid]);
  useEffect(() => {
    setOwnedFoods(null);
    if (!uid) return;
    return subscribeFoodsByDate(uid, today,
      (value) => setOwnedFoods({ uid, date: today, value }),
      () => setOwnedFoods({ uid, date: today, value: null }));
  }, [uid, today]);
  useEffect(() => {
    setOwnedWeight(null);
    if (!uid) return;
    return subscribeAccountWeightEntries(uid, (value) => setOwnedWeight({ uid, value }));
  }, [uid]);
  useFocusEffect(useCallback(() => {
    setToday(dayKey(new Date()));
    if (!uid) return;
    let active = true;
    setPlanStatus("loading");
    setOwnedPlan(null);
    getFitAdaptPlan().then((value) => {
      if (active) { setOwnedPlan({ uid, value }); setPlanStatus("ready"); }
    }).catch(() => { if (active) setPlanStatus("error"); });
    return () => { active = false; };
  }, [uid]));

  const profile = ownedProfile && ownedProfile.uid === uid ? ownedProfile.value : undefined;
  const foods = ownedFoods && ownedFoods.uid === uid && ownedFoods.date === today ? ownedFoods.value : undefined;
  const weights = ownedWeight && ownedWeight.uid === uid ? ownedWeight.value : undefined;
  const planState = ownedPlan && ownedPlan.uid === uid ? ownedPlan.value : null;
  const plan = dashboardPreviewPlan(profile, planState, planStatus);
  const logged = useMemo(() => foods ? dashboardLoggedToday(foods, today) : null, [foods, today]);
  const stepsMap = (profile as (Profile & { steps?: Record<string, unknown> }) | null | undefined)?.steps;
  const steps = profile ? recordedStepsForDate(stepsMap, new Date(`${today}T12:00:00`)) : null;
  const stepsWeek = recordedStepDays(stepsMap, startDay(today, 6), today);
  const weightDays = recordedWeightDays(weights, startDay(today, 29), today);
  const stepGoal = profile && typeof profile.stepsGoal === "number" && profile.stepsGoal > 0
    ? profile.stepsGoal : profile && typeof profile.stepsPerDay === "number" && profile.stepsPerDay > 0
      ? profile.stepsPerDay : undefined;
  const setPlanState = useCallback((value: FitAdaptPlanState | null) => {
    if (uid) setOwnedPlan({ uid, value });
  }, [uid]);

  return { user, uid, today, profile, foods, weights, planState, planStatus, plan, logged,
    steps, stepsWeek, stepGoal, weightDays, setPlanState };
}
