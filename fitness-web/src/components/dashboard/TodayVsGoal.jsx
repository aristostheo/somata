// src/components/dashboard/TodayVsGoal.jsx
import React from "react";
import GoalBar from "./GoalBar";

export default function TodayVsGoal({
  targets,
  todayFoods,
  todayExercise,
}) {
  return (
    <div className="card p-4">
      <h2 className="h2 mb-3">Today vs Goal</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <GoalBar
          label="Calories"
          goal={targets.calories}
          actual={(todayFoods.calories || 0) - (todayExercise || 0)}
          unit="kcal"
        />
        <GoalBar
          label="Protein"
          goal={targets.protein}
          actual={todayFoods.protein}
          unit="g"
        />
        <GoalBar
          label="Carbs"
          goal={targets.carbs}
          actual={todayFoods.carbs}
          unit="g"
        />
        <GoalBar
          label="Fat"
          goal={targets.fat}
          actual={todayFoods.fat}
          unit="g"
        />
      </div>
    </div>
  );
}
