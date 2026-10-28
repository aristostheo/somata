// app/(auth)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useAuthColors } from "@/components/somata/AuthControls";

export default function AuthLayout() {
  const { colors: C } = useAuthColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // keep the background consistent with your theme
        contentStyle: { backgroundColor: C.bg },
      }}
    />
  );
}
