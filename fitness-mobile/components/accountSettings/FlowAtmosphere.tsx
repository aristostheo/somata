import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { withAlpha } from "@/lib/color";
import { useProfileFlowTheme } from "./useProfileFlowTheme";

export function FlowAtmosphere() {
  const { colors, isDark } = useProfileFlowTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={isDark ? ["#090E20", "#121B37", "#090E20"] : ["#F6F1EA", "#EFE8F5", "#F6F1EA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: "absolute", width: 235, height: 235, borderRadius: 118, right: -127, top: -81, backgroundColor: withAlpha(colors.primary, isDark ? 0.13 : 0.1) }} />
      <View style={{ position: "absolute", width: 181, height: 181, borderRadius: 91, left: -100, top: 360, backgroundColor: withAlpha(colors.accent, isDark ? 0.09 : 0.08) }} />
    </View>
  );
}
