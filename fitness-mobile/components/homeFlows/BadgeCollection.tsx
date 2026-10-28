import { useTaskPresentation } from '@/components/designPreview/Appearance';
import { DeskIntro, DeskColumns, DeskSection, StatusNote } from '@/components/accountSettings/PremiumUI';
import { Button, TaskSheet } from '@/components/somata/TaskUI';
import type { BadgeDef, BadgeUnlockState } from '@/services/badges/types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import { FlowPage } from './FlowUI';

function iconFor(badge: BadgeDef): keyof typeof Ionicons.glyphMap {
  return badge.icon in Ionicons.glyphMap ? badge.icon as keyof typeof Ionicons.glyphMap : 'ribbon';
}
function rarityLabel(rarity: string) { return rarity === 'common' ? 'Common' : rarity === 'rare' ? 'Rare' : 'Epic'; }

export function BadgeCollection({ loaded, groups, unlocks, featured, unlockedCount, onSelect, onBack }: {
  loaded: boolean; groups: { key: string; label: string; items: BadgeDef[] }[];
  unlocks: Record<string, BadgeUnlockState>; featured: string[]; unlockedCount: number;
  onSelect: (id: string) => void; onBack: () => void;
}) {
  const { F, t, p } = useTaskPresentation();
  return <FlowPage title="Your collection." eyebrow="Badges" onBack={onBack}>
    <DeskIntro icon="ribbon-outline" label="Account / on this device" title="Small wins. Recorded.">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
        <Text style={{ ...F.value, fontSize: 56 }}>{loaded ? unlockedCount : '—'}</Text>
        <Text style={F.body}>{loaded ? 'badges unlocked' : 'Reading local collection…'}</Text>
      </View><Text style={F.caption}>Open a badge for its criteria or to manage your featured selection. This collection is stored on this device.</Text>
    </DeskIntro>
    {groups.map((group, index) => <View key={group.key} style={{ gap: 14 }}>
      <View style={{ gap: 7 }}><Text style={F.eyebrow}>{String(index + 1).padStart(2, '0')} / COLLECTION</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'baseline' }}>
          <Text accessibilityRole="header" style={{ ...F.heading, flex: 1 }}>{group.label}</Text>
          <Text style={F.caption}>{loaded ? `${group.items.filter(b => !!unlocks[b.id]).length}/${group.items.length} earned` : 'Loading…'}</Text>
        </View>
      </View>
      <DeskColumns>{group.items.map(badge => {
        const unlocked = !!unlocks[badge.id], isFeatured = featured.includes(badge.id);
        return <Pressable key={badge.id} onPress={() => onSelect(badge.id)} accessibilityRole="button"
          accessibilityLabel={`${badge.title}, ${unlocked ? 'unlocked' : 'locked'}${isFeatured ? ', featured' : ''}. View details`}
          style={({ pressed }) => ({ flex: 1, padding: 16, gap: 14, borderRadius: 20, backgroundColor: t.surface.primary,
            borderWidth: 1, borderColor: unlocked ? p.warmEdge : t.border.subtle, opacity: pressed ? .75 : 1 })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ padding: 14, borderRadius: 18, backgroundColor: unlocked ? t.selection.background : t.surface.inset }}>
              <Ionicons name={iconFor(badge)} size={30} color={unlocked ? t.status.warning : t.text.tertiary} />
            </View><Ionicons name={isFeatured ? 'star' : unlocked ? 'checkmark-circle' : 'lock-closed-outline'} size={19} color={unlocked ? t.status.warning : t.text.tertiary} />
          </View><Text style={{ ...F.heading, fontSize: 17 }}>{badge.title}</Text>
          <Text style={F.caption}>{badge.subtitle}</Text>
          <Text style={{ ...F.caption, color: unlocked ? t.status.warning : t.text.secondary }}>{rarityLabel(badge.rarity)} · {unlocked ? 'Unlocked' : 'Locked'}{isFeatured ? ' · Featured' : ''}</Text>
        </Pressable>;
      })}</DeskColumns>
    </View>)}
  </FlowPage>;
}
export function BadgeCollectionDetail({ badge, unlocked, category, isFeatured, onToggleFeature, onClose }: {
  badge: BadgeDef; unlocked?: BadgeUnlockState; category: string; isFeatured: boolean;
  onToggleFeature: () => void; onClose: () => void;
}) {
  const { F, t } = useTaskPresentation();
  const criteria = Array.isArray(badge.criteriaText) ? badge.criteriaText.map(String) : badge.criteriaText ? [String(badge.criteriaText)] : [];
  return <TaskSheet visible title="Badge details" onClose={onClose}>
    <DeskIntro icon={iconFor(badge)} label={category} title={badge.title} detail={badge.subtitle}>
      <StatusNote icon={unlocked ? 'checkmark-circle-outline' : 'lock-closed-outline'} title={`${rarityLabel(badge.rarity)} · ${unlocked ? 'Unlocked' : 'Locked'}`}
        detail={unlocked?.unlockedAt ? `Earned ${new Date(unlocked.unlockedAt).toLocaleDateString()}` : undefined} />
    </DeskIntro><Text style={F.body}>{badge.description}</Text>
    <DeskSection icon="flag-outline" title="How it’s earned">
      {criteria.map((criterion, i) => <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
        <Text style={{ ...F.eyebrow, color: t.status.warning }}>{String(i + 1).padStart(2, '0')}</Text><Text style={{ ...F.body, flex: 1 }}>{criterion}</Text>
      </View>)}
    </DeskSection>
    {!!badge.canFeature && <Button primary icon={isFeatured ? 'star' : 'star-outline'} label={isFeatured ? 'Remove from featured' : 'Feature on profile'}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleFeature(); }} />}
  </TaskSheet>;
}
