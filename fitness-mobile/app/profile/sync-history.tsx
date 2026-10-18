import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Empty, Heading, Metric, Panel, TaskPage } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";

import {
  clearSyncHistory,
  formatLastSync,
  INTEGRATIONS,
  subscribeIntegrations,
  type IntegrationSnapshot
} from "@/services/integrations";

function useC() {
  const { colors } = useProfileFlowTheme();
  return {
    bg: colors.background as string,
    card: colors.surface1 as string,
    card2: colors.surface2 as string,
    text: colors.textPrimary as string,
    muted: colors.textTertiary as string,
    hairline: colors.border as string,
    purple: colors.primary as string,
    green: colors.success as string,
    amber: colors.warning as string,
    red: colors.danger as string,
  };
}

function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(
    h.slice(4, 6),
    16
  )},${a})`;
}

export default function SyncHistoryScreen() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const C = useC();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);

  useEffect(() => subscribeIntegrations(setSnapshot, localStore), []);

  const history = snapshot?.settings.history || [];

  return (<TaskPage title="Your sync journal." section="Connections / history" onBack={() => router.back()}
    footer={history.length ? <Button label="Clear history" danger icon="trash-outline" onPress={() => clearSyncHistory(localStore)} /> : undefined}>

    {!snapshot ? <Empty title="Loading sync events…" /> : !history.length ? <Empty title="No sync history yet" detail="Connect a source and run a sync to see its recorded events." /> : <>
      <View style={F.wrap}>
        <Metric label="Recorded events" value={String(history.length)} />
      </View>
      <View>
        {history.map(event => <View key={event.id} style={{ flexDirection: 'row', gap: 16 }}>

          <View style={{ alignItems: 'center', width: 24 }}>
            <Ionicons name={event.failed.length ? 'alert-circle-outline' : 'checkmark-circle'} color={event.failed.length ? D.amber : D.teal} size={23} />
            <View style={{ flex: 1, width: 1, backgroundColor: D.line }} />
          </View>

          <View style={{ flex: 1, gap: 12, paddingBottom: 24 }}>
            <Text style={F.caption}>{formatLastSync(event.finishedAt)}</Text>
            <Heading title={event.reason.replace('_', ' ')}
              detail={event.integrations.map(id => INTEGRATIONS.find(x => x.id === id)?.name || id).join(' · ')} />

            <Panel>
              <Text style={{ ...F.heading, color: event.failed.length ? D.amber : D.lime }}>{event.failed.length ? `${event.failed.length} failed` : 'Successful'}</Text>

              <Text style={F.body}>{event.dataPointsReceived} data points · {Math.max(1, Math.round(event.durationMs / 1000))}s</Text>

              {!!event.failed.length && <Text style={F.caption}>Failed: {event.failed.map(id => INTEGRATIONS.find(x => x.id === id)?.name || id).join(', ')}</Text>}
            </Panel>
          </View>

        </View>)}
      </View></>}
  </TaskPage>
  );
}
