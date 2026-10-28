import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { useSomataTheme } from "@/components/somata/theme";
import { useTheme } from "@/content/ThemeProvider";

/** Visual colors for Profile destinations; the active theme still supplies accents. */
export function useProfileFlowTheme() {
  const theme = useTheme();
  const { isDark } = theme;
  const { D } = useSomataTheme();
  const visual = { canvas: D.bg, card: D.card, raised: D.raised, text: D.text, secondary: D.muted, border: D.line };

  return {
    ...theme,
    colors: {
      ...theme.colors,
      background: visual.canvas,
      bg: visual.canvas,
      card: visual.card,
      surface: visual.card,
      surface1: visual.card,
      surface2: visual.raised,
      surface3: D.raised,
      text: visual.text,
      textPrimary: visual.text,
      textSecondary: visual.secondary,
      textTertiary: visual.secondary,
      muted: visual.secondary,
      border: visual.border,
      borderElevated: visual.border,
    },
  };
}

/** Explicit Profile-family opt-in; other destinations keep their current appearance. */
export function usePremiumProfileFlowTheme() {
  const theme = useProfileFlowTheme();
  const { D, t } = useTaskPresentation();
  return { ...theme, colors: { ...theme.colors,
    background: D.bg, bg: D.bg, card: D.card, surface: D.card, surface1: D.card,
    surface2: D.raised, surface3: D.raised, text: D.text, textPrimary: D.text,
    textSecondary: D.muted, textTertiary: D.muted, muted: D.muted,
    border: D.line, borderElevated: D.line, primary: t.action.link, accent: t.action.link,
    success: t.status.success, warning: t.status.warning, danger: t.status.error,
  } };
}
