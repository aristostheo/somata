import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { withAlpha } from "@/lib/color";

export type FriendsTabKey = "friends" | "requests" | "sent";

export function PremiumSegmented({
  value,
  onChange,
  requestCount = 0,
}: {
  value: FriendsTabKey;
  onChange: (v: FriendsTabKey) => void;
  requestCount?: number;
}) {
  const { colors } = useProfileFlowTheme();

  const items: Array<{ key: FriendsTabKey; label: string }> = [
    { key: "friends", label: "Friends" },
    { key: "requests", label: "Requests" },
    { key: "sent", label: "Sent" },
  ];

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {items.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(item.key);
            }}
            style={styles.item}
          >
            <View style={styles.labelRow}>
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.textPrimary : colors.textTertiary },
                ]}
              >
                {item.label}
              </Text>
              {item.key === "requests" && requestCount > 0 ? (
                <View
                  style={[
                    styles.badgeDot,
                    { backgroundColor: colors.danger },
                  ]}
                />
              ) : null}
            </View>
            <View
              style={[
                styles.underline,
                {
                  opacity: active ? 1 : 0,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
  underline: {
    width: 28,
    height: 2,
    borderRadius: 999,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});
