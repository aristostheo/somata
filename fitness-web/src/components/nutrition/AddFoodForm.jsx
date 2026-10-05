import { dayKey } from "../../utils/date";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import { searchUsdaFoods } from "../../services/fooddb";
import { getRecentFoods } from "../../services/nutrition";
import { unscaleFromTotals } from "../../utils/nutritionMath";

/* ---------- helpers ---------- */
const AI_URL = process.env.REACT_APP_AI_PARSE_URL;
const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
const todayStr = () => dayKey(new Date());

function scaleNutrients(base, qty, unit) {
  const u = (unit || "").toLowerCase();
  const isWeight = u === "g" || u === "ml";
  const factor = isWeight ? (Number(qty) || 0) / 100 : Number(qty) || 1;
  const n = (v) => Math.round((Number(v) || 0) * factor);
  return {
    calories: n(base.calories),
    protein: n(base.protein),
    carbs: n(base.carbs),
    fat: n(base.fat),
    sugar: n(base.sugar),
    fiber: n(base.fiber),
  };
}

/**
 * Props:
 * - date
 * - form, setForm  (meal,name,qty,unit,calories,protein,carbs,fat,sugar,fiber)
 * - onAdd(entry)   (expects scaled totals)
 * - onMockSuggest()
 * - onAiApplyToForm({ aiResponse })
 * - userUid? (for loading recents)
 */
export default function AddFoodForm({
  date = todayStr(),
  form,
  setForm,
  onAdd,
  onMockSuggest,
  onAiApplyToForm,
  userUid,
}) {
  /* ---------- local persistence for meal & unit ---------- */
  useEffect(() => {
    // on mount, restore last used
    const last = JSON.parse(localStorage.getItem("nutrition:last") || "{}");
    setForm((f) => ({
      ...f,
      meal: last.meal || f.meal || "breakfast",
      unit: last.unit || f.unit || "serving",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "nutrition:last",
      JSON.stringify({ meal: form.meal, unit: form.unit })
    );
  }, [form.meal, form.unit]);

  /* ---------- USDA search state + keyboard nav ---------- */
  const [usdaResults, setUsdaResults] = useState([]);
  const [usdaErr, setUsdaErr] = useState("");
  const [usdaSearching, setUsdaSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!form.name || form.name.trim().length < 2) {
      setUsdaResults([]);
      setUsdaErr("");
      setShowResults(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setUsdaSearching(true);
        setUsdaErr("");
        const rows = await searchUsdaFoods(form.name.trim(), {
          limit: 8,
          signal: controller.signal,
        });
        setUsdaResults(rows || []);
        setShowResults(true);
        setHighlight(rows?.length ? 0 : -1);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error(e);
          setUsdaErr("Couldn’t reach USDA. Check API key/network.");
          setShowResults(true);
        }
      } finally {
        setUsdaSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [form.name]);

  function pickUsda(item) {
    // USDA is per 100 g/ml; keep base in 100g by default
    setForm((f) => ({
      ...f,
      name: item.name || f.name,
      qty: item.qty || 100,
      unit: item.unit || "g",
      calories: String(Math.round(item.calories || 0)),
      protein: String(Math.round(item.protein || 0)),
      carbs: String(Math.round(item.carbs || 0)),
      fat: String(Math.round(item.fat || 0)),
      sugar: String(Math.round(item.sugar || 0)),
      fiber: String(Math.round(item.fiber || 0)),
    }));
    setShowResults(false);
    setUsdaResults([]);
    setHighlight(-1);
  }

  function onNameKeyDown(e) {
    if (!showResults || usdaResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % usdaResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + usdaResults.length) % usdaResults.length);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && highlight < usdaResults.length) {
        e.preventDefault();
        pickUsda(usdaResults[highlight]);
      }
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  /* ---------- AI (describe meal) ---------- */
  const [aiDesc, setAiDesc] = useState("");
  const [aiQty, setAiQty] = useState("");
  const [aiUnit, setAiUnit] = useState("serving");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function onCalculateFromAI() {
    setAiError("");
    const raw = aiDesc.trim();
    if (!raw) {
      setAiError("Please describe your meal first.");
      return;
    }
    setAiLoading(true);
    try {
      const token = getAuth().currentUser?.getIdToken
        ? await getAuth().currentUser.getIdToken()
        : null;

      const body = {
        text: raw,
        qty: aiQty ? Number(aiQty) : null,
        unit: aiUnit || null,
      };

      const res = await fetch(AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data?.totals) {
        // bubble a toast upstream (optional)
        setAiError(data?.error || "AI parse failed");
        return;
      }
      onAiApplyToForm({ aiResponse: data });
    } catch (e) {
      console.error("AI parse failed:", e);
      setAiError("Couldn’t parse that. Try adding portion details.");
    } finally {
      setAiLoading(false);
    }
  }

  /* ---------- Recent quick-add ---------- */
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!userUid) return;
      try {
        const rows = await getRecentFoods(userUid, 20);
        if (active) setRecent(rows || []);
      } catch (e) {
        console.warn("recent load failed", e);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [userUid]);

  const filteredRecent = useMemo(() => {
    if (!recent?.length) return [];
    // show most frequent or newest first already handled upstream;
    // here just take first 8, optionally filter by name query hint
    const q = (form.name || "").trim().toLowerCase();
    const rows = q
      ? recent.filter((r) => (r.name || "").toLowerCase().includes(q))
      : recent;
    return rows.slice(0, 8);
  }, [recent, form.name]);

  function quickFillFromRecent(item) {
    // recent item stores totals for its qty+unit; convert back to base
    const base = unscaleFromTotals(
      {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        sugar: item.sugar,
        fiber: item.fiber,
      },
      item.qty || 1,
      item.unit || "serving"
    );
    setForm((f) => ({
      ...f,
      name: item.name || f.name,
      qty: item.qty ?? f.qty,
      unit: item.unit || f.unit,
      calories: String(base.calories ?? ""),
      protein: String(base.protein ?? ""),
      carbs: String(base.carbs ?? ""),
      fat: String(base.fat ?? ""),
      sugar: String(base.sugar ?? ""),
      fiber: String(base.fiber ?? ""),
    }));
  }

  /* ---------- live preview & derived ---------- */
  const isWeightUnit =
    (form.unit || "").toLowerCase() === "g" ||
    (form.unit || "").toLowerCase() === "ml";

  const preview = useMemo(
    () =>
      scaleNutrients(
        {
          calories: form.calories,
          protein: form.protein,
          carbs: form.carbs,
          fat: form.fat,
          sugar: form.sugar,
          fiber: form.fiber,
        },
        form.qty,
        form.unit
      ),
    [
      form.calories,
      form.protein,
      form.carbs,
      form.fat,
      form.sugar,
      form.fiber,
      form.qty,
      form.unit,
    ]
  );

  /* ---------- submit ---------- */
  async function handleSubmit(e) {
    e.preventDefault();
    const entry = {
      date,
      meal: form.meal,
      name: (form.name || "").trim(),
      unit: form.unit || "serving",
      qty: Number(form.qty || 1),
      ...preview, // scaled totals
      source: "manual",
      createdAt: Date.now(),
    };
    await onAdd(entry);
    // keep meal & unit; clear the rest
    setForm((f) => ({
      ...f,
      name: "",
      qty: 1,
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      sugar: "",
      fiber: "",
    }));
    setAiDesc("");
    setAiQty("");
  }

  /* ---------- UI ---------- */
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="h2">Add Food</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="button-ghost"
            onClick={onMockSuggest}
          >
            ✨ AI Suggestions (mock)
          </button>
        </div>
      </div>

      {/* Describe your meal (AI) */}
      <div className="mb-4 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Describe your meal (optional)
        </label>
        <textarea
          className="input h-24 !align-top"
          placeholder='e.g., "2 sandwiches on white bread with marble cheese, light mortadella, genoa salami"'
          value={aiDesc}
          onChange={(e) => setAiDesc(e.target.value)}
        />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Qty (optional)"
              value={aiQty}
              onChange={(e) => setAiQty(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="input"
              placeholder="Unit (e.g., sandwich, g, cup)"
              value={aiUnit}
              onChange={(e) => setAiUnit(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="button"
              className="button"
              disabled={aiLoading || !aiDesc.trim()}
              onClick={onCalculateFromAI}
            >
              {aiLoading ? "Analyzing…" : "Calculate macros"}
            </button>
            {aiError && <span className="text-sm text-red-500">{aiError}</span>}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Tip: Add portion details (e.g., “2 sandwiches”, “350 g”, “1.5 cups”)
          for better estimates.
        </p>
      </div>

      {/* Quick add: recent */}
      {userUid && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick add from recent
          </div>
          {filteredRecent.length === 0 ? (
            <p className="subtle">No recent foods.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredRecent.map((r) => (
                <button
                  key={r.id || r.name + r.calories}
                  type="button"
                  onClick={() => quickFillFromRecent(r)}
                  className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 text-sm"
                  title="Fill the form with this item (you can tweak before saving)"
                >
                  {r.name} · {Math.round(r.calories || 0)} kcal
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-6 gap-3"
      >
        <select
          className="select"
          value={form.meal}
          onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value }))}
        >
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <div className="md:col-span-2 relative">
          <input
            ref={nameRef}
            className="input"
            placeholder="Food name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onFocus={() => usdaResults.length && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 120)}
            onKeyDown={onNameKeyDown}
            required
          />
          {showResults &&
            (usdaSearching || usdaErr || usdaResults.length > 0) && (
              <div
                className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-2xl border p-1
              bg-white border-gray-200 dark:bg-[#0f1522] dark:border-white/10"
              >
                {usdaSearching && (
                  <div className="px-3 py-2 text-sm subtle">
                    Searching USDA…
                  </div>
                )}
                {usdaErr && (
                  <div className="px-3 py-2 text-sm text-red-500">
                    {usdaErr}
                  </div>
                )}
                {usdaResults.map((r, idx) => (
                  <button
                    type="button"
                    key={r.id}
                    onMouseDown={(e) => e.preventDefault()} // keep focus
                    onClick={() => pickUsda(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#121a2a] ${
                      idx === highlight ? "bg-gray-100 dark:bg-[#121a2a]" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {r.name}
                    </div>
                    <div className="subtle">
                      {Math.round(r.calories || 0)} kcal • P
                      {Math.round(r.protein || 0)} | C{Math.round(r.carbs || 0)}{" "}
                      | F{Math.round(r.fat || 0)}
                      {r.unit ? ` • ${r.qty || 100}${r.unit}` : ""}
                    </div>
                  </button>
                ))}
                {!usdaSearching && !usdaErr && usdaResults.length === 0 && (
                  <div className="px-3 py-2 text-sm subtle">No matches</div>
                )}
              </div>
            )}
        </div>

        <div className="grid grid-cols-3 gap-3 md:col-span-3">
          <input
            className="input"
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            inputMode="numeric"
          />
          <input
            className="input"
            placeholder="Unit (g, ml, serving)"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
          <div className="flex items-center">
            {isWeightUnit ? (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Enter nutrients <b>per 100{String(form.unit).toLowerCase()}</b>.
                We’ll scale by <code>qty/100</code>.
              </span>
            ) : (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Enter nutrients <b>per 1 {form.unit || "serving"}</b>. We’ll
                scale by <code>qty</code>.
              </span>
            )}
          </div>
        </div>

        {/* Base nutrients (per 1 serving or per 100g/ml) */}
        <input
          className="input"
          placeholder="Calories"
          value={form.calories}
          onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
          inputMode="numeric"
        />
        <input
          className="input"
          placeholder="Protein (g)"
          value={form.protein}
          onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))}
          inputMode="numeric"
        />
        <input
          className="input"
          placeholder="Carbs (g)"
          value={form.carbs}
          onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))}
          inputMode="numeric"
        />
        <input
          className="input"
          placeholder="Fat (g)"
          value={form.fat}
          onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))}
          inputMode="numeric"
        />
        <input
          className="input"
          placeholder="Sugar (g)"
          value={form.sugar}
          onChange={(e) => setForm((f) => ({ ...f, sugar: e.target.value }))}
          inputMode="numeric"
        />
        <input
          className="input"
          placeholder="Fiber (g)"
          value={form.fiber}
          onChange={(e) => setForm((f) => ({ ...f, fiber: e.target.value }))}
          inputMode="numeric"
        />

        {/* Live preview of scaled totals */}
        <div className="md:col-span-5 text-sm text-gray-600 dark:text-gray-400">
          <span className="mr-4">Preview for this entry:</span>
          <span>
            {preview.calories || 0} kcal • P{preview.protein || 0} C
            {preview.carbs || 0} F{preview.fat || 0}
            {preview.sugar ? ` • Sugar ${preview.sugar}g` : ""}{" "}
            {preview.fiber ? ` • Fiber ${preview.fiber}g` : ""}
          </span>
        </div>

        <button className="button md:col-span-1">Add</button>
      </form>
    </div>
  );
}

// // src/components/nutrition/AddFoodForm.jsx
// import { useMemo, useState, useEffect } from "react";
// import { getAuth } from "firebase/auth";
// import { searchUsdaFoods } from "../../services/fooddb";
// import { scaleNutrients, unscaleFromTotals } from "../../utils/nutritionMath";

// const AI_URL = process.env.REACT_APP_AI_PARSE_URL || "/parseMeal";

// const MEALS = ["breakfast", "lunch", "dinner", "snacks"];

// export default function AddFoodForm({
//   date,
//   onAdd, // (entry) => Promise<void>  (should return docRef or nothing)
//   recent,
//   onMockSuggest, // () => void
//   onAiApplyToForm, // (baseFields) => void
//   form, // { meal, name, qty, unit, calories, protein, carbs, fat, sugar, fiber }
//   setForm, // setter
// }) {
//   const { meal, name, qty, unit, calories, protein, carbs, fat, sugar, fiber } =
//     form;

//   // USDA
//   const [showResults, setShowResults] = useState(false);
//   const [usdaSearching, setUsdaSearching] = useState(false);
//   const [usdaResults, setUsdaResults] = useState([]);
//   const [usdaErr, setUsdaErr] = useState("");

//   // AI
//   const [aiDesc, setAiDesc] = useState("");
//   const [aiQty, setAiQty] = useState("");
//   const [aiUnit, setAiUnit] = useState("serving");
//   const [aiLoading, setAiLoading] = useState(false);
//   const [aiError, setAiError] = useState("");
//   const [aiSuggestedName, setAiSuggestedName] = useState("");

//   // Preview
//   const preview = useMemo(
//     () =>
//       scaleNutrients(
//         { calories, protein, carbs, fat, sugar, fiber },
//         qty,
//         unit
//       ),
//     [calories, protein, carbs, fat, sugar, fiber, qty, unit]
//   );

//   // Debounced USDA search
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
//     // per 100 g/ml typical
//     setForm((f) => ({
//       ...f,
//       name: item.name || "",
//       qty: item.qty || 100,
//       unit: item.unit || "g",
//       calories: Math.round(item.calories || 0),
//       protein: Math.round(item.protein || 0),
//       carbs: Math.round(item.carbs || 0),
//       fat: Math.round(item.fat || 0),
//       sugar: Math.round(item.sugar || 0),
//       fiber: Math.round(item.fiber || 0),
//     }));
//     setShowResults(false);
//     setUsdaResults([]);
//   }

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

//       // hand back to parent to open modal (parent decides modal, unscale etc.)
//       onAiApplyToForm({
//         aiResponse: data, // { suggestedName, qty, unit, totals }
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

//   function reset() {
//     setForm({
//       meal: "breakfast",
//       name: "",
//       qty: 1,
//       unit: "serving",
//       calories: "",
//       protein: "",
//       carbs: "",
//       fat: "",
//       sugar: "",
//       fiber: "",
//     });
//   }

//   async function submit(e) {
//     e.preventDefault();
//     const entry = {
//       date,
//       meal,
//       name: (name || "").trim(),
//       unit: unit || "serving",
//       qty: Number(qty || 1),
//       ...preview,
//       source: "manual",
//       createdAt: Date.now(),
//     };
//     await onAdd(entry);
//     reset();
//   }

//   const isWeightUnit =
//     unit?.toLowerCase() === "g" || unit?.toLowerCase() === "ml";

//   return (
//     <div className="card p-6">
//       <div className="flex items-center justify-between mb-4">
//         <h2 className="h2">Add Food</h2>
//         <div className="flex gap-2">
//           <button
//             type="button"
//             className="button-ghost"
//             onClick={onMockSuggest}
//           >
//             ✨ AI Suggestions (mock)
//           </button>
//         </div>
//       </div>

//       {/* AI describe */}
//       <div className="mb-4 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black/20">
//         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
//           Describe your meal (optional)
//         </label>
//         <textarea
//           className="input h-24 !align-top"
//           placeholder='e.g., "2 sandwiches on white bread with marble cheese, light mortadella, genoa salami"'
//           value={aiDesc}
//           onChange={(e) => setAiDesc(e.target.value)}
//         />
//         <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
//           <div className="flex gap-2">
//             <input
//               className="input"
//               placeholder="Qty (optional)"
//               value={aiQty}
//               inputMode="numeric"
//               onChange={(e) => setAiQty(e.target.value)}
//             />
//             <input
//               className="input"
//               placeholder="Unit (e.g., sandwich, g, cup)"
//               value={aiUnit}
//               onChange={(e) => setAiUnit(e.target.value)}
//             />
//           </div>
//           <div className="md:col-span-2 flex items-center gap-2">
//             <button
//               type="button"
//               className="button"
//               disabled={aiLoading || !aiDesc.trim()}
//               onClick={onCalculateFromAI}
//             >
//               {aiLoading ? "Analyzing…" : "Calculate macros"}
//             </button>
//             {aiSuggestedName &&
//               name.trim() &&
//               name.trim() !== aiSuggestedName && (
//                 <button
//                   type="button"
//                   className="button-ghost"
//                   onClick={() =>
//                     setForm((f) => ({ ...f, name: aiSuggestedName }))
//                   }
//                 >
//                   Use AI name: “{aiSuggestedName}”
//                 </button>
//               )}
//             {aiError && <span className="text-sm text-red-500">{aiError}</span>}
//           </div>
//         </div>
//         <p className="mt-2 text-xs text-gray-500">
//           Tip: Add portion details (e.g., “2 sandwiches”, “350 g”, “1.5 cups”)
//           for better estimates.
//         </p>
//       </div>

//       <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
//         <select
//           className="select"
//           value={meal}
//           onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value }))}
//         >
//           {MEALS.map((m) => (
//             <option key={m} value={m}>
//               {m}
//             </option>
//           ))}
//         </select>

//         <div className="md:col-span-2 relative">
//           <input
//             className="input"
//             placeholder="Food name"
//             value={name}
//             onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
//             onFocus={() => usdaResults.length && setShowResults(true)}
//             onBlur={() => setTimeout(() => setShowResults(false), 120)}
//             required
//           />
//           {showResults &&
//             (usdaSearching || usdaErr || usdaResults.length > 0) && (
//               <div
//                 className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-2xl border p-1
//               bg-white border-gray-200 dark:bg-[#0f1522] dark:border-white/10"
//               >
//                 {usdaSearching && (
//                   <div className="px-3 py-2 text-sm subtle">
//                     Searching USDA…
//                   </div>
//                 )}
//                 {usdaErr && (
//                   <div className="px-3 py-2 text-sm text-red-500">
//                     {usdaErr}
//                   </div>
//                 )}
//                 {usdaResults.map((r) => (
//                   <button
//                     type="button"
//                     key={r.id}
//                     onMouseDown={(e) => e.preventDefault()}
//                     onClick={() => onPickUsda(r)}
//                     className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#121a2a]"
//                   >
//                     <div className="font-medium text-gray-900 dark:text-white">
//                       {r.name}
//                     </div>
//                     <div className="subtle">
//                       {Math.round(r.calories || 0)} kcal • P
//                       {Math.round(r.protein || 0)} | C{Math.round(r.carbs || 0)}{" "}
//                       | F{Math.round(r.fat || 0)}
//                       {r.unit ? ` • ${r.qty || 100}${r.unit}` : ""}
//                     </div>
//                   </button>
//                 ))}
//                 {!usdaSearching && !usdaErr && usdaResults.length === 0 && (
//                   <div className="px-3 py-2 text-sm subtle">No matches</div>
//                 )}
//               </div>
//             )}
//         </div>

//         <div className="grid grid-cols-3 gap-3 md:col-span-3">
//           <input
//             className="input"
//             placeholder="Qty"
//             value={qty}
//             inputMode="numeric"
//             onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
//           />
//           <input
//             className="input"
//             placeholder="Unit (g, ml, serving)"
//             value={unit}
//             onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
//           />
//           <div className="flex items-center">
//             {["g", "ml"].includes((unit || "").toLowerCase()) ? (
//               <span className="text-xs text-gray-600 dark:text-gray-400">
//                 Enter nutrients <b>per 100{unit.toLowerCase()}</b>. We’ll scale
//                 by <code>qty/100</code>.
//               </span>
//             ) : (
//               <span className="text-xs text-gray-600 dark:text-gray-400">
//                 Enter nutrients <b>per 1 {unit || "serving"}</b>. We’ll scale by{" "}
//                 <code>qty</code>.
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Base nutrients */}
//         <input
//           className="input"
//           placeholder="Calories"
//           value={calories}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
//         />
//         <input
//           className="input"
//           placeholder="Protein (g)"
//           value={protein}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))}
//         />
//         <input
//           className="input"
//           placeholder="Carbs (g)"
//           value={carbs}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))}
//         />
//         <input
//           className="input"
//           placeholder="Fat (g)"
//           value={fat}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))}
//         />
//         <input
//           className="input"
//           placeholder="Sugar (g)"
//           value={sugar}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, sugar: e.target.value }))}
//         />
//         <input
//           className="input"
//           placeholder="Fiber (g)"
//           value={fiber}
//           inputMode="numeric"
//           onChange={(e) => setForm((f) => ({ ...f, fiber: e.target.value }))}
//         />

//         {/* Preview */}
//         <div className="md:col-span-5 text-sm text-gray-600 dark:text-gray-400">
//           <span className="mr-4">Preview for this entry:</span>
//           <span>
//             {preview.calories || 0} kcal • P{preview.protein || 0} C
//             {preview.carbs || 0} F{preview.fat || 0}
//             {preview.sugar ? ` • Sugar ${preview.sugar}g` : ""}{" "}
//             {preview.fiber ? ` • Fiber ${preview.fiber}g` : ""}
//           </span>
//         </div>

//         <button className="button md:col-span-1">Add</button>
//       </form>
//     </div>
//   );
// }
