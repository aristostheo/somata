// content/ThemeProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  OCEAN,
  THEME_KEYS,
  persistThemeSnapshot,
  readThemeSnapshot,
  type ThemeSnapshot,
} from "@/services/theme/themeState";

type ThemeMode = "system" | "light" | "dark";
export type GradientPairingStyle = "subtle" | "balanced" | "bold";

export type ThemeColors = {
  // existing (keep)
  background: string;
  text: string;
  card: string;
  border: string;
  muted: string;
  placeholder: string;
  inputBg: string;
  inputBorder: string;
  chipActiveBg: string;
  chipActiveText: string;
  buttonBg: string;
  buttonText: string;
  chartPrimary: string;
  chartSecondary: string;
  primary: string;
  accent: string;
  accentMuted: string;
  accentDim: string;
  accentSubtle: string;
  accentForeground: string;

  // NEW semantic tokens
  bg: string;
  surface: string;
  surface2: string;
  surface1: string;
  surface3: string;
  glass: string;
  glassBorder: string;
  shadow: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  ringTrack: string;
  borderElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

type ThemeAccents = {
  light: {
    primary?: string;
    accent?: string;
    gradientStyle?: GradientPairingStyle;
  };
  dark: {
    primary?: string;
    accent?: string;
    gradientStyle?: GradientPairingStyle;
  };
};

type ThemeContextShape = {
  colors: ThemeColors;
  isDark: boolean;
  modeSetting: ThemeMode;
  setModeSetting: (m: ThemeMode) => void;
  themeReady: boolean;
  themeLoadError: boolean;
  refreshTheme: () => Promise<void>;
  commitThemeDraft: (draft: ThemeSnapshot) => Promise<void>;

  // existing API (kept): sets BOTH light+dark
  setAccents: (primary?: string, accent?: string) => void;
  resetAccents: () => void;

  // new API
  themeAccents: ThemeAccents;
  setAccentsFor: (
    target: "light" | "dark" | "both",
    primary?: string,
    accent?: string
  ) => void;
  setGradientStyleFor: (
    target: "light" | "dark" | "both",
    style?: GradientPairingStyle
  ) => void;
  resetAccentsFor: (target: "light" | "dark" | "both") => void;
};

const ThemeContext = createContext<ThemeContextShape | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// defaults if user hasn't customized
const DEFAULT_STYLE: GradientPairingStyle = "balanced";

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function sanitizeAccentColor(hex: string, isDark: boolean): string {
  const { h, s, l } = hexToHSL(hex);
  if (isDark) {
    return hslToHex(h, Math.min(Math.max(s, 40), 75), Math.min(Math.max(l, 50), 70));
  }
  return hslToHex(h, Math.min(Math.max(s, 45), 85), Math.min(Math.max(l, 30), 55));
}

function deriveAccentPalette(baseHex: string, isDark: boolean) {
  const safe = sanitizeAccentColor(baseHex, isDark);
  const { h, s, l } = hexToHSL(safe);
  const adjustedS = isDark ? Math.min(s, 75) : Math.min(s, 85);
  const adjustedL = isDark ? Math.max(l, 55) : Math.min(l, 50);
  const accent = hslToHex(h, adjustedS, adjustedL);
  return {
    accent,
    accentMuted: hslToHex(
      h,
      Math.max(28, adjustedS * 0.7),
      isDark ? Math.max(48, adjustedL * 0.9) : Math.min(58, adjustedL * 1.08)
    ),
    accentDim: hslToHex(h, Math.max(18, adjustedS * 0.4), isDark ? 20 : 92),
    accentSubtle: hslToHex(h, Math.max(22, adjustedS * 0.55), isDark ? 28 : 85),
    accentForeground: adjustedL > 60 ? "#0A0A14" : "#F0F0FF",
    accentRaw: safe,
  };
}

const STORAGE_KEYS = {
  MODE: THEME_KEYS.mode,

  // legacy keys (keep reading for migration)
  PRIMARY: THEME_KEYS.legacyPrimary,
  ACCENT: THEME_KEYS.legacyAccent,

  // per-mode keys (new)
  LIGHT_PRIMARY: THEME_KEYS.lightPrimary,
  LIGHT_ACCENT: THEME_KEYS.lightAccent,
  DARK_PRIMARY: THEME_KEYS.darkPrimary,
  DARK_ACCENT: THEME_KEYS.darkAccent,

  LIGHT_STYLE: THEME_KEYS.lightStyle,
  DARK_STYLE: THEME_KEYS.darkStyle,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [modeSetting, setModeSetting] = useState<ThemeMode>("system");

  // system scheme tracking
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? "light"
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => {
      // RN compatibility
      // @ts-ignore
      if (typeof sub?.remove === "function") sub.remove();
      // @ts-ignore
      else if (typeof sub === "function") sub();
    };
  }, []);

  const isSystemDark = systemScheme === "dark";

  const [themeAccents, setThemeAccentsState] = useState<ThemeAccents>({
    light: { ...OCEAN.light },
    dark: { ...OCEAN.dark },
  });
  const [themeReady, setThemeReady] = useState(false);
  const [themeLoadError, setThemeLoadError] = useState(false);

  const refreshTheme = async () => {
    setThemeReady(false);
    try {
      const saved = await readThemeSnapshot(AsyncStorage);
      setModeSetting(saved.mode);
      setThemeAccentsState({ light: saved.light, dark: saved.dark });
      setThemeLoadError(false);
    } catch {
      setThemeLoadError(true);
    } finally {
      setThemeReady(true);
    }
  };

  // Migration happens during provider hydration, before the picker can create a draft.
  useEffect(() => { void refreshTheme(); }, []);

  const commitThemeDraft = async (draft: ThemeSnapshot) => {
    const saved = await persistThemeSnapshot(AsyncStorage, draft);
    setModeSetting(saved.mode);
    setThemeAccentsState({ light: saved.light, dark: saved.dark });
  };

  const setModePersist = async (m: ThemeMode) => {
    setModeSetting(m);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MODE, m);
    } catch {}
  };

  const setAccentsFor: ThemeContextShape["setAccentsFor"] = (
    target,
    primary,
    accent
  ) => {
    setThemeAccentsState((prev) => {
      const next: ThemeAccents = {
        ...prev,
        light: { ...prev.light },
        dark: { ...prev.dark },
      };
      const apply = (t: "light" | "dark") => {
        next[t].primary = primary;
        next[t].accent = accent;
      };
      if (target === "both") {
        apply("light");
        apply("dark");
      } else apply(target);

      (async () => {
        try {
          const tasks: Promise<any>[] = [];
          const write = async (key: string, value?: string) => {
            if (value) return AsyncStorage.setItem(key, value);
            return AsyncStorage.removeItem(key);
          };

          if (target === "light" || target === "both") {
            tasks.push(write(STORAGE_KEYS.LIGHT_PRIMARY, primary));
            tasks.push(write(STORAGE_KEYS.LIGHT_ACCENT, accent));
          }
          if (target === "dark" || target === "both") {
            tasks.push(write(STORAGE_KEYS.DARK_PRIMARY, primary));
            tasks.push(write(STORAGE_KEYS.DARK_ACCENT, accent));
          }

          // Keep legacy keys synced to "both" when applying both (helps old screens)
          if (target === "both") {
            tasks.push(write(STORAGE_KEYS.PRIMARY, primary));
            tasks.push(write(STORAGE_KEYS.ACCENT, accent));
          }

          await Promise.all(tasks);
        } catch {}
      })();

      return next;
    });
  };

  const setGradientStyleFor: ThemeContextShape["setGradientStyleFor"] = (
    target,
    style
  ) => {
    setThemeAccentsState((prev) => {
      const next: ThemeAccents = {
        ...prev,
        light: { ...prev.light },
        dark: { ...prev.dark },
      };
      const apply = (t: "light" | "dark") => {
        next[t].gradientStyle = style ?? DEFAULT_STYLE;
      };
      if (target === "both") {
        apply("light");
        apply("dark");
      } else apply(target);

      (async () => {
        try {
          const write = async (key: string, value?: string) => {
            if (value) return AsyncStorage.setItem(key, value);
            return AsyncStorage.removeItem(key);
          };
          const tasks: Promise<any>[] = [];
          if (target === "light" || target === "both")
            tasks.push(write(STORAGE_KEYS.LIGHT_STYLE, style));
          if (target === "dark" || target === "both")
            tasks.push(write(STORAGE_KEYS.DARK_STYLE, style));
          await Promise.all(tasks);
        } catch {}
      })();

      return next;
    });
  };

  const resetAccentsFor: ThemeContextShape["resetAccentsFor"] = (target) => {
    setAccentsFor(target, undefined, undefined);
    // styles reset separately if you want:
    setGradientStyleFor(target, DEFAULT_STYLE);
  };

  // existing API: sets BOTH
  const setAccents: ThemeContextShape["setAccents"] = (primary, accent) =>
    setAccentsFor("both", primary, accent);
  const resetAccents: ThemeContextShape["resetAccents"] = () =>
    resetAccentsFor("both");

  const isDark =
    modeSetting === "system" ? isSystemDark : modeSetting === "dark";

  const activeAccents = isDark ? themeAccents.dark : themeAccents.light;

  const primary = activeAccents.primary ?? (isDark ? OCEAN.dark.primary : OCEAN.light.primary);
  const accent = activeAccents.accent ?? (isDark ? OCEAN.dark.accent : OCEAN.light.accent);

  const colors: ThemeColors = useMemo(() => {
    const accentPalette = deriveAccentPalette(accent, isDark);
    if (isDark) {
      const background = "#08080F";
      const text = "#F0F0FF";

      return {
        background,
        text,
        card: "#0F0F1A",
        border: "#FFFFFF08",
        muted: "#8888AA",
        placeholder: "#444466",
        inputBg: "#1C1C2E",
        inputBorder: "#FFFFFF12",
        chipActiveBg: accentPalette.accentDim,
        chipActiveText: accentPalette.accentForeground,
        buttonBg: accentPalette.accent,
        buttonText: accentPalette.accentForeground,
        chartPrimary: primary,
        chartSecondary: accentPalette.accentMuted,
        primary,
        accent: accentPalette.accent,
        accentMuted: accentPalette.accentMuted,
        accentDim: accentPalette.accentDim,
        accentSubtle: accentPalette.accentSubtle,
        accentForeground: accentPalette.accentForeground,

        bg: background,
        surface: "#0F0F1A",
        surface1: "#0F0F1A",
        surface2: "#141422",
        surface3: "#1C1C2E",
        glass: "rgba(15,15,26,0.85)",
        glassBorder: "#FFFFFF08",
        shadow: "#000",
        success: "#4ADE80",
        warning: "#F59E0B",
        danger: "#F87171",
        info: "#06B6D4",
        ringTrack: "#1C1C2E",
        borderElevated: "#FFFFFF12",
        textPrimary: "#F0F0FF",
        textSecondary: "#8888AA",
        textTertiary: "#444466",
      };
    }

    const background = "#F8F8FC";
    const text = "#0A0A1A";

    return {
      background,
      text,
      card: "#FFFFFF",
      border: "#00000008",
      muted: "#666688",
      placeholder: "#AAABCC",
      inputBg: "#EAEAF2",
      inputBorder: "#00000012",
        chipActiveBg: accentPalette.accentDim,
        chipActiveText: accentPalette.accentForeground,
        buttonBg: accentPalette.accent,
        buttonText: accentPalette.accentForeground,
        chartPrimary: primary,
        chartSecondary: accentPalette.accentMuted,
        primary,
        accent: accentPalette.accent,
        accentMuted: accentPalette.accentMuted,
        accentDim: accentPalette.accentDim,
        accentSubtle: accentPalette.accentSubtle,
        accentForeground: accentPalette.accentForeground,

      bg: background,
      surface: "#FFFFFF",
      surface1: "#FFFFFF",
      surface2: "#F2F2F8",
      surface3: "#EAEAF2",
      glass: "rgba(255,255,255,0.85)",
      glassBorder: "#00000008",
      shadow: "rgba(0,0,0,0.25)",
      success: "#22C55E",
      warning: "#D97706",
      danger: "#E65C5C",
      info: "#0891B2",
      ringTrack: "#E8E8F0",
      borderElevated: "#00000012",
      textPrimary: "#0A0A1A",
      textSecondary: "#444460",
      textTertiary: "#9090AA",
    };
  }, [isDark, primary, accent]);

  const value: ThemeContextShape = {
    colors,
    isDark,
    modeSetting,
    setModeSetting: setModePersist,
    themeReady,
    themeLoadError,
    refreshTheme,
    commitThemeDraft,

    setAccents,
    resetAccents,

    themeAccents,
    setAccentsFor,
    setGradientStyleFor,
    resetAccentsFor,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
