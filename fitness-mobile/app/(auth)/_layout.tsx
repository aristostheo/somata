// app/(auth)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useSomataTheme } from "@/components/somata/theme";

export default function AuthLayout() {
  const { D } = useSomataTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // keep the background consistent with your theme
        contentStyle: { backgroundColor: D.bg },
      }}
    />
  );
}
