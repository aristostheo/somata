import { Button, Empty, Field, Heading, Choice as ModeChoice, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { visualTokens } from "@/components/accountSettings/visualTokens";
import { useTheme } from "@/content/ThemeProvider";
import { contrastRatio, isHex6, normalizeHex } from "@/lib/themeColor";
import {
  copyTheme, effectiveIsDark,
  OCEAN, PRESETS,
  resetPalette, setPreset,
  type PaletteTarget, type ThemeMode, type ThemeSnapshot,
} from "@/services/theme/themeState";

export default function ThemePickerScreen() {
  const { D, F } = useSomataTheme();

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

  return (<TaskPage title="Your signature look" section="Theme picker" subtitle="Mode and palette edits stay here until you save." onBack={leave} footer={draft ? <>{!!error && <Text accessibilityRole="alert" style={F.body}>{error}</Text>}<Button primary label={saving ? 'Saving…' : 'Save theme'} disabled={saving} onPress={save} /><Button label="Cancel changes" disabled={saving} onPress={leave} /></> : undefined}>

    {!themeReady ? <Empty title="Loading saved appearance…" /> : themeLoadError ? <><Empty title="Saved appearance unavailable" detail="Retry before editing to preserve your saved palettes." /><Button label="Retry loading" onPress={() => { void refreshTheme(); }} /></> : draft && <>
      <Heading title="Appearance mode" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['system', 'light', 'dark'] as ThemeMode[]).map(m => <ModeChoice key={m} label={m[0].toUpperCase() + m.slice(1)} selected={draft.mode === m} onPress={() => changeMode(m)} />)}
      </View><Text style={F.caption}>{draft.mode === 'system' ? `System currently uses ${systemIsDark ? 'dark' : 'light'} appearance.` : `${draft.mode} appearance selected.`}</Text>
      <View style={{ gap: 12, padding: 20, borderRadius: 24, backgroundColor: preview.canvas, borderWidth: 1, borderColor: preview.border }}>
        <Text style={{ color: preview.secondary, fontSize: 12, letterSpacing: 1 }}>PALETTE PREVIEW · {target.toUpperCase()}</Text>
        <Text style={{ color: preview.text, fontSize: 28, fontWeight: '700' }}>A little more you.</Text>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: preview.raised, overflow: 'hidden' }}>
          <LinearGradient colors={[primary, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 12, width: '68%' }} />
        </View>
        <Text style={{ color: preview.secondary, fontSize: 14 }}>Illustrative color sample</Text>
        <View style={{ padding: 18, borderRadius: 18, backgroundColor: preview.card, gap: 12 }}>
          <Text style={{ color: preview.text, fontSize: 17, fontWeight: '700' }}>Recorded progress</Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: primary, padding: 12, borderRadius: 12 }}>
            <Text style={{ color: buttonText, fontWeight: '700' }}>Accent preview</Text>
          </View>
        </View>
      </View>
      <Heading title="Palette library" detail="Light and dark accents are saved independently." /><View style={{ flexDirection: 'row', gap: 8 }}>
        {(['light', 'dark'] as PaletteTarget[]).map(t => <ModeChoice key={t} label={`${t} palette`} selected={target === t} onPress={() => setTarget(t)} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(name => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: presetName === name }} onPress={() => choosePreset(name)} style={{ flexGrow: 1, flexBasis: 140, padding: 16, borderRadius: 18, backgroundColor: D.card, borderWidth: 2, borderColor: presetName === name ? D.teal : D.line, gap: 12 }}>
          <LinearGradient colors={[PRESETS[name][target].primary, PRESETS[name][target].accent]} style={{ height: 50, borderRadius: 12 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          <Text style={F.heading}>{name}</Text>
          {presetName === name && <Text style={F.caption}>Selected</Text>}
        </Pressable>)}
      </View>
      <Panel>
        <Heading title={`Customize ${target}`} detail="Enter six-digit hex colors." />
        {(['primary', 'accent'] as const).map(field => <Field key={field} label={field === 'primary' ? 'Primary accent' : 'Secondary accent'} value={draft[target][field]} onChangeText={v => changeColor(field, v)} autoCapitalize="characters" autoCorrect={false} maxLength={7} />)}
      </Panel>
      <Heading title="Contrast check" detail={!validPrimary || !validAccent ? 'Enter valid hex colors to check contrast.' : `Primary ${primaryRatio.toFixed(1)}:1 · Secondary ${accentRatio.toFixed(1)}:1 on the card`} />{validPrimary && validAccent && <Text style={F.caption}>{primaryRatio < 3 || accentRatio < 3 ? 'One or both accents may be difficult to distinguish from the card.' : 'Both accents are distinguishable from the card.'}</Text>}<Button label={`Reset ${target} palette to Ocean`} onPress={resetSelected} />
    </>}
  </TaskPage>
  );
}
