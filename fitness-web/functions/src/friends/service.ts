import { assertAccountActive } from "../account/guard";
import { createHash } from "crypto";
import { Firestore, Transaction, DocumentData, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { FriendSummary, Section, WorkoutSummary } from "./contract";

const DAY = 86400000;
const CAP = 500;
const privateSection = { status: "private" } as const;
const unavailable = { status: "unavailable" } as const;
const shared = <T>(data: T): Section<T> => ({ status: "shared", data });
const number = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e8 ? v : null;
const label = (v: unknown): string => typeof v === "string" ? Array.from(v, c => c.charCodeAt(0) < 32 ? " " : c).join("").trim().slice(0, 120) : "";
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function input(uid: string | undefined, data: unknown, consent = false): { uid: string; friendUid: string; endDate?: string; enabled?: boolean } {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to view shared activity.");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpsError("invalid-argument", "Invalid request.");
  const d = data as Record<string, unknown>;
  const keys = consent ? ["friendUid", "enabled"] : ["friendUid", "endDate"];
  if (Object.keys(d).some(k => !keys.includes(k)) || typeof d.friendUid !== "string" ||
      !d.friendUid.length || d.friendUid.length > 128 || Array.from(d.friendUid).some(c => c === "/" || c.charCodeAt(0) <= 32)) {
    throw new HttpsError("invalid-argument", "Choose a valid friend.");
  }
  if (consent && (typeof d.enabled !== "boolean" || d.friendUid === uid)) throw new HttpsError("invalid-argument", "Invalid sharing choice.");
  return { uid, friendUid: d.friendUid, enabled: d.enabled as boolean, endDate: d.endDate as string };
}
// A grant is tied to both document incarnations and acceptance, not mutable nicknames/pings.
function revision(snaps: FirebaseFirestore.DocumentSnapshot[]): string {
  return createHash("sha256").update(JSON.stringify(snaps.map(s => [s.createTime?.toMillis(),
    s.get("requestedAt") ?? null, s.get("respondedAt") ?? null, s.get("direction") ?? null]))).digest("hex");
}
async function relationship(db: Firestore, tx: Transaction, owner: string, viewer: string) {
  await assertAccountActive(db, owner, tx);
  await assertAccountActive(db, viewer, tx);
  const [a, b, ab, ba] = await tx.getAll(db.doc(`users/${owner}/friends/${viewer}`),
    db.doc(`users/${viewer}/friends/${owner}`), db.doc(`users/${owner}/blocks/${viewer}`), db.doc(`users/${viewer}/blocks/${owner}`));
  if (a.get("status") !== "accepted" || b.get("status") !== "accepted" ||
      a.get("friendUid") !== viewer || b.get("friendUid") !== owner || ab.get("blocked") === true || ba.get("blocked") === true) {
    throw new HttpsError("permission-denied", "This shared activity is unavailable.");
  }
  return revision([a, b]);
}
const grantRef = (db: Firestore, owner: string, viewer: string) => db.doc(`friendSummaryGrants/${owner}/viewers/${viewer}`);
export async function setSharing(db: Firestore, uid: string | undefined, data: unknown) {
  const d = input(uid, data, true);
  await db.runTransaction(async tx => {
    await assertAccountActive(db, d.uid, tx);
    // Revocation always works, including after removal/blocking.
    const rev = d.enabled ? await relationship(db, tx, d.uid, d.friendUid) : null;
    tx.set(grantRef(db, d.uid, d.friendUid), { enabled: d.enabled, revision: rev, updatedAt: FieldValue.serverTimestamp() });
  });
  return { enabled: d.enabled === true };
}
export async function getSummary(db: Firestore, uid: string | undefined, data: unknown, now = Date.now()): Promise<FriendSummary> {
  const d = input(uid, data);
  const endDate = d.endDate ?? day(now);
  const end = typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? Date.parse(`${endDate}T00:00:00Z`) : NaN;
  if (!Number.isFinite(end) || day(end) !== endDate || Math.abs(end - Date.parse(`${day(now)}T00:00:00Z`)) > DAY) {
    throw new HttpsError("invalid-argument", "Use today's calendar date.");
  }
  const dates = Array.from({ length: 10 }, (_, i) => day(end - i * DAY));
  return db.runTransaction(async tx => {
    await assertAccountActive(db, d.uid, tx);
    let allowed = d.uid === d.friendUid, sharingWithFriend = false;
    if (!allowed) {
      const rev = await relationship(db, tx, d.friendUid, d.uid);
      const ownRev = await relationship(db, tx, d.uid, d.friendUid);
      const [incoming, outgoing] = await tx.getAll(grantRef(db, d.friendUid, d.uid), grantRef(db, d.uid, d.friendUid));
      allowed = incoming.get("enabled") === true && incoming.get("revision") === rev;
      sharingWithFriend = outgoing.get("enabled") === true && outgoing.get("revision") === ownRev;
    }
    const profile = (await tx.get(db.doc(`users/${d.friendUid}`))).data();
    const v = profile?.friendVisibility;
    const on = (group: string, key: string) => allowed && v?.enabled === true && v?.[group]?.[key] === true;
    const base: FriendSummary = { version: 1, status: "private", window: { from: dates[9], to: dates[0] }, sharingWithFriend,
      days: [], progress: { nutritionStreak: privateSection, consistencyStreak: privateSection, badgeCount: privateSection,
        weightTrend: privateSection, weeklyVolume: privateSection, personalRecords: privateSection, weeklyReportCard: privateSection, cardio: privateSection } };
    if (!allowed || v?.enabled !== true) return base;
    // Bounded, canonical sources only; no legacy scan or unscoped local fallbacks.
    const records = async (collection: string, needed: boolean): Promise<DocumentData[] | null> => {
      if (!needed) return null;
      const snap = await tx.get(db.collection(`users/${d.friendUid}/${collection}`)
        .where("date", ">=", dates[9]).where("date", "<=", dates[0]).orderBy("date", "desc").limit(CAP + 1));
      return snap.size > CAP ? null : snap.docs.map(s => s.data());
    };
    const n = (k: string) => on("nutrition", k), w = (k: string) => on("workouts", k), p = (k: string) => on("progress", k);
    const meals = await records("nutritionEntries", ["mealsLoggedToday", "dailyCaloriesTotal", "macroBreakdown", "streakStatus"].some(n) || p("consistencyStreak"));
    const workouts = await records("workouts", ["workoutsLogged", "workoutDetails", "weeklyVolume"].some(w) || p("consistencyStreak"));
    const weights = await records("fitadaptWeightEntries", p("weightTrend"));
    const total = (rows: DocumentData[], key: string): number | null => !rows.length || rows.some(r => number(r[key]) === null) ? null : rows.reduce((s, r) => s + r[key], 0);
    const section = <T>(enabled: boolean, source: unknown, value: () => T): Section<T> => !enabled ? privateSection : source === null ? unavailable : shared(value());
    const sessions = (rows: DocumentData[]) => {
      const groups = new Map<string, DocumentData[]>();
      rows.forEach(r => { const key = typeof r.sessionId === "string" && r.sessionId ? r.sessionId : r.date; groups.set(key, [...(groups.get(key) ?? []), r]); });
      return [...groups.values()];
    };
    base.days = dates.map(date => {
      const m = meals?.filter(r => r.date === date) ?? [], rows = workouts?.filter(r => r.date === date) ?? [];
      return { date,
        meals: section(n("mealsLoggedToday"), meals, () => m.map(r => ({ name: label(r.name) || "Meal", calories: number(r.calories) }))),
        calories: section(n("dailyCaloriesTotal"), meals, () => total(m, "calories")),
        macros: section(n("macroBreakdown"), meals, () => ({ protein: total(m, "protein"), carbs: total(m, "carbs"), fat: total(m, "fat") })),
        workoutCount: section(w("workoutsLogged"), workouts, () => sessions(rows).length),
        workouts: section(w("workoutDetails"), workouts, (): WorkoutSummary[] => sessions(rows).map(group => ({ title: label(group[0].sessionTitle) || "Workout",
          exercises: group.map(r => ({ exercise: label(r.exercise) || "Exercise", sets: number(r.sets), reps: number(r.reps), weightKg: number(r.weight) })) }))),
        steps: section(on("activity", "stepCount"), profile, () => number(profile?.steps?.[date])) };
    });
    const streak = (active: Set<string>) => {
      let count = 0; const start = active.has(dates[0]) ? 0 : 1;
      for (let i = start; i < dates.length && active.has(dates[i]); i++) count++;
      return { days: count, capped: count === dates.length - start };
    };
    base.progress.nutritionStreak = section(n("streakStatus"), meals, () => streak(new Set((meals ?? []).map(r => r.date))));
    base.progress.consistencyStreak = section(p("consistencyStreak"), meals && workouts, () => streak(new Set([
      ...(meals ?? []).map(r => r.date), ...(workouts ?? []).map(r => r.date), ...dates.filter(date => (number(profile?.steps?.[date]) ?? 0) > 0) ])));
    if (p("badgeCollection")) {
      const badges = await tx.get(db.collection(`users/${d.friendUid}/badges`).limit(101));
      base.progress.badgeCount = badges.size > 100 ? unavailable : shared(badges.docs.filter(b => typeof b.get("earnedAt") === "number" && Number.isFinite(b.get("earnedAt")) && b.get("earnedAt") > 0).length);
    }
    base.progress.weightTrend = section(p("weightTrend"), weights, () => {
      const daily = new Map<string, number>();
      for (const r of weights ?? []) if (number(r.weightKg) !== null && r.weightKg > 0) {
        // Conflicting same-day measurements cannot establish an unambiguous direction.
        if (daily.has(r.date) && daily.get(r.date) !== r.weightKg) return null;
        daily.set(r.date, r.weightKg);
      }
      const ordered = [...daily].sort(([a], [b]) => a.localeCompare(b));
      if (ordered.length < 2) return null;
      const delta = ordered[ordered.length - 1][1] - ordered[0][1];
      return delta > 0 ? "up" : delta < 0 ? "down" : "steady";
    });
    base.progress.weeklyVolume = section(w("weeklyVolume"), workouts, () => {
      const monday = day(end - ((new Date(end).getUTCDay() + 6) % 7) * DAY);
      const rows = (workouts ?? []).filter(r => r.date >= monday);
      return !rows.length || rows.some(r => [r.weight, r.sets, r.reps].some(x => number(x) === null)) ? null :
        rows.reduce((s, r) => s + r.weight * r.sets * r.reps, 0);
    });
    // No authoritative persisted PR/report contract or account timezone for cardio days.
    base.progress.personalRecords = w("personalRecords") ? unavailable : privateSection;
    base.progress.weeklyReportCard = p("weeklyReportCard") ? unavailable : privateSection;
    base.progress.cardio = on("activity", "cardioSessions") ? unavailable : privateSection;
    base.status = "shared";
    return base;
  }, { readOnly: true });
}
