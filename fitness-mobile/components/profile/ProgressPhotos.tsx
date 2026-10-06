import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/content/ThemeProvider";
import type { ProgressPhoto } from "@/services/progressPhotos";

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProgressPhotosCard({
  photos,
  onOpen,
  onAdd,
}: {
  photos: ProgressPhoto[];
  onOpen: () => void;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const latest = photos.slice(-4);

  return (
    <Pressable
      onPress={photos.length ? onOpen : onAdd}
      style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="camera-outline" size={16} color={colors.textTertiary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Progress Photos</Text>
        </View>
        <Pressable onPress={onAdd} hitSlop={8}>
          <Text style={[styles.link, { color: colors.accentMuted }]}>Add →</Text>
        </Pressable>
      </View>

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {latest.map((photo) => (
            <Pressable key={photo.id} onPress={onOpen} style={styles.thumbBlock}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <Text style={[styles.date, { color: colors.textTertiary }]}>{formatDate(photo.date)}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onAdd}
            style={[styles.addCard, { backgroundColor: colors.surface3, borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={[styles.addText, { color: colors.textSecondary }]}>Add</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="camera-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.emptyCopy, { color: colors.textTertiary }]}>
            Take your first progress photo
          </Text>
          <Pressable
            onPress={onAdd}
            style={[styles.emptyButton, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.accentMuted }]}>+ Add photo</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  link: {
    fontSize: 12,
    fontWeight: "500",
  },
  strip: {
    gap: 10,
  },
  thumbBlock: {
    width: 56,
    gap: 6,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 10,
  },
  date: {
    fontSize: 10,
    fontWeight: "300",
    textAlign: "center",
  },
  addCard: {
    width: 56,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addText: {
    fontSize: 10,
    fontWeight: "500",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
  },
  emptyCopy: {
    fontSize: 12,
    fontWeight: "300",
  },
  emptyButton: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
