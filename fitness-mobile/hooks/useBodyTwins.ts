import { useAccountStorage } from '@/services/local/accountStore';
// hooks/useBodyTwin.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BodyMetrics,
  BodyTwinBaseAvatar,
  BodyTwinConsent,
  BodyTwinState,
  ShapeParams,
} from "@/services/profile/bodyTwin/types";
import {
  loadBodyTwinState,
  saveBodyTwinState,
  clearBodyTwinState,
} from "@/services/profile/bodyTwin/storage";
import { metricsToShape } from "@/services/profile/bodyTwin/shape";
import { smoothShape } from "@/services/profile/bodyTwin/smoothing";
import { computeUnlocks } from "@/services/profile/bodyTwin/achievements";

const DEFAULT_STATE: BodyTwinState = {
  consent: {
    enabled: true,
    allowFutureSelf: true,
    allowAchievements: true,
    hideNumbers: false,
  },
  base: {
    version: 1,
    skinTone: "medium",
    hair: "short",
    outfit: "athleisure",
    outfitColorHex: "#4B8DFF",
    aura: "softGlow",
    presentation: "neutral",
  },
  unlocked: [],
};

export function useBodyTwin(params?: {
  // If you already have metrics in your profile, pass them in.
  currentMetrics?: BodyMetrics;

  // Optional metrics history (for streak-like unlocks)
  metricsHistory?: BodyMetrics[];
}) {
  const localStore = useAccountStorage();
  const [state, setState] = useState<BodyTwinState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  // Baseline captured once (first time we get metrics)
  const baselineRef = useRef<BodyMetrics | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const saved = await loadBodyTwinState(localStore);
      if (saved) setState(saved);
      setLoaded(true);
    })();
  }, []);

  // Keep baseline stable
  useEffect(() => {
    const latest = params?.currentMetrics ?? state.latestMetrics;
    if (!baselineRef.current && latest) {
      baselineRef.current = latest;
    }
  }, [params?.currentMetrics, state.latestMetrics]);

  const computedShape: ShapeParams = useMemo(() => {
    const latest = params?.currentMetrics ?? state.latestMetrics;
    return metricsToShape(latest);
  }, [params?.currentMetrics, state.latestMetrics]);

  // Smooth shape whenever metrics update
  useEffect(() => {
    if (!loaded) return;

    const latest = params?.currentMetrics;
    if (!latest) return;

    setState((prev) => {
      const nextSmoothed = smoothShape(
        prev.smoothedShape,
        metricsToShape(latest)
      );
      const newly = prev.consent.allowAchievements
        ? computeUnlocks({
            unlocked: prev.unlocked,
            baseline: baselineRef.current,
            latest,
            history: params?.metricsHistory,
          })
        : [];

      const mergedUnlocked = newly.length
        ? Array.from(new Set([...prev.unlocked, ...newly]))
        : prev.unlocked;

      const next: BodyTwinState = {
        ...prev,
        latestMetrics: latest,
        smoothedShape: nextSmoothed,
        unlocked: mergedUnlocked,
        lastRewardAt: newly.length ? Date.now() : prev.lastRewardAt,
      };

      saveBodyTwinState(next, localStore);
      return next;
    });
  }, [loaded, params?.currentMetrics, params?.metricsHistory]);

  const setConsent = useCallback((consent: Partial<BodyTwinConsent>) => {
    setState((prev) => {
      const next = { ...prev, consent: { ...prev.consent, ...consent } };
      saveBodyTwinState(next, localStore);
      return next;
    });
  }, []);

  const setBase = useCallback((base: Partial<BodyTwinBaseAvatar>) => {
    setState((prev) => {
      const next = { ...prev, base: { ...prev.base, ...base } };
      saveBodyTwinState(next, localStore);
      return next;
    });
  }, []);

  const setLatestMetrics = useCallback((metrics: BodyMetrics) => {
    setState((prev) => {
      const nextSmoothed = smoothShape(
        prev.smoothedShape,
        metricsToShape(metrics)
      );
      const next: BodyTwinState = {
        ...prev,
        latestMetrics: metrics,
        smoothedShape: nextSmoothed,
      };
      saveBodyTwinState(next, localStore);
      return next;
    });
  }, []);

  const resetAll = useCallback(async () => {
    await clearBodyTwinState(localStore);
    baselineRef.current = undefined;
    setState(DEFAULT_STATE);
  }, []);

  return {
    loaded,
    state,
    computedShape,
    setConsent,
    setBase,
    setLatestMetrics,
    resetAll,
  };
}
