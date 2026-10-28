import { D } from "@/components/designPreview/UI";
import { F } from "@/components/homeFlows/FlowUI";
import { useTaskPresentation } from "@/components/designPreview/Appearance";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export { D, F };
type Icon = keyof typeof Ionicons.glyphMap;
export function TaskPage({ title, section, subtitle, onBack, children, footer, action, scroll = true }: {
  title: string; section: string; subtitle?: string; onBack: () => void; children: React.ReactNode; footer?: React.ReactNode; action?: React.ReactNode; scroll?: boolean;
}) {
  const { D, F, premium, t, p } = useTaskPresentation();

  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  if (premium) return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: D.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={{ ...F.row, paddingHorizontal: 16, paddingVertical: 8 }}>
      <IconButton icon="arrow-back" label="Back" onPress={onBack} />
      <Text style={{ ...F.eyebrow, flex: 1, textAlign: "right" }}>{section.toUpperCase()}</Text>
    </View>
    <Body {...(scroll ? { keyboardShouldPersistTaps: "handled" as const, showsVerticalScrollIndicator: false,
      contentContainerStyle: { padding: 16, paddingBottom: footer ? 22 : insets.bottom + 32, gap: 20 } }
      : { style: { flex: 1, paddingHorizontal: 16, gap: 20 } })}>
      <View style={{ gap: 8 }}>
        <View style={{ ...F.row, flexWrap: "wrap" }}>
          <Text accessibilityRole="header" style={{ ...F.title, flexGrow: 1, flexShrink: 1 }}>{title}</Text>
          {action}
        </View>
        {!!subtitle && <Text style={F.body}>{subtitle}</Text>}
      </View>
      {children}
    </Body>
    {!!footer && <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 10,
      borderTopWidth: 1, borderColor: D.line, backgroundColor: D.bg }}>{footer}</View>}
  </KeyboardAvoidingView>;
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
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 16,
      borderWidth: 1, borderColor: pressed ? t.focus.ring : p.edge, backgroundColor: disabled ? t.disabled.background : p.surface,
      alignItems: "center", justifyContent: "center" })}>
    <Ionicons name={icon} size={22} color={disabled ? t.disabled.foreground : t.action.link} />
  </Pressable>;
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
  const { D, F, premium, t, p } = useTaskPresentation();
  if (premium) return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} style={({ pressed }) => ({ minHeight: 50, maxWidth: "100%", minWidth: 0, borderRadius: 14, overflow: "hidden",
      borderWidth: 1, borderColor: disabled ? t.disabled.border : pressed ? t.focus.ring : primary ? p.warmEdge : p.edge })}>
    {({ pressed }) => <LinearGradient colors={disabled ? [t.disabled.background, t.disabled.background] : primary && !danger
      ? [...p.cta] : pressed ? [t.surface.secondary, t.surface.inset] : [...p.lighting]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }}>
      {!!icon && <Ionicons name={icon} size={21} color={disabled ? t.disabled.foreground : danger ? t.status.error : primary ? t.text.onBrand : t.action.link} />}
      <Text style={{ color: disabled ? t.disabled.foreground : danger ? t.status.error : primary ? t.text.onBrand : t.text.primary,
        fontSize: 15, fontWeight: "700", flexShrink: 1, textAlign: "center" }}>{label}</Text>
    </LinearGradient>}
  </Pressable>;
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
export function Panel({ children, accent = false, compact = false }: { children: React.ReactNode; accent?: boolean; compact?: boolean; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <View style={{ borderRadius: 20, borderWidth: 1, borderColor: accent ? p.warmEdge : p.edge,
    backgroundColor: p.surface, shadowColor: p.shadow, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
    <LinearGradient colors={accent ? [...p.heroLighting] : [...p.lighting]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ padding: compact ? 8 : 16, gap: 16, borderRadius: 19, overflow: "hidden" }}>{children}</LinearGradient>
  </View>;
  return <View style={{ padding: 18, gap: 16, borderRadius: 22, backgroundColor: accent ? D.tint : D.card }}>
    {children}
  </View>;
}
export function Heading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  return <View style={{ ...F.row, alignItems: "flex-start" }}>
    <View style={{ flex: 1, gap: 5 }}>

      <Text accessibilityRole="header" style={F.heading}>{title}</Text>
      {!!detail && <Text style={F.caption}>{detail}</Text>}
    </View>
    {action}
  </View>;
}
export const Field = React.forwardRef<TextInput, TextInputProps & { label: string; }>(function Field({ label, style, ...props }, ref) {
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <PremiumField ref={ref} label={label} style={style} {...props} />;
  return <View style={{ gap: 7, minWidth: 90, flexGrow: 1 }}>
    <Text style={F.caption}>{label}</Text>

    <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={D.muted} selectionColor={D.teal} {...props}
      style={[{
        minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: D.raised,
        color: D.text, fontSize: 16, borderWidth: 1, borderColor: D.line
      }, style]} />
  </View>;
});
const PremiumField = React.forwardRef<TextInput, TextInputProps & { label: string }>(function PremiumField({ label, style, onFocus, onBlur, ...props }, ref) {
  const { t, F } = useTaskPresentation();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8, minWidth: 90, flexGrow: 1 }}>
    <Text style={{ ...F.caption, fontWeight: "700" }}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={t.text.tertiary} selectionColor={t.focus.ring} {...props}
      onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
        backgroundColor: props.editable === false ? t.disabled.background : t.surface.inset,
        color: t.text.primary, fontSize: 18, borderWidth: focused ? 2 : 1, borderColor: focused ? t.focus.ring : t.border.control }, style]} />
  </View>;
});
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
    style={({ pressed }) => ({ minHeight: 48, maxWidth: "100%", minWidth: 0, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 13,
      borderWidth: 1, borderColor: selected || pressed ? t.selection.border : p.edge, justifyContent: "center",
      backgroundColor: selected ? t.selection.background : t.surface.inset })}>
    <Text style={{ color: selected ? t.selection.foreground : t.text.secondary, fontSize: 14, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
    style={({ pressed }) => ({
      minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
      justifyContent: "center", backgroundColor: selected ? D.primary : D.raised, opacity: pressed ? 0.7 : 1
    })}>

    <Text style={{ color: selected ? D.onPrimary : D.text, fontSize: 14, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
}
export function Item({ title, detail, value, icon, onPress, action }: { title: string; detail?: string; value?: string; icon?: Icon; onPress?: () => void; action?: React.ReactNode; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <View style={{ ...F.row, borderBottomWidth: 1, borderBottomColor: D.line, paddingVertical: 8 }}>
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
      {!!icon && <View style={{ padding: 10, borderRadius: 12, backgroundColor: t.selection.background }}><Ionicons name={icon} size={22} color={t.action.link} /></View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ ...F.heading, fontSize: 16 }}>{title}</Text>
        {!!detail && <Text style={F.caption}>{detail}</Text>}
        {!!value && <Text style={{ ...F.body, fontWeight: "700", color: t.action.link }}>{value}</Text>}
      </View>
      {!!onPress && <Ionicons name="chevron-forward" color={D.muted} size={18} />}
    </Pressable>{action}
  </View>;
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
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <Panel>
    <View style={{ alignSelf: "flex-start", padding: 12, borderRadius: 14, backgroundColor: t.selection.background }}>
      <Ionicons name="albums-outline" size={26} color={t.action.link} />
    </View><Heading title={title} detail={detail} />
  </Panel>;
  return <Panel>
    <Ionicons name="ellipse-outline" color={D.teal} size={28} />
    <Heading title={title} detail={detail} />
  </Panel>;
}
export function Metric({ label, value, detail }: { label: string; value: string; detail?: string; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  if (premium) return <View style={{ flexGrow: 1, flexBasis: 125, minWidth: 110, gap: 6, padding: 14,
    borderRadius: 15, backgroundColor: t.surface.inset, borderWidth: 1, borderColor: p.edge }}>
    <Text style={F.caption}>{label}</Text>
    <Text style={{ ...F.value, fontSize: 25 }}>{value}</Text>
    {!!detail && <Text style={F.caption}>{detail}</Text>}
  </View>;
  return <View style={{ flex: 1, minWidth: 125, backgroundColor: D.card, borderRadius: 18, padding: 17, gap: 6 }}>

    <Text style={F.caption}>{label}</Text>
    <Text style={{ ...F.value, color: D.lime }}>{value}</Text>
    {!!detail && <Text style={F.caption}>{detail}</Text>}
  </View>;
}
export function TaskSheet({ title, visible, onClose, children, dismissOnBackdrop = true }: { title: string; visible: boolean; onClose: () => void; children: React.ReactNode; dismissOnBackdrop?: boolean; }) {
  const { D, F, premium, t, p } = useTaskPresentation();

  const reduceMotion = useReducedMotion(); const insets = useSafeAreaInsets();
  if (premium) return <Modal visible={visible} transparent onRequestClose={onClose} animationType={reduceMotion ? "none" : "slide"}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, justifyContent: "flex-end", backgroundColor: t.surface.scrim }}>
      {dismissOnBackdrop && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={{ position: "absolute", inset: 0 }} />}
      <View accessibilityViewIsModal style={{ maxHeight: "92%", backgroundColor: t.surface.canvas, borderWidth: 1,
        borderColor: p.warmEdge, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" }}>
        <LinearGradient colors={[...p.heroLighting]} style={{ padding: 16, gap: 12 }}>
          <View accessible={false} style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.border.control, alignSelf: "center" }} />
          <View style={{ ...F.row, alignItems: "flex-start" }}>
            <Text accessibilityRole="header" style={{ ...F.heading, fontSize: 24, flex: 1, paddingTop: 10 }}>{title}</Text>
            <IconButton label="Close" icon="close" onPress={onClose} />
          </View>
        </LinearGradient>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 18 }}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
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
  const { D, F, premium, t, p } = useTaskPresentation();
  return <View style={{ ...F.row, paddingVertical: 12, gap: 16, opacity: disabled ? 0.5 : 1 }}>
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ ...F.heading, fontSize: 16 }}>{title}</Text>
      {detail && <Text style={F.caption}>{detail}</Text>}
    </View>
    <Switch accessibilityLabel={title} disabled={disabled} value={value} onValueChange={onChange} trackColor={{ false: D.raised, true: D.teal }} thumbColor={value ? D.ink : D.text} />
  </View>;
}
