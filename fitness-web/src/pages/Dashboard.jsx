// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  subscribeWorkouts,
  deleteWorkout,
  updateWorkout,
} from "../services/workouts";
import { subscribeWorkoutPresets } from "../services/presets";
import {
  ensureProfile,
  subscribeProfile,
  updateProfile,
} from "../services/profile";
import { getFoodsRange, getExerciseRange } from "../services/nutrition";

/* utils/hooks */
import {
  fmt,
  startOfWeek,
  startOfMonth,
  endOfToday,
  dayKey,
  labelDay,
} from "../utils/date";
import { kgToLb, lbToKg } from "../utils/units";
import useChartTheme from "../hooks/useChartTheme";

/* components */
import DashboardToolbar from "../components/dashboard/DashboardToolbar";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import WorkoutForm from "../components/dashboard/WorkoutForm";
import RecentWorkoutsGrouped from "../components/dashboard/RecentWorkoutsGrouped";
import {
  CaloriesVsGoalCard,
  MacroDonutCard,
  ExerciseBarCard,
} from "../components/dashboard/Charts";
import TodayVsGoal from "../components/dashboard/TodayVsGoal";

/* constants */
const DAYS = 14;
const DEFAULT_CAL_GOAL = 2200;

export default function Dashboard() {
  const { user } = useAuth();
  useChartTheme(); // ensures theme subscription once

  /* workouts state */
  const [workouts, setWorkouts] = useState([]);
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preset, setPreset] = useState("all");

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    date: "",
    exercise: "",
    sets: "",
    reps: "",
    weight: "",
    notes: "",
  });

  const [workoutPresets, setWorkoutPresets] = useState([]);
  const [newWOPresetName, setNewWOPresetName] = useState("");

  const [profile, setProfile] = useState(null);
  const unit = profile?.weightUnit === "lb" ? "lb" : "kg";

  /* nutrition chart state */
  const [rangeData, setRangeData] = useState([]);
  const [exerciseData, setExerciseData] = useState([]);

  /* preset date filters */
  useEffect(() => {
    const today = endOfToday(new Date());
    if (preset === "all") {
      setFrom("");
      setTo("");
      return;
    }
    if (preset === "week") {
      const s = startOfWeek(today);
      setFrom(fmt(s));
      setTo(fmt(today));
      return;
    }
    if (preset === "7") {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      setFrom(fmt(s));
      setTo(fmt(today));
      return;
    }
    if (preset === "month") {
      const s = startOfMonth(today);
      setFrom(fmt(s));
      setTo(fmt(today));
      return;
    }
    if (preset === "30") {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      setFrom(fmt(s));
      setTo(fmt(today));
      return;
    }
  }, [preset]);

  useEffect(() => {
    if (from && to && from > to) setTo("");
  }, [from, to]);

  /* subscribe workouts/profile/presets */
  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsubs = [];
    unsubs.push(subscribeWorkouts(user.uid, setWorkouts, { from, to }));
    (async () => {
      await ensureProfile(user.uid);
      if (!active) return;
      unsubs.push(subscribeProfile(user.uid, setProfile));
      unsubs.push(subscribeWorkoutPresets(user.uid, setWorkoutPresets));
    })().catch(console.error);
    return () => {
      active = false;
      for (const u of unsubs) {
        try {
          typeof u === "function" && u();
        } catch {}
      }
    };
  }, [user, from, to]);

  /* build last N days and fetch ranges */
  const days = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(dayKey(d));
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const startISO = days[0];
      const endISO = days[days.length - 1];
      const [foodsRange, exRange] = await Promise.all([
        getFoodsRange(user.uid, startISO, endISO),
        getExerciseRange(user.uid, startISO, endISO),
      ]);
      setRangeData(aggregateFoods(days, foodsRange));
      setExerciseData(aggregateExercise(days, exRange));
    })();
  }, [user, days]);

  /* edit helpers */
  const startEdit = (w) => {
    setEditId(w.id);
    setEditData({
      date: w.date || "",
      exercise: w.exercise || "",
      sets: w.sets ?? "",
      reps: w.reps ?? "",
      weight:
        unit === "lb"
          ? Math.round(kgToLb(w.weight) * 100) / 100
          : w.weight ?? "",
      notes: w.notes || "",
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const weightKg =
      unit === "lb"
        ? lbToKg(Number(editData.weight || 0))
        : Number(editData.weight || 0);
    await updateWorkout(user.uid, editId, {
      ...editData,
      sets: Number(editData.sets || 0),
      reps: Number(editData.reps || 0),
      weight: weightKg,
    });
    setEditId(null);
  };

  /* computed */
  const groupedRecent = useMemo(() => {
    if (!workouts?.length) return [];
    const byDate = workouts.reduce((acc, w) => {
      (acc[w.date] ||= []).push(w);
      return acc;
    }, {});
    const daysDesc = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    const top5 = daysDesc.slice(0, 5);
    return top5.map((d) => ({
      date: d,
      items: byDate[d]
        .slice()
        .sort((a, b) => (a.exercise || "").localeCompare(b.exercise || "")),
    }));
  }, [workouts]);

  const todayISO = useMemo(() => dayKey(new Date()), []);
  const todayFoods = useMemo(
    () =>
      rangeData.find((r) => r.dateISO === todayISO) || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    [rangeData, todayISO]
  );
  const todayExercise = useMemo(
    () => exerciseData.find((r) => r.dateISO === todayISO)?.calories || 0,
    [exerciseData, todayISO]
  );

  const calGoal = Number(profile?.calorieGoal || DEFAULT_CAL_GOAL);
  const lineSeries = useMemo(
    () =>
      days.map((d) => {
        const f = rangeData.find((x) => x.dateISO === d) || {};
        const e = exerciseData.find((x) => x.dateISO === d) || {};
        return {
          label: labelDay(d),
          calories: Math.round(f.calories || 0),
          exercise: Math.round(e.calories || 0),
          goal: calGoal,
        };
      }),
    [days, rangeData, exerciseData, calGoal]
  );
  const macroData = useMemo(
    () => [
      {
        name: "Protein",
        value: Math.max(0, Math.round(todayFoods.protein || 0)),
      },
      { name: "Carbs", value: Math.max(0, Math.round(todayFoods.carbs || 0)) },
      { name: "Fat", value: Math.max(0, Math.round(todayFoods.fat || 0)) },
    ],
    [todayFoods]
  );
  const barSeries = useMemo(
    () =>
      days.map((d) => {
        const e = exerciseData.find((x) => x.dateISO === d) || {};
        return { label: labelDay(d), kcal: Math.round(e.calories || 0) };
      }),
    [days, exerciseData]
  );

  /* render */
  return (
    <div className="space-y-6">
      <DashboardToolbar
        unit={unit}
        onToggleUnit={() =>
          updateProfile(user.uid, { weightUnit: unit === "kg" ? "lb" : "kg" })
        }
        date={date}
        setDate={setDate}
      />
      <DashboardFilters
        preset={preset}
        setPreset={setPreset}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />
      <WorkoutForm
        user={user}
        unit={unit}
        date={date}
        setDate={setDate}
        exercise={exercise}
        setExercise={setExercise}
        sets={sets}
        setSets={setSets}
        reps={reps}
        setReps={setReps}
        weight={weight}
        setWeight={setWeight}
        notes={notes}
        setNotes={setNotes}
        workoutPresets={workoutPresets}
        newWOPresetName={newWOPresetName}
        setNewWOPresetName={setNewWOPresetName}
      />
      <RecentWorkoutsGrouped
        groupedRecent={groupedRecent}
        unit={unit}
        editId={editId}
        editData={editData}
        startEdit={startEdit}
        setEditId={setEditId}
        setEditData={setEditData}
        saveEdit={saveEdit}
        onDelete={deleteWorkout}
        user={user}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <CaloriesVsGoalCard daysCount={DAYS} data={lineSeries} />
        <MacroDonutCard data={macroData} />
        <ExerciseBarCard daysCount={DAYS} data={barSeries} />
      </div>
      <TodayVsGoal
        calGoal={calGoal}
        profile={profile}
        todayFoods={todayFoods}
        todayExercise={todayExercise}
      />
    </div>
  );
}

/* ---------- helpers ---------- */
function aggregateFoods(dayList, foodsRange) {
  const map = Object.fromEntries(
    dayList.map((d) => [
      d,
      { dateISO: d, calories: 0, protein: 0, carbs: 0, fat: 0 },
    ])
  );
  for (const day of foodsRange || []) {
    const bucket = map[day.date];
    if (!bucket) continue;
    for (const f of day.items || []) {
      bucket.calories += Number(f.calories || 0);
      bucket.protein += Number(f.protein || 0);
      bucket.carbs += Number(f.carbs || 0);
      bucket.fat += Number(f.fat || 0);
    }
  }
  return Object.values(map);
}
function aggregateExercise(dayList, exRange) {
  const map = Object.fromEntries(
    dayList.map((d) => [d, { dateISO: d, calories: 0 }])
  );
  for (const day of exRange || []) {
    const bucket = map[day.date];
    if (!bucket) continue;
    for (const x of day.items || []) bucket.calories += Number(x.calories || 0);
  }
  return Object.values(map);
}
