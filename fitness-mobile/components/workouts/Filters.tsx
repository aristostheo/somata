import { dayKey } from "@/utils/date";
// components/workouts/Filters.tsx (makeover)
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "./utils/withAlpha";
import { Field } from "./ui/Field";

type PresetKey = "all" | "week" | "7" | "month" | "30";

export default function Filters({
  preset,
  setPreset,
  from,
  to,
  setFrom,
  setTo,
}: {
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  const { colors } = useTheme();

  const summary = useMemo(() => {
    const map: Record<PresetKey, string> = {
      all: "All time",
      week: "This week",
      "7": "Last 7 days",
      month: "This month",
      "30": "Last 30 days",
    };
    const base = map[preset] ?? "Custom";
    if (from || to) {
      const span = (from ? from : "…") + " → " + (to ? to : "…");
      return `${base} • ${span}`;
    }
    return base;
  }, [preset, from, to]);

  const presets: Array<[PresetKey, keyof typeof Ionicons.glyphMap, string]> = [
    ["all", "infinite-outline", "All"],
    ["week", "calendar-outline", "Week"],
    ["7", "time-outline", "7d"],
    ["month", "calendar-number-outline", "Month"],
    ["30", "hourglass-outline", "30d"],
  ];

  const chipBase = {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  } as const;

  function setToday() {
    const d = new Date();
    const s = dayKey(d);
    setFrom(s);
    setTo(s);
  }
  function setYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const s = dayKey(d);
    setFrom(s);
    setTo(s);
  }
  function clearDates() {
    setFrom("");
    setTo("");
  }

  return (
    <LinearGradient
      colors={[withAlpha(colors.card, 0.9), withAlpha(colors.card, 0.98)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.7),
        gap: 12,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.35),
          }}
        >
          <Ionicons name="funnel-outline" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            Filter workouts
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
          >
            {summary}
          </Text>
        </View>
        {(from || to || preset !== "all") && (
          <Pressable
            onPress={() => {
              setPreset("all");
              clearDates();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: withAlpha(colors.text, 0.06),
              borderWidth: 1,
              borderColor: withAlpha(colors.text, 0.12),
            }}
          >
            <Ionicons name="refresh-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
              Reset
            </Text>
          </Pressable>
        )}
      </View>

      {/* Preset pills */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {presets.map(([p, icon, label], idx) => {
          const active = preset === p;
          return (
            <MotiView
              key={p}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 240, delay: 25 * idx }}
            >
              <Pressable
                onPress={() => setPreset(p)}
                hitSlop={8}
                style={{
                  ...chipBase,
                  backgroundColor: active
                    ? withAlpha(colors.primary, 0.22)
                    : withAlpha(colors.text, 0.04),
                  borderColor: active
                    ? withAlpha(colors.primary, 0.4)
                    : withAlpha(colors.border, 0.9),
                }}
              >
                <Ionicons
                  name={icon}
                  size={14}
                  color={active ? colors.primary : colors.muted}
                />
                <Text
                  style={{
                    color: active ? colors.primary : colors.text,
                    fontWeight: active ? "900" : "700",
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            </MotiView>
          );
        })}
      </View>

      {/* Quick shortcuts */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ShortcutChip icon="sunny-outline" label="Today" onPress={setToday} />
        <ShortcutChip icon="moon-outline" label="Yesterday" onPress={setYesterday} />
        {(from || to) && (
          <ShortcutChip icon="close-outline" label="Clear dates" onPress={clearDates} dim />
        )}
      </View>

      {/* Custom range */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
          Custom range
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={from}
            onChangeText={setFrom}
          />
          <Field
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={to}
            onChangeText={setTo}
          />
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
          Tip: presets set dates automatically; custom range overrides them.
        </Text>
      </View>
    </LinearGradient>
  );
}

function ShortcutChip({
  icon,
  label,
  onPress,
  dim,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  dim?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: dim
          ? withAlpha(colors.text, 0.05)
          : withAlpha(colors.primary, 0.08),
        borderColor: dim
          ? withAlpha(colors.text, 0.12)
          : withAlpha(colors.primary, 0.25),
      }}
    >
      <Ionicons name={icon} size={14} color={dim ? colors.muted : colors.primary} />
      <Text
        style={{
          color: dim ? colors.muted : colors.text,
          fontWeight: "800",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
