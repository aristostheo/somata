import assert from "node:assert/strict";
import test from "node:test";
import { createSemanticTokens, SOMATA_BRAND } from "../services/theme/semanticTokens";
import { authPalette } from "../components/somata/authPalette";
import { contrastRatio } from "../lib/themeColor";
import { effectiveIsDark } from "../services/theme/themeState";

const contrast = (ink: string, background: string, minimum = 4.5) =>
  assert(contrastRatio(ink, background) >= minimum, `${ink} on ${background} must meet ${minimum}:1`);

test("semantic text, actions, selection and navigation maintain contrast in both modes", () => {
  for (const dark of [false, true]) {
    const t = createSemanticTokens(dark);
    for (const surface of [t.surface.canvas, t.surface.primary, t.surface.secondary, t.surface.inset]) {
      for (const ink of [t.text.primary, t.text.secondary, t.text.tertiary, t.action.link, ...Object.values(t.status)]) {
        contrast(ink, surface);
      }
      contrast(t.focus.ring, surface, 3);
      contrast(t.border.control, surface, 3);
      for (const series of [t.data.energy, t.data.protein, t.data.carbohydrate, t.data.fat, t.data.steps, t.data.weight]) {
        contrast(series, surface, 3);
      }
    }
    contrast(t.action.primary.foreground, t.action.primary.background);
    contrast(t.action.primary.foreground, t.action.primary.pressed);
    contrast(t.action.secondary.foreground, t.action.secondary.background);
    contrast(t.action.secondary.foreground, t.action.secondary.pressed);
    contrast(t.selection.foreground, t.selection.background);
    contrast(t.disabled.foreground, t.disabled.background);
    contrast(t.navigation.active, t.navigation.background);
    contrast(t.navigation.inactive, t.navigation.background);
    contrast(t.navigation.onBadge, t.navigation.badge);
  }
});

test("the foundation follows the resolved mode and separates brand, feedback and data roles", () => {
  for (const system of ["dark", "light"] as const) {
    assert.equal(createSemanticTokens(effectiveIsDark("system", system)).mode, system);
    assert.equal(createSemanticTokens(effectiveIsDark("dark", system)).mode, "dark");
    assert.equal(createSemanticTokens(effectiveIsDark("light", system)).mode, "light");
  }
  for (const dark of [false, true]) {
    const t = createSemanticTokens(dark);
    assert.equal(t.action.primary.background, SOMATA_BRAND.orange);
    assert.equal(t.brand.coral, "#FF5A2A");
    assert.notEqual(t.status.success, t.action.link);
    assert.notEqual(t.status.error, t.brand.coral);
    assert.notEqual(t.data.missing, t.data.energy);
    assert.equal(new Set([t.data.energy, t.data.protein, t.data.carbohydrate, t.data.fat]).size, 4);
    assert(t.layout.minTouchTarget >= 44);
  }
});

test("authentication adapter preserves all Checkpoint 2B colors without global remapping", () => {
  for (const dark of [false, true]) {
    assert.deepEqual(authPalette(dark), {
      bg: dark ? "#0B0E12" : "#F4F3EE", card: dark ? "#1A1F26" : "#FFFFFF",
      text: dark ? "#F4F3EE" : "#0B0E12", muted: dark ? "#BCC3CA" : "#38434D",
      border: dark ? "#73808B" : "#78828C", accent: dark ? "#FF6A00" : "#B33B00",
      primary: "#FF6A00", onPrimary: "#0B0E12", pressed: "#FFC629", coral: "#FF5A2A",
      disabled: dark ? "#38434D" : "#DBDFE2", danger: dark ? "#FF967F" : "#A32F0D",
    });
  }
});
