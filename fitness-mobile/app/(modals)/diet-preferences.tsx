// app/(modals)/diet-preferences.tsx
// Drop-in ✅
// Full-screen premium editor for Diet Preferences
// Depends on: expo-router, expo-linear-gradient, expo-blur, expo-haptics, @expo/vector-icons
// Uses your ThemeProvider + profile service

import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import {
  ensureProfile,
  subscribeProfile,
  updateProfile,
} from "@/services/profile";
import { withAlpha } from "@/components/profile/premium/ui";

import {
  type DietPreferences,
  DEFAULT_DIET_PREFERENCES,
  type DietRestriction,
  type Allergy,
  type MoreOfGoal,
  type AvoidLimitGoal,
  uniqTokens,
  normalizeToken,
  computeDietPrefsCompletion,
} from "@/services/profile/dietPreferences";

type ChipOption<T extends string> = {
  key: T;
  label: string;
  hint?: string;
};

const RESTRICTIONS: ChipOption<DietRestriction>[] = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "pescatarian", label: "Pescatarian" },
  { key: "halal", label: "Halal" },
  { key: "kosher", label: "Kosher" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "lactose_free", label: "Lactose-free" },
  { key: "dairy_free", label: "Dairy-free" },
  { key: "low_carb", label: "Lower carb" },
  { key: "keto", label: "Keto" },
  { key: "paleo", label: "Paleo" },
];

const ALLERGIES: ChipOption<Allergy>[] = [
  { key: "peanuts", label: "Peanuts" },
  { key: "tree_nuts", label: "Tree nuts" },
  { key: "dairy", label: "Dairy" },
  { key: "eggs", label: "Eggs" },
  { key: "shellfish", label: "Shellfish" },
  { key: "fish", label: "Fish" },
  { key: "soy", label: "Soy" },
  { key: "wheat", label: "Wheat" },
  { key: "sesame", label: "Sesame" },
];

const MORE_OF: ChipOption<MoreOfGoal>[] = [
  { key: "protein", label: "More protein", hint: "e.g. higher-protein meals" },
  { key: "fiber", label: "More fiber", hint: "more filling, steadier energy" },
  {
    key: "whole_foods",
    label: "More whole foods",
    hint: "less ultra-processed",
  },
  { key: "hydration", label: "More hydration", hint: "soups, fruits, fluids" },
  { key: "vegetables", label: "More veggies", hint: "easy add-ins, blends" },
  { key: "omega_3", label: "More omega-3", hint: "fish, chia, flax" },
  { key: "iron", label: "More iron", hint: "meat, legumes, greens" },
  { key: "calcium", label: "More calcium", hint: "dairy or fortified options" },
];

const AVOID_LIMIT: ChipOption<AvoidLimitGoal>[] = [
  { key: "added_sugar", label: "Less added sugar" },
  { key: "fried_foods", label: "Less fried food" },
  { key: "processed_foods", label: "Less processed food" },
  { key: "sodium", label: "Less sodium" },
  { key: "alcohol", label: "Less alcohol" },
  { key: "high_saturated_fat", label: "Less saturated fat" },
];

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useProfileFlowTheme();
  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 17 }}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const { colors } = useProfileFlowTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected
            ? withAlpha(colors.primary, 0.42)
            : withAlpha(colors.border, 0.55),
          backgroundColor: selected
            ? withAlpha(colors.primary, pressed ? 0.22 : 0.16)
            : pressed
            ? colors.surface2
            : colors.surface,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon}
      <Text
        style={{
          color: selected ? colors.text : colors.muted,
          fontWeight: "600",
          fontSize: 12.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {children}
    </View>
  );
}

function toggleInList<T extends string>(arr: T[], key: T) {
  return arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
}

function TokenInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (token: string) => void;
}) {
  const { colors } = useProfileFlowTheme();
  const [text, setText] = useState("");

  const submit = () => {
    const t = normalizeToken(text);
    if (!t) return;
    setText("");
    Haptics.selectionAsync();
    onAdd(t);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.55),
        backgroundColor: colors.surface,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Ionicons name="add-circle-outline" size={18} color={colors.muted} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={withAlpha(colors.muted, 0.7)}
        style={{
          flex: 1,
          color: colors.text,
          fontWeight: "500",
          fontSize: 13,
          paddingVertical: 0,
        }}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Pressable
        onPress={submit}
        style={({ pressed }) => ({
          paddingHorizontal: 10,
          minHeight: 44,
          justifyContent: "center",
          borderRadius: 12,
          backgroundColor: withAlpha(colors.primary, pressed ? 0.22 : 0.16),
          borderWidth: 1,
          borderColor: withAlpha(colors.primary, 0.35),
        })}
      >
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
          Add
        </Text>
      </Pressable>
    </View>
  );
}

export default function DietPreferencesModal() {
  const router = useRouter();
  const { colors, isDark } = useProfileFlowTheme();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<DietPreferences>(DEFAULT_DIET_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // hydrate from backend
  React.useEffect(() => {
    if (!user?.uid) return;

    ensureProfile(user.uid).catch(() => {});
    return subscribeProfile(user.uid, (p) => {
      const from = (p as any)?.dietPreferences as DietPreferences | undefined;
      if (!hydrated) {
        setPrefs({
          ...DEFAULT_DIET_PREFERENCES,
          ...(from || {}),
          dislikes: uniqTokens(from?.dislikes || []),
          likes: uniqTokens(from?.likes || []),
        });
        setHydrated(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, hydrated]);

  const completion = useMemo(() => computeDietPrefsCompletion(prefs), [prefs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const pack = [
      ...RESTRICTIONS.map((o) => ({ group: "Restrictions", ...o })),
      ...ALLERGIES.map((o) => ({ group: "Allergies", ...o })),
      ...MORE_OF.map((o) => ({ group: "More of", ...o })),
      ...AVOID_LIMIT.map((o) => ({ group: "Avoid/limit", ...o })),
    ];

    return pack.filter((x) => x.label.toLowerCase().includes(q));
  }, [query]);

  const onSave = useCallback(async () => {
    if (!user?.uid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      const clean: DietPreferences = {
        ...prefs,
        dislikes: uniqTokens(prefs.dislikes || []),
        likes: uniqTokens(prefs.likes || []),
        notes: prefs.notes ? prefs.notes.trim() : "",
        updatedAt: Date.now(),
      };

      await updateProfile(user.uid, { dietPreferences: clean } as any);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [prefs, router, user?.uid]);

  const TopBar = (
    <View
      style={{
        paddingTop: 10,
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: withAlpha(colors.border, 0.6),
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surface2 : colors.surface,
            borderWidth: 0,
            borderColor: withAlpha(colors.border, 0.55),
          })}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 20 }}>
            Diet Preferences
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>
            Choose what fits you — we’ll adapt suggestions.
          </Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.primary, pressed ? 0.24 : 0.18),
            borderWidth: 0,
            borderColor: withAlpha(colors.primary, 0.35),
            opacity: saving ? 0.75 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="Save diet preferences"
        >
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ marginTop: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.55),
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search restrictions, allergies, goals…"
            placeholderTextColor={withAlpha(colors.muted, 0.7)}
            style={{
              flex: 1,
              color: colors.text,
              fontWeight: "500",
              fontSize: 13,
              paddingVertical: 0,
            }}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setQuery("");
              }}
              hitSlop={5}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.surface2 : "transparent",
              })}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Completion microcopy */}
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>
          {completion.state === "empty"
            ? "Optional — add anything that helps us avoid misses."
            : completion.state === "partial"
            ? `Nice. ${completion.filled}/${completion.total} sections set.`
            : "Set. Recommendations can match you more closely."}
        </Text>
      </View>
    </View>
  );

  const renderSearchResults = filtered && filtered.length > 0;

  const Body = (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 120,
        gap: 12,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      {renderSearchResults ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.55),
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
            Search results
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>
            Tap to toggle. We’ll place it in the right section.
          </Text>

          <View style={{ height: 10 }} />

          <ChipWrap>
            {filtered!.slice(0, 18).map((x) => {
              const selected =
                x.group === "Restrictions"
                  ? prefs.restrictions.includes(x.key as any)
                  : x.group === "Allergies"
                  ? prefs.allergies.includes(x.key as any)
                  : x.group === "More of"
                  ? prefs.moreOf.includes(x.key as any)
                  : prefs.avoidLimit.includes(x.key as any);

              return (
                <Chip
                  key={`${x.group}:${x.key}`}
                  label={`${x.label}`}
                  selected={selected}
                  onPress={() => {
                    setPrefs((p) => {
                      if (x.group === "Restrictions") {
                        return {
                          ...p,
                          restrictions: toggleInList(
                            p.restrictions,
                            x.key as any
                          ),
                        };
                      }
                      if (x.group === "Allergies") {
                        return {
                          ...p,
                          allergies: toggleInList(p.allergies, x.key as any),
                        };
                      }
                      if (x.group === "More of") {
                        return {
                          ...p,
                          moreOf: toggleInList(p.moreOf, x.key as any),
                        };
                      }
                      return {
                        ...p,
                        avoidLimit: toggleInList(p.avoidLimit, x.key as any),
                      };
                    });
                  }}
                  icon={
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: withAlpha(colors.border, 0.18),
                        borderWidth: 1,
                        borderColor: withAlpha(colors.border, 0.35),
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 10,
                          fontWeight: "600",
                        }}
                      >
                        {x.group[0]}
                      </Text>
                    </View>
                  }
                />
              );
            })}
          </ChipWrap>
        </View>
      ) : null}

      <Section
        title="Dietary restrictions"
        subtitle="Choose what you follow. If it’s not strict, you can still select it — we’ll treat it as a preference."
      >
        <ChipWrap>
          {RESTRICTIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={prefs.restrictions.includes(o.key)}
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  restrictions: toggleInList(p.restrictions, o.key),
                }))
              }
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="Allergies"
        subtitle="Safety first. If you’re unsure, skip it — you can always add later."
      >
        <ChipWrap>
          {ALLERGIES.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={prefs.allergies.includes(o.key)}
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  allergies: toggleInList(p.allergies, o.key),
                }))
              }
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="Dislikes"
        subtitle="Foods you’d rather not see in suggestions. Add in your own words."
      >
        <TokenInput
          placeholder='Add a dislike (e.g. "mushrooms")'
          onAdd={(t) =>
            setPrefs((p) => ({
              ...p,
              dislikes: uniqTokens([...(p.dislikes || []), t]),
            }))
          }
        />
        <ChipWrap>
          {(prefs.dislikes || []).map((t) => (
            <Chip
              key={`d:${t.toLowerCase()}`}
              label={t}
              selected
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  dislikes: (p.dislikes || []).filter((x) => x !== t),
                }))
              }
              icon={<Ionicons name="close" size={16} color={colors.muted} />}
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="Likes / favorites"
        subtitle="Foods you enjoy. We’ll bias suggestions toward these."
      >
        <TokenInput
          placeholder='Add a favorite (e.g. "chicken")'
          onAdd={(t) =>
            setPrefs((p) => ({
              ...p,
              likes: uniqTokens([...(p.likes || []), t]),
            }))
          }
        />
        <ChipWrap>
          {(prefs.likes || []).map((t) => (
            <Chip
              key={`l:${t.toLowerCase()}`}
              label={t}
              selected
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  likes: (p.likes || []).filter((x) => x !== t),
                }))
              }
              icon={<Ionicons name="close" size={16} color={colors.muted} />}
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="More of"
        subtitle="Gentle goals — we’ll tilt recommendations in this direction."
      >
        <ChipWrap>
          {MORE_OF.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={prefs.moreOf.includes(o.key)}
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  moreOf: toggleInList(p.moreOf, o.key),
                }))
              }
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="Avoid / limit"
        subtitle="Optional. This helps us reduce suggestions you’d rather not see often."
      >
        <ChipWrap>
          {AVOID_LIMIT.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={prefs.avoidLimit.includes(o.key)}
              onPress={() =>
                setPrefs((p) => ({
                  ...p,
                  avoidLimit: toggleInList(p.avoidLimit, o.key),
                }))
              }
            />
          ))}
        </ChipWrap>
      </Section>

      <Section
        title="Notes"
        subtitle="Anything else? Example: “no spicy”, “simple meals”, “quick prep”."
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.55),
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <TextInput
            value={prefs.notes || ""}
            onChangeText={(t) => setPrefs((p) => ({ ...p, notes: t }))}
            placeholder="Optional notes…"
            placeholderTextColor={withAlpha(colors.muted, 0.7)}
            style={{
              color: colors.text,
              fontWeight: "500",
              fontSize: 13,
              minHeight: 44,
              paddingVertical: 0,
            }}
            multiline
          />
        </View>
      </Section>

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setPrefs(DEFAULT_DIET_PREFERENCES);
        }}
        style={({ pressed }) => ({
          marginTop: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: withAlpha(colors.border, 0.55),
          backgroundColor: pressed ? colors.surface2 : colors.surface,
          alignItems: "center",
        })}
        accessibilityRole="button"
        accessibilityLabel="Reset preferences"
      >
        <Text style={{ color: colors.muted, fontWeight: "600" }}>
          Reset to empty
        </Text>
      </Pressable>

      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          lineHeight: 16,
          marginTop: 6,
        }}
      >
        Microcopy promise: This is for personalization, not judgment. You can
        leave anything blank.
      </Text>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlowAtmosphere />
      {TopBar}
      {Body}
    </KeyboardAvoidingView>
  );
}
