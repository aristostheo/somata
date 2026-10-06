// app/friends/[uid].tsx  (works even if your file is [id].tsx)
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";

import BottomTabSpacer from "@/components/ui/BottomTapSpacer";
import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { subscribeProfile, type Profile } from "@/services/profile";
import { getFriendVisibility } from "@/services/friends/visibility";

import { withAlpha } from "@/components/workouts/utils/withAlpha";
import { subscribeFoodsByDate, type FoodEntry } from "@/services/nutrition";
import {
  addComment,
  removeReaction,
  subscribeComments,
  subscribeReactions,
  toggleReaction,
  type Comment,
  type Reaction,
} from "@/services/social";
import { notifyComment, notifyReaction } from "@/services/notifications";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const softShadow = Platform.select({
  ios: {
    shadowColor: "black",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 8 },
});

export default function FriendMealsScreen() {
  // ✅ Support both param names: [uid].tsx or [id].tsx
  const params = useLocalSearchParams<{
    uid?: string;
    id?: string;
    name?: string;
  }>();
  const friendUid = ((params.uid ?? params.id) || "").toString();
  const friendName = (params.name || "").toString();

  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const todayISO = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  const datePills = useMemo(() => {
    const days: string[] = [];
    const base = new Date(todayISO + "T00:00:00");
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      days.push(iso);
    }
    return days;
  }, [todayISO]);

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!friendUid) return;
    return subscribeProfile(friendUid, setProfile);
  }, [friendUid]);

  const visibility = getFriendVisibility(profile);
  const mealsVisible = visibility.enabled && visibility.nutrition?.mealsLoggedToday;

  // ✅ OLD BACKEND LOGIC (unchanged): Stream meals for selected day
  useEffect(() => {
    if (!friendUid || !user?.uid || !mealsVisible) {
      setFoods([]);
      return;
    }

    setLoading(true);
    const unsub = subscribeFoodsByDate(friendUid, selectedDate, (rows) => {
      setFoods(rows || []);
      setLoading(false);
    });

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [friendUid, selectedDate, user?.uid, mealsVisible]);

  const totals = useMemo(() => {
    return foods.reduce(
      (acc, f) => {
        acc.calories += Number((f as any).calories || 0);
        acc.protein += Number((f as any).protein || 0);
        acc.carbs += Number((f as any).carbs || 0);
        acc.fat += Number((f as any).fat || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [foods]);

  const grouped = useMemo(() => {
    return MEAL_ORDER.map((meal) => ({
      meal,
      items: foods.filter(
        (f) => ((f as any).meal || "").toLowerCase() === meal
      ),
    }));
  }, [foods]);

  const title = friendName || friendUid || "Friend";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* premium background wash */}
      <LinearGradient
        colors={
          isDark
            ? [
                "rgba(255,255,255,0.06)",
                "rgba(255,255,255,0.00)",
                "rgba(0,0,0,0.00)",
              ]
            : [
                "rgba(0,0,0,0.04)",
                "rgba(255,255,255,0.00)",
                "rgba(255,255,255,0.00)",
              ]
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* floating ribbons */}
      <Ribbon
        side="right"
        colors={[colors.info, colors.danger] as const}
        opacity={isDark ? 0.18 : 0.22}
      />
      <Ribbon
        side="left"
        top={260}
        colors={[colors.success, colors.warning] as const}
        opacity={isDark ? 0.14 : 0.18}
      />

      {/* header */}
      <View style={{ paddingTop: topInset + 12, paddingHorizontal: 16 }}>
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 360 }}
        >
          <BlurView
            intensity={isDark ? 28 : 55}
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.06)",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.70)",
              padding: 14,
              ...(softShadow as any),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 20,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {title}'s Meals
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  Browse by day • React & comment (keep it supportive)
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <GlassIconButton
                  icon="chevron-back"
                  label="Back"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.back();
                  }}
                />
                <GlassIconButton
                  icon="barbell-outline"
                  label="Workouts"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(
                      `/friends/${encodeURIComponent(
                        friendUid
                      )}/workouts?name=${encodeURIComponent(title)}`
                    );
                  }}
                />
              </View>
              </View>

            {!mealsVisible ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: withAlpha(colors.text, 0.05),
                  borderWidth: 1,
                  borderColor: withAlpha(colors.text, 0.08),
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {title} hasn't shared recent meals
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>
                  Meal sharing is private and controlled by your friend.
                </Text>
              </View>
            ) : null}

            {/* small debug hint if route param is missing */}
            {!friendUid ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.35),
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  Missing friend uid
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  Your route param is empty. Ensure the file name matches your
                  route:
                  {"\n"}• /friends/[uid].tsx expects “uid”
                  {"\n"}• /friends/[id].tsx expects “id”
                </Text>
              </View>
            ) : null}
          </BlurView>
        </MotiView>

        <View style={{ height: 12 }} />

        {/* date pills */}
        <BlurView
          intensity={isDark ? 22 : 45}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,255,255,0.68)",
            overflow: "hidden",
            padding: 10,
          }}
        >
          <Text
            style={{ color: colors.text, fontWeight: "900", marginBottom: 8 }}
          >
            Pick a day
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {datePills.map((d) => {
              const active = d === selectedDate;
              const dateObj = new Date(d + "T00:00:00");
              const label = dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              const weekday = dateObj.toLocaleDateString(undefined, {
                weekday: "short",
              });

              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDate(d);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${weekday} ${label}`}
                  accessibilityState={{ selected: active }}
                >
                  {({ pressed }) => (
                    <MotiView
                      animate={{
                        scale: pressed ? 0.97 : 1,
                        translateY: pressed ? 1 : 0,
                      }}
                      transition={{ type: "timing", duration: 130 }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: active
                          ? withAlpha(colors.primary, 0.55)
                          : withAlpha(colors.border, 0.9),
                        backgroundColor: withAlpha(
                          active ? colors.primary : colors.card,
                          active ? (isDark ? 0.18 : 0.14) : 0.96
                        ),
                        minWidth: 92,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 13,
                        }}
                      >
                        {weekday}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "800",
                          marginTop: 2,
                        }}
                      >
                        {label}
                      </Text>
                    </MotiView>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </BlurView>

        <View style={{ height: 12 }} />

        {/* totals */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <GlassStat
            label="Calories"
            value={`${Math.round(totals.calories)} kcal`}
          />
          <GlassStat
            label="Protein"
            value={`${Math.round(totals.protein)} g`}
          />
          <GlassStat label="Carbs" value={`${Math.round(totals.carbs)} g`} />
          <GlassStat label="Fat" value={`${Math.round(totals.fat)} g`} />
        </View>

        <View style={{ height: 10 }} />
      </View>

      {/* content */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
      >
        {loading ? (
          <PremiumLoadingCard label="Loading meals…" />
        ) : (
          grouped.map((group) => (
            <PremiumSectionCard
              key={group.meal}
              title={titleForMeal(group.meal)}
              subtitle={
                group.items.length ? `${group.items.length} items` : "No items"
              }
              icon={iconForMeal(group.meal)}
            >
              {group.items.length === 0 ? (
                <EmptyLine label="No meals logged." />
              ) : (
                <View style={{ gap: 10 }}>
                  {group.items.map((item, idx) => {
                    const targetId =
                      (item as any).id ??
                      (item as any).docId ??
                      (item as any).name ??
                      `${group.meal}-${idx}`;
                    return (
                      <MealRow
                        key={String(targetId)}
                        item={item}
                        friendUid={friendUid}
                        actorUid={user?.uid}
                        actorName={user?.displayName || user?.email || null}
                      />
                    );
                  })}
                </View>
              )}
            </PremiumSectionCard>
          ))
        )}

        <BottomTabSpacer extra={20} />
      </ScrollView>
    </View>
  );
}

/* ───────────────── UI blocks ───────────────── */

function GlassIconButton({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <BlurView
        intensity={isDark ? 22 : 44}
        style={{
          height: 42,
          borderRadius: 14,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
          backgroundColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.72)",
          overflow: "hidden",
        }}
      >
        <Ionicons name={icon} size={16} color={colors.text} />
        <Text
          style={{ color: colors.text, fontWeight: "900", letterSpacing: -0.1 }}
        >
          {label}
        </Text>
      </BlurView>
    </Pressable>
  );
}

function PremiumSectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: any;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  return (
    <BlurView
      intensity={isDark ? 24 : 50}
      style={{
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        backgroundColor: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.72)",
        ...(softShadow as any),
      }}
    >
      <LinearGradient
        colors={
          isDark
            ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]
            : ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.60)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 14 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)",
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.06)",
            }}
          >
            <Ionicons name={icon} size={18} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text style={{ color: colors.muted, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {children}
      </LinearGradient>
    </BlurView>
  );
}

function PremiumLoadingCard({ label }: { label: string }) {
  const { colors, isDark } = useTheme();
  return (
    <BlurView
      intensity={isDark ? 24 : 50}
      style={{
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        backgroundColor: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.72)",
        padding: 16,
        alignItems: "center",
        justifyContent: "center",
        ...(softShadow as any),
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.muted, marginTop: 10, fontWeight: "800" }}>
        {label}
      </Text>
    </BlurView>
  );
}

export function GlassStat({ label, value }: { label: string; value: string }) {
  const { colors, isDark } = useTheme();
  return (
    <BlurView
      intensity={isDark ? 22 : 44}
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        backgroundColor: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.70)",
        overflow: "hidden",
      }}
    >
      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 18,
          marginTop: 6,
          letterSpacing: -0.2,
        }}
      >
        {value}
      </Text>
    </BlurView>
  );
}

function EmptyLine({ label }: { label: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
        backgroundColor: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.70)",
      }}
    >
      <Text style={{ color: colors.muted, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function Ribbon({
  side,
  colors,
  top = -50,
  opacity = 0.2,
}: {
  side: "left" | "right";
  colors: readonly [string, string];
  top?: number;
  opacity?: number;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: "absolute",
        [side]: -70,
        top,
        width: 220,
        height: 220,
        borderRadius: 120,
        opacity,
        transform: [{ rotate: side === "left" ? "-14deg" : "16deg" }],
      }}
    />
  );
}

/* ───────────────── MealRow (keeps your old logic) ───────────────── */

function MealRow({
  item,
  friendUid,
  actorUid,
  actorName,
}: {
  item: FoodEntry;
  friendUid: string;
  actorUid?: string | null;
  actorName?: string | null;
}) {
  const { colors } = useTheme();

  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const targetId =
    (item as any).id ?? (item as any)?.docId ?? (item as any).name;

  useEffect(() => {
    if (!friendUid || !targetId) return;
    const unsub = subscribeReactions(friendUid, String(targetId), setReactions);
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [friendUid, targetId]);

  useEffect(() => {
    if (!friendUid || !targetId) return;
    const unsub = subscribeComments(friendUid, String(targetId), setComments);
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [friendUid, targetId]);

  const myReaction = reactions.find((r) => r.createdByUid === actorUid);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    reactions.forEach((r) => {
      map[r.kind] = (map[r.kind] || 0) + 1;
    });
    return map;
  }, [reactions]);

  const handleReact = async (kind: Reaction["kind"]) => {
    if (!actorUid || !friendUid || !targetId) return;
    const wasSame = myReaction && myReaction.kind === kind;
    try {
      if (wasSame) {
        await removeReaction(friendUid, String(targetId), actorUid);
      } else {
        await toggleReaction(friendUid, String(targetId), kind, {
          uid: actorUid,
          displayName: actorName ?? undefined,
        });
        await notifyReaction(friendUid, {
          fromUid: actorUid,
          fromName: actorName ?? undefined,
          targetId: String(targetId),
          targetLabel: (item as any).name || "Meal",
          kind,
        });
      }
    } catch (e: any) {
      Alert.alert("Couldn't react", e?.message || "Unknown error");
    }
  };

  const handleComment = async () => {
    if (!actorUid || !commentText.trim() || !friendUid || !targetId) return;
    try {
      await addComment(friendUid, String(targetId), commentText, {
        uid: actorUid,
        displayName: actorName ?? undefined,
      });
      await notifyComment(friendUid, {
        fromUid: actorUid,
        fromName: actorName ?? undefined,
        targetId: String(targetId),
        targetLabel: (item as any).name || "Meal",
        text: commentText,
      });
      setCommentText("");
    } catch (e: any) {
      Alert.alert("Couldn't comment", e?.message || "Unknown error");
    }
  };

  const macroChip = (label: string, val: number, suffix = "g") => (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: withAlpha(colors.text, 0.06),
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.9),
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800" }}>
        {label}: {Math.round(val)} {suffix}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.9),
        backgroundColor: withAlpha(colors.card, 0.96),
        borderRadius: 14,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(colors.primary, 0.16),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.35),
          }}
        >
          <Ionicons name="fast-food-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {(item as any).name || "Meal item"}
          </Text>
          <Text style={{ color: colors.muted }}>
            {(item as any).qty} {(item as any).unit || "serving"} •{" "}
            {Math.round(Number((item as any).calories || 0))} kcal
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {macroChip("P", Number((item as any).protein || 0))}
        {macroChip("C", Number((item as any).carbs || 0))}
        {macroChip("F", Number((item as any).fat || 0))}
      </View>

      {/* Reactions */}
      {targetId ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          {[
            { kind: "like" as const, icon: "thumbs-up-outline" },
            { kind: "fire" as const, icon: "flame-outline" },
            { kind: "clap" as const, icon: "hand-left-outline" },
          ].map((btn) => {
            const active = myReaction?.kind === btn.kind;
            return (
              <Pressable key={btn.kind} onPress={() => handleReact(btn.kind)}>
                {({ pressed }) => (
                  <MotiView
                    animate={{ scale: pressed ? 0.95 : 1 }}
                    transition={{ type: "timing", duration: 140 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: withAlpha(
                        colors.primary,
                        active ? 0.8 : 0.35
                      ),
                      backgroundColor: withAlpha(
                        colors.primary,
                        active ? 0.18 : 0.1
                      ),
                    }}
                  >
                    <Ionicons
                      name={btn.icon as any}
                      size={16}
                      color={active ? colors.primary : colors.muted}
                    />
                    <Text
                      style={{
                        color: active ? colors.text : colors.muted,
                        fontWeight: "800",
                      }}
                    >
                      {counts[btn.kind] || 0}
                    </Text>
                  </MotiView>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Comments */}
      {targetId ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Say something nice…"
              placeholderTextColor={withAlpha(colors.text, 0.6)}
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: withAlpha(colors.card, 0.96),
              }}
            />
            <Pressable onPress={handleComment} disabled={!commentText.trim()}>
              {({ pressed }) => (
                <MotiView
                  animate={{ scale: pressed ? 0.96 : 1 }}
                  transition={{ type: "timing", duration: 120 }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: withAlpha(
                      colors.primary,
                      commentText.trim() ? 0.22 : 0.12
                    ),
                    borderWidth: 1,
                    borderColor: withAlpha(colors.primary, 0.5),
                    opacity: commentText.trim() ? 1 : 0.6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    Post
                  </Text>
                </MotiView>
              )}
            </Pressable>
          </View>

          {comments.length ? (
            <View style={{ gap: 6 }}>
              {comments.slice(0, 3).map((c) => (
                <View
                  key={c.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.border, 0.9),
                    backgroundColor: withAlpha(colors.text, 0.04),
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {c.createdByName || "Friend"}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>No comments yet</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function iconForMeal(meal?: string) {
  switch ((meal || "").toLowerCase()) {
    case "breakfast":
      return "sunny-outline";
    case "lunch":
      return "restaurant-outline";
    case "dinner":
      return "moon-outline";
    default:
      return "fast-food-outline";
  }
}

function titleForMeal(meal?: string) {
  const m = (meal || "").toLowerCase();
  if (m === "breakfast") return "Breakfast";
  if (m === "lunch") return "Lunch";
  if (m === "dinner") return "Dinner";
  return "Snacks";
}
