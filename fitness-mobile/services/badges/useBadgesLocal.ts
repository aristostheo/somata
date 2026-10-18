import { useAccountStorage } from '@/services/local/accountStore';
import { useCallback, useEffect, useState } from "react";
import { loadFeaturedLocal, loadUnlocksLocal } from "@/services/badges/store";
import type { UnlockMap } from "@/services/badges/types";

export function useBadgesLocal(auto = true) {
  const localStore = useAccountStorage();
  const [badgeUnlocks, setBadgeUnlocks] = useState<UnlockMap>({});
  const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);

  const refreshBadgesLocal = useCallback(async () => {
    try {
      const u = await loadUnlocksLocal(localStore);
      const f = await loadFeaturedLocal(localStore);
      setBadgeUnlocks(u || {});
      setFeaturedBadges(f || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    if (auto) refreshBadgesLocal();
  }, [auto, refreshBadgesLocal]);

  return { badgeUnlocks, featuredBadges, refreshBadgesLocal };
}
