import React, { createContext, useContext } from "react";
import { useSomataTheme } from "@/components/somata/theme";
import { premiumHomeTheme } from "@/components/home/premiumTheme";
import type { SemanticTokens } from "@/services/theme/semanticTokens";
import { presentationColors } from "./presentationColors";

// Presentation only. ThemeProvider still owns all mode, palette and storage state.
// Task primitives opt in separately: the approved tabs already use this context.
const BrandAppearance = createContext<{ tokens: SemanticTokens; tasks: boolean } | null>(null);

export function SomataHomeAppearance({ children, premiumTasks = false }: {
  children: React.ReactNode; premiumTasks?: boolean;
}) {
  const { semantic } = useSomataTheme();
  return <BrandAppearance.Provider value={{ tokens: semantic, tasks: premiumTasks }}>{children}</BrandAppearance.Provider>;
}

export function SomataTaskAppearance({ children }: { children: React.ReactNode }) {
  return <SomataHomeAppearance premiumTasks>{children}</SomataHomeAppearance>;
}

export function usePresentation() {
  const theme = useSomataTheme();
  const brand = useContext(BrandAppearance)?.tokens ?? null;
  return { ...theme, brand, D: brand ? { ...theme.D, ...presentationColors(brand) } : theme.D };
}

/** A shared visual vocabulary, enabled only by the explicit task scope. */
export function useTaskPresentation() {
  const theme = useSomataTheme();
  const scope = useContext(BrandAppearance);
  const premium = scope?.tasks === true;
  const t = theme.semantic;
  const D = premium ? { ...theme.D, ...presentationColors(t) } : theme.D;
  const F = premium ? {
    ...theme.F,
    eyebrow: { ...theme.F.eyebrow, color: t.action.link },
    title: { ...theme.F.title, ...t.typography.title, color: t.text.primary },
    heading: { ...theme.F.heading, color: t.text.primary },
    body: { ...theme.F.body, fontSize: 14, lineHeight: 22, color: t.text.secondary },
    caption: { ...theme.F.caption, fontSize: 12, lineHeight: 18, color: t.text.secondary },
    value: { ...theme.F.value, color: t.text.primary },
    panel: { ...theme.F.panel, backgroundColor: t.surface.primary },
  } : theme.F;
  return { ...theme, D, F, premium, t, p: premiumHomeTheme(t) };
}
