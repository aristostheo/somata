import { accountStorage, type AccountStore } from '@/services/local/accountStore';
// services/badges/reconcile.ts
import type { BadgeStatsSnapshot } from "./types";
import { evaluateBadges } from "./engine";
import {
  loadUnlocksLocal,
  loadProgressLocal,
  saveUnlocksLocal,
  saveProgressLocal,
} from "./store";

export async function reconcileBadgesFromSnapshot(stats: BadgeStatsSnapshot, localStore: AccountStore = accountStorage()) {
  const unlocks = await loadUnlocksLocal(localStore);
  const progress = await loadProgressLocal(localStore);

  const res = evaluateBadges({
    event: { type: "SNAPSHOT", timestamp: Date.now(), payload: {} },
    stats,
    unlocks,
    progress,
  });

  await saveUnlocksLocal(res.unlocks, localStore);
  await saveProgressLocal(res.progress, localStore);

  return res;
}
