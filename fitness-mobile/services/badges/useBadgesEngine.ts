import { useAccountStorage } from '@/services/local/accountStore';
// services/badges/useBadgesEngine.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { BadgeEvent, BadgeStatsSnapshot, BadgeUnlockState } from "./types";
import {
  loadUnlocksLocal,
  loadProgressLocal,
  saveUnlocksLocal,
  saveProgressLocal,
} from "./store";
import { evaluateBadges } from "./engine";

type UnlocksMap = Record<string, BadgeUnlockState>;
type ProgressMap = Record<string, any>;

type SyncOptions = {
  /** If true, will NOT populate newlyUnlockedIds (good for retroactive reconciliation). */
  silent?: boolean;
};

export function useBadgesEngine() {
  const localStore = useAccountStorage();
  const [unlocks, setUnlocks] = useState<UnlocksMap>({});
  const [progress, setProgress] = useState<ProgressMap>({});
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Avoid stale closure: keep always-fresh refs
  const unlocksRef = useRef<UnlocksMap>({});
  const progressRef = useRef<ProgressMap>({});
  const readyRef = useRef(false);

  useEffect(() => {
    unlocksRef.current = unlocks;
  }, [unlocks]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await loadUnlocksLocal(localStore);
        const p = await loadProgressLocal(localStore);
        if (!alive) return;

        setUnlocks(u || {});
        setProgress(p || {});
        unlocksRef.current = u || {};
        progressRef.current = p || {};
      } finally {
        if (!alive) return;
        setReady(true);
        readyRef.current = true;
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(
    async (nextUnlocks: UnlocksMap, nextProg: ProgressMap) => {
      try {
        await saveUnlocksLocal(nextUnlocks, localStore);
        await saveProgressLocal(nextProg, localStore);
      } catch {
        // noop
      }
    },
    []
  );

  /**
   * Real-time awarding: call after user logs something.
   * Returns newly unlocked badge IDs.
   */
  const emit = useCallback(
    async (event: BadgeEvent, stats: BadgeStatsSnapshot) => {
      const currentUnlocks = unlocksRef.current || {};
      const currentProgress = progressRef.current || {};

      const res = evaluateBadges({
        event,
        stats,
        unlocks: currentUnlocks,
        progress: currentProgress,
      });

      setUnlocks(res.unlocks);
      setProgress(res.progress);

      // 👇 evaluateBadges returns string[]
      setNewlyUnlockedIds(res.newlyUnlocked || []);

      unlocksRef.current = res.unlocks;
      progressRef.current = res.progress;

      void persist(res.unlocks, res.progress);

      return res.newlyUnlocked || [];
    },
    [persist]
  );

  /**
   * Retroactive reconciliation from a snapshot (quiet by default).
   * Returns newly unlocked badge IDs.
   */
  const syncFromSnapshot = useCallback(
    async (stats: BadgeStatsSnapshot, opts: SyncOptions = {}) => {
      const silent = !!opts.silent;

      const currentUnlocks = unlocksRef.current || {};
      const currentProgress = progressRef.current || {};

      const res = evaluateBadges({
        event: { type: "SNAPSHOT" } as BadgeEvent,
        stats,
        unlocks: currentUnlocks,
        progress: currentProgress,
      });

      setUnlocks(res.unlocks);
      setProgress(res.progress);

      unlocksRef.current = res.unlocks;
      progressRef.current = res.progress;

      if (!silent) setNewlyUnlockedIds(res.newlyUnlocked || []);

      void persist(res.unlocks, res.progress);

      return res.newlyUnlocked || [];
    },
    [persist]
  );

  const clearNewlyUnlocked = useCallback(() => setNewlyUnlockedIds([]), []);

  const refreshFromStorage = useCallback(async () => {
    const u = await loadUnlocksLocal(localStore);
    const p = await loadProgressLocal(localStore);
    setUnlocks(u || {});
    setProgress(p || {});
    unlocksRef.current = u || {};
    progressRef.current = p || {};
  }, []);

  return {
    ready,
    unlocks,
    progress,
    newlyUnlockedIds,
    emit,
    syncFromSnapshot,
    clearNewlyUnlocked,
    refreshFromStorage,
  };
}
