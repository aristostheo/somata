import { useAccountStorage } from '@/services/local/accountStore';
// content/SettingsContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ThemePref = "system" | "light" | "dark";
type WeightUnit = "kg" | "lb";

export type Settings = {
  notificationsEnabled: boolean;
  advancedWorkoutMode: boolean;
  theme: ThemePref;
  haptics: boolean;
  weeklySummary: boolean; // email/push digest idea
  unitOverride?: WeightUnit; // force unit regardless of profile (optional)
};

const DEFAULTS: Settings = {
  notificationsEnabled: false,
  advancedWorkoutMode: false,
  theme: "system",
  haptics: true,
  weeklySummary: false,
  unitOverride: undefined,
};

const STORAGE_KEY = "settings:v1";

type Ctx = {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const localStore = useAccountStorage();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Load once
  useEffect(() => {
    (async () => {
      try {
        const raw = await localStore.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULTS, ...parsed });
        }
      } catch (e) {
        // ignore
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  // Save (debounced) after load
  useEffect(() => {
    if (!loaded.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      localStore.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [settings]);

  const api = useMemo<Ctx>(
    () => ({
      settings,
      set: (key, value) => setSettings((prev) => ({ ...prev, [key]: value })),
      reset: () => setSettings(DEFAULTS),
    }),
    [settings]
  );

  return (
    <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
