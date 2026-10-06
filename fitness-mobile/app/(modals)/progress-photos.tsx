import { FlowAtmosphere } from "@/components/accountSettings/FlowAtmosphere";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

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
    const rows = await getPhotos();
    setPhotos(rows);
    setBaselineId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null);
    setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[rows.length - 1]?.id || null);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    hasSeenProgressPhotoPrivacyNotice().then((seen) => {
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
    await addPhoto(pendingUri, note);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setPendingUri(null);
    setNote("");
    refresh().catch(() => {});
  }

  async function removePhoto(photo: ProgressPhoto) {
    Alert.alert("Delete this photo?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePhoto(photo.id);
          setViewerIndex(null);
          refresh().catch(() => {});
        },
      },
    ]);
  }

  const weightDelta = baseline && current && baseline.weight != null && current.weight != null
    ? current.weight - baseline.weight
    : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlowAtmosphere />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Progress Photos</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.addPill, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
        >
          <Text style={[styles.addPillText, { color: colors.accent }]}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {current ? (
          <View style={{ gap: 12 }}>
            <View style={styles.compareRow}>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onLongPress={() => baseline && setBaselineId(current?.id || baseline.id)}>
                  <Image source={{ uri: baseline?.uri }} style={styles.compareImage} />
                </Pressable>
                <View style={[styles.labelChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.labelChipText, { color: colors.textTertiary }]}>
                    Start · {baseline ? formatDate(baseline.date) : "—"}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onPress={() => setViewerIndex(Math.max(0, photos.findIndex((item) => item.id === current?.id)))}>
                  <Image source={{ uri: current.uri }} style={styles.compareImage} />
                </Pressable>
                <View style={[styles.labelChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.labelChipText, { color: colors.textTertiary }]}>
                    Now · {formatDate(current.date)}
                  </Text>
                </View>
              </View>
            </View>
            {weightDelta != null ? (
              <View
                style={[
                  styles.deltaChip,
                  {
                    backgroundColor: weightDelta <= 0 ? colors.surface2 : colors.surface2,
                    borderColor: weightDelta <= 0 ? colors.success : colors.warning,
                  },
                ]}
              >
                <Text
                  style={{
                    color: weightDelta <= 0 ? colors.success : colors.warning,
                    fontSize: 12,
                    fontWeight: "500",
                  }}
                >
                  {weightDelta <= 0 ? "↓" : "↑"} {Math.abs(Math.round(weightDelta))} lb
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.singleState}>
            <Ionicons name="camera-outline" size={36} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Add another photo to see your progress
            </Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setSelectedId(photo.id)}
              onLongPress={() => setBaselineId(photo.id)}
              style={{ gap: 6 }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={[
                  styles.timelineThumb,
                  {
                    borderColor: photo.id === selectedId ? colors.accent : colors.border,
                    borderWidth: photo.id === selectedId ? 1.5 : 1,
                  },
                ]}
              />
              <Text style={[styles.timelineDate, { color: colors.textTertiary }]}>{formatDate(photo.date)}</Text>
              <Text style={[styles.timelineWeight, { color: colors.textSecondary }]}>
                {photo.weight != null ? `${Math.round(photo.weight)} lb` : "—"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface2, borderColor: colors.borderElevated }]}>
            <View style={[styles.handle, { backgroundColor: colors.surface3 }]} />
            <Pressable onPress={() => startAdd("camera")} style={[styles.sheetRow, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>Take photo now</Text>
            </Pressable>
            <Pressable onPress={() => startAdd("library")} style={[styles.sheetRow, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>Choose from library</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingUri} animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setPendingUri(null)}>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setPendingUri(null)} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Crop & Confirm</Text>
            <View style={{ width: 72 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {pendingUri ? <Image source={{ uri: pendingUri }} style={styles.pendingPreview} /> : null}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.noteInput,
                { backgroundColor: colors.surface3, color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
            />
            <Pressable onPress={confirmAdd} style={[styles.confirmButton, { backgroundColor: colors.accent }]}>
              <Text style={styles.confirmButtonText}>Use photo</Text>
            </Pressable>
            <Pressable onPress={() => setPendingUri(null)} style={[styles.ghostButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={[styles.ghostText, { color: colors.textSecondary }]}>Retake</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={privacyOpen} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setPrivacyOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.noticeCard, { backgroundColor: colors.surface2, borderColor: colors.borderElevated }]}>
            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Private by default</Text>
            <Text style={[styles.noticeCopy, { color: colors.textSecondary }]}>
              Photos are stored only on your device. They are never uploaded or shared.
            </Text>
            <Pressable
              onPress={async () => {
                await markProgressPhotoPrivacyNoticeSeen();
                setPrivacyOpen(false);
              }}
              style={[styles.confirmButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.confirmButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={viewerIndex != null} transparent={false} animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setViewerIndex(null)}>
        <View style={[styles.viewerRoot, { backgroundColor: colors.background }]}>
          <View style={styles.viewerHeader}>
            <Pressable onPress={() => setViewerIndex(null)} style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => viewerIndex != null && photos[viewerIndex] && removePhoto(photos[viewerIndex])}
              style={[styles.iconCircle, { backgroundColor: colors.surface3, borderColor: colors.border }]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
          {viewerIndex != null && photos[viewerIndex] ? (
            <ScrollView
              horizontal
              pagingEnabled
              maximumZoomScale={3}
              minimumZoomScale={1}
              contentOffset={{ x: viewerIndex * 1, y: 0 }}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={{ width: "100%" as any, justifyContent: "center", alignItems: "center" }}>
                  <Image source={{ uri: photo.uri }} style={styles.fullscreenImage} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
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
