import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTaskPresentation } from '@/components/designPreview/Appearance';
import { Heading, Panel } from '@/components/somata/TaskUI';

type Icon = keyof typeof Ionicons.glyphMap;
/** Scoped compositions over TaskUI, with no state, persistence or service access. */
export function DeskIntro({ icon, label, title, detail, children }: {
  icon: Icon; label: string; title: string; detail?: string; children?: React.ReactNode;
}) {
  const { F, t } = useTaskPresentation();
  const { fontScale } = useWindowDimensions();
  return <Panel accent><View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: 'flex-start', gap: 16 }}>
    <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.selection.background, borderWidth: 1, borderColor: t.selection.border }}>
      <Ionicons name={icon} size={28} color={t.action.link} />
    </View><View style={{ flex: 1, gap: 7 }}><Text style={F.eyebrow}>{label.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={{ ...F.heading, fontSize: 25 }}>{title}</Text>
      {!!detail && <Text style={F.body}>{detail}</Text>}</View>
  </View>{children}</Panel>;
}
export function DeskSection({ icon, title, detail, children }: {
  icon: Icon; title: string; detail?: string; children: React.ReactNode;
}) {
  const { t } = useTaskPresentation();
  return <Panel><View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <Ionicons name={icon} color={t.action.link} size={24} />
    <View style={{ flex: 1 }}><Heading title={title} detail={detail} /></View>
  </View>{children}</Panel>;
}
export function StatusNote({ title, detail, icon = 'shield-checkmark-outline', danger = false }: {
  title: string; detail?: string; icon?: Icon; danger?: boolean;
}) {
  const { F, t } = useTaskPresentation();
  return <View style={{ padding: 14, gap: 8, borderRadius: 14, backgroundColor: t.surface.inset,
    borderLeftWidth: 3, borderColor: danger ? t.status.error : t.action.link }}>
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={danger ? t.status.error : t.action.link} />
      <Text style={{ ...F.body, fontWeight: '700', color: danger ? t.status.error : t.text.primary, flex: 1 }}>{title}</Text>
    </View>{!!detail && <Text style={F.caption}>{detail}</Text>}
  </View>;
}
export function DeskColumns({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {React.Children.toArray(children).map((child, i) => <View key={(child as any)?.key ?? i}
      style={{ flexGrow: 1, flexBasis: width < 350 || fontScale > 1.3 ? '100%' : 145, minWidth: 120 }}>{child}</View>)}
  </View>;
}
