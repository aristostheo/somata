import React, { useState } from "react";
import { Pressable, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/content/ThemeProvider";
import { authPalette } from "./authPalette";

export function useAuthColors() {
  const { isDark } = useTheme();
  return { colors: authPalette(isDark), isDark };
}

type Icon = keyof typeof Ionicons.glyphMap;
export function Button({ label, onPress, icon, primary = false, disabled = false }: {
  label: string; onPress: () => void; icon?: Icon; primary?: boolean; disabled?: boolean;
}) {
  const { colors: C } = useAuthColors();
  const foreground = disabled ? C.muted : primary ? C.onPrimary : C.text;
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
    style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
      backgroundColor: disabled ? C.disabled : primary ? pressed ? C.pressed : C.primary : C.card,
      borderWidth: primary ? 0 : 1, borderColor: C.border })}>
    {!!icon && <Ionicons name={icon} color={foreground} size={20} />}
    <Text style={{ color: foreground, fontSize: 16, fontWeight: "700", flexShrink: 1, textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

export const Field = React.forwardRef<TextInput, TextInputProps & { label: string }>(function Field(
  { label, style, onFocus, onBlur, ...props }, ref,
) {
  const { colors: C } = useAuthColors();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8, minWidth: 0 }}>
    <Text style={{ color: C.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={C.muted} selectionColor={C.accent} {...props}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[{ minHeight: 54, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12,
        backgroundColor: C.card, color: C.text, fontSize: 16, borderWidth: 1,
        borderColor: focused ? C.accent : C.border }, style]} />
  </View>;
});

export function IconButton({ icon, label, onPress, disabled = false }: {
  icon: Icon; label: string; onPress: () => void; disabled?: boolean;
}) {
  const { colors: C } = useAuthColors();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} style={{ width: 48, height: 54, borderRadius: 12, backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={icon} color={disabled ? C.muted : C.accent} size={22} />
  </Pressable>;
}

export function Toggle({ title, detail, value, onChange, disabled = false }: {
  title: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  const { colors: C } = useAuthColors();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 48 }}>
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
      {!!detail && <Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>{detail}</Text>}
    </View>
    <Switch accessibilityLabel={title} disabled={disabled} value={value} onValueChange={onChange}
      trackColor={{ false: C.border, true: C.primary }} thumbColor={value ? C.onPrimary : C.card} />
  </View>;
}
