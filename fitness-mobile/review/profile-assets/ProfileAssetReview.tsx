// Asset treatment approval only. No app route imports this composition.
import React from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SomataSymbol, FitAdaptSymbol } from '@/components/brand/Brand';
import { useHomeVisuals } from '@/components/home/PremiumHomeUI';

const backgrounds = {
  ambient: { dark: require('../../assets/branding/profile/ambient-dark.png'), light: require('../../assets/branding/profile/ambient-light.png') },
  goals: { dark: require('../../assets/branding/profile/goals-dark.png'), light: require('../../assets/branding/profile/goals-light.png') },
  fitadapt: { dark: require('../../assets/branding/profile/fitadapt-dark.png'), light: require('../../assets/branding/profile/fitadapt-light.png') },
  progress: { dark: require('../../assets/branding/profile/progress-dark.png'), light: require('../../assets/branding/profile/progress-light.png') },
};

function Surface({ kind, children }: { kind: keyof typeof backgrounds; children: React.ReactNode }) {
  const { t, p } = useHomeVisuals();
  const { width } = useWindowDimensions();
  const dark = t.mode === 'dark';
  return <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: p.warmEdge, backgroundColor: t.surface.canvas }}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.min(200, (width - 32) / 2) }}>
      <Image source={backgrounds[kind][dark ? 'dark' : 'light']} resizeMode="cover" accessible={false}
        style={{ width: '100%', height: '100%' }} />
      <LinearGradient colors={dark ? ['#0B0E1229', '#0B0E12'] : ['#F4F3EE33', '#F4F3EE']}
        style={{ position: 'absolute', inset: 0 }} />
    </View>
    <View style={{ padding: 16, gap: 12 }}>{children}</View>
  </View>;
}
function Copy({ children, title = false }: { children: React.ReactNode; title?: boolean }) {
  const { t } = useHomeVisuals();
  return <Text accessibilityRole={title ? 'header' : undefined} style={{ color: title ? t.text.primary : t.text.secondary,
    fontSize: title ? 21 : 12, fontWeight: title ? '800' : '400', lineHeight: title ? undefined : 18 }}>{children}</Text>;
}
function ReviewAction({ title }: { title: string }) {
  const { t } = useHomeVisuals();
  return <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={`${title}; asset review only`}
    style={{ minHeight: 48, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border.control,
      backgroundColor: t.surface.secondary, justifyContent: 'center' }}>
    <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}
function Values({ labels }: { labels: string[] }) {
  const { t } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {labels.map(label => <View key={label} style={{ flexGrow: 1, flexBasis: 120 * fontScale, padding: 12, gap: 5,
      borderRadius: 13, backgroundColor: t.surface.primary, borderWidth: 1, borderColor: t.border.subtle }}>
      <Copy>{label}</Copy><Text style={{ color: t.text.primary, fontSize: 25, fontWeight: '800' }}>—</Text>
    </View>)}
  </View>;
}

export default function ProfileAssetReview() {
  const { t } = useHomeVisuals();
  return <View style={{ padding: 16, gap: 14, backgroundColor: t.surface.canvas }}>
    <Text style={{ color: t.action.link, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PROFILE / ASSET REVIEW ONLY</Text>
    <Copy>No account loaded. Empty values are intentional. Controls are inactive.</Copy>
    <Surface kind="ambient">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SomataSymbol size={42} />
        <View style={{ flex: 1, gap: 4 }}><Copy title>Profile</Copy><Copy>Your plan, measured progress, and account in one place.</Copy></View>
      </View>
      <View style={{ backgroundColor: t.surface.primary, padding: 12, borderRadius: 14, gap: 5 }}>
        <Copy title>Your profile</Copy><Copy>Your account</Copy>
        <ReviewAction title="Open Account" />
      </View>
      <ReviewAction title="Hide values" />
    </Surface>
    <Surface kind="goals">
      <Copy title>Your current focus</Copy>
      <Copy>Targets unavailable in this asset-only review.</Copy>
      <Values labels={['Energy', 'Protein', 'Carbs', 'Fat']} />
      <Copy>Editing saved goals does not replace accepted targets. A proposal changes them only after you accept it.</Copy>
      <ReviewAction title="Edit saved profile & goals" />
    </Surface>
    <Surface kind="fitadapt">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><Copy title>FitAdapt review</Copy></View><FitAdaptSymbol size={36} />
      </View>
      <Copy>Requested by you; acceptance is always explicit.</Copy>
      <Copy>A review uses required profile fields and account-scoped dated records. Your name, email, and photo are excluded.</Copy>
      <ReviewAction title="Review my plan" />
      <View style={{ backgroundColor: t.surface.primary, borderRadius: 12, padding: 12, gap: 5 }}>
        <Copy>No proposal is being shown in this preview.</Copy>
        <Copy>A real Pending review stays separate, with its existing comparison, Accept and Decline actions.</Copy>
      </View>
    </Surface>
    <Surface kind="progress">
      <Copy title>Measured progress</Copy>
      <Copy>Recorded account values, with no generated trend.</Copy>
      <Values labels={['Steps today', 'Latest weight']} />
      <View style={{ backgroundColor: t.surface.primary, padding: 14, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: t.border.subtle }}>
        <Copy title>Weight trace</Copy>
        <Copy>Two dated weights are needed for a trend.</Copy>
        <ReviewAction title="FitAdapt insights & history" />
      </View>
    </Surface>
    <View style={{ gap: 9, padding: 14, borderRadius: 16, backgroundColor: t.surface.primary }}>
      <Copy title>Existing lower sections</Copy>
      {['Records & reflection', 'Your settings', 'Collection & connections'].map(label => <View key={label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle-outline" color={t.action.link} size={20} /><Copy>{label} · unchanged</Copy>
      </View>)}
    </View>
  </View>;
}
