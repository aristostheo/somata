import type { SemanticTokens } from "@/services/theme/semanticTokens";

/** Home presentation recipes, derived from the existing mode-aware foundation. */
export function premiumHomeTheme(t: SemanticTokens) {
  const dark = t.mode === "dark";
  return {
    canvas: t.surface.canvas,
    surface: dark ? "#10171C" : t.surface.primary,
    edge: dark ? "#354048" : t.border.subtle,
    warmEdge: dark ? "#82442C" : "#CDA68E",
    lighting: [dark ? "#382019" : "#FFF1E4", dark ? "#11191E" : "#FFFFFF", dark ? "#0E1418" : "#F5F6F5"] as const,
    heroLighting: [dark ? "#241710" : "#FFF0DE", dark ? "#0E151A" : "#FFFFFF", dark ? "#2A1714" : "#FFF2EA"] as const,
    recommendation: [dark ? "#3A1F16" : "#FFF0D7", dark ? "#171211" : "#FFFAF5", dark ? "#402014" : "#FFE8D6"] as const,
    cta: ["#FFB43D", t.brand.orange, t.brand.coral] as const,
    macro: { protein: t.action.link, carbohydrate: t.status.info, fat: dark ? "#DEA2EF" : "#803B92" },
    macroWash: { protein: dark ? "#302019" : "#FFF1E4", carbohydrate: dark ? "#102631" : "#E9F4FC", fat: dark ? "#2E2031" : "#F8EDF9" },
    shadow: dark ? "#000000" : "#38434D",
  };
}
