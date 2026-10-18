import { accountStorage, type AccountStore, useAccountStorage } from '@/services/local/accountStore';
import { Action, ArcProgress, Card, fmt, GoalTrack, LinkRow, Metric, Page, Section } from "@/components/designPreview/UI";
import { usePreviewAccount } from "@/components/designPreview/usePreviewAccount";
import EditFoodSheet from "@/components/nutrition/uiNew/EditFoodSheet";
import { useSomataTheme } from "@/components/somata/theme";
import { dashboardLoggedToday } from "@/services/dashboardPreviewData";
import { deleteFood, subscribeFoodsByDate, updateFood, type FoodEntry } from "@/services/nutrition";
import { consumePreviewNutritionHandoffs } from "@/services/previewNutritionHandoff";
import { dayKey } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;
function changeDay(date: string, delta: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + delta);
  return dayKey(next);
}
function nice(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,
    { weekday: "short", month: "short", day: "numeric" });
}

export default function DesignNutrition() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const account = usePreviewAccount();
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [foods, setFoods] = useState<FoodEntry[] | null | undefined>(undefined);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [water, setWater] = useState<number | null>(null);
  useEffect(() => {
    setFoods(undefined);
    if (!account.uid) return;
    return subscribeFoodsByDate(account.uid, date, setFoods, () => setFoods(null));
  }, [account.uid, date]);
  useFocusEffect(useCallback(() => {
    if (!account.uid) return;
    const retry = () => consumePreviewNutritionHandoffs(account.uid!, date, setDate).catch(() => {
      Alert.alert("Meal not saved yet", "Your confirmed meal is kept on this device. Check your connection and retry.",
        [{ text: "Later", style: "cancel" }, { text: "Retry", onPress: () => { void retry(); } }]);
    });
    void retry();
  }, [account.uid, date]));
  useFocusEffect(useCallback(() => {
    let active = true;
    setWater(null);
    void localStore.getItem(`@water:${date}`).then((raw) => {
      if (active) setWater(raw == null ? null : Math.max(0, Number(raw) || 0));
    }).catch(() => { if (active) setWater(null); });
    return () => { active = false; };
  }, [date]));
  const totals = useMemo(() => foods ? dashboardLoggedToday(foods, date) : null, [foods, date]);
  const today = date === account.today;
  const goal = today ? account.plan.targets : null;
  const energy = totals?.calories ?? null;
  const ratio = energy != null && goal?.calories && goal.calories > 0 ? energy / goal.calories : null;
  const profileWater = account.profile as (typeof account.profile & {
    waterGoalMl?: number; dailyWaterTargetMl?: number; hydrationGoalMl?: number;
  });
  const savedWaterGoal = profileWater?.waterGoalMl ?? profileWater?.dailyWaterTargetMl ?? profileWater?.hydrationGoalMl;
  const waterGoal = typeof savedWaterGoal === "number" && savedWaterGoal > 0 ? savedWaterGoal : 2400;
  const setWaterStored = async (amount: number) => {
    try {
      const next = Math.max(0, Math.round(amount));
      await localStore.setItem(`@water:${date}`, String(next));
      setWater(next);
    } catch { Alert.alert("Water could not be saved", "Please try again."); }
  };
  const log = (meal: string, route = "/(modals)/add-meal") =>
    router.push({ pathname: route as never, params: { date, meal } });
  const remove = (item: FoodEntry) => {
    if (!account.uid) return;
    Alert.alert("Delete this entry?", item.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          void deleteFood(account.uid!, item.id).catch(() => Alert.alert("Could not delete", "Please try again."));
        }
      },
    ]);
  };
  const saveEdit = async (patch: Partial<FoodEntry>) => {
    if (!account.uid || !editing || saving) return;
    setSaving(true);
    try { await updateFood(account.uid, editing.id, patch); setEditing(null); }
    catch { Alert.alert("Could not save changes", "Please try again."); }
    finally { setSaving(false); }
  };
  const openSuggestion = () => {
    if (!today || !goal || !totals || [goal.calories, goal.protein, goal.carbs, goal.fat,
    totals.calories, totals.protein, totals.carbs, totals.fat].some((value) => value == null)) return;
    const left = (target: number | undefined, used: number | null) =>
      String(Math.max(0, Math.round(target! - used!)));
    router.push({
      pathname: "/(modals)/what-should-i-eat", params: {
        date, meal: "snacks", kcalLeft: left(goal.calories, totals.calories),
        proteinLeft: left(goal.protein, totals.protein), carbsLeft: left(goal.carbs, totals.carbs),
        fatLeft: left(goal.fat, totals.fat),
      }
    });
  };
  return <>
    <Page eyebrow="Fuel / daily record" title="Nutrition" subtitle="Move through dates, log food, and see what is recorded."
      headerAction={<Pressable accessibilityRole="button" accessibilityLabel="Open full calendar"
        onPress={() => router.push("/(modals)/full-calendar")}
        style={{
          width: 44, height: 44, borderRadius: 22, backgroundColor: D.card,
          alignItems: "center", justifyContent: "center"
        }}>

        <Ionicons name="calendar-outline" size={19} color={D.lime} />

      </Pressable>}>

      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>

        <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate(changeDay(date, -1))}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}>

          <Ionicons name="chevron-back" size={22} color={D.teal} />

        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Go to today" onPress={() => setDate(account.today)}
          style={{ alignItems: "center", gap: 2 }}>

          <Text style={{ color: D.text, fontSize: 17, fontWeight: "800" }}>{nice(date)}</Text>

          <Text style={{ color: D.dim, fontSize: 11 }}>{today ? "TODAY" : "TAP FOR TODAY"}</Text>

        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => setDate(changeDay(date, 1))}
          style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}>

          <Ionicons name="chevron-forward" size={22} color={D.teal} />

        </Pressable>

      </Card>

      <Card accent>

        <Section title="Energy logged" caption={today ? account.plan.title : "Recorded day · no historical target comparison"} />

        <Text style={{ color: D.text, fontSize: 38, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
          {foods === undefined ? "Loading…" : foods === null ? "Unavailable" : fmt(energy, " kcal")}
        </Text>

        {today && <ArcProgress ratio={ratio} label={goal?.calories ? `${fmt(goal.calories)} kcal current target` : "No current target available"} />}

        <Text style={{ color: D.muted, fontSize: 11 }}>Missing nutrients stay unknown; logged zero remains zero.</Text>

      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        <Metric label="Protein" value={fmt(totals?.protein, " g")} tone="lime" />

        <Metric label="Carbs" value={fmt(totals?.carbs, " g")} tone="plain" />

        <Metric label="Fat" value={fmt(totals?.fat, " g")} tone="plain" />

      </View>

      {today && <Card>

        <Section title="Goal tracker" caption="Today's logged amounts against current targets" />

        <GoalTrack label="Energy" logged={totals?.calories} target={goal?.calories} unit=" kcal" />

        <GoalTrack label="Protein" logged={totals?.protein} target={goal?.protein} unit=" g" />

        <GoalTrack label="Carbs" logged={totals?.carbs} target={goal?.carbs} unit=" g" />

        <GoalTrack label="Fat" logged={totals?.fat} target={goal?.fat} unit=" g" />

        {!!account.planState?.pending && <Text style={{ color: D.muted, fontSize: 11 }}>
          Pending review is separate; your current targets stay in place.
        </Text>}

      </Card>}

      <Card>

        <Section title="On-device hydration" caption="This existing water record stays on this device" />

        <Text style={{ color: D.text, fontSize: 24, fontWeight: "800" }}>
          {water == null ? "—" : `${fmt(water)} ml`} <Text style={{ color: D.muted, fontSize: 12, fontWeight: "500" }}> / {fmt(waterGoal)} ml goal</Text>
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

          <Action label="Add 250 ml" icon="add" onPress={() => { if (water != null) void setWaterStored(water + 250); }} />

          <Action label="Clear day" icon="refresh-outline" onPress={() => { if (water != null) void setWaterStored(0); }} />

        </View>

      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>

        <Action label="Add food" icon="add" bright onPress={() => log("snacks")} />

        <Action label="Quick add" icon="flash-outline" onPress={() => log("snacks", "/(modals)/quick-add")} />

        <Action label="Scan" icon="scan-outline" onPress={() => router.push(`/(modals)/scan-meal?date=${date}` as never)} />

        <Action label="Meal builder" icon="layers-outline" onPress={() => log("snacks", "/(modals)/meal-builder")} />

      </View>

      <Section title="Meal timeline" caption={foods == null ? "Account entries" : `${foods.length} entries on this date`} />

      {MEALS.map((meal) => {
        const entries = (foods ?? []).filter((item) => item.meal === meal);
        return <Card key={meal}>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>

            <Text style={{ color: D.text, fontSize: 17, fontWeight: "800", textTransform: "capitalize" }}>{meal}</Text>

            <Action label="Add" icon="add" onPress={() => log(meal)} />

          </View>

          {foods === undefined ? <Text style={{ color: D.muted }}>Loading entries…</Text> : foods === null ?
            <Text style={{ color: D.muted }}>Entries unavailable. Try again later.</Text> : entries.length === 0 ?
              <Text style={{ color: D.dim, fontSize: 12 }}>Nothing logged here.</Text> :
              entries.map((item) => <Pressable key={item.id} accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`} onPress={() => item.entryKind === "meal" ? remove(item) : setEditing(item)}
                onLongPress={() => remove(item)} style={{
                  borderTopWidth: 1, borderColor: D.line,
                  paddingVertical: 11, flexDirection: "row", gap: 9, alignItems: "center"
                }}>

                <View style={{ flex: 1, gap: 3 }}>

                  <Text style={{ color: D.text, fontSize: 14, fontWeight: "700" }}>{item.name}</Text>

                  <Text style={{ color: D.dim, fontSize: 11 }}>
                    {item.entryKind === "meal" ? "Meal bundle · tap for options" : `${item.qty} ${item.unit} · tap to edit`}
                  </Text>

                </View>

                <Text style={{ color: D.lime, fontSize: 14, fontWeight: "800" }}>{fmt(item.calories, " kcal")}</Text>

              </Pressable>)}

        </Card>;
      })}

      <Card>

        <Section title="More nutrition tools" />

        {today && goal && totals && [goal.calories, goal.protein, goal.carbs, goal.fat,
        totals.calories, totals.protein, totals.carbs, totals.fat].every((value) => value != null) &&
          <LinkRow title="What should I eat?" icon="sparkles-outline"
            detail="Use today's remaining targets" onPress={openSuggestion} />}

        <LinkRow title="Calendar" icon="calendar-outline" onPress={() => router.push("/(modals)/full-calendar")} />

        <LinkRow title="Diet choices" icon="restaurant-outline" onPress={() => router.push("/(modals)/diet-preferences")} />

        <LinkRow title="Quick water log" detail="Separate local quick-log history" icon="water-outline"
          onPress={() => router.push("/(modals)/quick-hydration")} />

      </Card>

    </Page>
    <EditFoodSheet open={!!editing} item={editing} saving={saving} onClose={() => setEditing(null)}
      onSave={(patch) => { void saveEdit(patch); }} onDelete={(id) => {
        const item = editing;
        setEditing(null);
        if (item?.id === id) remove(item);
      }} />
  </>;
}
