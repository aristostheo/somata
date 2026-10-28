// Review-only composition. No route imports this file; no account or workout writes.
import React from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHomeVisuals } from '@/components/home/PremiumHomeUI';
import { AUTO_TEMPLATES, type SharedTemplateVM } from '@/services/workoutTemplateCatalog';

const heroes = {
  dark: require('../../assets/branding/workouts/hero/hero-dark.png'),
  light: require('../../assets/branding/workouts/hero/hero-light.png'),
};
const templates = {
  'auto-push': require('../../assets/branding/workouts/templates/push.png'),
  'auto-pull': require('../../assets/branding/workouts/templates/pull.png'),
  'auto-legs': require('../../assets/branding/workouts/templates/legs.png'),
  'auto-upper': require('../../assets/branding/workouts/templates/upper.png'),
  'auto-zone2': require('../../assets/branding/workouts/templates/cardio.png'),
  'auto-mobility': require('../../assets/branding/workouts/templates/mobility.png'),
};
/** Proposed allowlist only. A matching name/id on a user template is insufficient. */
export function proposedTemplateArtwork(template: Pick<SharedTemplateVM, 'source' | 'id'>) {
  return template.source === 'auto' && Object.prototype.hasOwnProperty.call(templates, template.id)
    ? templates[template.id as keyof typeof templates] : null;
}
const held = new Set(['auto-legs', 'auto-zone2', 'auto-mobility']);

function ReviewButton({ title, primary = false }: { title: string; primary?: boolean }) {
  const { t } = useHomeVisuals();
  return <Pressable disabled accessibilityRole="button" accessibilityLabel={`${title} (visual review only)`}
    style={{ padding: 12, minHeight: 48, justifyContent: 'center', borderRadius: 13,
      borderWidth: 1, borderColor: t.border.control, backgroundColor: primary ? t.action.primary.background : t.surface.secondary }}>
    <Text style={{ color: primary ? t.text.onBrand : t.text.primary, fontSize: 13, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}

export default function WorkoutImageReview({ safeOnly = false }: { safeOnly?: boolean }) {
  const { t, p } = useHomeVisuals();
  const { fontScale, width } = useWindowDimensions();
  const dark = t.mode === 'dark';
  return <View style={{ padding: 16, gap: 16, backgroundColor: t.surface.canvas }}>
    <Text style={{ color: t.action.link, fontSize: 12, letterSpacing: 1.5, fontWeight: '800' }}>5A / IMAGE TREATMENT REVIEW</Text>
    <Text style={{ color: t.text.secondary, fontSize: 13 }}>{safeOnly ? 'Proposed safe fallbacks for mismatched imagery.' : 'All filename-based candidates, including artwork held for approval.'} Controls are inactive.</Text>
    <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: p.warmEdge, backgroundColor: p.surface }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', right: 0, top: 0, width: Math.min(288, width - 32), height: 216 }}>
        <Image source={heroes[dark ? 'dark' : 'light']} resizeMode="cover" accessible={false} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: dark ? 'rgba(11,14,18,0.78)' : 'rgba(244,243,238,0.86)' }} />
      </View>
      <View style={{ padding: 18, gap: 12 }}>
        <Text style={{ color: t.action.link, backgroundColor: t.surface.canvas, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3,
          borderRadius: 5, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' }}>YOUR NEXT SESSION</Text>
        <Text style={{ color: t.text.primary, fontSize: 28, fontWeight: '800' }}>Make room to move.</Text>
        <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>Your session workspace keeps the same logging and editing tools.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ReviewButton title="Start new" primary /><ReviewButton title="Open session" /><ReviewButton title="Plan a session" />
        </View>
      </View>
    </View>
    <Text style={{ color: t.text.primary, fontSize: 20, fontWeight: '800' }}>Built-in template candidates</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {AUTO_TEMPLATES.map(template => {
        const withheld = held.has(template.id);
        const image = safeOnly && withheld ? null : proposedTemplateArtwork(template);
        const largeText = fontScale > 1.3;
        const label = <View style={{ padding: 10, gap: 3, backgroundColor: dark ? 'rgba(11,14,18,0.94)' : 'rgba(244,243,238,0.96)' }}>
          <Text style={{ color: t.text.primary, fontSize: 14, fontWeight: '800' }}>{template.name}</Text>
          <Text style={{ color: t.text.secondary, fontSize: 11 }}>{template.items.length} movements</Text>
        </View>;
        return <View key={template.id} style={{ width: largeText ? '100%' : '48%', maxWidth: largeText ? undefined : 200, gap: 6 }}>
          <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: p.edge, backgroundColor: p.surface }}>
            <View style={{ height: 132, maxWidth: 200, width: '100%', alignSelf: 'center', backgroundColor: p.surface }}>
              {image && <Image source={image} resizeMode="cover" accessible={false} style={{ width: '100%', height: '100%' }} />}
              <LinearGradient colors={dark ? ['#0B0E121A', '#0B0E1255'] : ['#F4F3EE1A', '#F4F3EE55']}
                pointerEvents="none" style={{ position: 'absolute', inset: 0 }} />
              {!largeText && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{label}</View>}
              {!image && <Text style={{ color: t.text.secondary, fontSize: 12, padding: 10 }}>Neutral fallback</Text>}
            </View>
            {largeText && label}
          </View>
          <Text style={{ color: withheld ? t.status.warning : t.text.secondary, fontSize: 11 }}>{withheld ? 'HOLD · subject mismatch' : 'Candidate · softness review'}</Text>
        </View>;
      })}
    </View>
    <Text style={{ color: t.text.secondary, fontSize: 12 }}>Saved/user templates keep their current neutral treatment. No image is inferred from their names, focus, or copied IDs.</Text>
  </View>;
}
