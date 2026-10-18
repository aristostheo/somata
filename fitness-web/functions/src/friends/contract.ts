/** Wire-only DTO. No Firestore documents, account identity or plan fields. */
export type Section<T> = { status: "shared"; data: T } | { status: "private" | "unavailable" };
export type MealSummary = { name: string; calories: number | null };
export type ExerciseSummary = { exercise: string; sets: number | null; reps: number | null; weightKg: number | null };
export type WorkoutSummary = { title: string; exercises: ExerciseSummary[] };
export type FriendSummary = {
  version: 1;
  status: "shared" | "private";
  window: { from: string; to: string };
  // Caller-owned outgoing consent, never the other person's private settings.
  sharingWithFriend: boolean;
  days: Array<{
    date: string;
    meals: Section<MealSummary[]>;
    calories: Section<number | null>;
    macros: Section<{ protein: number | null; carbs: number | null; fat: number | null }>;
    workoutCount: Section<number>;
    workouts: Section<WorkoutSummary[]>;
    steps: Section<number | null>;
  }>;
  progress: {
    nutritionStreak: Section<{ days: number; capped: boolean }>;
    consistencyStreak: Section<{ days: number; capped: boolean }>;
    badgeCount: Section<number>;
    weightTrend: Section<"up" | "down" | "steady" | null>;
    weeklyVolume: Section<number | null>; // kg × repetitions, Monday through window end
    personalRecords: Section<never>;
    weeklyReportCard: Section<never>;
    cardio: Section<never>;
  };
};
