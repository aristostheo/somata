import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function AlertsEmptyState({
  colors,
}: {
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons
        name="notifications-off-outline"
        size={32}
        color={colors.textTertiary}
      />
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Nothing here yet
      </Text>
      <Text style={[styles.body, { color: colors.textTertiary }]}>
        Friend activity and app updates will appear here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "400",
  },
  body: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "300",
    textAlign: "center",
  },
});
