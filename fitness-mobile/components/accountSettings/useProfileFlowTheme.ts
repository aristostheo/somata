import { useTheme } from "@/content/ThemeProvider";
import { visualTokens } from "./visualTokens";

/** Visual colors for Profile destinations; the active theme still supplies accents. */
export function useProfileFlowTheme() {
  const theme = useTheme();
  const { isDark } = theme;
  const visual = visualTokens(isDark, theme.colors.primary, theme.colors.accent);

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
      surface3: isDark ? "#2A3B5B" : "#E7DCEF",
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
