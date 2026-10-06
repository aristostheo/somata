import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";
import { visualTokens, type VisualTokens } from "./visualTokens";

export type ScreenPalette = VisualTokens & { danger: string };

export function useScreenPalette(): ScreenPalette {
  const { isDark, themeAccents } = useTheme();
  const primary = (isDark ? themeAccents.dark.primary : themeAccents.light.primary) ?? (isDark ? "#A9C4FF" : "#315B9A");
  const accent = (isDark ? themeAccents.dark.accent : themeAccents.light.accent) ?? (isDark ? "#79D7BF" : "#17786C");
  return { ...visualTokens(isDark, primary, accent), danger: isDark ? "#FFB5B6" : "#A9334C" };
}

export function Screen({ title, intro, onBack, children, palette }: { title: string; intro?: string; onBack: () => void; children: React.ReactNode; palette: ScreenPalette }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.canvas }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 + insets.bottom, gap: 28 }}>
      <LinearGradient colors={[palette.heroStart, palette.heroMiddle, palette.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 22, minHeight: 178, overflow: "hidden" }}>
        <View pointerEvents="none" style={{ position: "absolute", width: 178, height: 178, borderRadius: 89, right: -46, top: -67, backgroundColor: withAlpha(palette.primary, 0.2) }} />
        <View pointerEvents="none" style={{ position: "absolute", width: 118, height: 118, borderRadius: 59, right: 38, bottom: -77, backgroundColor: withAlpha(palette.accent, 0.17) }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => ({ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12, opacity: pressed ? 0.65 : 1 })}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
          <Text accessibilityRole="header" style={{ color: "#FFFFFF", fontSize: 33, fontWeight: "700", letterSpacing: -1.1, flex: 1 }}>{title}</Text>
          <View style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: withAlpha(palette.gold, 0.22), alignItems: "center", justifyContent: "center" }}><Ionicons name="sparkles-outline" size={18} color={palette.gold} /></View>
        </View>
        {!!intro && <Text style={{ color: "#E7E9FA", fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 290 }}>{intro}</Text>}
        <View style={{ width: 52, height: 3, borderRadius: 2, backgroundColor: palette.gold, marginTop: 17 }} />
      </LinearGradient>
      {children}
    </ScrollView>
  );
}

export function Section({ title, children, palette }: { title: string; children: React.ReactNode; palette: ScreenPalette }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingLeft: 2 }}>
        <View style={{ width: 4, height: 16, borderRadius: 3, backgroundColor: palette.coral }} />
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 13, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>{title}</Text>
      </View>
      <View style={{ backgroundColor: palette.card, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.border, shadowColor: palette.heroStart, shadowOpacity: palette.dark ? 0 : 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: palette.dark ? 0 : 2 }}>
        {children}
      </View>
    </View>
  );
}

export function Row({ title, detail, icon, value, onPress, palette, last = false, danger = false }: { title: string; detail?: string; icon: keyof typeof Ionicons.glyphMap; value?: string; onPress?: () => void; palette: ScreenPalette; last?: boolean; danger?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={[title, value, detail].filter(Boolean).join(", ")} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ minHeight: 68, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.64 : 1 })}>
      <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: danger ? withAlpha(palette.danger, 0.13) : palette.primaryTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={19} color={danger ? palette.danger : palette.primary} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: danger ? palette.danger : palette.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        {!!detail && <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 18 }}>{detail}</Text>}
      </View>
      {!!value && <View style={{ backgroundColor: palette.raised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, maxWidth: "35%" }}><Text style={{ color: palette.text, fontSize: 12, fontWeight: "600", textAlign: "right" }}>{value}</Text></View>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={palette.secondary} />}
    </Pressable>
  );
}

export function ToggleRow({ title, detail, icon, value, onChange, palette, last = false, disabled = false }: { title: string; detail?: string; icon: keyof typeof Ionicons.glyphMap; value: boolean; onChange: (value: boolean) => void; palette: ScreenPalette; last?: boolean; disabled?: boolean }) {
  return (
    <View style={{ minHeight: 68, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border, flexDirection: "row", alignItems: "center", gap: 12, opacity: disabled ? 0.48 : 1 }}>
      <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: palette.accentTint, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={19} color={palette.accent} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        {!!detail && <Text style={{ color: palette.secondary, fontSize: 13, lineHeight: 18 }}>{detail}</Text>}
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: palette.accent, false: palette.border }} />
    </View>
  );
}
