import type { Section, WorkoutSummary } from "../../../fitness-web/functions/src/friends/contract";
/** Only explicit shared exercise fields can be saved. Missing measurements are not zero. */
export function sharedTemplateItems(section: Section<WorkoutSummary[]> | undefined) {
  if (section?.status !== "shared") return null;
  const exercises = section.data.flatMap(w => w.exercises);
  if (!exercises.length || exercises.some(e => [e.sets, e.reps, e.weightKg].some(n =>
    typeof n !== "number" || !Number.isFinite(n) || n < 0))) return null;
  return exercises.map(e => ({ exercise: e.exercise, sets: e.sets!, reps: e.reps!, weight: e.weightKg!, notes: "" }));
}
