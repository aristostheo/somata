// // components/workouts/AddWorkoutForm.tsx
// import React, { useMemo, useState } from "react";
// import {
//   View,
//   Text,
//   Pressable,
//   Platform,
//   ScrollView,
//   Modal,
//   StyleSheet, // <- add this
//   Alert as RNAlert,
// } from "react-native";

// import Card from "@/components/Card";
// import { useTheme } from "@/content/ThemeProvider";
// import { withAlpha } from "./utils/withAlpha";
// import { Field } from "./ui/Field";
// import { GradientButton } from "./ui/GradientButton";
// import { LinearGradient } from "expo-linear-gradient";
// import { BlurView } from "expo-blur";
// import { Ionicons } from "@expo/vector-icons";
// import { kgToLb } from "@/utils/units";

// // Optional native date picker (shown inside our modal)
// let DateTimePicker: any = null;
// try {
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   DateTimePicker = require("@react-native-community/datetimepicker").default;
// } catch {}

// /** Props unchanged — your logic stays the same. */
// export default function AddWorkoutForm({
//   unit,
//   todayISO,
//   suggested,
//   safePresets,
//   conflictWarning,
//   nextWeightSuggestion,
//   addDisabled,
//   date,
//   setDate,
//   exercise,
//   setExercise,
//   sets,
//   setSets,
//   reps,
//   setReps,
//   weight,
//   setWeight,
//   notes,
//   setNotes,
//   onAdd,
//   newPreset,
//   setNewPreset,
//   onSavePreset,
//   onClear,
//   onOpenSearch,
//   templates,
//   onSaveTemplate,
//   onApplyTemplate,
//   onUpdateTemplate,
//   onDeleteTemplate,
//   onUpdatePreset,
//   onDeletePreset,
//   templatesLocked = false,
//   onUpgradeTemplates,
// }: {
//   unit: "kg" | "lb";
//   todayISO: string;
//   suggested: string[];
//   safePresets: Array<{
//     id: string;
//     name: string;
//     sets?: number;
//     reps?: number;
//     weight?: number;
//     notes?: string;
//   }>;
//   conflictWarning: { alt?: string } | null;
//   nextWeightSuggestion: { next: number; prev: number } | null;
//   addDisabled: boolean;
//   date: string;
//   setDate: (v: string) => void;
//   exercise: string;
//   setExercise: (v: string) => void;
//   sets: string;
//   setSets: (v: string) => void;
//   reps: string;
//   setReps: (v: string) => void;
//   weight: string;
//   setWeight: (v: string) => void;
//   notes: string;
//   setNotes: (v: string) => void;
//   onAdd: () => void;
//   newPreset: string;
//   setNewPreset: (v: string) => void;
//   onSavePreset: (payload: {
//     name: string;
//     exercise: string;
//     sets: number;
//     reps: number;
//     weight: number;
//     notes: string;
//   }) => void;
//   onClear: () => void;
//   onOpenSearch: () => void;
//   templates: { id: string; name: string; items?: any[] }[];
//   onSaveTemplate: (name: string) => void;
//   onApplyTemplate: (id: string) => void;
//   onUpdateTemplate: (id: string) => void;
//   onDeleteTemplate: (id: string) => void;
//   onUpdatePreset: (id: string) => void;
//   onDeletePreset: (id: string) => void;
//   templatesLocked?: boolean;
//   onUpgradeTemplates?: () => void;
// }) {
//   const { colors, isDark } = useTheme();
//   const [presetsOpen, setPresetsOpen] = useState(true);
//   const [templateName, setTemplateName] = useState("");

//   // calendar modal state
//   const [showDatePicker, setShowDatePicker] = useState(false);
//   const [tempDate, setTempDate] = useState(parseISOToDate(date || todayISO));

//   const hasSuggestion = !!(exercise.trim() && nextWeightSuggestion);
//   const prevStr = hasSuggestion
//     ? String((nextWeightSuggestion as any).prev)
//     : "";
//   const nextStr = hasSuggestion
//     ? String((nextWeightSuggestion as any).next)
//     : "";
//   const canSavePreset = newPreset.trim().length > 0;

//   const weightStep = unit === "lb" ? 5 : 2.5;

//   const helper = useMemo(() => {
//     if (!exercise.trim()) return "Pick a preset or type an exercise.";
//     if (conflictWarning)
//       return "This may aggravate an injury. Consider the alternative shown.";
//     if (hasSuggestion) return `Suggested weight: ${nextStr} ${unit}`;
//     return "Fill sets, reps, and weight, then tap Add.";
//   }, [exercise, conflictWarning, hasSuggestion, nextStr, unit]);

//   function incInt(v: string, d = 1, min = 0, max = 999) {
//     const n = Number(v || 0);
//     return String(Math.max(min, Math.min(max, n + d)));
//   }
//   function incDec(v: string, step: number) {
//     const n = Number(v || 0);
//     const out = Math.max(0, n + step);
//     return String(Math.round(out * 10) / 10);
//   }

//   // date helpers
//   function parseISOToDate(s: string): Date {
//     if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return new Date();
//     const [y, m, d] = s.split("-").map((x) => Number(x));
//     return new Date(y, (m || 1) - 1, d || 1);
//   }
//   function toISO(d: Date) {
//     const p = (n: number) => String(n).padStart(2, "0");
//     return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
//   }
//   function shiftISO(baseISO: string, days: number) {
//     const base = parseISOToDate(baseISO);
//     base.setDate(base.getDate() + days);
//     return toISO(base);
//   }
//   const todayFromNow = toISO(new Date());
//   const yesterdayFromNow = shiftISO(todayFromNow, -1);

//   return (
//     <Card style={{ gap: 12, paddingTop: 12, paddingBottom: 14 }}>
//       {/* Header row */}
//       <Row between>
//         <Row gap={10}>
//           <Badge
//             tint={withAlpha(colors.primary, 0.15)}
//             border={withAlpha(colors.primary, 0.35)}
//           >
//             <Ionicons
//               name="add-circle-outline"
//               size={14}
//               color={colors.primary}
//             />
//           </Badge>
//           <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>
//             Add workout
//           </Text>
//         </Row>

//         <Row gap={8}>
//           <Chip onPress={() => setPresetsOpen((x) => !x)}>
//             <Row gap={6}>
//               <Ionicons
//                 name="bookmarks-outline"
//                 size={14}
//                 color={colors.text}
//               />
//               <Text style={{ color: colors.text, fontWeight: "700" }}>
//                 {presetsOpen ? "Hide presets" : "Show presets"}
//               </Text>
//             </Row>
//           </Chip>
//           <Chip onPress={onClear} subtle>
//             <Text style={{ color: colors.muted, fontWeight: "700" }}>
//               Clear
//             </Text>
//           </Chip>
//         </Row>
//       </Row>

//       {/* PRESETS */}
//       {presetsOpen && (
//         <GlassPanel>
//           <Row gap={8} style={{ marginBottom: 6 }}>
//             <Ionicons name="sparkles-outline" size={14} color={colors.text} />
//             <Text style={{ color: colors.text, fontWeight: "700" }}>
//               Presets
//             </Text>
//           </Row>
//           <ScrollView
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={{ gap: 8 }}
//           >
//             {suggested.map((name) => (
//               <Pill key={"sg-" + name} onPress={() => setExercise(name)} accent>
//                 {name}
//               </Pill>
//             ))}
//             {safePresets.map((p) => (
//               <Pill
//                 key={p.id}
//                 onPress={() => {
//                   setExercise(p.name);
//                   if (p.sets !== undefined) setSets(String(p.sets));
//                   if (p.reps !== undefined) setReps(String(p.reps));
//                   if (p.weight !== undefined) {
//                     const w =
//                       unit === "lb"
//                         ? Math.round(kgToLb(p.weight))
//                         : Math.round(p.weight);
//                     setWeight(w ? String(w) : "");
//                   }
//                   if (p.notes !== undefined) setNotes(p.notes);
//                 }}
//                 onLongPress={() =>
//                   RNAlert.alert("Preset options", p.name, [
//                     {
//                       text: "Update from current form",
//                       onPress: () => onUpdatePreset(p.id),
//                     },
//                     {
//                       text: "Delete",
//                       style: "destructive",
//                       onPress: () => onDeletePreset(p.id),
//                     },
//                     { text: "Cancel", style: "cancel" },
//                   ])
//                 }
//               >
//                 {p.name}
//               </Pill>
//             ))}
//           </ScrollView>
//         </GlassPanel>
//       )}

//       {/* Templates */}
//       <GlassPanel>
//         <Row between style={{ marginBottom: 8 }}>
//           <Row gap={8}>
//             <Ionicons name="copy-outline" size={14} color={colors.text} />
//             <Text style={{ color: colors.text, fontWeight: "700" }}>
//               Templates
//             </Text>
//           </Row>
//           <Text style={{ color: colors.muted, fontSize: 12 }}>
//             Save a whole day; apply to autofill today
//           </Text>
//         </Row>
//         <Text style={{ color: colors.muted, marginBottom: 6, fontSize: 12 }}>
//           Tip: Save a template from today’s logged workouts. Long-press to update/delete.
//         </Text>
//         <Row gap={8} style={{ marginBottom: 10 }}>
//           <Field
//             icon="create-outline"
//             placeholder="Template name"
//             value={templateName}
//             onChangeText={setTemplateName}
//           />
//           <GradientButton
//             label={templatesLocked ? "Unlock Pro" : "Save"}
//             onPress={() =>
//               templatesLocked
//                 ? onUpgradeTemplates?.()
//                 : onSaveTemplate(templateName.trim())
//             }
//             disabled={!templateName.trim() || templatesLocked}
//           />
//         </Row>
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={false}
//           contentContainerStyle={{ gap: 8 }}
//         >
//           {templates.length === 0 ? (
//             <Pill onPress={() => {}} subtle>
//               No templates yet
//             </Pill>
//           ) : (
//             templates.map((t) => (
//               <Pill
//                 key={t.id}
//                 onPress={() =>
//                   templatesLocked
//                     ? onUpgradeTemplates?.()
//                     : onApplyTemplate(t.id)
//                 }
//                 onLongPress={() =>
//                   templatesLocked
//                     ? onUpgradeTemplates?.()
//                     : RNAlert.alert("Template options", t.name, [
//                         {
//                           text: "Apply to today",
//                           onPress: () => onApplyTemplate(t.id),
//                         },
//                         {
//                           text: "Overwrite with today",
//                           onPress: () => onUpdateTemplate(t.id),
//                         },
//                         {
//                           text: "Delete",
//                           style: "destructive",
//                           onPress: () => onDeleteTemplate(t.id),
//                         },
//                         { text: "Cancel", style: "cancel" },
//                       ])
//                 }
//               >
//                 {t.name}
//               </Pill>
//             ))
//           )}
//         </ScrollView>
//         {templatesLocked && (
//           <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
//             Templates are part of Pro. Save and apply whole-day routines after upgrading.
//           </Text>
//         )}
//       </GlassPanel>

//       {/* ROW 1: Exercise (full width, always readable) */}
//       <GlassPanel>
//         <View style={{ flex: 1 }}>
//           <Field
//             icon="barbell-outline"
//             placeholder="Exercise"
//             value={exercise}
//             onChangeText={setExercise}
//             autoCapitalize="words"
//           />
//         </View>

//         {/* Secondary controls: Browse + Today + Yesterday + Calendar (compact) */}
//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           <IconChip
//             icon="search-outline"
//             label="Browse"
//             onPress={onOpenSearch}
//           />
//         </Row>

//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           {DateTimePicker ? (
//             <IconChip
//               icon="calendar-outline"
//               label="Calendar"
//               onPress={() => {
//                 setTempDate(parseISOToDate(date || todayISO));
//                 setShowDatePicker(true);
//               }}
//             />
//           ) : (
//             <View style={{ width: 120 }}>
//               <Field
//                 icon="calendar-outline"
//                 placeholder="YYYY-MM-DD"
//                 value={date}
//                 onChangeText={setDate}
//                 autoCapitalize="none"
//               />
//             </View>
//           )}
//           <QuickChip
//             label="Today"
//             onPress={() => setDate(todayFromNow)}
//             active={(date || todayISO) === todayFromNow}
//           />
//           <QuickChip
//             label="Yesterday"
//             onPress={() => setDate(yesterdayFromNow)}
//             active={(date || todayISO) === yesterdayFromNow}
//           />
//         </Row>

//         {/* Selected date summary (tiny, never crowded) */}
//         <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
//           Selected: {date || todayISO}
//         </Text>

//         {!!helper && (
//           <Row gap={8} style={{ marginTop: 8 }}>
//             <Ionicons
//               name={
//                 conflictWarning
//                   ? "warning-outline"
//                   : "information-circle-outline"
//               }
//               size={14}
//               color={conflictWarning ? "#ef4444" : colors.muted}
//             />
//             <Text
//               style={{
//                 color: conflictWarning ? "#ef4444" : colors.muted,
//                 fontSize: 12,
//                 flex: 1,
//               }}
//               numberOfLines={2}
//             >
//               {conflictWarning
//                 ? `This may aggravate an injury. Try${
//                     conflictWarning.alt
//                       ? `: ${conflictWarning.alt}`
//                       : " a safer alternative"
//                   }.`
//                 : helper}
//             </Text>
//           </Row>
//         )}
//       </GlassPanel>

//       {/* ROW 2: Scheme + Weight */}
//       <GlassPanel>
//         <Row gap={8}>
//           <StepperTile
//             label="Sets"
//             icon="layers-outline"
//             value={sets}
//             onChangeText={(t) => setSets(t.replace(/[^0-9]/g, ""))}
//             onInc={() => setSets(incInt(sets, 1))}
//             onDec={() => setSets(incInt(sets, -1))}
//           />
//           <StepperTile
//             label="Reps"
//             icon="repeat-outline"
//             value={reps}
//             onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ""))}
//             onInc={() => setReps(incInt(reps, 1))}
//             onDec={() => setReps(incInt(reps, -1))}
//           />
//         </Row>

//         <View style={{ marginTop: 8 }}>
//           <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
//             Weight ({unit})
//           </Text>
//           <Row gap={8}>
//             <BigIconButton
//               icon="remove-outline"
//               onPress={() => setWeight(incDec(weight, -weightStep))}
//             />
//             <Field
//               icon="speedometer-outline"
//               inputMode="decimal"
//               value={weight}
//               onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
//               style={{ flex: 1, height: 54 }}
//             />
//             <BigIconButton
//               icon="add-outline"
//               onPress={() => setWeight(incDec(weight, weightStep))}
//             />
//           </Row>

//           {hasSuggestion && (
//             <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//               <MiniChip onPress={() => setWeight(prevStr)}>
//                 <Ionicons
//                   name="refresh-outline"
//                   size={14}
//                   color={colors.primary}
//                 />
//                 <Text style={{ color: colors.primary, fontWeight: "800" }}>
//                   Use previous ({prevStr} {unit})
//                 </Text>
//               </MiniChip>
//               <MiniChip onPress={() => setWeight(nextStr)}>
//                 <Ionicons
//                   name="flash-outline"
//                   size={14}
//                   color={colors.primary}
//                 />
//                 <Text style={{ color: colors.primary, fontWeight: "800" }}>
//                   Apply suggestion ({nextStr} {unit})
//                 </Text>
//               </MiniChip>
//             </Row>
//           )}
//         </View>
//       </GlassPanel>

//       {/* ROW 3: Notes + Save Preset */}
//       <GlassPanel>
//         <Field
//           icon="document-text-outline"
//           placeholder="Notes (optional)"
//           value={notes}
//           onChangeText={setNotes}
//         />

//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           <View style={{ flex: 1, minWidth: 200 }}>
//             <Field
//               icon="bookmark-outline"
//               placeholder="Save exercise as preset (name)"
//               value={newPreset}
//               onChangeText={setNewPreset}
//             />
//           </View>
//           <Chip
//             onPress={() =>
//               onSavePreset({
//                 name: newPreset.trim(),
//                 exercise: exercise.trim(),
//                 sets: Number(sets || 0),
//                 reps: Number(reps || 0),
//                 weight: Number(weight || 0),
//                 notes: notes || "",
//               })
//             }
//             disabled={!canSavePreset || !exercise.trim()}
//           >
//             <Text
//               style={{
//                 color: colors.text,
//                 fontWeight: "700",
//                 opacity: canSavePreset && exercise.trim() ? 1 : 0.6,
//               }}
//             >
//               Save
//             </Text>
//           </Chip>
//         </Row>
//       </GlassPanel>

//       {/* Submit */}
//       <Row gap={8} style={{ marginTop: 2 }}>
//         <GradientButton label="Add" onPress={onAdd} disabled={addDisabled} />
//       </Row>

//       {/* Date modal (never changes layout height) */}
//       <DateModal
//         visible={!!DateTimePicker && showDatePicker}
//         date={tempDate}
//         onChange={setTempDate}
//         onCancel={() => setShowDatePicker(false)}
//         onConfirm={() => {
//           setDate(toISO(tempDate));
//           setShowDatePicker(false);
//         }}
//       />
//     </Card>
//   );
// }

// /* ────────────────────── UI helpers (glassy + minimal) ───────────────────── */

// function DateModal({
//   visible,
//   date,
//   onChange,
//   onCancel,
//   onConfirm,
// }: {
//   visible: boolean;
//   date: Date;
//   onChange: (d: Date) => void;
//   onCancel: () => void;
//   onConfirm: () => void;
// }) {
//   const { colors, isDark } = useTheme();
//   if (!DateTimePicker) return null;
//   return (
//     <Modal transparent visible={visible} animationType="fade">
//       <View
//         style={{
//           flex: 1,
//           backgroundColor: "rgba(0,0,0,0.35)",
//           alignItems: "center",
//           justifyContent: "center",
//           padding: 16,
//         }}
//       >
//         <View
//           style={{
//             width: "100%",
//             maxWidth: 420,
//             borderRadius: 18,
//             overflow: "hidden",
//             borderWidth: 1,
//             borderColor: withAlpha(colors.primary, 0.25),
//           }}
//         >
//           <BlurView
//             tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
//             intensity={20}
//           >
//             <View style={{ padding: 12, gap: 12 }}>
//               <Text style={{ color: colors.text, fontWeight: "800" }}>
//                 Pick a date
//               </Text>

//               <DateTimePicker
//                 value={date}
//                 mode="date"
//                 display={Platform.OS === "ios" ? "spinner" : "calendar"}
//                 onChange={(_: any, d?: Date) => {
//                   if (d) onChange(d);
//                 }}
//               />

//               <Row gap={8} style={{ justifyContent: "flex-end" }}>
//                 <Chip onPress={onCancel} subtle>
//                   <Text style={{ color: colors.text, fontWeight: "700" }}>
//                     Cancel
//                   </Text>
//                 </Chip>
//                 <Chip onPress={onConfirm}>
//                   <Text style={{ color: colors.text, fontWeight: "700" }}>
//                     Set date
//                   </Text>
//                 </Chip>
//               </Row>
//             </View>
//           </BlurView>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// function GlassPanel({ children }: React.PropsWithChildren) {
//   const { colors, isDark } = useTheme();
//   const content = (
//     <View style={{ padding: 10, gap: 8, borderRadius: 16, overflow: "hidden" }}>
//       {children}
//     </View>
//   );
//   if (Platform.OS === "ios") {
//     return (
//       <View
//         style={{
//           borderRadius: 16,
//           overflow: "hidden",
//           borderWidth: 1,
//           borderColor: colors.border,
//         }}
//       >
//         <BlurView
//           tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
//           intensity={20}
//         >
//           <LinearGradient
//             start={{ x: 0, y: 0.5 }}
//             end={{ x: 1, y: 0.5 }}
//             colors={[
//               withAlpha(colors.primary, 0.08),
//               withAlpha(colors.primary, 0.14),
//             ]}
//             style={StyleSheet.absoluteFill}
//           />

//           {content}
//         </BlurView>
//       </View>
//     );
//   }
//   return (
//     <LinearGradient
//       start={{ x: 0, y: 0.5 }}
//       end={{ x: 1, y: 0.5 }}
//       colors={[
//         withAlpha(colors.primary, 0.06),
//         withAlpha(colors.primary, 0.12),
//       ]}
//       style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
//     >
//       {content}
//     </LinearGradient>
//   );
// }

// /* chips & buttons */

// function IconChip({
//   icon,
//   label,
//   onPress,
//   disabled,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   label: string;
//   onPress: () => void;
//   disabled?: boolean;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={!disabled ? onPress : undefined}
//       hitSlop={8}
//       style={{
//         flexDirection: "row",
//         alignItems: "center",
//         gap: 6,
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: disabled ? colors.border : withAlpha(colors.primary, 0.35),
//         backgroundColor: disabled
//           ? withAlpha(colors.text, 0.06)
//           : withAlpha(colors.primary, 0.12),
//         opacity: disabled ? 0.7 : 1,
//       }}
//     >
//       <Ionicons
//         name={icon}
//         size={14}
//         color={disabled ? colors.muted : colors.text}
//       />
//       <Text
//         style={{
//           color: disabled ? colors.muted : colors.text,
//           fontWeight: "700",
//         }}
//       >
//         {label}
//       </Text>
//     </Pressable>
//   );
// }

// function QuickChip({
//   label,
//   onPress,
//   active,
// }: {
//   label: string;
//   onPress: () => void;
//   active?: boolean;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={8}
//       style={{
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: active ? withAlpha(colors.primary, 0.5) : colors.border,
//         backgroundColor: active
//           ? withAlpha(colors.primary, 0.18)
//           : withAlpha(colors.text, 0.06),
//       }}
//     >
//       <Text
//         style={{
//           color: active ? colors.primary : colors.text,
//           fontWeight: "800",
//         }}
//       >
//         {label}
//       </Text>
//     </Pressable>
//   );
// }

// function Pill({
//   children,
//   onPress,
//   onLongPress,
//   accent = false,
// }: React.PropsWithChildren<{
//   onPress: () => void;
//   onLongPress?: () => void;
//   accent?: boolean;
// }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       onLongPress={onLongPress}
//       hitSlop={6}
//       style={{
//         borderRadius: 999,
//         paddingVertical: 8,
//         paddingHorizontal: 14,
//         borderWidth: 1,
//         borderColor: accent ? withAlpha(colors.primary, 0.3) : colors.border,
//         backgroundColor: accent
//           ? withAlpha(colors.primary, 0.12)
//           : withAlpha(colors.text, 0.06),
//       }}
//     >
//       <Text style={{ color: colors.text }}>{children}</Text>
//     </Pressable>
//   );
// }

// function MiniChip({
//   children,
//   onPress,
// }: React.PropsWithChildren<{ onPress: () => void }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         borderRadius: 999,
//         paddingVertical: 6,
//         paddingHorizontal: 10,
//         borderWidth: 1,
//         borderColor: withAlpha(colors.primary, 0.35),
//         backgroundColor: withAlpha(colors.primary, 0.12),
//       }}
//     >
//       <Row gap={6}>{children}</Row>
//     </Pressable>
//   );
// }

// function Chip({
//   children,
//   onPress,
//   subtle,
//   disabled,
// }: React.PropsWithChildren<{
//   onPress: () => void;
//   subtle?: boolean;
//   disabled?: boolean;
// }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={!disabled ? onPress : undefined}
//       hitSlop={8}
//       style={{
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: subtle ? colors.border : withAlpha(colors.primary, 0.35),
//         backgroundColor: subtle
//           ? "transparent"
//           : withAlpha(colors.primary, 0.12),
//         opacity: disabled ? 0.6 : 1,
//       }}
//     >
//       {children}
//     </Pressable>
//   );
// }

// function Badge({
//   children,
//   tint,
//   border,
// }: {
//   children: React.ReactNode;
//   tint: string;
//   border: string;
// }) {
//   return (
//     <View
//       style={{
//         flexDirection: "row",
//         alignItems: "center",
//         paddingVertical: 6,
//         paddingHorizontal: 8,
//         borderRadius: 999,
//         backgroundColor: tint,
//         borderWidth: 1,
//         borderColor: border,
//       }}
//     >
//       {children}
//     </View>
//   );
// }

// /* layout primitives */

// function Row({
//   children,
//   gap = 0,
//   between = false,
//   style,
// }: React.PropsWithChildren<{ gap?: number; between?: boolean; style?: any }>) {
//   return (
//     <View
//       style={[
//         { flexDirection: "row", alignItems: "center", gap },
//         between && { justifyContent: "space-between" },
//         style,
//       ]}
//     >
//       {children}
//     </View>
//   );
// }

// function StepperTile({
//   label,
//   icon,
//   value,
//   onChangeText,
//   onInc,
//   onDec,
// }: {
//   label: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   value: string;
//   onChangeText: (v: string) => void;
//   onInc: () => void;
//   onDec: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <View style={{ flex: 1 }}>
//       <View
//         style={{
//           flexDirection: "row",
//           alignItems: "baseline",
//           justifyContent: "space-between",
//           marginBottom: 6,
//         }}
//       >
//         <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
//         <Text
//           style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}
//           numberOfLines={1}
//           ellipsizeMode="clip"
//         >
//           {value || "0"}
//         </Text>
//       </View>

//       <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
//         <SmallIconButton icon="remove-outline" onPress={onDec} />
//         <SmallIconButton icon="add-outline" onPress={onInc} />
//       </View>
//     </View>
//   );
// }

// function SmallIconButton({
//   icon,
//   onPress,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         height: 40,
//         width: 40,
//         borderRadius: 12,
//         borderWidth: 1,
//         borderColor: colors.border,
//         alignItems: "center",
//         justifyContent: "center",
//         backgroundColor: withAlpha(colors.primary, 0.06),
//       }}
//     >
//       <Ionicons name={icon} size={18} color={colors.text} />
//     </Pressable>
//   );
// }

// function BigIconButton({
//   icon,
//   onPress,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         height: 54,
//         width: 54,
//         borderRadius: 14,
//         borderWidth: 1,
//         borderColor: colors.border,
//         alignItems: "center",
//         justifyContent: "center",
//         backgroundColor: withAlpha(colors.primary, 0.06),
//       }}
//     >
//       <Ionicons name={icon} size={20} color={colors.text} />
//     </Pressable>
//   );
// }
// components/workouts/AddWorkoutForm.tsx
// // components/workouts/AddWorkoutForm.tsx
// import React, { useMemo, useState } from "react";
// import {
//   View,
//   Text,
//   Pressable,
//   Platform,
//   ScrollView,
//   Modal,
//   StyleSheet, // <- add this
//   Alert as RNAlert,
// } from "react-native";

// import Card from "@/components/Card";
// import { useTheme } from "@/content/ThemeProvider";
// import { withAlpha } from "./utils/withAlpha";
// import { Field } from "./ui/Field";
// import { GradientButton } from "./ui/GradientButton";
// import { LinearGradient } from "expo-linear-gradient";
// import { BlurView } from "expo-blur";
// import { Ionicons } from "@expo/vector-icons";
// import { kgToLb } from "@/utils/units";

// // Optional native date picker (shown inside our modal)
// let DateTimePicker: any = null;
// try {
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   DateTimePicker = require("@react-native-community/datetimepicker").default;
// } catch {}

// /** Props unchanged — your logic stays the same. */
// export default function AddWorkoutForm({
//   unit,
//   todayISO,
//   suggested,
//   safePresets,
//   conflictWarning,
//   nextWeightSuggestion,
//   addDisabled,
//   date,
//   setDate,
//   exercise,
//   setExercise,
//   sets,
//   setSets,
//   reps,
//   setReps,
//   weight,
//   setWeight,
//   notes,
//   setNotes,
//   onAdd,
//   newPreset,
//   setNewPreset,
//   onSavePreset,
//   onClear,
//   onOpenSearch,
//   templates,
//   onSaveTemplate,
//   onApplyTemplate,
//   onUpdateTemplate,
//   onDeleteTemplate,
//   onUpdatePreset,
//   onDeletePreset,
//   templatesLocked = false,
//   onUpgradeTemplates,
// }: {
//   unit: "kg" | "lb";
//   todayISO: string;
//   suggested: string[];
//   safePresets: Array<{
//     id: string;
//     name: string;
//     sets?: number;
//     reps?: number;
//     weight?: number;
//     notes?: string;
//   }>;
//   conflictWarning: { alt?: string } | null;
//   nextWeightSuggestion: { next: number; prev: number } | null;
//   addDisabled: boolean;
//   date: string;
//   setDate: (v: string) => void;
//   exercise: string;
//   setExercise: (v: string) => void;
//   sets: string;
//   setSets: (v: string) => void;
//   reps: string;
//   setReps: (v: string) => void;
//   weight: string;
//   setWeight: (v: string) => void;
//   notes: string;
//   setNotes: (v: string) => void;
//   onAdd: () => void;
//   newPreset: string;
//   setNewPreset: (v: string) => void;
//   onSavePreset: (payload: {
//     name: string;
//     exercise: string;
//     sets: number;
//     reps: number;
//     weight: number;
//     notes: string;
//   }) => void;
//   onClear: () => void;
//   onOpenSearch: () => void;
//   templates: { id: string; name: string; items?: any[] }[];
//   onSaveTemplate: (name: string) => void;
//   onApplyTemplate: (id: string) => void;
//   onUpdateTemplate: (id: string) => void;
//   onDeleteTemplate: (id: string) => void;
//   onUpdatePreset: (id: string) => void;
//   onDeletePreset: (id: string) => void;
//   templatesLocked?: boolean;
//   onUpgradeTemplates?: () => void;
// }) {
//   const { colors, isDark } = useTheme();
//   const [presetsOpen, setPresetsOpen] = useState(true);
//   const [templateName, setTemplateName] = useState("");

//   // calendar modal state
//   const [showDatePicker, setShowDatePicker] = useState(false);
//   const [tempDate, setTempDate] = useState(parseISOToDate(date || todayISO));

//   const hasSuggestion = !!(exercise.trim() && nextWeightSuggestion);
//   const prevStr = hasSuggestion
//     ? String((nextWeightSuggestion as any).prev)
//     : "";
//   const nextStr = hasSuggestion
//     ? String((nextWeightSuggestion as any).next)
//     : "";
//   const canSavePreset = newPreset.trim().length > 0;

//   const weightStep = unit === "lb" ? 5 : 2.5;

//   const helper = useMemo(() => {
//     if (!exercise.trim()) return "Pick a preset or type an exercise.";
//     if (conflictWarning)
//       return "This may aggravate an injury. Consider the alternative shown.";
//     if (hasSuggestion) return `Suggested weight: ${nextStr} ${unit}`;
//     return "Fill sets, reps, and weight, then tap Add.";
//   }, [exercise, conflictWarning, hasSuggestion, nextStr, unit]);

//   function incInt(v: string, d = 1, min = 0, max = 999) {
//     const n = Number(v || 0);
//     return String(Math.max(min, Math.min(max, n + d)));
//   }
//   function incDec(v: string, step: number) {
//     const n = Number(v || 0);
//     const out = Math.max(0, n + step);
//     return String(Math.round(out * 10) / 10);
//   }

//   // date helpers
//   function parseISOToDate(s: string): Date {
//     if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return new Date();
//     const [y, m, d] = s.split("-").map((x) => Number(x));
//     return new Date(y, (m || 1) - 1, d || 1);
//   }
//   function toISO(d: Date) {
//     const p = (n: number) => String(n).padStart(2, "0");
//     return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
//   }
//   function shiftISO(baseISO: string, days: number) {
//     const base = parseISOToDate(baseISO);
//     base.setDate(base.getDate() + days);
//     return toISO(base);
//   }
//   const todayFromNow = toISO(new Date());
//   const yesterdayFromNow = shiftISO(todayFromNow, -1);

//   return (
//     <Card style={{ gap: 12, paddingTop: 12, paddingBottom: 14 }}>
//       {/* Header row */}
//       <Row between>
//         <Row gap={10}>
//           <Badge
//             tint={withAlpha(colors.primary, 0.15)}
//             border={withAlpha(colors.primary, 0.35)}
//           >
//             <Ionicons
//               name="add-circle-outline"
//               size={14}
//               color={colors.primary}
//             />
//           </Badge>
//           <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>
//             Add workout
//           </Text>
//         </Row>

//         <Row gap={8}>
//           <Chip onPress={() => setPresetsOpen((x) => !x)}>
//             <Row gap={6}>
//               <Ionicons
//                 name="bookmarks-outline"
//                 size={14}
//                 color={colors.text}
//               />
//               <Text style={{ color: colors.text, fontWeight: "700" }}>
//                 {presetsOpen ? "Hide presets" : "Show presets"}
//               </Text>
//             </Row>
//           </Chip>
//           <Chip onPress={onClear} subtle>
//             <Text style={{ color: colors.muted, fontWeight: "700" }}>
//               Clear
//             </Text>
//           </Chip>
//         </Row>
//       </Row>

//       {/* PRESETS */}
//       {presetsOpen && (
//         <GlassPanel>
//           <Row gap={8} style={{ marginBottom: 6 }}>
//             <Ionicons name="sparkles-outline" size={14} color={colors.text} />
//             <Text style={{ color: colors.text, fontWeight: "700" }}>
//               Presets
//             </Text>
//           </Row>
//           <ScrollView
//             horizontal
//             showsHorizontalScrollIndicator={false}
//             contentContainerStyle={{ gap: 8 }}
//           >
//             {suggested.map((name) => (
//               <Pill key={"sg-" + name} onPress={() => setExercise(name)} accent>
//                 {name}
//               </Pill>
//             ))}
//             {safePresets.map((p) => (
//               <Pill
//                 key={p.id}
//                 onPress={() => {
//                   setExercise(p.name);
//                   if (p.sets !== undefined) setSets(String(p.sets));
//                   if (p.reps !== undefined) setReps(String(p.reps));
//                   if (p.weight !== undefined) {
//                     const w =
//                       unit === "lb"
//                         ? Math.round(kgToLb(p.weight))
//                         : Math.round(p.weight);
//                     setWeight(w ? String(w) : "");
//                   }
//                   if (p.notes !== undefined) setNotes(p.notes);
//                 }}
//                 onLongPress={() =>
//                   RNAlert.alert("Preset options", p.name, [
//                     {
//                       text: "Update from current form",
//                       onPress: () => onUpdatePreset(p.id),
//                     },
//                     {
//                       text: "Delete",
//                       style: "destructive",
//                       onPress: () => onDeletePreset(p.id),
//                     },
//                     { text: "Cancel", style: "cancel" },
//                   ])
//                 }
//               >
//                 {p.name}
//               </Pill>
//             ))}
//           </ScrollView>
//         </GlassPanel>
//       )}

//       {/* Templates */}
//       <GlassPanel>
//         <Row between style={{ marginBottom: 8 }}>
//           <Row gap={8}>
//             <Ionicons name="copy-outline" size={14} color={colors.text} />
//             <Text style={{ color: colors.text, fontWeight: "700" }}>
//               Templates
//             </Text>
//           </Row>
//           <Text style={{ color: colors.muted, fontSize: 12 }}>
//             Save a whole day; apply to autofill today
//           </Text>
//         </Row>
//         <Text style={{ color: colors.muted, marginBottom: 6, fontSize: 12 }}>
//           Tip: Save a template from today’s logged workouts. Long-press to update/delete.
//         </Text>
//         <Row gap={8} style={{ marginBottom: 10 }}>
//           <Field
//             icon="create-outline"
//             placeholder="Template name"
//             value={templateName}
//             onChangeText={setTemplateName}
//           />
//           <GradientButton
//             label={templatesLocked ? "Unlock Pro" : "Save"}
//             onPress={() =>
//               templatesLocked
//                 ? onUpgradeTemplates?.()
//                 : onSaveTemplate(templateName.trim())
//             }
//             disabled={!templateName.trim() || templatesLocked}
//           />
//         </Row>
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={false}
//           contentContainerStyle={{ gap: 8 }}
//         >
//           {templates.length === 0 ? (
//             <Pill onPress={() => {}} subtle>
//               No templates yet
//             </Pill>
//           ) : (
//             templates.map((t) => (
//               <Pill
//                 key={t.id}
//                 onPress={() =>
//                   templatesLocked
//                     ? onUpgradeTemplates?.()
//                     : onApplyTemplate(t.id)
//                 }
//                 onLongPress={() =>
//                   templatesLocked
//                     ? onUpgradeTemplates?.()
//                     : RNAlert.alert("Template options", t.name, [
//                         {
//                           text: "Apply to today",
//                           onPress: () => onApplyTemplate(t.id),
//                         },
//                         {
//                           text: "Overwrite with today",
//                           onPress: () => onUpdateTemplate(t.id),
//                         },
//                         {
//                           text: "Delete",
//                           style: "destructive",
//                           onPress: () => onDeleteTemplate(t.id),
//                         },
//                         { text: "Cancel", style: "cancel" },
//                       ])
//                 }
//               >
//                 {t.name}
//               </Pill>
//             ))
//           )}
//         </ScrollView>
//         {templatesLocked && (
//           <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
//             Templates are part of Pro. Save and apply whole-day routines after upgrading.
//           </Text>
//         )}
//       </GlassPanel>

//       {/* ROW 1: Exercise (full width, always readable) */}
//       <GlassPanel>
//         <View style={{ flex: 1 }}>
//           <Field
//             icon="barbell-outline"
//             placeholder="Exercise"
//             value={exercise}
//             onChangeText={setExercise}
//             autoCapitalize="words"
//           />
//         </View>

//         {/* Secondary controls: Browse + Today + Yesterday + Calendar (compact) */}
//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           <IconChip
//             icon="search-outline"
//             label="Browse"
//             onPress={onOpenSearch}
//           />
//         </Row>

//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           {DateTimePicker ? (
//             <IconChip
//               icon="calendar-outline"
//               label="Calendar"
//               onPress={() => {
//                 setTempDate(parseISOToDate(date || todayISO));
//                 setShowDatePicker(true);
//               }}
//             />
//           ) : (
//             <View style={{ width: 120 }}>
//               <Field
//                 icon="calendar-outline"
//                 placeholder="YYYY-MM-DD"
//                 value={date}
//                 onChangeText={setDate}
//                 autoCapitalize="none"
//               />
//             </View>
//           )}
//           <QuickChip
//             label="Today"
//             onPress={() => setDate(todayFromNow)}
//             active={(date || todayISO) === todayFromNow}
//           />
//           <QuickChip
//             label="Yesterday"
//             onPress={() => setDate(yesterdayFromNow)}
//             active={(date || todayISO) === yesterdayFromNow}
//           />
//         </Row>

//         {/* Selected date summary (tiny, never crowded) */}
//         <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
//           Selected: {date || todayISO}
//         </Text>

//         {!!helper && (
//           <Row gap={8} style={{ marginTop: 8 }}>
//             <Ionicons
//               name={
//                 conflictWarning
//                   ? "warning-outline"
//                   : "information-circle-outline"
//               }
//               size={14}
//               color={conflictWarning ? "#ef4444" : colors.muted}
//             />
//             <Text
//               style={{
//                 color: conflictWarning ? "#ef4444" : colors.muted,
//                 fontSize: 12,
//                 flex: 1,
//               }}
//               numberOfLines={2}
//             >
//               {conflictWarning
//                 ? `This may aggravate an injury. Try${
//                     conflictWarning.alt
//                       ? `: ${conflictWarning.alt}`
//                       : " a safer alternative"
//                   }.`
//                 : helper}
//             </Text>
//           </Row>
//         )}
//       </GlassPanel>

//       {/* ROW 2: Scheme + Weight */}
//       <GlassPanel>
//         <Row gap={8}>
//           <StepperTile
//             label="Sets"
//             icon="layers-outline"
//             value={sets}
//             onChangeText={(t) => setSets(t.replace(/[^0-9]/g, ""))}
//             onInc={() => setSets(incInt(sets, 1))}
//             onDec={() => setSets(incInt(sets, -1))}
//           />
//           <StepperTile
//             label="Reps"
//             icon="repeat-outline"
//             value={reps}
//             onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ""))}
//             onInc={() => setReps(incInt(reps, 1))}
//             onDec={() => setReps(incInt(reps, -1))}
//           />
//         </Row>

//         <View style={{ marginTop: 8 }}>
//           <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
//             Weight ({unit})
//           </Text>
//           <Row gap={8}>
//             <BigIconButton
//               icon="remove-outline"
//               onPress={() => setWeight(incDec(weight, -weightStep))}
//             />
//             <Field
//               icon="speedometer-outline"
//               inputMode="decimal"
//               value={weight}
//               onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
//               style={{ flex: 1, height: 54 }}
//             />
//             <BigIconButton
//               icon="add-outline"
//               onPress={() => setWeight(incDec(weight, weightStep))}
//             />
//           </Row>

//           {hasSuggestion && (
//             <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//               <MiniChip onPress={() => setWeight(prevStr)}>
//                 <Ionicons
//                   name="refresh-outline"
//                   size={14}
//                   color={colors.primary}
//                 />
//                 <Text style={{ color: colors.primary, fontWeight: "800" }}>
//                   Use previous ({prevStr} {unit})
//                 </Text>
//               </MiniChip>
//               <MiniChip onPress={() => setWeight(nextStr)}>
//                 <Ionicons
//                   name="flash-outline"
//                   size={14}
//                   color={colors.primary}
//                 />
//                 <Text style={{ color: colors.primary, fontWeight: "800" }}>
//                   Apply suggestion ({nextStr} {unit})
//                 </Text>
//               </MiniChip>
//             </Row>
//           )}
//         </View>
//       </GlassPanel>

//       {/* ROW 3: Notes + Save Preset */}
//       <GlassPanel>
//         <Field
//           icon="document-text-outline"
//           placeholder="Notes (optional)"
//           value={notes}
//           onChangeText={setNotes}
//         />

//         <Row gap={8} style={{ marginTop: 8, flexWrap: "wrap" }}>
//           <View style={{ flex: 1, minWidth: 200 }}>
//             <Field
//               icon="bookmark-outline"
//               placeholder="Save exercise as preset (name)"
//               value={newPreset}
//               onChangeText={setNewPreset}
//             />
//           </View>
//           <Chip
//             onPress={() =>
//               onSavePreset({
//                 name: newPreset.trim(),
//                 exercise: exercise.trim(),
//                 sets: Number(sets || 0),
//                 reps: Number(reps || 0),
//                 weight: Number(weight || 0),
//                 notes: notes || "",
//               })
//             }
//             disabled={!canSavePreset || !exercise.trim()}
//           >
//             <Text
//               style={{
//                 color: colors.text,
//                 fontWeight: "700",
//                 opacity: canSavePreset && exercise.trim() ? 1 : 0.6,
//               }}
//             >
//               Save
//             </Text>
//           </Chip>
//         </Row>
//       </GlassPanel>

//       {/* Submit */}
//       <Row gap={8} style={{ marginTop: 2 }}>
//         <GradientButton label="Add" onPress={onAdd} disabled={addDisabled} />
//       </Row>

//       {/* Date modal (never changes layout height) */}
//       <DateModal
//         visible={!!DateTimePicker && showDatePicker}
//         date={tempDate}
//         onChange={setTempDate}
//         onCancel={() => setShowDatePicker(false)}
//         onConfirm={() => {
//           setDate(toISO(tempDate));
//           setShowDatePicker(false);
//         }}
//       />
//     </Card>
//   );
// }

// /* ────────────────────── UI helpers (glassy + minimal) ───────────────────── */

// function DateModal({
//   visible,
//   date,
//   onChange,
//   onCancel,
//   onConfirm,
// }: {
//   visible: boolean;
//   date: Date;
//   onChange: (d: Date) => void;
//   onCancel: () => void;
//   onConfirm: () => void;
// }) {
//   const { colors, isDark } = useTheme();
//   if (!DateTimePicker) return null;
//   return (
//     <Modal transparent visible={visible} animationType="fade">
//       <View
//         style={{
//           flex: 1,
//           backgroundColor: "rgba(0,0,0,0.35)",
//           alignItems: "center",
//           justifyContent: "center",
//           padding: 16,
//         }}
//       >
//         <View
//           style={{
//             width: "100%",
//             maxWidth: 420,
//             borderRadius: 18,
//             overflow: "hidden",
//             borderWidth: 1,
//             borderColor: withAlpha(colors.primary, 0.25),
//           }}
//         >
//           <BlurView
//             tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
//             intensity={20}
//           >
//             <View style={{ padding: 12, gap: 12 }}>
//               <Text style={{ color: colors.text, fontWeight: "800" }}>
//                 Pick a date
//               </Text>

//               <DateTimePicker
//                 value={date}
//                 mode="date"
//                 display={Platform.OS === "ios" ? "spinner" : "calendar"}
//                 onChange={(_: any, d?: Date) => {
//                   if (d) onChange(d);
//                 }}
//               />

//               <Row gap={8} style={{ justifyContent: "flex-end" }}>
//                 <Chip onPress={onCancel} subtle>
//                   <Text style={{ color: colors.text, fontWeight: "700" }}>
//                     Cancel
//                   </Text>
//                 </Chip>
//                 <Chip onPress={onConfirm}>
//                   <Text style={{ color: colors.text, fontWeight: "700" }}>
//                     Set date
//                   </Text>
//                 </Chip>
//               </Row>
//             </View>
//           </BlurView>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// function GlassPanel({ children }: React.PropsWithChildren) {
//   const { colors, isDark } = useTheme();
//   const content = (
//     <View style={{ padding: 10, gap: 8, borderRadius: 16, overflow: "hidden" }}>
//       {children}
//     </View>
//   );
//   if (Platform.OS === "ios") {
//     return (
//       <View
//         style={{
//           borderRadius: 16,
//           overflow: "hidden",
//           borderWidth: 1,
//           borderColor: colors.border,
//         }}
//       >
//         <BlurView
//           tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
//           intensity={20}
//         >
//           <LinearGradient
//             start={{ x: 0, y: 0.5 }}
//             end={{ x: 1, y: 0.5 }}
//             colors={[
//               withAlpha(colors.primary, 0.08),
//               withAlpha(colors.primary, 0.14),
//             ]}
//             style={StyleSheet.absoluteFill}
//           />

//           {content}
//         </BlurView>
//       </View>
//     );
//   }
//   return (
//     <LinearGradient
//       start={{ x: 0, y: 0.5 }}
//       end={{ x: 1, y: 0.5 }}
//       colors={[
//         withAlpha(colors.primary, 0.06),
//         withAlpha(colors.primary, 0.12),
//       ]}
//       style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
//     >
//       {content}
//     </LinearGradient>
//   );
// }

// /* chips & buttons */

// function IconChip({
//   icon,
//   label,
//   onPress,
//   disabled,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   label: string;
//   onPress: () => void;
//   disabled?: boolean;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={!disabled ? onPress : undefined}
//       hitSlop={8}
//       style={{
//         flexDirection: "row",
//         alignItems: "center",
//         gap: 6,
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: disabled ? colors.border : withAlpha(colors.primary, 0.35),
//         backgroundColor: disabled
//           ? withAlpha(colors.text, 0.06)
//           : withAlpha(colors.primary, 0.12),
//         opacity: disabled ? 0.7 : 1,
//       }}
//     >
//       <Ionicons
//         name={icon}
//         size={14}
//         color={disabled ? colors.muted : colors.text}
//       />
//       <Text
//         style={{
//           color: disabled ? colors.muted : colors.text,
//           fontWeight: "700",
//         }}
//       >
//         {label}
//       </Text>
//     </Pressable>
//   );
// }

// function QuickChip({
//   label,
//   onPress,
//   active,
// }: {
//   label: string;
//   onPress: () => void;
//   active?: boolean;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={8}
//       style={{
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: active ? withAlpha(colors.primary, 0.5) : colors.border,
//         backgroundColor: active
//           ? withAlpha(colors.primary, 0.18)
//           : withAlpha(colors.text, 0.06),
//       }}
//     >
//       <Text
//         style={{
//           color: active ? colors.primary : colors.text,
//           fontWeight: "800",
//         }}
//       >
//         {label}
//       </Text>
//     </Pressable>
//   );
// }

// function Pill({
//   children,
//   onPress,
//   onLongPress,
//   accent = false,
// }: React.PropsWithChildren<{
//   onPress: () => void;
//   onLongPress?: () => void;
//   accent?: boolean;
// }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       onLongPress={onLongPress}
//       hitSlop={6}
//       style={{
//         borderRadius: 999,
//         paddingVertical: 8,
//         paddingHorizontal: 14,
//         borderWidth: 1,
//         borderColor: accent ? withAlpha(colors.primary, 0.3) : colors.border,
//         backgroundColor: accent
//           ? withAlpha(colors.primary, 0.12)
//           : withAlpha(colors.text, 0.06),
//       }}
//     >
//       <Text style={{ color: colors.text }}>{children}</Text>
//     </Pressable>
//   );
// }

// function MiniChip({
//   children,
//   onPress,
// }: React.PropsWithChildren<{ onPress: () => void }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         borderRadius: 999,
//         paddingVertical: 6,
//         paddingHorizontal: 10,
//         borderWidth: 1,
//         borderColor: withAlpha(colors.primary, 0.35),
//         backgroundColor: withAlpha(colors.primary, 0.12),
//       }}
//     >
//       <Row gap={6}>{children}</Row>
//     </Pressable>
//   );
// }

// function Chip({
//   children,
//   onPress,
//   subtle,
//   disabled,
// }: React.PropsWithChildren<{
//   onPress: () => void;
//   subtle?: boolean;
//   disabled?: boolean;
// }>) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={!disabled ? onPress : undefined}
//       hitSlop={8}
//       style={{
//         paddingVertical: 8,
//         paddingHorizontal: 12,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: subtle ? colors.border : withAlpha(colors.primary, 0.35),
//         backgroundColor: subtle
//           ? "transparent"
//           : withAlpha(colors.primary, 0.12),
//         opacity: disabled ? 0.6 : 1,
//       }}
//     >
//       {children}
//     </Pressable>
//   );
// }

// function Badge({
//   children,
//   tint,
//   border,
// }: {
//   children: React.ReactNode;
//   tint: string;
//   border: string;
// }) {
//   return (
//     <View
//       style={{
//         flexDirection: "row",
//         alignItems: "center",
//         paddingVertical: 6,
//         paddingHorizontal: 8,
//         borderRadius: 999,
//         backgroundColor: tint,
//         borderWidth: 1,
//         borderColor: border,
//       }}
//     >
//       {children}
//     </View>
//   );
// }

// /* layout primitives */

// function Row({
//   children,
//   gap = 0,
//   between = false,
//   style,
// }: React.PropsWithChildren<{ gap?: number; between?: boolean; style?: any }>) {
//   return (
//     <View
//       style={[
//         { flexDirection: "row", alignItems: "center", gap },
//         between && { justifyContent: "space-between" },
//         style,
//       ]}
//     >
//       {children}
//     </View>
//   );
// }

// function StepperTile({
//   label,
//   icon,
//   value,
//   onChangeText,
//   onInc,
//   onDec,
// }: {
//   label: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   value: string;
//   onChangeText: (v: string) => void;
//   onInc: () => void;
//   onDec: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <View style={{ flex: 1 }}>
//       <View
//         style={{
//           flexDirection: "row",
//           alignItems: "baseline",
//           justifyContent: "space-between",
//           marginBottom: 6,
//         }}
//       >
//         <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
//         <Text
//           style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}
//           numberOfLines={1}
//           ellipsizeMode="clip"
//         >
//           {value || "0"}
//         </Text>
//       </View>

//       <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
//         <SmallIconButton icon="remove-outline" onPress={onDec} />
//         <SmallIconButton icon="add-outline" onPress={onInc} />
//       </View>
//     </View>
//   );
// }

// function SmallIconButton({
//   icon,
//   onPress,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         height: 40,
//         width: 40,
//         borderRadius: 12,
//         borderWidth: 1,
//         borderColor: colors.border,
//         alignItems: "center",
//         justifyContent: "center",
//         backgroundColor: withAlpha(colors.primary, 0.06),
//       }}
//     >
//       <Ionicons name={icon} size={18} color={colors.text} />
//     </Pressable>
//   );
// }

// function BigIconButton({
//   icon,
//   onPress,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
// }) {
//   const { colors } = useTheme();
//   return (
//     <Pressable
//       onPress={onPress}
//       hitSlop={6}
//       style={{
//         height: 54,
//         width: 54,
//         borderRadius: 14,
//         borderWidth: 1,
//         borderColor: colors.border,
//         alignItems: "center",
//         justifyContent: "center",
//         backgroundColor: withAlpha(colors.primary, 0.06),
//       }}
//     >
//       <Ionicons name={icon} size={20} color={colors.text} />
//     </Pressable>
//   );
// }
// components/workouts/AddWorkoutForm.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  Platform,
  ScrollView,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Alert as RNAlert,
} from "react-native";

import Card from "@/components/Card";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "./utils/withAlpha";
import { Field } from "./ui/Field";
import { GradientButton } from "./ui/GradientButton";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { kgToLb } from "@/utils/units";

// Optional native date picker (shown inside our modal)
let DateTimePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch {}

const { height: SCREEN_H } = Dimensions.get("window");

export default function AddWorkoutForm({
  unit,
  todayISO,
  suggested,
  safePresets,
  conflictWarning,
  nextWeightSuggestion,
  addDisabled,
  date,
  setDate,
  exercise,
  setExercise,
  sets,
  setSets,
  reps,
  setReps,
  weight,
  setWeight,
  notes,
  setNotes,
  onAdd,
  newPreset,
  setNewPreset,
  onSavePreset,
  onClear,
  onOpenSearch,
  templates,
  onSaveTemplate,
  onApplyTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onUpdatePreset,
  onDeletePreset,
  templatesLocked = false,
  onUpgradeTemplates,
}: {
  unit: "kg" | "lb";
  todayISO: string;
  suggested: string[];
  safePresets: Array<{
    id: string;
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
    notes?: string;
  }>;
  conflictWarning: { alt?: string } | null;
  nextWeightSuggestion: { next: number; prev: number } | null;
  addDisabled: boolean;
  date: string;
  setDate: (v: string) => void;
  exercise: string;
  setExercise: (v: string) => void;
  sets: string;
  setSets: (v: string) => void;
  reps: string;
  setReps: (v: string) => void;
  weight: string;
  setWeight: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onAdd: () => void;
  newPreset: string;
  setNewPreset: (v: string) => void;
  onSavePreset: (payload: {
    name: string;
    exercise: string;
    sets: number;
    reps: number;
    weight: number;
    notes: string;
  }) => void;
  onClear: () => void;
  onOpenSearch: () => void;
  templates: { id: string; name: string; items?: any[] }[];
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (id: string) => void;
  onUpdateTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onUpdatePreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  templatesLocked?: boolean;
  onUpgradeTemplates?: () => void;
}) {
  const { colors, isDark } = useTheme();

  const [sheet, setSheet] = useState<null | "presets" | "templates" | "date">(
    null
  );
  const [templateName, setTemplateName] = useState("");

  const weightStep = unit === "lb" ? 5 : 2.5;

  const hasSuggestion = !!(exercise.trim() && nextWeightSuggestion);
  const prevStr = hasSuggestion ? String(nextWeightSuggestion!.prev) : "";
  const nextStr = hasSuggestion ? String(nextWeightSuggestion!.next) : "";

  const canSavePreset =
    newPreset.trim().length > 0 && exercise.trim().length > 0;

  const helper = useMemo(() => {
    if (!exercise.trim()) return "Pick an exercise (or use a preset).";
    if (conflictWarning)
      return `Heads up: might aggravate injury${
        conflictWarning.alt ? ` • Try: ${conflictWarning.alt}` : ""
      }.`;
    if (hasSuggestion)
      return `Suggestion: ${nextStr} ${unit} (prev ${prevStr})`;
    return "Tap Add to log this exercise into your workout.";
  }, [exercise, conflictWarning, hasSuggestion, nextStr, prevStr, unit]);

  function incInt(v: string, d = 1, min = 0, max = 999) {
    const n = Number(v || 0);
    return String(Math.max(min, Math.min(max, n + d)));
  }
  function incDec(v: string, step: number) {
    const n = Number(v || 0);
    const out = Math.max(0, n + step);
    return String(Math.round(out * 10) / 10);
  }

  // date helpers
  function parseISOToDate(s: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return new Date();
    const [y, m, d] = s.split("-").map((x) => Number(x));
    return new Date(y, (m || 1) - 1, d || 1);
  }
  function toISO(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const iso = date || todayISO;
  const dateLabel = iso === todayISO ? "Today" : iso;

  const showTemplatesEntryPoint = templates?.length > 0 || !!onSaveTemplate; // keep prop-compat

  return (
    <Card style={{ paddingTop: 12, paddingBottom: 14 }}>
      {/* subtle glow behind */}
      <LinearGradient
        colors={[
          withAlpha(colors.primary, isDark ? 0.18 : 0.12),
          withAlpha(colors.card, 0),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: -30,
          left: -30,
          right: -30,
          height: 140,
          borderRadius: 26,
        }}
      />

      {/* Header */}
      <Row between style={{ marginBottom: 10 }}>
        <Row gap={10}>
          <Badge
            tint={withAlpha(colors.primary, 0.16)}
            border={withAlpha(colors.primary, 0.35)}
          >
            <Ionicons name="flash-outline" size={14} color={colors.primary} />
          </Badge>
          <View>
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
            >
              Quick Log
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              Adds an exercise into your current workout session
            </Text>
          </View>
        </Row>

        <Row gap={8}>
          <SoftIconButton
            icon="sparkles-outline"
            label="Presets"
            onPress={() => setSheet("presets")}
          />
          <SoftIconButton
            icon="calendar-outline"
            label={dateLabel}
            onPress={() => setSheet("date")}
          />
          <SoftIconButton
            icon="trash-outline"
            label="Clear"
            onPress={onClear}
            subtle
          />
        </Row>
      </Row>

      {/* MAIN glossy panel */}
      <GlassPanel>
        {/* Exercise row (tap-to-browse vibe) */}
        <Pressable
          onPress={onOpenSearch}
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.2),
          }}
        >
          <LinearGradient
            colors={[
              withAlpha(colors.primary, isDark ? 0.14 : 0.1),
              withAlpha(colors.text, 0.03),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 12 }}
          >
            <Row between>
              <Row gap={10} style={{ flex: 1 }}>
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={colors.text}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                      letterSpacing: 0.5,
                    }}
                  >
                    EXERCISE
                  </Text>

                  {/* keep typing support too */}
                  <View style={{ marginTop: 6 }}>
                    <Field
                      icon="create-outline"
                      placeholder="Search or type exercise…"
                      value={exercise}
                      onChangeText={setExercise}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </Row>

              <View style={{ marginLeft: 10 }}>
                <PillAction icon="search-outline" label="Browse" />
              </View>
            </Row>
          </LinearGradient>
        </Pressable>

        {/* helper */}
        <Row gap={8} style={{ marginTop: 10 }}>
          <Ionicons
            name={
              conflictWarning ? "warning-outline" : "information-circle-outline"
            }
            size={14}
            color={conflictWarning ? "#ef4444" : colors.muted}
          />
          <Text
            style={{
              color: conflictWarning ? "#ef4444" : colors.muted,
              fontSize: 12,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {helper}
          </Text>
        </Row>

        {/* scheme row */}
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.5,
            }}
          >
            SCHEME
          </Text>

          <Row gap={10} style={{ marginTop: 8 }}>
            <MetricTile
              label="Sets"
              value={sets || "0"}
              icon="layers-outline"
              onDec={() => setSets(incInt(sets, -1))}
              onInc={() => setSets(incInt(sets, 1))}
            />
            <MetricTile
              label="Reps"
              value={reps || "0"}
              icon="repeat-outline"
              onDec={() => setReps(incInt(reps, -1))}
              onInc={() => setReps(incInt(reps, 1))}
            />
          </Row>
        </View>

        {/* weight row */}
        <View style={{ marginTop: 12 }}>
          <Row between>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              WEIGHT
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {unit.toUpperCase()}
            </Text>
          </Row>

          <Row gap={10} style={{ marginTop: 8 }}>
            <RoundButton
              icon="remove-outline"
              onPress={() => setWeight(incDec(weight, -weightStep))}
            />
            <Field
              icon="speedometer-outline"
              inputMode="decimal"
              value={weight}
              onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
              style={{ flex: 1, height: 54 }}
              placeholder="0"
            />
            <RoundButton
              icon="add-outline"
              onPress={() => setWeight(incDec(weight, weightStep))}
            />
          </Row>

          {hasSuggestion && (
            <Row gap={10} style={{ marginTop: 10, flexWrap: "wrap" }}>
              <MiniCTA
                icon="refresh-outline"
                label={`Prev ${prevStr} ${unit}`}
                onPress={() => setWeight(prevStr)}
              />
              <MiniCTA
                icon="flash-outline"
                label={`Use ${nextStr} ${unit}`}
                onPress={() => setWeight(nextStr)}
              />
            </Row>
          )}
        </View>

        {/* notes + save preset */}
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.5,
            }}
          >
            NOTES
          </Text>
          <View style={{ marginTop: 8 }}>
            <Field
              icon="document-text-outline"
              placeholder="Optional notes (tempo, RPE, cues)…"
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Row between>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                SAVE AS PRESET
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                long-press preset to edit
              </Text>
            </Row>

            <Row gap={10} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Field
                  icon="bookmark-outline"
                  placeholder="Preset name…"
                  value={newPreset}
                  onChangeText={setNewPreset}
                />
              </View>

              <Pressable
                onPress={() => {
                  if (!canSavePreset) return;
                  onSavePreset({
                    name: newPreset.trim(),
                    exercise: exercise.trim(),
                    sets: Number(sets || 0),
                    reps: Number(reps || 0),
                    weight: Number(weight || 0),
                    notes: notes || "",
                  });
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: canSavePreset
                    ? withAlpha(colors.primary, 0.45)
                    : colors.border,
                  backgroundColor: canSavePreset
                    ? withAlpha(colors.primary, 0.14)
                    : withAlpha(colors.text, 0.05),
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Row gap={8}>
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color={canSavePreset ? colors.primary : colors.muted}
                  />
                  <Text
                    style={{
                      color: canSavePreset ? colors.text : colors.muted,
                      fontWeight: "900",
                    }}
                  >
                    Save
                  </Text>
                </Row>
              </Pressable>
            </Row>
          </View>
        </View>

        {/* Primary action */}
        <View style={{ marginTop: 14 }}>
          <GradientButton
            label="Add to Workout"
            onPress={onAdd}
            disabled={addDisabled}
          />
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Adds this exercise as a line item in the current workout session
          </Text>
        </View>

        {/* templates entry (tucked away) */}
        {showTemplatesEntryPoint && (
          <View style={{ marginTop: 12 }}>
            <Pressable
              onPress={() => setSheet("templates")}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: withAlpha(colors.text, 0.05),
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Row between>
                <Row gap={10}>
                  <Ionicons
                    name="copy-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    Templates (from Workouts page)
                  </Text>
                </Row>
                <Ionicons
                  name="chevron-up-outline"
                  size={16}
                  color={colors.muted}
                />
              </Row>
            </Pressable>
          </View>
        )}
      </GlassPanel>

      {/* Bottom sheets */}
      <BottomSheet
        visible={sheet === "presets"}
        title="Presets"
        subtitle="Tap to apply • Long-press to update/delete"
        onClose={() => setSheet(null)}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 12,
            paddingBottom: 10,
          }}
        >
          {suggested?.map((name) => (
            <PresetPill
              key={"sg-" + name}
              label={name}
              accent
              onPress={() => setExercise(name)}
            />
          ))}

          {safePresets?.map((p) => (
            <PresetPill
              key={p.id}
              label={p.name}
              onPress={() => {
                setExercise(p.name);
                if (p.sets !== undefined) setSets(String(p.sets));
                if (p.reps !== undefined) setReps(String(p.reps));
                if (p.weight !== undefined) {
                  const w =
                    unit === "lb"
                      ? Math.round(kgToLb(p.weight))
                      : Math.round(p.weight);
                  setWeight(w ? String(w) : "");
                }
                if (p.notes !== undefined) setNotes(p.notes);
              }}
              onLongPress={() =>
                RNAlert.alert("Preset options", p.name, [
                  {
                    text: "Update from current form",
                    onPress: () => onUpdatePreset(p.id),
                  },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => onDeletePreset(p.id),
                  },
                  { text: "Cancel", style: "cancel" },
                ])
              }
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "templates"}
        title="Templates"
        subtitle="Reusable workout layouts (kept here, but meant for the Workouts page)"
        onClose={() => setSheet(null)}
      >
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Row gap={10} style={{ marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                icon="create-outline"
                placeholder="Template name…"
                value={templateName}
                onChangeText={setTemplateName}
              />
            </View>

            <GradientButton
              label={templatesLocked ? "Unlock" : "Save"}
              onPress={() =>
                templatesLocked
                  ? onUpgradeTemplates?.()
                  : onSaveTemplate(templateName.trim())
              }
              disabled={!templateName.trim() || templatesLocked}
            />
          </Row>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {templates?.length ? (
              templates.map((t) => (
                <PresetPill
                  key={t.id}
                  label={t.name}
                  onPress={() =>
                    templatesLocked
                      ? onUpgradeTemplates?.()
                      : onApplyTemplate(t.id)
                  }
                  onLongPress={() =>
                    templatesLocked
                      ? onUpgradeTemplates?.()
                      : RNAlert.alert("Template options", t.name, [
                          {
                            text: "Apply",
                            onPress: () => onApplyTemplate(t.id),
                          },
                          {
                            text: "Overwrite with today",
                            onPress: () => onUpdateTemplate(t.id),
                          },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => onDeleteTemplate(t.id),
                          },
                          { text: "Cancel", style: "cancel" },
                        ])
                  }
                />
              ))
            ) : (
              <PresetPill label="No templates yet" onPress={() => {}} subtle />
            )}
          </ScrollView>

          {templatesLocked && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
              Templates are part of Pro.
            </Text>
          )}
        </View>
      </BottomSheet>

      <DateSheet
        visible={sheet === "date"}
        iso={iso}
        todayISO={todayISO}
        setDate={setDate}
        onClose={() => setSheet(null)}
        parseISOToDate={parseISOToDate}
        toISO={toISO}
      />
    </Card>
  );
}

/* ───────────────────────── UI building blocks ───────────────────────── */

function GlassPanel({ children }: React.PropsWithChildren) {
  const { colors, isDark } = useTheme();
  const content = (
    <View
      style={{ padding: 12, gap: 10, borderRadius: 18, overflow: "hidden" }}
    >
      {children}
    </View>
  );

  if (Platform.OS === "ios") {
    return (
      <View
        style={{
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <BlurView
          tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
          intensity={22}
        >
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={[
              withAlpha(colors.primary, isDark ? 0.09 : 0.06),
              withAlpha(colors.text, 0.03),
            ]}
            style={StyleSheet.absoluteFill}
          />
          {content}
        </BlurView>
      </View>
    );
  }

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      colors={[withAlpha(colors.primary, 0.06), withAlpha(colors.text, 0.03)]}
      style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border }}
    >
      {content}
    </LinearGradient>
  );
}

function Row({
  children,
  gap = 0,
  between = false,
  style,
}: React.PropsWithChildren<{ gap?: number; between?: boolean; style?: any }>) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap },
        between && { justifyContent: "space-between" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Badge({
  children,
  tint,
  border,
}: {
  children: React.ReactNode;
  tint: string;
  border: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: tint,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {children}
    </View>
  );
}

function SoftIconButton({
  icon,
  label,
  onPress,
  subtle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  subtle?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: subtle ? colors.border : withAlpha(colors.primary, 0.35),
        backgroundColor: subtle
          ? withAlpha(colors.text, 0.04)
          : withAlpha(colors.primary, 0.12),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={14}
        color={subtle ? colors.muted : colors.text}
      />
      <Text
        style={{
          color: subtle ? colors.muted : colors.text,
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PillAction({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: withAlpha(colors.text, 0.05),
      }}
    >
      <Row gap={8}>
        <Ionicons name={icon} size={14} color={colors.muted} />
        <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>
          {label}
        </Text>
      </Row>
    </View>
  );
}

function MetricTile({
  label,
  value,
  icon,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onDec: () => void;
  onInc: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: withAlpha(colors.text, 0.05),
          padding: 12,
        }}
      >
        <Row between>
          <Row gap={8}>
            <Ionicons name={icon} size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontWeight: "900" }}>
              {label}
            </Text>
          </Row>
          <Text
            style={{
              color: colors.text,
              fontSize: 22,
              fontWeight: "1000" as any,
            }}
          >
            {value || "0"}
          </Text>
        </Row>

        <Row gap={10} style={{ marginTop: 10 }}>
          <SmallRound icon="remove-outline" onPress={onDec} />
          <SmallRound icon="add-outline" onPress={onInc} />
        </Row>
      </View>
    </View>
  );
}

function SmallRound({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flex: 1,
        height: 40,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(colors.primary, 0.06),
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function RoundButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        height: 54,
        width: 54,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(colors.primary, 0.06),
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function MiniCTA({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, 0.35),
        backgroundColor: withAlpha(colors.primary, 0.12),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Row gap={8}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text
          style={{
            color: colors.primary,
            fontWeight: "1000" as any,
            fontSize: 12,
          }}
        >
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

function PresetPill({
  label,
  onPress,
  onLongPress,
  accent,
  subtle,
}: {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  accent?: boolean;
  subtle?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={8}
      style={({ pressed }) => ({
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: subtle
          ? colors.border
          : accent
          ? withAlpha(colors.primary, 0.35)
          : colors.border,
        backgroundColor: subtle
          ? withAlpha(colors.text, 0.05)
          : accent
          ? withAlpha(colors.primary, 0.14)
          : withAlpha(colors.text, 0.06),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

/* ───────────────────────── Bottom Sheet (glossy) ───────────────────────── */

function BottomSheet({
  visible,
  title,
  subtitle,
  children,
  onClose,
}: React.PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
}>) {
  const { colors, isDark } = useTheme();

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!visible) return null;

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={close}
    >
      <Pressable style={{ flex: 1 }} onPress={close}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFill,
            backgroundColor: "rgba(0,0,0,0.35)",
            opacity: backdropOpacity as any,
          }}
        />
      </Pressable>

      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateY }],
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.2),
              maxHeight: Math.min(SCREEN_H * 0.72, 520),
            }}
          >
            <BlurView
              tint={
                isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"
              }
              intensity={28}
            >
              <LinearGradient
                colors={[
                  withAlpha(colors.primary, isDark ? 0.14 : 0.1),
                  withAlpha(colors.text, 0.03),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                <View style={{ alignItems: "center", paddingBottom: 10 }}>
                  <View
                    style={{
                      width: 44,
                      height: 5,
                      borderRadius: 99,
                      backgroundColor: withAlpha(colors.text, 0.18),
                    }}
                  />
                </View>

                <Row
                  between
                  style={{ paddingHorizontal: 12, paddingBottom: 10 }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "1000" as any,
                        fontSize: 16,
                      }}
                    >
                      {title}
                    </Text>
                    {!!subtitle && (
                      <Text
                        style={{
                          color: colors.muted,
                          marginTop: 2,
                          fontSize: 12,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    onPress={close}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      height: 36,
                      width: 36,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.text, 0.05),
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Ionicons
                      name="close-outline"
                      size={18}
                      color={colors.text}
                    />
                  </Pressable>
                </Row>

                {children}
              </View>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

/* ───────────────────────── Date Sheet ───────────────────────── */

function DateSheet({
  visible,
  iso,
  todayISO,
  setDate,
  onClose,
  parseISOToDate,
  toISO,
}: {
  visible: boolean;
  iso: string;
  todayISO: string;
  setDate: (v: string) => void;
  onClose: () => void;
  parseISOToDate: (s: string) => Date;
  toISO: (d: Date) => string;
}) {
  const { colors } = useTheme();
  const [temp, setTemp] = useState<Date>(() => parseISOToDate(iso));

  useEffect(() => {
    if (visible) setTemp(parseISOToDate(iso));
  }, [visible, iso]);

  return (
    <BottomSheet
      visible={visible}
      title="Workout Date"
      subtitle="Usually Today — change only if you’re logging later"
      onClose={onClose}
    >
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
        <Row gap={10} style={{ flexWrap: "wrap" }}>
          <Pressable
            onPress={() => {
              setDate(todayISO);
              onClose();
            }}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.35),
              backgroundColor: withAlpha(colors.primary, 0.12),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.primary, fontWeight: "1000" as any }}>
              Today
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const d = new Date(parseISOToDate(todayISO));
              d.setDate(d.getDate() - 1);
              setDate(toISO(d));
              onClose();
            }}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.text, 0.05),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              Yesterday
            </Text>
          </Pressable>
        </Row>

        {DateTimePicker ? (
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: withAlpha(colors.text, 0.04),
            }}
          >
            <DateTimePicker
              value={temp}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              onChange={(_: any, d?: Date) => d && setTemp(d)}
            />
          </View>
        ) : (
          <Field
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={iso}
            onChangeText={setDate}
            autoCapitalize="none"
          />
        )}

        {DateTimePicker && (
          <Row gap={10} style={{ justifyContent: "flex-end" }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: withAlpha(colors.text, 0.05),
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setDate(toISO(temp));
                onClose();
              }}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.35),
                backgroundColor: withAlpha(colors.primary, 0.14),
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontWeight: "1000" as any }}>
                Set date
              </Text>
            </Pressable>
          </Row>
        )}
      </View>
    </BottomSheet>
  );
}
