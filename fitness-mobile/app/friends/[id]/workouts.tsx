// app/friends/[uid]/workouts.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
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
import { subscribeWorkouts, type Workout } from "@/services/workouts";
import { saveWorkoutTemplate } from "@/services/templates";
import { GradientButton } from "@/components/workouts/ui/GradientButton";

const softShadow = Platform.select({
  ios: {
    shadowColor: "black",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 8 },
});

export default function FriendWorkoutsScreen() {
  // ✅ Support both param names: new route uses [uid], old used [id]
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
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!friendUid) return;
    return subscribeProfile(friendUid, setProfile);
  }, [friendUid]);

  const visibility = getFriendVisibility(profile);
  const workoutsVisible = visibility.enabled && visibility.workouts?.workoutsLogged;

  // ✅ OLD BACKEND LOGIC: subscribeWorkouts(uid, cb, {from,to})
  useEffect(() => {
    if (!friendUid || !workoutsVisible) return;

    setLoading(true);
    const unsub = subscribeWorkouts(
      friendUid,
      (rows) => {
        setWorkouts(rows || []);
        setLoading(false);
      },
      { from: selectedDate, to: selectedDate }
    );

    return () => {
      try {
        unsub && unsub();
      } catch {}
      setLoading(false);
    };
  }, [friendUid, selectedDate, workoutsVisible]);

  const dayRows = useMemo(
    () => workouts.filter((w) => w.date === selectedDate),
    [workouts, selectedDate]
  );

  const stats = useMemo(() => {
    // “friendly” stats for the day
    const exercises = dayRows.length;
    const sets = dayRows.reduce((a, w) => a + Number(w.sets || 0), 0);
    const reps = dayRows.reduce(
      (a, w) => a + Number(w.reps || 0) * Number(w.sets || 0),
      0
    );
    const volume = dayRows.reduce(
      (a, w) =>
        a + Number(w.weight || 0) * Number(w.reps || 0) * Number(w.sets || 0),
      0
    );
    return { exercises, sets, reps, volume };
  }, [dayRows]);

  async function handleSaveTemplate() {
    if (!user?.uid) {
      Alert.alert("Sign in required");
      return;
    }
    if (!dayRows.length) {
      Alert.alert("No workouts", "Pick a day with workouts to save.");
      return;
    }

    const displayTitle = friendName || "Friend";
    const name = templateName.trim() || `${displayTitle} ${selectedDate}`;

    Alert.alert(
      "Save as template",
      `Save ${dayRows.length} items as “${name}”?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            try {
              await saveWorkoutTemplate(user.uid!, {
                name,
                tags: [],
                items: dayRows.map((w) => ({
                  exercise: w.exercise,
                  sets: Number(w.sets || 0),
                  reps: Number(w.reps || 0),
                  weight: Number(w.weight || 0),
                  notes: w.notes || "",
                })),
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert("Saved", "Template added to your library.");
            } catch (e: any) {
              Alert.alert("Couldn't save", e?.message || "Unknown error");
            }
          },
        },
      ]
    );
  }

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

      {/* header area */}
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
              ...softShadow,
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
                  {title}'s Workouts
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  Browse by day • Save as a template
                </Text>
              </View>

            {!workoutsVisible ? (
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
                  {title} hasn't shared workouts
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>
                  Workout sharing is private and controlled by your friend.
                </Text>
              </View>
            ) : null}

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
                  icon="restaurant-outline"
                  label="Meals"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(
                      `/friends/${encodeURIComponent(
                        friendUid
                      )}?name=${encodeURIComponent(title)}`
                    );
                  }}
                />
              </View>
            </View>

            <View style={{ height: 12 }} />

            {/* template row */}
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <BlurView
                intensity={isDark ? 18 : 40}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.66)",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    height: 44,
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <TextInput
                    value={templateName}
                    onChangeText={setTemplateName}
                    placeholder="Template name (optional)"
                    placeholderTextColor={
                      isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)"
                    }
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontWeight: "800",
                      letterSpacing: -0.1,
                    }}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>
              </BlurView>

              <GradientButton
                label="Save"
                onPress={handleSaveTemplate}
                disabled={!dayRows.length}
              />
            </View>
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
                        backgroundColor: active
                          ? withAlpha(colors.primary, isDark ? 0.18 : 0.14)
                          : isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(255,255,255,0.78)",
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

        {/* stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <GlassStat label="Exercises" value={`${stats.exercises}`} />
          <GlassStat label="Sets" value={`${stats.sets}`} />
          <GlassStat label="Reps" value={`${stats.reps}`} />
          <GlassStat label="Volume" value={`${Math.round(stats.volume)} kg`} />
        </View>

        <View style={{ height: 10 }} />
      </View>

      {/* list */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}
      >
        {loading ? (
          <PremiumLoadingCard label="Loading workouts…" />
        ) : dayRows.length === 0 ? (
          <EmptyCard icon="barbell-outline" label="No workouts for this day." />
        ) : (
          <View style={{ gap: 12 }}>
            {dayRows.map((w, idx) => (
              <MotiView
                key={w.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  duration: 320,
                  delay: 20 + idx * 18,
                }}
              >
                <WorkoutRow item={w} />
              </MotiView>
            ))}
          </View>
        )}

        <BottomTabSpacer extra={20} />
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── UI ───────────────────────── */

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

function EmptyCard({ icon, label }: { icon: any; label: string }) {
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
        gap: 8,
        ...(softShadow as any),
      }}
    >
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text style={{ color: colors.muted, fontWeight: "800" }}>{label}</Text>
    </BlurView>
  );
}

function WorkoutRow({ item }: { item: Workout }) {
  const { colors, isDark } = useTheme();

  const sets = Number(item.sets || 0);
  const reps = Number(item.reps || 0);
  const weight = Number(item.weight || 0);

  const subtitle = `${sets} × ${reps} • ${Math.round(weight)} kg`;

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
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
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
            <Ionicons name="barbell-outline" size={18} color={colors.text} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontSize: 16,
                letterSpacing: -0.2,
              }}
            >
              {item.exercise || "Exercise"}
            </Text>
            <Text
              style={{ color: colors.muted, marginTop: 4, fontWeight: "800" }}
            >
              {subtitle}
            </Text>

            {item.notes ? (
              <Text
                style={{
                  color: colors.muted,
                  marginTop: 8,
                  fontStyle: "italic",
                  fontWeight: "700",
                }}
              >
                “{item.notes}”
              </Text>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </LinearGradient>
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
