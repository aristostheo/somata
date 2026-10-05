import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

type Flags = {
  isPro: boolean;
  isAdmin: boolean;
  isTester: boolean;
  loading: boolean;
};

export function useEntitlements(): Flags {
  const [state, setState] = useState<Flags>({
    isPro: false,
    isAdmin: false,
    isTester: false,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const user = auth.currentUser;
        if (!user) {
          mounted &&
            setState({ isPro: false, isAdmin: false, isTester: false, loading: false });
          return;
        }
        const token = await user.getIdTokenResult();
        const claims = token.claims || {};
        const isAdmin = !!claims.admin;
        const isTester = !!claims.tester;
        const isPro = !!claims.pro || isAdmin || isTester;
        mounted && setState({ isPro, isAdmin, isTester, loading: false });
      } catch (e) {
        console.warn("[entitlements] refresh failed", e);
        mounted &&
          setState((prev) => ({
            ...prev,
            loading: false,
          }));
      }
    }

    refresh();
    const unsub = auth.onIdTokenChanged(() => refresh());
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return state;
}
