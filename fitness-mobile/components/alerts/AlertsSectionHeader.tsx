import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/content/ThemeProvider";

export function AlertsSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme() as any;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: colors.textTertiary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sub, { color: colors.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sub: {
    fontSize: 11,
    fontWeight: "300",
  },
});
