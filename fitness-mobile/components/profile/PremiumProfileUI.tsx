import React from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useHomeVisuals } from '@/components/home/PremiumHomeUI';
import { Grid } from '@/components/nutrition/PremiumNutritionUI';
import type { Icon } from '@/components/designPreview/UI';

export { Grid };
const artwork = {
  ambient: { dark: require('../../assets/branding/profile/ambient-dark.png'), light: require('../../assets/branding/profile/ambient-light.png') },
  goals: { dark: require('../../assets/branding/profile/goals-dark.png'), light: require('../../assets/branding/profile/goals-light.png') },
  fitadapt: { dark: require('../../assets/branding/profile/fitadapt-dark.png'), light: require('../../assets/branding/profile/fitadapt-light.png') },
  progress: { dark: require('../../assets/branding/profile/progress-dark.png'), light: require('../../assets/branding/profile/progress-light.png') },
};
type Background = keyof typeof artwork;

/** Decoration is bounded independently of text/card height and never a chart. */
function Backdrop({ kind, height = 190 }: { kind: Background; height?: number }) {
  const { t, p } = useHomeVisuals();
  const { width, scale } = useWindowDimensions();
  const dark = t.mode === 'dark';
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.min(height, 1200 / Math.max(1, scale)),
      maxWidth: Math.min(width, 2400 / Math.max(1, scale)) }}>
    <Image accessible={false} source={artwork[kind][dark ? 'dark' : 'light']} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    <LinearGradient colors={[dark ? '#0B0E1229' : '#F4F3EE33', kind === 'ambient' ? t.surface.canvas : p.surface]}
      style={{ position: 'absolute', inset: 0 }} />
  </View>;
}

export function Page({ eyebrow, title, subtitle, headerAction, children }: {
  eyebrow: string; title: string; subtitle: string; headerAction: React.ReactNode; children: React.ReactNode;
}) {
  const { t } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  return <ScrollView style={{ flex: 1, backgroundColor: t.surface.canvas }} showsVerticalScrollIndicator={false}
    contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
    <Backdrop kind="ambient" height={230} />
    <View style={{ gap: 5, paddingHorizontal: 4, paddingBottom: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: t.action.link, backgroundColor: t.surface.canvas, alignSelf: 'flex-start', padding: 3,
            fontSize: 11, letterSpacing: 2, fontWeight: '800' }}>{eyebrow.toUpperCase()}</Text>
          {fontScale <= 1.3 && <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>{title}</Text>}
        </View>
        {headerAction}
      </View>
      {fontScale > 1.3 && <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>{title}</Text>}
      <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>{subtitle}</Text>
    </View>
    {children}
  </ScrollView>;
}

export function VisibilityButton({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show values' : 'Hide values'} onPress={onPress}
    style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, borderWidth: 1,
      borderColor: pressed ? t.focus.ring : p.warmEdge, backgroundColor: t.surface.inset, alignItems: 'center', justifyContent: 'center' })}>
    <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={23} color={t.action.link} />
  </Pressable>;
}

export function Card({ children, kind, accent = false, opaque = false }: {
  children: React.ReactNode; kind?: Background; accent?: boolean; opaque?: boolean;
}) {
  const { t, p } = useHomeVisuals();
  return <View style={{ borderRadius: 18, borderWidth: 1, borderColor: accent ? t.action.link : p.warmEdge,
    backgroundColor: p.surface, shadowColor: accent ? t.brand.orange : p.shadow, shadowOpacity: accent ? 0.13 : 0.08,
    shadowRadius: accent ? 10 : 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
    <View style={{ borderRadius: 17, overflow: 'hidden' }}>
      <LinearGradient colors={opaque ? [p.surface, p.surface] : p.lighting} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
        style={{ padding: 13, gap: 10 }}>
        {kind && !opaque && <Backdrop kind={kind} />}
        {children}
      </LinearGradient>
    </View>
  </View>;
}

export function Section({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode }) {
  const { t } = useHomeVisuals();
  return <View style={{ gap: 3 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: t.text.primary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>
      {action}
    </View>
    {!!caption && <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{caption}</Text>}
  </View>;
}

export function Identity({ name, email, photo, onPress }: { name: string; email: string; photo?: string | null; onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Account" onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, borderColor: pressed ? t.focus.ring : p.warmEdge, overflow: 'hidden' })}>
    <LinearGradient colors={p.lighting} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={{ minHeight: 78, padding: 13, gap: 12, flexDirection: 'row', alignItems: 'center' }}>
      {photo ? <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 24 }} /> :
        <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: p.warmEdge,
          backgroundColor: t.selection.background, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.action.link, fontSize: 23, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
        </View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text.primary, fontSize: 16, fontWeight: '800' }}>{name}</Text>
        <Text style={{ color: t.text.secondary, fontSize: 12 }}>{email}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.action.link} />
    </LinearGradient>
  </Pressable>;
}

export function Metric({ label, value, detail, icon, tone = 'plain' }: {
  label: string; value: string; detail?: string; icon: Icon; tone?: 'plain' | 'energy' | 'steps' | 'weight';
}) {
  const { t, p } = useHomeVisuals();
  const { width, fontScale } = useWindowDimensions();
  const ink = tone === 'plain' ? t.text.primary : t.data[tone];
  const inline = fontScale <= 1.15 && width >= 390;
  return <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: tone === 'plain' ? p.edge : ink + '77', overflow: 'hidden', backgroundColor: p.surface }}>
    <LinearGradient colors={tone === 'plain' ? [t.surface.inset, p.surface] : [t.mode === 'dark' ? '#2B1D16' : '#FFF1E6', p.surface]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 11, gap: 8 }}>
      <View style={{ flexDirection: inline ? 'row' : 'column', gap: 8, alignItems: inline ? 'center' : 'flex-start' }}>
        <View style={{ width: 34, height: 38, borderRadius: 18, backgroundColor: t.surface.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={23} color={ink} />
        </View>
        <View style={{ flex: inline ? 1 : undefined, alignSelf: inline ? undefined : 'stretch', gap: 3 }}>
          <Text style={{ color: t.text.secondary, fontSize: 11 }}>{label}</Text>
          <Text style={{ color: ink, fontSize: inline ? 20 : 23, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
        </View>
      </View>
      {!!detail && <Text style={{ color: t.text.secondary, fontSize: 11, lineHeight: 16 }}>{detail}</Text>}
    </LinearGradient>
  </View>;
}

export function Action({ label, icon, onPress, bright = false, disabled = false, navigation = true }: {
  label: string; icon: Icon; onPress: () => void; bright?: boolean; disabled?: boolean; navigation?: boolean;
}) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 12, borderWidth: 1, overflow: 'hidden',
      borderColor: disabled ? t.disabled.border : pressed ? t.focus.ring : t.action.link })}>
    {({ pressed }) => <LinearGradient colors={disabled ? [t.disabled.background, t.disabled.background] : pressed ? [t.surface.inset, t.surface.inset] : bright ? p.cta : p.recommendation}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={{ minHeight: 48, padding: 11, gap: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={21} color={disabled ? t.disabled.foreground : bright && !pressed ? t.text.onBrand : t.action.link} />
      <Text style={{ flexShrink: 1, color: disabled ? t.disabled.foreground : bright && !pressed ? t.text.onBrand : t.text.primary, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      {navigation && <Ionicons name="chevron-forward" size={17} color={disabled ? t.disabled.foreground : bright && !pressed ? t.text.onBrand : t.action.link} />}
    </LinearGradient>}
  </Pressable>;
}

export function LinkRow({ title, icon, onPress }: { title: string; icon: Icon; onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9,
      borderWidth: 1, borderColor: pressed ? t.focus.ring : p.edge, backgroundColor: pressed ? t.surface.secondary : p.surface,
      flexDirection: 'row', alignItems: 'center', gap: 9 })}>
    <Ionicons name={icon} size={21} color={t.action.link} />
    <Text style={{ flex: 1, color: t.text.primary, fontSize: 13, fontWeight: '500' }}>{title}</Text>
    <Ionicons name="chevron-forward" size={16} color={t.text.secondary} />
  </Pressable>;
}

export function Note({ children, alert = false }: { children: React.ReactNode; alert?: boolean }) {
  const { t } = useHomeVisuals();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, backgroundColor: t.surface.inset }}>
    <Ionicons name="information-circle-outline" size={20} color={t.text.secondary} />
    <Text accessibilityRole={alert ? 'alert' : undefined} style={{ flex: 1, color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{children}</Text>
  </View>;
}
