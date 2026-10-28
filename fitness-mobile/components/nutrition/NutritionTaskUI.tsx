import { useTaskPresentation } from '@/components/designPreview/Appearance';
import { Panel } from '@/components/somata/TaskUI';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

/** Nutrition compositions on the existing task foundation. No data or writes. */
export function NutritionContext({ label, title, detail, icon = 'restaurant-outline' }: {
  label: string; title: string; detail?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { F, t } = useTaskPresentation();
  return <Panel accent><View style={{ ...F.row, alignItems: 'flex-start' }}>
    <View style={{ flex: 1, gap: 8 }}><Text style={F.eyebrow}>{label.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={{ ...F.heading, fontSize: 25 }}>{title}</Text>
      {!!detail && <Text style={F.body}>{detail}</Text>}
    </View><View style={{ padding: 12, borderRadius: 16, backgroundColor: t.selection.background }}>
      <Ionicons name={icon} size={26} color={t.action.link} />
    </View>
  </View></Panel>;
}

export function NutritionValues({ values }: { values: Array<{ label: string; value: string }> }) {
  const { F, t, p } = useTaskPresentation();
  return <View style={F.wrap}>{values.map(v => <View key={v.label} style={{ flexGrow: 1, flexBasis: 128, minWidth: 110,
    padding: 14, gap: 7, borderRadius: 16, backgroundColor: t.surface.inset, borderWidth: 1, borderColor: p.edge }}>
    <Text style={F.caption}>{v.label}</Text><Text style={{ ...F.value, fontSize: 24, color: v.label === 'Carbs' ? t.status.info : v.label === 'Fat' ? t.status.warning : t.action.link }}>{v.value}</Text>
  </View>)}</View>;
}

export function NutritionFields({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
    {React.Children.toArray(children).map((child, i) => <View key={(child as any)?.key ?? i} style={{ flexGrow: 1, flexBasis: 145, minWidth: 130 }}>{child}</View>)}
  </View>;
}

export function FoodSourceTile({ label, icon, selected, onPress }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; selected?: boolean; onPress: () => void;
}) {
  const { F, t, p } = useTaskPresentation();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={selected == null ? undefined : { selected }}
    style={({ pressed }) => ({ flexGrow: 1, flexBasis: 95, minWidth: 90, minHeight: 86, padding: 14, gap: 10,
      borderRadius: 16, borderWidth: 1, borderColor: selected || pressed ? t.selection.border : p.edge,
      backgroundColor: selected ? t.selection.background : t.surface.inset })}>
    <Ionicons name={icon} size={23} color={t.action.link} />
    <Text style={{ ...F.caption, color: selected ? t.selection.foreground : t.text.primary, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
}
