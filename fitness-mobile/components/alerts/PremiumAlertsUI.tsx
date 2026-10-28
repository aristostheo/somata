import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useHomeVisuals } from '@/components/home/PremiumHomeUI';
import type { Icon } from '@/components/designPreview/UI';
import type { AppNotification } from '@/services/notifications';

export type AlertCategory = 'All' | 'Friends' | 'Workouts' | 'Nutrition' | 'Streaks' | 'Coach';
// Presentation labels only. Notification classification and item routes stay in the screen.
export const categoryPresentation: Record<AlertCategory, {
  title: string; hero: string; detail: string; icon: Icon; action: string; route: string;
}> = {
  All: { title: 'Alerts', hero: 'Your signal center', detail: 'Activity from friends and the app, in one place.', icon: 'notifications-outline', action: 'Open friends', route: '/friends' },
  Friends: { title: 'Friends', hero: 'Friend activity', detail: 'Requests and updates from your circle, in one place.', icon: 'people-outline', action: 'Open friends', route: '/friends' },
  Workouts: { title: 'Workouts', hero: 'Training signals', detail: 'Your recorded workout alerts, in one place.', icon: 'barbell-outline', action: 'Open workouts', route: '/(tabs)/workouts' },
  Nutrition: { title: 'Nutrition', hero: 'Fuel signals', detail: 'Your recorded food and nutrition alerts.', icon: 'nutrition-outline', action: 'Open nutrition', route: '/(tabs)/nutrition' },
  Streaks: { title: 'Streaks', hero: 'Momentum center', detail: 'Your recorded streaks and milestones, in one place.', icon: 'flame-outline', action: 'Open Home', route: '/(tabs)' },
  Coach: { title: 'Coach', hero: 'Your perspective', detail: 'Your recorded summaries and recovery updates.', icon: 'sparkles-outline', action: 'Open insights', route: '/profile/insights-progress' },
};

/** Static, bounded atmosphere. No data curve, logo, bitmap or animation. */
function LightTrail({ ambient = false }: { ambient?: boolean }) {
  const { t } = useHomeVisuals();
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', top: ambient ? -35 : 0, right: ambient ? -35 : 0, width: ambient ? 270 : 190,
      height: ambient ? 200 : 145, opacity: t.mode === 'dark' ? 0.65 : 0.18 }}>
    <Svg width="100%" height="100%" viewBox="0 0 270 190" accessible={false}>
      {ambient ? <>
        <Path d="M90 -12 C76 110 234 30 278 168" fill="none" stroke={t.brand.coral} strokeWidth={36} opacity={0.08} />
        <Path d="M90 -12 C76 110 234 30 278 168" fill="none" stroke={t.brand.orange} strokeWidth={14} opacity={0.13} />
        <Path d="M90 -12 C76 110 234 30 278 168" fill="none" stroke={t.brand.coral} strokeWidth={1.5} />
      </> : Array.from({ length: 9 }, (_, i) => <Path key={i}
        d={`M20 ${135 + i * 3} C115 ${25 + i * 5} 160 ${190 - i * 7} 285 ${35 + i * 7}`}
        fill="none" stroke={t.brand.orange} strokeWidth={0.8} opacity={0.15 + i * 0.035} />)}
    </Svg>
  </View>;
}

export function Button({ label, icon, onPress, disabled = false, primary = false, chevron = false }: {
  label: string; icon: Icon; onPress: () => void; disabled?: boolean; primary?: boolean; chevron?: boolean;
}) {
  const { t, p } = useHomeVisuals();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: disabled ? t.disabled.border : pressed ? t.focus.ring : primary ? t.action.link : p.warmEdge,
      borderRadius: 13, overflow: 'hidden', minHeight: 48 })}>
    {({ pressed }) => <LinearGradient colors={disabled ? [t.disabled.background, t.disabled.background] : pressed ? [t.surface.inset, t.surface.inset] : primary ? p.recommendation : [p.surface, t.surface.inset]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, gap: 9,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} color={disabled ? t.disabled.foreground : t.action.link} size={22} />
      <Text style={{ flexShrink: 1, color: disabled ? t.disabled.foreground : t.text.primary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
      {chevron && <Ionicons name="chevron-forward" size={19} color={t.action.link} />}
    </LinearGradient>}
  </Pressable>;
}

export function Header({ filter, subtitle, unread, busy, onMarkAll }: {
  filter: AlertCategory; subtitle: string; unread: number; busy: boolean; onMarkAll: () => void;
}) {
  const { t } = useHomeVisuals();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 390 || fontScale > 1.2;
  return <View style={{ gap: 8, paddingTop: 12, paddingBottom: 5, overflow: 'hidden' }}>
    <LightTrail ambient />
    <Text style={{ color: t.action.link, fontSize: 11, fontWeight: '800', letterSpacing: 2.5 }}>SIGNALS / {filter === 'All' ? 'YOUR ACCOUNT' : filter.toUpperCase()}</Text>
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', gap: 10 }}>
      <Text accessibilityRole="header" style={{ flexShrink: 1, flexGrow: stacked ? 0 : 1, color: t.text.primary, fontSize: 40, letterSpacing: -1.2, fontWeight: '800' }}>{categoryPresentation[filter].title}</Text>
      {unread > 0 && <Button label={busy ? 'Marking…' : 'Mark all'} icon="checkmark-done-outline" disabled={busy} onPress={onMarkAll} />}
    </View>
    <Text accessibilityLiveRegion="polite" style={{ color: t.text.secondary, fontSize: 14, lineHeight: 21 }}>{subtitle}</Text>
  </View>;
}

export function Hero({ filter, onPress }: { filter: AlertCategory; onPress: (route: string) => void }) {
  const { t, p } = useHomeVisuals();
  const { fontScale } = useWindowDimensions();
  const look = categoryPresentation[filter];
  return <View style={{ borderRadius: 20, borderWidth: 1, borderColor: t.action.link, backgroundColor: p.surface,
    shadowColor: t.brand.orange, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
    <LinearGradient colors={p.heroLighting} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
      style={{ padding: 17, gap: 18, borderRadius: 19, overflow: 'hidden' }}>
      <LightTrail />
      <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', alignItems: 'flex-start', gap: 13 }}>
        <IconTile icon={look.icon} />
        <View style={{ flex: fontScale > 1.3 ? undefined : 1, gap: 6 }}>
          <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{look.hero}</Text>
          <Text style={{ color: t.text.secondary, fontSize: 14, lineHeight: 21 }}>{look.detail}</Text>
        </View>
      </View>
      <Button label={look.action} icon={look.icon === 'notifications-outline' ? 'people-outline' : look.icon} primary chevron onPress={() => onPress(look.route)} />
    </LinearGradient>
  </View>;
}

function IconTile({ icon, quiet = false }: { icon: Icon; quiet?: boolean }) {
  const { t, p } = useHomeVisuals();
  return <View style={{ width: 48, height: 52, borderRadius: 15, borderWidth: 1, borderColor: quiet ? p.edge : p.warmEdge,
    backgroundColor: quiet ? t.surface.inset : t.selection.background, justifyContent: 'center', alignItems: 'center' }}>
    <Ionicons name={icon} size={27} color={quiet ? t.text.secondary : t.action.link} />
  </View>;
}

export function Filters({ options, selected, onSelect }: { options: AlertCategory[]; selected: AlertCategory; onSelect: (value: AlertCategory) => void }) {
  const { t, p } = useHomeVisuals();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<AlertCategory, number>>>({});
  const showSelected = () => { const x = positions.current[selected]; if (x !== undefined) scroll.current?.scrollTo({ x: Math.max(0, x - 8), animated: false }); };
  useEffect(showSelected, [selected]);
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 3 }}>
    {options.map(option => {
      const active = selected === option;
      return <Pressable key={option} accessibilityRole="tab" accessibilityLabel={`${option} alerts`} accessibilityState={{ selected: active }}
        onLayout={e => { positions.current[option] = e.nativeEvent.layout.x; if (active) showSelected(); }} onPress={() => onSelect(option)}
        style={({ pressed }) => ({ borderRadius: 26, overflow: 'hidden', minHeight: 48, borderWidth: 1, borderColor: pressed ? t.focus.ring : active ? t.brand.orange : p.edge })}>
        <LinearGradient colors={active ? p.cta : [p.surface, t.surface.inset]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {option !== 'All' && <Ionicons name={categoryPresentation[option].icon} size={20} color={active ? t.text.onBrand : t.text.secondary} />}
          <Text style={{ color: active ? t.text.onBrand : t.text.primary, fontSize: 13, fontWeight: '700' }}>{option}</Text>
        </LinearGradient>
      </Pressable>;
    })}
  </ScrollView>;
}

export function InboxHeading({ caption }: { caption: string }) {
  const { t } = useHomeVisuals();
  return <View style={{ gap: 3 }}>
    <Text accessibilityRole="header" style={{ color: t.text.primary, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 }}>Inbox</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: t.text.secondary, fontSize: 13 }}>{caption}</Text>
  </View>;
}

export function NotificationCard({ item, category, date, onOpen, onDismiss, onPing }: {
  item: AppNotification; category: AlertCategory; date: string; onOpen: () => void; onDismiss: () => void; onPing?: () => void;
}) {
  const { t, p } = useHomeVisuals();
  const { fontScale, width } = useWindowDimensions();
  const unread = !item.readAt;
  const stacked = fontScale > 1.3 || width < 350;
  return <View style={{ borderRadius: 19, borderWidth: 1, borderColor: unread ? t.action.link : p.edge, backgroundColor: p.surface, overflow: 'hidden' }}>
    <LinearGradient colors={unread ? p.heroLighting : [p.surface, t.surface.inset]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }}
      style={{ padding: 15, gap: 13 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} accessibilityHint={unread ? 'Unread alert. Opens the related screen and marks this alert as read.' : 'Read alert. Opens the related screen.'}
        onPress={onOpen} style={{ minHeight: 48, gap: 13, flexDirection: stacked ? 'column' : 'row', alignItems: 'flex-start' }}>
        <IconTile icon={item.type === 'ping' ? 'people-outline' : categoryPresentation[category].icon} quiet={!unread} />
        <View style={{ flex: stacked ? undefined : 1, alignSelf: 'stretch', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
            <Text style={{ flex: 1, color: t.text.primary, fontSize: 17, fontWeight: unread ? '800' : '600', lineHeight: 23 }}>{item.title}</Text>
            {unread && <View accessibilityLabel="Unread" style={{ width: 8, height: 8, marginTop: 7, borderRadius: 4, backgroundColor: t.navigation.badge }} />}
            <Ionicons name="chevron-forward" size={17} color={t.text.secondary} />
          </View>
          {!!item.body && <Text style={{ color: t.text.secondary, fontSize: 14, lineHeight: 21 }}>{item.body}</Text>}
          <Text style={{ color: t.text.secondary, fontSize: 12, lineHeight: 18 }}>{date} · {category}</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {onPing && <Button label="Ping back" icon="paper-plane-outline" onPress={onPing} />}
        <Button label="Dismiss" icon="close-outline" onPress={onDismiss} />
      </View>
    </LinearGradient>
  </View>;
}

export function InboxState({ loading, error, signedOut, filter, retry }: {
  loading: boolean; error: boolean; signedOut: boolean; filter: AlertCategory; retry: () => void;
}) {
  const { t, p } = useHomeVisuals();
  return <View style={{ borderRadius: 19, borderWidth: 1, borderColor: p.edge, padding: 20, gap: 12, backgroundColor: p.surface }}>
    {loading && !signedOut ? <ActivityIndicator accessibilityLabel="Loading account alerts" color={t.action.link} /> :
      <Ionicons name={error ? 'cloud-offline-outline' : 'notifications-outline'} size={30} color={t.action.link} />}
    <Text accessibilityRole={error ? 'alert' : undefined} style={{ color: t.text.primary, fontSize: 18, fontWeight: '700' }}>
      {signedOut ? 'Sign in to view your alerts' : error ? 'Alerts couldn’t load' : loading ? 'Loading account alerts…' : filter === 'All' ? 'Your inbox is clear' : `No ${filter.toLowerCase()} alerts yet`}
    </Text>
    {!loading && !signedOut && <Text style={{ color: t.text.secondary, fontSize: 14, lineHeight: 21 }}>
      {error ? 'Check your connection and try again.' : 'Recorded updates will appear here when available.'}
    </Text>}
    {error && !signedOut && <Button label="Retry alerts" icon="refresh-outline" onPress={retry} />}
  </View>;
}
