import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/content/AuthContext";
import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import {
  connectedCount,
  describeSyncInterval,
  formatLastSync,
  formatSyncInterval,
  getConnectionSyncLabel,
  getGlobalSyncStatus,
  INTEGRATIONS,
  markPrimaryIntegration,
  runIntegrationSync,
  setIntegrationConnected,
  subscribeIntegrations,
  syncHealth,
  updateIntegrationConnection,
  updateIntegrationSettings,
  type ConflictPolicy,
  type IntegrationConnection,
  type IntegrationDef,
  type IntegrationLatestValues,
  type IntegrationSnapshot,
  type SyncFrequency,
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

const conflictOptions: Array<{ key: ConflictPolicy; label: string }> = [
  { key: "highest", label: "Highest value" },
  { key: "recent", label: "Most recent" },
  { key: "apple", label: "Prefer Apple Health" },
  { key: "ask", label: "Ask me" },
];

function ringConnPlatformLabel() {
  return Platform.OS === "ios" ? "Apple Health" : "Health Connect";
}

export default function IntegrationsScreen() {
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

  useEffect(() => subscribeIntegrations(setSnapshot), []);

  const health = INTEGRATIONS.filter((x) => x.group === "health");
  const wearables = INTEGRATIONS.filter((x) => x.group === "wearable");
  const scales = INTEGRATIONS.filter((x) => x.group === "scale");
  const syncState = getGlobalSyncStatus(snapshot);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlowAtmosphere />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 44,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header
          syncState={syncState}
          onBack={() => router.replace("/(tabs)/profile")}
        />
        <InfoBanner />

        {!snapshot.settings.onboardingDone ? (
          <OnboardingCard
            onDone={() => updateIntegrationSettings({ onboardingDone: true })}
          />
        ) : null}

        <SyncSettingsCard
          snapshot={snapshot}
          uid={user?.uid}
          perfExpanded={perfExpanded}
          onTogglePerf={() => setPerfExpanded((v) => !v)}
          onOpenHistory={() => router.push("/profile/sync-history")}
        />

        <Section title="Primary Health Platforms">
          {health.map((x) => (
            <IntegrationCard
              key={x.id}
              item={x}
              snapshot={snapshot}
              uid={user?.uid}
              onDetail={() => setDetail(x)}
              onConnect={() => {
                if (x.id === "ringconn") {
                  if (
                    (Platform.OS === "ios" && snapshot.connections.apple_health?.connected) ||
                    (Platform.OS === "android" && snapshot.connections.google_fit?.connected)
                  ) {
                    setDetail(x);
                  } else {
                    setDetail(
                      INTEGRATIONS.find((item) => item.id === "apple_health") || x
                    );
                  }
                  return;
                }
                setIntegrationConnected(x.id, true, user?.uid).catch(() => {});
              }}
            />
          ))}
          <Note text="⚠ If both apps log food, disable one to avoid duplicates." />
        </Section>

        <Section title="Wearable Devices">
          {wearables.map((x) => (
            <IntegrationCard
              key={x.id}
              item={x}
              snapshot={snapshot}
              uid={user?.uid}
              onDetail={() => setDetail(x)}
              onConnect={() =>
                setIntegrationConnected(x.id, true, user?.uid).catch(() => {})
              }
            />
          ))}
        </Section>

        <Section title="Smart Scale Integrations">
          {scales.map((x) => (
            <IntegrationCard
              key={x.id}
              item={x}
              snapshot={snapshot}
              uid={user?.uid}
              onDetail={() => setDetail(x)}
              onConnect={() =>
                setIntegrationConnected(x.id, true, user?.uid).catch(() => {})
              }
            />
          ))}
          <Note text="New weigh-ins update Profile body metrics and feed Long-term Progress." />
        </Section>

        <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 18 }}>
          Connected sources update Home steps and burn, Recovery on Home and
          Workouts, Nutrition calorie adjustments, detected Workouts, Insights
          trends, and Profile auto-filled health fields through the sync layer.
        </Text>
      </ScrollView>

      <DetailSheet
        item={detail}
        snapshot={snapshot}
        uid={user?.uid}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

function Header({
  onBack,
  syncState,
}: {
  onBack: () => void;
  syncState: ReturnType<typeof getGlobalSyncStatus>;
}) {
  const C = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        onPress={onBack}
        style={iconButton(C)}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={20} color={C.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: "700", fontSize: 30 }}>
          Integrations
        </Text>
        <Text
          style={{
            color: C.muted,
            fontWeight: "400",
            marginTop: 3,
            lineHeight: 18,
          }}
        >
          Connected apps sync automatically in the background. Your data stays
          private.
        </Text>
      </View>
      <View
        style={{
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: alpha(
            syncState.tone === "red"
              ? C.red
              : syncState.tone === "yellow"
              ? C.amber
              : syncState.tone === "green"
              ? C.green
              : C.gray,
            0.32
          ),
          backgroundColor: alpha(
            syncState.tone === "red"
              ? C.red
              : syncState.tone === "yellow"
              ? C.amber
              : syncState.tone === "green"
              ? C.green
              : C.gray,
            0.12
          ),
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          maxWidth: 168,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor:
              syncState.tone === "red"
                ? C.red
                : syncState.tone === "yellow"
                ? C.amber
                : syncState.tone === "green"
                ? C.green
                : C.muted,
          }}
        />
        <Text
          style={{
            color: C.text,
            fontWeight: "600",
            fontSize: 11,
            flexShrink: 1,
          }}
          numberOfLines={2}
        >
          {syncState.text}
        </Text>
      </View>
    </View>
  );
}

function InfoBanner() {
  const C = useC();
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: alpha(C.blue, 0.28),
        backgroundColor: alpha(C.blue, 0.1),
        padding: 12,
        flexDirection: "row",
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16 }}>ℹ️</Text>
      <Text style={{ color: C.text, fontWeight: "500", flex: 1, lineHeight: 18 }}>
        We only read data you approve. Nothing is shared without your
        permission.
      </Text>
    </View>
  );
}

function OnboardingCard({
  onDone }: { onDone: () => void }) {
  const C = useC();
  const steps = [
    ["Choose your sources", "Select which apps and devices you use."],
    ["Approve permissions", "We request only what you select."],
    ["Done", "Your data syncs automatically."],
  ];
  return (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: alpha(C.purple, 0.24),
        padding: 14,
        gap: 12,
      }}
    >
      <Text style={{ color: C.text, fontWeight: "600", fontSize: 17 }}>
        Set up health sync
      </Text>
      {steps.map((s, i) => (
        <View
          key={s[0]}
          style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: alpha(C.purple, 0.22),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600" }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "600" }}>{s[0]}</Text>
            <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
              {s[1]}
            </Text>
          </View>
        </View>
      ))}
      <Pressable onPress={onDone} style={primaryButton(C)}>
        <Text style={{ color: C.text, fontWeight: "600" }}>
          Start choosing sources
        </Text>
      </Pressable>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const C = useC();
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          color: C.muted,
          fontWeight: "600",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function SyncSettingsCard({
  snapshot,
  uid,
  perfExpanded,
  onTogglePerf,
  onOpenHistory,
}: {
  snapshot: IntegrationSnapshot;
  uid?: string;
  perfExpanded: boolean;
  onTogglePerf: () => void;
  onOpenHistory: () => void;
}) {
  const C = useC();
  const syncState = getGlobalSyncStatus(snapshot);
  return (
    <Section title="Sync Settings">
      <View
        style={{
          borderRadius: 18,
          backgroundColor: C.card,
          borderWidth: 0,
          borderColor: C.hairline,
          padding: 14,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 18 }}>
              Auto Sync
            </Text>
            <Text style={{ color: C.muted, fontWeight: "500", marginTop: 3 }}>
              Keep your data fresh without lifting a finger
            </Text>
          </View>
          <Switch
            value={snapshot.settings.autoSync}
            onValueChange={(v) => updateIntegrationSettings({ autoSync: v })}
            trackColor={{ false: C.gray, true: alpha(C.purple, 0.42) }}
            thumbColor={snapshot.settings.autoSync ? C.purple : C.gray}
          />
        </View>

        <View
          style={{
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: alpha(
              syncState.tone === "red"
                ? C.red
                : syncState.tone === "yellow"
                ? C.amber
                : syncState.tone === "green"
                ? C.green
                : C.gray,
              0.28
            ),
            backgroundColor: alpha(
              syncState.tone === "red"
                ? C.red
                : syncState.tone === "yellow"
                ? C.amber
                : syncState.tone === "green"
                ? C.green
                : C.gray,
              0.1
            ),
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor:
                syncState.tone === "red"
                  ? C.red
                  : syncState.tone === "yellow"
                  ? C.amber
                  : syncState.tone === "green"
                  ? C.green
                  : C.muted,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "600" }}>
              {syncState.text}
            </Text>
            <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
              {snapshot.settings.autoSync
                ? `Global interval: ${formatSyncInterval(snapshot.settings.frequency)}`
                : "Manual sync only — tap 'Sync now' on any integration"}
            </Text>
          </View>
        </View>

        <SettingLabel title="Sync interval" />
        <Segmented
          value={snapshot.settings.frequency}
          options={frequencyOptions.map((x) => ({
            key: x,
            label: formatSyncInterval(x),
          }))}
          onChange={(v) =>
            updateIntegrationSettings({ frequency: v as SyncFrequency })
          }
        />
        <Text style={{ color: C.muted, fontWeight: "500" }}>
          {describeSyncInterval(snapshot.settings.frequency)}
        </Text>

        <Pressable
          onPress={onTogglePerf}
          style={{
            borderTopWidth: 1,
            borderTopColor: C.hairline,
            paddingTop: 12,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text style={{ color: C.text, fontWeight: "600", flex: 1 }}>
            Battery & Performance
          </Text>
          <Ionicons
            name={perfExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={C.text}
          />
        </Pressable>

        {perfExpanded ? (
          <View style={{ gap: 12 }}>
            <ToggleRow
              title="Sync when app is closed"
              subtitle={
                snapshot.settings.backgroundSync
                  ? "Uses minimal battery. Estimated impact: <1% per day."
                  : "Sync only when app is open."
              }
              value={snapshot.settings.backgroundSync}
              onChange={(v) => updateIntegrationSettings({ backgroundSync: v })}
            />
            <ToggleRow
              title="Sync on mobile data"
              subtitle="Turn on to sync without Wi-Fi."
              value={snapshot.settings.cellularSync}
              onChange={(v) => updateIntegrationSettings({ cellularSync: v })}
            />
            <ToggleRow
              title="Pause sync below 20% battery"
              subtitle="Reduces background churn when your device is low."
              value={snapshot.settings.lowBatteryPause}
              onChange={(v) => updateIntegrationSettings({ lowBatteryPause: v })}
            />
            <ToggleRow
              title="Always sync when opening the app"
              subtitle="Recommended. Pulls fresh data as soon as you return."
              value={snapshot.settings.syncOnAppOpen}
              onChange={(v) => updateIntegrationSettings({ syncOnAppOpen: v })}
            />
          </View>
        ) : null}

        <SettingLabel
          title="Data conflict resolution"
          subtitle="If two sources report different step counts, which wins?"
        />
        <Segmented
          value={snapshot.settings.conflictPolicy}
          options={conflictOptions}
          onChange={(v) =>
            updateIntegrationSettings({ conflictPolicy: v as ConflictPolicy })
          }
        />

        <View style={{ borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: 12, gap: 10 }}>
          <Text style={{ color: C.text, fontWeight: "600" }}>Last full sync</Text>
          <Text style={{ color: C.muted, fontWeight: "500" }}>
            All sources last synced: {formatLastSync(snapshot.settings.lastFullSyncAt)}
          </Text>
          <Pressable
            onPress={() => runIntegrationSync(uid, { reason: "manual", force: true })}
            style={primaryButton(C)}
          >
            <Text style={{ color: C.text, fontWeight: "600" }}>Sync now →</Text>
          </Pressable>
          <Pressable
            onPress={onOpenHistory}
            style={{
              minHeight: 42,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: C.card2,
              borderWidth: 1,
              borderColor: C.hairline,
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600" }}>Sync history →</Text>
          </Pressable>
        </View>
      </View>
    </Section>
  );
}

function IntegrationCard({
  item,
  snapshot,
  uid,
  onDetail,
  onConnect,
}: {
  item: IntegrationDef;
  snapshot: IntegrationSnapshot;
  uid?: string;
  onDetail: () => void;
  onConnect: () => void;
}) {
  const C = useC();
  const conn = snapshot.connections[item.id];
  const appleConn = snapshot.connections.apple_health;
  const connected = !!conn?.connected;
  const status = conn?.status || "disconnected";
  const implemented = item.id === "apple_health" || item.id === "ringconn";
  const hiddenByPlatform =
    (item.platform === "ios" && Platform.OS !== "ios") ||
    (item.platform === "android" && Platform.OS !== "android");
  const disabled = hiddenByPlatform || (!implemented && !connected);
  const syncLabel = getConnectionSyncLabel(snapshot, conn);
  const statusColor =
    status === "error"
      ? C.red
      : status === "warning"
      ? C.amber
      : status === "syncing"
      ? C.amber
      : connected
      ? C.green
      : C.muted;
  const battery = conn?.latestValues?.batteryLevel ?? conn?.batteryLevel;
  const isRingConn = item.id === "ringconn";
  const healthDependencyConnected =
    Platform.OS === "ios"
      ? !!appleConn?.connected
      : !!snapshot.connections.google_fit?.connected;
  const ringDetected = !!conn?.connected;
  const ringStatusText = !healthDependencyConnected
    ? `Requires ${ringConnPlatformLabel()}`
    : ringDetected
    ? `Active via ${ringConnPlatformLabel()}`
    : "Not detected · See setup guide";

  return (
    <Pressable
      onPress={onDetail}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} details`}
      style={({ pressed }) => ({
        borderRadius: 18,
        borderWidth: 0,
        borderColor: status === "error" ? alpha(C.red, 0.35) : C.hairline,
        backgroundColor: pressed ? C.card2 : C.card,
        padding: 14,
        gap: 10,
        opacity: hiddenByPlatform ? 0.58 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 17,
            backgroundColor: item.iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={item.icon as any} size={22} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>
              {item.name}
            </Text>
            {item.badge ? <Chip text={item.badge} color={C.purple} /> : null}
            {conn?.primary ? <Chip text="Primary source" color={C.purple} /> : null}
          </View>
          <Text
            style={{ color: C.muted, fontWeight: "500", marginTop: 4 }}
            numberOfLines={2}
          >
            {hiddenByPlatform
              ? `Available on ${item.platform === "ios" ? "iOS" : "Android"}`
              : !implemented && !connected
              ? "Coming soon. Apple Health and RingConn are the first live integrations."
              : item.description}
          </Text>
        </View>
        {isRingConn ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: alpha(
                !healthDependencyConnected
                  ? C.amber
                  : ringDetected
                  ? C.green
                  : C.amber,
                0.32
              ),
              backgroundColor: alpha(
                !healthDependencyConnected
                  ? C.amber
                  : ringDetected
                  ? C.green
                  : C.amber,
                0.12
              ),
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 11 }}>
              {ringStatusText}
            </Text>
          </View>
        ) : (
          <Switch
            value={connected}
            disabled={disabled}
            onValueChange={(next) => {
              if (next) {
                onConnect();
              } else {
                setIntegrationConnected(item.id, false, uid).catch(() => {});
              }
            }}
            trackColor={{ false: C.gray, true: alpha(C.green, 0.46) }}
            thumbColor={connected ? C.green : C.gray}
          />
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {isRingConn ? (
          <>
            <Chip text={ringStatusText} color={!healthDependencyConnected ? C.amber : ringDetected ? C.green : C.amber} />
            {ringDetected ? (
              <Text style={{ color: C.muted, fontWeight: "500" }}>
                Last synced: {formatLastSync(conn?.lastSyncedAt)}
              </Text>
            ) : null}
            <Pressable
              onPress={onConnect}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: alpha(C.purple, 0.18),
                borderWidth: 1,
                borderColor: alpha(C.purple, 0.34),
              }}
            >
              <Text style={{ color: C.text, fontWeight: "600" }}>
                {healthDependencyConnected
                  ? "View setup →"
                  : `Connect ${ringConnPlatformLabel()} →`}
              </Text>
            </Pressable>
          </>
        ) : connected ? (
          <>
            <Chip
              text={
                status === "error"
                  ? "⚠ Error"
                  : status === "warning"
                  ? "⚠ Reconnect needed"
                  : status === "syncing"
                  ? "⟳ Syncing"
                  : "Connected"
              }
              color={statusColor}
            />
            <Text style={{ color: statusColor, fontWeight: "500" }}>{syncLabel}</Text>
            {typeof battery === "number" ? (
              <Text style={{ color: C.muted, fontWeight: "500" }}>
                Ring battery: {Math.round(battery)}% 🔋
              </Text>
            ) : null}
          </>
        ) : implemented ? (
          <Pressable
            onPress={onConnect}
            disabled={hiddenByPlatform}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: alpha(C.purple, 0.18),
              borderWidth: 1,
              borderColor: alpha(C.purple, 0.34),
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600" }}>Connect →</Text>
          </Pressable>
        ) : (
          <Chip text="Coming soon" color={C.muted} />
        )}
      </View>
    </Pressable>
  );
}

function DetailSheet({
  item,
  snapshot,
  uid,
  onClose,
}: {
  item: IntegrationDef | null;
  snapshot: IntegrationSnapshot;
  uid?: string;
  onClose: () => void;
}) {
  const C = useC();
  if (!item) return null;
  const conn = snapshot.connections[item.id];
  const latest = conn?.latestValues;
  const isRingConn = item.id === "ringconn";
  const dependencyConnected =
    Platform.OS === "ios"
      ? !!snapshot.connections.apple_health?.connected
      : !!snapshot.connections.google_fit?.connected;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.62)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.hairline,
            padding: 18,
            gap: 14,
            maxHeight: "86%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                backgroundColor: item.iconBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon as any} size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 20 }}>
                {item.name}
              </Text>
              <Text style={{ color: C.muted, fontWeight: "500", marginTop: 2 }}>
                {item.description}
              </Text>
            </View>
            <Pressable onPress={onClose} style={iconButton(C)}>
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          </View>

          {isRingConn ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: C.card2,
                borderWidth: 1,
                borderColor: C.hairline,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: C.text, fontWeight: "600" }}>
                How this works
              </Text>
              <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 18 }}>
                RingConn doesn&apos;t offer a direct API yet. We read your ring&apos;s
                data through {ringConnPlatformLabel()}, which RingConn already
                syncs to. This is the same data — just a different path.
              </Text>
              <Text style={{ color: C.text, fontWeight: "600", marginTop: 4 }}>
                Setup
              </Text>
              {[
                "Open the RingConn app on your phone",
                Platform.OS === "ios"
                  ? "Go to Settings → Health → Enable Apple Health sync"
                  : "Go to Settings → Health → Enable Health Connect sync",
                "That's it — your data syncs automatically",
              ].map((step, idx) => (
                <View key={step} style={{ flexDirection: "row", gap: 10 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: alpha(C.purple, 0.18),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: C.text, fontWeight: "600", fontSize: 11 }}>
                      {idx + 1}
                    </Text>
                  </View>
                  <Text style={{ color: C.muted, fontWeight: "500", flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}
              <Text style={{ color: C.text, fontWeight: "600", marginTop: 2 }}>
                Metrics passed through
              </Text>
              <Text style={{ color: C.muted, fontWeight: "500" }}>
                HR · HRV · SpO₂ · Steps · Sleep · Calories · Skin temperature
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://help.ringconn.com").catch(() => {})
                }
                style={{ alignSelf: "flex-start", paddingVertical: 4 }}
              >
                <Text style={{ color: C.muted, fontWeight: "600" }}>
                  How to enable in RingConn app →
                </Text>
              </Pressable>
            </View>
          ) : null}

          {conn?.connected ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: C.card2,
                borderWidth: 1,
                borderColor: C.hairline,
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: C.text, fontWeight: "600" }}>
                Latest sync
              </Text>
              <Text style={{ color: C.muted, fontWeight: "500" }}>
                {getConnectionSyncLabel(snapshot, conn)}
              </Text>
              {item.id === "ringconn" ? <LatestValuesGrid values={latest} /> : null}
            </View>
          ) : null}

          <Text style={{ color: C.text, fontWeight: "600" }}>Data fields read</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {item.fields.map((f) => (
              <Chip key={f} text={f} color={item.id === "ringconn" ? C.teal : C.purple} />
            ))}
          </View>

          {conn?.connected && !isRingConn ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: C.card2,
                borderWidth: 1,
                borderColor: C.hairline,
                padding: 12,
                gap: 10,
              }}
            >
              <ToggleRow
                title="Use global sync setting"
                subtitle={`Currently ${conn.useGlobalSync === false ? "overriding" : "following"} the global ${formatSyncInterval(snapshot.settings.frequency)} interval.`}
                value={conn.useGlobalSync !== false}
                onChange={(v) =>
                  updateIntegrationConnection(item.id, { useGlobalSync: v })
                }
              />
              {conn.useGlobalSync === false ? (
                <>
                  <SettingLabel title="Integration sync interval" />
                  <Segmented
                    value={conn.overrideFrequency || snapshot.settings.frequency}
                    options={frequencyOptions.map((x) => ({
                      key: x,
                      label: formatSyncInterval(x),
                    }))}
                    onChange={(v) =>
                      updateIntegrationConnection(item.id, {
                        overrideFrequency: v as SyncFrequency,
                      })
                    }
                  />
                </>
              ) : null}
            </View>
          ) : null}

          <View
            style={{
              borderRadius: 18,
              backgroundColor: C.card2,
              borderWidth: 1,
              borderColor: C.hairline,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600" }}>Data flow</Text>
            <Text style={{ color: C.muted, fontWeight: "500", lineHeight: 18 }}>
              This app reads approved fields from {item.name}. It never writes
              back without your permission.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {item.primaryEligible && conn?.connected ? (
              <Pressable
                onPress={() => markPrimaryIntegration(item.id)}
                style={[primaryButton(C), { flex: 1 }]}
              >
                <Text style={{ color: C.text, fontWeight: "600" }}>
                  Set as primary
                </Text>
              </Pressable>
            ) : null}
            {conn?.connected && !isRingConn ? (
              <Pressable
                onPress={() =>
                  runIntegrationSync(uid, {
                    reason: "manual",
                    force: true,
                    ids: [item.id],
                  })
                }
                style={[
                  {
                    minHeight: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: C.card2,
                    borderWidth: 1,
                    borderColor: C.hairline,
                    paddingHorizontal: 14,
                    flex: 1,
                  },
                ]}
              >
                <Text style={{ color: C.text, fontWeight: "600" }}>Sync now</Text>
              </Pressable>
            ) : null}
            {isRingConn && !dependencyConnected ? (
              <Pressable
                onPress={() => {
                  onClose();
                }}
                style={[
                  {
                    minHeight: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: alpha(C.purple, 0.24),
                    borderWidth: 1,
                    borderColor: alpha(C.purple, 0.38),
                    paddingHorizontal: 14,
                    flex: 1,
                  },
                ]}
              >
                <Text style={{ color: C.text, fontWeight: "600" }}>
                  Connect {ringConnPlatformLabel()} →
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LatestValuesGrid({
  values }: { values?: IntegrationLatestValues }) {
  const C = useC();
  if (!values) return null;
  const rows = [
    values.recoveryScore != null
      ? ["Recovery", `${Math.round(values.recoveryScore)}%`, "Estimated from your RingConn data"]
      : null,
    values.hrvMs != null
      ? ["HRV", `${Math.round(values.hrvMs)} ms`, values.sourceTags?.hrv?.via ? `via ${values.sourceTags.hrv.via}` : undefined]
      : null,
    values.restingHeartRateBpm != null
      ? [
          "Resting HR",
          `${Math.round(values.restingHeartRateBpm)} bpm`,
          values.sourceTags?.restingHeartRate?.via
            ? `via ${values.sourceTags.restingHeartRate.via}`
            : undefined,
        ]
      : null,
    values.stressScore != null ? ["Stress", `${Math.round(values.stressScore)}`] : null,
    values.steps != null ? ["Steps", `${Math.round(values.steps).toLocaleString()}`] : null,
    values.activeCalories != null
      ? ["Active burn", `${Math.round(values.activeCalories)} kcal`]
      : null,
    values.bloodOxygenPct != null
      ? [
          "SpO₂",
          `${Math.round(values.bloodOxygenPct)}%`,
          values.sourceTags?.bloodOxygen?.via
            ? `via ${values.sourceTags.bloodOxygen.via}`
            : undefined,
        ]
      : null,
    values.batteryLevel != null
      ? ["Battery", `${Math.round(values.batteryLevel)}%`]
      : null,
  ].filter(Boolean) as Array<[string, string, string?]>;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {rows.map(([label, value, note]) => (
        <View
          key={label}
          style={{
            minWidth: "47%",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.hairline,
            backgroundColor: alpha(C.purple, 0.08),
            padding: 10,
            gap: 3,
          }}
        >
          <Text style={{ color: C.muted, fontWeight: "500", fontSize: 11 }}>
            {label}
          </Text>
          <Text style={{ color: C.text, fontWeight: "600" }}>{value}</Text>
          {note ? (
            <Text style={{ color: C.muted, fontWeight: "500", fontSize: 11 }}>
              {note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const C = useC();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: 10,
              minHeight: 34,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? alpha(C.purple, 0.28) : C.card2,
              borderWidth: 1,
              borderColor: active ? alpha(C.purple, 0.42) : C.hairline,
            }}
          >
            <Text style={{ color: C.text, fontWeight: "600", fontSize: 12 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const C = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <SettingLabel title={title} subtitle={subtitle} />
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.gray, true: alpha(C.purple, 0.42) }}
        thumbColor={value ? C.purple : C.gray}
      />
    </View>
  );
}

function Chip({
  text, color }: { text: string; color: string }) {
  const C = useC();
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: alpha(color, 0.14),
        borderWidth: 1,
        borderColor: alpha(color, 0.28),
      }}
    >
      <Text
        style={{
          color: color === C.muted ? C.muted : C.text,
          fontWeight: "600",
          fontSize: 11,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function Note({
  text }: { text: string }) {
  const C = useC();
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 11,
        backgroundColor: alpha(C.amber, 0.1),
        borderWidth: 1,
        borderColor: alpha(C.amber, 0.24),
      }}
    >
      <Text style={{ color: C.text, fontWeight: "500", lineHeight: 18 }}>
        {text}
      </Text>
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
