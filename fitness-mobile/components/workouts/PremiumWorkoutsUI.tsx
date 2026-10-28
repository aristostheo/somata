import React from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Action as HomeAction, Card, Section, useHomeVisuals } from '@/components/home/PremiumHomeUI';
import { Page as AdaptivePage, Grid, Tool } from '@/components/nutrition/PremiumNutritionUI';
import type { SharedTemplateVM } from '@/services/workoutTemplateCatalog';
import type { Icon } from '@/components/designPreview/UI';

export { Card, Section, Grid, Tool };
export function Page(props: Omit<React.ComponentProps<typeof AdaptivePage>, 'headerAction'>) {
  return <AdaptivePage {...props} headerAction={null} />;
}

const artwork = {
  'auto-push': require('../../assets/branding/workouts/templates/push.png'),
  'auto-pull': require('../../assets/branding/workouts/templates/pull.png'),
  'auto-legs': require('../../assets/branding/workouts/templates/legs.png'),
  'auto-upper': require('../../assets/branding/workouts/templates/upper.png'),
  'auto-zone2': require('../../assets/branding/workouts/templates/cardio.png'),
  'auto-mobility': require('../../assets/branding/workouts/templates/mobility.png'),
};
/** Photography belongs only to these built-ins, never inferred from a saved name. */
export function builtInArtwork(template: Pick<SharedTemplateVM, 'id' | 'source'>) {
  return template.source === 'auto' && Object.prototype.hasOwnProperty.call(artwork, template.id)
    ? artwork[template.id as keyof typeof artwork] : null;
}
const icons: Record<string, Icon> = {
  'auto-push': 'barbell-outline', 'auto-pull': 'fitness-outline', 'auto-legs': 'walk-outline',
  'auto-upper': 'flash-outline', 'auto-zone2': 'heart-outline', 'auto-mobility': 'leaf-outline',
};

export function Action(props: React.ComponentProps<typeof HomeAction> & { danger?: boolean }) {
  const { t } = useHomeVisuals();
  if (!props.danger) return <HomeAction {...props} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={props.label} disabled={props.disabled}
    accessibilityState={{ disabled: !!props.disabled }} onPress={props.onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 13, padding: 10, gap: 8, flexDirection: 'row',
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
      borderColor: props.disabled ? t.disabled.border : t.status.error,
      backgroundColor: props.disabled ? t.disabled.background : pressed ? t.surface.secondary : t.surface.inset })}>
    <Ionicons name={props.icon} size={20} color={props.disabled ? t.disabled.foreground : t.status.error} />
    <Text style={{ flexShrink: 1, color: props.disabled ? t.disabled.foreground : t.status.error, fontSize: 13, fontWeight: '700' }}>{props.label}</Text>
  </Pressable>;
}

export function SessionHero({ onStart, onOpen, onPlan }: { onStart: () => void; onOpen: () => void; onPlan: () => void }) {
  const { t, p } = useHomeVisuals();
  const { width, scale, fontScale } = useWindowDimensions();
  const dark = t.mode === 'dark';
  // Original hero is 960×720: cap the image independently of a growing text card.
  const imageWidth = Math.min(288, width - 32, 960 / Math.max(1, scale));
  return <View style={{ borderRadius: 22, borderWidth: 1, borderColor: p.warmEdge, backgroundColor: p.surface,
    shadowColor: t.brand.orange, shadowOpacity: dark ? 0.12 : 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } }}>
    <View style={{ overflow: 'hidden', borderRadius: 21 }}>
      <LinearGradient colors={p.heroLighting} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, gap: 10 }}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', right: 0, top: 0, width: imageWidth, height: imageWidth * 0.75 }}>
          <Image accessible={false} source={dark ? require('../../assets/branding/workouts/hero/hero-dark.png') : require('../../assets/branding/workouts/hero/hero-light.png')}
            resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          <LinearGradient colors={dark ? ['#0B0E12F5', '#0B0E1266'] : ['#F4F3EEF5', '#F4F3EE99']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', inset: 0 }} />
        </View>
        <View style={{ alignSelf: 'flex-start', borderRadius: 10, padding: 6, margin: -6, gap: 8,
          backgroundColor: dark ? '#0B0E12E6' : '#F4F3EEEE' }}>
          <Text style={{ color: t.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 }}>YOUR NEXT SESSION</Text>
          <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>Make room to move.</Text>
        </View>
        <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19, backgroundColor: dark ? '#0B0E12E6' : '#F4F3EEEE',
          borderRadius: 8, padding: 4, alignSelf: 'flex-start' }}>Your session workspace keeps the same logging and editing tools.</Text>
        <Grid><Action label="Start new" icon="add" bright onPress={onStart} /><Action label="Open session" icon="play-outline" onPress={onOpen} /></Grid>
        <View style={{ width: fontScale > 1.3 || width < 350 ? '100%' : '74%' }}>
          <Action label="Plan a session" icon="options-outline" onPress={onPlan} />
        </View>
      </LinearGradient>
    </View>
  </View>;
}

export function Stat({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: Icon }) {
  const { t, p } = useHomeVisuals();
  return <View style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: p.warmEdge, overflow: 'hidden', backgroundColor: p.surface }}>
    <LinearGradient colors={p.heroLighting} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Ionicons name={icon} size={23} color={t.action.link} />
        <Text style={{ flex: 1, color: t.text.secondary, fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: t.text.primary, fontSize: value === 'Loading…' ? 18 : 32, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: t.text.secondary, fontSize: 11, lineHeight: 16 }}>{detail}</Text>
    </LinearGradient>
  </View>;
}

export function TemplateCard({ template, onPress }: { template: SharedTemplateVM; onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  const source = builtInArtwork(template);
  const dark = t.mode === 'dark';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Start ${template.name}`} onPress={onPress}
    style={({ pressed }) => ({ flex: 1, minHeight: 110, borderRadius: 16, overflow: 'hidden', borderWidth: 1,
      borderColor: pressed ? t.focus.ring : p.edge, backgroundColor: p.surface })}>
    {source && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', right: 0, top: 0, width: 96, height: 120 }}>
      <Image source={source} resizeMode="cover" accessible={false} style={{ width: '100%', height: '100%' }} />
      <LinearGradient colors={dark ? ['#0B0E12F5', '#0B0E1233'] : ['#F4F3EEF5', '#F4F3EE66']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', inset: 0 }} />
    </View>}
    <View style={{ flex: 1, padding: 11, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ionicons name={icons[template.id] || 'document-text-outline'} size={22} color={t.action.link} />
        <View style={{ borderRadius: 12, padding: 3, backgroundColor: t.surface.canvas }}>
          <Ionicons name="chevron-forward" size={16} color={t.text.secondary} />
        </View>
      </View>
      <View style={{ gap: 3, alignSelf: 'flex-start', padding: 4, marginLeft: -4, borderRadius: 6,
        backgroundColor: dark ? '#0B0E12EE' : '#F4F3EEF5' }}>
        <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: '700' }}>{template.name}</Text>
        <Text style={{ color: t.text.secondary, fontSize: 11 }}>{template.items.length} {template.items.length === 1 ? 'movement' : 'movements'}</Text>
      </View>
    </View>
  </Pressable>;
}

export function Surprise({ onPress }: { onPress: () => void }) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel="Surprise from saved templates" onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, borderColor: pressed ? t.focus.ring : t.action.link, overflow: 'hidden' })}>
    <LinearGradient colors={p.recommendation} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={{ minHeight: 54, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Ionicons name="shuffle-outline" color={t.action.link} size={24} />
      <Text style={{ flexShrink: 1, fontSize: 13, fontWeight: '700', color: t.text.primary }}>Surprise from saved templates</Text>
      <Ionicons name="chevron-forward" color={t.text.secondary} size={17} />
    </LinearGradient>
  </Pressable>;
}

export function SavedHeading({ name, count }: { name: string; count: number }) {
  const { t, p } = useHomeVisuals();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={{ width: 42, height: 46, borderRadius: 12, borderWidth: 1, borderColor: p.warmEdge,
      backgroundColor: t.surface.inset, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="document-text-outline" size={24} color={t.action.link} />
    </View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: t.text.primary, fontSize: 15, fontWeight: '700' }}>{name}</Text>
      <Text style={{ color: t.text.secondary, fontSize: 11 }}>{count} {count === 1 ? 'movement' : 'movements'}</Text>
    </View>
  </View>;
}

export function RecordSummary({ title, detail, icon }: { title: string; detail: string; icon: Icon }) {
  const { t } = useHomeVisuals();
  return <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' }}>
    <View style={{ padding: 9, borderRadius: 13, backgroundColor: t.selection.background }}>
      <Ionicons name={icon} size={23} color={t.action.link} />
    </View>
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ color: t.text.primary, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{detail}</Text>
    </View>
  </View>;
}
