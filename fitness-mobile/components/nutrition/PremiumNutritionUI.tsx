import React from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHomeVisuals, Card, Action, Page as HomePage } from "@/components/home/PremiumHomeUI";
import type { Icon } from "@/components/designPreview/UI";

export { Card, Action } from "@/components/home/PremiumHomeUI";

export function Page(props: React.ComponentProps<typeof HomePage>) {
  const { fontScale } = useWindowDimensions();
  const { t, p } = useHomeVisuals();
  if (fontScale <= 1.3) return <HomePage {...props} />;
  // Give the title the full width at large text; the calendar must not squeeze it.
  return <ScrollView style={{ flex: 1, backgroundColor: p.canvas }} showsVerticalScrollIndicator={false}
    contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, color: t.action.link, fontSize: 11, letterSpacing: 2, fontWeight: "800" }}>{props.eyebrow.toUpperCase()}</Text>
        {props.headerAction}
      </View>
      <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 32, fontWeight: "800", letterSpacing: -1.1 }}>{props.title}</Text>
      <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>{props.subtitle}</Text>
    </View>
    {props.children}
  </ScrollView>;
}

export function useNutritionVisuals() {
  const { t, p } = useHomeVisuals();
  return { t, p, series: { energy: t.action.link, protein: t.action.link, carbs: t.status.info, fat: t.status.warning } };
}

export function Heading({ title, caption, icon }: { title: string; caption?: string; icon: Icon }) {
  const { t } = useNutritionVisuals();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
    <Ionicons name={icon} size={24} color={t.action.link} />
    <View style={{ flex: 1, gap: 2 }}>
      <Text accessibilityRole="header" style={{ color: t.text.primary, fontWeight: "800", fontSize: 18 }}>{title}</Text>
      {!!caption && <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 17 }}>{caption}</Text>}
    </View>
  </View>;
}

export function CalendarButton({ onPress }: { onPress: () => void }) {
  const { t, p } = useNutritionVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel="Open full calendar" onPress={onPress}
    style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 18, overflow: "hidden", borderWidth: 1,
      borderColor: pressed ? t.focus.ring : p.warmEdge })}>
    <LinearGradient colors={p.lighting} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="calendar-outline" size={24} color={t.action.link} />
    </LinearGradient>
  </Pressable>;
}

export function MacroTile({ label, value, series: key, icon }: {
  label: string; value: string; series: "protein" | "carbs" | "fat"; icon: Icon;
}) {
  const { t, p, series } = useNutritionVisuals();
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 95 * fontScale, maxWidth: "100%", borderRadius: 15,
    overflow: "hidden", backgroundColor: p.surface, borderWidth: 1, borderColor: series[key] + "77" }}>
    <LinearGradient colors={[series[key] + (t.mode === "dark" ? "22" : "12"), p.surface]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 10, gap: 6 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} color={series[key]} size={22} />
        <Text style={{ color: series[key], fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </View>
      <Text style={{ color: t.text.primary, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </LinearGradient>
    {/* A full-width series key, not a progress indicator. */}
    <LinearGradient colors={[series[key], series[key] + "66"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={{ height: 5 }} accessible={false} />
  </View>;
}

export function Grid({ children, four = false }: { children: React.ReactNode; four?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const count = fontScale > 1.3 || width < 350 ? 1 : four && width >= 420 && fontScale <= 1 ? 4 : 2;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {React.Children.toArray(children).map((child, i) => <View key={i}
      style={{ width: count === 4 ? "23%" : count === 2 ? "48.5%" : "100%" }}>{child}</View>)}
  </View>;
}

const mealIcons: Record<string, Icon> = { breakfast: "sunny-outline", lunch: "partly-sunny-outline", dinner: "moon-outline", snacks: "nutrition-outline" };
export function MealCard({ meal, status, onAdd, children }: {
  meal: string; status?: string; onAdd: () => void; children?: React.ReactNode;
}) {
  const { t } = useNutritionVisuals();
  const { fontScale } = useWindowDimensions();
  return <Card>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Ionicons name={mealIcons[meal]} size={23} color={t.action.link} />
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 100 * fontScale, gap: 3 }}>
        <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 16, fontWeight: "700", textTransform: "capitalize" }}>{meal}</Text>
        {!!status && <Text style={{ color: t.text.secondary, fontSize: 12 }}>{status}</Text>}
      </View>
      <Action label="Add" icon="add" onPress={onAdd} />
    </View>
    {children}
  </Card>;
}

export function Tool({ title, detail, icon, onPress }: { title: string; detail?: string; icon: Icon; onPress: () => void }) {
  const { t, p } = useNutritionVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 64, padding: 12, borderRadius: 15, borderWidth: 1,
      borderColor: pressed ? t.focus.ring : p.edge, backgroundColor: pressed ? t.surface.secondary : p.surface,
      flexDirection: "row", alignItems: "center", gap: 8 })}>
    <Ionicons name={icon} size={23} color={t.action.link} />
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>{title}</Text>
      {!!detail && <Text style={{ color: t.text.secondary, fontSize: 11, lineHeight: 16 }}>{detail}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={16} color={t.text.secondary} />
  </Pressable>;
}
