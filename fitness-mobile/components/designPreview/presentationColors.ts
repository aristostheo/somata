import type { SemanticTokens } from "@/services/theme/semanticTokens";

/** Compatibility names for existing Home JSX, resolved by role only inside its scope. */
export function presentationColors(t: SemanticTokens) {
  return {
    bg: t.surface.canvas, card: t.surface.primary, raised: t.surface.secondary, low: t.surface.inset,
    text: t.text.primary, muted: t.text.secondary, dim: t.text.tertiary, line: t.border.subtle,
    teal: t.action.link, lime: t.action.link, primary: t.action.primary.background,
    ink: t.text.onBrand, onPrimary: t.action.primary.foreground,
    amber: t.status.warning, danger: t.status.error, tint: t.selection.background,
    signature: t.action.link,
  };
}
