import { useAccountStorage } from '@/services/local/accountStore';
import { useSomataTheme } from "@/components/somata/theme";
import {
  INTEGRATIONS,
  describeSyncInterval,
  formatLastSync, formatSyncInterval,
  getConnectionSyncLabel,
  getGlobalSyncStatus,
  markPrimaryIntegration, runIntegrationSync,
  setIntegrationConnected,
  updateIntegrationConnection,
  updateIntegrationSettings,
  type ConflictPolicy,
  type IntegrationDef,
  type IntegrationSnapshot,
  type SyncFrequency
} from '@/services/integrations';
import { useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import { Button, Choice, Heading, Item, Metric, Panel, TaskPage, TaskSheet } from './TaskUI';
const frequencies: SyncFrequency[] = ['30min', '1hour', '2hours', '4hours', 'manual'];
const conflicts: { value: ConflictPolicy; label: string; }[] = [{ value: 'highest', label: 'Highest value' }, { value: 'recent', label: 'Most recent' }, { value: 'apple', label: 'Prefer Apple Health' }, { value: 'ask', label: 'Ask me' }];
const platformHealth = () => Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
function Toggle({ title, detail, value, onChange, disabled = false }: { title: string; detail?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void; }) {
  const { D, F } = useSomataTheme();

  return <Item title={title} detail={detail} action={<Switch accessibilityLabel={title} disabled={disabled} value={value} onValueChange={onChange} trackColor={{ false: D.raised, true: D.teal }} />} />;
}
export function ConnectionsDesk({ snapshot, uid, onBack, onHistory }: { snapshot: IntegrationSnapshot; uid?: string; onBack: () => void; onHistory: () => void; }) {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const [section, setSection] = useState<'sources' | 'sync'>('sources'); const [selected, setSelected] = useState<IntegrationDef | null>(null);
  const settings = snapshot.settings; const syncState = getGlobalSyncStatus(snapshot);
  const conn = selected ? snapshot.connections[selected.id] : undefined;
  const dependencyConnected = Platform.OS === 'ios' ? !!snapshot.connections.apple_health?.connected : !!snapshot.connections.google_fit?.connected;
  const latest = conn?.latestValues;
  return <><TaskPage title="Connected to you." section="Health / connections" onBack={onBack}>

    <Panel accent>
      <Heading title={syncState.text} detail={`Last full sync · ${formatLastSync(settings.lastFullSyncAt)}`} />

      <View style={F.wrap}>
        <Button label="Sync now" primary icon="sync-outline" onPress={() => runIntegrationSync(uid, { reason: 'manual', force: true }, localStore)} />
        <Button label="Sync history" onPress={onHistory} />
      </View>
    </Panel>

    <View style={F.wrap}>
      <Choice label="Data sources" selected={section === 'sources'} onPress={() => setSection('sources')} />
      <Choice label="Sync preferences" selected={section === 'sync'} onPress={() => setSection('sync')} />
    </View>

    {section === 'sources' ? <>
      {!settings.onboardingDone && <Panel>
        <Heading title="Choose your sources" detail="Select a supported app or device, then review its requested permissions." />
        <Button label="Start choosing sources" onPress={() => updateIntegrationSettings({ onboardingDone: true }, localStore)} />
      </Panel>}
      {(['health', 'wearable', 'scale'] as const).map(group => <View key={group} style={{ gap: 12 }}>
        <Heading title={group === 'health' ? 'Health platforms' : group === 'wearable' ? 'Wearables' : 'Smart scales'} />

        {INTEGRATIONS.filter(item => item.group === group).map(item => {
          const c = snapshot.connections[item.id]; const connected = !!c?.connected; const implemented = item.id === 'apple_health' || item.id === 'ringconn';
          const hidden = (item.platform === 'ios' && Platform.OS !== 'ios') || (item.platform === 'android' && Platform.OS !== 'android');
          return <Panel key={item.id}>
            <Item title={item.name} icon={item.icon as any} detail={hidden ? `Available on ${item.platform === 'ios' ? 'iOS' : 'Android'}` : item.description}
              value={c?.primary ? 'Primary source' : connected ? getConnectionSyncLabel(snapshot, c) : implemented ? 'Not connected' : 'Connection unavailable'} onPress={() => setSelected(item)} />

            {item.id === 'ringconn' ? <><Text style={F.caption}>{!dependencyConnected ? `Requires ${platformHealth()}` : connected ? `Active via ${platformHealth()}` : 'Not detected'}</Text>
              <Button label={dependencyConnected ? 'View setup' : `Connect ${platformHealth()}`} onPress={() => { if (item.group === 'health' && !dependencyConnected) setSelected(INTEGRATIONS.find(x => x.id === 'apple_health') || item); else if (item.group === 'health') setSelected(item); else void setIntegrationConnected(item.id, true, uid, undefined, localStore).catch(() => { }); }} /></> :
              <Toggle disabled={hidden || (!implemented && !connected)} title={`Connect ${item.name}`} detail={connected ? `Last synced ${formatLastSync(c?.lastSyncedAt)}` : undefined} value={connected}
                onChange={value => { if (hidden || (!implemented && !connected)) return; void setIntegrationConnected(item.id, value, uid, undefined, localStore).catch(() => { }); }} />}

            {typeof (c?.latestValues?.batteryLevel ?? c?.batteryLevel) === 'number' && <Text style={F.caption}>Battery {Math.round((c?.latestValues?.batteryLevel ?? c?.batteryLevel)!)}%</Text>}

          </Panel>;
        })}
      </View>)}
      <Text style={F.caption}>Review data fields in each source. If two connected apps log the same food, disable one source to avoid duplicate entries.</Text>
    </> : <>
      <Toggle title="Automatic sync" value={settings.autoSync} onChange={value => updateIntegrationSettings({ autoSync: value }, localStore)} />
      <Heading title="Sync interval" detail={describeSyncInterval(settings.frequency)} /><View style={F.wrap}>
        {frequencies.map(value => <Choice key={value} label={formatSyncInterval(value)} selected={settings.frequency === value} onPress={() => updateIntegrationSettings({ frequency: value }, localStore)} />)}
      </View>
      <Heading title="Battery & connectivity" />
      <Toggle title="Sync when app is closed" value={settings.backgroundSync} onChange={v => updateIntegrationSettings({ backgroundSync: v }, localStore)} />
      <Toggle title="Sync on mobile data" value={settings.cellularSync} onChange={v => updateIntegrationSettings({ cellularSync: v }, localStore)} />
      <Toggle title="Pause below 20% battery" value={settings.lowBatteryPause} onChange={v => updateIntegrationSettings({ lowBatteryPause: v }, localStore)} />
      <Toggle title="Sync when opening the app" value={settings.syncOnAppOpen} onChange={v => updateIntegrationSettings({ syncOnAppOpen: v }, localStore)} />
      <Heading title="When sources disagree" detail="Choose which step count to use." /><View style={F.wrap}>
        {conflicts.map(item => <Choice key={item.value} label={item.label} selected={settings.conflictPolicy === item.value} onPress={() => updateIntegrationSettings({ conflictPolicy: item.value }, localStore)} />)}
      </View>
    </>}

  </TaskPage>
    <TaskSheet title={selected?.name || 'Connection'} visible={!!selected} onClose={() => setSelected(null)}>

      {selected && <><Text style={F.body}>{selected.description}</Text><Heading title="Data fields read" /><View style={F.wrap}>
        {selected.fields.map(field => <Text key={field} style={{ ...F.body, padding: 10, borderRadius: 10, backgroundColor: D.card }}>{field}</Text>)}
      </View>
        {selected.id === 'ringconn' && <Panel>
          <Heading title={`Through ${platformHealth()}`} detail="This connection reads RingConn records shared through your phone’s health platform." />

          <Text style={F.body}>1. Open RingConn on your phone.</Text>
          <Text style={F.body}>2. In Settings → Health, enable {platformHealth()} sync.</Text>
          <Text style={F.body}>3. Return here to sync approved data.</Text>

          <Button label="Open RingConn setup guide" icon="open-outline" onPress={() => Linking.openURL('https://help.ringconn.com').catch(() => { })} />
        </Panel>}
        {!!conn?.connected && <><Heading title="Latest sync" detail={getConnectionSyncLabel(snapshot, conn)} />
          {selected.id === 'ringconn' && latest && <View style={F.wrap}>
            {([
              latest.recoveryScore != null ? ['Recovery', `${Math.round(latest.recoveryScore)}%`, 'Estimated from your RingConn data'] : null,
              latest.hrvMs != null ? ['HRV', `${Math.round(latest.hrvMs)} ms`, latest.sourceTags?.hrv?.via ? `via ${latest.sourceTags.hrv.via}` : undefined] : null,
              latest.restingHeartRateBpm != null ? ['Resting HR', `${Math.round(latest.restingHeartRateBpm)} bpm`, latest.sourceTags?.restingHeartRate?.via ? `via ${latest.sourceTags.restingHeartRate.via}` : undefined] : null,
              latest.stressScore != null ? ['Stress', `${Math.round(latest.stressScore)}`] : null,
              latest.steps != null ? ['Steps', `${Math.round(latest.steps).toLocaleString()}`] : null,
              latest.activeCalories != null ? ['Active burn', `${Math.round(latest.activeCalories)} kcal`] : null,
              latest.bloodOxygenPct != null ? ['SpO₂', `${Math.round(latest.bloodOxygenPct)}%`, latest.sourceTags?.bloodOxygen?.via ? `via ${latest.sourceTags.bloodOxygen.via}` : undefined] : null,
              latest.batteryLevel != null ? ['Battery', `${Math.round(latest.batteryLevel)}%`] : null,
            ].filter(Boolean) as [string, string, string?][]).map(([label, value, detail]) => <Metric key={label} label={label} value={value} detail={detail} />)}
          </View>}
          {selected.id !== 'ringconn' && <><Toggle title="Use global sync setting" value={conn.useGlobalSync !== false} onChange={v => updateIntegrationConnection(selected.id, { useGlobalSync: v }, localStore)} />
            {conn.useGlobalSync === false && <View style={F.wrap}>
              {frequencies.map(value => <Choice key={value} label={formatSyncInterval(value)} selected={(conn.overrideFrequency || settings.frequency) === value} onPress={() => updateIntegrationConnection(selected.id, { overrideFrequency: value }, localStore)} />)}
            </View>}
            <Button label="Sync this source" primary onPress={() => runIntegrationSync(uid, { reason: 'manual', force: true, ids: [selected.id] }, localStore)} /></>}
          {selected.primaryEligible && <Button label="Set as primary source" onPress={() => markPrimaryIntegration(selected.id, localStore)} />}</>}
        <Text style={F.caption}>Somata reads approved fields from this source. Permission and sync behavior are managed by the existing integration.</Text>
        {selected.id === 'ringconn' && !dependencyConnected && <Button label={`Connect ${platformHealth()}`} onPress={() => setSelected(null)} />}</>}

    </TaskSheet></>;
}
