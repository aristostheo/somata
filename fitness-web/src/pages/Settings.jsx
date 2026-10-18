import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ensureProfile, subscribeProfile, updateProfile } from "../services/profile";
import { nutritionTargets } from "../services/targetProjection";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [calories, setCalories] = useState(2200);
  const [protein, setProtein] = useState(130);
  const [saved, setSaved] = useState(false);
  const [hasAcceptedPlan, setHasAcceptedPlan] = useState(false);

  useEffect(() => {
    if (!user) return;
    let unsub;
    (async () => {
      await ensureProfile(user.uid);
      unsub = subscribeProfile(user.uid, (p) => {
        if (p) {
          const saved = nutritionTargets({ ...p, activeFitAdaptTargets: undefined });
          setCalories(saved.calories);
          setProtein(saved.protein);
          setHasAcceptedPlan(!!p.activeFitAdaptTargets);
        }
        setLoading(false);
      });
    })();
    return () => { try { unsub && unsub(); } catch {} };
  }, [user]);

  const onSave = async (e) => {
    e.preventDefault();
    await updateProfile(user.uid, {
      dailyCaloriesTarget: Number(calories), calorieGoal: Number(calories),
      dailyProteinTarget: Number(protein), proteinGoal: Number(protein),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {hasAcceptedPlan && <p className="text-sm text-gray-600 dark:text-gray-300">Your accepted FitAdapt plan still sets active targets. These fields update shared saved goals only. Request a FitAdapt review from the mobile Profile and accept its proposal there to change the active plan.</p>}

      <form onSubmit={onSave} className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 max-w-md space-y-4">
        <div>
          <label className="block text-sm mb-1">Saved daily calories goal (kcal)</label>
          <input className="border rounded px-3 py-2 w-full bg-white text-gray-800"
                 value={calories} onChange={e=>setCalories(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className="block text-sm mb-1">Saved daily protein goal (g)</label>
          <input className="border rounded px-3 py-2 w-full bg-white text-gray-800"
                 value={protein} onChange={e=>setProtein(e.target.value)} inputMode="numeric" />
        </div>
        <button className="px-4 py-2 rounded bg-blue-600 text-white">Save</button>
        {saved && <span className="ml-3 text-green-700">Saved ✓</span>}
      </form>
    </div>
  );
}
