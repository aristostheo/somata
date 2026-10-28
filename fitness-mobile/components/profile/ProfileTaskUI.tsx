import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTaskPresentation } from '@/components/designPreview/Appearance';
import { Panel } from '@/components/somata/TaskUI';
import { FitAdaptSymbol } from '@/components/brand/Brand';

/** Presentation only: controllers own values, units, validation and actions. */
export function ProfileIntro({ label, title, detail, fitadapt = false }: {
  label: string; title: string; detail?: string; fitadapt?: boolean;
}) {
  const { F } = useTaskPresentation();
  const { fontScale } = useWindowDimensions();
  return <Panel accent><View style={{ flexDirection: fontScale >= 1.4 ? 'column-reverse' : 'row', alignItems: 'flex-start', gap: 16 }}>
    <View style={{ flex: 1, gap: 8 }}><Text style={F.eyebrow}>{label.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={{ ...F.heading, fontSize: 25 }}>{title}</Text>
      {!!detail && <Text style={F.body}>{detail}</Text>}
    </View>{fitadapt && <FitAdaptSymbol size={40} />}
  </View></Panel>;
}
export function ProfileSection({ index, title, detail, children }: {
  index: string; title: string; detail?: string; children: React.ReactNode;
}) {
  const { F, t } = useTaskPresentation();
  const { fontScale } = useWindowDimensions();
  return <Panel><View style={{ flexDirection: fontScale >= 1.4 ? 'column' : 'row', gap: 12, alignItems: 'flex-start' }}>
    <View style={{ padding: 10, minWidth: 38, borderRadius: 12, backgroundColor: t.selection.background }}>
      <Text style={{ ...F.eyebrow, textAlign: 'center' }}>{index}</Text>
    </View><View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={F.heading}>{title}</Text>
      {!!detail && <Text style={F.caption}>{detail}</Text>}
    </View></View>{children}</Panel>;
}
export function ProfileStats({ values }: { values: Array<{ label: string; value: string }> }) {
  const { F, t } = useTaskPresentation();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map(v =>
    <View key={v.label} style={{ flexGrow: 1, flexBasis: 125, minWidth: 100, padding: 14, gap: 6,
      borderRadius: 16, backgroundColor: t.surface.inset, borderWidth: 1, borderColor: t.border.subtle }}>
      <Text style={F.caption}>{v.label}</Text><Text style={{ ...F.value, fontSize: 26 }}>{v.value}</Text>
    </View>)}</View>;
}
export function ProfileFields({ children }: { children: React.ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {React.Children.toArray(children).map((child, i) => <View key={(child as any)?.key ?? i}
      style={{ flexGrow: 1, flexBasis: fontScale >= 1.4 ? '100%' : 140, minWidth: 115 }}>{child}</View>)}
  </View>;
}
export function ProfileRecord({ label, children }: { label: string; children: React.ReactNode }) {
  const { F, t } = useTaskPresentation();
  return <View style={{ padding: 14, borderRadius: 16, gap: 10, backgroundColor: t.surface.inset,
    borderWidth: 1, borderColor: t.border.subtle }}>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Ionicons name="time-outline" color={t.action.link} size={18} /><Text style={{ ...F.caption, flex: 1 }}>{label}</Text>
    </View>{children}</View>;
}
