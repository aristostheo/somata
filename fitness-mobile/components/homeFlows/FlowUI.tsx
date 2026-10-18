import { D } from "@/components/designPreview/UI";
import { useSomataTheme } from "@/components/somata/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export { D };
export const F = StyleSheet.create({
  eyebrow: { color: D.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: D.text, fontSize: 34, fontWeight: "800", letterSpacing: -1.2 },
  heading: { color: D.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  body: { color: D.muted, fontSize: 14, lineHeight: 21 },
  caption: { color: D.muted, fontSize: 12, lineHeight: 18 },
  value: { color: D.text, fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  panel: { backgroundColor: D.card, borderRadius: 22, padding: 19, gap: 15 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});

/** New Home subpage chrome. Back pops the existing stack; route names stay unchanged. */
export function FlowPage({ title, eyebrow, children, action, onBack }: {
  title: string; eyebrow: string; children: React.ReactNode; action?: React.ReactNode; onBack: () => void;
}) {
  const { D, F } = useSomataTheme();

  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: D.bg }}>

    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, ...F.row }}>

      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack}
        style={({ pressed }) => ({
          width: 48, height: 48, borderRadius: 24, backgroundColor: D.card,
          alignItems: "center", justifyContent: "center", opacity: pressed ? 0.65 : 1
        })}>

        <Ionicons name="arrow-back" color={D.text} size={22} />

      </Pressable>

      <Text style={F.eyebrow}>SOMATA</Text>

      {action || <View style={{ width: 48 }} />}

    </View>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{
      paddingHorizontal: 20, paddingTop: 13, paddingBottom: insets.bottom + 35, gap: 24,
    }}>

      <View style={{ gap: 6 }}>

        <Text style={F.eyebrow}>{eyebrow.toUpperCase()}</Text>

        <Text accessibilityRole="header" style={F.title}>{title}</Text>

      </View>

      {children}

    </ScrollView>

  </View>;
}

export function ChoiceRail<T extends string | number>({ choices, value, onChange, label }: {
  choices: Array<{ value: T; label: string; }>; value: T; onChange: (next: T) => void; label: string;
}) {
  const { D, F } = useSomataTheme();

  return <View accessibilityLabel={label} style={{
    ...F.wrap, padding: 5,
    backgroundColor: D.card, borderRadius: 18, gap: 4
  }}>

    {choices.map((option) => <Pressable key={option.value} accessibilityRole="button"
      accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)}
      style={({ pressed }) => ({
        flexGrow: 1, flexBasis: 75, paddingHorizontal: 12,
        minHeight: 47, paddingVertical: 10, borderRadius: 13, alignItems: "center", justifyContent: "center",
        backgroundColor: value === option.value ? D.lime : "transparent", opacity: pressed ? 0.7 : 1
      })}>

      <Text style={{
        color: value === option.value ? D.ink : D.muted, fontSize: 13,
        fontWeight: "800", textAlign: "center"
      }}>{option.label}</Text>

    </Pressable>)}

  </View>;
}

export function FlowNotice({ title, detail, error = false }: { title: string; detail?: string; error?: boolean; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ ...F.panel, borderWidth: 1, borderColor: D.line }} accessibilityRole={error ? "alert" : undefined}>

    <Ionicons name={error ? "alert-circle-outline" : "ellipse-outline"} size={24} color={error ? D.amber : D.teal} />

    <Text style={{ ...F.heading, fontSize: 17 }}>{title}</Text>

    {!!detail && <Text style={F.body}>{detail}</Text>}

  </View>;
}

export function SmallStat({ label, value, detail }: { label: string; value: string; detail?: string; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ flex: 1, minWidth: 125, gap: 5, padding: 16, borderRadius: 17, backgroundColor: D.card }}>

    <Text style={F.caption}>{label}</Text>

    <Text style={{ ...F.value, fontSize: 24, color: D.lime }}>{value}</Text>

    {!!detail && <Text style={F.caption}>{detail}</Text>}

  </View>;
}
