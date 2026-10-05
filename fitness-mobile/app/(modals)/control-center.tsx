// app/(modals)/control-center.tsx
// Drop-in ✅ Unified Control Center (Account + Settings) — same premium calm vibe
// Depends on: expo-router, expo-linear-gradient, expo-blur, expo-haptics, react-native-reanimated
// Firebase: firebase/auth
//
// Uses your providers:
//   - useTheme() -> { colors, isDark, modeSetting?, setModeSetting? } (or equivalent)
//   - useAuth() -> { user }
//   - useEntitlements() -> { isPro, isAdmin, isTester }
//
// Uses your storage/services:
//   - services/settings/settingsStore: useSettingBool, useSettingString
//   - services/account/accountCenterSettings: getAccountCenterPrivacySettings, setAccountCenterPrivacySettings, DEFAULT_PRIVACY_SETTINGS
//
// Notes:
// - Keeps “important stuff” from both pages in one calm, theme-aware modal.
// - Avoids async-in-useMemo; uses useEffect for loading.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
  Linking,
  StatusBar,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  unlink,
} from "firebase/auth";

import { useTheme } from "@/content/ThemeProvider";
import { useAuth } from "@/content/AuthContext";
import { useEntitlements } from "@/content/useEntitlements";

import { withAlpha } from "@/lib/color";
import ThemeChooserCard from "@/components/settings/ThemeChooserCard";

import {
  useSettingBool,
  useSettingString,
} from "@/services/settings/settingsStore";

import {
  type AccountCenterPrivacySettings,
  getAccountCenterPrivacySettings,
  setAccountCenterPrivacySettings,
  DEFAULT_PRIVACY_SETTINGS,
} from "@/services/account/accountCenterSettings";
import {
  DEFAULT_SETTINGS as DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/services/notificationSettings";

type ThemeMode = "system" | "light" | "dark";

const hit = { top: 12, bottom: 12, left: 12, right: 12 };

function safeOpen(url: string) {
  Linking.openURL(url).catch(() => {});
}

function openSettings() {
  if (Linking.openSettings) {
    Linking.openSettings().catch(() => {});
  }
}

function deriveDisplayName(user: any) {
  const dn = user?.displayName;
  if (dn && dn.trim().length > 0) return dn.trim();
  const email = user?.email || "";
  const at = email.indexOf("@");
  if (at > 0) return email.slice(0, at);
  return "Account";
}

function providerLabel(id?: string) {
  if (!id) return "Unknown";
  if (id.includes("google")) return "Google";
  if (id.includes("apple")) return "Apple";
  if (id.includes("password")) return "Email + Password";
  if (id.includes("facebook")) return "Facebook";
  if (id.includes("github")) return "GitHub";
  return id;
}

export default function ControlCenterModal() {
  const router = useRouter();
  const theme: any = useTheme();
  const { colors, isDark } = theme;
  const { user } = useAuth() as any;
  const { isPro, isAdmin, isTester } = useEntitlements();
  const hasPro = isPro || isAdmin || isTester;

  // Theme mode support (try common shapes)
  const ctxMode: ThemeMode | undefined =
    theme?.modeSetting ??
    theme?.mode ??
    theme?.themeMode ??
    theme?.appearanceMode;
  const ctxSetMode: ((m: ThemeMode) => void) | undefined =
    theme?.setModeSetting ??
    theme?.setMode ??
    theme?.setThemeMode ??
    theme?.setAppearanceMode;

  // Local settings (persisted)
  const [lowPowerMode, setLowPowerMode, lowPowerLoading] = useSettingBool(
    "settings.lowPowerMode",
    false
  );
  const [reduceMotion, setReduceMotion, reduceMotionLoading] = useSettingBool(
    "settings.reduceMotion",
    false
  );
  const [hapticsEnabled, setHapticsEnabled, hapticsLoading] = useSettingBool(
    "settings.hapticsEnabled",
    true
  );
  const [privateOnLock, setPrivateOnLock, privateOnLockLoading] =
    useSettingBool("settings.privacyHideOnLock", true);

  const [units, setUnits, unitsLoading] = useSettingString(
    "settings.units",
    "metric" // metric | imperial
  );
  const [weekStartsOn, setWeekStartsOn, weekStartsLoading] = useSettingString(
    "settings.weekStartsOn",
    "monday" // monday | sunday
  );
  const [coachTone, setCoachTone, coachToneLoading] = useSettingString(
    "settings.coachTone",
    "calm" // calm | direct | hype
  );

  const loadingAny =
    lowPowerLoading ||
    reduceMotionLoading ||
    hapticsLoading ||
    privateOnLockLoading ||
    unitsLoading ||
    weekStartsLoading ||
    coachToneLoading;

  // Account privacy (synced per uid)
  const [privacy, setPrivacy] = useState<AccountCenterPrivacySettings>(
    DEFAULT_PRIVACY_SETTINGS
  );
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [timePickerState, setTimePickerState] = useState<{
    key: string;
    value: Date;
    apply: (date: Date) => void;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await getAccountCenterPrivacySettings(user?.uid);
        if (!alive) return;
        setPrivacy(next);
      } catch {
        if (!alive) return;
        setPrivacy(DEFAULT_PRIVACY_SETTINGS);
      } finally {
        if (!alive) return;
        setPrivacyLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    loadNotificationSettings()
      .then((next) => {
        if (!alive) return;
        setNotificationSettings(next);
        setNotificationsLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
        setNotificationsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const chrome = useMemo(() => {
    const border = withAlpha(colors.text, isDark ? 0.1 : 0.12);
    const card = withAlpha(colors.card, isDark ? 0.72 : 0.82);
    const sub = withAlpha(colors.text, isDark ? 0.65 : 0.7);
    const hairline = withAlpha(colors.text, isDark ? 0.1 : 0.12);
    const danger = colors.danger;
    const chip = withAlpha(colors.text, isDark ? 0.08 : 0.06);
    return { border, card, sub, hairline, danger, chip };
  }, [colors, isDark]);

  const taptic = useCallback(
    async (kind: "soft" | "light" | "medium" | "warn" = "soft") => {
      if (kind !== "warn" && !hapticsEnabled) return;
      try {
        if (kind === "warn") {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
          return;
        }
        if (kind === "soft")
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        else if (kind === "light")
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    },
    [hapticsEnabled]
  );

  const notifDisabled = !notificationSettings.enabled;

  const formatClock = useCallback((hour: number, minute: number) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const saveNotifications = useCallback(
    async (next: NotificationSettings) => {
      setNotificationSettings(next);
      await saveNotificationSettings(next);
    },
    []
  );

  const openTimePicker = useCallback(
    (
      key: string,
      hour: number,
      minute: number,
      apply: (hour: number, minute: number) => NotificationSettings
    ) => {
      const value = new Date();
      value.setHours(hour, minute, 0, 0);
      setTimePickerState({
        key,
        value,
        apply: (date) => {
          saveNotifications(apply(date.getHours(), date.getMinutes())).catch(
            () => {}
          );
        },
      });
    },
    [saveNotifications]
  );

  const signedIn = !!user?.uid;
  const email = user?.email || "Sign in to sync across devices";
  const verified = !!user?.emailVerified;

  const themeValue: ThemeMode =
    (ctxMode as ThemeMode) ?? (theme?.storedMode as ThemeMode) ?? "system";
  const themeLabel =
    themeValue === "system"
      ? "System"
      : themeValue === "dark"
      ? "Dark"
      : "Light";

  const providers = useMemo(() => {
    const list = (user?.providerData || [])
      .map((p: any) => p?.providerId)
      .filter(Boolean) as string[];
    if (user?.uid && list.length === 0 && user?.email) return ["password"];
    return Array.from(new Set(list));
  }, [user?.providerData, user?.uid, user?.email]);

  const canResetPassword = providers.includes("password") && !!user?.email;

  const close = () => {
    taptic("soft");
    router.back();
  };

  const onSignIn = () => {
    taptic("light");
    router.push("/(auth)/login");
  };

  const onSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await taptic("warn");
          try {
            await getAuth().signOut();
          } catch {
            Alert.alert("Error", "Could not sign out. Try again.");
          }
        },
      },
    ]);
  };

  const onVerifyEmail = async () => {
    try {
      const u = getAuth().currentUser;
      if (!u) return;
      await sendEmailVerification(u);
      await taptic("light");
      Alert.alert(
        "Verification sent",
        "Check your inbox for the verification email."
      );
    } catch (e: any) {
      Alert.alert(
        "Couldn’t send email",
        e?.message || "Try again in a moment."
      );
    }
  };

  const onPasswordReset = async () => {
    try {
      const em = user?.email;
      if (!em) return;
      await sendPasswordResetEmail(getAuth(), em);
      await taptic("light");
      Alert.alert(
        "Reset email sent",
        "Check your inbox for the password reset link."
      );
    } catch (e: any) {
      Alert.alert(
        "Couldn’t send reset email",
        e?.message || "Try again in a moment."
      );
    }
  };

  const onManagePlan = () => {
    taptic("light");
    router.push(hasPro ? "/account/subscription" : "/paywall");
  };

  const onEditProfile = () => {
    taptic("light");
    router.push("/account/edit-profile");
  };

  const onTogglePrivacy = async (
    patch: Partial<AccountCenterPrivacySettings>
  ) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    taptic("light");
    try {
      await setAccountCenterPrivacySettings(user?.uid, next);
    } catch {
      // optimistic UI; ok for prefs screen
    }
  };

  const onUnlinkProvider = (providerId: string) => {
    Alert.alert(
      "Remove sign-in method?",
      `This will remove ${providerLabel(providerId)} from your account.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await taptic("warn");
              const u = getAuth().currentUser;
              if (!u) return;

              const currentProviders = Array.from(
                new Set(
                  (u.providerData || [])
                    .map((p: any) => p?.providerId)
                    .filter(Boolean)
                )
              );
              if (currentProviders.length <= 1) {
                Alert.alert(
                  "Keep at least one method",
                  "You need at least one sign-in method to access your account."
                );
                return;
              }
              await unlink(u, providerId as any);
              Alert.alert("Removed", "Sign-in method removed.");
            } catch (e: any) {
              Alert.alert(
                "Couldn’t remove",
                e?.message || "Try again in a moment."
              );
            }
          },
        },
      ]
    );
  };

  const confirmReset = () => {
    taptic("medium");
    Alert.alert(
      "Reset settings?",
      "This restores defaults on this device. Your logged data stays untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setLowPowerMode(false);
            setReduceMotion(false);
            setHapticsEnabled(true);
            setPrivateOnLock(true);
            setUnits("metric");
            setWeekStartsOn("monday");
            setCoachTone("calm");
            await taptic("soft");
          },
        },
      ]
    );
  };

  const onExportData = () => {
    taptic("light");
    Alert.alert(
      "Export your data",
      "Recommended flow: generate an export (JSON/CSV) on the server and email a secure download link."
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your account and data. This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            taptic("warn");
            Alert.alert(
              "Not wired yet",
              "Recommended: re-authenticate → call a Cloud Function to delete user + all related data → confirm."
            );
          },
        },
      ]
    );
  };

  // ---------- UI primitives (kept inside this single file) ----------
  const Section = ({
    title,
    subtitle,
    footer,
    children,
    delay = 0,
  }: {
    title: string;
    subtitle?: string;
    footer?: string;
    children: React.ReactNode;
    delay?: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(220).springify()}>
      <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
        <Text style={[styles.h2, { color: colors.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.sub, { color: chrome.sub, marginTop: 4 }]}>
            {subtitle}
          </Text>
        )}
      </View>

      <BlurView
        intensity={18}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.card,
          {
            marginHorizontal: 14,
            marginTop: 10,
            borderColor: chrome.hairline,
            backgroundColor: chrome.card,
          },
        ]}
      >
        {children}
      </BlurView>

      {!!footer && (
        <Text
          style={[styles.footer, { color: chrome.sub, paddingHorizontal: 18 }]}
        >
          {footer}
        </Text>
      )}
    </Animated.View>
  );

  const Divider = () => (
    <View style={[styles.divider, { backgroundColor: chrome.hairline }]} />
  );

  const Row = ({
    icon,
    title,
    value,
    hint,
    onPress,
    right,
    danger,
    disabled,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    value?: string;
    hint?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
  }) => {
    const canPress = !!onPress && !disabled;
    return (
      <Pressable
        onPress={canPress ? onPress : undefined}
        disabled={!canPress}
        style={({ pressed }) => [
          styles.row,
          {
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
          },
        ]}
        accessibilityRole={canPress ? "button" : "none"}
      >
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: withAlpha(colors.text, isDark ? 0.08 : 0.06) },
            ]}
          >
            <Ionicons
              name={icon}
              size={16}
              color={danger ? chrome.danger : withAlpha(colors.text, 0.9)}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={[
                  styles.rowTitle,
                  { color: danger ? chrome.danger : colors.text },
                ]}
              >
                {title}
              </Text>
              {!!value && (
                <Text style={[styles.rowValue, { color: chrome.sub }]}>
                  {value}
                </Text>
              )}
            </View>
            {!!hint && (
              <Text style={[styles.rowHint, { color: chrome.sub }]}>
                {hint}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rowRight}>
          {right ?? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={withAlpha(colors.text, 0.35)}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const Chip = ({
    text,
    onPress,
    danger,
  }: {
    text: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed ? withAlpha(colors.text, 0.1) : chrome.chip,
          borderColor: chrome.hairline,
        },
      ]}
    >
      <Text
        style={{
          color: danger ? chrome.danger : colors.text,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {text}
      </Text>
      {!!onPress && (
        <Ionicons
          name="close-circle"
          size={14}
          color={withAlpha(colors.text, 0.5)}
        />
      )}
    </Pressable>
  );

  // ---------- header model ----------
  const headerPlan = hasPro ? "Pro" : "Free";
  const planHint = hasPro
    ? "Premium features unlocked"
    : "Upgrade to unlock premium features";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Calm premium backdrop */}
      <LinearGradient
        colors={[
          colors.background,
          isDark ? "rgba(139,92,246,0.14)" : "rgba(59,130,246,0.12)",
          "transparent",
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top chrome */}
      <View style={[styles.topBar, { borderBottomColor: chrome.hairline }]}>
        <Pressable onPress={close} hitSlop={hit} style={styles.topBtn}>
          <Ionicons
            name="chevron-down"
            size={20}
            color={withAlpha(colors.text, 0.9)}
          />
        </Pressable>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.text }]}>
            Control Center
          </Text>
          <Text style={[styles.subtitle, { color: chrome.sub }]}>
            Account + settings, kept calm.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            taptic("light");
            Alert.alert("Search", "Optional: add a search here later.");
          }}
          hitSlop={hit}
          style={styles.topBtn}
        >
          <Ionicons
            name="search"
            size={20}
            color={withAlpha(colors.text, 0.85)}
          />
        </Pressable>
      </View>

      {loadingAny ? (
        <View style={styles.loadingWrap}>
          <BlurView
            intensity={22}
            tint={isDark ? "dark" : "light"}
            style={[styles.loadingCard, { borderColor: chrome.hairline }]}
          >
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: chrome.sub }]}>
              Loading preferences…
            </Text>
          </BlurView>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity header (premium) */}
          <Animated.View entering={FadeInDown.duration(220).springify()}>
            <BlurView
              intensity={18}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.hero,
                {
                  marginHorizontal: 14,
                  marginTop: 14,
                  borderColor: chrome.hairline,
                  backgroundColor: chrome.card,
                },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: withAlpha(
                        colors.accentDim,
                        isDark ? 0.78 : 0.92
                      ),
                      borderColor: withAlpha(colors.text, isDark ? 0.1 : 0.12),
                    },
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={18}
                    color={withAlpha(colors.text, 0.92)}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroName, { color: colors.text }]}>
                    {signedIn ? deriveDisplayName(user) : "Guest"}
                  </Text>
                  <Text
                    style={[styles.heroEmail, { color: chrome.sub }]}
                    numberOfLines={1}
                  >
                    {email}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <View
                      style={[
                        styles.planPill,
                        {
                          backgroundColor: withAlpha(
                            colors.text,
                            isDark ? 0.08 : 0.06
                          ),
                          borderColor: chrome.hairline,
                        },
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={14}
                        color={withAlpha(colors.text, 0.85)}
                      />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {headerPlan}
                      </Text>
                      <Text
                        style={{
                          color: chrome.sub,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        • {planHint}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    taptic("light");
                    signedIn ? onEditProfile() : onSignIn();
                  }}
                  style={({ pressed }) => [
                    styles.heroBtn,
                    {
                      backgroundColor: pressed
                        ? withAlpha(colors.text, 0.1)
                        : withAlpha(colors.text, 0.08),
                      borderColor: chrome.hairline,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {signedIn ? "Edit" : "Sign in"}
                  </Text>
                </Pressable>
              </View>

              {!verified && signedIn ? (
                <Pressable
                  onPress={onVerifyEmail}
                  style={({ pressed }) => [
                    styles.verifyBanner,
                    {
                      backgroundColor: pressed
                        ? colors.accentDim
                        : withAlpha(colors.accentDim, 0.92),
                      borderColor: colors.accentSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color={withAlpha(colors.text, 0.9)}
                  />
                  <Text
                    style={{ color: colors.text, fontWeight: "800", flex: 1 }}
                  >
                    Verify your email
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={withAlpha(colors.text, 0.5)}
                  />
                </Pressable>
              ) : null}
            </BlurView>
          </Animated.View>

          {/* Membership & Plan */}
          <Section
            title="Membership"
            subtitle="Plan controls and premium access."
            footer={
              hasPro
                ? "You’re on Pro. Enjoy AI features, premium templates, and advanced insights."
                : "Free plan. Upgrade anytime to unlock Pro features."
            }
            delay={40}
          >
            <Row
              icon="sparkles-outline"
              title="Plan"
              value={hasPro ? "Pro" : "Free"}
              hint={hasPro ? "Manage billing & renewal" : "Upgrade to Pro"}
              onPress={onManagePlan}
            />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              title="Badges & achievements"
              hint="Streaks, milestones, challenges"
              onPress={() => {
                taptic("light");
                router.push("/(modals)/badges");
              }}
            />
            {isAdmin || isTester ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingBottom: 12,
                  paddingTop: 2,
                }}
              >
                <Text style={[styles.smallNote, { color: chrome.sub }]}>
                  You’re flagged as {isAdmin ? "admin" : "tester"} — premium
                  stays unlocked.
                </Text>
              </View>
            ) : null}
          </Section>

          {/* Security */}
          <Section
            title="Security"
            subtitle="Sign-in methods, password, and account safety."
            footer="Tip: Use device screen lock and a strong password for the safest experience."
            delay={80}
          >
            <Row
              icon="key-outline"
              title="Sign-in methods"
              value={signedIn ? `${providers.length || 0} linked` : "—"}
              hint={
                signedIn
                  ? "Manage how you sign in"
                  : "Sign in to manage methods"
              }
              onPress={() => {
                taptic("light");
                if (!signedIn) return onSignIn();
                router.push("/account");
              }}
            />
            <Divider />
            <Row
              icon="lock-closed-outline"
              title="Reset password"
              hint={
                signedIn
                  ? canResetPassword
                    ? "Send a reset email"
                    : "Not available for this sign-in method"
                  : "Sign in to continue"
              }
              onPress={
                signedIn && canResetPassword
                  ? onPasswordReset
                  : !signedIn
                  ? onSignIn
                  : undefined
              }
              disabled={signedIn ? !canResetPassword : false}
            />

            {signedIn ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  paddingTop: 8,
                }}
              >
                <Text style={[styles.miniLabel, { color: chrome.sub }]}>
                  Linked methods
                </Text>
                <View style={styles.chipWrap}>
                  {providers.length ? (
                    providers.map((pid) => (
                      <Chip
                        key={pid}
                        text={providerLabel(pid)}
                        onPress={() => onUnlinkProvider(pid)}
                      />
                    ))
                  ) : (
                    <Text style={{ color: chrome.sub, fontWeight: "700" }}>
                      No methods listed.
                    </Text>
                  )}
                </View>
                <Text style={[styles.miniHint, { color: chrome.sub }]}>
                  Tap a method to remove it. Keep at least one active.
                </Text>
              </View>
            ) : null}
          </Section>

          {/* Privacy & Social */}
          <Section
            title="Privacy & Social"
            subtitle="Control what’s visible and how your activity can be shared."
            footer="We aim for calm, non-judgmental defaults. You’re always in control."
            delay={120}
          >
            <Row
              icon="eye-outline"
              title="Profile visibility"
              value={
                privacy.profileVisibility === "private"
                  ? "Private"
                  : privacy.profileVisibility === "friends"
                  ? "Friends"
                  : "Public"
              }
              hint={!privacyLoaded ? "Loading…" : "Who can see your profile"}
              onPress={() => {
                taptic("light");
                if (!signedIn) return onSignIn();
                Alert.alert(
                  "Profile visibility",
                  "Choose who can see your profile.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Private",
                      onPress: () =>
                        onTogglePrivacy({ profileVisibility: "private" }),
                    },
                    {
                      text: "Friends",
                      onPress: () =>
                        onTogglePrivacy({ profileVisibility: "friends" }),
                    },
                    {
                      text: "Public",
                      onPress: () =>
                        onTogglePrivacy({ profileVisibility: "public" }),
                    },
                  ]
                );
              }}
            />
            <Divider />
            <Row
              icon="barbell-outline"
              title="Share workouts"
              hint="Allow sharing workout summaries"
              disabled={!signedIn}
              right={
                <Switch
                  value={privacy.shareWorkouts}
                  onValueChange={(v) => onTogglePrivacy({ shareWorkouts: v })}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
            <Divider />
            <Row
              icon="nutrition-outline"
              title="Share nutrition"
              hint="Allow sharing nutrition summaries"
              disabled={!signedIn}
              right={
                <Switch
                  value={privacy.shareNutrition}
                  onValueChange={(v) => onTogglePrivacy({ shareNutrition: v })}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
            <Divider />
            <Row
              icon="flame-outline"
              title="Share streaks"
              hint="Allow sharing streak milestones"
              disabled={!signedIn}
              right={
                <Switch
                  value={privacy.shareStreaks}
                  onValueChange={(v) => onTogglePrivacy({ shareStreaks: v })}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
            {!signedIn ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  paddingTop: 10,
                }}
              >
                <Text style={[styles.smallNote, { color: chrome.sub }]}>
                  Sign in to sync privacy settings across devices.
                </Text>
              </View>
            ) : null}
          </Section>

          {/* Appearance & Accessibility */}
          <Section
            title="Appearance"
            subtitle="Calm visuals, consistent contrast, and respectful motion."
            footer="Tip: System mode follows your device settings."
            delay={160}
          >
            <Row
              icon="color-palette-outline"
              title="Theme"
              value={themeLabel}
              hint="System, Light, or Dark"
              onPress={() => {
                taptic("light");
                Alert.alert("Theme", "Choose what feels right.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "System", onPress: () => ctxSetMode?.("system") },
                  { text: "Light", onPress: () => ctxSetMode?.("light") },
                  { text: "Dark", onPress: () => ctxSetMode?.("dark") },
                ]);
              }}
            />

            <Divider />

            {/* ✅ Theme Chooser (premium) */}
            <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <ThemeChooserCard />
            </View>

            <Divider />

            <Row
              icon="sparkles-outline"
              title="Low Power UI"
              hint="Less glow, fewer effects"
              right={
                <Switch
                  value={lowPowerMode}
                  onValueChange={async (v) => {
                    await taptic("light");
                    setLowPowerMode(v);
                  }}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />

            <Divider />
            <Row
              icon="walk-outline"
              title="Reduce motion"
              hint="Minimize animations and transitions"
              right={
                <Switch
                  value={reduceMotion}
                  onValueChange={async (v) => {
                    await taptic("light");
                    setReduceMotion(v);
                  }}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
            <Divider />
            <Row
              icon="pulse-outline"
              title="Haptics"
              hint="Subtle feedback for important actions"
              right={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={async (v) => {
                    // allow toggle even if currently off
                    try {
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    } catch {}
                    setHapticsEnabled(v);
                  }}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
          </Section>

          {/* Goals & Units */}
          <Section
            title="Goals & units"
            subtitle="Make numbers feel human."
            delay={200}
          >
            <Row
              icon="analytics-outline"
              title="Units"
              value={
                units === "metric" ? "Metric (kg, cm)" : "Imperial (lb, ft)"
              }
              hint="Affects input + display across the app"
              onPress={async () => {
                await taptic("light");
                Alert.alert(
                  "Units",
                  "Choose your default measurement system.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Metric",
                      onPress: async () => {
                        setUnits("metric");
                        await taptic("soft");
                      },
                    },
                    {
                      text: "Imperial",
                      onPress: async () => {
                        setUnits("imperial");
                        await taptic("soft");
                      },
                    },
                  ]
                );
              }}
            />
            <Divider />
            <Row
              icon="calendar-outline"
              title="Week starts on"
              value={weekStartsOn === "monday" ? "Monday" : "Sunday"}
              hint="Affects trends and weekly summaries"
              onPress={async () => {
                await taptic("light");
                Alert.alert(
                  "Week starts on",
                  "Choose what matches your rhythm.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Monday",
                      onPress: async () => {
                        setWeekStartsOn("monday");
                        await taptic("soft");
                      },
                    },
                    {
                      text: "Sunday",
                      onPress: async () => {
                        setWeekStartsOn("sunday");
                        await taptic("soft");
                      },
                    },
                  ]
                );
              }}
            />
            <Divider />
            <Row
              icon="chatbubble-ellipses-outline"
              title="Coach tone"
              value={
                coachTone === "calm"
                  ? "Calm"
                  : coachTone === "direct"
                  ? "Direct"
                  : "Hype"
              }
              hint="Sets the vibe for guidance"
              onPress={async () => {
                await taptic("light");
                Alert.alert(
                  "Coach tone",
                  "Choose the vibe you want from guidance.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Calm",
                      onPress: async () => {
                        setCoachTone("calm");
                        await taptic("soft");
                      },
                    },
                    {
                      text: "Direct",
                      onPress: async () => {
                        setCoachTone("direct");
                        await taptic("soft");
                      },
                    },
                    {
                      text: "Hype",
                      onPress: async () => {
                        setCoachTone("hype");
                        await taptic("soft");
                      },
                    },
                  ]
                );
              }}
            />
          </Section>

          <Section
            title="Notifications"
            subtitle="Reminders, goals, and social pings."
            footer="Changes apply immediately and scheduled reminders sync on save."
            delay={220}
          >
            {!notificationsLoaded ? (
              <View style={{ padding: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.accentMuted} />
              </View>
            ) : (
              <>
                <Row
                  icon="notifications-outline"
                  title="All notifications"
                  hint="Master switch for reminders and alerts"
                  right={
                    <Switch
                      value={notificationSettings.enabled}
                      onValueChange={(v) =>
                        saveNotifications({ ...notificationSettings, enabled: v }).catch(
                          () => {}
                        )
                      }
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <View style={[styles.subSectionPad, notifDisabled && styles.dimmed]}>
                  <Text style={[styles.sectionMiniLabel, { color: chrome.sub }]}>
                    MEAL REMINDERS
                  </Text>
                </View>
                <Row
                  icon="restaurant-outline"
                  title="Meal reminders"
                  hint="Breakfast, lunch, dinner, snack"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.mealReminders.enabled}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          mealReminders: {
                            ...notificationSettings.mealReminders,
                            enabled: v,
                          },
                        }).catch(() => {})
                      }
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                {(["breakfast", "lunch", "dinner", "snack"] as const).map((meal) => {
                  const row = notificationSettings.mealReminders[meal];
                  return (
                    <View key={meal}>
                      <Divider />
                      <Row
                        icon="time-outline"
                        title={row.label.charAt(0).toUpperCase() + row.label.slice(1)}
                        value={formatClock(row.hour, row.minute)}
                        hint={row.enabled ? "Scheduled" : "Off"}
                        disabled={notifDisabled || !notificationSettings.mealReminders.enabled}
                        onPress={() =>
                          openTimePicker(
                            `meal-${meal}`,
                            row.hour,
                            row.minute,
                            (hour, minute) => ({
                              ...notificationSettings,
                              mealReminders: {
                                ...notificationSettings.mealReminders,
                                [meal]: {
                                  ...row,
                                  hour,
                                  minute,
                                },
                              },
                            })
                          )
                        }
                        right={
                          <Switch
                            value={row.enabled}
                            onValueChange={(v) =>
                              saveNotifications({
                                ...notificationSettings,
                                mealReminders: {
                                  ...notificationSettings.mealReminders,
                                  [meal]: {
                                    ...row,
                                    enabled: v,
                                  },
                                },
                              }).catch(() => {})
                            }
                            disabled={notifDisabled || !notificationSettings.mealReminders.enabled}
                            trackColor={{
                              false: withAlpha(colors.text, 0.18),
                              true: colors.accentMuted,
                            }}
                            thumbColor={Platform.OS === "android" ? undefined : "white"}
                          />
                        }
                      />
                    </View>
                  );
                })}
                <Divider />
                <View style={[styles.subSectionPad, notifDisabled && styles.dimmed]}>
                  <Text style={[styles.sectionMiniLabel, { color: chrome.sub }]}>
                    GOALS & PROGRESS
                  </Text>
                </View>
                <Row
                  icon="flash-outline"
                  title="Protein reminder"
                  value={formatClock(
                    notificationSettings.proteinReminder.hour,
                    notificationSettings.proteinReminder.minute
                  )}
                  disabled={notifDisabled}
                  onPress={() =>
                    openTimePicker(
                      "protein-reminder",
                      notificationSettings.proteinReminder.hour,
                      notificationSettings.proteinReminder.minute,
                      (hour, minute) => ({
                        ...notificationSettings,
                        proteinReminder: {
                          ...notificationSettings.proteinReminder,
                          hour,
                          minute,
                        },
                      })
                    )
                  }
                  right={
                    <Switch
                      value={notificationSettings.proteinReminder.enabled}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          proteinReminder: {
                            ...notificationSettings.proteinReminder,
                            enabled: v,
                          },
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="flame-outline"
                  title="Streak protection"
                  value={formatClock(
                    notificationSettings.streakReminder.hour,
                    notificationSettings.streakReminder.minute
                  )}
                  disabled={notifDisabled}
                  onPress={() =>
                    openTimePicker(
                      "streak-reminder",
                      notificationSettings.streakReminder.hour,
                      notificationSettings.streakReminder.minute,
                      (hour, minute) => ({
                        ...notificationSettings,
                        streakReminder: {
                          ...notificationSettings.streakReminder,
                          hour,
                          minute,
                        },
                      })
                    )
                  }
                  right={
                    <Switch
                      value={notificationSettings.streakReminder.enabled}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          streakReminder: {
                            ...notificationSettings.streakReminder,
                            enabled: v,
                          },
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="checkmark-circle-outline"
                  title="Goal hit alerts"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.goalHitAlerts}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          goalHitAlerts: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="trophy-outline"
                  title="New PRs"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.prAlerts}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          prAlerts: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="ribbon-outline"
                  title="Badge unlocks"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.badgeAlerts}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          badgeAlerts: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <View style={[styles.subSectionPad, notifDisabled && styles.dimmed]}>
                  <Text style={[styles.sectionMiniLabel, { color: chrome.sub }]}>
                    SOCIAL
                  </Text>
                </View>
                <Row
                  icon="notifications-circle-outline"
                  title="Friend pings"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.friendPings}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          friendPings: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="people-outline"
                  title="Friend milestones"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.friendMilestones}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          friendMilestones: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <View style={[styles.subSectionPad, notifDisabled && styles.dimmed]}>
                  <Text style={[styles.sectionMiniLabel, { color: chrome.sub }]}>
                    WEEKLY
                  </Text>
                </View>
                <Row
                  icon="calendar-number-outline"
                  title="Weekly summary"
                  value={`Sun ${formatClock(
                    notificationSettings.weeklySummary.hour,
                    notificationSettings.weeklySummary.minute
                  )}`}
                  disabled={notifDisabled}
                  onPress={() =>
                    openTimePicker(
                      "weekly-summary",
                      notificationSettings.weeklySummary.hour,
                      notificationSettings.weeklySummary.minute,
                      (hour, minute) => ({
                        ...notificationSettings,
                        weeklySummary: {
                          ...notificationSettings.weeklySummary,
                          hour,
                          minute,
                        },
                      })
                    )
                  }
                  right={
                    <Switch
                      value={notificationSettings.weeklySummary.enabled}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          weeklySummary: {
                            ...notificationSettings.weeklySummary,
                            enabled: v,
                          },
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
                <Divider />
                <Row
                  icon="sparkles-outline"
                  title="Weekly check-in reminder"
                  disabled={notifDisabled}
                  right={
                    <Switch
                      value={notificationSettings.weeklyCheckinReminder}
                      onValueChange={(v) =>
                        saveNotifications({
                          ...notificationSettings,
                          weeklyCheckinReminder: v,
                        }).catch(() => {})
                      }
                      disabled={notifDisabled}
                      trackColor={{
                        false: withAlpha(colors.text, 0.18),
                        true: colors.accentMuted,
                      }}
                      thumbColor={Platform.OS === "android" ? undefined : "white"}
                    />
                  }
                />
              </>
            )}
          </Section>

          {/* Privacy & Safety (device) */}
          <Section
            title="Privacy & safety"
            subtitle="Control, clarity, and consent."
            footer="Your data is yours. We aim for transparency over persuasion."
            delay={240}
          >
            <Row
              icon="lock-closed-outline"
              title="Hide on lock screen"
              hint="Blur sensitive values"
              right={
                <Switch
                  value={privateOnLock}
                  onValueChange={async (v) => {
                    await taptic("light");
                    setPrivateOnLock(v);
                  }}
                  trackColor={{
                    false: withAlpha(colors.text, 0.18),
                    true: colors.accentMuted,
                  }}
                  thumbColor={Platform.OS === "android" ? undefined : "white"}
                />
              }
            />
            <Divider />
            <Row
              icon="hand-left-outline"
              title="Permissions"
              hint="Camera, photos, notifications"
              onPress={() => {
                taptic("light");
                openSettings();
              }}
            />
            <Divider />
            <Row
              icon="sparkles-outline"
              title="AI features"
              hint="What gets sent, what stays local"
              onPress={() => {
                taptic("light");
                router.push("/(modals)/ai-meal-suggestions");
              }}
            />
          </Section>

          {/* Data controls */}
          <Section
            title="Data controls"
            subtitle="Export, portability, and resets."
            footer="Sensitive actions are protected and require confirmation."
            delay={280}
          >
            <Row
              icon="download-outline"
              title="Export your data"
              hint="Request a copy of your data"
              onPress={signedIn ? onExportData : onSignIn}
              disabled={!signedIn}
            />
            <Divider />
            <Row
              icon="refresh-outline"
              title="Reset settings"
              hint="Restore defaults on this device"
              onPress={confirmReset}
              danger
            />
            <Divider />
            <Row
              icon="trash-outline"
              title="Delete account"
              hint="Permanently delete your account and data"
              onPress={signedIn ? onDeleteAccount : onSignIn}
              disabled={!signedIn}
              danger
            />
            {!signedIn ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  paddingTop: 10,
                }}
              >
                <Text style={[styles.smallNote, { color: chrome.sub }]}>
                  Sign in to export or delete your account.
                </Text>
              </View>
            ) : null}
          </Section>

          {/* Legal & Support */}
          <Section
            title="Support & legal"
            subtitle="Fast help, human tone."
            delay={320}
          >
            <Row
              icon="help-circle-outline"
              title="Help center"
              hint="Guides and FAQs"
              onPress={() => {
                taptic("light");
                Alert.alert(
                  "Help center",
                  "Wire this to your help center when ready."
                );
              }}
            />
            <Divider />
            <Row
              icon="mail-outline"
              title="Contact us"
              hint="Send feedback"
              onPress={() => {
                taptic("light");
                Alert.alert(
                  "Contact us",
                  "Wire this to your support channel when ready."
                );
              }}
            />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              title="Privacy policy"
              hint="How we handle your data"
              onPress={() => {
                taptic("light");
                router.push("/account/privacy");
              }}
            />
            <Divider />
            <Row
              icon="document-text-outline"
              title="Terms of service"
              hint="The legal stuff, kept readable"
              onPress={() => {
                taptic("light");
                router.push("/account/legal");
              }}
            />
          </Section>

          {/* Session */}
          <Section title="Account" subtitle="Session and sign-in." delay={360}>
            {signedIn ? (
              <Row
                icon="log-out-outline"
                title="Sign out"
                hint="Sign out on this device"
                onPress={onSignOut}
                danger
              />
            ) : (
              <Row
                icon="log-in-outline"
                title="Sign in"
                hint="Sync your data across devices"
                onPress={onSignIn}
              />
            )}
          </Section>

          <View style={{ height: 18 }} />
          <View style={{ paddingHorizontal: 18 }}>
            <BlurView
              intensity={14}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.pill,
                { borderColor: chrome.hairline, backgroundColor: chrome.card },
              ]}
            >
              <Text
                style={{ color: chrome.sub, fontWeight: "700", lineHeight: 18 }}
              >
                We design controls to feel calm: clear defaults, fewer toggles,
                and advanced options tucked away until you need them.
              </Text>
            </BlurView>
          </View>

          <View style={{ height: 26 }} />
        </ScrollView>
      )}

      {timePickerState ? (
        <Modal transparent animationType="fade" visible>
          <View style={styles.pickerScrim}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setTimePickerState(null)}
            />
            <View
              style={[
                styles.pickerCard,
                {
                  backgroundColor: colors.surface1,
                  borderColor: chrome.hairline,
                },
              ]}
            >
              <View style={styles.pickerHeader}>
                <Pressable onPress={() => setTimePickerState(null)}>
                  <Text style={[styles.pickerAction, { color: chrome.sub }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>
                  Pick a time
                </Text>
                <Pressable onPress={() => setTimePickerState(null)}>
                  <Text
                    style={[styles.pickerAction, { color: colors.accentMuted }]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={timePickerState.value}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  if (Platform.OS === "android") {
                    if (event.type === "dismissed") {
                      setTimePickerState(null);
                      return;
                    }
                    if (date) {
                      timePickerState.apply(date);
                    }
                    setTimePickerState(null);
                    return;
                  }
                  if (date) {
                    setTimePickerState((current) =>
                      current
                        ? {
                            ...current,
                            value: date,
                          }
                        : current
                    );
                    timePickerState.apply(date);
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dimmed: { opacity: 0.4 },
  subSectionPad: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  sectionMiniLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pickerScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  pickerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pickerTitle: { fontSize: 16, fontWeight: "600" },
  pickerAction: { fontSize: 14, fontWeight: "500" },

  topBar: {
    paddingTop: Platform.OS === "android" ? 14 : 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBtn: {
    width: 44,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { fontSize: 12, marginTop: 2 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 420,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  loadingText: { fontSize: 13, fontWeight: "600" },

  hero: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: "hidden",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroName: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  heroEmail: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  heroBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifyBanner: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexShrink: 1,
  },

  h2: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sub: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  footer: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  rowHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  rowRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },

  miniLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  miniHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  chipWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  smallNote: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
});
