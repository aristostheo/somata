import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SomataSymbol } from "@/components/brand/Brand";
import { createSemanticTokens } from "@/services/theme/semanticTokens";

/** Presentation only. Safe before ThemeProvider; never mounts private children. */
export function StartupSurface({ dark, preparing = false, failed = false, onRetry }: {
  dark: boolean; preparing?: boolean; failed?: boolean; onRetry?: () => void;
}) {
  const t = createSemanticTokens(dark);
  const content = <SafeAreaView style={{ flex: 1, backgroundColor: t.surface.canvas }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", alignItems: "center", gap: 20 }}>
        <SomataSymbol size={120} />
        {failed ? <>
          <Text accessibilityRole="alert" style={{ ...t.typography.body, color: t.text.primary, textAlign: "center" }}>
            Could not prepare private device data and reminders. Retry before opening another account.
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry secure account switch"
            style={({ pressed }) => ({ minHeight: t.layout.minTouchTarget, width: "100%", borderRadius: t.radius.control,
              padding: 16, backgroundColor: pressed ? t.action.primary.pressed : t.action.primary.background })}>
            <Text style={{ ...t.typography.label, color: t.action.primary.foreground, textAlign: "center" }}>Retry secure account switch</Text>
          </Pressable>
        </> : <>
          <ActivityIndicator color={t.action.link} accessibilityLabel={preparing ? "Preparing your account" : "Loading Somata"} />
          <Text accessibilityLiveRegion="polite" style={{ ...t.typography.body, color: t.text.secondary, textAlign: "center" }}>
            {preparing ? "Preparing your account…" : "Loading Somata…"}
          </Text>
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>;
  // Auth preparation precedes the application's safe-area provider. This local
  // provider covers only the gate, never changes the private provider hierarchy.
  return preparing ? <SafeAreaProvider style={{ flex: 1 }}>{content}</SafeAreaProvider> : content;
}
