import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Choice, Empty, Field, Heading, IconButton, Item, Metric, Panel, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
// app/workouts/session.tsx
// Sleek "Apple-ish" log workout page (fast during real workouts)
// - Uses add-exercise.tsx modal for Browse + Presets
// - Stores each set as ONE draft item (sets=1) to enable per-set editing
// - Draft persisted via sessionDraft utils
// - Finish writes to DB via addWorkout() with session grouping fields

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Alert as RNAlert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";

import { withAlpha } from "@/components/workouts/utils/withAlpha";
import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import {
  inferPrimaryMuscle,
  PRIMARY_MUSCLE_OPTIONS
} from "@/services/workoutMuscles";
import { fmt } from "@/utils/date";
import { kgToLb, lbToKg } from "@/utils/units";

import {
  addWorkoutPreset,
  deleteWorkoutPreset,
  subscribeWorkoutPresets,
  type WorkoutPreset,
} from "@/services/presets";
import {
  ensureProfile,
  subscribeProfile,
  type Profile,
} from "@/services/profile";
import { addWorkout, getRecentWorkouts, type Workout } from "@/services/workouts";

import { evaluateBadges } from "@/services/badges/engine";
import { reconcileBadgesFromSnapshot } from "@/services/badges/reconcile";
import { BADGES } from "@/services/badges/registry";
import {
  loadProgressLocal,
  loadUnlocksLocal,
  saveProgressLocal,
  saveUnlocksLocal,
} from "@/services/badges/store";
import type {
  BadgeEvent,
  BadgeStatsSnapshot
} from "@/services/badges/types";
import { notifyBadgeEarned, notifyNewPR } from "@/services/notificationTriggers";
import {
  clearSessionDraft,
  loadSessionDraft,
  newSessionDraft,
  saveSessionDraft,
  type WorkoutSessionDraft,
  type WorkoutSessionDraftItem,
} from "../../components/workouts/sessionDraft";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Each set is one item => per-set editing works naturally.
type SetDraftItem = WorkoutSessionDraftItem & {
  id?: string;
  done?: boolean;
  note?: string;
};

type EditSetState = {
  open: boolean;
  itemId: string | null;
  exercise: string;
  primaryMuscle: string;
  reps: string;
  weight: string;
  note: string;
  done: boolean;
};

type ReferenceGroup = {
  exercise: string;
  primaryMuscle?: string;
  sets: Array<{ reps: number; weightKg: number; note?: string; }>;
};

type Palette = {
  bg: string;
  bg2: string;
  bg3: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  border2: string;
  primary: string;
  primary2: string;
  danger: string;
  success: string;
  shadowInk: string; // used for "dark ink" icons on light surfaces
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${m}:${pad2(sec)}`;
}
function fmtCompact(n: number) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
  return String(Math.round(n));
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function guessIsDarkFromBg(bg?: string) {
  // crude fallback: if bg is near-black assume dark
  if (!bg) return true;
  const hex = bg.replace("#", "").trim();
  if (hex.length !== 6) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.45;
}

function buildPalette(theme: any): { p: Palette; isDark: boolean; } {
  const colors = theme?.colors ?? theme ?? {};
  const isDark =
    typeof theme?.isDark === "boolean"
      ? theme.isDark
      : typeof colors?.isDark === "boolean"
        ? colors.isDark
        : guessIsDarkFromBg(colors?.bg);

  // try common keys; fallback to your original dark palette
  const bg =
    colors?.bg ?? colors?.background ?? (isDark ? "#05060C" : "#F6F7FB");
  const text =
    colors?.text ?? colors?.foreground ?? (isDark ? "#FFFFFF" : "#0B0F1A");
  const muted =
    colors?.muted ??
    colors?.subtext ??
    (isDark ? withAlpha("#FFFFFF", 0.6) : withAlpha("#0B0F1A", 0.55));

  const primary = colors?.primary ?? colors?.accent ?? "#7B6FFF";
  const danger = colors?.danger ?? colors?.error ?? "#FF5C6A";
  const success = colors?.success ?? colors?.ok ?? "#7CFFB5";

  const card =
    colors?.card ??
    colors?.surface ??
    (isDark ? withAlpha("#FFFFFF", 0.06) : withAlpha("#0B0F1A", 0.04));

  const border =
    colors?.border ??
    (isDark ? withAlpha("#FFFFFF", 0.14) : withAlpha("#0B0F1A", 0.12));

  const border2 =
    colors?.border2 ??
    (isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#0B0F1A", 0.1));

  // background gradient (keep the vibe, but theme-aware)
  const bg2 = colors?.bg2 ?? (isDark ? "#070A12" : withAlpha(primary, 0.1));
  const bg3 = colors?.bg3 ?? (isDark ? "#03040A" : withAlpha(primary, 0.04));

  const primary2 = colors?.primary2 ?? withAlpha(primary, 0.22);

  const shadowInk = isDark ? "#111111" : "#0B0F1A";

  return {
    isDark,
    p: {
      bg,
      bg2,
      bg3,
      text,
      muted,
      card,
      border,
      border2,
      primary,
      primary2,
      danger,
      success,
      shadowInk,
    },
  };
}

function makeStyles(p: Palette, isDark: boolean) {
  const hair = StyleSheet.hairlineWidth;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.bg,
    },

    headerBlur: {
      borderBottomWidth: hair,
      borderBottomColor: withAlpha(p.text, 0.12),
    },
    headerRow: {
      paddingTop: 14,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(p.text, isDark ? 0.06 : 0.05),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
    },
    finishBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.primary,
      borderWidth: 0,
    },
    finishOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(p.shadowInk, isDark ? 0.35 : 0.2),
      zIndex: 999,
    },
    finishCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: hair,
    },
    finishText: {
      fontSize: 13,
      fontWeight: "800",
    },
    inProgress: {
      color: withAlpha(p.text, 0.6),
      fontSize: 11,
      fontWeight: "500",
      letterSpacing: 1,
    },
    headerTitle: {
      color: withAlpha(p.text, 0.94),
      fontSize: 20,
      fontWeight: "500",
      letterSpacing: -0.2,
      maxWidth: 240,
    },
    liveTimer: {
      fontSize: 28,
      fontWeight: "200",
      letterSpacing: -0.4,
      textShadowColor: withAlpha("#7B6FFF", 0.38),
      textShadowRadius: 8,
    },
    headerMeta: {
      color: withAlpha(p.text, 0.55),
      fontSize: 12,
      fontWeight: "300",
    },

    cardWrap: { borderRadius: 18, overflow: "hidden" },
    cardBorder: {
      ...StyleSheet.absoluteFill,
      borderRadius: 18,
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
      zIndex: 2,
    },
    cardBlur: { borderRadius: 18, overflow: "hidden" },
    cardInner: { padding: 14 },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    chipText: {
      color: withAlpha(p.text, 0.72),
      fontWeight: "800",
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },

    sectionTitle: {
      color: withAlpha(p.text, 0.92),
      fontWeight: "500",
      fontSize: 16,
    },
    sectionSub: {
      marginTop: 4,
      color: withAlpha(p.text, 0.58),
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 16,
    },

    statPill: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
    },
    statLabel: {
      color: withAlpha(p.text, 0.55),
      fontWeight: "500",
      fontSize: 11,
      letterSpacing: 1,
    },
    statValue: {
      marginTop: 6,
      color: withAlpha(p.text, 0.92),
      fontWeight: "200",
      fontSize: 28,
      fontVariant: ["tabular-nums"],
    },
    tip: {
      marginTop: 10,
      color: withAlpha(p.text, 0.5),
      fontWeight: "700",
      fontSize: 12,
    },

    browseBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: withAlpha(p.text, isDark ? 0.06 : 0.05),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
    },
    browseText: {
      color: withAlpha(p.text, 0.9),
      fontWeight: "900",
      fontSize: 13,
    },

    inputLabel: {
      color: withAlpha(p.text, 0.6),
      fontWeight: "500",
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 6,
    },
    input: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.1 : 0.08),
      backgroundColor: "#1C1C2E",
      color: withAlpha(p.text, 0.92),
      fontWeight: "300",
    },
    lastUsedMeta: {
      marginTop: 6,
      color: withAlpha(p.text, 0.5),
      fontSize: 12,
      fontWeight: "300",
    },
    muscleChipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    muscleChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    muscleChipActive: {
      backgroundColor: withAlpha(p.primary, isDark ? 0.2 : 0.14),
      borderColor: withAlpha(p.primary, isDark ? 0.35 : 0.26),
    },
    muscleChipText: {
      color: withAlpha(p.text, 0.72),
      fontWeight: "800",
      fontSize: 12,
    },
    muscleChipTextActive: {
      color: withAlpha(p.text, 0.92),
    },
    quickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    primaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: withAlpha(p.primary, isDark ? 0.22 : 0.16),
      borderWidth: hair,
      borderColor: withAlpha(p.primary, isDark ? 0.35 : 0.28),
    },
    primaryBtnText: {
      color: withAlpha(p.text, 0.92),
      fontWeight: "900",
      fontSize: 14,
    },
    secondaryBtn: {
      width: 110,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    secondaryBtnText: { color: withAlpha(p.text, 0.8), fontWeight: "900" },

    exerciseCard: {
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
      backgroundColor: withAlpha(p.text, isDark ? 0.04 : 0.035),
    },
    exerciseHeader: {
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    exerciseName: {
      color: withAlpha(p.text, 0.94),
      fontWeight: "900",
      fontSize: 15,
      letterSpacing: -0.1,
    },
    exerciseMeta: {
      marginTop: 4,
      color: withAlpha(p.text, 0.58),
      fontWeight: "700",
      fontSize: 12,
    },
    exerciseActions: {
      paddingHorizontal: 12,
      paddingBottom: 10,
      flexDirection: "row",
      gap: 10,
    },

    miniBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    miniBtnText: {
      color: withAlpha(p.text, 0.82),
      fontWeight: "900",
      fontSize: 12,
    },

    setRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    referenceRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: hair,
    },
    referenceText: {
      color: withAlpha(p.text, 0.45),
      fontSize: 12,
      fontWeight: "300",
    },
    donePill: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
      backgroundColor: withAlpha(p.text, isDark ? 0.04 : 0.035),
    },
    setTitle: {
      color: withAlpha(p.text, 0.92),
      fontWeight: "900",
      fontSize: 13,
    },
    setNote: {
      marginTop: 4,
      color: withAlpha(p.text, 0.65),
      fontWeight: "700",
      fontSize: 12,
    },
    setNoteMuted: {
      marginTop: 4,
      color: withAlpha(p.text, 0.45),
      fontWeight: "700",
      fontSize: 12,
    },
    trashBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(p.text, isDark ? 0.04 : 0.035),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 10,
      borderTopWidth: hair,
      borderTopColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
      backgroundColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.78)",
    },
    footerBtn: {
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      backgroundColor: p.primary,
      borderWidth: 0,
    },
    footerBtnText: {
      color: "#FFFFFF",
      fontWeight: "500",
      fontSize: 16,
    },

    toastWrap: {
      position: "absolute",
      top: 60,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 50,
    },
    toast: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: withAlpha(p.primary, isDark ? 0.2 : 0.14),
      borderWidth: hair,
      borderColor: withAlpha(p.primary, isDark ? 0.35 : 0.26),
    },
    toastText: { color: withAlpha(p.text, 0.92), fontWeight: "900" },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)", // stays dark for focus (good in both)
      padding: 18,
      justifyContent: "center",
    },
    modalKeyboardWrap: {
      width: "100%",
      justifyContent: "center",
    },
    modalKeyboardDismiss: {
      alignSelf: "flex-end",
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
      borderRadius: 999,
      backgroundColor: withAlpha(p.text, isDark ? 0.08 : 0.06),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
    },
    modalKeyboardDismissText: {
      color: withAlpha(p.text, 0.72),
      fontWeight: "700",
      fontSize: 11,
    },
    modalCard: {
      maxHeight: "78%",
      borderRadius: 18,
      backgroundColor: isDark
        ? withAlpha("#0B0F1A", 0.98)
        : withAlpha("#FFFFFF", 0.96),
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
    },
    modalScrollContent: {
      padding: 14,
      paddingBottom: 18,
    },
    modalTitle: {
      color: withAlpha(p.text, 0.94),
      fontWeight: "900",
      fontSize: 16,
    },
    modalSub: {
      marginTop: 6,
      color: withAlpha(p.text, 0.6),
      fontWeight: "700",
      fontSize: 12,
    },

    doneToggle: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.12 : 0.1),
      backgroundColor: withAlpha(p.text, isDark ? 0.05 : 0.045),
    },
    doneToggleText: { color: withAlpha(p.text, 0.86), fontWeight: "900" },

    modalSecondary: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: hair,
      borderColor: withAlpha(p.text, isDark ? 0.14 : 0.12),
      backgroundColor: withAlpha(p.text, isDark ? 0.04 : 0.035),
    },
    modalSecondaryText: { color: withAlpha(p.text, 0.86), fontWeight: "900" },
    modalPrimary: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: withAlpha(p.primary, isDark ? 0.22 : 0.16),
      borderWidth: hair,
      borderColor: withAlpha(p.primary, isDark ? 0.35 : 0.26),
    },
    modalPrimaryText: { color: withAlpha(p.text, 0.92), fontWeight: "900" },
  });
}

export default function WorkoutSessionScreen() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const router = useRouter();
  const params = useLocalSearchParams<any>();
  const theme = useTheme() as any;
  const { p, isDark } = useMemo(() => buildPalette(theme), [theme]);
  const styles = useMemo(() => makeStyles(p, isDark), [p, isDark]);

  const { user } = useAuth();
  const uidUser = user?.uid;

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const todayISO = useMemo(() => fmt(new Date()), []);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- persisted draft ----
  const [draft, setDraft] = useState<WorkoutSessionDraft | null>(null);
  const [referenceGroups, setReferenceGroups] = useState<ReferenceGroup[]>([]);
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const draftRef = useRef<WorkoutSessionDraft | null>(null);
  const itemsRef = useRef<SetDraftItem[]>([]);
  const launchHandledRef = useRef("");

  useEffect(() => {
    draftRef.current = draft;
    itemsRef.current = (draft?.items || []) as SetDraftItem[];
  }, [draft]);

  // ---- profile + unit ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const unit: "kg" | "lb" = profile?.weightUnit === "lb" ? "lb" : "kg";

  // ---- presets ----
  const [presets, setPresets] = useState<WorkoutPreset[]>([]);
  const safePresets = useMemo(
    () =>
      (presets || [])
        .filter((pp) => pp?.name)
        .map((pp) => ({
          id: pp.id,
          name: pp.name,
          sets: pp.sets,
          reps: pp.reps,
          weightKg:
            (pp as any).weight ?? (pp as any).weightKg ?? (pp as any).weight, // robust
          notes: (pp as any).notes,
          exercise: (pp as any).exercise,
        })),
    [presets]
  );
  void safePresets; // keep if you plan to use later

  // ---- UI states ----
  const [savedToast, setSavedToast] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pickedConsumed = useRef<string | null>(null);

  const [quickExercise, setQuickExercise] = useState("");
  const [quickPrimaryMuscle, setQuickPrimaryMuscle] = useState("");
  const [quickReps, setQuickReps] = useState("10");
  const [quickWeight, setQuickWeight] = useState("");

  const [edit, setEdit] = useState<EditSetState>({
    open: false,
    itemId: null,
    exercise: "",
    primaryMuscle: "",
    reps: "10",
    weight: "",
    note: "",
    done: false,
  });

  // ---- persist debounce ----
  const savingRef = useRef(false);
  const saveTimerRef = useRef<any>(null);
  const pendingRef = useRef<WorkoutSessionDraft | null>(null);

  async function flushSave() {
    if (!uidUser) return;
    if (savingRef.current) return;
    const next = pendingRef.current;
    if (!next) return;

    savingRef.current = true;
    try {
      await saveSessionDraft(uidUser, next);
    } finally {
      savingRef.current = false;
      if (
        pendingRef.current &&
        pendingRef.current.updatedAt !== next.updatedAt
      ) {
        flushSave();
      }
    }
  }

  function persist(next: WorkoutSessionDraft) {
    setDraft(next);
    pendingRef.current = next;
    if (!uidUser) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(), 220);
  }

  // ---- subscribe: profile ----
  useEffect(() => {
    if (!uidUser) return;
    ensureProfile(uidUser).catch(() => { });
    const unsub = subscribeProfile(uidUser, (pp) => setProfile(pp || null));
    return () => unsub?.();
  }, [uidUser]);

  // ---- subscribe: presets ----
  useEffect(() => {
    if (!uidUser) return;
    const unsub = subscribeWorkoutPresets(uidUser, (rows) =>
      setPresets(rows || [])
    );
    return () => unsub?.();
  }, [uidUser]);

  // ---- load draft ----
  useEffect(() => {
    if (!uidUser) {
      setDraft(null);
      return;
    }
    (async () => {
      const existing = await loadSessionDraft(uidUser);
      if (existing) {
        setDraft(existing);
        setTitleDraft(existing.title || "Workout");
        return;
      }
      const fresh = newSessionDraft({ dateISO: todayISO, title: "Workout" });
      setDraft(fresh);
      setTitleDraft(fresh.title);
      await saveSessionDraft(uidUser, fresh);
    })();
  }, [uidUser, todayISO]);

  // ---- consume template seed (from Workouts page) ----
  useEffect(() => {
    if (!uidUser || !draft) return;

    (async () => {
      const key = `workout:templateSeed:${uidUser}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;

      await AsyncStorage.removeItem(key);

      const seed = JSON.parse(raw) as {
        title?: string;
        exercises: {
          name: string;
          sets: number;
          reps?: number;
          weightKg?: number;
          note?: string;
          primaryMuscle?: string;
        }[];
      };

      let nextItems: SetDraftItem[] = [];

      for (const ex of seed.exercises || []) {
        const sets = Math.max(1, ex.sets || 1);
        for (let i = 0; i < sets; i++) {
          nextItems.push({
            id: uid(),
            exercise: ex.name,
            sets: 1,
            reps: ex.reps ?? 10,
            weightKg: ex.weightKg ?? 0,
            primaryMuscle: inferPrimaryMuscle(ex.name, ex.primaryMuscle),
            note: ex.note ?? "",
            notes: ex.note ?? "",
            done: false,
            createdAt: Date.now() + i,
          });
        }
      }

      const shouldResetDraft = String(params?.templateLaunch || "") === "1";
      const baseDraft = shouldResetDraft
        ? newSessionDraft({
          dateISO: draft.dateISO || todayISO,
          title: seed.title || "Workout",
        })
        : draft;

      const next: WorkoutSessionDraft = {
        ...baseDraft,
        title: seed.title || baseDraft.title,
        updatedAt: Date.now(),
        items: nextItems,
      };

      persist(next);
      setReferenceGroups([]);
      setTitleDraft(next.title || "Workout");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    })();
  }, [uidUser, draft?.id, params?.templateLaunch, todayISO]);

  useEffect(() => {
    if (!uidUser || !draft) return;

    const freshStart = String(params?.freshStart || "") === "1";
    const configTitle =
      String(params?.configTitle || "").trim() || "Workout";
    const configMuscle = String(params?.configMuscle || "").trim();
    const resumeReference = String(params?.resumeReference || "") === "1";
    const launchKey = JSON.stringify({
      freshStart,
      configTitle,
      configMuscle,
      resumeReference,
    });
    if (launchHandledRef.current === launchKey) return;
    launchHandledRef.current = launchKey;

    (async () => {
      const referenceKey = `workout:referenceSeed:${uidUser}`;
      const rawReference = await AsyncStorage.getItem(referenceKey);

      if (freshStart) {
        const fresh = newSessionDraft({
          dateISO: draft.dateISO || todayISO,
          title: configTitle,
        });
        persist(fresh);
        setTitleDraft(fresh.title || "Workout");
      }

      if (configMuscle) setQuickPrimaryMuscle(configMuscle);
      else if (freshStart) setQuickPrimaryMuscle("");

      if (rawReference && resumeReference) {
        await AsyncStorage.removeItem(referenceKey);
        const parsed = JSON.parse(rawReference) as {
          title?: string;
          groups?: ReferenceGroup[];
        };
        setReferenceGroups(Array.isArray(parsed.groups) ? parsed.groups : []);
        if (parsed.title) setTitleDraft(parsed.title);
      } else if (freshStart) {
        if (rawReference) await AsyncStorage.removeItem(referenceKey);
        setReferenceGroups([]);
      }
    })();
  }, [
    uidUser,
    draft?.id,
    draft?.dateISO,
    params?.freshStart,
    params?.configTitle,
    params?.configMuscle,
    params?.resumeReference,
    todayISO,
  ]);
  useFocusEffect(
    React.useCallback(() => {
      let alive = true;

      (async () => {
        if (!draft) return;

        const raw = await localStore.getItem("session:browsePick");
        if (!raw) return;

        // clear immediately so it doesn't re-add
        await localStore.removeItem("session:browsePick");

        if (!alive) return;

        const parsed = JSON.parse(raw) as { name?: string; t?: number; };
        const picked = (parsed?.name || "").trim();
        if (!picked) return;

        await addSet(picked);

        setSavedToast("Added ✓");
        setTimeout(() => setSavedToast(""), 1000);
      })();

      return () => {
        alive = false;
      };
    }, [draft?.id]) // draft id is enough; addSet uses draft from state
  );

  // ---- handle selection coming back from /(modals)/add-exercise ----
  useEffect(() => {
    const picked = (params?.pickedExercise || "").toString().trim();
    if (!picked || !draft) return;
    if (pickedConsumed.current === picked) return;

    pickedConsumed.current = picked;

    const from = String(params?.pickedFrom || "");
    const run = async () => {
      if (from === "preset") {
        const nSets = Math.max(1, Number(params?.presetSets || 1) || 1);
        const reps = Number(params?.presetReps || 10) || 10;
        const weightKg = Number(params?.presetWeightKg || 0) || 0;
        for (let i = 0; i < nSets; i++) {
          await addSet(picked, { reps, weightKg });
        }
      } else {
        await addSet(picked);
      }

      setSavedToast("Added ✓");
      setTimeout(() => setSavedToast(""), 1000);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.pickedExercise, draft?.id]);

  // ---- stats + grouping ----
  const items = (draft?.items || []) as SetDraftItem[];

  const stats = useMemo(() => {
    const totalSets = items.reduce((a, it) => a + Number(it.sets || 0), 0);
    const totalReps = items.reduce(
      (a, it) => a + Number(it.reps || 0) * Number(it.sets || 0),
      0
    );
    const totalVolumeKg = items.reduce(
      (a, it) =>
        a +
        Number(it.weightKg || 0) * Number(it.reps || 0) * Number(it.sets || 0),
      0
    );

    const startedAt = draft?.startedAt || Date.now();
    const durationMs = Math.max(0, nowTick - startedAt);

    const exCount = new Set(
      items.map((x) => (x.exercise || "").trim()).filter(Boolean)
    ).size;

    return {
      exCount,
      totalSets,
      totalReps,
      totalVolumeKg,
      startedAt,
      durationMs,
    };
  }, [items, draft?.startedAt, nowTick]);

  function buildSessionSnapshot(): BadgeStatsSnapshot {
    const stepsMap =
      (((profile as any)?.steps ?? {}) as Record<string, number>) || {};
    const stepsToday = Number(stepsMap?.[draft?.dateISO || todayISO] ?? 0);

    // This screen can reliably provide:
    // - totalWorkoutsAllTime? not available without querying
    // - workoutsThisWeek? not available without querying
    // So we provide what we know + let reconcile do the heavy lifting later.
    return {
      todayKey: (draft?.dateISO || todayISO).slice(0, 10),
      weekKey: (draft?.dateISO || todayISO).slice(0, 10), // fallback; reconcile will compute real weekKey in badges screen
      stepsToday,

      // session facts
      workoutsThisWeek: 0,
      workoutsStreakDays: 0,

      mealsLoggedThisWeek: 0,
      proteinDaysThisWeek: 0,
      fiberDaysThisWeek: 0,
      stepsDays10kThisWeek: 0,

      totalWorkoutsAllTime: 0,
      totalMealsAllTime: 0,
    };
  }

  const elapsedLabel = useMemo(() => {
    if (!draft?.startedAt) return "0:00";
    return formatDuration(nowTick - draft.startedAt);
  }, [draft?.startedAt, nowTick]);

  const volumeDisplay = useMemo(() => {
    const v = unit === "lb" ? kgToLb(stats.totalVolumeKg) : stats.totalVolumeKg;
    return fmtCompact(Math.round(v));
  }, [stats.totalVolumeKg, unit]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        items: SetDraftItem[];
        lastAt: number;
        referenceItems: ReferenceGroup["sets"];
        primaryMuscle?: string;
      }
    >();
    for (const it of items) {
      const key = (it.exercise || "").trim() || "Exercise";
      const prev = map.get(key);
      if (!prev)
        map.set(key, {
          name: key,
          items: [it],
          lastAt: it.createdAt,
          referenceItems: [],
          primaryMuscle: it.primaryMuscle,
        });
      else {
        prev.items.push(it);
        prev.lastAt = Math.max(prev.lastAt, it.createdAt);
        prev.primaryMuscle = prev.primaryMuscle || it.primaryMuscle;
      }
    }
    for (const ref of referenceGroups) {
      const key = (ref.exercise || "").trim() || "Exercise";
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          name: key,
          items: [],
          lastAt: 0,
          referenceItems: ref.sets || [],
          primaryMuscle: ref.primaryMuscle,
        });
      } else {
        prev.referenceItems = ref.sets || [];
        prev.primaryMuscle = prev.primaryMuscle || ref.primaryMuscle;
      }
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        items: g.items.sort((a, b) => b.createdAt - a.createdAt), // newest set on top
      }))
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [items, referenceGroups]);

  function toggleExpanded(exName: string, defaultOpen: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((cur) => ({ ...cur, [exName]: !(cur[exName] ?? defaultOpen) }));
  }

  function lastUsedFor(exerciseName: string) {
    const list = itemsRef.current || [];
    const found = list.find(
      (it) =>
        (it.exercise || "").trim().toLowerCase() ===
        exerciseName.trim().toLowerCase()
    );
    if (!found) return { reps: 10, weightKg: 0 };
    return {
      reps: Number(found.reps || 10),
      weightKg: Number(found.weightKg || 0),
      primaryMuscle: String(found.primaryMuscle || ""),
    };
  }

  async function addSet(
    exerciseName: string,
    opts?: { weightKg?: number; reps?: number; primaryMuscle?: string; }
  ) {
    const base = draftRef.current; // ✅ always latest
    if (!base) return;

    if (!uidUser) {
      RNAlert.alert("Sign in required", "Please sign in to start a workout.");
      return;
    }

    const ex = (exerciseName || "").trim();
    if (!ex) return;

    const last = lastUsedFor(ex);
    const reps = Number(opts?.reps ?? last.reps ?? 10) || 10;
    const weightKg = Number(opts?.weightKg ?? last.weightKg ?? 0) || 0;
    const primaryMuscle =
      inferPrimaryMuscle(ex, opts?.primaryMuscle || last.primaryMuscle) || "";

    const newItem: SetDraftItem = {
      id: uid(),
      exercise: ex,
      sets: 1,
      reps,
      weightKg,
      primaryMuscle,
      notes: "",
      note: "",
      done: false,
      createdAt: Date.now(),
    };

    const baseItems = (base.items || []) as any[];

    const next: WorkoutSessionDraft = {
      ...base, // ✅ IMPORTANT (not ...draft)
      updatedAt: Date.now(),
      items: [newItem as any, ...baseItems],
    };

    persist(next);
    setExpanded((cur) => ({ ...cur, [ex]: true }));

    try {
      await Haptics.selectionAsync();
    } catch { }
  }

  function removeItem(itemId: string) {
    if (!draft) return;
    const next: WorkoutSessionDraft = {
      ...draft,
      updatedAt: Date.now(),
      items: items.filter((it) => String(it.id) !== itemId) as any,
    };
    persist(next);
  }

  function openEdit(it: SetDraftItem) {
    const w =
      unit === "lb"
        ? kgToLb(Number(it.weightKg || 0))
        : Number(it.weightKg || 0);
    setEdit({
      open: true,
      itemId: String(it.id || ""),
      exercise: (it.exercise || "").toString(),
      primaryMuscle: inferPrimaryMuscle(
        String(it.exercise || ""),
        String(it.primaryMuscle || "")
      ) || "",
      reps: String(it.reps ?? 10),
      weight: w ? String(Math.round(w * 100) / 100) : "",
      note: String((it.note ?? it.notes ?? "") || ""),
      done: !!it.done,
    });
    Haptics.selectionAsync().catch(() => { });
  }

  function applyEdit() {
    if (!draft || !edit.itemId) return;

    const repsN = Math.max(0, Number(edit.reps || 0) || 0);

    const weightN = Number(edit.weight || 0) || 0;
    const weightKg = unit === "lb" ? lbToKg(weightN) : weightN;

    const nextItems = items.map((it) => {
      if (String(it.id) !== edit.itemId) return it;
      const updated: SetDraftItem = {
        ...it,
        primaryMuscle:
          inferPrimaryMuscle(edit.exercise, edit.primaryMuscle) || "",
        reps: repsN,
        weightKg: Number(isFinite(weightKg) ? weightKg : 0),
        done: !!edit.done,
        note: (edit.note || "").trim(),
        notes: (edit.note || "").trim(), // keep legacy in sync
      };
      return updated;
    });

    const next: WorkoutSessionDraft = {
      ...draft,
      updatedAt: Date.now(),
      items: nextItems as any,
    };

    persist(next);
    setEdit((s) => ({ ...s, open: false }));
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }

  function toggleDone(itemId: string) {
    if (!draft) return;
    const nextItems = items.map((it) =>
      String(it.id) === itemId ? { ...it, done: !it.done } : it
    );
    const next: WorkoutSessionDraft = {
      ...draft,
      updatedAt: Date.now(),
      items: nextItems as any,
    };
    persist(next);
    Haptics.selectionAsync().catch(() => { });
  }

  function saveTitle() {
    if (!draft) return;
    const next: WorkoutSessionDraft = {
      ...draft,
      title: (titleDraft || "Workout").trim() || "Workout",
      updatedAt: Date.now(),
    };
    persist(next);
    setTitleOpen(false);
  }

  async function savePresetForExercise(exName: string) {
    if (!uidUser) return;
    const ex = exName.trim();
    if (!ex) return;

    const last = items.find(
      (it) => (it.exercise || "").trim().toLowerCase() === ex.toLowerCase()
    );
    if (!last) {
      RNAlert.alert("Nothing to save", "Log at least one set first.");
      return;
    }

    await addWorkoutPreset(uidUser, {
      name: ex,
      exercise: ex,
      sets: 1,
      reps: Number(last.reps || 10),
      weight: Number(last.weightKg || 0),
      notes: (last.note || last.notes || "").trim(),
      primaryMuscle:
        inferPrimaryMuscle(ex, last.primaryMuscle) || "",
    } as any);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    RNAlert.alert("Saved", `Preset created for "${ex}".`);
  }

  async function deletePresetByName(exName: string) {
    if (!uidUser) return;
    const lower = exName.trim().toLowerCase();
    const found = presets.find(
      (pp: any) =>
        String(pp?.name || "")
          .trim()
          .toLowerCase() === lower ||
        String((pp as any)?.exercise || "")
          .trim()
          .toLowerCase() === lower
    );

    if (!found) {
      RNAlert.alert("No preset found", "Create a preset first.");
      return;
    }

    RNAlert.alert("Delete preset?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteWorkoutPreset(uidUser, found.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => { }
          );
        },
      },
    ]);
  }

  async function finishWorkout() {
    if (!uidUser || !draft) return;

    if (!items.length) {
      RNAlert.alert("Nothing logged", "Add at least one set first.");
      return;
    }

    // Ensure we use the latest typed title, even if the modal is still open.
    const normalizedTitle =
      (titleDraft || draft.title || "Workout").trim() || "Workout";
    if (normalizedTitle !== draft.title) {
      persist({ ...draft, title: normalizedTitle, updatedAt: Date.now() });
    }

    RNAlert.alert(
      "Finish workout?",
      "This will save it to your workout history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            setIsFinishing(true);
            try {
              // Oldest -> newest so history reads in real order
              const ordered = [...items].sort(
                (a, b) => a.createdAt - b.createdAt
              );
              const historicalRows = await getRecentWorkouts(uidUser, 500).catch(
                () => []
              );
              const previousBestByExercise = new Map<string, number>();
              historicalRows.forEach((row) => {
                const key = String(row.exercise || "").trim().toLowerCase();
                if (!key) return;
                previousBestByExercise.set(
                  key,
                  Math.max(
                    previousBestByExercise.get(key) || 0,
                    Number(row.weight || 0)
                  )
                );
              });
              let detectedPr:
                | { exercise: string; weightKg: number; }
                | null = null;

              for (const it of ordered) {
                const entry: Partial<Workout> & any = {
                  date: draft.dateISO,
                  exercise: it.exercise,
                  primaryMuscle:
                    inferPrimaryMuscle(it.exercise, it.primaryMuscle) || "",
                  sets: 1,
                  reps: it.reps,
                  weight: it.weightKg,
                  notes: (it.note || it.notes || "").trim(),
                  // grouping fields
                  sessionId: draft.id,
                  sessionTitle: normalizedTitle,
                  sessionStartedAt: draft.startedAt,
                  // optional
                  done: !!it.done,
                  setId: it.id,
                  setCreatedAt: it.createdAt,
                };

                await addWorkout(uidUser, {
                  ...entry,
                  createdAt: undefined, // match workouts.tsx behavior
                } as any);

                const exKey = String(it.exercise || "").trim().toLowerCase();
                const weightKg = Number(it.weightKg || 0);
                if (
                  !detectedPr &&
                  exKey &&
                  weightKg > 0 &&
                  weightKg > Number(previousBestByExercise.get(exKey) || 0)
                ) {
                  detectedPr = {
                    exercise: String(it.exercise || "Exercise"),
                    weightKg,
                  };
                }
              }

              await clearSessionDraft(uidUser);
              // ───────────────── Badges: unlock immediately ─────────────────
              try {
                // 1) Load current local badge state
                const currentUnlocks = (await loadUnlocksLocal(localStore)) || {};
                const currentProgress = (await loadProgressLocal(localStore)) || {};

                // 2) Fire a "WORKOUT_FINISHED" style event (use any event name your engine supports)
                // If your engine currently expects "WORKOUT_LOGGED", use that.
                const event: BadgeEvent = {
                  type: "WORKOUT_LOGGED",
                  timestamp: Date.now(),
                  payload: {
                    workoutId: draft.id, // ✅ allowed
                    totalSets: stats.totalSets, // ✅ allowed
                    totalVolumeKg: stats.totalVolumeKg, // ✅ allowed
                  },
                };

                // 3) Evaluate rules (instant gratification badges like: first workout, 5 workouts, PR note, etc.)
                const snap = buildSessionSnapshot();
                const beforeIds = new Set(Object.keys(currentUnlocks || {}));

                const res = evaluateBadges({
                  event,
                  stats: snap,
                  unlocks: currentUnlocks,
                  progress: currentProgress,
                });

                await saveUnlocksLocal(res.unlocks, localStore);
                await saveProgressLocal(res.progress, localStore);

                const afterIds = Object.keys(res.unlocks || {});
                const newIds = afterIds.filter((id) => !beforeIds.has(id));
                if (newIds.length) {
                  const newestId = newIds[0];
                  const def = BADGES.find((b) => b.id === newestId);
                  newIds.forEach((id) => {
                    const badge = BADGES.find((b) => b.id === id);
                    if (badge?.title) {
                      // NOTIFICATION TRIGGER
                      notifyBadgeEarned(badge.title, localStore).catch(() => { });
                    }
                  });
                  setSavedToast(
                    def ? `Unlocked: ${def.title} ✓` : "Badge unlocked ✓"
                  );
                  setTimeout(() => setSavedToast(""), 1600);
                }

                // 4) Run reconcile lightly (won't be perfect here because snapshot is minimal,
                // but it will catch any rules that depend only on this event).
                await reconcileBadgesFromSnapshot(snap, localStore);
              } catch {
                // badges are non-critical; never block finishing a workout
              }

              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => { }
              );

              if (detectedPr) {
                // NOTIFICATION TRIGGER
                notifyNewPR(
                  detectedPr.exercise,
                  `${Math.round(
                    unit === "lb" ? kgToLb(detectedPr.weightKg) : detectedPr.weightKg
                  )}${unit}`, localStore
                ).catch(() => { });
              }

              const vol =
                unit === "lb"
                  ? kgToLb(stats.totalVolumeKg)
                  : stats.totalVolumeKg;

              setIsFinishing(false);
              RNAlert.alert(
                "Nice work",
                `You logged ${fmtCompact(stats.totalSets)} sets • ${fmtCompact(
                  stats.totalReps
                )} reps • ${fmtCompact(Math.round(vol))} ${unit} volume`
              );

              router.back();
            } catch (e: any) {
              setIsFinishing(false);
              RNAlert.alert(
                "Couldn't save workout",
                e?.message || "Please try again."
              );
            }
          },
        },
      ]
    );
  }

  function confirmExit() {
    if (!draft || !items.length) {
      router.back();
      return;
    }

    RNAlert.alert(
      "Leave workout?",
      "Save it to continue later, or cancel to discard everything.",
      [
        { text: "Save & come back", onPress: () => router.back() },
        {
          text: "Cancel workout",
          style: "destructive",
          onPress: async () => {
            if (uidUser) await clearSessionDraft(uidUser);
            setDraft(null);
            setExpanded({});
            router.back();
          },
        },
        { text: "Keep logging", style: "cancel" },
      ]
    );
  }

  // ---- quick add (manual, no browse) ----
  async function quickAdd() {
    const ex = quickExercise.trim();
    if (!ex) {
      RNAlert.alert(
        "Exercise required",
        "Type an exercise name or use Browse."
      );
      return;
    }
    const reps = Number(quickReps || 0) || 10;

    const w = Number(quickWeight || 0) || 0;
    const weightKg = unit === "lb" ? lbToKg(w) : w;

    await addSet(ex, { reps, weightKg, primaryMuscle: quickPrimaryMuscle });
    setQuickExercise(ex); // keep name for speed
    setQuickPrimaryMuscle(
      inferPrimaryMuscle(ex, quickPrimaryMuscle) || ""
    );
  }

  // theme-aware helpers (same components, just themed)

  if (!draft) {
    return (<TaskPage title="Preparing your session" section="Workout" onBack={() => router.back()}>
      <Empty title="Loading your saved draft…" />
    </TaskPage>);
  }

  const contentMax = 980;
  const sidePad = 16;

  return (<><TaskPage title={draft.title || 'Workout'} section="Training session" onBack={confirmExit}
    action={<IconButton icon="pencil" label="Rename workout" onPress={() => { setTitleDraft(draft.title || 'Workout'); setTitleOpen(true); }} />}
    footer={<Button primary label={isFinishing ? 'Saving workout…' : 'Finish workout'} disabled={isFinishing} onPress={finishWorkout} icon="checkmark" />}>

    <View style={{ gap: 8 }}>
      <Text style={F.eyebrow}>SESSION TIME</Text>
      <Text style={{ ...F.value, fontSize: 52 }}>{elapsedLabel}</Text>
      <Text accessibilityLiveRegion="polite" style={F.caption}>{savedToast ? 'Draft saved' : 'Your session saves as you go'}</Text>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Metric label="Exercises" value={String(stats.exCount)} />
      <Metric label="Sets" value={String(stats.totalSets)} />
      <Metric label="Volume" value={`${volumeDisplay} ${unit}`} />
    </View>

    <Panel>
      <Heading title="Add a set" action={<IconButton icon="search" label="Browse exercises" onPress={() => router.push({ pathname: '/(modals)/browse', params: { returnTo: '/workouts/session' } } as any)} />} />

      <Field label="Exercise" value={quickExercise} onChangeText={setQuickExercise} placeholder="Exercise name" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Choice label="Auto muscle" selected={!quickPrimaryMuscle} onPress={() => setQuickPrimaryMuscle('')} />
        {PRIMARY_MUSCLE_OPTIONS.map(m => <Choice key={m.key} label={m.label} selected={quickPrimaryMuscle === m.key} onPress={() => setQuickPrimaryMuscle(m.key)} />)}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Reps" value={quickReps} onChangeText={setQuickReps} keyboardType="number-pad" />
        <Field label={`Weight · ${unit}`} value={quickWeight} onChangeText={setQuickWeight} keyboardType="decimal-pad" />
      </View>

      <Button primary label="Add set" onPress={quickAdd} />
      <Button label="Clear entry" onPress={() => { setQuickExercise(''); setQuickPrimaryMuscle(''); setQuickReps('10'); setQuickWeight(''); Keyboard.dismiss(); }} />
    </Panel>

    <Heading title="Session ledger" detail="Mark completed sets, tap a set to edit, or repeat an exercise." />

    {!groups.length && <Empty title="Ready when you are" detail="Browse an exercise or add your first set above." />}

    {groups.map(g => {
      const open = expanded[g.name] ?? g.items.length <= 2; return <Panel key={g.name}>

        <Item title={g.name} detail={`${g.items.filter(it => (it as SetDraftItem).done).length} completed · ${g.items.length} logged sets`} onPress={() => toggleExpanded(g.name, g.items.length <= 2)} action={<IconButton icon="add" label={`Add set to ${g.name}`} onPress={() => addSet(g.name)} />} />

        {open && <><View style={{ gap: 6 }}>
          {g.items.map((it, idx) => <Item key={String(it.id)} title={`Set ${g.items.length - idx} · ${it.reps} reps`} detail={`${Math.round((unit === 'lb' ? kgToLb(Number(it.weightKg || 0)) : Number(it.weightKg || 0)) * 10) / 10} ${unit}${(it as SetDraftItem).note ? ` · ${(it as SetDraftItem).note}` : ''}`} onPress={() => openEdit(it)} action={<View style={{ flexDirection: 'row', gap: 4 }}>
            <IconButton icon={(it as SetDraftItem).done ? 'checkmark-circle' : 'ellipse-outline'} label={(it as SetDraftItem).done ? 'Mark set incomplete' : 'Mark set complete'} onPress={() => toggleDone(String(it.id))} />
            <IconButton icon="trash-outline" label="Remove set" onPress={() => RNAlert.alert('Remove set?', "This can't be undone.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeItem(String(it.id)) }])} />
          </View>} />)}
        </View>
          {!!g.referenceItems.length && <View style={{ gap: 8 }}>
            <Text style={F.eyebrow}>PREVIOUS SESSION REFERENCE</Text>
            {g.referenceItems.map((it, i) => <Text key={i} style={F.caption}>{i + 1}. {it.reps} reps · {Math.round((unit === 'lb' ? kgToLb(it.weightKg) : it.weightKg) * 10) / 10} {unit}{it.note ? ` · ${it.note}` : ''}</Text>)}
          </View>}
          <View style={{ gap: 8 }}>
            <Button label="Save exercise preset" onPress={() => savePresetForExercise(g.name)} />
            <Button label="Delete preset" onPress={() => deletePresetByName(g.name)} />
          </View></>}

      </Panel>;
    })}

  </TaskPage>
    <TaskSheet title="Workout title" visible={titleOpen} onClose={() => setTitleOpen(false)}>
      <Field label="Title" value={titleDraft} onChangeText={setTitleDraft} onSubmitEditing={saveTitle} />
      <Button primary label="Save title" onPress={saveTitle} />
      <Button label="Cancel" onPress={() => setTitleOpen(false)} />
    </TaskSheet>
    <TaskSheet title={edit.exercise || 'Edit set'} visible={edit.open} onClose={() => setEdit(v => ({ ...v, open: false }))}>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Reps" value={edit.reps} keyboardType="number-pad" onChangeText={reps => setEdit(v => ({ ...v, reps }))} />
        <Field label={`Weight · ${unit}`} value={edit.weight} keyboardType="decimal-pad" onChangeText={weight => setEdit(v => ({ ...v, weight }))} />
      </View>

      <Heading title="Primary muscle" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Choice label="Auto" selected={!edit.primaryMuscle} onPress={() => setEdit(v => ({ ...v, primaryMuscle: '' }))} />
        {PRIMARY_MUSCLE_OPTIONS.map(m => <Choice key={m.key} label={m.label} selected={edit.primaryMuscle === m.key} onPress={() => setEdit(v => ({ ...v, primaryMuscle: m.key }))} />)}
      </View>

      <Field label="Note" multiline value={edit.note} onChangeText={note => setEdit(v => ({ ...v, note }))} />
      <Choice label={edit.done ? 'Completed' : 'Not completed'} selected={edit.done} onPress={() => setEdit(v => ({ ...v, done: !v.done }))} />
      <Button label="Hide keyboard" onPress={() => Keyboard.dismiss()} />
      <Button primary label="Save set" onPress={applyEdit} />
      <Button label="Cancel" onPress={() => setEdit(v => ({ ...v, open: false }))} />
    </TaskSheet>
    <Modal visible={isFinishing} transparent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000C' }}>
        <Panel>
          <ActivityIndicator color={D.lime} />
          <Text style={F.body}>Saving workout…</Text>
        </Panel>
      </View>
    </Modal>
  </>
  );
}
