import { useAccountStorage } from '@/services/local/accountStore';
import { Button, Empty, Field, Heading, IconButton, TaskPage, TaskSheet } from "@/components/somata/TaskUI";
import { useSomataTheme } from "@/components/somata/theme";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useProfileFlowTheme } from "@/components/accountSettings/useProfileFlowTheme";
import {
  addPhoto,
  deletePhoto,
  getPhotos,
  hasSeenProgressPhotoPrivacyNotice,
  markProgressPhotoPrivacyNoticeSeen,
  type ProgressPhoto,
} from "@/services/progressPhotos";

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ProgressPhotosScreen() {
  const localStore = useAccountStorage();
  const { D, F } = useSomataTheme();

  const { colors } = useProfileFlowTheme();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const rows = await getPhotos(localStore);
    setPhotos(rows);
    setBaselineId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null);
    setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[rows.length - 1]?.id || null);
  }, []);

  useEffect(() => {
    refresh().catch(() => { });
    hasSeenProgressPhotoPrivacyNotice(localStore).then((seen) => {
      if (!seen) setPrivacyOpen(true);
    });
  }, [refresh]);

  const baseline = photos.find((item) => item.id === baselineId) || photos[0] || null;
  const current = photos.find((item) => item.id === selectedId) || photos[photos.length - 1] || null;

  async function startAdd(mode: "camera" | "library") {
    try {
      setPickerOpen(false);
      await wait(220);

      const permission =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          mode === "camera" ? "Camera access needed" : "Photo library access needed",
          mode === "camera"
            ? "Allow camera access to take a progress photo."
            : "Allow photo access to choose a progress photo."
        );
        return;
      }

      const result =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.95,
          })
          : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.95,
          });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPendingUri(result.assets[0].uri);
    } catch {
      Alert.alert(
        mode === "camera" ? "Couldn’t open camera" : "Couldn’t open photo library",
        "Try again in a moment."
      );
    }
  }

  async function confirmAdd() {
    if (!pendingUri) return;
    await addPhoto(pendingUri, note, localStore);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
    setPendingUri(null);
    setNote("");
    refresh().catch(() => { });
  }

  async function removePhoto(photo: ProgressPhoto) {
    Alert.alert("Delete this photo?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePhoto(photo.id, localStore);
          setViewerIndex(null);
          refresh().catch(() => { });
        },
      },
    ]);
  }

  const weightDelta = baseline && current && baseline.weight != null && current.weight != null
    ? current.weight - baseline.weight
    : null;

  return (<><TaskPage title="See your own story" section="Progress photos" subtitle="A private collection stored on this device." onBack={() => router.back()} action={<IconButton label="Add progress photo" icon="add" onPress={() => setPickerOpen(true)} />}>

    {!photos.length ? <Empty title="Your collection starts with one photo" detail="Choose an image or take a photo when you feel ready." /> : <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[{ label: 'Baseline', photo: baseline }, { label: 'Selected', photo: current }].map(({ label, photo }) => <View key={label} style={{ flex: 1, gap: 8 }}>
          <Text style={F.eyebrow}>{label}</Text>
          {photo && <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label} photo`} onPress={() => setViewerIndex(photos.findIndex(p => p.id === photo.id))}>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: 20 }} />
          </Pressable>}
          <Text style={F.caption}>{photo ? formatDate(photo.date) : '—'}</Text>
        </View>)}
      </View>{weightDelta != null && <Text style={F.body}>Recorded weight difference · {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} lb</Text>}
      <Heading title="Photo journal" detail="Tap to compare. Hold a photo to set it as your baseline." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((photo, i) => <View key={photo.id} style={{ width: '47%', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Select photo from ${photo.date}`} onPress={() => setSelectedId(photo.id)} onLongPress={() => setBaselineId(photo.id)}>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: 16, borderWidth: selectedId === photo.id ? 2 : 0, borderColor: D.lime }} />
          </Pressable>
          <Text style={F.caption}>{formatDate(photo.date)}{baselineId === photo.id ? ' · Baseline' : ''}</Text>
          {!!photo.note && <Text style={F.body}>{photo.note}</Text>}
          <Button label="Set baseline" onPress={() => setBaselineId(photo.id)} />
          <Button label="View photo" onPress={() => setViewerIndex(i)} />
        </View>)}
      </View></>}

  </TaskPage><TaskSheet title="Add to your journal" visible={pickerOpen} onClose={() => setPickerOpen(false)}>
      <Button label="Take photo" onPress={() => startAdd('camera')} />
      <Button label="Choose from library" onPress={() => startAdd('library')} />
    </TaskSheet>
    <TaskSheet title="Keep this moment" visible={!!pendingUri} onClose={() => setPendingUri(null)}>
      {pendingUri && <Image source={{ uri: pendingUri }} style={{ width: '100%', height: 260, borderRadius: 20 }} resizeMode="contain" />}
      <Field label="Note · optional" multiline value={note} onChangeText={setNote} />
      <Button primary label="Save photo" onPress={confirmAdd} />
      <Button label="Cancel" onPress={() => setPendingUri(null)} />
    </TaskSheet>
    <TaskSheet title="Private by default" visible={privacyOpen} onClose={() => setPrivacyOpen(false)}>
      <Text style={F.body}>Photos are stored only on your device. They are never uploaded or shared.</Text>
      <Button primary label="Got it" onPress={async () => { await markProgressPhotoPrivacyNoticeSeen(localStore); setPrivacyOpen(false); }} />
    </TaskSheet>
    <TaskSheet title={viewerIndex != null && photos[viewerIndex] ? formatDate(photos[viewerIndex].date) : 'Photo'} visible={viewerIndex != null} onClose={() => setViewerIndex(null)}>
      {viewerIndex != null && photos[viewerIndex] && <><Image source={{ uri: photos[viewerIndex].uri }} style={{ width: '100%', height: 420, borderRadius: 16 }} resizeMode="contain" /><Text style={F.body}>{photos[viewerIndex].note}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton label="Previous photo" icon="arrow-back" disabled={viewerIndex <= 0} onPress={() => setViewerIndex(viewerIndex - 1)} />
        <IconButton label="Next photo" icon="arrow-forward" disabled={viewerIndex >= photos.length - 1} onPress={() => setViewerIndex(viewerIndex + 1)} />
      </View><Button danger label="Delete photo" onPress={() => removePhoto(photos[viewerIndex])} /></>}
    </TaskSheet></>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  addPill: {
    minWidth: 72,
    height: 44,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addPillText: { fontSize: 13, fontWeight: "600" },
  compareRow: { flexDirection: "row", gap: 12 },
  compareImage: { width: "100%", height: 200, borderRadius: 12 },
  labelChip: {
    borderWidth: 0,
    borderRadius: 999,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  labelChipText: { fontSize: 11, fontWeight: "300" },
  deltaChip: {
    alignSelf: "center",
    height: 30,
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  singleState: { alignItems: "center", gap: 10, paddingVertical: 20 },
  emptyText: { fontSize: 12, fontWeight: "300" },
  timeline: { gap: 12 },
  timelineThumb: { width: 64, height: 80, borderRadius: 10 },
  timelineDate: { fontSize: 10, fontWeight: "300", textAlign: "center" },
  timelineWeight: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0,
    padding: 16,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  sheetRow: {
    height: 48,
    borderRadius: 14,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowText: {
    fontSize: 14,
    fontWeight: "500",
  },
  pendingPreview: { width: "100%", aspectRatio: 3 / 4, borderRadius: 16 },
  noteInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    textAlignVertical: "top",
  },
  confirmButton: {
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  ghostButton: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { fontSize: 14, fontWeight: "500" },
  noticeCard: {
    margin: 24,
    borderRadius: 24,
    borderWidth: 0,
    padding: 20,
    gap: 14,
    alignSelf: "center",
  },
  noticeTitle: { fontSize: 18, fontWeight: "500", textAlign: "center" },
  noticeCopy: { fontSize: 12, fontWeight: "300", textAlign: "center", lineHeight: 18 },
  viewerRoot: { flex: 1 },
  viewerHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fullscreenImage: { width: "100%", height: "100%" },
});
