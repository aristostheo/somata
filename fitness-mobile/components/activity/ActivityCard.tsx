// components/activity/ActivityCard.tsx

import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

import { useTheme } from "@/content/ThemeProvider";
import { withAlpha } from "@/lib/color";

// Use your existing Card component if you have one.
// If you don't, replace <Card> with a <View style={...}>.
import Card from "@/components/Card";

import ActivityLogSheet from "./ActivityLogSheet";
import type {
  ActivityEntry,
  ActivityGoal,
  ActivityIntensity,
  ActivityType,
} from "./activityTypes";
import {
  formatTime,
  intensityLabel,
  labelForType,
  sumToday,
} from "./activityUtils";

type Props = {
  entries: ActivityEntry[];
  goal?: ActivityGoal;

  // “Controlled” persistence hooks
  onCreate: (entry: ActivityEntry) => void;
  onUpdate: (entry: ActivityEntry) => void;
  onDelete: (id: string) => void;

  // UI knobs
  title?: string;
  subtitle?: string;
  presets?: Array<{
    type: ActivityType;
    minutes: number;
    intensity: ActivityIntensity;
    label?: string;
  }>;
};

export default function ActivityCard({
  entries,
  goal = { minutesPerDay: 30 },
  onCreate,
  onUpdate,
  onDelete,
  title = "Activity",
  subtitle = "Optional • gentle momentum",
  presets,
}: Props) {
  const { colors, isDark } = useTheme();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityEntry | null>(null);

  const { today, minutes, calories, steps } = useMemo(
    () => sumToday(entries),
    [entries]
  );

  const goalMinutes = goal.minutesPerDay ?? 0;
  const progress = goalMinutes > 0 ? Math.min(1, minutes / goalMinutes) : 0;

  const recent = useMemo(() => {
    return [...entries]
      .filter((entry) => (entry.minutes || 0) > 0 || (entry.steps || 0) > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
  }, [entries]);

  const quickPresets =
    presets && presets.length
      ? presets
      : [
          {
            type: "walk" as const,
            minutes: 10,
            intensity: "easy" as const,
            label: "Walk 10",
          },
          {
            type: "run" as const,
            minutes: 20,
            intensity: "moderate" as const,
            label: "Run 20",
          },
          {
            type: "bike" as const,
            minutes: 20,
            intensity: "moderate" as const,
            label: "Bike 20",
          },
        ];

  const estimateKcal = (type: ActivityType, minutes: number) => {
    const rate =
      type === "walk"
        ? 4
        : type === "run"
          ? 10
          : type === "bike"
            ? 8
            : type === "swim"
              ? 8
              : 11;
    return Math.round(minutes * rate);
  };

  function hapticLight() {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }

  const subtleBorder = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: withAlpha(colors.border, isDark ? 0.22 : 0.55),
    }),
    [colors.border, isDark]
  );

  return (
    <>
      <Card style={[{ padding: 14, borderRadius: 22 }, subtleBorder]}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 2 }}>
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}
            >
              {title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }}>
              {subtitle}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              hapticLight();
              setEditing(null);
              setSheetOpen(true);
            }}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, isDark ? 0.32 : 0.26),
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            accessibilityRole="button"
            accessibilityLabel="Log activity"
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text
              style={{ color: colors.primary, fontWeight: "500", fontSize: 13 }}
            >
              Log
            </Text>
          </Pressable>
        </View>

        {/* Today Summary */}
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
            >
              <Text
                style={{ color: colors.text, fontSize: 28, fontWeight: "200" }}
              >
                {minutes}
              </Text>
              <Text
                style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }}
              >
                min today
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.text, fontWeight: "200", fontSize: 28 }}>
                  {calories || 0}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "300" }}>cals</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.text, fontWeight: "200", fontSize: 28 }}>
                  {steps || 0}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "300" }}>steps</Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          {goalMinutes > 0 ? (
            <View style={{ marginTop: 10 }}>
              <View
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: withAlpha(colors.card, isDark ? 0.28 : 0.72),
                  borderWidth: 1,
                  borderColor: withAlpha(colors.border, isDark ? 0.22 : 0.55),
                  overflow: "hidden",
                }}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Activity minutes progress"
                accessibilityValue={{
                  min: 0,
                  max: goalMinutes,
                  now: minutes,
                  text: `${minutes} of ${goalMinutes} minutes`,
                }}
              >
                <MotiView
                  from={{ width: "0%" }}
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ type: "timing", duration: 420 }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                backgroundColor: colors.info,
                  }}
                />
              </View>

              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                Goal: {goalMinutes} min •{" "}
                {progress >= 1 ? "Nice." : "Small adds count."}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Quick actions (gentle + optional) */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {quickPresets.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => {
                hapticLight();
                onCreate({
                  id: `act_${Math.random()
                    .toString(16)
                    .slice(2)}_${Date.now().toString(16)}`,
                  type: p.type,
                  minutes: p.minutes,
                  intensity: p.intensity,
                  timestamp: Date.now(),
                });
              }}
            style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: withAlpha(colors.border, isDark ? 0.22 : 0.55),
                alignItems: "center",
                gap: 3,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Quick add ${p.label}`}
            >
              <Text
                style={{ color: colors.text, fontWeight: "500", fontSize: 12 }}
              >
                {p.label || `${labelForType(p.type)} ${p.minutes}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "300" }}>
                ~{estimateKcal(p.type, p.minutes)} kcal
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Recent */}
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              RECENT
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setEditing(null);
                setSheetOpen(true);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open activity logger"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </View>

          {recent.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Nothing logged yet — and that’s okay.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {recent.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    hapticLight();
                    setEditing(e);
                    setSheetOpen(true);
                  }}
                  onLongPress={() => {
                    hapticLight();
                    Alert.alert(
                      "Remove activity?",
                      "This will delete the entry.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => onDelete(e.id),
                        },
                      ]
                    );
                  }}
              style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.surface2,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.border, isDark ? 0.22 : 0.55),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${labelForType(e.type)} ${
                    e.minutes
                  } minutes at ${formatTime(e.timestamp)}`}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Ionicons name="pulse-outline" size={16} color={colors.muted} />
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: colors.text, fontWeight: "500" }}>
                        {labelForType(e.type)} • {e.minutes} min
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "300" }}>
                        {intensityLabel(e.intensity)} •{" "}
                        {formatTime(e.timestamp)}
                      </Text>
                    </View>
                  </View>

                  <Ionicons name="pencil" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Card>

      <ActivityLogSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        goal={goal}
        presets={presets}
      />
    </>
  );
}
