// components/settings/premium/settingsStore.ts
// Drop-in ✅ tiny persisted settings hooks (AsyncStorage recommended)

import { useAccountStorage } from "@/services/local/accountStore";
import { useEffect, useState } from "react";

export function useSettingBool(
  key: string,
  defaultValue: boolean
): [boolean, (v: boolean) => void, boolean] {
  const localStore = useAccountStorage();
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await localStore.getItem(key).catch(() => null);
      if (!alive) return;
      if (raw === "true") setValue(true);
      else if (raw === "false") setValue(false);
      else setValue(defaultValue);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [key, defaultValue]);

  const set: (v: boolean) => void = (v) => {
    setValue(v);
    void localStore.setItem(key, v ? "true" : "false").catch(() => {});
  };

  return [value, set, loading];
}

export function useSettingString(
  key: string,
  defaultValue: string
): [string, (v: string) => void, boolean] {
  const localStore = useAccountStorage();
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await localStore.getItem(key).catch(() => null);
      if (!alive) return;
      if (typeof raw === "string" && raw.length) setValue(raw);
      else setValue(defaultValue);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [key, defaultValue]);

  const set: (v: string) => void = (v) => {
    setValue(v);
    void localStore.setItem(key, v).catch(() => {});
  };

  return [value, set, loading];
}
