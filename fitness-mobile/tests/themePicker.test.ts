import assert from "node:assert/strict";
import test from "node:test";

import {
  OCEAN, THEME_KEYS, copyTheme, effectiveIsDark, persistThemeSnapshot,
  readThemeSnapshot, resetPalette, setPreset, type ThemeStorage,
} from "../services/theme/themeState";

class MemoryThemeStorage implements ThemeStorage {
  values = new Map<string, string>();
  writes = 0;
  failNextBatch = false;
  constructor(entries: Array<[string, string]> = []) { entries.forEach(([key, value]) => this.values.set(key, value)); }
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  async removeItem(key: string) { this.writes++; this.values.delete(key); }
  async multiSet(entries: [string, string][]) {
    this.writes++;
    if (this.failNextBatch) {
      this.failNextBatch = false;
      this.values.set(entries[0][0], entries[0][1]);
      throw new Error("Storage failed");
    }
    entries.forEach(([key, value]) => this.values.set(key, value));
  }
}

test("opening, editing, cancelling and backing out do not persist", async () => {
  const storage = new MemoryThemeStorage();
  const saved = await readThemeSnapshot(storage);
  const draft = setPreset({ ...copyTheme(saved), mode: "dark" }, "light", "Pine");
  assert.equal(draft.light.primary, "#286B57");
  assert.equal(storage.writes, 0);
  assert.equal(await storage.getItem(THEME_KEYS.mode), null);
  assert.deepEqual(await readThemeSnapshot(storage), saved);
});

test("Save commits mode and both palette pairs without changing the untouched palette", async () => {
  const storage = new MemoryThemeStorage([
    [THEME_KEYS.mode, "light"],
    [THEME_KEYS.darkPrimary, "#BBAADD"], [THEME_KEYS.darkAccent, "#DDBBCC"],
  ]);
  const saved = await readThemeSnapshot(storage);
  const draft = setPreset({ ...copyTheme(saved), mode: "system" }, "light", "Plum");
  const committed = await persistThemeSnapshot(storage, draft);
  assert.equal(await storage.getItem(THEME_KEYS.mode), "system");
  assert.equal(await storage.getItem(THEME_KEYS.lightPrimary), "#6C4A8E");
  assert.equal(await storage.getItem(THEME_KEYS.lightAccent), "#86506F");
  assert.equal(await storage.getItem(THEME_KEYS.darkPrimary), "#BBAADD");
  assert.equal(await storage.getItem(THEME_KEYS.darkAccent), "#DDBBCC");
  assert.deepEqual(await readThemeSnapshot(storage), committed);
});

test("preset and reset change only the selected palette", () => {
  const saved = { mode: "dark" as const, light: { ...OCEAN.light }, dark: { primary: "#ABCDEF", accent: "#FEDCBA", gradientStyle: "bold" as const } };
  const changed = setPreset(saved, "light", "Pine");
  assert.deepEqual(changed.dark, saved.dark);
  const reset = resetPalette(changed, "dark");
  assert.deepEqual(reset.light, changed.light);
  assert.deepEqual(reset.dark, OCEAN.dark);
});

test("provider mode wins over legacy sheet mode and saved per-mode colors survive migration", async () => {
  const storage = new MemoryThemeStorage([
    [THEME_KEYS.mode, "dark"], [THEME_KEYS.legacyMode, "light"],
    [THEME_KEYS.legacyPrimary, "#112233"], [THEME_KEYS.legacyAccent, "#334455"],
    [THEME_KEYS.lightPrimary, "#445566"], [THEME_KEYS.darkPrimary, "#AABBCC"],
    [THEME_KEYS.darkAccent, "#DDEEFF"],
  ]);
  const saved = await readThemeSnapshot(storage);
  assert.equal(saved.mode, "dark");
  assert.equal(saved.light.primary, "#445566");
  assert.equal(saved.light.accent, "#334455");
  assert.equal(saved.dark.primary, "#AABBCC");
  assert.equal(saved.dark.accent, "#DDEEFF");
  assert.equal(await storage.getItem(THEME_KEYS.legacyMode), null);
  const writesAfterMigration = storage.writes;
  assert.deepEqual(await readThemeSnapshot(storage), saved);
  assert.equal(storage.writes, writesAfterMigration);
});

test("legacy sheet mode is adopted only when the provider key is absent", async () => {
  const storage = new MemoryThemeStorage([[THEME_KEYS.legacyMode, "light"]]);
  const saved = await readThemeSnapshot(storage);
  assert.equal(saved.mode, "light");
  assert.equal(await storage.getItem(THEME_KEYS.mode), "light");
  assert.equal(await storage.getItem(THEME_KEYS.legacyMode), null);
});

test("failed Save restores the old persisted mode and keeps the draft reusable", async () => {
  const storage = new MemoryThemeStorage([[THEME_KEYS.mode, "light"]]);
  const draft = setPreset({ ...await readThemeSnapshot(storage), mode: "dark" }, "dark", "Pine");
  storage.failNextBatch = true;
  await assert.rejects(persistThemeSnapshot(storage, draft));
  assert.equal(await storage.getItem(THEME_KEYS.mode), "light");
  assert.equal(await storage.getItem(THEME_KEYS.darkPrimary), null);
  assert.equal(draft.dark.primary, "#9DD8B6");
  await persistThemeSnapshot(storage, draft);
  assert.equal(await storage.getItem(THEME_KEYS.mode), "dark");
});

test("System follows the current device scheme", () => {
  assert.equal(effectiveIsDark("system", "light"), false);
  assert.equal(effectiveIsDark("system", "dark"), true);
  assert.equal(effectiveIsDark("light", "dark"), false);
  assert.equal(effectiveIsDark("dark", "light"), true);
});
