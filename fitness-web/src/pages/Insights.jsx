// src/pages/Insights.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getFoodsInRange, getExerciseInRange } from "../services/nutrition";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeDays(n = 7) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(fmt(d));
  }
  return days;
}

export default function Insights() {
  const { user } = useAuth();
  const [days] = useState(() => rangeDays(7));
  const [foods, setFoods] = useState([]);
  const [ex, setEx] = useState([]);
  const from = days[0];
  const to = days[days.length - 1];

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [f, e] = await Promise.all([
        getFoodsInRange(user.uid, from, to),
        getExerciseInRange(user.uid, from, to),
      ]);
      setFoods(f);
      setEx(e);
    })();
  }, [user, from, to]);

  const byDay = useMemo(() => {
    const map = {};
    for (const d of days) map[d] = { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
    foods.forEach((r) => {
      const d = r.date;
      if (!map[d]) map[d] = { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
      map[d].cal += Number(r.calories || 0);
      map[d].p += Number(r.protein || 0);
      map[d].c += Number(r.carbs || 0);
      map[d].f += Number(r.fat || 0);
    });
    ex.forEach((r) => {
      const d = r.date;
      if (!map[d]) map[d] = { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
      map[d].ex += Number(r.calories || 0);
    });
    return map;
  }, [foods, ex, days]);

  const totals = useMemo(() => {
    return days.reduce(
      (t, d) => {
        const v = byDay[d] || { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
        t.cal += v.cal;
        t.p += v.p;
        t.c += v.c;
        t.f += v.f;
        t.ex += v.ex;
        return t;
      },
      { cal: 0, p: 0, c: 0, f: 0, ex: 0 }
    );
  }, [byDay, days]);

  const chartData = useMemo(() => {
    return days.map((d) => {
      const v = byDay[d] || { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
      return {
        date: d.slice(5), // MM-DD
        calories: Math.round(v.cal),
        exercise: Math.round(v.ex),
        net: Math.round(v.cal - v.ex),
        protein: Math.round(v.p),
        carbs: Math.round(v.c),
        fat: Math.round(v.f),
      };
    });
  }, [byDay, days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">Insights</h1>
        <div className="subtle">Last 7 days</div>
      </div>

      {/* Weekly summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total kcal" value={Math.round(totals.cal)} />
        <SummaryCard label="Protein (g)" value={Math.round(totals.p)} />
        <SummaryCard label="Carbs (g)" value={Math.round(totals.c)} />
        <SummaryCard label="Fat (g)" value={Math.round(totals.f)} />
        <SummaryCard label="Exercise (-kcal)" value={Math.round(totals.ex)} />
      </div>
      {/* Net calories (Area) */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Net calories (last 7 days)
        </h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.35} />
                  <stop offset="95%" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" tickMargin={8} />
              <YAxis />
              <Tooltip
                contentStyle={{
                  background: "var(--tw-prose-invert)",
                  border: "none",
                }}
                labelFormatter={(v) => `Date: ${v}`}
              />
              <Area
                type="monotone"
                dataKey="net"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#netFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Macros per day (stacked bars) */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Macros per day
        </h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="date" tickMargin={8} />
              <YAxis />
              <Tooltip
                contentStyle={{
                  background: "var(--tw-prose-invert)",
                  border: "none",
                }}
                labelFormatter={(v) => `Date: ${v}`}
              />
              <Legend />
              <Bar dataKey="protein" stackId="a" />
              <Bar dataKey="carbs" stackId="a" />
              <Bar dataKey="fat" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-day table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <Th>Date</Th>
              <Th>Calories</Th>
              <Th>Protein</Th>
              <Th>Carbs</Th>
              <Th>Fat</Th>
              <Th>Exercise</Th>
              <Th>Net</Th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const v = byDay[d] || { cal: 0, p: 0, c: 0, f: 0, ex: 0 };
              const net = v.cal - v.ex;
              return (
                <tr key={d} className="border-t border-white/10">
                  <Td>{d}</Td>
                  <Td>{Math.round(v.cal)}</Td>
                  <Td>{Math.round(v.p)}</Td>
                  <Td>{Math.round(v.c)}</Td>
                  <Td>{Math.round(v.f)}</Td>
                  <Td>{Math.round(v.ex)}</Td>
                  <Td
                    className={net >= 0 ? "text-emerald-400" : "text-red-400"}
                  >
                    {Math.round(net)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        {value}
      </p>
    </div>
  );
}
function Th({ children }) {
  return (
    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  );
}
