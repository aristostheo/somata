import { dayKey } from "../utils/date";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  subscribeFoodsByDate,
  subscribeExerciseByDate,
  subscribeFoodsBetween,
  subscribeExerciseBetween,
} from "../services/nutrition";
import { ensureProfile, subscribeProfile } from "../services/profile";
import { subscribeWorkouts } from "../services/workouts";
import WeeklyCaloriesChart from "../components/WeeklyCaloriesChart";
import ProgressRing from "../components/ProgressRing";
import { Link } from "react-router-dom";

const todayStr = () => dayKey(new Date());
const ymd = dayKey;
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export default function Home() {
  const { user } = useAuth();
  const [date] = useState(todayStr());

  // today totals
  const [foodsToday, setFoodsToday] = useState([]);
  const [exerciseToday, setExerciseToday] = useState([]);

  // profile / goals
  const [profile, setProfile] = useState(null);

  // weekly series
  const [foodsRange, setFoodsRange] = useState([]);
  const [exerciseRange, setExerciseRange] = useState([]);
  const [workoutsRange, setWorkoutsRange] = useState([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsubs = [];
    // today
    unsubs.push(subscribeFoodsByDate(user.uid, date, setFoodsToday));
    unsubs.push(subscribeExerciseByDate(user.uid, date, setExerciseToday));
    // profile (goals)
    (async () => {
      await ensureProfile(user.uid);
      if (!active) return;
      unsubs.push(subscribeProfile(user.uid, setProfile));
    })().catch(console.error);

    // Fetch 30 days for streaks; the chart selects the last 7 days.
    const today = new Date();
    const start = addDays(today, -29);
    const from = ymd(start),
      to = ymd(today);
    unsubs.push(subscribeFoodsBetween(user.uid, from, to, setFoodsRange));
    unsubs.push(subscribeExerciseBetween(user.uid, from, to, setExerciseRange));
    unsubs.push(subscribeWorkouts(user.uid, setWorkoutsRange, { from, to }));

    return () => {
      active = false;
      unsubs.forEach((u) => {
        try {
          typeof u === "function" && u();
        } catch {}
      });
    };
  }, [user, date]);

  // compute today's totals
  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    foodsToday.forEach((f) => {
      t.calories += f.calories || 0;
      t.protein += f.protein || 0;
      t.carbs += f.carbs || 0;
      t.fat += f.fat || 0;
    });
    const burned = exerciseToday.reduce((s, e) => s + (e.calories || 0), 0);
    return { ...t, burned, net: t.calories - burned };
  }, [foodsToday, exerciseToday]);

  // build 7-day series
  const weekly = useMemo(() => {
    const today = new Date();
    const start = addDays(today, -6);
    const days = Array.from({ length: 7 }).map((_, i) =>
      ymd(addDays(start, i))
    );
    const consumedMap = Object.fromEntries(days.map((d) => [d, 0]));
    const burnedMap = Object.fromEntries(days.map((d) => [d, 0]));

    foodsRange.forEach((f) => {
      if (consumedMap[f.date] != null)
        consumedMap[f.date] += Number(f.calories || 0);
    });
    exerciseRange.forEach((x) => {
      if (burnedMap[x.date] != null)
        burnedMap[x.date] += Number(x.calories || 0);
    });

    return days.map((d) => ({
      date: d.slice(5), // MM-DD
      consumed: consumedMap[d] || 0,
      burned: burnedMap[d] || 0,
      net: (consumedMap[d] || 0) - (burnedMap[d] || 0),
    }));
  }, [foodsRange, exerciseRange]);

  // goals
  const kcalGoal = profile?.calorieGoal ?? profile?.dailyCaloriesTarget ?? 2200;
  const proteinGoal = profile?.proteinGoal ?? profile?.dailyProteinTarget ?? 135;

  // streaks (last 30 days)
  const [foodStreak, workoutStreak] = useMemo(() => {
    const daysBack = 30;
    const today = new Date();
    const logs = {};
    foodsRange.forEach((f) => {
      logs[f.date] = true;
    });
    workoutsRange.forEach((x) => {
      logs[`w:${x.date}`] = true;
    });

    // build arrays with last 30 days presence
    const foodPresence = [],
      woPresence = [];
    for (let i = 0; i < daysBack; i++) {
      const d = ymd(addDays(today, -i));
      foodPresence.push(!!logs[d]);
      woPresence.push(!!logs[`w:${d}`]);
    }
    const streak = (arr) => {
      let s = 0;
      for (const v of arr) {
        if (v) s++;
        else break;
      }
      return s;
    };
    return [streak(foodPresence), streak(woPresence)];
  }, [foodsRange, workoutsRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="h1">Home</h1>
        <p className="subtle">Today: {date}</p>
      </header>

      {/* Quick stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Calories"
          value={`${Math.round(totals.calories)} kcal`}
        />
        <StatCard label="Protein" value={`${Math.round(totals.protein)} g`} />
        <StatCard
          label="Exercise"
          value={`-${Math.round(totals.burned)} kcal`}
        />
        <StatCard label="Net" value={`${Math.round(totals.net)} kcal`} accent />
      </section>

      {/* Goals & Streaks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* <div className="card p-6 flex items-center justify-between"> */}
        <ProgressRing
          label="Calorie Goal"
          value={totals.calories}
          target={kcalGoal}
          unit="kcal"
        />
        <ProgressRing
          label="Protein Goal"
          value={totals.protein}
          target={proteinGoal}
          unit="g"
        />
        {/* </div> */}
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 flex items-center justify-between">
          <div>
            <div className="subtle">Meal Logging Streak</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {foodStreak} days
            </div>
            <div className="subtle">
              consecutive days with at least one food logged
            </div>
          </div>
          <div className="badge">Goal: daily</div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <div className="subtle">Workout Streak</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {workoutStreak} days
            </div>
            <div className="subtle">consecutive days with a workout logged</div>
          </div>
          <div className="badge">Goal: 3×/week</div>
        </div>
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4"></section>

      {/* Weekly Progress */}
      <section className="grid grid-cols-1">
        <WeeklyCaloriesChart data={weekly} />
      </section>

      {/* Shortcuts */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard
          title="Log Workout"
          desc="Add sets, reps, weight"
          to="/dashboard"
        />
        <QuickCard
          title="Add Meal"
          desc="Track food & macros"
          to="/nutrition"
        />
        <QuickCard title="Profile" desc="Account & preferences" to="/profile" />
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`card p-5 ${accent ? "ring-1 ring-brand-500/30" : ""}`}>
      <div className="subtle">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function QuickCard({ title, desc, to }) {
  return (
    <Link to={to} className="card p-5 hover:shadow-md transition">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="subtle">{desc}</p>
    </Link>
  );
}
