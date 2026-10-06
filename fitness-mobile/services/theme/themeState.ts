import { isHex6, normalizeHex } from "@/lib/themeColor";

export type ThemeMode = "system" | "light" | "dark";
export type PaletteTarget = "light" | "dark";
export type GradientPairingStyle = "subtle" | "balanced" | "bold";
export type ThemePalette = { primary: string; accent: string; gradientStyle: GradientPairingStyle };
export type ThemeSnapshot = { mode: ThemeMode; light: ThemePalette; dark: ThemePalette };

export interface ThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet(entries: [string, string][]): Promise<void>;
}

export const THEME_KEYS = {
  mode: "@theme:mode",
  legacyMode: "settings.themeMode",
  legacyPrimary: "@theme:primary",
  legacyAccent: "@theme:accent",
  lightPrimary: "@theme:light:primary",
  lightAccent: "@theme:light:accent",
  darkPrimary: "@theme:dark:primary",
  darkAccent: "@theme:dark:accent",
  lightStyle: "@theme:light:gradientStyle",
  darkStyle: "@theme:dark:gradientStyle",
} as const;

export const OCEAN: Record<PaletteTarget, ThemePalette> = {
  light: { primary: "#315B9A", accent: "#17786C", gradientStyle: "balanced" },
  dark: { primary: "#A9C4FF", accent: "#79D7BF", gradientStyle: "balanced" },
};

export const PRESETS: Record<"Ocean" | "Pine" | "Plum", Record<PaletteTarget, Pick<ThemePalette, "primary" | "accent">>> = {
  Ocean: { light: { primary: OCEAN.light.primary, accent: OCEAN.light.accent }, dark: { primary: OCEAN.dark.primary, accent: OCEAN.dark.accent } },
  Pine: { light: { primary: "#286B57", accent: "#156E65" }, dark: { primary: "#9DD8B6", accent: "#77D1BE" } },
  Plum: { light: { primary: "#6C4A8E", accent: "#86506F" }, dark: { primary: "#D5B7EF", accent: "#E5B7D1" } },
};

const validMode = (value: string | null): value is ThemeMode => value === "system" || value === "light" || value === "dark";
const validStyle = (value: string | null): value is GradientPairingStyle => value === "subtle" || value === "balanced" || value === "bold";

/** The provider key already controls rendering, so it wins over the retired sheet key. */
export async function readThemeSnapshot(storage: ThemeStorage): Promise<ThemeSnapshot> {
  const keys = THEME_KEYS;
  const [mode, legacyMode, legacyPrimary, legacyAccent, lightPrimary, lightAccent, darkPrimary, darkAccent, lightStyle, darkStyle] = await Promise.all([
    storage.getItem(keys.mode), storage.getItem(keys.legacyMode),
    storage.getItem(keys.legacyPrimary), storage.getItem(keys.legacyAccent),
    storage.getItem(keys.lightPrimary), storage.getItem(keys.lightAccent),
    storage.getItem(keys.darkPrimary), storage.getItem(keys.darkAccent),
    storage.getItem(keys.lightStyle), storage.getItem(keys.darkStyle),
  ]);

  const effectiveMode: ThemeMode = validMode(mode) ? mode : validMode(legacyMode) ? legacyMode : "system";
  const snapshot: ThemeSnapshot = {
    mode: effectiveMode,
    light: {
      primary: lightPrimary ?? legacyPrimary ?? OCEAN.light.primary,
      accent: lightAccent ?? legacyAccent ?? OCEAN.light.accent,
      gradientStyle: validStyle(lightStyle) ? lightStyle : "balanced",
    },
    dark: {
      primary: darkPrimary ?? legacyPrimary ?? OCEAN.dark.primary,
      accent: darkAccent ?? legacyAccent ?? OCEAN.dark.accent,
      gradientStyle: validStyle(darkStyle) ? darkStyle : "balanced",
    },
  };

  // This runs at provider hydration, not when the picker opens. Repeat runs write nothing.
  const migration: [string, string][] = [];
  if (!validMode(mode) && validMode(legacyMode)) migration.push([keys.mode, legacyMode]);
  if (lightPrimary === null && legacyPrimary !== null) migration.push([keys.lightPrimary, legacyPrimary]);
  if (lightAccent === null && legacyAccent !== null) migration.push([keys.lightAccent, legacyAccent]);
  if (darkPrimary === null && legacyPrimary !== null) migration.push([keys.darkPrimary, legacyPrimary]);
  if (darkAccent === null && legacyAccent !== null) migration.push([keys.darkAccent, legacyAccent]);
  if (migration.length) await storage.multiSet(migration);
  // Retire the duplicate key only after its effective value is already safe in the provider key.
  if (legacyMode !== null && (validMode(mode) || validMode(legacyMode))) {
    try { await storage.removeItem(keys.legacyMode); } catch { /* Safe to retry next launch. */ }
  }
  return snapshot;
}

export function copyTheme(snapshot: ThemeSnapshot): ThemeSnapshot {
  return { mode: snapshot.mode, light: { ...snapshot.light }, dark: { ...snapshot.dark } };
}

export function setPreset(snapshot: ThemeSnapshot, target: PaletteTarget, name: keyof typeof PRESETS): ThemeSnapshot {
  return { ...snapshot, [target]: { ...snapshot[target], ...PRESETS[name][target] } };
}

export function resetPalette(snapshot: ThemeSnapshot, target: PaletteTarget): ThemeSnapshot {
  return { ...snapshot, [target]: { ...OCEAN[target] } };
}

export function effectiveIsDark(mode: ThemeMode, systemScheme: "light" | "dark" | "unspecified" | null | undefined) {
  return mode === "dark" || (mode === "system" && systemScheme === "dark");
}

export async function persistThemeSnapshot(storage: ThemeStorage, snapshot: ThemeSnapshot): Promise<ThemeSnapshot> {
  const next = copyTheme(snapshot);
  for (const target of ["light", "dark"] as const) {
    for (const field of ["primary", "accent"] as const) {
      const value = normalizeHex(next[target][field]);
      if (!isHex6(value)) throw new Error(`Enter a valid six-digit ${target} ${field} color.`);
      next[target][field] = value;
    }
  }
  const entries: [string, string][] = [
    [THEME_KEYS.mode, next.mode],
    [THEME_KEYS.lightPrimary, next.light.primary], [THEME_KEYS.lightAccent, next.light.accent],
    [THEME_KEYS.darkPrimary, next.dark.primary], [THEME_KEYS.darkAccent, next.dark.accent],
    [THEME_KEYS.lightStyle, next.light.gradientStyle], [THEME_KEYS.darkStyle, next.dark.gradientStyle],
  ];
  const before = await Promise.all(entries.map(async ([key]) => [key, await storage.getItem(key)] as const));
  try {
    await storage.multiSet(entries);
  } catch (error) {
    const rollback = await Promise.allSettled(before.map(([key, value]) => value === null ? storage.removeItem(key) : storage.setItem(key, value)));
    if (rollback.some((result) => result.status === "rejected")) throw new Error("Couldn’t save appearance and restore the previous settings. Please retry.");
    throw error;
  }
  return next;
}
