import React from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePresentation } from "@/components/designPreview/Appearance";
import { premiumHomeTheme } from "./premiumTheme";
import type { Icon } from "@/components/designPreview/UI";

export function useHomeVisuals() {
  const { semantic: t } = usePresentation();
  return { t, p: premiumHomeTheme(t) };
}

export function Page({ eyebrow, title, subtitle, headerAction, children }: {
  eyebrow: string; title: string; subtitle: string; headerAction: React.ReactNode; children: React.ReactNode;
}) {
  const { t, p } = useHomeVisuals();
  return <ScrollView style={{ flex: 1, backgroundColor: p.canvas }} showsVerticalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 5, paddingBottom: 6 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.action.link, fontSize: 11, letterSpacing: 2, fontWeight: "800" }}>{eyebrow.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 32, fontWeight: "800", letterSpacing: -1.1 }}>{title}</Text>
        <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>{subtitle}</Text>
      </View>
      {headerAction}
    </View>
    {children}
  </ScrollView>;
}

export function Bell({ onPress }: { onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel="Open alerts" onPress={onPress}
    style={({ pressed }) => ({ width: 50, height: 50, borderRadius: 25, overflow: "hidden", borderWidth: 1,
      borderColor: pressed ? t.focus.ring : p.warmEdge, backgroundColor: p.surface })}>
    <LinearGradient colors={p.lighting} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="notifications-outline" size={26} color={t.action.link} />
    </LinearGradient>
  </Pressable>;
}

export function Card({ children, accent = false, hero = false, style }: {
  children: React.ReactNode; accent?: boolean; hero?: boolean; style?: ViewStyle;
}) {
  const { t, p } = useHomeVisuals();
  return <View style={{ borderRadius: 18, borderWidth: accent ? 1.5 : 1,
    borderColor: accent ? t.action.link : hero ? p.warmEdge : p.edge, backgroundColor: p.surface,
    shadowColor: accent ? t.brand.orange : p.shadow, shadowOpacity: accent ? 0.12 : 0.1,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: accent ? 12 : 8, elevation: 2, ...style }}>
    <View style={{ borderRadius: 17, overflow: "hidden" }}>
      <LinearGradient colors={accent ? p.recommendation : hero ? p.heroLighting : p.lighting}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={{ padding: 14, gap: 10 }}>
        {hero && <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", right: 0, top: 0, width: "58%", maxWidth: 260, height: 175, opacity: t.mode === "dark" ? 0.22 : 0.1 }}>
          <Image source={require("../../assets/branding/somata/symbol-color.png")} resizeMode="contain" accessible={false}
            style={{ width: "100%", height: "100%" }} />
        </View>}
        {children}
      </LinearGradient>
    </View>
  </View>;
}

export function Section({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode }) {
  const { t } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  return <View style={{ gap: 2 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <Text accessibilityRole="header" style={{ flexGrow: 1, flexShrink: 1, flexBasis: 165 * fontScale,
        color: t.text.primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }}>{title}</Text>
      {action}
    </View>
    {!!caption && <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{caption}</Text>}
  </View>;
}

export function Action({ label, icon, onPress, bright = false, disabled = false }: {
  label: string; icon: Icon; onPress: () => void; bright?: boolean; disabled?: boolean;
}) {
  const { t, p } = useHomeVisuals();
  return <View style={{ borderRadius: 13, shadowColor: p.shadow,
    shadowOpacity: bright && !disabled ? 0.16 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 13, overflow: "hidden", borderWidth: 1,
      borderColor: disabled ? t.disabled.border : pressed ? t.focus.ring : bright ? t.brand.coral : p.edge,
      backgroundColor: disabled ? t.disabled.background : p.surface })}>
    {({ pressed }) => <LinearGradient colors={disabled ? [t.disabled.background, t.disabled.background] : pressed ? [t.action.secondary.pressed, t.action.secondary.pressed] : bright ? p.cta : p.lighting}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
      style={{ flexGrow: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 9, paddingVertical: 10, gap: 8 }}>
      <Ionicons name={icon} size={22} color={disabled ? t.disabled.foreground : bright && !pressed ? t.text.onBrand : t.action.link} />
      <Text style={{ flexShrink: 1, color: disabled ? t.disabled.foreground : bright && !pressed ? t.text.onBrand : t.text.primary,
        fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </LinearGradient>}
  </Pressable></View>;
}

/** Responsive presentation only. Children and their handlers retain original order. */
export function ActionGrid({ children, explore = false }: { children: React.ReactNode; explore?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.35 || width < 350 ? 1 : explore || width < 420 ? 2 : 3;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {React.Children.toArray(children).map((child, index) => <View key={index}
      style={{ width: columns === 3 ? "31.8%" : columns === 2 ? "48.6%" : "100%", flexGrow: 0, flexShrink: 1 }}>{child}</View>)}
  </View>;
}

export function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: Icon }) {
  const { t, p } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 150 * fontScale, maxWidth: "100%" }}>
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
        <View style={{ width: 35, height: 38, borderRadius: 11, borderWidth: 1, borderColor: p.warmEdge,
          backgroundColor: t.surface.inset, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} color={t.action.link} size={24} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: t.text.secondary, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: t.text.primary, fontSize: 25, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
          <Text style={{ color: t.text.secondary, fontSize: 11, lineHeight: 16 }}>{detail}</Text>
        </View>
      </View>
    </Card>
  </View>;
}

export function Macro({ label, value, series, icon }: { label: string; value: string; series: "protein" | "carbohydrate" | "fat"; icon: Icon }) {
  const { t, p } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  return <LinearGradient colors={[p.macroWash[series], p.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={{ flexGrow: 1, flexShrink: 1, flexBasis: 88 * fontScale, borderRadius: 14, borderWidth: 1,
      borderColor: p.macro[series] + "55", padding: 10, gap: 5 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      <Ionicons name={icon} size={21} color={p.macro[series]} />
      <Text style={{ color: t.text.secondary, fontSize: 11 }}>{label}</Text>
    </View>
    <Text style={{ color: t.text.primary, fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
  </LinearGradient>;
}

export function Recommendation({ title, detail, label, onPress }: { title: string; detail: string; label: string; onPress: () => void }) {
  const { t } = useHomeVisuals();
  const { width, fontScale } = useWindowDimensions();
  const inline = width >= 420 && fontScale <= 1.1;
  return <Card accent>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name="restaurant-outline" size={30} color={t.action.link} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: t.action.link, fontSize: 10, fontWeight: "800", letterSpacing: 1.7 }}>A USEFUL NEXT STEP</Text>
        <Text style={{ color: t.text.primary, fontSize: 17, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{detail}</Text>
      </View>
      {inline && <View style={{ maxWidth: "34%" }}><Action label={label} icon="arrow-forward" bright onPress={onPress} /></View>}
    </View>
    {!inline && <Action label={label} icon="arrow-forward" bright onPress={onPress} />}
  </Card>;
}

export function LinkRow({ title, icon, onPress }: { title: string; icon: Icon; onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: pressed ? t.focus.ring : p.edge,
      backgroundColor: pressed ? t.surface.secondary : p.surface, paddingHorizontal: 10, paddingVertical: 10,
      flexDirection: "row", alignItems: "center", gap: 7 })}>
    <Ionicons name={icon} size={23} color={t.action.link} />
    <Text style={{ flex: 1, color: t.text.primary, fontSize: 12, fontWeight: "600" }}>{title}</Text>
    <Ionicons name="chevron-forward" size={15} color={t.text.secondary} />
  </Pressable>;
}
