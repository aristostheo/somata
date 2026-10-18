import { useTheme } from '@/content/ThemeProvider';
import { contrastRatio } from '@/lib/themeColor';
import { StyleSheet } from 'react-native';

/** Presentation tokens only. The provider remains the owner of mode, palettes and persistence. */
export function useSomataTheme() {
  const { isDark, colors } = useTheme();
  const D = {
    bg: isDark ? '#080A09' : '#F3F5F0', card: isDark ? '#191D1B' : '#FFFFFF',
    raised: isDark ? '#252A26' : '#E6EBE3', low: isDark ? '#111512' : '#EDF1E9',
    text: isDark ? '#F6F8F4' : '#142019', muted: isDark ? '#ACB6AC' : '#4C5B50',
    dim: isDark ? '#9DAA9F' : '#56665B', line: isDark ? '#343C35' : '#CAD5CA',
    teal: colors.accent, lime: isDark ? "#D2EF78" : "#526916",
    primary: colors.primary, ink: isDark ? "#0A1711" : "#FFFFFF",
    onPrimary: contrastRatio(colors.primary, '#0A1711') >= contrastRatio(colors.primary, '#FFFFFF') ? '#0A1711' : '#FFFFFF',
    amber: isDark ? '#EBC47A' : '#7E540B', danger: isDark ? '#FFB8AB' : '#A12C25',
    tint: isDark ? '#1D3B31' : '#DEEEE3',
    signature: isDark ? '#D2EF78' : '#526916',
  };
  const F = StyleSheet.create({
    eyebrow: { color: D.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
    title: { color: D.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.2 },
    heading: { color: D.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
    body: { color: D.muted, fontSize: 14, lineHeight: 21 }, caption: { color: D.muted, fontSize: 12, lineHeight: 18 },
    value: { color: D.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
    panel: { backgroundColor: D.card, borderRadius: 22, padding: 19, gap: 15 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  });
  return { D, F, isDark };
}
