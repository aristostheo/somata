/** Somata's presentation foundation. Pure, mode-aware, with no storage or data logic.
 * Legacy palette customization remains in ThemeProvider.colors until each surface
 * is explicitly migrated. Do not alias a color-named legacy token globally.
 */
export const SOMATA_BRAND = {
  charcoal: "#0B0E12", graphite: "#1A1F26", slate: "#38434D", bone: "#F4F3EE",
  orange: "#FF6A00", coral: "#FF5A2A", yellow: "#FFC629",
} as const;

export function createSemanticTokens(dark: boolean) {
  const b = SOMATA_BRAND;
  const surface = {
    canvas: dark ? b.charcoal : b.bone,
    primary: dark ? b.graphite : "#FFFFFF",
    secondary: dark ? "#242B34" : "#E8EBED",
    inset: dark ? "#10151B" : "#EEF0F2",
    scrim: "#000000B3",
  };
  const text = {
    primary: dark ? b.bone : b.charcoal,
    secondary: dark ? "#BCC3CA" : b.slate,
    tertiary: dark ? "#A7B1BA" : "#505E69",
    onBrand: b.charcoal,
  };
  // Raw orange/yellow are unsuitable for small text on white. These ink variants
  // retain the warm identity while meeting contrast on the intended surfaces.
  const accentInk = dark ? b.orange : "#B33B00";
  const border = {
    subtle: dark ? b.slate : "#CDD3D8",
    control: dark ? "#73808B" : "#78828C",
  };
  return {
    mode: dark ? "dark" as const : "light" as const,
    brand: b,
    surface, text, border,
    action: {
      primary: { background: b.orange, foreground: b.charcoal, border: accentInk, pressed: b.yellow },
      secondary: { background: surface.secondary, foreground: text.primary, border: border.control, pressed: surface.inset },
      link: accentInk,
    },
    navigation: { background: surface.primary, active: accentInk, inactive: text.secondary,
      indicator: accentInk, badge: b.coral, onBadge: b.charcoal },
    selection: { background: dark ? "#342117" : "#FFF0E5", foreground: accentInk, border: accentInk },
    focus: { ring: accentInk, width: 2, offset: 2 },
    disabled: { background: dark ? b.slate : "#DBDFE2", foreground: text.secondary, border: border.control },
    status: {
      success: dark ? "#79DB9B" : "#166B3E",
      warning: dark ? b.yellow : "#7E540B",
      error: dark ? "#FF967F" : "#A32F0D",
      info: dark ? "#8FC5FF" : "#225B96",
    },
    data: {
      energy: accentInk,
      protein: dark ? "#8FC5FF" : "#225B96",
      carbohydrate: dark ? b.yellow : "#7E540B",
      fat: dark ? "#FF967F" : "#A32F0D",
      steps: accentInk,
      weight: dark ? "#8FC5FF" : "#225B96",
      track: dark ? b.slate : "#CDD3D8",
      missing: text.tertiary,
    },
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 },
    radius: { control: 14, card: 20, hero: 24, pill: 999 },
    typography: {
      title: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.8 },
      heading: { fontSize: 20, fontWeight: "700" as const },
      body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
      caption: { fontSize: 13, lineHeight: 19, fontWeight: "500" as const },
      label: { fontSize: 14, fontWeight: "700" as const },
      metric: { fontSize: 32, fontWeight: "800" as const },
    },
    layout: { screenPadding: 20, minTouchTarget: 48 },
    motion: { pressMs: 120, transitionMs: 180 },
  };
}

export type SemanticTokens = ReturnType<typeof createSemanticTokens>;
