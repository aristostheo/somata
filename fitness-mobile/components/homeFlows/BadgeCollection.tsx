import { useSomataTheme } from "@/components/somata/theme";
import type { BadgeDef, BadgeUnlockState } from "@/services/badges/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlowPage } from "./FlowUI";

function iconFor(badge: BadgeDef): keyof typeof Ionicons.glyphMap {
  return badge.icon in Ionicons.glyphMap ? badge.icon as keyof typeof Ionicons.glyphMap : "ribbon";
}
function rarityLabel(rarity: string) {
  return rarity === "common" ? "Common" : rarity === "rare" ? "Rare" : "Epic";
}

export function BadgeCollection({ loaded, groups, unlocks, featured, unlockedCount, onSelect, onBack }: {
  loaded: boolean; groups: { key: string; label: string; items: BadgeDef[]; }[];
  unlocks: Record<string, BadgeUnlockState>; featured: string[]; unlockedCount: number;
  onSelect: (id: string) => void; onBack: () => void;
}) {
  const { D, F } = useSomataTheme();

  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 350 || fontScale > 1.3;
  return <FlowPage title="Your collection." eyebrow="Badges" onBack={onBack}>

    <LinearGradient colors={[D.tint, D.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ padding: 24, borderRadius: 26, gap: 14 }}>

      <View style={{ ...F.row, alignItems: "flex-start", flexWrap: "wrap" }}>

        <View style={{ flex: 1, minWidth: 140, gap: 4 }}>

          <Text style={{ ...F.eyebrow, color: D.lime }}>LOCAL COLLECTION</Text>

          <Text style={{ ...F.value, fontSize: 58 }}>{loaded ? unlockedCount : "—"}</Text>

          <Text style={{ ...F.body, color: D.muted }}>{loaded ? "badges unlocked" : "Reading local collection…"}</Text>

        </View>

        <View style={{
          width: 76, height: 76, borderRadius: 38, borderWidth: 1,
          borderColor: "#578B65", alignItems: "center", justifyContent: "center"
        }}>

          <Ionicons name="ribbon-outline" size={40} color={D.lime} />

        </View>

      </View>

      <Text style={{ ...F.caption, color: D.muted }}>Stored on this device. Open a badge to see its criteria or manage your featured selection.</Text>

    </LinearGradient>

    {groups.map((group, index) => <View key={group.key} style={{ gap: 14 }}>

      <View style={{ ...F.row, alignItems: "flex-start" }}>

        <View style={{ flex: 1, gap: 5 }}>

          <Text style={F.eyebrow}>{String(index + 1).padStart(2, "0")} / COLLECTION</Text>

          <Text accessibilityRole="header" style={F.heading}>{group.label}</Text>

        </View>

        <Text style={F.caption}>{group.items.filter((b) => !!unlocks[b.id]).length}/{group.items.length}</Text>

      </View>

      <View style={F.wrap}>

        {group.items.map((badge) => {
          const unlocked = !!unlocks[badge.id];
          const isFeatured = featured.includes(badge.id);
          return <Pressable key={badge.id} onPress={() => onSelect(badge.id)} accessibilityRole="button"
            accessibilityLabel={`${badge.title}, ${unlocked ? "unlocked" : "locked"}${isFeatured ? ", featured" : ""}. View details`}
            style={({ pressed }) => ({
              width: singleColumn ? "100%" : "48%", flexGrow: 1,
              padding: 17, gap: 14, borderRadius: 21, backgroundColor: unlocked ? D.tint : D.card,
              opacity: pressed ? 0.7 : 1, borderWidth: 1, borderColor: unlocked ? "#355344" : D.line
            })}>

            <View style={F.row}>

              <View style={{
                width: 49, height: 49, borderRadius: 17, backgroundColor: unlocked ? D.lime : D.raised,
                justifyContent: "center", alignItems: "center"
              }}>

                <Ionicons name={iconFor(badge)} color={unlocked ? D.ink : D.muted} size={26} />

              </View>

              <Ionicons name={isFeatured ? "star" : unlocked ? "checkmark-circle" : "lock-closed-outline"}
                size={17} color={unlocked || isFeatured ? D.lime : D.muted} />

            </View>

            <View style={{ gap: 5 }}>

              <Text style={{ ...F.heading, fontSize: 17 }}>{badge.title}</Text>

              <Text style={F.caption}>{badge.subtitle}</Text>

            </View>

            <Text style={{ ...F.caption, color: unlocked ? D.lime : D.muted }}>
              {rarityLabel(badge.rarity)} · {unlocked ? "Unlocked" : "Locked"}
            </Text>

          </Pressable>;
        })}

      </View>

    </View>)}

  </FlowPage>;
}

export function BadgeCollectionDetail({ badge, unlocked, category, isFeatured, onToggleFeature, onClose }: {
  badge: BadgeDef; unlocked?: BadgeUnlockState; category: string; isFeatured: boolean;
  onToggleFeature: () => void; onClose: () => void;
}) {
  const { D, F } = useSomataTheme();

  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const criteria = Array.isArray(badge.criteriaText) ? badge.criteriaText.map(String) : badge.criteriaText ? [String(badge.criteriaText)] : [];
  return <Modal transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose}>

    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#000000B3" }}>

      <Pressable accessibilityRole="button" accessibilityLabel="Close badge details" onPress={onClose}
        style={{ position: "absolute", inset: 0 }} />

      <View accessibilityViewIsModal style={{
        maxHeight: "90%", backgroundColor: D.bg,
        borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12
      }}>

        <View style={{ ...F.row, paddingHorizontal: 24 }}>

          <Text style={{ ...F.eyebrow, flex: 1 }}>BADGE / {category.toUpperCase()}</Text>

          <Pressable accessibilityRole="button" accessibilityLabel="Close badge details"
            onPress={() => { void Haptics.selectionAsync(); onClose(); }}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: D.card, alignItems: "center", justifyContent: "center" }}>

            <Ionicons name="close" size={23} color={D.text} />

          </Pressable>

        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 28, gap: 24 }}>

          <View style={{ alignItems: "center", gap: 14 }}>

            <LinearGradient colors={unlocked ? [D.teal, D.lime] : ["#343D39", "#1D2522"]}
              style={{ width: 114, height: 114, borderRadius: 57, alignItems: "center", justifyContent: "center" }}>

              <Ionicons name={iconFor(badge)} size={52} color={unlocked ? D.ink : D.muted} />

            </LinearGradient>

            <Text accessibilityRole="header" style={{ ...F.title, fontSize: 30, textAlign: "center" }}>{badge.title}</Text>

            <Text style={{ ...F.body, textAlign: "center" }}>{badge.subtitle}</Text>

            <Text style={{ ...F.caption, color: D.lime }}>{rarityLabel(badge.rarity)} · {unlocked ? "Unlocked" : "Locked"}
              {unlocked?.unlockedAt ? ` · ${new Date(unlocked.unlockedAt).toLocaleDateString()}` : ""}</Text>

          </View>

          <Text style={F.body}>{badge.description}</Text>

          <View style={{ gap: 16 }}>

            <Text accessibilityRole="header" style={F.heading}>How it’s earned</Text>

            {criteria.map((criterion, index) => <View key={index} style={{ flexDirection: "row", gap: 13 }}>

              <Text style={{ ...F.eyebrow, paddingTop: 3 }}>{String(index + 1).padStart(2, "0")}</Text>

              <Text style={{ ...F.body, flex: 1, color: D.text }}>{criterion}</Text>

            </View>)}

          </View>

          {!!badge.canFeature && <Pressable accessibilityRole="button"
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleFeature(); }}
            style={({ pressed }) => ({
              ...F.row, justifyContent: "center", padding: 18, borderRadius: 18,
              minHeight: 52, backgroundColor: D.lime, opacity: pressed ? 0.75 : 1
            })}>

            <Ionicons name={isFeatured ? "star" : "star-outline"} size={21} color={D.ink} />

            <Text style={{ flexShrink: 1, color: D.ink, fontSize: 15, fontWeight: "800" }}>
              {isFeatured ? "Remove from featured" : "Feature on profile"}
            </Text>

          </Pressable>}

        </ScrollView>

      </View>

    </View>

  </Modal>;
}
