// // app/(modals)/settings.tsx
// import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
// import {
//   ScrollView,
//   View,
//   Text,
//   Switch,
//   Pressable,
//   TextInput,
//   Alert,
//   Platform,
// } from "react-native";
// import { router, useNavigation } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { BlurView } from "expo-blur";
// import { LinearGradient } from "expo-linear-gradient";

// import Card from "../../components/Card";
// import { useTheme } from "@/content/ThemeProvider";
// import { useAuth } from "@/content/AuthContext";
// import {
//   ensureProfile,
//   subscribeProfile,
//   updateProfile,
//   type Profile,
// } from "@/services/profile";
// import ThemeChooser from "@/components/settings/ThemeChooser";

// type ThemePref = "system" | "light" | "dark";
// type Unit = "kg" | "lb";
// type Settings = {
//   notificationsEnabled: boolean;
//   notifyDaily: boolean;
//   dailyReminder: string; // "HH:MM"
//   workoutReminders: boolean;
//   mealReminders: boolean;
//   advancedWorkoutMode: boolean;
//   autoSyncHealth: boolean;
//   theme: ThemePref;
//   haptics: boolean;
//   soundEffects: boolean;
//   analytics: boolean;
//   weightUnit: Unit;
//   themeOverrides?: { primary?: string; accent?: string };
// };

// const DEFAULTS: Settings = {
//   notificationsEnabled: false,
//   notifyDaily: false,
//   dailyReminder: "08:00",
//   workoutReminders: false,
//   mealReminders: false,
//   advancedWorkoutMode: false,
//   autoSyncHealth: false,
//   theme: "system",
//   haptics: true,
//   soundEffects: false,
//   analytics: true,
//   weightUnit: "kg",
//   themeOverrides: undefined,
// };

// function toTimeString(s: string | undefined): string {
//   const v = (s || "").trim();
//   return /^\d{2}:\d{2}$/.test(v) ? v : "08:00";
// }

// export default function SettingsModal() {
//   const theme = useTheme() as any;
//   const { colors, isDark } = theme;
//   const { user } = useAuth();
//   const nav = useNavigation();

//   const [profile, setProfile] = useState<Profile | null>(null);
//   const [settings, setSettings] = useState<Settings>(DEFAULTS);
//   const [saving, setSaving] = useState(false);

//   const currentPrimary = (settings.themeOverrides?.primary ||
//     colors.primary) as string;
//   const currentAccent = (settings.themeOverrides?.accent ||
//     colors.accent) as string;

//   // glossy header
//   useLayoutEffect(() => {
//     nav.setOptions({
//       headerShadowVisible: false,
//       headerBackground: () => (
//         <View style={{ position: "absolute", inset: 0 }}>
//           <LinearGradient
//             colors={
//               isDark
//                 ? ["rgba(16,18,28,0.85)", "rgba(16,18,28,0.65)"]
//                 : ["rgba(244,247,255,0.85)", "rgba(244,247,255,0.65)"]
//             }
//             style={{ position: "absolute", inset: 0 }}
//           />
//           <BlurView
//             intensity={24}
//             tint={
//               isDark ? "systemThickMaterialDark" : "systemThickMaterialLight"
//             }
//             style={{ position: "absolute", inset: 0 }}
//           />
//           <View
//             style={{
//               position: "absolute",
//               left: 0,
//               right: 0,
//               bottom: 0,
//               height: 1,
//               backgroundColor: isDark
//                 ? "rgba(255,255,255,0.08)"
//                 : "rgba(0,0,0,0.06)",
//             }}
//           />
//         </View>
//       ),
//       headerTitle: () => (
//         <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//           <View
//             style={{
//               padding: 8,
//               borderRadius: 12,
//               backgroundColor: `${currentPrimary}26`,
//               borderWidth: 1,
//               borderColor: `${currentPrimary}66`,
//             }}
//           >
//             <Ionicons name="settings-outline" size={18} color={colors.text} />
//           </View>
//           <View>
//             <Text
//               style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}
//             >
//               Settings
//             </Text>
//             <Text style={{ color: colors.muted, fontSize: 12 }}>
//               Tailor the app to your style
//             </Text>
//           </View>
//         </View>
//       ),
//       headerRight: () => (
//         <Pressable
//           onPress={() => router.back()}
//           style={{ borderRadius: 999, overflow: "hidden" }}
//         >
//           <BlurView
//             intensity={16}
//             tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
//           >
//             <Text
//               style={{
//                 paddingVertical: 8,
//                 paddingHorizontal: 14,
//                 color: colors.text,
//                 fontWeight: "800",
//               }}
//             >
//               Done
//             </Text>
//           </BlurView>
//         </Pressable>
//       ),
//     });
//   }, [nav, isDark, colors.text, currentPrimary]);

//   // hydrate from profile
//   useEffect(() => {
//     if (!user?.uid) return;
//     let unsub: undefined | (() => void);
//     (async () => {
//       await ensureProfile(user.uid, user.email ? { email: user.email } : {});
//       unsub = subscribeProfile(user.uid, (p) => {
//         setProfile(p || null);
//         const s = (p as any)?.settings || {};
//         setSettings({
//           ...DEFAULTS,
//           ...s,
//           weightUnit: (p?.weightUnit === "lb" ? "lb" : "kg") as Unit,
//           dailyReminder: toTimeString(s?.dailyReminder),
//         });
//       });
//     })();
//     return () => {
//       try {
//         unsub && unsub();
//       } catch {}
//     };
//   }, [user?.uid]);

//   async function onSave() {
//     if (!user?.uid) return;
//     setSaving(true);
//     try {
//       await updateProfile(user.uid, {
//         settings,
//         weightUnit: settings.weightUnit,
//         updatedAt: Date.now(),
//       } as any);
//       Alert.alert("Saved", "Your settings were updated.");
//       router.back();
//     } catch (e: any) {
//       Alert.alert("Save failed", e?.message || "Couldn't update settings");
//     } finally {
//       setSaving(false);
//     }
//   }

//   // helpers
//   const Row = ({
//     children,
//     style,
//   }: {
//     children: React.ReactNode;
//     style?: any;
//   }) => (
//     <View
//       style={[
//         {
//           flexDirection: "row",
//           alignItems: "center",
//           justifyContent: "space-between",
//           gap: 12,
//           paddingVertical: 10,
//         },
//         style,
//       ]}
//     >
//       {children}
//     </View>
//   );

//   const Label = ({ title, subtitle }: { title: string; subtitle?: string }) => (
//     <View style={{ flex: 1 }}>
//       <Text style={{ color: colors.text, fontWeight: "700" }}>{title}</Text>
//       {!!subtitle && (
//         <Text style={{ color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
//       )}
//     </View>
//   );

//   const Segmented = ({
//     value,
//     options,
//     onChange,
//   }: {
//     value: string;
//     options: { value: string; label: string }[];
//     onChange: (v: string) => void;
//   }) => (
//     <View
//       style={{
//         flexDirection: "row",
//         borderWidth: 1,
//         borderColor: colors.border,
//         borderRadius: 999,
//         padding: 4,
//         backgroundColor: colors.card,
//       }}
//     >
//       {options.map((o) => {
//         const active = value === o.value;
//         return (
//           <Pressable
//             key={o.value}
//             onPress={() => onChange(o.value)}
//             style={{
//               paddingVertical: 8,
//               paddingHorizontal: 14,
//               borderRadius: 999,
//               backgroundColor: active ? "rgba(0,0,0,0.06)" : "transparent",
//             }}
//           >
//             <Text
//               style={{ color: colors.text, fontWeight: active ? "800" : "600" }}
//             >
//               {o.label}
//             </Text>
//           </Pressable>
//         );
//       })}
//     </View>
//   );

//   return (
//     <ScrollView
//       style={{ flex: 1, backgroundColor: colors.background }}
//       contentInsetAdjustmentBehavior="automatic"
//       contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 28 }}
//       keyboardShouldPersistTaps="handled"
//     >
//       {/* Theme Studio — uses drop-in ThemeChooser */}
//       <Card style={{ padding: 16, gap: 12 }}>
//         <Text
//           style={{
//             color: colors.text,
//             fontSize: 16,
//             fontWeight: "800",
//             letterSpacing: 0.3,
//           }}
//         >
//           Theme & Colors
//         </Text>

//         <ThemeChooser
//           primary={currentPrimary}
//           accent={currentAccent}
//           onApply={(p, a) => {
//             // Save into local state; Settings "Save" button persists to Firestore.
//             setSettings((s) => ({
//               ...s,
//               themeOverrides: { primary: p, accent: a },
//             }));
//             // Optional live-apply if ThemeProvider exposes setAccents()
//             (theme as any)?.setAccents?.(p, a);
//           }}
//           onReset={() => {
//             setSettings((s) => ({ ...s, themeOverrides: undefined }));
//             (theme as any)?.resetAccents?.();
//           }}
//         />

//         <Text style={{ color: colors.muted, fontSize: 12 }}>
//           Your color selection takes effect across the app. Tap Save at the
//           bottom to persist.
//         </Text>
//       </Card>

//       {/* General */}
//       <Card style={{ padding: 16 }}>
//         <Text
//           style={{
//             color: colors.text,
//             fontSize: 16,
//             fontWeight: "800",
//             letterSpacing: 0.3,
//           }}
//         >
//           General
//         </Text>
//         <Row>
//           <Label title="Units" subtitle="Affects weight entry & calculations" />
//           <Segmented
//             value={settings.weightUnit}
//             onChange={(v) =>
//               setSettings((s) => ({ ...s, weightUnit: v as Unit }))
//             }
//             options={[
//               { value: "kg", label: "kg" },
//               { value: "lb", label: "lb" },
//             ]}
//           />
//         </Row>
//         <Row>
//           <Label
//             title="Advanced workout mode"
//             subtitle="Unlocks more set/rep schemes (coming soon)"
//           />
//           <Switch
//             value={settings.advancedWorkoutMode}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, advancedWorkoutMode: v }))
//             }
//           />
//         </Row>
//         <Row>
//           <Label
//             title="Auto-sync health data"
//             subtitle={
//               Platform.OS === "ios"
//                 ? "Apple Health (planned)"
//                 : "Google Fit (planned)"
//             }
//           />
//           <Switch
//             value={settings.autoSyncHealth}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, autoSyncHealth: v }))
//             }
//           />
//         </Row>
//       </Card>

//       {/* Notifications */}
//       <Card style={{ padding: 16 }}>
//         <Text
//           style={{
//             color: colors.text,
//             fontSize: 16,
//             fontWeight: "800",
//             letterSpacing: 0.3,
//           }}
//         >
//           Notifications
//         </Text>
//         <Row>
//           <Label
//             title="Enable notifications"
//             subtitle="Allow reminders & progress nudges"
//           />
//           <Switch
//             value={settings.notificationsEnabled}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, notificationsEnabled: v }))
//             }
//           />
//         </Row>
//         <Row>
//           <Label title="Daily reminder time" subtitle="HH:MM (24h)" />
//           <TextInput
//             value={settings.dailyReminder}
//             onChangeText={(txt) =>
//               setSettings((s) => ({ ...s, dailyReminder: toTimeString(txt) }))
//             }
//             placeholder="08:00"
//             placeholderTextColor={colors.placeholder}
//             keyboardType="numeric"
//             style={{
//               width: 110,
//               borderWidth: 1,
//               borderColor: colors.inputBorder,
//               borderRadius: 12,
//               paddingHorizontal: 12,
//               paddingVertical: 10,
//               backgroundColor: colors.inputBg,
//               color: colors.text,
//               textAlign: "center",
//               fontWeight: "700",
//             }}
//           />
//         </Row>
//         <Row>
//           <Label title="Daily check-in" subtitle="Motivation & habit streaks" />
//           <Switch
//             value={settings.notifyDaily}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, notifyDaily: v }))
//             }
//           />
//         </Row>
//         <Row>
//           <Label
//             title="Workout reminders"
//             subtitle="Based on your planned training days"
//           />
//           <Switch
//             value={settings.workoutReminders}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, workoutReminders: v }))
//             }
//           />
//         </Row>
//         <Row>
//           <Label title="Meal reminders" subtitle="Based on meal schedule" />
//           <Switch
//             value={settings.mealReminders}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, mealReminders: v }))
//             }
//           />
//         </Row>
//       </Card>

//       {/* Appearance & UX */}
//       <Card style={{ padding: 16 }}>
//         <Text
//           style={{
//             color: colors.text,
//             fontSize: 16,
//             fontWeight: "800",
//             letterSpacing: 0.3,
//           }}
//         >
//           Appearance & UX
//         </Text>
//         <Row>
//           <Label title="Theme" subtitle="Force Light/Dark or follow System" />
//           <Segmented
//             value={settings.theme}
//             onChange={(v) =>
//               setSettings((s) => ({ ...s, theme: v as ThemePref }))
//             }
//             options={[
//               { value: "system", label: "System" },
//               { value: "light", label: "Light" },
//               { value: "dark", label: "Dark" },
//             ]}
//           />
//         </Row>
//         <Row>
//           <Label title="Haptics" subtitle="Subtle vibrations on actions" />
//           <Switch
//             value={settings.haptics}
//             onValueChange={(v) => setSettings((s) => ({ ...s, haptics: v }))}
//           />
//         </Row>
//         <Row>
//           <Label title="Sound effects" subtitle="Tiny taps and chimes" />
//           <Switch
//             value={settings.soundEffects}
//             onValueChange={(v) =>
//               setSettings((s) => ({ ...s, soundEffects: v }))
//             }
//           />
//         </Row>
//       </Card>

//       {/* Privacy & data */}
//       <Card style={{ padding: 16, gap: 10 }}>
//         <Text
//           style={{
//             color: colors.text,
//             fontSize: 16,
//             fontWeight: "800",
//             letterSpacing: 0.3,
//           }}
//         >
//           Privacy & Data
//         </Text>
//         <Row>
//           <Label
//             title="Anonymous analytics"
//             subtitle="Help improve the app (no personal data)"
//           />
//           <Switch
//             value={settings.analytics}
//             onValueChange={(v) => setSettings((s) => ({ ...s, analytics: v }))}
//           />
//         </Row>
//         <Pressable
//           onPress={() => Alert.alert("Export", "Export coming soon")}
//           style={({ pressed }) => [
//             {
//               borderWidth: 1,
//               borderColor: colors.border,
//               borderRadius: 12,
//               paddingVertical: 12,
//               paddingHorizontal: 14,
//               backgroundColor: pressed ? colors.inputBg : "transparent",
//             },
//           ]}
//         >
//           <Text style={{ color: colors.text, fontWeight: "700" }}>
//             Export my data (CSV)
//           </Text>
//           <Text style={{ color: colors.muted, marginTop: 2 }}>
//             Workouts, nutrition logs, and targets.
//           </Text>
//         </Pressable>
//         <Pressable
//           onPress={() =>
//             Alert.alert(
//               "Delete account",
//               "Account deletion will be added soon. For now, contact support.",
//               [{ text: "OK" }]
//             )
//           }
//           style={({ pressed }) => [
//             {
//               borderWidth: 1,
//               borderColor: colors.border,
//               borderRadius: 12,
//               paddingVertical: 12,
//               paddingHorizontal: 14,
//               backgroundColor: pressed ? colors.inputBg : "transparent",
//             },
//           ]}
//         >
//           <Text style={{ color: "#ef4444", fontWeight: "800" }}>
//             Delete my account
//           </Text>
//           <Text style={{ color: colors.muted, marginTop: 2 }}>
//             Permanently remove your data (irreversible).
//           </Text>
//         </Pressable>
//       </Card>

//       {/* Footer actions */}
//       <View
//         style={{
//           flexDirection: "row",
//           gap: 10,
//           justifyContent: "flex-end",
//           marginBottom: 10,
//         }}
//       >
//         <Pressable
//           onPress={() => router.back()}
//           style={({ pressed }) => [
//             {
//               borderWidth: 1,
//               borderColor: colors.border,
//               borderRadius: 12,
//               paddingVertical: 12,
//               paddingHorizontal: 16,
//               backgroundColor: pressed ? colors.inputBg : "transparent",
//             },
//           ]}
//         >
//           <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
//         </Pressable>

//         <Pressable
//           onPress={onSave}
//           disabled={saving}
//           style={{
//             borderRadius: 12,
//             overflow: "hidden",
//             opacity: saving ? 0.9 : 1,
//           }}
//         >
//           <LinearGradient
//             colors={[currentPrimary, currentAccent]}
//             start={{ x: 0, y: 0.5 }}
//             end={{ x: 1, y: 0.5 }}
//             style={{
//               paddingVertical: 12,
//               paddingHorizontal: 16,
//               alignItems: "center",
//               justifyContent: "center",
//             }}
//           >
//             <Text style={{ color: "#fff", fontWeight: "800" }}>
//               {saving ? "Saving…" : "Save"}
//             </Text>
//           </LinearGradient>
//         </Pressable>
//       </View>
//     </ScrollView>
//   );
// }
