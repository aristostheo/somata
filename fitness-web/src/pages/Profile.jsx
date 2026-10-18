// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  ensureProfile,
  importLegacyProfile,
  loadLegacyProfileImport,
  subscribeProfile,
  updateProfile,
} from "../services/profile";
import { matchingPatchFields, selectedFields } from "../services/legacyProfileImport";
import { computeTargets } from "../utils/macros";

const toKg = (val, unit) =>
  unit === "lb" ? (Number(val) || 0) / 2.2046226218 : Number(val) || 0;
const fromKg = (kg, unit) =>
  unit === "lb" ? (kg || 0) * 2.2046226218 : kg || 0;

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [legacyImport, setLegacyImport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState("");

  // local editable state (mirrors profile, with unit-friendly inputs)
  const [sex, setSex] = useState("male");
  const [age, setAge] = useState(25);
  const [heightCm, setHeightCm] = useState(175);
  const [weightUnit, setWeightUnit] = useState("kg");
  const [weightInput, setWeightInput] = useState(75); // shown in current unit
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("maintain");

  // target mode
  const [targetMode, setTargetMode] = useState("proteinPerKg"); // "proteinPerKg" | "percent"
  const [proteinPerKg, setProteinPerKg] = useState(1.8);

  const [proteinPct, setProteinPct] = useState(0.3);
  const [carbPct, setCarbPct] = useState(0.4);
  const [fatPct, setFatPct] = useState(0.3);
  // Ensure proteinPct + carbPct + fatPct === 1.0 by rescaling the other two
  function setSplit(which, newVal) {
    const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
    const next = clamp01(newVal);

    const current = {
      proteinPct,
      carbPct,
      fatPct,
    };

    // Which two are “others”?
    const others = Object.entries(current)
      .filter(([k]) => k !== which)
      .map(([k, v]) => ({ key: k, val: v }));

    const sumOthers = others[0].val + others[1].val;
    const targetOthers = 1 - next;

    let n1, n2;
    if (sumOthers <= 0) {
      // if others were zero, split evenly
      n1 = targetOthers / 2;
      n2 = targetOthers / 2;
    } else {
      const scale = targetOthers / sumOthers;
      n1 = others[0].val * scale;
      n2 = others[1].val * scale;
    }

    // Write back
    if (which === "proteinPct") {
      setProteinPct(next);
      if (others[0].key === "carbPct") setCarbPct(n1);
      else setFatPct(n1);
      if (others[1].key === "fatPct") setFatPct(n2);
      else setCarbPct(n2);
    } else if (which === "carbPct") {
      setCarbPct(next);
      if (others[0].key === "proteinPct") setProteinPct(n1);
      else setFatPct(n1);
      if (others[1].key === "fatPct") setFatPct(n2);
      else setProteinPct(n2);
    } else {
      // fatPct changed
      setFatPct(next);
      if (others[0].key === "proteinPct") setProteinPct(n1);
      else setCarbPct(n1);
      if (others[1].key === "carbPct") setCarbPct(n2);
      else setProteinPct(n2);
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    let unsub;
    (async () => {
      await ensureProfile(user.uid);
      if (!active) return;
      unsub = subscribeProfile(user.uid, (p) => {
        setProfile(p);
        // hydrate local state
        setSex(p?.sex || "male");
        setAge(p?.age ?? 25);
        setHeightCm(p?.heightCm ?? 175);
        setWeightUnit(p?.weightUnit === "lb" ? "lb" : "kg");
        setWeightInput(
          Math.round(
            fromKg(p?.weightKg ?? 75, p?.weightUnit === "lb" ? "lb" : "kg")
          )
        );
        setActivityLevel(p?.activityLevel || "moderate");
        setGoal(p?.goal || "maintain");
        setTargetMode(p?.targetMode || "proteinPerKg");
        setProteinPerKg(p?.proteinPerKg ?? 1.8);
        setProteinPct(p?.proteinPct ?? 0.3);
        setCarbPct(p?.carbPct ?? 0.4);
        setFatPct(p?.fatPct ?? 0.3);
      });
    })().catch(console.error);
    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadLegacyProfileImport(user.uid).then((candidate) => {
      if (active) setLegacyImport(candidate && Object.keys(candidate).length ? candidate : null);
    }).catch(() => {
      // The shared users/{uid} profile remains usable before legacy read rules are deployed.
      if (active) setLegacyImport(null);
    });
    return () => { active = false; };
  }, [user]);

  const onImport = async () => {
    if (!user || !profile || !legacyImport || importing) return;
    setImporting(true);
    setImportNote("");
    try {
      const changed = await importLegacyProfile(user.uid, legacyImport, selectedFields(profile, legacyImport));
      setLegacyImport(null);
      setImportNote(changed
        ? "Earlier web profile fields were saved to your shared profile."
        : "Those values are already in your shared profile.");
    } catch (error) {
      setImportNote(error?.message || "Import could not be completed. Refresh and try again.");
    } finally {
      setImporting(false);
    }
  };

  const weightKg = useMemo(
    () => toKg(weightInput, weightUnit),
    [weightInput, weightUnit]
  );

  const preview = useMemo(() => {
    if (!weightKg || !heightCm || !age) return null;
    const base = {
      sex,
      weightKg,
      heightCm: Number(heightCm),
      age: Number(age),
      activityLevel,
      goal,
    };
    if (targetMode === "percent") {
      return computeTargets(base, {
        mode: "percent",
        proteinPct: Number(proteinPct),
        carbPct: Number(carbPct),
        fatPct: Number(fatPct),
      });
    }
    return computeTargets(base, {
      mode: "proteinPerKg",
      proteinPerKg: Number(proteinPerKg),
    });
  }, [
    sex,
    weightKg,
    heightCm,
    age,
    activityLevel,
    goal,
    targetMode,
    proteinPerKg,
    proteinPct,
    carbPct,
    fatPct,
  ]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!user || !preview) return;

    const patch = {
      email: user.email,
      sex,
      age: Number(age),
      heightCm: Number(heightCm),
      weightUnit,
      weightKg: Number(weightKg),
      activityLevel,
      goal,
      targetMode,
      proteinPerKg: Number(proteinPerKg),
      proteinPct: Number(proteinPct),
      carbPct: Number(carbPct),
      fatPct: Number(fatPct),
      // computed targets
      calorieGoal: preview.calorieGoal,
      dailyCaloriesTarget: preview.calorieGoal,
      proteinGoal: preview.proteinGoal,
      dailyProteinTarget: preview.proteinGoal,
      carbGoal: preview.carbGoal,
      fatGoal: preview.fatGoal,
      updatedAt: Date.now(),
    };

    await updateProfile(user.uid, patch);
  };

  if (!profile) {
    return (
      <div className="card p-6">
        <h1 className="h1">Profile</h1>
        <p className="subtle">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Profile & Goals</h1>
        <div className="subtle">{user?.email}</div>
      </div>
      {profile.activeFitAdaptTargets && <p className="subtle">An accepted FitAdapt plan sets your current nutrition targets. Changes saved here update your shared saved goals without replacing that plan. To change the active plan, request a FitAdapt review from the mobile Profile and accept its proposal there.</p>}
      {legacyImport && !matchingPatchFields(profile, legacyImport) && (
        <section className="card p-6 space-y-3">
          <h2 className="h2">Earlier web profile</h2>
          <p className="subtle">Compare your current shared values with the earlier web values before importing. The import replaces the listed saved fields; an accepted FitAdapt plan stays active until you accept a new proposal.</p>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(legacyImport).filter(([key]) => key !== "dailyCaloriesTarget" && key !== "dailyProteinTarget").map(([key, value]) => (
              <div key={key}>
                <dt className="subtle">{legacyFieldLabel(key)}</dt>
                <dd>Current: {legacyFieldValue(key, currentProfileValue(profile, key))}</dd>
                <dd>Earlier web: {legacyFieldValue(key, value)}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className="button" disabled={importing} onClick={onImport}>
            {importing ? "Importing…" : "Use earlier web values"}
          </button>
        </section>
      )}
      {importNote && <p role="status" className="subtle">{importNote}</p>}

      <form onSubmit={onSave} className="space-y-6">
        {/* Basics */}
        <div className="card p-6">
          <h2 className="h2 mb-4">Basics</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label className="subtle block mb-1">Sex</label>
              <select
                className="select"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="subtle block mb-1">Age (years)</label>
              <input
                className="input"
                placeholder="Age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div>
              <label className="subtle block mb-1">Height (cm)</label>
              <input
                className="input"
                placeholder="Height (cm)"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>

            <div>
              <label className="subtle block mb-1">
                Weight ({weightUnit.toUpperCase()})
              </label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder={`Weight (${weightUnit})`}
                  inputMode="numeric"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() =>
                    setWeightUnit((u) => (u === "kg" ? "lb" : "kg"))
                  }
                  title="Toggle unit"
                >
                  {weightUnit.toUpperCase()}
                </button>
              </div>
            </div>

            <div>
              <label className="subtle block mb-1">Activity Level</label>
              <select
                className="select"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
                <option value="athlete">Athlete</option>
              </select>
            </div>

            <div>
              <label className="subtle block mb-1">Goal</label>
              <select
                className="select"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="cut">Cut</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk</option>
              </select>
            </div>
          </div>
        </div>

        {/* Targets */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="h2">Targets</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  targetMode === "proteinPerKg"
                    ? "bg-brand-400 text-white"
                    : "border-white/10"
                }`}
                onClick={() => setTargetMode("proteinPerKg")}
              >
                Protein g/kg
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  targetMode === "percent"
                    ? "bg-brand-400 text-white"
                    : "border-white/10"
                }`}
                onClick={() => setTargetMode("percent")}
              >
                % splits
              </button>
            </div>
          </div>

          {targetMode === "proteinPerKg" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="subtle block mb-1">Protein (g/kg)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={proteinPerKg}
                  onChange={(e) => setProteinPerKg(e.target.value)}
                />
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                  Common range: 1.6–2.2 g/kg (higher for cutting/lean mass).
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PctField
                label="Protein %"
                value={proteinPct}
                onChange={(v) => setSplit("proteinPct", v)}
              />
              <PctField
                label="Carbs %"
                value={carbPct}
                onChange={(v) => setSplit("carbPct", v)}
              />
              <PctField
                label="Fat %"
                value={fatPct}
                onChange={(v) => setSplit("fatPct", v)}
              />
              <div className="md:col-span-3 text-xs text-gray-600 dark:text-gray-400">
                Values auto-balance to 100%.
              </div>
            </div>
          )}

          {/* Saved-goal preview; an accepted FitAdapt plan remains active. */}
          {preview && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Calories" value={preview.calorieGoal} />
              <SummaryCard label="Protein (g)" value={preview.proteinGoal} />
              <SummaryCard label="Carbs (g)" value={preview.carbGoal} />
              <SummaryCard label="Fat (g)" value={preview.fatGoal} />
              <SummaryCard label="Weight (kg)" value={Math.round(weightKg)} />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button className="button">Save</button>
        </div>
      </form>
    </div>
  );
}

const legacyLabels = {
  calorieGoal: "Daily calories", proteinGoal: "Protein", carbGoal: "Carbs", fatGoal: "Fat",
  sex: "Equation sex", age: "Age", heightCm: "Height", weightKg: "Weight",
  weightUnit: "Weight display", activityLevel: "Activity", goal: "Goal", targetMode: "Macro method",
  proteinPerKg: "Protein per kg", proteinPct: "Protein share", carbPct: "Carb share", fatPct: "Fat share",
};

function legacyFieldLabel(key) { return legacyLabels[key] || key; }
function currentProfileValue(profile, key) {
  if (key === "calorieGoal") return profile.dailyCaloriesTarget ?? profile.calorieGoal;
  if (key === "proteinGoal") return profile.dailyProteinTarget ?? profile.proteinGoal;
  return profile[key];
}
function legacyFieldValue(key, value) {
  if (value == null) return "Not saved";
  if (key === "calorieGoal") return `${value} kcal`;
  if (["proteinGoal", "carbGoal", "fatGoal"].includes(key)) return `${value} g`;
  if (key === "heightCm") return `${value} cm`;
  if (key === "weightKg") return `${value} kg`;
  if (["proteinPct", "carbPct", "fatPct"].includes(key)) return `${Math.round(value * 100)}%`;
  return String(value).replaceAll("_", " ");
}

function PctField({ label, value, onChange }) {
  const pct = Math.round((Number(value) || 0) * 100);
  return (
    <div>
      <label className="subtle block mb-1">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          className="input"
          type="number"
          min="0"
          max="100"
          step="1"
          value={pct}
          onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-black/20">
      <p className="text-xs uppercase text-gray-700 dark:text-gray-400">
        {label}
      </p>
      <p className="text-xl font-semibold text-gray-900 dark:text-white">
        {Math.round(Number(value || 0))}
      </p>
    </div>
  );
}
