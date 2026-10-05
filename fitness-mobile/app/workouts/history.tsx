// // app/workouts/history.tsx
// // Theme-aware (dark/light) glossy history screen.
// // Drop-in replacement.

// import React, { useEffect, useMemo, useState } from "react";
// import {
//   View,
//   Text,
//   Pressable,
//   ScrollView,
//   Modal,
//   TextInput,
//   StyleSheet,
//   Platform,
//   StatusBar,
//   Alert as RNAlert,
// } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
// import { useRouter, useLocalSearchParams } from "expo-router";
// import { LinearGradient } from "expo-linear-gradient";
// import { BlurView } from "expo-blur";
// import * as Haptics from "expo-haptics";

// import { useAuth } from "@/content/AuthContext";
// import { useTheme } from "@/content/ThemeProvider";
// import { withAlpha } from "@/components/workouts/utils/withAlpha";
// import { endOfToday, fmt, startOfMonth, startOfWeek } from "@/utils/date";
// import {
//   subscribeWorkouts,
//   updateWorkout,
//   deleteWorkout,
//   type Workout,
// } from "@/services/workouts";

// type PresetKey = "all" | "week" | "7" | "month" | "30";

// function computePrFlags(all: Workout[]) {
//   const list = all
//     .slice()
//     .sort(
//       (a, b) =>
//         (a.date || "").localeCompare(b.date || "") ||
//         ((a.createdAt as any)?.toMillis?.() ?? (a.createdAt as any) ?? 0) -
//           ((b.createdAt as any)?.toMillis?.() ?? (b.createdAt as any) ?? 0)
//     );

//   const bestByExercise = new Map<string, { weight: number; volume: number }>();
//   const flags: Record<string, { prWeight: boolean; prVolume: boolean }> = {};
//   for (const w of list) {
//     const ex = (w.exercise || "").trim().toLowerCase();
//     const prev = bestByExercise.get(ex) || { weight: 0, volume: 0 };
//     const isPRw = Number(w.weight || 0) > prev.weight;
//     const vol =
//       Number(w.sets || 0) * Number(w.reps || 0) * Number(w.weight || 0);
//     const isPRv = vol > prev.volume;
//     flags[w.id] = { prWeight: isPRw, prVolume: isPRv };
//     bestByExercise.set(ex, {
//       weight: Math.max(prev.weight, Number(w.weight || 0)),
//       volume: Math.max(prev.volume, vol),
//     });
//   }
//   return flags;
// }

// function fmtCompact(n: number) {
//   if (!isFinite(n)) return "0";
//   const abs = Math.abs(n);
//   if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
//   if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
//   return String(Math.round(n));
// }

// function GlassCard({
//   children,
//   style,
//   intensity = 34,
// }: {
//   children: React.ReactNode;
//   style?: any;
//   intensity?: number;
// }) {
//   const { colors, isDark } = useTheme();

//   const border = isDark
//     ? withAlpha("#FFFFFF", 0.14)
//     : withAlpha(colors.text, 0.1);

//   const tint = isDark ? "dark" : "light";

//   const grad = isDark
//     ? [
//         withAlpha("#FFFFFF", 0.1),
//         withAlpha("#FFFFFF", 0.06),
//         withAlpha("#000000", 0.06),
//       ]
//     : [
//         withAlpha(colors.primary, 0.1),
//         withAlpha("#FFFFFF", 0.78),
//         withAlpha(colors.card, 0.6),
//       ];

//   const bg = isDark ? withAlpha("#FFFFFF", 0.06) : withAlpha("#FFFFFF", 0.72);

//   return (
//     <View
//       style={[
//         styles.cardWrap,
//         { backgroundColor: bg, borderColor: border },
//         style,
//       ]}
//     >
//       <View
//         style={[styles.cardBorder, { borderColor: border }]}
//         pointerEvents="none"
//       />
//       <BlurView intensity={intensity} tint={tint} style={styles.cardBlur}>
//         <LinearGradient
//           colors={grad as any}
//           start={{ x: 0, y: 0 }}
//           end={{ x: 1, y: 1 }}
//           style={styles.cardInner}
//         >
//           {children}
//         </LinearGradient>
//       </BlurView>
//     </View>
//   );
// }

// function StatChip({
//   icon,
//   label,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   label: string;
// }) {
//   const { colors, isDark } = useTheme();
//   const bg = isDark ? withAlpha("#FFFFFF", 0.05) : withAlpha(colors.card, 0.85);
//   const border = isDark
//     ? withAlpha("#FFFFFF", 0.12)
//     : withAlpha(colors.text, 0.1);

//   return (
//     <View
//       style={[styles.statChip, { backgroundColor: bg, borderColor: border }]}
//     >
//       <Ionicons
//         name={icon}
//         size={14}
//         color={withAlpha(colors.text, isDark ? 0.82 : 0.78)}
//       />
//       <Text
//         style={[
//           styles.statChipText,
//           { color: withAlpha(colors.text, isDark ? 0.82 : 0.82) },
//         ]}
//       >
//         {label}
//       </Text>
//     </View>
//   );
// }

// function RowBtn({
//   title,
//   onPress,
//   active,
// }: {
//   title: string;
//   onPress?: () => void;
//   active?: boolean;
// }) {
//   const { colors, isDark } = useTheme();

//   const bg = active
//     ? isDark
//       ? withAlpha("#FFFFFF", 0.92)
//       : withAlpha(colors.text, 0.9)
//     : isDark
//     ? withAlpha("#FFFFFF", 0.05)
//     : withAlpha(colors.card, 0.85);

//   const border = active
//     ? bg
//     : isDark
//     ? withAlpha("#FFFFFF", 0.12)
//     : withAlpha(colors.text, 0.1);

//   const text = active
//     ? isDark
//       ? withAlpha("#111", 0.92)
//       : withAlpha("#FFFFFF", 0.95)
//     : withAlpha(colors.text, isDark ? 0.86 : 0.82);

//   return (
//     <Pressable
//       onPress={onPress}
//       style={({ pressed }) => [
//         styles.filterPill,
//         { backgroundColor: bg, borderColor: border },
//         pressed && { opacity: 0.9 },
//       ]}
//     >
//       <Text style={[styles.filterPillText, { color: text }]}>{title}</Text>
//     </Pressable>
//   );
// }

// export default function WorkoutHistoryScreen() {
//   const router = useRouter();
//   useLocalSearchParams<{ focus?: string }>(); // keep (in case you use later)

//   const { user } = useAuth();
//   const uid = user?.uid;

//   const { colors, isDark } = useTheme();

//   const accent = colors.primary ?? "#68D7FF";
//   const accent2 = "#8B7CFF";

//   const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

//   const [preset, setPreset] = useState<PresetKey>("all");
//   const [from, setFrom] = useState<string>("");
//   const [to, setTo] = useState<string>("");
//   const [workouts, setWorkouts] = useState<Workout[]>([]);
//   const unit: "kg" | "lb" = "kg";

//   const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

//   const [editId, setEditId] = useState<string | null>(null);
//   const [edit, setEdit] = useState({
//     date: "",
//     exercise: "",
//     sets: "",
//     reps: "",
//     weight: "",
//     notes: "",
//   });

//   useEffect(() => {
//     const today = endOfToday(new Date());
//     if (preset === "all") {
//       setFrom("");
//       setTo("");
//       return;
//     }
//     if (preset === "week") {
//       setFrom(fmt(startOfWeek(today)));
//       setTo(fmt(today));
//       return;
//     }
//     if (preset === "7") {
//       const s = new Date(today);
//       s.setDate(s.getDate() - 6);
//       setFrom(fmt(s));
//       setTo(fmt(today));
//       return;
//     }
//     if (preset === "month") {
//       setFrom(fmt(startOfMonth(today)));
//       setTo(fmt(today));
//       return;
//     }
//     if (preset === "30") {
//       const s = new Date(today);
//       s.setDate(s.getDate() - 29);
//       setFrom(fmt(s));
//       setTo(fmt(today));
//       return;
//     }
//   }, [preset]);

//   useEffect(() => {
//     if (from && to && from > to) setTo("");
//   }, [from, to]);

//   useEffect(() => {
//     if (!uid) return;
//     return subscribeWorkouts(uid, setWorkouts, { from, to });
//   }, [uid, from, to]);

//   const grouped = useMemo(() => {
//     const byDate: Record<string, Workout[]> = {};
//     for (const w of workouts) (byDate[w.date] ??= []).push(w);
//     const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
//     return dates.map((d) => ({
//       date: d,
//       items: byDate[d]
//         .slice()
//         .sort((a, b) => (a.exercise || "").localeCompare(b.exercise || "")),
//     }));
//   }, [workouts]);

//   const prFlags = useMemo(() => computePrFlags(workouts), [workouts]);

//   const totals = useMemo(() => {
//     let setsSum = 0;
//     let volume = 0;
//     for (const w of workouts) {
//       const s = Number(w.sets || 0);
//       const r = Number(w.reps || 0);
//       const wt = Number(w.weight || 0);
//       setsSum += s;
//       volume += s * r * wt;
//     }
//     const prCount = Object.values(prFlags).filter(
//       (f) => f.prWeight || f.prVolume
//     ).length;
//     return {
//       workouts: workouts.length,
//       sets: setsSum,
//       volume: Math.round(volume),
//       prCount,
//     };
//   }, [workouts, prFlags]);

//   function startEdit(w: Workout) {
//     setEditId(w.id);
//     setEdit({
//       date: w.date || "",
//       exercise: w.exercise || "",
//       sets: String(w.sets ?? ""),
//       reps: String(w.reps ?? ""),
//       weight: String(w.weight ?? ""),
//       notes: w.notes || "",
//     });
//     Haptics.selectionAsync().catch(() => {});
//   }

//   async function saveEdit() {
//     if (!uid || !editId) {
//       setEditId(null);
//       return;
//     }

//     const patch = {
//       date: edit.date,
//       exercise: edit.exercise.trim(),
//       sets: Number(edit.sets || 0),
//       reps: Number(edit.reps || 0),
//       weight: Number(edit.weight || 0),
//       notes: (edit.notes || "").trim(),
//     };

//     const prev = workouts;
//     setWorkouts((curr) =>
//       curr.map((w) => (w.id === editId ? { ...w, ...patch } : w))
//     );
//     setEditId(null);

//     try {
//       await updateWorkout(uid, editId, patch);
//       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
//     } catch (e) {
//       console.warn(e);
//       setWorkouts(prev);
//     }
//   }

//   async function removeWorkout(id: string) {
//     if (!uid) return;

//     RNAlert.alert("Delete workout?", "This can't be undone.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Delete",
//         style: "destructive",
//         onPress: async () => {
//           const prev = workouts;
//           setWorkouts((curr) => curr.filter((w) => w.id !== id));
//           try {
//             await deleteWorkout(uid, id);
//             Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
//               () => {}
//             );
//           } catch (e) {
//             console.warn(e);
//             setWorkouts(prev);
//           }
//         },
//       },
//     ]);
//   }

//   const sidePad = 16;

//   const bgGradient = isDark
//     ? ["#070A12", "#050711", "#03040A"]
//     : [
//         withAlpha(accent, 0.1),
//         withAlpha("#FFFFFF", 0.92),
//         withAlpha(colors.card, 0.7),
//       ];

//   const headerBorder = withAlpha(colors.text, isDark ? 0.12 : 0.1);

//   const backPillBg = isDark
//     ? withAlpha("#FFFFFF", 0.06)
//     : withAlpha(colors.card, 0.85);
//   const backPillBorder = isDark
//     ? withAlpha("#FFFFFF", 0.14)
//     : withAlpha(colors.text, 0.1);

//   const rowBg = isDark
//     ? withAlpha("#FFFFFF", 0.05)
//     : withAlpha(colors.card, 0.88);
//   const rowBorder = isDark
//     ? withAlpha("#FFFFFF", 0.12)
//     : withAlpha(colors.text, 0.1);

//   const fieldBg = isDark
//     ? withAlpha("#FFFFFF", 0.06)
//     : withAlpha(colors.card, 0.9);
//   const fieldBorder = isDark
//     ? withAlpha("#FFFFFF", 0.14)
//     : withAlpha(colors.text, 0.12);

//   const modalBackdrop = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)";

//   return (
//     <View style={[styles.root, { backgroundColor: colors.bg }]}>
//       <LinearGradient
//         colors={bgGradient as any}
//         start={{ x: 0, y: 0 }}
//         end={{ x: 0.85, y: 1 }}
//         style={StyleSheet.absoluteFill}
//       />

//       <View
//         pointerEvents="none"
//         style={[
//           styles.glow,
//           { top: -120, left: -80, backgroundColor: withAlpha(accent, 0.18) },
//         ]}
//       />
//       <View
//         pointerEvents="none"
//         style={[
//           styles.glow,
//           { top: 120, right: -90, backgroundColor: withAlpha(accent2, 0.16) },
//         ]}
//       />

//       {/* Header */}
//       <View style={{ paddingTop: topInset }}>
//         <BlurView
//           intensity={isDark ? 26 : 20}
//           tint={isDark ? "dark" : "light"}
//           style={[styles.headerBlur, { borderBottomColor: headerBorder }]}
//         >
//           <View style={[styles.headerRow, { paddingHorizontal: sidePad }]}>
//             <Pressable
//               onPress={() => router.back()}
//               style={({ pressed }) => [
//                 styles.backBtn,
//                 { backgroundColor: backPillBg, borderColor: backPillBorder },
//                 pressed && { opacity: 0.85 },
//               ]}
//               accessibilityRole="button"
//               accessibilityLabel="Back"
//             >
//               <Ionicons
//                 name="chevron-back"
//                 size={20}
//                 color={withAlpha(colors.text, isDark ? 0.9 : 0.82)}
//               />
//               <Text
//                 style={[
//                   styles.backText,
//                   { color: withAlpha(colors.text, isDark ? 0.9 : 0.92) },
//                 ]}
//               >
//                 Workouts
//               </Text>
//             </Pressable>

//             <View style={{ flex: 1, alignItems: "flex-end" }}>
//               <Pressable
//                 onPress={() => router.push("/workouts/session")}
//                 style={({ pressed }) => [
//                   styles.headerAction,
//                   { backgroundColor: backPillBg, borderColor: backPillBorder },
//                   pressed && { opacity: 0.9 },
//                 ]}
//                 accessibilityRole="button"
//                 accessibilityLabel="Open active session"
//               >
//                 <Ionicons
//                   name="play"
//                   size={16}
//                   color={withAlpha(colors.text, isDark ? 0.9 : 0.82)}
//                 />
//                 <Text
//                   style={[
//                     styles.headerActionText,
//                     { color: withAlpha(colors.text, isDark ? 0.9 : 0.92) },
//                   ]}
//                 >
//                   Session
//                 </Text>
//               </Pressable>
//             </View>
//           </View>
//         </BlurView>
//       </View>

//       <ScrollView
//         contentContainerStyle={{ padding: sidePad, paddingBottom: 30, gap: 14 }}
//         showsVerticalScrollIndicator={false}
//       >
//         <GlassCard intensity={isDark ? 30 : 22} style={{ borderRadius: 22 }}>
//           <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//             <Ionicons
//               name="time-outline"
//               size={20}
//               color={withAlpha(colors.text, isDark ? 0.9 : 0.82)}
//             />
//             <View style={{ flex: 1 }}>
//               <Text
//                 style={[
//                   styles.title,
//                   { color: withAlpha(colors.text, isDark ? 0.94 : 0.95) },
//                 ]}
//               >
//                 Workout history
//               </Text>
//               <Text
//                 style={[
//                   styles.subtitle,
//                   { color: withAlpha(colors.text, isDark ? 0.62 : 0.68) },
//                 ]}
//               >
//                 Glide through your logged entries, filter ranges, and spot PRs.
//               </Text>
//             </View>
//           </View>

//           <View
//             style={{
//               marginTop: 12,
//               flexDirection: "row",
//               gap: 8,
//               flexWrap: "wrap",
//             }}
//           >
//             <StatChip
//               icon="barbell-outline"
//               label={`${totals.workouts} workouts`}
//             />
//             <StatChip icon="layers-outline" label={`${totals.sets} sets`} />
//             <StatChip icon="ribbon-outline" label={`${totals.prCount} PRs`} />
//             <StatChip
//               icon="stats-chart-outline"
//               label={`${fmtCompact(totals.volume)} ${unit} vol`}
//             />
//           </View>
//         </GlassCard>

//         {/* Filter pills */}
//         <GlassCard intensity={isDark ? 26 : 20} style={{ borderRadius: 22 }}>
//           <Text
//             style={[
//               styles.sectionTitle,
//               { color: withAlpha(colors.text, isDark ? 0.88 : 0.9) },
//             ]}
//           >
//             Range
//           </Text>
//           <View
//             style={{
//               flexDirection: "row",
//               flexWrap: "wrap",
//               gap: 10,
//               marginTop: 10,
//             }}
//           >
//             <RowBtn
//               title="All"
//               active={preset === "all"}
//               onPress={() => setPreset("all")}
//             />
//             <RowBtn
//               title="Week"
//               active={preset === "week"}
//               onPress={() => setPreset("week")}
//             />
//             <RowBtn
//               title="7d"
//               active={preset === "7"}
//               onPress={() => setPreset("7")}
//             />
//             <RowBtn
//               title="Month"
//               active={preset === "month"}
//               onPress={() => setPreset("month")}
//             />
//             <RowBtn
//               title="30d"
//               active={preset === "30"}
//               onPress={() => setPreset("30")}
//             />
//           </View>

//           {!!from && !!to && (
//             <Text
//               style={{
//                 marginTop: 10,
//                 color: withAlpha(colors.text, isDark ? 0.6 : 0.65),
//                 fontWeight: "700",
//               }}
//             >
//               Showing: {from} → {to}
//             </Text>
//           )}
//         </GlassCard>

//         {/* Groups */}
//         {grouped.length === 0 ? (
//           <GlassCard intensity={isDark ? 24 : 18} style={{ borderRadius: 22 }}>
//             <Text
//               style={[
//                 styles.sectionTitle,
//                 { color: withAlpha(colors.text, isDark ? 0.88 : 0.9) },
//               ]}
//             >
//               No workouts yet
//             </Text>
//             <Text
//               style={{
//                 marginTop: 6,
//                 color: withAlpha(colors.text, isDark ? 0.62 : 0.68),
//                 fontWeight: "700",
//                 lineHeight: 18,
//               }}
//             >
//               Finish your first session and it’ll show up here.
//             </Text>
//           </GlassCard>
//         ) : (
//           <View style={{ gap: 12 }}>
//             {grouped.map((g) => {
//               const isCollapsed = collapsed[g.date] ?? false;
//               return (
//                 <GlassCard
//                   key={g.date}
//                   intensity={isDark ? 28 : 20}
//                   style={{ borderRadius: 22 }}
//                 >
//                   <Pressable
//                     onPress={() =>
//                       setCollapsed((c) => ({ ...c, [g.date]: !isCollapsed }))
//                     }
//                     style={({ pressed }) => [
//                       styles.groupHeader,
//                       pressed && { opacity: 0.92 },
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.groupDate,
//                         { color: withAlpha(colors.text, isDark ? 0.92 : 0.92) },
//                       ]}
//                     >
//                       {g.date}
//                     </Text>
//                     <View
//                       style={{
//                         flexDirection: "row",
//                         alignItems: "center",
//                         gap: 10,
//                       }}
//                     >
//                       <Text
//                         style={[
//                           styles.groupCount,
//                           {
//                             color: withAlpha(colors.text, isDark ? 0.62 : 0.65),
//                           },
//                         ]}
//                       >
//                         {g.items.length}
//                       </Text>
//                       <Ionicons
//                         name={isCollapsed ? "chevron-down" : "chevron-up"}
//                         size={16}
//                         color={withAlpha(colors.text, isDark ? 0.6 : 0.6)}
//                       />
//                     </View>
//                   </Pressable>

//                   {!isCollapsed ? (
//                     <View style={{ marginTop: 10, gap: 10 }}>
//                       {g.items.map((w) => {
//                         const pr = prFlags[w.id];
//                         const vol =
//                           Number(w.sets || 0) *
//                           Number(w.reps || 0) *
//                           Number(w.weight || 0);

//                         return (
//                           <Pressable
//                             key={w.id}
//                             onPress={() => startEdit(w)}
//                             onLongPress={() => removeWorkout(w.id)}
//                             style={({ pressed }) => [
//                               styles.row,
//                               {
//                                 backgroundColor: rowBg,
//                                 borderColor: rowBorder,
//                               },
//                               pressed && { opacity: 0.92 },
//                             ]}
//                           >
//                             <View style={{ flex: 1 }}>
//                               <View
//                                 style={{
//                                   flexDirection: "row",
//                                   alignItems: "center",
//                                   gap: 8,
//                                 }}
//                               >
//                                 <Text
//                                   style={[
//                                     styles.rowTitle,
//                                     {
//                                       color: withAlpha(
//                                         colors.text,
//                                         isDark ? 0.94 : 0.95
//                                       ),
//                                     },
//                                   ]}
//                                   numberOfLines={1}
//                                 >
//                                   {w.exercise || "Exercise"}
//                                 </Text>

//                                 {pr?.prWeight || pr?.prVolume ? (
//                                   <View style={styles.prBadge}>
//                                     <Ionicons
//                                       name="trophy"
//                                       size={14}
//                                       color={withAlpha("#111", 0.9)}
//                                     />
//                                     <Text style={styles.prText}>PR</Text>
//                                   </View>
//                                 ) : null}
//                               </View>

//                               <Text
//                                 style={[
//                                   styles.rowSub,
//                                   {
//                                     color: withAlpha(
//                                       colors.text,
//                                       isDark ? 0.62 : 0.68
//                                     ),
//                                   },
//                                 ]}
//                                 numberOfLines={1}
//                               >
//                                 {w.sets}×{w.reps} • {w.weight} {unit} • vol{" "}
//                                 {fmtCompact(vol)}
//                               </Text>

//                               {!!w.notes && (
//                                 <Text
//                                   style={[
//                                     styles.rowNotes,
//                                     {
//                                       color: withAlpha(
//                                         colors.text,
//                                         isDark ? 0.62 : 0.68
//                                       ),
//                                     },
//                                   ]}
//                                   numberOfLines={2}
//                                 >
//                                   {w.notes}
//                                 </Text>
//                               )}
//                             </View>

//                             <Ionicons
//                               name="chevron-forward"
//                               size={16}
//                               color={withAlpha(
//                                 colors.text,
//                                 isDark ? 0.55 : 0.55
//                               )}
//                             />
//                           </Pressable>
//                         );
//                       })}
//                     </View>
//                   ) : null}
//                 </GlassCard>
//               );
//             })}
//           </View>
//         )}
//       </ScrollView>

//       {/* Edit modal */}
//       <Modal
//         visible={!!editId}
//         animationType="fade"
//         transparent
//         onRequestClose={() => setEditId(null)}
//       >
//         <View
//           style={[styles.modalBackdrop, { backgroundColor: modalBackdrop }]}
//         >
//           <Pressable
//             style={StyleSheet.absoluteFill}
//             onPress={() => setEditId(null)}
//           />
//           <View style={styles.modalWrap}>
//             <GlassCard
//               intensity={isDark ? 42 : 26}
//               style={{ borderRadius: 22 }}
//             >
//               <Text
//                 style={[
//                   styles.modalTitle,
//                   { color: withAlpha(colors.text, isDark ? 0.94 : 0.95) },
//                 ]}
//               >
//                 Edit
//               </Text>
//               <Text
//                 style={[
//                   styles.modalSub,
//                   { color: withAlpha(colors.text, isDark ? 0.62 : 0.68) },
//                 ]}
//               >
//                 Tap save to update this entry.
//               </Text>

//               <View style={{ marginTop: 12, gap: 10 }}>
//                 <TextInput
//                   value={edit.exercise}
//                   onChangeText={(v) => setEdit((e) => ({ ...e, exercise: v }))}
//                   placeholder="Exercise"
//                   placeholderTextColor={withAlpha(colors.text, 0.45)}
//                   style={[
//                     styles.field,
//                     {
//                       backgroundColor: fieldBg,
//                       borderColor: fieldBorder,
//                       color: withAlpha(colors.text, isDark ? 0.92 : 0.92),
//                     },
//                   ]}
//                 />
//                 <View style={{ flexDirection: "row", gap: 10 }}>
//                   <TextInput
//                     value={edit.sets}
//                     onChangeText={(v) => setEdit((e) => ({ ...e, sets: v }))}
//                     placeholder="Sets"
//                     placeholderTextColor={withAlpha(colors.text, 0.45)}
//                     style={[
//                       styles.field,
//                       {
//                         flex: 1,
//                         backgroundColor: fieldBg,
//                         borderColor: fieldBorder,
//                         color: withAlpha(colors.text, isDark ? 0.92 : 0.92),
//                       },
//                     ]}
//                     keyboardType="number-pad"
//                   />
//                   <TextInput
//                     value={edit.reps}
//                     onChangeText={(v) => setEdit((e) => ({ ...e, reps: v }))}
//                     placeholder="Reps"
//                     placeholderTextColor={withAlpha(colors.text, 0.45)}
//                     style={[
//                       styles.field,
//                       {
//                         flex: 1,
//                         backgroundColor: fieldBg,
//                         borderColor: fieldBorder,
//                         color: withAlpha(colors.text, isDark ? 0.92 : 0.92),
//                       },
//                     ]}
//                     keyboardType="number-pad"
//                   />
//                   <TextInput
//                     value={edit.weight}
//                     onChangeText={(v) => setEdit((e) => ({ ...e, weight: v }))}
//                     placeholder={`Weight (${unit})`}
//                     placeholderTextColor={withAlpha(colors.text, 0.45)}
//                     style={[
//                       styles.field,
//                       {
//                         flex: 1,
//                         backgroundColor: fieldBg,
//                         borderColor: fieldBorder,
//                         color: withAlpha(colors.text, isDark ? 0.92 : 0.92),
//                       },
//                     ]}
//                     keyboardType="numeric"
//                   />
//                 </View>
//                 <TextInput
//                   value={edit.notes}
//                   onChangeText={(v) => setEdit((e) => ({ ...e, notes: v }))}
//                   placeholder="Notes"
//                   placeholderTextColor={withAlpha(colors.text, 0.45)}
//                   style={[
//                     styles.field,
//                     {
//                       backgroundColor: fieldBg,
//                       borderColor: fieldBorder,
//                       color: withAlpha(colors.text, isDark ? 0.92 : 0.92),
//                     },
//                   ]}
//                 />
//               </View>

//               <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
//                 <Pressable
//                   onPress={() => setEditId(null)}
//                   style={({ pressed }) => [
//                     styles.secondaryBtn,
//                     {
//                       backgroundColor: isDark
//                         ? withAlpha("#FFFFFF", 0.06)
//                         : withAlpha(colors.card, 0.9),
//                       borderColor: isDark
//                         ? withAlpha("#FFFFFF", 0.14)
//                         : withAlpha(colors.text, 0.12),
//                     },
//                     pressed && { opacity: 0.9 },
//                   ]}
//                 >
//                   <Text
//                     style={[
//                       styles.secondaryBtnText,
//                       { color: withAlpha(colors.text, isDark ? 0.86 : 0.9) },
//                     ]}
//                   >
//                     Cancel
//                   </Text>
//                 </Pressable>

//                 <Pressable
//                   onPress={saveEdit}
//                   style={({ pressed }) => [
//                     styles.primaryBtn,
//                     {
//                       backgroundColor: isDark
//                         ? withAlpha("#FFFFFF", 0.92)
//                         : withAlpha(colors.text, 0.92),
//                     },
//                     pressed && { opacity: 0.92 },
//                   ]}
//                 >
//                   <Text
//                     style={[
//                       styles.primaryBtnText,
//                       {
//                         color: isDark
//                           ? withAlpha("#111", 0.92)
//                           : withAlpha("#FFFFFF", 0.95),
//                       },
//                     ]}
//                   >
//                     Save
//                   </Text>
//                 </Pressable>
//               </View>

//               <Pressable
//                 onPress={() => {
//                   const id = editId!;
//                   setEditId(null);
//                   removeWorkout(id);
//                 }}
//                 style={({ pressed }) => [
//                   styles.dangerBtn,
//                   pressed && { opacity: 0.92 },
//                 ]}
//               >
//                 <Ionicons
//                   name="trash-outline"
//                   size={16}
//                   color={withAlpha("#FFFFFF", 0.9)}
//                 />
//                 <Text style={styles.dangerText}>Delete</Text>
//               </Pressable>
//             </GlassCard>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root: { flex: 1 },
//   glow: { position: "absolute", width: 260, height: 260, borderRadius: 260 },

//   headerBlur: {
//     borderBottomWidth: StyleSheet.hairlineWidth,
//   },
//   headerRow: {
//     paddingTop: 12,
//     paddingBottom: 10,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   backBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     borderRadius: 999,
//     borderWidth: StyleSheet.hairlineWidth,
//   },
//   backText: { fontWeight: "900" },

//   headerAction: {
//     height: 40,
//     paddingHorizontal: 12,
//     borderRadius: 999,
//     borderWidth: StyleSheet.hairlineWidth,
//     alignItems: "center",
//     justifyContent: "center",
//     flexDirection: "row",
//     gap: 8,
//   },
//   headerActionText: { fontWeight: "900" },

//   cardWrap: {
//     borderRadius: 18,
//     overflow: "hidden",
//     borderWidth: StyleSheet.hairlineWidth,
//   },
//   cardBorder: {
//     ...StyleSheet.absoluteFill,
//     borderRadius: 18,
//     borderWidth: StyleSheet.hairlineWidth,
//     zIndex: 2,
//   },
//   cardBlur: { borderRadius: 18, overflow: "hidden" },
//   cardInner: { padding: 14 },

//   title: {
//     fontSize: 18,
//     fontWeight: "900",
//     letterSpacing: -0.2,
//   },
//   subtitle: {
//     marginTop: 4,
//     fontWeight: "700",
//     lineHeight: 18,
//   },

//   sectionTitle: { fontWeight: "900" },

//   statChip: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 7,
//     borderRadius: 999,
//     borderWidth: StyleSheet.hairlineWidth,
//   },
//   statChipText: {
//     fontSize: 12,
//     fontWeight: "800",
//   },

//   filterPill: {
//     paddingHorizontal: 12,
//     paddingVertical: 9,
//     borderRadius: 999,
//     borderWidth: StyleSheet.hairlineWidth,
//   },
//   filterPillText: { fontWeight: "900" },

//   groupHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   groupDate: { fontWeight: "900", fontSize: 14 },
//   groupCount: { fontWeight: "900" },

//   row: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 12,
//     padding: 12,
//     borderRadius: 16,
//     borderWidth: StyleSheet.hairlineWidth,
//   },
//   rowTitle: { fontWeight: "900", fontSize: 14, letterSpacing: -0.1 },
//   rowSub: { marginTop: 4, fontWeight: "700", fontSize: 12 },
//   rowNotes: { marginTop: 4, fontWeight: "700", fontSize: 12, lineHeight: 16 },

//   prBadge: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     paddingHorizontal: 10,
//     paddingVertical: 7,
//     borderRadius: 999,
//     backgroundColor: withAlpha("#FFD66B", 0.92),
//   },
//   prText: { color: withAlpha("#111", 0.9), fontSize: 12, fontWeight: "900" },

//   modalBackdrop: { flex: 1 },
//   modalWrap: {
//     flex: 1,
//     justifyContent: "flex-end",
//     padding: 14,
//     paddingBottom: 16,
//   },
//   modalTitle: { fontWeight: "900", fontSize: 16 },
//   modalSub: { marginTop: 6, fontWeight: "700" },

//   field: {
//     height: 44,
//     borderRadius: 14,
//     paddingHorizontal: 12,
//     borderWidth: StyleSheet.hairlineWidth,
//     fontWeight: "900",
//   },

//   primaryBtn: {
//     flex: 1,
//     height: 46,
//     borderRadius: 16,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   primaryBtnText: { fontWeight: "900" },

//   secondaryBtn: {
//     flex: 1,
//     height: 46,
//     borderRadius: 16,
//     borderWidth: StyleSheet.hairlineWidth,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   secondaryBtnText: { fontWeight: "900" },

//   dangerBtn: {
//     marginTop: 10,
//     height: 46,
//     borderRadius: 16,
//     backgroundColor: withAlpha("#FF5A5F", 0.16),
//     borderWidth: StyleSheet.hairlineWidth,
//     borderColor: withAlpha("#FF5A5F", 0.35),
//     alignItems: "center",
//     justifyContent: "center",
//     flexDirection: "row",
//     gap: 8,
//   },
//   dangerText: { color: withAlpha("#FFFFFF", 0.92), fontWeight: "900" },
// });

// app/workouts/history.tsx
// Premium Workout History (Apple-inspired glossy dark UI)
// Drop-in replacement ✅
//
// Depends on: expo-router, expo-blur, expo-linear-gradient, expo-haptics, react-native-reanimated
// Uses your existing backend: subscribeWorkouts(uid, cb, { from, to, max })
//
// Navigation: pushes to /workouts/recap?sessionKey=...
// (Matches the recap screen sessionKey logic: "session:<id>" or "auto:<date>:<n>")

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
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  TextInput,
  SectionList,
  Modal,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOut,
  Layout,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "@/content/AuthContext";
import { useTheme } from "@/content/ThemeProvider";
import { subscribeWorkouts, type Workout } from "@/services/workouts";

// ----------------- helpers -----------------

const withAlpha = (hex: string, a: number) => {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
};

function createdAtMs(x: any) {
  const t = x?.setCreatedAt ?? x?.createdAt ?? x?.sessionStartedAt;
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  return Number(t) || 0;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isISO(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function endOfToday(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysAgo(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
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
function fmtDateNice(iso: string) {
  if (!isISO(iso)) return iso || "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtCompact(n: number) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`;
  return String(Math.round(n));
}
function volumeKg(sets: number, reps: number, weightKg: number) {
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weightKg);
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

function dateMsFromISO(iso: string) {
  if (!iso || !isISO(iso)) return 0;
  return new Date(`${iso}T00:00:00`).getTime();
}

function buildSessionBuckets(all: WorkoutRow[]) {
  const rows = (all || []).slice();
  const gapMs = 1000 * 60 * 120;

  rows.sort((a, b) => {
    const ad = (a as any).date || "";
    const bd = (b as any).date || "";
    if (ad !== bd) return bd.localeCompare(ad);
    return createdAtMs(b) - createdAtMs(a);
  });

  const buckets = new Map<string, SessionBucket>();
  const autoBucketsByDate = new Map<string, SessionBucket[]>();

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
      createdAtMs(r) ||
      dateMsFromISO(dateISO) ||
      undefined;
    const createdMs = createdAtMs(r) || startedAt || 0;

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
      const bucket: SessionBucket = {
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

  return Array.from(buckets.values()).sort((a, b) => {
    const at = a.latestAt || a.startedAt || createdAtMs(a.rows[0]) || 0;
    const bt = b.latestAt || b.startedAt || createdAtMs(b.rows[0]) || 0;
    return bt - at;
  });
}

// PR flags (range-local) – uses your old logic style (best-by-exercise across list)
function computePrFlags(all: Workout[]) {
  const list = all
    .slice()
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        ((a.createdAt as any)?.toMillis?.() ?? (a.createdAt as any) ?? 0) -
          ((b.createdAt as any)?.toMillis?.() ?? (b.createdAt as any) ?? 0)
    );

  const bestByExercise = new Map<string, { weight: number; volume: number }>();
  const flags: Record<string, { prWeight: boolean; prVolume: boolean }> = {};
  for (const w of list) {
    const ex = (w.exercise || "").trim().toLowerCase();
    const prev = bestByExercise.get(ex) || { weight: 0, volume: 0 };
    const isPRw = Number(w.weight || 0) > prev.weight;
    const vol =
      Number(w.sets || 0) * Number(w.reps || 0) * Number(w.weight || 0);
    const isPRv = vol > prev.volume;
    flags[w.id] = { prWeight: isPRw, prVolume: isPRv };
    bestByExercise.set(ex, {
      weight: Math.max(prev.weight, Number(w.weight || 0)),
      volume: Math.max(prev.volume, vol),
    });
  }
  return flags;
}

function usePressScale() {
  const s = useSharedValue(1);
  const onPressIn = () => {
    s.value = withSpring(0.985, { damping: 18, stiffness: 260 });
  };
  const onPressOut = () => {
    s.value = withSpring(1, { damping: 18, stiffness: 260 });
  };
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));
  return { style, onPressIn, onPressOut };
}

const HAPTIC_LIGHT = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const HAPTIC_SOFT = () => {
  const anyHaptics: any = Haptics;
  const soft = anyHaptics?.ImpactFeedbackStyle?.Soft;
  Haptics.impactAsync(soft ?? Haptics.ImpactFeedbackStyle.Light).catch(
    () => {}
  );
};

// ----------------- filtering -----------------

type Preset = "today" | "week" | "month" | "90d" | "all";

function computeRangeFromPreset(p: Preset) {
  const today = endOfToday(new Date());
  if (p === "all") return { from: "", to: "" };
  if (p === "today") {
    const iso = fmtISO(today);
    return { from: iso, to: iso };
  }
  if (p === "week") {
    const s = daysAgo(today, 6);
    return { from: fmtISO(s), to: fmtISO(today) };
  }
  if (p === "month") {
    return { from: fmtISO(startOfMonth(today)), to: fmtISO(today) };
  }
  // 90d
  {
    const s = daysAgo(today, 89);
    return { from: fmtISO(s), to: fmtISO(today) };
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabel(key: string) {
  // key YYYY-MM
  const [y, m] = key.split("-").map((x) => Number(x));
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function monthRange(key: string) {
  const [y, m] = key.split("-").map((x) => Number(x));
  const start = new Date(y, (m || 1) - 1, 1);
  const end = endOfMonth(start);
  const today = endOfToday(new Date());
  const endClamped = end > today ? today : end;
  return { from: fmtISO(start), to: fmtISO(endClamped) };
}

// ----------------- Screen -----------------

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  useLocalSearchParams<{ focus?: string }>();

  const { user } = useAuth();
  const uid = user?.uid;

  const { colors, isDark } = useTheme();

  const accent = colors.primary ?? "#68D7FF";
  const accent2 = "#8B7CFF";
  const gold = "#FFD66B";
  const hot = "#FF4FD8";

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState<string>(
    () => computeRangeFromPreset("month").from
  );
  const [to, setTo] = useState<string>(
    () => computeRangeFromPreset("month").to
  );

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const firstLoadRef = useRef(false);

  useEffect(() => {
    const r = computeRangeFromPreset(preset);
    setFrom(r.from);
    setTo(r.to);
  }, [preset]);

  useEffect(() => {
    if (from && to && from > to) setTo("");
  }, [from, to]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    return subscribeWorkouts(
      uid,
      (rows: Workout[]) => {
        setWorkouts((rows || []) as WorkoutRow[]);
        setLoading(false);
        firstLoadRef.current = true;
      },
      { from, to, max: 1500 }
    );
  }, [uid, from, to]);

  const prFlags = useMemo(() => computePrFlags(workouts), [workouts]);

  // Sessions derived from rows in performed order (latest first by buildSessionBuckets)
  const sessions = useMemo(() => {
    const list = buildSessionBuckets(workouts);

    const q = query.trim().toLowerCase();
    if (!q) return list;

    // Search by session title OR any exercise name inside rows
    return list.filter((s) => {
      const t = (s.title || "").toLowerCase();
      if (t.includes(q)) return true;
      for (const r of s.rows) {
        const ex = String((r as any).exercise || "").toLowerCase();
        if (ex.includes(q)) return true;
      }
      return false;
    });
  }, [workouts, query]);

  // Sections grouped by date
  const sections = useMemo(() => {
    const byDate = new Map<string, SessionBucket[]>();
    for (const s of sessions) {
      const d = s.dateISO || "Unknown date";
      const arr = byDate.get(d) || [];
      arr.push(s);
      byDate.set(d, arr);
    }

    const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
    return dates.map((d) => ({
      title: d,
      data: (byDate.get(d) || []).sort((a, b) => {
        const at = a.latestAt || a.startedAt || createdAtMs(a.rows[0]) || 0;
        const bt = b.latestAt || b.startedAt || createdAtMs(b.rows[0]) || 0;
        return bt - at;
      }),
    }));
  }, [sessions]);

  const totals = useMemo(() => {
    let setSum = 0;
    let vol = 0;
    const exSet = new Set<string>();
    let pr = 0;

    for (const w of workouts) {
      const s = Number((w as any).sets || 0);
      const r = Number((w as any).reps || 0);
      const wt = Number((w as any).weight || 0);
      setSum += s;
      vol += volumeKg(s, r, wt);
      const ex = String((w as any).exercise || "")
        .trim()
        .toLowerCase();
      if (ex) exSet.add(ex);

      const f = prFlags[(w as any).id];
      if (f?.prWeight || f?.prVolume) pr++;
    }

    return {
      sessions: sessions.length,
      sets: setSum,
      volume: Math.round(vol),
      exercises: exSet.size,
      prs: pr,
    };
  }, [workouts, prFlags, sessions.length]);

  // Theme tokens
  const bgGradient = isDark
    ? ["#050710", "#040513", "#02030A"]
    : [
        withAlpha(accent, 0.12),
        withAlpha("#FFFFFF", 0.92),
        withAlpha("#FFFFFF", 0.88),
      ];

  const headerBorder = withAlpha(colors.text, isDark ? 0.12 : 0.08);
  const glassBg = isDark
    ? withAlpha("#FFFFFF", 0.06)
    : withAlpha("#FFFFFF", 0.82);
  const glassBorder = isDark
    ? withAlpha("#FFFFFF", 0.14)
    : withAlpha(colors.text, 0.1);

  const cardBg = isDark
    ? withAlpha("#FFFFFF", 0.05)
    : withAlpha("#FFFFFF", 0.88);
  const cardBorder = isDark
    ? withAlpha("#FFFFFF", 0.12)
    : withAlpha(colors.text, 0.08);

  const pillBg = isDark
    ? withAlpha("#FFFFFF", 0.06)
    : withAlpha("#FFFFFF", 0.86);
  const pillBorder = isDark
    ? withAlpha("#FFFFFF", 0.14)
    : withAlpha(colors.text, 0.1);

  const textStrong = isDark ? withAlpha("#FFFFFF", 0.94) : colors.text;
  const textMuted = withAlpha(colors.text, isDark ? 0.58 : 0.62);
  const textMid = withAlpha(colors.text, isDark ? 0.7 : 0.76);

  const rangeLabel = useMemo(() => {
    if (!from && !to) return "All time";
    if (from && to && from === to) return fmtDateNice(from);
    if (from && to) return `${from} → ${to}`;
    if (from && !to) return `From ${from}`;
    if (!from && to) return `Until ${to}`;
    return "";
  }, [from, to]);

  const clearSearch = useCallback(() => {
    HAPTIC_SOFT();
    setQuery("");
    Keyboard.dismiss();
  }, []);

  const goRecap = useCallback(
    (sessionKey: string) => {
      HAPTIC_LIGHT();
      router.push({
        pathname: "/workouts/recap",
        params: { sessionKey },
      } as any);
    },
    [router]
  );

  const applyMonth = useCallback((key: string) => {
    HAPTIC_SOFT();
    const r = monthRange(key);
    setPreset("all"); // keep preset visually neutral when explicit range selected
    setFrom(r.from);
    setTo(r.to);
    setMonthPickerOpen(false);
  }, []);

  const applyCustomRange = useCallback((r: { from: string; to: string }) => {
    HAPTIC_SOFT();
    setPreset("all");
    setFrom(r.from);
    setTo(r.to);
    setCustomOpen(false);
  }, []);

  const headerHeight = 64;

  const renderSectionHeader = useCallback(
    ({ section }: any) => (
      <View style={styles.sectionHeaderWrap}>
        <View
          style={[
            styles.sectionHeaderPill,
            { backgroundColor: pillBg, borderColor: pillBorder },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={withAlpha(colors.text, isDark ? 0.8 : 0.72)}
          />
          <Text style={[styles.sectionHeaderText, { color: textStrong }]}>
            {fmtDateNice(section.title)}
          </Text>
          <Text style={[styles.sectionHeaderCount, { color: textMuted }]}>
            {section.data.length}
          </Text>
        </View>
      </View>
    ),
    [pillBg, pillBorder, colors.text, isDark, textStrong, textMuted]
  );

  const keyExtractor = useCallback((item: SessionBucket) => item.key, []);

  const renderItem = useCallback(
    ({ item, index, section }: any) => {
      // compute session highlights fast (memo-ish within render)
      const rows = (item.rows || [])
        .slice()
        .sort((a: SessionBucket, b: SessionBucket) => {
          const at = a.latestAt || a.startedAt || createdAtMs(a.rows?.[0]) || 0;
          const bt = b.latestAt || b.startedAt || createdAtMs(b.rows?.[0]) || 0;
          return bt - at;
        });
      const first = rows[0];
      const last = rows[rows.length - 1];

      const start = Number((item as any).startedAt || 0) || createdAtMs(first);
      const end = createdAtMs(last) || start;

      const durationMin =
        start && end && end >= start
          ? Math.max(1, Math.round((end - start) / 60000))
          : 0;

      const exSet = new Set<string>();
      let sets = 0;
      let vol = 0;
      let prCount = 0;

      for (const r of rows) {
        exSet.add(String((r as any).exercise || "Exercise"));
        const s = Number((r as any).sets || 0);
        const rep = Number((r as any).reps || 0);
        const wt = Number((r as any).weight || 0);
        sets += s;
        vol += volumeKg(s, rep, wt);

        const f = prFlags[(r as any).id];
        if (f?.prWeight || f?.prVolume) prCount++;
      }

      const timeLabel = start ? fmtTime(start) : "";
      const exerciseCount = exSet.size;

      return (
        <SessionCard
          key={item.key}
          title={item.title || "Workout"}
          timeLabel={timeLabel}
          durationMin={durationMin}
          exerciseCount={exerciseCount}
          sets={sets}
          volume={Math.round(vol)}
          prCount={prCount}
          onPress={() => goRecap(item.key)}
          isDark={isDark}
          textStrong={textStrong}
          textMuted={textMuted}
          textMid={textMid}
          cardBg={cardBg}
          cardBorder={cardBorder}
          pillBg={pillBg}
          pillBorder={pillBorder}
          accent={accent}
          accent2={accent2}
          gold={gold}
          hot={hot}
          index={index}
        />
      );
    },
    [
      prFlags,
      goRecap,
      isDark,
      textStrong,
      textMuted,
      textMid,
      cardBg,
      cardBorder,
      pillBg,
      pillBorder,
      accent,
      accent2,
      gold,
      hot,
    ]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={bgGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* soft glows */}
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            top: -140,
            left: -110,
            backgroundColor: withAlpha(accent, isDark ? 0.18 : 0.14),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            top: 140,
            right: -120,
            backgroundColor: withAlpha(accent2, isDark ? 0.16 : 0.12),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowSm,
          {
            bottom: 40,
            left: 40,
            backgroundColor: withAlpha(hot, isDark ? 0.1 : 0.08),
          },
        ]}
      />

      {/* Header */}
      <View style={{ paddingTop: topInset }}>
        <BlurView
          intensity={isDark ? 30 : 22}
          tint={isDark ? "dark" : "light"}
          style={[styles.headerBlur, { borderBottomColor: headerBorder }]}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                HAPTIC_LIGHT();
                router.back();
              }}
              style={({ pressed }) => [
                styles.backBtn,
                { backgroundColor: pillBg, borderColor: pillBorder },
                pressed && { opacity: 0.86 },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={withAlpha(colors.text, isDark ? 0.9 : 0.8)}
              />
              <Text style={[styles.backText, { color: textStrong }]}>
                Workouts
              </Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text
                style={[styles.title, { color: textStrong }]}
                numberOfLines={1}
              >
                History
              </Text>
              <Text
                style={[styles.subtitle, { color: textMuted }]}
                numberOfLines={1}
              >
                {rangeLabel}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                HAPTIC_LIGHT();
                setCustomOpen(true);
              }}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { backgroundColor: pillBg, borderColor: pillBorder },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityLabel="Custom range"
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={withAlpha(colors.text, isDark ? 0.86 : 0.78)}
              />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchPill,
                { backgroundColor: pillBg, borderColor: pillBorder },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={16}
                color={withAlpha(colors.text, isDark ? 0.72 : 0.66)}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search workout or exercise…"
                placeholderTextColor={withAlpha(
                  colors.text,
                  isDark ? 0.42 : 0.45
                )}
                style={[styles.searchInput, { color: textStrong }]}
                returnKeyType="search"
              />
              {!!query && (
                <Pressable
                  onPress={clearSearch}
                  style={({ pressed }) => [
                    styles.clearBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={withAlpha(colors.text, isDark ? 0.7 : 0.62)}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* Range pills */}
          <View style={styles.rangeRow}>
            <RangePill
              title="Today"
              active={preset === "today" && !monthPickerOpen && !customOpen}
              onPress={() => {
                HAPTIC_SOFT();
                setPreset("today");
              }}
              isDark={isDark}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textStrong={textStrong}
              colorsText={colors.text}
            />
            <RangePill
              title="Week"
              active={preset === "week"}
              onPress={() => {
                HAPTIC_SOFT();
                setPreset("week");
              }}
              isDark={isDark}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textStrong={textStrong}
              colorsText={colors.text}
            />
            <RangePill
              title="Month"
              active={preset === "month"}
              onPress={() => {
                HAPTIC_SOFT();
                setPreset("month");
              }}
              isDark={isDark}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textStrong={textStrong}
              colorsText={colors.text}
            />
            <RangePill
              title="90d"
              active={preset === "90d"}
              onPress={() => {
                HAPTIC_SOFT();
                setPreset("90d");
              }}
              isDark={isDark}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textStrong={textStrong}
              colorsText={colors.text}
            />
            <RangePill
              title="All"
              active={preset === "all" && !from && !to}
              onPress={() => {
                HAPTIC_SOFT();
                setPreset("all");
              }}
              isDark={isDark}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textStrong={textStrong}
              colorsText={colors.text}
            />

            <Pressable
              onPress={() => {
                HAPTIC_SOFT();
                setMonthPickerOpen(true);
              }}
              style={({ pressed }) => [
                styles.monthBtn,
                { backgroundColor: pillBg, borderColor: pillBorder },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityLabel="Month picker"
            >
              <Ionicons
                name="calendar"
                size={14}
                color={withAlpha(accent, 0.95)}
              />
              <Text style={[styles.monthBtnText, { color: textStrong }]}>
                Pick
              </Text>
            </Pressable>
          </View>

          {/* quick totals */}
          <View style={styles.totalsRow}>
            <MiniChip
              icon="time-outline"
              label={`${totals.sessions} workouts`}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textMuted={textMuted}
              textStrong={textStrong}
              isDark={isDark}
              colorsText={colors.text}
            />
            <MiniChip
              icon="layers-outline"
              label={`${totals.sets} sets`}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textMuted={textMuted}
              textStrong={textStrong}
              isDark={isDark}
              colorsText={colors.text}
            />
            <MiniChip
              icon="pulse-outline"
              label={`${fmtCompact(totals.volume)} kg vol`}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textMuted={textMuted}
              textStrong={textStrong}
              isDark={isDark}
              colorsText={colors.text}
            />
            <MiniChip
              icon="trophy-outline"
              label={`${totals.prs} PRs`}
              pillBg={pillBg}
              pillBorder={pillBorder}
              textMuted={textMuted}
              textStrong={textStrong}
              isDark={isDark}
              colorsText={colors.text}
            />
          </View>
        </BlurView>
      </View>

      {/* List */}
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // performance knobs
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        windowSize={12}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={
          <View style={{ marginTop: 10 }}>
            {loading ? (
              <LoadingCard
                isDark={isDark}
                glassBg={glassBg}
                glassBorder={glassBorder}
                textStrong={textStrong}
                textMuted={textMuted}
              />
            ) : (
              <EmptyCard
                isDark={isDark}
                glassBg={glassBg}
                glassBorder={glassBorder}
                textStrong={textStrong}
                textMuted={textMuted}
                hasQuery={!!query.trim()}
              />
            )}
          </View>
        }
      />

      {/* Month Picker */}
      <MonthPickerModal
        visible={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        onPick={applyMonth}
        isDark={isDark}
        glassBg={glassBg}
        glassBorder={glassBorder}
        pillBg={pillBg}
        pillBorder={pillBorder}
        textStrong={textStrong}
        textMuted={textMuted}
        accent={accent}
      />

      {/* Custom Range */}
      <CustomRangeModal
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        onApply={applyCustomRange}
        initialFrom={from}
        initialTo={to}
        isDark={isDark}
        glassBg={glassBg}
        glassBorder={glassBorder}
        pillBg={pillBg}
        pillBorder={pillBorder}
        textStrong={textStrong}
        textMuted={textMuted}
        accent={accent}
        accent2={accent2}
      />
    </View>
  );
}

// ----------------- Components -----------------

function RangePill(props: {
  title: string;
  active: boolean;
  onPress: () => void;
  isDark: boolean;
  pillBg: string;
  pillBorder: string;
  textStrong: string;
  colorsText: string;
}) {
  const bg = props.active
    ? props.isDark
      ? withAlpha("#FFFFFF", 0.92)
      : withAlpha(props.colorsText, 0.92)
    : props.pillBg;

  const border = props.active ? bg : props.pillBorder;

  const text = props.active
    ? props.isDark
      ? withAlpha("#111111", 0.92)
      : withAlpha("#FFFFFF", 0.95)
    : props.textStrong;

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.rangePill,
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.rangePillText, { color: text }]}>{props.title}</Text>
    </Pressable>
  );
}

function MiniChip(props: {
  icon: any;
  label: string;
  pillBg: string;
  pillBorder: string;
  textMuted: string;
  textStrong: string;
  isDark: boolean;
  colorsText: string;
}) {
  return (
    <View
      style={[
        styles.miniChip,
        { backgroundColor: props.pillBg, borderColor: props.pillBorder },
      ]}
    >
      <Ionicons
        name={props.icon}
        size={14}
        color={withAlpha(props.colorsText, props.isDark ? 0.78 : 0.72)}
      />
      <Text
        style={[
          styles.miniChipText,
          { color: withAlpha(props.textStrong, props.isDark ? 0.88 : 0.84) },
        ]}
      >
        {props.label}
      </Text>
    </View>
  );
}

function SessionCard(props: {
  title: string;
  timeLabel: string;
  durationMin: number;
  exerciseCount: number;
  sets: number;
  volume: number;
  prCount: number;
  onPress: () => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  textMid: string;
  cardBg: string;
  cardBorder: string;
  pillBg: string;
  pillBorder: string;
  accent: string;
  accent2: string;
  gold: string;
  hot: string;
  index: number;
}) {
  const press = usePressScale();
  const shimmer = useSharedValue(0);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  const prTone =
    props.prCount >= 2
      ? props.hot
      : props.prCount === 1
      ? props.gold
      : props.accent;

  const onPress = () => {
    shimmer.value = withTiming(1, { duration: 90 }, () => {
      shimmer.value = withTiming(0, { duration: 240 });
    });
    props.onPress();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(240).delay(Math.min(140, props.index * 14))}
      layout={LinearTransition.springify().damping(18).stiffness(220)}
      style={{ marginBottom: 10 }}
    >
      <Animated.View style={press.style}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            press.onPressIn();
            HAPTIC_LIGHT();
          }}
          onPressOut={press.onPressOut}
          style={({ pressed }) => [
            styles.sessionCard,
            { backgroundColor: props.cardBg, borderColor: props.cardBorder },
            pressed && { opacity: 0.92 },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.cardGlow,
              {
                backgroundColor: withAlpha(prTone, props.isDark ? 0.18 : 0.12),
              },
              shimmerStyle,
            ]}
          />

          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.sessionTitle, { color: props.textStrong }]}
                numberOfLines={1}
              >
                {props.title}
              </Text>
              <Text
                style={[styles.sessionSub, { color: props.textMuted }]}
                numberOfLines={1}
              >
                {props.timeLabel ? props.timeLabel : "—"}
                {props.durationMin ? ` • ${props.durationMin} min` : ""}
              </Text>
            </View>

            {!!props.prCount && (
              <View
                style={[
                  styles.prBadge,
                  {
                    backgroundColor: withAlpha(
                      prTone,
                      props.isDark ? 0.14 : 0.1
                    ),
                    borderColor: withAlpha(prTone, props.isDark ? 0.28 : 0.18),
                  },
                ]}
              >
                <Ionicons
                  name="trophy-outline"
                  size={14}
                  color={withAlpha(prTone, 0.95)}
                />
                <Text
                  style={[
                    styles.prBadgeText,
                    {
                      color: withAlpha(
                        props.textStrong,
                        props.isDark ? 0.88 : 0.84
                      ),
                    },
                  ]}
                >
                  {props.prCount}
                </Text>
              </View>
            )}

            <Ionicons
              name="chevron-forward"
              size={16}
              color={withAlpha(props.textMuted, props.isDark ? 0.85 : 0.72)}
            />
          </View>

          <View style={styles.cardChipsRow}>
            <CardChip
              icon="barbell-outline"
              label={`${props.exerciseCount} ex`}
              pillBg={props.pillBg}
              pillBorder={props.pillBorder}
              text={props.textMid}
              isDark={props.isDark}
            />
            <CardChip
              icon="layers-outline"
              label={`${props.sets} sets`}
              pillBg={props.pillBg}
              pillBorder={props.pillBorder}
              text={props.textMid}
              isDark={props.isDark}
            />
            <CardChip
              icon="pulse-outline"
              label={`${fmtCompact(props.volume)} kg`}
              pillBg={props.pillBg}
              pillBorder={props.pillBorder}
              text={props.textMid}
              isDark={props.isDark}
            />
            <CardChip
              icon="sparkles-outline"
              label={props.prCount ? "Highlights" : "Clean"}
              pillBg={props.pillBg}
              pillBorder={props.pillBorder}
              text={props.textMid}
              isDark={props.isDark}
              accent={props.prCount ? prTone : undefined}
            />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function CardChip(props: {
  icon: any;
  label: string;
  pillBg: string;
  pillBorder: string;
  text: string;
  isDark: boolean;
  accent?: string;
}) {
  const iconColor = props.accent
    ? withAlpha(props.accent, 0.95)
    : withAlpha(props.text, props.isDark ? 0.95 : 0.9);

  return (
    <View
      style={[
        styles.cardChip,
        { backgroundColor: props.pillBg, borderColor: props.pillBorder },
      ]}
    >
      <Ionicons name={props.icon} size={13} color={iconColor} />
      <Text style={[styles.cardChipText, { color: props.text }]}>
        {props.label}
      </Text>
    </View>
  );
}

function LoadingCard(props: {
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  textStrong: string;
  textMuted: string;
}) {
  return (
    <View
      style={[
        styles.edgeCard,
        { backgroundColor: props.glassBg, borderColor: props.glassBorder },
      ]}
    >
      <Ionicons
        name="cloud-download-outline"
        size={18}
        color={withAlpha("#8B7CFF", 0.9)}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.edgeTitle, { color: props.textStrong }]}>
          Loading history…
        </Text>
        <Text style={[styles.edgeSub, { color: props.textMuted }]}>
          Pulling your sessions with high-performance rendering.
        </Text>
      </View>
    </View>
  );
}

function EmptyCard(props: {
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  textStrong: string;
  textMuted: string;
  hasQuery: boolean;
}) {
  return (
    <View
      style={[
        styles.edgeCard,
        { backgroundColor: props.glassBg, borderColor: props.glassBorder },
      ]}
    >
      <Ionicons
        name={props.hasQuery ? "search-outline" : "file-tray-outline"}
        size={18}
        color={withAlpha("#68D7FF", 0.9)}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.edgeTitle, { color: props.textStrong }]}>
          {props.hasQuery ? "No matches" : "No workouts yet"}
        </Text>
        <Text style={[styles.edgeSub, { color: props.textMuted }]}>
          {props.hasQuery
            ? "Try a different workout name or exercise."
            : "Log a session and it will show up here."}
        </Text>
      </View>
    </View>
  );
}

function MonthPickerModal(props: {
  visible: boolean;
  onClose: () => void;
  onPick: (monthKey: string) => void;
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  pillBg: string;
  pillBorder: string;
  textStrong: string;
  textMuted: string;
  accent: string;
}) {
  const months = useMemo(() => {
    // last 18 months (including current)
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(monthKey(d));
    }
    return out;
  }, []);

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} />
        <View style={styles.modalSheetWrap}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: props.glassBg,
                borderColor: props.glassBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: props.textStrong }]}>
                Pick a month
              </Text>
              <Pressable
                onPress={props.onClose}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={withAlpha(props.textStrong, props.isDark ? 0.9 : 0.8)}
                />
              </Pressable>
            </View>
            <Text style={[styles.modalSub, { color: props.textMuted }]}>
              Jumps to the month range instantly.
            </Text>

            <View style={styles.monthGrid}>
              {months.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => props.onPick(m)}
                  style={({ pressed }) => [
                    styles.monthCell,
                    {
                      backgroundColor: props.pillBg,
                      borderColor: props.pillBorder,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={withAlpha(props.accent, 0.95)}
                  />
                  <Text
                    style={[styles.monthCellText, { color: props.textStrong }]}
                    numberOfLines={1}
                  >
                    {monthLabel(m)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CustomRangeModal(props: {
  visible: boolean;
  onClose: () => void;
  onApply: (r: { from: string; to: string }) => void;
  initialFrom: string;
  initialTo: string;
  isDark: boolean;
  glassBg: string;
  glassBorder: string;
  pillBg: string;
  pillBorder: string;
  textStrong: string;
  textMuted: string;
  accent: string;
  accent2: string;
}) {
  const [from, setFrom] = useState(props.initialFrom || "");
  const [to, setTo] = useState(props.initialTo || "");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (props.visible) {
      setFrom(props.initialFrom || "");
      setTo(props.initialTo || "");
      setErr("");
    }
  }, [props.visible, props.initialFrom, props.initialTo]);

  const validate = () => {
    const f = from.trim();
    const t = to.trim();
    if (f && !isISO(f)) return "From must be YYYY-MM-DD";
    if (t && !isISO(t)) return "To must be YYYY-MM-DD";
    if (f && t && f > t) return "From must be before To";
    return "";
  };

  const quick = (key: Preset) => {
    HAPTIC_SOFT();
    const r = computeRangeFromPreset(key);
    setFrom(r.from);
    setTo(r.to);
    setErr("");
  };

  const apply = () => {
    const e = validate();
    if (e) {
      HAPTIC_LIGHT();
      setErr(e);
      return;
    }
    props.onApply({ from: from.trim(), to: to.trim() });
  };

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} />
        <View style={styles.modalSheetWrap}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: props.glassBg,
                borderColor: props.glassBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: props.textStrong }]}>
                Custom range
              </Text>
              <Pressable
                onPress={props.onClose}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={withAlpha(props.textStrong, props.isDark ? 0.9 : 0.8)}
                />
              </Pressable>
            </View>
            <Text style={[styles.modalSub, { color: props.textMuted }]}>
              Use ISO dates. Leave blank for open-ended.
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: props.textMuted }]}>
                  From
                </Text>
                <View
                  style={[
                    styles.field,
                    {
                      backgroundColor: props.pillBg,
                      borderColor: props.pillBorder,
                    },
                  ]}
                >
                  <TextInput
                    value={from}
                    onChangeText={(v) => {
                      setFrom(v);
                      setErr("");
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={withAlpha(
                      props.textStrong,
                      props.isDark ? 0.35 : 0.35
                    )}
                    style={[styles.fieldInput, { color: props.textStrong }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: props.textMuted }]}>
                  To
                </Text>
                <View
                  style={[
                    styles.field,
                    {
                      backgroundColor: props.pillBg,
                      borderColor: props.pillBorder,
                    },
                  ]}
                >
                  <TextInput
                    value={to}
                    onChangeText={(v) => {
                      setTo(v);
                      setErr("");
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={withAlpha(
                      props.textStrong,
                      props.isDark ? 0.35 : 0.35
                    )}
                    style={[styles.fieldInput, { color: props.textStrong }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            {!!err && (
              <View
                style={[
                  styles.errorPill,
                  { borderColor: withAlpha(props.accent2, 0.35) },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color={withAlpha(props.accent2, 0.95)}
                />
                <Text
                  style={[
                    styles.errorText,
                    {
                      color: withAlpha(
                        props.textStrong,
                        props.isDark ? 0.86 : 0.82
                      ),
                    },
                  ]}
                >
                  {err}
                </Text>
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 12,
              }}
            >
              <QuickBtn
                title="Today"
                onPress={() => quick("today")}
                bg={props.pillBg}
                border={props.pillBorder}
                text={props.textStrong}
              />
              <QuickBtn
                title="Week"
                onPress={() => quick("week")}
                bg={props.pillBg}
                border={props.pillBorder}
                text={props.textStrong}
              />
              <QuickBtn
                title="Month"
                onPress={() => quick("month")}
                bg={props.pillBg}
                border={props.pillBorder}
                text={props.textStrong}
              />
              <QuickBtn
                title="90d"
                onPress={() => quick("90d")}
                bg={props.pillBg}
                border={props.pillBorder}
                text={props.textStrong}
              />
              <QuickBtn
                title="All"
                onPress={() => quick("all")}
                bg={props.pillBg}
                border={props.pillBorder}
                text={props.textStrong}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={props.onClose}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: props.pillBg,
                    borderColor: props.pillBorder,
                  },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: props.textStrong }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={apply}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: props.isDark
                      ? withAlpha("#FFFFFF", 0.92)
                      : withAlpha("#111111", 0.92),
                  },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnTextPrimary,
                    {
                      color: props.isDark
                        ? withAlpha("#111", 0.92)
                        : withAlpha("#FFF", 0.95),
                    },
                  ]}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function QuickBtn(props: {
  title: string;
  onPress: () => void;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <Pressable
      onPress={() => {
        HAPTIC_SOFT();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.quickBtn,
        { backgroundColor: props.bg, borderColor: props.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.quickBtnText, { color: props.text }]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

// ----------------- styles -----------------

const styles = StyleSheet.create({
  root: { flex: 1 },

  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
  },
  glowSm: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 220,
  },

  headerBlur: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backText: { fontWeight: "900", fontSize: 13, letterSpacing: -0.1 },

  title: { fontSize: 18, fontWeight: "950" as any, letterSpacing: -0.3 },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "750" as any },

  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  searchPill: {
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800" as any,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },

  rangeRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangePillText: {
    fontSize: 12,
    fontWeight: "950" as any,
    letterSpacing: -0.1,
  },

  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthBtnText: { fontSize: 12, fontWeight: "950" as any, letterSpacing: -0.1 },

  totalsRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniChipText: { fontSize: 12, fontWeight: "850" as any, letterSpacing: -0.1 },

  sectionHeaderWrap: { marginTop: 6, marginBottom: 10 },
  sectionHeaderPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "950" as any,
    letterSpacing: -0.1,
  },
  sectionHeaderCount: {
    marginLeft: 2,
    fontSize: 12,
    fontWeight: "900" as any,
    fontVariant: ["tabular-nums"],
  },

  sessionCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    left: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 140,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionTitle: { fontSize: 14, fontWeight: "950" as any, letterSpacing: -0.2 },
  sessionSub: { marginTop: 4, fontSize: 12, fontWeight: "750" as any },

  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  prBadgeText: {
    fontSize: 12,
    fontWeight: "950" as any,
    fontVariant: ["tabular-nums"],
  },

  cardChipsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardChipText: { fontSize: 12, fontWeight: "850" as any, letterSpacing: -0.1 },

  edgeCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  edgeTitle: { fontSize: 14, fontWeight: "950" as any, letterSpacing: -0.2 },
  edgeSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "650" as any,
    lineHeight: 16,
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
    paddingBottom: 16,
  },
  modalSheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontWeight: "950" as any, letterSpacing: -0.2 },
  modalSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700" as any,
    lineHeight: 16,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  monthGrid: { marginTop: 12, gap: 10 },
  monthCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthCellText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900" as any,
    letterSpacing: -0.2,
  },

  fieldLabel: { fontSize: 12, fontWeight: "850" as any },
  field: {
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginTop: 8,
  },
  fieldInput: {
    fontSize: 13,
    fontWeight: "900" as any,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },

  errorPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "750" as any,
    lineHeight: 16,
  },

  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickBtnText: { fontSize: 12, fontWeight: "950" as any, letterSpacing: -0.1 },

  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontSize: 13, fontWeight: "950" as any, letterSpacing: -0.2 },

  modalBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnTextPrimary: {
    fontSize: 13,
    fontWeight: "950" as any,
    letterSpacing: -0.2,
  },
});
