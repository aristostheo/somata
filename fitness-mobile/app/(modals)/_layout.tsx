// =============================
// FILE: app/(modals)/_layout.tsx
// =============================
import React from "react";
import { Stack } from "expo-router";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: "modal",
        headerShown: false,
      }}
    >
      <Stack.Screen name="coach-spark" />
      <Stack.Screen name="full-calendar" />
      <Stack.Screen name="progress-photos" />
      <Stack.Screen name="weekly-checkin" />
    </Stack>
  );
}
