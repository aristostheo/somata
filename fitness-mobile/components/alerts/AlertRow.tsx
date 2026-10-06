import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AlertItem } from "./types";
import { formatTime } from "./logic";

type Props = {
  item: AlertItem;
  colors: any;
  isDark: boolean;
  reduceMotion: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function AlertRow({ item, colors, onPress, onLongPress }: Props) {
  const time = useMemo(() => formatTime(item.createdAt), [item.createdAt]);
  const icon = useMemo(() => getIcon(item), [item]);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.wrap}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <View style={[styles.iconBubble, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
            <Ionicons name={icon} size={18} color={colors.textSecondary} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!!item.body && (
              <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.body}
              </Text>
            )}
            <Text style={[styles.meta, { color: colors.textTertiary }]}>{time}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function getIcon(item: AlertItem): any {
  if (item.source === "friend") return "person-outline";
  switch (item.kind) {
    case "streak_milestone":
      return "flame-outline";
    case "workout_reminder":
      return "barbell-outline";
    case "nutrition_nudge":
      return "restaurant-outline";
    case "goal_progress":
      return "checkmark-outline";
    case "recovery_tip":
      return "sparkles-outline";
    default:
      return "notifications-outline";
  }
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
  },
  body: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "300",
  },
  meta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "300",
  },
});
