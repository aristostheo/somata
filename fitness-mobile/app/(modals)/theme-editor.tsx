import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/content/ThemeProvider";
import { contrastRatio, isHex6, normalizeHex } from "@/lib/themeColor";
import { withAlpha } from "@/lib/color";
import { visualTokens, type VisualTokens } from "@/components/accountSettings/visualTokens";
import {
  OCEAN, PRESETS, copyTheme, effectiveIsDark, resetPalette, setPreset,
  type PaletteTarget, type ThemeMode, type ThemeSnapshot,
} from "@/services/theme/themeState";

function Choice({ label, selected, onPress, palette, icon }: { label: string; selected: boolean; onPress: () => void; palette: VisualTokens; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 80, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 17, borderWidth: selected ? 2 : 1, borderColor: selected ? palette.primary : palette.border, backgroundColor: selected ? palette.primaryTint : palette.card, flexGrow: 1, flexBasis: 86, justifyContent: "center", alignItems: "center", gap: 6, opacity: pressed ? 0.72 : 1 })}>
      <Ionicons name={icon} size={22} color={selected ? palette.primary : palette.secondary} />
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: selected ? "700" : "600" }}>{label}</Text>
    </Pressable>
  );
}

function Label({ children, palette }: { children: React.ReactNode; palette: VisualTokens }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 11 }}><View style={{ width: 4, height: 15, borderRadius: 3, backgroundColor: palette.coral }} /><Text accessibilityRole="header" style={{ color: palette.text, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{children}</Text></View>;
}

export default function ThemePickerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const { modeSetting, themeAccents, isDark, themeReady, themeLoadError, refreshTheme, commitThemeDraft } = useTheme();
  const [draft, setDraft] = useState<ThemeSnapshot | null>(null);
  const [target, setTarget] = useState<PaletteTarget>(isDark ? "dark" : "light");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const chrome = visualTokens(isDark, (isDark ? themeAccents.dark.primary : themeAccents.light.primary) ?? OCEAN[isDark ? "dark" : "light"].primary, (isDark ? themeAccents.dark.accent : themeAccents.light.accent) ?? OCEAN[isDark ? "dark" : "light"].accent);

  useEffect(() => {
    if (themeReady && !themeLoadError && draft === null) {
      setDraft(copyTheme({
        mode: modeSetting,
        light: { primary: themeAccents.light.primary ?? OCEAN.light.primary, accent: themeAccents.light.accent ?? OCEAN.light.accent, gradientStyle: themeAccents.light.gradientStyle ?? "balanced" },
        dark: { primary: themeAccents.dark.primary ?? OCEAN.dark.primary, accent: themeAccents.dark.accent ?? OCEAN.dark.accent, gradientStyle: themeAccents.dark.gradientStyle ?? "balanced" },
      }));
    }
  }, [themeReady, themeLoadError, draft, modeSetting, themeAccents]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (savingRef.current) event.preventDefault();
  }), [navigation]);

  const leave = () => {
    if (savingRef.current) return;
    if (router.canGoBack()) router.back();
    else router.replace("/(modals)/settings");
  };
  const changeMode = (mode: ThemeMode) => { if (draft) { setError(""); setDraft({ ...draft, mode }); } };
  const changeColor = (field: "primary" | "accent", value: string) => {
    if (!draft) return;
    setError("");
    setDraft({ ...draft, [target]: { ...draft[target], [field]: value.toUpperCase() } });
  };
  const choosePreset = (name: keyof typeof PRESETS) => {
    if (!draft) return;
    setError("");
    setDraft(setPreset(draft, target, name));
  };
  const resetSelected = () => {
    if (!draft) return;
    setError("");
    setDraft(resetPalette(draft, target));
  };
  const save = async () => {
    if (!draft || savingRef.current) return;
    if (![draft.light.primary, draft.light.accent, draft.dark.primary, draft.dark.accent].every((value) => isHex6(normalizeHex(value)))) {
      setError("Enter a valid six-digit hex color for each palette before saving.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await commitThemeDraft(draft);
      savingRef.current = false;
      if (router.canGoBack()) router.back();
      else router.replace("/(modals)/settings");
    } catch (reason: any) {
      setError(reason?.message || "Couldn’t save your theme. Your edits are still here; please retry.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const active = draft?.[target];
  const validPrimary = !!active && isHex6(normalizeHex(active.primary));
  const validAccent = !!active && isHex6(normalizeHex(active.accent));
  const primary = validPrimary ? normalizeHex(active!.primary) : OCEAN[target].primary;
  const accent = validAccent ? normalizeHex(active!.accent) : OCEAN[target].accent;
  const preview = visualTokens(target === "dark", primary, accent);
  const primaryRatio = validPrimary ? contrastRatio(primary, preview.card) : 0;
  const accentRatio = validAccent ? contrastRatio(accent, preview.card) : 0;
  const buttonText = contrastRatio(primary, "#FFFFFF") >= contrastRatio(primary, "#111419") ? "#FFFFFF" : "#111419";
  const presetName = useMemo(() => {
    if (!active || !validPrimary || !validAccent) return "Custom";
    return (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).find((name) => PRESETS[name][target].primary === primary && PRESETS[name][target].accent === accent) ?? "Custom";
  }, [active, target, primary, accent, validPrimary, validAccent]);
  const systemIsDark = effectiveIsDark(draft?.mode ?? "system", systemScheme);

  return (
    <View style={{ flex: 1, backgroundColor: chrome.canvas }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 27, gap: 27 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[chrome.heroStart, chrome.heroMiddle, chrome.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 22, minHeight: 186, overflow: "hidden" }}>
          <View pointerEvents="none" style={{ position: "absolute", width: 184, height: 184, borderRadius: 92, top: -72, right: -48, backgroundColor: withAlpha(chrome.primary, 0.24) }} />
          <View pointerEvents="none" style={{ position: "absolute", width: 125, height: 125, borderRadius: 63, bottom: -70, right: 40, backgroundColor: withAlpha(chrome.accent, 0.18) }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel theme changes" onPress={leave} disabled={saving} style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12 }}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 13 }}><Text accessibilityRole="header" style={{ color: "#FFFFFF", fontSize: 33, fontWeight: "700", letterSpacing: -1.1, flex: 1 }}>Theme picker</Text><Ionicons name="color-palette-outline" size={26} color={chrome.gold} /></View>
          <Text style={{ color: "#E7E9FA", fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 288 }}>Choose an appearance and two independent accent palettes.</Text>
          <View style={{ width: 52, height: 3, borderRadius: 2, backgroundColor: chrome.gold, marginTop: 16 }} />
        </LinearGradient>

        {!themeReady ? <View style={{ minHeight: 160, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={chrome.primary} /><Text style={{ color: chrome.secondary, marginTop: 10 }}>Loading saved appearance…</Text></View> : themeLoadError ? <View style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 }}>
          <Text style={{ color: chrome.text, fontSize: 16, fontWeight: "700" }}>Saved appearance unavailable</Text>
          <Text style={{ color: chrome.secondary, fontSize: 14 }}>Retry before editing so your saved colors stay intact.</Text>
          <Pressable accessibilityRole="button" onPress={() => { void refreshTheme(); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: chrome.text, fontSize: 16, fontWeight: "700" }}>Retry loading</Text></Pressable>
        </View> : draft && <>
          <View>
            <Label palette={chrome}>Appearance</Label>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Choice label="System" icon="phone-portrait-outline" selected={draft.mode === "system"} onPress={() => changeMode("system")} palette={chrome} />
              <Choice label="Light" icon="sunny-outline" selected={draft.mode === "light"} onPress={() => changeMode("light")} palette={chrome} />
              <Choice label="Dark" icon="moon-outline" selected={draft.mode === "dark"} onPress={() => changeMode("dark")} palette={chrome} />
            </View>
            <Text style={{ color: chrome.secondary, fontSize: 14, lineHeight: 20, marginTop: 11 }}>{draft.mode === "system" ? `System follows your device · currently ${systemIsDark ? "Dark" : "Light"}` : `Somata will use ${draft.mode === "dark" ? "Dark" : "Light"} appearance`}</Text>
          </View>

          <View>
            <Label palette={chrome}>Palette to edit</Label>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 9 }}>
              <Choice label="Light palette" icon="sunny-outline" selected={target === "light"} onPress={() => setTarget("light")} palette={chrome} />
              <Choice label="Dark palette" icon="moon-outline" selected={target === "dark"} onPress={() => setTarget("dark")} palette={chrome} />
            </View>
            <Text style={{ color: chrome.secondary, fontSize: 14, lineHeight: 20, marginTop: 11 }}>Changes here affect only the {target} palette, regardless of appearance mode.</Text>
          </View>

          <View>
            <Label palette={chrome}>Preview · {target === "light" ? "Light" : "Dark"}</Label>
            <LinearGradient colors={[preview.heroStart, preview.heroMiddle, preview.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 23, padding: 13, overflow: "hidden" }}>
              <View pointerEvents="none" style={{ position: "absolute", width: 150, height: 150, borderRadius: 75, top: -60, right: -30, backgroundColor: withAlpha(primary, 0.2) }} />
              <View style={{ borderRadius: 17, backgroundColor: preview.card, padding: 17, gap: 10 }}>
                <Text style={{ color: preview.text, fontSize: 19, fontWeight: "700" }}>Your progress</Text>
                <Text style={{ color: preview.secondary, fontSize: 14 }}>A calm place for your personal record.</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: accent }} /><Text style={{ color: preview.text, fontSize: 14 }}>Recorded measurements</Text></View>
                <View style={{ backgroundColor: primary, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ color: buttonText, fontSize: 15, fontWeight: "700" }}>View progress</Text></View>
              </View>
            </LinearGradient>
          </View>

          <View>
            <Label palette={chrome}>Accent presets</Label>
            <View style={{ gap: 9 }}>
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: presetName === name }} onPress={() => choosePreset(name)} style={({ pressed }) => ({ minHeight: 65, borderRadius: 17, borderWidth: presetName === name ? 2 : 1, borderColor: presetName === name ? chrome.primary : chrome.border, backgroundColor: presetName === name ? chrome.primaryTint : chrome.card, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.72 : 1 })}>
                <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: PRESETS[name][target].primary }} /><View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: PRESETS[name][target].accent, marginLeft: -17, marginTop: 13, borderWidth: 2, borderColor: chrome.card }} />
                <Text style={{ color: chrome.text, fontSize: 16, fontWeight: "700", flex: 1, marginLeft: 6 }}>{name}</Text>
                {presetName === name ? <Ionicons name="checkmark-circle" size={20} color={chrome.primary} /> : <Ionicons name="chevron-forward" size={17} color={chrome.secondary} />}
              </Pressable>)}
            </View>
          </View>

          <View>
            <Label palette={chrome}>Customize {target} palette</Label>
            <View style={{ backgroundColor: chrome.card, borderRadius: 20, borderWidth: 1, borderColor: chrome.border, padding: 16, gap: 13 }}>
              {(["primary", "accent"] as const).map((field) => <View key={field} style={{ gap: 7 }}>
                <Text style={{ color: chrome.text, fontSize: 14, fontWeight: "700" }}>{field === "primary" ? "Primary accent" : "Secondary accent"}</Text>
                <View style={{ borderRadius: 13, backgroundColor: chrome.raised, minHeight: 51, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View style={{ width: 23, height: 23, borderRadius: 8, backgroundColor: isHex6(normalizeHex(draft[target][field])) ? normalizeHex(draft[target][field]) : chrome.border }} />
                  <TextInput accessibilityLabel={`${target} ${field} hex color`} value={draft[target][field]} onChangeText={(value) => changeColor(field, value)} autoCapitalize="characters" autoCorrect={false} maxLength={7} placeholder="#315B9A" placeholderTextColor={chrome.secondary} style={{ color: chrome.text, fontSize: 16, flex: 1, minHeight: 48 }} />
                </View>
              </View>)}
              <Text style={{ color: chrome.secondary, fontSize: 13, lineHeight: 19 }}>Use six-digit hex colors. Your saved palettes stay separate.</Text>
            </View>
          </View>

          <View style={{ backgroundColor: chrome.accentTint, borderRadius: 18, padding: 16, gap: 7 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="contrast-outline" size={18} color={chrome.accent} /><Text style={{ color: chrome.text, fontSize: 15, fontWeight: "700" }}>Contrast check</Text></View>
            {!validPrimary || !validAccent ? <Text style={{ color: chrome.secondary, fontSize: 14 }}>Enter valid hex colors to check contrast.</Text> : <>
              <Text style={{ color: chrome.secondary, fontSize: 14 }}>Primary on card: {primaryRatio.toFixed(1)}:1 · Secondary on card: {accentRatio.toFixed(1)}:1</Text>
              <Text style={{ color: chrome.text, fontSize: 14, lineHeight: 20 }}>{primaryRatio < 3 || accentRatio < 3 ? "Low contrast: one or both accents may be hard to distinguish from the card." : "Both accents are distinguishable from the card."}</Text>
            </>}
          </View>

          <Pressable accessibilityRole="button" onPress={resetSelected} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }}><Text style={{ color: chrome.text, fontSize: 14, fontWeight: "700" }}>Reset {target} palette to Ocean</Text></Pressable>
        </>}
      </ScrollView>

      {!!draft && <View style={{ backgroundColor: chrome.card, borderTopColor: chrome.border, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(14, insets.bottom), gap: 8 }}>
        {!!error && <Text accessibilityRole="alert" style={{ color: chrome.text, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={leave} disabled={saving} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Text style={{ color: chrome.secondary, fontSize: 15, fontWeight: "700" }}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void save(); }} disabled={saving} style={{ flex: 1, minHeight: 48, opacity: saving ? 0.5 : 1 }}><LinearGradient colors={[chrome.heroStart, chrome.heroMiddle]} style={{ flex: 1, borderRadius: 13, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{saving ? "Saving…" : "Save"}</Text></LinearGradient></Pressable>
        </View>
      </View>}
    </View>
  );
}
