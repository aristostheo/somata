import React from "react";
import { View, Text } from "react-native";

export function SectionHeader({
  title,
  subtitle,
  colors,
  right,
}: {
  title: string;
  subtitle?: string;
  colors: any;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.placeholder ?? colors.muted,
            fontWeight: "500",
            fontSize: 11,
            letterSpacing: 1,
          }}
        >
          {title.toUpperCase()}
        </Text>
        {!!subtitle && (
          <Text
            style={{
              color: colors.muted,
              fontWeight: "300",
              fontSize: 12,
              marginTop: 4,
              lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {!!right && <View style={{ flexShrink: 0 }}>{right}</View>}
    </View>
  );
}
