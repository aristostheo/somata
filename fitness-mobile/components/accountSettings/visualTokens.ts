import { withAlpha } from "@/lib/color";

export function visualTokens(isDark: boolean, primary: string, accent: string, preview = false) {
  if (preview) return {
    canvas: "#080A09", card: "#1A1E1C", raised: "#242B26",
    text: "#F7F8F4", secondary: "#AFBAB1", border: "#303932",
    primary, accent,
    primaryTint: withAlpha(primary, 0.2), accentTint: withAlpha(accent, 0.16),
    heroStart: "#163D36", heroMiddle: "#17493A", heroEnd: "#293E2A",
    gold: "#D4EF78", coral: "#65CDB9", dark: true,
  };
  const canvas = isDark ? "#090E20" : "#F6F1EA";
  const card = isDark ? "#16213A" : "#FFFCF8";
  const raised = isDark ? "#20304D" : "#EFE8F5";
  const text = isDark ? "#FAF8FF" : "#261D35";
  const secondary = isDark ? "#B0BCD6" : "#70677D";
  const border = isDark ? "#344361" : "#DED4E3";
  return {
    canvas,
    card,
    raised,
    text,
    secondary,
    border,
    primary,
    accent,
    primaryTint: withAlpha(primary, isDark ? 0.2 : 0.13),
    accentTint: withAlpha(accent, isDark ? 0.18 : 0.12),
    heroStart: isDark ? "#1D2856" : "#243564",
    heroMiddle: isDark ? "#183D5A" : "#315076",
    heroEnd: isDark ? "#121C3A" : "#26375D",
    gold: "#F0C98C",
    coral: isDark ? "#F1A7B8" : "#C65D77",
    dark: isDark,
  };
}

export type VisualTokens = ReturnType<typeof visualTokens>;
