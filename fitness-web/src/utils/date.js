// src/utils/date.js
export const pad = (n) => String(n).padStart(2, "0");
export const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfToday(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export const dayKey = fmt;
export const labelDay = (iso) => iso.slice(5);
