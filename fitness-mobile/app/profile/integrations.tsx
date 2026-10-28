import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { useAccountStorage } from '@/services/local/accountStore';
import { ConnectionsDesk } from "@/components/somata/ConnectionsDesk";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import { useAuth } from "@/content/AuthContext";
import {
  getGlobalSyncStatus,
  INTEGRATIONS,
  subscribeIntegrations,
  type ConflictPolicy,
  type IntegrationDef,
  type IntegrationSnapshot,
  type SyncFrequency
} from "@/services/integrations";

function useC() {
  const { colors, isDark } = useProfileFlowTheme();
  return {
    bg: colors.background,
    card: colors.surface1,
    card2: colors.surface2,
    text: colors.textPrimary,
    muted: colors.textTertiary,
    hairline: colors.border,
    purple: colors.primary as string,
    blue: isDark ? "#B9A4FA" : "#7051B5",
    green: colors.success as string,
    amber: colors.warning as string,
    red: colors.danger as string,
    gray: colors.surface3 as string,
    teal: colors.accent as string,
  };
}

function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(
    h.slice(4, 6),
    16
  )},${Math.max(0, Math.min(1, a))})`;
}

const frequencyOptions: SyncFrequency[] = [
  "30min",
  "1hour",
  "2hours",
  "4hours",
  "manual",
];

const conflictOptions: Array<{ key: ConflictPolicy; label: string; }> = [
  { key: "highest", label: "Highest value" },
  { key: "recent", label: "Most recent" },
  { key: "apple", label: "Prefer Apple Health" },
  { key: "ask", label: "Ask me" },
];

function ringConnPlatformLabel() {
  return Platform.OS === "ios" ? "Apple Health" : "Health Connect";
}

function IntegrationsScreen() {
  const localStore = useAccountStorage();
  const C = useC();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot>({
    connections: {},
    settings: {
      autoSync: true,
      frequency: "1hour",
      conflictPolicy: "highest",
      backgroundSync: true,
      activeCaloriesAdjustment: false,
      onboardingDone: false,
      cellularSync: false,
      lowBatteryPause: true,
      syncOnAppOpen: true,
      cellularPolicy: "wifi_only",
      history: [],
    },
  });
  const [detail, setDetail] = useState<IntegrationDef | null>(null);
  const [perfExpanded, setPerfExpanded] = useState(false);

  useEffect(() => subscribeIntegrations(setSnapshot, localStore), []);

  const health = INTEGRATIONS.filter((x) => x.group === "health");
  const wearables = INTEGRATIONS.filter((x) => x.group === "wearable");
  const scales = INTEGRATIONS.filter((x) => x.group === "scale");
  const syncState = getGlobalSyncStatus(snapshot);

  return (<ConnectionsDesk snapshot={snapshot} uid={user?.uid} onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
    onHistory={() => router.push('/profile/sync-history')} />
  );
}

function SettingLabel({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const C = useC();
  return (
    <View style={{ gap: 3 }}>

      <Text style={{ color: C.text, fontWeight: "600" }}>{title}</Text>

      {subtitle ? (
        <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 17 }}>
          {subtitle}
        </Text>
      ) : null}

    </View>
  );
}

function iconButton(C: ReturnType<typeof useC>) {
  return {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 0,
    borderColor: C.hairline,
    backgroundColor: C.card2,
  };
}

function primaryButton(C: ReturnType<typeof useC>) {
  return {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: alpha(C.purple, 0.24),
    borderWidth: 0,
    borderColor: alpha(C.purple, 0.38),
  };
}

export default function PremiumIntegrationsScreen() {
  return <SomataTaskAppearance><IntegrationsScreen /></SomataTaskAppearance>;
}
