import { D } from "@/components/designPreview/UI";
import { F } from "@/components/homeFlows/FlowUI";
import { useSomataTheme } from "@/components/somata/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export { D, F };
type Icon = keyof typeof Ionicons.glyphMap;
export function TaskPage({ title, section, subtitle, onBack, children, footer, action, scroll = true }: {
  title: string; section: string; subtitle?: string; onBack: () => void; children: React.ReactNode; footer?: React.ReactNode; action?: React.ReactNode; scroll?: boolean;
}) {
  const { D, F } = useSomataTheme();

  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: D.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

    <View style={{ ...F.row, paddingHorizontal: 19, paddingVertical: 8 }}>

      <IconButton icon="arrow-back" label="Back" onPress={onBack} />

      <Text style={{ ...F.eyebrow, flex: 1 }}>{section.toUpperCase()}</Text>
      {action}

    </View>

    <Body {...(scroll ? { keyboardShouldPersistTaps: "handled" as const, showsVerticalScrollIndicator: false, contentContainerStyle: { padding: 20, paddingBottom: footer ? 22 : insets.bottom + 32, gap: 22 } } : { style: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 14 } })}>

      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={F.title}>{title}</Text>

        {!!subtitle && <Text style={F.body}>{subtitle}</Text>}
      </View>
      {children}

    </Body>

    {!!footer && <View style={{
      padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 10,
      backgroundColor: D.bg, borderTopWidth: 1, borderTopColor: D.line
    }}>
      {footer}
    </View>}

  </KeyboardAvoidingView>;
}
export function IconButton({ icon, label, onPress, disabled = false }: { icon: Icon; label: string; onPress: () => void; disabled?: boolean; }) {
  const { D, F } = useSomataTheme();

  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} style={({ pressed }) => ({
      width: 48, height: 48, borderRadius: 24,
      alignItems: "center", justifyContent: "center", backgroundColor: D.card, opacity: disabled ? 0.4 : pressed ? 0.65 : 1
    })}>

    <Ionicons name={icon} color={D.teal} size={22} />
  </Pressable>;
}
export function Button({ label, onPress, icon, primary = false, danger = false, disabled = false }: {
  label: string; onPress: () => void; icon?: Icon; primary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  const { D, F } = useSomataTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    style={({ pressed }) => ({
      minHeight: 50, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16,
      flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9,
      backgroundColor: primary ? D.primary : D.raised, opacity: disabled ? 0.4 : pressed ? 0.7 : 1
    })}>

    {!!icon && <Ionicons name={icon} color={primary ? D.onPrimary : danger ? D.danger : D.teal} size={20} />}

    <Text style={{ color: primary ? D.onPrimary : danger ? D.danger : D.text, fontSize: 15, fontWeight: "700", flexShrink: 1 }}>{label}</Text>

  </Pressable>;
}
export function Panel({ children, accent = false }: { children: React.ReactNode; accent?: boolean; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ padding: 18, gap: 16, borderRadius: 22, backgroundColor: accent ? D.tint : D.card }}>
    {children}
  </View>;
}
export function Heading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ ...F.row, alignItems: "flex-start" }}>
    <View style={{ flex: 1, gap: 5 }}>

      <Text accessibilityRole="header" style={F.heading}>{title}</Text>
      {!!detail && <Text style={F.caption}>{detail}</Text>}
    </View>
    {action}
  </View>;
}
export const Field = React.forwardRef<TextInput, TextInputProps & { label: string; }>(function Field({ label, style, ...props }, ref) {
  const { D, F } = useSomataTheme();

  return <View style={{ gap: 7, minWidth: 90, flexGrow: 1 }}>
    <Text style={F.caption}>{label}</Text>

    <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={D.muted} selectionColor={D.teal} {...props}
      style={[{
        minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: D.raised,
        color: D.text, fontSize: 16, borderWidth: 1, borderColor: D.line
      }, style]} />
  </View>;
});
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void; }) {
  const { D, F } = useSomataTheme();

  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
    style={({ pressed }) => ({
      minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
      justifyContent: "center", backgroundColor: selected ? D.primary : D.raised, opacity: pressed ? 0.7 : 1
    })}>

    <Text style={{ color: selected ? D.onPrimary : D.text, fontSize: 14, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
}
export function Item({ title, detail, value, icon, onPress, action }: { title: string; detail?: string; value?: string; icon?: Icon; onPress?: () => void; action?: React.ReactNode; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ ...F.row, borderBottomWidth: 1, borderBottomColor: D.line, paddingVertical: 15 }}>

    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 13, opacity: pressed ? 0.65 : 1 })}>

      {!!icon && <Ionicons name={icon} size={23} color={D.teal} />}
      <View style={{ flex: 1, gap: 5 }}>

        <Text style={{ ...F.heading, fontSize: 16 }}>{title}</Text>
        {!!detail && <Text style={F.caption}>{detail}</Text>}

        {!!value && <Text style={{ ...F.body, color: D.lime }}>{value}</Text>}
      </View>

      {!!onPress && <Ionicons name="arrow-forward" color={D.muted} size={18} />}
    </Pressable>
    {action}
  </View>;
}
export function Empty({ title, detail }: { title: string; detail?: string; }) {
  const { D, F } = useSomataTheme();

  return <Panel>
    <Ionicons name="ellipse-outline" color={D.teal} size={28} />
    <Heading title={title} detail={detail} />
  </Panel>;
}
export function Metric({ label, value, detail }: { label: string; value: string; detail?: string; }) {
  const { D, F } = useSomataTheme();

  return <View style={{ flex: 1, minWidth: 125, backgroundColor: D.card, borderRadius: 18, padding: 17, gap: 6 }}>

    <Text style={F.caption}>{label}</Text>
    <Text style={{ ...F.value, color: D.lime }}>{value}</Text>
    {!!detail && <Text style={F.caption}>{detail}</Text>}
  </View>;
}
export function TaskSheet({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: React.ReactNode; }) {
  const { D, F } = useSomataTheme();

  const reduceMotion = useReducedMotion(); const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent onRequestClose={onClose} animationType={reduceMotion ? "none" : "slide"}>

    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#000000B3" }}>

      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={{ position: "absolute", inset: 0 }} />

      <View accessibilityViewIsModal style={{ maxHeight: "92%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: D.bg, paddingTop: 16 }}>

        <View style={{ ...F.row, paddingHorizontal: 20 }}>
          <Text accessibilityRole="header" style={{ ...F.heading, flex: 1 }}>{title}</Text>
          <IconButton label="Close" icon="close" onPress={onClose} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28, gap: 20 }}>
          {children}
        </ScrollView>

      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function Toggle({ title, detail, value, onChange, disabled = false }: { title: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; }) {
  const { D, F } = useSomataTheme();
  return <View style={{ ...F.row, paddingVertical: 12, gap: 16, opacity: disabled ? 0.5 : 1 }}>
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ ...F.heading, fontSize: 16 }}>{title}</Text>
      {detail && <Text style={F.caption}>{detail}</Text>}
    </View>
    <Switch accessibilityLabel={title} disabled={disabled} value={value} onValueChange={onChange} trackColor={{ false: D.raised, true: D.teal }} thumbColor={value ? D.ink : D.text} />
  </View>;
}
