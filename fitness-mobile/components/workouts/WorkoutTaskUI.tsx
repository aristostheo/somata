import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTaskPresentation } from '@/components/designPreview/Appearance';
import { Panel } from '@/components/somata/TaskUI';

/** Workout-only compositions; values and actions remain in their controllers. */
export function WorkoutIntro({ label, title, detail, icon = 'barbell-outline' }: {
  label: string; title: string; detail?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { F, t } = useTaskPresentation();
  return <Panel accent><View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
    <View style={{ flex: 1, gap: 8 }}><Text style={F.eyebrow}>{label.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={{ ...F.heading, fontSize: 24 }}>{title}</Text>
      {!!detail && <Text style={F.body}>{detail}</Text>}
    </View><Ionicons name={icon} color={t.action.link} size={28} />
  </View></Panel>;
}
export function WorkoutStats({ values }: { values: Array<{ label: string; value: string }> }) {
  const { F, t } = useTaskPresentation();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map(v =>
    <View key={v.label} style={{ flexGrow: 1, flexBasis: 125, minWidth: 112, padding: 14, gap: 6,
      borderRadius: 16, backgroundColor: t.surface.inset, borderWidth: 1, borderColor: t.border.subtle }}>
      <Text style={F.caption}>{v.label}</Text><Text style={{ ...F.value, fontSize: 26 }}>{v.value}</Text>
    </View>)}</View>;
}
export function WorkoutFields({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {React.Children.toArray(children).map((child, i) => <View key={(child as any)?.key ?? i} style={{ flexGrow: 1, flexBasis: 145, minWidth: 125 }}>{child}</View>)}
  </View>;
}
export function MovementHeading({ number, title, detail }: { number: number; title: string; detail?: string }) {
  const { F, t } = useTaskPresentation();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <View style={{ minWidth: 38, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, backgroundColor: t.selection.background }}>
      <Text style={{ ...F.eyebrow, textAlign: 'center' }}>{String(number).padStart(2, '0')}</Text>
    </View><View style={{ flex: 1, gap: 6 }}><Text accessibilityRole="header" style={F.heading}>{title}</Text>
      {!!detail && <Text style={F.caption}>{detail}</Text>}
    </View>
  </View>;
}
