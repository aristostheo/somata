// app/(tabs)/workouts.tsx
// Drop-in replacement ✅
// Theme-adjusted: light mode is glossy + readable (no "washed out" text), dark mode unchanged vibe.
// Notes:
// - Uses your ThemeProvider: { colors, isDark }
// - Keeps your Coach Spark + template routes as-is

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Platform,
  StatusBar,
  AccessibilityInfo,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
  Alert as RNAlert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useAnimatedScrollHandler,
  withSpring,
} from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Body, {
  type ExtendedBodyPart,
  type Slug as BodySlug,
} from "react-native-body-highlighter/dist/index";

import * as Haptics from "expo-haptics";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeProfile, type Profile } from "@/services/profile";
import {
  inferPrimaryMuscle,
  PRIMARY_MUSCLE_OPTIONS,
} from "@/services/workoutMuscles";
import {
  subscribeWorkouts,
  deleteWorkout,
  type Workout,
} from "@/services/workouts";

import {
  subscribeWorkoutTemplates,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
  type WorkoutTemplate as DbWorkoutTemplate,
} from "@/services/templates";
import ActivityCard from "@/components/activity/ActivityCard";
import {
  WorkoutEntryCardPremium,
  type WorkoutEntrySummary,
} from "@/components/workouts/ui/WorkoutEntryCard";

import {
  subscribeActivityBetween,
  addActivity,
  updateActivity,
  deleteActivity,
  type ActivityEntry as CardioEntry,
} from "@/services/activity";
import {
  getRecoveryMetrics,
  subscribeIntegrations,
  type IntegrationSnapshot,
} from "@/services/integrations";
import {
  loadSessionDraft,
  type WorkoutSessionDraft,
} from "@/components/workouts/sessionDraft";
import { WorkoutSessionHeroCard } from "@/components/workouts/ui/WorkoutSessionHeroCard";
import { TemplatesSectionPremium } from "@/components/workouts/ui/TemplatesSectionPremium";
import { CoachSparkCardPremium } from "@/components/workouts/ui/CoachSparkCardPremium";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (date: Date, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

type WorkoutSummary = {
  id: string;
  title: string;
  subtitle?: string;
  dateISO: string;
  timeLabel?: string;
  dateLabel: string;
  durationMin: number;
  sets: number;
  volumeKg: number;
  group?: "push" | "pull" | "legs" | "full" | "cardio" | "recovery" | "other";
  pr?: { label: string; value?: string };
  highlight?: string;
};

type TemplateSource = "user" | "auto";

type TemplateItem = {
  exercise: string;
  sets: number;
  reps: number;
  weight?: number;
  weightKg?: number;
  notes?: string;
};

type TemplateVM = {
  id: string;
  name: string;
  emoji?: string;
  tag?: string;
  tags?: string[];
  source: TemplateSource;
  items: TemplateItem[];
  createdAt?: any;
  updatedAt?: any;
  lastUsedAt?: any;
  pinned?: boolean;
  archived?: boolean;
};

type ActiveSession = {
  title: string;
  elapsedMin: number;
  setsLogged?: number;
  exercisesCount?: number;
  volumeKg?: number;
  lastActiveAtMs?: number;
  startedAtMs?: number;
  lastAction?: string;
};

const AUTO_TEMPLATES: TemplateVM[] = [
  {
    id: "auto-push",
    name: "Push (Strength)",
    emoji: "🔥",
    tag: "Upper • Strength",
    source: "auto",
    items: [
      { exercise: "Bench Press", sets: 4, reps: 6, weightKg: 0 },
      { exercise: "Incline DB Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Overhead Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Lateral Raise", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "Triceps Pushdown", sets: 3, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-pull",
    name: "Pull (Strength)",
    emoji: "🧲",
    tag: "Upper • Strength",
    source: "auto",
    items: [
      { exercise: "Lat Pulldown", sets: 4, reps: 8, weightKg: 0 },
      { exercise: "Chest-Supported Row", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Seated Cable Row", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Face Pull", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "DB Curl", sets: 3, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-legs",
    name: "Legs (Strength)",
    emoji: "🦵",
    tag: "Lower • Strength",
    source: "auto",
    items: [
      { exercise: "Squat", sets: 4, reps: 6, weightKg: 0 },
      { exercise: "RDL", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Leg Press", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Leg Curl", sets: 3, reps: 12, weightKg: 0 },
      { exercise: "Calf Raise", sets: 4, reps: 12, weightKg: 0 },
    ],
  },
  {
    id: "auto-upper",
    name: "Upper (Balanced)",
    emoji: "⚡️",
    tag: "Upper • Balanced",
    source: "auto",
    items: [
      { exercise: "Bench Press", sets: 3, reps: 8, weightKg: 0 },
      { exercise: "Lat Pulldown", sets: 3, reps: 10, weightKg: 0 },
      { exercise: "Incline DB Press", sets: 2, reps: 10, weightKg: 0 },
      { exercise: "Row (Machine)", sets: 2, reps: 10, weightKg: 0 },
      { exercise: "Lateral Raise", sets: 2, reps: 15, weightKg: 0 },
    ],
  },
  {
    id: "auto-zone2",
    name: "Zone 2 Cardio",
    emoji: "🫀",
    tag: "Cardio • Conditioning",
    source: "auto",
    items: [
      {
        exercise: "Treadmill / Run",
        sets: 1,
        reps: 1,
        notes: "20–40 min Zone 2",
      },
    ],
  },
  {
    id: "auto-mobility",
    name: "Mobility (10–15 min)",
    emoji: "🧘",
    tag: "Recovery • Mobility",
    source: "auto",
    items: [
      { exercise: "Hip Opener Flow", sets: 1, reps: 1 },
      { exercise: "Thoracic Rotation", sets: 2, reps: 8 },
      { exercise: "Hamstring Stretch", sets: 2, reps: 1, notes: "45–60s hold" },
    ],
  },
];

function createdAtMs(r: any) {
  const c = r?.createdAt;
  if (!c) return 0;
  if (typeof c === "number") return c;
  if (typeof c?.toMillis === "function") return c.toMillis();
  if (typeof c?.seconds === "number") return c.seconds * 1000;
  return 0;
}

function ScalePressable({
  children,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: any;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const down = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => {
    const s = interpolate(down.value, [0, 1], [1, 0.985]);
    return { transform: [{ scale: s }] };
  });

  return (
    <Animated.View style={[aStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          onPressIn?.();
          down.value = withTiming(1, {
            duration: 90,
            easing: Easing.out(Easing.quad),
          });
        }}
        onPressOut={() => {
          onPressOut?.();
          down.value = withTiming(0, {
            duration: 140,
            easing: Easing.out(Easing.quad),
          });
        }}
        style={({ pressed }) => [pressed && { opacity: 0.98 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * THEME MODEL (local to this file)
 * Goal: keep the exact same components, but drive every "white-on-dark" style
 * from theme tokens so light mode is glossy + high-contrast.
 */
function useSurfaceTokens() {
  const { colors, isDark } = useTheme();

  const t1 = colors.textPrimary;
  const t2 = colors.textSecondary;
  const t3 = colors.textTertiary;

  const cardBorder = colors.border;
  const cardFill = colors.surface1;
  const chipFill = colors.surface2;
  const chipBorder = colors.border;
  const hairline = colors.border;

  const icon = colors.textSecondary;
  const iconBright = colors.textPrimary;
  const chevron = colors.textTertiary;

  const tTitleSoft = colors.textSecondary;
  const tMetaStrong = colors.textSecondary;

  const ghostFill = colors.surface2;
  const ghostBorder = colors.borderElevated;

  return {
    colors,
    isDark,
    t1,
    t2,
    t3,
    tTitleSoft,
    tMetaStrong,
    icon,
    iconBright,
    chevron,
    cardBorder,
    cardFill,
    chipFill,
    chipBorder,
    hairline,
    ghostFill,
    ghostBorder,
  };
}

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  const s = useSurfaceTokens();
  return (
    <View
      style={[
        styles.cardWrap,
        { backgroundColor: s.cardFill, borderColor: s.cardBorder, borderWidth: 1 },
        style,
      ]}
    >
      <View style={styles.cardInner}>{children}</View>
    </View>
  );
}

function Pill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const s = useSurfaceTokens();
  const iconScale = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  return (
    <ScalePressable
      onPress={onPress}
      onPressIn={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        iconScale.value = withSpring(1.12, { damping: 12, stiffness: 260 });
      }}
      onPressOut={() => {
        iconScale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      accessibilityLabel={label}
      accessibilityHint="Activates quick workout action"
      style={{ marginRight: 10 }}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: s.chipFill, borderColor: s.chipBorder },
        ]}
      >
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={15} color={s.iconBright} />
        </Animated.View>
        <Text style={[styles.pillText, { color: s.t1 }]}>{label}</Text>
      </View>
    </ScalePressable>
  );
}

function Ring({
  label,
  value,
  sub,
  accent,
  onPress,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
  onPress?: () => void;
}) {
  const s = useSurfaceTokens();
  const ringAccent = accent || s.colors.primary;
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityLabel={`${label}. ${value}. ${sub}.`}
      accessibilityHint="Opens weekly summary"
      style={{ flex: 1 }}
    >
      <GlassCard style={styles.ringCard} intensity={26}>
        <View style={styles.ringTop}>
          <View
            style={[
              styles.ringDot,
              { backgroundColor: withAlpha(ringAccent, 0.9) },
            ]}
          />
          <Text style={[styles.ringLabel, { color: s.t2 }]}>{label}</Text>
        </View>
        <Text style={[styles.ringValue, { color: s.t1 }]}>{value}</Text>
        <Text style={[styles.ringSub, { color: s.t2 }]}>{sub}</Text>
      </GlassCard>
    </ScalePressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const s = useSurfaceTokens();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: s.t1 }]}>{title}</Text>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={[styles.sectionActionText, { color: s.t3 }]}>
            {actionLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={s.chevron} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatChip({
  icon,
  label,
  dense = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  dense?: boolean;
}) {
  const s = useSurfaceTokens();
  return (
    <View
      style={[
        styles.statChip,
        dense && styles.statChipDense,
        { backgroundColor: s.chipFill, borderColor: s.chipBorder },
      ]}
    >
      <Ionicons name={icon} size={dense ? 13 : 14} color={s.iconBright} />
      <Text
        style={[
          styles.statChipText,
          dense && styles.statChipTextDense,
          { color: s.t1 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function WorkoutCard({
  w,
  index = 0,
  onPress,
  onDuplicate,
  onDelete,
  onSaveTemplate,
}: {
  w: WorkoutSummary;
  index?: number;
  onPress?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSaveTemplate?: () => void;
}) {
  const s = useSurfaceTokens();

  const isHero = index === 0;
  const highlight = w.highlight
    ? w.highlight.replace(/^best set:\s*/i, "")
    : "";
  const intensity = useMemo(() => {
    const density = w.volumeKg / Math.max(1, w.durationMin);
    const score = 0.6 * (density / 420) + 0.4 * (w.sets / 32);
    return clamp(score, 0, 1);
  }, [w.volumeKg, w.durationMin, w.sets]);
  const bars = Math.max(1, Math.min(5, Math.round(intensity * 5)));

  // subtle depth stack
  const stackStyle = isHero ? styles.heroCardWrap : styles.stackCardWrap;
  const isGeneric = (w.title || "").trim().toLowerCase() === "workout";

  return (
    <Animated.View
      entering={FadeInDown.duration(380).springify().damping(18).stiffness(160)}
    >
      <ScalePressable
        onPress={onPress}
        accessibilityLabel={`${w.title}. ${w.dateLabel}. ${w.durationMin} minutes. ${w.sets} sets.`}
        accessibilityHint="Opens workout details"
        style={[{ marginBottom: 12 }, stackStyle]}
      >
        <GlassCard
          intensity={22}
          style={[styles.workoutCard, !isHero && styles.workoutCardCompact]}
        >
          <View style={styles.workoutHeaderRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text
                style={[
                  styles.workoutTitle,
                  { color: isGeneric ? s.tTitleSoft : s.t1 },
                ]}
                numberOfLines={1}
              >
                {w.title}
              </Text>

              <Text
                style={[styles.workoutMeta, { color: s.tMetaStrong }]}
                numberOfLines={1}
              >
                {w.subtitle ? `${w.subtitle} • ` : ""}
                {w.dateLabel}
              </Text>
            </View>

            {w.pr ? (
              <View style={styles.prBadge} accessibilityLabel="Personal record">
                <Ionicons
                  name="trophy"
                  size={14}
                  color={withAlpha("#111", 0.9)}
                />
                <Text style={styles.prText}>PR</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={s.chevron} />
            )}
          </View>

          <View style={[styles.statsRow, !isHero && styles.statsRowCompact]}>
            <StatChip
              icon="time-outline"
              label={`${w.durationMin}m`}
              dense={!isHero}
            />
            <StatChip
              icon="layers-outline"
              label={`${w.sets} sets`}
              dense={!isHero}
            />
            <StatChip
              icon="barbell-outline"
              label={`${Math.round(w.volumeKg)} kg`}
              dense={!isHero}
            />
          </View>

          <View
            style={[styles.intensityRow, !isHero && styles.intensityRowCompact]}
          >
            <Text style={[styles.intensityLabel, { color: s.t2 }]}>
              Intensity
            </Text>
            <View style={styles.intensityBars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={`intensity-${w.id}-${i}`}
                  style={[
                    styles.intensityBar,
                    {
                      backgroundColor:
                        i < bars
                          ? withAlpha(s.colors.primary, 0.9)
                          : withAlpha(s.colors.text, s.isDark ? 0.18 : 0.12),
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {w.highlight ? (
            <View
              style={[
                styles.bestSetPill,
                {
                  backgroundColor: s.isDark
                    ? withAlpha(s.colors.surface1, 0.06)
                    : withAlpha(s.colors.surface1, 0.72),
                  borderColor: s.hairline,
                },
              ]}
            >
              <View style={styles.bestSetBadge}>
                <Ionicons name="sparkles-outline" size={13} color={s.icon} />
                <Text style={[styles.bestSetBadgeText, { color: s.t1 }]}>
                  Best set
                </Text>
              </View>
              {w.pr ? (
                <View
                  style={[
                    styles.bestSetTag,
                    {
                      backgroundColor: withAlpha(s.colors.warning, 0.18),
                      borderColor: withAlpha(s.colors.warning, 0.35),
                    },
                  ]}
                >
                  <Text style={[styles.bestSetTagText, { color: s.colors.warning }]}>PR</Text>
                </View>
              ) : null}
              <Text
                style={[styles.bestSetText, { color: s.t2 }]}
                numberOfLines={1}
              >
                {highlight}
              </Text>
            </View>
          ) : null}

          {w.pr ? (
            <Text style={[styles.prLine, { color: s.t3 }]} numberOfLines={1}>
              {w.pr.label}
              {w.pr.value ? ` • ${w.pr.value}` : ""}
            </Text>
          ) : null}

          {isHero ? (
            <View style={styles.cardActions}>
              {/* Primary: Duplicate */}
              <Pressable
                onPress={onDuplicate}
                accessibilityRole="button"
                accessibilityLabel="Duplicate workout"
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  {
                    backgroundColor: s.isDark
                      ? withAlpha(s.colors.surface1, 0.08)
                      : withAlpha(s.colors.surface1, 0.82),
                    borderColor: s.isDark
                      ? withAlpha(s.colors.surface1, 0.16)
                      : withAlpha(s.colors.text, 0.14),
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="copy-outline" size={16} color={s.icon} />
                <Text style={[styles.actionBtnText, { color: s.t1 }]}>
                  Duplicate
                </Text>
              </Pressable>

              {/* Neutral: Save template */}
              <Pressable
                onPress={onSaveTemplate}
                accessibilityRole="button"
                accessibilityLabel="Save workout as template"
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: s.isDark
                      ? withAlpha(s.colors.surface1, 0.05)
                      : withAlpha(s.colors.surface1, 0.74),
                    borderColor: s.hairline,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="bookmark-outline" size={16} color={s.icon} />
                <Text style={[styles.actionBtnText, { color: s.t1 }]}>
                  Save template
                </Text>
              </Pressable>

              {/* Quiet destructive: icon only */}
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete workout"
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnIconOnly,
                  {
                    backgroundColor: "transparent",
                    borderColor: s.hairline,
                    opacity: pressed ? 0.45 : 0.55,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={s.chevron} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardActionsCompact}>
              <Pressable
                onPress={onDuplicate}
                accessibilityRole="button"
                accessibilityLabel="Duplicate workout"
                style={({ pressed }) => [
                  styles.actionBtnCompact,
                  { borderColor: s.hairline },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="copy-outline" size={15} color={s.icon} />
              </Pressable>
              <Pressable
                onPress={onSaveTemplate}
                accessibilityRole="button"
                accessibilityLabel="Save workout as template"
                style={({ pressed }) => [
                  styles.actionBtnCompact,
                  { borderColor: s.hairline },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="bookmark-outline" size={15} color={s.icon} />
              </Pressable>
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete workout"
                style={({ pressed }) => [
                  styles.actionBtnCompact,
                  { borderColor: s.hairline, opacity: pressed ? 0.5 : 0.6 },
                ]}
              >
                <Ionicons name="trash-outline" size={15} color={s.chevron} />
              </Pressable>
            </View>
          )}
        </GlassCard>
      </ScalePressable>
    </Animated.View>
  );
}

function TemplateChip({ t, onPress }: { t: TemplateVM; onPress?: () => void }) {
  const s = useSurfaceTokens();
  const isUser = t.source === "user";
  return (
    <ScalePressable onPress={onPress} style={{ marginRight: 10 }}>
      <GlassCard intensity={20} style={styles.templateCard}>
        <View
          style={[
            styles.templateChip,
            {
              backgroundColor: s.cardFill,
              borderColor: s.cardBorder,
            },
          ]}
        >
          <Text style={styles.templateEmoji}>{t.emoji ?? "🏋️"}</Text>

          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={[styles.templateName, { color: s.t1 }]}
                numberOfLines={1}
              >
                {t.name}
              </Text>

              <View
                style={[
                  styles.templateBadge,
                  isUser
                    ? [
                        styles.templateBadgeUser,
                        {
                          backgroundColor: withAlpha(s.colors.primary, 0.16),
                          borderColor: withAlpha(s.colors.primary, 0.35),
                        },
                      ]
                    : [
                        styles.templateBadgeAuto,
                        {
                          backgroundColor: s.isDark
                            ? withAlpha(s.colors.surface1, 0.07)
                            : withAlpha(s.colors.surface1, 0.8),
                          borderColor: s.isDark
                            ? withAlpha(s.colors.surface1, 0.14)
                            : withAlpha(s.colors.text, 0.14),
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.templateBadgeText,
                    {
                      color: isUser ? s.colors.primary : s.t2,
                    },
                  ]}
                >
                  {isUser ? "SAVED" : "SUGGESTED"}
                </Text>
              </View>
            </View>

            {t.tag ? (
              <Text style={[styles.templateTag, { color: s.t2 }]}>{t.tag}</Text>
            ) : null}
          </View>

          <Ionicons name="play" size={16} color={s.chevron} />
        </View>
      </GlassCard>
    </ScalePressable>
  );
}

/* ───────────────────────────── */
/* Sheets: Start + Templates      */
/* ───────────────────────────── */
function SheetShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const s = useSurfaceTokens();
  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheetBackdrop,
          {
            backgroundColor: s.isDark
              ? withAlpha(s.colors.textPrimary, 0.35)
              : withAlpha(s.colors.textPrimary, 0.12),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <GlassCard intensity={38} style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: s.t1 }]}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text style={[styles.sheetSubtitle, { color: s.t2 }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.sheetClose,
                  {
                    backgroundColor: s.ghostFill,
                    borderColor: s.ghostBorder,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="close" size={18} color={s.icon} />
              </Pressable>
            </View>
            {children}
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

function SheetRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const s = useSurfaceTokens();
  return (
    <ScalePressable onPress={onPress} style={{ marginBottom: 10 }}>
      <View
        style={[
          styles.sheetRow,
          {
            backgroundColor: s.isDark
              ? withAlpha(s.colors.surface1, 0.05)
              : withAlpha(s.colors.surface1, 0.78),
            borderColor: s.hairline,
          },
        ]}
      >
        <View
          style={[
            styles.sheetIcon,
            { backgroundColor: s.ghostFill, borderColor: s.ghostBorder },
          ]}
        >
          <Ionicons name={icon} size={18} color={s.icon} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetRowTitle, { color: s.t1 }]}>{title}</Text>
          {!!subtitle && (
            <Text
              style={[styles.sheetRowSubtitle, { color: s.t2 }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {right ?? (
          <Ionicons name="chevron-forward" size={16} color={s.chevron} />
        )}
      </View>
    </ScalePressable>
  );
}

function Toast({
  text,
  actionLabel,
  onAction,
  onHide,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onHide?: () => void;
}) {
  const s = useSurfaceTokens();
  if (!text) return null;
  return (
    <View style={styles.toastWrap} pointerEvents="box-none">
      <GlassCard intensity={40} style={styles.toastCard}>
        <Text style={[styles.toastText, { color: s.t1 }]} numberOfLines={2}>
          {text}
        </Text>
        {!!actionLabel && !!onAction && (
          <Pressable
            onPress={onAction}
            style={({ pressed }) => [
              styles.toastBtn,
              {
                backgroundColor: s.ghostFill,
                borderColor: s.ghostBorder,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.toastBtnText, { color: s.t1 }]}>
              {actionLabel}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onHide}
          hitSlop={10}
          style={{ padding: 6, marginLeft: 4 }}
        >
          <Ionicons name="close" size={16} color={s.chevron} />
        </Pressable>
      </GlassCard>
    </View>
  );
}

/* ───────────────────────────── */
/* Screen                        */
/* ───────────────────────────── */
export default function WorkoutsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const uid = user?.uid;

  const s = useSurfaceTokens();

  const TEMPLATE_PREVIEW_COUNT = 7;
  const TEMPLATE_KEEP_KEY = "workouts:template-keep-until";
  const [dbTemplates, setDbTemplates] = useState<DbWorkoutTemplate[]>([]);
  const [activityEntries, setActivityEntries] = useState<CardioEntry[]>([]);
  const [templateKeepUntil, setTemplateKeepUntil] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null);

  const accent = s.colors.primary;
  const scrollY = useSharedValue(0);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeWorkoutTemplates(user.uid, setDbTemplates);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProfile(user.uid, (next) => setProfile(next || null));
  }, [user?.uid]);

  useEffect(() => subscribeIntegrations(setCoachIntegrations), []);

  useEffect(() => {
    AsyncStorage.getItem(TEMPLATE_KEEP_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setTemplateKeepUntil(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const templatesMerged: TemplateVM[] = useMemo<TemplateVM[]>(() => {
    const userMapped: TemplateVM[] = (dbTemplates ?? [])
      .map((t: any) => ({
        id: t.id,
        name: t.name ?? t.title ?? "Template",
        emoji: t.emoji ?? "⭐️",
        tags: t.tags ?? t.tag ?? [],
        tag:
          (Array.isArray(t.tags) ? t.tags : Array.isArray(t.tag) ? t.tag : [])
            .slice(0, 2)
            .join(" • ") || "Saved template",
        source: "user" as TemplateSource,
        items: (t.items ?? t.exercises ?? []).map((it: any) => ({
          exercise: it.exercise ?? it.name ?? "",
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weightKg: Number(it.weightKg ?? it.weight ?? 0),
          notes: it.notes || "",
        })),
        createdAt: t.createdAt ?? null,
        updatedAt: t.updatedAt ?? null,
        lastUsedAt: t.lastUsedAt ?? null,
        pinned: !!t.pinned,
        archived: !!t.archived,
      }))
      .filter((t) => t.name && t.items?.length);

    const usedIds = new Set(userMapped.map((x) => x.id));
    const usedNames = new Set(userMapped.map((x) => x.name.toLowerCase()));
    const autos = AUTO_TEMPLATES.filter(
      (a) => !usedIds.has(a.id) && !usedNames.has(a.name.toLowerCase())
    );

    return [...userMapped, ...autos];
  }, [dbTemplates]);

  const userTemplatesPreview = useMemo(
    () =>
      templatesMerged
        .filter((t) => t.source === "user" && !t.archived)
        .slice(0, TEMPLATE_PREVIEW_COUNT),
    [templatesMerged]
  );

  const templateSeedKey = (u: string) => `workout:templateSeed:${u}`;

  const [templateActionsOpen, setTemplateActionsOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<TemplateVM | null>(null);
  const [coachIntegrations, setCoachIntegrations] =
    useState<IntegrationSnapshot | null>(null);

  function openTemplateActions(t: TemplateVM) {
    setActiveTemplate(t);
    setTemplateActionsOpen(true);
  }

  const haptic = async (kind: "light" | "select" = "select") => {
    try {
      if (kind === "light")
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else await Haptics.selectionAsync();
    } catch {}
  };

  const openSession = async (params?: Record<string, any>) => {
    await haptic("select");
    router.push({ pathname: "/workouts/session", params } as any);
  };

  async function startFromTemplate(t: TemplateVM) {
    if (!uid) return;
    const seed = {
      title: t.name,
      exercises: (t.items || []).map((it) => ({
        name: it.exercise,
        sets: Math.max(1, Number(it.sets || 1)),
        reps: Number(it.reps || 10),
        weightKg: Number(it.weightKg ?? it.weight ?? 0),
        note: (it.notes || "").trim(),
      })),
    };
    await AsyncStorage.setItem(templateSeedKey(uid), JSON.stringify(seed));
    if (t.source === "user") {
      updateWorkoutTemplate(uid, t.id, { lastUsedAt: Date.now() } as any).catch(
        () => {}
      );
    }
    await openSession({
      templateId: t.id,
      templateName: t.name,
      templateLaunch: "1",
    });
  }

  async function keepTemplateFresh(templateId: string) {
    const next = {
      ...templateKeepUntil,
      [templateId]: Date.now() + 30 * 86400000,
    };
    setTemplateKeepUntil(next);
    await AsyncStorage.setItem(TEMPLATE_KEEP_KEY, JSON.stringify(next));
  }

  async function archiveTemplate(templateId: string) {
    if (!uid) return;
    await updateWorkoutTemplate(uid, templateId, { archived: true } as any);
  }

  function volumeKg(sets: number, reps: number, weightKg: number) {
    return (
      Math.max(0, Number(sets || 0)) *
      Math.max(0, Number(reps || 0)) *
      Math.max(0, Number(weightKg || 0))
    );
  }

  function timeAgoLabelFromISO(isoDate: string) {
    const today = new Date();
    const t0 = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    const d = isoDate.split("-").map((n) => Number(n));
    if (d.length !== 3) return isoDate;
    const t1 = new Date(d[0], d[1] - 1, d[2]).getTime();
    const days = Math.round((t0 - t1) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days > 1 && days < 7)
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        new Date(t1).getDay()
      ];
    return isoDate;
  }

function fmtTime(ms: number) {
    if (!ms) return "";
    const d = new Date(ms);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function classifyWorkoutGroup(
    title: string,
    exercises: string[]
  ): "push" | "pull" | "legs" | "full" | "cardio" | "recovery" | "other" {
    const all = `${title} ${exercises.join(" ")}`.toLowerCase();
    if (
      /cardio|run|bike|cycle|swim|treadmill|rower|hiit|conditioning/.test(all)
    ) {
      return "cardio";
    }
    if (/mobility|stretch|recovery|rest|yoga/.test(all)) {
      return "recovery";
    }
    if (/full body|fullbody|total body/.test(all)) {
      return "full";
    }
    if (
      /squat|leg|rdl|deadlift|hamstring|quad|glute|calf|lunge/.test(all)
    ) {
      return "legs";
    }
    if (
      /row|pulldown|pull|curl|rear delt|face pull|bicep|lat/.test(all)
    ) {
      return "pull";
    }
    if (
      /bench|press|chest|shoulder|tricep|dip|push/.test(all)
    ) {
      return "push";
    }
    return "other";
  }

  type WorkoutRow = Workout & {
    sessionId?: string;
    sessionTitle?: string;
    sessionStartedAt?: number;
  };

  type SessionBucket = {
    key: string;
    sessionId?: string;
    dateISO: string;
    title: string;
    startedAt?: number;
    latestAt?: number;
    rows: WorkoutRow[];
  };

  function buildSessionBuckets(all: WorkoutRow[]) {
    const rows = (all || []).slice();
    const gapMs = 1000 * 60 * 120; // 2h gap groups separate sessions if no sessionId

    const dateMsFromISO = (iso: string) => {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
      return new Date(`${iso}T00:00:00`).getTime();
    };

    const rowCreatedAtMs = (r: WorkoutRow) => {
      const raw =
        (r as any).setCreatedAt ??
        (r as any).createdAt ??
        (r as any).sessionStartedAt;
      if (!raw) return 0;
      if (typeof raw === "number") return raw;
      if (typeof raw?.toMillis === "function") return raw.toMillis();
      if (typeof raw?.seconds === "number") return raw.seconds * 1000;
      return 0;
    };

    rows.sort((a, b) => {
      const ad = (a as any).date || "";
      const bd = (b as any).date || "";
      if (ad !== bd) return bd.localeCompare(ad);
      return rowCreatedAtMs(b) - rowCreatedAtMs(a);
    });

    const buckets = new Map<string, SessionBucket & { latestAt?: number }>();
    const autoBucketsByDate = new Map<
      string,
      Array<SessionBucket & { latestAt?: number }>
    >();

    for (const r of rows) {
      const dateISO = ((r as any).date || "").trim() || "Unknown date";
      const sid =
        typeof (r as any).sessionId === "string" && (r as any).sessionId.trim()
          ? String((r as any).sessionId)
          : "";

      const title =
        typeof (r as any).sessionTitle === "string" &&
        (r as any).sessionTitle.trim()
          ? String((r as any).sessionTitle)
          : "Workout";

      const startedAt =
        Number((r as any).sessionStartedAt || 0) ||
        rowCreatedAtMs(r) ||
        dateMsFromISO(dateISO) ||
        undefined;
      const createdMs = rowCreatedAtMs(r) || startedAt || 0;

      if (sid) {
        const key = `session:${sid}`;
        const existing = buckets.get(key);
        if (!existing) {
          buckets.set(key, {
            key,
            sessionId: sid,
            dateISO,
            title,
            startedAt,
            latestAt: createdMs,
            rows: [r],
          });
        } else {
          existing.rows.push(r);
          existing.latestAt = Math.max(existing.latestAt || 0, createdMs || 0);
          if (existing.title === "Workout" && title !== "Workout")
            existing.title = title;
          if (!existing.startedAt && startedAt) existing.startedAt = startedAt;
          if (existing.dateISO === "Unknown date" && dateISO !== "Unknown date")
            existing.dateISO = dateISO;
        }
        continue;
      }

      const autoList = autoBucketsByDate.get(dateISO) || [];
      const last = autoList[autoList.length - 1];
      if (last && last.latestAt && last.latestAt - createdMs <= gapMs) {
        last.rows.push(r);
        last.latestAt = Math.max(last.latestAt || 0, createdMs || 0);
        if (last.title === "Workout" && title !== "Workout") last.title = title;
        if (!last.startedAt && startedAt) last.startedAt = startedAt;
      } else {
        const key = `auto:${dateISO}:${autoList.length}`;
        const bucket: SessionBucket & { latestAt?: number } = {
          key,
          sessionId: undefined,
          dateISO,
          title,
          startedAt,
          latestAt: createdMs,
          rows: [r],
        };
        autoList.push(bucket);
        autoBucketsByDate.set(dateISO, autoList);
        buckets.set(key, bucket);
      }
    }

    return {
      sessions: Array.from(buckets.values()).sort((a, b) => {
        const at = a.latestAt || a.startedAt || rowCreatedAtMs(a.rows[0]) || 0;
        const bt = b.latestAt || b.startedAt || rowCreatedAtMs(b.rows[0]) || 0;
        return bt - at;
      }),
      rowCreatedAtMs,
    };
  }

  function buildRecentsFromWorkoutRows(all: WorkoutRow[]): WorkoutSummary[] {
    const { sessions, rowCreatedAtMs } = buildSessionBuckets(all);

    return sessions.map((sess) => {
      const ordered = sess.rows
        .slice()
        .sort((a, b) => rowCreatedAtMs(a) - rowCreatedAtMs(b));

      const first = ordered[0];
      const last = ordered[ordered.length - 1];

      const totalSets = ordered.reduce(
        (acc, r) => acc + Number((r as any).sets || 0),
        0
      );
      const exerciseCount = new Set(
        ordered.map((r) =>
          String((r as any).exercise || "")
            .trim()
            .toLowerCase()
        )
      ).size;
      const totalVolume = ordered.reduce((acc, r) => {
        return (
          acc +
          volumeKg(
            Number((r as any).sets || 0),
            Number((r as any).reps || 0),
            Number((r as any).weight || 0)
          )
        );
      }, 0);

      const start = sess.startedAt || rowCreatedAtMs(first);
      const end = rowCreatedAtMs(last) || start;
      const durationMin =
        start && end && end >= start
          ? Math.max(1, Math.round((end - start) / 60000))
          : 0;

      let bestLine = "";
      let bestVol = -1;
      for (const r of ordered) {
        const v = volumeKg(
          Number((r as any).sets || 0),
          Number((r as any).reps || 0),
          Number((r as any).weight || 0)
        );
        if (v > bestVol) {
          bestVol = v;
          const ex = (r as any).exercise || "Exercise";
          const sets = Number((r as any).sets || 0);
          const reps = Number((r as any).reps || 0);
          const wt = Number((r as any).weight || 0);
          bestLine = `${ex} • ${sets}×${reps} @ ${Math.round(wt)}kg`;
        }
      }

      const dayLabel = timeAgoLabelFromISO(sess.dateISO);
      const timeLabel = start ? fmtTime(start) : "";
      const dateLabel = timeLabel ? `${dayLabel} • ${timeLabel}` : dayLabel;
      const exercises = ordered
        .map((r) => String((r as any).exercise || "").trim())
        .filter(Boolean);
      const group = classifyWorkoutGroup(sess.title || "Workout", exercises);

      return {
        id: sess.key,
        title: sess.title || "Workout",
        subtitle: exerciseCount ? `${exerciseCount} exercises` : undefined,
        dateISO: sess.dateISO,
        timeLabel,
        dateLabel,
        durationMin,
        sets: totalSets,
        volumeKg: Math.round(totalVolume),
        group,
        highlight: bestLine ? `Best set: ${bestLine}` : undefined,
      };
    });
  }

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const contentMax = Math.min(980, width);
  const sidePad = clamp((width - contentMax) / 2, 16, 28);

  const [draftSession, setDraftSession] = useState<WorkoutSessionDraft | null>(
    null
  );
  const [hideDraftHero, setHideDraftHero] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      if (!uid) {
        setDraftSession(null);
        return () => {};
      }
      (async () => {
        const draft = await loadSessionDraft(uid);
        if (mounted) setDraftSession(draft);
      })();
      return () => {
        mounted = false;
      };
    }, [uid])
  );

  const hasDraftSession = !!draftSession;
  const showDraftSession = hasDraftSession && !hideDraftHero;

  useEffect(() => {
    if (!draftSession) setHideDraftHero(false);
  }, [draftSession]);

  const activeSession = useMemo<ActiveSession | null>(() => {
    if (!draftSession) return null;
    const items = draftSession.items || [];
    const setsLogged = items.reduce(
      (sum, it) => sum + Math.max(1, Number(it.sets || 1)),
      0
    );
    const exercisesCount = new Set(
      items
        .map((it) =>
          String(it.exercise || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ).size;
    const totalVolumeKg = items.reduce(
      (sum, it) =>
        sum +
        volumeKg(
          Number(it.sets || 1),
          Number(it.reps || 0),
          Number(it.weightKg || 0)
        ),
      0
    );
    const elapsedMin = Math.max(
      0,
      Math.round((Date.now() - draftSession.startedAt) / 60000)
    );
    return {
      title: (draftSession.title || "Workout").trim() || "Workout",
      elapsedMin,
      setsLogged,
      exercisesCount,
      volumeKg: Math.round(totalVolumeKg),
      lastActiveAtMs: draftSession.updatedAt,
      startedAtMs: draftSession.startedAt,
      lastAction: "Draft in progress",
    };
  }, [draftSession]);

  useEffect(() => {
    if (!uid) return;

    const end = ymd(new Date());
    const start = ymd(addDays(new Date(), -30));

    return subscribeActivityBetween(uid, start, end, (arr) =>
      setActivityEntries(arr || [])
    );
  }, [uid]);

  const [startOpen, setStartOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [configTitle, setConfigTitle] = useState("");
  const [configMuscle, setConfigMuscle] = useState("");
  const [configDuration, setConfigDuration] = useState("45");
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [surpriseTemplate, setSurpriseTemplate] = useState<TemplateVM | null>(
    null
  );
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => void;
  } | null>(null);
  const toastTimer = useRef<any>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [deletingLabel, setDeletingLabel] = useState("");

  function showToast(text: string, undo?: () => void) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  const referenceSeedKey = (u: string) => `workout:referenceSeed:${u}`;

  const onStart = async () => {
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => false
    );
    if (!reduceMotion) await haptic("light");
    await openSession({ freshStart: "1" });
  };

  const onOptions = async () => {
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => false
    );
    if (!reduceMotion) await haptic("light");
    setConfigTitle("");
    setConfigMuscle("");
    setConfigDuration("45");
    setStartOpen(true);
  };

  const onContinue = () => openSession({});
  const AFlatList = Animated.createAnimatedComponent(FlatList);

  const [workoutRows, setWorkoutRows] = useState<WorkoutRow[]>([]);
  const [recents, setRecents] = useState<WorkoutSummary[]>([]);
  const recentLimit = 5;
  const recentlyFinished = useMemo(() => {
    if (draftSession) return null;
    if (!workoutRows.length) return null;
    const { sessions, rowCreatedAtMs } = buildSessionBuckets(workoutRows);
    const latest = sessions[0];
    if (!latest?.rows?.length) return null;
    const lastRow = latest.rows[latest.rows.length - 1];
    const finishedAt =
      latest.latestAt || latest.startedAt || rowCreatedAtMs(lastRow) || 0;
    if (!finishedAt) return null;
    const minutesAgo = (Date.now() - finishedAt) / 60000;
    if (minutesAgo > 90) return null;

    const totalSets = latest.rows.reduce(
      (sum, r) => sum + Number((r as any).sets || 0),
      0
    );
    const exercisesCount = new Set(
      latest.rows
        .map((r) =>
          String((r as any).exercise || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ).size;
    const volume = latest.rows.reduce((sum, r) => {
      return (
        sum +
        volumeKg(
          Number((r as any).sets || 0),
          Number((r as any).reps || 0),
          Number((r as any).weight || 0)
        )
      );
    }, 0);

    return {
      title: (latest.title || "Workout").trim() || "Workout",
      finishedAtMs: finishedAt,
      setsLogged: totalSets,
      exercisesCount,
      volumeKg: Math.round(volume),
    };
  }, [draftSession, workoutRows]);

  useEffect(() => {
    if (!user?.uid) {
      setWorkoutRows([]);
      setRecents([]);
      return;
    }
    return subscribeWorkouts(
      user.uid,
      (rows: Workout[]) => {
        const typed = (rows || []) as WorkoutRow[];
        setWorkoutRows(typed);
        setRecents(buildRecentsFromWorkoutRows(typed));
      },
      { max: 300 }
    );
  }, [user?.uid]);

  const onFinish = async () => {
    await haptic("light");
    setHideDraftHero(true);
    showToast("Workout hidden (draft still in session).", () => {
      setHideDraftHero(false);
    });
  };

  const onFromTemplate = () => {
    setStartOpen(false);
    setTemplatesOpen(true);
  };

  async function seedReferenceSession(session: SessionBucket) {
    if (!uid) return;
    const grouped = new Map<
      string,
      {
        exercise: string;
        primaryMuscle?: string;
        sets: Array<{ reps: number; weightKg: number; note?: string }>;
      }
    >();
    for (const row of session.rows) {
      const exercise = String((row as any).exercise || "").trim();
      if (!exercise) continue;
      const key = exercise.toLowerCase();
      const current =
        grouped.get(key) ||
        {
          exercise,
          primaryMuscle:
            inferPrimaryMuscle(
              exercise,
              String((row as any).primaryMuscle || "")
            ) || "",
          sets: [],
        };
      current.sets.push({
        reps: Number((row as any).reps || 0),
        weightKg: Number((row as any).weight || 0),
        note: String((row as any).notes || "").trim() || undefined,
      });
      grouped.set(key, current);
    }
    const seed = {
      title: (session.title || "Workout").trim() || "Workout",
      groups: [...grouped.values()],
    };
    await AsyncStorage.setItem(referenceSeedKey(uid), JSON.stringify(seed));
  }

  async function startFromSession(session: SessionBucket) {
    if (!uid) return;
    await seedReferenceSession(session);
    await openSession({
      freshStart: "1",
      configTitle: (session.title || "Workout").trim() || "Workout",
      resumeReference: "1",
    });
  }

  function templatePrimaryGroup(template: TemplateVM) {
    const text = `${template.name} ${template.items
      .map((item) => item.exercise)
      .join(" ")}`.toLowerCase();
    if (/push|bench|chest|shoulder|tricep|press/.test(text)) return "push";
    if (/pull|row|lat|bicep|curl|rear delt/.test(text)) return "pull";
    if (/leg|quad|hamstring|glute|calf|squat|rdl/.test(text)) return "legs";
    if (/cardio|run|bike|zone 2|conditioning/.test(text)) return "cardio";
    return "full";
  }

  function pickSmartTemplate() {
    const candidates = templatesMerged.filter(
      (template) => template.source === "user" && !template.archived
    );
    if (!candidates.length) return null;

    const cutoff = Date.now() - 3 * 86400000;
    const recentGroups = new Set<string>();
    const { sessions } = buildSessionBuckets(workoutRows);
    for (const session of sessions) {
      const stamp = Number(session.latestAt || session.startedAt || 0);
      if (!stamp || stamp < cutoff) continue;
        recentGroups.add(
          classifyWorkoutGroup(
            session.title || "Workout",
            session.rows.map((row) => String((row as any).exercise || ""))
          ) || "full"
        );
    }

    const scored = candidates.map((template) => {
      const group = templatePrimaryGroup(template);
      const rawLastUsed =
        (template.lastUsedAt as any)?.toMillis?.() ||
        (template.updatedAt as any)?.toMillis?.() ||
        (template.createdAt as any)?.toMillis?.() ||
        0;
      const recentlyTrainedPenalty = recentGroups.has(group) ? 0 : 1000;
      return {
        template,
        group,
        score: recentlyTrainedPenalty - rawLastUsed,
        lastUsed: rawLastUsed,
      };
    });

    const bestScore = Math.max(...scored.map((item) => item.score));
    const best = scored.filter((item) => item.score === bestScore);
    if (best.length === 1) return best[0].template;

    best.sort((a, b) => a.lastUsed - b.lastUsed);
    return best[0]?.template || candidates[0];
  }

  function rerollSurpriseTemplate() {
    const next = pickSmartTemplate();
    setSurpriseTemplate(next);
    setSurpriseOpen(true);
  }

  const onSurprise = () => {
    const next = pickSmartTemplate();
    setSurpriseTemplate(next);
    setSurpriseOpen(true);
  };

  const coachSparkContextLine = useMemo(() => {
    const recovery = getRecoveryMetrics(coachIntegrations);
    const latest = recents[0];
    if (recovery?.recoveryScore != null) {
      const score = Math.round(recovery.recoveryScore);
      if (score < 40) return `Recovery: ${score}% · Consider a lighter session today`;
      if (score < 70) return `Recovery: ${score}% · Consider a moderate session today`;
      return `Recovery: ${score}% · Good day to train with intent`;
    }
    if (latest?.group === "legs") {
      return "Last session: Legs · Upper body or rest recommended";
    }
    if (!recents.length) {
      return "No sessions yet this week · Good time to start";
    }
    return "Tap to build a personalized workout";
  }, [coachIntegrations, recents]);

  const onCreateTemplate = () => {
    setStartOpen(false);
    router.push("/(modals)/create-template");
  };

  const onViewAllTemplates = () => router.push("/workouts/templates");
  const onSeeMoreHistory = () => router.push("/workouts/history");

  const deleteRecent = async (sum: WorkoutSummary) => {
    if (!user?.uid) return;

    const { sessions } = buildSessionBuckets(workoutRows);
    const session = sessions.find((s) => s.key === sum.id);

    if (!session?.rows?.length) return;
    setIsDeletingSession(true);
    setDeletingLabel(sum.title || "Workout");
    try {
      await Promise.all(
        session.rows.map((r) => deleteWorkout(user.uid, (r as any).id))
      );
      showToast("Workout deleted");
    } catch (e: any) {
      RNAlert.alert("Couldn't delete", e?.message || "Unknown error");
    } finally {
      setIsDeletingSession(false);
      setDeletingLabel("");
    }
  };

  const duplicateRecent = async (w: WorkoutSummary) => {
    const { sessions } = buildSessionBuckets(workoutRows);
    const session = sessions.find((entry) => entry.key === w.id);
    if (!session) {
      await openSession({ freshStart: "1", configTitle: w.title || "Workout" });
      return;
    }
    await startFromSession(session);
  };
  async function handleCreateActivity(e: CardioEntry) {
    if (!uid) return;
    await addActivity(uid, e);
  }
  async function handleUpdateActivity(e: CardioEntry) {
    if (!uid) return;
    await updateActivity(uid, e);
  }
  async function handleDeleteActivity(id: string) {
    if (!uid) return;
    await deleteActivity(uid, id);
  }
  const validActivityEntries = useMemo(
    () =>
      (activityEntries || []).filter((entry) => {
        const minutes = Number(entry.minutes || 0);
        const calories = Number(entry.calories || 0);
        const steps = Number(entry.steps || 0);
        if (minutes > 0) return true;
        if (steps > 0) return true;
        return false;
      }),
    [activityEntries]
  );
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const headerAnimStyle = useAnimatedStyle(() => {
    // how much we collapse
    const y = Math.min(scrollY.value, 72);

    return {
      transform: [
        { translateY: -y }, // slides header up as you scroll
      ],
    };
  });
  const renderRecentItem = ({
    item,
    index,
  }: {
    item: unknown;
    index: number;
  }) => {
    const w = item as WorkoutSummary;

    const summary: WorkoutEntrySummary = {
      id: w.id,
      sessionKey: w.id,
      title: w.title || "Workout",
      dateISO: w.dateISO,
      timeLabel: w.timeLabel,
      durationMin: Number(w.durationMin || 0),
      exercisesCount: Number((w.subtitle || "").match(/\d+/)?.[0] || 0),
      sets: Number(w.sets || 0),
      volumeKg: Number(w.volumeKg || 0),
      prCount: w.pr ? 1 : 0,
      highlight: w.highlight
        ? {
            label: w.pr ? "PR moment" : "Best set",
            text: w.highlight.replace(/^best set:\s*/i, ""),
            isPR: !!w.pr,
          }
        : undefined,
    };

    return (
      <WorkoutEntryCardPremium
        summary={summary}
        index={index}
        onPress={() =>
          router.push({
            pathname: "/workouts/session-detail",
            params: { sessionKey: w.id },
          } as any)
        }
        onMore={() =>
          router.push({
            pathname: "/workouts/session-detail",
            params: { sessionKey: w.id, focus: "actions" },
          } as any)
        }
        onDuplicate={() => duplicateRecent(w)}
      />
    );
  };

  // make data a real variable so TS sees the type
  const recentData: WorkoutSummary[] = recents.slice(0, recentLimit);
  const weeklyWorkoutRows = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = ymd(addDays(today, mondayOffset));
    const end = ymd(addDays(today, mondayOffset + 6));
    return (workoutRows || []).filter((row) => {
      const date = String((row as any).date || "");
      return date >= start && date <= end;
    });
  }, [workoutRows]);
  const weeklyWorkouts = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = ymd(addDays(today, mondayOffset));
    const end = ymd(addDays(today, mondayOffset + 6));
    return recents.filter((row) => row.dateISO >= start && row.dateISO <= end);
  }, [recents]);
  const priorWeekWorkouts = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = ymd(addDays(today, mondayOffset - 7));
    const end = ymd(addDays(today, mondayOffset - 1));
    return recents.filter((row) => row.dateISO >= start && row.dateISO <= end);
  }, [recents]);
  const weeklyWorkoutCount = weeklyWorkouts.length;
  const weeklyMinutes = weeklyWorkouts.reduce((sum, row) => sum + Number(row.durationMin || 0), 0);
  const weeklyVolume = weeklyWorkouts.reduce((sum, row) => sum + Number(row.volumeKg || 0), 0);
  const priorWeekVolume = priorWeekWorkouts.reduce((sum, row) => sum + Number(row.volumeKg || 0), 0);
  const hasVolumeComparison = priorWeekVolume > 0 && weeklyWorkoutCount > 0;
  const volumeDeltaPct = hasVolumeComparison
    ? Math.round(((weeklyVolume - priorWeekVolume) / priorWeekVolume) * 100)
    : null;
  const weeklyHoursLabel = `${Math.floor(weeklyMinutes / 60)}h ${String(weeklyMinutes % 60).padStart(2, "0")}m`;
  const weeklySubtitle =
    weeklyWorkoutCount === 0
      ? "Let's get this week started"
      : `This week: ${weeklyWorkoutCount} workouts · ${weeklyHoursLabel}${
          volumeDeltaPct == null ? "" : ` · ${volumeDeltaPct >= 0 ? "+" : ""}${volumeDeltaPct}% volume`
        }`;
  const weeklyStatTiles = useMemo(() => {
    const target = 4;
    const restDays = Math.max(0, 7 - weeklyWorkoutCount);
    return [
      { label: "Workouts", value: `${weeklyWorkoutCount}/${target}`, sub: weeklyWorkoutCount >= target ? "Goal hit" : `${Math.max(0, target - weeklyWorkoutCount)} to go` },
      { label: "Minutes", value: String(weeklyMinutes), sub: `${weeklyHoursLabel} total` },
      { label: "Strength", value: volumeDeltaPct == null ? "—" : `${volumeDeltaPct >= 0 ? "+" : ""}${volumeDeltaPct}%`, sub: volumeDeltaPct == null ? "No comparison yet" : "vs last wk" },
      { label: "Rest Days", value: String(restDays), sub: restDays === 1 ? "1 rest day" : `${restDays} rest days` },
    ];
  }, [weeklyWorkoutCount, weeklyMinutes, weeklyHoursLabel, volumeDeltaPct]);

  const recentWorkout = recents[0] || null;
  const recentTemplate = recentWorkout ? recentWorkout.title : "";

  const weeklySplit = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = addDays(today, mondayOffset);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = ymd(addDays(weekStart, i));
      const hit = weeklyWorkouts.find((row) => row.dateISO === date);
      const isToday = date === ymd(today);
      return {
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
        group: hit?.group || undefined,
        detail:
          hit?.group === "push"
            ? "Push"
            : hit?.group === "pull"
            ? "Pull"
            : hit?.group === "legs"
            ? "Legs"
            : hit?.group === "full"
            ? "Full"
            : hit?.group === "cardio" || hit?.group === "recovery"
            ? "Rest"
            : "",
        isToday,
      };
    });
    return days;
  }, [weeklyWorkouts]);

  const splitCounts = useMemo(() => {
    return weeklySplit.reduce(
      (acc, day) => {
        if (day.group === "push" || day.group === "pull" || day.group === "legs") acc[day.group] += 1;
        return acc;
      },
      { push: 0, pull: 0, legs: 0 }
    );
  }, [weeklySplit]);

  const splitInsight = useMemo(() => {
    if (weeklyWorkoutCount === 0) return "No workouts logged yet this week";
    if (weeklyWorkoutCount < 2) return "Log one more session to see your split balance";
    const values = [splitCounts.push, splitCounts.pull, splitCounts.legs];
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max - min <= 1) return "Push · Pull · Legs balance looks good";
    const weakest =
      splitCounts.push === min ? "Push" : splitCounts.pull === min ? "Pull" : "Legs";
    return `${weakest} is trailing this week — rebalance your split next session`;
  }, [splitCounts, weeklyWorkoutCount]);

  const nextWorkoutSuggestion = useMemo(() => {
    if (weeklyWorkoutCount < 1) return "";
    const entries = [
      { key: "push", count: splitCounts.push, label: "Push day" },
      { key: "pull", count: splitCounts.pull, label: "Pull day" },
      { key: "legs", count: splitCounts.legs, label: "Leg day" },
    ].sort((a, b) => a.count - b.count);
    const target = entries[0]?.label || "Full body";
    return `Based on your split, next up: ${target} · ~45 min`;
  }, [splitCounts, weeklyWorkoutCount]);

  const recentPRs = useMemo(() => {
    const sorted = (workoutRows || [])
      .slice()
      .sort((a, b) => {
        const at = Number((a as any).setCreatedAt || 0) || Number((a as any).sessionStartedAt || 0);
        const bt = Number((b as any).setCreatedAt || 0) || Number((b as any).sessionStartedAt || 0);
        return at - bt;
      });
    const bestByExercise = new Map<string, number>();
    const prs: Array<{ id: string; exercise: string; text: string; date: string; when: string; value: number; weight: number }> = [];
    const seen = new Map<string, { idx: number; value: number; weight: number }>();
    for (const row of sorted) {
      const exercise = String((row as any).exercise || "").trim();
      if (!exercise) continue;
      const sets = Math.max(1, Number((row as any).sets || 1));
      const reps = Math.max(0, Number((row as any).reps || 0));
      const weight = Math.round(Number((row as any).weight || 0));
      const value = volumeKg(Number((row as any).sets || 0), Number((row as any).reps || 0), Number((row as any).weight || 0));
      if (value <= 0) continue;
      const key = exercise.toLowerCase();
      const prev = bestByExercise.get(key) || 0;
      if (value > prev) {
        bestByExercise.set(key, value);
        const date = String((row as any).date || "");
        const dedupeKey = `${key}|${date}|${sets}x${reps}`;
        const existing = seen.get(dedupeKey);
        const candidate = {
          id: String((row as any).id || `${key}-${value}`),
          exercise,
          text: `${sets}×${reps} @ ${weight}kg`,
          date,
          when: date
            ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "Recent",
          value,
          weight,
        };
        if (existing) {
          if (weight > existing.weight) {
            prs[existing.idx] = candidate;
            seen.set(dedupeKey, { idx: existing.idx, value, weight });
          }
        } else {
          seen.set(dedupeKey, { idx: prs.length, value, weight });
          prs.push(candidate);
        }
      }
    }
    return prs.slice(-3).reverse();
  }, [workoutRows]);

  const muscleVolumes = useMemo(() => {
    const out = {
      chest: 0,
      shoulders: 0,
      biceps: 0,
      triceps: 0,
      forearms: 0,
      abs: 0,
      back: 0,
      traps: 0,
      lats: 0,
      rhomboids: 0,
      lowerBack: 0,
      quads: 0,
      adductors: 0,
      hamstrings: 0,
      glutes: 0,
      calves: 0,
    };
    for (const row of weeklyWorkoutRows) {
      const explicit = inferPrimaryMuscle(
        String((row as any).exercise || ""),
        String((row as any).primaryMuscle || "")
      );
      const v = 1;
      if (explicit) {
        out[explicit] += v;
        continue;
      }
      const all = `${(row as any).exercise || ""} ${(row as any).notes || ""}`.toLowerCase();
      if (/bench|chest|press/.test(all)) out.chest += v;
      if (/shoulder|lateral|press/.test(all)) out.shoulders += v;
      if (/tricep|dip|pushdown/.test(all)) out.triceps += v;
      if (/row|pulldown|lat|pull/.test(all)) {
        out.back += v;
        out.lats += v;
        out.rhomboids += v;
      }
      if (/trap|shrug/.test(all)) out.traps += v;
      if (/deadlift|rdl|lower back|back extension/.test(all)) out.lowerBack += v;
      if (/curl|bicep/.test(all)) out.biceps += v;
      if (/forearm|grip|wrist/.test(all)) out.forearms += v;
      if (/squat|leg press|quad|lunge/.test(all)) out.quads += v;
      if (/rdl|hamstring|curl/.test(all)) out.hamstrings += v;
      if (/glute|hip thrust|rdl/.test(all)) out.glutes += v;
      if (/calf/.test(all)) out.calves += v;
      if (/adductor|copenhagen|groin/.test(all)) out.adductors += v;
      if (/core|plank|crunch|ab/.test(all)) out.abs += v;
    }
    return out;
  }, [weeklyWorkoutRows]);

  const undertrainedMuscles = useMemo(() => {
    return Object.entries(muscleVolumes)
      .filter(([, value]) => value <= 0)
      .map(([key]) => key)
      .slice(0, 2);
  }, [muscleVolumes]);

  const muscleLastTrained = useMemo(() => {
    const out: Record<string, string> = {};
    const sorted = (workoutRows || []).slice().sort((a, b) => {
      const ad = String((a as any).date || "");
      const bd = String((b as any).date || "");
      if (ad !== bd) return bd.localeCompare(ad);
      return Number((b as any).setCreatedAt || 0) - Number((a as any).setCreatedAt || 0);
    });
    for (const row of sorted) {
      const explicit = inferPrimaryMuscle(
        String((row as any).exercise || ""),
        String((row as any).primaryMuscle || "")
      );
      const date = String((row as any).date || "");
      const all = `${(row as any).exercise || ""} ${(row as any).notes || ""}`.toLowerCase();
      const dateLabel = date
        ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "Recent";
      const assign = (key: string, hit: boolean) => {
        if (hit && !out[key]) out[key] = dateLabel;
      };
      if (explicit) {
        assign(explicit, true);
        continue;
      }
      assign("chest", /bench|chest|press/.test(all));
      assign("shoulders", /shoulder|lateral|press/.test(all));
      assign("biceps", /curl|bicep/.test(all));
      assign("triceps", /tricep|dip|pushdown/.test(all));
      assign("forearms", /forearm|grip|wrist/.test(all));
      assign("abs", /core|plank|crunch|ab/.test(all));
      assign("quads", /squat|leg press|quad|lunge/.test(all));
      assign("adductors", /adductor|copenhagen|groin/.test(all));
      assign("traps", /trap|shrug/.test(all));
      assign("lats", /lat|pulldown|pull/.test(all));
      assign("rhomboids", /row|rhomboid/.test(all));
      assign("lowerBack", /deadlift|rdl|lower back|back extension/.test(all));
      assign("glutes", /glute|hip thrust|rdl/.test(all));
      assign("hamstrings", /hamstring|rdl|curl/.test(all));
      assign("calves", /calf/.test(all));
    }
    return out;
  }, [workoutRows]);

  const cardioWeekSummary = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = ymd(addDays(today, mondayOffset));
    const end = ymd(addDays(today, mondayOffset + 6));
    const weekly = validActivityEntries.filter((entry) => {
      const d = new Date(entry.timestamp);
      const date = ymd(d);
      return date >= start && date <= end;
    });
    const mins = weekly.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    const estimateRates: Record<string, number> = {
      walk: 4,
      run: 10,
      bike: 8,
      swim: 8,
      sport: 11,
      stairs: 9,
      yoga: 3,
      stretch: 2,
      other: 6,
    };
    const hasAppleCalories = weekly.some(
      (entry) =>
        Number(entry.calories || 0) > 0 &&
        String((entry as any).note || "").toLowerCase().includes("apple health")
    );
    const kcals = weekly.reduce((sum, entry) => {
      const logged = Number(entry.calories || 0);
      if (logged > 0) return sum + logged;
      const rate = estimateRates[String(entry.type || "other")] || 6;
      return sum + rate * Number(entry.minutes || 0);
    }, 0);
    return { mins, kcals, viaApple: hasAppleCalories };
  }, [validActivityEntries]);

  const displayedTemplates = useMemo(() => {
    const deriveTags = (t: TemplateVM) => {
      if (t.tags?.length) return t.tags.slice(0, 3);
      const text = `${t.name} ${t.items.map((i) => i.exercise).join(" ")}`.toLowerCase();
      if (/squat|leg|rdl|hamstring|glute/.test(text)) return ["Quads", "Hamstrings", "Core"];
      if (/pull|row|lat|curl/.test(text)) return ["Back", "Biceps", "Rear delts"];
      if (/push|bench|press|tricep/.test(text)) return ["Chest", "Shoulders", "Triceps"];
      return ["Full body"];
    };
    const candidates = userTemplatesPreview
      .filter((template) => !template.archived)
      .map((template) => {
        const raw =
          (template.lastUsedAt as any)?.toMillis?.() ||
          (template.updatedAt as any)?.toMillis?.() ||
          (template.createdAt as any)?.toMillis?.() ||
          0;
        const days = raw ? Math.floor((Date.now() - raw) / 86400000) : 999;
        const keepUntil = Number(templateKeepUntil[template.id] || 0);
        return {
          ...template,
          displayTags: deriveTags(template),
          staleDays: days,
          stale: days > 60 && keepUntil < Date.now(),
        };
      })
      .sort((a, b) => b.staleDays - a.staleDays);
    const staleId = candidates.find((template) => template.stale)?.id;
    return candidates.slice(0, 2).map((template) => ({
      ...template,
      stale: template.id === staleId,
    }));
  }, [userTemplatesPreview, templateKeepUntil]);

  const headerBorderAnimStyle = useAnimatedStyle(() => {
    // fade border in after slight scroll
    const o = Math.min(Math.max(scrollY.value / 18, 0), 1);
    return { opacity: o };
  });
  return (
    <View style={[styles.root, { backgroundColor: s.colors.bg }]}>
      {isDeletingSession ? (
        <View style={[styles.deleteOverlay, { backgroundColor: withAlpha(s.colors.textPrimary, 0.35) }]}>
          <View
            style={[
              styles.deleteCard,
              {
                borderColor: withAlpha(s.colors.surface1, 0.18),
                backgroundColor: withAlpha(s.colors.surface2, 0.88),
              },
            ]}
          >
            <ActivityIndicator size="small" color={withAlpha(s.t1, 0.9)} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.deleteTitle, { color: s.t1 }]}>
                Deleting workout…
              </Text>
              <Text style={[styles.deleteSub, { color: s.t2 }]}>
                {deletingLabel || "Hang tight"}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.headerContainer,
          { paddingTop: topInset },
          headerAnimStyle,
        ]}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <View
          style={[
            styles.headerBlur,
            {
              backgroundColor: s.colors.background,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: s.colors.border,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.headerHairline,
              { backgroundColor: s.hairline },
              headerBorderAnimStyle,
            ]}
          />

          <View style={[styles.headerRow, { paddingHorizontal: sidePad }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: s.t1 }]}>Workouts</Text>
              <Text style={[styles.subtitle, { color: s.t2 }]}>
                {weeklySubtitle}
              </Text>
            </View>

            <ScalePressable
              onPress={onStart}
              accessibilityLabel="Start workout"
              accessibilityHint="Starts a new workout"
            >
              <View
                style={[
                  styles.startBtn,
                  { backgroundColor: "transparent", borderColor: withAlpha(s.colors.primary, 0.5) },
                ]}
              >
                <Ionicons name="add" size={18} color={s.colors.primary} />
                <Text style={[styles.startBtnText, { color: s.colors.primary }]}>+ New</Text>
              </View>
            </ScalePressable>
          </View>
        </View>
      </Animated.View>

      <AFlatList
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        data={recentData}
        keyExtractor={(item, index) =>
          (item as WorkoutSummary)?.id ?? String(index)
        }
        renderItem={renderRecentItem}
        contentContainerStyle={{
          paddingBottom: 28,
          paddingTop: headerH + 14,
          paddingHorizontal: sidePad,
        }}
        ListHeaderComponent={
          <View>
            <StartWorkoutCard
              onStart={onStart}
              onOptions={onOptions}
              onResumeLast={
                recentWorkout
                  ? async () => {
                      const { sessions } = buildSessionBuckets(workoutRows);
                      const session = sessions.find(
                        (entry) => entry.key === recentWorkout.id
                      );
                      if (!session) return;
                      await startFromSession(session);
                    }
                  : undefined
              }
              resumeLabel={recentTemplate}
              onSurprise={onSurprise}
            />

            {nextWorkoutSuggestion ? (
              <NextWorkoutSuggestionChip
                text={nextWorkoutSuggestion}
                onPress={() =>
                  router.push({
                    pathname: "/(modals)/coach-spark",
                    params: { focus: nextWorkoutSuggestion.includes("Pull") ? "Upper" : nextWorkoutSuggestion.includes("Leg") ? "Lower" : "Balanced", duration: "45", style: "Balanced" },
                  } as any)
                }
              />
            ) : null}

            <SmallCapsHeader title="Weekly Stats" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
            >
              {weeklyStatTiles.map((tile) => (
                <StatTile key={tile.label} title={tile.label} value={tile.value} sub={tile.sub} />
              ))}
            </ScrollView>

            <WeeklySplitVisualizer days={weeklySplit} insight={splitInsight} />

            <SmallCapsHeader title="AI Coach" />
            <View style={{ marginTop: 10 }}>
              <CoachSparkCardPremium
                contextLine={coachSparkContextLine}
                onOpen={() => router.push("/(modals)/coach-spark")}
                onQuickPick={(preset) => {
                  if (preset === "surprise") {
                    router.push({
                      pathname: "/(modals)/coach-spark",
                      params: { instant: "1", quickPreset: "surprise" },
                    } as any);
                    return;
                  }
                  if (preset === "push") {
                    router.push({
                      pathname: "/(modals)/coach-spark",
                      params: { mode: "quick", focus: "Push" },
                    } as any);
                    return;
                  }
                  router.push({
                    pathname: "/(modals)/coach-spark",
                    params: { mode: "quick", duration: "15-30" },
                  } as any);
                }}
              />
            </View>
            <RecoveryCoachCard
              onPress={() =>
                router.push({
                  pathname: "/(modals)/coach-spark",
                  params: {
                    focus: "Mobility",
                    duration: "20",
                    style: "Calm",
                  },
                } as any)
              }
            />

            <TemplatesOverview
              templates={displayedTemplates}
              onViewAll={onViewAllTemplates}
              onCreateNew={onCreateTemplate}
              onUseTemplate={(id) => {
                const t = templatesMerged.find((x) => x.id === id);
                if (t) startFromTemplate(t);
              }}
              onManageTemplate={(id) => {
                const t = templatesMerged.find((x) => x.id === id);
                if (t) openTemplateActions(t);
              }}
              onKeepTemplate={keepTemplateFresh}
              onArchiveTemplate={archiveTemplate}
            />

            <PRFeed prs={recentPRs} />

            <View style={{ marginTop: 10 }}>
              <SectionHeader title="Recent Workouts" actionLabel="See more" onAction={onSeeMoreHistory} />
              <Text style={[styles.helperText, { color: s.t2 }]}>Tap a workout for details or duplicate it to repeat fast.</Text>
            </View>

            <View style={{ height: 10 }} />
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingBottom: 62 }}>
            <MuscleHeatmapCard
              muscleVolumes={muscleVolumes}
              undertrained={undertrainedMuscles}
              lastTrainedMap={muscleLastTrained}
              sex={profile?.sex === "female" ? "female" : "male"}
            />
            <View style={{ marginTop: 10 }}>
              <SectionHeader title="Activity" />
              <Text style={[styles.helperText, { color: s.t2 }]}>
                This week: {cardioWeekSummary.mins} min cardio · ~{Math.round(cardioWeekSummary.kcals)} kcal burned
                {cardioWeekSummary.viaApple ? " · via Apple Health" : ""}
              </Text>
            </View>

            <View style={{ marginTop: 10 }}>
              <ActivityCard
                entries={validActivityEntries}
                goal={{ minutesPerDay: 30 }}
                onCreate={handleCreateActivity}
                onUpdate={handleUpdateActivity}
                onDelete={handleDeleteActivity}
                title="Movement"
                subtitle="Cardio + movement"
                presets={[
                  {
                    type: "walk",
                    minutes: 10,
                    intensity: "easy",
                    label: "Walk 10 · ~40 kcal",
                  },
                  {
                    type: "run",
                    minutes: 20,
                    intensity: "moderate",
                    label: "Run 20 · ~180 kcal",
                  },
                  {
                    type: "bike",
                    minutes: 20,
                    intensity: "moderate",
                    label: "Bike 20 · ~150 kcal",
                  },
                  {
                    type: "swim",
                    minutes: 20,
                    intensity: "moderate",
                    label: "Swim 20 · ~160 kcal",
                  },
                  {
                    type: "sport",
                    minutes: 15,
                    intensity: "hard",
                    label: "HIIT 15 · ~170 kcal",
                  },
                ]}
              />
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Workout options sheet */}
      <SheetShell
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title="Workout options"
        subtitle="Set the session up before you start."
      >
        <View style={{ marginTop: 6, gap: 12 }}>
          <View>
            <Text style={[styles.sheetFieldLabel, { color: s.t2 }]}>
              Workout name
            </Text>
            <TextInput
              value={configTitle}
              onChangeText={setConfigTitle}
              placeholder="Workout"
              placeholderTextColor={s.t3}
              style={[
                styles.sheetTextInput,
                {
                  color: s.t1,
                  backgroundColor: s.colors.surface2,
                  borderColor: s.hairline,
                },
              ]}
            />
          </View>

          <View>
            <Text style={[styles.sheetFieldLabel, { color: s.t2 }]}>
              Target muscle group
            </Text>
            <View style={styles.sheetChipRow}>
              <Pressable
                onPress={() => setConfigMuscle("")}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: !configMuscle
                      ? withAlpha(s.colors.primary, 0.14)
                      : s.colors.surface2,
                    borderColor: !configMuscle
                      ? withAlpha(s.colors.primary, 0.3)
                      : s.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sheetChipText,
                    { color: !configMuscle ? s.colors.primary : s.t2 },
                  ]}
                >
                  Auto
                </Text>
              </Pressable>
              {PRIMARY_MUSCLE_OPTIONS.slice(0, 6).map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setConfigMuscle(option.key)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor:
                        configMuscle === option.key
                          ? withAlpha(s.colors.primary, 0.14)
                          : s.colors.surface2,
                      borderColor:
                        configMuscle === option.key
                          ? withAlpha(s.colors.primary, 0.3)
                          : s.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChipText,
                      {
                        color:
                          configMuscle === option.key
                            ? s.colors.primary
                            : s.t2,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.sheetFieldLabel, { color: s.t2 }]}>
              Estimated duration
            </Text>
            <View style={styles.sheetChipRow}>
              {["30", "45", "60", "75"].map((duration) => (
                <Pressable
                  key={duration}
                  onPress={() => setConfigDuration(duration)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor:
                        configDuration === duration
                          ? withAlpha(s.colors.primary, 0.14)
                          : s.colors.surface2,
                      borderColor:
                        configDuration === duration
                          ? withAlpha(s.colors.primary, 0.3)
                          : s.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChipText,
                      {
                        color:
                          configDuration === duration
                            ? s.colors.primary
                            : s.t2,
                      },
                    ]}
                  >
                    {duration} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={async () => {
              setStartOpen(false);
              await openSession({
                freshStart: "1",
                configTitle: (configTitle || "Workout").trim() || "Workout",
                configMuscle,
                configDuration,
              });
            }}
            style={({ pressed }) => [
              styles.sheetPrimaryBtn,
              { backgroundColor: s.colors.primary },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={[styles.sheetPrimaryBtnText, { color: s.colors.buttonText }]}>
              Start configured workout →
            </Text>
          </Pressable>
        </View>
      </SheetShell>

      <SheetShell
        open={surpriseOpen}
        onClose={() => setSurpriseOpen(false)}
        title={surpriseTemplate ? surpriseTemplate.name : "No templates yet"}
        subtitle={
          surpriseTemplate
            ? "A smart pick from your saved templates."
            : "Create one first to use Surprise me."
        }
      >
        {surpriseTemplate ? (
          <View style={{ marginTop: 6, gap: 12 }}>
            <View
              style={[
                styles.sheetPreviewCard,
                { backgroundColor: s.colors.surface2, borderColor: s.hairline },
              ]}
            >
              {(surpriseTemplate.items || []).slice(0, 4).map((item, index) => (
                <Text
                  key={`${surpriseTemplate.id}-${item.exercise}-${index}`}
                  style={[styles.sheetPreviewText, { color: s.t2 }]}
                >
                  {item.exercise}
                </Text>
              ))}
            </View>
            <Pressable
              onPress={async () => {
                setSurpriseOpen(false);
                await startFromTemplate(surpriseTemplate);
              }}
              style={({ pressed }) => [
                styles.sheetPrimaryBtn,
                { backgroundColor: s.colors.primary },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={[styles.sheetPrimaryBtnText, { color: s.colors.buttonText }]}>
                Let&apos;s go →
              </Text>
            </Pressable>
            <Pressable
              onPress={rerollSurpriseTemplate}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.sheetTextLink, { color: s.colors.primary }]}>
                Pick another →
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 6, gap: 12 }}>
            <Text style={[styles.sheetPreviewText, { color: s.t2 }]}>
              No templates yet · Create one first
            </Text>
            <Pressable
              onPress={() => {
                setSurpriseOpen(false);
                onCreateTemplate();
              }}
              style={({ pressed }) => [
                styles.sheetPrimaryBtn,
                { backgroundColor: s.colors.primary },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={[styles.sheetPrimaryBtnText, { color: s.colors.buttonText }]}>
                Create template
              </Text>
            </Pressable>
          </View>
        )}
      </SheetShell>

      {/* Templates sheet */}
      <SheetShell
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="Templates"
        subtitle="Tap a template for options."
      >
        <View style={{ marginTop: 6 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 420 }}
          >
            {templatesMerged.map((t) => (
              <SheetRow
                key={`${t.source}-${t.id}`}
                icon="albums-outline"
                title={`${t.emoji ?? "🏋️"}  ${t.name}  ${
                  t.source === "user" ? "• Saved" : "• Suggested"
                }`}
                subtitle={t.tag}
                onPress={() => {
                  setTemplatesOpen(false);
                  openTemplateActions(t);
                }}
              />
            ))}
            <View style={{ height: 6 }} />
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Pressable
              onPress={() => {
                setTemplatesOpen(false);
                onCreateTemplate();
              }}
              style={({ pressed }) => [
                styles.sheetPrimaryBtn,
                { backgroundColor: s.colors.primary },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color="#fff" />
              <Text style={[styles.sheetPrimaryBtnText, { color: "#fff" }]}>
                Create template
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setTemplatesOpen(false);
                onViewAllTemplates();
              }}
              style={({ pressed }) => [
                styles.sheetGhostBtn,
                { backgroundColor: s.ghostFill, borderColor: s.ghostBorder },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="grid-outline" size={16} color={s.icon} />
              <Text style={[styles.sheetGhostBtnText, { color: s.t1 }]}>
                View all
              </Text>
            </Pressable>
          </View>
        </View>
      </SheetShell>

      <Toast
        text={toast?.text ?? ""}
        actionLabel={toast?.undo ? "Undo" : undefined}
        onAction={toast?.undo}
        onHide={() => setToast(null)}
      />

      {/* Template actions modal */}
      <Modal visible={templateActionsOpen} transparent animationType="fade">
        <Pressable
          onPress={() => setTemplateActionsOpen(false)}
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: s.isDark
                ? withAlpha(s.colors.textPrimary, 0.55)
                : withAlpha(s.colors.textPrimary, 0.18),
            },
          ]}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.modalCard,
              {
                backgroundColor: s.isDark
                  ? withAlpha(s.colors.background, 0.98)
                  : withAlpha(s.colors.surface1, 0.9),
                borderColor: s.hairline,
              },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: s.t1 }]}
              numberOfLines={1}
            >
              {activeTemplate?.name || "Template"}
            </Text>
            <Text style={[styles.modalSub, { color: s.t2 }]}>
              Start it, keep it active, archive it, or remove it.
            </Text>

            <Pressable
              onPress={async () => {
                if (!activeTemplate) return;
                setTemplateActionsOpen(false);
                await startFromTemplate(activeTemplate);
              }}
              style={[
                styles.modalPrimary,
                {
                  backgroundColor: s.isDark
                    ? withAlpha(s.colors.primary, 0.22)
                    : withAlpha(s.colors.primary, 0.12),
                  borderColor: s.isDark
                    ? withAlpha(s.colors.primary, 0.35)
                    : withAlpha(s.colors.primary, 0.25),
                },
              ]}
            >
              <Text style={[styles.modalPrimaryText, { color: s.t1 }]}>
                Use template
              </Text>
            </Pressable>

            {activeTemplate?.source === "user" ? (
              <Pressable
                onPress={async () => {
                  if (!activeTemplate) return;
                  await keepTemplateFresh(activeTemplate.id);
                  setTemplateActionsOpen(false);
                }}
                style={[
                  styles.modalSecondary,
                  {
                    borderColor: s.hairline,
                    backgroundColor: s.isDark
                      ? withAlpha(s.colors.surface1, 0.04)
                      : withAlpha(s.colors.surface1, 0.72),
                  },
                ]}
              >
                <Text style={[styles.modalSecondaryText, { color: s.t1 }]}>
                  Keep active for 30 days
                </Text>
              </Pressable>
            ) : null}

            {activeTemplate?.source === "user" ? (
              <Pressable
                onPress={async () => {
                  if (!activeTemplate) return;
                  await archiveTemplate(activeTemplate.id);
                  setTemplateActionsOpen(false);
                }}
                style={[
                  styles.modalSecondary,
                  {
                    borderColor: withAlpha(s.colors.warning, 0.25),
                    backgroundColor: s.isDark
                      ? withAlpha(s.colors.surface1, 0.04)
                      : withAlpha(s.colors.surface1, 0.72),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalSecondaryText,
                    { color: withAlpha(s.colors.warning, 0.95) },
                  ]}
                >
                  Archive template
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                if (!uid || !activeTemplate) return;

                if (activeTemplate.source !== "user") {
                  RNAlert.alert(
                    "Not editable",
                    "Suggested templates can't be deleted."
                  );
                  return;
                }

                RNAlert.alert("Delete template?", "This can't be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      await deleteWorkoutTemplate(uid, activeTemplate.id);
                      setTemplateActionsOpen(false);
                    },
                  },
                ]);
              }}
              style={[
                styles.modalSecondary,
                {
                  borderColor: withAlpha(s.colors.danger, 0.25),
                  backgroundColor: s.isDark
                    ? withAlpha(s.colors.surface1, 0.04)
                    : withAlpha(s.colors.surface1, 0.72),
                },
              ]}
            >
              <Text
                style={[
                  styles.modalSecondaryText,
                  { color: withAlpha(s.colors.danger, 0.95) },
                ]}
              >
                Delete template
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SmallCapsHeader({ title }: { title: string }) {
  const s = useSurfaceTokens();
  return (
    <Text
      style={[
        styles.smallCapsHeader,
        { color: s.t2, borderBottomColor: s.hairline },
      ]}
    >
      {title}
    </Text>
  );
}

function StatTile({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  const s = useSurfaceTokens();
  return (
    <View
      style={[
        styles.flatStatTile,
        { backgroundColor: s.colors.surface1, borderColor: s.hairline },
      ]}
    >
      <Text style={[styles.flatStatTitle, { color: s.t2 }]}>{title}</Text>
      <Text style={[styles.flatStatValue, { color: s.t1 }]}>{value}</Text>
      {!!sub && (
        <Text style={[styles.flatStatSub, { color: s.t2 }]} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function StartWorkoutCard({
  onStart,
  onOptions,
  onResumeLast,
  resumeLabel,
  onSurprise,
}: {
  onStart: () => void;
  onOptions: () => void;
  onResumeLast?: () => void;
  resumeLabel?: string;
  onSurprise?: () => void;
}) {
  const s = useSurfaceTokens();
  return (
    <View
      style={[
        styles.startWorkoutCard,
        { backgroundColor: s.colors.surface1, borderColor: s.hairline },
      ]}
    >
      <View style={styles.startWorkoutHeader}>
        <View style={[styles.readyChip, { borderWidth: 1, borderColor: withAlpha(s.colors.primary, 0.35), backgroundColor: withAlpha(s.colors.primary, 0.08) }]}>
          <Text style={[styles.readyChipText, { color: s.t2 }]}>
            Ready when you are
          </Text>
        </View>
        <Text style={[styles.startWorkoutTitle, { color: s.t1 }]}>
          Start a workout
        </Text>
        <Text style={[styles.startWorkoutSub, { color: s.t2 }]} numberOfLines={1}>
          Pick up where you left off or start fresh.
        </Text>
      </View>

      <Pressable
        onPress={onStart}
        style={({ pressed }) => [
          styles.primaryWideButton,
          { backgroundColor: s.colors.primary, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Ionicons name="add" size={16} color={s.colors.buttonText} />
        <Text style={[styles.primaryWideButtonText, { color: s.colors.buttonText }]}>+ Start</Text>
      </Pressable>

      <Pressable
        onPress={onOptions}
        style={({ pressed }) => [
          styles.secondaryButton,
          { backgroundColor: s.colors.surface2, borderColor: s.hairline, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: s.t1 }]}>
          Options
        </Text>
      </Pressable>

      <View style={styles.quickStartRow}>
        {onResumeLast ? (
          <Pressable
            onPress={onResumeLast}
            style={({ pressed }) => [
              styles.quickStartChip,
              { backgroundColor: s.colors.surface2, borderColor: s.hairline },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="play" size={12} color={s.t2} />
              <Text style={[styles.quickStartChipText, { color: s.t1 }]} numberOfLines={1}>
                {`Resume last: ${resumeLabel || "Last workout"}`}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSurprise}
          style={({ pressed }) => [
            styles.quickStartChip,
            { backgroundColor: s.colors.surface2, borderColor: s.hairline },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="shuffle" size={12} color={s.t2} />
            <Text style={[styles.quickStartChipText, { color: s.t1 }]}>
              Surprise me
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function NextWorkoutSuggestionChip({
  text,
  onPress,
}: {
  text: string;
  onPress?: () => void;
}) {
  const s = useSurfaceTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.nextSuggestionChip,
        { backgroundColor: withAlpha(s.colors.primary, 0.14), borderColor: withAlpha(s.colors.primary, 0.3) },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.nextSuggestionText, { color: s.t1 }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={14} color={s.t2} />
    </Pressable>
  );
}

function WeeklySplitVisualizer({
  days,
  insight,
}: {
  days: Array<{ label: string; group?: string; detail?: string; isToday?: boolean }>;
  insight: string;
}) {
  const s = useSurfaceTokens();
  const toneForGroup = (group?: string) =>
    group === "push"
      ? s.colors.primary
      : group === "pull"
        ? s.colors.info
        : group === "legs"
          ? s.colors.success
          : group === "full"
            ? s.colors.warning
            : s.colors.textTertiary;
  const shortForGroup = (group?: string) =>
    group === "push"
      ? "P"
      : group === "pull"
        ? "PL"
        : group === "legs"
          ? "L"
          : group === "full"
            ? "FB"
            : group === "cardio" || group === "recovery"
              ? "R"
              : "—";
  return (
    <View
      style={[
        styles.splitCard,
        { backgroundColor: s.colors.surface1, borderColor: s.hairline },
      ]}
    >
      <View style={styles.splitHeaderRow}>
        <Text style={[styles.splitTitle, { color: s.t1 }]}>This week&apos;s split</Text>
      </View>
      <View style={styles.splitPillRow}>
        {days.map((day) => (
          <View key={day.label} style={styles.splitDayWrap}>
            <Text style={[styles.splitDayMeta, { color: s.t2 }]}>
              {day.label.slice(0, 3)}
            </Text>
            <View
              style={[
                styles.splitDayPill,
                {
                  backgroundColor: day.group
                    ? withAlpha(toneForGroup(day.group), day.group === "full" ? 0.16 : 0.12)
                    : s.colors.surface3,
                  borderColor: day.isToday
                    ? s.colors.primary
                    : day.group
                      ? withAlpha(toneForGroup(day.group), 0.34)
                      : s.hairline,
                  borderWidth: day.isToday ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text
                style={[
                  styles.splitDayLabel,
                  { color: day.group ? toneForGroup(day.group) : s.t2 },
                ]}
              >
                {shortForGroup(day.group)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text
        style={[
          styles.splitInsight,
          {
            color: s.t2,
            fontStyle: insight.includes("No workouts") ? "italic" : "normal",
          },
        ]}
      >
        {insight}
      </Text>
    </View>
  );
}

function RecoveryCoachCard({ onPress }: { onPress?: () => void }) {
  const s = useSurfaceTokens();
  const [integrations, setIntegrations] = useState<IntegrationSnapshot | null>(
    null
  );
  useEffect(() => subscribeIntegrations(setIntegrations), []);
  const recovery = useMemo(() => getRecoveryMetrics(integrations), [integrations]);
  const score = recovery?.recoveryScore ?? null;
  const tone =
    score == null
      ? s.colors.warning
      : score < 40
        ? s.colors.warning
        : score > 80
          ? s.colors.success
          : s.colors.primary;
  const badge =
    score == null ? "Fatigued" : score < 40 ? "Low recovery" : score > 80 ? "Recovered" : "Ready";
  const body =
    score == null
      ? "Your last session was rated Fatigued. Consider a lighter session or rest today."
      : score < 40
      ? `Low recovery detected. ${recovery?.sourceName || "Your wearable"} suggests rest or light movement today.`
      : score > 80
      ? `Recovery: ${Math.round(score)}% · HRV: ${Math.round(
          recovery?.hrvMs || 0
        )}ms · Resting HR: ${Math.round(
          recovery?.restingHeartRateBpm || 0
        )}bpm · Good day to push intensity.`
      : `Recovery: ${Math.round(score)}% · HRV: ${Math.round(
          recovery?.hrvMs || 0
        )}ms · Resting HR: ${Math.round(
          recovery?.restingHeartRateBpm || 0
        )}bpm · Ready to train.`;
  return (
    <View
      style={[
        styles.recoveryCard,
        { backgroundColor: s.colors.surface1, borderColor: s.hairline },
      ]}
    >
      <View style={styles.recoveryTopRow}>
        <View style={[styles.recoveryBadge, { backgroundColor: withAlpha(tone, 0.14), borderColor: withAlpha(tone, 0.28) }]}>
          <Text style={[styles.recoveryBadgeText, { color: tone }]}>{badge}</Text>
        </View>
      </View>
      <Text style={[styles.recoveryTitle, { color: s.t1 }]}>Recovery check</Text>
      <Text style={[styles.recoveryBody, { color: s.t2 }]}>
        {body}
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.recoveryAction,
          { borderColor: s.hairline, backgroundColor: withAlpha(s.colors.surface1, 0.04) },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[styles.recoveryActionText, { color: s.t1 }]}>
          Plan rest day →
        </Text>
      </Pressable>
    </View>
  );
}

function TemplatesOverview({
  templates,
  onViewAll,
  onCreateNew,
  onUseTemplate,
  onManageTemplate,
  onKeepTemplate,
  onArchiveTemplate,
}: {
  templates: any[];
  onViewAll?: () => void;
  onCreateNew?: () => void;
  onUseTemplate?: (id: string) => void;
  onManageTemplate?: (id: string) => void;
  onKeepTemplate?: (id: string) => void;
  onArchiveTemplate?: (id: string) => void;
}) {
  const s = useSurfaceTokens();
  return (
    <View style={{ marginTop: 18 }}>
      <SectionHeader title="Templates" actionLabel="View all" onAction={onViewAll} />
      <View style={styles.templatesGrid}>
        {templates.map((template) => (
          <Pressable
            key={template.id}
            onPress={() => onUseTemplate?.(template.id)}
            style={({ pressed }) => [
              styles.templateOverviewCard,
              { backgroundColor: s.colors.surface1, borderColor: s.hairline },
              pressed && { opacity: 0.92 },
            ]}
          >
            <View style={styles.templateOverviewTop}>
              <View style={[styles.templateOverviewIcon, { backgroundColor: s.colors.surface3 }]}>
                <Text style={[styles.templateOverviewIconText, { color: s.t1 }]}>
                  {(template.name || "W").slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.templateOverviewName, { color: s.t1 }]} numberOfLines={1}>
                  {template.name}
                </Text>
                <Text style={[styles.templateOverviewMeta, { color: s.t2 }]} numberOfLines={1}>
                  {template.lastUsedLabel || "Saved template"}
                </Text>
              </View>
              <Pressable
                onPress={() => onManageTemplate?.(template.id)}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={s.t2} />
              </Pressable>
            </View>
            {template.stale ? (
              <View style={[styles.staleChip, { backgroundColor: withAlpha(s.colors.warning, 0.12), borderColor: withAlpha(s.colors.warning, 0.24) }]}>
                <Text style={[styles.staleChipText, { color: s.colors.warning }]}>
                  Haven&apos;t used in a while — still relevant?
                </Text>
                <View style={styles.staleActionsRow}>
                  <Pressable
                    onPress={() => onKeepTemplate?.(template.id)}
                    style={[styles.staleActionBtn, { borderColor: withAlpha(s.colors.success, 0.3) }]}
                  >
                    <Text style={[styles.staleActionText, { color: s.colors.success }]}>Keep ✓</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onArchiveTemplate?.(template.id)}
                    style={[styles.staleActionBtn, { borderColor: withAlpha(s.colors.danger, 0.3) }]}
                  >
                    <Text style={[styles.staleActionText, { color: s.colors.danger }]}>Archive ✗</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.templateTagRow}>
              {(template.displayTags || template.tags || []).slice(0, 3).map((tag: string) => (
                <View
                  key={`${template.id}-${tag}`}
                  style={[styles.templateTagChip, { backgroundColor: s.colors.surface2, borderColor: s.hairline }]}
                >
                  <Text style={[styles.templateTagChipText, { color: s.t2 }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}

        <Pressable
          onPress={onCreateNew}
          style={({ pressed }) => [
            styles.templateOverviewCard,
            styles.templateCreateCard,
            { backgroundColor: s.colors.surface1, borderColor: withAlpha(s.colors.primary, 0.36) },
            pressed && { opacity: 0.92 },
          ]}
        >
          <Ionicons name="add" size={20} color={s.colors.primary} />
          <Text style={[styles.templateCreateText, { color: s.t1 }]}>Create new</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PRFeed({ prs }: { prs: any[] }) {
  const s = useSurfaceTokens();
  const [open, setOpen] = useState(true);
  return (
    <View style={{ marginTop: 18 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.collapsibleHeader}
      >
        <Text style={[styles.collapsibleTitle, { color: s.t1 }]}>Recent PRs</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={s.t2} />
      </Pressable>
      {open ? (
        prs.length ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            {prs.map((pr) => (
              <View
                key={pr.id}
                style={[styles.prFeedRow, { backgroundColor: s.colors.surface1, borderColor: s.hairline }]}
              >
                <Ionicons name="trophy" size={14} color={s.colors.warning} />
                <Text style={[styles.prFeedText, { color: s.t1 }]} numberOfLines={2}>
                  {pr.exercise} · {pr.text}{pr.when ? ` · ${pr.when}` : ""}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={s.t2} />
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.prFeedEmpty, { backgroundColor: s.colors.surface1, borderColor: s.hairline }]}>
            <Text style={[styles.prFeedEmptyText, { color: s.t2 }]}>
              No PRs yet this month — push a little harder next session
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function MuscleHeatmapCard({
  muscleVolumes,
  undertrained,
  lastTrainedMap,
  sex,
}: {
  muscleVolumes: Record<string, number>;
  undertrained: string[];
  lastTrainedMap: Record<string, string>;
  sex: "male" | "female";
}) {
  const s = useSurfaceTokens();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const legend = [
    { label: "Light", color: withAlpha(s.colors.primary, 0.35) },
    { label: "Moderate", color: withAlpha(s.colors.primary, 0.65) },
    { label: "Heavy", color: s.colors.primary },
  ];
  const regionLabels: Record<string, string> = {
    chest: "Chest",
    shoulders: "Shoulders",
    biceps: "Biceps",
    triceps: "Triceps",
    forearms: "Forearms",
    abs: "Abs",
    quads: "Quads",
    adductors: "Adductors",
    traps: "Traps",
    lats: "Lats",
    rhomboids: "Rhomboids",
    lowerBack: "Lower back",
    glutes: "Glutes",
    hamstrings: "Hamstrings",
    calves: "Calves",
  };
  const keyToSlug: Record<string, BodySlug> = {
    chest: "chest",
    shoulders: "deltoids",
    biceps: "biceps",
    triceps: "triceps",
    forearms: "forearm",
    abs: "abs",
    quads: "quadriceps",
    adductors: "adductors",
    traps: "trapezius",
    lats: "upper-back",
    rhomboids: "upper-back",
    lowerBack: "lower-back",
    glutes: "gluteal",
    hamstrings: "hamstring",
    calves: "calves",
  };
  const slugToKeys: Partial<Record<BodySlug, string[]>> = {
    chest: ["chest"],
    deltoids: ["shoulders"],
    biceps: ["biceps"],
    triceps: ["triceps"],
    forearm: ["forearms"],
    abs: ["abs"],
    quadriceps: ["quads"],
    adductors: ["adductors"],
    trapezius: ["traps"],
    "upper-back": ["lats", "rhomboids"],
    "lower-back": ["lowerBack"],
    gluteal: ["glutes"],
    hamstring: ["hamstrings"],
    calves: ["calves"],
  };
  const levelIntensity = (sessions: number) => {
    if (sessions >= 3) return 3;
    if (sessions >= 2) return 2;
    if (sessions >= 1) return 1;
    return 0;
  };
  const bodyData = useMemo<ExtendedBodyPart[]>(() => {
    return Object.entries(keyToSlug)
      .map(([key, slug]) => {
        const sessions = muscleVolumes[key] || 0;
        const intensity = levelIntensity(sessions);
        if (!intensity) return null;
        return {
          slug,
          intensity,
          styles:
            activeKey === key
              ? {
                  stroke: withAlpha(s.colors.textPrimary, 0.3),
                  strokeWidth: 1.5,
                }
              : undefined,
        } as ExtendedBodyPart;
      })
      .filter(Boolean) as ExtendedBodyPart[];
  }, [activeKey, muscleVolumes]);
  const activeRegion = activeKey
    ? {
        key: activeKey,
        label: regionLabels[activeKey] || activeKey,
        sessions: muscleVolumes[activeKey] || 0,
      }
    : null;

  return (
    <View
      style={[
        styles.heatmapCard,
        { backgroundColor: s.colors.surface1, borderColor: s.hairline },
      ]}
    >
      <SectionHeader title="Muscle Heatmap" />
      <View style={styles.heatmapSilhouetteRow}>
        <View style={styles.silhouetteWrap}>
          <Body
            data={bodyData}
            gender={sex}
            side="front"
            scale={0.92}
            border="none"
            defaultFill={s.colors.surface3}
            colors={[withAlpha(s.colors.primary, 0.35), withAlpha(s.colors.primary, 0.65), s.colors.primary]}
            onBodyPartPress={(part) => {
              const key = slugToKeys[part.slug as BodySlug]?.[0];
              if (key) setActiveKey(key);
            }}
          />
          <Text style={[styles.silhouetteLabel, { color: s.t2 }]}>Front</Text>
        </View>
        <View style={styles.silhouetteWrap}>
          <Body
            data={bodyData}
            gender={sex}
            side="back"
            scale={0.92}
            border="none"
            defaultFill={s.colors.surface3}
            colors={[withAlpha(s.colors.primary, 0.35), withAlpha(s.colors.primary, 0.65), s.colors.primary]}
            onBodyPartPress={(part) => {
              const key = slugToKeys[part.slug as BodySlug]?.[0];
              if (key) setActiveKey(key);
            }}
          />
          <Text style={[styles.silhouetteLabel, { color: s.t2 }]}>Back</Text>
        </View>
      </View>
      {activeRegion ? (
        <View style={[styles.heatmapTooltip, { borderColor: s.hairline }]}>
          <Text style={[styles.heatmapTooltipText, { color: s.t1 }]}>
            {activeRegion.label} · Last trained: {lastTrainedMap[activeRegion.key] || "Not logged"} · {activeRegion.sessions} {activeRegion.sessions === 1 ? "session" : "sessions"}
          </Text>
        </View>
      ) : null}
      <View style={styles.heatmapLegendRow}>
        {legend.map((item) => (
          <View key={item.label} style={styles.heatmapLegendItem}>
            <View style={[styles.heatmapLegendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.heatmapLegendText, { color: s.t2 }]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.heatmapInsight, { color: s.t2 }]}>
        {undertrained.length
          ? `${undertrained
              .map((m) => m.replace(/([A-Z])/g, " $1"))
              .map((m) => m[0].toUpperCase() + m.slice(1))
              .join(" and ")} haven't been trained this week`
          : "Your weekly muscle balance looks good"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    filter: undefined as any,
    zIndex: 0,
  },
  // ✅ ADD
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },

  headerBlur: {
    overflow: "hidden",
  },

  headerRow: {
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // ✅ ADD
  headerHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },

  title: {
    fontSize: 28,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "300",
  },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  startBtnText: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  cardWrap: { borderRadius: 18, overflow: "hidden" },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  cardBlur: { borderRadius: 18, overflow: "hidden" },
  cardInner: { padding: 14 },

  continueCard: { borderRadius: 22 },
  continueTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  continueTitle: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  continueName: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  continueMeta: { marginTop: 5, fontSize: 13, fontWeight: "300" },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  finishBtnText: {
    fontSize: 12,
    fontWeight: "500",
  },
  continueCTA: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  continueCTAText: { fontSize: 13, fontWeight: "400" },

  emptyStateCard: { borderRadius: 22 },
  emptyTitle: { fontSize: 18, fontWeight: "500", letterSpacing: -0.2 },
  emptyText: { marginTop: 6, fontSize: 13, fontWeight: "300", lineHeight: 18 },
  emptyCTA: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyCTAtext: { fontSize: 13, fontWeight: "400" },

  ringsRow: { flexDirection: "row", marginTop: 2 },
  ringCard: { borderRadius: 18 },
  ringTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  ringDot: { width: 8, height: 8, borderRadius: 8 },
  ringLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  ringValue: {
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  ringSub: { marginTop: 2, fontSize: 12, fontWeight: "300" },

  sectionHeader: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 14, fontWeight: "500", letterSpacing: 0.4 },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sectionActionText: { fontSize: 13, fontWeight: "400" },
  helperText: { marginTop: 6, fontSize: 12, fontWeight: "300" },

  pillStroke: {
    borderRadius: 999,
    padding: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontSize: 12.5, fontWeight: "400", letterSpacing: 0.2 },

  templateCard: {
    borderRadius: 18,
  },
  templateChip: {
    width: 188,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  templateEmoji: { fontSize: 18 },
  templateName: { fontSize: 14, fontWeight: "500", letterSpacing: -0.1 },
  templateTag: { marginTop: 2, fontSize: 12, fontWeight: "300" },

  templateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  templateBadgeUser: {
  },
  templateBadgeAuto: {},

  workoutCardCompact: {
    paddingVertical: 12,
  },
  statsRowCompact: {
    marginTop: 8,
    gap: 6,
  },
  statChipDense: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  statChipTextDense: { fontSize: 12 },

  intensityRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  intensityRowCompact: {
    marginTop: 8,
  },
  intensityLabel: { fontSize: 12, fontWeight: "400", letterSpacing: 0.2 },
  intensityBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  intensityBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },

  bestSetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bestSetBadgeText: { fontSize: 12, fontWeight: "400" },
  bestSetTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bestSetTagText: { fontSize: 10, fontWeight: "500" },

  cardActionsCompact: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtnCompact: {
    height: 34,
    width: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  templateBadgeText: { fontSize: 10, fontWeight: "500", letterSpacing: 0.6 },
  templateBadgeTextUser: {},
  templateBadgeTextAuto: {},

  workoutCard: { borderRadius: 22 },
  workoutHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  workoutTitle: { fontSize: 16, fontWeight: "500", letterSpacing: -0.15 },
  workoutMeta: { marginTop: 4, fontSize: 12, fontWeight: "300" },

  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: withAlpha("#FFD66B", 0.92),
  },
  prText: { color: withAlpha("#111", 0.9), fontSize: 12, fontWeight: "500" },

  statsRow: { marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statChipText: {
    fontSize: 12,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },

  highlight: { marginTop: 10, fontSize: 12, fontWeight: "300" },
  prLine: { marginTop: 6, fontSize: 12, fontWeight: "400" },

  cardActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtnText: { fontSize: 12, fontWeight: "400" },

  /* Coach Spark */
  coachCard: { borderRadius: 22, padding: 0 },
  coachInner: { borderRadius: 22, padding: 14 },
  coachTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coachIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  coachTitle: { fontSize: 15, fontWeight: "500", letterSpacing: -0.1 },
  coachSub: { marginTop: 4, fontSize: 12, fontWeight: "300", lineHeight: 16 },
  coachCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coachCTAText: { fontSize: 13, fontWeight: "500" },
  coachChipsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  coachChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coachChipText: { fontSize: 12, fontWeight: "400" },

  /* Sheets */
  sheetBackdrop: { flex: 1 },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
    paddingBottom: 16,
  },
  sheetCard: { borderRadius: 22 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "500", letterSpacing: -0.2 },
  sheetSubtitle: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetRowTitle: { fontSize: 14, fontWeight: "500" },
  sheetRowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 16,
  },
  sheetPrimaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sheetPrimaryBtnText: { fontWeight: "500" },
  sheetGhostBtn: {
    width: 120,
    height: 46,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sheetGhostBtnText: { fontWeight: "500" },
  sheetFieldLabel: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sheetTextInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "400",
  },
  sheetChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sheetChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetChipText: {
    fontSize: 12,
    fontWeight: "400",
  },
  sheetPreviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sheetPreviewText: {
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18,
  },
  sheetTextLink: {
    fontSize: 12,
    fontWeight: "400",
  },

  /* Toast */
  toastWrap: { position: "absolute", left: 14, right: 14, bottom: 98 },
  toastCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  toastText: { flex: 1, fontWeight: "400", fontSize: 12, lineHeight: 16 },
  toastBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 8,
  },
  toastBtnText: { fontWeight: "500", fontSize: 12 },
  deleteOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  deleteCard: {
    width: "80%",
    maxWidth: 320,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteTitle: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  deleteSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "300",
  },

  /* Template actions modal */
  modalBackdrop: { flex: 1, padding: 18, justifyContent: "center" },
  modalCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontWeight: "500", fontSize: 16 },
  modalSub: { marginTop: 6, fontWeight: "300", fontSize: 12 },
  modalPrimary: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalPrimaryText: { fontWeight: "500" },
  modalSecondary: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalSecondaryText: { fontWeight: "500" },
  heroCardWrap: {
    // more "hero" elevation for the first card
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  stackCardWrap: {
    // slightly smaller + quieter shadow for depth
    transform: [{ scale: 0.985 }],
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  bestSetPill: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },

  bestSetText: {
    fontSize: 12,
    fontWeight: "300",
  },

  actionBtnPrimary: {
    // tiny "primary" emphasis via shape only; colors already set inline
  },

  actionBtnIconOnly: {
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  smallCapsHeader: {
    marginTop: 18,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flatStatTile: {
    minWidth: 140,
    minHeight: 108,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    justifyContent: "space-between",
  },
  flatStatTitle: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  flatStatValue: {
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  flatStatSub: {
    fontSize: 11,
    fontWeight: "300",
  },
  startWorkoutCard: {
    marginTop: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  startWorkoutHeader: {
    gap: 8,
  },
  readyChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  readyChipText: { fontSize: 11, fontWeight: "400" },
  startWorkoutTitle: { fontSize: 20, fontWeight: "500", letterSpacing: -0.3 },
  startWorkoutSub: { fontSize: 13, lineHeight: 18, fontWeight: "300" },
  primaryWideButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryWideButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  secondaryButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "400" },
  quickStartRow: {
    marginTop: 12,
    gap: 8,
  },
  quickStartChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  quickStartChipText: { fontSize: 13, fontWeight: "400" },
  nextSuggestionChip: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nextSuggestionText: { flex: 1, fontSize: 13, fontWeight: "400" },
  splitCard: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  splitHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  splitTitle: { fontSize: 15, fontWeight: "500" },
  splitPillRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  splitDayWrap: { flex: 1, alignItems: "center", gap: 6 },
  splitDayMeta: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  splitDayPill: {
    minWidth: 36,
    width: "100%",
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  splitDayLabel: { fontSize: 12, fontWeight: "500" },
  splitDayDetail: { fontSize: 10, fontWeight: "300" },
  splitInsight: { marginTop: 12, fontSize: 12, fontWeight: "300", lineHeight: 17 },
  recoveryCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  recoveryTopRow: { flexDirection: "row", justifyContent: "flex-start" },
  recoveryBadge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recoveryBadgeText: { fontSize: 11, fontWeight: "500" },
  recoveryTitle: { marginTop: 10, fontSize: 15, fontWeight: "500" },
  recoveryBody: { marginTop: 6, fontSize: 13, fontWeight: "300", lineHeight: 18 },
  recoveryAction: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recoveryActionText: { fontSize: 13, fontWeight: "400" },
  templatesGrid: {
    marginTop: 10,
    gap: 10,
  },
  templateOverviewCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  templateOverviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  templateOverviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  templateOverviewIconText: {
    fontWeight: "500",
    fontSize: 13,
  },
  templateOverviewName: { fontSize: 15, fontWeight: "500" },
  templateOverviewMeta: { marginTop: 4, fontSize: 12, fontWeight: "300" },
  staleChip: {
    marginTop: 10,
    alignSelf: "stretch",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  staleChipText: { fontSize: 11, fontWeight: "400" },
  staleActionsRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  staleActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  staleActionText: { fontSize: 11, fontWeight: "400" },
  templateTagRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  templateTagChipText: { fontSize: 11, fontWeight: "300" },
  templateCreateCard: {
    borderStyle: "dashed",
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  templateCreateText: { fontSize: 14, fontWeight: "400" },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapsibleTitle: { fontSize: 15, fontWeight: "500" },
  prFeedRow: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  prFeedText: { flex: 1, fontSize: 13, fontWeight: "400", lineHeight: 18 },
  prFeedEmpty: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  prFeedEmptyText: { fontSize: 13, fontWeight: "300" },
  heatmapCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  heatmapSilhouetteRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-evenly",
    gap: 16,
  },
  silhouetteWrap: {
    alignItems: "center",
    gap: 6,
  },
  silhouetteLabel: {
    fontSize: 11,
    fontWeight: "300",
  },
  heatmapTooltip: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heatmapTooltipText: { fontSize: 12, fontWeight: "300" },
  heatmapLegendRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  heatmapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heatmapLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heatmapLegendText: { fontSize: 11, fontWeight: "300" },
  heatmapInsight: { marginTop: 12, fontSize: 12, fontWeight: "300", lineHeight: 18 },
});
