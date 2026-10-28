import { usePresentation } from "./Appearance";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";

export const D = {
  bg: "#080A09", card: "#191D1B", raised: "#252A26", low: "#111512",
  text: "#F6F8F4", muted: "#ACB6AC", dim: "#859189", line: "#343C35",
  teal: "#52C5AE", lime: "#D2EF78", ink: "#0A1711", amber: "#EBC47A",
};
export type Icon = keyof typeof Ionicons.glyphMap;

export function Page({ eyebrow, title, subtitle, children, headerAction }: {
  eyebrow: string; title: string; subtitle?: string; children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const { D, F, brand } = usePresentation();

  const { fontScale } = useWindowDimensions();
  return <ScrollView style={{ flex: 1, backgroundColor: D.bg }} showsVerticalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: brand?.layout.screenPadding ?? 17, paddingTop: brand?.space.xl ?? 17, paddingBottom: 42, gap: brand?.space.xl ?? 17 }}>

    <View style={{ gap: 7 }}>

      <Text style={{ color: D.teal, fontSize: 11, fontWeight: "800", letterSpacing: 2.1 }}>{eyebrow.toUpperCase()}</Text>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>

        <Text accessibilityRole="header" style={{
          color: D.text, fontSize: brand?.typography.title.fontSize ?? (fontScale > 1.4 ? 26 : 32),
          letterSpacing: -1, fontWeight: "800", flexShrink: 1
        }}>{title}</Text>

        {headerAction}

      </View>

      {!!subtitle && <Text style={{ color: D.muted, fontSize: 13, lineHeight: 19 }}>{subtitle}</Text>}

    </View>

    {children}

  </ScrollView>;
}

export function Card({ children, accent = false, style }: { children: React.ReactNode; accent?: boolean; style?: object; }) {
  const { D, F, brand } = usePresentation();

  return <View style={{
    borderRadius: brand?.radius.card ?? 19, padding: brand?.space.xl ?? 17, gap: brand?.space.lg ?? 12, backgroundColor: accent ? D.tint : D.card,
    borderWidth: 1, borderColor: accent ? D.teal : D.line, ...style
  }}>
    {children}
  </View>;
}

export function Section({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode; }) {
  const { D, F, brand } = usePresentation();
  const { fontScale } = useWindowDimensions();

  return <View style={{ flexDirection: "row", flexWrap: brand ? "wrap" : "nowrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>

    <View style={brand ? { flexGrow: 1, flexShrink: 1, flexBasis: 160 * fontScale, maxWidth: "100%", gap: 2 } : { flex: 1, gap: 2 }}>

      <Text accessibilityRole="header" style={{ color: D.text, fontSize: brand?.typography.heading.fontSize ?? 19, fontWeight: "800" }}>{title}</Text>

      {!!caption && <Text style={{ color: D.dim, fontSize: brand?.typography.caption.fontSize ?? 12 }}>{caption}</Text>}

    </View>

    {action}

  </View>;
}

export function Action({ label, icon, onPress, bright = false, disabled = false }: {
  label: string; icon: Icon; onPress: () => void; bright?: boolean; disabled?: boolean;
}) {
  const { D, F, brand } = usePresentation();

  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({
      minHeight: brand?.layout.minTouchTarget ?? 47, paddingHorizontal: 14, paddingVertical: brand ? 14 : undefined, borderRadius: 14,
      maxWidth: brand ? "100%" : undefined, flexShrink: brand ? 1 : undefined,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
      backgroundColor: brand ? disabled ? brand.disabled.background : bright ? pressed ? brand.action.primary.pressed : D.primary : pressed ? brand.action.secondary.pressed : D.raised : bright ? D.primary : D.raised,
      borderWidth: brand ? 1 : 0, borderColor: brand ? bright ? brand.action.primary.border : brand.border.control : undefined,
      opacity: brand ? 1 : disabled ? 0.45 : pressed ? 0.65 : 1
    })}>

    <Ionicons name={icon} size={17} color={brand && disabled ? brand.disabled.foreground : bright ? D.onPrimary : D.teal} />

    <Text style={{ color: brand && disabled ? brand.disabled.foreground : bright ? D.onPrimary : D.text, fontSize: brand ? 14 : 13, fontWeight: "800", flexShrink: 1 }}>{label}</Text>

  </Pressable>;
}

export function LinkRow({ title, detail, icon, onPress, badge }: {
  title: string; detail?: string; icon: Icon; onPress: () => void; badge?: string;
}) {
  const { D, F, brand } = usePresentation();

  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({
      minHeight: 64, paddingVertical: 10, flexDirection: "row", alignItems: "center",
      gap: brand?.space.md ?? 11, borderBottomWidth: 1, borderColor: D.line, opacity: brand ? 1 : pressed ? 0.6 : 1, backgroundColor: brand && pressed ? brand.surface.secondary : undefined
    })}>

    <View style={{
      width: 37, height: 37, borderRadius: 12, backgroundColor: D.tint,
      alignItems: "center", justifyContent: "center"
    }}>
      <Ionicons name={icon} size={18} color={D.teal} />
    </View>

    <View style={{ flex: 1, gap: 2 }}>

      <Text style={{ color: D.text, fontSize: brand ? 16 : 14, fontWeight: "700" }}>{title}</Text>

      {!!detail && <Text style={{ color: D.muted, fontSize: 12, lineHeight: 17 }}>{detail}</Text>}

    </View>

    {!!badge && <Text style={{ color: D.lime, fontSize: 11, fontWeight: "800" }}>{badge}</Text>}

    <Ionicons name="chevron-forward" size={17} color={D.dim} />

  </Pressable>;
}

export function Metric({ label, value, detail, tone = "teal", series }: {
  label: string; value: string; detail?: string; tone?: "teal" | "lime" | "plain"; series?: "protein" | "carbohydrate" | "fat";
}) {
  const { D, F, brand } = usePresentation();

  const { fontScale } = useWindowDimensions();
  if (brand) return <View style={{
    flexGrow: 1, flexShrink: 1, flexBasis: (series ? 82 : 130) * fontScale, minWidth: 0, maxWidth: "100%",
    minHeight: series ? 100 : 124, padding: series ? 10 : brand.space.lg, gap: brand.space.sm,
    borderRadius: brand.radius.card, backgroundColor: series ? brand.surface.inset : brand.surface.primary,
    borderWidth: 1, borderColor: brand.border.subtle,
  }}>
    <Text style={{ color: series ? brand.data[series] : brand.text.secondary, ...brand.typography.caption }}>{label}</Text>
    <Text style={{ color: brand.text.primary, fontSize: series ? 24 : brand.typography.metric.fontSize,
      fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
    {!!detail && <Text style={{ color: brand.text.tertiary, ...brand.typography.caption }}>{detail}</Text>}
  </View>;

  return <View style={{
    flex: 1, minWidth: 130, minHeight: 119, padding: 15, borderRadius: 17,
    backgroundColor: tone === "teal" ? "#267967" : D.card, borderWidth: 1,
    borderColor: tone === "teal" ? "#388F7B" : D.line, justifyContent: "space-between", gap: 4
  }}>

    <Text style={{ color: tone === "teal" ? "#D7F6EC" : D.muted, fontSize: 12 }}>{label}</Text>

    <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}
      style={{
        color: tone === "teal" ? "#FFFFFF" : tone === "lime" ? D.lime : D.text,
        fontSize: 25, fontWeight: "800", fontVariant: ["tabular-nums"]
      }}>{value}</Text>

    {!!detail && <Text style={{ color: tone === "teal" ? "#D7F6EC" : D.dim, fontSize: 11 }}>{detail}</Text>}

  </View>;
}

export function SegmentedProgress({ ratio, label, compact = false }: { ratio: number | null; label: string; compact?: boolean; }) {
  const { D, F, brand } = usePresentation();

  const count = 24;
  const filled = ratio == null ? 0 : Math.round(Math.min(1, Math.max(0, ratio)) * count);
  return <View accessibilityLabel={label} style={{ gap: 8 }}>

    <View style={{ height: compact ? 20 : 39, flexDirection: "row", gap: compact ? 2 : 3, overflow: "hidden", borderRadius: 9 }}>

      {Array.from({ length: count }, (_, index) => <View key={index} style={{
        flex: 1,
        transform: [{ skewX: "-9deg" }], backgroundColor: index < filled ?
          brand ? brand.data.energy : index < count / 2 ? D.teal : D.lime : brand ? brand.data.track : D.raised
      }} />)}

    </View>

    <Text style={{ color: D.muted, fontSize: 11 }}>{label}</Text>

  </View>;
}

export function GlowPanel({ children }: { children: React.ReactNode; }) {
  const { D, F, brand } = usePresentation();

  if (brand) return <View style={{ borderRadius: brand.radius.hero, padding: brand.space.xl, gap: brand.space.lg,
    backgroundColor: brand.surface.primary, borderWidth: 1, borderColor: brand.border.subtle,
    borderTopWidth: 3, borderTopColor: brand.action.link }}>
    {children}
  </View>;

  return <LinearGradient colors={[D.tint, D.card, D.low]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={{ borderRadius: 23, padding: 19, gap: 15, overflow: "hidden" }}>
    {children}
  </LinearGradient>;
}

export function ArcProgress({ ratio, label, size, color }: { ratio: number | null; label: string; size?: number; color?: string }) {
  const { D, F, brand } = usePresentation();
  const { fontScale } = useWindowDimensions();
  const arcHeight = size ? size * 147 / 300 : 147;
  const expanded = !!size && fontScale > 1.3;

  const bars = 29;
  const filled = ratio == null ? 0 : Math.round(Math.min(1, Math.max(0, ratio)) * bars);
  return <View accessibilityLabel={label} style={{ width: size, height: expanded ? undefined : arcHeight, alignItems: "center", justifyContent: "center" }}>

    <Svg width="100%" height={arcHeight} viewBox="0 0 300 147" accessibilityLabel={label}>

      {Array.from({ length: bars }, (_, i) => {
        const angle = Math.PI + i / (bars - 1) * Math.PI;
        const x1 = 150 + Math.cos(angle) * 88;
        const y1 = 131 + Math.sin(angle) * 88;
        const x2 = 150 + Math.cos(angle) * 117;
        const y2 = 131 + Math.sin(angle) * 117;
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={9}
          strokeLinecap="round" stroke={i < filled ? color ?? (i < bars * 0.55 ? D.teal : D.lime) : D.raised} />;
      })}

    </Svg>

    <Text style={{ position: expanded ? "relative" : "absolute", top: expanded ? undefined : size ? arcHeight * 0.55 : 82, color: D.text, fontSize: size ? 25 : 31, fontWeight: "800" }}>
      {ratio == null ? "—" : `${Math.round(Math.max(0, ratio) * 100)}%`}
    </Text>

  </View>;
}

export function GoalTrack({ label, logged, target, unit, color, inline = false }: {
  label: string; logged: number | null | undefined; target: number | null | undefined; unit: string; color?: string; inline?: boolean;
}) {
  const { D, F, brand } = usePresentation();
  const { width, fontScale } = useWindowDimensions();
  const row = inline && width >= 380 && fontScale <= 1.1;

  const valid = logged != null && target != null && target > 0;
  const fraction = valid ? Math.min(1, Math.max(0, logged / target)) : 0;
  const bar = <View style={{ height: 8, flex: row ? 1 : undefined, borderRadius: 5, backgroundColor: D.raised, overflow: "hidden" }}>
    {valid && <View style={{ width: `${fraction * 100}%`, height: 8, borderRadius: 5,
      backgroundColor: color ?? (fraction >= 1 ? D.lime : D.teal) }} />}
  </View>;
  return <View style={{ gap: 7, paddingVertical: 6 }} accessibilityLabel={`${label}: ${fmt(logged, unit)} logged, ${fmt(target, unit)} target`}>

    <View style={{ flexDirection: "row", flexWrap: inline && !row ? "wrap" : "nowrap", alignItems: inline ? "center" : undefined, justifyContent: "space-between", gap: 8 }}>

      <Text style={{ width: row ? 54 : undefined, color: D.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
      {row && bar}

      <Text style={{ color: D.muted, fontSize: 12, flexShrink: inline ? 1 : undefined }}>{fmt(logged, unit)} / {fmt(target, unit)}</Text>

    </View>

    {!row && bar}

  </View>;
}

export function fmt(value: number | null | undefined, suffix = "") {
  return value == null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString() + suffix;
}
