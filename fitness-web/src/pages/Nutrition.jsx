import { dayKey } from "../utils/date";
// src/pages/Nutrition.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  addFood,
  updateFood,
  deleteFood,
  addExercise,
  deleteExercise,
} from "../services/nutrition";

import SummaryCard from "../components/nutrition/SummaryCard";
import MealSection from "../components/nutrition/MealSection";
import ReviewAIModal from "../components/nutrition/ReviewAIModal";
import ReviewCandidates from "../components/nutrition/ReviewCandidates";
import AddFoodForm from "../components/nutrition/AddFoodForm";

import { getMockCandidates } from "../services/aiMock";
import { useNutritionStreams } from "../hooks/useNutritionStreams";
import { unscaleFromTotals } from "../utils/nutritionMath";

const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
const todayStr = () => dayKey(new Date());

export default function Nutrition() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());

  // live data (comes from your hook)
  const { foods, setFoods, exercise, setExercise, mealsMap, totals } =
    useNutritionStreams(user, date);

  /* ---------------- Add Form (page-level state) ---------------- */
  const [form, setForm] = useState({
    meal: "breakfast",
    name: "",
    qty: 1,
    unit: "serving",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sugar: "",
    fiber: "",
  });

  /* ---------------- Edit state ---------------- */
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    qty: 1,
    unit: "serving",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sugar: "",
    fiber: "",
  });

  // keep editId valid if item disappears
  useEffect(() => {
    if (editId && !foods.some((f) => f.id === editId)) setEditId(null);
  }, [foods, editId]);

  /* ---------------- Mock AI multi-add ---------------- */
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiCandidates, setAiCandidates] = useState([]);

  async function onMockSuggest() {
    try {
      const candidates = await getMockCandidates({
        meal: form.meal,
        hint: form.name,
      });
      setAiCandidates(candidates);
      setReviewOpen(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function onConfirmFromAI(picks) {
    if (!user || !picks?.length) {
      setReviewOpen(false);
      return;
    }
    const docs = picks.map((p) => ({
      ...p,
      meal: form.meal,
      date,
      source: "mock-ai",
      createdAt: Date.now(),
    }));
    const temps = docs.map((d) => ({
      id: "temp-ai-" + Math.random().toString(36).slice(2),
      ...d,
    }));
    setFoods((prev) => [...temps, ...prev]);
    setReviewOpen(false);
    try {
      await Promise.all(docs.map((d) => addFood(user.uid, d)));
      setFoods((prev) => prev.filter((f) => !f.id.startsWith("temp-ai-")));
    } catch {
      setFoods((prev) => prev.filter((f) => !f.id.startsWith("temp-ai-")));
    }
  }

  /* ---------------- AI analyze (single) modal ---------------- */
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // { suggestedName, qty, unit, totals }

  // called by AddFoodForm when server returns AI parse
  function handleAiApplyToForm({ aiResponse }) {
    setAiPreview({
      suggestedName: aiResponse.suggestedName || "",
      qty: aiResponse.qty ?? "",
      unit: aiResponse.unit || "serving",
      totals: aiResponse.totals || {},
    });
    setAiModalOpen(true);
  }

  /* ---------------- Add food (optimistic) ---------------- */
  async function onAdd(entry) {
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    setFoods((prev) => [{ id: tempId, ...entry }, ...prev]);
    try {
      const docRef = await addFood(user.uid, entry);
      setFoods((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, id: docRef.id } : f))
      );
    } finally {
      // snapshot reconciliation
    }
  }

  /* ---------------- Edit save ---------------- */
  async function onSaveEdit(e) {
    e.preventDefault();
    if (!user || !editId || editId.startsWith("temp-")) {
      setEditId(null);
      return;
    }
    const patch = {
      name: (editData.name || "").trim(),
      qty: Number(editData.qty || 1),
      unit: editData.unit || "serving",
      calories: Number(editData.calories || 0),
      protein: Number(editData.protein || 0),
      carbs: Number(editData.carbs || 0),
      fat: Number(editData.fat || 0),
      sugar: Number(editData.sugar || 0),
      fiber: Number(editData.fiber || 0),
    };
    const prevFoods = foods;
    setFoods((curr) =>
      curr.map((f) => (f.id === editId ? { ...f, ...patch } : f))
    );
    setEditId(null);
    try {
      await updateFood(user.uid, editId, patch);
    } catch (err) {
      console.error(err);
      setFoods(prevFoods);
    }
  }

  async function onDeleteFood(id) {
    if (id?.startsWith?.("temp-")) {
      setFoods((curr) => curr.filter((f) => f.id !== id));
      return;
    }
    const prevFoods = foods;
    setFoods((curr) => curr.filter((f) => f.id !== id));
    try {
      await deleteFood(user.uid, id);
    } catch (err) {
      console.error(err);
      setFoods(prevFoods);
    }
  }

  /* ---------------- Exercise ---------------- */
  const [exName, setExName] = useState("");
  const [exCalories, setExCalories] = useState("");

  async function addExerciseSubmit(e) {
    e.preventDefault();
    if (!user) return;
    const entry = {
      date,
      name: (exName || "").trim(),
      calories: Number(exCalories || 0),
      createdAt: Date.now(),
    };
    const tempId = "temp-x-" + Date.now();
    setExercise((prev) => [{ id: tempId, ...entry }, ...prev]);
    try {
      await addExercise(user.uid, entry);
      setExercise((prev) => prev.filter((x) => x.id !== tempId));
    } catch (err) {
      console.error(err);
      setExercise((prev) => prev.filter((x) => x.id !== tempId));
    }
    setExName("");
    setExCalories("");
  }

  async function deleteExerciseItem(id) {
    try {
      await deleteExercise(user.uid, id);
    } catch (e) {
      console.warn(e);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="h1">Nutrition</h1>
        <input
          className="input w-44"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Day summary */}
      <div className="card p-6 grid grid-cols-2 md:grid-cols-6 gap-3 bg-white text-gray-900 dark:bg-[#111827] dark:text-white">
        <SummaryCard label="Calories" value={totals.calories} />
        <SummaryCard label="Protein (g)" value={totals.protein} />
        <SummaryCard label="Carbs (g)" value={totals.carbs} />
        <SummaryCard label="Fat (g)" value={totals.fat} />
        <SummaryCard label="Exercise (-kcal)" value={totals.exercise} />
        <SummaryCard label="Net (kcal)" value={totals.net} />
      </div>

      {/* Add food (USDA keyboard nav, local persistence, and recent quick-add live inside) */}
      <AddFoodForm
        date={date}
        onAdd={onAdd}
        onMockSuggest={onMockSuggest}
        onAiApplyToForm={handleAiApplyToForm}
        form={form}
        setForm={setForm}
        userUid={user?.uid}
      />

      {/* Meals */}
      {MEALS.map((m) => (
        <MealSection
          key={m}
          title={m}
          items={mealsMap[m] || []}
          onEdit={(item) => {
            setEditId(item.id);
            setEditData({
              name: item.name || "",
              qty: item.qty ?? 1,
              unit: item.unit || "serving",
              calories: item.calories ?? "",
              protein: item.protein ?? "",
              carbs: item.carbs ?? "",
              fat: item.fat ?? "",
              sugar: item.sugar ?? "",
              fiber: item.fiber ?? "",
            });
          }}
          onDelete={onDeleteFood}
          editingId={editId}
          editData={editData}
          setEditData={setEditData}
          onSaveEdit={onSaveEdit}
          onCancel={() => setEditId(null)}
        />
      ))}

      {/* Exercise */}
      <div className="card p-6">
        <h2 className="h2 mb-4">Exercise (calories burned)</h2>
        <form
          onSubmit={addExerciseSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
        >
          <input
            className="input md:col-span-2"
            placeholder="Exercise name (e.g., Running)"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Calories burned"
            value={exCalories}
            inputMode="numeric"
            onChange={(e) => setExCalories(e.target.value)}
          />
          <button className="button">Add</button>
        </form>
        {exercise.length === 0 ? (
          <p className="subtle">No exercise logged.</p>
        ) : (
          <ul className="space-y-2">
            {exercise.map((x) => (
              <li
                key={x.id}
                className="flex items-center justify-between border border-white/10 rounded-xl px-3 py-2"
              >
                <span className="text-gray-900 dark:text-white">
                  {x.name} — {Math.round(x.calories || 0)} kcal
                </span>
                <button
                  onClick={() => deleteExerciseItem(x.id)}
                  className="button-ghost delete"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI review (single suggestion) */}
      <ReviewAIModal
        open={aiModalOpen}
        data={aiPreview}
        onClose={() => setAiModalOpen(false)}
        onApply={(chosen) => {
          if (!chosen) return;
          const cQty = Number(chosen.qty) || 1;
          const cUnit = chosen.unit || "serving";
          const base = unscaleFromTotals(chosen.totals || {}, cQty, cUnit);
          setForm((f) => ({
            ...f,
            name: (chosen.suggestedName || "").trim(),
            qty: cQty,
            unit: cUnit,
            calories: String(base.calories ?? ""),
            protein: String(base.protein ?? ""),
            carbs: String(base.carbs ?? ""),
            fat: String(base.fat ?? ""),
            sugar: String(base.sugar ?? ""),
            fiber: String(base.fiber ?? ""),
          }));
          setAiModalOpen(false);
        }}
      />

      {/* Mock AI multi-add */}
      <ReviewCandidates
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        candidates={aiCandidates}
        onConfirm={onConfirmFromAI}
      />
    </div>
  );
}

// // src/pages/Nutrition.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { getAuth } from "firebase/auth";
// import {
//   addFood,
//   subscribeFoodsByDate,
//   deleteFood,
//   updateFood,
//   getRecentFoods,
//   addExercise,
//   subscribeExerciseByDate,
//   deleteExercise,
// } from "../services/nutrition";
// import { searchUsdaFoods } from "../services/fooddb";
// import { getMockCandidates } from "../services/aiMock";
// import { ensureProfile, subscribeProfile } from "../services/profile";

// const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
// const todayStr = () => new Date().toISOString().slice(0, 10);

// // ---------- Scaling helpers ----------

// /** Scale a nutrient set by qty+unit.
//  * - For "g"/"ml": assume base values are per 100g/ml; scale by qty/100
//  * - Otherwise (e.g. "serving"): scale by qty
//  */
// function scaleNutrients(base, qty, unit) {
//   const isWeight = unit?.toLowerCase() === "g" || unit?.toLowerCase() === "ml";
//   const factor = isWeight ? (Number(qty) || 0) / 100 : Number(qty) || 1;
//   const n = (v) => Math.round((Number(v) || 0) * factor);
//   return {
//     calories: n(base.calories),
//     protein: n(base.protein),
//     carbs: n(base.carbs),
//     fat: n(base.fat),
//     sugar: n(base.sugar),
//     fiber: n(base.fiber),
//   };
// }

// /** Inverse of scaleNutrients:
//  * Given totals for the whole portion and the portion (qty, unit),
//  * compute the "base" nutrients to show in the inputs:
//  *  - per 1 serving (if unit not g/ml)
//  *  - per 100 g/ml (if unit is g/ml)
//  */
// function unscaleFromTotals(totals, qty, unit) {
//   const isWeight = unit?.toLowerCase() === "g" || unit?.toLowerCase() === "ml";
//   const q = Number(qty) || 1;
//   const factor = isWeight ? q / 100 : q; // totals = base * factor
//   const d = (v) => (factor ? Math.round((Number(v) || 0) / factor) : 0);
//   return {
//     calories: d(totals.calories),
//     protein: d(totals.protein),
//     carbs: d(totals.carbs),
//     fat: d(totals.fat),
//     sugar: d(totals.sugar),
//     fiber: d(totals.fiber),
//   };
// }

// export default function Nutrition() {
//   const { user } = useAuth();
//   const [date, setDate] = useState(todayStr());

//   // profile (for goals/remaining)
//   const [profile, setProfile] = useState(null);

//   // data
//   const [foods, setFoods] = useState([]);
//   const [exercise, setExercise] = useState([]);
//   const [recent, setRecent] = useState([]);

//   // add form
//   const [meal, setMeal] = useState("breakfast");
//   const [name, setName] = useState("");
//   const [qty, setQty] = useState(1);
//   const [unit, setUnit] = useState("serving"); // "serving", "g", "ml", etc.
//   const [calories, setCalories] = useState("");
//   const [protein, setProtein] = useState("");
//   const [carbs, setCarbs] = useState("");
//   const [fat, setFat] = useState("");
//   const [sugar, setSugar] = useState("");
//   const [fiber, setFiber] = useState("");

//   // USDA search
//   const [showResults, setShowResults] = useState(false);
//   const [usdaSearching, setUsdaSearching] = useState(false);
//   const [usdaResults, setUsdaResults] = useState([]);
//   const [usdaErr, setUsdaErr] = useState("");

//   // edit
//   const [editId, setEditId] = useState(null);
//   const [editData, setEditData] = useState({
//     name: "",
//     qty: 1,
//     unit: "serving",
//     calories: "",
//     protein: "",
//     carbs: "",
//     fat: "",
//     sugar: "",
//     fiber: "",
//   });

//   // AI text → macros form
//   const [aiDesc, setAiDesc] = useState("");
//   const [aiQty, setAiQty] = useState(""); // optional portion for AI
//   const [aiUnit, setAiUnit] = useState("serving");
//   const [aiLoading, setAiLoading] = useState(false);
//   const [aiError, setAiError] = useState("");
//   const [aiSuggestedName, setAiSuggestedName] = useState("");

//   // --- AI review modal state ---
//   const [aiPreview, setAiPreview] = useState(null); // { suggestedName, qty, unit, totals }
//   const [aiModalOpen, setAiModalOpen] = useState(false);

//   // exercise form
//   const [exName, setExName] = useState("");
//   const [exCalories, setExCalories] = useState("");

//   // mock ai
//   const [reviewOpen, setReviewOpen] = useState(false);
//   const [aiCandidates, setAiCandidates] = useState([]);

//   // subscribe foods/exercise + recent + profile
//   useEffect(() => {
//     if (!user) return;
//     const unsubs = [];
//     unsubs.push(subscribeFoodsByDate(user.uid, date, setFoods));
//     unsubs.push(subscribeExerciseByDate(user.uid, date, setExercise));
//     getRecentFoods(user.uid, 40).then(setRecent);
//     (async () => {
//       await ensureProfile(user.uid, { email: user.email });
//       const unsub = subscribeProfile(user.uid, setProfile);
//       unsubs.push(unsub);
//     })();
//     return () => {
//       for (const u of unsubs) {
//         try {
//           typeof u === "function" && u();
//         } catch {}
//       }
//     };
//   }, [user, date]);

//   // USDA debounced search
//   useEffect(() => {
//     if (!name || name.trim().length < 2) {
//       setUsdaResults([]);
//       setUsdaErr("");
//       setShowResults(false);
//       return;
//     }
//     const controller = new AbortController();
//     const t = setTimeout(async () => {
//       try {
//         setUsdaSearching(true);
//         setUsdaErr("");
//         const rows = await searchUsdaFoods(name.trim(), {
//           limit: 8,
//           signal: controller.signal,
//         });
//         setUsdaResults(rows);
//         setShowResults(true);
//       } catch (e) {
//         if (e.name !== "AbortError") {
//           console.error(e);
//           setUsdaErr("Couldn’t reach USDA. Check API key/network.");
//         }
//       } finally {
//         setUsdaSearching(false);
//       }
//     }, 300);
//     return () => {
//       controller.abort();
//       clearTimeout(t);
//     };
//   }, [name]);

//   function onPickUsda(item) {
//     // USDA items are typically per 100 g/ml; keep that convention here.
//     setName(item.name || "");
//     setQty(item.qty || 100); // 100 baseline for g/ml
//     setUnit(item.unit || "g");
//     setCalories(Math.round(item.calories || 0));
//     setProtein(Math.round(item.protein || 0));
//     setCarbs(Math.round(item.carbs || 0));
//     setFat(Math.round(item.fat || 0));
//     setSugar(Math.round(item.sugar || 0));
//     setFiber(Math.round(item.fiber || 0));
//     setShowResults(false);
//     setUsdaResults([]);
//   }

//   // open the review modal with the raw AI result
//   function openAiModal(payload) {
//     setAiPreview(payload); // { suggestedName, qty, unit, totals }
//     setAiModalOpen(true);
//   }

//   const resetFoodForm = () => {
//     setMeal("breakfast");
//     setName("");
//     setQty(1);
//     setUnit("serving");
//     setCalories("");
//     setProtein("");
//     setCarbs("");
//     setFat("");
//     setSugar("");
//     setFiber("");
//   };

//   // Live preview for the add form (so user sees scaled numbers before saving)
//   const preview = useMemo(
//     () =>
//       scaleNutrients(
//         { calories, protein, carbs, fat, sugar, fiber },
//         qty,
//         unit
//       ),
//     [calories, protein, carbs, fat, sugar, fiber, qty, unit]
//   );

//   // optimistic add with temp id & scaling by qty/unit
//   const addFoodSubmit = async (e) => {
//     e.preventDefault();
//     if (!user) return;

//     const entry = {
//       date,
//       meal,
//       name: name.trim(),
//       unit: unit || "serving",
//       qty: Number(qty || 1),
//       ...preview, // already scaled
//       source: "manual",
//       createdAt: Date.now(),
//     };

//     const tempId = `temp-${Date.now()}`;
//     setFoods((prev) => [{ id: tempId, ...entry }, ...prev]);

//     try {
//       const docRef = await addFood(user.uid, entry);
//       setFoods((prev) =>
//         prev.map((f) => (f.id === tempId ? { ...f, id: docRef.id } : f))
//       );
//     } finally {
//       // snapshot will reconcile
//     }

//     resetFoodForm();
//     getRecentFoods(user.uid, 40).then(setRecent);
//   };

//   // ---- AI analyze -> open modal ----
//   const AI_URL = process.env.REACT_APP_AI_PARSE_URL || "/parseMeal";

//   async function onCalculateFromAI() {
//     setAiError("");
//     const raw = aiDesc.trim();
//     if (!raw) {
//       setAiError("Please describe your meal first.");
//       return;
//     }

//     setAiLoading(true);
//     try {
//       const token = getAuth().currentUser?.getIdToken
//         ? await getAuth().currentUser.getIdToken()
//         : null;

//       const body = {
//         text: raw,
//         qty: aiQty ? Number(aiQty) : null,
//         unit: aiUnit || null,
//       };

//       const res = await fetch(AI_URL, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//         body: JSON.stringify(body),
//       });

//       const data = await res.json();
//       if (!res.ok || !data?.totals)
//         throw new Error(data?.error || "bad_response");

//       setAiSuggestedName(data.suggestedName || "");

//       // Show the review modal with what AI returned
//       openAiModal({
//         suggestedName: data.suggestedName || "",
//         qty: data.qty ?? "",
//         unit: data.unit || "serving",
//         totals: {
//           calories: data.totals.calories ?? 0,
//           protein: data.totals.protein ?? 0,
//           carbs: data.totals.carbs ?? 0,
//           fat: data.totals.fat ?? 0,
//           sugar: data.totals.sugar ?? 0,
//           fiber: data.totals.fiber ?? 0,
//         },
//       });
//     } catch (e) {
//       console.error("AI parse failed:", e);
//       setAiError(
//         "Couldn’t parse that. Try adding portion details or use USDA."
//       );
//     } finally {
//       setAiLoading(false);
//     }
//   }

//   // optimistic edit with scaling
//   const onSaveEdit = async (e) => {
//     e.preventDefault();
//     if (!editId || editId.startsWith("temp-")) {
//       setEditId(null);
//       return;
//     }
//     const scaled = scaleNutrients(
//       {
//         calories: editData.calories,
//         protein: editData.protein,
//         carbs: editData.carbs,
//         fat: editData.fat,
//         sugar: editData.sugar,
//         fiber: editData.fiber,
//       },
//       editData.qty,
//       editData.unit
//     );

//     const patch = {
//       name: (editData.name || "").trim(),
//       qty: Number(editData.qty || 1),
//       unit: editData.unit || "serving",
//       ...scaled,
//     };

//     const prevFoods = foods;
//     setFoods((curr) =>
//       curr.map((f) => (f.id === editId ? { ...f, ...patch } : f))
//     );
//     setEditId(null);
//     try {
//       await updateFood(user.uid, editId, patch);
//     } catch (err) {
//       console.error(err);
//       setFoods(prevFoods);
//     }
//   };

//   // optimistic delete
//   const onDeleteFood = async (id) => {
//     if (id?.startsWith?.("temp-")) {
//       setFoods((curr) => curr.filter((f) => f.id !== id));
//       return;
//     }
//     const prevFoods = foods;
//     setFoods((curr) => curr.filter((f) => f.id !== id));
//     try {
//       await deleteFood(user.uid, id);
//     } catch (err) {
//       console.error(err);
//       setFoods(prevFoods);
//     }
//   };

//   // exercise
//   const addExerciseSubmit = async (e) => {
//     e.preventDefault();
//     if (!user) return;
//     await addExercise(user.uid, {
//       date,
//       name: (exName || "").trim(),
//       calories: Number(exCalories || 0),
//       createdAt: Date.now(),
//     });
//     setExName("");
//     setExCalories("");
//   };

//   const deleteExerciseItem = async (id) => {
//     try {
//       await deleteExercise(user.uid, id);
//     } catch {
//       console.warn(
//         "Implement deleteExercise(uid, id) in services/nutrition if missing."
//       );
//     }
//   };

//   // AI mock suggestions (meal-aware)
//   async function onMockSuggest() {
//     try {
//       const candidates = await getMockCandidates({ meal, hint: name });
//       setAiCandidates(candidates);
//       setReviewOpen(true);
//     } catch (e) {
//       console.error("Mock AI failed", e);
//     }
//   }

//   async function onConfirmFromAI(picks) {
//     if (!user || !picks?.length) {
//       setReviewOpen(false);
//       return;
//     }
//     const docs = picks.map((p) => ({
//       ...p,
//       meal,
//       date,
//       source: "mock-ai",
//       confidence: p.confidence ?? null,
//       createdAt: Date.now(),
//     }));
//     const temps = docs.map((d) => ({
//       id: "temp-ai-" + Math.random().toString(36).slice(2),
//       ...d,
//     }));
//     setFoods((prev) => [...temps, ...prev]);
//     setReviewOpen(false);
//     try {
//       await Promise.all(docs.map((d) => addFood(user.uid, d)));
//       setFoods((prev) => prev.filter((f) => !f.id.startsWith("temp-ai-")));
//     } catch (err) {
//       console.error(err);
//       setFoods((prev) => prev.filter((f) => !f.id.startsWith("temp-ai-")));
//     }
//   }

//   // meals map & totals
//   const mealsMap = useMemo(() => {
//     const m = { breakfast: [], lunch: [], dinner: [], snacks: [] };
//     foods.forEach((f) => (m[f.meal] ||= []).push(f));
//     return m;
//   }, [foods]);

//   const totals = useMemo(() => {
//     const t = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
//     foods.forEach((f) => {
//       t.calories += f.calories || 0;
//       t.protein += f.protein || 0;
//       t.carbs += f.carbs || 0;
//       t.fat += f.fat || 0;
//       t.sugar += f.sugar || 0;
//       t.fiber += f.fiber || 0;
//     });
//     const ex = exercise.reduce((s, e) => s + (e.calories || 0), 0);
//     return { ...t, exercise: ex, net: t.calories - ex };
//   }, [foods, exercise]);

//   // keep editId valid
//   useEffect(() => {
//     if (editId && !foods.some((f) => f.id === editId)) setEditId(null);
//   }, [foods, editId]);

//   const isWeightUnit =
//     unit?.toLowerCase() === "g" || unit?.toLowerCase() === "ml";

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <h1 className="h1">Nutrition</h1>
//         <input
//           className="input w-44"
//           type="date"
//           value={date}
//           onChange={(e) => setDate(e.target.value)}
//         />
//       </div>

//       {/* Day summary */}
//       <div className="card p-6 grid grid-cols-2 md:grid-cols-6 gap-3 bg-white text-gray-900 dark:bg-[#111827] dark:text-white">
//         <SummaryCard label="Calories" value={totals.calories} />
//         <SummaryCard label="Protein (g)" value={totals.protein} />
//         <SummaryCard label="Carbs (g)" value={totals.carbs} />
//         <SummaryCard label="Fat (g)" value={totals.fat} />
//         <SummaryCard label="Exercise (-kcal)" value={totals.exercise} />
//         <SummaryCard label="Net (kcal)" value={totals.net} />
//       </div>

//       {/* Add food */}
//       <div className="card p-6">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="h2">Add Food</h2>
//           <div className="flex gap-2">
//             {/* <button
//               type="button"
//               className="button-ghost"
//               onClick={onMockSuggest}
//             >
//               ✨ AI Suggestions (mock)
//             </button> */}
//           </div>
//         </div>

//         {/* AI: describe your meal */}
//         <div className="mb-4 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20">
//           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
//             Describe your meal (optional)
//           </label>
//           <textarea
//             className="input h-24 !align-top"
//             placeholder='e.g., "2 sandwiches on white bread with marble cheese, light mortadella, genoa salami"'
//             value={aiDesc}
//             onChange={(e) => setAiDesc(e.target.value)}
//           />

//           <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
//             <div className="flex gap-2">
//               <input
//                 className="input"
//                 placeholder="Qty (optional)"
//                 value={aiQty}
//                 onChange={(e) => setAiQty(e.target.value)}
//                 inputMode="numeric"
//               />
//               <input
//                 className="input"
//                 placeholder="Unit (e.g., sandwich, g, cup)"
//                 value={aiUnit}
//                 onChange={(e) => setAiUnit(e.target.value)}
//               />
//             </div>
//             <div className="md:col-span-2 flex items-center gap-2">
//               <button
//                 type="button"
//                 className="button"
//                 disabled={aiLoading || !aiDesc.trim()}
//                 onClick={onCalculateFromAI}
//               >
//                 {aiLoading ? "Analyzing…" : "Calculate macros"}
//               </button>

//               {aiSuggestedName &&
//                 name.trim() &&
//                 name.trim() !== aiSuggestedName && (
//                   <button
//                     type="button"
//                     className="button-ghost"
//                     onClick={() => setName(aiSuggestedName)}
//                     title="Replace the Name field with AI’s suggestion"
//                   >
//                     Use AI name: “{aiSuggestedName}”
//                   </button>
//                 )}

//               {aiError && (
//                 <span className="text-sm text-red-500">{aiError}</span>
//               )}
//             </div>
//           </div>

//           <p className="mt-2 text-xs text-gray-500">
//             Tip: Add portion details (e.g., “2 sandwiches”, “350 g”, “1.5 cups”)
//             for better estimates.
//           </p>
//         </div>

//         <form
//           onSubmit={addFoodSubmit}
//           className="grid grid-cols-1 md:grid-cols-6 gap-3"
//         >
//           <select
//             className="select"
//             value={meal}
//             onChange={(e) => setMeal(e.target.value)}
//           >
//             {MEALS.map((m) => (
//               <option key={m} value={m}>
//                 {m}
//               </option>
//             ))}
//           </select>

//           <div className="md:col-span-2 relative">
//             <input
//               className="input"
//               placeholder="Food name"
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               onFocus={() => usdaResults.length && setShowResults(true)}
//               onBlur={() => setTimeout(() => setShowResults(false), 120)}
//               required
//             />
//             {showResults &&
//               (usdaSearching || usdaErr || usdaResults.length > 0) && (
//                 <div
//                   className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-2xl border p-1
//                 bg-white border-gray-200 dark:bg-[#0f1522] dark:border-white/10"
//                 >
//                   {usdaSearching && (
//                     <div className="px-3 py-2 text-sm subtle">
//                       Searching USDA…
//                     </div>
//                   )}
//                   {usdaErr && (
//                     <div className="px-3 py-2 text-sm text-red-500">
//                       {usdaErr}
//                     </div>
//                   )}
//                   {usdaResults.map((r) => (
//                     <button
//                       type="button"
//                       key={r.id}
//                       onMouseDown={(e) => e.preventDefault()}
//                       onClick={() => onPickUsda(r)}
//                       className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#121a2a]"
//                     >
//                       <div className="font-medium text-gray-900 dark:text-white">
//                         {r.name}
//                       </div>
//                       <div className="subtle">
//                         {Math.round(r.calories || 0)} kcal • P
//                         {Math.round(r.protein || 0)} | C
//                         {Math.round(r.carbs || 0)} | F{Math.round(r.fat || 0)}
//                         {r.unit ? ` • ${r.qty || 100}${r.unit}` : ""}
//                       </div>
//                     </button>
//                   ))}
//                   {!usdaSearching && !usdaErr && usdaResults.length === 0 && (
//                     <div className="px-3 py-2 text-sm subtle">No matches</div>
//                   )}
//                 </div>
//               )}
//           </div>

//           <div className="grid grid-cols-3 gap-3 md:col-span-3">
//             <input
//               className="input"
//               placeholder="Qty"
//               value={qty}
//               onChange={(e) => setQty(e.target.value)}
//               inputMode="numeric"
//             />
//             <input
//               className="input"
//               placeholder="Unit (g, ml, serving)"
//               value={unit}
//               onChange={(e) => setUnit(e.target.value)}
//             />
//             <div className="flex items-center">
//               {isWeightUnit ? (
//                 <span className="text-xs text-gray-600 dark:text-gray-400">
//                   Enter nutrients <b>per 100{unit.toLowerCase()}</b>. We’ll
//                   scale by <code>qty/100</code>.
//                 </span>
//               ) : (
//                 <span className="text-xs text-gray-600 dark:text-gray-400">
//                   Enter nutrients <b>per 1 {unit || "serving"}</b>. We’ll scale
//                   by <code>qty</code>.
//                 </span>
//               )}
//             </div>
//           </div>

//           {/* Base nutrients (per 1 serving or per 100g/ml) */}
//           <input
//             className="input"
//             placeholder="Calories"
//             value={calories}
//             onChange={(e) => setCalories(e.target.value)}
//             inputMode="numeric"
//           />
//           <input
//             className="input"
//             placeholder="Protein (g)"
//             value={protein}
//             onChange={(e) => setProtein(e.target.value)}
//             inputMode="numeric"
//           />
//           <input
//             className="input"
//             placeholder="Carbs (g)"
//             value={carbs}
//             onChange={(e) => setCarbs(e.target.value)}
//             inputMode="numeric"
//           />
//           <input
//             className="input"
//             placeholder="Fat (g)"
//             value={fat}
//             onChange={(e) => setFat(e.target.value)}
//             inputMode="numeric"
//           />
//           <input
//             className="input"
//             placeholder="Sugar (g)"
//             value={sugar}
//             onChange={(e) => setSugar(e.target.value)}
//             inputMode="numeric"
//           />
//           <input
//             className="input"
//             placeholder="Fiber (g)"
//             value={fiber}
//             onChange={(e) => setFiber(e.target.value)}
//             inputMode="numeric"
//           />

//           {/* Live preview of scaled totals */}
//           <div className="md:col-span-5 text-sm text-gray-600 dark:text-gray-400">
//             <span className="mr-4">Preview for this entry:</span>
//             <span>
//               {preview.calories || 0} kcal • P{preview.protein || 0} C
//               {preview.carbs || 0} F{preview.fat || 0}
//               {preview.sugar ? ` • Sugar ${preview.sugar}g` : ""}{" "}
//               {preview.fiber ? ` • Fiber ${preview.fiber}g` : ""}
//             </span>
//           </div>

//           <button className="button md:col-span-1">Add</button>
//         </form>
//       </div>

//       {/* Meals */}
//       {MEALS.map((m) => (
//         <MealSection
//           key={m}
//           title={m}
//           items={mealsMap[m] || []}
//           onEdit={(item) => {
//             setEditId(item.id);
//             setEditData({
//               name: item.name || "",
//               qty: item.qty ?? 1,
//               unit: item.unit || "serving",
//               // IMPORTANT: when editing, the inputs represent the "base"
//               calories: item.calories ?? "",
//               protein: item.protein ?? "",
//               carbs: item.carbs ?? "",
//               fat: item.fat ?? "",
//               sugar: item.sugar ?? "",
//               fiber: item.fiber ?? "",
//             });
//           }}
//           onDelete={onDeleteFood}
//           editingId={editId}
//           editData={editData}
//           setEditData={setEditData}
//           onSaveEdit={onSaveEdit}
//           onCancel={() => setEditId(null)}
//         />
//       ))}

//       {/* Exercise */}
//       <div className="card p-6">
//         <h2 className="h2 mb-4">Exercise (calories burned)</h2>
//         <form
//           onSubmit={addExerciseSubmit}
//           className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
//         >
//           <input
//             className="input md:col-span-2"
//             placeholder="Exercise name (e.g., Running)"
//             value={exName}
//             onChange={(e) => setExName(e.target.value)}
//           />
//           <input
//             className="input"
//             placeholder="Calories burned"
//             value={exCalories}
//             onChange={(e) => setExCalories(e.target.value)}
//             inputMode="numeric"
//           />
//           <button className="button">Add</button>
//         </form>
//         {exercise.length === 0 ? (
//           <p className="subtle">No exercise logged.</p>
//         ) : (
//           <ul className="space-y-2">
//             {exercise.map((x) => (
//               <li
//                 key={x.id}
//                 className="flex items-center justify-between border border-white/10 rounded-xl px-3 py-2"
//               >
//                 <span className="text-gray-900 dark:text-white">
//                   {x.name} — {Math.round(x.calories || 0)} kcal
//                 </span>
//                 <button
//                   onClick={() => deleteExerciseItem(x.id)}
//                   className="button-ghost delete"
//                 >
//                   Delete
//                 </button>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>

//       {/* AI Review modal (NEW: renders & applies) */}
//       <ReviewAIModal
//         open={aiModalOpen}
//         data={aiPreview}
//         onClose={() => setAiModalOpen(false)}
//         onApply={(chosen) => {
//           // chosen: { suggestedName, qty, unit, totals }
//           if (!chosen) return;
//           const cQty = Number(chosen.qty) || 1;
//           const cUnit = chosen.unit || "serving";
//           const base = unscaleFromTotals(chosen.totals || {}, cQty, cUnit);

//           // Fill the form fields
//           setName((chosen.suggestedName || "").trim());
//           setQty(cQty);
//           setUnit(cUnit);
//           setCalories(String(base.calories ?? ""));
//           setProtein(String(base.protein ?? ""));
//           setCarbs(String(base.carbs ?? ""));
//           setFat(String(base.fat ?? ""));
//           setSugar(String(base.sugar ?? ""));
//           setFiber(String(base.fiber ?? ""));

//           setAiModalOpen(false);
//         }}
//       />

//       {/* Mock AI multi-add modal (unchanged) */}
//       <ReviewCandidates
//         open={reviewOpen}
//         onClose={() => setReviewOpen(false)}
//         candidates={aiCandidates}
//         onConfirm={onConfirmFromAI}
//       />
//     </div>
//   );
// }

// /* ---------- Subcomponents ---------- */

// function SummaryCard({ label, value }) {
//   return (
//     <div className="border border-black/10 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-black/20">
//       <p className="text-xs uppercase text-gray-700 dark:text-gray-400">
//         {label}
//       </p>
//       <p className="text-xl font-semibold text-black dark:text-white">
//         {Math.round(Number(value || 0))}
//       </p>
//     </div>
//   );
// }

// function MealSection({
//   title,
//   items,
//   onEdit,
//   onDelete,
//   editingId,
//   editData,
//   setEditData,
//   onSaveEdit,
//   onCancel,
// }) {
//   const mealTotals = React.useMemo(() => {
//     const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
//     items.forEach((i) => {
//       t.calories += i.calories || 0;
//       t.protein += i.protein || 0;
//       t.carbs += i.carbs || 0;
//       t.fat += i.fat || 0;
//     });
//     return t;
//   }, [items]);

//   return (
//     <div className="card p-6">
//       <div className="flex items-center justify-between mb-3">
//         <h3 className="text-lg font-semibold capitalize text-gray-800 dark:text-white">
//           {title}
//         </h3>
//         <div className="text-sm text-gray-500 dark:text-gray-400">
//           {Math.round(mealTotals.calories)} kcal • P{" "}
//           {Math.round(mealTotals.protein)} • C {Math.round(mealTotals.carbs)} •
//           F {Math.round(mealTotals.fat)}
//         </div>
//       </div>

//       {items.length === 0 ? (
//         <p className="text-sm text-gray-500 dark:text-gray-400 italic">
//           Nothing here yet — add your first item above.
//         </p>
//       ) : (
//         <ul className="space-y-2">
//           {items.map((it) => {
//             const isTemp = it.id?.startsWith?.("temp-");
//             return (
//               <li
//                 key={it.id}
//                 className="border border-white/10 rounded-xl px-3 py-2"
//               >
//                 {editingId === it.id ? (
//                   <form
//                     onSubmit={onSaveEdit}
//                     className="grid grid-cols-1 md:grid-cols-6 gap-2"
//                   >
//                     <input
//                       className="input md:col-span-2"
//                       value={editData.name}
//                       onChange={(e) =>
//                         setEditData((v) => ({ ...v, name: e.target.value }))
//                       }
//                     />
//                     <input
//                       className="input"
//                       value={editData.qty}
//                       onChange={(e) =>
//                         setEditData((v) => ({ ...v, qty: e.target.value }))
//                       }
//                       inputMode="numeric"
//                     />
//                     <input
//                       className="input"
//                       value={editData.unit}
//                       onChange={(e) =>
//                         setEditData((v) => ({ ...v, unit: e.target.value }))
//                       }
//                     />
//                     <input
//                       className="input"
//                       placeholder="kcal (base)"
//                       value={editData.calories}
//                       onChange={(e) =>
//                         setEditData((v) => ({ ...v, calories: e.target.value }))
//                       }
//                       inputMode="numeric"
//                     />
//                     <div className="md:col-span-6 grid grid-cols-3 gap-2">
//                       <input
//                         className="input"
//                         placeholder="P (base)"
//                         value={editData.protein}
//                         onChange={(e) =>
//                           setEditData((v) => ({
//                             ...v,
//                             protein: e.target.value,
//                           }))
//                         }
//                         inputMode="numeric"
//                       />
//                       <input
//                         className="input"
//                         placeholder="C (base)"
//                         value={editData.carbs}
//                         onChange={(e) =>
//                           setEditData((v) => ({ ...v, carbs: e.target.value }))
//                         }
//                         inputMode="numeric"
//                       />
//                       <input
//                         className="input"
//                         placeholder="F (base)"
//                         value={editData.fat}
//                         onChange={(e) =>
//                           setEditData((v) => ({ ...v, fat: e.target.value }))
//                         }
//                         inputMode="numeric"
//                       />
//                     </div>
//                     <div className="md:col-span-6 grid grid-cols-2 gap-2">
//                       <input
//                         className="input"
//                         placeholder="Sugar (base)"
//                         value={editData.sugar}
//                         onChange={(e) =>
//                           setEditData((v) => ({ ...v, sugar: e.target.value }))
//                         }
//                         inputMode="numeric"
//                       />
//                       <input
//                         className="input"
//                         placeholder="Fiber (base)"
//                         value={editData.fiber}
//                         onChange={(e) =>
//                           setEditData((v) => ({ ...v, fiber: e.target.value }))
//                         }
//                         inputMode="numeric"
//                       />
//                     </div>
//                     <div className="md:col-span-6 text-xs text-gray-600 dark:text-gray-400">
//                       {editData.unit?.toLowerCase() === "g" ||
//                       editData.unit?.toLowerCase() === "ml"
//                         ? "Enter base nutrients per 100 g/ml. They’ll be scaled by qty/100 when saved."
//                         : "Enter base nutrients per 1 serving. They’ll be scaled by qty when saved."}
//                     </div>
//                     <div className="flex gap-2 md:col-span-6">
//                       <button className="button">Save</button>
//                       <button
//                         type="button"
//                         onClick={onCancel}
//                         className="button-ghost"
//                       >
//                         Cancel
//                       </button>
//                     </div>
//                   </form>
//                 ) : (
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <div className="font-medium text-gray-800 dark:text-white">
//                         {it.name} — {it.qty || 1} {it.unit || "serving"} •{" "}
//                         {Math.round(it.calories || 0)} kcal
//                         {isTemp && (
//                           <span className="ml-2 text-xs text-gray-400">
//                             (saving…)
//                           </span>
//                         )}
//                       </div>
//                       <div className="text-sm text-gray-500 dark:text-gray-400">
//                         P {Math.round(it.protein || 0)} • C{" "}
//                         {Math.round(it.carbs || 0)} • F{" "}
//                         {Math.round(it.fat || 0)}
//                         {it.sugar ? ` • Sugar ${Math.round(it.sugar)}g` : ""}
//                         {it.fiber ? ` • Fiber ${Math.round(it.fiber)}g` : ""}
//                       </div>
//                     </div>
//                     <div className="flex gap-2">
//                       <button
//                         onClick={() => !isTemp && onEdit(it)}
//                         disabled={isTemp}
//                         className="button-ghost"
//                       >
//                         Edit
//                       </button>
//                       <button
//                         onClick={() => onDelete(it.id)}
//                         className="button-ghost delete"
//                       >
//                         Delete
//                       </button>
//                     </div>
//                   </div>
//                 )}
//               </li>
//             );
//           })}
//         </ul>
//       )}
//     </div>
//   );
// }

// function ReviewAIModal({ open, data, onApply, onClose }) {
//   const [local, setLocal] = useState(() => data || null);
//   const [usdaLoading, setUsdaLoading] = useState(false);
//   const [usdaErr, setUsdaErr] = useState("");
//   const [usda, setUsda] = useState([]);

//   useEffect(() => {
//     setLocal(data || null);
//     setUsda([]);
//     setUsdaErr("");
//   }, [data]);

//   if (!open || !local) return null;

//   async function handleCompare() {
//     setUsdaErr("");
//     setUsda([]);
//     setUsdaLoading(true);
//     try {
//       const q =
//         (local.suggestedName && local.suggestedName.split("(")[0]) ||
//         local.suggestedName ||
//         "";
//       const results = await searchUsdaFoods(q || "sandwich", { limit: 6 });
//       setUsda(results);
//     } catch (e) {
//       console.error(e);
//       setUsdaErr("Couldn’t fetch USDA matches");
//     } finally {
//       setUsdaLoading(false);
//     }
//   }

//   return (
//     <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
//       <div className="card w-full max-w-3xl p-5 space-y-4">
//         <div className="flex items-center justify-between">
//           <h3 className="h2">Review AI suggestion</h3>
//           <button className="button-ghost" onClick={onClose}>
//             Close
//           </button>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//           <div className="md:col-span-2">
//             <label className="block text-sm mb-1 subtle">Name</label>
//             <input
//               className="input"
//               value={local.suggestedName}
//               onChange={(e) =>
//                 setLocal((v) => ({ ...v, suggestedName: e.target.value }))
//               }
//             />
//           </div>
//           <div className="flex gap-2">
//             <div className="flex-1">
//               <label className="block text-sm mb-1 subtle">Qty</label>
//               <input
//                 className="input"
//                 value={local.qty}
//                 onChange={(e) =>
//                   setLocal((v) => ({ ...v, qty: e.target.value }))
//                 }
//                 inputMode="numeric"
//               />
//             </div>
//             <div className="flex-1">
//               <label className="block text-sm mb-1 subtle">Unit</label>
//               <input
//                 className="input"
//                 value={local.unit}
//                 onChange={(e) =>
//                   setLocal((v) => ({ ...v, unit: e.target.value }))
//                 }
//               />
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
//           {[
//             ["Calories", "calories"],
//             ["Protein", "protein"],
//             ["Carbs", "carbs"],
//             ["Fat", "fat"],
//             ["Sugar", "sugar"],
//             ["Fiber", "fiber"],
//           ].map(([label, key]) => (
//             <div key={key}>
//               <label className="block text-sm mb-1 subtle">{label}</label>
//               <input
//                 className="input"
//                 value={local.totals[key]}
//                 onChange={(e) =>
//                   setLocal((v) => ({
//                     ...v,
//                     totals: {
//                       ...v.totals,
//                       [key]: Number(e.target.value || 0),
//                     },
//                   }))
//                 }
//                 inputMode="numeric"
//               />
//             </div>
//           ))}
//         </div>

//         <div className="border-t border-white/10 pt-3">
//           <div className="flex items-center justify-between">
//             <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
//               Compare with USDA
//             </h4>
//             <button
//               type="button"
//               onClick={handleCompare}
//               className="button-ghost"
//               disabled={usdaLoading}
//             >
//               {usdaLoading ? "Searching…" : "Compare (USDA)"}
//             </button>
//           </div>

//           {usdaErr && <p className="text-sm text-red-500 mt-2">{usdaErr}</p>}

//           {usda.length > 0 && (
//             <ul className="mt-3 space-y-2 max-h-56 overflow-auto">
//               {usda.map((r) => (
//                 <li
//                   key={r.id}
//                   className="border border-white/10 rounded-xl p-3 flex items-center justify-between"
//                 >
//                   <div>
//                     <div className="font-medium text-gray-900 dark:text-white">
//                       {r.name}
//                     </div>
//                     <div className="subtle">
//                       {Math.round(r.calories || 0)} kcal • P
//                       {Math.round(r.protein || 0)} | C{Math.round(r.carbs || 0)}{" "}
//                       | F{Math.round(r.fat || 0)}
//                       {r.unit ? ` • ${r.qty || 100}${r.unit}` : ""}
//                     </div>
//                   </div>
//                   <button
//                     type="button"
//                     className="button-ghost"
//                     onClick={() =>
//                       setLocal((v) => ({
//                         ...v,
//                         suggestedName: r.name,
//                         qty: r.qty || v.qty,
//                         unit: r.unit || v.unit,
//                         totals: {
//                           calories: Math.round(r.calories || 0),
//                           protein: Math.round(r.protein || 0),
//                           carbs: Math.round(r.carbs || 0),
//                           fat: Math.round(r.fat || 0),
//                           sugar: Math.round(r.sugar || 0),
//                           fiber: Math.round(r.fiber || 0),
//                         },
//                       }))
//                     }
//                   >
//                     Use
//                   </button>
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>

//         <div className="flex justify-end gap-2">
//           <button className="button-ghost" onClick={onClose}>
//             Cancel
//           </button>
//           <button
//             className="button"
//             onClick={() => onApply(local)}
//             title="Apply these values to the Add Food form"
//           >
//             Apply
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ReviewCandidates({ open, onClose, candidates = [], onConfirm }) {
//   const [selected, setSelected] = useState([]);

//   useEffect(() => {
//     setSelected(candidates.map((c) => ({ ...c, selected: true })));
//   }, [candidates]);

//   if (!open) return null;

//   function update(i, patch) {
//     setSelected((prev) =>
//       prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
//     );
//   }

//   return (
//     <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
//       <div className="card p-5 w-full max-w-2xl">
//         <div className="flex items-center justify-between mb-3">
//           <h3 className="h2">Review & confirm</h3>
//           <button className="button-ghost" onClick={onClose}>
//             Close
//           </button>
//         </div>

//         <ul className="space-y-3 max-h-[60vh] overflow-auto">
//           {selected.map((item, idx) => (
//             <li
//               key={idx}
//               className="border border-white/10 rounded-xl p-3 grid grid-cols-12 gap-2 items-center"
//             >
//               <input
//                 type="checkbox"
//                 className="col-span-1"
//                 checked={item.selected}
//                 onChange={(e) => update(idx, { selected: e.target.checked })}
//               />
//               <input
//                 className="input col-span-5"
//                 value={item.name}
//                 onChange={(e) => update(idx, { name: e.target.value })}
//               />
//               <input
//                 className="input col-span-2"
//                 value={item.qty}
//                 onChange={(e) =>
//                   update(idx, { qty: Number(e.target.value) || 0 })
//                 }
//               />
//               <input
//                 className="input col-span-2"
//                 value={item.unit}
//                 onChange={(e) => update(idx, { unit: e.target.value })}
//               />
//               <input
//                 className="input col-span-2"
//                 value={item.calories}
//                 onChange={(e) =>
//                   update(idx, { calories: Number(e.target.value) || 0 })
//                 }
//               />
//             </li>
//           ))}
//         </ul>

//         <div className="mt-4 flex justify-end gap-2">
//           <button className="button-ghost" onClick={onClose}>
//             Cancel
//           </button>
//           <button
//             className="button"
//             onClick={() => onConfirm(selected.filter((s) => s.selected))}
//           >
//             Add selected
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
