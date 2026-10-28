import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Empty, Heading, Metric, Panel, TaskPage } from "@/components/somata/TaskUI";
import { SomataTaskAppearance, useTaskPresentation } from "@/components/designPreview/Appearance";
import { FlowNotice } from "@/components/homeFlows/FlowUI";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";


import {
  clearSyncHistory,
  formatLastSync,
  INTEGRATIONS,
  subscribeIntegrations,
  type IntegrationSnapshot
} from "@/services/integrations";

export default function SyncHistoryScreen() {
  return <SomataTaskAppearance><SyncHistoryContent /></SomataTaskAppearance>;
}

function SyncHistoryContent() {
  const localStore = useAccountStorage();
  const { D, F, t } = useTaskPresentation();

  const router = useRouter();
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);

  useEffect(() => subscribeIntegrations(setSnapshot, localStore), []);

  const history = snapshot?.settings.history || [];

  return <TaskPage title="Sync history" section="Connections / your records" subtitle="A journal of what your connected sources returned." onBack={() => router.back()}>
    {!snapshot ? <FlowNotice title="Loading sync events…" /> : !history.length ?
      <Empty title="Your journal is clear" detail="Connect a source and run a sync to see its recorded events." /> : <>
      <Panel accent>
        <View style={{ ...F.row, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={F.eyebrow}>ON THIS DEVICE</Text>
            <Text style={{ ...F.value, fontSize: 38 }}>{history.length} <Text style={F.body}>recorded events</Text></Text>
          </View>
          <Ionicons name="sync-outline" color={t.action.link} size={32} />
        </View>
        <Text style={F.body}>Latest record · {formatLastSync(history[0].finishedAt)}</Text>
      </Panel>
      <Heading title="Event journal" detail="Most recent first · saved for this account" />
      {history.map(event => <Panel key={event.id}>
        <View style={{ ...F.row, alignItems: "flex-start" }}>
          <View style={{ backgroundColor: t.surface.inset, padding: 12, borderRadius: 14 }}>
            <Ionicons name={event.failed.length ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              color={event.failed.length ? t.status.warning : t.status.success} size={24} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ ...F.caption, color: event.failed.length ? t.status.warning : t.status.success, fontWeight: "700" }}>
              {event.failed.length ? `${event.failed.length} failed` : 'Successful'}
            </Text>
            <Text style={F.heading}>{event.reason.replace('_', ' ')}</Text>
            <Text style={F.caption}>{formatLastSync(event.finishedAt)}</Text>
          </View>
        </View>
        <Text style={F.body}>{event.integrations.map(id => INTEGRATIONS.find(x => x.id === id)?.name || id).join(' · ')}</Text>
        <View style={F.wrap}>
          <Metric label="Data points received" value={String(event.dataPointsReceived)} />
          <Metric label="Duration" value={`${Math.max(1, Math.round(event.durationMs / 1000))}s`} />
        </View>
        {!!event.failed.length && <FlowNotice error title="Some sources did not sync" detail={`Failed: ${event.failed.map(id => INTEGRATIONS.find(x => x.id === id)?.name || id).join(', ')}`} />}
      </Panel>)}
      <View style={{ gap: 10, paddingTop: 8 }}>
        <Text style={F.caption}>Clear this account's sync journal on this device.</Text>
        <Button label="Clear history" danger icon="trash-outline" onPress={() => clearSyncHistory(localStore)} />
      </View>
    </>}
  </TaskPage>;
}
