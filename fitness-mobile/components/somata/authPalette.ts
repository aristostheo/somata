import { createSemanticTokens } from "../../services/theme/semanticTokens";

/** Compatibility adapter: keeps Checkpoint 2B's exact appearance and API. */
export function authPalette(dark: boolean) {
  const t = createSemanticTokens(dark);
  return {
    bg: t.surface.canvas,
    card: t.surface.primary,
    text: t.text.primary,
    muted: t.text.secondary,
    border: t.border.control,
    accent: t.action.link,
    primary: t.action.primary.background,
    onPrimary: t.action.primary.foreground,
    pressed: t.action.primary.pressed,
    coral: t.brand.coral,
    disabled: t.disabled.background,
    danger: t.status.error,
  };
}
